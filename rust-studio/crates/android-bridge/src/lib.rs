use std::ffi::c_void;
use std::sync::OnceLock;
use std::thread;

static SERVER_STARTED: OnceLock<u16> = OnceLock::new();

/// JNI entry point for `com.xiangqi.ruststudio.MainActivity.startRustServer(int port)`.
/// Starts the embedded Rust CAD + Physics + HTTP studio server once in a background thread.
#[no_mangle]
pub extern "C" fn Java_com_xiangqi_ruststudio_MainActivity_startRustServer(
    _env: *mut c_void,
    _class: *mut c_void,
    port: i32,
) -> i32 {
    let p = if port > 1024 && port <= 65535 { port as u16 } else { 8124 };
    SERVER_STARTED.get_or_init(|| {
        let addr = format!("127.0.0.1:{p}");
        thread::spawn(move || {
            let _ = xiangqi_studio::start_studio_server_with_mode(&addr, None, "android");
        });
        p
    });
    1
}
