# Helm as a native desktop app (Tauri)

Helm ships as a web app / installable PWA, and is **also** wrapped with
[Tauri v2](https://v2.tauri.app) so it can run as a native desktop application
(Windows, macOS, Linux) with its own window and app icon.

The same React/Vite frontend powers both — Tauri just hosts the built `dist/`
in a native webview. Because the app uses **hash routing**, no routing or server
changes were needed to run inside Tauri.

> **Status — what this does and doesn't do yet**
> - ✅ Native desktop window, app icon, installers per platform.
> - ✅ Opens `mailto:` and external links via the OS (the `opener` plugin).
> - 🚧 **Persistence is still IndexedDB** inside the webview. Your data lives in
>   the app's local webview storage; back it up with the in-app JSON export.
> - 🚧 **Encryption at rest is NOT here yet.** The planned follow-up migrates
>   persistence to SQLite + SQLCipher for an encrypted local database. Until
>   then, rely on OS full-disk encryption (see the data-security notes).

---

## Prerequisites

Tauri needs a **Rust toolchain** plus platform build tools. Install once per
machine.

### 1. Rust (all platforms)
Install via [rustup](https://rustup.rs):
```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # macOS/Linux
# Windows: download and run rustup-init.exe from https://rustup.rs
```

### 2. Platform build tools

**Windows**
- **Microsoft C++ Build Tools** (the "Desktop development with C++" workload).
- **WebView2** runtime — preinstalled on Windows 10/11; otherwise install the
  Evergreen runtime from Microsoft.

**macOS**
```sh
xcode-select --install
```

**Linux / WSL2**
```sh
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config
```

### Which environment do I build in? (WSL vs Windows)

The project lives on the WSL filesystem, so there are two paths — pick by what
you want:

| You want… | Where to run | What you get |
|-----------|--------------|--------------|
| **To run/use Helm now** (recommended first) | **In WSL**, where the project already is | A *Linux* build whose window appears on your Windows desktop via **WSLg** |
| **A distributable Windows `.exe`/`.msi`** | A **separate Windows-side checkout** | A native Windows installer |

**Start in WSL.** Everything is already there — install Rust *inside WSL* (the
rustup line above) and the apt packages above, and run the commands below. WSLg
(present on your machine) renders the native window on Windows automatically. No
need to move or re-clone the project.

Only set up the **Windows** path later, *if* you want a shareable Windows
installer. That means a fresh `git clone` onto the Windows filesystem (e.g.
`C:\Users\you\helm`), Rust-for-Windows + the C++ Build Tools, and `npm install`
there — Rust and `node_modules` are platform-specific, so the Windows build
needs its own checkout rather than reusing the WSL one across `\\wsl$`.

---

## First-time setup: generate the app icons

The icon files referenced by `src-tauri/tauri.conf.json` are **generated, not
committed**. The `tauri icon` command accepts an **SVG** directly, so just point
it at the logo already in the repo — no need to create a PNG:

```sh
npm run tauri icon public/helm-icon.svg
```

(`public/helm-icon.svg` is a real file in the repo — that's the actual path to
type, not a placeholder.) This writes `32x32.png`, `128x128.png`,
`128x128@2x.png`, `icon.icns`, and `icon.ico` into `src-tauri/icons/`.

> Skipping this step makes the build fail with a missing-icon error.

---

## Develop

```sh
npm install        # first time — installs @tauri-apps/cli
npm run tauri:dev
```

This launches the Vite dev server (port **1420**) and opens the native window
pointing at it, with hot-reload. (The web dev server port moved from Vite's
default 5173 to 1420 so the Tauri webview can connect reliably; plain
`npm run dev` now also serves on 1420.)

> **WSLg: blank/white window?** WebKitGTK under WSLg sometimes fails to composite
> via the GPU and shows an empty window. Run with software rendering:
> ```sh
> WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri:dev
> ```
> (On older WSLg, use `WEBKIT_DISABLE_COMPOSITING_MODE=1` instead.)

## Build installers

```sh
npm run tauri:build
```

Output lands in `src-tauri/target/release/bundle/`:
- **Windows** — `.msi` and `.exe` (NSIS) installers
- **macOS** — `.app` and `.dmg`
- **Linux** — `.deb`, `.rpm`, and `.AppImage`

---

## How the pieces fit

| File | Purpose |
|------|---------|
| `src-tauri/Cargo.toml` | Rust crate + Tauri dependencies |
| `src-tauri/src/main.rs` | Binary entry — calls `helm_lib::run()` |
| `src-tauri/src/lib.rs` | Builds and runs the Tauri app (registers plugins) |
| `src-tauri/tauri.conf.json` | Window, bundle, and build config (`devUrl`, `frontendDist`) |
| `src-tauri/capabilities/default.json` | Permissions granted to the main window |
| `src-tauri/build.rs` | Tauri build script |
| `vite.config.ts` | Tauri-aware dev server + build targets (web build unchanged) |

The web build (and the DigitalOcean deploy) are unaffected — the Tauri-specific
Vite settings only apply when the Tauri CLI sets `TAURI_ENV_*`.

---

## Roadmap from here

1. **Native filesystem backups** — use Tauri's `fs`/`dialog` plugins for
   one-click "Save backup to disk" and scheduled auto-export to a real folder.
2. **Encrypted SQLite (SQLCipher)** — migrate persistence off IndexedDB to an
   encrypted local database. This is the real data-at-rest security upgrade.
