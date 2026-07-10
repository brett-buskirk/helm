# Deploying Helm (Cloudflare Pages)

> **Status: live** at **<https://helm.brett-buskirk.dev/>** — provisioning is done.
> The steps below are the setup record and how future changes deploy.

Helm ships as an installable **PWA** — a static bundle served from a CDN. Only
the app *shell* is hosted; all data lives in the browser's IndexedDB on the
user's machine and never touches the host (see
[ADR 0001](adr/0001-ship-as-pwa-defer-native-installers.md)). Hosting is
therefore low-stakes and, because Helm uses hash routing, needs **no server-side
rewrite rules** — the build drops onto any static host as-is.

The host is **Cloudflare Pages** — free, with no bandwidth caps, private-repo
support, a free custom domain, and commercial use permitted. The repo ships its
Pages config at **[`wrangler.toml`](../wrangler.toml)** and an SPA fallback at
**[`public/_redirects`](../public/_redirects)**.

> **Why not DigitalOcean?** An earlier iteration targeted DO App Platform, but
> DO's free static-site tier (3 per account) was already used up and a fourth
> billed at ~$24/mo. Cloudflare Pages is free for this use case. The PWA-vs-
> installers decision (ADR 0001) is unchanged — only the static host differs.

## How deploys flow

```
PR (CI + AgentGate green) ──merge──▶ main ──push──▶ Cloudflare builds & publishes
```

`main` is branch-protected, so only merged, CI-green code reaches it. Cloudflare
Pages watches the production branch (`main`) and rebuilds on every push — the
existing PR gates *are* the deploy gate. There are **no Cloudflare secrets in
GitHub** and no CI deploy step; Cloudflare's own build system runs
`npm run build` and serves `dist/`.

## One-time provisioning (done)

Connecting the private repo was an account-level action, done once by hand:

1. **[Cloudflare dashboard](https://dash.cloudflare.com) → Workers & Pages →
   Create → Pages → Connect to Git.**
2. Authorize Cloudflare for `brett-buskirk/helm` (private repos are supported —
   grant the Cloudflare GitHub app access to it).
3. Set the build config (or let it read `wrangler.toml`):
   - **Production branch:** `main`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Framework preset:** Vite (optional; just sets the two fields above)
4. Under **Settings → Environment variables**, set `NODE_VERSION` = `20` so the
   build matches the repo's `engines` floor. Then **Save and Deploy**.

First build takes a few minutes; after that every merge to `main` auto-deploys,
and every PR gets a preview URL for free.

### Alternative: deploy from the CLI

With [`wrangler`](https://developers.cloudflare.com/workers/wrangler/)
authenticated (`npx wrangler login`):

```bash
npm run build
npx wrangler pages deploy dist --project-name helm
```

## Build details

- **Node:** pinned to `>=20` via `package.json` `engines`; also set
  `NODE_VERSION=20` in the Pages project (step 4) since Cloudflare's build image
  defaults to an older Node otherwise.
- **Output:** `dist/` (Vite) — includes the service worker (`sw.js` + workbox)
  for offline/precaching and `manifest.webmanifest` for installability.
- **SPA fallback:** `public/_redirects` (`/* /index.html 200`) is copied into
  `dist/` by Vite; rarely hit thanks to hash routing, but it keeps stray deep
  paths from 404ing.

## Custom domain

The app is live at **<https://helm.brett-buskirk.dev/>**. Because
`brett-buskirk.dev`'s DNS is managed on **DigitalOcean** (not Cloudflare), it was
wired up as a CNAME:

1. Add the custom domain in the Pages project's **Custom domains** tab —
   Cloudflare supplies a CNAME target (`helm-d5s.pages.dev`).
2. Create a `CNAME` record in the DO DNS panel: `helm` → `helm-d5s.pages.dev`.
3. Cloudflare provisions the TLS certificate automatically once it resolves.

The Cloudflare-assigned URL `helm-d5s.pages.dev` still works as a fallback. No DNS
migration was needed — a CNAME on DO does **not** consume a DO static-app slot.

## A note on privacy

The deployed shell is **public** — anyone with the URL loads the app, but it
starts empty; there is no shared backend and no data to expose. If you ever want
the shell itself gated, Cloudflare Access can put it behind auth — but that isn't
required to keep *data* private, since data never leaves the user's browser.
