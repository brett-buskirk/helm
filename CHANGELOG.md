# Changelog

All notable changes to helm are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

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
