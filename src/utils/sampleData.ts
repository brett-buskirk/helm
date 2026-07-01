import type { Table } from 'dexie';
import { db } from '../db';
import type { Invoice, InvoiceLineItem } from '../types';

/**
 * Sample / demo data.
 *
 * Every seeded record carries `isDemo: true`. Real records the user creates
 * never have the flag, so {@link clearDemoData} can remove the entire demo graph
 * while leaving the user's own data untouched and orphan-free — the demo graph
 * only ever references itself.
 *
 * Settings (the business profile + invoice numbering) is intentionally NOT
 * touched: seeding uses its own invoice numbers and never bumps the user's
 * counter, so loading/clearing demo data leaves the user's configuration alone.
 */

const DEMO = { isDemo: true as const };

/** Tables that hold demo-flaggable records, in safe clear order. */
const demoTables: Table[] = [
  db.timeEntries,
  db.payments,
  db.invoices,
  db.proposals,
  db.documents,
  db.expenses,
  db.projects,
  db.clients,
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function daysAgo(n: number, base = new Date()): Date {
  const d = new Date(base);
  d.setDate(d.getDate() - n);
  return d;
}

/** First day of the month `n` months before now (n=0 → this month). */
function monthStart(n: number, base = new Date()): Date {
  return new Date(base.getFullYear(), base.getMonth() - n, 1);
}

function lineItem(description: string, quantity: number, unitPrice: number): InvoiceLineItem {
  return { description, quantity, unitPrice, amount: round2(quantity * unitPrice) };
}

/**
 * Insert one record and return its generated id. Dexie types an auto-increment
 * key as `number | undefined` (because `id?` is optional); for a fresh insert
 * the key is always defined, so we narrow it here for use as a foreign key.
 */
async function insert(table: Table, record: object): Promise<number> {
  return (await table.add(record as never)) as number;
}

interface InvoiceSeed {
  clientId: number;
  projectId?: number;
  invoiceNumber: string;
  status: 'draft' | 'sent' | 'paid';
  issueDate: Date;
  dueDate: Date;
  items: InvoiceLineItem[];
  amountPaid?: number;
  paymentTerms?: string;
}

function buildInvoice(seed: InvoiceSeed): Omit<Invoice, 'id'> {
  const subtotal = round2(seed.items.reduce((s, li) => s + li.amount, 0));
  const total = subtotal; // demo invoices carry no client-facing sales tax
  const amountPaid = seed.status === 'paid' ? total : seed.amountPaid ?? 0;
  return {
    ...DEMO,
    clientId: seed.clientId,
    projectId: seed.projectId,
    invoiceNumber: seed.invoiceNumber,
    status: seed.status,
    issueDate: seed.issueDate,
    dueDate: seed.dueDate,
    lineItems: seed.items,
    subtotal,
    taxRate: 0,
    taxAmount: 0,
    total,
    amountPaid,
    balanceDue: round2(Math.max(0, total - amountPaid)),
    paymentTerms: seed.paymentTerms ?? 'Net 30',
    createdAt: seed.issueDate,
    updatedAt: seed.issueDate,
  };
}

/** Count of demo records across all tables (for status display). */
export async function countDemoData(): Promise<number> {
  const counts = await Promise.all(
    demoTables.map((t) => t.filter((r) => r.isDemo === true).count()),
  );
  return counts.reduce((a, b) => a + b, 0);
}

export async function hasDemoData(): Promise<boolean> {
  // Clients are always present in a seed, so this short-circuits cheaply.
  return (await db.clients.filter((c) => c.isDemo === true).count()) > 0;
}

/** Delete every demo-flagged record across all tables. Returns the count removed. */
export async function clearDemoData(): Promise<number> {
  let removed = 0;
  await db.transaction('rw', demoTables, async () => {
    for (const table of demoTables) {
      removed += await table.filter((r) => r.isDemo === true).delete();
    }
  });
  return removed;
}

/**
 * Seed a realistic ~6-month consulting practice: platform/DevOps engagements
 * (observability, cloud foundation, CI/CD, migrations) plus a teaching course
 * and an app-build, with proposals, invoices, payments, expenses, time, and
 * documents wired together. No-op-safe: throws if demo data already exists.
 */
export async function loadSampleData(): Promise<void> {
  if (await hasDemoData()) {
    throw new Error('Sample data is already loaded.');
  }

  // ── Clients ────────────────────────────────────────────────────────────────
  const northwind = await insert(db.clients, {
    ...DEMO, company: 'Northwind Robotics', contactName: 'Priya Anand',
    email: 'priya@northwindrobotics.com', phone: '(415) 555-0142',
    address: '2200 Bryant St, San Francisco, CA 94110', defaultRate: 165,
    status: 'active', notes: 'Series A robotics startup. Runs ~30 services on DO; wanted real observability before scaling the fleet.',
    createdAt: monthStart(4), updatedAt: daysAgo(3),
  });
  const lumen = await insert(db.clients, {
    ...DEMO, company: 'Lumen Health', contactName: 'Marcus Reed',
    email: 'marcus@lumenhealth.io', phone: '(617) 555-0188',
    address: '88 Kendall Sq, Cambridge, MA 02139', defaultRate: 175,
    status: 'active', notes: 'Healthtech; needed HIPAA-minded VPC + IaC foundation before their first enterprise customer.',
    createdAt: monthStart(3), updatedAt: daysAgo(12),
  });
  const cedarOak = await insert(db.clients, {
    ...DEMO, company: 'Cedar & Oak Goods', contactName: 'Dana Whitfield',
    email: 'dana@cedarandoak.com', phone: '(503) 555-0117',
    address: '410 SE Morrison St, Portland, OR 97214', defaultRate: 150,
    status: 'active', notes: 'DTC home goods. Moved off a slow WordPress/Elementor stack onto static Astro.',
    createdAt: monthStart(3), updatedAt: daysAgo(40),
  });
  const polaris = await insert(db.clients, {
    ...DEMO, company: 'Polaris Fintech', contactName: 'Sofia Marchetti',
    email: 'sofia@polarisfin.com', phone: '(212) 555-0173',
    address: '120 Broadway, New York, NY 10271', defaultRate: 185,
    status: 'active', notes: 'Payments startup. Manual deploys were causing incidents — wanted a real CI/CD pipeline.',
    createdAt: monthStart(2), updatedAt: daysAgo(20),
  });
  const trailhead = await insert(db.clients, {
    ...DEMO, company: 'Trailhead Outdoors', contactName: 'Cole Berman',
    email: 'cole@trailheadoutdoors.co', phone: '(720) 555-0155',
    address: '1500 Pearl St, Boulder, CO 80302', defaultRate: 160,
    status: 'lead', notes: 'Inbound from the site. Wants Terraform/Ansible adoption; proposal out, deciding.',
    createdAt: daysAgo(14), updatedAt: daysAgo(10),
  });
  const meridian = await insert(db.clients, {
    ...DEMO, company: 'Meridian Labs', contactName: 'Helen Fitzgerald',
    email: 'helen@meridianlabs.dev', phone: '(206) 555-0129',
    address: '500 Yale Ave N, Seattle, WA 98109', defaultRate: 170,
    status: 'past', notes: 'Completed cloud foundation buildout. Good reference; revisit for observability later.',
    createdAt: monthStart(5), updatedAt: monthStart(2),
  });
  const brightpath = await insert(db.clients, {
    ...DEMO, company: 'Brightpath Academy', contactName: 'Renee Park',
    email: 'renee@brightpath.academy', phone: '(312) 555-0164',
    address: '233 S Wacker Dr, Chicago, IL 60606', defaultRate: 150,
    status: 'active', notes: 'Coding bootcamp. Hourly engagement teaching a live DevOps fundamentals course.',
    createdAt: monthStart(2), updatedAt: daysAgo(4),
  });
  const onsen = await insert(db.clients, {
    ...DEMO, company: 'Onsen Apps', contactName: 'Theo Nakamura',
    email: 'theo@onsenapps.com', phone: '(808) 555-0190',
    address: '1050 Ala Moana Blvd, Honolulu, HI 96814', defaultRate: 160,
    status: 'active', notes: 'Small studio. Building out the backend + auth for a React app on an hourly basis.',
    createdAt: monthStart(1), updatedAt: daysAgo(2),
  });
  const atlas = await insert(db.clients, {
    ...DEMO, company: 'Atlas Freight', contactName: 'Gabriel Santos',
    email: 'gabriel@atlasfreight.io', phone: '(469) 555-0136',
    address: '1700 Pacific Ave, Dallas, TX 75201', defaultRate: 180,
    status: 'active', notes: 'Logistics SaaS. Setting up an agentic dev workflow (CLAUDE.md, guardrails, AgentGate) for their team.',
    createdAt: monthStart(1), updatedAt: daysAgo(6),
  });
  const keystone = await insert(db.clients, {
    ...DEMO, company: 'Keystone Software', contactName: 'Iris Donnelly',
    email: 'iris@keystonesw.com', phone: '(303) 555-0148',
    address: '1900 16th St, Denver, CO 80202', defaultRate: 185,
    status: 'active', notes: 'Mid-size product team adopting AI coding agents. Wanted governance + guardrails (AgentGate) and hands-on training before rolling agents out widely.',
    createdAt: monthStart(1), updatedAt: daysAgo(5),
  });

  // ── Projects ───────────────────────────────────────────────────────────────
  const pNorthwind = await insert(db.projects, {
    ...DEMO, clientId: northwind, name: 'Observability Retainer', type: 'retainer',
    status: 'active', startDate: monthStart(3), rate: 3500,
    description: 'Ongoing platform support: Prometheus/Grafana/Loki upkeep, alert tuning, on-call runbook updates, monthly reliability review.',
    links: [
      { label: 'Infra repo', url: 'https://github.com/northwind-robotics/infra' },
      { label: 'Grafana', url: 'https://grafana.northwindrobotics.com' },
    ],
    createdAt: monthStart(3), updatedAt: daysAgo(3),
  });
  const pLumen = await insert(db.projects, {
    ...DEMO, clientId: lumen, name: 'Cloud Foundation — VPC + Terraform', type: 'fixed',
    status: 'active', startDate: monthStart(3), rate: 12000,
    description: 'Greenfield DigitalOcean VPC managed via Terraform + Ansible, hardened networking, secrets handling, and a Tailscale-only management plane.',
    links: [
      { label: 'Terraform repo', url: 'https://github.com/lumen-health/infra' },
      { label: 'PR #42 — VPC firewall', url: 'https://github.com/lumen-health/infra/pull/42' },
    ],
    createdAt: monthStart(3), updatedAt: daysAgo(12),
  });
  const pCedar = await insert(db.projects, {
    ...DEMO, clientId: cedarOak, name: 'WordPress → Astro Migration', type: 'fixed',
    status: 'completed', startDate: monthStart(3), endDate: daysAgo(38), rate: 7500,
    description: 'Full content migration off WordPress/Elementor to a custom Astro static site with Tailwind, image optimization, and GitOps deploys.',
    createdAt: monthStart(3), updatedAt: daysAgo(38),
  });
  const pPolaris = await insert(db.projects, {
    ...DEMO, clientId: polaris, name: 'CI/CD Pipeline — GitHub Actions', type: 'fixed',
    status: 'active', startDate: monthStart(1), rate: 9000,
    description: 'Commit-to-deploy pipeline on GitHub Actions: typecheck, tests, build, container publish, and gated production deploys with rollbacks.',
    createdAt: monthStart(1), updatedAt: daysAgo(20),
  });
  const pMeridian = await insert(db.projects, {
    ...DEMO, clientId: meridian, name: 'Cloud Foundation Buildout', type: 'fixed',
    status: 'completed', startDate: monthStart(5), endDate: monthStart(2), rate: 10000,
    description: 'Initial production environment: VPC, droplet fleet via Terraform, baseline monitoring, and a documented deploy process.',
    createdAt: monthStart(5), updatedAt: monthStart(2),
  });
  const pBrightpath = await insert(db.projects, {
    ...DEMO, clientId: brightpath, name: 'DevOps Fundamentals — Course Instruction', type: 'hourly',
    status: 'active', startDate: monthStart(2), rate: 150,
    description: 'Live cohort instruction: Linux, containers, CI/CD, IaC, and observability. Weekly sessions plus office hours and assignment review.',
    createdAt: monthStart(2), updatedAt: daysAgo(4),
  });
  const pOnsen = await insert(db.projects, {
    ...DEMO, clientId: onsen, name: 'React App — Backend & Auth', type: 'hourly',
    status: 'active', startDate: monthStart(1), rate: 160,
    description: 'API layer, authentication, and deployment for a React/TypeScript app. Billed hourly against a rolling scope.',
    createdAt: monthStart(1), updatedAt: daysAgo(2),
  });
  const pAtlas = await insert(db.projects, {
    ...DEMO, clientId: atlas, name: 'Agentic Dev Workflow Setup', type: 'fixed',
    status: 'active', startDate: monthStart(1), rate: 8000,
    description: 'CLAUDE.md handoff specs, context + guardrail conventions, and AgentGate wired into CI so AI-agent PRs are safe to merge.',
    createdAt: monthStart(1), updatedAt: daysAgo(6),
  });
  const pKeystone = await insert(db.projects, {
    ...DEMO, clientId: keystone, name: 'AI Coding Agent Governance & Enablement', type: 'fixed',
    status: 'active', startDate: monthStart(1), rate: 11000,
    description: 'Responsible AI-agent adoption: a governance policy (review, scope, secrets, attribution), AgentGate wired into CI as a merge gate, and a hands-on team training workshop.',
    links: [
      { label: 'App repo', url: 'https://github.com/keystone-sw/platform' },
      { label: 'AgentGate', url: 'https://github.com/marketplace/actions/agentgate-ai-pr-guardrails' },
    ],
    createdAt: monthStart(1), updatedAt: daysAgo(5),
  });

  // ── Proposals (every status) ────────────────────────────────────────────────
  await db.proposals.bulkAdd([
    {
      ...DEMO, clientId: trailhead, title: 'IaC Adoption — Terraform + Ansible',
      scope: 'Codify existing hand-built infrastructure as Terraform, add Ansible for configuration management, and establish a reviewed change workflow.',
      deliverables: 'Terraform modules for current prod, Ansible playbooks, remote state, a PR-based change process, and a half-day handoff session.',
      pricing: 14000, pricingNote: '50% to start, 50% on completion', validUntil: daysAgo(-20),
      status: 'sent', notes: 'Sent after the intro call. Following up next week.',
      createdAt: daysAgo(10), updatedAt: daysAgo(10),
    },
    {
      ...DEMO, clientId: polaris, projectId: pPolaris, title: 'CI/CD Pipeline — GitHub Actions',
      scope: 'Design and build a commit-to-deploy pipeline with automated checks and gated production releases.',
      deliverables: 'GitHub Actions workflows, containerized build/publish, staging + prod environments, rollback runbook.',
      pricing: 9000, pricingNote: '50% deposit, 50% on delivery', validUntil: daysAgo(-5),
      status: 'accepted', notes: 'Accepted — kicked off and invoiced the deposit.',
      createdAt: monthStart(1), updatedAt: daysAgo(22),
    },
    {
      ...DEMO, clientId: atlas, projectId: pAtlas, title: 'Agentic Dev Workflow Setup',
      scope: 'Stand up an agentic development workflow: handoff specs, guardrail conventions, and automated PR review for AI-generated changes.',
      deliverables: 'CLAUDE.md templates, context conventions, AgentGate configured in CI, and a team enablement session.',
      pricing: 8000, pricingNote: '50% deposit, 50% on completion', validUntil: daysAgo(-12),
      status: 'accepted', createdAt: monthStart(1), updatedAt: daysAgo(8),
    },
    {
      ...DEMO, clientId: keystone, projectId: pKeystone, title: 'AI Coding Agent Governance & Enablement',
      scope: 'Establish responsible-use governance for AI coding agents and enable the team to adopt them safely.',
      deliverables: 'Governance policy + PR conventions, AgentGate configured as a CI merge gate, and a half-day hands-on training workshop.',
      pricing: 11000, pricingNote: '50% deposit, 50% on completion', validUntil: daysAgo(-18),
      status: 'accepted', notes: 'Accepted — governance + AgentGate underway, workshop scheduled.',
      createdAt: monthStart(1), updatedAt: daysAgo(7),
    },
    {
      ...DEMO, clientId: cedarOak, title: 'Observability Add-on',
      scope: 'Add Prometheus/Grafana/Loki monitoring to the newly migrated site and supporting services.',
      deliverables: 'Metrics, dashboards, log aggregation, and basic alerting.',
      pricing: 4500, pricingNote: 'Fixed fee', validUntil: daysAgo(15),
      status: 'declined', notes: 'Passed for now — said maybe next quarter.',
      createdAt: daysAgo(50), updatedAt: daysAgo(30),
    },
    {
      ...DEMO, clientId: onsen, projectId: pOnsen, title: 'Phase 2 — Mobile App Backend',
      scope: 'Extend the backend to support the upcoming React Native mobile client.',
      deliverables: 'Draft — scoping in progress.',
      pricing: 0, status: 'draft', notes: 'Rough draft; still scoping with Theo.',
      createdAt: daysAgo(5), updatedAt: daysAgo(5),
    },
  ]);

  // ── Invoices + payments ──────────────────────────────────────────────────────
  async function addInvoice(seed: InvoiceSeed, payment?: { amount: number; date: Date; method: string }) {
    const id = (await db.invoices.add(buildInvoice(seed) as Invoice)) as number;
    if (payment) {
      await db.payments.add({
        ...DEMO, invoiceId: id, clientId: seed.clientId, amount: payment.amount,
        date: payment.date, method: payment.method, createdAt: payment.date,
      });
    }
    return id;
  }

  // Northwind retainer — two paid months + the current month outstanding
  await addInvoice(
    { clientId: northwind, projectId: pNorthwind, invoiceNumber: 'INV-1201', status: 'paid',
      issueDate: monthStart(2), dueDate: daysAgo(-1, monthStart(2)),
      items: [lineItem('Monthly Retainer — Observability Retainer', 1, 3500)] },
    { amount: 3500, date: daysAgo(8, monthStart(2)), method: 'ACH' },
  );
  await addInvoice(
    { clientId: northwind, projectId: pNorthwind, invoiceNumber: 'INV-1208', status: 'paid',
      issueDate: monthStart(1), dueDate: daysAgo(-1, monthStart(1)),
      items: [lineItem('Monthly Retainer — Observability Retainer', 1, 3500)] },
    { amount: 3500, date: daysAgo(6, monthStart(1)), method: 'ACH' },
  );
  await addInvoice(
    { clientId: northwind, projectId: pNorthwind, invoiceNumber: 'INV-1215', status: 'sent',
      issueDate: monthStart(0), dueDate: daysAgo(-25, monthStart(0)),
      items: [lineItem('Monthly Retainer — Observability Retainer', 1, 3500)] },
  );

  // Lumen — deposit paid, final overdue
  await addInvoice(
    { clientId: lumen, projectId: pLumen, invoiceNumber: 'INV-1203', status: 'paid',
      issueDate: daysAgo(70), dueDate: daysAgo(40),
      items: [lineItem('Cloud Foundation — VPC + Terraform (50% deposit)', 1, 6000)] },
    { amount: 6000, date: daysAgo(58), method: 'Wire' },
  );
  await addInvoice(
    { clientId: lumen, projectId: pLumen, invoiceNumber: 'INV-1212', status: 'sent',
      issueDate: daysAgo(40), dueDate: daysAgo(10), // past due → overdue
      items: [lineItem('Cloud Foundation — VPC + Terraform (final 50%)', 1, 6000)] },
  );

  // Cedar & Oak — migration, paid
  await addInvoice(
    { clientId: cedarOak, projectId: pCedar, invoiceNumber: 'INV-1206', status: 'paid',
      issueDate: daysAgo(45), dueDate: daysAgo(15),
      items: [lineItem('WordPress → Astro Migration (fixed fee)', 1, 7500)] },
    { amount: 7500, date: daysAgo(22), method: 'ACH' },
  );

  // Polaris — deposit paid, remainder draft
  await addInvoice(
    { clientId: polaris, projectId: pPolaris, invoiceNumber: 'INV-1210', status: 'paid',
      issueDate: daysAgo(21), dueDate: daysAgo(-9),
      items: [lineItem('CI/CD Pipeline — GitHub Actions (50% deposit)', 1, 4500)] },
    { amount: 4500, date: daysAgo(14), method: 'Credit Card' },
  );
  await addInvoice(
    { clientId: polaris, projectId: pPolaris, invoiceNumber: 'INV-1216', status: 'draft',
      issueDate: daysAgo(2), dueDate: daysAgo(-28),
      items: [lineItem('CI/CD Pipeline — GitHub Actions (final 50%)', 1, 4500)] },
  );

  // Meridian — completed engagement, paid
  await addInvoice(
    { clientId: meridian, projectId: pMeridian, invoiceNumber: 'INV-1190', status: 'paid',
      issueDate: monthStart(3), dueDate: daysAgo(-1, monthStart(3)),
      items: [lineItem('Cloud Foundation Buildout (fixed fee)', 1, 10000)] },
    { amount: 10000, date: daysAgo(5, monthStart(2)), method: 'Wire' },
  );

  // Atlas — agentic workflow deposit, paid
  await addInvoice(
    { clientId: atlas, projectId: pAtlas, invoiceNumber: 'INV-1214', status: 'paid',
      issueDate: daysAgo(18), dueDate: daysAgo(-12),
      items: [lineItem('Agentic Dev Workflow Setup (50% deposit)', 1, 4000)] },
    { amount: 4000, date: daysAgo(11), method: 'ACH' },
  );

  // Keystone — AI governance & enablement deposit, paid
  await addInvoice(
    { clientId: keystone, projectId: pKeystone, invoiceNumber: 'INV-1213', status: 'paid',
      issueDate: daysAgo(16), dueDate: daysAgo(-14),
      items: [lineItem('AI Coding Agent Governance & Enablement (50% deposit)', 1, 5500)] },
    { amount: 5500, date: daysAgo(9), method: 'ACH' },
  );

  // ── Time entries (hourly clients) + the invoice they were billed into ─────────
  // Brightpath — 4 billed (into a paid invoice) + 3 unbilled
  const brightpathInvoiceId = await addInvoice(
    { clientId: brightpath, projectId: pBrightpath, invoiceNumber: 'INV-1211', status: 'paid',
      issueDate: daysAgo(21), dueDate: daysAgo(-9),
      items: [
        lineItem(`${daysAgo(38).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — Cohort session: Linux & containers`, 3, 150),
        lineItem(`${daysAgo(33).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — Cohort session: CI/CD`, 3, 150),
        lineItem(`${daysAgo(31).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — Office hours + assignment review`, 2, 150),
        lineItem(`${daysAgo(26).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — Cohort session: IaC`, 3, 150),
      ] },
    { amount: 1650, date: daysAgo(14), method: 'ACH' },
  );
  await db.timeEntries.bulkAdd([
    { ...DEMO, clientId: brightpath, projectId: pBrightpath, date: daysAgo(38), hours: 3, description: 'Cohort session: Linux & containers', billable: true, invoiceId: brightpathInvoiceId, createdAt: daysAgo(38), updatedAt: daysAgo(38) },
    { ...DEMO, clientId: brightpath, projectId: pBrightpath, date: daysAgo(33), hours: 3, description: 'Cohort session: CI/CD', billable: true, invoiceId: brightpathInvoiceId, createdAt: daysAgo(33), updatedAt: daysAgo(33) },
    { ...DEMO, clientId: brightpath, projectId: pBrightpath, date: daysAgo(31), hours: 2, description: 'Office hours + assignment review', billable: true, invoiceId: brightpathInvoiceId, createdAt: daysAgo(31), updatedAt: daysAgo(31) },
    { ...DEMO, clientId: brightpath, projectId: pBrightpath, date: daysAgo(26), hours: 3, description: 'Cohort session: IaC', billable: true, invoiceId: brightpathInvoiceId, createdAt: daysAgo(26), updatedAt: daysAgo(26) },
    // Unbilled — ready to invoice
    { ...DEMO, clientId: brightpath, projectId: pBrightpath, date: daysAgo(12), hours: 3, description: 'Cohort session: observability', billable: true, createdAt: daysAgo(12), updatedAt: daysAgo(12) },
    { ...DEMO, clientId: brightpath, projectId: pBrightpath, date: daysAgo(7), hours: 2, description: 'Office hours + grading', billable: true, createdAt: daysAgo(7), updatedAt: daysAgo(7) },
    { ...DEMO, clientId: brightpath, projectId: pBrightpath, date: daysAgo(2), hours: 3, description: 'Cohort session: capstone review', billable: true, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  ]);

  // Onsen — all unbilled (a clean "ready to generate an invoice" scenario)
  await db.timeEntries.bulkAdd([
    { ...DEMO, clientId: onsen, projectId: pOnsen, date: daysAgo(16), hours: 4, description: 'Auth service: sessions + refresh tokens', billable: true, createdAt: daysAgo(16), updatedAt: daysAgo(16) },
    { ...DEMO, clientId: onsen, projectId: pOnsen, date: daysAgo(13), hours: 5, description: 'API: project + task endpoints', billable: true, createdAt: daysAgo(13), updatedAt: daysAgo(13) },
    { ...DEMO, clientId: onsen, projectId: pOnsen, date: daysAgo(9), hours: 3.5, description: 'CI + preview deploys on the app repo', billable: true, createdAt: daysAgo(9), updatedAt: daysAgo(9) },
    { ...DEMO, clientId: onsen, projectId: pOnsen, date: daysAgo(4), hours: 4, description: 'Rate limiting + integration tests', billable: true, createdAt: daysAgo(4), updatedAt: daysAgo(4) },
  ]);

  // ── Expenses across categories + months ──────────────────────────────────────
  await db.expenses.bulkAdd([
    { ...DEMO, date: daysAgo(3), vendor: 'DigitalOcean', category: 'Software & Subscriptions', amount: 142.5, deductible: true, billable: false, createdAt: daysAgo(3), updatedAt: daysAgo(3), notes: 'Droplets + Spaces (current month)' },
    { ...DEMO, date: daysAgo(33), vendor: 'DigitalOcean', category: 'Software & Subscriptions', amount: 138.2, deductible: true, billable: false, createdAt: daysAgo(33), updatedAt: daysAgo(33) },
    { ...DEMO, date: daysAgo(63), vendor: 'DigitalOcean', category: 'Software & Subscriptions', amount: 129.9, deductible: true, billable: false, createdAt: daysAgo(63), updatedAt: daysAgo(63) },
    { ...DEMO, date: daysAgo(6), vendor: 'GitHub', category: 'Software & Subscriptions', amount: 21, deductible: true, billable: false, createdAt: daysAgo(6), updatedAt: daysAgo(6), notes: 'Team plan' },
    { ...DEMO, date: daysAgo(9), vendor: 'Grafana Cloud', category: 'Software & Subscriptions', amount: 49, deductible: true, billable: true, clientId: northwind, projectId: pNorthwind, createdAt: daysAgo(9), updatedAt: daysAgo(9), notes: 'Pass-through for Northwind dashboards' },
    { ...DEMO, date: daysAgo(18), vendor: 'Tailscale', category: 'Software & Subscriptions', amount: 18, deductible: true, billable: false, createdAt: daysAgo(18), updatedAt: daysAgo(18) },
    { ...DEMO, date: daysAgo(27), vendor: 'Terraform Cloud (HashiCorp)', category: 'Software & Subscriptions', amount: 20, deductible: true, billable: false, createdAt: daysAgo(27), updatedAt: daysAgo(27) },
    { ...DEMO, date: daysAgo(58), vendor: 'Apple', category: 'Hardware & Equipment', amount: 2399, deductible: true, billable: false, createdAt: daysAgo(58), updatedAt: daysAgo(58), notes: 'MacBook Pro 14" — primary dev machine' },
    { ...DEMO, date: daysAgo(52), vendor: 'Dell', category: 'Hardware & Equipment', amount: 389.99, deductible: true, billable: false, createdAt: daysAgo(52), updatedAt: daysAgo(52), notes: '27" monitor' },
    { ...DEMO, date: daysAgo(74), vendor: 'CNCF', category: 'Professional Development', amount: 750, deductible: true, billable: false, createdAt: daysAgo(74), updatedAt: daysAgo(74), notes: 'KubeCon registration' },
    { ...DEMO, date: daysAgo(72), vendor: 'United Airlines', category: 'Travel & Transportation', amount: 412.3, deductible: true, billable: false, createdAt: daysAgo(72), updatedAt: daysAgo(72), notes: 'KubeCon flight' },
    { ...DEMO, date: daysAgo(20), vendor: 'Namecheap', category: 'Software & Subscriptions', amount: 64.4, deductible: true, billable: false, createdAt: daysAgo(20), updatedAt: daysAgo(20), notes: 'Domain renewals' },
    { ...DEMO, date: daysAgo(15), vendor: 'Comcast Business', category: 'Utilities & Internet', amount: 95, deductible: true, billable: false, createdAt: daysAgo(15), updatedAt: daysAgo(15) },
    { ...DEMO, date: daysAgo(45), vendor: 'Comcast Business', category: 'Utilities & Internet', amount: 95, deductible: true, billable: false, createdAt: daysAgo(45), updatedAt: daysAgo(45) },
    { ...DEMO, date: daysAgo(30), vendor: 'Northstar CPA', category: 'Professional Services', amount: 450, deductible: true, billable: false, createdAt: daysAgo(30), updatedAt: daysAgo(30), notes: 'Quarterly bookkeeping + estimated taxes' },
  ]);

  // ── Documents: two templates + one generated SOW ─────────────────────────────
  await db.documents.bulkAdd([
    { ...DEMO, type: 'msa', title: 'Master Services Agreement (Template)', isTemplate: true,
      content: 'MASTER SERVICES AGREEMENT\n\nThis Agreement is between {{MY_BUSINESS}} and {{CLIENT_NAME}} ("Client")…\n\n1. SERVICES\n2. PAYMENT\n3. INTELLECTUAL PROPERTY\n4. CONFIDENTIALITY\n5. TERM & TERMINATION',
      createdAt: monthStart(4), updatedAt: monthStart(4) },
    { ...DEMO, type: 'nda', title: 'Mutual NDA (Template)', isTemplate: true,
      content: 'NON-DISCLOSURE AGREEMENT\n\nThis NDA is entered into between {{MY_BUSINESS}} and {{CLIENT_NAME}}…',
      createdAt: monthStart(4), updatedAt: monthStart(4) },
    { ...DEMO, type: 'sow', title: 'SOW — Cloud Foundation — Lumen Health', isTemplate: false,
      clientId: lumen, projectId: pLumen,
      content: 'STATEMENT OF WORK\n\nProject: Cloud Foundation — VPC + Terraform\nClient: Lumen Health\n\n1. SCOPE\nProvision a hardened DigitalOcean VPC via Terraform + Ansible…\n\n2. DELIVERABLES\n3. TIMELINE\n4. FEES — $12,000 (50% deposit, 50% on completion)',
      createdAt: daysAgo(72), updatedAt: daysAgo(70) },
  ]);
}
