# Helm as a native desktop app (Tauri)

Helm ships as a web app / installable PWA, and is **also** wrapped with
[Tauri v2](https://v2.tauri.app) so it can run as a native desktop application
(Windows, macOS, Linux) with its own window and app icon.

The same React/Vite frontend powers both — Tauri just hosts the built `dist/`
in a native webview. Because the app uses **hash routing**, no routing or server
changes were needed to run inside Tauri.

> **The PWA is the shipped product; the desktop build is deferred/optional.**
> Helm is distributed as its installable PWA — see
> [ADR 0001](adr/0001-ship-as-pwa-defer-native-installers.md). The Tauri wrapper
> is kept in the repo as an optional native shell (paid code-signing and per-OS
> installer packaging are out of scope for a local-first, single-user tool), so
> the build steps below still work but aren't part of the release path.

> **Status — what this does and doesn't do yet**
> - ✅ Native desktop window, app icon, and per-platform installers (build them
>   yourself; not signed or published — see ADR 0001).
> - ✅ Opens `mailto:` and external links via the OS (the `opener` plugin), and
>   saves PDFs through the native dialog + filesystem plugins.
> - ✅ **Encryption at rest** works here too — it's the same opt-in, client-side
>   scheme as the web build (tweetnacl field encryption + a PBKDF2 passphrase
>   app-lock over IndexedDB), so no desktop-specific work is needed.
> - 🚧 **Persistence is IndexedDB** inside the webview — a *separate* store from
>   your browser's. Back it up with the in-app JSON export; to move data between
>   the desktop app and the PWA, export from one and import into the other.

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

## App icons (already generated)

The desktop icons are **committed** in `src-tauri/icons/` (generated from
`public/helm-icon.svg`), so there's nothing to do before your first build.

To regenerate them after changing the logo — `tauri icon` takes the SVG
directly, no PNG needed:

```sh
npm run tauri icon public/helm-icon.svg
```

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
> via the GPU and shows an empty window. Use the WSL convenience script, which
> sets software rendering for you:
> ```sh
> npm run tauri:dev:wsl
> ```
> (Equivalent to `WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri:dev`. On older
> WSLg, use `WEBKIT_DISABLE_COMPOSITING_MODE=1` instead.)

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

The desktop wrapper is optional (see ADR 0001), so this is a "someday if the
native path is worth it" list, not release-blocking work:

1. **Native filesystem backups** — the `fs`/`dialog` plugins are already wired
   (they back the PDF save dialog), so a one-click "Save backup to disk" and a
   scheduled auto-export to a real folder are a small extension.
2. **Signed, published installers** — code-signing + notarization + per-platform
   distribution, only if Helm is ever handed to other users as a native app.

> **Not planned: SQLCipher.** An earlier note here proposed migrating persistence
> to encrypted SQLite. That was rejected — encryption at rest is already solved
> client-side (opt-in tweetnacl + PBKDF2 over IndexedDB), which works in both the
> PWA and the desktop webview without a storage-engine rewrite.
