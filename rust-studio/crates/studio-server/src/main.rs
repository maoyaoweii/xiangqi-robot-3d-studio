use std::env;
use std::fs;
use std::path::PathBuf;
use std::time::Instant;
use xiangqi_core::AssemblyGraph;
use xiangqi_sim::{optimize_assembly, run_headless_match, PhysicsEnv};
use xiangqi_studio::desktop::{launch_desktop_window, LaunchOutcome};
use xiangqi_studio::{spawn_studio_server, ServerConfig, ENGINE_VERSION};

fn print_help() {
    println!(
        r#"====================================================================
  光电象棋 · Rust 真3D机器人工程平台 CLI (v{ENGINE_VERSION})
  Xiangqi Rust 3D Engineering Studio - Standalone Runner
====================================================================

用法 / Usage:
  XiangqiRustCLI.exe [命令] [选项]

子命令 / Commands:
  serve (默认)      启动内置 Rust 3D 工程后端并打开桌面窗口
  sim               在终端运行纯 Rust 确定性刚体物理仿真比赛
  optimize          在终端运行 14 候选多线程 Rust 并行寻优计算
  inspect           输出默认整车 3D 运动学/质心/惯量/合规报告
  export-stl        导出指定模块 3D 可打印 ASCII .STL 文件
  export-dxf        导出指定模块 CNC 激光切割 2D .DXF 文件
  mcp               以 JSON-RPC 2.0 stdio 模式运行 AI MCP 服务

常用选项 / Options:
  --port, -p <N>        指定端口（默认 8124，占用时自动递增顺延）
  --host <IP>           监听地址（默认 127.0.0.1，局域网可用 0.0.0.0）
  --no-open, --server   仅运行后台服务，不自动弹出桌面窗口
  --browser             在默认浏览器标签页中打开而非独立桌面窗口
  --3d                  直接进入高级 3D 独立工坊 (/3d.html)
  --web-root <DIR>      使用外部目录覆盖内嵌前端资源（开发热更新用）
  --preset <NAME>       物理预设: standard | slippery | bouncy | heavy
  --seed <N>            仿真随机种子（默认 42）
  --seeds <A,B,C>       并行寻优多随机种子列表（默认 42,101,202,303）
  --duration <SEC>      比赛时长秒数（默认 120）
  --node <ID>           CAD 导出节点（默认 chassis_main / device_scoop）
  --out <FILE>          CAD 导出输出文件路径
  --json                以纯 JSON 格式输出结果（便于脚本联动）
  --help, -h            显示帮助信息
  --version, -V         显示版本号

示例 / Examples:
  XiangqiRustCLI.exe
  XiangqiRustCLI.exe --port 8124 --no-open
  XiangqiRustCLI.exe sim --preset slippery --seed 101
  XiangqiRustCLI.exe optimize --preset standard --seeds 42,101,202,303
  XiangqiRustCLI.exe export-stl --node chassis_main --out chassis.stl
  XiangqiRustCLI.exe mcp
"#
    );
}

fn cmd_inspect(as_json: bool) {
    let graph = AssemblyGraph::default_competition_robot();
    let built = graph.resolve_kinematics();
    if as_json {
        println!("{}", serde_json::to_string_pretty(&built).unwrap_or_default());
        return;
    }
    println!("================ Rust 整车物理与合规快照 ================");
    println!("底盘造型 : {} | 驱动构型 : {} | 收集装置 : {}", built.frame_style, built.drive_type, built.device_kind);
    println!("后部扩展 : {} | 传感套件 : {}", built.rear_mod, built.sensor_suite);
    println!("整车质量 : {:.3} kg | 转动惯量 Iz : {:.4} kg·m²", built.total_mass, built.inertia_z);
    println!(
        "质心轴荷 : X={:.1} mm, Z={:.1} mm | 前后轴荷 {}%/{}% | 左右轴荷 {}%/{}%",
        built.cg_x * 1000.0,
        built.cg_z * 1000.0,
        built.front_axle_pct,
        built.rear_axle_pct,
        built.left_axle_pct,
        built.right_axle_pct
    );
    println!(
        "外廓尺寸 : {:.1} × {:.1} × {:.1} mm (国赛限额 250×250×250 mm)",
        built.envelope[0] * 1000.0,
        built.envelope[1] * 1000.0,
        built.envelope[2] * 1000.0
    );
    println!(
        "动力性能 : 理论极速 {:.2} m/s | 最大加速度 {:.2} m/s² | 推力 {:.1} N | 入口宽 {:.0} mm",
        built.max_speed, built.max_accel, built.push_force, built.mouth_width * 1000.0
    );
    let compliant = built.compliance_issues.is_empty();
    println!("底盘合规 : {}", if compliant { "PASS (完全合规)" } else { "WARN (存在超限项)" });
    if !built.compliance_issues.is_empty() {
        println!("超限提示 :");
        for d in &built.compliance_issues {
            println!("  - {d}");
        }
    }
}

fn cmd_sim(args: &[String]) {
    let mut preset = "standard".to_string();
    let mut seed: u64 = 42;
    let mut duration_s: f64 = 120.0;
    let mut as_json = false;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--preset" if i + 1 < args.len() => { preset = args[i + 1].clone(); i += 2; }
            "--seed" if i + 1 < args.len() => { seed = args[i + 1].parse().unwrap_or(42); i += 2; }
            "--duration" if i + 1 < args.len() => { duration_s = args[i + 1].parse().unwrap_or(120.0); i += 2; }
            "--json" => { as_json = true; i += 1; }
            _ => { i += 1; }
        }
    }

    let graph = AssemblyGraph::default_competition_robot();
    let built = graph.resolve_kinematics();
    let t0 = Instant::now();
    let summary = run_headless_match(&built, PhysicsEnv::preset(&preset), seed, duration_s);
    let ms = t0.elapsed().as_secs_f64() * 1000.0;

    if as_json {
        println!("{}", serde_json::to_string_pretty(&summary).unwrap_or_default());
        return;
    }
    println!("================ Rust 刚体纯视觉仿真战报 ================");
    println!("物理预设 : {preset} | 随机种子 : {seed} | 仿真耗时 : {ms:.2} ms");
    println!("最终得分 : {} / 45 | 收集棋子 : {} 枚 | 完赛用时 : {:.2} s", summary.score, summary.collected, summary.finish_time_s);
    println!("峰值受力 : {:.2} N | 抓地极限 : {:.2} N | 打滑次数 : {}", summary.peak_force_n, summary.traction_max_n, summary.slip_events);
    println!("机械能耗 : {:.2} J | 整车合规 : {}", summary.energy_j, if built.compliance_issues.is_empty() { "PASS" } else { "WARN" });
}

fn cmd_optimize(args: &[String]) {
    let mut preset = "standard".to_string();
    let mut seeds: Vec<u64> = vec![42, 101, 202, 303];
    let mut as_json = false;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--preset" if i + 1 < args.len() => { preset = args[i + 1].clone(); i += 2; }
            "--seeds" if i + 1 < args.len() => {
                let parsed: Vec<u64> = args[i + 1].split(',').filter_map(|s| s.trim().parse().ok()).collect();
                if !parsed.is_empty() { seeds = parsed; }
                i += 2;
            }
            "--json" => { as_json = true; i += 1; }
            _ => { i += 1; }
        }
    }

    let graph = AssemblyGraph::default_competition_robot();
    let t0 = Instant::now();
    let results = optimize_assembly(&graph, PhysicsEnv::preset(&preset), &seeds);
    let elapsed_ms = t0.elapsed().as_millis();

    if as_json {
        println!(
            "{}",
            serde_json::to_string_pretty(&serde_json::json!({
                "preset": preset,
                "seeds": seeds,
                "elapsed_ms": elapsed_ms,
                "candidates": results
            }))
            .unwrap_or_default()
        );
        return;
    }

    println!(
        "================ Rust 多线程并行寻优排行 ({} 方案 × {} 场 = {} 场, {} ms) ================",
        results.len(),
        seeds.len(),
        results.len() * seeds.len(),
        elapsed_ms
    );
    println!("{:<4} {:<26} {:>7} {:>8} {:>7} {:>8}", "排名", "候选机械构型", "均分", "平均用时", "打滑", "质量(kg)");
    println!("{}", "-".repeat(72));
    for (idx, c) in results.iter().enumerate() {
        println!(
            "#{:<3} {:<26} {:>7.2} {:>7.1}s {:>7.1} {:>8.3}",
            idx + 1,
            c.label,
            c.avg_score,
            c.avg_finish_s,
            c.avg_slip_events,
            c.total_mass_kg
        );
    }
}

fn cmd_export_cad(fmt: &str, args: &[String]) {
    let mut node_id = "chassis_main".to_string();
    let mut out_path: Option<PathBuf> = None;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--node" if i + 1 < args.len() => { node_id = args[i + 1].clone(); i += 2; }
            "--out" | "-o" if i + 1 < args.len() => { out_path = Some(PathBuf::from(&args[i + 1])); i += 2; }
            s if !s.starts_with('-') && node_id == "chassis_main" => { node_id = s.to_string(); i += 1; }
            s if !s.starts_with('-') && out_path.is_none() => { out_path = Some(PathBuf::from(s)); i += 1; }
            _ => { i += 1; }
        }
    }

    let graph = AssemblyGraph::default_competition_robot();
    let Some(sk) = graph.nodes.iter().find(|n| n.id == node_id).and_then(|n| n.custom_sketch.as_ref()) else {
        eprintln!("错误：未找到带 CAD 草图的节点 '{node_id}'（可用节点：chassis_main, device_scoop）");
        std::process::exit(1);
    };

    let (content, ext) = if fmt == "stl" {
        (sk.extrude().to_stl_ascii_mm(), "stl")
    } else {
        (sk.to_dxf_mm(), "dxf")
    };

    let dst = out_path.unwrap_or_else(|| PathBuf::from(format!("{node_id}.{ext}")));
    if let Err(e) = fs::write(&dst, content.as_bytes()) {
        eprintln!("导出失败 ({})：{e}", dst.display());
        std::process::exit(1);
    }
    println!("已导出 {} ({} bytes) -> {}", ext.to_uppercase(), content.len(), dst.display());
}

fn cmd_serve(args: &[String]) {
    let env_port = env::var("SERVER_PORT")
        .or_else(|_| env::var("PORT"))
        .ok()
        .and_then(|s| s.trim().parse::<u16>().ok());
    let mut preferred_port: u16 = env_port.unwrap_or(8124);
    let mut host = if env_port.is_some() {
        "0.0.0.0".to_string()
    } else {
        "127.0.0.1".to_string()
    };
    let mut web_root: Option<PathBuf> = None;
    let mut no_open = env_port.is_some();
    let mut allow_shutdown = env_port.is_none();
    let mut prefer_browser_tab = false;
    let mut start_page = "studio.html";

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--port" | "-p" if i + 1 < args.len() => {
                preferred_port = args[i + 1].parse().unwrap_or(preferred_port);
                i += 2;
            }
            "--host" if i + 1 < args.len() => {
                host = args[i + 1].clone();
                i += 2;
            }
            "--web-root" if i + 1 < args.len() => {
                web_root = Some(PathBuf::from(&args[i + 1]));
                i += 2;
            }
            "--no-open" | "--server" | "--headless" => {
                no_open = true;
                i += 1;
            }
            "--public" | "--no-shutdown" => {
                no_open = true;
                allow_shutdown = false;
                if host == "127.0.0.1" {
                    host = "0.0.0.0".to_string();
                }
                i += 1;
            }
            "--browser" => {
                prefer_browser_tab = true;
                i += 1;
            }
            "--3d" | "--advanced" => {
                start_page = "3d.html";
                i += 1;
            }
            _ => {
                i += 1;
            }
        }
    }

    let cfg = ServerConfig {
        host: host.clone(),
        preferred_port,
        web_root: web_root.clone(),
        mode: if no_open { "server".to_string() } else { "desktop".to_string() },
        allow_shutdown,
    };

    let mut server = match spawn_studio_server(cfg) {
        Ok(h) => h,
        Err(e) => {
            eprintln!("启动 Rust 工程服务失败：{e}");
            std::process::exit(1);
        }
    };

    let main_url = server.url(start_page);
    let adv_url = server.url("3d.html");
    println!("====================================================================");
    println!("  🦀 光电象棋 · Rust 真3D机器人工程平台 v{ENGINE_VERSION}");
    println!("  主界面地址 : {main_url}");
    println!("  高级工坊   : {adv_url}");
    println!(
        "  前端资源   : {}",
        match &web_root {
            Some(p) => format!("外部目录优先 ({}) + 内嵌回退", p.display()),
            None => "100% 内嵌于 Rust 可执行文件 (零外部依赖)".to_string(),
        }
    );
    println!("  按 Ctrl+C 退出服务 (独立窗口模式下关闭窗口即自动退出)");
    println!("====================================================================");

    if no_open {
        server.wait();
        return;
    }

    match launch_desktop_window(&main_url, prefer_browser_tab) {
        Ok(LaunchOutcome::WindowClosed) => {
            println!("桌面窗口已关闭，正在安全停止 Rust 后端...");
            server.stop();
        }
        Ok(LaunchOutcome::Detached) => {
            server.wait();
        }
        Err(e) => {
            eprintln!("未能自动弹出窗口 ({e})，请手动在浏览器打开：{main_url}");
            server.wait();
        }
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() > 1 {
        match args[1].as_str() {
            "--help" | "-h" | "help" => {
                print_help();
                return;
            }
            "--version" | "-V" | "version" => {
                println!("XiangqiRustStudio v{ENGINE_VERSION}");
                return;
            }
            "sim" => {
                cmd_sim(&args[2..]);
                return;
            }
            "optimize" | "opt" => {
                cmd_optimize(&args[2..]);
                return;
            }
            "inspect" => {
                let as_json = args[2..].iter().any(|a| a == "--json");
                cmd_inspect(as_json);
                return;
            }
            "export-stl" | "stl" => {
                cmd_export_cad("stl", &args[2..]);
                return;
            }
            "export-dxf" | "dxf" => {
                cmd_export_cad("dxf", &args[2..]);
                return;
            }
            "mcp" => {
                xiangqi_mcp::run_stdio_mcp_loop();
                return;
            }
            "serve" => {
                cmd_serve(&args[2..]);
                return;
            }
            _ => {}
        }
    }
    cmd_serve(&args[1..]);
}
