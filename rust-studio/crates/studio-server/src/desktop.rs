use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::time::{Duration, Instant};

#[cfg(target_os = "windows")]
mod win32 {
    use std::ffi::c_void;

    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    const STILL_ACTIVE: u32 = 259;
    const MB_OK: u32 = 0x0000_0000;
    const MB_ICONERROR: u32 = 0x0000_0010;

    #[link(name = "kernel32")]
    extern "system" {
        fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut c_void;
        fn GetExitCodeProcess(process: *mut c_void, exit_code: *mut u32) -> i32;
        fn CloseHandle(handle: *mut c_void) -> i32;
    }

    #[link(name = "user32")]
    extern "system" {
        fn MessageBoxW(hwnd: *mut c_void, text: *const u16, caption: *const u16, utype: u32) -> i32;
    }

    pub fn is_pid_alive(pid: u32) -> bool {
        unsafe {
            let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if h.is_null() {
                return false;
            }
            let mut code: u32 = 0;
            let ok = GetExitCodeProcess(h, &mut code) != 0;
            CloseHandle(h);
            ok && code == STILL_ACTIVE
        }
    }

    pub fn show_error_box(title: &str, message: &str) {
        let mut t: Vec<u16> = title.encode_utf16().collect();
        t.push(0);
        let mut m: Vec<u16> = message.encode_utf16().collect();
        m.push(0);
        unsafe {
            MessageBoxW(std::ptr::null_mut(), m.as_ptr(), t.as_ptr(), MB_OK | MB_ICONERROR);
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod win32 {
    pub fn is_pid_alive(_pid: u32) -> bool {
        false
    }

    pub fn show_error_box(title: &str, message: &str) {
        eprintln!("[{title}] {message}");
    }
}

pub fn show_error_dialog(title: &str, message: &str) {
    win32::show_error_box(title, message);
}

pub enum LaunchOutcome {
    /// Dedicated standalone desktop app window ran and then exited cleanly.
    WindowClosed,
    /// Browser delegated to an existing process or system default browser; keep server alive.
    Detached,
}

fn find_chromium_app_host() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let mut candidates: Vec<PathBuf> = vec![
            PathBuf::from(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
            PathBuf::from(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
            PathBuf::from(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
            PathBuf::from(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
            PathBuf::from(r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"),
        ];
        if let Ok(local) = env::var("LOCALAPPDATA") {
            let base = PathBuf::from(local);
            candidates.push(base.join(r"Microsoft\Edge\Application\msedge.exe"));
            candidates.push(base.join(r"Google\Chrome\Application\chrome.exe"));
            candidates.push(base.join(r"BraveSoftware\Brave-Browser\Application\brave.exe"));
        }
        return candidates.into_iter().find(|p| p.is_file());
    }
    #[cfg(not(target_os = "windows"))]
    {
        for bin in ["google-chrome", "chromium", "chromium-browser", "microsoft-edge"] {
            if let Ok(st) = Command::new("which").arg(bin).output() {
                if st.status.success() {
                    let s = String::from_utf8_lossy(&st.stdout).trim().to_string();
                    if !s.is_empty() {
                        return Some(PathBuf::from(s));
                    }
                }
            }
        }
        None
    }
}

struct ProfileLease {
    profile_dir: PathBuf,
    pid_file: Option<PathBuf>,
    ephemeral: bool,
}

impl ProfileLease {
    fn acquire() -> Self {
        let root = env::var("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| env::temp_dir())
            .join("XiangqiRustStudio");
        let _ = fs::create_dir_all(&root);

        let pid_file = root.join("primary_session.pid");
        let primary_busy = fs::read_to_string(&pid_file)
            .ok()
            .and_then(|s| s.trim().parse::<u32>().ok())
            .map(win32::is_pid_alive)
            .unwrap_or(false);

        if !primary_busy {
            let profile_dir = root.join("RuntimeProfile");
            let _ = fs::create_dir_all(&profile_dir);
            let _ = fs::write(&pid_file, std::process::id().to_string());
            Self {
                profile_dir,
                pid_file: Some(pid_file),
                ephemeral: false,
            }
        } else {
            let profile_dir = root.join(format!("RuntimeProfile_{}", std::process::id()));
            let _ = fs::create_dir_all(&profile_dir);
            Self {
                profile_dir,
                pid_file: None,
                ephemeral: true,
            }
        }
    }

    fn path(&self) -> &Path {
        &self.profile_dir
    }
}

impl Drop for ProfileLease {
    fn drop(&mut self) {
        if let Some(pf) = &self.pid_file {
            let _ = fs::remove_file(pf);
        }
        if self.ephemeral {
            let _ = fs::remove_dir_all(&self.profile_dir);
        }
    }
}

pub fn open_default_browser(url: &str) -> std::io::Result<()> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd").args(["/C", "start", "", url]).spawn()?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(url).spawn()?;
        Ok(())
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        Command::new("xdg-open").arg(url).spawn()?;
        Ok(())
    }
}

/// Launches the standalone chromeless desktop window pointing at `url` and waits until closed.
/// If `prefer_browser_tab` is true or no Chromium-based host is installed, falls back to default browser.
pub fn launch_desktop_window(url: &str, prefer_browser_tab: bool) -> std::io::Result<LaunchOutcome> {
    if prefer_browser_tab {
        open_default_browser(url)?;
        return Ok(LaunchOutcome::Detached);
    }

    if let Some(host_exe) = find_chromium_app_host() {
        let lease = ProfileLease::acquire();
        let started = Instant::now();
        let mut child: Child = Command::new(&host_exe)
            .arg(format!("--app={url}"))
            .arg("--window-size=1480,940")
            .arg(format!("--user-data-dir={}", lease.path().display()))
            .arg("--no-first-run")
            .arg("--no-default-browser-check")
            .arg("--disable-background-mode")
            .arg("--disable-features=msEdgeSidebarV2,EdgeCollections,msUndersideButton")
            .spawn()?;

        let _ = child.wait();
        if started.elapsed() >= Duration::from_secs(2) {
            return Ok(LaunchOutcome::WindowClosed);
        }
        return Ok(LaunchOutcome::Detached);
    }

    open_default_browser(url)?;
    Ok(LaunchOutcome::Detached)
}
