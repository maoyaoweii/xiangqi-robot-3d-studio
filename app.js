(() => {
  "use strict";

  const FIELD = { width: 3000, height: 2000 };
  const TRACK_LIMITS = { width: 300, length: 300, height: 300, mass: 2.5 };
  const $ = (selector) => document.querySelector(selector);

  const MODULE_META = {
    chassis: { label: "底盘", icon: "▣", defaults: { name: "轻量底盘", width: 280, length: 240, height: 105, mass: 0.62, mountX: 0, mountY: 0, mountYaw: 0 } },
    motor: { label: "电机", icon: "◉", defaults: { name: "编码电机 ×2", kind: "dc_encoder", rpm: 420, torque: 0.22, count: 2, mass: 0.26, gear: 1, mountX: 0, mountY: 0, mountYaw: 0 } },
    wheel: { label: "轮子", icon: "◌", defaults: { name: "橡胶驱动轮 ×4", kind: "standard", layout: "four_corner", radius: 32, width: 18, count: 4, track: 190, wheelbase: 170, mass: 0.18, mountX: 0, mountY: 0, mountYaw: 0 } },
    controller: { label: "控制器", icon: "⌁", defaults: { name: "车载控制器", cpu: "实时控制", mass: 0.16, mountX: -25, mountY: 0, mountYaw: 0 } },
    sensor: { label: "传感器", icon: "◈", defaults: { name: "顶视相机 + IMU", kind: "camera", range: 900, fov: 100, mass: 0.14, mountX: 35, mountY: 0, mountYaw: 0 } },
    pusher: { label: "推送器", icon: "↦", defaults: { name: "柔性贴地推板", kind: "push_plate", actuation: "passive", motorId: "", driveRatio: 1, width: 150, offset: 20, clearance: 2, mass: 0.12, mountX: 110, mountY: 0, mountYaw: 0 } },
    collector: { label: "收集器", icon: "⌁", defaults: { name: "被动收集斗", kind: "scoop", actuation: "passive", motorId: "", driveRatio: 1, width: 180, offset: 80, clearance: 2, mass: 0.16, mountX: 90, mountY: 0, mountYaw: 0 } },
    battery: { label: "电池", icon: "▰", defaults: { name: "3S 锂电池", voltage: 11.1, capacity: 2.2, mass: 0.24, mountX: -35, mountY: 0, mountYaw: 0 } },
    safety: { label: "安全模块", icon: "⚠", defaults: { name: "急停 / 保险丝 / 队标", eStop: "机械急停", fuse: "1 A", team: "A 队", mass: 0.08, mountX: 0, mountY: 70, mountYaw: 0 } },
  };

  const PRESET = [
    { type: "chassis", name: "赛道一轻量底盘", width: 280, length: 240, height: 105, mass: 0.62 },
    { type: "motor", name: "编码电机 ×2", kind: "dc_encoder", rpm: 420, torque: 0.22, count: 2, mass: 0.26, gear: 1 },
    { type: "wheel", name: "橡胶驱动轮 ×4", kind: "standard", layout: "four_corner", radius: 32, width: 18, count: 4, track: 190, wheelbase: 170, mass: 0.18 },
    { type: "controller", name: "车载控制器", cpu: "实时控制", mass: 0.16 },
    { type: "sensor", name: "顶视车载相机", kind: "camera", range: 900, fov: 100, mass: 0.14 },
    { type: "sensor", name: "IMU 姿态模块", kind: "imu", range: 0, fov: 0, mass: 0.05, mountX: 0, mountY: 0, mountYaw: 0 },
    { type: "sensor", name: "轮速编码器", kind: "encoder", range: 0, fov: 0, mass: 0.06 },
    { type: "pusher", name: "柔性贴地推板", width: 150, offset: 20, clearance: 2, mass: 0.12, mountX: 110, mountY: 0, mountYaw: 0 },
    { type: "battery", name: "3S 锂电池", voltage: 11.1, capacity: 2.2, mass: 0.24 },
    { type: "safety", name: "急停 / 保险丝 / 队标", eStop: "机械急停", fuse: "1 A", team: "A 队", mass: 0.08 },
  ];

  const BEST_PRESET = [
    { type: "chassis", name: "最佳拿棋轻量底盘", width: 270, length: 240, height: 100, mass: 0.56 },
    { type: "motor", name: "低速高扭编码电机 ×2", kind: "geared", rpm: 360, torque: 0.30, count: 2, mass: 0.30, gear: 1.15 },
    { type: "wheel", name: "高抓地橡胶轮 ×4", kind: "standard", layout: "differential", radius: 30, width: 18, count: 4, track: 185, wheelbase: 165, mass: 0.18 },
    { type: "controller", name: "实时控制器", cpu: "视觉闭环 / 编码反馈", mass: 0.16 },
    { type: "sensor", name: "前置车载相机", kind: "camera", range: 1100, fov: 95, mass: 0.14, mountX: 55, mountY: 0, mountYaw: 0 },
    { type: "sensor", name: "IMU 姿态模块", kind: "imu", range: 0, fov: 0, mass: 0.05, mountX: -10, mountY: 0, mountYaw: 0 },
    { type: "sensor", name: "轮速编码器", kind: "encoder", range: 0, fov: 0, mass: 0.06 },
    { type: "pusher", name: "宽幅柔性贴地推板", kind: "push_plate", actuation: "passive", width: 185, offset: 24, clearance: 2, mass: 0.14, mountX: 105, mountY: 0, mountYaw: 0 },
    { type: "battery", name: "3S 2.6Ah 锂电池", voltage: 11.1, capacity: 2.6, mass: 0.26, mountX: -35, mountY: 0, mountYaw: 0 },
    { type: "safety", name: "急停 / 保险丝 / 队标", eStop: "机械急停", fuse: "1 A", team: "A 队", mass: 0.08 },
  ];

  const PIECE_TYPES = [
    { kind: "帅/将", value: 10, symbol: "帅" },
    { kind: "车", value: 5, symbol: "车" },
    { kind: "马", value: 3, symbol: "马" },
    { kind: "炮", value: 3, symbol: "炮" },
    { kind: "相/象", value: 2, symbol: "相" },
    { kind: "仕/士", value: 2, symbol: "仕" },
    { kind: "兵/卒", value: 1, symbol: "兵" },
  ];

  const DETECTION_VALUES = [
    ["general", 10], ["将", 10], ["帅", 10],
    ["rook", 5], ["车", 5],
    ["horse", 3], ["马", 3], ["cannon", 3], ["炮", 3],
    ["elephant", 2], ["象", 2], ["相", 2], ["advisor", 2], ["士", 2], ["仕", 2],
    ["pawn", 1], ["兵", 1], ["卒", 1],
  ];

  function randomPieces() {
    const pieces = [];
    const pile = { left: 1200, right: 1800, top: 700, bottom: 1300, radius: 33.5 };
    const makeSide = (side) => {
      PIECE_TYPES.forEach((type, index) => {
        const count = type.kind === "车" || type.kind === "马" || type.kind === "炮" || type.kind === "相/象" || type.kind === "仕/士" ? 2 : type.kind === "兵/卒" ? 5 : 1;
        for (let copy = 0; copy < count; copy += 1) {
          let x = 0; let y = 0; let placed = false;
          for (let attempt = 0; attempt < 300 && !placed; attempt += 1) {
            x = pile.left + Math.random() * (pile.right - pile.left);
            y = pile.top + Math.random() * (pile.bottom - pile.top);
            placed = pieces.every((other) => Math.hypot(other.x - x, other.y - y) >= pile.radius * 2 + 4);
          }
          if (!placed) { x = pile.left + ((index * 97 + copy * 71) % 520); y = pile.top + ((index * 83 + copy * 67) % 520); }
          pieces.push({ id: `${side}-${type.kind}-${copy}`, side, kind: type.kind, symbol: side === "red" ? type.symbol : type.symbol === "帅" ? "将" : type.symbol === "相" ? "象" : type.symbol === "仕" ? "士" : type.symbol === "兵" ? "卒" : type.symbol, value: type.value, x, y, radius: pile.radius, scored: false });
        }
      });
    };
    makeSide("red"); makeSide("white");
    return pieces;
  }

  const state = {
    modules: [],
    selectedId: null,
    controls: { throttle: 0.45, steer: 0, strafe: 0, driveMode: "diff", timeScale: 1, autoStrategy: false, strategyMode: "value_first" },
    sim: { running: false, time: 0, x: 150, y: 1850, theta: 0, trace: [], lastTrace: 0, lastFrame: 0, pieces: [], targetId: null, score: 0, scoredPieces: [], drag: null },
    camera: { adapterMode: "mock", endpoint: "http://127.0.0.1:8765/predict", sourceMode: "sim", detections: [], frameWidth: 560, frameHeight: 230, capturedAt: null, frameData: null, frameCount: 0, status: "装配摄像头后可捕获帧", model: "", localAdapter: null, realStream: null, realRunning: false, captureBusy: false, lastRealCapture: 0, realIntervalMs: 180, plan: null },
  };

  function uid(type) { return `${type}-${Math.random().toString(36).slice(2, 8)}`; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function formatNumber(value, digits = 2) { return Number.isFinite(value) ? value.toFixed(digits) : "—"; }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function currentModule() { return state.modules.find((module) => module.id === state.selectedId) || null; }
  function moduleMass(module) { return Number(module.mass) || 0; }

  function createModule(type, overrides = {}) {
    const meta = MODULE_META[type];
    const values = { ...clone(meta.defaults), ...overrides };
    return { id: uid(type), type, ...values };
  }

  function addModule(type, overrides = {}) {
    const module = createModule(type, overrides);
    state.modules.push(module);
    state.selectedId = module.id;
    renderAll();
  }

  function syncStrategyControls() {
    const auto = $("#autoStrategyControl"); const mode = $("#strategyMode"); const drive = $("#driveMode");
    if (auto) auto.checked = Boolean(state.controls.autoStrategy);
    if (mode) mode.value = state.controls.strategyMode || "value_first";
    if (drive) drive.value = state.controls.driveMode;
    syncControlInputs();
  }

  function applyPreset(definition, controls = {}) {
    state.modules = definition.map((module) => createModule(module.type, module));
    state.controls = { ...state.controls, throttle: 0.45, steer: 0, strafe: 0, timeScale: 1, driveMode: "diff", autoStrategy: false, strategyMode: "value_first", ...controls };
    state.selectedId = state.modules[0]?.id || null;
    const note = $("#bestSchemeNote");
    if (note) note.textContent = definition === BEST_PRESET ? "当前方案：270×240×100 mm 轻量底盘 · 双减速编码电机 · 185 mm 宽被动柔性推板 · 前置相机 + IMU + 编码器 · 约 1.93 kg。自动取子已启用，默认高分优先。" : "推荐加载“最佳拿棋方案”：宽幅被动推板、低速高扭编码电机和前置视觉闭环，专门用于贴地推送高分棋子。";
    syncStrategyControls();
    resetSimulation();
    renderAll();
  }

  function loadPreset() { applyPreset(PRESET); }

  function loadBestPreset() { applyPreset(BEST_PRESET, { autoStrategy: true, strategyMode: "value_first", driveMode: "diff" }); }

  function removeModule(id) {
    state.modules = state.modules.filter((module) => module.id !== id);
    if (state.selectedId === id) state.selectedId = state.modules.at(-1)?.id || null;
    renderAll();
  }

  function totalMass() { return state.modules.reduce((sum, module) => sum + moduleMass(module), 0); }
  function chassis() { return state.modules.find((module) => module.type === "chassis") || null; }
  function wheel() { return state.modules.find((module) => module.type === "wheel") || null; }
  function motor() { return state.modules.find((module) => module.type === "motor") || null; }
  function motorForDevice(device) { return state.modules.find((module) => module.type === "motor" && module.id === device.motorId) || motor(); }
  function collectionDevices() { return state.modules.filter((module) => module.type === "pusher" || module.type === "collector"); }
  function cameraModule() { return state.modules.find((module) => module.type === "sensor" && module.kind === "camera") || null; }

  function installationEnvelope() {
    const body = chassis();
    if (!body) return { length: 0, width: 0, height: 0 };
    let halfLength = Number(body.length) / 2; let halfWidth = Number(body.width) / 2;
    state.modules.filter((module) => module.type !== "chassis").forEach((module) => {
      let length = 60; let width = 40; let centerX = Number(module.mountX) || 0; const centerY = Number(module.mountY) || 0;
      if (module.type === "motor") { length = 80; width = 60; }
      if (module.type === "wheel") { length = Number(module.wheelbase) || 170; width = Number(module.track) || 190; }
      if (module.type === "controller") { length = 90; width = 60; }
      if (module.type === "sensor") { length = 100; width = 70; }
      if (module.type === "battery") { length = 120; width = 70; }
      if (module.type === "safety") { length = 70; width = 40; }
      if (module.type === "pusher" || module.type === "collector") { const reach = Math.max(20, Number(module.offset) || 0); length = reach * 2; width = Number(module.width) || 150; centerX += reach / 2; }
      const yaw = (Number(module.mountYaw) || 0) * Math.PI / 180; const cos = Math.abs(Math.cos(yaw)); const sin = Math.abs(Math.sin(yaw));
      halfLength = Math.max(halfLength, Math.abs(centerX) + cos * length / 2 + sin * width / 2);
      halfWidth = Math.max(halfWidth, Math.abs(centerY) + sin * length / 2 + cos * width / 2);
    });
    return { length: halfLength * 2, width: halfWidth * 2, height: Number(body.height) || 0 };
  }

  function estimateMaxSpeed() {
    const wheelModule = wheel();
    const motorModule = motor();
    if (!wheelModule || !motorModule) return 0;
    const radius = Math.max(1, Number(wheelModule.radius) || 1);
    const rpm = Math.max(0, Number(motorModule.rpm) || 0);
    const gear = Math.max(0.05, Number(motorModule.gear) || 1);
    const kindFactor = { dc_encoder: 1, brushless: 1.2, geared: 0.78, servo: 0.38 }[motorModule.kind] || 1;
    return (rpm * gear * (2 * Math.PI * radius)) / 60 * 0.82 * kindFactor;
  }

  function compliance() {
    const body = chassis();
    const mass = totalMass();
    const envelope = installationEnvelope();
    const issues = [];
    if (!body) issues.push("缺少底盘");
    if (!motor()) issues.push("缺少电机");
    if (!wheel()) issues.push("缺少轮子");
    if (!state.modules.some((module) => module.type === "sensor")) issues.push("缺少车载传感器");
    if (!state.modules.some((module) => module.type === "safety")) issues.push("缺少安全模块（急停 / 保险丝 / 队标）");
    const devices = collectionDevices();
    if (devices.some((device) => ["scoop", "gripper"].includes(device.kind))) issues.push("铲起 / 夹取类装置仅作仿真对比；赛道一应改为贴地推动");
    if (devices.some((device) => device.actuation === "motor" && !motorForDevice(device))) issues.push("电机驱动收集装置缺少可用电机");
    if (body && (envelope.width > TRACK_LIMITS.width || envelope.length > TRACK_LIMITS.length || envelope.height > TRACK_LIMITS.height)) issues.push(`安装后包络超过 300 mm（${Math.round(envelope.length)} × ${Math.round(envelope.width)} × ${Math.round(envelope.height)} mm）`);
    if (mass > TRACK_LIMITS.mass) issues.push("总质量超过 2.5 kg");
    return { ok: issues.length === 0, issues, mass, body, envelope };
  }

  function renderAssembly() {
    const list = $("#assemblyList");
    $("#assemblyCount").textContent = state.modules.length;
    $("#moduleCount").textContent = state.modules.length;
    if (!state.modules.length) {
      list.innerHTML = '<p class="empty-state">还没有模块。点击左侧模块加入车体。</p>';
      return;
    }
    list.innerHTML = state.modules.map((module) => {
      const meta = MODULE_META[module.type];
      const selected = module.id === state.selectedId ? " selected" : "";
      return `<div class="assembly-row${selected}" data-id="${module.id}">
        <div class="assembly-main"><strong>${meta.icon} ${escapeHtml(module.name || meta.label)}</strong><small>${meta.label} · ${formatNumber(moduleMass(module), 2)} kg</small></div>
        <button class="delete-module" title="移除模块" data-remove="${module.id}">×</button>
      </div>`;
    }).join("");
    list.querySelectorAll(".assembly-main").forEach((element) => element.addEventListener("click", () => {
      state.selectedId = element.closest(".assembly-row").dataset.id;
      renderAll();
    }));
    list.querySelectorAll("[data-remove]").forEach((element) => element.addEventListener("click", (event) => {
      event.stopPropagation();
      removeModule(element.dataset.remove);
    }));
  }

  function fieldHtml(module, key, label, options = {}) {
    const value = module[key] ?? "";
    if (options.select) {
      const optionsHtml = options.select.map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${String(value) === optionValue ? "selected" : ""}>${optionLabel}</option>`).join("");
      return `<div class="field"><label>${label}</label><select data-field="${key}">${optionsHtml}</select></div>`;
    }
    const type = options.type || "number";
    return `<div class="field"><label>${label}</label><input data-field="${key}" type="${type}" value="${escapeAttr(value)}" ${options.min != null ? `min="${options.min}"` : ""} ${options.step != null ? `step="${options.step}"` : ""} /></div>`;
  }

  function mountFields(module) {
    return fieldHtml(module, "mountX", "安装 X mm", { min: -500, step: 1 }) + fieldHtml(module, "mountY", "安装 Y mm", { min: -500, step: 1 }) + fieldHtml(module, "mountYaw", "安装偏航 °", { min: -180, step: 1 });
  }

  function renderInspector() {
    const target = $("#inspector");
    const module = currentModule();
    if (!module) {
      target.innerHTML = '<p class="empty-state">选择一个模块开始编辑。</p>';
      return;
    }
    let fields = fieldHtml(module, "name", "显示名称", { type: "text" });
    if (module.type === "chassis") fields += fieldHtml(module, "width", "宽度 mm", { min: 50, step: 1 }) + fieldHtml(module, "length", "长度 mm", { min: 50, step: 1 }) + fieldHtml(module, "height", "高度 mm", { min: 20, step: 1 }) + fieldHtml(module, "mass", "质量 kg", { min: 0, step: 0.01 });
    if (module.type === "motor") fields += fieldHtml(module, "kind", "电机类型", { select: [["dc_encoder", "直流编码电机"], ["brushless", "无刷电机"], ["geared", "减速电机"], ["servo", "舵机 / 执行器"]] }) + fieldHtml(module, "rpm", "空载转速 rpm", { min: 0, step: 10 }) + fieldHtml(module, "torque", "额定扭矩 N·m", { min: 0, step: 0.01 }) + fieldHtml(module, "count", "数量", { min: 1, step: 1 }) + fieldHtml(module, "gear", "传动比", { min: 0.05, step: 0.05 }) + fieldHtml(module, "mass", "总质量 kg", { min: 0, step: 0.01 });
    if (module.type === "wheel") fields += fieldHtml(module, "kind", "轮型", { select: [["standard", "标准轮"], ["mecanum", "麦克纳姆轮"], ["omni", "全向轮"], ["caster", "万向辅助轮"]] }) + fieldHtml(module, "layout", "安装布局", { select: [["four_corner", "四角轮组"], ["differential", "左右差速"], ["mecanum_x", "麦轮 X 形"], ["omni_cross", "全向十字"]] }) + fieldHtml(module, "radius", "半径 mm", { min: 5, step: 1 }) + fieldHtml(module, "width", "轮宽 mm", { min: 3, step: 1 }) + fieldHtml(module, "count", "数量", { min: 1, step: 1 }) + fieldHtml(module, "track", "轮距 mm", { min: 30, step: 1 }) + fieldHtml(module, "wheelbase", "轴距 mm", { min: 30, step: 1 }) + fieldHtml(module, "mass", "总质量 kg", { min: 0, step: 0.01 });
    if (module.type === "controller") fields += fieldHtml(module, "cpu", "控制能力", { type: "text" }) + fieldHtml(module, "mass", "质量 kg", { min: 0, step: 0.01 });
    if (module.type === "sensor") fields += fieldHtml(module, "kind", "类型", { select: [["camera", "车载相机"], ["imu", "IMU"], ["encoder", "轮速编码器"], ["lidar", "光电测距"]] }) + fieldHtml(module, "range", "量程 mm", { min: 0, step: 10 }) + fieldHtml(module, "fov", "视场角 °", { min: 0, step: 1 }) + fieldHtml(module, "mass", "质量 kg", { min: 0, step: 0.01 });
    if (module.type === "pusher" || module.type === "collector") {
      const motorOptions = [["", "自动使用首个电机"], ...state.modules.filter((item) => item.type === "motor").map((item) => [item.id, item.name || item.id])];
      fields += fieldHtml(module, "kind", "装置类型", { select: [["push_plate", "贴地推板"], ["roller", "滚轮推送"], ["scoop", "收集斗"], ["brush", "柔性刷"]] }) + fieldHtml(module, "actuation", "驱动方式", { select: [["passive", "被动"], ["motor", "电机驱动"]] }) + fieldHtml(module, "motorId", "驱动电机实例", { select: motorOptions }) + fieldHtml(module, "driveRatio", "驱动传动比", { min: 0.05, step: 0.05 }) + fieldHtml(module, "width", "装置宽度 mm", { min: 20, step: 1 }) + fieldHtml(module, "offset", "前伸距离 mm", { min: 0, step: 1 }) + fieldHtml(module, "clearance", "离地间隙 mm", { min: 0, step: 0.5 }) + fieldHtml(module, "mass", "质量 kg", { min: 0, step: 0.01 });
    }
    if (module.type === "battery") fields += fieldHtml(module, "voltage", "标称电压 V", { min: 1, step: 0.1 }) + fieldHtml(module, "capacity", "容量 Ah", { min: 0, step: 0.1 }) + fieldHtml(module, "mass", "质量 kg", { min: 0, step: 0.01 });
    if (module.type === "safety") fields += fieldHtml(module, "eStop", "急停说明", { type: "text" }) + fieldHtml(module, "fuse", "保险丝规格", { type: "text" }) + fieldHtml(module, "team", "队标说明", { type: "text" }) + fieldHtml(module, "mass", "质量 kg", { min: 0, step: 0.01 });
    if (module.type !== "chassis") fields += mountFields(module);
    target.innerHTML = `<div class="inspector-title"><strong>${MODULE_META[module.type].icon} ${MODULE_META[module.type].label}</strong><span>${module.id}</span></div><div class="field-grid">${fields}</div>`;
    target.querySelectorAll("[data-field]").forEach((input) => input.addEventListener("change", () => {
      const key = input.dataset.field;
      module[key] = input.type === "number" ? Number(input.value) : input.value;
      renderAll();
    }));
  }

  function updateTelemetry() {
    const result = compliance();
    const body = result.body;
    $("#massTelemetry").textContent = `${formatNumber(result.mass, 2)} kg`;
    $("#sizeTelemetry").textContent = body ? `${formatNumber(result.envelope.width, 0)} × ${formatNumber(result.envelope.length, 0)} × ${formatNumber(result.envelope.height, 0)}` : "—";
    $("#speedTelemetry").textContent = `${formatNumber(estimateMaxSpeed(), 0)} mm/s`;
    const velocity = getKinematics(state.controls.autoStrategy ? strategyControls() : state.controls);
    $("#velocityTelemetry").textContent = `${formatNumber(Math.hypot(velocity.vx, velocity.vy), 0)} mm/s`;
    $("#omegaTelemetry").textContent = `${formatNumber(velocity.omega, 2)} rad/s`;
    $("#scoreTelemetry").textContent = `${state.sim.score} / 45 分`;
    $("#pieceTelemetry").textContent = `${state.sim.scoredPieces.length} 枚入区`;
    $("#timeTelemetry").textContent = `${formatNumber(state.sim.time, 1)} s`;
    const pill = $("#compliancePill");
    pill.className = `status-pill ${result.ok ? "ok" : result.issues.some((issue) => issue.includes("超过")) ? "danger" : "warn"}`;
    pill.textContent = result.ok ? "基线通过" : result.issues[0];
    $("#complianceNote").textContent = result.ok ? "尺寸、质量和基础模块齐备。实际参赛仍需单独验证光学安全、机构和自主运行。" : result.issues.join(" · ");
    $("#poseHud").textContent = `x ${Math.round(state.sim.x)} · y ${Math.round(state.sim.y)} · θ ${Math.round(radToDeg(state.sim.theta))}°`;
    $("#traceHud").textContent = `${state.sim.trace.length} points`;
    const planStatus = $("#planStatus");
    if (planStatus) {
      const plan = state.camera.plan;
      const strategyLabel = { value_first: "高分优先", nearest: "最近优先", sweep: "横向扫掠" }[state.controls.strategyMode] || "高分优先";
      planStatus.textContent = state.controls.autoStrategy && plan?.target ? `自动路径（${strategyLabel}）：${plan.target.label || plan.target.symbol || "棋子"} · ${Math.round((Number(plan.target.confidence) || 1) * 100)}% · 第 ${plan.activeIndex + 1}/3 个航点` : state.camera.sourceMode === "real" ? "真实视觉已连接；勾选自动策略开始规划" : `自动策略等待视觉目标 · ${strategyLabel}`;
    }
  }

  function hasCameraSensor() { return state.modules.some((module) => module.type === "sensor" && module.kind === "camera"); }

  function cameraPose() {
    const sensor = cameraModule();
    const bodyTheta = state.sim.theta;
    const mountX = Number(sensor?.mountX) || 0;
    const mountY = Number(sensor?.mountY) || 0;
    const bodyCos = Math.cos(bodyTheta);
    const bodySin = Math.sin(bodyTheta);
    return {
      x: state.sim.x + mountX * bodyCos - mountY * bodySin,
      y: state.sim.y + mountX * bodySin + mountY * bodyCos,
      theta: bodyTheta + (Number(sensor?.mountYaw) || 0) * Math.PI / 180,
      range: clamp(Number(sensor?.range) || 900, 250, 1800),
      fov: clamp(Number(sensor?.fov) || 100, 25, 170),
    };
  }

  function cameraPoint(x, y, width, height) {
    const camera = cameraPose();
    const dx = x - camera.x; const dy = y - camera.y;
    const c = Math.cos(camera.theta); const s = Math.sin(camera.theta);
    const forward = dx * c + dy * s; const lateral = -dx * s + dy * c;
    const halfFov = camera.fov * Math.PI / 360;
    const lateralLimit = Math.max(180, Math.tan(halfFov) * Math.max(forward, 120));
    return { x: width * .5 + lateral * width / (2 * lateralLimit), y: height * .8 - forward * height / (camera.range * 1.08), forward, lateral, visible: forward >= -120 && forward <= camera.range && Math.abs(lateral) <= lateralLimit, range: camera.range, fov: camera.fov };
  }

  function detectionValue(detection) {
    const explicit = Number(detection?.value);
    if (Number.isFinite(explicit)) return explicit;
    const text = `${detection?.label || ""} ${detection?.className || ""} ${detection?.piece_type || ""}`.toLowerCase();
    const match = DETECTION_VALUES.find(([token]) => text.includes(token.toLowerCase()));
    return match ? match[1] : 1;
  }

  function normaliseDetections(payload, fallbackWidth, fallbackHeight) {
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.detections) ? payload.detections : [];
    const payloadWidth = Number(payload?.width);
    const payloadHeight = Number(payload?.height);
    if (payload?.model) state.camera.model = String(payload.model);
    if (Number.isFinite(payloadWidth) && payloadWidth > 0) state.camera.frameWidth = payloadWidth;
    else state.camera.frameWidth = fallbackWidth;
    if (Number.isFinite(payloadHeight) && payloadHeight > 0) state.camera.frameHeight = payloadHeight;
    else state.camera.frameHeight = fallbackHeight;
    return list.map((detection, index) => ({
      ...detection,
      id: String(detection?.id || `vision-${state.camera.frameCount}-${index}`),
      label: detection?.label || detection?.piece_type_cn || detection?.className || detection?.piece_type || "棋子",
      confidence: clamp(Number(detection?.confidence) || 0, 0, 1),
    }));
  }

  function detectionWorldPoint(detection) {
    const explicitX = Number(detection?.worldX);
    const explicitY = Number(detection?.worldY);
    if (Number.isFinite(explicitX) && Number.isFinite(explicitY)) return { x: explicitX, y: explicitY };
    const box = detection?.bbox || (Array.isArray(detection?.bbox_xyxy) ? { x: detection.bbox_xyxy[0], y: detection.bbox_xyxy[1], width: detection.bbox_xyxy[2] - detection.bbox_xyxy[0], height: detection.bbox_xyxy[3] - detection.bbox_xyxy[1] } : null);
    if (!box) return null;
    const frameWidth = Math.max(1, state.camera.frameWidth || 560);
    const frameHeight = Math.max(1, state.camera.frameHeight || 230);
    const centerX = Number(box.x) + Number(box.width || 0) / 2;
    const centerY = Number(box.y) + Number(box.height || 0) / 2;
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return null;
    const camera = cameraPose();
    const depthRatio = clamp(0.86 - centerY / frameHeight, 0.08, 0.92);
    const forward = clamp(depthRatio * camera.range * 1.08, 120, camera.range);
    const lateral = (centerX / frameWidth - 0.5) * 2 * Math.tan(camera.fov * Math.PI / 360) * forward;
    return { x: camera.x + forward * Math.cos(camera.theta) - lateral * Math.sin(camera.theta), y: camera.y + forward * Math.sin(camera.theta) + lateral * Math.cos(camera.theta), forward, lateral };
  }

  function visionTargets() {
    if (state.camera.sourceMode !== "real") return [];
    return state.camera.detections.map((detection) => {
      const world = detectionWorldPoint(detection);
      if (!world) return null;
      const side = detection.side === "white" || detection.side === "blue" ? "white" : detection.side === "red" ? "red" : "unknown";
      return { id: detection.id, x: world.x, y: world.y, radius: Math.max(22, Number(detection.radius) || 33.5), value: detectionValue(detection), side, label: detection.label, confidence: detection.confidence, detection };
    }).filter(Boolean).filter((target) => target.confidence >= 0.25).sort(compareStrategyTargets);
  }

  function compareStrategyTargets(first, second) {
    const mode = state.controls.strategyMode || "value_first";
    if (mode === "nearest") return Math.hypot(first.x - state.sim.x, first.y - state.sim.y) - Math.hypot(second.x - state.sim.x, second.y - state.sim.y);
    if (mode === "sweep") return Math.round(first.y / 150) - Math.round(second.y / 150) || first.x - second.x;
    const firstConfidence = Number(first.confidence) || 1; const secondConfidence = Number(second.confidence) || 1;
    return (second.value * 1000 + secondConfidence * 100 - Math.hypot(second.x - state.sim.x, second.y - state.sim.y) / 10) - (first.value * 1000 + firstConfidence * 100 - Math.hypot(first.x - state.sim.x, first.y - state.sim.y) / 10);
  }

  function buildVisionPlan(target) {
    const body = chassis() || { length: 240, width: 280 };
    const goal = { x: target.side === "white" ? FIELD.width - 200 : 200, y: FIELD.height / 2 };
    const standOff = Number(body.length || 240) / 2 + target.radius + 35;
    const approachDirection = goal.x < target.x ? 1 : -1;
    const approach = { x: clamp(target.x + approachDirection * standOff, Number(body.length || 240) / 2, FIELD.width - Number(body.length || 240) / 2), y: clamp(target.y, Number(body.width || 280) / 2, FIELD.height - Number(body.width || 280) / 2) };
    return { source: "vision", targetId: target.id, target, goal, waypoints: [approach, { x: target.x, y: target.y }, goal], activeIndex: 0, updatedAt: Date.now() };
  }

  function updateVisionPlan() {
    if (state.camera.sourceMode !== "real") return null;
    const target = visionTargets()[0];
    if (!target) {
      if (state.camera.plan?.source !== "vision") return null;
      if (Date.now() - state.camera.plan.updatedAt > 1400) state.camera.plan = null;
      return state.camera.plan;
    }
    if (!state.camera.plan || state.camera.plan.targetId !== target.id) state.camera.plan = buildVisionPlan(target);
    else {
      state.camera.plan.target = target;
      state.camera.plan.waypoints[1] = { x: target.x, y: target.y };
      state.camera.plan.waypoints[2] = { x: target.side === "white" ? FIELD.width - 200 : 200, y: FIELD.height / 2 };
      state.camera.plan.updatedAt = Date.now();
    }
    const plan = state.camera.plan;
    const approachDistance = Math.hypot(plan.waypoints[0].x - state.sim.x, plan.waypoints[0].y - state.sim.y);
    const targetDistance = Math.hypot(plan.waypoints[1].x - state.sim.x, plan.waypoints[1].y - state.sim.y);
    plan.activeIndex = approachDistance > 85 ? 0 : targetDistance > 75 ? 1 : 2;
    return plan;
  }

  function buildSimulationPlan(target) {
    const body = chassis() || { length: 240, width: 280 };
    const goal = { x: target.side === "white" ? FIELD.width - 200 : 200, y: FIELD.height / 2 };
    const standOff = Number(body.length || 240) / 2 + target.radius + 35;
    const approachDirection = goal.x < target.x ? 1 : -1;
    const approach = { x: clamp(target.x + approachDirection * standOff, Number(body.length || 240) / 2, FIELD.width - Number(body.length || 240) / 2), y: clamp(target.y, Number(body.width || 280) / 2, FIELD.height - Number(body.width || 280) / 2) };
    return { source: "simulation", targetId: target.id, target, goal, waypoints: [approach, { x: target.x, y: target.y }, goal], activeIndex: 0, updatedAt: Date.now() };
  }

  function updateSimulationPlan(target) {
    if (state.camera.sourceMode === "real") return null;
    if (!state.camera.plan || state.camera.plan.source !== "simulation" || state.camera.plan.targetId !== target.id) state.camera.plan = buildSimulationPlan(target);
    else {
      state.camera.plan.target = target;
      state.camera.plan.waypoints[1] = { x: target.x, y: target.y };
      state.camera.plan.updatedAt = Date.now();
    }
    const plan = state.camera.plan;
    const approachDistance = Math.hypot(plan.waypoints[0].x - state.sim.x, plan.waypoints[0].y - state.sim.y);
    const targetDistance = Math.hypot(plan.waypoints[1].x - state.sim.x, plan.waypoints[1].y - state.sim.y);
    plan.activeIndex = approachDistance > 85 ? 0 : targetDistance > 75 ? 1 : 2;
    return plan;
  }

  function drawRealCameraFrame() {
    const canvas = $("#cameraCanvas");
    const video = $("#cameraVideo");
    if (!canvas || !video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return false;
    const ctx = canvas.getContext("2d");
    const width = canvas.width; const height = canvas.height;
    const sourceRatio = video.videoWidth / video.videoHeight;
    const targetRatio = width / height;
    let sourceWidth = video.videoWidth; let sourceHeight = video.videoHeight; let sourceX = 0; let sourceY = 0;
    if (sourceRatio > targetRatio) { sourceWidth = video.videoHeight * targetRatio; sourceX = (video.videoWidth - sourceWidth) / 2; }
    else if (sourceRatio < targetRatio) { sourceHeight = video.videoWidth / targetRatio; sourceY = (video.videoHeight - sourceHeight) / 2; }
    ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    ctx.fillStyle = "rgba(5, 16, 28, .72)"; ctx.fillRect(8, 8, 156, 20);
    ctx.fillStyle = "#d9e8f9"; ctx.font = "10px Segoe UI, sans-serif"; ctx.textAlign = "left"; ctx.fillText("REAL-CAM · YOLO", 14, 22);
    return true;
  }

  function drawCameraMessage(message) {
    const canvas = $("#cameraCanvas"); if (!canvas) return;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#12283b"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#b7cde3"; ctx.font = "14px Microsoft YaHei, sans-serif"; ctx.textAlign = "center"; ctx.fillText(message, canvas.width / 2, canvas.height / 2);
  }

  function drawDetectionOverlay() {
    const canvas = $("#cameraCanvas"); if (!canvas || state.camera.sourceMode !== "real") return;
    const ctx = canvas.getContext("2d"); ctx.font = "10px Microsoft YaHei, sans-serif"; ctx.textAlign = "left";
    state.camera.detections.forEach((detection) => {
      const box = detection.bbox || (Array.isArray(detection.bbox_xyxy) ? { x: detection.bbox_xyxy[0], y: detection.bbox_xyxy[1], width: detection.bbox_xyxy[2] - detection.bbox_xyxy[0], height: detection.bbox_xyxy[3] - detection.bbox_xyxy[1] } : null);
      if (!box) return;
      const x = Number(box.x) || 0; const y = Number(box.y) || 0; const width = Number(box.width) || 0; const height = Number(box.height) || 0;
      const label = `${detection.label} ${Math.round(detection.confidence * 100)}%`; const metrics = ctx.measureText(label); const labelWidth = Number(metrics?.width) || 0;
      ctx.strokeStyle = "#5ce1bd"; ctx.lineWidth = 2; ctx.strokeRect(x, y, width, height); ctx.fillStyle = "rgba(5, 16, 28, .76)"; ctx.fillRect(x, Math.max(0, y - 16), Math.max(64, labelWidth + 8), 15); ctx.fillStyle = "#e8fff7"; ctx.fillText(label, x + 4, Math.max(11, y - 5));
    });
  }

  function drawCameraViewport() {
    const canvas = $("#cameraCanvas"); if (!canvas) return;
    const ctx = canvas.getContext("2d"); const width = canvas.width; const height = canvas.height; ctx.fillStyle = "#12283b"; ctx.fillRect(0, 0, width, height);
    if (!hasCameraSensor()) { ctx.fillStyle = "#9bb0c7"; ctx.font = "14px Microsoft YaHei, sans-serif"; ctx.textAlign = "center"; ctx.fillText("未安装车载相机", width / 2, height / 2); return; }
    ctx.strokeStyle = "rgba(142,188,211,.18)"; ctx.lineWidth = 1; for (let x = width / 2 - 120; x <= width / 2 + 120; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); } for (let y = 35; y < height; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    state.sim.pieces.forEach((piece) => { const point = cameraPoint(piece.x, piece.y, width, height); if (!point.visible) return; const radius = Math.max(4, piece.radius * width / 700); ctx.fillStyle = piece.side === "red" ? "#d85f73" : "#86a9de"; ctx.strokeStyle = piece.id === state.sim.targetId ? "#ffe08a" : "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#071522"; ctx.font = `${Math.max(8, radius * .7)}px Microsoft YaHei, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(piece.symbol, point.x, point.y); });
    const camera = cameraPose();
    ctx.fillStyle = "#5ce1bd"; ctx.beginPath(); ctx.moveTo(width / 2, height * .82); ctx.lineTo(width / 2 - 11, height * .95); ctx.lineTo(width / 2 + 11, height * .95); ctx.closePath(); ctx.fill(); ctx.fillStyle = "rgba(223,238,247,.7)"; ctx.font = "10px Segoe UI, sans-serif"; ctx.textAlign = "left"; ctx.fillText(`SIM-CAM · t=${formatNumber(state.sim.time, 1)}s · ${Math.round(camera.fov)}° / ${Math.round(camera.range)}mm`, 10, 16);
  }

  function mockYoloDetections() {
    if (!hasCameraSensor()) return [];
    return state.sim.pieces.map((piece) => { const point = cameraPoint(piece.x, piece.y, 560, 230); if (!point.visible) return null; return { id: piece.id, label: `${piece.side === "red" ? "红" : "白"}${piece.symbol}`, kind: piece.kind, side: piece.side, value: piece.value, confidence: clamp(.98 - Math.abs(point.lateral) / Math.max(700, point.range), .55, .98), bbox: { x: point.x - 10, y: point.y - 10, width: 20, height: 20 }, worldX: piece.x, worldY: piece.y }; }).filter(Boolean);
  }

  function renderDetections(detections) {
    const list = $("#detectionList"); if (!list) return; const safeDetections = Array.isArray(detections) ? detections : []; if (!safeDetections.length) { list.innerHTML = '<span class="empty-state">当前视野未识别到目标</span>'; return; }
    const sourceLabel = state.camera.localAdapter ? "本地适配器" : state.camera.adapterMode === "mock" ? "本地模拟" : `HTTP YOLO${state.camera.model ? ` · ${state.camera.model}` : ""}`;
    list.innerHTML = `<div class="detection-summary">识别 ${safeDetections.length} 个目标 · ${sourceLabel}</div>` + safeDetections.slice(0, 32).map((det) => `<div class="detection-row"><strong>${escapeHtml(det.label || det.className || det.name || "piece")}</strong><span>${Math.round((Number(det.confidence) || 0) * 100)}%</span><small>${det.worldX != null && det.worldY != null ? `${Math.round(det.worldX)}, ${Math.round(det.worldY)} mm` : det.bbox ? `box ${Math.round(det.bbox.x || 0)}, ${Math.round(det.bbox.y || 0)}` : "YOLO box"}</small></div>`).join("");
  }

  async function captureCameraFrame(options = {}) {
    const canvas = $("#cameraCanvas"); if (!canvas) return;
    const source = options.source || state.camera.sourceMode;
    try {
      if (source === "real") {
        if (!drawRealCameraFrame()) throw new Error("真实摄像头尚未准备好");
      } else drawCameraViewport();
      state.camera.frameData = canvas.toDataURL("image/png"); state.camera.frameCount += 1; state.camera.capturedAt = new Date().toISOString();
      let detections; let statusOverride = "";
      if (!hasCameraSensor()) throw new Error("未安装车载相机");
      if (state.camera.localAdapter) detections = await state.camera.localAdapter({ imageData: state.camera.frameData, width: canvas.width, height: canvas.height, time: state.sim.time, source });
      else if (source === "real" && state.camera.adapterMode === "mock") {
        detections = [];
        statusOverride = "真实帧已捕获；请选择 HTTP YOLO 或挂载本地适配器";
      } else if (state.camera.adapterMode === "http") {
        if (!state.camera.endpoint) throw new Error("请先填写 HTTP YOLO 地址");
        const response = await fetch(state.camera.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageData: state.camera.frameData, width: canvas.width, height: canvas.height, time: state.sim.time, source }) });
        if (!response.ok) {
          let detail = "";
          try { const errorPayload = await response.json(); detail = errorPayload?.error || ""; } catch (_) {}
          throw new Error(detail || `HTTP ${response.status}`);
        }
        detections = await response.json();
        statusOverride = `第 ${state.camera.frameCount} 帧 · HTTP YOLO 已返回结果`;
      } else detections = mockYoloDetections();
      state.camera.detections = normaliseDetections(detections, canvas.width, canvas.height);
      state.camera.status = statusOverride || `第 ${state.camera.frameCount} 帧 · 识别 ${state.camera.detections.length} 个目标`;
      updateVisionPlan();
    } catch (error) { state.camera.detections = []; state.camera.status = `识别失败：${error.message}`; state.camera.plan = null; }
    const status = $("#cameraStatus"); if (status) status.textContent = state.camera.status; renderDetections(state.camera.detections); updateTelemetry(); draw(); if (source === "real") drawDetectionOverlay();
  }

  function setYoloAdapter(adapter) { state.camera.localAdapter = typeof adapter === "function" ? adapter : null; state.camera.status = state.camera.localAdapter ? "已挂载本地 YOLO 适配器" : "已恢复默认适配器"; const status = $("#cameraStatus"); if (status) status.textContent = state.camera.status; renderDetections(state.camera.detections); }

  function updateCameraButtons() {
    const start = $("#startCameraButton"); const stop = $("#stopCameraButton");
    if (start) start.disabled = state.camera.realRunning;
    if (stop) stop.disabled = !state.camera.realRunning;
  }

  function stopRealCamera(options = {}) {
    state.camera.realRunning = false;
    state.camera.captureBusy = false;
    state.camera.realStream?.getTracks?.().forEach((track) => track.stop());
    state.camera.realStream = null;
    const video = $("#cameraVideo"); if (video) video.srcObject = null;
    if (!options.keepSource) {
      state.camera.sourceMode = "sim";
      state.camera.plan = null;
      const source = $("#cameraSourceMode"); if (source) source.value = "sim";
      drawCameraViewport();
    }
    state.camera.status = options.silent ? state.camera.status : "真实摄像头已停止";
    const status = $("#cameraStatus"); if (status && !options.silent) status.textContent = state.camera.status;
    updateCameraButtons();
  }

  async function realCameraLoop(timestamp) {
    if (!state.camera.realRunning) return;
    if (!state.camera.captureBusy && timestamp - state.camera.lastRealCapture >= state.camera.realIntervalMs) {
      state.camera.lastRealCapture = timestamp;
      state.camera.captureBusy = true;
      try { await captureCameraFrame({ source: "real" }); } finally { state.camera.captureBusy = false; }
    }
    if (state.camera.realRunning) requestAnimationFrame(realCameraLoop);
  }

  async function startRealCamera() {
    if (!hasCameraSensor()) throw new Error("请先在装配中加入车载相机");
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new Error("当前页面没有可用的摄像头权限；请使用 localhost 或 HTTPS 打开");
    const video = $("#cameraVideo"); if (!video) throw new Error("缺少摄像头预览元素");
    stopRealCamera({ keepSource: true, silent: true });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    state.camera.realStream = stream;
    state.camera.sourceMode = "real";
    video.srcObject = stream;
    await video.play();
    state.camera.realRunning = true;
    state.camera.lastRealCapture = 0;
    const source = $("#cameraSourceMode"); if (source) source.value = "real";
    state.camera.status = state.camera.adapterMode === "mock" ? "真实摄像头已启动；请选择 HTTP YOLO 或挂载本地适配器" : "真实摄像头已启动，正在识别";
    const status = $("#cameraStatus"); if (status) status.textContent = state.camera.status;
    updateCameraButtons();
    requestAnimationFrame(realCameraLoop);
  }

  const STORAGE_BUILD_KEY = "xiangqi_sim_vehicle_build_v2";
  let allowStorageSync = false;

  function syncToSharedStorage() {
    if (!allowStorageSync) return;
    try {
      const body = chassis();
      const mot = motor();
      const whl = wheel();
      const dev = collectionDevices()[0];
      const existingRaw = localStorage.getItem(STORAGE_BUILD_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : {
        chassisId: "carbon_light",
        motorId: "geared_360",
        wheelId: "mecanum_4wd",
        deviceId: "brush",
        sensorId: "cam_laser_imu",
        controllerId: "rdk_x5",
        batteryId: "3s_1500",
        overrides: {},
      };
      const ov = { ...(existing.overrides || {}) };
      if (body) {
        ov.length = Number(body.length) / 1000;
        ov.width = Number(body.width) / 1000;
        ov.height = Number(body.height) / 1000;
      }
      if (mot) {
        ov.rpm = Number(mot.rpm);
        ov.torque = Number(mot.torque);
        ov.gear = Number(mot.gear);
      }
      if (whl) {
        ov.wheelRadius = Number(whl.radius) / 1000;
        ov.track = Number(whl.track) / 1000;
        ov.wheelbase = Number(whl.wheelbase) / 1000;
      }
      if (dev) {
        ov.deviceWidth = Number(dev.width) / 1000;
        ov.deviceOffset = Number(dev.offset) / 1000;
      }
      localStorage.setItem(STORAGE_BUILD_KEY, JSON.stringify({ ...existing, overrides: ov, from2d: true }));
    } catch (_) {}
  }

  function applySharedStorageOnInit() {
    try {
      const raw = localStorage.getItem(STORAGE_BUILD_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const r = parsed?.resolved;
      if (!r) return false;
      const body = chassis();
      const mot = motor();
      const whl = wheel();
      const dev = collectionDevices()[0];
      if (body && r.lengthMm) {
        body.length = r.lengthMm;
        body.width = r.widthMm || body.width;
        body.height = r.heightMm || body.height;
      }
      if (mot && r.rpm) {
        mot.rpm = r.rpm;
        mot.torque = r.torque || mot.torque;
        mot.gear = r.gear || mot.gear;
      }
      if (whl && r.wheelRadiusMm) {
        whl.radius = r.wheelRadiusMm;
        whl.track = r.trackMm || whl.track;
        whl.wheelbase = r.wheelbaseMm || whl.wheelbase;
        if (r.driveMode === "mecanum") whl.kind = "mecanum";
        else if (r.driveMode === "omni") whl.kind = "omni";
        else whl.kind = "standard";
      }
      if (dev && r.deviceWidthMm) {
        dev.width = r.deviceWidthMm;
        dev.offset = r.deviceOffsetMm || dev.offset;
        dev.kind = r.deviceKind === "active_roller" ? "roller" : r.deviceKind === "brush" ? "brush" : "push_plate";
      }
      if (r.driveMode) {
        state.controls.driveMode = r.driveMode === "mecanum" ? "mecanum" : r.driveMode === "omni" ? "omni" : "diff";
        syncStrategyControls();
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function renderAll() { renderAssembly(); renderInspector(); updateTelemetry(); draw(); renderDetections(state.camera.detections); syncToSharedStorage(); }

  function clearCameraResults() {
    state.camera.detections = [];
    state.camera.frameData = null;
    state.camera.frameCount = 0;
    state.camera.capturedAt = null;
    state.camera.plan = null;
    state.camera.status = hasCameraSensor() ? "场景已重置，等待捕获帧" : "装配摄像头后可捕获帧";
    const status = $("#cameraStatus"); if (status) status.textContent = state.camera.status;
    renderDetections([]);
  }

  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
  function escapeAttr(value) { return escapeHtml(value); }
  function radToDeg(value) { return value * 180 / Math.PI; }

  function resetSimulation() {
    state.sim.running = false;
    state.sim.time = 0;
    state.sim.x = 150;
    state.sim.y = FIELD.height - 150;
    state.sim.theta = 0;
    state.sim.trace = [];
    state.sim.lastTrace = 0;
    state.sim.lastFrame = 0;
    state.sim.pieces = randomPieces();
    state.sim.targetId = null;
    state.sim.score = 0;
    state.sim.scoredPieces = [];
    state.sim.drag = null;
    clearCameraResults();
    setRunUi();
    updateTelemetry();
    draw();
  }

  function resetPieces() {
    state.sim.pieces = randomPieces();
    state.sim.targetId = null;
    state.sim.score = 0;
    state.sim.scoredPieces = [];
    state.sim.drag = null;
    clearCameraResults();
    updateTelemetry();
    draw();
  }

  function getKinematics(controls = state.controls) {
    const maxSpeed = estimateMaxSpeed();
    const body = chassis();
    const wheelModule = wheel();
    const wheelBase = Math.max(80, Number(wheelModule?.track) || Number(wheelModule?.wheelbase) || Number(body?.length) * 0.72 || 170);
    const throttle = Number(controls.throttle) || 0;
    const steer = Number(controls.steer) || 0;
    const strafe = Number(controls.strafe) || 0;
    const mode = controls.driveMode;
    if (mode === "mecanum" || mode === "omni" || wheelModule?.kind === "mecanum" || wheelModule?.kind === "omni") {
      return { vx: maxSpeed * throttle, vy: maxSpeed * strafe * 0.82, omega: maxSpeed / wheelBase * steer * 0.8 };
    }
    return { vx: maxSpeed * throttle, vy: 0, omega: maxSpeed / wheelBase * steer * 0.85 };
  }

  function chooseStrategyTarget() {
    const visionPlan = updateVisionPlan();
    if (visionPlan?.target) {
      state.sim.targetId = visionPlan.targetId;
      return visionPlan.target;
    }
    const candidates = state.sim.pieces.filter((piece) => piece.side === "red" && !piece.scored);
    if (!candidates.length) { state.sim.targetId = null; if (state.camera.sourceMode !== "real") state.camera.plan = null; return null; }
    const ranked = candidates.slice().sort(compareStrategyTargets);
    state.sim.targetId = ranked[0].id;
    updateSimulationPlan(ranked[0]);
    return ranked[0];
  }

  function driveTowardPoint(point, throttleMax = 0.8) {
    const distance = Math.hypot(point.x - state.sim.x, point.y - state.sim.y);
    const desired = Math.atan2(point.y - state.sim.y, point.x - state.sim.x);
    const error = Math.atan2(Math.sin(desired - state.sim.theta), Math.cos(desired - state.sim.theta));
    return { throttle: clamp(distance / 800, 0.2, throttleMax), steer: clamp(error * 1.7, -1, 1), strafe: 0, driveMode: state.controls.driveMode };
  }

  function strategyControls() {
    const visionPlan = updateVisionPlan();
    if (visionPlan?.target) {
      const waypoint = visionPlan.waypoints[visionPlan.activeIndex] || visionPlan.goal;
      if (Math.hypot(waypoint.x - state.sim.x, waypoint.y - state.sim.y) > 70) return driveTowardPoint(waypoint, visionPlan.activeIndex === 2 ? 0.62 : 0.8);
      const desired = Math.atan2(visionPlan.goal.y - visionPlan.target.y, visionPlan.goal.x - visionPlan.target.x);
      const error = Math.atan2(Math.sin(desired - state.sim.theta), Math.cos(desired - state.sim.theta));
      return { throttle: 0.58, steer: clamp(error * 1.8, -1, 1), strafe: 0, driveMode: state.controls.driveMode };
    }
    const target = state.sim.pieces.find((piece) => piece.id === state.sim.targetId && !piece.scored) || chooseStrategyTarget();
    if (!target) return { throttle: 0, steer: 0, strafe: 0, driveMode: state.controls.driveMode };
    const body = chassis() || { length: 240, width: 280 };
    const standOff = Number(body.length || 240) / 2 + target.radius + 35;
    const approachX = Math.min(FIELD.width - Number(body.length || 240) / 2, target.x + standOff);
    const distance = Math.hypot(approachX - state.sim.x, target.y - state.sim.y);
    if (distance > 70) return driveTowardPoint({ x: approachX, y: target.y });
    const error = Math.atan2(Math.sin(Math.PI - state.sim.theta), Math.cos(Math.PI - state.sim.theta));
    return { throttle: 0.7, steer: clamp(error * 1.8, -1, 1), strafe: 0, driveMode: state.controls.driveMode };
  }

  function devicePose(device) {
    const bodyTheta = state.sim.theta;
    const bodyCos = Math.cos(bodyTheta); const bodySin = Math.sin(bodyTheta);
    const mountX = Number(device.mountX) || 0; const mountY = Number(device.mountY) || 0;
    const deviceTheta = bodyTheta + (Number(device.mountYaw) || 0) * Math.PI / 180;
    const reach = Number(device.offset) || 0;
    const mountWorldX = state.sim.x + mountX * bodyCos - mountY * bodySin;
    const mountWorldY = state.sim.y + mountX * bodySin + mountY * bodyCos;
    return { x: mountWorldX + reach * Math.cos(deviceTheta), y: mountWorldY + reach * Math.sin(deviceTheta), theta: deviceTheta };
  }

  function deviceTransfer(device) {
    const kindFactor = { push_plate: 0.92, roller: 1.08, brush: 1.02, scoop: 0.78 }[device.kind] || 0.9;
    const ratio = clamp(Number(device.driveRatio) || 1, 0.1, 3);
    if (device.actuation !== "motor") return kindFactor;
    const motorModule = motorForDevice(device);
    if (!motorModule) return 0;
    return kindFactor * clamp((Number(motorModule.rpm) || 0) / 420 * ratio, 0.25, 1.8);
  }

  function pushPieces(velocity, seconds) {
    const devices = collectionDevices();
    if (!devices.length) return;
    const worldVx = velocity.vx * Math.cos(state.sim.theta) - velocity.vy * Math.sin(state.sim.theta);
    const worldVy = velocity.vx * Math.sin(state.sim.theta) + velocity.vy * Math.cos(state.sim.theta);
    state.sim.pieces.forEach((piece) => {
      if (piece.scored) return;
      let contact = null;
      devices.forEach((device) => {
        if (contact) return;
        const pose = devicePose(device);
        const dx = piece.x - pose.x; const dy = piece.y - pose.y;
        const c = Math.cos(pose.theta); const s = Math.sin(pose.theta);
        const forward = dx * c + dy * s; const lateral = -dx * s + dy * c;
        const halfWidth = Math.max(10, Number(device.width) || 150) / 2;
        const inContactDepth = piece.radius + (device.kind === "roller" ? 42 : device.kind === "brush" ? 34 : 28);
        const aligned = Math.abs(lateral) <= halfWidth + piece.radius;
        const inContact = forward >= -piece.radius - 16 && forward <= inContactDepth;
        const vehicleDrive = worldVx * c + worldVy * s;
        const linkedMotor = motorForDevice(device);
        const motorKindFactor = { dc_encoder: 1, brushless: 1.2, geared: 0.78, servo: 0.38 }[linkedMotor?.kind] || 1;
        const motorSurface = device.actuation === "motor" && linkedMotor ? clamp((Number(linkedMotor.rpm) || 0) * 2 * Math.PI * 20 / 60 * (Number(device.driveRatio) || 1) * 0.18 * motorKindFactor, 0, 900) : 0;
        if (aligned && inContact && (vehicleDrive > 1 || motorSurface > 1)) contact = { device, pose, vehicleDrive, motorSurface };
      });
      if (!contact) return;
      const { device, pose, vehicleDrive, motorSurface } = contact;
      const gain = deviceTransfer(device);
      let transportX; let transportY;
      if (vehicleDrive > 1) {
        transportX = worldVx * gain;
        transportY = worldVy * gain;
      } else {
        const rollerSpeed = motorSurface * Math.max(0.2, Math.min(1, gain));
        transportX = Math.cos(pose.theta) * rollerSpeed;
        transportY = Math.sin(pose.theta) * rollerSpeed;
      }
      piece.x = clamp(piece.x + transportX * seconds, piece.radius, FIELD.width - piece.radius);
      piece.y = clamp(piece.y + transportY * seconds, piece.radius, FIELD.height - piece.radius);
      const insideGoal = piece.side === "red" && piece.x + piece.radius <= 400 && piece.y - piece.radius >= 700 && piece.y + piece.radius <= 1300;
      if (insideGoal) { piece.scored = true; state.sim.scoredPieces.push(piece.id); state.sim.score += piece.value; }
    });
  }

  function step(dt) {
    const velocity = getKinematics(state.controls.autoStrategy ? strategyControls() : state.controls);
    const scale = Number(state.controls.timeScale) || 1;
    const seconds = dt * scale;
    const { theta } = state.sim;
    state.sim.x += (velocity.vx * Math.cos(theta) - velocity.vy * Math.sin(theta)) * seconds;
    state.sim.y += (velocity.vx * Math.sin(theta) + velocity.vy * Math.cos(theta)) * seconds;
    state.sim.theta += velocity.omega * seconds;
    const margin = 150;
    if (state.sim.x < margin || state.sim.x > FIELD.width - margin) {
      state.sim.x = Math.max(margin, Math.min(FIELD.width - margin, state.sim.x));
      state.controls.throttle *= -0.15;
    }
    if (state.sim.y < margin || state.sim.y > FIELD.height - margin) {
      state.sim.y = Math.max(margin, Math.min(FIELD.height - margin, state.sim.y));
      state.controls.throttle *= -0.15;
    }
    state.sim.time += seconds;
    pushPieces(velocity, seconds);
    if (state.sim.time - state.sim.lastTrace > 0.04) {
      state.sim.trace.push({ x: state.sim.x, y: state.sim.y });
      if (state.sim.trace.length > 1400) state.sim.trace.shift();
      state.sim.lastTrace = state.sim.time;
    }
  }

  function animationFrame(timestamp) {
    if (!state.sim.running) return;
    if (!state.sim.lastFrame) state.sim.lastFrame = timestamp;
    const dt = Math.min(0.05, Math.max(0, (timestamp - state.sim.lastFrame) / 1000));
    state.sim.lastFrame = timestamp;
    step(dt);
    updateTelemetry();
    draw();
    requestAnimationFrame(animationFrame);
  }

  function setRunUi() {
    $("#runButton").textContent = state.sim.running ? "Ⅱ 暂停" : "▶ 运行";
    $("#simStatus").textContent = state.sim.running ? "仿真运行中" : "已暂停";
    $("#liveDot").classList.toggle("live", state.sim.running);
  }

  function toggleRun() {
    if (!state.sim.running && !compliance().body) {
      $("#complianceNote").textContent = "请先加入底盘，再开始仿真。";
      return;
    }
    state.sim.running = !state.sim.running;
    state.sim.lastFrame = 0;
    setRunUi();
    if (state.sim.running) requestAnimationFrame(animationFrame);
  }

  function worldToCanvas(x, y, width, height) {
    const padding = 34;
    const scale = Math.min((width - padding * 2) / FIELD.width, (height - padding * 2) / FIELD.height);
    return { x: padding + x * scale, y: padding + y * scale, scale };
  }

  function canvasWorldPoint(event) {
    const canvas = $("#simCanvas");
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: canvas.clientWidth || canvas.width, height: canvas.clientHeight || canvas.height };
    const width = canvas.clientWidth || canvas.width; const height = canvas.clientHeight || canvas.height;
    const pixelX = (event.clientX - rect.left) * width / Math.max(1, rect.width || width);
    const pixelY = (event.clientY - rect.top) * height / Math.max(1, rect.height || height);
    const field = worldToCanvas(0, 0, width, height);
    return { x: clamp((pixelX - field.x) / field.scale, 0, FIELD.width), y: clamp((pixelY - field.y) / field.scale, 0, FIELD.height) };
  }

  function pieceAtWorldPoint(x, y) {
    let selected = null; let nearest = Infinity;
    state.sim.pieces.slice().reverse().forEach((piece) => {
      const distance = Math.hypot(piece.x - x, piece.y - y);
      const hitRadius = Math.max(48, Number(piece.radius) + 28);
      if (distance <= hitRadius && distance < nearest) { selected = piece; nearest = distance; }
    });
    return selected;
  }

  function clearPieceScore(piece) {
    if (!piece.scored) return;
    piece.scored = false;
    state.sim.scoredPieces = state.sim.scoredPieces.filter((id) => id !== piece.id);
    state.sim.score = Math.max(0, state.sim.score - (Number(piece.value) || 0));
  }

  function handlePiecePointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    const point = canvasWorldPoint(event); const piece = pieceAtWorldPoint(point.x, point.y);
    if (!piece) return;
    clearPieceScore(piece);
    state.sim.drag = { id: piece.id, offsetX: piece.x - point.x, offsetY: piece.y - point.y, pointerId: event.pointerId };
    const canvas = $("#simCanvas"); canvas.setPointerCapture?.(event.pointerId); if (canvas.style) canvas.style.cursor = "grabbing";
    event.preventDefault?.(); draw();
  }

  function handlePiecePointerMove(event) {
    const drag = state.sim.drag;
    if (!drag || (drag.pointerId != null && event.pointerId != null && drag.pointerId !== event.pointerId)) return;
    const point = canvasWorldPoint(event); const piece = state.sim.pieces.find((item) => item.id === drag.id);
    if (!piece) return;
    piece.x = clamp(point.x + drag.offsetX, piece.radius, FIELD.width - piece.radius);
    piece.y = clamp(point.y + drag.offsetY, piece.radius, FIELD.height - piece.radius);
    clearPieceScore(piece);
    updateTelemetry(); draw();
    event.preventDefault?.();
  }

  function handlePiecePointerUp(event) {
    const drag = state.sim.drag;
    if (!drag || (drag.pointerId != null && event.pointerId != null && drag.pointerId !== event.pointerId)) return;
    state.sim.drag = null;
    const canvas = $("#simCanvas"); canvas.releasePointerCapture?.(event.pointerId); if (canvas.style) canvas.style.cursor = "grab";
    updateTelemetry(); draw();
    event.preventDefault?.();
  }

  function bindPieceDragging() {
    const canvas = $("#simCanvas");
    canvas.addEventListener("pointerdown", handlePiecePointerDown);
    canvas.addEventListener("pointermove", handlePiecePointerMove);
    canvas.addEventListener("pointerup", handlePiecePointerUp);
    canvas.addEventListener("pointercancel", handlePiecePointerUp);
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + width, y, x + width, y + height, r); ctx.arcTo(x + width, y + height, x, y + height, r); ctx.arcTo(x, y + height, x, y, r); ctx.arcTo(x, y, x + width, y, r); ctx.closePath();
  }

  function draw() {
    const canvas = $("#simCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    const scaleX = width / canvas.width; const scaleY = height / canvas.height;
    if (canvas.width !== Math.round(width * devicePixelRatio)) canvas.width = Math.round(width * devicePixelRatio);
    if (canvas.height !== Math.round(height * devicePixelRatio)) canvas.height = Math.round(height * devicePixelRatio);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const field = worldToCanvas(0, 0, width, height);
    const fieldWidth = FIELD.width * field.scale; const fieldHeight = FIELD.height * field.scale;
    const ox = field.x; const oy = field.y;
    const gradient = ctx.createLinearGradient(0, 0, width, height); gradient.addColorStop(0, "#0b2332"); gradient.addColorStop(1, "#071522");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#0c2c37"; ctx.fillRect(ox, oy, fieldWidth, fieldHeight);
    ctx.strokeStyle = "rgba(135, 192, 204, .22)"; ctx.lineWidth = 1; ctx.strokeRect(ox, oy, fieldWidth, fieldHeight);
    ctx.strokeStyle = "rgba(150, 197, 218, .08)";
    for (let x = 0; x <= FIELD.width; x += 300) { const px = ox + x * field.scale; ctx.beginPath(); ctx.moveTo(px, oy); ctx.lineTo(px, oy + fieldHeight); ctx.stroke(); }
    for (let y = 0; y <= FIELD.height; y += 300) { const py = oy + y * field.scale; ctx.beginPath(); ctx.moveTo(ox, py); ctx.lineTo(ox + fieldWidth, py); ctx.stroke(); }
    drawGoals(ctx, ox, oy, field.scale);
    drawTrackZones(ctx, ox, oy, field.scale);
    drawPieces(ctx, ox, oy, field.scale);
    drawTrace(ctx, ox, oy, field.scale);
    drawCollectionPlan(ctx, ox, oy, field.scale);
    drawRobot(ctx, ox, oy, field.scale);
    ctx.font = "10px Inter, sans-serif"; ctx.fillStyle = "rgba(201, 225, 234, .52)"; ctx.fillText("3000 mm", ox + fieldWidth - 48, oy + fieldHeight + 20); ctx.save(); ctx.translate(ox - 22, oy + 42); ctx.rotate(-Math.PI / 2); ctx.fillText("2000 mm", 0, 0); ctx.restore();
    if (state.camera.sourceMode !== "real") drawCameraViewport();
    else if (!state.camera.realRunning) drawCameraMessage("已选择真实摄像头 · 点击启动");
  }

  function drawGoals(ctx, ox, oy, scale) {
    const laneW = 400 * scale; const goalH = 600 * scale; const goalY = oy + (FIELD.height - 600) * scale / 2;
    ctx.fillStyle = "rgba(216, 95, 115, .08)"; ctx.fillRect(ox, oy, laneW, FIELD.height * scale);
    ctx.fillStyle = "rgba(134, 169, 222, .08)"; ctx.fillRect(ox + (FIELD.width - 400) * scale, oy, laneW, FIELD.height * scale);
    ctx.fillStyle = "rgba(216, 95, 115, .22)"; ctx.fillRect(ox, goalY, laneW, goalH);
    ctx.fillStyle = "rgba(134, 169, 222, .22)"; ctx.fillRect(ox + (FIELD.width - 400) * scale, goalY, laneW, goalH);
    ctx.font = "10px Inter, sans-serif"; ctx.fillStyle = "rgba(255, 195, 205, .85)"; ctx.fillText("甲队球门区 400×600", ox + 10, goalY + goalH / 2); ctx.fillStyle = "rgba(197, 215, 255, .85)"; ctx.fillText("乙队球门区 400×600", ox + (FIELD.width - 390) * scale, goalY + goalH / 2);
  }

  function drawTrackZones(ctx, ox, oy, scale) {
    const startSize = 300 * scale; const pileSize = 600 * scale;
    ctx.save(); ctx.fillStyle = "rgba(255, 197, 107, .1)"; ctx.strokeStyle = "rgba(255, 197, 107, .65)"; ctx.setLineDash([4, 3]);
    ctx.fillRect(ox, oy + (FIELD.height - 300) * scale, startSize, startSize); ctx.strokeRect(ox, oy + (FIELD.height - 300) * scale, startSize, startSize);
    ctx.fillRect(ox + (FIELD.width - 300) * scale, oy, startSize, startSize); ctx.strokeRect(ox + (FIELD.width - 300) * scale, oy, startSize, startSize);
    ctx.fillStyle = "rgba(255, 255, 255, .05)"; ctx.strokeStyle = "rgba(255, 255, 255, .55)"; ctx.fillRect(1200 * scale + ox, 700 * scale + oy, pileSize, pileSize); ctx.strokeRect(1200 * scale + ox, 700 * scale + oy, pileSize, pileSize);
    ctx.setLineDash([]); ctx.fillStyle = "rgba(255, 197, 107, .82)"; ctx.font = "9px Microsoft YaHei, sans-serif"; ctx.fillText("甲发车区 300×300", 8 * scale + ox, (FIELD.height - 315) * scale + oy); ctx.fillText("乙发车区 300×300", (FIELD.width - 292) * scale + ox, 16 * scale + oy); ctx.fillStyle = "rgba(218, 231, 239, .78)"; ctx.fillText("中央棋子堆放区 600×600", 1230 * scale + ox, 690 * scale + oy); ctx.fillText("四周挡板高 300 mm", 1210 * scale + ox, 28 * scale + oy);
    ctx.strokeStyle = "rgba(225, 239, 245, .72)"; ctx.lineWidth = 3; ctx.strokeRect(ox, oy, FIELD.width * scale, FIELD.height * scale); ctx.restore();
  }

  function drawTrace(ctx, ox, oy, scale) {
    if (state.sim.trace.length < 2) return;
    ctx.save(); ctx.strokeStyle = "rgba(92, 225, 189, .55)"; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath();
    state.sim.trace.forEach((point, index) => { const px = ox + point.x * scale; const py = oy + point.y * scale; if (!index) ctx.moveTo(px, py); else ctx.lineTo(px, py); }); ctx.stroke(); ctx.restore();
  }

  function drawCollectionPlan(ctx, ox, oy, scale) {
    const plan = state.camera.plan;
    if (!plan?.waypoints?.length || !state.controls.autoStrategy) return;
    const points = [{ x: state.sim.x, y: state.sim.y }, ...plan.waypoints];
    ctx.save(); ctx.strokeStyle = "rgba(255, 197, 107, .88)"; ctx.fillStyle = "#ffc56b"; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.beginPath();
    points.forEach((point, index) => { const px = ox + point.x * scale; const py = oy + point.y * scale; if (!index) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
    ctx.stroke(); ctx.setLineDash([]);
    plan.waypoints.forEach((point, index) => { const px = ox + point.x * scale; const py = oy + point.y * scale; ctx.beginPath(); ctx.arc(px, py, index === plan.activeIndex ? 7 : 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "rgba(255, 239, 195, .9)"; ctx.font = "9px Microsoft YaHei, sans-serif"; ctx.fillText(`${index + 1}`, px + 9, py - 7); ctx.fillStyle = "#ffc56b"; });
    ctx.restore();
  }

  function drawPieces(ctx, ox, oy, scale) {
    if (!Array.isArray(state.sim.pieces)) return;
    state.sim.pieces.forEach((piece) => {
      const px = ox + piece.x * scale; const py = oy + piece.y * scale; const radius = Math.max(4, piece.radius * scale);
      ctx.save();
      ctx.fillStyle = piece.side === "red" ? "#d85f73" : "#86a9de";
      const dragging = state.sim.drag?.id === piece.id;
      ctx.strokeStyle = dragging ? "#ffffff" : piece.id === state.sim.targetId ? "#ffe08a" : "rgba(255,255,255,.48)";
      ctx.lineWidth = dragging ? 3 : piece.id === state.sim.targetId ? 2.5 : 1;
      ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#071522"; ctx.font = `${Math.max(7, radius * 0.75)}px Microsoft YaHei, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(piece.symbol, px, py + 1);
      if (piece.scored) { ctx.strokeStyle = "#5ce1bd"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, radius + 3, 0, Math.PI * 2); ctx.stroke(); }
      if (dragging) { ctx.strokeStyle = "rgba(255, 255, 255, .9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, radius + 6, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    });
  }

  function drawMountedRect(ctx, module, scale, lengthMm, widthMm, fill, stroke) {
    const x = (Number(module.mountX) || 0) * scale; const y = (Number(module.mountY) || 0) * scale; const yaw = (Number(module.mountYaw) || 0) * Math.PI / 180;
    ctx.save(); ctx.translate(x, y); ctx.rotate(yaw); roundedRect(ctx, -lengthMm * scale / 2, -widthMm * scale / 2, lengthMm * scale, widthMm * scale, 4); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke || fill; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  }

  function drawRobot(ctx, ox, oy, scale) {
    const body = chassis() || { width: 280, length: 240, height: 100 };
    const px = ox + state.sim.x * scale; const py = oy + state.sim.y * scale; const width = Number(body.width || 280) * scale; const length = Number(body.length || 240) * scale;
    ctx.save(); ctx.translate(px, py); ctx.rotate(state.sim.theta);
    ctx.shadowColor = "rgba(0, 0, 0, .35)"; ctx.shadowBlur = 13; ctx.shadowOffsetY = 5;
    roundedRect(ctx, -length / 2, -width / 2, length, width, 10); ctx.fillStyle = "#193b50"; ctx.fill(); ctx.shadowColor = "transparent"; ctx.strokeStyle = "#70e4c5"; ctx.lineWidth = 1.5; ctx.stroke();
    const wheelModule = wheel(); const wheelR = Math.max(7, Number(wheelModule?.radius || 32) * scale); const wheelW = Math.max(5, Number(wheelModule?.width || 18) * scale); const wheelTrack = Number(wheelModule?.track || Number(body.width || 280) * .72) * scale; const wheelBase = Number(wheelModule?.wheelbase || Number(body.length || 240) * .72) * scale;
    const wheelPositions = [[-wheelBase / 2, -wheelTrack / 2], [-wheelBase / 2, wheelTrack / 2], [wheelBase / 2, -wheelTrack / 2], [wheelBase / 2, wheelTrack / 2]];
    const wheelCount = Math.max(2, Math.min(4, Math.round(Number(wheelModule?.count || 4))));
    ctx.fillStyle = "#071018"; wheelPositions.slice(0, wheelCount).forEach(([wx, wy]) => { ctx.save(); ctx.translate(wx, wy); ctx.rotate(Math.PI / 2); roundedRect(ctx, -wheelR, -wheelW / 2, wheelR * 2, wheelW, 4); ctx.fill(); ctx.restore(); });
    ctx.fillStyle = "#5ce1bd"; ctx.beginPath(); ctx.moveTo(length / 2 + 10, 0); ctx.lineTo(length / 2 - 2, -7); ctx.lineTo(length / 2 - 2, 7); ctx.closePath(); ctx.fill();
    state.modules.filter((module) => module.type === "motor").forEach((module) => {
      const offset = Math.max(18, wheelTrack / scale / 2 - 18); const count = Math.max(1, Math.round(Number(module.count || 2)));
      for (let index = 0; index < Math.min(count, 2); index += 1) drawMountedRect(ctx, { ...module, mountY: (Number(module.mountY) || 0) + (index ? offset : -offset) }, scale, 60, 34, "#b88b52", "#e4c789");
    });
    state.modules.filter((module) => module.type === "sensor").forEach((module) => {
      drawMountedRect(ctx, module, scale, 65, 45, "#385b9b", "#91b8ff");
      const sx = (Number(module.mountX) || 0) * scale; const sy = (Number(module.mountY) || 0) * scale; const yaw = (Number(module.mountYaw) || 0) * Math.PI / 180; const range = Math.min(300, Number(module.range) || 180) * scale; const fov = (Number(module.fov) || 70) * Math.PI / 360;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(yaw); ctx.fillStyle = "rgba(117, 168, 255, .13)"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, range, -fov, fov); ctx.closePath(); ctx.fill(); ctx.restore();
    });
    state.modules.filter((module) => module.type === "battery").forEach((module) => drawMountedRect(ctx, module, scale, 85, 50, "#784f7b", "#d092d4"));
    state.modules.filter((module) => module.type === "controller").forEach((module) => drawMountedRect(ctx, module, scale, 65, 42, "#315e5d", "#84c5a7"));
    state.modules.filter((module) => module.type === "safety").forEach((module) => drawMountedRect(ctx, module, scale, 45, 28, "#7c5b30", "#ffc56b"));
    state.modules.filter((module) => module.type === "pusher" || module.type === "collector").forEach((device) => {
      const x = ((Number(device.mountX) || 0) + (Number(device.offset) || 0)) * scale; const y = (Number(device.mountY) || 0) * scale; const yaw = (Number(device.mountYaw) || 0) * Math.PI / 180; const half = Number(device.width || 150) * scale / 2;
      const color = { push_plate: "#ffc56b", roller: "#5ce1bd", brush: "#84b9ff", scoop: "#c795ff" }[device.kind] || (device.type === "collector" ? "#c795ff" : "#ffc56b");
      ctx.save(); ctx.translate(x, y); ctx.rotate(yaw); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(2, Number(device.width || 150) * scale * .06);
      if (device.kind === "roller") { for (let index = -2; index <= 2; index += 1) { ctx.beginPath(); ctx.arc(0, index * half / 2.4, Math.max(3, 7 * scale), 0, Math.PI * 2); ctx.fill(); } }
      else if (device.kind === "brush") { ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(0, -half); ctx.lineTo(0, half); ctx.stroke(); ctx.setLineDash([]); for (let index = -2; index <= 2; index += 1) { ctx.beginPath(); ctx.moveTo(0, index * half / 2.4); ctx.lineTo(-8 * scale, index * half / 2.4); ctx.stroke(); } }
      else { ctx.beginPath(); ctx.moveTo(0, -half); ctx.lineTo(0, half); ctx.stroke(); }
      ctx.restore();
    });
    ctx.restore();
  }

  function exportConfig() {
    const payload = { version: 1, createdAt: new Date().toISOString(), controls: state.controls, modules: state.modules };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "赛道一小车装配方案.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importConfig(file) {
    const reader = new FileReader(); reader.onload = () => { try {
      const payload = JSON.parse(reader.result);
      if (!Array.isArray(payload.modules)) throw new Error("缺少 modules");
      const supported = payload.modules.filter((module) => module && Object.prototype.hasOwnProperty.call(MODULE_META, module.type));
      if (supported.length !== payload.modules.length) throw new Error("配置包含未知模块类型");
      state.modules = supported.map((module) => {
        const defaults = MODULE_META[module.type].defaults;
        const overrides = {};
        Object.keys(defaults).forEach((key) => {
          const incoming = module[key];
          if (typeof defaults[key] === "number") {
            overrides[key] = Number.isFinite(Number(incoming)) ? Number(incoming) : defaults[key];
          } else {
            overrides[key] = incoming == null ? defaults[key] : String(incoming);
          }
        });
        const normalised = createModule(module.type, overrides);
        normalised.id = typeof module.id === "string" && module.id.trim() ? module.id : uid(module.type);
        return normalised;
      });
      state.controls = { ...state.controls, ...(payload.controls || {}) };
      $("#autoStrategyControl").checked = Boolean(state.controls.autoStrategy);
      $("#driveMode").value = state.controls.driveMode;
      $("#strategyMode").value = state.controls.strategyMode || "value_first";
      state.selectedId = state.modules[0]?.id || null;
      resetSimulation(); renderAll();
    } catch (error) { alert(`配置读取失败：${error.message}`); } }; reader.readAsText(file, "utf-8");
  }

  function bindControls() {
    bindPieceDragging();
    document.querySelectorAll("[data-module]").forEach((button) => button.addEventListener("click", () => addModule(button.dataset.module)));
    $("#loadPresetButton").addEventListener("click", loadPreset);
    $("#bestSchemeButton").addEventListener("click", loadBestPreset);
    $("#clearButton").addEventListener("click", () => { state.modules = []; state.selectedId = null; resetSimulation(); renderAll(); });
    $("#resetPiecesButton").addEventListener("click", resetPieces);
    $("#exportButton").addEventListener("click", exportConfig);
    $("#importButton").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", (event) => { if (event.target.files[0]) importConfig(event.target.files[0]); event.target.value = ""; });
    $("#runButton").addEventListener("click", toggleRun);
    $("#resetButton").addEventListener("click", resetSimulation);
    const rangeBindings = [["throttleControl", "throttle", "throttleValue"], ["steerControl", "steer", "steerValue"], ["strafeControl", "strafe", "strafeValue"], ["timeScaleControl", "timeScale", "timeScaleValue"]];
    rangeBindings.forEach(([inputId, key, outputId]) => { const input = $(`#${inputId}`); input.addEventListener("input", () => { state.controls[key] = Number(input.value); $("#" + outputId).textContent = key === "timeScale" ? `${Number(input.value).toFixed(1)}×` : Number(input.value).toFixed(2); }); });
    $("#driveMode").addEventListener("change", (event) => { state.controls.driveMode = event.target.value; });
    $("#strategyMode").addEventListener("change", (event) => { state.controls.strategyMode = event.target.value; state.sim.targetId = null; updateTelemetry(); draw(); });
    $("#autoStrategyControl").addEventListener("change", (event) => { state.controls.autoStrategy = event.target.checked; if (!event.target.checked) state.sim.targetId = null; updateTelemetry(); draw(); });
    $("#captureFrameButton").addEventListener("click", captureCameraFrame);
    $("#yoloAdapterMode").addEventListener("change", (event) => { state.camera.adapterMode = event.target.value; $("#yoloEndpoint").disabled = event.target.value !== "http"; $("#cameraStatus").textContent = event.target.value === "http" ? "捕获时将把当前帧 POST 到 HTTP YOLO 地址" : "本地模拟识别已就绪"; renderDetections(state.camera.detections); updateTelemetry(); });
    const yoloEndpoint = $("#yoloEndpoint"); yoloEndpoint.value = state.camera.endpoint; yoloEndpoint.disabled = state.camera.adapterMode !== "http";
    yoloEndpoint.addEventListener("input", (event) => { state.camera.endpoint = event.target.value.trim(); });
    $("#cameraSourceMode").addEventListener("change", (event) => { if (event.target.value === "real") { state.camera.sourceMode = "real"; state.camera.plan = null; $("#cameraStatus").textContent = state.camera.realRunning ? "真实摄像头正在运行" : "已选择真实摄像头；点击启动"; } else { stopRealCamera(); } updateTelemetry(); draw(); });
    $("#startCameraButton").addEventListener("click", async () => { try { await startRealCamera(); } catch (error) { state.camera.status = `摄像头启动失败：${error.message}`; $("#cameraStatus").textContent = state.camera.status; updateCameraButtons(); } });
    $("#stopCameraButton").addEventListener("click", () => stopRealCamera());
    updateCameraButtons();
    window.addEventListener("keydown", (event) => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "a", "d"].includes(event.key)) event.preventDefault(); if (event.key === "ArrowUp") state.controls.throttle = .72; if (event.key === "ArrowDown") state.controls.throttle = -.45; if (event.key === "ArrowLeft") state.controls.steer = -.7; if (event.key === "ArrowRight") state.controls.steer = .7; if (event.key.toLowerCase() === "a") state.controls.strafe = -.7; if (event.key.toLowerCase() === "d") state.controls.strafe = .7; syncControlInputs(); });
    window.addEventListener("keyup", (event) => { if (["ArrowUp", "ArrowDown"].includes(event.key)) state.controls.throttle = 0; if (["ArrowLeft", "ArrowRight"].includes(event.key)) state.controls.steer = 0; if (["a", "d", "A", "D"].includes(event.key)) state.controls.strafe = 0; syncControlInputs(); });
    window.addEventListener("resize", draw);
  }

  function syncControlInputs() { [["throttleControl", "throttle", "throttleValue"], ["steerControl", "steer", "steerValue"], ["strafeControl", "strafe", "strafeValue"]].forEach(([inputId, key, outputId]) => { $(`#${inputId}`).value = state.controls[key]; $(`#${outputId}`).textContent = Number(state.controls[key]).toFixed(2); }); }

  bindControls();
  loadPreset();
  applySharedStorageOnInit();
  allowStorageSync = true;
  renderAll();
  window.KinematicSimulator = { state, loadPreset, loadBestPreset, addModule, resetSimulation, captureCameraFrame, startRealCamera, stopRealCamera, setYoloAdapter, getCameraFrame() { return state.camera.frameData; }, getDetections() { return clone(state.camera.detections); }, getCollectionPlan() { return clone(state.camera.plan); }, getStrategyTarget() { const target = chooseStrategyTarget(); return target ? clone(target) : null; } };
})();
