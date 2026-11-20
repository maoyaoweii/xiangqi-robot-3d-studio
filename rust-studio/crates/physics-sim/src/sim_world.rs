use crate::wheel_physics::{step_per_wheel_dynamics_with_pwm, BodyKinematicsState, WheelStepSummary, WheelStepTelemetry};
use crate::{PhysicsEnv, Piece, FIELD_DEPTH, FIELD_WIDTH, GOAL_MAX_X, GOAL_MAX_Z, GOAL_MIN_X, GOAL_MIN_Z};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::f64::consts::PI;
use xiangqi_core::{ResolvedBuild, PIECE_HEIGHT_M, PIECE_RADIUS_M};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnemyState {
    pub x: f64,
    pub z: f64,
    pub yaw: f64,
    pub v: f64,
    pub omega: f64,
    pub wheel_spin: f64,
}

#[derive(Debug, Clone)]
pub struct SimWorld {
    pub build: ResolvedBuild,
    pub env: PhysicsEnv,
    pub body: BodyKinematicsState,
    pub enemy: EnemyState,
    pub versus_mode: bool,
    pub pieces: Vec<Piece>,
    pub perceived: HashMap<String, (f64, f64, i32, bool)>,
    pub push_commit_id: Option<String>,
    pub time_s: f64,
    pub prev_step_force: f64,
    pub peak_force_n: f64,
    pub traction_max_n: f64,
    pub slip_events: u32,
    pub was_slipping: bool,
    pub energy_j: f64,
    pub last_wheel_summary: WheelStepSummary,
    pub last_wheel_tele: Vec<WheelStepTelemetry>,
}

fn lcg_next(state: &mut u64) -> f64 {
    *state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    ((*state >> 32) as f64) / (u32::MAX as f64)
}

fn normalise_angle(mut a: f64) -> f64 {
    while a > PI {
        a -= 2.0 * PI;
    }
    while a < -PI {
        a += 2.0 * PI;
    }
    a
}

pub fn create_pieces_with_layout(mut seed: u64, layout: &str) -> Vec<Piece> {
    let red_chars = ["帅", "仕", "仕", "相", "相", "车", "车", "马", "马", "炮", "炮", "兵", "兵", "兵", "兵", "兵"];
    let blk_chars = ["将", "士", "士", "象", "象", "车", "车", "马", "马", "炮", "炮", "卒", "卒", "卒", "卒", "卒"];
    let values = [10, 2, 2, 2, 2, 5, 5, 3, 3, 3, 3, 1, 1, 1, 1, 1];
    let mut pieces = Vec::with_capacity(32);

    if layout == "random_center" {
        let specs: &[(&str, i32, usize)] = &[
            ("帅", 10, 1), ("车", 5, 2), ("马", 3, 2), ("炮", 3, 2),
            ("相", 2, 2), ("仕", 2, 2), ("兵", 1, 5),
        ];
        for &is_red in &[true, false] {
            let mut idx = 0usize;
            for &(sym, val, count) in specs {
                for _ in 0..count {
                    let mut x = 1.5;
                    let mut z = 1.0;
                    for _ in 0..80 {
                        x = 1.24 + lcg_next(&mut seed) * 0.52;
                        z = 0.74 + lcg_next(&mut seed) * 0.52;
                        if pieces.iter().all(|p: &Piece| (p.x - x).hypot(p.z - z) > PIECE_RADIUS_M * 2.15) {
                            break;
                        }
                    }
                    pieces.push(Piece {
                        id: format!("{}_{}", if is_red { "r" } else { "b" }, idx),
                        is_red,
                        symbol: sym.into(),
                        value: if is_red { val } else { 0 },
                        x,
                        z,
                        vx: 0.0,
                        vz: 0.0,
                        scored: false,
                        held: false,
                    });
                    idx += 1;
                }
            }
        }
        return pieces;
    }

    for i in 0..32 {
        let is_red = i < 16;
        let idx = i % 16;
        let (x, z) = match layout {
            "scatter" => {
                let s1 = ((i as f64 + 1.0) * 12.9898).sin() * 43758.5453;
                let s2 = ((i as f64 + 37.0) * 78.233).sin() * 43758.5453;
                (0.72 + (s1 - s1.floor()) * 1.56, 0.24 + (s2 - s2.floor()) * 1.52)
            }
            "ring" => {
                let ring = if is_red { 0.34 } else { 0.52 };
                let ang = ((idx as f64) / 16.0) * PI * 2.0;
                (1.50 + ang.cos() * ring, 1.00 + ang.sin() * ring)
            }
            "corridor" => {
                let col = i % 8;
                let row = i / 8;
                (0.85 + (col as f64) * 0.185, 0.55 + (row as f64) * 0.28 + ((col % 2) as f64) * 0.06)
            }
            _ => {
                let col = i % 6;
                let row = i / 6;
                (1.25 + (col as f64) * 0.11 + (((i % 2) as f64) - 0.5) * 0.02, 0.70 + (row as f64) * 0.12)
            }
        };
        pieces.push(Piece {
            id: format!("{}_{}", if is_red { "r" } else { "b" }, idx),
            is_red,
            symbol: if is_red { red_chars[idx] } else { blk_chars[idx] }.into(),
            value: if is_red { values[idx] } else { 0 },
            x,
            z,
            vx: 0.0,
            vz: 0.0,
            scored: false,
            held: false,
        });
    }
    pieces
}

impl SimWorld {
    pub fn new(build: ResolvedBuild, env: PhysicsEnv, seed: u64, layout: &str, versus_mode: bool) -> Self {
        let pieces = create_pieces_with_layout(seed, layout);
        let start_x = 0.42;
        let start_z = 1.00;
        let start_yaw = 0.0;
        let traction_max_n = crate::compute_traction_limit_n(&build, env);
        let wheel_count = build.custom_wheels.len();
        let init_v = build.voltage;
        Self {
            build,
            env,
            body: BodyKinematicsState {
                x: start_x,
                z: start_z,
                yaw: start_yaw,
                v_fwd: 0.0,
                v_lat: 0.0,
                omega: 0.0,
                wheel_spin: 0.0,
                steer_angle: 0.0,
                pitch_rad: 0.0,
                battery_soc: 1.0,
            },
            enemy: EnemyState {
                x: 2.58,
                z: 1.0,
                yaw: PI,
                v: 0.0,
                omega: 0.0,
                wheel_spin: 0.0,
            },
            versus_mode,
            pieces,
            perceived: HashMap::new(),
            push_commit_id: None,
            time_s: 0.0,
            prev_step_force: 0.0,
            peak_force_n: 0.0,
            traction_max_n,
            slip_events: 0,
            was_slipping: false,
            energy_j: 0.0,
            last_wheel_summary: WheelStepSummary {
                total_traction_n: traction_max_n,
                peak_wheel_slip: 0.0,
                slip_count: 0,
                drive_force_n: 0.0,
                can_strafe: false,
                bus_voltage: init_v,
                total_current_a: 0.4,
                battery_pct: 100.0,
            },
            last_wheel_tele: vec![
                WheelStepTelemetry {
                    normal_n: 0.0,
                    force_long_n: 0.0,
                    force_lat_n: 0.0,
                    slip_ratio: 0.0,
                    steer_rad: 0.0,
                };
                wheel_count
            ],
        }
    }

    pub fn update_build(&mut self, build: ResolvedBuild, env: PhysicsEnv, versus_mode: bool) {
        self.build = build;
        self.env = env;
        self.versus_mode = versus_mode;
        self.traction_max_n = crate::compute_traction_limit_n(&self.build, self.env);
    }

    /// Runs onboard pure-vision perception and produces a high-level velocity command (v_fwd, v_lat, omega).
    pub fn compute_auto_vision_cmd(&mut self) -> (f64, f64, f64) {
        let dev_kind = self.build.device_kind.as_str();
        let base_hold: usize = match dev_kind {
            "conveyor" | "funnel_gate" => 4,
            "roller" | "vacuum" | "pincer_claw" => 3,
            "gripper" | "forklift" | "mag_arm" => 2,
            _ => 0,
        };
        let bin_bonus = if self.build.rear_mod == "storage_bin" && base_hold > 0 { 2 } else { 0 };
        let max_hold = base_hold + bin_bonus;
        let is_active_collector = max_hold > 0;

        let fx_r = self.body.yaw.cos();
        let fz_r = self.body.yaw.sin();
        let rx_r = -fz_r;
        let rz_r = fx_r;
        // camera_mount_z is fore/aft in core-model, camera_mount_x is lateral
        let cam_x = self.body.x + fx_r * self.build.camera_mount_z + rx_r * self.build.camera_mount_x;
        let cam_z = self.body.z + fz_r * self.build.camera_mount_z + rz_r * self.build.camera_mount_x;
        let cam_yaw = normalise_angle(self.body.yaw + self.build.camera_mount_yaw * PI / 180.0);
        let half_fov = (self.build.fov_deg * PI / 180.0) * 0.5;

        let mut vis_now: HashSet<String> = HashSet::new();
        let mut cands: Vec<(usize, f64, f64)> = Vec::new();
        for (idx, p) in self.pieces.iter().enumerate() {
            if p.held {
                continue;
            }
            let dx = p.x - cam_x;
            let dz = p.z - cam_z;
            let d = dx.hypot(dz);
            let ang = dz.atan2(dx);
            let bear = normalise_angle(ang - cam_yaw);
            if d >= 0.04 && d <= self.build.sensor_range_m && bear.abs() <= half_fov {
                cands.push((idx, d, ang));
            }
        }
        cands.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
        let h_ratio = self.build.camera_height / (self.build.camera_height - PIECE_HEIGHT_M).max(0.02);
        for i in 0..cands.len() {
            let (idx, d, ang) = cands[i];
            let mut occ = false;
            for j in 0..i {
                let (_, bd, bang) = cands[j];
                if d > bd + 0.03
                    && d <= bd * h_ratio
                    && normalise_angle(ang - bang).abs() < (PIECE_RADIUS_M * 0.9).atan2(bd.max(0.08))
                {
                    occ = true;
                    break;
                }
            }
            if !occ {
                let p = &self.pieces[idx];
                vis_now.insert(p.id.clone());
                self.perceived.insert(p.id.clone(), (p.x, p.z, p.value, p.is_red && !p.scored && !p.held));
            }
        }
        self.perceived.retain(|id, (px, pz, _, avail)| {
            if !*avail {
                return false;
            }
            if vis_now.contains(id) {
                return true;
            }
            let d = (*px - cam_x).hypot(*pz - cam_z);
            let bear = normalise_angle((*pz - cam_z).atan2(*px - cam_x) - cam_yaw);
            !(d >= 0.12 && d <= self.build.sensor_range_m * 0.9 && bear.abs() <= half_fov * 0.85)
        });

        let held_count = self.pieces.iter().filter(|p| p.held).count();
        let mut best_target: Option<(String, f64, f64)> = None;
        let mut best_u = f64::NEG_INFINITY;
        for (id, &(px, pz, val, avail)) in &self.perceived {
            if !avail {
                continue;
            }
            let d_rob = (px - self.body.x).hypot(pz - self.body.z);
            let d_goal = (px - 0.25).hypot(pz - 1.0);
            let commit_bonus = if self.push_commit_id.as_deref() == Some(id.as_str()) { 2.8 } else { 0.0 };
            let u = (val as f64) * 2.2 - d_rob * 3.0 - d_goal * 1.4 + commit_bonus;
            if u > best_u {
                best_u = u;
                best_target = Some((id.clone(), px, pz));
            }
        }

        let need_deliver = held_count >= max_hold.max(1)
            || (held_count > 0 && best_target.as_ref().map(|(_, tx, tz)| (*tx - self.body.x).hypot(*tz - self.body.z) > 0.55).unwrap_or(true));

        let (thr, steer) = if is_active_collector && need_deliver {
            self.push_commit_id = None;
            let aim = (1.0 - self.body.z).atan2(0.25 - self.body.x);
            let err = normalise_angle(aim - self.body.yaw);
            (if err.abs() > 1.0 { 0.20 } else { 0.95 }, (err * 2.8).clamp(-1.0, 1.0))
        } else if let Some((tid, tx, tz)) = best_target {
            if is_active_collector {
                let aim = (tz - self.body.z).atan2(tx - self.body.x);
                let err = normalise_angle(aim - self.body.yaw);
                let d_t = (tx - self.body.x).hypot(tz - self.body.z);
                let thr = if err.abs() > 0.9 { 0.18 } else if d_t < 0.28 { 0.72 } else { 0.94 };
                (thr, (err * 2.8).clamp(-1.0, 1.0))
            } else {
                let gx = 0.25 - tx;
                let gz = 1.0 - tz;
                let gl = gx.hypot(gz).max(1e-4);
                let goal_dir = gz.atan2(gx);
                let rob_to_piece_dir = (tz - self.body.z).atan2(tx - self.body.x);
                let d_piece = (tx - self.body.x).hypot(tz - self.body.z);
                let align_err = normalise_angle(rob_to_piece_dir - goal_dir).abs();
                let behind_piece = self.body.x > tx - 0.03;
                let is_committed = self.push_commit_id.as_deref() == Some(tid.as_str()) && d_piece < 0.34 && align_err < 0.75;
                let pushing = is_committed || (behind_piece && d_piece < 0.28 && align_err < 0.55);
                if pushing {
                    self.push_commit_id = Some(tid);
                    let lead_x = tx + (gx / gl) * 0.22;
                    let lead_z = tz + (gz / gl) * 0.22;
                    let aim = (lead_z - self.body.z).atan2(lead_x - self.body.x);
                    let err = normalise_angle(aim - self.body.yaw);
                    (if err.abs() > 0.85 { 0.28 } else { 0.88 }, (err * 2.6).clamp(-1.0, 1.0))
                } else {
                    self.push_commit_id = None;
                    let ap_x = (tx - (gx / gl) * 0.24).clamp(0.18, FIELD_WIDTH - 0.18);
                    let ap_z = (tz - (gz / gl) * 0.24).clamp(0.18, FIELD_DEPTH - 0.18);
                    let aim = (ap_z - self.body.z).atan2(ap_x - self.body.x);
                    let err = normalise_angle(aim - self.body.yaw);
                    (if err.abs() > 1.0 { 0.18 } else { 0.90 }, (err * 2.6).clamp(-1.0, 1.0))
                }
            }
        } else {
            self.push_commit_id = None;
            let d_ctr = (1.5 - self.body.x).hypot(1.0 - self.body.z);
            if d_ctr > 0.65 {
                let aim = (1.0 - self.body.z).atan2(1.5 - self.body.x);
                let err = normalise_angle(aim - self.body.yaw);
                (if err.abs() > 0.9 { 0.20 } else { 0.65 }, (err * 2.2).clamp(-1.0, 1.0))
            } else {
                (0.12, 0.75)
            }
        };

        (thr * self.build.max_speed, 0.0, steer * self.build.max_omega)
    }

    /// Steps the unified Rust physics kernel by `dt` seconds.
    /// If `external_cmd` is `Some((v_fwd, v_lat, omega))`, executes it; otherwise uses onboard pure-vision controller.
    pub fn step(&mut self, dt: f64, external_cmd: Option<(f64, f64, f64)>) {
        self.step_internal(dt, external_cmd, None);
    }

    /// Steps the unified Rust physics kernel using direct per-wheel motor PWM values (`-1.0..=1.0`).
    pub fn step_motors(&mut self, dt: f64, wheel_pwms: &[f64]) {
        self.step_internal(dt, Some((0.0, 0.0, 0.0)), Some(wheel_pwms));
    }

    fn step_internal(&mut self, dt: f64, external_cmd: Option<(f64, f64, f64)>, wheel_pwms: Option<&[f64]>) {
        let dt = dt.clamp(0.001, 0.05);
        let (cmd_v, cmd_vlat, cmd_omega) = match external_cmd {
            Some(c) => c,
            None => self.compute_auto_vision_cmd(),
        };

        let (summary, tele) = step_per_wheel_dynamics_with_pwm(
            &mut self.body,
            &self.build,
            self.env.friction,
            cmd_v,
            cmd_vlat,
            cmd_omega,
            self.prev_step_force,
            dt,
            wheel_pwms,
        );
        self.body.x = self.body.x.clamp(0.14, FIELD_WIDTH - 0.14);
        self.body.z = self.body.z.clamp(0.14, FIELD_DEPTH - 0.14);
        self.last_wheel_summary = summary;
        self.last_wheel_tele = tele;

        let slipping = summary.peak_wheel_slip > 0.05 || summary.slip_count > 0;
        if slipping && !self.was_slipping {
            self.slip_events += 1;
        }
        self.was_slipping = slipping;

        // Versus Blue Enemy AI
        if self.versus_mode {
            let e = &mut self.enemy;
            let blk = self
                .pieces
                .iter()
                .filter(|p| !p.is_red && p.x < 2.45)
                .min_by(|a, b| {
                    (a.x - e.x)
                        .hypot(a.z - e.z)
                        .partial_cmp(&(b.x - e.x).hypot(b.z - e.z))
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .map(|p| (p.x, p.z));
            if let Some((bx, bz)) = blk {
                let desired = (bz - e.z).atan2(bx - e.x);
                let ediff = normalise_angle(desired - e.yaw);
                e.omega = (ediff * 2.8).clamp(-3.0, 3.0);
                let tgt = if ediff.abs() > 0.9 { 0.18 } else { 0.78 };
                e.v += (tgt - e.v) * (1.0 - (-8.0 * dt).exp());
            } else {
                e.v *= 0.94;
                e.omega = 1.2;
            }
            e.yaw = normalise_angle(e.yaw + e.omega * dt);
            e.x = (e.x + e.yaw.cos() * e.v * dt).clamp(0.15, FIELD_WIDTH - 0.15);
            e.z = (e.z + e.yaw.sin() * e.v * dt).clamp(0.15, FIELD_DEPTH - 0.15);
            e.wheel_spin += (e.v * dt) / 0.03;

            let rdx = self.body.x - e.x;
            let rdz = self.body.z - e.z;
            let rd = rdx.hypot(rdz);
            if rd < 0.27 && rd > 1e-4 {
                let push = (0.27 - rd) * 0.5;
                self.body.x += (rdx / rd) * push;
                self.body.z += (rdz / rd) * push;
                e.x -= (rdx / rd) * push;
                e.z -= (rdz / rd) * push;
            }
        }

        // Piece interactions & collector mechanics
        let fx = self.body.yaw.cos();
        let fz = self.body.yaw.sin();
        let rx = -fz;
        let rz = fx;
        let dev_kind = self.build.device_kind.as_str();
        let base_hold: usize = match dev_kind {
            "conveyor" | "funnel_gate" => 4,
            "roller" | "vacuum" | "pincer_claw" => 3,
            "gripper" | "forklift" | "mag_arm" => 2,
            _ => 0,
        };
        let bin_bonus = if self.build.rear_mod == "storage_bin" && base_hold > 0 { 2 } else { 0 };
        let max_hold = base_hold + bin_bonus;
        let is_active_collector = max_hold > 0;
        let capture_reach = if dev_kind == "mag_arm" {
            0.27
        } else if dev_kind == "conveyor" || dev_kind == "pincer_claw" || dev_kind == "funnel_gate" {
            0.25
        } else {
            0.22
        };

        let in_red_goal = self.body.x < GOAL_MAX_X + 0.18 && self.body.z > GOAL_MIN_Z - 0.05 && self.body.z < GOAL_MAX_Z + 0.05;
        let a_fric = self.env.friction * 0.48 * 9.81;
        let single_slide_n = self.env.piece_mass_kg * a_fric;
        let scoop_hits = dev_kind != "none" && self.build.device_mount_y < PIECE_HEIGHT_M + 0.001;
        let body_hits = self.build.ground_clearance < PIECE_HEIGHT_M + 0.001;
        let front_plate_x = self.build.length * 0.5 + self.build.device_offset;
        let ls_rad = self.build.left_wing_splay * PI / 180.0;
        let rs_rad = self.build.right_wing_splay * PI / 180.0;
        let left_tip_x = front_plate_x + (self.build.left_wing_depth * ls_rad.cos()).max(0.0);
        let right_tip_x = front_plate_x + (self.build.right_wing_depth * rs_rad.cos()).max(0.0);
        let pocket_front_x = left_tip_x.max(right_tip_x);

        let mut held_now = self.pieces.iter().filter(|p| p.held).count();
        let mut step_force = 0.0_f64;

        for idx in 0..self.pieces.len() {
            if self.pieces[idx].held {
                if in_red_goal {
                    self.pieces[idx].held = false;
                    self.pieces[idx].x = (self.body.x + fx * (front_plate_x + 0.02))
                        .clamp(GOAL_MIN_X + PIECE_RADIUS_M + 0.02, GOAL_MAX_X + 0.12);
                    self.pieces[idx].z = (self.body.z + fz * (front_plate_x + 0.02))
                        .clamp(GOAL_MIN_Z, GOAL_MAX_Z);
                    self.pieces[idx].vx = fx * 0.35;
                    self.pieces[idx].vz = fz * 0.35;
                    held_now = held_now.saturating_sub(1);
                } else {
                    let slot_idx = self.pieces[..idx].iter().filter(|q| q.held).count();
                    let lat = (((slot_idx % 3) as f64) - 1.0) * 0.052;
                    let row_back = ((slot_idx / 3) as f64) * 0.055;
                    self.pieces[idx].x = self.body.x + fx * (0.16 - row_back) + rx * lat;
                    self.pieces[idx].z = self.body.z + fz * (0.16 - row_back) + rz * lat;
                    self.pieces[idx].vx = 0.0;
                    self.pieces[idx].vz = 0.0;
                    step_force += single_slide_n * 0.25;
                }
                continue;
            }

            let p = &mut self.pieces[idx];
            let spd = p.vx.hypot(p.vz);
            if spd <= a_fric * dt {
                p.vx = 0.0;
                p.vz = 0.0;
            } else if spd > 1e-6 {
                let sc = (spd - a_fric * dt) / spd;
                p.vx *= sc;
                p.vz *= sc;
            }

            let dx = p.x - self.body.x;
            let dz = p.z - self.body.z;
            let dist = dx.hypot(dz);
            let fwd_dot = dx * fx + dz * fz;
            let lat_dot = dx * rx + dz * rz - self.build.device_mount_x;

            if is_active_collector
                && p.is_red
                && !p.scored
                && !in_red_goal
                && held_now < max_hold
                && scoop_hits
                && fwd_dot > 0.08
                && fwd_dot < capture_reach
                && lat_dot.abs() < (self.build.device_width * 0.55).max(0.11)
            {
                p.held = true;
                held_now += 1;
                step_force += single_slide_n * 1.1;
                continue;
            }

            if self.build.rear_mod == "dual_scoop" && fwd_dot < -0.10 && fwd_dot > -0.22 && lat_dot.abs() < 0.11 {
                p.vx -= fx * 0.65;
                p.vz -= fz * 0.65;
            }

            if self.versus_mode {
                let edx = p.x - self.enemy.x;
                let edz = p.z - self.enemy.z;
                let ed = edx.hypot(edz);
                if ed < 0.145 + PIECE_RADIUS_M && ed > 1e-4 {
                    p.x += (edx / ed) * (0.145 + PIECE_RADIUS_M - ed);
                    p.z += (edz / ed) * (0.145 + PIECE_RADIUS_M - ed);
                    p.vx += (edx / ed) * 0.7;
                    p.vz += (edz / ed) * 0.7;
                }
            }

            if dev_kind == "vacuum" && !p.scored && dist < 0.28 && fwd_dot > 0.05 {
                p.vx -= (dx / dist.max(0.05)) * 1.4 * dt;
                p.vz -= (dz / dist.max(0.05)) * 1.4 * dt;
            } else if dev_kind == "brush" && dist < 0.24 && fwd_dot > 0.06 {
                let side = if lat_dot > 0.0 { -1.0 } else { 1.0 };
                p.vx += rx * side * 1.2 * dt;
                p.vz += rz * side * 1.2 * dt;
            }

            if scoop_hits && fwd_dot > self.build.length * 0.45 && fwd_dot <= pocket_front_x + PIECE_RADIUS_M {
                let l_hw = (self.build.device_width * 0.5 + (fwd_dot - front_plate_x).max(0.0) * ls_rad.tan()).max(0.025);
                let r_hw = (self.build.device_width * 0.5 + (fwd_dot - front_plate_x).max(0.0) * rs_rad.tan()).max(0.025);
                if lat_dot >= -l_hw - PIECE_RADIUS_M * 0.4 && lat_dot <= r_hw + PIECE_RADIUS_M * 0.4 {
                    if fwd_dot < front_plate_x + PIECE_RADIUS_M {
                        let push = front_plate_x + PIECE_RADIUS_M - fwd_dot;
                        p.x += fx * push;
                        p.z += fz * push;
                        let pv = p.vx * fx + p.vz * fz;
                        if self.body.v_fwd > pv {
                            let add = (self.body.v_fwd - pv) * 1.04;
                            p.vx += fx * add;
                            p.vz += fz * add;
                        }
                        let lat_v = p.vx * rx + p.vz * rz;
                        p.vx -= rx * lat_v * 0.45;
                        p.vz -= rz * lat_v * 0.45;
                        step_force += single_slide_n * 1.35;
                    } else if lat_dot < -l_hw + PIECE_RADIUS_M * 0.5 {
                        p.x += rx * 0.015;
                        p.z += rz * 0.015;
                        p.vx += rx * 0.35;
                        p.vz += rz * 0.35;
                    } else if lat_dot > r_hw - PIECE_RADIUS_M * 0.5 {
                        p.x -= rx * 0.015;
                        p.z -= rz * 0.015;
                        p.vx -= rx * 0.35;
                        p.vz -= rz * 0.35;
                    }
                }
            } else if body_hits {
                // Oriented Bounding Box (OBB) chassis collision (exact length x width)
                let hx = self.build.length * 0.5;
                let hz = self.build.width * 0.5;
                let bx = dx * fx + dz * fz;
                let bz = dx * rx + dz * rz;
                let cx = bx.clamp(-hx, hx);
                let cz = bz.clamp(-hz, hz);
                let ex = bx - cx;
                let ez = bz - cz;
                let ed = ex.hypot(ez);
                if ed < PIECE_RADIUS_M && ed > 1e-5 {
                    let pen = PIECE_RADIUS_M - ed;
                    let nx_b = ex / ed;
                    let nz_b = ez / ed;
                    let nx = nx_b * fx + nz_b * rx;
                    let nz = nx_b * fz + nz_b * rz;
                    p.x += nx * pen;
                    p.z += nz * pen;
                    p.vx += nx * (0.45 + self.body.v_fwd.abs() * 0.72);
                    p.vz += nz * (0.45 + self.body.v_fwd.abs() * 0.72);
                    step_force += 1.05;
                }
            }

            // Custom CAD part OBB collisions for low-mounted parts (<= piece height)
            for cad in &self.build.custom_cad_colliders {
                if cad.min_y_m > PIECE_HEIGHT_M + 0.002 || cad.max_y_m < -0.002 {
                    continue;
                }
                let bx = (p.x - self.body.x) * fx + (p.z - self.body.z) * fz - cad.center_x_m;
                let bz = (p.x - self.body.x) * rx + (p.z - self.body.z) * rz - cad.center_z_m;
                let cy = (cad.yaw_deg * PI / 180.0).cos();
                let sy = (cad.yaw_deg * PI / 180.0).sin();
                let lx = bx * cy + bz * sy;
                let lz = -bx * sy + bz * cy;
                let cx = lx.clamp(-cad.half_x_m, cad.half_x_m);
                let cz = lz.clamp(-cad.half_z_m, cad.half_z_m);
                let ex = lx - cx;
                let ez = lz - cz;
                let ed = ex.hypot(ez);
                if ed < PIECE_RADIUS_M && ed > 1e-5 {
                    let pen = PIECE_RADIUS_M - ed;
                    let nlx = ex / ed;
                    let nlz = ez / ed;
                    let nbx = nlx * cy - nlz * sy;
                    let nbz = nlx * sy + nlz * cy;
                    let nx = nbx * fx + nbz * rx;
                    let nz = nbx * fz + nbz * rz;
                    p.x += nx * pen;
                    p.z += nz * pen;
                    p.vx += nx * (0.50 + self.body.v_fwd.abs() * 0.78);
                    p.vz += nz * (0.50 + self.body.v_fwd.abs() * 0.78);
                    step_force += single_slide_n * 1.1;
                }
            }
        }

        // Piece-to-piece elastic collisions
        let len = self.pieces.len();
        for i in 0..len {
            if self.pieces[i].held {
                continue;
            }
            for j in (i + 1)..len {
                if self.pieces[j].held {
                    continue;
                }
                let dx = self.pieces[j].x - self.pieces[i].x;
                let dz = self.pieces[j].z - self.pieces[i].z;
                let d = dx.hypot(dz);
                let min_sep = PIECE_RADIUS_M * 2.02;
                if d < min_sep && d > 1e-5 {
                    let nx = dx / d;
                    let nz = dz / d;
                    let pen = (min_sep - d) * 0.5;
                    self.pieces[i].x -= nx * pen;
                    self.pieces[i].z -= nz * pen;
                    self.pieces[j].x += nx * pen;
                    self.pieces[j].z += nz * pen;
                    let rvx = self.pieces[j].vx - self.pieces[i].vx;
                    let rvz = self.pieces[j].vz - self.pieces[i].vz;
                    let vn = rvx * nx + rvz * nz;
                    if vn < 0.0 {
                        let imp = vn * (0.5 + 0.5 * self.env.restitution);
                        self.pieces[i].vx += imp * nx;
                        self.pieces[i].vz += imp * nz;
                        self.pieces[j].vx -= imp * nx;
                        self.pieces[j].vz -= imp * nz;
                    }
                }
            }
        }

        let wall_r = self.env.restitution * 0.85;
        for p in &mut self.pieces {
            if p.held {
                continue;
            }
            p.x += p.vx * dt;
            p.z += p.vz * dt;
            if p.x < PIECE_RADIUS_M { p.x = PIECE_RADIUS_M; p.vx = p.vx.abs() * wall_r; }
            if p.x > FIELD_WIDTH - PIECE_RADIUS_M { p.x = FIELD_WIDTH - PIECE_RADIUS_M; p.vx = -p.vx.abs() * wall_r; }
            if p.z < PIECE_RADIUS_M { p.z = PIECE_RADIUS_M; p.vz = p.vz.abs() * wall_r; }
            if p.z > FIELD_DEPTH - PIECE_RADIUS_M { p.z = FIELD_DEPTH - PIECE_RADIUS_M; p.vz = -p.vz.abs() * wall_r; }
            p.scored = p.is_red
                && !p.held
                && p.x >= GOAL_MIN_X
                && p.x <= GOAL_MAX_X + 0.15
                && p.z >= GOAL_MIN_Z - 0.05
                && p.z <= GOAL_MAX_Z + 0.05;
        }

        self.prev_step_force = step_force;
        self.peak_force_n = self.peak_force_n.max(step_force);
        let aux_watts = match dev_kind {
            "vacuum" => 6.5,
            "conveyor" => 4.2,
            "roller" | "brush" => 3.2,
            "forklift" | "mag_arm" => 2.6,
            "gripper" => 1.5,
            _ => 0.0,
        };
        let watts = 4.2 + aux_watts + self.build.control_hz * 0.05 + self.body.v_fwd.abs() * (10.5 + step_force * 2.2) + self.body.omega.abs() * 1.4;
        self.energy_j += watts * dt;
        self.time_s += dt;
    }

    pub fn score(&self) -> i32 {
        self.pieces.iter().filter(|p| p.scored).map(|p| p.value).sum()
    }

    pub fn collected(&self) -> usize {
        self.pieces.iter().filter(|p| p.scored).count()
    }

    /// Official competition rule: opponent (black) pieces pushed into red goal zone incur -3 pts each.
    pub fn wrong_pieces_in_goal(&self) -> usize {
        self.pieces
            .iter()
            .filter(|p| {
                !p.is_red
                    && !p.held
                    && p.x >= GOAL_MIN_X
                    && p.x <= GOAL_MAX_X
                    && p.z >= GOAL_MIN_Z
                    && p.z <= GOAL_MAX_Z
            })
            .count()
    }

    pub fn official_net_score(&self) -> i32 {
        self.score() - (self.wrong_pieces_in_goal() as i32) * 3
    }
}
