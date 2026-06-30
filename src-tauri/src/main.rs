// Prevents an additional console window from opening on Windows in release.
// DO NOT REMOVE.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    helm_lib::run()
}
