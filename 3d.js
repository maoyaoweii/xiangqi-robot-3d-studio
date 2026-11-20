((root) => {
  "use strict";

  const STORAGE_BUILD_KEY = "xiangqi_sim_vehicle_build_v2";
  const STORAGE_EXPERIMENTS_KEY = "xiangqi_research_experiments_v1";
  const STORAGE_NOTES_KEY = "xiangqi_research_notes_v1";
  const FIELD = { width: 3.0, depth: 2.0, wallHeight: 0.30, wallThickness: 0.04 };
  const GOAL = { x: 0.20, z: 1.0, minX: 0.0, maxX: 0.40, minZ: 0.70, maxZ: 1.30 };
  const ENEMY_GOAL = { x: 2.80, z: 1.0, minX: 2.60, maxX: 3.00, minZ: 0.70, maxZ: 1.30 };
  const MATCH_DURATION = 120.0;
  const PIECE_RADIUS = 0.0335; // 67 mm 直径
  const PIECE_HEIGHT = 0.017;  // 17 mm 厚度
  const TRACK_LIMITS = { length: 0.300, width: 0.300, height: 0.300, mass: 2.50 };
  const PHYSICS_PRESETS = {
    standard: { id: "standard", label: "国赛标准 PVC 面", friction: 0.78, restitution: 0.42, pieceMassKg: 0.048 },
    slippery: { id: "slippery", label: "湿滑亚克力板", friction: 0.32, restitution: 0.48, pieceMassKg: 0.048 },
    bouncy: { id: "bouncy", label: "高弹性硬质碰撞", friction: 0.78, restitution: 0.82, pieceMassKg: 0.048 },
    heavy: { id: "heavy", label: "重棋满载极限测试", friction: 0.84, restitution: 0.35, pieceMassKg: 0.080 },
  };
  function defaultPhysicsConfig() {
    return { friction: 0.78, restitution: 0.42, pieceMassKg: 0.048 };
  }

  const PIECE_TYPES = [
    { kind: "帅", symbol: "帅", enemySymbol: "将", value: 10, count: 1 },
    { kind: "车", symbol: "车", enemySymbol: "车", value: 5, count: 2 },
    { kind: "马", symbol: "马", enemySymbol: "马", value: 3, count: 2 },
    { kind: "炮", symbol: "炮", enemySymbol: "炮", value: 3, count: 2 },
    { kind: "相", symbol: "相", enemySymbol: "象", value: 2, count: 2 },
    { kind: "仕", symbol: "仕", enemySymbol: "士", value: 2, count: 2 },
    { kind: "兵", symbol: "兵", enemySymbol: "卒", value: 1, count: 5 },
  ];

  // =========================
  // 1. 全车 8 大模块与材料工艺目录
  // =========================
  const CHASSIS_MATERIALS = {
    carbon_3k: { id: "carbon_3k", name: "3K 碳纤维板 (超轻高刚)", massFactor: 1.00, color: [0.13, 0.24, 0.28] },
    alu_6061: { id: "alu_6061", name: "6061 航空铝合金 CNC", massFactor: 1.28, color: [0.34, 0.44, 0.49] },
    fr4_glass: { id: "fr4_glass", name: "FR4 环氧玻纤板", massFactor: 1.14, color: [0.14, 0.36, 0.25] },
    resin_3d: { id: "resin_3d", name: "光敏树脂 3D 打印一体", massFactor: 0.94, color: [0.24, 0.30, 0.38] },
  };

  const DEVICE_MATERIALS = {
    pom_acetal: { id: "pom_acetal", name: "POM 赛钢板 (耐磨顺滑)", massFactor: 1.00, retentionBoost: 0.00, pushBoost: 1.00 },
    tpu_flex: { id: "tpu_flex", name: "柔性 TPU95A (减震防弹)", massFactor: 0.92, retentionBoost: 0.10, pushBoost: 0.98 },
    alu_silicone: { id: "alu_silicone", name: "铝合金折弯 + 硅胶内衬", massFactor: 1.18, retentionBoost: 0.08, pushBoost: 1.08 },
  };

  const PARTS_CATALOG = {
    chassis: {
      carbon_light: { id: "carbon_light", name: "极轻碳纤双层骨架 (235×215×88 mm)", frameStyle: "dual_deck", length: 0.235, width: 0.215, height: 0.088, chamfer: 0.016, clearance: 0.018, mass: 0.42 },
      alu_balanced: { id: "alu_balanced", name: "均衡铝合金镂空骨架 (245×235×95 mm)", frameStyle: "dual_deck", length: 0.245, width: 0.235, height: 0.095, chamfer: 0.014, clearance: 0.018, mass: 0.54 },
      omni_square: { id: "omni_square", name: "紧凑方阵桁架底盘 (248×248×94 mm)", frameStyle: "truss_frame", length: 0.248, width: 0.248, height: 0.094, chamfer: 0.022, clearance: 0.016, mass: 0.50 },
      heavy_tank: { id: "heavy_tank", name: "重载对抗加宽框体 (255×268×105 mm)", frameStyle: "monocoque", length: 0.255, width: 0.268, height: 0.105, chamfer: 0.010, clearance: 0.020, mass: 0.72 },
    },
    motor: {
      geared_360: { id: "geared_360", name: "360 RPM 高扭减速编码电机 ×2", kind: "geared", rpm: 360, torque: 0.32, gear: 1.15, count: 2, mountZ: -0.045, mass: 0.28, kindFactor: 0.92 },
      dc_520: { id: "dc_520", name: "520 RPM 直流编码电机 ×2", kind: "dc_encoder", rpm: 520, torque: 0.24, gear: 1.00, count: 2, mountZ: -0.040, mass: 0.24, kindFactor: 1.00 },
      brushless_680: { id: "brushless_680", name: "680 RPM 赛用无刷四驱 ×4", kind: "brushless", rpm: 680, torque: 0.28, gear: 1.05, count: 4, mountZ: 0.0, mass: 0.36, kindFactor: 1.08 },
      planetary_260: { id: "planetary_260", name: "260 RPM 行星高扭电机 ×2", kind: "geared", rpm: 260, torque: 0.42, gear: 1.10, count: 2, mountZ: -0.050, mass: 0.34, kindFactor: 0.90 },
    },
    wheel: {
      rubber_diff: { id: "rubber_diff", name: "高抓地硅胶差速轮 ×4 (独立前后轴)", driveMode: "diff", wheelKind: "standard", radius: 0.030, rearRadius: 0.030, width: 0.018, track: 0.185, rearTrack: 0.185, wheelbase: 0.160, offsetZ: 0, grip: 0.98, mass: 0.16 },
      mecanum_4wd: { id: "mecanum_4wd", name: "麦克纳姆全向轮 ×4 (支持横移)", driveMode: "mecanum", wheelKind: "mecanum", radius: 0.030, rearRadius: 0.030, width: 0.024, track: 0.210, rearTrack: 0.210, wheelbase: 0.175, offsetZ: 0, grip: 0.86, mass: 0.26 },
      omni_4wd: { id: "omni_4wd", name: "双排全向轮 ×4 (全向平移)", driveMode: "omni", wheelKind: "omni", radius: 0.029, rearRadius: 0.029, width: 0.022, track: 0.205, rearTrack: 0.205, wheelbase: 0.175, offsetZ: 0, grip: 0.84, mass: 0.22 },
      wide_diff: { id: "wide_diff", name: "宽胎高摩擦差速轮 ×4 (高抓地)", driveMode: "diff", wheelKind: "standard", radius: 0.033, rearRadius: 0.033, width: 0.025, track: 0.195, rearTrack: 0.195, wheelbase: 0.165, offsetZ: 0, grip: 1.06, mass: 0.21 },
      rwd_caster: { id: "rwd_caster", name: "后驱大轮差速 + 前万向随动轮", driveMode: "rwd_caster", wheelKind: "standard", radius: 0.018, rearRadius: 0.036, width: 0.022, track: 0.140, rearTrack: 0.205, wheelbase: 0.165, offsetZ: -0.01, grip: 1.02, mass: 0.17 },
    },
    device: {
      u_funnel: { id: "u_funnel", name: "U型铝合金主推斗背板", kind: "u_funnel", width: 0.165, offset: 0.024, mountX: 0, mountY: 0.002, height: 0.056, wingDepth: 0.036, splay: 8, dividers: 0, retention: 0.96, pushGain: 1.06, centering: 0.62, mass: 0.07, color: [0.96, 0.74, 0.26] },
      push_plate: { id: "push_plate", name: "宽幅柔性贴地平板", kind: "push_plate", width: 0.195, offset: 0.020, mountX: 0, mountY: 0.002, height: 0.054, wingDepth: 0.008, splay: 0, dividers: 0, retention: 0.45, pushGain: 1.00, centering: 0.18, mass: 0.06, color: [0.95, 0.69, 0.30] },
      active_roller: { id: "active_roller", name: "主动内旋聚拢滚轮斗 (独立电机驱动)", kind: "active_roller", width: 0.162, offset: 0.026, mountX: 0, mountY: 0.002, height: 0.058, wingDepth: 0.034, splay: 6, dividers: 0, retention: 0.94, pushGain: 1.15, centering: 0.92, mass: 0.13, color: [0.24, 0.82, 0.66] },
      multi_slot: { id: "multi_slot", name: "双槽分道连推主斗", kind: "multi_slot", width: 0.210, offset: 0.024, mountX: 0, mountY: 0.002, height: 0.056, wingDepth: 0.036, splay: 6, dividers: 1, retention: 0.92, pushGain: 1.04, centering: 0.45, mass: 0.10, color: [0.64, 0.49, 0.96] },
      brush: { id: "brush", name: "双排柔性防漏毛刷推架", kind: "brush", width: 0.185, offset: 0.022, mountX: 0, mountY: 0.002, height: 0.054, wingDepth: 0.020, splay: 10, dividers: 0, retention: 0.74, pushGain: 0.97, centering: 0.36, mass: 0.05, color: [0.38, 0.61, 0.94] },
    },
    wing: {
      dual_brush_wing: { id: "dual_brush_wing", name: "对称标准导向侧翼 (20mm · 10°)", leftDepth: 0.020, leftSplay: 10, rightDepth: 0.020, rightSplay: 10, dividers: 0, centering: 0.36, mass: 0.03 },
      sym_funnel_wing: { id: "sym_funnel_wing", name: "深槽大张角喇叭双翼 (38mm · 14°)", leftDepth: 0.038, leftSplay: 14, rightDepth: 0.038, rightSplay: 14, dividers: 0, centering: 0.68, mass: 0.05 },
      asym_right_sweep: { id: "asym_right_sweep", name: "非对称右掠扫墙长翼 (左15 / 右62mm)", leftDepth: 0.015, leftSplay: 4, rightDepth: 0.062, rightSplay: 26, dividers: 0, centering: 0.52, mass: 0.05 },
      dual_slot_fin: { id: "dual_slot_fin", name: "对称双翼 + 中置分道隔板", leftDepth: 0.036, leftSplay: 8, rightDepth: 0.036, rightSplay: 8, dividers: 1, centering: 0.48, mass: 0.05 },
      no_wings: { id: "no_wings", name: "无侧翼开放直推口 (0mm)", leftDepth: 0.0, leftSplay: 0, rightDepth: 0.0, rightSplay: 0, dividers: 0, centering: 0.15, mass: 0.01 },
    },
    camera: {
      cam_110_gs: { id: "cam_110_gs", name: "110° 全局快门单目相机 (云台可调)", fov: 110, range: 1.75, minRange: 0.04, mountX: 0, mountZ: 0.070, mountYaw: 0, camHeight: 0.185, camPitch: 22, mass: 0.09 },
      cam_95_hd: { id: "cam_95_hd", name: "95° 窄角低畸变视觉相机", fov: 95, range: 1.45, minRange: 0.05, mountX: 0, mountZ: 0.065, mountYaw: 0, camHeight: 0.155, camPitch: 24, mass: 0.08 },
      cam_135_wide: { id: "cam_135_wide", name: "135° 超广角全景双目相机", fov: 135, range: 2.15, minRange: 0.03, mountX: 0, mountZ: 0.075, mountYaw: 0, camHeight: 0.215, camPitch: 20, mass: 0.12 },
      cam_60_tele: { id: "cam_60_tele", name: "60° 远距长焦追瞄相机", fov: 60, range: 2.60, minRange: 0.08, mountX: 0, mountZ: 0.060, mountYaw: 0, camHeight: 0.240, camPitch: 16, mass: 0.11 },
    },
    sensor: {
      cam_laser_imu: { id: "cam_laser_imu", name: "3路前向安全激光 + 推斗对管 + IMU", fov: 110, range: 1.75, minRange: 0.05, mountX: 0, mountZ: 0.070, mountYaw: 0, camHeight: 0.185, camPitch: 22, noise: 0.004, pocketSensor: true, pocketRange: 0.030, laserRays: 3, laserMountX: 0.0, laserMountY: 0.116, laserMountZ: 0.095, laserPowerMw: 0.85, mass: 0.07 },
      cam_imu: { id: "cam_imu", name: "单路精密测距激光 + 对管 + IMU", fov: 95, range: 1.35, minRange: 0.06, mountX: 0, mountZ: 0.065, mountYaw: 0, camHeight: 0.155, camPitch: 24, noise: 0.007, pocketSensor: true, pocketRange: 0.025, laserRays: 1, laserMountX: 0.0, laserMountY: 0.114, laserMountZ: 0.090, laserPowerMw: 0.70, mass: 0.05 },
      dual_cam: { id: "dual_cam", name: "5路环向激光雷达阵列 + 对管 + IMU", fov: 125, range: 2.00, minRange: 0.04, mountX: 0, mountZ: 0.075, mountYaw: 0, camHeight: 0.210, camPitch: 20, noise: 0.003, pocketSensor: true, pocketRange: 0.038, laserRays: 5, laserMountX: 0.0, laserMountY: 0.122, laserMountZ: 0.095, laserPowerMw: 0.90, mass: 0.09 },
      opto_only: { id: "opto_only", name: "纯光电对管槽控 + 9轴IMU (无激光)", fov: 110, range: 1.75, minRange: 0.04, mountX: 0, mountZ: 0.070, mountYaw: 0, camHeight: 0.185, camPitch: 22, noise: 0.002, pocketSensor: true, pocketRange: 0.045, laserRays: 0, laserMountX: 0.0, laserMountY: 0.110, laserMountZ: 0.090, laserPowerMw: 0.10, mass: 0.03 },
    },
    controller: {
      k230_stm32: { id: "k230_stm32", name: "K230视觉 + STM32实时底盘板", controlHz: 50, mountX: -0.02, mountZ: -0.025, yaw: 0, mass: 0.08 },
      rdk_x5: { id: "rdk_x5", name: "地瓜派 RDK X5 视觉闭环主控", controlHz: 60, mountX: 0.0, mountZ: -0.020, yaw: 0, mass: 0.11 },
      jetson_orin: { id: "jetson_orin", name: "Jetson Orin Nano 高算力载板", controlHz: 80, mountX: 0.0, mountZ: -0.025, yaw: 90, mass: 0.16 },
    },
    battery: {
      "3s_1500": { id: "3s_1500", name: "3S 1500mAh 轻量锂电", voltage: 11.1, capacity: 1.5, mountX: 0.035, cgOffsetZ: -0.025, yaw: 0, mass: 0.13 },
      "3s_2200": { id: "3s_2200", name: "3S 2200mAh 均衡锂电", voltage: 11.1, capacity: 2.2, mountX: 0.035, cgOffsetZ: -0.025, yaw: 0, mass: 0.19 },
      "3s_2600": { id: "3s_2600", name: "3S 2600mAh 长续航锂电", voltage: 11.1, capacity: 2.6, mountX: 0.030, cgOffsetZ: -0.030, yaw: 0, mass: 0.25 },
      "4s_1800": { id: "4s_1800", name: "4S 1800mAh 高压赛用锂电", voltage: 14.8, capacity: 1.8, mountX: 0.0, cgOffsetZ: -0.035, yaw: 90, mass: 0.21 },
    },
    safety: {
      standard_safety: { id: "standard_safety", name: "蘑菇头急停 + 1A熔断套件", eStopType: "蘑菇头急停", fuse: "1 A 快熔", laserPowerMw: 0.85, eStopX: -0.06, eStopZ: -0.07, team: "甲队", mass: 0.06 },
      light_safety: { id: "light_safety", name: "轻量化拨动急停 + 贴片保险套件", eStopType: "拨动急停", fuse: "1 A 贴片", laserPowerMw: 0.80, eStopX: -0.055, eStopZ: -0.065, team: "甲队", mass: 0.04 },
    },
  };

  function defaultBuildSelection() {
    return {
      chassisId: "carbon_light",
      motorId: "geared_360",
      wheelId: "mecanum_4wd",
      deviceId: "brush",
      wingId: "dual_brush_wing",
      cameraId: "cam_110_gs",
      sensorId: "cam_laser_imu",
      controllerId: "k230_stm32",
      batteryId: "3s_1500",
      safetyId: "standard_safety",
      overrides: {},
    };
  }

  function defaultStrategyParams() {
    return {
      valueWeight: 2.4,
      distWeight: 3.1,
      goalDistWeight: 2.2,
      alignBonus: 1.8,
      approachDist: 0.22,
      cruiseThrottle: 0.96,
      pushThrottle: 0.90,
      steerKp: 2.5,
      goalReleaseX: 0.34,
      alignAngleTol: 0.20,
    };
  }

  function resolveBuild(selection) {
    const sel = selection || defaultBuildSelection();
    const ov = sel.overrides || {};
    const numFree = (v, fb, minFloor = -Infinity, maxCeil = Infinity) => (
      Number.isFinite(Number(v)) && v !== null && v !== "" ? clamp(Number(v), minFloor, maxCeil) : fb
    );

    const chassis = PARTS_CATALOG.chassis[sel.chassisId] || PARTS_CATALOG.chassis.carbon_light;
    const motor = PARTS_CATALOG.motor[sel.motorId] || PARTS_CATALOG.motor.geared_360;
    const wheel = PARTS_CATALOG.wheel[sel.wheelId] || PARTS_CATALOG.wheel.mecanum_4wd;
    const device = PARTS_CATALOG.device[sel.deviceId] || PARTS_CATALOG.device.brush;
    const wing = PARTS_CATALOG.wing[sel.wingId] || PARTS_CATALOG.wing.dual_brush_wing;
    const camera = PARTS_CATALOG.camera[sel.cameraId] || PARTS_CATALOG.camera.cam_110_gs;
    const sensor = PARTS_CATALOG.sensor[sel.sensorId] || PARTS_CATALOG.sensor.cam_laser_imu;
    const controller = PARTS_CATALOG.controller[sel.controllerId] || PARTS_CATALOG.controller.k230_stm32;
    const battery = PARTS_CATALOG.battery[sel.batteryId] || PARTS_CATALOG.battery["3s_1500"];
    const safety = PARTS_CATALOG.safety[sel.safetyId] || PARTS_CATALOG.safety.standard_safety;

    const chassisMaterialId = CHASSIS_MATERIALS[ov.chassisMaterial]?.id || "carbon_3k";
    const chassisMat = CHASSIS_MATERIALS[chassisMaterialId];
    const deviceMaterialId = DEVICE_MATERIALS[ov.deviceMaterial]?.id || "pom_acetal";
    const deviceMat = DEVICE_MATERIALS[deviceMaterialId];

    // 1. 底盘完全独立尺寸与结构样式 (仅保留防止除零/退化的物理最小下限，无竞赛尺寸上限)
    const frameStyle = typeof ov.frameStyle === "string" && ["dual_deck", "truss_frame", "monocoque"].includes(ov.frameStyle) ? ov.frameStyle : (chassis.frameStyle || "dual_deck");
    const length = numFree(ov.length, chassis.length, 0.04);
    const width = numFree(ov.width, chassis.width, 0.04);
    const height = numFree(ov.height, chassis.height, 0.012);
    const frontChamfer = numFree(ov.frontChamfer, chassis.chamfer, 0);
    const groundClearance = numFree(ov.groundClearance, chassis.clearance, 0.001);
    const chassisMass = numFree(ov.chassisMass, +(chassis.mass * chassisMat.massFactor).toFixed(3), 0.01);

    // 2. 驱动电机独立配置 (1~8个，任意转速/扭矩/齿轮比/前后安装轴位)
    const rpm = numFree(ov.rpm, motor.rpm, 10);
    const torque = numFree(ov.torque, motor.torque, 0.005);
    const gear = numFree(ov.gear, motor.gear, 0.05);
    const motorCount = Math.round(numFree(ov.motorCount, motor.count, 1));
    const motorMountZ = numFree(ov.motorMountZ, motor.mountZ ?? -0.04, -1.0, 1.0);
    const motorMass = numFree(ov.motorMass, motor.mass, 0.01);

    // 3. 轮组与前/后轴完全独立配置 (允许异宽前后轮距、大小轮前倾、单双驱)
    const driveMode = typeof ov.driveMode === "string" && ["diff", "mecanum", "omni", "rwd_caster"].includes(ov.driveMode) ? ov.driveMode : wheel.driveMode;
    const legacyRad = Number.isFinite(ov.wheelRadius) ? Math.max(0.006, ov.wheelRadius) : null;
    const frontWheelRadius = numFree(ov.frontWheelRadius, legacyRad ?? wheel.radius, 0.006);
    const rearWheelRadius = numFree(ov.rearWheelRadius, legacyRad ?? (wheel.rearRadius ?? wheel.radius), 0.006);
    const wheelRadius = +((frontWheelRadius + rearWheelRadius) * 0.5).toFixed(4);
    const wheelWidth = numFree(ov.wheelWidth, wheel.width, 0.004);
    const legacyTrack = Number.isFinite(ov.track) ? Math.max(0.02, ov.track) : null;
    const frontTrack = numFree(ov.frontTrack, legacyTrack ?? wheel.track, 0.02);
    const rearTrack = numFree(ov.rearTrack, legacyTrack ?? (wheel.rearTrack ?? wheel.track), 0.02);
    const track = Math.max(frontTrack, rearTrack);
    const wheelbase = numFree(ov.wheelbase, wheel.wheelbase, 0.02);
    const wheelOffsetZ = numFree(ov.wheelOffsetZ, wheel.offsetZ, -1.0, 1.0);
    const grip = numFree(ov.grip, wheel.grip, 0.05);
    const wheelMass = numFree(ov.wheelMass, wheel.mass, 0.01);

    // 4. 前端主推斗机构独立装配坐标 (支持上下悬空高度 deviceMountY、左右偏置、板高)
    const deviceKind = typeof ov.deviceKind === "string" && ["u_funnel", "push_plate", "active_roller", "multi_slot", "brush"].includes(ov.deviceKind) ? ov.deviceKind : device.kind;
    const deviceWidth = numFree(ov.deviceWidth, device.width, 0.02);
    const deviceOffset = numFree(ov.deviceOffset, device.offset, 0.001);
    const deviceMountX = numFree(ov.deviceMountX, device.mountX ?? 0, -0.5, 0.5);
    const deviceMountY = numFree(ov.deviceMountY, device.mountY ?? 0.002, 0);
    const deviceHeight = numFree(ov.deviceHeight, device.height ?? 0.056, 0.008);
    const retention = clamp(numFree(ov.retention, device.retention, 0) + deviceMat.retentionBoost, 0.0, 1.2);
    const deviceMass = numFree(ov.deviceMass, +(device.mass * deviceMat.massFactor).toFixed(3), 0.01);

    // 5. 左右侧翼与导流完全独立配置 (左右非对称深度 & 张角 + 分槽)
    const hasCustomWing = Boolean(sel.wingId);
    const fbLeftD = Number.isFinite(ov.wingDepth) ? ov.wingDepth : (hasCustomWing ? wing.leftDepth : device.wingDepth);
    const fbRightD = Number.isFinite(ov.wingDepth) ? ov.wingDepth : (hasCustomWing ? wing.rightDepth : device.wingDepth);
    const fbLeftS = Number.isFinite(ov.wingSplayAngle) ? ov.wingSplayAngle : (hasCustomWing ? wing.leftSplay : device.splay);
    const fbRightS = Number.isFinite(ov.wingSplayAngle) ? ov.wingSplayAngle : (hasCustomWing ? wing.rightSplay : device.splay);
    const leftWingDepth = numFree(ov.leftWingDepth, fbLeftD, 0);
    const rightWingDepth = numFree(ov.rightWingDepth, fbRightD, 0);
    const leftWingSplay = numFree(ov.leftWingSplay, fbLeftS, -80, 85);
    const rightWingSplay = numFree(ov.rightWingSplay, fbRightS, -80, 85);
    const wingDepth = +((leftWingDepth + rightWingDepth) * 0.5).toFixed(4);
    const wingSplayAngle = +((leftWingSplay + rightWingSplay) * 0.5).toFixed(2);
    const dividerCount = Math.round(numFree(ov.dividerCount, hasCustomWing ? wing.dividers : device.dividers, 0));
    const centering = numFree(ov.centering, hasCustomWing ? wing.centering : device.centering, 0);
    const wingMass = numFree(ov.wingMass, wing.mass, 0);

    const leftSplayRad = (leftWingSplay * Math.PI) / 180;
    const rightSplayRad = (rightWingSplay * Math.PI) / 180;
    const leftTipForward = +(leftWingDepth * Math.cos(leftSplayRad)).toFixed(4);
    const rightTipForward = +(rightWingDepth * Math.cos(rightSplayRad)).toFixed(4);
    const wingTipForward = Math.max(leftTipForward, rightTipForward);
    const mouthWidth = +(deviceWidth + leftWingDepth * Math.sin(leftSplayRad) + rightWingDepth * Math.sin(rightSplayRad)).toFixed(4);

    // 6. 车载视觉相机独立光学与三维云台坐标 (不受限俯仰 -80~+80° / 任意偏航 / 任意高度)
    const fov = numFree(ov.fov, camera.fov ?? sensor.fov, 8, 176);
    const sensorRange = numFree(ov.sensorRange, camera.range ?? sensor.range, 0.08);
    const cameraMinRange = numFree(ov.cameraMinRange, camera.minRange ?? sensor.minRange, 0.005);
    const cameraMountX = numFree(ov.cameraMountX, camera.mountX ?? sensor.mountX, -1.0, 1.0);
    const cameraMountZ = numFree(ov.cameraMountZ, camera.mountZ ?? sensor.mountZ, -1.0, 1.0);
    const cameraMountYaw = numFree(ov.cameraMountYaw, camera.mountYaw ?? sensor.mountYaw, -180, 180);
    const cameraHeight = numFree(ov.cameraHeight, camera.camHeight ?? sensor.camHeight, 0.015);
    const cameraPitch = numFree(ov.cameraPitch, camera.camPitch ?? sensor.camPitch, -85, 85);
    const cameraMass = numFree(ov.cameraMass, camera.mass ?? 0.09, 0.005);

    // 7. 激光测距与光电对管独立装配与传感器位置
    const laserRays = Math.round(numFree(ov.laserRays, sensor.laserRays, 0));
    const defaultLaserY = groundClearance + height + 0.018;
    const laserMountX = numFree(ov.laserMountX, sensor.laserMountX ?? 0, -1.0, 1.0);
    const laserMountY = numFree(ov.laserMountY, sensor.laserMountY ?? defaultLaserY, 0.01);
    const laserMountZ = numFree(ov.laserMountZ, Math.min(length * 0.45, sensor.laserMountZ ?? length * 0.42), -1.0, 1.0);
    const laserPowerMw = numFree(ov.laserPowerMw, sensor.laserPowerMw ?? safety.laserPowerMw, 0);
    const hasPocketSensor = typeof ov.hasPocketSensor === "boolean" ? ov.hasPocketSensor : sensor.pocketSensor;
    const pocketSensorRange = numFree(ov.pocketSensorRange, sensor.pocketRange ?? 0.030, 0.002);
    const sensorNoise = numFree(ov.sensorNoise, sensor.noise, 0);
    const lidarMass = numFree(ov.lidarMass, sensor.mass ?? 0.07, 0.002);
    const sensorMass = +(cameraMass + lidarMass).toFixed(3);

    // 8. 车载主控芯片与散热架独立装配坐标
    const controlHz = numFree(ov.controlHz, controller.controlHz, 2);
    const ctrlMountX = numFree(ov.ctrlMountX, controller.mountX ?? -0.02, -1.0, 1.0);
    const ctrlMountY = numFree(ov.ctrlMountY, groundClearance + height + 0.012, 0.005);
    const ctrlMountZ = numFree(ov.ctrlMountZ, controller.mountZ ?? -0.025, -1.0, 1.0);
    const ctrlYaw = numFree(ov.ctrlYaw, controller.yaw ?? 0, -180, 180);
    const controllerMass = numFree(ov.controllerMass, controller.mass, 0.005);

    // 9. 动力电池独立位置 (XYZ + Yaw) -> 实时改变纵向/横向配重与转动惯量
    const voltage = numFree(ov.voltage, battery.voltage, 2.0);
    const capacity = numFree(ov.capacity, battery.capacity, 0.05);
    const battMountX = numFree(ov.battMountX, battery.mountX ?? 0.035, -1.0, 1.0);
    const battMountY = numFree(ov.battMountY, groundClearance + height + 0.014, 0.005);
    const cgOffsetZ = numFree(ov.cgOffsetZ, battery.cgOffsetZ, -1.0, 1.0);
    const battYaw = numFree(ov.battYaw, battery.yaw ?? 0, -180, 180);
    const batteryMass = numFree(ov.batteryMass, battery.mass, 0.005);

    // 10. 急停与安全组件独立装配坐标
    const eStopMountX = numFree(ov.eStopMountX, safety.eStopX ?? -width * 0.28, -1.0, 1.0);
    const eStopMountZ = numFree(ov.eStopMountZ, safety.eStopZ ?? -length * 0.32, -1.0, 1.0);
    const teamName = typeof ov.teamName === "string" && ov.teamName.trim() ? ov.teamName.trim() : safety.team;
    const eStopType = typeof ov.eStopType === "string" ? ov.eStopType : safety.eStopType;
    const safetyMass = numFree(ov.safetyMass, safety.mass, 0.002);

    const totalMass = +(chassisMass + motorMass + wheelMass + deviceMass + wingMass + cameraMass + lidarMass + controllerMass + batteryMass + safetyMass).toFixed(3);
    const leftMost = Math.min(-width / 2, -track / 2 - wheelWidth / 2, deviceMountX - deviceWidth / 2 - Math.max(0, leftWingDepth * Math.sin(leftSplayRad)));
    const rightMost = Math.max(width / 2, track / 2 + wheelWidth / 2, deviceMountX + deviceWidth / 2 + Math.max(0, rightWingDepth * Math.sin(rightSplayRad)));
    const frontMost = Math.max(length / 2, wheelOffsetZ + wheelbase / 2 + frontWheelRadius, length / 2 + deviceOffset + Math.max(0, wingTipForward));
    const backMost = Math.min(-length / 2, wheelOffsetZ - wheelbase / 2 - rearWheelRadius);
    const envelopeLength = +(frontMost - backMost).toFixed(4);
    const envelopeWidth = +(rightMost - leftMost).toFixed(4);
    const envelopeHeight = +Math.max(groundClearance + height + 0.024, frontWheelRadius * 2 + 0.012, rearWheelRadius * 2 + 0.012, cameraHeight + 0.022, laserMountY + 0.015).toFixed(4);

    // 真实三维质心 (CG_X, CG_Z)、前后轴荷、左右轮载比、转动惯量 I_zz
    const frontDeviceZ = length * 0.5 + deviceOffset;
    const weightedX = batteryMass * battMountX + controllerMass * ctrlMountX + cameraMass * cameraMountX + lidarMass * laserMountX + (deviceMass + wingMass) * deviceMountX + safetyMass * eStopMountX;
    const weightedZ = batteryMass * cgOffsetZ + controllerMass * ctrlMountZ + cameraMass * cameraMountZ + lidarMass * laserMountZ + motorMass * motorMountZ + (deviceMass + wingMass) * frontDeviceZ + safetyMass * eStopMountZ;
    const cgX = +(weightedX / Math.max(0.05, totalMass)).toFixed(4);
    const cgZ = +(weightedZ / Math.max(0.05, totalMass)).toFixed(4);

    const relCgZ = clamp((cgZ - wheelOffsetZ) / Math.max(0.04, wheelbase) + 0.5, 0.05, 0.95);
    const frontAxlePct = Math.round(relCgZ * 100);
    const rearAxlePct = 100 - frontAxlePct;
    const relCgX = clamp(cgX / Math.max(0.04, track) + 0.5, 0.1, 0.9);
    const rightAxlePct = Math.round(relCgX * 100);
    const leftAxlePct = 100 - rightAxlePct;

    const inertiaZ = +(
      (chassisMass * (length * length + width * width)) / 12 +
      batteryMass * (battMountX * battMountX + cgOffsetZ * cgOffsetZ) +
      controllerMass * (ctrlMountX * ctrlMountX + ctrlMountZ * ctrlMountZ) +
      cameraMass * (cameraMountX * cameraMountX + cameraMountZ * cameraMountZ) +
      (deviceMass + wingMass) * (deviceMountX * deviceMountX + frontDeviceZ * frontDeviceZ) +
      motorMass * ((track * 0.35) ** 2 + motorMountZ * motorMountZ) +
      wheelMass * ((track * 0.5) ** 2 + (wheelbase * 0.5) ** 2)
    ).toFixed(5);

    // 真实无上限的机电运动学推导
    const rawWheelSpeed = ((rpm * gear * 2 * Math.PI * wheelRadius) / 60) * 0.84 * (motor.kindFactor || 1) * clamp(voltage / 11.1, 0.25, 4.5);
    const maxSpeed = +Math.max(0.05, rawWheelSpeed).toFixed(3);
    const wheelForce = (torque * motorCount * gear) / Math.max(0.008, wheelRadius);
    const maxAccel = +Math.max(0.18, (wheelForce / Math.max(0.12, totalMass)) * grip * 0.42).toFixed(3);
    const inertiaScale = clamp(0.013 / Math.max(0.004, inertiaZ), 0.35, 2.2);
    const maxOmega = +Math.max(0.60, (maxSpeed / Math.max(0.05, track * 0.48)) * 0.62 * grip * inertiaScale).toFixed(3);
    const pushForce = +Math.max(0.20, wheelForce * 0.16 * device.pushGain * deviceMat.pushBoost).toFixed(2);

    // 真实物理装配状态诊断 (只作提示，不锁定)
    const assemblyNotes = [];
    if (wheelbase < frontWheelRadius + rearWheelRadius + 0.003) assemblyNotes.push("前后轮干涉：轴距小于前后轮半径之和");
    if (deviceMountY >= PIECE_HEIGHT) assemblyNotes.push(`推斗离地 ${Math.round(deviceMountY * 1000)}mm ≥ 17mm：棋子会从推斗底部滑过`);
    if (deviceMountY <= 0.0005) assemblyNotes.push("推斗完全贴地(0mm)：产生额外地面刮擦阻力");
    if (Math.abs(cameraMountX) > width * 0.5 || Math.abs(cameraMountZ) > length * 0.5) assemblyNotes.push("相机已延伸至底盘外缘：自动装配悬臂连接杆");

    return {
      selection: sel,
      chassis, motor, wheel, device, wing, camera, sensor, controller, battery, safety,
      frameStyle, chassisMaterial: chassisMaterialId, chassisColor: chassisMat.color,
      deviceMaterial: deviceMaterialId,
      length, width, height, frontChamfer, groundClearance, chassisMass,
      rpm, torque, gear, motorCount, motorMountZ, motorMass,
      driveMode, wheelKind: wheel.wheelKind, wheelRadius, frontWheelRadius, rearWheelRadius, wheelWidth,
      track, frontTrack, rearTrack, wheelbase, wheelOffsetZ, grip, wheelMass,
      deviceKind, deviceName: device.name, deviceColor: device.color,
      deviceWidth, deviceOffset, deviceMountX, deviceMountY, deviceHeight,
      leftWingDepth, leftWingSplay, rightWingDepth, rightWingSplay, leftTipForward, rightTipForward,
      wingDepth, wingSplayAngle, mouthWidth, wingTipForward, dividerCount, retention,
      pushGain: device.pushGain * deviceMat.pushBoost, centering, deviceMass, wingMass,
      fov, sensorRange, cameraMinRange, cameraMountX, cameraMountZ, cameraMountYaw, cameraHeight, cameraPitch, cameraMass,
      sensorNoise, hasPocketSensor, pocketSensorRange, laserRays, laserMountX, laserMountY, laserMountZ, lidarMass, sensorMass,
      controlHz, ctrlMountX, ctrlMountY, ctrlMountZ, ctrlYaw, controllerMass,
      voltage, capacity, battMountX, battMountY, cgOffsetZ, battYaw, batteryMass,
      laserPowerMw, teamName, eStopType, eStopMountX, eStopMountZ, safetyMass,
      cgX, cgZ, frontAxlePct, rearAxlePct, leftAxlePct, rightAxlePct, inertiaZ, assemblyNotes,
      totalMass, envelopeLength, envelopeWidth, envelopeHeight,
      maxSpeed, maxAccel, maxOmega, pushForce,
    };
  }

  function checkCompliance(build, unrestricted = false) {
    const issues = [];
    if (build.envelopeLength > TRACK_LIMITS.length + 1e-6) issues.push(`总长 ${Math.round(build.envelopeLength * 1000)}mm > 300mm`);
    if (build.envelopeWidth > TRACK_LIMITS.width + 1e-6) issues.push(`总宽 ${Math.round(build.envelopeWidth * 1000)}mm > 300mm`);
    if (build.envelopeHeight > TRACK_LIMITS.height + 1e-6) issues.push(`总高 ${Math.round(build.envelopeHeight * 1000)}mm > 300mm`);
    if (build.totalMass > TRACK_LIMITS.mass + 1e-6) issues.push(`总重 ${build.totalMass.toFixed(2)}kg > 2.50kg`);
    if (build.laserPowerMw > 1.0 + 1e-6) issues.push(`激光功率 ${build.laserPowerMw.toFixed(2)}mW > 1mW 安全上限`);
    return {
      ok: issues.length === 0,
      unrestricted: Boolean(unrestricted),
      issues,
      assemblyNotes: build.assemblyNotes || [],
    };
  }

  // =========================
  // 2. 纯车载光电感知策略代码模板 (严禁获取全局地图)
  // =========================
  const STRATEGY_TEMPLATES = {
    optimal_funnel: `// 🏆 推荐模板：纯车载视觉感知 + 主动视锥巡航扫描 + 聚拢推子状态机
// ⚠️ 注意：本沙盒严禁通过地图作弊！ctx.myPieces 仅包含车载相机/光电对管发现并记忆的棋子。
function decide(ctx) {
  const { robot, myPieces, perceivedPieces, goal, params, memory, sensors } = ctx;
  const inGoalBox = (x, z) => x < 0.48 && z > 0.60 && z < 1.40;

  if (!myPieces.length) {
    if (robot.x < 0.60 && robot.z > 0.54 && robot.z < 1.46) {
      if (Math.sin(robot.yaw) < -0.20) return { throttle: -0.92, steer: 0, strafe: 0, phase: "EXIT_GOAL" };
      const exitCmd = ctx.driveTo(0.66, robot.z < 1.0 ? 0.56 : 1.44, { maxThrottle: 0.85, kp: 2.0 });
      return { ...exitCmd, phase: "EXIT_GOAL" };
    }
    if (ctx.scoredPieces.length < 16) return ctx.scanForPieces();
    return { throttle: 0, steer: 0, strafe: 0, phase: "ALL_SCORED" };
  }

  const slots = [];
  for (const sx of [0.095, 0.185, 0.275, 0.345]) {
    for (const sz of [0.77, 0.885, 1.00, 1.115, 1.23]) slots.push({ x: sx, z: sz });
  }
  const knownScored = perceivedPieces.filter((p) => p.scored);
  function pickBestSlot(piece) {
    let best = slots[0], bestCost = Infinity;
    for (const s of slots) {
      if (knownScored.some((sp) => Math.hypot(sp.x - s.x, sp.z - s.z) < 0.068)) continue;
      const cost = s.x * 2.8 + Math.abs(s.z - piece.z) * 0.85;
      if (cost < bestCost) { bestCost = cost; best = s; }
    }
    return best;
  }

  if (!memory.phase) memory.phase = "APPROACH";
  if (memory.lastCheckTime == null) {
    memory.lastCheckTime = ctx.time;
    memory.lastCheckX = robot.x;
    memory.lastCheckZ = robot.z;
    memory.unstuckUntil = 0;
  }
  if (ctx.time < memory.unstuckUntil) {
    return { throttle: -0.80, steer: memory.unstuckSteer || 0.75, strafe: 0, phase: "UNSTUCK", targetId: memory.targetId };
  }
  if (ctx.time - memory.lastCheckTime > 0.75) {
    const moved = Math.hypot(robot.x - memory.lastCheckX, robot.z - memory.lastCheckZ);
    if (moved < 0.022 && memory.phase !== "RETREAT") {
      memory.unstuckUntil = ctx.time + 0.42;
      memory.unstuckSteer = (Math.sin(ctx.time * 13) >= 0 ? 1 : -1) * 0.85;
      memory.phase = "APPROACH";
    }
    memory.lastCheckTime = ctx.time;
    memory.lastCheckX = robot.x;
    memory.lastCheckZ = robot.z;
  }

  if (memory.phase === "RETREAT") {
    if (robot.x < 0.58 && robot.z > 0.54 && robot.z < 1.46) {
      if (Math.sin(robot.yaw) < -0.20) return { throttle: -0.92, steer: 0, strafe: 0, phase: "RETREAT" };
      const out = ctx.driveTo(0.66, robot.z < 1.0 ? 0.56 : 1.44, { maxThrottle: 0.85, kp: 2.0 });
      return { ...out, phase: "RETREAT" };
    }
    memory.phase = "APPROACH";
    memory.targetId = null;
  }

  let target = myPieces.find((p) => p.id === memory.targetId);
  if (!target || memory.phase === "APPROACH") {
    let bestScore = -Infinity;
    for (const p of myPieces) {
      const dRobot = ctx.dist(robot, p);
      const dGoal = Math.hypot(p.x - goal.x, p.z - goal.z);
      const gx = goal.x - p.x, gz = goal.z - p.z, gLen = Math.hypot(gx, gz) || 1;
      const rx = p.x - robot.x, rz = p.z - robot.z, rLen = Math.hypot(rx, rz) || 1;
      const alignDot = (gx * rx + gz * rz) / (gLen * rLen);
      const nearGoalBonus = (p.x > 0.42 && p.x < 0.85) ? 4.2 : (p.x <= 0.42 ? -12.0 : 0);
      const inViewBonus = p.inView ? 0.8 : 0;
      const wallPenalty = (p.x > 2.74 ? 12.0 : 0) + (p.z < 0.14 || p.z > 1.86 ? 4.5 : 0);
      const util = p.value * params.valueWeight - dRobot * params.distWeight - dGoal * params.goalDistWeight + alignDot * params.alignBonus + nearGoalBonus + inViewBonus - wallPenalty;
      if (util > bestScore) { bestScore = util; target = p; }
    }
    if (target) memory.targetId = target.id;
  }
  if (!target) return ctx.scanForPieces();

  if (inGoalBox(robot.x, robot.z) && memory.phase !== "PUSH" && target.x > 0.48) {
    if (Math.sin(robot.yaw) < -0.20) return { throttle: -0.92, steer: 0, strafe: 0, phase: "EXIT_GOAL" };
    const exitCmd = ctx.driveTo(0.64, robot.z < 1.0 ? 0.56 : 1.44, { maxThrottle: 0.85, kp: 2.0 });
    return { ...exitCmd, phase: "EXIT_GOAL" };
  }

  const slot = pickBestSlot(target);
  const dxG = slot.x - target.x, dzG = slot.z - target.z, distToSlot = Math.hypot(dxG, dzG) || 1;
  const dirX = dxG / distToSlot, dirZ = dzG / distToSlot;

  const standOff = params.approachDist;
  let apZ = target.z - dirZ * standOff;
  if (target.z < 0.16) apZ = target.z + 0.14;
  if (target.z > 1.84) apZ = target.z - 0.14;
  const approachPt = { x: ctx.clamp(target.x - dirX * standOff, 0.22, ctx.field.width - 0.16), z: ctx.clamp(apZ, 0.18, ctx.field.depth - 0.18) };

  const cYaw = Math.cos(robot.yaw), sYaw = Math.sin(robot.yaw);
  const relX = target.x - robot.x, relZ = target.z - robot.z;
  const localForward = relX * sYaw + relZ * cYaw;
  const localLateral = relX * cYaw - relZ * sYaw;
  const inPocket = (sensors.pocket.inPocket && sensors.pocket.piece?.id === target.id) || (localForward > 0.05 && localForward < 0.26 && Math.abs(localLateral) < robot.deviceWidth * 0.64);

  const distToApproach = ctx.dist(robot, approachPt);
  if (memory.phase === "APPROACH") {
    if (inPocket && Math.abs(ctx.angleDiff(ctx.angleTo(target, slot), robot.yaw)) < 0.48) memory.phase = "PUSH";
    else if (distToApproach < 0.095) memory.phase = "ALIGN";
  } else if (memory.phase === "ALIGN") {
    const aimYaw = ctx.angleTo(robot, target);
    if (Math.abs(ctx.angleDiff(aimYaw, robot.yaw)) < params.alignAngleTol || inPocket) memory.phase = "PUSH";
    else if (distToApproach > 0.20) memory.phase = "APPROACH";
  } else if (memory.phase === "PUSH") {
    if (target.scored && (target.x <= Math.min(params.goalReleaseX, slot.x + 0.07) || target.x <= 0.30)) {
      memory.phase = "RETREAT";
      return { throttle: -0.92, steer: 0, strafe: 0, targetId: target.id, phase: "RETREAT" };
    }
    if (!inPocket && (ctx.dist(robot, target) > 0.34 || localForward < 0.01)) memory.phase = "APPROACH";
  }

  if (memory.phase === "APPROACH") {
    let wp = approachPt;
    if (robot.x < 0.54 && approachPt.x < 0.56 && ((robot.z < 0.66 && approachPt.z > 0.66) || (robot.z > 1.34 && approachPt.z < 1.34))) {
      wp = { x: 0.64, z: robot.z };
    } else if (robot.x < approachPt.x - 0.08) {
      const laneZ = robot.z >= 1.0 ? 1.62 : 0.38;
      if (robot.x < 1.12 && approachPt.x > 1.05 && Math.abs(robot.z - laneZ) > 0.22) wp = { x: Math.min(1.18, approachPt.x), z: laneZ };
      else if (Math.abs(robot.z - target.z) < 0.32 || (robot.x > 0.95 && Math.abs(robot.z - 1.0) < 0.44)) {
        const bypassZ = target.z >= 1.0 ? ctx.clamp(Math.max(1.56, target.z + 0.34), 0.22, 1.78) : ctx.clamp(Math.min(0.44, target.z - 0.34), 0.22, 1.78);
        wp = { x: ctx.clamp(approachPt.x + 0.06, 0.22, 2.82), z: bypassZ };
      }
    }
    const cmd = ctx.driveTo(wp.x, wp.z, { maxThrottle: params.cruiseThrottle, kp: params.steerKp, useStrafe: true });
    return { ...cmd, targetId: target.id, phase: "APPROACH", waypoints: [wp, approachPt, target, slot] };
  }

  if (memory.phase === "ALIGN") {
    const desiredYaw = ctx.angleTo(robot, target);
    const err = ctx.angleDiff(desiredYaw, robot.yaw);
    return { throttle: Math.abs(err) < 0.32 ? 0.24 : 0.03, steer: ctx.clamp(err * (params.steerKp + 0.7), -1, 1), strafe: 0, targetId: target.id, phase: "ALIGN", waypoints: [target, slot] };
  }

  const aimX = target.x + dirX * 0.22, aimZ = target.z + dirZ * 0.22;
  const blendX = inPocket ? (aimX * 0.55 + slot.x * 0.45) : target.x;
  const blendZ = inPocket ? (aimZ * 0.55 + slot.z * 0.45) : target.z;
  const pushYaw = ctx.angleTo(robot, { x: blendX, z: blendZ });
  const pushErr = ctx.angleDiff(pushYaw, robot.yaw);
  const lateralFix = robot.isMecanum ? ctx.clamp(localLateral * 3.5, -0.5, 0.5) : 0;
  return { throttle: params.pushThrottle * (Math.abs(pushErr) > 0.6 ? 0.55 : 1.0), steer: ctx.clamp(pushErr * params.steerKp, -1, 1), strafe: lateralFix, targetId: target.id, phase: "PUSH", waypoints: [target, slot] };
}`,

    versus_blitz: `// ⚔️ 模板二：双车同场对抗抢中突击 + 激光/视觉避让敌车策略
function decide(ctx) {
  const { robot, myPieces, perceivedPieces, goal, params, memory, sensors, enemyRobot } = ctx;
  const inGoalBox = (x, z) => x < 0.48 && z > 0.60 && z < 1.40;
  if (!myPieces.length) {
    if (robot.x < 0.60 && robot.z > 0.54 && robot.z < 1.46) {
      if (Math.sin(robot.yaw) < -0.20) return { throttle: -0.92, steer: 0, strafe: 0, phase: "EXIT_GOAL" };
      const exitCmd = ctx.driveTo(0.66, robot.z < 1.0 ? 0.56 : 1.44, { maxThrottle: 0.90, kp: 2.2 });
      return { ...exitCmd, phase: "EXIT_GOAL" };
    }
    return ctx.scoredPieces.length < 16 ? ctx.scanForPieces() : { throttle: 0, steer: 0, strafe: 0, phase: "ALL_SCORED" };
  }

  const slots = [];
  for (const sx of [0.095, 0.185, 0.275, 0.345]) {
    for (const sz of [0.77, 0.885, 1.00, 1.115, 1.23]) slots.push({ x: sx, z: sz });
  }
  const knownScored = perceivedPieces.filter((p) => p.scored);
  function pickBestSlot(piece) {
    let best = slots[0], bestCost = Infinity;
    for (const s of slots) {
      if (knownScored.some((sp) => Math.hypot(sp.x - s.x, sp.z - s.z) < 0.068)) continue;
      const cost = s.x * 2.6 + Math.abs(s.z - piece.z) * 0.85;
      if (cost < bestCost) { bestCost = cost; best = s; }
    }
    return best;
  }

  if (!memory.phase) memory.phase = "APPROACH";
  if (memory.lastCheckTime == null) {
    memory.lastCheckTime = ctx.time; memory.lastCheckX = robot.x; memory.lastCheckZ = robot.z; memory.unstuckUntil = 0;
  }
  if (ctx.time < memory.unstuckUntil) {
    return { throttle: -0.82, steer: memory.unstuckSteer || 0.85, strafe: robot.isMecanum ? (memory.unstuckSteer > 0 ? -0.5 : 0.5) : 0, phase: "UNSTUCK", targetId: memory.targetId };
  }
  if (ctx.time - memory.lastCheckTime > 0.70) {
    if (Math.hypot(robot.x - memory.lastCheckX, robot.z - memory.lastCheckZ) < 0.024 && memory.phase !== "RETREAT") {
      memory.unstuckUntil = ctx.time + 0.45;
      memory.unstuckSteer = (Math.sin(ctx.time * 17) >= 0 ? 1 : -1) * 0.88;
      memory.phase = "APPROACH";
    }
    memory.lastCheckTime = ctx.time; memory.lastCheckX = robot.x; memory.lastCheckZ = robot.z;
  }

  if (memory.phase === "RETREAT") {
    if (robot.x < 0.58 && robot.z > 0.54 && robot.z < 1.46) {
      if (Math.sin(robot.yaw) < -0.20) return { throttle: -0.94, steer: 0, strafe: 0, phase: "RETREAT" };
      const out = ctx.driveTo(0.66, robot.z < 1.0 ? 0.56 : 1.44, { maxThrottle: 0.88, kp: 2.2 });
      return { ...out, phase: "RETREAT" };
    }
    memory.phase = "APPROACH"; memory.targetId = null;
  }

  let target = myPieces.find((p) => p.id === memory.targetId);
  if (!target || memory.phase === "APPROACH") {
    let bestU = -Infinity;
    for (const p of myPieces) {
      const oppPressure = enemyRobot ? Math.max(0, 0.9 - ctx.dist(enemyRobot, p)) * 1.4 : 0;
      const nearGoalBonus = (p.x > 0.42 && p.x < 0.85) ? 4.4 : (p.x <= 0.42 ? -12.0 : 0);
      const wallPen = (p.x > 2.74 ? 12 : 0) + (p.z < 0.14 || p.z > 1.86 ? 4.5 : 0);
      const u = p.value * (params.valueWeight + 0.7) - ctx.dist(robot, p) * params.distWeight - Math.hypot(p.x - goal.x, p.z - goal.z) * params.goalDistWeight + nearGoalBonus + (p.inView ? 0.8 : 0) + oppPressure - wallPen;
      if (u > bestU) { bestU = u; target = p; }
    }
    if (target) memory.targetId = target.id;
  }
  if (!target) return ctx.scanForPieces();
  if (inGoalBox(robot.x, robot.z) && memory.phase !== "PUSH" && target.x > 0.48) {
    if (Math.sin(robot.yaw) < -0.20) return { throttle: -0.92, steer: 0, strafe: 0, phase: "EXIT_GOAL" };
    return { ...ctx.driveTo(0.64, robot.z < 1.0 ? 0.56 : 1.44, { maxThrottle: 0.88, kp: 2.1 }), phase: "EXIT_GOAL" };
  }

  const slot = pickBestSlot(target);
  const dxG = slot.x - target.x, dzG = slot.z - target.z, distG = Math.hypot(dxG, dzG) || 1;
  const dirX = dxG / distG, dirZ = dzG / distG;
  const standOff = params.approachDist;
  let apZ = target.z - dirZ * standOff;
  if (target.z < 0.16) apZ = target.z + 0.14;
  if (target.z > 1.84) apZ = target.z - 0.14;
  const apPt = { x: ctx.clamp(target.x - dirX * standOff, 0.22, ctx.field.width - 0.16), z: ctx.clamp(apZ, 0.18, ctx.field.depth - 0.18) };

  const cY = Math.cos(robot.yaw), sY = Math.sin(robot.yaw);
  const fDot = (target.x - robot.x) * sY + (target.z - robot.z) * cY;
  const lDot = (target.x - robot.x) * cY - (target.z - robot.z) * sY;
  const inPocket = (sensors.pocket.inPocket && sensors.pocket.piece?.id === target.id) || (fDot > 0.05 && fDot < 0.26 && Math.abs(lDot) < robot.deviceWidth * 0.64);
  const dAp = ctx.dist(robot, apPt);

  if (memory.phase === "APPROACH") {
    if (inPocket && Math.abs(ctx.angleDiff(ctx.angleTo(target, slot), robot.yaw)) < 0.52) memory.phase = "PUSH";
    else if (dAp < 0.095) memory.phase = "ALIGN";
  } else if (memory.phase === "ALIGN") {
    if (Math.abs(ctx.angleDiff(ctx.angleTo(robot, target), robot.yaw)) < params.alignAngleTol || inPocket) memory.phase = "PUSH";
    else if (dAp > 0.20) memory.phase = "APPROACH";
  } else if (memory.phase === "PUSH") {
    if (target.scored && (target.x <= Math.min(params.goalReleaseX, slot.x + 0.07) || target.x <= 0.30)) {
      memory.phase = "RETREAT";
      return { throttle: -0.94, steer: 0, strafe: 0, targetId: target.id, phase: "RETREAT" };
    }
    if (!inPocket && (ctx.dist(robot, target) > 0.34 || fDot < 0.01)) memory.phase = "APPROACH";
  }

  if (memory.phase === "APPROACH") {
    let wp = apPt;
    const frontOpp = (sensors.laser?.rays || []).find((r) => r.hitType === "robot" && r.dist < 0.28 && Math.abs(r.angleDeg) <= 22);
    if (frontOpp) {
      wp = { x: ctx.clamp(robot.x + (apPt.x >= robot.x ? 0.20 : -0.20), 0.22, 2.80), z: ctx.clamp(robot.z + (frontOpp.angleDeg >= 0 ? -0.34 : 0.34), 0.20, 1.80) };
    } else if (robot.x < 0.54 && apPt.x < 0.56 && ((robot.z < 0.66 && apPt.z > 0.66) || (robot.z > 1.34 && apPt.z < 1.34))) {
      wp = { x: 0.64, z: robot.z };
    } else if (robot.x < apPt.x - 0.08) {
      const laneZ = robot.z >= 1.0 ? 1.62 : 0.38;
      if (robot.x < 1.12 && apPt.x > 1.05 && Math.abs(robot.z - laneZ) > 0.22) wp = { x: Math.min(1.18, apPt.x), z: laneZ };
      else if (Math.abs(robot.z - target.z) < 0.32 || (robot.x > 0.95 && Math.abs(robot.z - 1.0) < 0.44)) {
        const bypassZ = target.z >= 1.0 ? ctx.clamp(Math.max(1.56, target.z + 0.34), 0.22, 1.78) : ctx.clamp(Math.min(0.44, target.z - 0.34), 0.22, 1.78);
        wp = { x: ctx.clamp(apPt.x + 0.06, 0.22, 2.82), z: bypassZ };
      }
    }
    const cmd = ctx.driveTo(wp.x, wp.z, { maxThrottle: Math.min(1, params.cruiseThrottle + 0.03), kp: params.steerKp, useStrafe: true });
    return { ...cmd, targetId: target.id, phase: "BLITZ_APPROACH", waypoints: [wp, apPt, target, slot] };
  }

  if (memory.phase === "ALIGN") {
    const err = ctx.angleDiff(ctx.angleTo(robot, target), robot.yaw);
    return { throttle: Math.abs(err) < 0.32 ? 0.25 : 0.04, steer: ctx.clamp(err * (params.steerKp + 0.7), -1, 1), strafe: 0, targetId: target.id, phase: "BLITZ_ALIGN", waypoints: [target, slot] };
  }

  const blendX = inPocket ? ((target.x + dirX * 0.22) * 0.55 + slot.x * 0.45) : target.x;
  const blendZ = inPocket ? ((target.z + dirZ * 0.22) * 0.55 + slot.z * 0.45) : target.z;
  const pushErr = ctx.angleDiff(ctx.angleTo(robot, { x: blendX, z: blendZ }), robot.yaw);
  const lateralFix = robot.isMecanum ? ctx.clamp(lDot * 3.6, -0.55, 0.55) : 0;
  return { throttle: Math.min(1, params.pushThrottle + 0.04) * (Math.abs(pushErr) > 0.6 ? 0.55 : 1.0), steer: ctx.clamp(pushErr * params.steerKp, -1, 1), strafe: lateralFix, targetId: target.id, phase: "BLITZ_PUSH", waypoints: [target, slot] };
}`,

    combo_sweep: `// 🧹 模板二：纯视觉走廊迂回 + 区域清场策略
function decide(ctx) {
  const { robot, myPieces, perceivedPieces, params, memory } = ctx;
  const inGoalBox = (x, z) => x < 0.48 && z > 0.60 && z < 1.40;
  if (!myPieces.length) {
    if (inGoalBox(robot.x, robot.z)) return { throttle: -0.88, steer: 0, strafe: 0, phase: "DONE_EXIT" };
    return ctx.scoredPieces.length < 16 ? ctx.scanForPieces() : { throttle: 0, steer: 0, strafe: 0, phase: "DONE" };
  }
  if (memory.retreatUntil && ctx.time < memory.retreatUntil) {
    if (robot.x < 0.58 && robot.z > 0.56 && robot.z < 1.44 && Math.sin(robot.yaw) < -0.20) return { throttle: -0.90, steer: 0, strafe: 0, phase: "RETREAT" };
    memory.retreatUntil = 0;
  }
  const scored = perceivedPieces.filter((p) => p.scored);
  function pickSlot(piece) {
    let best = { x: 0.14, z: ctx.clamp(piece.z, 0.77, 1.23) }, bestCost = Infinity;
    for (const sx of [0.095, 0.185, 0.275, 0.345]) for (const sz of [0.77, 0.885, 1.00, 1.115, 1.23]) {
      if (scored.some((sp) => Math.hypot(sp.x - sx, sp.z - sz) < 0.068)) continue;
      const c = sx * 2.6 + Math.abs(sz - piece.z);
      if (c < bestCost) { bestCost = c; best = { x: sx, z: sz }; }
    }
    return best;
  }
  let target = myPieces.find((p) => p.id === memory.targetId);
  if (!target) {
    target = myPieces.slice().sort((a, b) => (b.value * 2.2 - ctx.dist(robot, b) * 2.6 - b.x * 1.4 - (b.x > 2.74 ? 10 : 0)) - (a.value * 2.2 - ctx.dist(robot, a) * 2.6 - a.x * 1.4 - (a.x > 2.74 ? 10 : 0)))[0];
    memory.targetId = target.id;
  }
  const slot = pickSlot(target);
  if (target.scored && target.x <= Math.min(0.34, slot.x + 0.07)) { memory.retreatUntil = ctx.time + 0.65; memory.targetId = null; return { throttle: -0.90, steer: 0, strafe: 0, phase: "RETREAT" }; }
  const dx = slot.x - target.x, dz = slot.z - target.z, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
  const approach = { x: ctx.clamp(target.x - ux * params.approachDist, 0.22, 2.82), z: ctx.clamp(target.z - uz * params.approachDist, 0.20, 1.80) };
  const forwardDot = (target.x - robot.x) * Math.sin(robot.yaw) + (target.z - robot.z) * Math.cos(robot.yaw);
  const lateralDot = (target.x - robot.x) * Math.cos(robot.yaw) - (target.z - robot.z) * Math.sin(robot.yaw);
  const alignedBehind = (robot.x > target.x + 0.02) && Math.abs(lateralDot) < robot.deviceWidth * 0.65 && forwardDot > 0.04 && forwardDot < 0.28;
  if (!alignedBehind && ctx.dist(robot, approach) > 0.10) {
    if (inGoalBox(robot.x, robot.z)) return { throttle: -0.90, steer: 0, strafe: 0, phase: "EXIT_GOAL" };
    let wp = approach;
    if (robot.x < approach.x - 0.08 && (Math.abs(robot.z - 1.0) < 0.45 || Math.abs(robot.z - target.z) < 0.30)) wp = { x: approach.x, z: robot.z >= 1.0 ? 1.62 : 0.38 };
    const cmd = ctx.driveTo(wp.x, wp.z, { maxThrottle: params.cruiseThrottle, kp: params.steerKp });
    return { ...cmd, targetId: target.id, phase: "SWEEP_APPROACH", waypoints: [wp, approach, target, slot] };
  }
  const aim = alignedBehind ? { x: target.x + ux * 0.18, z: target.z + uz * 0.18 } : target;
  const cmd = ctx.driveTo(aim.x, aim.z, { maxThrottle: params.pushThrottle, kp: params.steerKp });
  return { ...cmd, targetId: target.id, phase: "SWEEP_PUSH", waypoints: [target, slot] };
}`,

    mecanum_omni: `// 🦀 模板三：纯视觉麦克纳姆/全向轮蟹行对准策略
function decide(ctx) {
  const { robot, myPieces, perceivedPieces, params, memory } = ctx;
  const inGoalBox = (x, z) => x < 0.48 && z > 0.60 && z < 1.40;
  if (!myPieces.length) {
    if (inGoalBox(robot.x, robot.z)) return { throttle: -0.88, steer: 0, strafe: 0, phase: "DONE_EXIT" };
    return ctx.scoredPieces.length < 16 ? ctx.scanForPieces() : { throttle: 0, steer: 0, strafe: 0, phase: "DONE" };
  }
  if (memory.retreatUntil && ctx.time < memory.retreatUntil) {
    if (robot.x < 0.58 && robot.z > 0.56 && robot.z < 1.44 && Math.sin(robot.yaw) < -0.20) return { throttle: -0.88, steer: 0, strafe: 0, phase: "RETREAT" };
    memory.retreatUntil = 0;
  }
  const scored = perceivedPieces.filter((p) => p.scored);
  function pickSlot(piece) {
    let best = { x: 0.14, z: ctx.clamp(piece.z, 0.77, 1.23) }, bestCost = Infinity;
    for (const sx of [0.095, 0.185, 0.275, 0.345]) for (const sz of [0.77, 0.885, 1.00, 1.115, 1.23]) {
      if (scored.some((sp) => Math.hypot(sp.x - sx, sp.z - sz) < 0.068)) continue;
      const c = sx * 2.6 + Math.abs(sz - piece.z);
      if (c < bestCost) { bestCost = c; best = { x: sx, z: sz }; }
    }
    return best;
  }
  let target = myPieces.find((p) => p.id === memory.targetId);
  if (!target) {
    target = myPieces.slice().sort((a, b) => (b.value * 2.5 - ctx.dist(robot, b) * 3 - b.x - (b.x > 2.74 ? 10 : 0)) - (a.value * 2.5 - ctx.dist(robot, a) * 3 - a.x - (a.x > 2.74 ? 10 : 0)))[0];
    memory.targetId = target.id;
  }
  const slot = pickSlot(target);
  if (target.scored && target.x <= Math.min(0.34, slot.x + 0.07)) { memory.retreatUntil = ctx.time + 0.65; memory.targetId = null; return { throttle: -0.88, steer: 0, strafe: 0, phase: "RETREAT" }; }
  const goalYaw = ctx.angleTo(target, slot), yawErr = ctx.angleDiff(goalYaw, robot.yaw), ux = Math.sin(goalYaw), uz = Math.cos(goalYaw);
  const behindX = ctx.clamp(target.x - ux * 0.22, 0.22, 2.82), behindZ = ctx.clamp(target.z - uz * 0.22, 0.20, 1.80);
  if (inGoalBox(robot.x, robot.z) && target.x > 0.45) return { throttle: -0.88, steer: 0, strafe: 0, phase: "EXIT_GOAL" };
  if (robot.x < behindX - 0.10 && (Math.abs(robot.z - 1.0) < 0.45 || Math.abs(robot.z - target.z) < 0.30)) {
    const bypass = { x: behindX, z: robot.z >= 1.0 ? 1.62 : 0.38 };
    const cmd = ctx.driveTo(bypass.x, bypass.z, { maxThrottle: params.cruiseThrottle, kp: params.steerKp });
    return { ...cmd, targetId: target.id, phase: "OMNI_BYPASS", waypoints: [bypass, { x: behindX, z: behindZ }, target, slot] };
  }
  const dx = behindX - robot.x, dz = behindZ - robot.z, c = Math.cos(robot.yaw), s = Math.sin(robot.yaw);
  const fwdErr = dx * s + dz * c, latErr = dx * c - dz * s;
  if (Math.abs(latErr) < 0.06 && fwdErr > -0.06 && Math.abs(yawErr) < 0.28) {
    return { throttle: params.pushThrottle, steer: ctx.clamp(yawErr * 2.6, -1, 1), strafe: ctx.clamp(latErr * 4.0, -0.7, 0.7), targetId: target.id, phase: "OMNI_PUSH", waypoints: [target, slot] };
  }
  return { throttle: ctx.clamp(fwdErr * 3.0, -0.9, 0.9), steer: ctx.clamp(yawErr * 2.4, -1, 1), strafe: ctx.clamp(latErr * 3.5, -0.95, 0.95), targetId: target.id, phase: "OMNI_CRAB", waypoints: [{ x: behindX, z: behindZ }, target, slot] };
}`,

    minimal_custom: `// ✍️ 模板四：极简纯视觉脚本骨架（无全局地图作弊，仅靠车载相机发现目标）
function decide(ctx) {
  const { robot, myPieces, memory } = ctx;
  if (myPieces.length === 0) return ctx.scoredPieces.length < 16 ? ctx.scanForPieces() : { throttle: 0, steer: 0, strafe: 0, phase: "FINISHED" };
  if (memory.retreatUntil && ctx.time < memory.retreatUntil) return { throttle: -0.85, steer: 0, strafe: 0, phase: "RETREAT" };
  let target = myPieces.find((p) => p.id === memory.targetId);
  if (!target) {
    target = myPieces.slice().sort((a, b) => (b.value * 2.2 - ctx.dist(robot, b) * 2.8) - (a.value * 2.2 - ctx.dist(robot, a) * 2.8))[0];
    memory.targetId = target.id;
  }
  if (target.scored && target.x < 0.34) { memory.retreatUntil = ctx.time + 0.55; memory.targetId = null; return { throttle: -0.85, steer: 0, strafe: 0, phase: "RETREAT" }; }
  const slot = { x: 0.16, z: ctx.clamp(target.z, 0.78, 1.22) };
  const dx = slot.x - target.x, dz = slot.z - target.z, dist = Math.hypot(dx, dz) || 1;
  const approachX = ctx.clamp(target.x - (dx / dist) * 0.24, 0.22, 2.82), approachZ = ctx.clamp(target.z - (dz / dist) * 0.24, 0.20, 1.80);
  const inLine = robot.x > target.x + 0.04 && Math.abs(robot.z - target.z) < 0.14 && Math.sin(robot.yaw) < -0.35;
  if (!inLine && robot.x < 0.52 && robot.z > 0.60 && robot.z < 1.40) return { throttle: -0.85, steer: 0, strafe: 0, phase: "EXIT_GOAL" };
  let dest = inLine ? slot : { x: approachX, z: approachZ };
  if (!inLine && robot.x < approachX - 0.10 && (Math.abs(robot.z - 1.0) < 0.44 || Math.abs(robot.z - target.z) < 0.28)) dest = { x: approachX, z: robot.z >= 1.0 ? 1.62 : 0.38 };
  const cmd = ctx.driveTo(dest.x, dest.z, { maxThrottle: 0.88, kp: 2.3 });
  return { ...cmd, targetId: target.id, phase: inLine ? "PUSH" : "SEEK", waypoints: [dest, slot] };
}`,
  };

  function compileStrategyCode(sourceText) {
    const trimmed = String(sourceText || "").trim();
    if (!trimmed) throw new Error("代码不能为空");
    let fnFactory;
    if (/function\s+decide\s*\(/.test(trimmed) || /(const|let|var)\s+decide\s*=/.test(trimmed)) {
      fnFactory = new Function(`"use strict";\n${trimmed}\nreturn decide;`);
    } else {
      fnFactory = new Function("ctx", `"use strict";\n${trimmed}`);
      return fnFactory;
    }
    const fn = fnFactory();
    if (typeof fn !== "function") throw new Error("必须定义一个 decide(ctx) 函数");
    return fn;
  }

  // =========================
  // 3. 确定性随机数 & 纯车载感知物理引擎
  // =========================
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashNoise(str, stepBucket) {
    let h = (2166136261 ^ stepBucket) >>> 0;
    for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) / 4294967296) * 2 - 1;
  }

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function approach(current, target, amount) { return current < target ? Math.min(current + amount, target) : Math.max(current - amount, target); }
  function normaliseAngle(angle) { return Math.atan2(Math.sin(angle), Math.cos(angle)); }

  // =========================
  // 参数化 CAD 自定义件与拼图式吸附装配
  // =========================
  const CUSTOM_PARTS_KEY = "xiangqi_custom_parts_v1";
  const CUSTOM_MCP_ENDPOINT_KEY = "xiangqi_cad_mcp_endpoint_v1";
  const CUSTOM_PART_TEMPLATES = {
    plate: {
      label: "自由板件 / 安装板",
      description: "适合底板、侧板、摄像头托板与隔板",
      defaults: { width: 0.120, length: 0.180, height: 0.006, thickness: 0.006, massKg: 0.08, color: "#2d9279" },
    },
    bracket: {
      label: "L 型支架",
      description: "两面直角折弯，适合安装相机、电机和收集机构",
      defaults: { width: 0.080, length: 0.090, height: 0.060, thickness: 0.006, massKg: 0.07, color: "#4d98e0" },
    },
    funnel: {
      label: "导向漏斗 / 收集翼",
      description: "带侧壁的喇叭形导向件，可拼接为多种收集装置",
      defaults: { width: 0.160, length: 0.120, height: 0.050, thickness: 0.005, massKg: 0.09, color: "#e0a943" },
    },
    connector: {
      label: "快拆连接块",
      description: "带两枚圆柱定位销与连接槽的拼图接口件",
      defaults: { width: 0.060, length: 0.060, height: 0.030, thickness: 0.008, massKg: 0.04, color: "#a56bd6" },
    },
    block: {
      label: "自由实体 / 外壳块",
      description: "用于外壳、配重、防护罩和任意占位几何",
      defaults: { width: 0.080, length: 0.080, height: 0.050, thickness: 0.010, massKg: 0.10, color: "#7d8c99" },
    },
  };

  function makeCustomPart(spec = {}) {
    const template = CUSTOM_PART_TEMPLATES[spec.template] ? spec.template : "plate";
    const defaults = CUSTOM_PART_TEMPLATES[template].defaults;
    const safeNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    return {
      id: String(spec.id || `cad-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`),
      name: String(spec.name || CUSTOM_PART_TEMPLATES[template].label),
      template,
      role: ["structure", "collector", "guard"].includes(spec.role) ? spec.role : "structure",
      width: Math.max(0.004, safeNumber(spec.width, defaults.width)),
      length: Math.max(0.004, safeNumber(spec.length, defaults.length)),
      height: Math.max(0.002, safeNumber(spec.height, defaults.height)),
      thickness: Math.max(0.001, safeNumber(spec.thickness, defaults.thickness)),
      massKg: Math.max(0, safeNumber(spec.massKg, defaults.massKg)),
      color: /^#[0-9a-f]{6}$/i.test(String(spec.color || "")) ? String(spec.color) : defaults.color,
      x: safeNumber(spec.x, 0),
      y: safeNumber(spec.y, 0.115),
      z: safeNumber(spec.z, 0),
      yaw: safeNumber(spec.yaw, 0),
      slotId: spec.slotId ? String(spec.slotId) : "",
      connected: Boolean(spec.connected),
      locked: Boolean(spec.locked),
      connectors: Array.isArray(spec.connectors) ? spec.connectors.map((item) => ({ ...item })) : ["male", "female"],
    };
  }

  function customPartMassKg(parts) {
    return (Array.isArray(parts) ? parts : []).reduce((sum, part) => sum + Math.max(0, Number(part.massKg) || 0), 0);
  }

  function customPartColor(value, fallback = [0.18, 0.58, 0.48]) {
    const hex = String(value || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback;
    return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255];
  }

  function getCustomSnapSlots(build) {
    const b = build || {};
    const topY = (b.groundClearance || 0.018) + (b.height || 0.09) + 0.006;
    const hw = (b.width || 0.22) * 0.38;
    const hl = (b.length || 0.24) * 0.38;
    return [
      { id: "deck-top-center", label: "顶板中心", x: 0, y: topY, z: 0, yaw: 0 },
      { id: "deck-front-center", label: "顶板前中", x: 0, y: topY, z: hl, yaw: 0 },
      { id: "deck-rear-center", label: "顶板后中", x: 0, y: topY, z: -hl, yaw: 180 },
      { id: "deck-left", label: "左侧导轨", x: -hw, y: topY, z: 0, yaw: 90 },
      { id: "deck-right", label: "右侧导轨", x: hw, y: topY, z: 0, yaw: -90 },
      { id: "front-tool", label: "前端工具座", x: 0, y: Math.max(0.035, b.deviceMountY || 0.035), z: (b.length || 0.24) * 0.56, yaw: 0 },
      { id: "camera-mast", label: "相机桅杆", x: b.cameraMountX || 0, y: b.cameraHeight || 0.18, z: b.cameraMountZ || 0.06, yaw: 0 },
      { id: "battery-bay", label: "电池舱", x: b.battMountX || 0.035, y: b.battMountY || topY, z: b.cgOffsetZ || -0.025, yaw: b.battYaw || 0 },
    ];
  }

  function snapCustomPart(part, build, preferredSlotId = "") {
    if (!part || part.locked) return null;
    const slots = getCustomSnapSlots(build);
    const preferred = slots.find((slot) => slot.id === preferredSlotId);
    if (preferred) {
      part.x = preferred.x;
      part.y = preferred.y;
      part.z = preferred.z;
      part.yaw = preferred.yaw;
      part.slotId = preferred.id;
      part.connected = true;
      return preferred;
    }
    const candidates = slots;
    let best = null;
    let bestDist = 0.085;
    for (const slot of candidates) {
      const d = Math.hypot((part.x || 0) - slot.x, (part.z || 0) - slot.z, ((part.y || 0) - slot.y) * 0.6);
      if (d < bestDist) { best = slot; bestDist = d; }
    }
    if (!best) {
      part.connected = false;
      part.slotId = "";
      return null;
    }
    part.x = best.x;
    part.y = best.y;
    part.z = best.z;
    part.yaw = best.yaw;
    part.slotId = best.id;
    part.connected = true;
    return best;
  }

  function getRuntimeCustomParts() {
    return Array.isArray(globalThis.__xiangqiCustomParts) ? globalThis.__xiangqiCustomParts : [];
  }

  function createPiecesWithSeed(seed = 42, layoutMode = "standard") {
    const rng = mulberry32(seed);
    const pieces = [];
    let index = 0;
    const zone = layoutMode === "spread"
      ? { minX: 0.72, maxX: 2.28, minZ: 0.25, maxZ: 1.75 }
      : { minX: 1.24, maxX: 1.76, minZ: 0.74, maxZ: 1.26 };

    const addSide = (side) => {
      PIECE_TYPES.forEach((type) => {
        for (let copy = 0; copy < type.count; copy += 1) {
          let x = 1.5, z = 1.0, valid = false;
          for (let attempt = 0; attempt < 450 && !valid; attempt += 1) {
            x = zone.minX + rng() * (zone.maxX - zone.minX);
            z = zone.minZ + rng() * (zone.maxZ - zone.minZ);
            valid = pieces.every((piece) => Math.hypot(piece.x - x, piece.z - z) >= PIECE_RADIUS * 2.15);
          }
          if (!valid) {
            const col = index % 6, row = Math.floor(index / 6);
            x = 1.24 + col * 0.088; z = 0.74 + row * 0.088;
          }
          pieces.push({
            id: `${side}-${++index}`,
            side,
            symbol: side === "red" ? type.symbol : type.enemySymbol,
            kind: type.kind,
            value: type.value,
            x, z, vx: 0, vz: 0,
            radius: PIECE_RADIUS,
            scored: false,
            confidence: 0.90 + rng() * 0.09,
          });
        }
      });
    };
    addSide("red");
    addSide("blue");
    return pieces;
  }

  function rayToArenaWall(ox, oz, yaw) {
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    let minT = 10;
    if (Math.abs(dx) > 1e-6) {
      const t1 = (0 - ox) / dx; if (t1 > 0) minT = Math.min(minT, t1);
      const t2 = (FIELD.width - ox) / dx; if (t2 > 0) minT = Math.min(minT, t2);
    }
    if (Math.abs(dz) > 1e-6) {
      const t3 = (0 - oz) / dz; if (t3 > 0) minT = Math.min(minT, t3);
      const t4 = (FIELD.depth - oz) / dz; if (t4 > 0) minT = Math.min(minT, t4);
    }
    return minT;
  }

  function rayCastSensor(ox, oz, yaw, oppRobot = null) {
    let minT = rayToArenaWall(ox, oz, yaw), hitType = "wall";
    if (oppRobot) {
      const dx = Math.sin(yaw), dz = Math.cos(yaw);
      const fx = ox - oppRobot.x, fz = oz - oppRobot.z, rad = 0.145;
      const bCoef = 2 * (fx * dx + fz * dz), cCoef = fx * fx + fz * fz - rad * rad;
      const disc = bCoef * bCoef - 4 * cCoef;
      if (disc >= 0) {
        const tHit = (-bCoef - Math.sqrt(disc)) * 0.5;
        if (tHit > 0.04 && tHit < minT) { minT = tHit; hitType = "robot"; }
      }
    }
    return { dist: minT, hitType };
  }

  function getLaserFanAngles(count) {
    if (count <= 0) return [];
    if (count === 1) return [0];
    if (count <= 3) return [-24, 0, 24];
    if (count <= 5) return [-45, -20, 0, 20, 45];
    const span = 64, out = [];
    for (let i = 0; i < count; i += 1) out.push(Math.round(-span + (2 * span * i) / (count - 1)));
    return out;
  }

  function updatePerceptionForRobot({ pieces, robot, build, perceivedMap, time, targetSide, oppRobot }) {
    const sR = Math.sin(robot.yaw), cR = Math.cos(robot.yaw);
    const camX = robot.x + cR * build.cameraMountX + sR * build.cameraMountZ;
    const camY = build.cameraHeight;
    const camZ = robot.z - sR * build.cameraMountX + cR * build.cameraMountZ;
    const camYaw = normaliseAngle(robot.yaw + (build.cameraMountYaw * Math.PI) / 180);
    const pitchRad = (build.cameraPitch * Math.PI) / 180;
    const halfFov = ((build.fov * Math.PI) / 180) * 0.5;
    const tanHalfX = Math.tan(halfFov);
    const tanHalfY = tanHalfX / (480 / 230);
    const minRange = build.cameraMinRange;
    const maxRange = build.sensorRange;

    const hFwd = Math.cos(pitchRad), vDown = -Math.sin(pitchRad);
    const fwd3 = [Math.sin(camYaw) * hFwd, vDown, Math.cos(camYaw) * hFwd];
    const rLen = Math.hypot(-fwd3[2], fwd3[0]) || 1;
    const right3 = [-fwd3[2] / rLen, 0, fwd3[0] / rLen];
    const up3 = [
      right3[1] * fwd3[2] - right3[2] * fwd3[1],
      right3[2] * fwd3[0] - right3[0] * fwd3[2],
      right3[0] * fwd3[1] - right3[1] * fwd3[0],
    ];

    const vHalf = Math.atan(tanHalfY);
    const angTop = pitchRad - vHalf;
    const angBot = pitchRad + vHalf;
    const farGroundDist = angTop > 0.025 ? clamp(camY / Math.tan(angTop), minRange, maxRange) : maxRange;
    const nearGroundDist = angBot < Math.PI / 2 - 0.04 ? clamp(camY / Math.tan(angBot), minRange, maxRange) : minRange;

    const frontPlateZ = build.length / 2 + build.deviceOffset;
    const pocketEndZ = frontPlateZ + build.wingTipForward;
    const devX = build.deviceMountX || 0;
    const halfMouthLeft = build.deviceWidth * 0.5 + (build.leftWingDepth || 0) * Math.sin(((build.leftWingSplay || 0) * Math.PI) / 180);
    const halfMouthRight = build.deviceWidth * 0.5 + (build.rightWingDepth || 0) * Math.sin(((build.rightWingSplay || 0) * Math.PI) / 180);
    const halfBodyL = build.length / 2;
    const plateBottomY = build.deviceMountY ?? 0.002;
    const plateTopY = plateBottomY + (build.deviceHeight ?? 0.056);
    const pocketExtra = build.pocketSensorRange ?? 0.030;

    const inConeCandidates = [];
    let pocketPiece = null;
    const timeBucket = Math.floor(time * 15);

    for (let i = 0; i < pieces.length; i += 1) {
      const p = pieces[i];
      const rdx = p.x - robot.x, rdz = p.z - robot.z;
      const lz = rdx * sR + rdz * cR;
      const lx = rdx * cR - rdz * sR;
      const lxShift = lx - devX;
      const inPocket = build.hasPocketSensor && lz >= halfBodyL - 0.01 && lz <= pocketEndZ + p.radius + pocketExtra
        && lxShift >= -(halfMouthLeft + 0.015) && lxShift <= (halfMouthRight + 0.015);
      if (inPocket && !pocketPiece) pocketPiece = p;

      const dx = p.x - camX, dy = PIECE_HEIGHT * 0.6 - camY, dz = p.z - camZ;
      const dist = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz);
      const bearing = normaliseAngle(ang - camYaw);
      const zForward = dx * fwd3[0] + dy * fwd3[1] + dz * fwd3[2];
      const xc = dx * right3[0] + dy * right3[1] + dz * right3[2];
      const yc = dx * up3[0] + dy * up3[1] + dz * up3[2];
      const inFrustum3D = dist >= minRange && dist <= maxRange && zForward > 0.03
        && Math.abs(xc / zForward) <= tanHalfX * 1.04
        && Math.abs(yc / zForward) <= tanHalfY * 1.08;

      let selfBlocked = false;
      if (inFrustum3D && camY < plateTopY + 0.025 && plateBottomY < PIECE_HEIGHT && lz > frontPlateZ && build.cameraMountZ < frontPlateZ) {
        const denom = lz - build.cameraMountZ;
        if (denom > 0.02) {
          const tP = (frontPlateZ - build.cameraMountZ) / denom;
          const rayY = camY + tP * (PIECE_HEIGHT * 0.85 - camY);
          const rayX = build.cameraMountX + tP * (lx - build.cameraMountX);
          if (rayY >= plateBottomY && rayY < plateTopY && Math.abs(rayX - devX) <= build.deviceWidth * 0.52) selfBlocked = true;
        }
      }
      if ((inFrustum3D && !selfBlocked) || inPocket) inConeCandidates.push({ piece: p, dist, ang, bearing, inPocket });
    }

    inConeCandidates.sort((a, b) => a.dist - b.dist);
    const visibleList = [], visibleIds = new Set();
    const heightRatio = build.cameraHeight / Math.max(0.02, build.cameraHeight - PIECE_HEIGHT);

    for (let i = 0; i < inConeCandidates.length; i += 1) {
      const cand = inConeCandidates[i];
      let occluded = false;
      if (!cand.inPocket) {
        for (let j = 0; j < i; j += 1) {
          const blocker = inConeCandidates[j];
          if (cand.dist <= blocker.dist + 0.03) continue;
          const shadowEnd = blocker.dist * heightRatio;
          if (cand.dist <= shadowEnd && Math.abs(normaliseAngle(cand.ang - blocker.ang)) < Math.atan2(PIECE_RADIUS * 0.90, Math.max(0.08, blocker.dist))) {
            occluded = true; break;
          }
        }
      }
      if (occluded) continue;

      const p = cand.piece;
      const noiseAmp = cand.inPocket ? build.sensorNoise * 0.25 : build.sensorNoise * (0.4 + cand.dist * 0.7);
      const nx = hashNoise(p.id + "x", timeBucket) * noiseAmp;
      const nz = hashNoise(p.id + "z", timeBucket) * noiseAmp;
      const estX = clamp(p.x + nx, PIECE_RADIUS, FIELD.width - PIECE_RADIUS);
      const estZ = clamp(p.z + nz, PIECE_RADIUS, FIELD.depth - PIECE_RADIUS);

      const obs = {
        id: p.id, side: p.side, symbol: p.symbol, kind: p.kind, value: p.value,
        x: estX, z: estZ, vx: p.vx, vz: p.vz, radius: p.radius, scored: p.scored,
        distance: cand.dist, bearing: cand.bearing,
        confidence: clamp(0.98 - cand.dist * 0.06, 0.58, 0.99),
        lastSeenTime: time, inView: true,
      };
      visibleList.push(obs);
      visibleIds.add(p.id);
      perceivedMap.set(p.id, obs);
    }

    for (const [id, rec] of perceivedMap.entries()) {
      if (visibleIds.has(id)) continue;
      rec.inView = false;
      const cdx = rec.x - camX, cdz = rec.z - camZ;
      const dist = Math.hypot(cdx, cdz);
      const ang = Math.atan2(cdx, cdz);
      const bearing = normaliseAngle(ang - camYaw);
      const insideClearCone = farGroundDist > nearGroundDist + 0.08 && dist >= Math.max(minRange + 0.04, nearGroundDist + 0.05) && dist <= Math.min(maxRange - 0.06, farGroundDist - 0.05) && Math.abs(bearing) <= halfFov * 0.88;
      if (insideClearCone) {
        let occluded = false;
        for (let j = 0; j < visibleList.length; j += 1) {
          const blocker = visibleList[j];
          if (dist <= blocker.distance + 0.02) continue;
          if (dist <= blocker.distance * heightRatio) {
            const bAng = Math.atan2(blocker.x - camX, blocker.z - camZ);
            if (Math.abs(normaliseAngle(ang - bAng)) < Math.atan2(PIECE_RADIUS, Math.max(0.08, blocker.distance))) { occluded = true; break; }
          }
        }
        if (!occluded) perceivedMap.delete(id);
      }
    }

    const perceivedAll = Array.from(perceivedMap.values());
    const knownOwnCount = perceivedAll.filter((p) => p.side === targetSide).length;
    const fanAngles = getLaserFanAngles(build.laserRays ?? 3);
    const lmx = build.laserMountX ?? 0, lmz = build.laserMountZ ?? (build.length * 0.42);
    const laserX = robot.x + cR * lmx + sR * lmz;
    const laserZ = robot.z - sR * lmx + cR * lmz;
    const rays = fanAngles.map((deg) => {
      const rYaw = normaliseAngle(robot.yaw + (deg * Math.PI) / 180);
      const hit = rayCastSensor(laserX, laserZ, rYaw, oppRobot);
      return { angleDeg: deg, dist: hit.dist, hitType: hit.hitType };
    });

    let visibleEnemyRobot = null;
    if (oppRobot) {
      const odx = oppRobot.x - camX, odz = oppRobot.z - camZ, oDist = Math.hypot(odx, odz);
      const oBear = normaliseAngle(Math.atan2(odx, odz) - camYaw);
      const hitByRay = rays.some((r) => r.hitType === "robot" && r.dist < 1.85);
      if ((oDist <= maxRange * 1.15 && Math.abs(oBear) <= halfFov * 1.05) || hitByRay) {
        visibleEnemyRobot = { x: oppRobot.x, z: oppRobot.z, yaw: oppRobot.yaw, speed: oppRobot.speed };
      }
    }

    return {
      visibleIds,
      visibleEnemyRobot,
      visionState: {
        visible: visibleList,
        myVisible: visibleList.filter((p) => p.side === targetSide && !p.scored),
        enemyVisible: visibleList.filter((p) => p.side !== targetSide),
        camX, camY, camZ, camYaw, pitch: build.cameraPitch,
        nearGroundDist, farGroundDist,
        fov: build.fov, range: build.sensorRange, mountYaw: build.cameraMountYaw,
        unseenRedCount: Math.max(0, 16 - knownOwnCount),
        unseenTotalCount: Math.max(0, pieces.length - perceivedAll.length),
      },
      sensors: {
        pocket: { inPocket: Boolean(pocketPiece), piece: pocketPiece ? perceivedMap.get(pocketPiece.id) || null : null },
        laser: {
          frontDist: rayCastSensor(camX, camZ, camYaw, oppRobot).dist,
          leftDist: rayCastSensor(robot.x, robot.z, robot.yaw - Math.PI / 2, oppRobot).dist,
          rightDist: rayCastSensor(robot.x, robot.z, robot.yaw + Math.PI / 2, oppRobot).dist,
          rays,
        },
        imu: { x: robot.x, z: robot.z, yaw: robot.yaw, speed: robot.speed, omega: robot.omega },
      },
    };
  }

  function updateOnboardPerception(sim) {
    const opp = sim.matchMode === "versus" ? sim.enemyRobot : null;
    const redPerc = updatePerceptionForRobot({
      pieces: sim.pieces, robot: sim.robot, build: sim.build, perceivedMap: sim.perceivedMap,
      time: sim.time, targetSide: "red", oppRobot: opp,
    });
    sim.visionVisibleIds = redPerc.visibleIds;
    sim.visionState = redPerc.visionState;
    sim.sensors = redPerc.sensors;
    sim.visibleEnemyRobot = redPerc.visibleEnemyRobot;

    if (sim.matchMode === "versus" && sim.enemyRobot && sim.enemyBuild) {
      const bluePerc = updatePerceptionForRobot({
        pieces: sim.pieces, robot: sim.enemyRobot, build: sim.enemyBuild, perceivedMap: sim.enemyPerceivedMap,
        time: sim.time, targetSide: "blue", oppRobot: sim.robot,
      });
      sim.enemyVisionState = bluePerc.visionState;
      sim.enemySensors = bluePerc.sensors;
    } else {
      sim.enemyVisionState = null;
      sim.enemySensors = null;
    }
  }

  function resolveStartYaw(preset = "center") {
    if (preset === "east") return Math.PI * 0.5;
    if (preset === "north") return Math.PI * 0.86;
    if (preset === "wide") return Math.atan2(1.55 - 0.15, 0.72 - 1.85);
    return Math.atan2(1.5 - 0.15, 1.0 - 1.85);
  }

  function createEnemyBuild() {
    return resolveBuild({
      chassisId: "alu_balanced", motorId: "dc_520", wheelId: "wide_diff", deviceId: "u_funnel",
      sensorId: "cam_laser_imu", controllerId: "k230_stm32", batteryId: "3s_2200", safetyId: "standard_safety",
      overrides: { teamName: "乙队", laserRays: 3 },
    });
  }

  function computeTractionLimitN(build, physics) {
    const lonFactor = clamp(1 - Math.abs((build.frontAxlePct || 50) - 50) * 0.008, 0.72, 1.0);
    const latFactor = clamp(1 - Math.abs((build.leftAxlePct || 50) - 50) * 0.006, 0.76, 1.0);
    return build.totalMass * 9.81 * build.grip * ((physics?.friction ?? 0.78) / 0.78) * lonFactor * latFactor;
  }

  function createSimulationState(build, seed = 42, layoutMode = "standard", strategyParams = null, options = {}) {
    const matchMode = options.matchMode || "solo";
    const startYawPreset = options.startYawPreset || "center";
    const startYaw = resolveStartYaw(startYawPreset);
    const enemyYaw = Math.atan2(1.5 - 2.85, 1.0 - 0.15);
    const physics = { ...defaultPhysicsConfig(), ...(options.physics || {}) };
    const recordSnapshots = options.recordSnapshots !== undefined ? Boolean(options.recordSnapshots) : true;
    const sim = {
      time: 0, matchMode, startYawPreset, physics, recordSnapshots,
      score: 0, collected: 0, enemyScore: 0, enemyCollected: 0,
      contactForce: 0, peakContactForce: 0, friction: physics.friction,
      tractionMaxN: computeTractionLimitN(build, physics), tractionPct: 0,
      wheelSlip: 0, peakSlip: 0, slipEvents: 0, wasSlipping: false,
      lastWatts: 0, energyJ: 0, forceVec: { x: 0, z: 0 }, lastCmdSpeed: 0,
      targetId: null, phase: "READY", waypoints: [],
      robot: { x: 0.15, z: 1.85, yaw: startYaw, speed: 0, strafeSpeed: 0, omega: 0 },
      enemyRobot: matchMode === "versus" ? { x: 2.85, z: 0.15, yaw: enemyYaw, speed: 0, strafeSpeed: 0, omega: 0 } : null,
      enemyBuild: matchMode === "versus" ? createEnemyBuild() : null,
      pieces: createPiecesWithSeed(seed, layoutMode),
      perceivedMap: new Map(), visionVisibleIds: new Set(), visionState: null, sensors: null, visibleEnemyRobot: null,
      enemyPerceivedMap: new Map(), enemyVisionState: null, enemySensors: null,
      scanWaypointIdx: 0, enemyScanIdx: 0, trail: [], memory: {}, enemyMemory: {},
      history: [], snapshots: [], nextHistT: 0, nextSnapT: 0,
      controlTimer: 0, lastCmd: { throttle: 0, steer: 0, strafe: 0 },
      mutualStallTimer: 0, resetCount: 0,
      params: { ...defaultStrategyParams(), ...(strategyParams || {}) },
      build, scoreTime30: null, scoreTime40: null, maxScoreReached: 0,
    };
    updateOnboardPerception(sim);
    return sim;
  }

  function buildStrategyContext(sim, dt) {
    const { robot, build } = sim;
    const isMecanum = build.driveMode === "mecanum" || build.driveMode === "omni";
    const perceivedPieces = Array.from(sim.perceivedMap.values()).map((p) => ({ ...p }));
    const myPieces = perceivedPieces.filter((p) => p.side === "red" && !p.scored);
    const enemyPieces = perceivedPieces.filter((p) => p.side === "blue");
    const scoredPieces = perceivedPieces.filter((p) => p.side === "red" && p.scored);

    const driveToFn = (targetX, targetZ, opts = {}) => {
      const dx = targetX - robot.x, dz = targetZ - robot.z, range = Math.hypot(dx, dz);
      const stopDist = opts.stopDist ?? 0.02;
      if (range < stopDist) return { throttle: 0, steer: 0, strafe: 0 };
      const desiredYaw = Math.atan2(dx, dz), yawErr = normaliseAngle(desiredYaw - robot.yaw);
      const kp = opts.kp ?? sim.params.steerKp ?? 2.3, maxThrottle = opts.maxThrottle ?? 0.92;
      const steer = clamp(yawErr * kp, -1, 1);

      if (isMecanum && opts.useStrafe && range < 0.55) {
        const c = Math.cos(robot.yaw), s = Math.sin(robot.yaw);
        return { throttle: clamp((dx * s + dz * c) * 3.2, -maxThrottle, maxThrottle), steer: clamp(yawErr * kp * 0.7, -1, 1), strafe: clamp((dx * c - dz * s) * 3.4, -0.85, 0.85) };
      }
      const turnBrake = Math.abs(yawErr) > 1.35 ? 0.08 : Math.abs(yawErr) > 0.75 ? 0.42 : 1.0;
      return { throttle: clamp(range * 3.8, 0.18, maxThrottle) * turnBrake, steer, strafe: 0 };
    };

    const PATROL_POINTS = [
      { x: 1.05, z: 1.52 }, { x: 1.98, z: 1.52 }, { x: 2.35, z: 1.00 },
      { x: 1.98, z: 0.48 }, { x: 0.95, z: 0.48 }, { x: 0.88, z: 1.00 },
    ];

    return {
      time: sim.time, dt, matchMode: sim.matchMode,
      field: { width: FIELD.width, depth: FIELD.depth },
      goal: { ...GOAL }, enemyGoal: { ...ENEMY_GOAL },
      robot: {
        x: robot.x, z: robot.z, yaw: robot.yaw, speed: robot.speed, strafeSpeed: robot.strafeSpeed, omega: robot.omega,
        vx: Math.sin(robot.yaw) * robot.speed + Math.cos(robot.yaw) * robot.strafeSpeed,
        vz: Math.cos(robot.yaw) * robot.speed - Math.sin(robot.yaw) * robot.strafeSpeed,
        width: build.width, length: build.length, maxSpeed: build.maxSpeed, maxOmega: build.maxOmega,
        driveMode: build.driveMode, deviceWidth: build.deviceWidth, deviceOffset: build.deviceOffset, wingDepth: build.wingDepth, isMecanum,
      },
      enemyRobot: sim.visibleEnemyRobot ? { ...sim.visibleEnemyRobot } : null,
      vision: {
        visible: sim.visionState.visible.map((p) => ({ ...p })),
        myVisible: sim.visionState.myVisible.map((p) => ({ ...p })),
        enemyVisible: sim.visionState.enemyVisible.map((p) => ({ ...p })),
        fov: build.fov, range: build.sensorRange, mountYaw: build.cameraMountYaw, unseenCount: sim.visionState.unseenRedCount,
      },
      sensors: sim.sensors,
      perceivedPieces, pieces: perceivedPieces, myPieces, enemyPieces, scoredPieces,
      score: scoredPieces.reduce((sum, p) => sum + p.value, 0),
      params: sim.params, memory: sim.memory,
      clamp,
      dist: (a, b) => Math.hypot(a.x - b.x, a.z - b.z),
      angleTo: (from, to) => Math.atan2(to.x - from.x, to.z - from.z),
      angleDiff: (targetYaw, currentYaw) => normaliseAngle(targetYaw - currentYaw),
      driveTo: driveToFn,
      scanForPieces() {
        const wp = PATROL_POINTS[sim.scanWaypointIdx % PATROL_POINTS.length];
        if (Math.hypot(wp.x - robot.x, wp.z - robot.z) < 0.24) sim.scanWaypointIdx = (sim.scanWaypointIdx + 1) % PATROL_POINTS.length;
        const nextWp = PATROL_POINTS[sim.scanWaypointIdx % PATROL_POINTS.length];
        return { ...driveToFn(nextWp.x, nextWp.z, { maxThrottle: 0.78, kp: 2.3 }), phase: "SEARCH_SCAN", targetId: null, waypoints: [nextWp] };
      },
    };
  }

  function decideEnemyRobot(sim) {
    const r = sim.enemyRobot, b = sim.enemyBuild, mem = sim.enemyMemory;
    const perceived = Array.from(sim.enemyPerceivedMap.values());
    const targets = perceived.filter((p) => p.side === "blue" && !p.scored);
    const inEnemyGoal = (x, z) => x > 2.46 && z > 0.56 && z < 1.44;

    if (mem.retreatUntil && sim.time < mem.retreatUntil) {
      if (inEnemyGoal(r.x, r.z) && Math.sin(r.yaw) > 0.20) return { throttle: -0.90, steer: 0, strafe: 0 };
      mem.retreatUntil = 0;
    }

    const oppRay = (sim.enemySensors?.laser?.rays || []).find((ray) => ray.hitType === "robot" && ray.dist < 0.34);
    if (oppRay) return { throttle: -0.40, steer: oppRay.angleDeg >= 0 ? -0.85 : 0.85, strafe: 0 };

    if (!targets.length) {
      if (inEnemyGoal(r.x, r.z)) return { throttle: -0.85, steer: 0.4, strafe: 0 };
      const pat = [{ x: 1.95, z: 0.52 }, { x: 1.15, z: 0.52 }, { x: 0.82, z: 1.00 }, { x: 1.15, z: 1.48 }, { x: 1.95, z: 1.48 }];
      const wp = pat[sim.enemyScanIdx % pat.length];
      if (Math.hypot(wp.x - r.x, wp.z - r.z) < 0.25) sim.enemyScanIdx = (sim.enemyScanIdx + 1) % pat.length;
      const aimYaw = Math.atan2(wp.x - r.x, wp.z - r.z), err = normaliseAngle(aimYaw - r.yaw);
      return { throttle: Math.abs(err) > 0.9 ? 0.15 : 0.78, steer: clamp(err * 2.2, -1, 1), strafe: 0 };
    }

    let tgt = targets.find((p) => p.id === mem.targetId);
    if (!tgt) {
      targets.sort((a, c) => (c.value * 2.4 - Math.hypot(c.x - r.x, c.z - r.z) * 2.8) - (a.value * 2.4 - Math.hypot(a.x - r.x, a.z - r.z) * 2.8));
      tgt = targets[0];
      mem.targetId = tgt.id;
    }
    if (tgt.scored && tgt.x >= 2.66) { mem.retreatUntil = sim.time + 0.65; mem.targetId = null; return { throttle: -0.90, steer: 0, strafe: 0 }; }

    const dxG = ENEMY_GOAL.x - tgt.x, dzG = ENEMY_GOAL.z - tgt.z, dG = Math.hypot(dxG, dzG) || 1;
    const ux = dxG / dG, uz = dzG / dG;
    const apX = clamp(tgt.x - ux * 0.24, 0.18, 2.76), apZ = clamp(tgt.z - uz * 0.24, 0.18, 1.82);
    const sR = Math.sin(r.yaw), cR = Math.cos(r.yaw);
    const fDot = (tgt.x - r.x) * sR + (tgt.z - r.z) * cR, lDot = (tgt.x - r.x) * cR - (tgt.z - r.z) * sR;
    const aligned = fDot > 0.04 && fDot < 0.28 && Math.abs(lDot) < b.deviceWidth * 0.62;
    if (!aligned) {
      if (inEnemyGoal(r.x, r.z) && tgt.x < 2.52) return { throttle: -0.88, steer: 0, strafe: 0 };
      const wpX = r.x > apX + 0.08 && Math.abs(r.z - 1.0) < 0.44 ? apX : apX;
      const wpZ = r.x > apX + 0.08 && Math.abs(r.z - 1.0) < 0.44 ? (r.z < 1.0 ? 0.38 : 1.62) : apZ;
      const aim = Math.atan2(wpX - r.x, wpZ - r.z), err = normaliseAngle(aim - r.yaw);
      const brake = Math.abs(err) > 1.2 ? 0.10 : Math.abs(err) > 0.6 ? 0.45 : 1.0;
      return { throttle: 0.88 * brake, steer: clamp(err * 2.4, -1, 1), strafe: 0 };
    }
    const aimYaw = Math.atan2(tgt.x + ux * 0.22 - r.x, tgt.z + uz * 0.22 - r.z), err = normaliseAngle(aimYaw - r.yaw);
    return { throttle: 0.84, steer: clamp(err * 2.5, -1, 1), strafe: 0 };
  }

  function applyRobotPieceCollection(robot, build, pieces, worldVx, worldVz, s, c, subDt, applyPosAndFriction = false, physics = null) {
    const phys = physics || defaultPhysicsConfig();
    const frontPlateZ = build.length / 2 + build.deviceOffset;
    const halfDevW = build.deviceWidth / 2;
    const devX = build.deviceMountX || 0;
    const scoopHitsPiece = (build.deviceMountY ?? 0.002) < PIECE_HEIGHT + 0.001;
    const bodyHitsPiece = (build.groundClearance ?? 0.018) < PIECE_HEIGHT + 0.001;
    const leftDepth = build.leftWingDepth ?? build.wingDepth ?? 0;
    const rightDepth = build.rightWingDepth ?? build.wingDepth ?? 0;
    const leftSplayRad = ((build.leftWingSplay ?? build.wingSplayAngle ?? 0) * Math.PI) / 180;
    const rightSplayRad = ((build.rightWingSplay ?? build.wingSplayAngle ?? 0) * Math.PI) / 180;
    const leftTipZ = frontPlateZ + Math.max(0, leftDepth * Math.cos(leftSplayRad));
    const rightTipZ = frontPlateZ + Math.max(0, rightDepth * Math.cos(rightSplayRad));
    const pocketFrontZ = Math.max(leftTipZ, rightTipZ);
    const leftTan = Math.tan(leftSplayRad), rightTan = Math.tan(rightSplayRad);
    const halfBodyW = build.width / 2, halfBodyL = build.length / 2;
    const chamfer = Math.min(build.frontChamfer || 0, halfBodyW * 0.7, halfBodyL * 0.7);
    const customCollectors = getRuntimeCustomParts().filter((part) => part.role === "collector" && !part.locked);
    // 亚克力/密胺棋子在 PVC 赛道上的滑动动摩擦约为主观胶轮静摩擦系数的 0.48 倍
    const aFric = phys.friction * 0.48 * 9.81;
    const singleSlideN = phys.pieceMassKg * aFric;
    let maxForce = 0, pushedCount = 0, forceVecX = 0, forceVecZ = 0, yawTorque = 0;

    for (let i = 0; i < pieces.length; i += 1) {
      const piece = pieces[i];
      if (applyPosAndFriction) {
        const pSpeed = Math.hypot(piece.vx, piece.vz);
        if (pSpeed <= aFric * subDt) { piece.vx = 0; piece.vz = 0; }
        else if (pSpeed > 1e-6) {
          const scale = (pSpeed - aFric * subDt) / pSpeed;
          piece.vx *= scale; piece.vz *= scale;
        }
      }

      const dx = piece.x - robot.x, dz = piece.z - robot.z;
      const lz = dx * s + dz * c, lx = dx * c - dz * s;
      const lxShift = lx - devX;
      let handledByFront = false;

      if (scoopHitsPiece && lz > halfBodyL - 0.005 && lz <= pocketFrontZ + piece.radius + 0.014) {
        const dzInto = Math.max(0, lz - frontPlateZ);
        const leftHalfW = Math.max(0.025, halfDevW + Math.min(dzInto, Math.max(0.01, leftTipZ - frontPlateZ)) * leftTan);
        const rightHalfW = Math.max(0.025, halfDevW + Math.min(dzInto, Math.max(0.01, rightTipZ - frontPlateZ)) * rightTan);
        const leftWallX = -(leftHalfW - 0.007);
        const rightWallX = rightHalfW - 0.007;

        if (lxShift >= leftWallX && lxShift <= rightWallX) {
          if (lz < frontPlateZ + piece.radius + 0.004) {
            const deltaZ = frontPlateZ + piece.radius + 0.004 - lz;
            piece.x += s * deltaZ; piece.z += c * deltaZ;
            const pieceForwardV = piece.vx * s + piece.vz * c;
            const desiredForwardV = Math.max(robot.speed * build.pushGain, pieceForwardV)
              + (build.deviceKind === "active_roller" && robot.speed >= -0.02 ? 0.16 : 0);
            let impN = 0;
            if (desiredForwardV > pieceForwardV) {
              const addV = desiredForwardV - pieceForwardV;
              piece.vx += s * addV; piece.vz += c * addV;
              impN = (phys.pieceMassKg * addV) / Math.max(0.005, subDt);
            }
            const fN = singleSlideN + impN * 0.45;
            pushedCount += 1;
            maxForce = Math.max(maxForce, fN);
            forceVecX += s * fN; forceVecZ += c * fN;
            yawTorque -= lx * fN * 0.35;
            handledByFront = true;
          }
          // 独立左右翼挡板物理约束
          const minInnerL = -(Math.max(0.010, leftHalfW - 0.014 - piece.radius * 0.88));
          const maxInnerR = Math.max(0.010, rightHalfW - 0.014 - piece.radius * 0.88);
          if (leftDepth > 0.004 && lz >= frontPlateZ - 0.004 && lz <= leftTipZ + piece.radius * 0.75 && lxShift < minInnerL) {
            const corrLx = (minInnerL - lxShift) * build.retention;
            piece.x += c * corrLx; piece.z -= s * corrLx;
            maxForce = Math.max(maxForce, singleSlideN * 0.85);
            handledByFront = true;
          }
          if (rightDepth > 0.004 && lz >= frontPlateZ - 0.004 && lz <= rightTipZ + piece.radius * 0.75 && lxShift > maxInnerR) {
            const corrLx = (maxInnerR - lxShift) * build.retention;
            piece.x += c * corrLx; piece.z -= s * corrLx;
            maxForce = Math.max(maxForce, singleSlideN * 0.85);
            handledByFront = true;
          }
          if (robot.speed > 0.05 && (build.centering > 0 || build.wingSplayAngle > 2) && lz >= frontPlateZ - 0.004) {
            const midTarget = (maxInnerR + minInnerL) * 0.5;
            let aimLx = midTarget;
            if (build.dividerCount >= 1 && Math.abs(lxShift - midTarget) > 0.020) aimLx = midTarget + Math.sign(lxShift - midTarget) * Math.min((maxInnerR - minInnerL) * 0.32, 0.045);
            const pullStrength = build.centering + Math.max(0, build.wingSplayAngle) * 0.012;
            const pullLx = (aimLx - lxShift) * pullStrength * 2.4 * subDt;
            piece.x += c * pullLx; piece.z -= s * pullLx;
          }
        } else if (lxShift < leftWallX && leftDepth > 0.004 && lxShift > -(leftHalfW + piece.radius + 0.010) && lz >= frontPlateZ - 0.008 && lz <= leftTipZ + piece.radius) {
          const pushOut = -(leftHalfW + piece.radius + 0.004) - lxShift;
          piece.x += c * pushOut; piece.z -= s * pushOut;
          maxForce = Math.max(maxForce, singleSlideN * 1.1);
          handledByFront = true;
        } else if (lxShift > rightWallX && rightDepth > 0.004 && lxShift < (rightHalfW + piece.radius + 0.010) && lz >= frontPlateZ - 0.008 && lz <= rightTipZ + piece.radius) {
          const pushOut = (rightHalfW + piece.radius + 0.004) - lxShift;
          piece.x += c * pushOut; piece.z -= s * pushOut;
          maxForce = Math.max(maxForce, singleSlideN * 1.1);
          handledByFront = true;
        } else if (lz < frontPlateZ + piece.radius + 0.004 && lxShift >= -(leftHalfW + piece.radius * 0.75) && lxShift <= (rightHalfW + piece.radius * 0.75)) {
          const deltaZ = frontPlateZ + piece.radius + 0.004 - lz;
          piece.x += s * deltaZ; piece.z += c * deltaZ;
          maxForce = Math.max(maxForce, singleSlideN);
          handledByFront = true;
        }
      }

      // 自定义 CAD 收集件也参与棋子接触推动。它们按自己的局部 yaw 和底部高度形成一个可拼接的矩形接触面。
      if (!handledByFront && customCollectors.length) {
        for (const part of customCollectors) {
          if ((Number(part.y) || 0) > PIECE_HEIGHT + 0.018) continue;
          const partYaw = ((Number(part.yaw) || 0) * Math.PI) / 180;
          const relX = lx - (Number(part.x) || 0), relZ = lz - (Number(part.z) || 0);
          const pc = Math.cos(partYaw), ps = Math.sin(partYaw);
          const partX = relX * pc + relZ * ps, partZ = -relX * ps + relZ * pc;
          const halfW = Math.max(0.006, (Number(part.width) || 0.08) * 0.5);
          const halfL = Math.max(0.006, (Number(part.length) || 0.08) * 0.5);
          if (Math.abs(partX) > halfW + piece.radius || partZ < -halfL - piece.radius || partZ > halfL + piece.radius) continue;
          const pushDepth = Math.max(0, halfL + piece.radius - partZ);
          const dirLx = Math.sin(partYaw), dirLz = Math.cos(partYaw);
          const worldDirX = c * dirLx + s * dirLz, worldDirZ = -s * dirLx + c * dirLz;
          if (pushDepth > 0) {
            const correction = Math.min(0.08, pushDepth + 0.002);
            piece.x += worldDirX * correction;
            piece.z += worldDirZ * correction;
          }
          const pieceForwardV = piece.vx * worldDirX + piece.vz * worldDirZ;
          const desiredForwardV = Math.max(robot.speed * build.pushGain * 0.88, pieceForwardV);
          const addV = Math.max(0, desiredForwardV - pieceForwardV);
          piece.vx += worldDirX * addV;
          piece.vz += worldDirZ * addV;
          const fN = singleSlideN + (phys.pieceMassKg * addV) / Math.max(0.005, subDt) * 0.36;
          pushedCount += 1;
          maxForce = Math.max(maxForce, fN);
          forceVecX += worldDirX * fN; forceVecZ += worldDirZ * fN;
          yawTorque -= (partX + (Number(part.x) || 0)) * fN * 0.16;
          handledByFront = true;
          break;
        }
      }

      if (!handledByFront && bodyHitsPiece) {
        const boundX = halfBodyW + piece.radius, boundZ = halfBodyL + piece.radius;
        if (Math.abs(lx) < boundX && Math.abs(lz) < boundZ) {
          // 物理前切角倒角判定：大前切角可顺滑导开角部碰撞的棋子
          const cxStart = halfBodyW - chamfer, czStart = halfBodyL - chamfer;
          if (chamfer > 0.005 && Math.abs(lx) > cxStart && lz > czStart) {
            const ov = (Math.abs(lx) - cxStart) + (lz - czStart) - (chamfer + piece.radius * 1.38);
            if (ov < 0) {
              const penC = -ov * 0.52, dirX = lx >= 0 ? 1 : -1;
              const nxL = dirX * 0.7071, nzL = 0.7071;
              const wxN = c * nxL + s * nzL, wzN = -s * nxL + c * nzL;
              piece.x += wxN * penC; piece.z += wzN * penC;
              piece.vx += wxN * 0.25 + worldVx * 0.45; piece.vz += wzN * 0.25 + worldVz * 0.45;
              maxForce = Math.max(maxForce, 0.9);
            }
          } else {
            const penX = boundX - Math.abs(lx), penZ = boundZ - Math.abs(lz);
            if (penX < penZ) {
              const dir = lx >= 0 ? 1 : -1;
              piece.x += c * dir * penX; piece.z -= s * dir * penX;
              piece.vx += c * dir * 0.25 + worldVx * 0.45; piece.vz += -s * dir * 0.25 + worldVz * 0.45;
            } else {
              const dir = lz >= 0 ? 1 : -1;
              piece.x += s * dir * penZ; piece.z += c * dir * penZ;
              piece.vx += s * dir * 0.25 + worldVx * 0.55; piece.vz += c * dir * 0.25 + worldVz * 0.55;
            }
            maxForce = Math.max(maxForce, 1.1);
          }
        }
      }

      if (applyPosAndFriction) {
        piece.x += piece.vx * subDt; piece.z += piece.vz * subDt;
        const wallRest = phys.restitution * 0.85;
        if (piece.x < piece.radius) { piece.x = piece.radius; piece.vx = Math.abs(piece.vx) * wallRest; }
        if (piece.x > FIELD.width - piece.radius) { piece.x = FIELD.width - piece.radius; piece.vx = -Math.abs(piece.vx) * wallRest; }
        if (piece.z < piece.radius) { piece.z = piece.radius; piece.vz = Math.abs(piece.vz) * wallRest; }
        if (piece.z > FIELD.depth - piece.radius) { piece.z = FIELD.depth - piece.radius; piece.vz = -Math.abs(piece.vz) * wallRest; }
      }
    }
    const totalPushN = Math.max(maxForce, pushedCount * singleSlideN);
    return { maxForce: totalPushN, pushedCount, forceVecX, forceVecZ, yawTorque };
  }

  function separateRobots(rA, bA, rB, bB) {
    const radA = Math.hypot(bA.width, bA.length) * 0.44, radB = Math.hypot(bB.width, bB.length) * 0.44;
    const minD = radA + radB;
    const dx = rB.x - rA.x, dz = rB.z - rA.z, d = Math.hypot(dx, dz) || 0.001;
    if (d < minD) {
      const overlap = (minD - d) * 0.5, nx = dx / d, nz = dz / d;
      rA.x -= nx * overlap; rA.z -= nz * overlap;
      rB.x += nx * overlap; rB.z += nz * overlap;
      rA.speed *= 0.65; rB.speed *= 0.65;
      enforceRobotArenaBounds(rA, bA);
      enforceRobotArenaBounds(rB, bB);
      return true;
    }
    return false;
  }

  function enforceRobotArenaBounds(robot, build) {
    const c = Math.cos(robot.yaw), s = Math.sin(robot.yaw);
    const hw = Math.max(build.width, build.frontTrack || build.track, build.rearTrack || build.track) / 2;
    const hlBack = Math.max(build.length / 2, (build.rearWheelRadius || 0.03) - (build.wheelOffsetZ || 0) + (build.wheelbase || 0.16) / 2);
    const frontPlateZ = build.length / 2 + build.deviceOffset;
    const devX = build.deviceMountX || 0;
    const lTipX = devX - build.deviceWidth / 2 - (build.leftWingDepth || 0) * Math.sin(((build.leftWingSplay || 0) * Math.PI) / 180);
    const rTipX = devX + build.deviceWidth / 2 + (build.rightWingDepth || 0) * Math.sin(((build.rightWingSplay || 0) * Math.PI) / 180);
    const lTipZ = frontPlateZ + (build.leftTipForward ?? build.wingTipForward) * 0.7;
    const rTipZ = frontPlateZ + (build.rightTipForward ?? build.wingTipForward) * 0.7;
    const corners = [[-hw, -hlBack], [hw, -hlBack], [-hw, build.length / 2], [hw, build.length / 2], [lTipX, lTipZ], [rTipX, rTipZ]];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < corners.length; i += 1) {
      const lx = corners[i][0], lz = corners[i][1];
      const wx = robot.x + lx * c + lz * s, wz = robot.z - lx * s + lz * c;
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
      if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
    }
    let wallHit = false;
    if (minX < 0) { robot.x += -minX; wallHit = true; }
    if (maxX > FIELD.width) { robot.x -= (maxX - FIELD.width); wallHit = true; }
    if (minZ < 0) { robot.z += -minZ; wallHit = true; }
    if (maxZ > FIELD.depth) { robot.z -= (maxZ - FIELD.depth); wallHit = true; }
    if (wallHit) robot.speed *= 0.65;
    return wallHit;
  }

  function stepSimulation(sim, rawDt, controlInputOrFn, isCodeMode = true) {
    const dt = Math.min(rawDt, 0.04);
    if (dt <= 0) return null;

    updateOnboardPerception(sim);

    const { build, robot } = sim;
    const phys = sim.physics || defaultPhysicsConfig();
    sim.friction = phys.friction;
    let cmd = { ...sim.lastCmd }, runtimeError = null;

    if (isCodeMode && typeof controlInputOrFn === "function") {
      const ctrlPeriod = 1 / Math.max(10, build.controlHz || 50);
      sim.controlTimer += dt;
      if (sim.controlTimer >= ctrlPeriod || sim.time === 0) {
        sim.controlTimer = sim.controlTimer >= ctrlPeriod ? (sim.controlTimer % ctrlPeriod) : 0;
        try {
          const out = controlInputOrFn(buildStrategyContext(sim, dt));
          if (out && typeof out === "object") {
            cmd = {
              throttle: clamp(Number(out.throttle) || 0, -1, 1),
              steer: clamp(Number(out.steer) || 0, -1, 1),
              strafe: clamp(Number(out.strafe) || 0, -1, 1),
            };
            sim.lastCmd = cmd;
            if (out.targetId !== undefined) sim.targetId = out.targetId;
            if (out.phase) sim.phase = String(out.phase);
            if (Array.isArray(out.waypoints)) sim.waypoints = out.waypoints;
          }
        } catch (err) {
          runtimeError = err; cmd = { throttle: 0, steer: 0, strafe: 0 }; sim.lastCmd = cmd; sim.phase = "CODE_ERROR";
        }
      }
    } else if (controlInputOrFn && typeof controlInputOrFn === "object") {
      cmd.throttle = clamp(Number(controlInputOrFn.throttle) || 0, -1, 1);
      cmd.steer = clamp(Number(controlInputOrFn.steer) || 0, -1, 1);
      cmd.strafe = clamp(Number(controlInputOrFn.strafe) || 0, -1, 1);
      sim.lastCmd = cmd;
      sim.phase = "MANUAL"; sim.waypoints = [];
    }

    const isMecanum = build.driveMode === "mecanum" || build.driveMode === "omni";
    const tractionMaxN = computeTractionLimitN(build, phys);
    sim.tractionMaxN = tractionMaxN;
    const slipAuthority = clamp(1 - sim.wheelSlip * 0.55, 0.35, 1.0);
    const gripRatio = clamp(phys.friction / 0.78, 0.42, 1.20);
    const effAccel = build.maxAccel * gripRatio * slipAuthority;
    const effOmega = build.maxOmega * clamp(0.60 + 0.40 * gripRatio, 0.60, 1.15);

    const prevSpeed = robot.speed;
    sim.lastCmdSpeed = cmd.throttle * build.maxSpeed;
    robot.speed = approach(robot.speed, sim.lastCmdSpeed, dt * effAccel);
    robot.strafeSpeed = approach(robot.strafeSpeed, isMecanum ? cmd.strafe * build.maxSpeed * 0.78 : 0, dt * effAccel);
    robot.omega = approach(robot.omega, cmd.steer * effOmega, dt * effOmega * 5.2);

    let enemyCmd = { throttle: 0, steer: 0, strafe: 0 };
    if (sim.matchMode === "versus" && sim.enemyRobot && sim.enemyBuild) {
      enemyCmd = decideEnemyRobot(sim);
      const eb = sim.enemyBuild, er = sim.enemyRobot;
      er.speed = approach(er.speed, enemyCmd.throttle * eb.maxSpeed, dt * eb.maxAccel);
      er.strafeSpeed = approach(er.strafeSpeed, (eb.driveMode === "mecanum" || eb.driveMode === "omni") ? enemyCmd.strafe * eb.maxSpeed * 0.78 : 0, dt * eb.maxAccel);
      er.omega = approach(er.omega, enemyCmd.steer * eb.maxOmega, dt * eb.maxOmega * 5.2);
    }

    const substeps = 2, subDt = dt / substeps;
    let stepForceN = 0, wallImpactN = 0, fvX = 0, fvZ = 0, pushedPieces = 0, torqueSum = 0;

    for (let sIdx = 0; sIdx < substeps; sIdx += 1) {
      robot.yaw = normaliseAngle(robot.yaw + robot.omega * subDt);
      const s = Math.sin(robot.yaw), c = Math.cos(robot.yaw);
      const worldVx = s * robot.speed + c * robot.strafeSpeed, worldVz = c * robot.speed - s * robot.strafeSpeed;
      robot.x += worldVx * subDt; robot.z += worldVz * subDt;
      if (enforceRobotArenaBounds(robot, build)) wallImpactN = Math.max(wallImpactN, build.totalMass * Math.abs(prevSpeed) * 4.5 + 1.2);

      if (sim.matchMode === "versus" && sim.enemyRobot && sim.enemyBuild) {
        const er = sim.enemyRobot, eb = sim.enemyBuild;
        er.yaw = normaliseAngle(er.yaw + er.omega * subDt);
        const es = Math.sin(er.yaw), ec = Math.cos(er.yaw);
        const eVx = es * er.speed + ec * er.strafeSpeed, eVz = ec * er.speed - es * er.strafeSpeed;
        er.x += eVx * subDt; er.z += eVz * subDt;
        enforceRobotArenaBounds(er, eb);
        const touching = separateRobots(robot, build, er, eb);
        if (touching && Math.abs(robot.speed) < 0.04 && Math.abs(er.speed) < 0.04) {
          sim.mutualStallTimer += subDt;
          if (sim.mutualStallTimer > 3.5) {
            sim.mutualStallTimer = 0;
            sim.resetCount += 1;
            robot.x = 0.15; robot.z = 1.85; robot.yaw = resolveStartYaw(sim.startYawPreset); robot.speed = 0; robot.omega = 0;
            er.x = 2.85; er.z = 0.15; er.yaw = Math.atan2(1.5 - 2.85, 1.0 - 0.15); er.speed = 0; er.omega = 0;
          }
        } else if (!touching) {
          sim.mutualStallTimer = Math.max(0, sim.mutualStallTimer - subDt * 2);
        }
        applyRobotPieceCollection(er, eb, sim.pieces, eVx, eVz, es, ec, subDt, false, phys);
      }

      const fRes = applyRobotPieceCollection(robot, build, sim.pieces, worldVx, worldVz, s, c, subDt, true, phys);
      const scrapeN = (build.deviceMountY ?? 0.002) <= 0.0005 && Math.abs(robot.speed) > 0.02 ? 0.85 * phys.friction : 0;
      if (scrapeN > 0) robot.speed *= Math.max(0.85, 1 - dt * 1.4);
      stepForceN = Math.max(stepForceN, fRes.maxForce + scrapeN, wallImpactN);
      pushedPieces = Math.max(pushedPieces, fRes.pushedCount);
      fvX = fRes.forceVecX; fvZ = fRes.forceVecZ;
      torqueSum += fRes.yawTorque;

      const minRange = PIECE_RADIUS * 2;
      const impK = 0.5 * (1 + phys.restitution);
      for (let i = 0; i < sim.pieces.length; i += 1) {
        const a = sim.pieces[i];
        for (let j = i + 1; j < sim.pieces.length; j += 1) {
          const b = sim.pieces[j];
          const dx = b.x - a.x, dz = b.z - a.z, distSq = dx * dx + dz * dz;
          if (distSq < minRange * minRange) {
            const dist = Math.sqrt(distSq) || 0.001, nx = dx / dist, nz = dz / dist, overlap = minRange - dist;
            a.x -= nx * overlap * 0.5; a.z -= nz * overlap * 0.5;
            b.x += nx * overlap * 0.5; b.z += nz * overlap * 0.5;
            const relV = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
            if (relV < 0) { const imp = relV * impK; a.vx += nx * imp; a.vz += nz * imp; b.vx -= nx * imp; b.vz -= nz * imp; }
          }
        }
      }

      for (let i = 0; i < sim.pieces.length; i += 1) {
        const p = sim.pieces[i];
        if (p.x < p.radius) p.x = p.radius; if (p.x > FIELD.width - p.radius) p.x = FIELD.width - p.radius;
        if (p.z < p.radius) p.z = p.radius; if (p.z > FIELD.depth - p.radius) p.z = FIELD.depth - p.radius;
      }
    }

    // 电机/离心需求载荷 vs 轮胎地面极限静摩擦牵引力 -> 真实打滑
    const rawCmdAccel = clamp(Math.abs(sim.lastCmdSpeed - prevSpeed) / dt, 0, build.maxAccel);
    const accelDemandN = build.totalMass * rawCmdAccel;
    const centripetalN = build.totalMass * Math.abs(robot.speed * robot.omega);
    const totalLoadN = stepForceN + accelDemandN * 0.65 + centripetalN * 0.45;
    sim.contactForce = +stepForceN.toFixed(2);
    sim.peakContactForce = Math.max(sim.peakContactForce, sim.contactForce);
    sim.forceVec = { x: fvX, z: fvZ };
    const loadRatio = totalLoadN / Math.max(1, tractionMaxN);
    sim.tractionPct = Math.round(clamp(loadRatio * 100, 0, 140));
    const newSlip = clamp((loadRatio - 0.88) * 1.65, 0, 0.85);
    sim.wheelSlip = newSlip;
    sim.peakSlip = Math.max(sim.peakSlip, newSlip);
    const isSlipping = newSlip > 0.10;
    if (isSlipping && !sim.wasSlipping) sim.slipEvents += 1;
    sim.wasSlipping = isSlipping;
    if (Math.abs(torqueSum) > 0.04) robot.omega = clamp(robot.omega + torqueSum * 0.004 * (1 / Math.max(0.4, phys.friction)), -build.maxOmega, build.maxOmega);

    const speedNorm = Math.hypot(robot.speed, robot.strafeSpeed);
    const watts = 4.2 + build.controlHz * 0.05 + speedNorm * (10.5 + stepForceN * 2.2) + Math.abs(robot.omega) * 1.4;
    sim.lastWatts = +watts.toFixed(1);
    sim.energyJ += watts * dt;

    let currentScore = 0, currentCount = 0, enemyScore = 0, enemyCount = 0;
    const eps = 0.0005;
    for (let i = 0; i < sim.pieces.length; i += 1) {
      const p = sim.pieces[i];
      if (Math.hypot(p.vx, p.vz) < 0.004) { p.vx = 0; p.vz = 0; }
      const insideRed = p.side === "red" && p.x - p.radius >= GOAL.minX - eps && p.x + p.radius <= GOAL.maxX + eps && p.z - p.radius >= GOAL.minZ - eps && p.z + p.radius <= GOAL.maxZ + eps;
      const insideBlue = p.side === "blue" && p.x - p.radius >= ENEMY_GOAL.minX - eps && p.x + p.radius <= ENEMY_GOAL.maxX + eps && p.z - p.radius >= ENEMY_GOAL.minZ - eps && p.z + p.radius <= ENEMY_GOAL.maxZ + eps;
      p.scored = insideRed || insideBlue;
      if (insideRed) { currentScore += p.value; currentCount += 1; }
      if (insideBlue) { enemyScore += p.value; enemyCount += 1; }
    }

    sim.time += dt;
    sim.score = currentScore;
    sim.collected = currentCount;
    sim.enemyScore = enemyScore;
    sim.enemyCollected = enemyCount;
    if (currentScore > sim.maxScoreReached) sim.maxScoreReached = currentScore;
    if (currentScore >= 30 && sim.scoreTime30 === null) sim.scoreTime30 = sim.time;
    if (currentScore >= 40 && sim.scoreTime40 === null) sim.scoreTime40 = sim.time;

    if (sim.recordSnapshots) {
      if (sim.time >= sim.nextHistT) {
        sim.nextHistT = sim.time + 0.15;
        sim.history.push({
          t: +sim.time.toFixed(2),
          v: +speedNorm.toFixed(3),
          vCmd: +Math.abs(sim.lastCmdSpeed).toFixed(3),
          forceN: sim.contactForce,
          tractionN: +tractionMaxN.toFixed(2),
          slip: +sim.wheelSlip.toFixed(2),
          watts: sim.lastWatts,
          score: currentScore,
          enemyScore,
        });
        if (sim.history.length > 820) sim.history.shift();
      }
      if (sim.time >= sim.nextSnapT) {
        sim.nextSnapT = sim.time + 0.25;
        sim.snapshots.push({
          t: +sim.time.toFixed(2),
          score: currentScore, collected: currentCount, enemyScore, enemyCollected: enemyCount,
          phase: sim.phase, targetId: sim.targetId,
          contactForce: sim.contactForce, tractionPct: sim.tractionPct, wheelSlip: sim.wheelSlip,
          energyJ: sim.energyJ, lastWatts: sim.lastWatts, forceVec: { ...sim.forceVec },
          robot: { ...robot },
          enemyRobot: sim.enemyRobot ? { ...sim.enemyRobot } : null,
          pieces: sim.pieces.map((p) => ({ id: p.id, side: p.side, symbol: p.symbol, value: p.value, radius: p.radius, x: +p.x.toFixed(4), z: +p.z.toFixed(4), scored: p.scored })),
        });
        if (sim.snapshots.length > 500) sim.snapshots.shift();
      }
    }

    updateOnboardPerception(sim);
    return runtimeError;
  }

  function runHeadlessMatch(build, strategyFn, strategyParams, options = {}) {
    const seed = options.seed ?? 42, duration = options.duration ?? MATCH_DURATION, layoutMode = options.layoutMode || "standard";
    const matchMode = options.matchMode || "solo", startYawPreset = options.startYawPreset || "center";
    const dt = 0.025, steps = Math.round(duration / dt);
    const sim = createSimulationState(build, seed, layoutMode, strategyParams, {
      matchMode, startYawPreset, physics: options.physics, recordSnapshots: false,
    });
    for (let stepIdx = 0; stepIdx < steps; stepIdx += 1) {
      const err = stepSimulation(sim, dt, strategyFn, true);
      if (err) return { score: 0, collected: 0, enemyScore: 0, time30: duration, time40: duration, finishTime: duration, peakForceN: 0, slipEvents: 0, energyJ: 0, error: err.message };
      if (sim.score >= 45 && sim.robot.x > 0.56) break;
    }
    return {
      score: sim.score, collected: sim.collected, enemyScore: sim.enemyScore,
      time30: sim.scoreTime30 ?? duration, time40: sim.scoreTime40 ?? duration,
      finishTime: sim.score >= 45 ? sim.time : duration,
      peakForceN: sim.peakContactForce, slipEvents: sim.slipEvents, energyJ: sim.energyJ, error: null,
    };
  }

  function evaluateCandidate(build, strategyFn, params, seeds, duration, layoutMode, matchMode = "solo", startYawPreset = "center", physics = null) {
    let totalScore = 0, totalEnemy = 0, totalTime30 = 0, totalFinish = 0, totalPieces = 0, wins = 0;
    for (let i = 0; i < seeds.length; i += 1) {
      const res = runHeadlessMatch(build, strategyFn, params, { seed: seeds[i], duration, layoutMode, matchMode, startYawPreset, physics });
      totalScore += res.score; totalEnemy += res.enemyScore; totalTime30 += res.time30; totalFinish += res.finishTime; totalPieces += res.collected;
      if (matchMode === "versus" && (res.score > res.enemyScore || (res.score === res.enemyScore && build.totalMass < 1.63))) wins += 1;
    }
    const n = Math.max(1, seeds.length), avgScore = totalScore / n, avgEnemy = totalEnemy / n, avgTime30 = totalTime30 / n, avgFinish = totalFinish / n, avgPieces = totalPieces / n;
    const vsBonus = matchMode === "versus" ? (avgScore - avgEnemy) * 32 + (wins / n) * 40 : 0;
    return { build, selection: build.selection, params, avgScore, avgEnemy, winRate: wins / n, avgTime30, avgFinish, avgPieces, fitness: avgScore * 100 + vsBonus - avgFinish * 0.45 - avgTime30 * 0.25 - build.totalMass * 2.2 };
  }

  function generateCadRefinements(topResults, currentParams, unrestricted = false) {
    const refined = [], seen = new Set();
    const bases = topResults.slice(0, Math.min(2, topResults.length));
    for (const item of bases) {
      const baseSel = item.selection;
      const devWidths = unrestricted ? [0.185, 0.235, 0.285] : [0.175, 0.210, 0.242];
      const wingDepths = unrestricted ? [0.025, 0.048, 0.072] : [0.024, 0.038, 0.052];
      const splayAngles = [8, 16, 26];
      const camHeights = [0.165, 0.220];
      const camPitches = [18, 24];
      for (const dw of devWidths) for (const wd of wingDepths) for (const sa of splayAngles) {
        const ch = camHeights[(Math.round(sa) / 8) % camHeights.length];
        const cp = camPitches[(Math.round(wd * 100) + 1) % camPitches.length];
        const sel = {
          ...baseSel,
          overrides: { ...(baseSel.overrides || {}), deviceWidth: dw, leftWingDepth: wd, rightWingDepth: wd, leftWingSplay: sa, rightWingSplay: sa, dividerCount: dw >= 0.20 ? 1 : 0, cameraHeight: ch, cameraPitch: cp },
        };
        const built = resolveBuild(sel);
        if (!unrestricted && !checkCompliance(built).ok) continue;
        const sig = `${sel.chassisId}-${sel.motorId}-${sel.wheelId}-${sel.deviceId}-${dw}-${wd}-${sa}-${ch}-${cp}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        refined.push({ sel, params: item.params || currentParams, stage: 3 });
        if (refined.length >= 18) return refined;
      }
    }
    return refined;
  }

  function generateCandidateConfigs(scope, currentBuildSel, currentParams, unrestricted = false) {
    const candidates = [], partCombos = [];
    if (scope === "params_only") {
      partCombos.push(currentBuildSel);
    } else if (scope === "full_cad") {
      partCombos.push(currentBuildSel);
      for (const ch of ["carbon_light", "omni_square"]) for (const dev of ["u_funnel", "active_roller", "multi_slot", "brush"]) {
        const sel = { ...currentBuildSel, chassisId: ch, motorId: "geared_360", wheelId: "mecanum_4wd", deviceId: dev, overrides: {} };
        if (unrestricted || checkCompliance(resolveBuild(sel)).ok) partCombos.push(sel);
      }
    } else {
      for (const chassisId of ["carbon_light", "alu_balanced", "omni_square"]) {
        for (const motorId of ["geared_360", "dc_520", "brushless_680"]) {
          for (const wheelId of ["rubber_diff", "mecanum_4wd", "wide_diff"]) {
            for (const deviceId of ["u_funnel", "active_roller", "multi_slot", "push_plate", "brush"]) {
              const sel = {
                chassisId, motorId, wheelId, deviceId,
                wingId: currentBuildSel?.wingId || "dual_brush_wing",
                cameraId: currentBuildSel?.cameraId || "cam_110_gs",
                sensorId: currentBuildSel?.sensorId || "cam_laser_imu",
                controllerId: currentBuildSel?.controllerId || "k230_stm32",
                batteryId: currentBuildSel?.batteryId || "3s_1500",
                safetyId: currentBuildSel?.safetyId || "standard_safety",
                overrides: {},
              };
              if (unrestricted || checkCompliance(resolveBuild(sel)).ok) partCombos.push(sel);
            }
          }
        }
      }
    }
    const paramPresets = scope === "parts_only" ? [currentParams] : [
      { ...currentParams, approachDist: 0.22, cruiseThrottle: 0.96, pushThrottle: 0.90, steerKp: 2.5, goalReleaseX: 0.34 },
      { ...currentParams, approachDist: 0.25, cruiseThrottle: 0.94, pushThrottle: 0.88, steerKp: 2.4, goalReleaseX: 0.34 },
      { ...currentParams, approachDist: 0.28, cruiseThrottle: 0.90, pushThrottle: 0.82, steerKp: 2.2, goalReleaseX: 0.32 },
      { ...currentParams, valueWeight: 3.2, distWeight: 2.6, approachDist: 0.24, cruiseThrottle: 0.98, pushThrottle: 0.92, steerKp: 2.7, goalReleaseX: 0.35 },
    ];
    if (scope === "joint" || scope === "full_cad") {
      for (const sel of partCombos) candidates.push({ sel, params: paramPresets[0], stage: 1 });
      return { candidates, partCombos, paramPresets };
    }
    for (const sel of partCombos) for (const params of paramPresets) candidates.push({ sel, params });
    return { candidates, partCombos, paramPresets };
  }

  function runOptimizationSync(options = {}) {
    const scope = options.scope || "joint", seedCount = options.seedCount || 3, duration = options.duration || 120;
    const layoutMode = options.layoutMode || "standard", matchMode = options.matchMode || "solo", startYawPreset = options.startYawPreset || "center";
    const currentBuildSel = options.currentBuildSel || defaultBuildSelection(), currentParams = options.currentParams || defaultStrategyParams();
    const strategyFn = options.strategyFn || compileStrategyCode(STRATEGY_TEMPLATES.optimal_funnel);
    const physics = options.physics || null, unrestricted = Boolean(options.unrestricted);
    const seeds = [101, 202, 303, 404, 505].slice(0, seedCount);
    const { candidates, paramPresets } = generateCandidateConfigs(scope, currentBuildSel, currentParams, unrestricted);
    const results = [];
    for (let i = 0; i < candidates.length; i += 1) results.push(evaluateCandidate(resolveBuild(candidates[i].sel), strategyFn, candidates[i].params, seeds, duration, layoutMode, matchMode, startYawPreset, physics));
    results.sort((a, b) => b.fitness - a.fitness);
    if ((scope === "joint" || scope === "full_cad") && results.length > 0) {
      const topHardware = results.slice(0, Math.min(5, results.length));
      for (const item of topHardware) for (let pIdx = 1; pIdx < paramPresets.length; pIdx += 1) results.push(evaluateCandidate(item.build, strategyFn, paramPresets[pIdx], seeds, duration, layoutMode, matchMode, startYawPreset, physics));
      results.sort((a, b) => b.fitness - a.fitness);
      const cadCandidates = generateCadRefinements(results, currentParams, unrestricted);
      for (const cadItem of cadCandidates) results.push(evaluateCandidate(resolveBuild(cadItem.sel), strategyFn, cadItem.params, seeds, duration, layoutMode, matchMode, startYawPreset, physics));
      results.sort((a, b) => b.fitness - a.fitness);
    }
    return results;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      PARTS_CATALOG, CHASSIS_MATERIALS, DEVICE_MATERIALS, STRATEGY_TEMPLATES, PHYSICS_PRESETS,
      CUSTOM_PART_TEMPLATES, makeCustomPart, getCustomSnapSlots, snapCustomPart,
      defaultBuildSelection, defaultStrategyParams, defaultPhysicsConfig, resolveBuild, checkCompliance,
      computeTractionLimitN, compileStrategyCode, createSimulationState, updateOnboardPerception, buildStrategyContext,
      stepSimulation, runHeadlessMatch, runOptimizationSync, generateCandidateConfigs, generateCadRefinements, evaluateCandidate,
    };
  }

  if (typeof document === "undefined") return;

  // =========================
  // 4. 10大完全独立子系统 Schema (Unrestricted Independent CAD & Assembly Studio)
  // =========================
  const MODULE_ORDER = [
    { key: "chassis", icon: "▣", title: "1. 底盘骨架", selKey: "chassisId", dictKey: "chassis" },
    { key: "motor", icon: "◉", title: "2. 驱动电机", selKey: "motorId", dictKey: "motor" },
    { key: "wheel", icon: "◌", title: "3. 轮组轴系", selKey: "wheelId", dictKey: "wheel" },
    { key: "device", icon: "↦", title: "4. 前端推斗", selKey: "deviceId", dictKey: "device" },
    { key: "wing", icon: "⟠", title: "5. 独立侧翼", selKey: "wingId", dictKey: "wing" },
    { key: "camera", icon: "◎", title: "6. 视觉相机", selKey: "cameraId", dictKey: "camera" },
    { key: "sensor", icon: "◈", title: "7. 激光对管", selKey: "sensorId", dictKey: "sensor" },
    { key: "controller", icon: "⌁", title: "8. 车载主控", selKey: "controllerId", dictKey: "controller" },
    { key: "battery", icon: "▰", title: "9. 电池配重", selKey: "batteryId", dictKey: "battery" },
    { key: "safety", icon: "⚠", title: "10. 急停安全", selKey: "safetyId", dictKey: "safety" },
    { key: "custom", icon: "✣", title: "11. 自定义 CAD 拼图件", selKey: null, dictKey: null },
  ];

  const MODULE_DESIGN_SCHEMA = {
    chassis: {
      summary: (b) => `${Math.round(b.length * 1000)}×${Math.round(b.width * 1000)}×${Math.round(b.height * 1000)}mm · ${CHASSIS_MATERIALS[b.chassisMaterial].name.split(" ")[0]}`,
      mass: (b) => b.chassisMass,
      materials: { key: "chassisMaterial", label: "板材与结构工艺", dict: CHASSIS_MATERIALS },
      topology: [
        { key: "frameStyle", label: "底盘装配构型", type: "select", options: [["dual_deck", "开放双层铝柱骨架 (透视内部组装)"], ["truss_frame", "轻量化十字桁架"], ["monocoque", "全包一体封闭箱体"]] },
      ],
      fields: [
        { key: "length", label: "底盘长度", type: "range", min: 80, max: 450, minAbs: 40, step: 2, scale: 0.001, unit: "mm" },
        { key: "width", label: "底盘宽度", type: "range", min: 80, max: 450, minAbs: 40, step: 2, scale: 0.001, unit: "mm" },
        { key: "height", label: "上下板层间距", type: "range", min: 20, max: 280, minAbs: 12, step: 2, scale: 0.001, unit: "mm" },
        { key: "groundClearance", label: "底板离地间隙", type: "range", min: 2, max: 90, minAbs: 1, step: 1, scale: 0.001, unit: "mm" },
        { key: "frontChamfer", label: "车头斜切倒角", type: "range", min: 0, max: 120, minAbs: 0, step: 1, scale: 0.001, unit: "mm" },
        { key: "chassisMass", label: "底盘结构质量", type: "range", min: 0.05, max: 3.00, minAbs: 0.01, step: 0.02, scale: 1, unit: "kg" },
      ],
    },
    motor: {
      summary: (b) => `${Math.round(b.rpm)}rpm · ${b.torque.toFixed(2)}N·m ×${b.motorCount}`,
      mass: (b) => b.motorMass,
      materials: null,
      topology: [],
      fields: [
        { key: "rpm", label: "额定转速 (不限)", type: "range", min: 50, max: 3000, minAbs: 10, step: 10, scale: 1, unit: "rpm" },
        { key: "torque", label: "单电机额定扭矩", type: "range", min: 0.02, max: 2.50, minAbs: 0.005, step: 0.02, scale: 1, unit: "N·m" },
        { key: "gear", label: "外接齿轮传动比", type: "range", min: 0.2, max: 5.0, minAbs: 0.05, step: 0.05, scale: 1, unit: "×" },
        { key: "motorCount", label: "独立电机数 (1~8)", type: "range", min: 1, max: 8, minAbs: 1, step: 1, scale: 1, unit: "个" },
        { key: "motorMountZ", label: "电机轴前后装配位", type: "range", min: -180, max: 180, minAbs: -1000, step: 2, scale: 0.001, unit: "mm" },
        { key: "motorMass", label: "电机组总质量", type: "range", min: 0.04, max: 2.00, minAbs: 0.01, step: 0.02, scale: 1, unit: "kg" },
      ],
    },
    wheel: {
      summary: (b) => `${b.driveMode} · 前Ø${Math.round(b.frontWheelRadius * 2000)}/后Ø${Math.round(b.rearWheelRadius * 2000)}mm`,
      mass: (b) => b.wheelMass,
      materials: null,
      topology: [{ key: "driveMode", label: "轮系驱动架构", type: "select", options: [["diff", "差速四驱/两驱"], ["mecanum", "麦克纳姆全向轮 (横移)"], ["omni", "全向轮 (全向平移)"], ["rwd_caster", "后驱独立大轮 + 前万向随动轮"]] }],
      fields: [
        { key: "frontWheelRadius", label: "前轮半径 (独立)", type: "range", min: 10, max: 90, minAbs: 6, step: 1, scale: 0.001, unit: "mm" },
        { key: "rearWheelRadius", label: "后轮半径 (独立)", type: "range", min: 10, max: 90, minAbs: 6, step: 1, scale: 0.001, unit: "mm" },
        { key: "frontTrack", label: "前轮距 Front Track", type: "range", min: 60, max: 420, minAbs: 20, step: 2, scale: 0.001, unit: "mm" },
        { key: "rearTrack", label: "后轮距 Rear Track", type: "range", min: 60, max: 420, minAbs: 20, step: 2, scale: 0.001, unit: "mm" },
        { key: "wheelWidth", label: "单轮轮宽", type: "range", min: 6, max: 60, minAbs: 4, step: 1, scale: 0.001, unit: "mm" },
        { key: "wheelbase", label: "前后轴距 Wheelbase", type: "range", min: 50, max: 400, minAbs: 20, step: 2, scale: 0.001, unit: "mm" },
        { key: "wheelOffsetZ", label: "轴系整体前后偏置", type: "range", min: -120, max: 120, minAbs: -1000, step: 2, scale: 0.001, unit: "mm" },
        { key: "grip", label: "轮胎摩擦抓地系数", type: "range", min: 0.20, max: 2.50, minAbs: 0.05, step: 0.02, scale: 1, unit: "μ" },
        { key: "wheelMass", label: "轮系总质量", type: "range", min: 0.03, max: 1.50, minAbs: 0.01, step: 0.02, scale: 1, unit: "kg" },
      ],
    },
    device: {
      summary: (b) => `${b.device.name.split(" ")[0]} · 宽${Math.round(b.deviceWidth * 1000)} 离地${Math.round(b.deviceMountY * 1000)}mm`,
      mass: (b) => b.deviceMass,
      materials: { key: "deviceMaterial", label: "推板主体材料", dict: DEVICE_MATERIALS },
      topology: [
        { key: "deviceKind", label: "推取机构类型", type: "select", options: [["u_funnel", "U型铝合金背板"], ["push_plate", "宽幅平板"], ["active_roller", "主动内旋滚轮斗"], ["multi_slot", "双槽分道主斗"], ["brush", "双排柔性毛刷"]] },
      ],
      fields: [
        { key: "deviceWidth", label: "背板根部宽度", type: "range", min: 40, max: 450, minAbs: 20, step: 2, scale: 0.001, unit: "mm" },
        { key: "deviceOffset", label: "前伸悬臂距离", type: "range", min: 2, max: 160, minAbs: 1, step: 1, scale: 0.001, unit: "mm" },
        { key: "deviceMountX", label: "推斗左右安装偏置", type: "range", min: -150, max: 150, minAbs: -500, step: 2, scale: 0.001, unit: "mm" },
        { key: "deviceMountY", label: "推斗底沿离地高度", type: "range", min: 0, max: 60, minAbs: 0, step: 1, scale: 0.001, unit: "mm" },
        { key: "deviceHeight", label: "推板档墙高度", type: "range", min: 10, max: 120, minAbs: 8, step: 1, scale: 0.001, unit: "mm" },
        { key: "retention", label: "防侧滑兜底系数", type: "range", min: 0.0, max: 1.2, minAbs: 0, step: 0.05, scale: 1, unit: "" },
        { key: "deviceMass", label: "主推斗质量", type: "range", min: 0.02, max: 1.00, minAbs: 0.01, step: 0.01, scale: 1, unit: "kg" },
      ],
    },
    wing: {
      summary: (b) => `左${Math.round(b.leftWingDepth * 1000)}(${Math.round(b.leftWingSplay)}°) / 右${Math.round(b.rightWingDepth * 1000)}(${Math.round(b.rightWingSplay)}°) · 口${Math.round(b.mouthWidth * 1000)}`,
      mass: (b) => b.wingMass,
      materials: null,
      topology: [
        { key: "dividerCount", label: "槽内分道隔板数量", type: "select", options: [["0", "0道 (整槽自由口)"], ["1", "1道 (对称双槽)"], ["2", "2道 (三槽导轨)"], ["3", "3道 (四槽精密道)"]], isNum: true },
      ],
      fields: [
        { key: "leftWingDepth", label: "左侧翼伸出长度 (独立)", type: "range", min: 0, max: 160, minAbs: 0, step: 1, scale: 0.001, unit: "mm" },
        { key: "leftWingSplay", label: "左侧翼外张角度 (独立)", type: "range", min: -45, max: 75, minAbs: -80, step: 1, scale: 1, unit: "°" },
        { key: "rightWingDepth", label: "右侧翼伸出长度 (独立)", type: "range", min: 0, max: 160, minAbs: 0, step: 1, scale: 0.001, unit: "mm" },
        { key: "rightWingSplay", label: "右侧翼外张角度 (独立)", type: "range", min: -45, max: 75, minAbs: -80, step: 1, scale: 1, unit: "°" },
        { key: "centering", label: "侧翼合拢引导强度", type: "range", min: 0.0, max: 2.0, minAbs: 0, step: 0.05, scale: 1, unit: "" },
        { key: "wingMass", label: "侧翼与隔板质量", type: "range", min: 0.00, max: 0.80, minAbs: 0, step: 0.01, scale: 1, unit: "kg" },
      ],
    },
    camera: {
      summary: (b) => `${Math.round(b.fov)}°FOV · 高${Math.round(b.cameraHeight * 1000)}mm · 俯仰${Math.round(b.cameraPitch)}°`,
      mass: (b) => b.cameraMass,
      materials: null,
      topology: [],
      fields: [
        { key: "fov", label: "水平视场角 FOV", type: "range", min: 20, max: 165, minAbs: 8, step: 2, scale: 1, unit: "°" },
        { key: "sensorRange", label: "视觉识别最远距", type: "range", min: 0.25, max: 4.50, minAbs: 0.08, step: 0.05, scale: 1, unit: "m" },
        { key: "cameraHeight", label: "云台支架高度 Y", type: "range", min: 30, max: 500, minAbs: 15, step: 2, scale: 0.001, unit: "mm" },
        { key: "cameraPitch", label: "俯仰倾角 Pitch", type: "range", min: -60, max: 75, minAbs: -85, step: 1, scale: 1, unit: "°" },
        { key: "cameraMountYaw", label: "云台偏航角 Yaw", type: "range", min: -180, max: 180, minAbs: -180, step: 2, scale: 1, unit: "°" },
        { key: "cameraMountX", label: "相机左右安装 X", type: "range", min: -180, max: 180, minAbs: -1000, step: 2, scale: 0.001, unit: "mm" },
        { key: "cameraMountZ", label: "相机前后安装 Z", type: "range", min: -180, max: 220, minAbs: -1000, step: 2, scale: 0.001, unit: "mm" },
        { key: "cameraMass", label: "相机与支架总重", type: "range", min: 0.01, max: 0.80, minAbs: 0.005, step: 0.01, scale: 1, unit: "kg" },
      ],
    },
    sensor: {
      summary: (b) => `${b.laserRays}路激光 · ${b.laserPowerMw.toFixed(2)}mW · ${b.hasPocketSensor ? "含对管" : "无对管"}`,
      mass: (b) => b.lidarMass,
      materials: null,
      topology: [
        { key: "hasPocketSensor", label: "推斗前端光电对管", type: "checkbox" },
      ],
      fields: [
        { key: "laserRays", label: "安全激光测距路数 (0~9)", type: "range", min: 0, max: 9, minAbs: 0, step: 1, scale: 1, unit: "路" },
        { key: "laserPowerMw", label: "激光发射功率 (无限制)", type: "range", min: 0.05, max: 5.0, minAbs: 0, step: 0.05, scale: 1, unit: "mW" },
        { key: "laserMountX", label: "激光云台左右 X", type: "range", min: -180, max: 180, minAbs: -1000, step: 2, scale: 0.001, unit: "mm" },
        { key: "laserMountY", label: "激光云台安装高 Y", type: "range", min: 20, max: 320, minAbs: 10, step: 2, scale: 0.001, unit: "mm" },
        { key: "laserMountZ", label: "激光云台前后 Z", type: "range", min: -180, max: 220, minAbs: -1000, step: 2, scale: 0.001, unit: "mm" },
        { key: "pocketSensorRange", label: "推斗对管探测深度", type: "range", min: 5, max: 120, minAbs: 2, step: 2, scale: 0.001, unit: "mm" },
        { key: "sensorNoise", label: "光学融合测距噪声", type: "range", min: 0.0, max: 0.050, minAbs: 0, step: 0.001, scale: 1, unit: "m" },
        { key: "lidarMass", label: "激光/IMU质量", type: "range", min: 0.01, max: 0.80, minAbs: 0.002, step: 0.01, scale: 1, unit: "kg" },
      ],
    },
    controller: {
      summary: (b) => `${b.controller.name.split(" ")[0]} · ${Math.round(b.controlHz)}Hz (${Math.round(b.ctrlMountX * 1000)},${Math.round(b.ctrlMountZ * 1000)})`,
      mass: (b) => b.controllerMass,
      materials: null,
      topology: [],
      fields: [
        { key: "controlHz", label: "视觉闭环频率 (不限)", type: "range", min: 5, max: 240, minAbs: 2, step: 5, scale: 1, unit: "Hz" },
        { key: "ctrlMountX", label: "主板左右位置 X", type: "range", min: -160, max: 160, minAbs: -1000, step: 2, scale: 0.001, unit: "mm" },
        { key: "ctrlMountY", label: "主板铜柱高度 Y", type: "range", min: 20, max: 280, minAbs: 5, step: 2, scale: 0.001, unit: "mm" },
        { key: "ctrlMountZ", label: "主板前后位置 Z", type: "range", min: -160, max: 160, minAbs: -1000, step: 2, scale: 0.001, unit: "mm" },
        { key: "ctrlYaw", label: "主板朝向旋转 Yaw", type: "range", min: -180, max: 180, minAbs: -180, step: 15, scale: 1, unit: "°" },
        { key: "controllerMass", label: "主控与散热质量", type: "range", min: 0.01, max: 0.80, minAbs: 0.005, step: 0.01, scale: 1, unit: "kg" },
      ],
    },
    battery: {
      summary: (b) => `${b.voltage.toFixed(1)}V ${b.capacity.toFixed(1)}Ah · 前后${b.frontAxlePct}:${b.rearAxlePct} 左右${b.leftAxlePct}:${b.rightAxlePct}`,
      mass: (b) => b.batteryMass,
      materials: null,
      topology: [],
      fields: [
        { key: "voltage", label: "电池电压 (不限)", type: "range", min: 3.7, max: 36.0, minAbs: 2.0, step: 0.1, scale: 1, unit: "V" },
        { key: "capacity", label: "电池容量", type: "range", min: 0.4, max: 15.0, minAbs: 0.05, step: 0.1, scale: 1, unit: "Ah" },
        { key: "battMountX", label: "电池左右配重 X", type: "range", min: -160, max: 160, minAbs: -1000, step: 2, scale: 0.001, unit: "mm" },
        { key: "battMountY", label: "电池托盘高度 Y", type: "range", min: 15, max: 280, minAbs: 5, step: 2, scale: 0.001, unit: "mm" },
        { key: "cgOffsetZ", label: "电池前后配重 Z", type: "range", min: -180, max: 180, minAbs: -1000, step: 2, scale: 0.001, unit: "mm" },
        { key: "battYaw", label: "电池摆放旋转 Yaw", type: "range", min: -180, max: 180, minAbs: -180, step: 15, scale: 1, unit: "°" },
        { key: "batteryMass", label: "电池质量", type: "range", min: 0.02, max: 2.00, minAbs: 0.005, step: 0.01, scale: 1, unit: "kg" },
      ],
    },
    safety: {
      summary: (b) => `${b.eStopType} · ${b.teamName}`,
      mass: (b) => b.safetyMass,
      materials: null,
      topology: [{ key: "eStopType", label: "机械急停按钮规格", type: "select", options: [["蘑菇头急停", "工业蘑菇头急停 (醒目)"], ["拨动急停", "轻量化拨动开关"]] }],
      fields: [
        { key: "eStopMountX", label: "急停开关左右 X", type: "range", min: -160, max: 160, minAbs: -1000, step: 2, scale: 0.001, unit: "mm" },
        { key: "eStopMountZ", label: "急停开关前后 Z", type: "range", min: -160, max: 160, minAbs: -1000, step: 2, scale: 0.001, unit: "mm" },
        { key: "teamName", label: "车身队伍标识", type: "text" },
        { key: "safetyMass", label: "安全组件总重", type: "range", min: 0.01, max: 0.50, minAbs: 0.002, step: 0.01, scale: 1, unit: "kg" },
      ],
    },
    custom: {
      summary: () => `${game.customParts.length} 件 · ${customPartMassKg(game.customParts).toFixed(2)}kg · ${game.customParts.filter((part) => part.connected).length} 个已吸附`,
      mass: () => customPartMassKg(game.customParts),
      materials: null,
      topology: [],
      fields: [],
    },
  };

  // =========================
  // 5. WebGL 渲染引擎 (上帝3D视角 + 黑体红白字国赛象棋)
  // =========================
  const $ = (id) => document.getElementById(id);
  const fmt = (value, digits = 2) => Number.isFinite(value) ? Number(value).toFixed(digits) : "0.00";
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function scale3(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function len3(a) { return Math.hypot(a[0], a[1], a[2]); }
  function norm3(a) { const l = len3(a) || 1; return scale3(a, 1 / l); }
  function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

  function m4Identity() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
  function m4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col += 1) for (let row = 0; row < 4; row += 1)
      out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
    return out;
  }
  function m4Translation(x, y, z) { const out = m4Identity(); out[12] = x; out[13] = y; out[14] = z; return out; }
  function m4Scale(x, y, z) { const out = m4Identity(); out[0] = x; out[5] = y; out[10] = z; return out; }
  function m4RotateX(angle) { const c = Math.cos(angle), s = Math.sin(angle); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); }
  function m4RotateY(angle) { const c = Math.cos(angle), s = Math.sin(angle); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); }
  function m4RotateZ(angle) { const c = Math.cos(angle), s = Math.sin(angle); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
  function m4Perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2), range = near - far, out = new Float32Array(16);
    out[0] = f / aspect; out[5] = f; out[10] = (far + near) / range; out[11] = -1; out[14] = (2 * far * near) / range;
    return out;
  }
  function m4LookAt(eye, target, up) {
    const z = norm3(sub3(eye, target)), x = norm3(cross3(up, z)), y = cross3(z, x), out = m4Identity();
    out[0] = x[0]; out[4] = x[1]; out[8] = x[2]; out[12] = -dot3(x, eye);
    out[1] = y[0]; out[5] = y[1]; out[9] = y[2]; out[13] = -dot3(y, eye);
    out[2] = z[0]; out[6] = z[1]; out[10] = z[2]; out[14] = -dot3(z, eye);
    return out;
  }
  function m4Transform(m, p) {
    const x = p[0], y = p[1], z = p[2], w = p[3] ?? 1, divisor = m[3] * x + m[7] * y + m[11] * z + m[15] * w || 1;
    return [(m[0] * x + m[4] * y + m[8] * z + m[12] * w) / divisor, (m[1] * x + m[5] * y + m[9] * z + m[13] * w) / divisor, (m[2] * x + m[6] * y + m[10] * z + m[14] * w) / divisor];
  }
  function m4Invert(matrix) {
    const m = matrix, out = new Float32Array(16);
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7], a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return m4Identity();
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; out[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * det; out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; out[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * det;
    out[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * det; out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det; out[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * det; out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; out[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * det; out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; out[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * det;
    out[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * det; out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det; out[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * det; out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  }

  const canvas = $("gameCanvas");
  const gl = canvas?.getContext("webgl", { antialias: true, alpha: false, preserveDrawingBuffer: true });
  if (!gl) {
    if ($("sceneHint")) $("sceneHint").textContent = "当前浏览器未开启 WebGL，请使用现代浏览器";
    return;
  }

  const VERTEX_SHADER = `attribute vec3 aPosition; attribute vec3 aNormal; attribute vec2 aUv; uniform mat4 uMvp; uniform mat4 uModel; varying vec3 vNormal; varying vec2 vUv; void main(){ gl_Position=uMvp*vec4(aPosition,1.0); vNormal=mat3(uModel)*aNormal; vUv=aUv; }`;
  const FRAGMENT_SHADER = `precision mediump float; uniform vec3 uColor; uniform vec3 uLightDir; uniform sampler2D uTexture; uniform float uHasTexture; uniform float uAlpha; varying vec3 vNormal; varying vec2 vUv; void main(){ vec3 base=uColor; float diffuse=max(dot(normalize(vNormal),normalize(uLightDir)),0.0); if(uHasTexture>0.5){ vec4 tex=texture2D(uTexture,vUv); base*=tex.rgb; if(tex.a<0.05) discard; } vec3 lit=base*(0.62+0.52*diffuse); gl_FragColor=vec4(lit,uAlpha); }`;
  const LINE_VERTEX_SHADER = `attribute vec3 aPosition; uniform mat4 uMvp; void main(){ gl_Position=uMvp*vec4(aPosition,1.0); }`;
  const LINE_FRAGMENT_SHADER = `precision mediump float; uniform vec3 uColor; uniform float uAlpha; void main(){ gl_FragColor=vec4(uColor,uAlpha); }`;

  function compileShader(type, source) {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function createProgram(vertex, fragment) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vertex));
    gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    return prog;
  }

  const program = createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
  const lineProgram = createProgram(LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER);
  const locations = {
    position: gl.getAttribLocation(program, "aPosition"), normal: gl.getAttribLocation(program, "aNormal"), uv: gl.getAttribLocation(program, "aUv"),
    mvp: gl.getUniformLocation(program, "uMvp"), model: gl.getUniformLocation(program, "uModel"), color: gl.getUniformLocation(program, "uColor"),
    light: gl.getUniformLocation(program, "uLightDir"), texture: gl.getUniformLocation(program, "uTexture"), hasTexture: gl.getUniformLocation(program, "uHasTexture"), alpha: gl.getUniformLocation(program, "uAlpha"),
  };
  const lineLocations = {
    position: gl.getAttribLocation(lineProgram, "aPosition"), mvp: gl.getUniformLocation(lineProgram, "uMvp"),
    color: gl.getUniformLocation(lineProgram, "uColor"), alpha: gl.getUniformLocation(lineProgram, "uAlpha"),
  };

  function createMesh(positions, normals, uvs, mode = gl.TRIANGLES) {
    const mesh = { count: positions.length / 3, mode, position: gl.createBuffer(), normal: gl.createBuffer(), uv: gl.createBuffer() };
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
    return mesh;
  }
  function cubeMesh() {
    const positions = [], normals = [], uvs = [], corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const faceData = [
      [[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]], [[.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5]],
      [[-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5], [-.5, .5, -.5]], [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5]],
      [[-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5]], [[.5, -.5, .5], [.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5]],
    ];
    const faceNormals = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [-1, 0, 0], [1, 0, 0]];
    faceData.forEach((face, idx) => [0, 1, 2, 0, 2, 3].forEach((ci) => { positions.push(...face[ci]); normals.push(...faceNormals[idx]); uvs.push(...corners[ci]); }));
    return createMesh(positions, normals, uvs);
  }
  function cylinderMesh(segments = 24) {
    const positions = [], normals = [], uvs = [];
    const add = (p, n, uv) => { positions.push(...p); normals.push(...n); uvs.push(...uv); };
    for (let i = 0; i < segments; i += 1) {
      const a = (i * Math.PI * 2) / segments, b = ((i + 1) * Math.PI * 2) / segments;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      add([ca, -.5, sa], [ca, 0, sa], [i / segments, 0]); add([cb, .5, sb], [cb, 0, sb], [(i + 1) / segments, 1]); add([cb, -.5, sb], [cb, 0, sb], [(i + 1) / segments, 0]);
      add([ca, -.5, sa], [ca, 0, sa], [i / segments, 0]); add([ca, .5, sa], [ca, 0, sa], [i / segments, 1]); add([cb, .5, sb], [cb, 0, sb], [(i + 1) / segments, 1]);
      add([0, .5, 0], [0, 1, 0], [.5, .5]); add([cb, .5, sb], [0, 1, 0], [.5 + cb / 2, .5 + sb / 2]); add([ca, .5, sa], [0, 1, 0], [.5 + ca / 2, .5 + sa / 2]);
      add([0, -.5, 0], [0, -1, 0], [.5, .5]); add([ca, -.5, sa], [0, -1, 0], [.5 + ca / 2, .5 + sa / 2]); add([cb, -.5, sb], [0, -1, 0], [.5 + cb / 2, .5 + sb / 2]);
    }
    return createMesh(positions, normals, uvs);
  }
  function planeMesh() {
    return createMesh([-.5, 0, -.5, -.5, 0, .5, .5, 0, .5, -.5, 0, -.5, .5, 0, .5, .5, 0, -.5], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0]);
  }

  const meshes = { cube: cubeMesh(), cylinder: cylinderMesh(), plane: planeMesh() };
  const lineState = { position: gl.createBuffer(), count: 0 };
  const coneState = { position: gl.createBuffer(), normal: gl.createBuffer(), uv: gl.createBuffer() };
  const textureCache = new Map();

  // 国赛标准黑体棋子贴图：黑底 + 甲队红字 / 乙队白字
  function createPieceTexture(piece) {
    const key = `black-${piece.side}-${piece.symbol}`;
    if (textureCache.has(key)) return textureCache.get(key);
    const bitmap = document.createElement("canvas");
    bitmap.width = 128; bitmap.height = 128;
    const ctx = bitmap.getContext("2d");
    const isRed = piece.side === "red";
    const accent = isRed ? "#ff4252" : "#ffffff";
    const ringGlow = isRed ? "rgba(255, 66, 82, 0.85)" : "rgba(255, 255, 255, 0.88)";

    const grad = ctx.createRadialGradient(46, 40, 8, 66, 70, 74);
    grad.addColorStop(0, "#2c313a");
    grad.addColorStop(0.75, "#14161a");
    grad.addColorStop(1, "#090a0d");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(64, 64, 59, 0, Math.PI * 2); ctx.fill();

    ctx.lineWidth = 6; ctx.strokeStyle = ringGlow;
    ctx.beginPath(); ctx.arc(64, 64, 50, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.8; ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath(); ctx.arc(64, 64, 43, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = accent;
    ctx.font = "700 64px 'Microsoft YaHei', KaiTi, serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(piece.symbol, 64, 67);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    textureCache.set(key, texture);
    return texture;
  }

  function drawMesh(mesh, model, color, texture = null, alpha = 1) {
    gl.useProgram(program);
    const vp = game.viewProjection || m4Identity();
    gl.uniformMatrix4fv(locations.mvp, false, m4Multiply(vp, model));
    gl.uniformMatrix4fv(locations.model, false, model);
    gl.uniform3fv(locations.color, color);
    gl.uniform3fv(locations.light, [-0.28, 0.92, 0.36]);
    gl.uniform1f(locations.alpha, alpha);
    gl.uniform1f(locations.hasTexture, texture ? 1 : 0);
    if (texture) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture); gl.uniform1i(locations.texture, 0); }
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position); gl.enableVertexAttribArray(locations.position); gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal); gl.enableVertexAttribArray(locations.normal); gl.vertexAttribPointer(locations.normal, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv); gl.enableVertexAttribArray(locations.uv); gl.vertexAttribPointer(locations.uv, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(mesh.mode, 0, mesh.count);
  }

  function drawLines(points, color, alpha = 1, mode = gl.LINE_STRIP) {
    if (points.length < 2) return;
    const values = [];
    for (let i = 0; i < points.length; i += 1) values.push(points[i][0], points[i][1], points[i][2]);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineState.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.DYNAMIC_DRAW);
    lineState.count = points.length;
    gl.useProgram(lineProgram);
    gl.uniformMatrix4fv(lineLocations.mvp, false, game.viewProjection);
    gl.uniform3fv(lineLocations.color, color);
    gl.uniform1f(lineLocations.alpha, alpha);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineState.position);
    gl.enableVertexAttribArray(lineLocations.position);
    gl.vertexAttribPointer(lineLocations.position, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(mode, 0, lineState.count);
  }

  function modelAt(base, x, y, z, scale, rotation = null) {
    let model = m4Multiply(base, m4Translation(x, y, z));
    if (rotation) model = m4Multiply(model, rotation);
    return m4Multiply(model, m4Scale(scale[0], scale[1], scale[2]));
  }

  // =========================
  // 6. 应用主状态
  // =========================
  const game = {
    running: false,
    speedMultiplier: 1,
    lastFrame: 0,
    seedCounter: 42,
    layoutMode: "standard",
    matchMode: "solo",
    startYawPreset: "center",
    controlMode: "code",
    manualControls: { throttle: 0, steer: 0, strafe: 0 },
    buildSelection: loadSavedBuildSelection(),
    build: null,
    customParts: loadSavedJsonList(CUSTOM_PARTS_KEY).map((part) => makeCustomPart(part)),
    cadMcpEndpoint: (() => { try { return localStorage.getItem(CUSTOM_MCP_ENDPOINT_KEY) || "http://127.0.0.1:8786/mcp"; } catch (_) { return "http://127.0.0.1:8786/mcp"; } })(),
    showCamOverlay: true,
    studio: {
      open: false,
      moduleKey: "device",
      view: "top", // "top" | "side" | "3d_iso" | "assembly" | "live_cam"
      handles: [],
      dragHandle: null,
      orbitYaw: 0.62,
      orbitPitch: 0.42,
      orbitDist: 0.72,
      orbiting: false,
      testPieces: [
        { id: "tp1", side: "red", symbol: "帅", x: 0.0, z: 0.16 },
        { id: "tp2", side: "blue", symbol: "车", x: 0.09, z: 0.23 },
      ],
      dragPiece: null,
      selectedCustomId: null,
    },
    strategyParams: defaultStrategyParams(),
    strategyFn: null,
    strategyError: null,
    sim: null,
    camera: { locked: true, yaw: 0, pitch: 1.30, distance: 3.15, target: [1.5, 0, 1.0] },
    pointer: null,
    viewProjection: null,
    externalDetections: null,
    cameraStream: null,
    captureBusy: false,
    optimizerRunning: false,
    optimizerAbort: false,
    optResults: [],
    bestOptResult: null,
    physicsEnv: defaultPhysicsConfig(),
    physicsPresetId: "standard",
    showPhysicsVectors: true,
    unrestrictedMode: true,
    replayIndex: null,
    experiments: loadSavedJsonList(STORAGE_EXPERIMENTS_KEY),
    selectedExpIds: [],
    researchNotes: loadSavedJsonList(STORAGE_NOTES_KEY),
  };
  globalThis.__xiangqiCustomParts = game.customParts;

  function escapeHtml(text) {
    return String(text ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
  }

  function loadSavedJsonList(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  }

  function saveJsonList(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (_) {}
  }

  function persistCustomParts() {
    globalThis.__xiangqiCustomParts = game.customParts;
    saveJsonList(CUSTOM_PARTS_KEY, game.customParts);
  }

  function selectedCustomPart() {
    return game.customParts.find((part) => part.id === game.studio.selectedCustomId) || game.customParts[0] || null;
  }

  function applyCustomPartsToBuild(targetBuild = game.build) {
    if (!targetBuild) return targetBuild;
    const extraMass = customPartMassKg(game.customParts);
    targetBuild.customPartMass = extraMass;
    targetBuild.totalMass += extraMass;
    targetBuild.inertiaZ += game.customParts.reduce((sum, part) => sum + (Number(part.massKg) || 0) * ((Number(part.x) || 0) ** 2 + (Number(part.z) || 0) ** 2), 0);
    const extents = game.customParts.reduce((acc, part) => {
      const halfW = Math.abs(Number(part.width) || 0) * 0.5;
      const halfL = Math.abs(Number(part.length) || 0) * 0.5;
      acc.minX = Math.min(acc.minX, (Number(part.x) || 0) - halfW);
      acc.maxX = Math.max(acc.maxX, (Number(part.x) || 0) + halfW);
      acc.minZ = Math.min(acc.minZ, (Number(part.z) || 0) - halfL);
      acc.maxZ = Math.max(acc.maxZ, (Number(part.z) || 0) + halfL);
      acc.maxY = Math.max(acc.maxY, (Number(part.y) || 0) + (Number(part.height) || 0));
      return acc;
    }, { minX: -targetBuild.width / 2, maxX: targetBuild.width / 2, minZ: -targetBuild.length / 2, maxZ: targetBuild.length / 2, maxY: targetBuild.envelopeHeight });
    targetBuild.envelopeWidth = Math.max(targetBuild.envelopeWidth, extents.maxX - extents.minX);
    targetBuild.envelopeLength = Math.max(targetBuild.envelopeLength, extents.maxZ - extents.minZ);
    targetBuild.envelopeHeight = Math.max(targetBuild.envelopeHeight, extents.maxY);
    return targetBuild;
  }

  function resolveBuildForCurrentCustomParts(selection) {
    return applyCustomPartsToBuild(resolveBuild(selection));
  }

  function updateCustomPartList() {
    const root = $("customPartList");
    if (!root) return;
    const selectedId = game.studio.selectedCustomId;
    if (!game.customParts.length) {
      root.innerHTML = '<div class="empty-state">还没有自定义件。选择模板后加入第一个拼图零件。</div>';
      return;
    }
    root.innerHTML = game.customParts.map((part, index) => `
      <div class="custom-part-row${part.id === selectedId ? " selected" : ""}" data-custom-select="${escapeHtml(part.id)}">
        <span class="custom-part-swatch" style="background:${escapeHtml(part.color)}"></span>
        <div class="custom-part-main"><strong>${escapeHtml(part.name)}</strong><small>${escapeHtml(CUSTOM_PART_TEMPLATES[part.template]?.label || part.template)} · ${part.role === "collector" ? "收集件" : part.role === "guard" ? "防护件" : "结构件"} · ${Math.round(part.width * 1000)}×${Math.round(part.length * 1000)}×${Math.round(part.height * 1000)}mm</small></div>
        <span class="custom-part-state">${part.connected ? `🔗 ${escapeHtml(part.slotId)}` : "自由"}</span>
        <button class="text-button" type="button" data-custom-action="snap" data-custom-id="${escapeHtml(part.id)}">吸附</button>
        <button class="text-button" type="button" data-custom-action="duplicate" data-custom-id="${escapeHtml(part.id)}">复制</button>
        <button class="text-button danger-text" type="button" data-custom-action="delete" data-custom-id="${escapeHtml(part.id)}">删除</button>
      </div>
    `).join("");
    root.querySelectorAll("[data-custom-select]").forEach((row) => row.addEventListener("click", () => {
      game.studio.selectedCustomId = row.dataset.customSelect;
      renderCustomPartEditor();
      drawStudioCad();
    }));
    root.querySelectorAll("[data-custom-action]").forEach((button) => button.addEventListener("click", (event) => {
      event.stopPropagation();
      const part = game.customParts.find((item) => item.id === button.dataset.customId);
      if (!part) return;
      if (button.dataset.customAction === "snap") {
        const slot = snapCustomPart(part, game.build);
        addLog(slot ? `拼图件「${part.name}」已吸附到${slot.label}` : `拼图件「${part.name}」附近没有可用标准接口`);
      } else if (button.dataset.customAction === "duplicate") {
        const copy = makeCustomPart({ ...part, id: undefined, name: `${part.name} · 复制`, x: part.x + 0.025, z: part.z + 0.025, connected: false, slotId: "" });
        game.customParts.push(copy);
        game.studio.selectedCustomId = copy.id;
      } else if (button.dataset.customAction === "delete") {
        game.customParts = game.customParts.filter((item) => item.id !== part.id);
        game.studio.selectedCustomId = game.customParts[0]?.id || null;
      }
      persistCustomParts();
      refreshBuildAndSyncSim();
      renderCustomPartEditor();
      drawStudioCad();
    }));
  }

  function renderCustomPartEditor() {
    const part = selectedCustomPart();
    if (part && !game.studio.selectedCustomId) game.studio.selectedCustomId = part.id;
    const setValue = (id, value) => { const el = $(id); if (el) el.value = value ?? ""; };
    setValue("customPartNameInput", part?.name || "");
    setValue("customPartWidth", part ? Math.round(part.width * 1000) : 120);
    setValue("customPartLength", part ? Math.round(part.length * 1000) : 180);
    setValue("customPartHeight", part ? Math.round(part.height * 1000) : 60);
    setValue("customPartThickness", part ? Math.round(part.thickness * 1000) : 6);
    setValue("customPartMass", part ? part.massKg : 0.08);
    setValue("customPartX", part ? Math.round(part.x * 1000) : 0);
    setValue("customPartY", part ? Math.round(part.y * 1000) : 115);
    setValue("customPartZ", part ? Math.round(part.z * 1000) : 0);
    setValue("customPartYaw", part ? Math.round(part.yaw) : 0);
    setValue("customPartColor", part?.color || CUSTOM_PART_TEMPLATES.plate.defaults.color);
    const templateSel = $("customCadTemplateSelect");
    if (templateSel) templateSel.value = part?.template || templateSel.value || "plate";
    const roleSel = $("customPartRole");
    if (roleSel) roleSel.value = part?.role || "structure";
    const slotSel = $("customSnapSlotSelect");
    if (slotSel) {
      slotSel.innerHTML = `<option value="">自由摆放（不吸附）</option>${getCustomSnapSlots(game.build).map((slot) => `<option value="${slot.id}">${slot.label}</option>`).join("")}`;
      slotSel.value = part?.slotId || "";
    }
    const lock = $("customPartLocked");
    if (lock) lock.checked = Boolean(part?.locked);
    updateCustomPartList();
    const status = $("customCadStatus");
    if (status) status.textContent = part ? `${part.name} · ${part.connected ? `已连接 ${part.slotId}` : "自由编辑"}` : "请选择或新建一个自定义件";
  }

  function readCustomPartForm() {
    const n = (id, fallback) => Number.isFinite(Number($(id)?.value)) ? Number($(id).value) : fallback;
    return {
      name: $("customPartNameInput")?.value?.trim() || "自定义 CAD 零件",
      template: $("customCadTemplateSelect")?.value || "plate",
      role: $("customPartRole")?.value || "structure",
      width: n("customPartWidth", 120) * 0.001,
      length: n("customPartLength", 180) * 0.001,
      height: n("customPartHeight", 60) * 0.001,
      thickness: n("customPartThickness", 6) * 0.001,
      massKg: Math.max(0, n("customPartMass", 0.08)),
      x: n("customPartX", 0) * 0.001,
      y: n("customPartY", 115) * 0.001,
      z: n("customPartZ", 0) * 0.001,
      yaw: n("customPartYaw", 0),
      color: $("customPartColor")?.value || "#2d9279",
      locked: Boolean($("customPartLocked")?.checked),
    };
  }

  function applyCustomPartForm() {
    const part = selectedCustomPart();
    if (!part) return;
    const next = readCustomPartForm();
    Object.assign(part, next);
    part.connected = false;
    part.slotId = "";
    persistCustomParts();
    refreshBuildAndSyncSim();
    renderCustomPartEditor();
    drawStudioCad();
  }

  function addCustomPartFromForm() {
    const next = makeCustomPart(readCustomPartForm());
    const selectedSlot = $("customSnapSlotSelect")?.value || "";
    game.customParts.push(next);
    game.studio.selectedCustomId = next.id;
    if (selectedSlot) snapCustomPart(next, game.build, selectedSlot);
    persistCustomParts();
    refreshBuildAndSyncSim();
    renderCustomPartEditor();
    drawStudioCad();
    addLog(`已加入自定义 CAD 拼图件「${next.name}」${next.connected ? `并吸附到 ${next.slotId}` : ""}`);
  }

  function resetCustomParts() {
    game.customParts = [];
    game.studio.selectedCustomId = null;
    persistCustomParts();
    refreshBuildAndSyncSim();
    renderCustomPartEditor();
    drawStudioCad();
  }

  function exportCustomPartLibrary(download = true) {
    const payload = { schemaVersion: 1, exportedAt: new Date().toISOString(), parts: game.customParts.map((part) => ({ ...part })), snapSlots: getCustomSnapSlots(game.build) };
    if (download && typeof Blob !== "undefined") {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "xiangqi_custom_cad_library.json"; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      addLog(`已导出自定义 CAD 库 (${game.customParts.length} 件)`);
    }
    return payload;
  }

  function importCustomPartLibrary(jsonText) {
    const parsed = typeof jsonText === "string" ? JSON.parse(jsonText) : jsonText;
    const parts = Array.isArray(parsed) ? parsed : parsed?.parts;
    if (!Array.isArray(parts)) throw new Error("CAD 库文件缺少 parts 数组");
    game.customParts = parts.map((part) => makeCustomPart(part));
    game.studio.selectedCustomId = game.customParts[0]?.id || null;
    persistCustomParts();
    refreshBuildAndSyncSim();
    renderCustomPartEditor();
    drawStudioCad();
    addLog(`已导入自定义 CAD 库 (${game.customParts.length} 件)`);
    return exportCustomPartLibrary(false);
  }

  function setCadMcpStatus(message, tone = "") {
    const status = $("cadMcpStatus");
    if (status) {
      status.textContent = message;
      status.dataset.tone = tone;
    }
  }

  async function callCadMcp(method, params = {}) {
    const endpoint = $("cadMcpEndpoint")?.value?.trim() || game.cadMcpEndpoint;
    game.cadMcpEndpoint = endpoint;
    try { localStorage.setItem(CUSTOM_MCP_ENDPOINT_KEY, endpoint); } catch (_) {}
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || "MCP 请求失败");
    return payload.result || payload;
  }

  function localCadPromptToPart(prompt) {
    const text = String(prompt || "").trim();
    const pick = (patterns, fallback) => {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return Number(match[1]);
      }
      return fallback;
    };
    let template = "block";
    if (/支架|相机|电机/.test(text)) template = "bracket";
    if (/漏斗|收集|导向|侧翼/.test(text)) template = "funnel";
    if (/连接|快拆|定位销|拼图/.test(text)) template = "connector";
    if (/板|底板|隔板/.test(text)) template = "plate";
    const defaults = CUSTOM_PART_TEMPLATES[template].defaults;
    return makeCustomPart({
      name: text.slice(0, 24) || CUSTOM_PART_TEMPLATES[template].label,
      template,
      role: /收集|推送|铲|漏斗/.test(text) ? "collector" : "structure",
      width: pick([/(?:宽|width)\s*[:：]?\s*(\d+(?:\.\d+)?)/i], defaults.width * 1000) * 0.001,
      length: pick([/(?:长|length|深)\s*[:：]?\s*(\d+(?:\.\d+)?)/i], defaults.length * 1000) * 0.001,
      height: pick([/(?:高|height)\s*[:：]?\s*(\d+(?:\.\d+)?)/i], defaults.height * 1000) * 0.001,
      thickness: pick([/(?:厚|thickness)\s*[:：]?\s*(\d+(?:\.\d+)?)/i], defaults.thickness * 1000) * 0.001,
      massKg: pick([/(?:质量|重量|mass)\s*[:：]?\s*(\d+(?:\.\d+)?)/i], defaults.massKg),
      connectors: /定位销|连接|快拆|拼图/.test(text) ? ["male", "female", "pin", "slot"] : ["male", "female"],
    });
  }

  function acceptCadMcpPart(data, sourceLabel = "MCP") {
    const candidate = data?.part || data?.template || data;
    if (!candidate || typeof candidate !== "object") throw new Error("MCP 未返回可用 CAD 零件");
    const part = makeCustomPart(candidate);
    game.customParts.push(part);
    game.studio.selectedCustomId = part.id;
    persistCustomParts();
    refreshBuildAndSyncSim();
    renderCustomPartEditor();
    drawStudioCad();
    addLog(`${sourceLabel} 已生成 CAD 拼图件「${part.name}」`);
    return part;
  }

  function bindCustomStudioControls() {
    const endpoint = $("cadMcpEndpoint");
    if (endpoint) endpoint.value = game.cadMcpEndpoint;
    $("customCadTemplateSelect")?.addEventListener("change", (event) => {
      const template = event.target.value;
      const defaults = CUSTOM_PART_TEMPLATES[template]?.defaults;
      if (!defaults) return;
      const writeMm = (id, value) => { const el = $(id); if (el) el.value = Math.round(value * 1000); };
      writeMm("customPartWidth", defaults.width); writeMm("customPartLength", defaults.length); writeMm("customPartHeight", defaults.height); writeMm("customPartThickness", defaults.thickness);
      if ($("customPartMass")) $("customPartMass").value = defaults.massKg;
      if ($("customPartColor")) $("customPartColor").value = defaults.color;
    });
    $("addCustomPartBtn")?.addEventListener("click", addCustomPartFromForm);
    $("applyCustomPartBtn")?.addEventListener("click", applyCustomPartForm);
    $("exportCustomPartsBtn")?.addEventListener("click", () => exportCustomPartLibrary(true));
    $("importCustomPartsBtn")?.addEventListener("click", () => $("customPartsImportFile")?.click());
    $("customPartsImportFile")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { importCustomPartLibrary(String(reader.result || "")); }
        catch (error) { setCadMcpStatus(`CAD 库导入失败：${error.message}`, "error"); }
        finally { event.target.value = ""; }
      };
      reader.readAsText(file);
    });
    $("customSnapSlotSelect")?.addEventListener("change", () => {
      const part = selectedCustomPart();
      if (!part) return;
      const selectedSlotId = $("customSnapSlotSelect").value;
      const slot = selectedSlotId ? snapCustomPart(part, game.build, selectedSlotId) : null;
      if (!selectedSlotId) { part.connected = false; part.slotId = ""; }
      persistCustomParts();
      refreshBuildAndSyncSim();
      renderCustomPartEditor();
      drawStudioCad();
      if (slot) addLog(`拼图件「${part.name}」已连接到${slot.label}`);
    });
    $("cadMcpConnectBtn")?.addEventListener("click", async () => {
      setCadMcpStatus("正在连接本地 MCP 桥接…");
      try {
        const result = await callCadMcp("initialize", { clientInfo: { name: "光赛一 CAD 工坊", version: "1.0" } });
        setCadMcpStatus(`MCP 已连接 · ${result.serverInfo?.name || "CAD Bridge"}`, "ok");
      } catch (error) {
        setCadMcpStatus(`连接失败：${error.message}`, "error");
      }
    });
    $("cadMcpToolsBtn")?.addEventListener("click", async () => {
      try {
        const result = await callCadMcp("tools/list");
        const names = (result.tools || []).map((tool) => tool.name).join("、");
        setCadMcpStatus(names ? `可用工具：${names}` : "MCP 未返回工具列表", names ? "ok" : "error");
      } catch (error) { setCadMcpStatus(`工具查询失败：${error.message}`, "error"); }
    });
    $("cadMcpGenerateBtn")?.addEventListener("click", async () => {
      const prompt = $("cadMcpPrompt")?.value?.trim();
      if (!prompt) { setCadMcpStatus("先输入零件描述，再生成 CAD 模板", "error"); return; }
      setCadMcpStatus("AI MCP 正在解析尺寸、结构与连接器…");
      try {
        const result = await callCadMcp("tools/call", { name: "cad.create_template", arguments: { prompt } });
        let data = result.structuredContent;
        if (!data && Array.isArray(result.content)) {
          const textBlock = result.content.find((item) => item.type === "text");
          if (textBlock) { try { data = JSON.parse(textBlock.text); } catch (_) {} }
        }
        const part = acceptCadMcpPart(data, "AI MCP");
        setCadMcpStatus(`已加入「${part.name}」· 可继续拖动或吸附到标准接口`, "ok");
      } catch (error) {
        const localPart = localCadPromptToPart(prompt);
        game.customParts.push(localPart);
        game.studio.selectedCustomId = localPart.id;
        persistCustomParts();
        refreshBuildAndSyncSim();
        renderCustomPartEditor();
        drawStudioCad();
        setCadMcpStatus(`MCP 暂不可用，已用本地参数解析生成「${localPart.name}」`, "fallback");
        addLog(`MCP 连接失败，已使用本地 CAD 模板解析：${error.message}`);
      }
    });
  }

  function loadSavedBuildSelection() {
    try {
      const raw = localStorage.getItem(STORAGE_BUILD_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.chassisId && PARTS_CATALOG.chassis[parsed.chassisId]) {
          return { ...defaultBuildSelection(), ...parsed, overrides: parsed.overrides || {} };
        }
      }
    } catch (_) {}
    return defaultBuildSelection();
  }

  function saveBuildSelection() {
    try {
      localStorage.setItem(STORAGE_BUILD_KEY, JSON.stringify({
        ...game.buildSelection,
        resolved: {
          lengthMm: Math.round(game.build.length * 1000), widthMm: Math.round(game.build.width * 1000), heightMm: Math.round(game.build.height * 1000),
          massKg: game.build.totalMass, deviceKind: game.build.deviceKind,
          deviceWidthMm: Math.round(game.build.deviceWidth * 1000), deviceOffsetMm: Math.round(game.build.deviceOffset * 1000),
          wingDepthMm: Math.round(game.build.wingDepth * 1000), driveMode: game.build.driveMode,
          rpm: game.build.rpm, torque: game.build.torque, gear: game.build.gear,
          wheelRadiusMm: Math.round(game.build.wheelRadius * 1000), trackMm: Math.round(game.build.track * 1000), wheelbaseMm: Math.round(game.build.wheelbase * 1000),
        },
      }));
    } catch (_) {}
  }

  function refreshBuildAndSyncSim() {
    game.build = resolveBuild(game.buildSelection);
    applyCustomPartsToBuild();
    if (game.sim) {
      game.sim.build = game.build;
      game.sim.tractionMaxN = computeTractionLimitN(game.build, game.sim.physics);
      updateOnboardPerception(game.sim);
    }
    saveBuildSelection();
    updatePartsReadouts();
    renderModuleCardsGrid();
    if (game.studio.open) {
      updateStudioTelemetryStrip();
      updateStudioDiagnostics();
      if (game.studio.moduleKey === "custom") renderCustomPartEditor();
      drawStudioCad(Boolean(game.sim));
    }
    if (game.sim) drawCameraView();
  }

  function addLog(message) {
    const root = $("eventLog");
    if (!root) return;
    const t = game.sim ? game.sim.time : 0;
    const stamp = `${String(Math.floor(t / 60)).padStart(2, "0")}:${fmt(t % 60, 1).padStart(4, "0")}`;
    const entry = document.createElement("div");
    entry.innerHTML = `<time>${stamp}</time><span>${escapeHtml(message)}</span>`;
    root.prepend(entry);
    while (root.children.length > 14) root.lastElementChild.remove();
  }

  function getRenderSimState() {
    const sim = game.sim;
    if (!sim) return null;
    if (game.replayIndex == null || !Array.isArray(sim.snapshots) || !sim.snapshots.length) return sim;
    const idx = clamp(Math.round(game.replayIndex), 0, sim.snapshots.length - 1);
    const snap = sim.snapshots[idx];
    if (!snap) return sim;
    return {
      ...sim,
      time: snap.t,
      score: snap.score,
      collected: snap.collected,
      enemyScore: snap.enemyScore,
      enemyCollected: snap.enemyCollected,
      phase: snap.phase,
      targetId: snap.targetId,
      contactForce: snap.contactForce,
      tractionPct: snap.tractionPct,
      wheelSlip: snap.wheelSlip,
      energyJ: snap.energyJ,
      lastWatts: snap.lastWatts,
      forceVec: snap.forceVec || sim.forceVec,
      robot: snap.robot,
      enemyRobot: snap.enemyRobot,
      pieces: snap.pieces,
      isReplay: true,
    };
  }

  function resetScene(message = null) {
    game.seedCounter = (game.seedCounter + 17) % 10000;
    game.replayIndex = null;
    game.sim = createSimulationState(game.build, game.seedCounter, game.layoutMode, game.strategyParams, {
      matchMode: game.matchMode, startYawPreset: game.startYawPreset, physics: { ...game.physicsEnv }, recordSnapshots: true,
    });
    const modeLabel = game.matchMode === "versus" ? "甲红 vs 乙白双车同场对抗" : "单车纯视觉清场";
    addLog(message || `赛场已重置 [${modeLabel}]，黑体红白字象棋布置完成`);
    updateHud();
    drawCameraView();
  }

  // =========================
  // 7. 第一人称真实 3D 车载摄像头投影渲染
  // =========================
  function clipPolyNear(camPts, near = 0.04) {
    if (!camPts.length) return [];
    const out = [];
    for (let i = 0; i < camPts.length; i += 1) {
      const curr = camPts[i], prev = camPts[(i + camPts.length - 1) % camPts.length];
      const currIn = curr[2] <= -near, prevIn = prev[2] <= -near;
      if (currIn !== prevIn) {
        const t = (-near - prev[2]) / (curr[2] - prev[2] || 1e-6);
        out.push([prev[0] + (curr[0] - prev[0]) * t, prev[1] + (curr[1] - prev[1]) * t, -near]);
      }
      if (currIn) out.push(curr);
    }
    return out;
  }

  function drawFirstPersonSceneToRect(targetCanvas, dstX, dstY, dstW, dstH, opts = {}) {
    const sim = getRenderSimState();
    if (!targetCanvas || !sim || dstW < 8 || dstH < 8) return;
    if (canvas.width <= 1 || canvas.height <= 1) resizeCanvas();
    if (!game.viewProjection) updateCameraMatrices();

    const b = game.build, r = sim.robot;
    const sR = Math.sin(r.yaw), cR = Math.cos(r.yaw);
    const camX = r.x + cR * b.cameraMountX + sR * b.cameraMountZ;
    const camY = b.cameraHeight;
    const camZ = r.z - sR * b.cameraMountX + cR * b.cameraMountZ;
    const camYaw = normaliseAngle(r.yaw + (b.cameraMountYaw * Math.PI) / 180);
    const pitchRad = (b.cameraPitch * Math.PI) / 180;

    const horizFwd = Math.cos(pitchRad), vertDown = -Math.sin(pitchRad);
    const fwd = [Math.sin(camYaw) * horizFwd, vertDown, Math.cos(camYaw) * horizFwd];
    const eye = [camX, camY, camZ];
    const camView = m4LookAt(eye, add3(eye, fwd), [0, 1, 0]);

    const fovX = (b.fov * Math.PI) / 180;
    const tanHalfX = Math.tan(fovX / 2);
    const aspect = dstW / Math.max(1, dstH);
    const tanHalfY = tanHalfX / aspect;
    const fovY = clamp(2 * Math.atan(tanHalfY), 0.25, 2.55);
    const camVP = m4Multiply(m4Perspective(fovY, aspect, 0.018, 9.0), camView);

    const prevVP = game.viewProjection;
    game.viewProjection = camVP;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.80, 0.87, 0.90, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawMesh(meshes.cube, m4Multiply(m4Translation(1.5, -0.092, 1.0), m4Scale(9.0, 0.02, 8.0)), [0.74, 0.80, 0.79]);
    drawField(true);
    drawPieces(true);
    drawRobot(true);

    const ctx = targetCanvas.getContext("2d");
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, dstX, dstY, dstW, dstH);

    game.viewProjection = prevVP;
    if (!opts.skipRestore && prevVP) drawScene();

    // 2D 叠加层：检测框、准星标尺与角标
    ctx.save();
    ctx.beginPath(); ctx.rect(dstX, dstY, dstW, dstH); ctx.clip();

    const worldToRect = (wx, wy, wz) => {
      const zFwd = -(camView[2] * wx + camView[6] * wy + camView[10] * wz + camView[14]);
      if (zFwd <= 0.03) return null;
      const ndc = m4Transform(camVP, [wx, wy, wz, 1]);
      return { x: dstX + dstW * (0.5 + 0.5 * ndc[0]), y: dstY + dstH * (0.5 - 0.5 * ndc[1]), zFwd };
    };

    // 光轴准星 & 地平线参照刻度
    const cxMid = dstX + dstW * 0.5, cyMid = dstY + dstH * 0.5;
    ctx.strokeStyle = "rgba(100, 227, 193, 0.48)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cxMid - 10, cyMid); ctx.lineTo(cxMid - 3, cyMid);
    ctx.moveTo(cxMid + 3, cyMid); ctx.lineTo(cxMid + 10, cyMid);
    ctx.moveTo(cxMid, cyMid - 7); ctx.lineTo(cxMid, cyMid + 7);
    ctx.stroke();

    const horPt = worldToRect(camX + Math.sin(camYaw) * 4.0, camY, camZ + Math.cos(camYaw) * 4.0);
    if (horPt && horPt.y >= dstY && horPt.y <= dstY + dstH) {
      ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(255, 212, 121, 0.45)";
      ctx.beginPath(); ctx.moveTo(dstX + 6, horPt.y); ctx.lineTo(dstX + dstW - 6, horPt.y); ctx.stroke();
      ctx.setLineDash([]);
    }

    if (game.showCamOverlay && !opts.hideBoxes) {
      const visibleIds = sim.visionVisibleIds || new Set();
      for (let i = 0; i < sim.pieces.length; i += 1) {
        const p = sim.pieces[i];
        if (!visibleIds.has(p.id)) continue;
        const pTop = worldToRect(p.x, PIECE_HEIGHT, p.z);
        const pBot = worldToRect(p.x, 0, p.z);
        if (!pTop || !pBot) continue;
        const rx = Math.max(4, (p.radius / Math.max(0.05, pTop.zFwd)) * (dstW / (2 * tanHalfX)));
        if (pTop.x + rx < dstX || pTop.x - rx > dstX + dstW) continue;
        const ryHalf = Math.max(2.5, rx * Math.abs(vertDown) * 0.85);
        const boxX = pTop.x - rx - 3, boxY = pTop.y - ryHalf - 2, boxW = rx * 2 + 6, boxH = Math.max(8, (pBot.y - pTop.y) + ryHalf * 1.8 + 4);
        const isRed = p.side === "red";
        ctx.strokeStyle = p.id === sim.targetId ? "#ffc76b" : isRed ? "#5ce1bd" : "rgba(160, 198, 255, 0.78)";
        ctx.lineWidth = p.id === sim.targetId ? 2 : 1.2;
        ctx.strokeRect(boxX, boxY, boxW, boxH);
        if (rx >= 6.5 && dstW >= 180) {
          ctx.fillStyle = "rgba(8, 20, 26, 0.82)";
          ctx.fillRect(boxX, Math.max(dstY, boxY - 12), 42, 11);
          ctx.fillStyle = isRed ? "#ff8a96" : "#e2ecff";
          ctx.font = "600 8.5px DM Sans, Microsoft YaHei";
          ctx.textAlign = "left"; ctx.textBaseline = "top";
          ctx.fillText(`${isRed ? "红" : "白"}·${p.symbol}`, boxX + 2, Math.max(dstY + 1, boxY - 11));
        }
      }
    }

    if (!opts.minimalHud) {
      ctx.fillStyle = "rgba(8, 22, 27, 0.76)";
      ctx.fillRect(dstX + 7, dstY + 7, Math.min(dstW - 14, 218), 18);
      ctx.fillStyle = "#64e3c1";
      ctx.font = "600 9.5px 'Barlow Condensed', 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(`CAM-1 · 机高${Math.round(b.cameraHeight * 1000)}mm · 俯仰${Math.round(b.cameraPitch)}° · ${sim.visionState?.visible?.length || 0}目标`, dstX + 12, dstY + 16);
    } else {
      ctx.fillStyle = "rgba(8, 22, 27, 0.78)";
      ctx.fillRect(dstX, dstY, dstW, 14);
      ctx.fillStyle = "#64e3c1";
      ctx.font = "700 8.5px 'Barlow Condensed', 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(`LIVE CAM · 高${Math.round(b.cameraHeight * 1000)}mm 俯仰${Math.round(b.cameraPitch)}°`, dstX + 5, dstY + 7);
    }
    ctx.restore();
  }

  function renderFirstPersonCamera(targetCanvas, skipRestore = false) {
    if (!targetCanvas) return;
    const ctx = targetCanvas.getContext("2d");
    const width = targetCanvas.width, height = targetCanvas.height;
    ctx.clearRect(0, 0, width, height);

    if (targetCanvas.id === "cameraCanvas" && game.cameraStream && $("cameraVideo")?.readyState >= 2) {
      ctx.drawImage($("cameraVideo"), 0, 0, width, height);
      return;
    }
    drawFirstPersonSceneToRect(targetCanvas, 0, 0, width, height, { skipRestore });
  }

  function renderStudioWebGLAssembly(cad, skipRestore = false) {
    if (!cad || !game.sim) return;
    if (canvas.width <= 1 || canvas.height <= 1) resizeCanvas();
    if (!game.viewProjection) updateCameraMatrices();

    const w = cad.width, h = cad.height, r = game.sim.robot, b = game.build;
    const oy = game.studio.orbitYaw, op = game.studio.orbitPitch, od = game.studio.orbitDist;
    const target = [r.x, 0.08, r.z];
    const horiz = Math.cos(op) * od;
    const eye = [target[0] + Math.sin(oy) * horiz, target[1] + Math.sin(op) * od, target[2] + Math.cos(oy) * horiz];
    const aspect = w / Math.max(1, h);
    const vp = m4Multiply(m4Perspective((44 * Math.PI) / 180, aspect, 0.02, 12.0), m4LookAt(eye, target, [0, 1, 0]));

    const prevVP = game.viewProjection;
    game.viewProjection = vp;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.05, 0.13, 0.16, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawField(true);
    drawVisionCone();
    drawPieces(false);
    drawRobot(false);

    // 绘制 300×300×300 mm 合规限界立体线框笼
    const sR = Math.sin(r.yaw), cR = Math.cos(r.yaw);
    const toW = (lx, ly, lz) => [r.x + lx * cR + lz * sR, ly, r.z - lx * sR + lz * cR];
    const hl = 0.15, hh = 0.30;
    const compColor = checkCompliance(b).ok ? [0.39, 0.89, 0.76] : [1.0, 0.32, 0.36];
    const bPts = [toW(-hl, 0.005, -hl), toW(hl, 0.005, -hl), toW(hl, 0.005, hl), toW(-hl, 0.005, hl)];
    const tPts = [toW(-hl, hh, -hl), toW(hl, hh, -hl), toW(hl, hh, hl), toW(-hl, hh, hl)];
    drawLines([...bPts, bPts[0]], compColor, 0.7);
    drawLines([...tPts, tPts[0]], compColor, 0.7);
    for (let i = 0; i < 4; i += 1) drawLines([bPts[i], tPts[i]], compColor, 0.55);

    const ctx = cad.getContext("2d");
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, w, h);

    game.viewProjection = prevVP;
    if (!skipRestore && prevVP) drawScene();
  }

  function drawCameraView(skipRestore = false) {
    renderFirstPersonCamera($("cameraCanvas"), skipRestore);
  }

  // =========================
  // 8. 独立全屏高自由度 CAD 设计工坊 (#independentStudioModal)
  // =========================
  function openIndependentStudio(moduleKey = "device") {
    game.studio.open = true;
    game.studio.moduleKey = MODULE_ORDER.some((m) => m.key === moduleKey) ? moduleKey : "device";
    $("independentStudioModal").hidden = false;
    renderStudioModuleTabs();
    renderStudioModuleBody();
    updateStudioTelemetryStrip();
    updateStudioDiagnostics();
    drawStudioCad();
  }

  function closeIndependentStudio() {
    game.studio.open = false;
    $("independentStudioModal").hidden = true;
    refreshBuildAndSyncSim();
  }

  function renderStudioModuleTabs() {
    const root = $("studioModuleTabs");
    root.innerHTML = MODULE_ORDER.map((m) =>
      `<button class="studio-mod-tab${m.key === game.studio.moduleKey ? " active" : ""}" data-smod="${m.key}"><span>${m.icon}</span><span>${m.title}</span></button>`
    ).join("");
    root.querySelectorAll("[data-smod]").forEach((btn) => {
      btn.addEventListener("click", () => {
        game.studio.moduleKey = btn.dataset.smod;
        renderStudioModuleTabs();
        renderStudioModuleBody();
        updateStudioDiagnostics();
        drawStudioCad();
      });
    });
  }

  function renderStudioModuleBody() {
    const key = game.studio.moduleKey;
    const modMeta = MODULE_ORDER.find((m) => m.key === key);
    const schema = MODULE_DESIGN_SCHEMA[key];
    $("studioModuleHeading").textContent = `${modMeta.icon} ${modMeta.title} — 独立高自由度工程设计`;

    const customBlock = $("customCadBlock");
    const mcpBlock = $("cadMcpBlock");
    if (customBlock) customBlock.hidden = key !== "custom";
    if (mcpBlock) mcpBlock.hidden = key !== "custom";
    if (key === "custom") {
      $("studioMaterialBlock").hidden = true;
      $("studioTopologyBlock").hidden = true;
      $("studioPresetSelect").innerHTML = '<option value="custom">参数化 CAD 自定义件库</option>';
      $("studioPresetSelect").disabled = true;
      $("studioInteractionHint").textContent = "自定义件采用真实毫米参数、自由三维坐标与标准拼图接口。可在俯视 CAD 中拖动零件，也可用 AI MCP 生成模板后立即吸附到顶板、工具座或桅杆接口。";
      $("studioFieldsList").innerHTML = '<div class="studio-field-card"><strong>自定义件参数已移至左侧 CAD 零件库</strong><small>输入尺寸、材料、坐标并加入总装后，右侧诊断会实时更新质量、包络和连接状态。</small></div>';
      renderCustomPartEditor();
      return;
    }
    $("studioPresetSelect").disabled = false;

    // 1. 规格预设
    const presetSel = $("studioPresetSelect");
    const dict = PARTS_CATALOG[modMeta.dictKey];
    presetSel.innerHTML = Object.values(dict).map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
    presetSel.value = game.buildSelection[modMeta.selKey];
    presetSel.onchange = () => {
      game.buildSelection[modMeta.selKey] = presetSel.value;
      schema.fields.forEach((f) => { delete game.buildSelection.overrides[f.key]; });
      schema.topology.forEach((f) => { delete game.buildSelection.overrides[f.key]; });
      refreshBuildAndSyncSim();
      renderStudioModuleBody();
      addLog(`独立工坊切换预设 [${modMeta.title}] -> ${presetSel.options[presetSel.selectedIndex].text}`);
    };

    // 2. 材料工艺
    const matBlock = $("studioMaterialBlock"), matRoot = $("studioMaterialControls");
    if (schema.materials) {
      matBlock.hidden = false;
      const curMat = game.build[schema.materials.key];
      matRoot.innerHTML = `
        <span class="studio-sub-label">${schema.materials.label}</span>
        <select id="studioMatSelect" class="studio-select">
          ${Object.values(schema.materials.dict).map((m) => `<option value="${m.id}" ${m.id === curMat ? "selected" : ""}>${m.name}</option>`).join("")}
        </select>
      `;
      $("studioMatSelect").addEventListener("change", (e) => {
        game.buildSelection.overrides[schema.materials.key] = e.target.value;
        // 切换材料时清除质量覆写以便重新按密度计算
        if (key === "chassis") delete game.buildSelection.overrides.chassisMass;
        if (key === "device") delete game.buildSelection.overrides.deviceMass;
        refreshBuildAndSyncSim();
        renderStudioModuleBody();
      });
    } else {
      matBlock.hidden = true;
    }

    // 3. 结构拓扑开关
    const topoBlock = $("studioTopologyBlock"), topoRoot = $("studioTopologyControls");
    if (schema.topology && schema.topology.length > 0) {
      topoBlock.hidden = false;
      topoRoot.innerHTML = schema.topology.map((t) => {
        const val = game.build[t.key];
        if (t.type === "checkbox") {
          return `<label class="designer-checkbox-row" style="margin-top:6px;color:#d6ebe6;"><span>${t.label}</span><input type="checkbox" data-stopo="${t.key}" ${val ? "checked" : ""} /></label>`;
        }
        return `<span class="studio-sub-label">${t.label}</span><select class="studio-select" data-stopo="${t.key}">${t.options.map(([ov, ol]) => `<option value="${ov}" ${String(val) === ov ? "selected" : ""}>${ol}</option>`).join("")}</select>`;
      }).join("");
      schema.topology.forEach((t) => {
        const el = topoRoot.querySelector(`[data-stopo="${t.key}"]`);
        el.addEventListener("change", (e) => {
          game.buildSelection.overrides[t.key] = t.type === "checkbox" ? e.target.checked : t.isNum ? Number(e.target.value) : e.target.value;
          refreshBuildAndSyncSim();
          renderStudioModuleBody();
        });
      });
    } else {
      topoBlock.hidden = true;
    }

    // 4. 右栏全自由度滑块+任意直输数值框 (滑块范围会随手动输入的更大/更小值自动扩展，不设人为限制)
    const fieldsRoot = $("studioFieldsList");
    fieldsRoot.innerHTML = schema.fields.map((f) => {
      const rawVal = game.build[f.key];
      if (f.type === "text") {
        return `<div class="studio-field-card"><div class="designer-field-head"><span>${f.label}</span></div><input type="text" data-sfield="${f.key}" value="${escapeHtml(String(rawVal || ""))}" /></div>`;
      }
      const scale = f.scale || 1;
      const numVal = scale !== 1 ? Math.round(rawVal / scale) : Number(Number(rawVal).toFixed(f.step < 0.01 ? 3 : f.step < 0.1 ? 2 : f.step < 1 ? 1 : 0));
      const sMin = Math.min(f.min, numVal), sMax = Math.max(f.max, numVal);
      return `
        <div class="studio-field-card">
          <div class="designer-field-head">
            <span>${f.label}</span>
            <span class="unit-val" id="sval-${f.key}">${numVal} ${f.unit || ""}</span>
          </div>
          <div class="designer-range-combo">
            <input type="range" data-srange="${f.key}" min="${sMin}" max="${sMax}" step="${f.step}" value="${numVal}" />
            <input type="number" data-snum="${f.key}" step="${f.step}" value="${numVal}" title="支持直接键入突破滑条范围的任意合法物理数值" />
          </div>
        </div>
      `;
    }).join("");

    schema.fields.forEach((f) => {
      const scale = f.scale || 1;
      const applyVal = (v) => {
        game.buildSelection.overrides[f.key] = f.type === "text" ? String(v) : Number(v) * scale;
        refreshBuildAndSyncSim();
      };
      const txt = fieldsRoot.querySelector(`[data-sfield="${f.key}"]`);
      if (txt) txt.addEventListener("change", (e) => applyVal(e.target.value));
      const rng = fieldsRoot.querySelector(`[data-srange="${f.key}"]`), num = fieldsRoot.querySelector(`[data-snum="${f.key}"]`);
      if (rng && num) {
        const lbl = $(`sval-${f.key}`);
        rng.addEventListener("input", () => { num.value = rng.value; if (lbl) lbl.textContent = `${rng.value} ${f.unit || ""}`; applyVal(rng.value); });
        num.addEventListener("change", () => {
          const parsed = Number(num.value);
          if (!Number.isFinite(parsed)) return;
          const minAbs = f.minAbs !== undefined ? f.minAbs : -Infinity;
          const val = Math.max(minAbs, parsed);
          num.value = String(val);
          if (val > Number(rng.max)) rng.max = String(val);
          if (val < Number(rng.min)) rng.min = String(val);
          rng.value = String(val);
          if (lbl) lbl.textContent = `${val} ${f.unit || ""}`;
          applyVal(val);
        });
      }
    });

    const hints = {
      chassis: "在俯视 CAD 中拖拽绿色控制柄自由改长/宽/切角，已解除 300mm 锁定，任意输入尺寸均可真实双层装配。",
      motor: "独立配置电机转速/扭矩/齿轮比/数量(1~8个)及电机前后安装轴位，电机盒将沿驱动轴真实装入。",
      wheel: "前/后轮半径与前/后轮距完全独立（支持前低后高俯仰姿态与异宽轮距），拖拽前右轮可联动调整。",
      device: "支持调整推斗离地安装高度 (≥17mm时棋子可从下方穿过)、左右偏置与长斜臂拉杆，均可独立装配。",
      wing: "左翼与右翼深度、外张角完全独立，在 CAD 图可分别拖拽左、右琥珀色翼尖手柄打造非对称扫斗。",
      camera: "视觉相机与激光彻底拆分解耦：支持任意 XYZ 悬臂坐标、-85°~+85° 俯仰及 360° 全向偏航旋转。",
      sensor: "独立激光塔安装位置与 0~9 路数设定，激光发射点严格跟随实际激光座世界坐标发射。",
      controller: "独立微调主控板 XYZ 与偏航角，4 根铜柱自动垂直锚固到所在层板。",
      battery: "独立调节电池三维配重坐标 (X, Y, Z) 与角度，实时改变前后轴荷、左右配重与整车转动惯量 Izz。",
      safety: "急停蘑菇头可在车体上方任意坐标独立打孔安装。",
    };
    $("studioInteractionHint").textContent = hints[key] || "已开启全独立无限制装配模式，可直接拖拽蓝图或直接输入任意数值。";
  }

  function updateStudioTelemetryStrip() {
    const b = game.build, comp = checkCompliance(b, game.unrestrictedMode);
    $("stSpecMass").textContent = `${b.totalMass.toFixed(2)} kg`;
    $("stSpecEnv").textContent = `${Math.round(b.envelopeLength * 1000)}×${Math.round(b.envelopeWidth * 1000)}×${Math.round(b.envelopeHeight * 1000)}`;
    $("stSpecAxle").textContent = `${b.frontAxlePct}:${b.rearAxlePct}`;
    $("stSpecSpeed").textContent = `${b.maxSpeed.toFixed(2)} m/s`;
    $("stSpecVision").textContent = `${Math.round(b.fov)}°/${b.sensorRange.toFixed(2)}m`;
    if ($("studioUnrestrictedBox")) $("studioUnrestrictedBox").checked = game.unrestrictedMode;
    const pill = $("stCompPill");
    if (game.unrestrictedMode) {
      pill.textContent = b.assemblyNotes.length ? b.assemblyNotes[0] : "无限制自由模式";
      pill.className = "status-pill mint";
    } else {
      pill.textContent = comp.ok ? "国赛合规通过" : comp.issues[0];
      pill.className = `status-pill ${comp.ok ? "mint" : "danger"}`;
    }
  }

  function computeEngineeringDiagnostics(b) {
    const mouthMm = Math.round(b.mouthWidth * 1000);
    const maxCapPieces = Math.max(1, Math.floor(Math.max(0, b.deviceWidth - 0.01) / (PIECE_RADIUS * 2)));
    const groundHitM = b.cameraPitch > 1.5 ? (b.cameraHeight / Math.tan((b.cameraPitch * Math.PI) / 180)) : 2.50;
    const shadow1mMm = Math.round(1000 * (PIECE_HEIGHT / Math.max(0.02, b.cameraHeight - PIECE_HEIGHT)));
    const battWh = b.voltage * b.capacity;
    const avgDrawW = Math.min(battWh * 25, 14 + b.motorCount * b.torque * 32 + b.controlHz * 0.12);
    const matchWh = (avgDrawW * 120) / 3600;
    const reservePct = Math.round(clamp(((battWh - matchWh) / Math.max(0.1, battWh)) * 100, 5, 99));
    const massMarginKg = +(TRACK_LIMITS.mass - b.totalMass).toFixed(2);
    return { mouthMm, maxCapPieces, groundHitM, shadow1mMm, reservePct, massMarginKg, customMassKg: customPartMassKg(game.customParts), connectedCustom: game.customParts.filter((part) => part.connected).length };
  }

  function updateStudioDiagnostics() {
    const b = game.build;
    const d = computeEngineeringDiagnostics(b);
    const fitMsg = b.assemblyNotes.length ? b.assemblyNotes[0] : "各连接件无干涉";
    const items = [
      ["左右翼捕集口宽", `${d.mouthMm} mm (${Math.round(b.leftWingDepth * 1000)}/${Math.round(b.rightWingDepth * 1000)})`],
      ["左右配重 · 惯量", `${b.leftAxlePct}:${b.rightAxlePct} · ${b.inertiaZ.toFixed(3)}kg·m²`],
      ["相机中心落地点", d.groundHitM >= 2.49 ? "平视/仰视" : `${d.groundHitM.toFixed(2)} m`],
      ["推斗 / 底盘离地", `${Math.round(b.deviceMountY * 1000)}mm / ${Math.round(b.groundClearance * 1000)}mm`],
      ["真驱动加速 / 极速", `${b.maxAccel.toFixed(2)} m/s² / ${b.maxSpeed.toFixed(2)}`],
      ["装配干涉评估", fitMsg],
      ["CAD拼图件", `${game.customParts.length}件 · ${d.connectedCustom}处已吸附 · ${d.customMassKg.toFixed(2)}kg`],
      ["120s电量余量", `${d.reservePct}% (${(b.voltage * b.capacity).toFixed(1)}Wh)`],
      ["国赛2.5kg参考裕度", d.massMarginKg >= 0 ? `轻 ${d.massMarginKg.toFixed(2)} kg` : `自由超重 ${Math.abs(d.massMarginKg).toFixed(2)} kg`],
    ];
    $("studioDiagnostics").innerHTML = items.map(([k, v]) => `<div class="studio-diag-item"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join("");
  }

  function drawStudioCameraPip(ctx, cad, w, h, skipRestore) {
    const pipW = clamp(Math.round(w * 0.34), 156, 224), pipH = Math.round(pipW * (230 / 480));
    const pipX = w - pipW - 12, pipY = h - pipH - 12;
    game.studio.pipRect = { x: pipX, y: pipY, w: pipW, h: pipH };
    drawFirstPersonSceneToRect(cad, pipX, pipY, pipW, pipH, { skipRestore, minimalHud: true, hideBoxes: false });
    ctx.strokeStyle = "#64e3c1"; ctx.lineWidth = 1.6;
    ctx.strokeRect(pipX, pipY, pipW, pipH);
  }

  function drawCustomCadOverlay(ctx, scale, cx, cy, toPX, toPY, addHandle) {
    const slots = getCustomSnapSlots(game.build);
    ctx.save();
    ctx.setLineDash([4, 3]);
    slots.forEach((slot) => {
      const sx = toPX(slot.x), sy = toPY(slot.z);
      ctx.strokeStyle = "rgba(255, 199, 107, .72)";
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255, 199, 107, .82)";
      ctx.font = "600 9px DM Sans, Microsoft YaHei";
      ctx.textAlign = "center";
      ctx.fillText(slot.label, sx, sy - 12);
      ctx.setLineDash([4, 3]);
    });
    ctx.setLineDash([]);

    game.customParts.forEach((part) => {
      const px = toPX(part.x), py = toPY(part.z);
      const pw = Math.max(9, part.width * scale), pl = Math.max(9, part.length * scale);
      const selected = part.id === game.studio.selectedCustomId;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-(part.yaw * Math.PI) / 180);
      ctx.fillStyle = `${part.color || "#2d9279"}cc`;
      ctx.strokeStyle = selected ? "#ffffff" : (part.connected ? "#64e3c1" : part.color || "#2d9279");
      ctx.lineWidth = selected ? 2.4 : 1.5;
      ctx.fillRect(-pw / 2, -pl / 2, pw, pl);
      ctx.strokeRect(-pw / 2, -pl / 2, pw, pl);
      if (part.template === "bracket" || part.template === "funnel") {
        ctx.strokeStyle = "rgba(255,255,255,.78)";
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(-pw * 0.34, -pl * 0.30); ctx.lineTo(pw * 0.34, pl * 0.30); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pw * 0.34, -pl * 0.30); ctx.lineTo(-pw * 0.34, pl * 0.30); ctx.stroke();
      }
      if (part.template === "connector") {
        ctx.fillStyle = "#f8f0d0";
        ctx.beginPath(); ctx.arc(-pw * 0.25, 0, Math.max(2, pw * 0.10), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(pw * 0.25, 0, Math.max(2, pw * 0.10), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = "#e6f8f4";
      ctx.font = "600 10px DM Sans, Microsoft YaHei";
      ctx.textAlign = "left";
      ctx.fillText(`${part.name}${part.connected ? " · 🔗" : ""}`, px + pw / 2 + 6, py + 4);
      addHandle(`custom:${part.id}`, px, py, `${Math.round(part.width * 1000)}×${Math.round(part.length * 1000)}mm`, selected ? "#ffffff" : (part.connected ? "#64e3c1" : "#ffc76b"), (mx, my) => {
        if (part.locked) return;
        game.studio.selectedCustomId = part.id;
        part.x = (mx - cx) / scale;
        part.z = (cy - my) / scale;
        part.connected = false;
        part.slotId = "";
        persistCustomParts();
        updateCustomPartList();
      });
    });
    ctx.restore();
  }

  function drawStudioCad(skipRestore = false) {
    const cad = $("studioCadCanvas");
    if (!cad || !game.studio.open) return;
    const rect = cad.getBoundingClientRect();
    if (rect.width > 10 && rect.height > 10) {
      cad.width = Math.round(rect.width);
      cad.height = Math.round(rect.height);
    }

    const ctx = cad.getContext("2d");
    const w = cad.width, h = cad.height, b = game.build;
    const view = game.studio.view, mod = game.studio.moduleKey;
    game.studio.pipRect = null;

    if (view === "live_cam") {
      $("studioCadMeta").textContent = "FIRST-PERSON WEBGL 3D · 无限制上下拖拽俯仰 (-85°~+85°) / Shift或滚轮升降机高";
      ctx.fillStyle = "#07161c"; ctx.fillRect(0, 0, w, h);
      const maxW = Math.max(120, w - 76), maxH = Math.max(80, h - 68);
      const fw = Math.min(maxW, Math.round(maxH * (480 / 230)));
      const fh = Math.round(fw * (230 / 480));
      const fx = Math.round((w - fw) * 0.5), fy = Math.max(18, Math.round((h - fh - 30) * 0.5));
      drawFirstPersonSceneToRect(cad, fx, fy, fw, fh, { skipRestore });
      ctx.strokeStyle = "#64e3c1"; ctx.lineWidth = 2; ctx.strokeRect(fx, fy, fw, fh);

      // 左侧镜头升降(机高)刻度条 & 右侧俯仰角刻度条
      const gxL = fx - 18, gxR = fx + fw + 18;
      const hFrac = clamp((b.cameraHeight - 0.02) / (0.50 - 0.02), 0, 1);
      ctx.strokeStyle = "rgba(100,227,193,0.35)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(gxL, fy + fh); ctx.lineTo(gxL, fy); ctx.stroke();
      ctx.fillStyle = "#64e3c1"; ctx.beginPath(); ctx.arc(gxL, fy + fh * (1 - hFrac), 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#bfe6df"; ctx.font = "600 10px DM Sans, Microsoft YaHei"; ctx.textAlign = "center";
      ctx.fillText(`${Math.round(b.cameraHeight * 1000)}mm`, gxL, fy - 7);

      const pFrac = clamp((b.cameraPitch - (-75)) / (75 - (-75)), 0, 1);
      ctx.strokeStyle = "rgba(255,199,107,0.35)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(gxR, fy); ctx.lineTo(gxR, fy + fh); ctx.stroke();
      ctx.fillStyle = "#ffc76b"; ctx.beginPath(); ctx.arc(gxR, fy + fh * pFrac, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffd479"; ctx.fillText(`${Math.round(b.cameraPitch)}°`, gxR, fy - 7);

      ctx.fillStyle = "#8cb7b0"; ctx.font = "600 11px DM Sans, Microsoft YaHei"; ctx.textAlign = "center";
      ctx.fillText(`↕ 上下拖拽调俯仰 (${Math.round(b.cameraPitch)}°) · 🖱 滚轮/Shift+拖调机高 (${Math.round(b.cameraHeight * 1000)}mm) · ↔ 偏航 (${Math.round(b.cameraMountYaw)}°)`, w * 0.5, fy + fh + 24);
      return;
    }

    if (view === "3d_iso") {
      $("studioCadMeta").textContent = "TRUE 3D ASSEMBLY · 拖拽旋转立体视角 · 滚轮缩放 · 实景观察各模块机械支架与铜柱装配";
      game.studio.handles = [];
      renderStudioWebGLAssembly(cad, true);
      ctx.fillStyle = "rgba(8, 22, 27, 0.78)"; ctx.fillRect(10, 10, Math.min(w - 20, 360), 22);
      ctx.fillStyle = "#64e3c1"; ctx.font = "600 10.5px DM Sans, Microsoft YaHei"; ctx.textAlign = "left";
      ctx.fillText(`3D实体总装 · 镜头高${Math.round(b.cameraHeight * 1000)}mm · 推斗离地${Math.round(b.deviceMountY * 1000)}mm · 左键旋转`, 16, 25);
      drawStudioCameraPip(ctx, cad, w, h, skipRestore);
      return;
    }

    ctx.fillStyle = "#07161c"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(100, 227, 193, 0.08)"; ctx.lineWidth = 1;
    for (let x = 20; x < w; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 20; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    game.studio.handles = [];
    const addHandle = (id, hx, hy, label, color, onDrag) => {
      game.studio.handles.push({ id, x: hx, y: hy, label, color, onDrag });
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(hx, hy, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#061417"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#e6f8f4"; ctx.font = "600 10.5px DM Sans, Microsoft YaHei"; ctx.textAlign = "left";
      ctx.fillText(label, hx + 11, hy + 4);
    };

    if (view === "side") {
      $("studioCadMeta").textContent = "SIDE ELEVATION · 双层结构/推斗离地高度/独立前后轮/相机与激光三维坐标直观拖拽";
      const ox = w * 0.24, gy = h * 0.78, ppmS = clamp(Math.min(w * 0.28, 280) * (0.30 / Math.max(0.28, b.envelopeHeight, b.envelopeLength * 0.85)), 110, 320);
      const toSX = (z) => ox + z * ppmS, toSY = (y) => gy - y * ppmS;

      ctx.strokeStyle = "#3a6e6a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(20, gy); ctx.lineTo(w - 20, gy); ctx.stroke();

      const y300 = toSY(0.30);
      ctx.setLineDash([5, 4]); ctx.strokeStyle = "rgba(255, 197, 107, 0.42)";
      ctx.beginPath(); ctx.moveTo(20, y300); ctx.lineTo(w - 20, y300); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#ffd479"; ctx.font = "600 10px DM Sans"; ctx.fillText("300mm 国赛参考线", 26, y300 - 6);

      // 双层底盘上下板 + 铜柱支柱
      const botY = b.groundClearance, topDeckY = b.groundClearance + b.height;
      const hl = b.length / 2;
      if (b.frameStyle === "monocoque") {
        ctx.fillStyle = "rgba(45, 146, 121, 0.30)"; ctx.strokeStyle = "#64e3c1"; ctx.lineWidth = 2;
        ctx.fillRect(toSX(-hl), toSY(topDeckY), b.length * ppmS, b.height * ppmS);
        ctx.strokeRect(toSX(-hl), toSY(topDeckY), b.length * ppmS, b.height * ppmS);
      } else {
        ctx.fillStyle = "rgba(45, 146, 121, 0.42)"; ctx.strokeStyle = "#64e3c1"; ctx.lineWidth = 1.6;
        ctx.fillRect(toSX(-hl), toSY(botY + 0.005), b.length * ppmS, Math.max(3, 0.005 * ppmS));
        ctx.fillRect(toSX(-hl), toSY(topDeckY), b.length * ppmS, Math.max(3, 0.005 * ppmS));
        ctx.strokeStyle = "#8ab0aa"; ctx.lineWidth = 3;
        for (const pz of [-hl * 0.85, hl * 0.85]) {
          ctx.beginPath(); ctx.moveTo(toSX(pz), toSY(botY)); ctx.lineTo(toSX(pz), toSY(topDeckY)); ctx.stroke();
        }
      }

      // 独立前后轮半径
      const wzRear = b.wheelOffsetZ - b.wheelbase / 2, wzFront = b.wheelOffsetZ + b.wheelbase / 2;
      ctx.strokeStyle = "#52787d"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(toSX(wzRear), toSY(b.rearWheelRadius), b.rearWheelRadius * ppmS, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(toSX(wzFront), toSY(b.frontWheelRadius), b.frontWheelRadius * ppmS, 0, Math.PI * 2); ctx.stroke();

      // 电池 & 主控 & 电机侧面装配投影
      ctx.fillStyle = "#b06cd9"; ctx.fillRect(toSX(b.cgOffsetZ - 0.03), toSY(b.battMountY + 0.022), 0.06 * ppmS, 0.022 * ppmS);
      ctx.fillStyle = "#3ba98e"; ctx.fillRect(toSX(b.ctrlMountZ - 0.035), toSY(b.ctrlMountY + 0.015), 0.07 * ppmS, 0.015 * ppmS);
      ctx.fillStyle = "#e0a943"; ctx.fillRect(toSX(b.laserMountZ - 0.009), toSY(b.laserMountY + 0.014), 0.018 * ppmS, 0.014 * ppmS);

      // 独立推斗 (离地高度 deviceMountY + 板高 deviceHeight) + 连杆
      const fz = hl + b.deviceOffset;
      const devMidY = b.deviceMountY + b.deviceHeight * 0.5;
      ctx.strokeStyle = "#7da2a0"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(toSX(hl), toSY((botY + topDeckY) * 0.5)); ctx.lineTo(toSX(fz), toSY(devMidY)); ctx.stroke();
      ctx.fillStyle = "#ffc76b"; ctx.fillRect(toSX(fz) - 4, toSY(b.deviceMountY + b.deviceHeight), 8, Math.max(4, b.deviceHeight * ppmS));

      // 相机支架悬臂 + 光学视线
      const cx = toSX(b.cameraMountZ), cy = toSY(b.cameraHeight);
      const anchorZ = clamp(b.cameraMountZ, -hl * 0.85, hl * 0.85);
      ctx.strokeStyle = "#4d98e0"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(toSX(anchorZ), toSY(topDeckY)); ctx.lineTo(toSX(anchorZ), cy); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.fillStyle = "#4d98e0"; ctx.fillRect(cx - 7, cy - 6, 14, 12);
      const pitchRad = (b.cameraPitch * Math.PI) / 180;
      const aimX = cx + Math.cos(pitchRad) * (1.25 * ppmS), aimY = cy + Math.sin(pitchRad) * (1.25 * ppmS);
      ctx.strokeStyle = "rgba(100, 227, 193, 0.88)"; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      if (b.cameraPitch > 1.5) {
        const gHit = b.cameraMountZ + b.cameraHeight / Math.tan(pitchRad);
        ctx.lineTo(toSX(Math.min(2.6, gHit)), gy);
      } else {
        ctx.lineTo(Math.min(w - 24, aimX), clamp(aimY, 16, gy));
      }
      ctx.stroke();

      const px = b.cameraMountZ + 0.55;
      ctx.fillStyle = "#16191e"; ctx.fillRect(toSX(px - 0.0335), toSY(PIECE_HEIGHT), 0.067 * ppmS, PIECE_HEIGHT * ppmS);
      ctx.strokeStyle = "#ff4757"; ctx.lineWidth = 2; ctx.strokeRect(toSX(px - 0.0335), toSY(PIECE_HEIGHT), 0.067 * ppmS, PIECE_HEIGHT * ppmS);
      const shadowReach = b.cameraMountZ + (px - b.cameraMountZ) * (b.cameraHeight / Math.max(0.02, b.cameraHeight - PIECE_HEIGHT));
      ctx.fillStyle = "rgba(255, 71, 87, 0.24)";
      ctx.beginPath(); ctx.moveTo(toSX(px), toSY(PIECE_HEIGHT)); ctx.lineTo(toSX(shadowReach), gy); ctx.lineTo(toSX(px), gy); ctx.closePath(); ctx.fill();

      addHandle("camSidePose", cx, cy, `相机高 ${Math.round(b.cameraHeight * 1000)}mm / 前后 ${Math.round(b.cameraMountZ * 1000)}mm`, "#64e3c1", (mx, my) => {
        game.buildSelection.overrides.cameraHeight = clamp((gy - my) / ppmS, 0.015, 0.60);
        game.buildSelection.overrides.cameraMountZ = (mx - ox) / ppmS;
      });
      const pitchTipZ = b.cameraMountZ + 0.68 * Math.cos(pitchRad), pitchTipY = clamp(b.cameraHeight - 0.68 * Math.sin(pitchRad), 0, 0.65);
      addHandle("camPitchHandle", toSX(pitchTipZ), toSY(pitchTipY), `俯仰 ${Math.round(b.cameraPitch)}°`, "#ffc76b", (mx, my) => {
        const dz = Math.max(0.05, (mx - ox) / ppmS - b.cameraMountZ), dy = b.cameraHeight - (gy - my) / ppmS;
        game.buildSelection.overrides.cameraPitch = clamp(Math.round((Math.atan2(dy, dz) * 180) / Math.PI), -85, 85);
      });
      addHandle("devSideMount", toSX(fz), toSY(b.deviceMountY), `推斗离地 ${Math.round(b.deviceMountY * 1000)}mm`, "#ff8a96", (mx, my) => {
        game.buildSelection.overrides.deviceMountY = Math.max(0, (gy - my) / ppmS);
        game.buildSelection.overrides.deviceOffset = Math.max(0.001, (mx - ox) / ppmS - hl);
      });
      drawStudioCameraPip(ctx, cad, w, h, skipRestore);
      return;
    }

    // 俯视 CAD 视图 (Top CAD / Assembly — 自适应大幅面缩放，突破 300mm 尺寸依然清晰可控)
    const refSpan = Math.max(0.32, b.envelopeLength * 1.12, b.envelopeWidth * 1.12);
    const baseScale = (view === "assembly" || mod === "camera" || mod === "sensor") ? Math.min(w, h) * 0.25 : Math.min(w, h) * 0.92 * (0.34 / refSpan);
    const scale = clamp(baseScale, 110, 1400);
    const cx = w * 0.5, cy = (view === "assembly" || mod === "camera" || mod === "sensor") ? h * 0.72 : h * 0.56;
    const toPX = (lx) => cx + lx * scale;
    const toPY = (lz) => cy - lz * scale;

    $("studioCadMeta").textContent = view === "assembly" ? "FULL ASSEMBLY & FOV CONE" : "TOP CAD · 每部件独立拖拽，彻底无尺寸/位置限制";

    // 1. 300×300 mm 竞赛参考虚线框
    const lim = 0.15 * scale;
    ctx.setLineDash([6, 4]); ctx.strokeStyle = "rgba(255, 197, 107, 0.34)"; ctx.lineWidth = 1.4;
    ctx.strokeRect(cx - lim, cy - lim, lim * 2, lim * 2);
    ctx.setLineDash([]);

    // 2. 底盘多边形（带前切角 frontChamfer）
    const hw = b.width / 2, hl = b.length / 2, ch = Math.min(b.frontChamfer, hw * 0.7, hl * 0.7);
    ctx.fillStyle = "rgba(45, 146, 121, 0.22)"; ctx.strokeStyle = "#64e3c1"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(toPX(-hw), toPY(-hl));
    ctx.lineTo(toPX(hw), toPY(-hl));
    ctx.lineTo(toPX(hw), toPY(hl - ch));
    ctx.lineTo(toPX(hw - ch), toPY(hl));
    ctx.lineTo(toPX(-hw + ch), toPY(hl));
    ctx.lineTo(toPX(-hw), toPY(hl - ch));
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // 3. 真实传动轴 + 独立前后轮距/轮径 + 电机仓
    const fWz = b.wheelOffsetZ + b.wheelbase / 2, rWz = b.wheelOffsetZ - b.wheelbase / 2;
    ctx.strokeStyle = "#7c9b97"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(toPX(-b.frontTrack / 2), toPY(fWz)); ctx.lineTo(toPX(b.frontTrack / 2), toPY(fWz));
    ctx.moveTo(toPX(-b.rearTrack / 2), toPY(rWz)); ctx.lineTo(toPX(b.rearTrack / 2), toPY(rWz));
    ctx.stroke();

    const drawTopWheel = (wx, wz, rad) => {
      ctx.fillStyle = b.driveMode === "diff" || b.driveMode === "rwd_caster" ? "#2d9279" : "#e3a634";
      ctx.fillRect(toPX(wx - b.wheelWidth / 2), toPY(wz + rad), b.wheelWidth * scale, rad * 2 * scale);
    };
    drawTopWheel(-b.rearTrack / 2, rWz, b.rearWheelRadius);
    drawTopWheel(b.rearTrack / 2, rWz, b.rearWheelRadius);
    if (b.driveMode === "rwd_caster") {
      ctx.fillStyle = "#95b8b1";
      ctx.beginPath(); ctx.arc(toPX(0), toPY(fWz), Math.max(5, b.frontWheelRadius * scale * 0.7), 0, Math.PI * 2); ctx.fill();
    } else {
      drawTopWheel(-b.frontTrack / 2, fWz, b.frontWheelRadius);
      drawTopWheel(b.frontTrack / 2, fWz, b.frontWheelRadius);
    }

    // 电机缸投影
    ctx.fillStyle = "rgba(180, 198, 206, 0.55)";
    ctx.fillRect(toPX(-hw * 0.55), toPY(b.motorMountZ + 0.015), hw * 1.1 * scale, 0.030 * scale);

    // 4. 前端主斗 + 独立左右侧翼 (支持左右偏置 deviceMountX + 不对称左/右翼)
    const fz = hl + b.deviceOffset, devX = b.deviceMountX || 0, dhw = b.deviceWidth / 2;
    const lSplayRad = (b.leftWingSplay * Math.PI) / 180, rSplayRad = (b.rightWingSplay * Math.PI) / 180;
    const lTipX = devX - dhw - b.leftWingDepth * Math.sin(lSplayRad), lTipZ = fz + b.leftTipForward;
    const rTipX = devX + dhw + b.rightWingDepth * Math.sin(rSplayRad), rTipZ = fz + b.rightTipForward;
    // 连杆臂
    ctx.strokeStyle = "#7da2a0"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(toPX(-dhw * 0.65), toPY(hl)); ctx.lineTo(toPX(devX - dhw * 0.65), toPY(fz));
    ctx.moveTo(toPX(dhw * 0.65), toPY(hl)); ctx.lineTo(toPX(devX + dhw * 0.65), toPY(fz));
    ctx.stroke();

    ctx.strokeStyle = "#ffc76b"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(toPX(devX - dhw), toPY(fz)); ctx.lineTo(toPX(devX + dhw), toPY(fz)); ctx.stroke();
    if (b.leftWingDepth > 0.002) {
      ctx.beginPath(); ctx.moveTo(toPX(devX - dhw), toPY(fz)); ctx.lineTo(toPX(lTipX), toPY(lTipZ)); ctx.stroke();
    }
    if (b.rightWingDepth > 0.002) {
      ctx.beginPath(); ctx.moveTo(toPX(devX + dhw), toPY(fz)); ctx.lineTo(toPX(rTipX), toPY(rTipZ)); ctx.stroke();
    }
    if (b.dividerCount > 0 && Math.max(b.leftWingDepth, b.rightWingDepth) > 0.005) {
      const n = b.dividerCount;
      for (let di = 1; di <= n; di += 1) {
        const dx = devX + (-dhw + (b.deviceWidth * di) / (n + 1));
        ctx.beginPath(); ctx.moveTo(toPX(dx), toPY(fz)); ctx.lineTo(toPX(dx), toPY(fz + b.wingTipForward * 0.82)); ctx.stroke();
      }
    }

    // 5. 车载相机与视锥
    const camXpx = toPX(b.cameraMountX), camYpx = toPY(b.cameraMountZ);
    const halfFov = (b.fov * Math.PI) / 360, tilt = (b.cameraMountYaw * Math.PI) / 180;
    const rVis = b.sensorRange * scale;
    ctx.fillStyle = "rgba(20, 184, 166, 0.16)"; ctx.strokeStyle = "rgba(20, 184, 166, 0.72)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(camXpx, camYpx);
    ctx.arc(camXpx, camYpx, rVis, -Math.PI / 2 + tilt - halfFov, -Math.PI / 2 + tilt + halfFov);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#4d98e0"; ctx.fillRect(camXpx - 6, camYpx - 6, 12, 12);

    // 6. 独立主控 / 电池 / 激光座 / 急停 / 实际三维重心标示
    ctx.fillStyle = "#16806c";
    ctx.fillRect(toPX(b.ctrlMountX - 0.032), toPY(b.ctrlMountZ + 0.032), 0.064 * scale, 0.064 * scale);
    ctx.fillStyle = "#d977d9";
    ctx.fillRect(toPX(b.battMountX - 0.025), toPY(b.cgOffsetZ + 0.035), 0.05 * scale, 0.07 * scale);
    ctx.fillStyle = "#ff5a6b";
    ctx.beginPath(); ctx.arc(toPX(b.laserMountX), toPY(b.laserMountZ), 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff4050";
    ctx.beginPath(); ctx.arc(toPX(b.eStopMountX), toPY(b.eStopMountZ), 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffd479"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(toPX(b.cgX), toPY(b.cgZ), 6, 0, Math.PI * 2); ctx.stroke();

    // 7. 推斗视图中的可拖拽 Ø67mm 黑体象棋测试包络
    if (mod === "device" || mod === "wing") {
      game.studio.testPieces.forEach((tp) => {
        const px = toPX(tp.x), py = toPY(tp.z), pr = PIECE_RADIUS * scale;
        ctx.fillStyle = "#14161b"; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = tp.side === "red" ? "#ff4757" : "#ffffff"; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = tp.side === "red" ? "#ff4757" : "#ffffff";
        ctx.font = `700 ${Math.max(10, pr * 0.95)}px Microsoft YaHei`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(tp.symbol, px, py);
      });
    }

    if (mod === "custom") {
      drawCustomCadOverlay(ctx, scale, cx, cy, toPX, toPY, addHandle);
    }

    // 8. 10 大独立模块各自独占的高自由度拖拽控制柄 (无范围限制)
    if (mod === "chassis") {
      addHandle("chW", toPX(hw), cy, `宽 ${Math.round(b.width * 1000)}mm`, "#64e3c1", (mx) => {
        game.buildSelection.overrides.width = Math.max(0.04, Math.abs(mx - cx) * 2 / scale);
      });
      addHandle("chL", cx, toPY(hl), `长 ${Math.round(b.length * 1000)}mm`, "#64e3c1", (_, my) => {
        game.buildSelection.overrides.length = Math.max(0.04, (cy - my) * 2 / scale);
      });
      addHandle("chC", toPX(hw - ch), toPY(hl), `切角 ${Math.round(b.frontChamfer * 1000)}mm`, "#ffc76b", (mx) => {
        game.buildSelection.overrides.frontChamfer = Math.max(0, hw - (mx - cx) / scale);
      });
    } else if (mod === "motor") {
      addHandle("motZ", cx, toPY(b.motorMountZ), `电机轴位 ${Math.round(b.motorMountZ * 1000)}mm`, "#ffc76b", (_, my) => {
        game.buildSelection.overrides.motorMountZ = (cy - my) / scale;
      });
    } else if (mod === "wheel") {
      addHandle("whFront", toPX(b.frontTrack / 2), toPY(fWz), `前轮距${Math.round(b.frontTrack * 1000)} · 轴距${Math.round(b.wheelbase * 1000)}`, "#ffc76b", (mx, my) => {
        game.buildSelection.overrides.frontTrack = Math.max(0.02, Math.abs(mx - cx) * 2 / scale);
        game.buildSelection.overrides.wheelbase = Math.max(0.02, Math.abs((cy - my) / scale - b.wheelOffsetZ) * 2);
      });
      addHandle("whRear", toPX(b.rearTrack / 2), toPY(rWz), `后轮距${Math.round(b.rearTrack * 1000)}`, "#64e3c1", (mx) => {
        game.buildSelection.overrides.rearTrack = Math.max(0.02, Math.abs(mx - cx) * 2 / scale);
      });
      addHandle("whOff", cx, toPY(b.wheelOffsetZ), `轴偏置 ${Math.round(b.wheelOffsetZ * 1000)}mm`, "#a9f2dc", (_, my) => {
        game.buildSelection.overrides.wheelOffsetZ = (cy - my) / scale;
      });
    } else if (mod === "device") {
      addHandle("devBack", toPX(devX + dhw), toPY(fz), `宽${Math.round(b.deviceWidth * 1000)} · 伸${Math.round(b.deviceOffset * 1000)}`, "#64e3c1", (mx, my) => {
        game.buildSelection.overrides.deviceWidth = Math.max(0.02, Math.abs((mx - cx) / scale - devX) * 2);
        game.buildSelection.overrides.deviceOffset = Math.max(0.001, (cy - my) / scale - hl);
      });
      addHandle("devShift", toPX(devX), toPY(fz), `横移 ${Math.round(devX * 1000)}mm`, "#ff8a96", (mx) => {
        game.buildSelection.overrides.deviceMountX = (mx - cx) / scale;
      });
    } else if (mod === "wing") {
      addHandle("wingLTip", toPX(lTipX), toPY(lTipZ), `左翼${Math.round(b.leftWingDepth * 1000)}mm/${Math.round(b.leftWingSplay)}°`, "#64e3c1", (mx, my) => {
        const dx = (devX - dhw) - (mx - cx) / scale, dz = Math.max(0.002, (cy - my) / scale - fz);
        game.buildSelection.overrides.leftWingDepth = Math.hypot(dx, dz);
        game.buildSelection.overrides.leftWingSplay = clamp(Math.round((Math.atan2(dx, dz) * 180) / Math.PI), -80, 85);
      });
      addHandle("wingRTip", toPX(rTipX), toPY(rTipZ), `右翼${Math.round(b.rightWingDepth * 1000)}mm/${Math.round(b.rightWingSplay)}°`, "#ffc76b", (mx, my) => {
        const dx = (mx - cx) / scale - (devX + dhw), dz = Math.max(0.002, (cy - my) / scale - fz);
        game.buildSelection.overrides.rightWingDepth = Math.hypot(dx, dz);
        game.buildSelection.overrides.rightWingSplay = clamp(Math.round((Math.atan2(dx, dz) * 180) / Math.PI), -80, 85);
      });
    } else if (mod === "camera") {
      addHandle("camPos", camXpx, camYpx, `相机 (${Math.round(b.cameraMountX * 1000)}, ${Math.round(b.cameraMountZ * 1000)})`, "#4d98e0", (mx, my) => {
        game.buildSelection.overrides.cameraMountX = (mx - cx) / scale;
        game.buildSelection.overrides.cameraMountZ = (cy - my) / scale;
      });
      const arcTipX = camXpx + Math.sin(tilt + halfFov) * rVis, arcTipY = camYpx - Math.cos(tilt + halfFov) * rVis;
      addHandle("camFov", arcTipX, arcTipY, `FOV ${Math.round(b.fov)}° / ${b.sensorRange.toFixed(2)}m`, "#64e3c1", (mx, my) => {
        const ddx = mx - camXpx, ddy = camYpx - my;
        game.buildSelection.overrides.sensorRange = Math.max(0.08, Math.hypot(ddx, ddy) / scale);
        const angDeg = (Math.atan2(ddx, ddy) * 180) / Math.PI - b.cameraMountYaw;
        game.buildSelection.overrides.fov = clamp(Math.round(Math.abs(angDeg) * 2), 8, 176);
      });
    } else if (mod === "sensor") {
      addHandle("laserPos", toPX(b.laserMountX), toPY(b.laserMountZ), `激光座 (${Math.round(b.laserMountX * 1000)}, ${Math.round(b.laserMountZ * 1000)})`, "#ff5a6b", (mx, my) => {
        game.buildSelection.overrides.laserMountX = (mx - cx) / scale;
        game.buildSelection.overrides.laserMountZ = (cy - my) / scale;
      });
    } else if (mod === "controller") {
      addHandle("ctrlPos", toPX(b.ctrlMountX), toPY(b.ctrlMountZ), `主控 (${Math.round(b.ctrlMountX * 1000)}, ${Math.round(b.ctrlMountZ * 1000)})`, "#64e3c1", (mx, my) => {
        game.buildSelection.overrides.ctrlMountX = (mx - cx) / scale;
        game.buildSelection.overrides.ctrlMountZ = (cy - my) / scale;
      });
    } else if (mod === "battery") {
      addHandle("batPos", toPX(b.battMountX), toPY(b.cgOffsetZ), `电池 (${Math.round(b.battMountX * 1000)},${Math.round(b.cgOffsetZ * 1000)}) · 前后${b.frontAxlePct}:${b.rearAxlePct} 左右${b.leftAxlePct}:${b.rightAxlePct}`, "#d977d9", (mx, my) => {
        game.buildSelection.overrides.battMountX = (mx - cx) / scale;
        game.buildSelection.overrides.cgOffsetZ = (cy - my) / scale;
      });
    } else if (mod === "safety") {
      addHandle("estopPos", toPX(b.eStopMountX), toPY(b.eStopMountZ), `急停 (${Math.round(b.eStopMountX * 1000)}, ${Math.round(b.eStopMountZ * 1000)})`, "#ff5a6b", (mx, my) => {
        game.buildSelection.overrides.eStopMountX = (mx - cx) / scale;
        game.buildSelection.overrides.eStopMountZ = (cy - my) / scale;
      });
    }
    drawStudioCameraPip(ctx, cad, w, h, skipRestore);
  }

  function bindStudioCanvasEvents() {
    const cad = $("studioCadCanvas");
    if (!cad) return;
    const getPos = (e) => { const rect = cad.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; };

    cad.addEventListener("pointerdown", (e) => {
      if (!game.studio.open) return;
      const p = getPos(e);
      if (game.studio.pipRect && p.x >= game.studio.pipRect.x && p.x <= game.studio.pipRect.x + game.studio.pipRect.w && p.y >= game.studio.pipRect.y && p.y <= game.studio.pipRect.y + game.studio.pipRect.h) {
        game.studio.view = "live_cam";
        document.querySelectorAll("[data-sview]").forEach((b) => b.classList.toggle("active", b.dataset.sview === "live_cam"));
        drawStudioCad();
        return;
      }
      if (game.studio.view === "live_cam" || game.studio.view === "3d_iso") {
        game.studio.orbiting = true;
        game.studio.lastPtr = { x: e.clientX, y: e.clientY };
        cad.setPointerCapture(e.pointerId);
        return;
      }
      for (const h of game.studio.handles) {
        if (Math.hypot(p.x - h.x, p.y - h.y) <= 14) {
          game.studio.dragHandle = h;
          cad.setPointerCapture(e.pointerId);
          return;
        }
      }
      if ((game.studio.moduleKey === "device" || game.studio.moduleKey === "wing") && game.studio.view === "top") {
        const w = cad.width, h = cad.height, b = game.build;
        const refSpan = Math.max(0.32, b.envelopeLength * 1.12, b.envelopeWidth * 1.12);
        const scale = clamp(Math.min(w, h) * 0.92 * (0.34 / refSpan), 110, 1400), cx = w * 0.5, cy = h * 0.56;
        for (const tp of game.studio.testPieces) {
          const tpx = cx + tp.x * scale, tpy = cy - tp.z * scale;
          if (Math.hypot(p.x - tpx, p.y - tpy) <= PIECE_RADIUS * scale + 6) {
            game.studio.dragPiece = tp;
            cad.setPointerCapture(e.pointerId);
            return;
          }
        }
      }
    });
    cad.addEventListener("pointermove", (e) => {
      const p = getPos(e);
      if (game.studio.orbiting && game.studio.lastPtr) {
        const dx = e.clientX - game.studio.lastPtr.x, dy = e.clientY - game.studio.lastPtr.y;
        game.studio.lastPtr = { x: e.clientX, y: e.clientY };
        if (game.studio.view === "3d_iso") {
          game.studio.orbitYaw -= dx * 0.01;
          game.studio.orbitPitch = clamp(game.studio.orbitPitch + dy * 0.009, 0.05, 1.48);
          drawStudioCad();
        } else if (game.studio.view === "live_cam") {
          if (e.shiftKey) {
            game.buildSelection.overrides.cameraHeight = clamp(game.build.cameraHeight - dy * 0.001, 0.015, 0.60);
          } else {
            game.buildSelection.overrides.cameraPitch = clamp(Math.round(game.build.cameraPitch + dy * 0.25), -85, 85);
            game.buildSelection.overrides.cameraMountYaw = clamp(Math.round(game.build.cameraMountYaw + dx * 0.25), -180, 180);
          }
          refreshBuildAndSyncSim();
          renderStudioModuleBody();
        }
      } else if (game.studio.dragHandle) {
        game.studio.dragHandle.onDrag(p.x, p.y);
        if (game.studio.dragHandle.id.startsWith("custom:")) {
          drawStudioCad();
        } else {
          refreshBuildAndSyncSim();
          renderStudioModuleBody();
        }
      } else if (game.studio.dragPiece) {
        const w = cad.width, h = cad.height, b = game.build;
        const refSpan = Math.max(0.32, b.envelopeLength * 1.12, b.envelopeWidth * 1.12);
        const scale = clamp(Math.min(w, h) * 0.92 * (0.34 / refSpan), 110, 1400), cx = w * 0.5, cy = h * 0.56;
        game.studio.dragPiece.x = (p.x - cx) / scale;
        game.studio.dragPiece.z = (cy - p.y) / scale;
        drawStudioCad();
      }
    });
    cad.addEventListener("wheel", (e) => {
      if (!game.studio.open) return;
      if (game.studio.view === "3d_iso") {
        e.preventDefault();
        game.studio.orbitDist = clamp(game.studio.orbitDist + e.deltaY * 0.0012, 0.25, 2.8);
        drawStudioCad();
      } else if (game.studio.view === "live_cam") {
        e.preventDefault();
        game.buildSelection.overrides.cameraHeight = clamp(game.build.cameraHeight - Math.sign(e.deltaY) * 0.008, 0.015, 0.60);
        refreshBuildAndSyncSim();
        renderStudioModuleBody();
      }
    }, { passive: false });
    const rel = (e) => {
      if (game.studio.dragHandle?.id?.startsWith("custom:")) {
        const part = game.customParts.find((item) => item.id === game.studio.dragHandle.id.slice(7));
        if (part) {
          const slot = snapCustomPart(part, game.build);
          persistCustomParts();
          if (slot) addLog(`拼图件「${part.name}」已自动吸附到${slot.label}`);
          applyCustomPartsToBuild();
          updateCustomPartList();
          updateStudioTelemetryStrip();
          updateStudioDiagnostics();
          drawStudioCad();
        }
      }
      game.studio.dragHandle = null; game.studio.dragPiece = null; game.studio.orbiting = false; cad.releasePointerCapture?.(e.pointerId);
    };
    cad.addEventListener("pointerup", rel);
    cad.addEventListener("pointercancel", rel);
  }

  // =========================
  // 9. 主页面模块列表 & 上帝 3D 场景绘制
  // =========================
  function renderModuleCardsGrid() {
    const grid = $("moduleCardsGrid");
    if (!grid) return;
    const b = game.build;
    grid.innerHTML = MODULE_ORDER.map((m) => {
      const schema = MODULE_DESIGN_SCHEMA[m.key];
      const summary = schema.summary(b);
      const mass = schema.mass(b);
      return `
        <button class="module-card-btn" data-open-module="${m.key}">
          <span class="mod-icon">${m.icon}</span>
          <span class="mod-info"><strong>${m.title}</strong><small>${escapeHtml(summary)}</small></span>
          <span class="mod-right"><b>${Number(mass).toFixed(2)}kg</b><span>独立设计 ▸</span></span>
        </button>
      `;
    }).join("");
    grid.querySelectorAll("[data-open-module]").forEach((btn) => {
      btn.addEventListener("click", () => openIndependentStudio(btn.dataset.openModule));
    });
  }

  function computeGodEyeDistance(aspect, fov, pitch, yaw, target) {
    const tanHalfY = Math.tan(fov / 2), tanHalfX = tanHalfY * aspect;
    const dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    const xCam = norm3(cross3([0, 1, 0], dir)), yCam = cross3(dir, xCam);
    let requiredDist = 2.4;
    for (const x of [-0.06, 3.06]) for (const y of [0, 0.30]) for (const z of [-0.06, 2.06]) {
      const rel = [x - target[0], y - target[1], z - target[2]];
      requiredDist = Math.max(requiredDist, dot3(rel, dir) + Math.abs(dot3(rel, xCam)) / (0.93 * tanHalfX), dot3(rel, dir) + Math.abs(dot3(rel, yCam)) / (0.90 * tanHalfY));
    }
    return requiredDist;
  }

  function updateCameraMatrices() {
    const aspect = canvas.width / Math.max(1, canvas.height), fov = (44 * Math.PI) / 180, cam = game.camera;
    if (cam.locked) { cam.yaw = 0; cam.pitch = 1.30; cam.target = [1.5, 0, 1.0]; cam.distance = computeGodEyeDistance(aspect, fov, cam.pitch, cam.yaw, cam.target); }
    const horiz = Math.cos(cam.pitch) * cam.distance;
    const eye = [cam.target[0] + Math.sin(cam.yaw) * horiz, cam.target[1] + Math.sin(cam.pitch) * cam.distance, cam.target[2] + Math.cos(cam.yaw) * horiz];
    game.viewProjection = m4Multiply(m4Perspective(fov, aspect, 0.05, 25), m4LookAt(eye, cam.target, [0, 1, 0]));
  }

  function worldFromPointer(event) {
    const rect = canvas.getBoundingClientRect(), x = ((event.clientX - rect.left) / rect.width) * 2 - 1, y = 1 - ((event.clientY - rect.top) / rect.height) * 2;
    const inverse = m4Invert(game.viewProjection), near = m4Transform(inverse, [x, y, -1, 1]), far = m4Transform(inverse, [x, y, 1, 1]), dir = sub3(far, near);
    return add3(near, scale3(dir, (0.017 - near[1]) / (dir[1] || -0.0001)));
  }

  function pickPiece(point) {
    let best = null, bestDist = 0.068;
    for (let i = 0; i < game.sim.pieces.length; i += 1) { const p = game.sim.pieces[i]; const d = Math.hypot(p.x - point[0], p.z - point[2]); if (d < bestDist) { best = p; bestDist = d; } }
    return best;
  }

  function drawField(withTopTrim = false) {
    drawMesh(meshes.cube, m4Multiply(m4Translation(1.5, -0.04, 1.0), m4Scale(3.08, 0.08, 2.08)), [0.62, 0.74, 0.70]);
    const wallY = FIELD.wallHeight / 2, wt = FIELD.wallThickness, wallColor = [0.76, 0.81, 0.78];
    drawMesh(meshes.cube, m4Multiply(m4Translation(-wt / 2, wallY, 1.0), m4Scale(wt, FIELD.wallHeight, 2.0 + wt * 2)), wallColor);
    drawMesh(meshes.cube, m4Multiply(m4Translation(3.0 + wt / 2, wallY, 1.0), m4Scale(wt, FIELD.wallHeight, 2.0 + wt * 2)), wallColor);
    drawMesh(meshes.cube, m4Multiply(m4Translation(1.5, wallY, -wt / 2), m4Scale(3.0, FIELD.wallHeight, wt)), wallColor);
    drawMesh(meshes.cube, m4Multiply(m4Translation(1.5, wallY, 2.0 + wt / 2), m4Scale(3.0, FIELD.wallHeight, wt)), wallColor);
    if (withTopTrim) {
      const capColor = [0.46, 0.54, 0.52];
      drawMesh(meshes.cube, m4Multiply(m4Translation(-wt / 2, FIELD.wallHeight + 0.0025, 1.0), m4Scale(wt + 0.004, 0.005, 2.0 + wt * 2)), capColor);
      drawMesh(meshes.cube, m4Multiply(m4Translation(3.0 + wt / 2, FIELD.wallHeight + 0.0025, 1.0), m4Scale(wt + 0.004, 0.005, 2.0 + wt * 2)), capColor);
      drawMesh(meshes.cube, m4Multiply(m4Translation(1.5, FIELD.wallHeight + 0.0025, -wt / 2), m4Scale(3.0, 0.005, wt + 0.004)), capColor);
      drawMesh(meshes.cube, m4Multiply(m4Translation(1.5, FIELD.wallHeight + 0.0025, 2.0 + wt / 2), m4Scale(3.0, 0.005, wt + 0.004)), capColor);
    }

    drawMesh(meshes.cube, m4Multiply(m4Translation(0.20, 0.002, 1.0), m4Scale(0.40, 0.004, 0.60)), [0.85, 0.42, 0.45], null, 0.72);
    drawMesh(meshes.cube, m4Multiply(m4Translation(2.80, 0.002, 1.0), m4Scale(0.40, 0.004, 0.60)), [0.42, 0.56, 0.82], null, 0.58);
    drawMesh(meshes.cube, m4Multiply(m4Translation(0.15, 0.002, 1.85), m4Scale(0.30, 0.004, 0.30)), [0.88, 0.72, 0.34], null, 0.65);
    drawMesh(meshes.cube, m4Multiply(m4Translation(2.85, 0.002, 0.15), m4Scale(0.30, 0.004, 0.30)), [0.48, 0.68, 0.86], null, 0.55);
    drawMesh(meshes.cube, m4Multiply(m4Translation(1.5, 0.0015, 1.0), m4Scale(0.60, 0.003, 0.60)), [0.76, 0.74, 0.54], null, 0.48);

    const gridPts = [];
    for (let x = 0; x <= 3.001; x += 0.25) gridPts.push([x, 0.0045, 0], [x, 0.0045, 2.0]);
    for (let z = 0; z <= 2.001; z += 0.25) gridPts.push([0, 0.0045, z], [3.0, 0.0045, z]);
    drawLines(gridPts, [0.32, 0.48, 0.44], 0.24, gl.LINES);

    drawLines([[0, 0.006, 0.70], [0.40, 0.006, 0.70], [0.40, 0.006, 1.30], [0, 0.006, 1.30]], [0.82, 0.22, 0.28], 0.90);
    drawLines([[3.0, 0.006, 0.70], [2.60, 0.006, 0.70], [2.60, 0.006, 1.30], [3.0, 0.006, 1.30]], [0.24, 0.44, 0.78], 0.85);
    drawLines([[1.20, 0.006, 0.70], [1.80, 0.006, 0.70], [1.80, 0.006, 1.30], [1.20, 0.006, 1.30], [1.20, 0.006, 0.70]], [0.75, 0.56, 0.16], 0.75);
    drawLines([[0, 0.006, 1.70], [0.30, 0.006, 1.70], [0.30, 0.006, 2.0]], [0.78, 0.55, 0.14], 0.85);
  }

  function drawVisionCone() {
    const sim = getRenderSimState();
    const vs = sim?.visionState;
    if (!sim || !vs) return;
    const b = game.build, halfFov = ((b.fov * Math.PI) / 180) * 0.5, segs = 20;
    const rMin = Math.max(b.cameraMinRange, vs.nearGroundDist ?? b.cameraMinRange);
    const rMax = Math.max(rMin + 0.05, vs.farGroundDist ?? b.sensorRange);
    let camX = vs.camX, camZ = vs.camZ, camYaw = vs.camYaw;
    if (sim.isReplay && sim.robot) {
      const sR = Math.sin(sim.robot.yaw), cR = Math.cos(sim.robot.yaw);
      camX = sim.robot.x + cR * b.cameraMountX + sR * b.cameraMountZ;
      camZ = sim.robot.z - sR * b.cameraMountX + cR * b.cameraMountZ;
      camYaw = normaliseAngle(sim.robot.yaw + (b.cameraMountYaw * Math.PI) / 180);
    }
    const yCone = 0.009, camEyeY = vs.camY ?? b.cameraHeight;
    const pos = [], norm = [], uv = [], arcOutline = [];
    for (let i = 0; i <= segs; i += 1) {
      const a = camYaw - halfFov + (2 * halfFov * i) / segs;
      const px = clamp(camX + Math.sin(a) * rMax, 0, FIELD.width), pz = clamp(camZ + Math.cos(a) * rMax, 0, FIELD.depth);
      arcOutline.push([px, yCone + 0.002, pz]);
      if (i < segs) {
        const a2 = camYaw - halfFov + (2 * halfFov * (i + 1)) / segs;
        const p1 = [clamp(camX + Math.sin(a) * rMin, 0, FIELD.width), yCone, clamp(camZ + Math.cos(a) * rMin, 0, FIELD.depth)];
        const p2 = [px, yCone, pz];
        const p3 = [clamp(camX + Math.sin(a2) * rMax, 0, FIELD.width), yCone, clamp(camZ + Math.cos(a2) * rMax, 0, FIELD.depth)];
        const p4 = [clamp(camX + Math.sin(a2) * rMin, 0, FIELD.width), yCone, clamp(camZ + Math.cos(a2) * rMin, 0, FIELD.depth)];
        pos.push(...p1, ...p3, ...p2, ...p1, ...p4, ...p3);
        for (let k = 0; k < 6; k += 1) { norm.push(0, 1, 0); uv.push(0.5, 0.5); }
      }
    }
    gl.useProgram(program);
    gl.uniformMatrix4fv(locations.mvp, false, game.viewProjection); gl.uniformMatrix4fv(locations.model, false, m4Identity());
    gl.uniform3fv(locations.color, [0.10, 0.72, 0.65]); gl.uniform3fv(locations.light, [0, 1, 0]);
    gl.uniform1f(locations.alpha, 0.16); gl.uniform1f(locations.hasTexture, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, coneState.position); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.position); gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, coneState.normal); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(norm), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.normal); gl.vertexAttribPointer(locations.normal, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, coneState.uv); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.uv); gl.vertexAttribPointer(locations.uv, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, pos.length / 3);
    drawLines([[vs.camX, camEyeY, vs.camZ], ...arcOutline, [vs.camX, camEyeY, vs.camZ]], [0.08, 0.72, 0.65], 0.55);
  }

  function drawBridgeRod(base, x1, y1, z1, x2, y2, z2, thickness, color) {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.002) return;
    const mx = (x1 + x2) * 0.5, my = (y1 + y2) * 0.5, mz = (z1 + z2) * 0.5;
    const ry = Math.atan2(dx, dz), rx = -Math.atan2(dy, Math.hypot(dx, dz));
    drawMesh(meshes.cube, modelAt(base, mx, my, mz, [thickness, thickness, len], m4Multiply(m4RotateY(ry), m4RotateX(rx))), color);
  }

  function drawCustomPartsOnRobot(base, build, isEnemy = false) {
    if (isEnemy || !Array.isArray(game.customParts)) return;
    game.customParts.forEach((part) => {
      const width = Math.max(0.004, Number(part.width) || 0.08);
      const length = Math.max(0.004, Number(part.length) || 0.08);
      const height = Math.max(0.002, Number(part.height) || 0.04);
      const thickness = clamp(Number(part.thickness) || 0.006, 0.001, Math.min(width, length, height));
      const color = customPartColor(part.color);
      const partBase = m4Multiply(base, m4Multiply(m4Translation(Number(part.x) || 0, Number(part.y) || 0.115, Number(part.z) || 0), m4RotateY(((Number(part.yaw) || 0) * Math.PI) / 180)));
      if (part.template === "bracket") {
        drawMesh(meshes.cube, modelAt(partBase, 0, height * 0.5, -length * 0.5 + thickness * 0.5, [width, height, thickness]), color);
        drawMesh(meshes.cube, modelAt(partBase, 0, thickness * 0.5, 0, [width, thickness, length]), color);
      } else if (part.template === "funnel") {
        drawMesh(meshes.cube, modelAt(partBase, 0, thickness * 0.5, 0, [width * 0.78, thickness, length]), color);
        const sideRot = m4RotateY(Math.PI * 0.12);
        drawMesh(meshes.cube, modelAt(partBase, -width * 0.42, height * 0.5, length * 0.04, [thickness, height, length]), color, null, 0.94);
        drawMesh(meshes.cube, modelAt(partBase, width * 0.42, height * 0.5, length * 0.04, [thickness, height, length], sideRot), color, null, 0.94);
      } else if (part.template === "connector") {
        drawMesh(meshes.cube, modelAt(partBase, 0, height * 0.5, 0, [width, height, length]), color);
        drawMesh(meshes.cylinder, modelAt(partBase, -width * 0.28, height + 0.006, 0, [0.006, 0.012, 0.006]), [0.92, 0.76, 0.30]);
        drawMesh(meshes.cylinder, modelAt(partBase, width * 0.28, height + 0.006, 0, [0.006, 0.012, 0.006]), [0.92, 0.76, 0.30]);
      } else if (part.template === "plate") {
        drawMesh(meshes.cube, modelAt(partBase, 0, height * 0.5, 0, [width, height, length]), color);
      } else {
        drawMesh(meshes.cube, modelAt(partBase, 0, height * 0.5, 0, [width, height, length]), color);
        drawMesh(meshes.cube, modelAt(partBase, 0, height + thickness * 0.25, 0, [width * 0.78, thickness * 0.5, length * 0.78]), [Math.min(1, color[0] * 1.15), Math.min(1, color[1] * 1.15), Math.min(1, color[2] * 1.15)]);
      }
    });
  }

  function drawSingleRobotModel(robot, build, isFirstPersonOwn, isEnemy = false) {
    const base = m4Multiply(m4Translation(robot.x, 0, robot.z), m4RotateY(robot.yaw));
    const hw = build.width / 2, hl = build.length / 2;
    const botY = build.groundClearance, topY = botY + build.height;
    const hullColor = isEnemy ? [0.84, 0.88, 0.94] : build.chassisColor;
    const metalColor = [0.46, 0.54, 0.58], brassColor = [0.84, 0.68, 0.24];

    // 1. 真实结构底盘装配 (开放双层铜柱 / 桁架 / 全包箱体 + 前倒角护条)
    if (build.frameStyle === "monocoque") {
      drawMesh(meshes.cube, modelAt(base, 0, botY + build.height * 0.5, 0, [build.width, build.height, build.length]), hullColor);
    } else {
      const plateT = 0.005;
      drawMesh(meshes.cube, modelAt(base, 0, botY + plateT * 0.5, 0, [build.width, plateT, build.length]), hullColor);
      drawMesh(meshes.cube, modelAt(base, 0, topY - plateT * 0.5, 0, [build.width * 0.96, plateT, build.length * 0.96]), hullColor);
      const colH = Math.max(0.006, build.height - plateT);
      const px = hw * 0.84, pz = hl * 0.84;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        drawMesh(meshes.cylinder, modelAt(base, sx * px, (botY + topY) * 0.5, sz * pz, [0.005, colH, 0.005]), metalColor);
      }
      if (build.frameStyle === "truss_frame") {
        drawBridgeRod(base, -px, botY, -pz, px, topY, pz, 0.005, metalColor);
        drawBridgeRod(base, px, botY, -pz, -px, topY, pz, 0.005, metalColor);
      }
    }
    if ((build.frontChamfer || 0) > 0.004) {
      const ch = Math.min(build.frontChamfer, hw * 0.68, hl * 0.68);
      for (const sx of [-1, 1]) {
        drawBridgeRod(base, sx * hw, (botY + topY) * 0.5, hl - ch, sx * (hw - ch), (botY + topY) * 0.5, hl, 0.007, metalColor);
      }
    }

    // 2. 独立传动轴系 + 轴承立柱支座 + 独立前后轮半径/轮距 + 驱动电机与减速箱
    const fWz = build.wheelOffsetZ + build.wheelbase / 2, rWz = build.wheelOffsetZ - build.wheelbase / 2;
    const fRad = build.frontWheelRadius || build.wheelRadius, rRad = build.rearWheelRadius || build.wheelRadius;
    const fTrack = build.frontTrack || build.track, rTrack = build.rearTrack || build.track;
    const wheelColor = (build.driveMode === "mecanum") ? [0.16, 0.20, 0.24] : (build.driveMode === "omni") ? [0.22, 0.24, 0.28] : [0.08, 0.10, 0.11];

    // 真实前后钢制车轴 + 与底板相连的悬挂支座
    drawBridgeRod(base, -rTrack / 2, rRad, rWz, rTrack / 2, rRad, rWz, 0.006, metalColor);
    drawBridgeRod(base, -hw * 0.72, botY, clamp(rWz, -hl, hl), -hw * 0.72, rRad, rWz, 0.008, metalColor);
    drawBridgeRod(base, hw * 0.72, botY, clamp(rWz, -hl, hl), hw * 0.72, rRad, rWz, 0.008, metalColor);

    if (build.driveMode !== "rwd_caster") {
      drawBridgeRod(base, -fTrack / 2, fRad, fWz, fTrack / 2, fRad, fWz, 0.006, metalColor);
      drawBridgeRod(base, -hw * 0.72, botY, clamp(fWz, -hl, hl), -hw * 0.72, fRad, fWz, 0.008, metalColor);
      drawBridgeRod(base, hw * 0.72, botY, clamp(fWz, -hl, hl), hw * 0.72, fRad, fWz, 0.008, metalColor);
    }

    const drawWheelUnit = (wx, wy, wz, rad) => {
      drawMesh(meshes.cylinder, modelAt(base, wx, wy, wz, [rad, build.wheelWidth, rad], m4RotateZ(Math.PI / 2)), wheelColor);
      if (build.driveMode !== "diff" && build.driveMode !== "rwd_caster") {
        drawMesh(meshes.cylinder, modelAt(base, wx + Math.sign(wx) * (build.wheelWidth * 0.55), wy, wz, [rad * 0.62, 0.004, rad * 0.62], m4RotateZ(Math.PI / 2)), isEnemy ? [0.46, 0.72, 0.96] : [0.85, 0.72, 0.28]);
      }
    };
    drawWheelUnit(-rTrack / 2, rRad, rWz, rRad);
    drawWheelUnit(rTrack / 2, rRad, rWz, rRad);
    if (build.driveMode === "rwd_caster") {
      drawBridgeRod(base, 0, botY, clamp(fWz, -hl, hl), 0, fRad, fWz, 0.010, metalColor);
      drawMesh(meshes.cylinder, modelAt(base, 0, fRad, fWz, [fRad * 0.85, build.wheelWidth * 0.7, fRad * 0.85], m4RotateZ(Math.PI / 2)), [0.34, 0.40, 0.44]);
    } else {
      drawWheelUnit(-fTrack / 2, fRad, fWz, fRad);
      drawWheelUnit(fTrack / 2, fRad, fWz, fRad);
    }

    // 真实电机缸 + 铝制减速箱装配（1~8 独立电机按轴位挂装）
    const mCount = Math.max(1, build.motorCount || 2);
    const mZ = build.motorMountZ ?? -0.04;
    const mY = clamp(botY + 0.015, Math.min(rRad, fRad), topY - 0.012);
    for (let mi = 0; mi < mCount; mi += 1) {
      const side = mi % 2 === 0 ? -1 : 1;
      const tier = Math.floor(mi / 2);
      const axZ = mCount >= 4 ? (tier % 2 === 0 ? rWz : fWz) : mZ;
      const axY = mCount >= 4 ? (tier % 2 === 0 ? rRad : fRad) : mY;
      const mSpan = (mCount >= 4 ? (tier % 2 === 0 ? rTrack : fTrack) : hw * 1.45) * 0.30;
      drawMesh(meshes.cylinder, modelAt(base, side * mSpan, axY, axZ, [0.014, 0.044, 0.014], m4RotateZ(Math.PI / 2)), [0.24, 0.26, 0.30]);
      drawMesh(meshes.cube, modelAt(base, side * (mSpan + 0.024), axY, axZ, [0.018, 0.024, 0.024]), metalColor);
      drawBridgeRod(base, side * clamp(mSpan, -hw, hw), botY, clamp(axZ, -hl, hl), side * mSpan, axY, axZ, 0.006, metalColor);
    }

    // 3. 独立主控板 + 4 根黄铜 M3 铜柱锚固到底盘表面
    const ctrlX = build.ctrlMountX ?? -0.02, ctrlY = build.ctrlMountY ?? (topY + 0.012), ctrlZ = build.ctrlMountZ ?? -0.025;
    const ctrlAnchorY = ctrlY >= topY - 0.005 ? topY : botY;
    const ctrlRot = m4RotateY(((build.ctrlYaw || 0) * Math.PI) / 180);
    drawMesh(meshes.cube, modelAt(base, ctrlX, ctrlY, ctrlZ, [0.068, 0.006, 0.072], ctrlRot), isEnemy ? [0.22, 0.42, 0.78] : [0.12, 0.48, 0.40]);
    drawMesh(meshes.cube, modelAt(base, ctrlX, ctrlY + 0.008, ctrlZ, [0.032, 0.010, 0.032], ctrlRot), [0.18, 0.22, 0.25]);
    for (const sx of [-0.026, 0.026]) for (const sz of [-0.026, 0.026]) {
      const rxP = ctrlX + sx, rzP = ctrlZ + sz;
      drawBridgeRod(base, clamp(rxP, -hw * 0.92, hw * 0.92), ctrlAnchorY, clamp(rzP, -hl * 0.92, hl * 0.92), rxP, ctrlY - 0.002, rzP, 0.004, brassColor);
    }

    // 4. 独立动力电池 + 托盘与绑带 + 锚固支座 (随配重坐标实时移动)
    const batX = build.battMountX ?? 0.035, batY = build.battMountY ?? (topY + 0.014), batZ = build.cgOffsetZ ?? -0.025;
    const batAnchorY = batY >= topY - 0.005 ? topY : botY;
    const batRot = m4RotateY(((build.battYaw || 0) * Math.PI) / 180);
    drawMesh(meshes.cube, modelAt(base, batX, batY, batZ, [0.048, 0.024, 0.078], batRot), isEnemy ? [0.28, 0.34, 0.56] : [0.46, 0.28, 0.54]);
    drawMesh(meshes.cube, modelAt(base, batX, batY, batZ - 0.018, [0.052, 0.026, 0.009], batRot), [0.12, 0.14, 0.16]);
    drawMesh(meshes.cube, modelAt(base, batX, batY, batZ + 0.018, [0.052, 0.026, 0.009], batRot), [0.12, 0.14, 0.16]);
    drawBridgeRod(base, clamp(batX, -hw * 0.9, hw * 0.9), batAnchorY, clamp(batZ, -hl * 0.9, hl * 0.9), batX, batY - 0.010, batZ, 0.009, metalColor);

    // 5. 独立机械急停按钮 (自带金属安装座)
    const eX = build.eStopMountX ?? (-hw * 0.56), eZ = build.eStopMountZ ?? (-hl * 0.64);
    drawBridgeRod(base, clamp(eX, -hw * 0.92, hw * 0.92), topY, clamp(eZ, -hl * 0.92, hl * 0.92), eX, topY + 0.005, eZ, 0.010, metalColor);
    drawMesh(meshes.cylinder, modelAt(base, eX, topY + 0.016, eZ, [0.013, 0.018, 0.013]), [0.92, 0.20, 0.24]);

    // 6. 独立车载视觉相机 + 悬臂 L 型金属立柱云台（任意外探绝不悬空）
    if (!isFirstPersonOwn) {
      const camY = build.cameraHeight;
      const anchorX = clamp(build.cameraMountX, -hw * 0.88, hw * 0.88);
      const anchorZ = clamp(build.cameraMountZ, -hl * 0.88, hl * 0.88);
      drawBridgeRod(base, anchorX, topY, anchorZ, anchorX, camY, anchorZ, 0.010, [0.22, 0.32, 0.36]);
      drawBridgeRod(base, anchorX, camY, anchorZ, build.cameraMountX, camY, build.cameraMountZ, 0.009, metalColor);
      const camRot = m4Multiply(m4RotateY((build.cameraMountYaw * Math.PI) / 180), m4RotateX((-build.cameraPitch * Math.PI) / 180));
      const camFrame = m4Multiply(base, m4Multiply(m4Translation(build.cameraMountX, camY, build.cameraMountZ), camRot));
      drawMesh(meshes.cube, m4Multiply(camFrame, m4Scale(0.068, 0.026, 0.040)), isEnemy ? [0.26, 0.50, 0.88] : [0.16, 0.58, 0.84]);
      drawMesh(meshes.cylinder, m4Multiply(m4Multiply(camFrame, m4Translation(0, 0, 0.024)), m4Multiply(m4RotateX(Math.PI / 2), m4Scale(0.011, 0.016, 0.011))), [0.08, 0.12, 0.15]);
    }

    // 7. 独立前向安全激光塔座 & 实景激光射线
    const lmx = build.laserMountX ?? 0, lmy = build.laserMountY ?? (topY + 0.018), lmz = build.laserMountZ ?? (hl * 0.84);
    const lAnX = clamp(lmx, -hw * 0.9, hw * 0.9), lAnZ = clamp(lmz, -hl * 0.9, hl * 0.9);
    drawBridgeRod(base, lAnX, topY, lAnZ, lAnX, lmy, lAnZ, 0.008, metalColor);
    drawBridgeRod(base, lAnX, lmy, lAnZ, lmx, lmy, lmz, 0.008, metalColor);
    drawMesh(meshes.cylinder, modelAt(base, lmx, lmy + 0.004, lmz, [0.012, 0.016, 0.012]), build.laserPowerMw > 1.0 ? [1.0, 0.14, 0.14] : [0.92, 0.42, 0.22]);

    if (!isFirstPersonOwn && !isEnemy && game.sim?.sensors?.laser?.rays?.length) {
      const sR = Math.sin(robot.yaw), cR = Math.cos(robot.yaw);
      const lx0 = robot.x + cR * lmx + sR * lmz;
      const lz0 = robot.z - sR * lmx + cR * lmz;
      game.sim.sensors.laser.rays.forEach((ray) => {
        const ryaw = normaliseAngle(robot.yaw + (ray.angleDeg * Math.PI) / 180);
        const rlen = Math.min(ray.dist, 1.35);
        drawLines([[lx0, lmy + 0.005, lz0], [lx0 + Math.sin(ryaw) * rlen, 0.032, lz0 + Math.cos(ryaw) * rlen]], ray.hitType === "robot" ? [1.0, 0.65, 0.15] : [0.95, 0.25, 0.30], 0.36);
      });
    }

    // 8. 独立前推斗与左右非对称侧翼（带真实可伸缩斜拉支架，离地高度 deviceMountY 可调）
    const frontZ = hl + build.deviceOffset, dw = build.deviceWidth, devX = build.deviceMountX || 0;
    const devY0 = build.deviceMountY ?? 0.002, devH = build.deviceHeight ?? 0.056, devCenterY = devY0 + devH * 0.5;
    const dc = isEnemy ? [0.36, 0.62, 0.96] : build.deviceColor;
    const spanArm = Math.min(hw * 0.72, dw * 0.34);
    const chassisJointY = clamp((botY + topY) * 0.5, botY + 0.006, topY - 0.006);
    drawBridgeRod(base, -spanArm, chassisJointY, hl - 0.006, devX - spanArm, devCenterY, frontZ, 0.011, [0.26, 0.34, 0.36]);
    drawBridgeRod(base, spanArm, chassisJointY, hl - 0.006, devX + spanArm, devCenterY, frontZ, 0.011, [0.26, 0.34, 0.36]);
    drawMesh(meshes.cube, modelAt(base, devX, devCenterY, frontZ, [dw, devH, 0.016]), dc);

    // 独立左翼 & 右翼几何拼接
    const lDepth = build.leftWingDepth ?? build.wingDepth ?? 0;
    const rDepth = build.rightWingDepth ?? build.wingDepth ?? 0;
    const lSplayRad = ((build.leftWingSplay ?? build.wingSplayAngle ?? 0) * Math.PI) / 180;
    const rSplayRad = ((build.rightWingSplay ?? build.wingSplayAngle ?? 0) * Math.PI) / 180;
    if (lDepth > 0.003) {
      const lcx = devX - dw / 2 - (lDepth * 0.5) * Math.sin(lSplayRad);
      const lcz = frontZ + (lDepth * 0.5) * Math.cos(lSplayRad);
      drawMesh(meshes.cube, modelAt(base, lcx, devCenterY, lcz, [0.014, devH * 0.94, lDepth], m4RotateY(-lSplayRad)), dc);
    }
    if (rDepth > 0.003) {
      const rcx = devX + dw / 2 + (rDepth * 0.5) * Math.sin(rSplayRad);
      const rcz = frontZ + (rDepth * 0.5) * Math.cos(rSplayRad);
      drawMesh(meshes.cube, modelAt(base, rcx, devCenterY, rcz, [0.014, devH * 0.94, rDepth], m4RotateY(rSplayRad)), dc);
    }
    if (build.dividerCount > 0 && Math.max(lDepth, rDepth) > 0.005) {
      for (let di = 1; di <= build.dividerCount; di += 1) {
        const dx = devX + (-dw * 0.5 + (dw * di) / (build.dividerCount + 1));
        drawMesh(meshes.cube, modelAt(base, dx, devCenterY, frontZ + build.wingTipForward * 0.45, [0.010, devH * 0.90, Math.max(lDepth, rDepth) * 0.88]), dc);
      }
    }
    if (build.deviceKind === "active_roller") {
      drawMesh(meshes.cylinder, modelAt(base, devX, devCenterY + 0.004, frontZ + 0.018, [0.016, Math.max(0.02, dw - 0.02), 0.016], m4RotateZ(Math.PI / 2)), [0.14, 0.72, 0.56]);
      drawMesh(meshes.cylinder, modelAt(base, devX + dw * 0.5 - 0.004, devCenterY + 0.004, frontZ + 0.018, [0.012, 0.022, 0.012], m4RotateZ(Math.PI / 2)), [0.22, 0.26, 0.30]);
    }
    if (build.deviceKind === "brush") {
      for (let idx = -3; idx <= 3; idx += 1) drawMesh(meshes.cube, modelAt(base, devX + (idx * dw) / 8, devY0 + 0.018, frontZ + 0.012, [0.007, Math.min(devH, 0.036), 0.018]), [0.28, 0.48, 0.88]);
    }

    drawCustomPartsOnRobot(base, build, isEnemy);
  }

  function drawRobot(isFirstPersonPass = false) {
    const sim = getRenderSimState();
    if (!sim) return;
    drawSingleRobotModel(sim.robot, game.build, isFirstPersonPass, false);
    if (sim.matchMode === "versus" && sim.enemyRobot && sim.enemyBuild) {
      drawSingleRobotModel(sim.enemyRobot, sim.enemyBuild, false, true);
    }
  }

  function drawPieces(isFirstPersonPass = false) {
    const sim = getRenderSimState();
    if (!sim) return;
    const visibleIds = sim.visionVisibleIds || new Set();
    for (let i = 0; i < sim.pieces.length; i += 1) {
      const p = sim.pieces[i];
      const inView = visibleIds.has(p.id);
      const bodyModel = m4Multiply(m4Translation(p.x, PIECE_HEIGHT / 2 + 0.001, p.z), m4Scale(p.radius, PIECE_HEIGHT, p.radius));
      // 真实黑色哑光棋体
      drawMesh(meshes.cylinder, bodyModel, [0.09, 0.10, 0.12]);
      const topModel = m4Multiply(m4Translation(p.x, PIECE_HEIGHT + 0.0014, p.z), m4Scale(p.radius * 1.92, 1, p.radius * 1.92));
      drawMesh(meshes.plane, topModel, [1, 1, 1], createPieceTexture(p));

      if (!isFirstPersonPass) {
        if (p.scored) {
          drawMesh(meshes.cylinder, m4Multiply(m4Translation(p.x, 0.004, p.z), m4Scale(p.radius * 1.24, 0.004, p.radius * 1.24)), [0.18, 0.85, 0.62]);
        } else if (p.id === sim.targetId) {
          drawMesh(meshes.cylinder, m4Multiply(m4Translation(p.x, 0.004, p.z), m4Scale(p.radius * 1.32, 0.004, p.radius * 1.32)), [0.98, 0.74, 0.22]);
        } else if (inView) {
          drawMesh(meshes.cylinder, m4Multiply(m4Translation(p.x, 0.0035, p.z), m4Scale(p.radius * 1.22, 0.003, p.radius * 1.22)), [0.08, 0.78, 0.72]);
        }
      }
    }
  }

  function drawRoute() {
    const sim = getRenderSimState();
    if (!sim) return;
    if (game.controlMode === "code" && Array.isArray(sim.waypoints) && sim.waypoints.length > 0) {
      const pts = [[sim.robot.x, 0.016, sim.robot.z]];
      for (let i = 0; i < sim.waypoints.length; i += 1) {
        const wp = sim.waypoints[i];
        if (wp && Number.isFinite(wp.x) && Number.isFinite(wp.z)) pts.push([wp.x, 0.016, wp.z]);
      }
      if (pts.length >= 2) {
        drawLines(pts, [0.95, 0.65, 0.14], 0.92);
        for (let i = 1; i < pts.length; i += 1) drawMesh(meshes.cylinder, m4Multiply(m4Translation(pts[i][0], 0.018, pts[i][2]), m4Scale(0.018, 0.006, 0.018)), [0.98, 0.72, 0.18]);
      }
    }
    if (sim.trail.length > 1) drawLines(sim.trail.map((pt) => [pt.x, 0.010, pt.z]), [0.18, 0.66, 0.56], 0.45);
  }

  function drawPhysicsVectors() {
    if (!game.showPhysicsVectors) return;
    const sim = getRenderSimState();
    if (!sim || !sim.robot) return;
    const r = sim.robot, b = game.build;

    // 1. 瞬时合速度矢量 (青色)
    const sR = Math.sin(r.yaw), cR = Math.cos(r.yaw);
    const rvx = sR * (r.speed || 0) + cR * (r.strafeSpeed || 0);
    const rvz = cR * (r.speed || 0) - sR * (r.strafeSpeed || 0);
    const speedMag = Math.hypot(rvx, rvz);
    if (speedMag > 0.04) {
      const scale = clamp(speedMag * 0.42, 0.06, 0.44);
      const vxNorm = rvx / speedMag, vzNorm = rvz / speedMag;
      const tipX = r.x + vxNorm * scale, tipZ = r.z + vzNorm * scale;
      drawLines([[r.x, b.height + 0.035, r.z], [tipX, b.height + 0.035, tipZ]], [0.12, 0.85, 0.68], 0.95);
      drawMesh(meshes.cylinder, m4Multiply(m4Translation(tipX, b.height + 0.035, tipZ), m4Scale(0.016, 0.008, 0.016)), [0.12, 0.90, 0.70]);
    }

    // 2. 接触反推合力矢量 (橙琥珀色)
    const fMag = sim.contactForce || 0;
    const fv = sim.forceVec || { x: 0, z: 0 };
    const fVecMag = Math.hypot(fv.x || 0, fv.z || 0);
    if (fMag > 0.25 && fVecMag > 0.01) {
      const fLen = clamp(fMag * 0.016, 0.08, 0.52);
      const frontX = r.x + Math.sin(r.yaw) * (b.length * 0.52);
      const frontZ = r.z + Math.cos(r.yaw) * (b.length * 0.52);
      const fxNorm = fv.x / fVecMag, fzNorm = fv.z / fVecMag;
      const endX = frontX + fxNorm * fLen, endZ = frontZ + fzNorm * fLen;
      drawLines([[frontX, 0.052, frontZ], [endX, 0.052, endZ]], [0.98, 0.58, 0.14], 0.96);
      drawMesh(meshes.cylinder, m4Multiply(m4Translation(endX, 0.052, endZ), m4Scale(0.020, 0.010, 0.020)), [0.98, 0.58, 0.14]);
    }

    // 3. 轮面打滑越限环光晕 (牵引超限时红圈警示)
    if ((sim.wheelSlip || 0) > 0.08) {
      const haloR = Math.max(b.length, b.width) * 0.62;
      drawMesh(
        meshes.cylinder,
        m4Multiply(m4Translation(r.x, 0.006, r.z), m4Scale(haloR, 0.005, haloR)),
        [0.95, 0.26, 0.22],
        null,
        clamp(0.22 + sim.wheelSlip * 0.42, 0.22, 0.62)
      );
    }
  }

  function drawScene() {
    gl.clearColor(0.84, 0.90, 0.87, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawField();
    drawVisionCone();
    drawRoute();
    drawPieces();
    drawRobot();
    drawPhysicsVectors();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height); }
  }

  function updateDetectionPanel() {
    const list = $("detectionList"), summary = $("perceptionSummary"), vs = game.sim.visionState;
    const memAll = Array.from(game.sim.perceivedMap.values());
    const inViewCount = vs ? vs.visible.length : 0;
    const memRed = memAll.filter((p) => p.side === "red" && !p.scored);
    const unseenTotal = vs ? vs.unseenTotalCount : 32;
    if (summary) summary.textContent = `当前视野 ${inViewCount} 枚 · 视觉记忆 ${memAll.length} 枚 · 未知盲区 ${unseenTotal} 枚`;
    $("detectionCount").textContent = `${inViewCount} IN VIEW`;
    const displayList = (game.externalDetections || memRed).slice().sort((a, b) => (b.inView ? 1 : 0) - (a.inView ? 1 : 0) || (b.value || 0) - (a.value || 0));
    if (!displayList.length) { list.innerHTML = '<div class="empty-state">相机视野与记忆库暂无待拿红子，运行后小车将巡航扫描</div>'; return; }
    list.innerHTML = displayList.slice(0, 7).map((p) => `
      <div class="detection-row">
        <strong>${p.inView ? "📷 视野内" : "🧠 记忆"} · ${p.symbol || p.label || "棋子"}</strong>
        <b>${Math.round((Number(p.confidence) || 0.9) * 100)}%</b>
        <small>${p.value ? `${p.value} 分 · ` : ""}观测 (${Math.round((p.x || 0) * 1000)}, ${Math.round((p.z || 0) * 1000)}) mm</small>
      </div>
    `).join("");
  }

  function updateScoredChips() {
    const root = $("scoredChips"), sim = getRenderSimState();
    if (!root || !sim) return;
    const scored = sim.pieces.filter((p) => p.side === "red" && p.scored).sort((a, b) => b.value - a.value);
    $("scoredCountBadge").textContent = String(scored.length);
    if (!scored.length) { root.innerHTML = '<span class="empty-state">尚无红方棋子完整进入甲方球门区</span>'; return; }
    root.innerHTML = scored.map((p) => `<span class="scored-chip">${p.symbol} <em>+${p.value}</em></span>`).join("");
  }

  function updateHud() {
    const sim = getRenderSimState(), liveSim = game.sim;
    if (!sim || !liveSim) return;
    $("velocityTelemetry").textContent = fmt(Math.hypot(sim.robot.speed, sim.robot.strafeSpeed));
    $("omegaTelemetry").textContent = fmt(sim.robot.omega);
    $("forceTelemetry").textContent = fmt(sim.contactForce, 1);
    $("pieceTelemetry").textContent = String(sim.collected);
    $("scoreTelemetry").textContent = String(sim.score);
    if ($("unseenTelemetry")) $("unseenTelemetry").textContent = String(liveSim.visionState ? liveSim.visionState.unseenRedCount : 16);
    $("poseTelemetry").textContent = `X ${fmt(sim.robot.x, 2)} · Z ${fmt(sim.robot.z, 2)} · YAW ${fmt((sim.robot.yaw * 180) / Math.PI, 0)}° · ${sim.isReplay ? "REPLAY" : (game.controlMode === "code" ? "VISION" : "MANUAL")}`;
    $("contactValue").textContent = `${fmt(sim.contactForce, 1)} N`;
    $("frictionValue").textContent = fmt(game.physicsEnv.friction, 2);

    const tractEl = $("tractionTelemetry"), slipEl = $("slipTelemetry");
    const tractPct = Math.round(sim.tractionPct || 0);
    const slipPct = Math.round((sim.wheelSlip || 0) * 100);
    if (tractEl) { tractEl.textContent = `${tractPct}%`; tractEl.classList.toggle("warn", tractPct >= 90); }
    if (slipEl) { slipEl.textContent = `${slipPct}%`; slipEl.classList.toggle("warn", slipPct >= 12); }
    if ($("peakForceTelemetry")) $("peakForceTelemetry").textContent = `${fmt(liveSim.peakContactForce ?? sim.contactForce ?? 0, 1)} N`;
    if ($("energyTelemetry")) $("energyTelemetry").textContent = `${Math.round(sim.energyJ || 0)} J`;

    const snaps = liveSim.snapshots || [];
    const scrubber = $("replayScrubber"), rLabel = $("replayTimeLabel");
    if (scrubber) {
      scrubber.max = String(Math.max(0, snaps.length - 1));
      scrubber.value = game.replayIndex == null ? scrubber.max : String(clamp(game.replayIndex, 0, Math.max(0, snaps.length - 1)));
    }
    if (rLabel) rLabel.textContent = sim.isReplay ? `REPLAY · ${fmt(sim.time, 1)}s` : `LIVE · ${fmt(liveSim.time, 1)}s`;

    const mins = Math.floor(sim.time / 60), secs = sim.time % 60;
    $("simClock").textContent = `T+${String(mins).padStart(2, "0")}:${fmt(secs, 1).padStart(4, "0")} / 02:00`;
    const target = liveSim.perceivedMap.get(sim.targetId);
    $("targetHud").textContent = `${sim.isReplay ? "[回放] " : ""}${target ? `锁定:${target.symbol}(${target.value}分) · ${sim.phase}` : `阶段:${sim.phase}`}`;

    const isVs = liveSim.matchMode === "versus";
    if ($("versusHudPill")) { $("versusHudPill").hidden = !isVs; $("versusHudPill").textContent = `甲 ${sim.score} : ${sim.enemyScore} 乙`; }
    if ($("versusHudDivider")) $("versusHudDivider").hidden = !isVs;
    if ($("versusCompareBar")) $("versusCompareBar").hidden = !isVs;
    if (isVs && $("versusScoreDiff") && $("versusTieInfo")) {
      $("versusScoreDiff").textContent = `甲 ${sim.score} : ${sim.enemyScore} 乙 (${sim.collected}:${sim.enemyCollected}枚)`;
      const massDiff = (liveSim.enemyBuild?.totalMass || 1.63) - game.build.totalMass;
      const verdict = sim.score > sim.enemyScore ? "甲队领先" : sim.score < sim.enemyScore ? "乙队暂时领先"
        : (massDiff > 0 ? `同分将先金球，质量轻 ${massDiff.toFixed(2)}kg 占优` : "同分将先金球加赛");
      $("versusTieInfo").textContent = liveSim.resetCount > 0 ? `${verdict} · 互卡复位${liveSim.resetCount}次` : verdict;
    }

    if (liveSim.time >= MATCH_DURATION && game.running) {
      setRunning(false);
      if (isVs) {
        const resTxt = liveSim.score > liveSim.enemyScore ? "🏆 甲队常规赛胜出"
          : liveSim.score < liveSim.enemyScore ? "乙队暂胜，请优化代码或硬件"
            : `平局 (${liveSim.score}:${liveSim.enemyScore}) -> 按国赛规则进入60s金球加赛/轻量(${game.build.totalMass.toFixed(2)}kg)决胜`;
        addLog(`⏱ 120秒对抗结束！甲 ${liveSim.score}分 : 乙 ${liveSim.enemyScore}分 · ${resTxt}`);
      } else {
        addLog(`⏱ 120秒比赛结束！纯视觉实测得分：${liveSim.score} / 45 分（入区 ${liveSim.collected} 枚，峰推力 ${fmt(liveSim.peakContactForce, 1)}N，打滑 ${liveSim.slipEvents} 次，整车 ${game.build.totalMass.toFixed(2)} kg）`);
      }
    }
    $("planStatus").textContent = game.strategyError ? `代码运行异常：${game.strategyError}`
      : sim.isReplay ? `时序回放视角 T=${fmt(sim.time, 2)}s（点击「回到最新」或开始仿真恢复实时）`
        : game.controlMode === "code" ? `纯车载视觉闭环 · 阶段 [${sim.phase}]${target ? ` → ${target.symbol}` : ""}`
          : "当前为手动驾驶模式 (WASD / 方向键)";

    updateDetectionPanel();
    updateScoredChips();
    drawPhysicsScope();
  }

  function updatePartsReadouts() {
    const b = game.build, comp = checkCompliance(b, game.unrestrictedMode);
    $("specMass").textContent = `${b.totalMass.toFixed(2)} kg`;
    $("specEnvelope").textContent = `${Math.round(b.envelopeLength * 1000)}×${Math.round(b.envelopeWidth * 1000)}×${Math.round(b.envelopeHeight * 1000)}`;
    $("specMaxSpeed").textContent = `${b.maxSpeed.toFixed(2)} m/s`;
    if ($("specVision")) $("specVision").textContent = `${Math.round(b.fov)}° / ${b.sensorRange.toFixed(2)}m`;
    if ($("unrestrictedModeBox")) $("unrestrictedModeBox").checked = game.unrestrictedMode;

    const pill = $("compliancePill"), msg = $("complianceMsg");
    if (game.unrestrictedMode) {
      pill.textContent = "无限制模式"; pill.className = "status-pill mint"; msg.className = "compliance-msg";
      const fitText = b.assemblyNotes.length ? b.assemblyNotes.join("；") : `10大硬件 + ${game.customParts.length}件自定义 CAD 独立装配完毕`;
      msg.textContent = `无限制自由组装已激活 · 轴荷前${b.frontAxlePct}:后${b.rearAxlePct} / 左${b.leftAxlePct}:右${b.rightAxlePct} · ${fitText}`;
    } else if (comp.ok) {
      pill.textContent = "合规通过"; pill.className = "status-pill mint"; msg.className = "compliance-msg";
      msg.textContent = `整车尺寸 ≤300mm、重量 ${b.totalMass.toFixed(2)}kg ≤2.50kg、激光 ${b.laserPowerMw.toFixed(2)}mW ≤1mW，全部合规。`;
    } else {
      pill.textContent = "国赛超限提示"; pill.className = "status-pill danger"; msg.className = "compliance-msg warn";
      msg.textContent = `规则超限参考 (仍可自由运行)：${comp.issues.join("；")}`;
    }
    if ($("camMountBadge")) $("camMountBadge").textContent = `${Math.round(b.fov)}° · ${Math.round(b.cameraPitch)}°俯仰`;
    if ($("cameraViewMeta")) $("cameraViewMeta").textContent = `机高 ${Math.round(b.cameraHeight * 1000)}mm · 俯仰 ${Math.round(b.cameraPitch)}° · 上下拖动画面可调镜头视角`;
    const qH = $("quickCamHeight"), qHv = $("quickCamHeightVal"), qP = $("quickCamPitch"), qPv = $("quickCamPitchVal");
    if (qH) {
      const hMm = Math.round(b.cameraHeight * 1000);
      if (hMm > Number(qH.max)) qH.max = String(hMm);
      if (hMm < Number(qH.min)) qH.min = String(hMm);
      qH.value = String(hMm);
    }
    if (qHv) qHv.textContent = `${Math.round(b.cameraHeight * 1000)} mm`;
    if (qP) {
      const pDeg = Math.round(b.cameraPitch);
      if (pDeg > Number(qP.max)) qP.max = String(pDeg);
      if (pDeg < Number(qP.min)) qP.min = String(pDeg);
      qP.value = String(pDeg);
    }
    if (qPv) qPv.textContent = `${Math.round(b.cameraPitch)}°`;
  }

  function setRunning(running) {
    if (running) game.replayIndex = null;
    game.running = running;
    $("runGameButton").textContent = running ? "❚❚ 暂停仿真" : "▶ 开始仿真";
    $("runStatePill").textContent = running ? "RUNNING" : "PAUSED";
    $("runStatePill").classList.toggle("mint", running);
    addLog(running ? `仿真运行中 (${game.speedMultiplier}× · ${game.controlMode === "code" ? "纯车载视觉闭环" : "手动驾驶"})` : "仿真已暂停");
  }

  // =========================
  // 9B. 真实物理实验室 · 示波器 · 时序回放 · 对照研究与讨论
  // =========================
  function syncPhysicsSlidersUi() {
    const env = game.physicsEnv;
    if ($("physPresetSelect")) $("physPresetSelect").value = game.physicsPresetId || "custom";
    if ($("physFrictionRange")) $("physFrictionRange").value = String(env.friction);
    if ($("physFrictionLabel")) $("physFrictionLabel").textContent = fmt(env.friction, 2);
    if ($("physRestitutionRange")) $("physRestitutionRange").value = String(env.restitution);
    if ($("physRestitutionLabel")) $("physRestitutionLabel").textContent = fmt(env.restitution, 2);
    if ($("physPieceMassRange")) $("physPieceMassRange").value = String(Math.round(env.pieceMassKg * 1000));
    if ($("physMassLabel")) $("physMassLabel").textContent = `${Math.round(env.pieceMassKg * 1000)}g`;
    if ($("frictionValue")) $("frictionValue").textContent = fmt(env.friction, 2);
    if ($("togglePhysicsVectorsBox")) $("togglePhysicsVectorsBox").checked = game.showPhysicsVectors;
  }

  function syncSimPhysicsEnv() {
    if (game.sim) {
      game.sim.physics = { ...game.physicsEnv };
      game.sim.friction = game.physicsEnv.friction;
      game.sim.tractionMaxN = computeTractionLimitN(game.build, game.sim.physics);
    }
    syncPhysicsSlidersUi();
    updateHud();
  }

  function applyPhysicsPreset(presetId) {
    const p = PHYSICS_PRESETS[presetId];
    if (!p) return;
    game.physicsPresetId = presetId;
    game.physicsEnv = { friction: p.friction, restitution: p.restitution, pieceMassKg: p.pieceMassKg };
    syncSimPhysicsEnv();
    addLog(`物理场已切换：[${p.label}] μ=${fmt(p.friction, 2)}, e=${fmt(p.restitution, 2)}, 棋重=${Math.round(p.pieceMassKg * 1000)}g`);
  }

  function applyCustomPhysicsFromSliders() {
    game.physicsPresetId = "custom";
    const friction = clamp(Number($("physFrictionRange")?.value) || 0.78, 0.15, 1.25);
    const restitution = clamp(Number($("physRestitutionRange")?.value) || 0.42, 0.05, 0.95);
    const pieceMassKg = clamp((Number($("physPieceMassRange")?.value) || 48) * 0.001, 0.020, 0.120);
    game.physicsEnv = { friction, restitution, pieceMassKg };
    const matchPreset = Object.values(PHYSICS_PRESETS).find((p) =>
      Math.abs(p.friction - friction) < 0.005 && Math.abs(p.restitution - restitution) < 0.005 && Math.abs(p.pieceMassKg - pieceMassKg) < 0.0005
    );
    if (matchPreset) game.physicsPresetId = matchPreset.id;
    else if ($("physPresetSelect")) {
      let opt = $("physPresetSelect").querySelector('option[value="custom"]');
      if (!opt) {
        opt = document.createElement("option");
        opt.value = "custom";
        opt.textContent = "自定义实验参数 (μ/e/m)";
        $("physPresetSelect").appendChild(opt);
      }
    }
    syncSimPhysicsEnv();
  }

  function stepSingleFrame(dt = 0.025) {
    if (!game.sim) return;
    if (game.running) setRunning(false);
    game.replayIndex = null;
    const isCode = game.controlMode === "code";
    const controller = isCode ? game.strategyFn : game.manualControls;
    const err = stepSimulation(game.sim, dt, controller, isCode);
    if (err) {
      game.strategyError = err.message;
      if ($("codeCompileStatus")) {
        $("codeCompileStatus").textContent = `运行报错: ${err.message}`;
        $("codeCompileStatus").classList.add("error");
      }
    } else if (!game.sim.trail.length || distance(game.sim.robot, game.sim.trail[game.sim.trail.length - 1]) > 0.022) {
      game.sim.trail.push({ x: game.sim.robot.x, z: game.sim.robot.z });
      if (game.sim.trail.length > 600) game.sim.trail.shift();
    }
    drawCameraView(true);
    drawScene();
    updateHud();
  }

  function drawPhysicsScope() {
    const scopeCanvas = $("physicsScopeCanvas");
    if (!scopeCanvas || !game.sim) return;
    const ctx = scopeCanvas.getContext("2d");
    const w = scopeCanvas.width, h = scopeCanvas.height;
    const sim = getRenderSimState(), hist = game.sim.history || [];
    const tractionMax = game.sim.tractionMaxN || computeTractionLimitN(game.build, game.physicsEnv);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#07161c";
    ctx.fillRect(0, 0, w, h);

    // 网格刻度线
    ctx.strokeStyle = "rgba(100, 227, 193, 0.09)";
    ctx.lineWidth = 1;
    for (let gx = 1; gx < 6; gx += 1) {
      const px = (w * gx) / 6;
      ctx.beginPath(); ctx.moveTo(px, 6); ctx.lineTo(px, h - 14); ctx.stroke();
    }
    for (let gy = 1; gy < 4; gy += 1) {
      const py = 6 + ((h - 20) * gy) / 4;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
    }

    if (hist.length < 2) {
      ctx.fillStyle = "#7fa9a2";
      ctx.font = "12px DM Sans, Microsoft YaHei";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("点击「▶ 开始仿真」或「⏭ +25ms」后，实时绘制线速度 / 接触推力 / 牵引极限 / 得分曲线", w * 0.5, h * 0.5);
      if ($("scopeSummaryMeta")) $("scopeSummaryMeta").textContent = `μ=${fmt(game.physicsEnv.friction, 2)} · e=${fmt(game.physicsEnv.restitution, 2)} · 牵引极限 ${fmt(tractionMax, 1)}N`;
      return;
    }

    const padTop = 10, padBot = 16, plotH = h - padTop - padBot;
    const maxT = Math.max(4, hist[hist.length - 1].t);
    const maxV = Math.max(1.2, game.build.maxSpeed * 1.18);
    const maxF = Math.max(tractionMax * 1.32, game.sim.peakContactForce || 10, 14);
    const xOf = (t) => clamp((t / maxT) * (w - 8) + 4, 4, w - 4);
    const yV = (v) => padTop + plotH * (1 - clamp(v / maxV, 0, 1));
    const yF = (f) => padTop + plotH * (1 - clamp(f / maxF, 0, 1));
    const yS = (s) => padTop + plotH * (1 - clamp(s / 45, 0, 1));

    // 牵引上限警戒红虚线
    const yTract = yF(tractionMax);
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "rgba(255, 90, 107, 0.58)";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(4, yTract); ctx.lineTo(w - 4, yTract); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(255, 130, 142, 0.85)";
    ctx.font = "600 9.5px JetBrains Mono, monospace";
    ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText(`F_max ${fmt(tractionMax, 1)}N`, 8, Math.max(14, yTract - 2));

    // 打滑事件红色底标条
    ctx.fillStyle = "rgba(255, 90, 107, 0.72)";
    for (let i = 0; i < hist.length; i += 1) {
      if ((hist[i].slip || 0) > 0.12) {
        const sx = xOf(hist[i].t);
        ctx.fillRect(sx - 1.5, h - 10, 3, 6);
      }
    }

    const drawSeries = (getter, yMapper, color, lineWidth = 1.5, dashed = false) => {
      ctx.save();
      if (dashed) ctx.setLineDash([4, 3]);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      for (let i = 0; i < hist.length; i += 1) {
        const px = xOf(hist[i].t), py = yMapper(getter(hist[i]));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    };

    drawSeries((pt) => pt.vCmd || 0, yV, "rgba(100, 227, 193, 0.35)", 1.1, true);
    drawSeries((pt) => pt.v || 0, yV, "#64e3c1", 1.7);
    drawSeries((pt) => pt.forceN || 0, yF, "#ffc76b", 1.5);
    drawSeries((pt) => pt.score || 0, yS, "#ff5a6b", 1.6);

    // 当前时刻或回放游标线
    const curX = xOf(sim.time);
    ctx.strokeStyle = sim.isReplay ? "#ffffff" : "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = sim.isReplay ? 1.8 : 1;
    ctx.beginPath(); ctx.moveTo(curX, 4); ctx.lineTo(curX, h - 12); ctx.stroke();

    ctx.fillStyle = "#88b6ae";
    ctx.font = "9.5px JetBrains Mono, monospace";
    ctx.textAlign = "right"; ctx.textBaseline = "bottom";
    ctx.fillText(`0s → ${fmt(maxT, 1)}s (单击示波器可直跳回放)`, w - 8, h - 2);

    if ($("scopeSummaryMeta")) {
      $("scopeSummaryMeta").textContent = `采样${hist.length}帧 · μ=${fmt(game.physicsEnv.friction, 2)} · 上限${fmt(tractionMax, 1)}N · 打滑${game.sim.slipEvents || 0}次 · ${Math.round(game.sim.energyJ || 0)}J`;
    }
  }

  function recordCurrentExperiment() {
    if (!game.sim) return;
    const sim = getRenderSimState(), liveSim = game.sim, env = game.physicsEnv;
    const presetLabel = PHYSICS_PRESETS[game.physicsPresetId]?.label || `自定义(μ=${fmt(env.friction, 2)})`;
    const item = {
      id: `exp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toLocaleTimeString(),
      presetLabel,
      schemeName: `${game.build.chassis.name.split(" ")[0]}/${game.build.device.name.split(" ")[0]}(口${Math.round(game.build.mouthWidth * 1000)})`,
      friction: +env.friction.toFixed(2),
      restitution: +env.restitution.toFixed(2),
      pieceMassG: Math.round(env.pieceMassKg * 1000),
      totalMassKg: +game.build.totalMass.toFixed(2),
      score: sim.score,
      collected: sim.collected,
      timeSec: +sim.time.toFixed(1),
      peakForceN: +(liveSim.peakContactForce || sim.contactForce || 0).toFixed(1),
      slipEvents: liveSim.slipEvents || 0,
      peakSlipPct: Math.round((liveSim.peakSlip || sim.wheelSlip || 0) * 100),
      energyJ: Math.round(sim.energyJ || 0),
    };
    game.experiments.unshift(item);
    if (game.experiments.length > 20) game.experiments.length = 20;
    game.selectedExpIds = game.experiments.slice(0, 2).map((e) => e.id);
    saveJsonList(STORAGE_EXPERIMENTS_KEY, game.experiments);
    renderExperimentRunsTable();
    addLog(`📌 已记录实验快照：${item.score}/45分 · ${item.timeSec}s · ${item.presetLabel} · 峰力 ${item.peakForceN}N`);
  }

  function renderExperimentRunsTable() {
    const body = $("experimentRunsBody");
    if ($("expCountBadge")) $("expCountBadge").textContent = String(game.experiments.length);
    if (!body) return;
    if (!game.experiments.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-cell">运行后点击「📌 记录实验快照」保存对照实验</td></tr>';
      return;
    }
    const selectedSet = new Set(game.selectedExpIds);
    body.innerHTML = game.experiments.map((exp) => {
      const checked = selectedSet.has(exp.id) ? "checked" : "";
      return `<tr>
        <td><input type="checkbox" class="exp-check" data-id="${escapeHtml(exp.id)}" ${checked} /></td>
        <td><strong>${escapeHtml(exp.schemeName)}</strong><br><small>${escapeHtml(exp.presetLabel)} · μ=${exp.friction} e=${exp.restitution}</small></td>
        <td class="opt-score-cell">${exp.score}<small> (${exp.collected}枚)</small></td>
        <td>${exp.timeSec}s</td>
        <td>${exp.peakForceN}N / ${exp.slipEvents}次<small>(${exp.peakSlipPct}%)</small></td>
        <td>${exp.energyJ} J</td>
      </tr>`;
    }).join("");
    body.querySelectorAll(".exp-check").forEach((box) => {
      box.addEventListener("change", () => {
        const id = box.dataset.id;
        if (box.checked) {
          if (!game.selectedExpIds.includes(id)) game.selectedExpIds.push(id);
          if (game.selectedExpIds.length > 2) game.selectedExpIds = game.selectedExpIds.slice(-2);
        } else {
          game.selectedExpIds = game.selectedExpIds.filter((x) => x !== id);
        }
        renderExperimentRunsTable();
      });
    });
  }

  function compareSelectedExperiments() {
    const banner = $("compareDiffBanner");
    if (!banner) return;
    if (game.experiments.length < 2) {
      banner.hidden = false;
      banner.textContent = "请至少运行并记录 2 组实验快照后，再点击「对比勾选」进行对照分析。";
      return;
    }
    let chosen = game.experiments.filter((e) => game.selectedExpIds.includes(e.id));
    if (chosen.length < 2) {
      chosen = game.experiments.slice(0, 2);
      game.selectedExpIds = chosen.map((e) => e.id);
      renderExperimentRunsTable();
    }
    const [a, b] = chosen;
    const dScore = a.score - b.score;
    const dTime = +(a.timeSec - b.timeSec).toFixed(1);
    const dForce = +(a.peakForceN - b.peakForceN).toFixed(1);
    const dSlip = a.slipEvents - b.slipEvents;
    const dEnergy = a.energyJ - b.energyJ;
    const signed = (v, unit = "") => `${v > 0 ? "+" : ""}${v}${unit}`;
    banner.hidden = false;
    banner.innerHTML = `<b>A</b> [${escapeHtml(a.schemeName)} · ${escapeHtml(a.presetLabel)}] vs <b>B</b> [${escapeHtml(b.schemeName)} · ${escapeHtml(b.presetLabel)}]<br>` +
      `得分差 <b>${signed(dScore, "分")}</b> · 耗时差 <b>${signed(dTime, "s")}</b> · 峰值推力差 <b>${signed(dForce, "N")}</b> · 打滑差 <b>${signed(dSlip, "次")}</b> · 能耗差 <b>${signed(dEnergy, "J")}</b>`;
  }

  function renderResearchNotes() {
    const root = $("researchNotesList");
    if (!root) return;
    if (!game.researchNotes.length) {
      root.innerHTML = '<div class="empty-state">可结合示波器与回放时间轴记录发现，例如打滑帧、遮挡盲区、翼展优劣等。</div>';
      return;
    }
    root.innerHTML = game.researchNotes.map((n) => `
      <div class="research-note-item">
        <time>${escapeHtml(n.wallTime)} · T+${n.simTime}s · ${n.score}分 · μ=${n.friction} · 打滑${n.slipPct}%</time>
        <div>${escapeHtml(n.text)}</div>
      </div>
    `).join("");
  }

  function addResearchNote() {
    const input = $("researchNoteInput");
    const text = input?.value?.trim();
    if (!text) return;
    const sim = getRenderSimState();
    const note = {
      id: `note_${Date.now()}`,
      wallTime: new Date().toLocaleTimeString(),
      simTime: sim ? fmt(sim.time, 1) : "0.0",
      score: sim ? sim.score : 0,
      friction: fmt(game.physicsEnv.friction, 2),
      restitution: fmt(game.physicsEnv.restitution, 2),
      slipPct: sim ? Math.round((sim.wheelSlip || 0) * 100) : 0,
      text,
    };
    game.researchNotes.unshift(note);
    if (game.researchNotes.length > 40) game.researchNotes.length = 40;
    saveJsonList(STORAGE_NOTES_KEY, game.researchNotes);
    input.value = "";
    renderResearchNotes();
    addLog(`📝 已添加研究讨论批注 @ T+${note.simTime}s`);
  }

  function clearResearchNotes() {
    game.researchNotes = [];
    saveJsonList(STORAGE_NOTES_KEY, game.researchNotes);
    renderResearchNotes();
  }

  function exportResearchMarkdown() {
    const b = game.build, comp = checkCompliance(b), sim = getRenderSimState(), liveSim = game.sim;
    const tractN = computeTractionLimitN(b, game.physicsEnv);
    const lines = [
      "# 第十五届光电设计竞赛（赛题1·智能车光电象棋对抗）物理研究与探讨报告",
      "",
      `- 导出时间: ${new Date().toLocaleString()}`,
      `- 赛制模式: ${game.matchMode === "versus" ? "甲红 vs 乙白双车对抗" : "单车视觉清场"}`,
      `- 整车选配: ${b.chassis.name} + ${b.motor.name} + ${b.wheel.name} + ${b.device.name}`,
      `- 自定义 CAD 拼图件: ${game.customParts.length} 件 / ${customPartMassKg(game.customParts).toFixed(2)} kg / ${game.customParts.filter((part) => part.connected).length} 处已吸附`,
      `- 合规状态: ${comp.ok ? "合规通过" : "超限: " + comp.issues.join("; ")} (${b.totalMass.toFixed(2)}kg, ${Math.round(b.envelopeLength * 1000)}×${Math.round(b.envelopeWidth * 1000)}×${Math.round(b.envelopeHeight * 1000)}mm, 轴荷比 ${b.frontAxlePct}:${b.rearAxlePct})`,
      "",
      "## 1. 当前实验物理环境与遥测结果",
      `- 物理场参数: 摩擦系数 μ=${fmt(game.physicsEnv.friction, 2)} · 恢复系数 e=${fmt(game.physicsEnv.restitution, 2)} · 单棋质量=${Math.round(game.physicsEnv.pieceMassKg * 1000)}g`,
      `- 轮胎极限牵引力: ${fmt(tractN, 2)} N`,
      `- 当前得分与耗时: ${sim?.score ?? 0} / 45 分 (入区 ${sim?.collected ?? 0} 枚, T=${fmt(sim?.time ?? 0, 1)}s)`,
      `- 峰推力 / 打滑 / 累计能耗: ${fmt(liveSim?.peakContactForce ?? 0, 1)} N / ${liveSim?.slipEvents ?? 0} 次 (峰打滑 ${Math.round((liveSim?.peakSlip ?? 0) * 100)}%) / ${Math.round(liveSim?.energyJ ?? 0)} J`,
      "",
      "## 2. 对照实验记录汇总",
    ];
    if (!game.experiments.length) {
      lines.push("（暂无记录实验快照）");
    } else {
      lines.push("| 方案 / CAD | 物理场 | μ / e | 得分 | 耗时 | 峰推力 / 打滑 | 能耗 |");
      lines.push("|---|---|---:|---:|---:|---|---:|");
      game.experiments.forEach((exp) => {
        lines.push(`| ${exp.schemeName} | ${exp.presetLabel} | ${exp.friction}/${exp.restitution} | ${exp.score}/45 | ${exp.timeSec}s | ${exp.peakForceN}N / ${exp.slipEvents}次(${exp.peakSlipPct}%) | ${exp.energyJ}J |`);
      });
    }
    lines.push("", "## 3. 团队探索发现与讨论批注");
    if (!game.researchNotes.length) {
      lines.push("（暂无讨论批注）");
    } else {
      game.researchNotes.forEach((n) => {
        lines.push(`- [${n.wallTime} | T+${n.simTime}s | ${n.score}分 | μ=${n.friction} | 打滑${n.slipPct}%] ${n.text}`);
      });
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "xiangqi_physics_research_report.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    addLog("📝 已导出团队物理探索研究报告 (.md)");
  }

  // =========================
  // 10. 代码编辑器编译 & 寻优器
  // =========================
  function applyEditorCode(andRun = false) {
    const code = $("codeEditor").value, status = $("codeCompileStatus");
    try {
      const fn = compileStrategyCode(code);
      const probeSim = createSimulationState(game.build, 42, game.layoutMode, game.strategyParams, {
        matchMode: game.matchMode, startYawPreset: game.startYawPreset,
      });
      const err = stepSimulation(probeSim, 0.025, fn, true);
      if (err) throw err;
      game.strategyFn = fn; game.strategyError = null;
      status.textContent = "纯视觉代码编译通过 · 运行中"; status.classList.remove("error");
      game.controlMode = "code"; $("controlModeSelect").value = "code"; updateControlModeUi();
      addLog("已应用最新纯视觉控制代码 decide(ctx)");
      if (andRun && !game.running) setRunning(true);
    } catch (error) {
      game.strategyError = error.message; status.textContent = `语法/运行错误: ${error.message}`; status.classList.add("error");
      addLog(`代码编译失败：${error.message}`);
    }
  }

  function exportFullBomJson(download = true) {
    const b = game.build, comp = checkCompliance(b), diag = computeEngineeringDiagnostics(b);
    const bomItems = MODULE_ORDER.map((m) => ({
      module: m.title,
      presetId: m.selKey ? game.buildSelection[m.selKey] : "custom-library",
      massKg: +Number(MODULE_DESIGN_SCHEMA[m.key].mass(b)).toFixed(3),
      summary: MODULE_DESIGN_SCHEMA[m.key].summary(b),
    }));
    const payload = {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      matchMode: game.matchMode,
      startYawPreset: game.startYawPreset,
      buildSelection: game.buildSelection,
      resolvedBuild: {
        totalMassKg: b.totalMass,
        envelopeMm: [Math.round(b.envelopeLength * 1000), Math.round(b.envelopeWidth * 1000), Math.round(b.envelopeHeight * 1000)],
        axleRatio: `${b.frontAxlePct}:${b.rearAxlePct}`,
        maxSpeedMs: b.maxSpeed, maxAccelMs2: b.maxAccel, maxOmegaRadS: b.maxOmega,
        cameraHeightMm: Math.round(b.cameraHeight * 1000), cameraPitchDeg: b.cameraPitch, fovDeg: b.fov, sensorRangeM: b.sensorRange,
        controlHz: b.controlHz, laserRays: b.laserRays, laserPowerMw: b.laserPowerMw,
        customPartMassKg: b.customPartMass || 0, customPartCount: game.customParts.length,
      },
      compliance: comp,
      engineeringDiagnostics: diag,
      bomItems,
      strategyParams: game.strategyParams,
      strategyCode: $("codeEditor")?.value || STRATEGY_TEMPLATES.optimal_funnel,
      customParts: game.customParts.map((part) => ({ ...part })),
      cadAssembly: {
        snapSlots: getCustomSnapSlots(b),
        connectedCount: game.customParts.filter((part) => part.connected).length,
      },
    };
    if (download && typeof Blob !== "undefined") {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = "xiangqi_robot_bom_v3_cad.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      addLog(`📦 已导出整车 BOM 与策略方案 (${b.totalMass.toFixed(2)}kg, ${Math.round(b.envelopeLength * 1000)}×${Math.round(b.envelopeWidth * 1000)}mm)`);
    }
    return payload;
  }

  function importFullBomJson(jsonText) {
    const parsed = typeof jsonText === "string" ? JSON.parse(jsonText) : jsonText;
    if (!parsed || !parsed.buildSelection || !parsed.buildSelection.chassisId) throw new Error("无效的 BOM 设计文件格式");
    game.buildSelection = { ...defaultBuildSelection(), ...parsed.buildSelection, overrides: parsed.buildSelection.overrides || {} };
    if (parsed.strategyParams) game.strategyParams = { ...defaultStrategyParams(), ...parsed.strategyParams };
    if (Array.isArray(parsed.customParts)) {
      game.customParts = parsed.customParts.map((part) => makeCustomPart(part));
      game.studio.selectedCustomId = game.customParts[0]?.id || null;
      persistCustomParts();
    }
    if (parsed.matchMode) { game.matchMode = parsed.matchMode; if ($("matchModeSelect")) $("matchModeSelect").value = game.matchMode; }
    if (parsed.startYawPreset) { game.startYawPreset = parsed.startYawPreset; if ($("startYawSelect")) $("startYawSelect").value = game.startYawPreset; }
    if (typeof parsed.strategyCode === "string" && $("codeEditor")) { $("codeEditor").value = parsed.strategyCode; applyEditorCode(false); }
    refreshBuildAndSyncSim();
    if (game.studio.open) { renderStudioModuleTabs(); renderStudioModuleBody(); }
    resetScene(`📂 已成功导入整车 BOM 设计 (${game.build.totalMass.toFixed(2)}kg)`);
    return exportFullBomJson(false);
  }

  function loadCodeTemplate(templateKey) { $("codeEditor").value = STRATEGY_TEMPLATES[templateKey] || STRATEGY_TEMPLATES.optimal_funnel; applyEditorCode(false); }
  function updateControlModeUi() { const isCode = game.controlMode === "code"; $("controlModeBadge").textContent = isCode ? "纯视觉代码" : "手动驾驶"; $("manualControlsBox").classList.toggle("dimmed", isCode); }
  function formatParamsSummary(p) { return `接敌${Math.round(p.approachDist * 1000)}mm · 推速${Math.round(p.pushThrottle * 100)}% · Kp=${p.steerKp.toFixed(1)}`; }

  function applyOptResult(item, autoRun = true) {
    if (!item) return;
    game.buildSelection = JSON.parse(JSON.stringify(item.selection));
    game.strategyParams = { ...item.params };
    refreshBuildAndSyncSim();
    const vsNote = game.matchMode === "versus" && Number.isFinite(item.avgEnemy) ? ` (对乙均分:${item.avgEnemy.toFixed(1)})` : "";
    resetScene(`已加载寻优方案：纯视觉均分 ${item.avgScore.toFixed(1)}/45${vsNote} · ${item.build.chassis.name.split(" ")[0]} + ${item.build.device.name.split(" ")[0]} (${item.build.totalMass.toFixed(2)}kg)`);
    if (autoRun) setRunning(true);
  }

  function renderOptResultsTable() {
    const body = $("optResultsBody");
    if (!body) return;
    if (!game.optResults.length) { body.innerHTML = '<tr><td colspan="7" class="empty-cell">尚未运行寻优计算</td></tr>'; return; }
    body.innerHTML = game.optResults.slice(0, 12).map((item, idx) => {
      const b = item.build;
      const ovKeys = item.selection?.overrides || {};
      const cadTag = Object.keys(ovKeys).length > 0 ? ` [CAD 口${Math.round(b.mouthWidth * 1000)}/角${Math.round(b.wingSplayAngle)}°]` : "";
      const partsSummary = `${b.chassis.name.split(" ")[0]} / ${Math.round(b.rpm)}rpm / ${b.driveMode} / ${b.device.name.split(" ")[0]}${cadTag}`;
      const scoreDisp = game.matchMode === "versus" ? `${item.avgScore.toFixed(1)} : ${item.avgEnemy.toFixed(1)}` : item.avgScore.toFixed(1);
      return `<tr><td><strong>#${idx + 1}</strong></td><td>${partsSummary}</td><td class="opt-score-cell">${scoreDisp}</td><td>${item.avgTime30 >= 119.9 ? "—" : `${item.avgTime30.toFixed(1)} s`}</td><td>${b.totalMass.toFixed(2)}kg / ${Math.round(b.envelopeLength * 1000)}×${Math.round(b.envelopeWidth * 1000)}</td><td>${formatParamsSummary(item.params)}</td><td><button class="button accent small opt-apply-row" data-idx="${idx}">应用演示</button></td></tr>`;
    }).join("");
    body.querySelectorAll(".opt-apply-row").forEach((btn) => btn.addEventListener("click", () => applyOptResult(game.optResults[Number(btn.dataset.idx)], true)));
  }

  async function startOptimization() {
    if (game.optimizerRunning) return;
    try { game.strategyFn = compileStrategyCode($("codeEditor").value); } catch (err) { addLog(`请先修正代码错误再寻优：${err.message}`); return; }
    switchWorkbenchTab("optimizer");
    const scope = $("optScopeSelect").value, seedCount = Number($("optSeedsSelect").value) || 3, duration = Number($("optDurationSelect").value) || 120;
    const seeds = [101, 202, 303, 404, 505].slice(0, seedCount);
    const { candidates, paramPresets } = generateCandidateConfigs(scope, game.buildSelection, game.strategyParams, game.unrestrictedMode);

    game.optimizerRunning = true; game.optimizerAbort = false; game.optResults = [];
    $("startOptBtn").disabled = true; $("stopOptBtn").disabled = false; $("optBestBanner").hidden = true;
    const hasStage23 = (scope === "joint" || scope === "full_cad");
    addLog(`启动纯视觉仿真寻优 [${game.matchMode === "versus" ? "双车对抗" : "单车清场"}]：基线 ${candidates.length} 组 × ${seedCount} 局 (${duration}s)`);

    let completed = 0;
    let totalTasks = candidates.length + (hasStage23 ? Math.min(5, candidates.length) * (paramPresets.length - 1) + 18 : 0);
    const yieldFrame = () => new Promise((resolve) => setTimeout(resolve, 0));

    for (let i = 0; i < candidates.length; i += 1) {
      if (game.optimizerAbort) break;
      game.optResults.push(evaluateCandidate(resolveBuildForCurrentCustomParts(candidates[i].sel), game.strategyFn, candidates[i].params, seeds, duration, game.layoutMode, game.matchMode, game.startYawPreset, game.physicsEnv));
      completed += 1;
      if (i % 3 === 0 || i === candidates.length - 1) {
        game.optResults.sort((a, b2) => b2.fitness - a.fitness);
        const pct = Math.min(100, Math.round((completed / totalTasks) * 100));
        $("optProgressFill").style.width = `${pct}%`;
        $("optProgressText").textContent = `Stage 1 硬件选配 ${completed}/${totalTasks} (${pct}%) · 当前最优均分 ${game.optResults[0].avgScore.toFixed(1)} / 45`;
        renderOptResultsTable();
        await yieldFrame();
      }
    }
    if (!game.optimizerAbort && hasStage23 && game.optResults.length > 0) {
      const topHardware = game.optResults.slice(0, Math.min(5, game.optResults.length));
      for (const item of topHardware) for (let pIdx = 1; pIdx < paramPresets.length; pIdx += 1) {
        if (game.optimizerAbort) break;
        game.optResults.push(evaluateCandidate(item.build, game.strategyFn, paramPresets[pIdx], seeds, duration, game.layoutMode, game.matchMode, game.startYawPreset, game.physicsEnv));
        completed += 1;
        game.optResults.sort((a, b2) => b2.fitness - a.fitness);
        const pct = Math.min(100, Math.round((completed / totalTasks) * 100));
        $("optProgressFill").style.width = `${pct}%`;
        $("optProgressText").textContent = `Stage 2 控制超参寻优 ${completed}/${totalTasks} (${pct}%) · 最优均分 ${game.optResults[0].avgScore.toFixed(1)} / 45`;
        renderOptResultsTable();
        await yieldFrame();
      }
      const cadList = generateCadRefinements(game.optResults, game.strategyParams, game.unrestrictedMode);
      totalTasks = completed + cadList.length;
      for (let cIdx = 0; cIdx < cadList.length; cIdx += 1) {
        if (game.optimizerAbort) break;
        const ci = cadList[cIdx];
        game.optResults.push(evaluateCandidate(resolveBuildForCurrentCustomParts(ci.sel), game.strategyFn, ci.params, seeds, duration, game.layoutMode, game.matchMode, game.startYawPreset, game.physicsEnv));
        completed += 1;
        if (cIdx % 3 === 0 || cIdx === cadList.length - 1) {
          game.optResults.sort((a, b2) => b2.fitness - a.fitness);
          const pct = Math.min(100, Math.round((completed / Math.max(1, totalTasks)) * 100));
          $("optProgressFill").style.width = `${pct}%`;
          $("optProgressText").textContent = `Stage 3 高自由度 CAD 几何×相机寻优 ${completed}/${totalTasks} (${pct}%) · 最优 ${game.optResults[0].avgScore.toFixed(1)} / 45`;
          renderOptResultsTable();
          await yieldFrame();
        }
      }
    }

    game.optResults.sort((a, b2) => b2.fitness - a.fitness);
    game.optimizerRunning = false; $("startOptBtn").disabled = false; $("stopOptBtn").disabled = true;
    if (game.optResults.length > 0) {
      const best = game.optResults[0];
      game.bestOptResult = best; $("optBestBanner").hidden = false;
      $("optBestSummary").textContent = `${best.build.chassis.name.split(" ")[0]} + ${best.build.motor.name.split(" ")[0]} + ${best.build.wheel.name.split(" ")[0]} + ${best.build.device.name.split(" ")[0]} (口宽${Math.round(best.build.mouthWidth * 1000)}mm/高${Math.round(best.build.cameraHeight * 1000)}mm)`;
      $("optBestMetrics").textContent = `纯视觉均分 ${best.avgScore.toFixed(1)} / 45 · 均入区 ${best.avgPieces.toFixed(1)} 枚 · 整车 ${best.build.totalMass.toFixed(2)} kg · ${formatParamsSummary(best.params)}`;
      $("optProgressFill").style.width = "100%";
      $("optProgressText").textContent = game.optimizerAbort ? `寻优已中止（已评估 ${completed} 组），保留当前最优方案` : `三阶段寻优完成！共 ${completed * seedCount} 场纯视觉仿真，最优均分 ${best.avgScore.toFixed(1)}/45`;
      renderOptResultsTable();
      addLog(`🏆 三阶段纯视觉寻优完成：最优均分 ${best.avgScore.toFixed(1)}/45 (${best.build.device.name.split(" ")[0]}, ${best.build.totalMass.toFixed(2)}kg)`);
    }
  }

  // =========================
  // 11. 渲染循环与事件绑定
  // =========================
  function renderFrame(timestamp) {
    resizeCanvas();
    updateCameraMatrices();
    const rawDelta = game.lastFrame ? (timestamp - game.lastFrame) / 1000 : 0;
    game.lastFrame = timestamp;

    if (game.running && rawDelta > 0) {
      const totalSimDt = Math.min(rawDelta, 0.05) * game.speedMultiplier;
      const steps = Math.max(1, Math.ceil(totalSimDt / 0.02));
      const dtPerStep = totalSimDt / steps;
      const isCode = game.controlMode === "code", controller = isCode ? game.strategyFn : game.manualControls;
      for (let i = 0; i < steps; i += 1) {
        const err = stepSimulation(game.sim, dtPerStep, controller, isCode);
        if (err) {
          game.strategyError = err.message;
          $("codeCompileStatus").textContent = `运行报错: ${err.message}`; $("codeCompileStatus").classList.add("error");
          setRunning(false); break;
        }
        if (!game.sim.trail.length || distance(game.sim.robot, game.sim.trail[game.sim.trail.length - 1]) > 0.022) {
          game.sim.trail.push({ x: game.sim.robot.x, z: game.sim.robot.z });
          if (game.sim.trail.length > 600) game.sim.trail.shift();
        }
      }
    }

    drawCameraView(true);
    if (game.studio.open && (game.studio.view === "live_cam" || game.studio.view === "3d_iso" || game.running)) drawStudioCad(true);
    drawScene();
    updateHud();
    requestAnimationFrame(renderFrame);
  }

  function switchWorkbenchTab(tabKey) {
    document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabKey));
    document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.toggle("active", pane.id === `tab-${tabKey}`));
    if (tabKey === "research") drawPhysicsScope();
  }

  // =========================
  // 10B. CAD 建模 · 拼图吸附 · Rust 工程后端 & MCP 联动
  // =========================
  function getRustApiBase() {
    if (typeof game !== "undefined" && typeof game.rustApiBase === "string") return game.rustApiBase;
    if (typeof window !== "undefined" && (window.location?.protocol === "http:" || window.location?.protocol === "https:")) return "";
    return "http://127.0.0.1:8124";
  }

  async function rehydrateCustomPartsToRust() {
    if (!game.rustConnected) return;
    await syncSelectionToRust();
    for (const part of game.customParts) {
      if (!part.rustNodeId) part.rustNodeId = `cad_${part.id || Date.now()}`;
      const res = await fetch(`${getRustApiBase()}/api/cad/extrude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part_id: part.rustNodeId,
          name: part.name || "自定义CAD件",
          kind: part.template === "funnel" ? "u_scoop" : "chamfered_rect",
          parent_id: "chassis_main",
          port_id: part.slotId === "front_center" ? "front_bulkhead" : (part.slotId === "bottom_deck" ? "bottom_deck" : "top_deck"),
          width: part.width || 0.18,
          length: part.length || 0.09,
          thickness: part.thickness || part.height || 0.005,
          density_kg_m3: part.volume ? (part.massKg / part.volume) : 1550,
          offset: [0, 0.006, 0],
        }),
      }).catch(() => null);
      if (res?.ok) persistCustomParts();
    }
  }

  async function probeRustBackend() {
    const pill = $("rustEnginePill");
    const candidates = (typeof window !== "undefined" && (window.location?.protocol === "http:" || window.location?.protocol === "https:"))
      ? ["", "http://127.0.0.1:8124"]
      : ["http://127.0.0.1:8124"];
    for (const base of candidates) {
      try {
        const res = await fetch(`${base}/api/health`, { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          if (data?.ok) {
            game.rustApiBase = base;
            game.rustConnected = true;
            if (pill) {
              pill.textContent = data?.mode === "desktop" ? "🦀 Rust 桌面程序在线" : "🦀 Rust 引擎在线";
              pill.className = "status-pill mint";
            }
            rehydrateCustomPartsToRust();
            return true;
          }
        }
      } catch (_) {}
    }
    game.rustConnected = false;
    if (pill) { pill.textContent = "JS 本地内核 (Rust未启动)"; pill.className = "status-pill"; }
    return false;
  }

  function renderCadMcpPartsList() {
    const list = $("customCadPartsList"), badge = $("customCadCount");
    if (badge) badge.textContent = String(game.customParts.length);
    if (!list) return;
    if (!game.customParts.length) {
      list.innerHTML = '<div class="empty-state">尚未添加自定义 CAD 拼装件；生成后将自动按体积×密度计入整车质量与转动惯量。</div>';
      return;
    }
    list.innerHTML = game.customParts.map((p, idx) => `
      <div class="custom-cad-item">
        <div>
          <strong>${escapeHtml(p.name)}</strong>
          <small>${Math.round(p.width * 1000)}×${Math.round(p.length * 1000)}×${Math.round(p.height * 1000)}mm · ${(p.massKg * 1000).toFixed(1)}g · 吸附:${escapeHtml(p.slotId || "自由")}</small>
        </div>
        <div class="cad-item-actions">
          <button class="text-button cad-exp-btn" data-cidx="${idx}" data-ext="stl" title="导出 STL">STL</button>
          <button class="text-button cad-exp-btn" data-cidx="${idx}" data-ext="dxf" title="导出 DXF">DXF</button>
          <button class="text-button cad-del-btn" data-cidx="${idx}">删除</button>
        </div>
      </div>
    `).join("");
    list.querySelectorAll(".cad-exp-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = game.customParts[Number(btn.dataset.cidx)];
        exportCadArtifact(btn.dataset.ext, p?.rustNodeId, p);
      });
    });
    list.querySelectorAll(".cad-del-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const idx = Number(btn.dataset.cidx);
        const removed = game.customParts.splice(idx, 1)[0];
        if (game.rustConnected && removed?.rustNodeId) {
          fetch(`${getRustApiBase()}/api/cad/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ part_id: removed.rustNodeId }),
          }).catch(() => {});
        }
        persistCustomParts();
        refreshBuildAndSyncSim();
        renderCadMcpPartsList();
      });
    });
  }

  function buildStlFromBoxMm(name, wMm, hMm, lMm) {
    const hx = wMm * 0.5, hy = hMm, hz = lMm * 0.5;
    const tris = [
      [[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz]], [[-hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz]],
      [[-hx, hy, -hz], [hx, hy, hz], [hx, hy, -hz]], [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz]],
      [[-hx, 0, hz], [hx, 0, hz], [hx, hy, hz]], [[-hx, 0, hz], [hx, hy, hz], [-hx, hy, hz]],
      [[hx, 0, -hz], [-hx, 0, -hz], [-hx, hy, -hz]], [[hx, 0, -hz], [-hx, hy, -hz], [hx, hy, -hz]],
      [[-hx, 0, -hz], [-hx, 0, hz], [-hx, hy, hz]], [[-hx, 0, -hz], [-hx, hy, hz], [-hx, hy, -hz]],
      [[hx, 0, hz], [hx, 0, -hz], [hx, hy, -hz]], [[hx, 0, hz], [hx, hy, -hz], [hx, hy, hz]],
    ];
    let out = `solid ${name.replace(/[^a-zA-Z0-9_]/g, "_")}\n`;
    tris.forEach(([a, b, c]) => {
      out += `  facet normal 0 0 1\n    outer loop\n      vertex ${a[0].toFixed(3)} ${a[1].toFixed(3)} ${a[2].toFixed(3)}\n      vertex ${b[0].toFixed(3)} ${b[1].toFixed(3)} ${b[2].toFixed(3)}\n      vertex ${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)}\n    endloop\n  endfacet\n`;
    });
    return `${out}endsolid ${name.replace(/[^a-zA-Z0-9_]/g, "_")}\n`;
  }

  function buildDxfFromBoxMm(wMm, lMm) {
    const hx = (wMm * 0.5).toFixed(3), hz = (lMm * 0.5).toFixed(3);
    const segs = [[`-${hx}`, `-${hz}`, hx, `-${hz}`], [hx, `-${hz}`, hx, hz], [hx, hz, `-${hx}`, hz], [`-${hx}`, hz, `-${hx}`, `-${hz}`]];
    return `0\nSECTION\n2\nENTITIES\n${segs.map(([x1, y1, x2, y2]) => `0\nLINE\n8\nOUTLINE\n10\n${x1}\n20\n${y1}\n30\n0.0\n11\n${x2}\n21\n${y2}\n31\n0.0\n`).join("")}0\nENDSEC\n0\nEOF\n`;
  }

  async function extrudeAndSnapFromCadTab() {
    const name = $("cadPartName")?.value?.trim() || "自定义CAD件";
    const kind = $("cadSketchKind")?.value || "chamfered_rect";
    const port = $("cadMountPort")?.value || "top_deck";
    const width = Math.max(0.01, (Number($("cadWidthMm")?.value) || 180) * 0.001);
    const length = Math.max(0.01, (Number($("cadLengthMm")?.value) || 90) * 0.001);
    const thickness = Math.max(0.001, (Number($("cadThickMm")?.value) || 5) * 0.001);
    const density = Math.max(100, Number($("cadDensity")?.value) || 1550);
    const ox = (Number($("cadOffX")?.value) || 0) * 0.001;
    const oy = (Number($("cadOffY")?.value) || 6) * 0.001;
    const oz = (Number($("cadOffZ")?.value) || 0) * 0.001;

    let massKg = +(width * length * thickness * density).toFixed(4);
    let outline = null;
    if (kind === "polygon") {
      try { outline = JSON.parse($("cadPolyJson")?.value || "[]"); } catch (_) {}
    }

    const rustNodeId = `cad_${Date.now()}`;
    let syncedRust = false;
    if (game.rustConnected) {
      try {
        const res = await fetch(`${getRustApiBase()}/api/cad/extrude`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            part_id: rustNodeId, name, kind, parent_id: "chassis_main", port_id: port,
            width, length, thickness, density_kg_m3: density, offset: [ox, oy, oz], outline,
          }),
        });
        if (res.ok) {
          const payload = await res.json();
          syncedRust = !!payload?.ok;
          if (payload?.mesh?.mass_kg) massKg = +payload.mesh.mass_kg.toFixed(4);
          const statsEl = $("cadMeshStats");
          if (statsEl && payload?.mesh) {
            const triCount = payload.mesh.triangles?.length || 0;
            const volCm3 = ((payload.mesh.volume_m3 || 0) * 1e6).toFixed(1);
            statsEl.textContent = `网格: ${triCount} 三角面 · ${volCm3} cm³ · ${(massKg * 1000).toFixed(1)} g`;
          }
        }
      } catch (_) {}
    }

    const slotMap = { top_deck: "top_deck", front_bulkhead: "front_center", bottom_deck: "bottom_deck", axle_station: "top_deck" };
    const part = makeCustomPart({
      name,
      template: kind === "u_scoop" ? "funnel" : "plate",
      role: kind === "u_scoop" ? "collector" : "structure",
      width, length, height: thickness, thickness,
      massKg: Math.max(0.001, massKg),
      color: kind === "u_scoop" ? "#e3a634" : "#2d9279",
    });
    if (syncedRust) part.rustNodeId = rustNodeId;
    snapCustomPart(part, game.build, slotMap[port] || "top_deck");
    part.x += ox; part.y += oy; part.z += oz;
    game.customParts.push(part);
    persistCustomParts();
    refreshBuildAndSyncSim();
    renderCadMcpPartsList();
    addLog(`🧩 已生成并拼装 CAD 零件 [${name}] (${Math.round(width * 1000)}×${Math.round(length * 1000)}×${Math.round(thickness * 1000)}mm, ${(massKg * 1000).toFixed(1)}g)`);
  }

  function exportCadArtifact(ext, nodeIdOverride = null, partOverride = null) {
    const p = partOverride || game.customParts[game.customParts.length - 1];
    const wMm = p ? p.width * 1000 : game.build.width * 1000;
    const lMm = p ? p.length * 1000 : game.build.length * 1000;
    const hMm = p ? p.height * 1000 : 5.0;
    const name = p ? p.name : "chassis_main";
    const rustNode = nodeIdOverride || p?.rustNodeId || "chassis_main";
    if (game.rustConnected) {
      window.open(`${getRustApiBase()}/api/cad/export.${ext}?node=${encodeURIComponent(rustNode)}`, "_blank");
      addLog(`📐 已从 Rust CAD 内核导出 [${rustNode}.${ext}]`);
      return;
    }
    const content = ext === "stl" ? buildStlFromBoxMm(name, wMm, hMm, lMm) : buildDxfFromBoxMm(wMm, lMm);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `xiangqi_cad_part.${ext}`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    addLog(`📐 已导出制造文件 xiangqi_cad_part.${ext}`);
  }

  async function syncSelectionToRust() {
    if (!game.rustConnected) return;
    const b = game.build;
    const payload = {
      chassis_main: { width: b.width, length: b.length, height: b.height },
      device_scoop: { device_width: b.deviceWidth, mouth_width: b.mouthWidth },
      wing_pair: {
        left_wing_depth: b.leftWingDepth,
        left_wing_splay: b.leftWingSplay,
        right_wing_depth: b.rightWingDepth,
        right_wing_splay: b.rightWingSplay,
      },
      motor_drive: { rpm: b.motorRpm },
      camera_main: { camera_height: b.cameraHeight, camera_pitch_deg: b.cameraPitchDeg },
    };
    await fetch(`${getRustApiBase()}/api/assembly/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  function applyRustCandidateToBuilder(cand) {
    if (!cand?.graph?.nodes) return;
    if (!game.sel) game.sel = {};
    if (!game.sel.overrides) game.sel.overrides = {};
    const ov = game.sel.overrides;
    const byId = Object.fromEntries(cand.graph.nodes.map((n) => [n.id, n]));
    const scoop = byId.device_scoop?.params;
    const wings = byId.wing_pair?.params;
    const motor = byId.motor_drive?.params;
    const wheel = byId.wheel_mecanum?.params;
    if (scoop?.device_width) ov.deviceWidth = scoop.device_width;
    if (wings) {
      if (wings.left_wing_depth != null) ov.leftWingDepth = wings.left_wing_depth;
      if (wings.left_wing_splay != null) ov.leftWingSplay = wings.left_wing_splay;
      if (wings.right_wing_depth != null) ov.rightWingDepth = wings.right_wing_depth;
      if (wings.right_wing_splay != null) ov.rightWingSplay = wings.right_wing_splay;
    }
    if (motor?.rpm) ov.rpm = motor.rpm;
    if (wheel?.drive_type) {
      ov.driveMode = wheel.drive_type;
      const wheelMap = { mecanum: "mecanum_4wd", omni: "omni_4wd", rwd_caster: "diff_2wd_caster" };
      if (wheelMap[wheel.drive_type]) game.sel.wheelId = wheelMap[wheel.drive_type];
    }
    refreshBuildAndSyncSim();
    addLog(`✨ 已将 Rust 最优构型 [${cand.label}] 应用到当前 3D 整车总装`);
  }

  async function runRustOptimize() {
    if (!game.rustConnected) {
      addLog("未检测到 Rust 后端 (端口 8124)，自动使用浏览器引擎进行寻优计算...");
      startOptimization();
      return;
    }
    const btn = $("rustOptimizeBtn"), box = $("rustOptResultBox");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Rust 多核并行寻优中..."; }
    try {
      await syncSelectionToRust();
      const res = await fetch(`${getRustApiBase()}/api/sim/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset: game.physicsPresetId || "standard", seeds: [42, 101, 202, 303] }),
      });
      const data = await res.json();
      const cands = data?.candidates || [];
      const top = cands[0];
      if (top) {
        const ms = data.elapsed_ms != null ? ` · 用时 ${data.elapsed_ms}ms` : "";
        addLog(`🦀 Rust 并行寻优完成 (${cands.length}构型×${data.seeds_count || 4}种子${ms})！最优 [${top.label}] 均分 ${top.avg_score.toFixed(1)}/45 · 耗时 ${top.avg_finish_s.toFixed(1)}s · 质量 ${top.total_mass_kg.toFixed(2)}kg`);
        if (box) {
          box.hidden = false;
          box.innerHTML = `
            <div class="rust-opt-head">
              <strong>🏆 最优: ${escapeHtml(top.label)} (${top.avg_score.toFixed(1)}/45${ms})</strong>
              <button class="button accent small" id="applyRustBestBtn">✨ 一键应用最优构型</button>
            </div>
            <div class="rust-opt-list">
              ${cands.slice(0, 3).map((c, i) => `<div>#${i + 1} ${escapeHtml(c.label)} · 均分 <b>${c.avg_score.toFixed(1)}</b> · ${c.avg_finish_s.toFixed(1)}s · 打滑 ${c.avg_slip_events.toFixed(1)} · ${c.total_mass_kg.toFixed(2)}kg</div>`).join("")}
            </div>
          `;
          $("applyRustBestBtn")?.addEventListener("click", () => applyRustCandidateToBuilder(top));
        }
      }
    } catch (err) {
      addLog(`Rust 寻优请求异常：${err.message}`);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "🦀 调用 Rust 内核极速寻优"; }
    }
  }

  function copyMcpConfig() {
    const cfg = JSON.stringify({
      mcpServers: {
        "xiangqi-cad-mcp": {
          command: "cargo",
          args: ["run", "--release", "-p", "xiangqi_mcp"],
          cwd: "g:/deepseek测试/simulator/rust-studio",
        },
      },
    }, null, 2);
    navigator.clipboard?.writeText(cfg).catch(() => {});
    addLog("📋 已复制 Rust MCP Server 配置 JSON (xiangqi-cad-mcp)");
  }

  function bindControls() {
    bindCustomStudioControls();
    $("runGameButton").addEventListener("click", () => setRunning(!game.running));
    $("stepSimButton")?.addEventListener("click", () => stepSingleFrame(0.025));
    $("resetGameButton").addEventListener("click", () => { setRunning(false); resetScene(); });

    $("physPresetSelect")?.addEventListener("change", (e) => applyPhysicsPreset(e.target.value));
    $("physFrictionRange")?.addEventListener("input", applyCustomPhysicsFromSliders);
    $("physRestitutionRange")?.addEventListener("input", applyCustomPhysicsFromSliders);
    $("physPieceMassRange")?.addEventListener("input", applyCustomPhysicsFromSliders);
    $("togglePhysicsVectorsBox")?.addEventListener("change", (e) => {
      game.showPhysicsVectors = e.target.checked;
      drawScene();
    });
    $("replayScrubber")?.addEventListener("input", (e) => {
      if (game.running) setRunning(false);
      const snaps = game.sim?.snapshots || [];
      const idx = clamp(Number(e.target.value) || 0, 0, Math.max(0, snaps.length - 1));
      game.replayIndex = idx >= snaps.length - 1 ? null : idx;
      drawCameraView(true);
      drawScene();
      updateHud();
    });
    $("resumeLiveBtn")?.addEventListener("click", () => {
      game.replayIndex = null;
      drawCameraView(true);
      drawScene();
      updateHud();
    });
    $("physicsScopeCanvas")?.addEventListener("click", (e) => {
      const snaps = game.sim?.snapshots || [];
      const hist = game.sim?.history || [];
      if (snaps.length < 2 || hist.length < 2) return;
      if (game.running) setRunning(false);
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      const maxT = Math.max(4, hist[hist.length - 1].t);
      const targetT = ratio * maxT;
      let bestIdx = 0, bestDiff = Infinity;
      for (let i = 0; i < snaps.length; i += 1) {
        const diff = Math.abs(snaps[i].t - targetT);
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
      }
      game.replayIndex = bestIdx >= snaps.length - 1 ? null : bestIdx;
      drawCameraView(true);
      drawScene();
      updateHud();
    });
    $("recordExperimentBtn")?.addEventListener("click", recordCurrentExperiment);
    $("compareRunsBtn")?.addEventListener("click", compareSelectedExperiments);
    $("clearExpRunsBtn")?.addEventListener("click", () => {
      game.experiments = []; game.selectedExpIds = [];
      saveJsonList(STORAGE_EXPERIMENTS_KEY, game.experiments);
      if ($("compareDiffBanner")) $("compareDiffBanner").hidden = true;
      renderExperimentRunsTable();
    });
    $("addResearchNoteBtn")?.addEventListener("click", addResearchNote);
    $("clearResearchNotesBtn")?.addEventListener("click", clearResearchNotes);
    $("researchNoteInput")?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addResearchNote(); } });
    $("exportResearchMdBtn")?.addEventListener("click", exportResearchMarkdown);

    $("cadSketchKind")?.addEventListener("change", (e) => {
      if ($("cadPolyRow")) $("cadPolyRow").hidden = e.target.value !== "polygon";
    });
    $("cadExtrudeSnapBtn")?.addEventListener("click", extrudeAndSnapFromCadTab);
    $("cadExportStlBtn")?.addEventListener("click", () => exportCadArtifact("stl"));
    $("cadExportDxfBtn")?.addEventListener("click", () => exportCadArtifact("dxf"));
    $("rustOptimizeBtn")?.addEventListener("click", runRustOptimize);
    $("exportRustAssemblyBtn")?.addEventListener("click", async () => {
      if (game.rustConnected) {
        await syncSelectionToRust();
        window.open(`${getRustApiBase()}/api/assembly/export.json`, "_blank");
        addLog("📦 已从 Rust 内核导出完整总装图 (xiangqi_assembly_graph.json)");
      } else {
        exportFullBomJson(true);
      }
    });
    $("copyMcpConfigBtn")?.addEventListener("click", copyMcpConfig);
    $("openInspectorButton").addEventListener("click", () => { window.location.href = "index.html?legacy=1"; });
    $("clearLogButton").addEventListener("click", () => { $("eventLog").innerHTML = ""; });
    $("quickOptimizeButton").addEventListener("click", startOptimization);
    $("bestSchemeButton").addEventListener("click", () => {
      if (game.bestOptResult) applyOptResult(game.bestOptResult, true);
      else applyOptResult({ selection: defaultBuildSelection(), params: defaultStrategyParams(), avgScore: 45.0, build: resolveBuild(defaultBuildSelection()) }, true);
    });

    // 独立全屏模块设计工坊事件
    $("openStudioButton").addEventListener("click", () => openIndependentStudio(game.studio.moduleKey || "device"));
    $("studioCloseBtn").addEventListener("click", closeIndependentStudio);
    $("studioApplyBtn").addEventListener("click", () => {
      closeIndependentStudio();
      addLog(`已应用独立工坊设计方案 (${game.build.totalMass.toFixed(2)}kg, ${Math.round(game.build.envelopeLength * 1000)}×${Math.round(game.build.envelopeWidth * 1000)}mm)`);
    });
    $("studioExportBomBtn")?.addEventListener("click", () => exportFullBomJson(true));
    $("studioImportBtn")?.addEventListener("click", () => $("studioImportFile")?.click());
    $("studioImportFile")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { importFullBomJson(String(reader.result || "")); }
        catch (err) { addLog(`导入设计失败：${err.message}`); }
        finally { e.target.value = ""; }
      };
      reader.readAsText(file);
    });
    $("studioResetModBtn").addEventListener("click", () => {
      if (game.studio.moduleKey === "custom") {
        resetCustomParts();
        addLog("已清空自定义 CAD 拼图件库");
        return;
      }
      const schema = MODULE_DESIGN_SCHEMA[game.studio.moduleKey];
      if (!schema) return;
      schema.fields.forEach((f) => delete game.buildSelection.overrides[f.key]);
      schema.topology.forEach((t) => delete game.buildSelection.overrides[t.key]);
      if (schema.materials) delete game.buildSelection.overrides[schema.materials.key];
      refreshBuildAndSyncSim();
      renderStudioModuleBody();
    });
    document.querySelectorAll("[data-sview]").forEach((btn) => {
      btn.addEventListener("click", () => {
        game.studio.view = btn.dataset.sview;
        document.querySelectorAll("[data-sview]").forEach((b) => b.classList.toggle("active", b === btn));
        drawStudioCad();
      });
    });
    bindStudioCanvasEvents();
    window.addEventListener("resize", () => { if (game.studio.open) drawStudioCad(); });

    const syncLockUi = () => {
      const locked = game.camera.locked, btn = $("lockCameraButton");
      btn.classList.toggle("active", locked);
      btn.textContent = locked ? "🔒 固定上帝3D视角" : "🔓 自由视角 (Shift+拖动)";
      $("cameraModeTag").textContent = locked ? "GOD-EYE 3D · LOCKED" : "FREE 3D · UNLOCKED";
      $("sceneHint").textContent = locked ? "固定上帝3D俯视全局 · 黑底红白字国赛象棋 · 左键拖动棋子" : "视角已解锁 · Shift+左键旋转视角 · 滚轮缩放 · 左键拖动棋子";
      $("viewportHelpText").textContent = locked ? "视角已锁定 · 左键拖动棋子" : "Shift+拖动旋转 · 滚轮缩放";
    };
    $("lockCameraButton").addEventListener("click", () => { game.camera.locked = !game.camera.locked; syncLockUi(); });
    $("resetCameraButton").addEventListener("click", () => { game.camera.locked = true; syncLockUi(); });
    syncLockUi();

    document.querySelectorAll(".speed-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        game.speedMultiplier = Number(btn.dataset.speed) || 1;
        document.querySelectorAll(".speed-btn").forEach((b) => b.classList.toggle("active", b === btn));
        addLog(`仿真播放倍速切换为 ${game.speedMultiplier}×`);
      });
    });

    $("syncFrom2dButton").addEventListener("click", () => { game.buildSelection = loadSavedBuildSelection(); refreshBuildAndSyncSim(); addLog("已从本地缓存同步最新选配参数"); });
    $("matchModeSelect")?.addEventListener("change", (e) => {
      game.matchMode = e.target.value;
      setRunning(false);
      resetScene();
    });
    $("startYawSelect")?.addEventListener("change", (e) => {
      game.startYawPreset = e.target.value;
      setRunning(false);
      resetScene(`发车区朝向已调整：${e.target.options[e.target.selectedIndex].text}`);
    });
    $("controlModeSelect").addEventListener("change", (e) => { game.controlMode = e.target.value; updateControlModeUi(); });
    $("layoutModeSelect").addEventListener("change", (e) => { game.layoutMode = e.target.value; resetScene(`棋子布局已切换：${e.target.options[e.target.selectedIndex].text}`); });
    $("codeEditor")?.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); applyEditorCode(true); }
    });

    const throttle = $("throttleControl"), steer = $("steerControl"), strafe = $("strafeControl");
    const syncSliders = () => {
      throttle.value = game.manualControls.throttle; steer.value = game.manualControls.steer; strafe.value = game.manualControls.strafe;
      $("throttleValue").textContent = fmt(game.manualControls.throttle); $("steerValue").textContent = fmt(game.manualControls.steer); $("strafeValue").textContent = fmt(game.manualControls.strafe);
    };
    throttle.addEventListener("input", () => { game.manualControls.throttle = Number(throttle.value); syncSliders(); });
    steer.addEventListener("input", () => { game.manualControls.steer = Number(steer.value); syncSliders(); });
    strafe.addEventListener("input", () => { game.manualControls.strafe = Number(strafe.value); syncSliders(); });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && game.studio.open) { closeIndependentStudio(); return; }
      const tag = document.activeElement?.tagName;
      if (game.studio.open || tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "q", "e"].includes(event.key)) {
        event.preventDefault();
        if (game.controlMode !== "manual") { game.controlMode = "manual"; $("controlModeSelect").value = "manual"; updateControlModeUi(); }
      }
      const key = event.key.toLowerCase();
      if (key === "w" || event.key === "ArrowUp") game.manualControls.throttle = 0.85;
      if (key === "s" || event.key === "ArrowDown") game.manualControls.throttle = -0.65;
      if (key === "a" || event.key === "ArrowLeft") game.manualControls.steer = -0.75;
      if (key === "d" || event.key === "ArrowRight") game.manualControls.steer = 0.75;
      if (key === "q") game.manualControls.strafe = -0.8;
      if (key === "e") game.manualControls.strafe = 0.8;
      if (key === "r") resetScene("按键快捷重置赛场");
      syncSliders();
    });
    window.addEventListener("keyup", (event) => {
      const tag = document.activeElement?.tagName;
      if (game.studio.open || tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      const key = event.key.toLowerCase();
      if (["w", "s", "arrowup", "arrowdown"].includes(key)) game.manualControls.throttle = 0;
      if (["a", "d", "arrowleft", "arrowright"].includes(key)) game.manualControls.steer = 0;
      if (["q", "e"].includes(key)) game.manualControls.strafe = 0;
      syncSliders();
    });

    canvas.addEventListener("pointerdown", (event) => {
      const world = worldFromPointer(event);
      if (event.altKey && event.button === 0) {
        canvas.setPointerCapture(event.pointerId);
        game.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moveRobot: true, offset: { x: game.sim.robot.x - world[0], z: game.sim.robot.z - world[2] } };
        return;
      }
      const piece = !event.shiftKey && event.button === 0 ? pickPiece(world) : null;
      canvas.setPointerCapture(event.pointerId);
      game.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, pieceId: piece?.id || null, offset: piece ? { x: piece.x - world[0], z: piece.z - world[2] } : null, orbit: !piece && !game.camera.locked && event.shiftKey };
      if (piece) { piece.vx = 0; piece.vz = 0; addLog(`手动拖动棋子：${piece.side === "red" ? "甲队(红字)" : "乙队(白字)"}${piece.symbol}`); }
    });
    canvas.addEventListener("pointermove", (event) => {
      const ptr = game.pointer;
      if (!ptr || ptr.id !== event.pointerId) return;
      const dx = event.clientX - ptr.x, dy = event.clientY - ptr.y;
      ptr.x = event.clientX; ptr.y = event.clientY;
      if (ptr.moveRobot) {
        const world = worldFromPointer(event);
        game.sim.robot.x = clamp(world[0] + ptr.offset.x, 0.14, FIELD.width - 0.14);
        game.sim.robot.z = clamp(world[2] + ptr.offset.z, 0.14, FIELD.depth - 0.14);
        enforceRobotArenaBounds(game.sim.robot, game.build); updateOnboardPerception(game.sim);
      } else if (ptr.pieceId) {
        const piece = game.sim.pieces.find((p) => p.id === ptr.pieceId);
        if (piece) {
          const world = worldFromPointer(event);
          piece.x = clamp(world[0] + ptr.offset.x, piece.radius, FIELD.width - piece.radius);
          piece.z = clamp(world[2] + ptr.offset.z, piece.radius, FIELD.depth - piece.radius);
          piece.vx = 0; piece.vz = 0; updateOnboardPerception(game.sim);
        }
      } else if (ptr.orbit && !game.camera.locked) {
        game.camera.yaw -= dx * 0.008; game.camera.pitch = clamp(game.camera.pitch + dy * 0.008, 0.35, 1.48);
      }
    });
    const releasePointer = (event) => { if (game.pointer?.id === event.pointerId) { game.pointer = null; canvas.releasePointerCapture?.(event.pointerId); } };
    canvas.addEventListener("pointerup", releasePointer);
    canvas.addEventListener("pointercancel", releasePointer);
    canvas.addEventListener("wheel", (event) => { if (game.camera.locked) return; event.preventDefault(); game.camera.distance = clamp(game.camera.distance + event.deltaY * 0.0025, 2.0, 6.2); }, { passive: false });

    document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => switchWorkbenchTab(btn.dataset.tab)));
    $("codeTemplateSelect").addEventListener("change", (e) => loadCodeTemplate(e.target.value));
    $("applyCodeBtn").addEventListener("click", () => applyEditorCode(true));
    $("resetCodeBtn").addEventListener("click", () => loadCodeTemplate($("codeTemplateSelect").value));
    $("toggleApiHelpBtn").addEventListener("click", () => { $("apiCheatsheet").hidden = !$("apiCheatsheet").hidden; });
    $("exportCodeBtn").addEventListener("click", () => {
      const blob = new Blob([$("codeEditor").value], { type: "text/javascript;charset=utf-8" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = "xiangqi_vision_strategy.js"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    $("startOptBtn").addEventListener("click", startOptimization);
    $("stopOptBtn").addEventListener("click", () => { game.optimizerAbort = true; });
    $("applyBestOptBtn").addEventListener("click", () => applyOptResult(game.bestOptResult, true));

    const setUnrestricted = (val) => {
      game.unrestrictedMode = Boolean(val);
      refreshBuildAndSyncSim();
      addLog(game.unrestrictedMode ? "🔓 已切换为无限制自由组装与实验模式" : "📏 已开启国赛 300×300×300mm / 2.5kg 参考校准提示");
    };
    $("unrestrictedModeBox")?.addEventListener("change", (e) => setUnrestricted(e.target.checked));
    $("studioUnrestrictedBox")?.addEventListener("change", (e) => setUnrestricted(e.target.checked));

    if ($("toggleCamOverlayBox")) $("toggleCamOverlayBox").addEventListener("change", (e) => { game.showCamOverlay = e.target.checked; drawCameraView(); });
    if ($("quickCamHeight")) $("quickCamHeight").addEventListener("input", (e) => {
      game.buildSelection.overrides.cameraHeight = Math.max(0.015, Number(e.target.value) * 0.001);
      refreshBuildAndSyncSim();
    });
    if ($("quickCamPitch")) $("quickCamPitch").addEventListener("input", (e) => {
      game.buildSelection.overrides.cameraPitch = clamp(Number(e.target.value), -85, 85);
      refreshBuildAndSyncSim();
    });
    const camCanvasEl = $("cameraCanvas");
    if (camCanvasEl) {
      let camDrag = null;
      camCanvasEl.addEventListener("pointerdown", (e) => {
        camDrag = { x: e.clientX, y: e.clientY };
        camCanvasEl.setPointerCapture(e.pointerId);
      });
      camCanvasEl.addEventListener("pointermove", (e) => {
        if (!camDrag) return;
        const dx = e.clientX - camDrag.x, dy = e.clientY - camDrag.y;
        camDrag = { x: e.clientX, y: e.clientY };
        if (e.shiftKey) {
          game.buildSelection.overrides.cameraHeight = clamp(game.build.cameraHeight - dy * 0.001, 0.015, 0.60);
        } else {
          game.buildSelection.overrides.cameraPitch = clamp(Math.round(game.build.cameraPitch + dy * 0.28), -85, 85);
          game.buildSelection.overrides.cameraMountYaw = clamp(Math.round(game.build.cameraMountYaw + dx * 0.25), -180, 180);
        }
        refreshBuildAndSyncSim();
      });
      const endCamDrag = (e) => { camDrag = null; camCanvasEl.releasePointerCapture?.(e.pointerId); };
      camCanvasEl.addEventListener("pointerup", endCamDrag);
      camCanvasEl.addEventListener("pointercancel", endCamDrag);
      camCanvasEl.addEventListener("wheel", (e) => {
        e.preventDefault();
        game.buildSelection.overrides.cameraHeight = clamp(game.build.cameraHeight - Math.sign(e.deltaY) * 0.008, 0.015, 0.60);
        refreshBuildAndSyncSim();
      }, { passive: false });
    }
    $("cameraSourceMode").addEventListener("change", (e) => { if (e.target.value === "real") $("cameraStatus").textContent = "已选择真实 USB 摄像头，请点击启动"; else { stopCamera(); $("cameraStatus").textContent = "第一人称 3D 车载相机已实时连接到右侧主监视窗"; } });
    $("yoloAdapterMode").addEventListener("change", (e) => { const http = e.target.value === "http"; $("yoloEndpoint").disabled = !http; $("cameraStatus").textContent = http ? "捕获帧后将 POST 到 YOLO 桥接" : "仿真光电识别已开启"; });
    $("startCameraButton").addEventListener("click", startCamera);
    $("captureFrameButton").addEventListener("click", captureFrame);
  }

  async function startCamera() {
    if (game.cameraStream) { stopCamera(); return; }
    try {
      game.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      $("cameraVideo").srcObject = game.cameraStream;
      $("cameraStatus").textContent = "真实摄像头已启动，捕获帧时识别"; $("startCameraButton").textContent = "停止真实摄像头";
      addLog("真实 USB 摄像头已接入");
    } catch (error) { $("cameraStatus").textContent = `摄像头不可用：${error.message}`; addLog("真实摄像头未授权，继续使用 3D 仿真车载相机"); }
  }
  function stopCamera() {
    game.cameraStream?.getTracks?.().forEach((track) => track.stop()); game.cameraStream = null;
    if ($("cameraVideo")) $("cameraVideo").srcObject = null; $("startCameraButton").textContent = "启动真实 USB 摄像头";
  }
  async function captureFrame() {
    if (game.captureBusy) return;
    game.captureBusy = true;
    try {
      const capture = $("captureCanvas"), ctx = capture.getContext("2d");
      if (game.cameraStream && $("cameraVideo").readyState >= 2) ctx.drawImage($("cameraVideo"), 0, 0, capture.width, capture.height);
      else { drawCameraView(); ctx.drawImage($("cameraCanvas"), 0, 0, capture.width, capture.height); }
      const imageData = capture.toDataURL("image/jpeg", 0.82);
      if ($("yoloAdapterMode").value === "http") {
        const res = await fetch($("yoloEndpoint").value.trim(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageData, width: capture.width, height: capture.height, source: game.cameraStream ? "real" : "sim" }) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        game.externalDetections = Array.isArray(payload) ? payload : (Array.isArray(payload.detections) ? payload.detections : []);
        $("cameraStatus").textContent = `YOLO 已返回 ${game.externalDetections.length} 个目标`;
      } else {
        game.externalDetections = null; $("cameraStatus").textContent = `第 ${Math.floor(game.sim.time * 10)} 帧 · 模拟识别已更新`;
      }
      updateDetectionPanel();
    } catch (error) { $("cameraStatus").textContent = `识别失败：${error.message}`; } finally { game.captureBusy = false; }
  }

  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.clearDepth(1);
  refreshBuildAndSyncSim();
  loadCodeTemplate("optimal_funnel");
  bindControls();
  syncPhysicsSlidersUi();
  renderExperimentRunsTable();
  renderResearchNotes();
  renderCadMcpPartsList();
  probeRustBackend();
  resetScene();
  updateControlModeUi();
  requestAnimationFrame(renderFrame);

  window.KinematicSimulator3D = {
    state: game, PARTS_CATALOG, CHASSIS_MATERIALS, DEVICE_MATERIALS, STRATEGY_TEMPLATES, PHYSICS_PRESETS, CUSTOM_PART_TEMPLATES,
    openIndependentStudio, closeIndependentStudio, exportFullBomJson, importFullBomJson,
    addCustomPart: (spec) => { const part = makeCustomPart(spec); game.customParts.push(part); game.studio.selectedCustomId = part.id; persistCustomParts(); refreshBuildAndSyncSim(); renderCustomPartEditor(); drawStudioCad(); return part; },
    snapCustomPart: (id, slotId = "") => { const part = game.customParts.find((item) => item.id === id); const slot = part ? snapCustomPart(part, game.build, slotId) : null; persistCustomParts(); refreshBuildAndSyncSim(); renderCustomPartEditor(); drawStudioCad(); return slot; },
    callCadMcp, resetCustomParts, exportCustomPartLibrary, importCustomPartLibrary,
    resolveBuild, checkCompliance, computeTractionLimitN, resetScene, setRunning, stepSingleFrame,
    applyPhysicsPreset, recordCurrentExperiment, compareSelectedExperiments, exportResearchMarkdown,
    applyEditorCode, loadCodeTemplate, startOptimization,
    runOptimizationSync: (opts) => runOptimizationSync({ currentBuildSel: game.buildSelection, currentParams: game.strategyParams, strategyFn: game.strategyFn, matchMode: game.matchMode, startYawPreset: game.startYawPreset, physics: game.physicsEnv, unrestricted: game.unrestrictedMode, ...opts }),
    getState: () => JSON.parse(JSON.stringify({
      time: game.sim.time, matchMode: game.sim.matchMode,
      score: game.sim.score, collected: game.sim.collected, enemyScore: game.sim.enemyScore, enemyCollected: game.sim.enemyCollected,
      phase: game.sim.phase, robot: game.sim.robot, enemyRobot: game.sim.enemyRobot, vision: game.sim.visionState,
      physics: { env: game.physicsEnv, contactForce: game.sim.contactForce, peakContactForce: game.sim.peakContactForce, tractionMaxN: game.sim.tractionMaxN, tractionPct: game.sim.tractionPct, wheelSlip: game.sim.wheelSlip, slipEvents: game.sim.slipEvents, energyJ: game.sim.energyJ },
      build: { totalMass: game.build.totalMass, envelopeLength: game.build.envelopeLength, envelopeWidth: game.build.envelopeWidth, envelopeHeight: game.build.envelopeHeight, mouthWidth: game.build.mouthWidth, customPartMass: game.build.customPartMass || 0, customPartCount: game.customParts.length },
      customParts: game.customParts,
      pieces: game.sim.pieces,
    })),
  };
})(typeof window !== "undefined" ? window : globalThis);
