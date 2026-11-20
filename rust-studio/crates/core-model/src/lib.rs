pub mod cad_kernel;

use cad_kernel::{CadMesh, Hole2D, SketchProfile};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::f64::consts::PI;

pub const TRACK_LIMIT_LENGTH_M: f64 = 0.300;
pub const TRACK_LIMIT_WIDTH_M: f64 = 0.300;
pub const TRACK_LIMIT_HEIGHT_M: f64 = 0.300;
pub const TRACK_LIMIT_MASS_KG: f64 = 2.50;
pub const PIECE_RADIUS_M: f64 = 0.0335;
pub const PIECE_HEIGHT_M: f64 = 0.017;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModuleKind {
    Chassis,
    Motor,
    WheelAxle,
    FrontScoop,
    Wing,
    Camera,
    LaserOpto,
    Controller,
    Battery,
    SafetyEStop,
    CustomCad,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PortKind {
    DeckTop,
    DeckBottom,
    FrontBulkhead,
    AxleMount,
    WingHingeLeft,
    WingHingeRight,
    GimbalMount,
    UniversalM3,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountingPort {
    pub id: String,
    pub kind: PortKind,
    pub local_pos: [f64; 3],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MateEdge {
    pub child_id: String,
    pub parent_id: String,
    pub parent_port: String,
    pub offset: [f64; 3],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PuzzleNode {
    pub id: String,
    pub kind: ModuleKind,
    pub name: String,
    pub enabled: bool,
    pub mass_kg: f64,
    pub local_pos: [f64; 3],
    pub rotation_deg: [f64; 3],
    pub params: serde_json::Value,
    #[serde(default)]
    pub custom_sketch: Option<SketchProfile>,
    #[serde(default)]
    pub ports: Vec<MountingPort>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomWheelSpec {
    pub id: String,
    /// Fore/aft position relative to chassis center in meters (+front, -rear)
    pub x_m: f64,
    /// Lateral position relative to chassis center in meters (-left, +right)
    pub z_m: f64,
    pub radius_m: f64,
    pub width_m: f64,
    pub yaw_deg: f64,
    pub tire_type: String,
    pub driven: bool,
    pub steered: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CadColliderBox {
    pub id: String,
    pub center_x_m: f64,
    pub center_z_m: f64,
    pub half_x_m: f64,
    pub half_z_m: f64,
    pub min_y_m: f64,
    pub max_y_m: f64,
    pub yaw_deg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssemblyGraph {
    pub project_name: String,
    pub unrestricted_mode: bool,
    pub nodes: Vec<PuzzleNode>,
    pub mates: Vec<MateEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedBuild {
    pub length: f64,
    pub width: f64,
    pub height: f64,
    pub ground_clearance: f64,
    pub front_chamfer: f64,
    pub rpm: f64,
    pub torque: f64,
    pub gear: f64,
    pub motor_count: u32,
    pub front_wheel_radius: f64,
    pub rear_wheel_radius: f64,
    pub front_track: f64,
    pub rear_track: f64,
    pub wheelbase: f64,
    pub wheel_offset_z: f64,
    pub grip: f64,
    pub wheel_count: usize,
    pub driven_wheel_count: usize,
    pub wheel_width: f64,
    pub tire_type: String,
    pub locomotion_mode: String,
    pub fwd_gain: f64,
    pub strafe_gain: f64,
    pub omega_gain: f64,
    pub steer_max_deg: f64,
    pub traction_gain: f64,
    pub lateral_drag: f64,
    pub custom_wheels: Vec<CustomWheelSpec>,
    pub frame_style: String,
    pub drive_type: String,
    pub device_kind: String,
    pub rear_mod: String,
    pub sensor_suite: String,
    pub device_width: f64,
    pub device_offset: f64,
    pub device_mount_x: f64,
    pub device_mount_y: f64,
    pub device_height: f64,
    pub left_wing_depth: f64,
    pub left_wing_splay: f64,
    pub right_wing_depth: f64,
    pub right_wing_splay: f64,
    pub fov_deg: f64,
    pub sensor_range_m: f64,
    pub camera_height: f64,
    pub camera_pitch_deg: f64,
    pub camera_mount_x: f64,
    pub camera_mount_z: f64,
    pub camera_mount_yaw: f64,
    pub laser_rays: u32,
    pub laser_power_mw: f64,
    pub control_hz: f64,
    pub voltage: f64,
    pub capacity_ah: f64,
    pub total_mass: f64,
    pub envelope_length: f64,
    pub envelope_width: f64,
    pub envelope_height: f64,
    pub envelope: [f64; 3],
    pub cg_x: f64,
    pub cg_z: f64,
    pub front_axle_pct: i32,
    pub rear_axle_pct: i32,
    pub left_axle_pct: i32,
    pub right_axle_pct: i32,
    pub inertia_z: f64,
    pub max_speed: f64,
    pub max_accel: f64,
    pub max_omega: f64,
    pub push_force: f64,
    pub mouth_width: f64,
    pub custom_part_count: usize,
    #[serde(default)]
    pub custom_cad_colliders: Vec<CadColliderBox>,
    pub assembly_notes: Vec<String>,
    pub compliance_issues: Vec<String>,
}

impl AssemblyGraph {
    pub fn default_competition_robot() -> Self {
        let chassis = PuzzleNode {
            id: "chassis_main".into(),
            kind: ModuleKind::Chassis,
            name: "极轻碳纤双层骨架".into(),
            enabled: true,
            mass_kg: 0.42,
            local_pos: [0.0, 0.018, 0.0],
            rotation_deg: [0.0, 0.0, 0.0],
            params: serde_json::json!({
                "length": 0.235, "width": 0.215, "height": 0.088,
                "ground_clearance": 0.018, "front_chamfer": 0.016, "frame_style": "dual_deck"
            }),
            custom_sketch: Some(SketchProfile::chamfered_rect(
                "chassis_deck",
                0.215,
                0.235,
                0.016,
                0.005,
                1550.0,
                vec![
                    Hole2D { cx: -0.06, cz: 0.0, radius: 0.012 },
                    Hole2D { cx: 0.06, cz: 0.0, radius: 0.012 },
                ],
            )),
            ports: vec![
                MountingPort { id: "top_deck".into(), kind: PortKind::DeckTop, local_pos: [0.0, 0.106, 0.0] },
                MountingPort { id: "bottom_deck".into(), kind: PortKind::DeckBottom, local_pos: [0.0, 0.018, 0.0] },
                MountingPort { id: "front_bulkhead".into(), kind: PortKind::FrontBulkhead, local_pos: [0.0, 0.055, 0.1175] },
                MountingPort { id: "axle_station".into(), kind: PortKind::AxleMount, local_pos: [0.0, 0.030, 0.0] },
                MountingPort { id: "m3_universal".into(), kind: PortKind::UniversalM3, local_pos: [0.0, 0.106, 0.0] },
            ],
        };

        let motor = PuzzleNode {
            id: "motor_drive".into(),
            kind: ModuleKind::Motor,
            name: "360RPM 高扭减速编码电机 ×2".into(),
            enabled: true,
            mass_kg: 0.28,
            local_pos: [0.0, 0.030, -0.045],
            rotation_deg: [0.0, 0.0, 0.0],
            params: serde_json::json!({ "rpm": 360.0, "torque": 0.32, "gear": 1.15, "motor_count": 2 }),
            custom_sketch: None,
            ports: vec![],
        };

        let wheel = PuzzleNode {
            id: "wheel_mecanum".into(),
            kind: ModuleKind::WheelAxle,
            name: "麦克纳姆全向轮 ×4 (独立前后轴)".into(),
            enabled: true,
            mass_kg: 0.26,
            local_pos: [0.0, 0.030, 0.0],
            rotation_deg: [0.0, 0.0, 0.0],
            params: serde_json::json!({
                "drive_type": "mecanum",
                "drive_mode": "mecanum",
                "tire_type": "mecanum",
                "locomotion_mode": "holonomic_strafe",
                "wheel_count": 4,
                "wheel_layout": "symmetric_axles",
                "front_wheel_radius": 0.030, "rear_wheel_radius": 0.030,
                "wheel_width": 0.026,
                "front_track": 0.210, "rear_track": 0.210,
                "wheelbase": 0.175, "wheel_offset_z": 0.0, "grip": 0.86,
                "fwd_gain": 1.0, "strafe_gain": 0.82, "omega_gain": 1.0,
                "steer_max_deg": 28.0, "traction_gain": 1.0, "lateral_drag": 0.85
            }),
            custom_sketch: None,
            ports: vec![],
        };

        let scoop = PuzzleNode {
            id: "device_scoop".into(),
            kind: ModuleKind::FrontScoop,
            name: "前端主推斗背板".into(),
            enabled: true,
            mass_kg: 0.05,
            local_pos: [0.0, 0.002, 0.1395],
            rotation_deg: [0.0, 0.0, 0.0],
            params: serde_json::json!({
                "device_width": 0.185, "device_offset": 0.022,
                "device_mount_x": 0.0, "device_mount_y": 0.002, "device_height": 0.054
            }),
            custom_sketch: Some(SketchProfile::u_scoop(
                "device_scoop", 0.185, 0.006, 0.020, 10.0, 0.020, 10.0, 0.054, 1380.0,
            )),
            ports: vec![
                MountingPort { id: "wing_left".into(), kind: PortKind::WingHingeLeft, local_pos: [-0.0925, 0.028, 0.1395] },
                MountingPort { id: "wing_right".into(), kind: PortKind::WingHingeRight, local_pos: [0.0925, 0.028, 0.1395] },
            ],
        };

        let wing = PuzzleNode {
            id: "wing_pair".into(),
            kind: ModuleKind::Wing,
            name: "独立左右侧翼 (20mm · 10°)".into(),
            enabled: true,
            mass_kg: 0.03,
            local_pos: [0.0, 0.028, 0.1395],
            rotation_deg: [0.0, 0.0, 0.0],
            params: serde_json::json!({
                "left_wing_depth": 0.020, "left_wing_splay": 10.0,
                "right_wing_depth": 0.020, "right_wing_splay": 10.0, "dividers": 0
            }),
            custom_sketch: None,
            ports: vec![],
        };

        let camera = PuzzleNode {
            id: "camera_main".into(),
            kind: ModuleKind::Camera,
            name: "110° 全局快门单目相机".into(),
            enabled: true,
            mass_kg: 0.09,
            local_pos: [0.0, 0.185, 0.070],
            rotation_deg: [-22.0, 0.0, 0.0],
            params: serde_json::json!({
                "fov_deg": 110.0, "sensor_range_m": 1.75, "camera_height": 0.185,
                "camera_pitch_deg": 22.0, "camera_mount_x": 0.0, "camera_mount_z": 0.070, "camera_mount_yaw": 0.0
            }),
            custom_sketch: None,
            ports: vec![],
        };

        let sensor = PuzzleNode {
            id: "sensor_laser".into(),
            kind: ModuleKind::LaserOpto,
            name: "3路安全激光 + 推斗对管 + IMU".into(),
            enabled: true,
            mass_kg: 0.07,
            local_pos: [0.0, 0.116, 0.095],
            rotation_deg: [0.0, 0.0, 0.0],
            params: serde_json::json!({ "laser_rays": 3, "laser_power_mw": 0.85, "has_pocket_sensor": true }),
            custom_sketch: None,
            ports: vec![],
        };

        let controller = PuzzleNode {
            id: "ctrl_k230".into(),
            kind: ModuleKind::Controller,
            name: "K230视觉 + STM32实时底盘板".into(),
            enabled: true,
            mass_kg: 0.08,
            local_pos: [-0.020, 0.118, -0.025],
            rotation_deg: [0.0, 0.0, 0.0],
            params: serde_json::json!({ "control_hz": 50.0 }),
            custom_sketch: None,
            ports: vec![],
        };

        let battery = PuzzleNode {
            id: "batt_3s".into(),
            kind: ModuleKind::Battery,
            name: "3S 1500mAh 轻量锂电".into(),
            enabled: true,
            mass_kg: 0.13,
            local_pos: [0.035, 0.120, -0.025],
            rotation_deg: [0.0, 0.0, 0.0],
            params: serde_json::json!({ "voltage": 11.1, "capacity_ah": 1.5 }),
            custom_sketch: None,
            ports: vec![],
        };

        let safety = PuzzleNode {
            id: "safety_estop".into(),
            kind: ModuleKind::SafetyEStop,
            name: "蘑菇头急停 + 1A熔断套件".into(),
            enabled: true,
            mass_kg: 0.06,
            local_pos: [-0.060, 0.118, -0.070],
            rotation_deg: [0.0, 0.0, 0.0],
            params: serde_json::json!({ "e_stop_type": "蘑菇头急停" }),
            custom_sketch: None,
            ports: vec![],
        };

        let mates = vec![
            MateEdge { child_id: "motor_drive".into(), parent_id: "chassis_main".into(), parent_port: "axle_station".into(), offset: [0.0, 0.0, -0.045] },
            MateEdge { child_id: "wheel_mecanum".into(), parent_id: "chassis_main".into(), parent_port: "axle_station".into(), offset: [0.0, 0.0, 0.0] },
            MateEdge { child_id: "device_scoop".into(), parent_id: "chassis_main".into(), parent_port: "front_bulkhead".into(), offset: [0.0, -0.053, 0.022] },
            MateEdge { child_id: "wing_pair".into(), parent_id: "device_scoop".into(), parent_port: "wing_left".into(), offset: [0.0, 0.0, 0.0] },
            MateEdge { child_id: "camera_main".into(), parent_id: "chassis_main".into(), parent_port: "top_deck".into(), offset: [0.0, 0.079, 0.070] },
            MateEdge { child_id: "sensor_laser".into(), parent_id: "chassis_main".into(), parent_port: "top_deck".into(), offset: [0.0, 0.010, 0.095] },
            MateEdge { child_id: "ctrl_k230".into(), parent_id: "chassis_main".into(), parent_port: "top_deck".into(), offset: [-0.020, 0.012, -0.025] },
            MateEdge { child_id: "batt_3s".into(), parent_id: "chassis_main".into(), parent_port: "top_deck".into(), offset: [0.035, 0.014, -0.025] },
            MateEdge { child_id: "safety_estop".into(), parent_id: "chassis_main".into(), parent_port: "top_deck".into(), offset: [-0.060, 0.012, -0.070] },
        ];

        Self {
            project_name: "智能车光电象棋工程总装".into(),
            unrestricted_mode: true,
            nodes: vec![chassis, motor, wheel, scoop, wing, camera, sensor, controller, battery, safety],
            mates,
        }
    }

    pub fn snap_module(&mut self, mut node: PuzzleNode, parent_id: &str, port_id: &str, offset: [f64; 3]) -> Result<(), String> {
        let port_pos = self
            .nodes
            .iter()
            .find(|n| n.id == parent_id)
            .and_then(|p| p.ports.iter().find(|pt| pt.id == port_id))
            .map(|pt| pt.local_pos)
            .ok_or_else(|| format!("Port '{port_id}' not found on parent '{parent_id}'"))?;

        node.local_pos = [
            port_pos[0] + offset[0],
            port_pos[1] + offset[1],
            port_pos[2] + offset[2],
        ];

        if let Some(existing) = self.nodes.iter_mut().find(|n| n.id == node.id) {
            *existing = node.clone();
        } else {
            self.nodes.push(node.clone());
        }

        self.mates.retain(|m| m.child_id != node.id);
        self.mates.push(MateEdge {
            child_id: node.id,
            parent_id: parent_id.to_string(),
            parent_port: port_id.to_string(),
            offset,
        });
        Ok(())
    }

    pub fn add_custom_cad_part(
        &mut self,
        id: String,
        sketch: SketchProfile,
        parent_id: &str,
        port_id: &str,
        offset: [f64; 3],
    ) -> Result<CadMesh, String> {
        let mesh = sketch.extrude();
        let node = PuzzleNode {
            id,
            kind: ModuleKind::CustomCad,
            name: sketch.name.clone(),
            enabled: true,
            mass_kg: mesh.mass_kg,
            local_pos: [0.0; 3],
            rotation_deg: [0.0; 3],
            params: serde_json::json!({
                "area_m2": mesh.area_m2,
                "volume_m3": mesh.volume_m3,
                "density_kg_m3": sketch.density_kg_m3,
                "thickness": sketch.thickness,
            }),
            custom_sketch: Some(sketch),
            ports: vec![MountingPort {
                id: "custom_top".into(),
                kind: PortKind::UniversalM3,
                local_pos: [0.0, mesh.bounds_max[1], 0.0],
            }],
        };
        self.snap_module(node, parent_id, port_id, offset)?;
        Ok(mesh)
    }

    pub fn remove_node(&mut self, node_id: &str) -> bool {
        let before = self.nodes.len();
        self.nodes.retain(|n| n.id != node_id);
        self.mates.retain(|m| m.child_id != node_id && m.parent_id != node_id);
        self.nodes.len() < before
    }

    pub fn resolve_kinematics(&self) -> ResolvedBuild {
        let by_kind = |k: ModuleKind| -> Vec<&PuzzleNode> {
            self.nodes.iter().filter(|n| n.enabled && n.kind == k).collect()
        };
        let f64_p = |n: Option<&&PuzzleNode>, key: &str, fb: f64| -> f64 {
            n.and_then(|node| node.params.get(key)).and_then(|v| v.as_f64()).unwrap_or(fb)
        };

        let ch_list = by_kind(ModuleKind::Chassis);
        let ch = ch_list.first();
        let length = f64_p(ch, "length", 0.235).max(0.04);
        let width = f64_p(ch, "width", 0.215).max(0.04);
        let height = f64_p(ch, "height", 0.088).max(0.012);
        let ground_clearance = f64_p(ch, "ground_clearance", 0.018).max(0.001);
        let front_chamfer = f64_p(ch, "front_chamfer", 0.016).max(0.0);

        let mot_list = by_kind(ModuleKind::Motor);
        let mot = mot_list.first();
        let rpm = f64_p(mot, "rpm", 360.0).max(10.0);
        let torque = f64_p(mot, "torque", 0.32).max(0.005);
        let gear = f64_p(mot, "gear", 1.15).max(0.05);
        let motor_count = (f64_p(mot, "motor_count", 2.0).round() as u32).max(1);

        let wh_list = by_kind(ModuleKind::WheelAxle);
        let wh = wh_list.first();
        let str_p = |n: Option<&&PuzzleNode>, key: &str, fb: &str| -> String {
            n.and_then(|node| node.params.get(key))
                .and_then(|v| v.as_str())
                .unwrap_or(fb)
                .to_string()
        };
        let frame_style = str_p(ch, "frame_style", "dual_deck");
        let rear_mod = str_p(ch, "rear_mod", "none");
        let drive_type = str_p(wh, "drive_type", "mecanum");
        let front_wheel_radius = wh
            .and_then(|n| n.params.get("front_wheel_radius").or_else(|| n.params.get("front_radius")))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.030)
            .max(0.006);
        let rear_wheel_radius = wh
            .and_then(|n| n.params.get("rear_wheel_radius").or_else(|| n.params.get("rear_radius")))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.030)
            .max(0.006);
        let wheel_radius = (front_wheel_radius + rear_wheel_radius) * 0.5;
        let front_track = f64_p(wh, "front_track", 0.210).max(0.02);
        let rear_track = f64_p(wh, "rear_track", 0.210).max(0.02);
        let track = front_track.max(rear_track);
        let wheelbase = f64_p(wh, "wheelbase", 0.175).max(0.02);
        let wheel_offset_z = f64_p(wh, "wheel_offset_z", 0.0);
        let base_grip = f64_p(wh, "grip", 0.86).max(0.05);
        let grip = match drive_type.as_str() {
            "tracked" => base_grip * 1.24,
            "six_wd" => base_grip * 1.18,
            "rwd_caster" => base_grip * 1.12,
            "omni" => base_grip * 0.96,
            _ => base_grip,
        };
        let wheel_width = f64_p(wh, "wheel_width", 0.026).max(0.006);
        let tire_type = str_p(wh, "tire_type", match drive_type.as_str() {
            "omni" => "omni",
            "tracked" => "tracked",
            "rwd_caster" => "rubber",
            "six_wd" => "offroad",
            _ => "mecanum",
        });
        let locomotion_mode = str_p(wh, "locomotion_mode", match drive_type.as_str() {
            "mecanum" | "omni" => "holonomic_strafe",
            _ => "diff_skid",
        });
        let fwd_gain = f64_p(wh, "fwd_gain", 1.0).clamp(0.1, 4.0);
        let default_strafe = if matches!(locomotion_mode.as_str(), "holonomic_strafe" | "ackermann_4ws" | "custom_vector") {
            0.80
        } else {
            0.0
        };
        let strafe_gain = f64_p(wh, "strafe_gain", default_strafe).clamp(0.0, 3.0);
        let omega_gain = f64_p(wh, "omega_gain", 1.0).clamp(0.1, 4.0);
        let steer_max_deg = f64_p(wh, "steer_max_deg", 28.0).clamp(0.0, 89.0);
        let traction_gain = f64_p(wh, "traction_gain", 1.0).clamp(0.1, 4.0);
        let lateral_drag = f64_p(wh, "lateral_drag", 0.85).clamp(0.05, 4.0);

        let synthesize_wheels = |count: usize, d_type: &str, t_type: &str, l_mode: &str, fr: f64, rr: f64, ww: f64, trk: f64, wb: f64| -> Vec<CustomWheelSpec> {
            let mut ws = Vec::with_capacity(count);
            let half_z = trk * 0.5;
            let half_x = wb * 0.5;
            if count == 0 {
                return ws;
            }
            if count == 2 {
                for (idx, (side_id, z)) in [("left", -half_z), ("right", half_z)].into_iter().enumerate() {
                    ws.push(CustomWheelSpec {
                        id: format!("w_{}_{}", idx + 1, side_id),
                        x_m: 0.0,
                        z_m: z,
                        radius_m: fr,
                        width_m: ww,
                        yaw_deg: 0.0,
                        tire_type: t_type.to_string(),
                        driven: true,
                        steered: false,
                    });
                }
                return ws;
            }
            if count == 3 && t_type == "omni" {
                let rad = (half_z.hypot(half_x) * 0.82).max(0.06);
                for k in 0..3 {
                    let ang = (k as f64) * (2.0 * PI / 3.0);
                    let deg = ang.to_degrees() + 90.0;
                    ws.push(CustomWheelSpec {
                        id: format!("w_omni_{}", k + 1),
                        x_m: ang.cos() * rad,
                        z_m: ang.sin() * rad,
                        radius_m: fr,
                        width_m: ww,
                        yaw_deg: deg,
                        tire_type: "omni".to_string(),
                        driven: true,
                        steered: false,
                    });
                }
                return ws;
            }
            if count == 3 {
                ws.push(CustomWheelSpec {
                    id: "w_1_front_caster".into(),
                    x_m: half_x,
                    z_m: 0.0,
                    radius_m: (fr * 0.55).max(0.012),
                    width_m: (ww * 0.8).max(0.014),
                    yaw_deg: 0.0,
                    tire_type: "caster".into(),
                    driven: d_type != "rwd_caster",
                    steered: true,
                });
                ws.push(CustomWheelSpec {
                    id: "w_2_rear_l".into(),
                    x_m: -half_x * 0.85,
                    z_m: -half_z,
                    radius_m: rr,
                    width_m: ww,
                    yaw_deg: 0.0,
                    tire_type: t_type.to_string(),
                    driven: true,
                    steered: false,
                });
                ws.push(CustomWheelSpec {
                    id: "w_3_rear_r".into(),
                    x_m: -half_x * 0.85,
                    z_m: half_z,
                    radius_m: rr,
                    width_m: ww,
                    yaw_deg: 0.0,
                    tire_type: t_type.to_string(),
                    driven: true,
                    steered: false,
                });
                return ws;
            }
            let pairs = count / 2;
            let rem = count % 2;
            for p_idx in 0..pairs {
                let u = if pairs == 1 { 0.0 } else { 1.0 - 2.0 * (p_idx as f64) / ((pairs - 1) as f64) };
                let xm = u * half_x;
                let r = if u > 0.1 { fr } else { rr };
                let is_front = u > 0.1;
                let steered = matches!(l_mode, "ackermann_4ws") || (matches!(l_mode, "ackermann_front") && is_front);
                for (s_name, zm) in [("L", -half_z), ("R", half_z)] {
                    ws.push(CustomWheelSpec {
                        id: format!("w_{}_{}", p_idx + 1, s_name),
                        x_m: xm,
                        z_m: zm,
                        radius_m: r,
                        width_m: ww,
                        yaw_deg: 0.0,
                        tire_type: t_type.to_string(),
                        driven: !(d_type == "rwd_caster" && is_front),
                        steered,
                    });
                }
            }
            if rem == 1 {
                ws.push(CustomWheelSpec {
                    id: format!("w_{}_center", count),
                    x_m: half_x,
                    z_m: 0.0,
                    radius_m: (fr * 0.6).max(0.012),
                    width_m: ww,
                    yaw_deg: 0.0,
                    tire_type: "caster".into(),
                    driven: false,
                    steered: true,
                });
            }
            ws
        };

        let explicit_wheels: Option<Vec<CustomWheelSpec>> = wh
            .and_then(|n| n.params.get("custom_wheels"))
            .and_then(|v| serde_json::from_value::<Vec<CustomWheelSpec>>(v.clone()).ok());
        let requested_count = wh
            .and_then(|n| n.params.get("wheel_count"))
            .and_then(|v| v.as_u64())
            .map(|c| c as usize)
            .unwrap_or_else(|| if drive_type == "six_wd" { 6 } else if drive_type == "rwd_caster" { 3 } else { 4 });

        let custom_wheels = explicit_wheels.unwrap_or_else(|| {
            synthesize_wheels(
                requested_count,
                drive_type.as_str(),
                tire_type.as_str(),
                locomotion_mode.as_str(),
                front_wheel_radius,
                rear_wheel_radius,
                wheel_width,
                track,
                wheelbase,
            )
        });
        let wheel_count = custom_wheels.len();
        let driven_wheel_count = custom_wheels.iter().filter(|w| w.driven).count();

        let sc_list = by_kind(ModuleKind::FrontScoop);
        let sc = sc_list.first();
        let device_kind = if sc.is_none() { "none".to_string() } else { str_p(sc, "device_kind", "u_scoop") };
        let device_width = if device_kind == "none" { width } else { f64_p(sc, "device_width", 0.185).max(0.02) };
        let device_offset = if device_kind == "none" { 0.0 } else { f64_p(sc, "device_offset", 0.022).max(0.001) };
        let device_mount_x = f64_p(sc, "device_mount_x", 0.0);
        let device_mount_y = f64_p(sc, "device_mount_y", 0.002).max(0.0);
        let device_height = f64_p(sc, "device_height", 0.054).max(0.008);

        let wg_list = by_kind(ModuleKind::Wing);
        let wg = wg_list.first();
        let left_wing_depth = if device_kind == "none" { 0.0 } else { f64_p(wg, "left_wing_depth", 0.020).max(0.0) };
        let left_wing_splay = f64_p(wg, "left_wing_splay", 10.0).clamp(-80.0, 85.0);
        let right_wing_depth = if device_kind == "none" { 0.0 } else { f64_p(wg, "right_wing_depth", 0.020).max(0.0) };
        let right_wing_splay = f64_p(wg, "right_wing_splay", 10.0).clamp(-80.0, 85.0);

        let ls = left_wing_splay * PI / 180.0;
        let rs = right_wing_splay * PI / 180.0;
        let mouth_width = if device_kind == "none" {
            width
        } else {
            device_width + left_wing_depth * ls.sin() + right_wing_depth * rs.sin()
        };
        let wing_tip_fwd = (left_wing_depth * ls.cos()).max(right_wing_depth * rs.cos()).max(0.0);

        let cam_list = by_kind(ModuleKind::Camera);
        let cam = cam_list.first();
        let fov_deg = f64_p(cam, "fov_deg", 110.0).clamp(8.0, 176.0);
        let sensor_range_m = f64_p(cam, "sensor_range_m", 1.75).max(0.08);
        let camera_height = f64_p(cam, "camera_height", 0.185).max(0.015);
        let camera_pitch_deg = f64_p(cam, "camera_pitch_deg", 22.0).clamp(-85.0, 85.0);
        let camera_mount_x = f64_p(cam, "camera_mount_x", 0.0);
        let camera_mount_z = f64_p(cam, "camera_mount_z", 0.070);
        let camera_mount_yaw = f64_p(cam, "camera_mount_yaw", 0.0).clamp(-180.0, 180.0);

        let sen_list = by_kind(ModuleKind::LaserOpto);
        let sen = sen_list.first();
        let sensor_suite = str_p(sen, "sensor_suite", "laser3");
        let sensor_range_m = match sensor_suite.as_str() {
            "lidar360" => sensor_range_m.max(2.60),
            "stereo_cam" => sensor_range_m.max(2.20),
            "omni_ir" => sensor_range_m.max(2.05),
            _ => sensor_range_m,
        };
        let fov_deg = match sensor_suite.as_str() {
            "lidar360" => 360.0_f64.min(fov_deg.max(200.0)),
            "stereo_cam" => fov_deg.max(135.0),
            _ => fov_deg,
        };
        let laser_rays = f64_p(sen, "laser_rays", 3.0).max(0.0).round() as u32;
        let laser_power_mw = f64_p(sen, "laser_power_mw", 0.85).max(0.0);

        let ctrl_list = by_kind(ModuleKind::Controller);
        let ctrl = ctrl_list.first();
        let control_hz = f64_p(ctrl, "control_hz", 50.0).max(2.0);

        let bat_list = by_kind(ModuleKind::Battery);
        let voltage = f64_p(bat_list.first(), "voltage", 11.1).max(2.0);
        let capacity_ah: f64 = bat_list.iter().map(|b| b.params.get("capacity_ah").and_then(|v| v.as_f64()).unwrap_or(1.5)).sum();

        let mut total_mass = match rear_mod.as_str() {
            "counterweight" => 0.35,
            "storage_bin" => 0.14,
            "turbo_fan" => 0.12,
            "dual_scoop" => 0.09,
            _ => 0.0,
        };
        total_mass += match sensor_suite.as_str() {
            "lidar360" => 0.11,
            "stereo_cam" => 0.06,
            _ => 0.0,
        };
        let mut wx = 0.0;
        let mut wz = 0.0;
        let mut inertia_z = 0.0;
        let mut custom_part_count = 0usize;
        let mut custom_cad_colliders = Vec::new();
        let mut max_y = ground_clearance + height + 0.024;
        let mut min_x = -width * 0.5;
        let mut max_x = width * 0.5;
        let mut min_z = -length * 0.5;
        let mut max_z = (length * 0.5).max(length * 0.5 + device_offset + wing_tip_fwd);
        let mut max_wheel_dia = 0.0_f64;

        for w in &custom_wheels {
            let wm = (PI * w.radius_m * w.radius_m * w.width_m * 1180.0).max(0.015);
            total_mass += wm;
            wx += wm * w.z_m;
            wz += wm * w.x_m;
            inertia_z += wm * (w.x_m * w.x_m + w.z_m * w.z_m);
            let hw = w.width_m * 0.5;
            min_x = min_x.min(w.z_m - hw);
            max_x = max_x.max(w.z_m + hw);
            min_z = min_z.min(w.x_m - w.radius_m);
            max_z = max_z.max(w.x_m + w.radius_m);
            max_wheel_dia = max_wheel_dia.max(w.radius_m * 2.0);
        }

        for node in &self.nodes {
            if !node.enabled {
                continue;
            }
            if node.kind == ModuleKind::WheelAxle {
                // Tire masses are accounted per wheel in `custom_wheels`.
                continue;
            }
            if device_kind == "none" && matches!(node.kind, ModuleKind::FrontScoop | ModuleKind::Wing) {
                continue;
            }
            let m = node.mass_kg.max(0.001);
            total_mass += m;
            wx += m * node.local_pos[0];
            wz += m * node.local_pos[2];
            inertia_z += m * (node.local_pos[0].powi(2) + node.local_pos[2].powi(2));
            max_y = max_y.max(node.local_pos[1] + 0.020);
            if node.kind == ModuleKind::CustomCad {
                custom_part_count += 1;
                if let Some(sk) = &node.custom_sketch {
                    let mesh = sk.extrude();
                    min_x = min_x.min(node.local_pos[0] + mesh.bounds_min[0]);
                    max_x = max_x.max(node.local_pos[0] + mesh.bounds_max[0]);
                    min_z = min_z.min(node.local_pos[2] + mesh.bounds_min[2]);
                    max_z = max_z.max(node.local_pos[2] + mesh.bounds_max[2]);
                    max_y = max_y.max(node.local_pos[1] + mesh.bounds_max[1]);
                    custom_cad_colliders.push(CadColliderBox {
                        id: node.id.clone(),
                        center_x_m: node.local_pos[2] + (mesh.bounds_min[0] + mesh.bounds_max[0]) * 0.5,
                        center_z_m: node.local_pos[0] + (mesh.bounds_min[2] + mesh.bounds_max[2]) * 0.5,
                        half_x_m: ((mesh.bounds_max[0] - mesh.bounds_min[0]) * 0.5).max(0.004),
                        half_z_m: ((mesh.bounds_max[2] - mesh.bounds_min[2]) * 0.5).max(0.004),
                        min_y_m: node.local_pos[1] + mesh.bounds_min[1],
                        max_y_m: node.local_pos[1] + mesh.bounds_max[1],
                        yaw_deg: node.rotation_deg[1],
                    });
                }
            }
        }
        inertia_z += (f64_p(ch, "chassis_mass", 0.42) * (length * length + width * width)) / 12.0;

        let envelope_length = (max_z - min_z).max(length);
        let envelope_width = (max_x - min_x).max(width).max(mouth_width);
        let envelope_height = max_y.max(max_wheel_dia + 0.012).max(camera_height + 0.022);

        let cg_x = wx / total_mass.max(0.05);
        let cg_z = wz / total_mass.max(0.05);
        let rel_z = ((cg_z - wheel_offset_z) / wheelbase.max(0.04) + 0.5).clamp(0.05, 0.95);
        let front_axle_pct = (rel_z * 100.0).round() as i32;
        let rear_axle_pct = 100 - front_axle_pct;
        let rel_x = (cg_x / track.max(0.04) + 0.5).clamp(0.1, 0.9);
        let right_axle_pct = (rel_x * 100.0).round() as i32;
        let left_axle_pct = 100 - right_axle_pct;

        let tire_grip_mult = match tire_type.as_str() {
            "offroad" => 1.25,
            "rubber" => 1.18,
            "tracked" => 1.28,
            "omni" => 0.96,
            "caster" => 0.35,
            _ => 1.0,
        };
        let eff_grip = (grip * tire_grip_mult * traction_gain).max(0.05);

        let driven_radii: Vec<f64> = custom_wheels.iter().filter(|w| w.driven).map(|w| w.radius_m).collect();
        let avg_driven_r = if driven_radii.is_empty() {
            wheel_radius
        } else {
            driven_radii.iter().sum::<f64>() / (driven_radii.len() as f64)
        };
        let drive_factor = if driven_wheel_count == 0 {
            0.0
        } else {
            (0.65 + (driven_wheel_count as f64) * 0.09).clamp(0.70, 1.45)
        };

        let fan_boost = if rear_mod == "turbo_fan" { 1.18 } else { 1.0 };
        let mut max_speed = ((rpm * gear * 2.0 * PI * avg_driven_r) / 60.0)
            * 0.84
            * (voltage / 11.1).clamp(0.25, 4.5)
            * fan_boost
            * fwd_gain;
        if driven_wheel_count == 0 && rear_mod != "turbo_fan" {
            max_speed = 0.0;
        } else {
            max_speed = max_speed.max(0.05);
        }
        let wheel_force = if driven_wheel_count == 0 {
            if rear_mod == "turbo_fan" { 0.8 } else { 0.0 }
        } else {
            (torque * motor_count as f64 * gear) / avg_driven_r.max(0.008) * drive_factor
        };
        let max_accel = if driven_wheel_count == 0 && rear_mod != "turbo_fan" {
            0.0
        } else {
            ((wheel_force / total_mass.max(0.12)) * eff_grip * 0.42).max(0.18)
        };
        let inertia_scale = (0.013 / inertia_z.max(0.004)).clamp(0.35, 2.2);
        let max_omega = if driven_wheel_count == 0 && rear_mod != "turbo_fan" {
            0.0
        } else {
            ((max_speed / (track * 0.48).max(0.05)) * 0.62 * eff_grip * inertia_scale * omega_gain).max(0.60)
        };
        let push_force = if driven_wheel_count == 0 && rear_mod != "turbo_fan" {
            0.0
        } else {
            (wheel_force * 0.16 * eff_grip.min(1.5)).max(0.20)
        };

        let mut assembly_notes = Vec::new();
        if driven_wheel_count == 0 && rear_mod != "turbo_fan" {
            assembly_notes.push("当前无驱动轮：需至少配置 1 颗驱动轮或启用尾部涵道风扇".into());
        }
        if wheel_count >= 2 && wheelbase < front_wheel_radius + rear_wheel_radius + 0.003 {
            assembly_notes.push("前后轮干涉：轴距小于前后轮半径之和".into());
        }
        if device_kind != "none" && device_mount_y >= PIECE_HEIGHT_M {
            assembly_notes.push(format!("推斗离地 {}mm ≥ 17mm：棋子将从底部穿过", (device_mount_y * 1000.0).round()));
        }
        if custom_part_count > 0 {
            assembly_notes.push(format!("已挂载 {custom_part_count} 个自定义参数化 CAD 拼图件"));
        }

        let mut compliance_issues = Vec::new();
        if envelope_length > TRACK_LIMIT_LENGTH_M + 1e-6 {
            compliance_issues.push(format!("总长 {}mm > 300mm", (envelope_length * 1000.0).round()));
        }
        if envelope_width > TRACK_LIMIT_WIDTH_M + 1e-6 {
            compliance_issues.push(format!("总宽 {}mm > 300mm", (envelope_width * 1000.0).round()));
        }
        if envelope_height > TRACK_LIMIT_HEIGHT_M + 1e-6 {
            compliance_issues.push(format!("总高 {}mm > 300mm", (envelope_height * 1000.0).round()));
        }
        if total_mass > TRACK_LIMIT_MASS_KG + 1e-6 {
            compliance_issues.push(format!("总重 {:.2}kg > 2.50kg", total_mass));
        }
        if laser_power_mw > 1.0 + 1e-6 {
            compliance_issues.push(format!("激光功率 {:.2}mW > 1mW", laser_power_mw));
        }

        ResolvedBuild {
            length, width, height, ground_clearance, front_chamfer,
            rpm, torque, gear, motor_count,
            front_wheel_radius, rear_wheel_radius, front_track, rear_track, wheelbase, wheel_offset_z, grip: eff_grip,
            wheel_count, driven_wheel_count, wheel_width, tire_type, locomotion_mode,
            fwd_gain, strafe_gain, omega_gain, steer_max_deg, traction_gain, lateral_drag, custom_wheels,
            frame_style, drive_type, device_kind, rear_mod, sensor_suite,
            device_width, device_offset, device_mount_x, device_mount_y, device_height,
            left_wing_depth, left_wing_splay, right_wing_depth, right_wing_splay,
            fov_deg, sensor_range_m, camera_height, camera_pitch_deg, camera_mount_x, camera_mount_z, camera_mount_yaw,
            laser_rays, laser_power_mw, control_hz, voltage, capacity_ah,
            total_mass, envelope_length, envelope_width, envelope_height,
            envelope: [envelope_length, envelope_width, envelope_height],
            cg_x, cg_z, front_axle_pct, rear_axle_pct, left_axle_pct, right_axle_pct,
            inertia_z, max_speed, max_accel, max_omega, push_force, mouth_width,
            custom_part_count, custom_cad_colliders, assembly_notes, compliance_issues,
        }
    }

    pub fn node_lookup(&self) -> HashMap<&str, &PuzzleNode> {
        self.nodes.iter().map(|n| (n.id.as_str(), n)).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_puzzle_snap_and_custom_cad() {
        let mut graph = AssemblyGraph::default_competition_robot();
        let sketch = SketchProfile::u_scoop("custom_funnel", 0.24, 0.008, 0.06, 22.0, 0.03, 8.0, 0.045, 1410.0);
        let mesh = graph
            .add_custom_cad_part("cad_funnel_1".into(), sketch, "chassis_main", "front_bulkhead", [0.0, 0.0, 0.02])
            .unwrap();
        assert!(mesh.mass_kg > 0.0);
        let built = graph.resolve_kinematics();
        assert_eq!(built.custom_part_count, 1);
        assert!(built.total_mass > 1.4);
    }

    #[test]
    fn test_custom_wheels_and_from_scratch_locomotion() {
        // 1. 0-wheel bare chassis + no front collector
        let mut blank = AssemblyGraph::default_competition_robot();
        for n in &mut blank.nodes {
            if n.id == "wheel_mecanum" {
                n.params["custom_wheels"] = serde_json::json!([]);
                n.params["wheel_count"] = serde_json::json!(0);
                n.params["locomotion_mode"] = serde_json::json!("custom_vector");
            } else if n.id == "device_scoop" {
                n.params["device_kind"] = serde_json::json!("none");
            }
        }
        let built_blank = blank.resolve_kinematics();
        assert_eq!(built_blank.wheel_count, 0);
        assert_eq!(built_blank.driven_wheel_count, 0);
        assert_eq!(built_blank.max_speed, 0.0);
        assert_eq!(built_blank.push_force, 0.0);
        assert_eq!(built_blank.device_kind, "none");
        assert!(built_blank.assembly_notes.iter().any(|s| s.contains("当前无驱动轮")));

        // 2. 3-wheel Kiwi omni array
        let mut kiwi = AssemblyGraph::default_competition_robot();
        for n in &mut kiwi.nodes {
            if n.id == "wheel_mecanum" {
                n.params.as_object_mut().unwrap().remove("custom_wheels");
                n.params["wheel_count"] = serde_json::json!(3);
                n.params["tire_type"] = serde_json::json!("omni");
                n.params["drive_type"] = serde_json::json!("omni");
                n.params["locomotion_mode"] = serde_json::json!("holonomic_strafe");
                n.params["fwd_gain"] = serde_json::json!(1.25);
            }
        }
        let built_kiwi = kiwi.resolve_kinematics();
        assert_eq!(built_kiwi.wheel_count, 3);
        assert_eq!(built_kiwi.driven_wheel_count, 3);
        assert!(built_kiwi.max_speed > 1.1);

        // 3. 8-wheel custom locomotion
        let mut octo = AssemblyGraph::default_competition_robot();
        for n in &mut octo.nodes {
            if n.id == "wheel_mecanum" {
                n.params.as_object_mut().unwrap().remove("custom_wheels");
                n.params["wheel_count"] = serde_json::json!(8);
                n.params["tire_type"] = serde_json::json!("offroad");
                n.params["locomotion_mode"] = serde_json::json!("diff_skid");
                n.params["traction_gain"] = serde_json::json!(1.3);
            }
        }
        let built_octo = octo.resolve_kinematics();
        assert_eq!(built_octo.wheel_count, 8);
        assert_eq!(built_octo.driven_wheel_count, 8);
        assert!(built_octo.grip > 1.2);
        assert!(built_octo.total_mass > built_blank.total_mass);
    }
}
