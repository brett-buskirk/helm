# Roadmap

Helm shipped **v1.0.0** (2026-07-09) and is live as an installable PWA at
<https://helm.brett-buskirk.dev/>. It's feature-complete across its planned
phases (0–5) — the connected client hub, the proposal → SOW → invoice pipeline,
invoicing with PDF export, time tracking, expenses and the running tax set-aside,
the document/template vault with a markdown editor and @-mention linking, the ⌘K
command palette, opt-in at-rest encryption, encrypted backups, and an optional
Tauri desktop build.

Since 1.0, post-launch releases have added recurring expenses, invoice edit &
delete, a new-user intro and PDF fixes (**1.1.0**); then an income ledger for
money that never went through an invoice, sortable/filterable expense and
invoice lists, a Time entry detail panel, date-ranged invoicing, a client-facing
time report, and a self-repairing fix for date-type corruption (**1.2.0**) — see
[CHANGELOG.md](CHANGELOG.md). What remains is a short list of automation
nice-to-haves. Nothing here is a rewrite.

## 1.0 release — shipped

Helm ships as its **installable PWA**, not as signed native installers — see
[ADR 0001](docs/adr/0001-ship-as-pwa-defer-native-installers.md) for why (it's a
local-first, single-user tool; paid code-signing and per-OS installer packaging
add friction that local-first is meant to avoid). The Tauri wrapper stays in the
repo as a deferred, optional native shell.

- [x] Cut the first tagged release (**v1.0.0**, 2026-07-09) with a real
      `CHANGELOG.md`.
- [x] Deploy to **Cloudflare Pages** as a static site — **live at
      <https://helm.brett-buskirk.dev/>**. Config at [`wrangler.toml`](wrangler.toml),
      setup in [docs/DEPLOY.md](docs/DEPLOY.md); every merge to `main`
      auto-publishes and each PR gets a free preview URL.
- [x] Document browser install (Add to Home Screen / Install app) in the README.

### Deferred — native installers (optional, not on the 1.0 path)

Kept as a future option; requires paid signing certs + hosting decisions.

- [ ] Produce signed, per-platform Tauri installers (macOS `.dmg`, Windows
      `.msi`/NSIS, Linux `.AppImage`/`.deb`) and attach them to a GitHub release.
- [ ] Wire installer packaging into CI so a tag push builds and publishes the
      bundles automatically.

## Automation & convenience (from the build brief, not yet built)

- [ ] **Recurring retainer invoices** — auto-generate the monthly invoice for an
      active retainer instead of the one-click dashboard action.
- [ ] **Overdue reminders** — surface and nudge on invoices past their due date.
- [ ] **CSV import for expenses** — the "sync later" path for pulling in bank/
      statement rows without a live bank API.

## Backlog — captured ideas

Tracked as issues (milestone **Backlog**); not yet scheduled.

- [ ] **Daily automated local encrypted backup** — write an encrypted backup to
      local storage on a daily cadence, no network egress
      ([#70](https://github.com/brett-buskirk/helm/issues/70)).
- [ ] **Expense report documents (PDF)** — generate, save, and download expense
      reports; on demand over a date range + filters, or auto-generated
      monthly/quarterly/annually
      ([#71](https://github.com/brett-buskirk/helm/issues/71)). The Time report
      added in 1.2.0 is the pattern to follow.
- [x] **Dedicated Security area** — shipped in 1.2.0 (#79).
- [x] **Business name in the sidebar** — shipped in 1.2.0 (#77).
- [x] **Branding color picker** — shipped in 1.2.0 (#78).

## Small follow-ups

- [ ] Adopt the shared table's column sorting on **Clients**, **Projects**, and
      the client detail tabs — they already use the same `Table` component.

## Maintenance

- [ ] Keep dependencies current (React 19, Vite 6, Tailwind v4, Dexie v4, Tauri v2).
- [ ] Grow Vitest coverage and the Playwright e2e suite alongside new features.
- [ ] Hold the accessibility bar (focus management, labels, keyboard nav) as UI changes.
