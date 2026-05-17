use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};

#[cfg(target_os = "windows")]
mod pipe {
    use tauri::{AppHandle, Emitter};
    use tokio::io::AsyncReadExt;
    use tokio::net::windows::named_pipe::ServerOptions;

    pub fn run_pipe_server(handle: AppHandle) {
        tokio::runtime::Runtime::new().unwrap().block_on(async move {
            loop {
                let mut server = match ServerOptions::new()
                    .first_pipe_instance(false)
                    .create(r"\\.\pipe\overplay")
                {
                    Ok(s) => s,
                    Err(e) => {
                        eprintln!("[overplay] Pipe create error: {}", e);
                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                        continue;
                    }
                };

                if server.connect().await.is_err() {
                    continue;
                }

                let mut buf = vec![0u8; 512];
                match server.read(&mut buf).await {
                    Ok(n) if n > 0 => {
                        if let Ok(msg) = std::str::from_utf8(&buf[..n]) {
                            let msg = msg.trim().to_string();
                            eprintln!("[overplay] Received: {}", msg);
                            let _ = handle.emit("obs-event", msg);
                        }
                    }
                    _ => {}
                }
            }
        });
    }
}

fn position_window_top_right(handle: &AppHandle) {
    if let Some(win) = handle.get_webview_window("overlay") {
        if let Ok(Some(monitor)) = win.primary_monitor() {
            let size = monitor.size();
            let pos = monitor.position();

            let _ = win.set_size(tauri::PhysicalSize::new(size.width, size.height));
            let _ = win.set_position(tauri::PhysicalPosition::new(pos.x, pos.y));
        }

        #[cfg(target_os = "windows")]
        set_click_through(&win);
    }
}

#[cfg(target_os = "windows")]
fn set_click_through(win: &tauri::WebviewWindow) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_LAYERED, WS_EX_TRANSPARENT,
    };
    if let Ok(hwnd) = win.hwnd() {
        unsafe {
            let ex = GetWindowLongPtrW(hwnd.0 as _, GWL_EXSTYLE);
            SetWindowLongPtrW(
                hwnd.0 as _,
                GWL_EXSTYLE,
                ex | WS_EX_LAYERED as isize | WS_EX_TRANSPARENT as isize,
            );
        }
    }
}

fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let quit = MenuItem::with_id(app, "quit", "Quit Overplay", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&quit])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("Overplay — OBS Overlay")
        .on_menu_event(|app, event| {
            if event.id() == "quit" {
                app.exit(0);
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn ensure_single_instance() -> bool {
    use windows::Win32::System::Threading::CreateMutexW;
    use windows::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
    use windows::core::PCWSTR;

    let name: Vec<u16> = "Global\\OverplayMutex\0".encode_utf16().collect();

    unsafe {
        let _mutex = CreateMutexW(None, true, PCWSTR(name.as_ptr()));
        GetLastError() != ERROR_ALREADY_EXISTS
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(target_os = "windows")]
            if !ensure_single_instance() {
                eprintln!("[overplay] Already running, exiting");
                std::process::exit(0);
            }

            let handle = app.handle().clone();

            if let Some(win) = handle.get_webview_window("overlay") {
                win.set_background_color(Some((0, 0, 0, 0).into())).ok();

                win.set_always_on_top(true).ok();
                win.set_skip_taskbar(true).ok();
            }

            position_window_top_right(&handle);
            setup_tray(app)?;

            #[cfg(target_os = "windows")]
            {
                let pipe_handle = handle.clone();
                std::thread::spawn(move || {
                    pipe::run_pipe_server(pipe_handle);
                });
            }

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running overplay");
}