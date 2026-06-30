#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Opens external URLs / mailto: links in the user's default app — needed
        // because the web app uses mailto: and target=_blank links.
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Helm");
}
