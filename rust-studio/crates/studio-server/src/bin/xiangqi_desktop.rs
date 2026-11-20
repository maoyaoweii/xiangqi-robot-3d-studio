#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use std::env;
use std::path::PathBuf;
use xiangqi_studio::desktop::{launch_desktop_window, show_error_dialog, LaunchOutcome};
use xiangqi_studio::{spawn_studio_server, ServerConfig};

fn main() {
    let args: Vec<String> = env::args().collect();
    let mut preferred_port: u16 = 8124;
    let mut host = "127.0.0.1".to_string();
    let mut web_root: Option<PathBuf> = None;
    let mut no_open = false;
    let mut prefer_browser_tab = false;
    let mut start_page = "studio.html";

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--port" | "-p" if i + 1 < args.len() => {
                preferred_port = args[i + 1].parse().unwrap_or(8124);
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
        host,
        preferred_port,
        web_root,
        mode: "desktop".to_string(),
        allow_shutdown: true,
    };

    let mut server = match spawn_studio_server(cfg) {
        Ok(h) => h,
        Err(err) => {
            show_error_dialog(
                "光电象棋 Rust 3D 工程台启动失败",
                &format!("无法启动本地 Rust 工程服务：\n{err}"),
            );
            std::process::exit(1);
        }
    };

    if no_open {
        server.wait();
        return;
    }

    let url = server.url(start_page);
    match launch_desktop_window(&url, prefer_browser_tab) {
        Ok(LaunchOutcome::WindowClosed) => {
            server.stop();
        }
        Ok(LaunchOutcome::Detached) => {
            server.wait();
        }
        Err(err) => {
            show_error_dialog(
                "光电象棋 Rust 3D 工程台",
                &format!("后端已启动于 {url}\n但自动打开桌面窗口失败：{err}\n\n您可在浏览器手动访问上述地址。"),
            );
            server.wait();
        }
    }
}
