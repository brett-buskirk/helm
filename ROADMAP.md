# Roadmap

Helm is feature-complete across its planned phases (0–5): the connected client
hub, the proposal → SOW → invoice pipeline, invoicing with PDF export, time
tracking, expenses and the running tax set-aside, the document/template vault
with a markdown editor and @-mention linking, the ⌘K command palette, opt-in
at-rest encryption, encrypted backups, and the Tauri desktop build.

What's left is the path from a working daily-use tool to a tagged 1.0 release,
plus a short list of genuine automation nice-to-haves. Nothing here is a rewrite.

## Toward a 1.0 release

- [ ] Cut the first tagged release (`v1.0.0`) and start populating `CHANGELOG.md`
      with real dated sections.
- [ ] Produce signed, per-platform Tauri installers (macOS `.dmg`, Windows
      `.msi`/NSIS, Linux `.AppImage`/`.deb`) and attach them to the GitHub release.
- [ ] Wire installer packaging into CI so a tag push builds and publishes the
      bundles automatically.

## Automation & convenience (from the build brief, not yet built)

- [ ] **Recurring retainer invoices** — auto-generate the monthly invoice for an
      active retainer instead of the one-click dashboard action.
- [ ] **Overdue reminders** — surface and nudge on invoices past their due date.
- [ ] **CSV import for expenses** — the "sync later" path for pulling in bank/
      statement rows without a live bank API.

## Maintenance

- [ ] Keep dependencies current (React 19, Vite 6, Tailwind v4, Dexie v4, Tauri v2).
- [ ] Grow Vitest coverage and the Playwright e2e suite alongside new features.
- [ ] Hold the accessibility bar (focus management, labels, keyboard nav) as UI changes.
