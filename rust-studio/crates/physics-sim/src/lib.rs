pub mod sim_world;
pub mod wheel_physics;

use serde::{Deserialize, Serialize};
use xiangqi_core::{AssemblyGraph, ResolvedBuild};

pub const FIELD_WIDTH: f64 = 3.0;
pub const FIELD_DEPTH: f64 = 2.0;
pub const GOAL_MIN_X: f64 = 0.0;
pub const GOAL_MAX_X: f64 = 0.40;
pub const GOAL_MIN_Z: f64 = 0.70;
pub const GOAL_MAX_Z: f64 = 1.30;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct PhysicsEnv {
    pub friction: f64,
    pub restitution: f64,
    pub piece_mass_kg: f64,
}

impl Default for PhysicsEnv {
    fn default() -> Self {
        Self::preset("standard")
    }
}

impl PhysicsEnv {
    pub fn preset(name: &str) -> Self {
        match name {
            "slippery" => Self { friction: 0.32, restitution: 0.48, piece_mass_kg: 0.048 },
            "bouncy" => Self { friction: 0.78, restitution: 0.82, piece_mass_kg: 0.048 },
            "heavy" => Self { friction: 0.84, restitution: 0.35, piece_mass_kg: 0.080 },
            _ => Self { friction: 0.78, restitution: 0.42, piece_mass_kg: 0.048 },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Piece {
    pub id: String,
    pub is_red: bool,
    pub symbol: String,
    pub value: i32,
    pub x: f64,
    pub z: f64,
    pub vx: f64,
    pub vz: f64,
    pub scored: bool,
    #[serde(default)]
    pub held: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RobotState {
    pub x: f64,
    pub z: f64,
    pub yaw: f64,
    pub speed: f64,
    pub omega: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchSummary {
    pub seed: u64,
    pub score: i32,
    pub collected: usize,
    pub finish_time_s: f64,
    pub peak_force_n: f64,
    pub traction_max_n: f64,
    pub slip_events: u32,
    pub energy_j: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationCandidateResult {
    pub label: String,
    pub avg_score: f64,
    pub avg_finish_s: f64,
    pub avg_slip_events: f64,
    pub avg_energy_j: f64,
    pub total_mass_kg: f64,
    pub graph: AssemblyGraph,
}

pub fn compute_traction_limit_n(build: &ResolvedBuild, env: PhysicsEnv) -> f64 {
    if build.driven_wheel_count == 0 && build.rear_mod != "turbo_fan" {
        return 0.0;
    }
    let lon_factor = (1.0 - (build.front_axle_pct as f64 - 50.0).abs() * 0.008).clamp(0.72, 1.0);
    let lat_factor = (1.0 - (build.left_axle_pct as f64 - 50.0).abs() * 0.006).clamp(0.76, 1.0);
    let wheel_factor = if build.driven_wheel_count == 0 {
        0.35
    } else {
        (0.70 + (build.driven_wheel_count.min(10) as f64) * 0.08).clamp(0.75, 1.45)
    };
    build.total_mass * 9.81 * build.grip * (env.friction / 0.78) * lon_factor * lat_factor * wheel_factor * build.traction_gain.clamp(0.2, 2.5)
}

pub fn run_headless_match(build: &ResolvedBuild, env: PhysicsEnv, seed: u64, duration_s: f64) -> MatchSummary {
    let dt = 0.02;
    let steps = (duration_s / dt).round() as usize;
    let mut world = sim_world::SimWorld::new(build.clone(), env, seed, "random_center", false);
    if build.driven_wheel_count == 0 && build.rear_mod != "turbo_fan" {
        return MatchSummary {
            seed,
            score: 0,
            collected: 0,
            finish_time_s: duration_s,
            peak_force_n: 0.0,
            traction_max_n: 0.0,
            slip_events: 0,
            energy_j: duration_s * 4.2,
        };
    }
    for _ in 0..steps {
        world.step(dt, None);
        if world.score() >= 45 {
            break;
        }
    }
    MatchSummary {
        seed,
        score: world.score(),
        collected: world.collected(),
        finish_time_s: world.time_s,
        peak_force_n: world.peak_force_n,
        traction_max_n: world.traction_max_n,
        slip_events: world.slip_events,
        energy_j: world.energy_j,
    }
}

pub fn optimize_assembly(base_graph: &AssemblyGraph, env: PhysicsEnv, seeds: &[u64]) -> Vec<OptimizationCandidateResult> {
    struct CandidatePreset {
        label: &'static str,
        frame: &'static str,
        dev_kind: &'static str,
        dev_w: f64,
        lw_d: f64,
        lw_s: f64,
        rw_d: f64,
        rw_s: f64,
        rpm: f64,
        drive: &'static str,
        wheel_count: usize,
        tire_type: &'static str,
        loco_mode: &'static str,
    }

    let presets = [
        CandidatePreset { label: "电动门笼斗+后集棋箱 (6枚连运 · 540rpm 麦轮)", frame: "armored_box", dev_kind: "funnel_gate", dev_w: 0.220, lw_d: 0.036, lw_s: 14.0, rw_d: 0.036, rw_s: 14.0, rpm: 540.0, drive: "mecanum", wheel_count: 4, tire_type: "mecanum", loco_mode: "holonomic_strafe" },
        CandidatePreset { label: "重型液压剪式钳+激光雷达 (3枚 · 560rpm 六驱)", frame: "truss_cage", dev_kind: "pincer_claw", dev_w: 0.215, lw_d: 0.024, lw_s: 10.0, rw_d: 0.024, rw_s: 10.0, rpm: 560.0, drive: "six_wd", wheel_count: 6, tire_type: "offroad", loco_mode: "diff_skid" },
        CandidatePreset { label: "履带传送带收子战车 (4枚连运 · 500rpm 履带)", frame: "armored_box", dev_kind: "conveyor", dev_w: 0.210, lw_d: 0.030, lw_s: 12.0, rw_d: 0.030, rw_s: 12.0, rpm: 500.0, drive: "tracked", wheel_count: 4, tire_type: "tracked", loco_mode: "diff_skid" },
        CandidatePreset { label: "主动滚筒吸纳轮 (3枚连运 · 520rpm 麦轮)", frame: "dual_deck", dev_kind: "roller", dev_w: 0.210, lw_d: 0.032, lw_s: 12.0, rw_d: 0.032, rw_s: 12.0, rpm: 520.0, drive: "mecanum", wheel_count: 4, tire_type: "mecanum", loco_mode: "holonomic_strafe" },
        CandidatePreset { label: "三轮120°三角全向快车 (3轮Omni · 560rpm)", frame: "hex_open", dev_kind: "roller", dev_w: 0.205, lw_d: 0.028, lw_s: 12.0, rw_d: 0.028, rw_s: 12.0, rpm: 560.0, drive: "omni", wheel_count: 3, tire_type: "omni", loco_mode: "holonomic_strafe" },
        CandidatePreset { label: "八轮八驱深齿越野传送战车 (8轮越野 · 520rpm)", frame: "armored_box", dev_kind: "conveyor", dev_w: 0.215, lw_d: 0.030, lw_s: 12.0, rw_d: 0.030, rw_s: 12.0, rpm: 520.0, drive: "six_wd", wheel_count: 8, tire_type: "offroad", loco_mode: "diff_skid" },
        CandidatePreset { label: "八边全向负压吸盘车 (广域吸附 · 540rpm 麦轮)", frame: "hex_open", dev_kind: "vacuum", dev_w: 0.200, lw_d: 0.025, lw_s: 10.0, rw_d: 0.025, rw_s: 10.0, rpm: 540.0, drive: "mecanum", wheel_count: 4, tire_type: "mecanum", loco_mode: "holonomic_strafe" },
        CandidatePreset { label: "桁架六驱仿生机械臂车 (长距抓运 · 560rpm 六驱)", frame: "truss_cage", dev_kind: "mag_arm", dev_w: 0.195, lw_d: 0.020, lw_s: 8.0, rw_d: 0.020, rw_s: 8.0, rpm: 560.0, drive: "six_wd", wheel_count: 6, tire_type: "offroad", loco_mode: "diff_skid" },
        CandidatePreset { label: "电动双叉升降铲车 (高稳托运 · 520rpm 六驱)", frame: "dual_deck", dev_kind: "forklift", dev_w: 0.200, lw_d: 0.024, lw_s: 10.0, rw_d: 0.024, rw_s: 10.0, rpm: 520.0, drive: "six_wd", wheel_count: 6, tire_type: "offroad", loco_mode: "diff_skid" },
        CandidatePreset { label: "双臂机械夹爪 (稳固夹运 · 580rpm 全向)", frame: "low_rider", dev_kind: "gripper", dev_w: 0.190, lw_d: 0.020, lw_s: 8.0, rw_d: 0.020, rw_s: 8.0, rpm: 580.0, drive: "omni", wheel_count: 4, tire_type: "omni", loco_mode: "holonomic_strafe" },
        CandidatePreset { label: "高速 V 型破阵犁 (极速切入 · 620rpm 履带)", frame: "low_rider", dev_kind: "plow_v", dev_w: 0.225, lw_d: 0.048, lw_s: 22.0, rw_d: 0.048, rw_s: 22.0, rpm: 620.0, drive: "tracked", wheel_count: 4, tire_type: "tracked", loco_mode: "diff_skid" },
        CandidatePreset { label: "双排旋转毛刷 (聚拢推运 · 480rpm 后驱)", frame: "dual_deck", dev_kind: "brush", dev_w: 0.220, lw_d: 0.045, lw_s: 16.0, rw_d: 0.045, rw_s: 16.0, rpm: 480.0, drive: "rwd_caster", wheel_count: 3, tire_type: "rubber", loco_mode: "ackermann_front" },
        CandidatePreset { label: "均衡标准推斗 (口195 / 翼36mm·12°)", frame: "dual_deck", dev_kind: "u_scoop", dev_w: 0.195, lw_d: 0.036, lw_s: 12.0, rw_d: 0.036, rw_s: 12.0, rpm: 420.0, drive: "mecanum", wheel_count: 4, tire_type: "mecanum", loco_mode: "holonomic_strafe" },
        CandidatePreset { label: "宽口大翼推斗 (口240 / 翼58mm·20°)", frame: "armored_box", dev_kind: "u_scoop", dev_w: 0.240, lw_d: 0.058, lw_s: 20.0, rw_d: 0.058, rw_s: 20.0, rpm: 480.0, drive: "mecanum", wheel_count: 4, tire_type: "mecanum", loco_mode: "holonomic_strafe" },
        CandidatePreset { label: "高速轻量化滚筒 (口195 / 660rpm 后驱)", frame: "low_rider", dev_kind: "roller", dev_w: 0.195, lw_d: 0.028, lw_s: 10.0, rw_d: 0.028, rw_s: 10.0, rpm: 660.0, drive: "rwd_caster", wheel_count: 3, tire_type: "rubber", loco_mode: "ackermann_front" },
        CandidatePreset { label: "超宽双翼毛刷清场 (口270 / 540rpm)", frame: "hex_open", dev_kind: "brush", dev_w: 0.270, lw_d: 0.060, lw_s: 22.0, rw_d: 0.060, rw_s: 22.0, rpm: 540.0, drive: "mecanum", wheel_count: 4, tire_type: "mecanum", loco_mode: "holonomic_strafe" },
    ];

    let mut out: Vec<OptimizationCandidateResult> = std::thread::scope(|scope| {
        let handles: Vec<_> = presets
            .iter()
            .map(|p| {
                scope.spawn(move || {
                    let mut g = base_graph.clone();
                    for n in &mut g.nodes {
                        if n.id == "chassis_main" {
                            n.params["frame_style"] = serde_json::json!(p.frame);
                            n.params["rear_mod"] = serde_json::json!(if p.label.contains("集棋箱") { "storage_bin" } else { "none" });
                        } else if n.id == "sensor_laser" {
                            n.params["sensor_suite"] = serde_json::json!(if p.label.contains("激光雷达") { "lidar360" } else { "laser3" });
                        } else if n.id == "device_scoop" {
                            n.params["device_width"] = serde_json::json!(p.dev_w);
                            n.params["device_kind"] = serde_json::json!(p.dev_kind);
                        } else if n.id == "wing_pair" {
                            n.params["left_wing_depth"] = serde_json::json!(p.lw_d);
                            n.params["left_wing_splay"] = serde_json::json!(p.lw_s);
                            n.params["right_wing_depth"] = serde_json::json!(p.rw_d);
                            n.params["right_wing_splay"] = serde_json::json!(p.rw_s);
                        } else if n.id == "motor_drive" {
                            n.params["rpm"] = serde_json::json!(p.rpm);
                        } else if n.id == "wheel_mecanum" {
                            if let Some(obj) = n.params.as_object_mut() {
                                obj.remove("custom_wheels");
                            }
                            n.params["drive_type"] = serde_json::json!(p.drive);
                            n.params["wheel_count"] = serde_json::json!(p.wheel_count);
                            n.params["tire_type"] = serde_json::json!(p.tire_type);
                            n.params["locomotion_mode"] = serde_json::json!(p.loco_mode);
                        }
                    }
                    let built = g.resolve_kinematics();
                    let n_seeds = seeds.len().max(1) as f64;
                    let mut sum_s = 0.0;
                    let mut sum_t = 0.0;
                    let mut sum_slip = 0.0;
                    let mut sum_e = 0.0;
                    for &sd in seeds {
                        let r = run_headless_match(&built, env, sd, 120.0);
                        sum_s += r.score as f64;
                        sum_t += r.finish_time_s;
                        sum_slip += r.slip_events as f64;
                        sum_e += r.energy_j;
                    }
                    OptimizationCandidateResult {
                        label: p.label.into(),
                        avg_score: sum_s / n_seeds,
                        avg_finish_s: sum_t / n_seeds,
                        avg_slip_events: sum_slip / n_seeds,
                        avg_energy_j: sum_e / n_seeds,
                        total_mass_kg: built.total_mass,
                        graph: g,
                    }
                })
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });

    out.sort_by(|a, b| {
        b.avg_score
            .partial_cmp(&a.avg_score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.avg_finish_s.partial_cmp(&b.avg_finish_s).unwrap_or(std::cmp::Ordering::Equal))
    });

    // Stage 2: Parallel parametric search around the top candidate and user's base graph
    let mut seed_graphs: Vec<(&'static str, AssemblyGraph)> = Vec::new();
    if let Some(best) = out.first() {
        let mut g1 = best.graph.clone();
        for n in &mut g1.nodes {
            if n.id == "motor_drive" {
                let rpm = n.params["rpm"].as_f64().unwrap_or(520.0);
                n.params["rpm"] = serde_json::json!((rpm * 1.12).min(780.0));
            } else if n.id == "device_scoop" {
                let dw = n.params["device_width"].as_f64().unwrap_or(0.21);
                n.params["device_width"] = serde_json::json!((dw + 0.015).min(0.26));
            } else if n.id == "wing_pair" {
                n.params["left_wing_depth"] = serde_json::json!(0.042);
                n.params["left_wing_splay"] = serde_json::json!(16.0);
                n.params["right_wing_depth"] = serde_json::json!(0.026);
                n.params["right_wing_splay"] = serde_json::json!(10.0);
            }
        }
        seed_graphs.push(("🧬 进化参数寻优解 (高转速+非对称导流翼)", g1));

        let mut g2 = best.graph.clone();
        for n in &mut g2.nodes {
            if n.id == "batt_3s" {
                n.params["voltage"] = serde_json::json!(14.8);
                n.params["capacity_ah"] = serde_json::json!(2.2);
            } else if n.id == "wheel_mecanum" {
                n.params["traction_gain"] = serde_json::json!(1.22);
            }
        }
        seed_graphs.push(("🧬 进化参数寻优解 (4S高压+高抓地调校)", g2));
    }
    let mut g_user = base_graph.clone();
    for n in &mut g_user.nodes {
        if n.id == "motor_drive" {
            let rpm = n.params["rpm"].as_f64().unwrap_or(420.0);
            n.params["rpm"] = serde_json::json!((rpm * 1.25).clamp(460.0, 720.0));
        } else if n.id == "wheel_mecanum" {
            n.params["fwd_gain"] = serde_json::json!(1.15);
            n.params["omega_gain"] = serde_json::json!(1.15);
        }
    }
    seed_graphs.push(("🧬 基于当前构型的参数进化调优解", g_user));

    let evolved: Vec<OptimizationCandidateResult> = std::thread::scope(|scope| {
        let handles: Vec<_> = seed_graphs
            .into_iter()
            .map(|(lbl, g)| {
                scope.spawn(move || {
                    let built = g.resolve_kinematics();
                    let n_seeds = seeds.len().max(1) as f64;
                    let mut sum_s = 0.0;
                    let mut sum_t = 0.0;
                    let mut sum_slip = 0.0;
                    let mut sum_e = 0.0;
                    for &sd in seeds {
                        let r = run_headless_match(&built, env, sd, 120.0);
                        sum_s += r.score as f64;
                        sum_t += r.finish_time_s;
                        sum_slip += r.slip_events as f64;
                        sum_e += r.energy_j;
                    }
                    OptimizationCandidateResult {
                        label: lbl.into(),
                        avg_score: sum_s / n_seeds,
                        avg_finish_s: sum_t / n_seeds,
                        avg_slip_events: sum_slip / n_seeds,
                        avg_energy_j: sum_e / n_seeds,
                        total_mass_kg: built.total_mass,
                        graph: g,
                    }
                })
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });
    if let Some(best_evo) = evolved.into_iter().max_by(|a, b| {
        a.avg_score
            .partial_cmp(&b.avg_score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(b.avg_finish_s.partial_cmp(&a.avg_finish_s).unwrap_or(std::cmp::Ordering::Equal))
    }) {
        out.push(best_evo);
    }

    out.sort_by(|a, b| {
        b.avg_score
            .partial_cmp(&a.avg_score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.avg_finish_s.partial_cmp(&b.avg_finish_s).unwrap_or(std::cmp::Ordering::Equal))
    });
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_headless_sim_and_optimizer() {
        let graph = AssemblyGraph::default_competition_robot();
        let built = graph.resolve_kinematics();
        let res = run_headless_match(&built, PhysicsEnv::preset("standard"), 42, 60.0);
        assert!(res.traction_max_n > 8.0);
        assert!(res.energy_j > 10.0);
        let opt = optimize_assembly(&graph, PhysicsEnv::preset("standard"), &[42, 101]);
        assert!(opt.len() >= 17);
        assert!(opt[0].avg_score >= opt.last().unwrap().avg_score);
        assert!(opt[0].avg_score >= 15.0, "Top collector candidate should reliably score >= 15/45, got {}", opt[0].avg_score);
    }

    #[test]
    fn test_per_wheel_asymmetric_torque_and_friction() {
        let mut g = AssemblyGraph::default_competition_robot();
        for n in &mut g.nodes {
            if n.id == "wheel_mecanum" {
                n.params["custom_wheels"] = serde_json::json!([
                    { "id": "left_only", "x_m": 0.0, "z_m": -0.11, "radius_m": 0.03, "width_m": 0.026, "yaw_deg": 0.0, "tire_type": "rubber", "driven": true, "steered": false }
                ]);
            }
        }
        let built = g.resolve_kinematics();
        let mut world = sim_world::SimWorld::new(built, PhysicsEnv::preset("standard"), 42, "grid", false);
        for _ in 0..25 {
            world.step(0.02, Some((0.8, 0.0, 0.0)));
        }
        // 1 driven wheel on the left (-z_m) commanded straight forward must generate +omega / +yaw (pulling right)
        assert!(world.body.omega > 0.5, "Expected asymmetric wheel torque to turn right, got omega={}", world.body.omega);
        assert!(world.body.yaw > 0.1, "Expected yaw > 0.1 rad, got {}", world.body.yaw);
    }

    #[test]
    fn test_custom_cad_obb_collision_and_motor_sag() {
        use xiangqi_core::cad_kernel::SketchProfile;
        let mut g = AssemblyGraph::default_competition_robot();
        for n in &mut g.nodes {
            if n.id == "device_scoop" {
                n.params["device_kind"] = serde_json::json!("none");
            }
        }
        let sk = SketchProfile::chamfered_rect("low_bumper", 0.18, 0.04, 0.005, 0.015, 1550.0, vec![]);
        g.add_custom_cad_part("cad_bumper".into(), sk, "chassis_main", "bottom_deck", [0.0, -0.014, 0.16])
            .unwrap();
        let built = g.resolve_kinematics();
        assert_eq!(built.custom_cad_colliders.len(), 1);
        let mut world = sim_world::SimWorld::new(built, PhysicsEnv::preset("standard"), 42, "grid", false);
        // Place a piece directly in front of the custom CAD bumper
        world.pieces[0].x = world.body.x + 0.185;
        world.pieces[0].z = world.body.z;
        let init_px = world.pieces[0].x;
        for _ in 0..20 {
            world.step(0.02, Some((0.9, 0.0, 0.0)));
        }
        assert!(world.pieces[0].x > init_px + 0.04, "Low-mounted custom CAD part must push piece forward");
        assert!(world.last_wheel_summary.bus_voltage > 5.0 && world.last_wheel_summary.bus_voltage <= 11.2);
        assert!(world.last_wheel_summary.total_current_a > 0.4);
    }
}
