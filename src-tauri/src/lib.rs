#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // WebKitGTK (Linux, incl. WSL) uses auto-hiding GTK overlay scrollbars, so
    // long content looks unscrollable. Force classic, always-visible scrollbars.
    // Must be set before GTK initializes (i.e. before the Tauri builder runs).
    #[cfg(target_os = "linux")]
    std::env::set_var("GTK_OVERLAY_SCROLLING", "0");

    tauri::Builder::default()
        // Opens external URLs / mailto: links in the user's default app — needed
        // because the web app uses mailto: and target=_blank links.
        .plugin(tauri_plugin_opener::init())
        // Save dialog + filesystem write — used to save generated PDFs, since the
        // webview ignores blob `<a download>` saves.
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running Helm");
}
