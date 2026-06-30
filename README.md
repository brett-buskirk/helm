# Helm

A local-first PWA for running a solo consulting practice — clients, projects, invoices, expenses, documents, and taxes in one connected place.

Data lives in your browser (IndexedDB via Dexie). No server, no auth, no cloud. Install it, use it offline, back it up with one click.

## Quick start

```bash
npm install
npm run dev        # http://localhost:1420
```

```bash
npm run build      # production build → dist/
npm run preview    # preview the production build locally
```

## Desktop app (Tauri)

Helm is also wrapped with [Tauri v2](https://v2.tauri.app) to run as a native
desktop app. It needs a Rust toolchain and per-platform build tools — see
**[docs/TAURI.md](docs/TAURI.md)** for setup, then:

```bash
npm run tauri:dev      # run the native app with hot-reload
npm run tauri:build    # produce installers in src-tauri/target/release/bundle/
```

Persistence is still IndexedDB inside the webview today; an encrypted-SQLite
(SQLCipher) migration is the planned follow-up.

## What's built

| Phase | Feature | Status |
|---|---|---|
| 0 | Scaffold, Dexie schema (all 9 entities), app shell, Settings, backup/restore | ✅ Done |
| 1 | Clients (list, detail, CRUD, archive), Projects (list, CRUD) | ✅ Done |
| 2 | Invoices — create/edit, line items, PDF export, status workflow | 🔜 Next |
| 3 | Expenses, income ledger, tax set-aside tracker | ⬜ Planned |
| 4 | Document/contract template vault, PDF generation per client | ⬜ Planned |
| 5 | Dashboard (income/expense charts, overdue summary), global search, polish | ⬜ Planned |

The sidebar shows all six sections. Invoices, Expenses, and Documents are stubbed — they render a placeholder until their phase ships.

## Data & backup

All data is stored in IndexedDB. Clearing browser storage wipes it.

**Back up regularly:** Settings → Data & Backup → Export All Data. The export is a plain JSON file you can restore from the same screen.

The Dexie schema is defined in full at `src/db/index.ts` — all nine tables exist from day one so later phases slot in without migrations.

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 19 + TypeScript |
| Bundler | Vite 6 |
| Styles | Tailwind CSS v4 |
| Database | Dexie v4 (IndexedDB) + dexie-react-hooks |
| Forms | react-hook-form + zod |
| Routing | react-router v7 (hash router — works offline without a server) |
| PDF | @react-pdf/renderer (Phase 2+) |
| Charts | recharts (Phase 5) |
| PWA | vite-plugin-pwa (installable, offline-capable) |
| Icons | lucide-react |

## Project layout

```
src/
├── components/
│   ├── clients/        # ClientForm drawer
│   ├── layout/         # AppLayout, Sidebar
│   ├── projects/       # ProjectForm drawer
│   └── ui/             # Button, Input, Drawer, Table, Modal, Badge, Tabs, Toast, …
├── db/                 # Dexie schema + default data
├── hooks/              # useToast
├── pages/              # One file per route
├── types/              # All entity interfaces and union types
└── utils/              # backup (export/import), format (date/currency)
```

## Contributing / repo workflow

- `main` is branch-protected — no direct commits.
- Work on a feature branch, open a PR with `gh pr create`.
- AgentGate CI runs on every PR: `secrets` and `dangerous_patterns` are hard blocks; everything else is advisory.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full policy.
