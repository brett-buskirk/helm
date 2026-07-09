# Deploying Helm (DigitalOcean App Platform)

Helm ships as an installable **PWA** — a static bundle served from a CDN. Only
the app *shell* is hosted; all data lives in the browser's IndexedDB on the
user's machine and never touches the host (see
[ADR 0001](adr/0001-ship-as-pwa-defer-native-installers.md)). Hosting is
therefore low-stakes and, because Helm uses hash routing, needs **no server-side
rewrite rules** — the build drops onto any static host as-is.

The repo ships a DigitalOcean App Platform spec at **[`.do/app.yaml`](../.do/app.yaml)**.

## How deploys flow

```
PR (CI + AgentGate green) ──merge──▶ main ──deploy_on_push──▶ DO builds & publishes
```

`main` is branch-protected, so only merged, CI-green code reaches it. DO's
`deploy_on_push` then rebuilds and republishes automatically — the existing PR
gates *are* the deploy gate. There are **no DigitalOcean secrets in GitHub** and
no `doctl` step in CI; DO's own build system runs `npm run build` and serves
`dist/`.

## One-time provisioning (dashboard) — Brett runs this

Creating the app and connecting the private repo is an account-level action, so
it's done once by hand:

1. **[DigitalOcean → Apps](https://cloud.digitalocean.com/apps) → Create App.**
2. Choose **GitHub** as the source and authorize DO for `brett-buskirk/helm`
   (a private repo needs the DO GitHub app granted access to it).
3. Pick branch **`main`**. DO detects `.do/app.yaml` and configures a **static
   site** component (`npm run build` → `dist/`) automatically.
4. Confirm the plan is the **Starter / free static site** tier, then **Create**.

First build takes a few minutes; after that every merge to `main` auto-deploys.

### Alternative: provision from the CLI

With [`doctl`](https://docs.digitalocean.com/reference/doctl/) authenticated:

```bash
doctl apps create --spec .do/app.yaml     # first time
doctl apps list                           # find the app id
doctl apps update <app-id> --spec .do/app.yaml   # after spec changes
```

## Build details

- **Node:** pinned to `>=20` via `package.json` `engines`, which DO's Node
  buildpack respects. Bump the floor there if the toolchain needs it.
- **Output:** `dist/` (Vite) — includes the service worker (`sw.js` + workbox)
  for offline/precaching and `manifest.webmanifest` for installability.
- **Region:** `nyc` in the spec; static sites are served globally via CDN
  regardless, so this is just the app's home region — adjust if preferred.

## Custom domain (optional)

Add a domain in the app's **Settings → Domains**, or add a `domains:` block to
`.do/app.yaml`. DO provisions the TLS certificate automatically.

## A note on privacy

The deployed shell is **public** — anyone with the URL loads the app, but it
starts empty; there is no shared backend and no data to expose. If you ever want
the shell itself gated (e.g. while it's unfinished), put it behind an access
proxy or a private domain — but it isn't required to keep *data* private, since
data never leaves the user's browser.
