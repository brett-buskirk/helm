# Changelog

All notable changes to helm are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Bill a date range of hours** — the Time page's *Generate Invoice* now takes
  an optional inclusive **Bill from / To** window, so a project's unbilled hours
  can be invoiced a month (or any period) at a time instead of all at once.
  Hours outside the window stay unbilled for a later invoice, and the invoice
  records the period it covers so the client can see what it's for. Leaving both
  dates blank bills everything, as before.

- **Time entry detail** — click a row on the Time page (or tab to its
  description) to open a panel with the full description, client, project,
  hours, status, and the entry's value at the project's rate, with Edit and
  Delete alongside. Billed entries stay locked and link to their invoice.

- **Income beyond invoices** — a new **Income** page records money that never
  went through an invoice: owner's contributions, cashback and rebates,
  donations, interest, and anything else. Invoice payments appear in the same
  ledger (read-only — they belong to their invoice), so one screen shows every
  deposit, sortable and filterable by source and tax treatment.
- **Revenue vs. Money In** — the dashboard now separates taxable **revenue**
  from total **money in**. An owner's transfer isn't earnings and cashback is
  normally a rebate, so counting either as income would inflate profit, margin,
  and the 25% tax set-aside. Each source carries a sensible taxable default that
  you can override per entry, and the value is stored on the record so how a
  deposit was treated stays auditable.

- **Sortable, filterable expense tables** — click any column header on Expenses
  to sort by it (date, vendor, category, client, amount; and on the Recurring
  tab, repeats, per-year, and next-due), and narrow the list with new **client**
  and **tag** filters alongside the existing search, category, and period
  controls. Rows with no value sort last in either direction, and sorting never
  changes the summary totals.

### Fixed

- **Dialog titles** — `Drawer` and `Modal` each gave their heading the same
  fixed element id, so a screen reader announced every open dialog on a page
  with the first one's title (Security shows four modals at once). Each instance
  now gets its own id.
- **Dates survive a backup restore** — importing a backup rewrote every date as
  text (JSON has no date type), and IndexedDB orders keys by type before value,
  so any list sorted by date came out in the wrong order while still *displaying*
  correctly. Imports now restore real dates, and **Security → Data Health**
  offers a one-click repair for a database restored before this fix.

### Changed

- **Security area** — backup/restore and at-rest encryption moved out of Settings
  into a dedicated **Security** page (its own sidebar entry), grouping every
  data-safety control in one place. Settings now focuses on the business profile,
  invoice defaults, branding, and integrations.

## [1.1.0] - 2026-07-28

Post-1.0 improvements, live on <https://helm.brett-buskirk.dev/> — recurring
expenses, invoice edit & delete, a new-user intro, and PDF rendering fixes.

### Added

- **Recurring expenses** — mark an expense Monthly, Quarterly, or Annual; Helm
  surfaces each occurrence as it comes due and logs it in one click, catching up
  multiple periods if you've been away.
- **Recurring views** — a "Recurring" tab on the Expenses page (frequency filter
  + a monthly/annual run-rate summary), and a recurring run-rate card on the
  dashboard, alongside Retainer MRR.
- **Invoice edit & delete** — delete an invoice (cascading to its payments and
  freeing any billed time back to unbilled, so dashboard totals adjust), plus
  edit and delete actions directly on the invoice list.
- **Client detail polish** — count badges on the Proposals and Documents tabs,
  and click any project row to open its edit drawer.
- **Wider, sectioned project drawer** — the project add/edit panel is roomier and
  grouped into labeled sections.
- **GitHub integration** — shows all open issues and pull requests (previously
  capped at 10), with "view all on GitHub" links.
- **New-user intro** — a dashboard hero explaining what Helm is, with a one-click
  install, shown to new users.
- **Mobile screen** — phones get a branded "built for desktop" explainer instead
  of a cramped layout (Helm is a local-first desktop workspace).

### Fixed

- **PDF rendering** — decode HTML entities (e.g. `&quot;` → `"`) so quotes render
  correctly, and apply consistent margins on every page of documents, proposals,
  and invoices.

## [1.0.0] - 2026-07-09

First tagged release. Helm is live as an installable, offline-capable PWA at
<https://helm.brett-buskirk.dev/> (hosted on Cloudflare Pages); the Tauri desktop
wrapper is retained as a deferred, optional native shell (see
[ADR 0001](docs/adr/0001-ship-as-pwa-defer-native-installers.md)).

### Added

**The connected hub**
- Clients and Projects as the core graph — everything links to a client; open a
  client to see their full history in one place. Projects are fixed-price,
  retainer, or hourly, with a `lead` status for pipeline tracking.
- Proposal → SOW → Invoice pipeline — proposals move draft → sent →
  accepted/declined, and an accepted proposal converts to an invoice in one click.
- Invoices with auto-calculating line items, deposit/milestone lines, tax,
  payment recording, a draft/sent/paid/overdue status workflow, and PDF export
  (paid invoices export with a `-PAID` filename suffix).
- Retainers — generate the current month's invoice for an active retainer from
  the dashboard.
- Time tracking — log hours against hourly projects and roll unbilled time into
  an invoice; cancelling that invoice releases the hours again.
- Expenses and taxes — categorized expenses, deductible flags, and a running 25%
  tax set-aside.
- Documents and templates — a vault of MSA/NDA/SOW/Proposal templates with
  variable substitution and a markdown editor (live preview + branded PDF export).
- `@`-mention linking — type `@` in the document and proposal editors to link
  clients, projects, proposals, invoices, and documents inline.
- Toolbox — customizable quick links to the consoles, dashboards, and docs you
  use, grouped by category.

**Command center**
- A dashboard with cash-flow trends, YTD income/profit/margin, outstanding and
  overdue totals, unbilled time, retainer MRR, and top clients.
- A ⌘K command palette to navigate and run actions from the keyboard.
- Branding — your logo and brand color flow onto invoices, proposals, documents,
  and the app shell (white-label sidebar).
- First-run onboarding and one-click sample data (loads a realistic demo
  practice; clears without touching real data).

**Platform**
- Local-first PWA — installable, offline-capable, data in IndexedDB (Dexie);
  hash routing so it works with no server.
- Native desktop build via Tauri v2 (optional/deferred; see ADR 0001).
- Backup and restore — one-click JSON export/import covering every entity.
- Custom date pickers, phone-number input masking, and an accessibility pass
  (focus management, skip link, keyboard navigation, labeled controls).
- Opt-in GitHub integration (off by default) for surfacing repo activity.

### Security

- Opt-in at-rest encryption of the live database (tweetnacl field encryption +
  PBKDF2 passphrase app-lock). Sensitive content and identities are stored as
  ciphertext while the structural graph stays queryable. There is no passphrase
  recovery — keep a backup.
- Encrypted backups — passphrase-protected JSON export/import (AES-256-GCM), in
  addition to plain export.
- No telemetry and no network calls for your data.
