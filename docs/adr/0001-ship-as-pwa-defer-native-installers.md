# ADR 0001 — Ship Helm as a PWA; defer native installers

- **Status:** Accepted — 2026-07-09
- **Deciders:** Brett Buskirk

## Context

Helm is a **local-first, single-user** tool — one person's consulting back
office, with all data living on their own machine (IndexedDB via Dexie). It was
built **PWA-first**: `vite-plugin-pwa` provides an installable, offline-capable
app, and the web build is the primary output. A Tauri v2 desktop wrapper was
added later (see `docs/TAURI.md`) as an *optional* native shell hosting the same
`dist/` in a native webview — the Vite web build is unchanged when Tauri is not
involved.

Treating the **Tauri installers** as the release artifact quietly drags in the
exact friction that local-first is meant to avoid:

- **Paid code-signing.** Distributing installers without OS "unknown publisher"
  warnings needs certificates: an Apple Developer Program membership (annual fee)
  for macOS signing + notarization, and a Windows CA code-signing certificate —
  which, since June 2023, must live on a hardware token or cloud HSM. Ongoing
  cost and administrative overhead that was never the intent for a personal tool.
- **Per-OS installer packaging + an update/hosting story** to build, sign,
  notarize, publish, and auto-update three platforms' bundles.
- **Downloads regress in the desktop webview.** The native save-dialog code in
  `src/utils/savePdf.ts` exists *only* because Linux WebKitGTK ignores blob
  `<a download>` saves. In a real browser, PDF downloads work natively.

None of this serves a single user running their own tool. A PWA, by contrast,
installs from the browser, updates itself via the service worker, costs nothing
to host, and keeps every byte of data on the user's machine. The web build
already contemplates a static web deploy (the `vite.config.ts` and
`docs/TAURI.md` comments reference a DigitalOcean deploy target).

## Decision

**The PWA is the shipped product.** Helm is distributed and run as its
installable PWA. Concretely:

1. Deploy the production build to static hosting; the host serves only the app
   shell — all data stays local in IndexedDB, so privacy is unchanged.
2. Users install from the browser ("Install app") to get a standalone window,
   an icon, offline support, and silent service-worker auto-updates.
3. Keep `src-tauri/` in the repository as an **optional, deferred** native
   wrapper. It is isolated, costs nothing to retain, and preserves both the
   future option and the portfolio narrative (a local-first PWA *and* a native
   desktop build).
4. Retarget the 1.0 release track: instead of signed per-platform installers,
   ship the PWA and document browser install. A tagged `v1.0.0` and a real
   `CHANGELOG.md` still apply.

## Consequences

### Positive

- **No cost to ship.** No developer-program fees, no CA certificate, no
  notarization, no installer CI.
- **Free, trivial hosting.** Any static host works, and it never sees user data.
- **Browser-native install + auto-update** with no updater infrastructure and no
  signing.
- **Downloads work natively** in every real browser — the desktop-webview
  workaround stops being on the critical path.
- **Cross-platform for free** — anything with a modern browser, no per-OS builds.

### Trade-offs / what we give up

- **No automatic native filesystem backups.** This was a *future* Tauri feature,
  never shipped; manual JSON export/import already covers backup, and the File
  System Access API (Chromium) is a possible middle path later.
- **Data is scoped to the browser profile.** Clearing browser storage wipes it,
  so backup/restore (a Phase 0 non-negotiable) remains essential.
- **Slightly less "native" feel** than a dock/Start-menu app — an installed PWA
  gets its own window and icon, which is close but not identical.

### Migration note

Data entered into the **Tauri desktop app** lives in a *separate* webview store
from the browser's. To move it: export JSON from the desktop app, then import it
into the browser PWA. One-time, using the existing backup/restore feature.

## Alternatives considered

- **Ship signed installers now.** Rejected: recurring cost + multi-platform
  signing/notarization friction contradicts the local-first, zero-friction goal,
  and was never the intent for a personal tool.
- **Remove Tauri entirely.** Rejected: `src-tauri/` is isolated and costs nothing
  to keep. Retaining it preserves the option to distribute natively later and the
  portfolio story, at no ongoing burden.
