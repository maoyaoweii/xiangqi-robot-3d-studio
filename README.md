# 光电象棋 · Rust 真 3D 机器人工程与全流程仿真工坊
**Xiangqi Robot 3D Engineering Studio (Rust + WebAssembly + WebGL + Android + MCP)**

[![Rust](https://img.shields.io/badge/Rust-2021_Edition-orange.svg)](#从源码构建与开发)
[![WebAssembly](https://img.shields.io/badge/Physics-Rust_WASM-654ff0.svg)](#物理与运动学内核)
[![Platform](https://img.shields.io/badge/Platform-Windows_%7C_Android_%7C_Browser-0f9f84.svg)](#快速开始与使用指南)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

面向**全国大学生光电设计竞赛（光电搬运象棋赛道）**与自定义轮式移动机器人的全栈 **真 3D 设计、硬件选型、3D 打印切片、物理动力学仿真、多语言嵌入式固件在环测试（SIL）、官方检录裁判及自动化寻优平台**。

---

## 一、具体用途（为什么要做这个项目）

传统电赛备赛过程中，结构设计（SolidWorks/Fusion 360）、BOM 采购、3D 打印件制作、运动学逆解、单片机/K230 写代码以及赛场规则测试往往完全割裂：必须先把真车造出来才能发现底盘过重、轮距打滑、推斗高度不对或视觉被自己车体遮挡。

本项目把实体造车到赛场对抗的全链路搬进了零外部依赖的 **Rust + WASM 真 3D 仿真系统**：

1. **先选型与造车，再动真格**：支持“选零件算 BOM 重量成本 → FDM 3D 打印机切片估算 → 导出 `.STL`/`.DXF` 去实体打印/CNC 切割 → 6 步机械/焊接/电调装调”。
2. **从零自由设计非标底盘与轮系**：不再局限固定模板，支持 **0～16 颗自定义轮胎**、任意 3D 安装坐标 `(X, Z)`、独立半径/轮宽/偏航角、麦轮/全向轮/热熔胶胎/越野钉胎/履带/万向球混搭，以及自定义拉伸 CAD 零件碰撞体。
3. **写仿真板原生代码并直接驱动物理内核**：可在内置 IDE 中直接编写 **Arduino C/C++ (`setup`/`loop`)**、**K230 MicroPython (`def setup/loop`)** 或 **JavaScript SDK**，按真实主控频率（5～200 Hz）运行，读取仿真视觉/激光/IMU/编码器/电池电压并直接向 Rust WASM 输出每颗车轮的 PWM 占空比。
4. **完全还原官方竞赛规则与物理反馈**：按国赛真实比例建立 **3000×2000×300 mm** 围挡场地与 **Ø67×17 mm** 象棋（红 16 枚满分 45 分 + 黑 16 枚），内置赛前 **300×300×300 mm / ≤3.0 kg 官方检录**、**180s/120s 赛制倒计时**、**误推黑棋进红区每枚扣 3 分**、**人工复位罚时 +5s**，以及双车同场对抗。

---

## 二、核心功能一览

### 1. 可动 3D 装配空间 + 双视角赛场仿真
- **🔧 3D 装配空间（交互式手拖组装）**：点击顶部 **🔧 3D 装配空间**，镜头自动聚焦至车辆转盘，并显示顶板/前缘/底板/后甲板吸附锚点。可通过浮动工具栏一键创造 **装甲板 / 推斗翼 / 支架 / 齿轮 / 电池槽 / 车轮**，并在 3D 视口中直接用鼠标**点击选中、拖动安装位置**（按住 `Shift` 上下拖调高度，`+Y/-Y`、`↻15°`、`删除` 快捷微调），松手即自动同步至 Rust 后端总装图与碰撞体。
- **🏁 3D 赛场运行（上帝/追尾/全屏第一人称一键切换）**：实时渲染整车底盘、轮组滚转与转向舵角动画、11 种收集机构动作、自定义 CAD 零件、对抗敌车与 32 枚立体象棋，支持拖拽旋转与滚轮缩放。
- **第一人称车载相机视口 + 视觉识别叠加**：按设定机高 `mCamH`、俯仰角 `mCamP`、视场角 `mCamFov` 实时渲染第一人称画面，并叠加当前所选视觉模型的实时检测框、棋字分类标签、置信度与测距读数。
- **实时遥测面板**：净得分、携带枚数/剩余时间、整车质量、推斗口宽、理论极速、外廓包络尺寸、轮面推力 (N)、滑移率 (%)、总线压降电压 (V) 与电流 (A)。

### 2. 五大工程工作台标签页

| 标签页 | 核心能力 |
|---|---|
| **🚗 底盘轮系** | • **8 套整车预设** + **🧹 从 0 空车架开始**（一键清空轮胎与收集器，纯手工搭车）<br>• **5 种底盘风格 + 涂装自选色**、**9 套轮系模板 + 逐颗轮胎坐标编辑器**（X/Z/R/W/偏角/胎型/驱动/转向开关）<br>• **6 种运动学模型**（全向平移、双侧差速、前阿克曼、四轮双阿克曼蟹行、双轮自平衡动态俯仰、自定义矢量倍率）<br>• **11 种收集装置 + 无收集器**、独立左右翼伸出与张角、4 种传感套件、4 种动力电池、4 种物理场地预设与 4 种布棋阵型 |
| **🧱 创造与组装** | • 基于 Rust `cad_kernel` 拉伸 3D 网格：支持 **8 种截面原型**（倒角开孔板、非对称 U 型推斗、L 型支架、六边轻量化平台、参数化齿轮/编码盘、法兰圆环、U 型槽钢、自定义多边形 JSON）<br>• 支持吸附至 `top_deck` / `front_bulkhead` / `bottom_deck` / `axle_station`，并可在 **3D 装配空间** 中直接用鼠标拖动摆放<br>• 实时参与整车质量/质心/惯量与低位碰撞体积计算，支持一键导出 `.STL`（3D 打印）与 `.DXF`（激光/CNC 切割） |
| **👁️ 视觉模型** | • 支持 **5 种车载视觉识别模型** 自由切换：`YOLO11s 棋字分类`（按帅/车/马/炮分值优先抓高分红子）、`YOLO11n 轻量高速`、`经典 HSV+轮廓`、`双目立体深度融合`、`本地真实 YOLO 权重桥接 (yolo_bridge.py)`<br>• 可调置信度阈值与叠加框显示模式，点击 **🤖 应用视觉模型 + 烧录代码并自动运行** 一键上场测试 |
| **💻 编写代码** | • **4 款主控板**：`CanMV K230` (50Hz) / `STM32F407` (100Hz) / `ESP32-S3` (50Hz) / `Arduino Mega 2560` (30Hz)<br>• **3 种代码兼容模式**：`C / Arduino (setup/loop)`、`Python / K230 MicroPython`、`JavaScript SDK / decide(ctx)`<br>• **硬件外设模拟**：GPIO (`pinMode`/`digitalWrite`/`digitalRead`/`analogRead`)、引脚映射 `mapMotorPin`、1024 PPR 轮速编码器 (`getEncoderTicks`/`getWheelRPS`)、3/5 路激光测距、相机检测、IMU 姿态、电池电压电流，以及深色串口监视器 (`Serial.println`/`printf`/`print`) 与 `.ino`/`.py`/`.js` 源码导出 |
| **🏁 实车赛规** | • **硬件选件 BOM**（15 种器件，支持装机同步与导出 `BOM.csv`） + **FDM 3D 打印切片仿真**（PLA/PETG/ABS/PLA-CF，导出 STL）<br>• **实车制作 6 步工序单**（可选 **🔒 真实制作约束**） + **官方检录**（300mm 限框 / ≤3.0kg 限重） + **180s/120s 赛制裁判**（误推黑棋 -3 分、人工复位 +5s）与 **本地战绩排行榜** |

### 3. 确定性 Rust + WASM 多轮物理内核
- 编译为 `xiangqi_wasm.wasm`（浏览器实时步进）及原生 Rust 多线程二进制（批处理与寻优）。
- 包含每轮法向载荷分配、库仑摩擦圆切向/法向限制、X 型麦轮 45° 滚子推力混控、直流电机扭矩-转速曲线、电池内阻压降与 SoC 消耗、OBB 车体/自定义 CAD 零件/棋子弹性碰撞。

### 4. 三端运行形态与 AI 工具链
- **Windows 独立桌面版 (`XiangqiRustStudio.exe`)**：无黑框命令行窗口、内嵌全部前端与 WASM 资产、独立应用窗体，双击即用。
- **Windows 命令行与工程服务 (`XiangqiRustCLI.exe`)**：支持 `serve`、`sim`、`optimize`、`inspect`、`export-stl`、`export-dxf`、`mcp` 子命令。
- **独立 AI MCP Server (`XiangqiMcpServer.exe`)**：面向 AI Agent 的 stdio JSON-RPC 2.0 服务，暴露 `get_assembly_graph`、`update_module_params`、`create_custom_cad_part`、`export_cad_stl`、`export_cad_dxf`、`run_physics_simulation`、`optimize_best_design` 7 个工具。
- **Android 原生 APK (`XiangqiRustStudio-debug.apk`)**：内置 ARM64 (`aarch64-linux-android`) Rust 动态库 `libxiangqi_android.so` + WebView，在手机/平板离线运行完整真 3D 工坊并支持直接下载 `.stl`/`.json`。
- **Python 拓展桥接**：`cad_mcp_server.py`（HTTP CAD 拼图桥）与 `yolo_bridge.py`（接真实摄像头做 YOLO11 象棋识别联调）。

---

## 三、快速开始与使用指南

### 方式一：直接下载打包版（最简单 · 零配置）

前往本仓库的 **[GitHub Releases](https://github.com/maoyaoweii/xiangqi-robot-3d-studio/releases)** 下载打包压缩包 `XiangqiRobotStudio-v1.0.0-win64-android.zip`（或按需单独下载 `.exe` / `.apk`）：

1. **Windows 桌面使用**：解压后直接双击 **`XiangqiRustStudio.exe`**，即刻弹出完整 3D 工程软件界面（自动分配可用端口，默认 `8124`）。
   - 可选命令行参数：`--port <N>`、`--3d`（打开经典高级工坊 `3d.html`）、`--browser`（用默认浏览器打开）、`--no-open`（仅启动后台服务）。
2. **Android 手机/平板使用**：将 **`XiangqiRustStudio-debug.apk`** 传输至安卓设备（ARM64）安装即可离线使用。
3. **命令行批处理与 MCP 调用**：
   ```powershell
   .\XiangqiRustCLI.exe inspect                                          # 查看默认整车物理/质心/合规报告
   .\XiangqiRustCLI.exe sim --preset standard --seed 42 --duration 120   # 终端运行 120s 物理仿真
   .\XiangqiRustCLI.exe optimize --preset standard --seeds 42,101,202    # 多线程并行寻优
   .\XiangqiRustCLI.exe export-stl --node chassis_main --out chassis.stl # 导出底盘 3D 打印 STL
   .\XiangqiRustCLI.exe export-dxf --node device_scoop --out scoop.dxf   # 导出推斗 CNC DXF
   .\XiangqiRustCLI.exe mcp                                              # 启动 JSON-RPC 2.0 MCP 服务
   ```

### 方式二：操作流程与快捷键

1. **日常界面操作推荐流程**：
   - 在 **🧩 自由装配** 选预设或点击 **🧹 从0空车架开始** 自定义底盘、轮胎与收集装置 → 点击 **🔄 同步 Rust**。
   - 在 **🏭 实体造车&赛规** 挑选 BOM 零件 **⚙️ 装机同步硬件**，完成 3D 打印切片与 6 步工序单，点击 **📋 官方检录**。
   - 在 **💻 仿真板&MCP** 选择主控板与编程语言编写控制程序，点击 **🔄 烧录并复位** 启动自主运行，或直接用 `WASD` + `Q/E` 手动遥控测试底盘手感。
   - 如需更多传统独立模块画布与示波器回放工具，可点击右上角 **高级工坊** 进入 `3d.html`。
2. **键盘快捷键（焦点不在输入框时生效）**：
   - `W / A / S / D` 或方向键：手动前进、后退、左转、右转
   - `Q / E`：麦克纳姆轮/全向轮左右横移
   - `空格 (Space)`：运行 / 暂停仿真
   - `R`：重置场地与计时器
   - `C`：切换 3D 视口视角（自由环绕 / 追尾跟拍 / 第一人称全屏）
   - `I`：执行赛前官方检录
   - `1` ~ `5`：快速切换右侧五大工作台标签页

### 方式三：仿真板代码兼容与常用 API 速查

在 **💻 仿真板&MCP** 标签页中可直接运行以下代码风格：

- **Arduino C / STM32**：`void setup()` / `void loop()`，支持 `pinMode`、`digitalWrite`、`analogWrite`、`mapMotorPin`、`Serial.println`、`Serial.printf`、`constrain`、`map`、`uint8_t`/`float` 等常见类型。
- **Python / K230 MicroPython**：`def setup(board):` / `def loop(board):`，支持 `f"..."` 格式化字符串、`print()`、`math.*`、`time.ticks_ms()`、`board.set_velocity(v, omega, v_lat)`。
- **JavaScript 硬件 SDK**：可调用完整 `board` 对象，并向后兼容旧版 `function decide(ctx)` 策略函数。

常用传感器与控制函数：`setVelocity(v, omega, vLat)`、`setMotorPWM(idx, pwm)`、`setAllMotors([...])`、`getCameraCount()`、`getCameraObject(i)`、`readLaser(rayIdx)`、`getIMU()`、`getEncoderTicks(i)`、`getWheelRPS(i)`、`getBatteryVoltage()`、`getHeldCount()`、`getGoalPos()`。

### 方式四：Python 真实摄像头 YOLO & CAD HTTP 桥接（可选）

```powershell
# 启动本地纯标准库 HTTP CAD MCP 桥接 (http://127.0.0.1:8786/mcp)
powershell -ExecutionPolicy Bypass -File .\start_cad_mcp.ps1

# 启动本地 YOLO 象棋识别视觉桥接 (需自备 Python 环境与 ultralytics/OpenCV 权重)
.\.venv\Scripts\python.exe .\yolo_bridge.py --weights ..\weights\xiangqi_yolo11s_best.pt --port 8765
```

---

## 四、从源码构建与开发

### 前置依赖
- [Rustup & Cargo](https://rustup.rs/)（支持 GNU `x86_64-pc-windows-gnu` 或 MSVC，及 `wasm32-unknown-unknown` 目标）
- 若需构建 Android APK：安装 `aarch64-linux-android` Rust target、Android SDK Platform 34、Build-Tools 与 NDK，以及 JDK 8+。

### 编译与测试命令

```powershell
# 1. 进入 Rust 工作区目录
cd rust-studio

# （可选）若在含中文的路径或需交叉编译 Android，先复制示例配置并按本机路径修改
# copy .cargo\config.toml.example .cargo\config.toml

# 2. 重新编译 WASM 物理内核并更新内嵌资产
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown -p xiangqi_wasm
copy target\wasm32-unknown-unknown\release\xiangqi_wasm.wasm crates\studio-server\assets\xiangqi_wasm.wasm

# 3. 运行全工作区单元测试
cargo test --workspace

# 4. 编译 Windows Release 可执行程序
cargo build --release --workspace
# 生成产物：xiangqi_desktop.exe (桌面版)、xiangqi_studio.exe (CLI)、xiangqi_mcp.exe (MCP Server)

# 5. 构建并签名 Android ARM64 APK（需已配置 Android SDK / NDK）
cd ..\android-app
powershell -ExecutionPolicy Bypass -File .\build_apk.ps1
```

---

## 五、项目结构说明

```text
.
├── studio.html                  # 主工作台前端 (WebGL 双 3D 视口 + 5 大工程标签页 + WASM 物理与 MCU IDE)
├── 3d.html / 3d.css / 3d.js     # 高级多视图独立模块工坊 & 多通道示波器回放界面
├── index.html / styles.css / app.js  # 经典 2D 装配校验页
├── cad_mcp_server.py / start_cad_mcp.ps1    # 本地 HTTP 参数化 CAD 拼图桥接服务
├── yolo_bridge.py / start_yolo_bridge.ps1   # 真实摄像头 YOLO 象棋识别服务
├── android-app/                 # Android 原生 WebView 壳 + JNI 打包脚本 (build_apk.ps1)
└── rust-studio/                 # Rust 多 Crate 工作区
    ├── Cargo.toml
    ├── rust-toolchain.toml
    └── crates/
        ├── core-model/          # 总装图模型、自定义轮系拓扑与 8 种原型拉伸 CAD 内核 (STL/DXF)
        ├── physics-sim/         # 确定性多轮动力学引擎、官方赛规计分与多线程并行寻优器
        ├── physics-wasm/        # 浏览器端 WebAssembly 物理 FFI 与直驱电机 PWM 接口
        ├── mcp-server/          # stdio JSON-RPC 2.0 MCP Server (7 个 CAD/仿真工具)
        ├── studio-server/       # 内嵌全部静态资源与 WASM 的桌面程序 / CLI / HTTP 服务
        └── android-bridge/      # Android ARM64 JNI 入口
```

---

## License

本项目采用 [MIT License](LICENSE) 开源发布。
