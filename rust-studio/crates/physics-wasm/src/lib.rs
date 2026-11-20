use std::cell::RefCell;
use std::slice;
use xiangqi_core::{AssemblyGraph, ResolvedBuild};
use xiangqi_sim::sim_world::SimWorld;
use xiangqi_sim::PhysicsEnv;

const OUT_CAP: usize = 256;

thread_local! {
    static WORLD: RefCell<Option<SimWorld>> = const { RefCell::new(None) };
    static OUT_BUF: RefCell<[f64; OUT_CAP]> = const { RefCell::new([0.0; OUT_CAP]) };
}

static mut LAST_OUT_PTR: *const f64 = std::ptr::null();
static mut MOTOR_PWM_BUF: [f64; 16] = [0.0; 16];

#[no_mangle]
pub extern "C" fn wasm_alloc(len: usize) -> *mut u8 {
    let mut buf = Vec::<u8>::with_capacity(len.max(1));
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[no_mangle]
pub extern "C" fn wasm_free(ptr: *mut u8, len: usize) {
    if !ptr.is_null() && len > 0 {
        unsafe {
            let _ = Vec::from_raw_parts(ptr, 0, len);
        }
    }
}

#[no_mangle]
pub extern "C" fn wasm_out_ptr() -> *const f64 {
    unsafe { LAST_OUT_PTR }
}

fn write_world_to_out(w: &SimWorld) {
    OUT_BUF.with(|cell| {
        let mut out = cell.borrow_mut();
        out[0] = w.body.x;
        out[1] = w.body.z;
        out[2] = w.body.yaw;
        out[3] = w.body.v_fwd;
        out[4] = w.body.v_lat;
        out[5] = w.body.omega;
        out[6] = w.body.wheel_spin;
        out[7] = w.body.steer_angle;
        out[8] = w.body.pitch_rad;
        out[9] = w.enemy.x;
        out[10] = w.enemy.z;
        out[11] = w.enemy.yaw;
        out[12] = w.enemy.v;
        out[13] = w.enemy.wheel_spin;
        out[14] = w.time_s;
        out[15] = w.score() as f64;
        out[16] = w.last_wheel_summary.total_traction_n;
        out[17] = w.last_wheel_summary.peak_wheel_slip;
        out[18] = w.last_wheel_summary.drive_force_n;
        out[19] = w.last_wheel_summary.slip_count as f64;
        let count = w.pieces.len().min(36);
        out[20] = count as f64;
        for (i, p) in w.pieces.iter().take(count).enumerate() {
            let base = 21 + i * 6;
            out[base] = p.x;
            out[base + 1] = p.z;
            out[base + 2] = p.vx;
            out[base + 3] = p.vz;
            out[base + 4] = if p.scored { 1.0 } else { 0.0 };
            out[base + 5] = if p.held { 1.0 } else { 0.0 };
        }
        out[240] = w.last_wheel_summary.bus_voltage;
        out[241] = w.last_wheel_summary.total_current_a;
        out[242] = w.last_wheel_summary.battery_pct;
        out[243] = w.wrong_pieces_in_goal() as f64;
        out[244] = w.official_net_score() as f64;
        unsafe {
            LAST_OUT_PTR = out.as_ptr();
        }
    });
}

fn read_str(ptr: *const u8, len: usize) -> String {
    if ptr.is_null() || len == 0 {
        return String::new();
    }
    let bytes = unsafe { slice::from_raw_parts(ptr, len) };
    String::from_utf8_lossy(bytes).into_owned()
}

#[no_mangle]
pub extern "C" fn wasm_init_world(
    build_ptr: *const u8,
    build_len: usize,
    env_ptr: *const u8,
    env_len: usize,
    seed: u32,
    layout_ptr: *const u8,
    layout_len: usize,
    versus: i32,
) -> i32 {
    let build_str = read_str(build_ptr, build_len);
    let env_str = read_str(env_ptr, env_len);
    let layout = read_str(layout_ptr, layout_len);
    let build: ResolvedBuild = serde_json::from_str(&build_str)
        .unwrap_or_else(|_| AssemblyGraph::default_competition_robot().resolve_kinematics());
    let env: PhysicsEnv = serde_json::from_str(&env_str).unwrap_or_default();
    let world = SimWorld::new(build, env, seed as u64, &layout, versus != 0);
    write_world_to_out(&world);
    WORLD.with(|cell| {
        *cell.borrow_mut() = Some(world);
    });
    1
}

#[no_mangle]
pub extern "C" fn wasm_update_build(
    build_ptr: *const u8,
    build_len: usize,
    env_ptr: *const u8,
    env_len: usize,
    versus: i32,
) -> i32 {
    let build_str = read_str(build_ptr, build_len);
    let env_str = read_str(env_ptr, env_len);
    let Ok(build) = serde_json::from_str::<ResolvedBuild>(&build_str) else {
        return 0;
    };
    let env: PhysicsEnv = serde_json::from_str(&env_str).unwrap_or_default();
    WORLD.with(|cell| {
        let mut opt = cell.borrow_mut();
        if let Some(w) = opt.as_mut() {
            w.update_build(build, env, versus != 0);
            write_world_to_out(w);
            1
        } else {
            let world = SimWorld::new(build, env, 42, "grid", versus != 0);
            write_world_to_out(&world);
            *opt = Some(world);
            1
        }
    })
}

#[no_mangle]
pub extern "C" fn wasm_set_motor_pwm(idx: usize, pwm: f64) {
    if idx < 16 {
        unsafe {
            MOTOR_PWM_BUF[idx] = pwm.clamp(-1.0, 1.0);
        }
    }
}

#[no_mangle]
pub extern "C" fn wasm_step_motors(dt: f64, wheel_count: usize) -> i32 {
    let n = wheel_count.min(16);
    WORLD.with(|cell| {
        let mut opt = cell.borrow_mut();
        let Some(w) = opt.as_mut() else {
            return 0;
        };
        let pwms = unsafe { &MOTOR_PWM_BUF[..n] };
        w.step_motors(dt, pwms);
        write_world_to_out(w);
        1
    })
}

#[no_mangle]
pub extern "C" fn wasm_step(dt: f64, has_cmd: i32, cmd_v: f64, cmd_vlat: f64, cmd_omega: f64) -> i32 {
    WORLD.with(|cell| {
        let mut opt = cell.borrow_mut();
        let Some(w) = opt.as_mut() else {
            return 0;
        };
        let cmd = if has_cmd != 0 {
            Some((cmd_v, cmd_vlat, cmd_omega))
        } else {
            None
        };
        w.step(dt, cmd);
        write_world_to_out(w);
        1
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wasm_ffi_roundtrip() {
        let build = AssemblyGraph::default_competition_robot().resolve_kinematics();
        let b_json = serde_json::to_string(&build).unwrap();
        let e_json = serde_json::to_string(&PhysicsEnv::preset("standard")).unwrap();
        let layout = "grid";
        let ok = wasm_init_world(
            b_json.as_ptr(),
            b_json.len(),
            e_json.as_ptr(),
            e_json.len(),
            42,
            layout.as_ptr(),
            layout.len(),
            0,
        );
        assert_eq!(ok, 1);
        assert_eq!(wasm_step(0.02, 1, 0.8, 0.0, 0.0), 1);
        let ptr = wasm_out_ptr();
        assert!(!ptr.is_null());
        let out = unsafe { slice::from_raw_parts(ptr, 25) };
        assert!(out[0] > 0.42, "Robot should move forward along +X");
        assert!(out[16] > 5.0, "Should report real traction N");
    }

    #[test]
    fn test_wasm_direct_motor_pwm_mecanum_strafe() {
        let build = AssemblyGraph::default_competition_robot().resolve_kinematics();
        let b_json = serde_json::to_string(&build).unwrap();
        let e_json = serde_json::to_string(&PhysicsEnv::preset("standard")).unwrap();
        let layout = "grid";
        assert_eq!(
            wasm_init_world(b_json.as_ptr(), b_json.len(), e_json.as_ptr(), e_json.len(), 42, layout.as_ptr(), layout.len(), 0),
            1
        );
        // Standard 4-wheel mecanum strafe right (+Z): FL=+0.8, FR=-0.8, RL=-0.8, RR=+0.8
        wasm_set_motor_pwm(0, 0.8);
        wasm_set_motor_pwm(1, -0.8);
        wasm_set_motor_pwm(2, -0.8);
        wasm_set_motor_pwm(3, 0.8);
        for _ in 0..25 {
            assert_eq!(wasm_step_motors(0.02, 4), 1);
        }
        let out = unsafe { slice::from_raw_parts(wasm_out_ptr(), 10) };
        assert!(out[1] > 1.05, "Mecanum PWM strafe should move +Z right, got z={}", out[1]);
        assert!((out[0] - 0.42).abs() < 0.08, "Mecanum PWM strafe should have minimal X drift, got x={}", out[0]);
        assert!(out[2].abs() < 0.25, "Mecanum PWM strafe should have bounded open-loop yaw drift, got yaw={}", out[2]);
    }

    #[test]
    fn test_official_wrong_piece_penalty() {
        let build = AssemblyGraph::default_competition_robot().resolve_kinematics();
        let mut world = SimWorld::new(build, PhysicsEnv::preset("standard"), 42, "grid", false);
        assert_eq!(world.wrong_pieces_in_goal(), 0);
        // Move a black (opponent) piece into the red goal zone
        if let Some(blk) = world.pieces.iter_mut().find(|p| !p.is_red) {
            blk.x = 0.25;
            blk.z = 1.00;
        }
        assert_eq!(world.wrong_pieces_in_goal(), 1);
        assert_eq!(world.official_net_score(), -3);
    }
}
