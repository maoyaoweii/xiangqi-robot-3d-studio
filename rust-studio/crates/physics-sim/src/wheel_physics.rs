use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use xiangqi_core::{CustomWheelSpec, ResolvedBuild};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct WheelStepTelemetry {
    pub normal_n: f64,
    pub force_long_n: f64,
    pub force_lat_n: f64,
    pub slip_ratio: f64,
    pub steer_rad: f64,
}

#[derive(Debug, Clone, Copy)]
pub struct BodyKinematicsState {
    pub x: f64,
    pub z: f64,
    pub yaw: f64,
    /// Body-frame forward velocity (+X_body, m/s)
    pub v_fwd: f64,
    /// Body-frame lateral velocity (+Z_body right, m/s)
    pub v_lat: f64,
    /// Yaw angular velocity (rad/s, + turns right from +X toward +Z)
    pub omega: f64,
    pub wheel_spin: f64,
    pub steer_angle: f64,
    pub pitch_rad: f64,
    /// Remaining battery State-of-Charge in [0.05..1.0]
    pub battery_soc: f64,
}

#[derive(Debug, Clone, Copy)]
pub struct WheelStepSummary {
    pub total_traction_n: f64,
    pub peak_wheel_slip: f64,
    pub slip_count: usize,
    pub drive_force_n: f64,
    pub can_strafe: bool,
    pub bus_voltage: f64,
    pub total_current_a: f64,
    pub battery_pct: f64,
}

/// Computes per-wheel normal load N_i (N) from CG offset and dynamic longitudinal/lateral acceleration.
fn compute_wheel_normal_loads(
    wheels: &[CustomWheelSpec],
    build: &ResolvedBuild,
    a_fwd: f64,
    a_lat: f64,
    downforce_n: f64,
) -> Vec<f64> {
    let n = wheels.len();
    if n == 0 {
        return Vec::new();
    }
    let total_n = (build.total_mass * 9.81 + downforce_n).max(0.5);
    if n == 1 {
        return vec![total_n];
    }

    let cg_fwd = build.cg_z; // fore/aft CG in core-model
    let cg_lat = build.cg_x; // lateral CG in core-model
    let cg_h = (build.ground_clearance + build.height * 0.45).clamp(0.025, 0.14);
    let half_l = (build.wheelbase * 0.5).max(0.05);
    let half_w = (build.front_track.max(build.rear_track) * 0.5).max(0.05);

    // Dynamic load transfer offsets the effective center of pressure
    let eff_fwd = cg_fwd - (a_fwd / 9.81) * cg_h;
    let eff_lat = cg_lat - (a_lat / 9.81) * cg_h;

    let mut weights = Vec::with_capacity(n);
    let mut sum_w = 0.0;
    for w in wheels {
        let df = ((w.x_m - eff_fwd) / half_l).clamp(-2.0, 2.0);
        let dl = ((w.z_m - eff_lat) / half_w).clamp(-2.0, 2.0);
        // Wheels closer to effective CG carry higher normal load
        let prox = (1.0 - 0.35 * df.abs() * 0.5 - 0.35 * dl.abs() * 0.5).max(0.15);
        // Transfer directional bias
        let bias = (1.0 + 0.38 * (w.x_m / half_l) * (eff_fwd / half_l) + 0.38 * (w.z_m / half_w) * (eff_lat / half_w)).max(0.10);
        let wt = prox * bias;
        weights.push(wt);
        sum_w += wt;
    }

    weights
        .into_iter()
        .map(|wt| total_n * (wt / sum_w.max(1e-6)))
        .collect()
}

/// Steps rigid-body planar dynamics using summed per-wheel tire forces & yaw torques.
///
/// Body coordinates: +X is forward, +Z is right, +Y is up.
/// World heading `yaw = 0` points along +X; positive `omega` turns from +X toward +Z (right).
pub fn step_per_wheel_dynamics(
    body: &mut BodyKinematicsState,
    build: &ResolvedBuild,
    mu_env: f64,
    cmd_v: f64,
    cmd_v_lat: f64,
    cmd_omega: f64,
    external_resist_fx: f64,
    dt: f64,
) -> (WheelStepSummary, Vec<WheelStepTelemetry>) {
    step_per_wheel_dynamics_with_pwm(body, build, mu_env, cmd_v, cmd_v_lat, cmd_omega, external_resist_fx, dt, None)
}

pub fn step_per_wheel_dynamics_with_pwm(
    body: &mut BodyKinematicsState,
    build: &ResolvedBuild,
    mu_env: f64,
    cmd_v: f64,
    cmd_v_lat: f64,
    cmd_omega: f64,
    external_resist_fx: f64,
    dt: f64,
    wheel_pwms: Option<&[f64]>,
) -> (WheelStepSummary, Vec<WheelStepTelemetry>) {
    let wheels = &build.custom_wheels;
    let has_fan = build.rear_mod == "turbo_fan";
    let downforce_n = if has_fan { 2.8 } else { 0.0 };

    if build.driven_wheel_count == 0 && !has_fan {
        body.v_fwd *= (-12.0 * dt).exp();
        body.v_lat *= (-12.0 * dt).exp();
        body.omega *= (-12.0 * dt).exp();
        body.pitch_rad = 0.0;
        let tele = vec![
            WheelStepTelemetry {
                normal_n: 0.0,
                force_long_n: 0.0,
                force_lat_n: 0.0,
                slip_ratio: 0.0,
                steer_rad: 0.0,
            };
            wheels.len()
        ];
        return (
            WheelStepSummary {
                total_traction_n: 0.0,
                peak_wheel_slip: 0.0,
                slip_count: 0,
                drive_force_n: 0.0,
                can_strafe: false,
                bus_voltage: build.voltage * (0.88 + 0.12 * body.battery_soc),
                total_current_a: 0.4,
                battery_pct: body.battery_soc * 100.0,
            },
            tele,
        );
    }

    let loco = build.locomotion_mode.as_str();
    let can_strafe = matches!(loco, "holonomic_strafe" | "ackermann_4ws" | "custom_vector")
        && build.strafe_gain > 0.05;

    let max_spd = build.max_speed.max(0.05);
    let des_v = cmd_v.clamp(-max_spd, max_spd);
    let des_vlat = if can_strafe {
        cmd_v_lat.clamp(-max_spd * build.strafe_gain.max(0.2), max_spd * build.strafe_gain.max(0.2))
    } else {
        0.0
    };
    let des_w = cmd_omega.clamp(-build.max_omega.max(0.6) * 1.4, build.max_omega.max(0.6) * 1.4);

    // Visual steering angle smoothly tracks turning / crab-walk vector
    let max_steer_rad = (build.steer_max_deg * PI / 180.0).clamp(0.0, 1.5);
    let target_steer = if loco == "ackermann_4ws" && des_vlat.abs() > 0.05 {
        des_vlat.atan2(des_v.abs().max(0.15)).clamp(-max_steer_rad, max_steer_rad)
    } else {
        (-des_w * 0.24).clamp(-max_steer_rad, max_steer_rad)
    };
    body.steer_angle += (target_steer - body.steer_angle) * (1.0 - (-14.0 * dt).exp());

    // Normal loads with dynamic weight transfer estimate
    let est_a_fwd = ((des_v - body.v_fwd) / dt.max(0.005)).clamp(-build.max_accel * 1.5, build.max_accel * 1.5);
    let est_a_lat = (body.v_fwd * body.omega).clamp(-8.0, 8.0);
    let normal_loads = compute_wheel_normal_loads(wheels, build, est_a_fwd, est_a_lat, downforce_n);

    // Battery OCV & internal resistance sag
    let v_ocv = build.voltage * (0.88 + 0.12 * body.battery_soc.clamp(0.05, 1.0));
    let r_int = if build.voltage > 18.0 {
        0.048
    } else if build.voltage > 13.0 {
        0.038
    } else if build.voltage < 9.0 {
        0.065
    } else {
        0.045
    };
    let est_bus_v = (v_ocv - (body.v_fwd.abs() * 2.4 + 0.5) * r_int).max(build.voltage * 0.55);

    // Per-motor stall force budget distributed across driven wheels (scaled by bus voltage)
    let total_motor_force = if build.driven_wheel_count > 0 {
        let r_avg = wheels
            .iter()
            .filter(|w| w.driven)
            .map(|w| w.radius_m)
            .sum::<f64>()
            / (build.driven_wheel_count as f64);
        (build.torque * (build.motor_count as f64) * build.gear / r_avg.max(0.008)) * 1.45 * (est_bus_v / build.voltage.max(2.0))
    } else {
        0.0
    };
    let per_wheel_stall_cap = if build.driven_wheel_count > 0 {
        (total_motor_force / (build.driven_wheel_count as f64)).max(2.0)
    } else {
        0.0
    };

    let mass = build.total_mass.max(0.15);
    let iz = build.inertia_z.max(0.004);
    let mu_scale = (mu_env / 0.78).clamp(0.25, 1.8) * build.traction_gain.clamp(0.2, 3.0);

    let mut sum_fx = if has_fan { des_v.signum() * 1.6 } else { 0.0 } - external_resist_fx;
    let mut sum_fz = 0.0;
    let mut sum_my = 0.0;
    let mut total_traction_n = 0.0;
    let mut peak_wheel_slip = 0.0_f64;
    let mut slip_count = 0usize;
    let mut drive_force_n = 0.0_f64;
    let mut total_current_a = if has_fan { 1.4 } else { 0.35 } + build.control_hz * 0.004;
    let mut tele = Vec::with_capacity(wheels.len());

    // Servo velocity loop stiffness (N per (m/s))
    let k_drive = (mass * 16.0 / (build.driven_wheel_count.max(1) as f64)).clamp(4.5, 45.0);

    for (idx, w) in wheels.iter().enumerate() {
        let n_i = normal_loads[idx];
        let tire_mu = match w.tire_type.as_str() {
            "offroad" => 1.08,
            "rubber" => 1.02,
            "tracked" => 1.12,
            "omni" => 0.84,
            "caster" => 0.30,
            _ => 0.90, // mecanum
        } * mu_scale
            * build.grip.clamp(0.3, 2.0)
            / 0.86;
        let max_fric_n = (tire_mu * n_i).max(0.05);
        total_traction_n += max_fric_n;

        // Steer angle for this wheel
        let delta = if w.steered {
            if loco == "ackermann_4ws" && w.x_m < -0.01 && des_vlat.abs() <= 0.05 {
                -body.steer_angle * 0.8
            } else {
                body.steer_angle
            }
        } else {
            0.0
        };
        let theta = w.yaw_deg * PI / 180.0 + delta;
        let ct = theta.cos();
        let st = theta.sin();

        // Contact patch velocity in body frame: v + omega x r
        let v_bx = body.v_fwd - body.omega * w.z_m;
        let v_bz = body.v_lat + body.omega * w.x_m;
        // Transform into wheel-local frame (roll along theta, lat perpendicular)
        let v_roll = v_bx * ct + v_bz * st;
        let v_lat = -v_bx * st + v_bz * ct;

        // Desired contact velocity from high-level chassis command OR direct per-wheel firmware PWM
        let v_noload_i = ((build.rpm * build.gear * 2.0 * PI * w.radius_m) / 60.0)
            * (est_bus_v / 11.1).clamp(0.25, 4.5)
            * build.fwd_gain.max(0.1);
        let pwm_override = wheel_pwms.map(|p| p.get(idx).copied().unwrap_or(0.0).clamp(-1.0, 1.0));
        let (cmd_roll, cmd_lat_w) = if let Some(pwm_i) = pwm_override {
            (pwm_i * v_noload_i, 0.0)
        } else {
            let cmd_bx = des_v - des_w * w.z_m;
            let cmd_bz = des_vlat + des_w * w.x_m;
            (cmd_bx * ct + cmd_bz * st, -cmd_bx * st + cmd_bz * ct)
        };

        // DC motor linear torque-speed envelope for this wheel
        let speed_ratio = if cmd_roll.abs() > 1e-3 {
            (v_roll * cmd_roll.signum()) / v_noload_i.max(0.15)
        } else {
            0.0
        };
        let torque_env = (1.08 - 0.65 * speed_ratio).clamp(0.18, 1.35);
        let per_wheel_motor_cap = per_wheel_stall_cap * torque_env;

        let (mut f_roll, mut f_lat) = match w.tire_type.as_str() {
            "caster" => (
                -0.06 * n_i * v_roll.clamp(-1.0, 1.0),
                -0.08 * n_i * v_lat.clamp(-1.0, 1.0),
            ),
            "omni" => (
                if w.driven {
                    (k_drive * (cmd_roll - v_roll)).clamp(-per_wheel_motor_cap, per_wheel_motor_cap)
                } else {
                    -0.10 * n_i * v_roll.clamp(-1.0, 1.0)
                },
                -0.12 * n_i * v_lat.clamp(-1.0, 1.0),
            ),
            "mecanum" => {
                let roller_sign = if (w.x_m * w.z_m) < 0.0 { 1.0 } else { -1.0 };
                if w.driven {
                    if pwm_override.is_some() {
                        // Direct PWM mode: motor spin induces longitudinal + 45-deg roller lateral thrust
                        let f_r = (k_drive * (cmd_roll - v_roll)).clamp(-per_wheel_motor_cap, per_wheel_motor_cap);
                        let f_l = (roller_sign * f_r * 0.92 - k_drive * 0.14 * v_lat).clamp(-per_wheel_motor_cap, per_wheel_motor_cap);
                        (f_r, f_l)
                    } else {
                        let req_roll = k_drive * (cmd_roll - v_roll);
                        let req_lat = k_drive * 0.92 * (cmd_lat_w - v_lat);
                        (
                            req_roll.clamp(-per_wheel_motor_cap, per_wheel_motor_cap),
                            (req_lat + 0.15 * roller_sign * (cmd_lat_w - v_lat)).clamp(-per_wheel_motor_cap, per_wheel_motor_cap),
                        )
                    }
                } else {
                    (
                        -0.12 * n_i * v_roll.clamp(-1.0, 1.0),
                        -0.15 * n_i * v_lat.clamp(-1.0, 1.0),
                    )
                }
            }
            _ => {
                let fr = if w.driven {
                    (k_drive * (cmd_roll - v_roll)).clamp(-per_wheel_motor_cap, per_wheel_motor_cap)
                } else {
                    -0.12 * n_i * v_roll.clamp(-1.0, 1.0)
                };
                let k_lat = k_drive * 1.45 * build.lateral_drag.clamp(0.2, 3.0);
                let fl = if can_strafe && loco == "ackermann_4ws" {
                    k_lat * 0.45 * (cmd_lat_w - v_lat)
                } else {
                    -k_lat * v_lat
                };
                (fr, fl)
            }
        };

        // Coulomb friction circle clamping: |F| <= mu_i * N_i
        let f_mag = f_roll.hypot(f_lat);
        let slip_ratio = if f_mag > max_fric_n && max_fric_n > 1e-4 {
            let s = max_fric_n / f_mag;
            f_roll *= s;
            f_lat *= s;
            slip_count += 1;
            ((f_mag - max_fric_n) / max_fric_n).min(1.0)
        } else {
            0.0
        };
        peak_wheel_slip = peak_wheel_slip.max(slip_ratio);

        if w.driven {
            let mech_w = (f_roll.abs() * w.radius_m / build.gear.max(0.1)) * (v_roll.abs() / w.radius_m.max(0.01)) + 0.6;
            total_current_a += (mech_w / est_bus_v.max(2.0)) + f_roll.abs() * 0.14;
        }

        // Rotate wheel force back to body frame (+X_body, +Z_body)
        let fb_x = f_roll * ct - f_lat * st;
        let fb_z = f_roll * st + f_lat * ct;
        sum_fx += fb_x;
        sum_fz += fb_z;
        sum_my += -w.z_m * fb_x + w.x_m * fb_z;
        drive_force_n += fb_x.hypot(fb_z);

        tele.push(WheelStepTelemetry {
            normal_n: n_i,
            force_long_n: f_roll,
            force_lat_n: f_lat,
            slip_ratio,
            steer_rad: delta,
        });
    }

    let bus_voltage = (v_ocv - total_current_a * r_int).max(build.voltage * 0.55);
    let cap_as = (build.capacity_ah.max(0.2) * 3600.0).max(600.0);
    body.battery_soc = (body.battery_soc - (total_current_a * dt) / cap_as).clamp(0.05, 1.0);

    // Integrate body velocities (semi-implicit Euler with aerodynamic/chassis damping)
    let prev_v = body.v_fwd;
    let a_x = sum_fx / mass;
    let a_z = sum_fz / mass;
    let alpha_y = sum_my / iz;

    body.v_fwd = (body.v_fwd + a_x * dt).clamp(-max_spd * 1.15, max_spd * 1.15);
    body.v_lat = (body.v_lat + a_z * dt).clamp(-max_spd * 1.05, max_spd * 1.05);
    body.omega = (body.omega + alpha_y * dt).clamp(-build.max_omega.max(0.6) * 1.5, build.max_omega.max(0.6) * 1.5);

    // Small air/chassis drag so 0-command coasts smoothly to stop
    let coast_damp = (-1.6 * dt).exp();
    if wheel_pwms.is_none() {
        if des_v.abs() < 1e-3 {
            body.v_fwd *= coast_damp;
        }
        if des_vlat.abs() < 1e-3 && !can_strafe {
            body.v_lat *= (-6.0 * dt).exp();
        }
        if des_w.abs() < 1e-3 {
            body.omega *= coast_damp;
        }
    } else {
        body.v_fwd *= (-0.35 * dt).exp();
        body.v_lat *= (-0.35 * dt).exp();
        body.omega *= (-0.35 * dt).exp();
    }

    // 2-wheel self-balancing dynamic pitch
    if loco == "self_balance_2w" {
        let actual_a = (body.v_fwd - prev_v) / dt.max(0.004);
        let target_pitch = (-body.v_fwd * 0.14 - actual_a * 0.03).clamp(-0.26, 0.26);
        body.pitch_rad += (target_pitch - body.pitch_rad) * (1.0 - (-10.0 * dt).exp());
    } else {
        body.pitch_rad = 0.0;
    }

    // Integrate world pose: +X forward when yaw=0, +Z right when yaw=pi/2
    body.yaw = normalise_angle(body.yaw + body.omega * dt);
    let fx = body.yaw.cos();
    let fz = body.yaw.sin();
    let rx = -fz;
    let rz = fx;
    body.x += (fx * body.v_fwd + rx * body.v_lat) * dt;
    body.z += (fz * body.v_fwd + rz * body.v_lat) * dt;

    let r_spin = wheels
        .iter()
        .filter(|w| w.driven)
        .map(|w| w.radius_m)
        .next()
        .unwrap_or(0.030)
        .max(0.010);
    body.wheel_spin += (body.v_fwd * dt) / r_spin;

    (
        WheelStepSummary {
            total_traction_n,
            peak_wheel_slip,
            slip_count,
            drive_force_n,
            can_strafe,
            bus_voltage,
            total_current_a,
            battery_pct: body.battery_soc * 100.0,
        },
        tele,
    )
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
