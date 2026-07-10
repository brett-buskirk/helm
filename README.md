# Helm

**A local-first PSA (professional services automation) tool for the solo
consultant — your own "consulting ERP."** Clients, projects, proposals, invoices,
expenses, time, taxes, and contract documents — the whole proposal → SOW →
invoice → tax-set-aside pipeline in one connected place, shaped around a solo
technical consultant's workflow.

Everything runs on your machine. No server, no accounts, no cloud. Install it
from your browser as a PWA, work fully offline, optionally encrypt it with a
passphrase, and back it up with one click.

> Built as a daily-use tool **and** a portfolio piece: a local-first app with a
> real relational data model, opt-in client-side encryption, PDF document
> generation, and a command-center dashboard.

---

## Install

Helm is live and installable — nothing to download or sign in to:

1. Open **<https://helm.brett-buskirk.dev/>** in a modern browser.
2. Install it as an app: **Chrome/Edge** — click the install icon in the address
   bar (or ⋮ menu → *Install Helm*); **Safari** — Share → *Add to Dock* (macOS) /
   *Add to Home Screen* (iOS).
3. It opens in its own window, works fully offline, and updates itself silently
   on each new deploy.

Your data lives only in that browser profile's storage on your machine, so
**export a backup regularly** (Settings → Data & Backup) — see
[Data & security](#data--security) below.

---

## Features

**The connected hub — everything links to a client**
- **Clients & Projects** — projects are fixed-price, retainer, or hourly; open a
  client to see their entire history in one place.
- **Proposals → SOW → Invoice pipeline** — draft → sent → accepted/declined, then
  turn an accepted proposal into an invoice in one click.
- **Invoices** — auto-calculating line items, deposits/milestones, tax, payment
  recording, status workflow (draft/sent/paid/overdue), and PDF export.
- **Retainers** — generate the current month's invoice for an active retainer
  straight from the dashboard.
- **Time tracking** — log hours against hourly projects and roll unbilled time
  into an invoice; cancelling an invoice releases its hours again.
- **Expenses & taxes** — categorized expenses, deductible flags, and a running
  25% tax set-aside.
- **Documents & templates** — a vault of MSA/NDA/SOW/Proposal templates with
  variable substitution; generate client-specific docs and export branded PDFs.
- **Toolbox** — customizable quick links to the tools you use (cloud consoles,
  admin panels, dashboards, docs).

**Command center**
- A dashboard with cash-flow trends, YTD income/profit/margin, outstanding &
  overdue, unbilled time, retainer MRR, and top clients.
- A **⌘K command palette** — navigate anywhere and run actions from the keyboard.
- Branding — your logo and brand color flow onto invoices, proposals, documents,
  and the app itself.

**Local-first & private**
- Data lives in **IndexedDB** (via Dexie). Shipped as an offline-capable,
  installable **PWA**; an optional **Tauri** desktop build is kept in the repo
  but deferred (see [ADR 0001](docs/adr/0001-ship-as-pwa-defer-native-installers.md)).
- **Opt-in at-rest encryption** — encrypt the live database with a passphrase
  (tweetnacl + PBKDF2); the app locks on each load.
- **Encrypted backups** — passphrase-protected JSON export/import (AES-256-GCM),
  plus a plain export.
- **Sample data** — one click loads a realistic demo practice to explore; one
  click clears it, leaving any real data untouched.

---

## Quick start (web)

```bash
npm install
npm run dev        # http://localhost:1420
npm run build      # production build → dist/
npm run preview    # preview the production build
```

## Desktop app (Tauri) — optional / deferred

The **PWA above is the shipped product.** Helm is *also* wrapped with
[Tauri v2](https://v2.tauri.app) as an optional native desktop build — kept in the
repo but deferred; signed installers aren't on the release path
([ADR 0001](docs/adr/0001-ship-as-pwa-defer-native-installers.md)). To build it
yourself you need a Rust toolchain + per-platform build tools — see
**[docs/TAURI.md](docs/TAURI.md)**, then:

```bash
npm run tauri:dev      # native app with hot-reload
npm run tauri:build    # installers → src-tauri/target/release/bundle/
```

## Data & security

- All data is stored locally in IndexedDB — clearing browser storage wipes it, so
  **back up regularly**: Settings → Data & Backup → Export (plain or encrypted).
- **Encryption at rest** is opt-in (Settings → Encryption). When on, the app
  requires your passphrase to unlock; sensitive content and identities are stored
  as ciphertext while the structural graph stays queryable. There is **no
  passphrase recovery** — keep a backup.
- No telemetry, no network calls for your data.

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 19 + TypeScript |
| Bundler | Vite 6 |
| Styles | Tailwind CSS v4 |
| Database | Dexie v4 (IndexedDB) + dexie-react-hooks |
| Forms | react-hook-form + zod |
| Routing | react-router v7 (hash router — works offline, no server) |
| PDF | @react-pdf/renderer |
| Charts | recharts |
| Crypto | Web Crypto (PBKDF2, AES-GCM) + tweetnacl (secretbox) |
| Desktop | Tauri v2 (Rust) — optional / deferred |
| PWA | vite-plugin-pwa |
| Hosting | Cloudflare Pages (static) |
| Tests | Vitest + fake-indexeddb + React Testing Library; Playwright (e2e) |

## Project structure

```
src/
├── components/
│   ├── clients/ projects/ invoices/ proposals/
│   ├── documents/ time/ expenses/          # feature forms & PDFs
│   ├── command/        # ⌘K command palette
│   ├── security/       # unlock gate + screen
│   ├── layout/         # AppLayout, Sidebar
│   └── ui/             # Button, Input, Drawer, Table, Modal, …
├── db/                 # Dexie schema + transparent encryption hooks
├── hooks/              # useToast, usePdfDownload
├── pages/              # one file per route
├── types/              # entity interfaces + union types
└── utils/              # backup, crypto, vault, savePdf, pdf, image,
                        # format, date, invoice, retainer, time,
                        # dashboard, links, sampleData
src-tauri/              # Tauri (Rust) desktop wrapper
```

## Development

```bash
npm run test           # watch mode (Vitest)
npm run test:run       # single run
npm run test:e2e       # Playwright end-to-end suite
npm run check:cycles   # fail on circular imports (madge)
```

## Repo workflow

- `main` is branch-protected — no direct commits. Work on a feature branch and
  open a PR with `gh pr create`.
- **CI** runs on every PR: type-check, circular-import check, tests, and build.
- **AgentGate** runs on every PR: `secrets` and `dangerous_patterns` are hard
  blocks; scope/diff/tests/deps are advisory.

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full policy.
