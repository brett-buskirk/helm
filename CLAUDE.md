# Helm — Claude Code Build Brief
### A local-first operating system for an independent consulting practice

*Working name "Helm" (you're at the helm of your business) — placeholder, rename freely. Alternatives: Quartermaster, Cairn, Atlas. Use this document as the repo's initial `CLAUDE.md`.*

---

## What it is
A single-user, local-first desktop/PWA that runs your entire consulting back office — clients, projects, proposals, SOWs, invoices, expenses, taxes, and contract templates — in one connected place, shaped specifically around a solo technical consultant's workflow.

## Why build it (when Wave / FreshBooks / QuickBooks exist)
The market is full of generic invoicing and bookkeeping tools, and you'd never out-feature them. But none of them are shaped like *your* pipeline: proposal → SOW → deposit → milestones → retainer → tax set-aside, with contract templates and client context living in the same place. The value is the niche fit — this is your operating system, not a generic ledger. It also does double duty: a tool you use daily **and** a portfolio piece ("I built my own consulting ERP"), the same way AgentGate is both a product and proof.

## Constraints (decided)
- **Local-first, single-user.** No server, no auth, no cloud, no multi-tenancy. Data lives on your machine. (Massively simplifies the build.)
- **Desktop / PWA.** Installable, offline-capable.
- **Manual data entry.** No bank API, no Plaid, no CSV parsing required for v1 — simple forms, full control.
- **Whole pipeline, phased.** Design the complete data model up front so the pieces connect; build it in independently-useful slices.

## Tech stack (your wheelhouse — reuse what you know from Day One & OffGrid Ops)
- **React 19 + TypeScript + Vite**
- **Tailwind CSS**
- **Dexie.js** (IndexedDB) for persistence + **dexie-react-hooks** (`useLiveQuery`) for reactive data
- **vite-plugin-pwa** for installable/offline
- **react-router** for navigation
- **react-hook-form + zod** for forms + validation
- **@react-pdf/renderer** (or pdfmake) for generating invoices/documents as PDF
- **recharts** for the dashboard
- *Later/optional:* **Tauri** (Rust) to wrap as a true native desktop app with real filesystem access

## The core idea: one connected data model
Everything links to a **Client**. That's the differentiator — open a client and see their entire history (projects, proposals, contracts, invoices, money in and out) in one view. **Define this whole schema in Phase 0** even though features arrive over phases, so nothing needs re-architecting later.

**Entities (Dexie tables):**
- **Client** — company, contact, address, email, tax ID, default rate, status (lead/active/past), notes. *The hub.*
- **Project / Engagement** — belongs to a Client. Name, type (fixed / retainer / hourly), status, start/end, description.
- **Proposal** — belongs to Client/Project. Scope, deliverables, pricing, validity, status (draft/sent/accepted/declined). Converts → SOW.
- **Agreement (SOW)** — belongs to Project. Scope, deliverables, milestones, fees, payment schedule, references the MSA, status.
- **Invoice** — belongs to Client/Project. Line items (auto-calculating totals), deposit/milestone lines, dates, payment terms, status (draft/sent/paid/overdue).
- **Expense** — business expense, optionally tagged to a Client/Project (billable/pass-through). Date, vendor, category, amount, deductible flag, optional receipt attachment.
- **Income / Payment** — money received (usually against an invoice); feeds the books + tax set-aside.
- **Document / Template** — reusable contract templates (MSA, NDA, SOW, Proposal) + generated documents stored per client.
- **Settings** — business profile (Brett Buskirk LLC, EIN, address, payment instructions), default rate, tax %, invoice numbering, expense categories.

## Phased build plan (each phase independently useful)

**Phase 0 — Foundation.** Scaffold (React/TS/Vite/Tailwind/Dexie/PWA). Define the **complete Dexie schema** for all entities above. App shell + navigation. Settings/business profile. Base UI components (forms, tables, modals). **Backup/restore (JSON export + import) from day one** — see Data Safety.

**Phase 1 — Clients + Projects (the hub).** CRUD for clients and projects. The **client detail view** — the central screen everything else hangs off.

**Phase 2 — Invoicing.** Create/manage invoices linked to clients/projects; port the invoice template's auto-calculating logic (deposit/milestone lines, subtotal/tax/total, balance due); status tracking; **PDF export**. *(Your most immediate pain — live leads will need invoices soon.)*

**Phase 3 — Expenses + Tax set-aside.** Expense entry with categories + deductible flag; the bookkeeping ledger; dashboard metrics for income, expenses, profit, and the **running 25–30% tax set-aside**. *(Replaces the standalone spreadsheet idea, integrated.)*

**Phase 4 — Documents + Templates.** Contract/template vault (MSA, NDA, SOW, Proposal); generate filled documents from client/project data; store per client; PDF export. The proposal → SOW → invoice flow becomes click-through.

**Phase 5 — Command center + polish.** Unified dashboard (income MTD/QTD/YTD, outstanding/overdue invoices, expenses by category, profit, tax owed, retainer status); global search; retainer tracking; UX polish.

## Data safety (non-negotiable for local-first)
IndexedDB can be wiped (clearing browser data, a profile reset, etc.). So:
- **JSON export/import backup is a Phase 0 feature, not an afterthought.** One click to export everything to a file; one click to restore.
- Nudge periodic backups; consider auto-export on a schedule.
- This is the #1 thing that sinks local-first apps — treat it as core, not polish.
- *(The Tauri upgrade later gives real filesystem access for automatic, robust backups.)*

## Definition of Done (per phase)
A phase ships when its feature is fully usable end-to-end with data persisting in Dexie, reactive UI via `useLiveQuery`, validation on all forms, and backup/restore covering the new entities. The app stays installable as a PWA throughout.

## Roadmap (post-v1)
- **Tauri wrapper** — native desktop + automatic filesystem backups.
- **CSV import** for expenses (bank statement) — the "sync later" path.
- **Recurring invoices** for retainers; **overdue reminders**.
- Optional **time tracking** for hourly work.
- Encrypted backups.

## Portfolio framing
A personal tool first, but genuinely showcase-worthy: a local-first PWA with a real relational data model, document generation, and a clean dashboard. Write it up as "I built my own consulting ERP" — it pairs with AgentGate to show range (infra/agentic tooling *and* full-stack product). Keep real client data out of any screenshots.

## To decide / placeholders
- **Name** — "Helm" is a placeholder; pick one you like.
- **PDF library** — @react-pdf/renderer (more control) vs pdfmake (simpler) vs browser print-to-PDF for v1.
- **Tauri now or later** — recommend PWA first, Tauri as a Phase 6 upgrade.

---

## Working in this repo (provisioning note)

This repo was set up with guardrails **before** project work begins:

- **`main` is protected — no direct commits.** Work on a feature branch and open a PR via the `gh` CLI.
- **AgentGate runs on every PR** — `secrets` + `dangerous_patterns` block a merge; everything else (scope, diff size, tests, dependencies) is advisory. See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full policy and a note on the expected (non-blocking) warnings on the Phase 0 scaffold PR.
- The repo is **private**; the LLM intent check is off for now (enable later with an `ANTHROPIC_API_KEY` secret).

*(Added during repo provisioning — separate from the build brief above.)*
