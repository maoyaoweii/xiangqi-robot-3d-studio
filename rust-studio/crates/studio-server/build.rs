use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

fn find_windres() -> Option<PathBuf> {
    if Command::new("windres").arg("--version").output().is_ok() {
        return Some(PathBuf::from("windres"));
    }
    for candidate in [
        r"D:\mingw64\bin\windres.exe",
        r"C:\mingw64\bin\windres.exe",
        r"C:\msys64\mingw64\bin\windres.exe",
    ] {
        if Path::new(candidate).exists() {
            return Some(PathBuf::from(candidate));
        }
    }
    None
}

fn main() {
    println!("cargo:rerun-if-changed=assets/app.rc");
    println!("cargo:rerun-if-changed=assets/app.ico");
    println!("cargo:rerun-if-changed=assets/app.svg");
    println!("cargo:rerun-if-changed=assets/xiangqi_wasm.wasm");
    println!("cargo:rerun-if-changed=../../../studio.html");
    println!("cargo:rerun-if-changed=../../../3d.html");
    println!("cargo:rerun-if-changed=../../../3d.css");
    println!("cargo:rerun-if-changed=../../../3d.js");
    println!("cargo:rerun-if-changed=../../../index.html");
    println!("cargo:rerun-if-changed=../../../styles.css");
    println!("cargo:rerun-if-changed=../../../app.js");

    if env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }

    let Some(windres) = find_windres() else {
        return;
    };

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());

    // Copy RC + ICO into ASCII OUT_DIR so GNU windres never hits non-ASCII paths.
    let rc_dst = out_dir.join("app.rc");
    let ico_dst = out_dir.join("app.ico");
    if fs::copy(manifest_dir.join("assets/app.rc"), &rc_dst).is_err() {
        return;
    }
    if fs::copy(manifest_dir.join("assets/app.ico"), &ico_dst).is_err() {
        return;
    }

    let res_obj = out_dir.join("app_res.o");
    let status = Command::new(windres)
        .current_dir(&out_dir)
        .args(["-i", "app.rc", "-o", "app_res.o", "-O", "coff", "-F", "pe-x86-64"])
        .status();

    if let Ok(st) = status {
        if st.success() && res_obj.exists() {
            let arg = res_obj.to_string_lossy();
            println!("cargo:rustc-link-arg-bin=xiangqi_desktop={arg}");
            println!("cargo:rustc-link-arg-bin=xiangqi_studio={arg}");
        }
    }
}
