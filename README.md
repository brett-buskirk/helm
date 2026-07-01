# Helm

**A local-first operating system for an independent consulting practice.**
Clients, projects, proposals, invoices, expenses, time, taxes, and contract
documents — in one connected place, shaped around a solo technical consultant's
workflow.

Everything runs on your machine. No server, no accounts, no cloud. Install it as
a PWA or a native desktop app, work fully offline, optionally encrypt it with a
passphrase, and back it up with one click.

> Built as a daily-use tool **and** a portfolio piece: a local-first app with a
> real relational data model, opt-in client-side encryption, PDF document
> generation, and a command-center dashboard.

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
- Data lives in **IndexedDB** (via Dexie). Offline-capable **PWA** and a native
  **desktop app** (Tauri).
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

## Desktop app (Tauri)

Helm is also wrapped with [Tauri v2](https://v2.tauri.app) to run as a native
desktop app. It needs a Rust toolchain + per-platform build tools — see
**[docs/TAURI.md](docs/TAURI.md)** for setup, then:

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
| Desktop | Tauri v2 (Rust) |
| PWA | vite-plugin-pwa |
| Tests | Vitest + fake-indexeddb |

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
npm run test           # watch mode
npm run test:run       # single run
npm run check:cycles   # fail on circular imports (madge)
```

## Repo workflow

- `main` is branch-protected — no direct commits. Work on a feature branch and
  open a PR with `gh pr create`.
- **CI** runs on every PR: type-check, circular-import check, tests, and build.
- **AgentGate** runs on every PR: `secrets` and `dangerous_patterns` are hard
  blocks; scope/diff/tests/deps are advisory.

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full policy.
