import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../db';
import type { Client, Expense } from '../../types';
import { loadSampleData, clearDemoData, hasDemoData, countDemoData } from '../sampleData';

async function clearAll() {
  await Promise.all(db.tables.map((t) => t.clear()));
}

const demoFlaggableTables = [
  db.clients, db.projects, db.proposals, db.invoices,
  db.payments, db.expenses, db.timeEntries, db.documents,
];

describe('sample data', () => {
  beforeEach(clearAll);

  it('loads an interconnected dataset across all tables', async () => {
    await loadSampleData();
    expect(await hasDemoData()).toBe(true);
    expect((await db.clients.toArray()).length).toBeGreaterThanOrEqual(8);
    expect((await db.projects.toArray()).length).toBeGreaterThan(0);
    expect((await db.proposals.toArray()).length).toBeGreaterThan(0);
    expect((await db.invoices.toArray()).length).toBeGreaterThan(0);
    expect((await db.payments.toArray()).length).toBeGreaterThan(0);
    expect((await db.expenses.toArray()).length).toBeGreaterThan(0);
    expect((await db.timeEntries.toArray()).length).toBeGreaterThan(0);
    expect((await db.documents.toArray()).length).toBeGreaterThan(0);
  });

  it('flags every seeded record with isDemo', async () => {
    await loadSampleData();
    for (const table of demoFlaggableTables) {
      const rows = await table.toArray();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => (r as { isDemo?: boolean }).isDemo === true)).toBe(true);
    }
  });

  it('covers all invoice and proposal statuses (so the UI lights up)', async () => {
    await loadSampleData();
    const invoiceStatuses = new Set((await db.invoices.toArray()).map((i) => i.status));
    expect(invoiceStatuses).toContain('paid');
    expect(invoiceStatuses).toContain('sent');
    expect(invoiceStatuses).toContain('draft');
    const proposalStatuses = new Set((await db.proposals.toArray()).map((p) => p.status));
    expect(proposalStatuses).toContain('draft');
    expect(proposalStatuses).toContain('sent');
    expect(proposalStatuses).toContain('accepted');
    expect(proposalStatuses).toContain('declined');
  });

  it('keeps invoice money fields internally consistent', async () => {
    await loadSampleData();
    for (const inv of await db.invoices.toArray()) {
      const lineTotal = inv.lineItems.reduce((s, li) => s + li.amount, 0);
      expect(Math.round(inv.subtotal * 100)).toBe(Math.round(lineTotal * 100));
      expect(inv.balanceDue).toBe(Math.max(0, inv.total - inv.amountPaid));
      if (inv.status === 'paid') expect(inv.balanceDue).toBe(0);
    }
  });

  it('wires every foreign key within the demo graph (no dangling refs)', async () => {
    await loadSampleData();
    const clientIds = new Set((await db.clients.toArray()).map((c) => c.id));
    const projectIds = new Set((await db.projects.toArray()).map((p) => p.id));
    const invoiceIds = new Set((await db.invoices.toArray()).map((i) => i.id));

    for (const p of await db.projects.toArray()) expect(clientIds.has(p.clientId)).toBe(true);
    for (const inv of await db.invoices.toArray()) expect(clientIds.has(inv.clientId)).toBe(true);
    for (const pay of await db.payments.toArray()) {
      expect(invoiceIds.has(pay.invoiceId)).toBe(true);
      expect(clientIds.has(pay.clientId)).toBe(true);
    }
    for (const te of await db.timeEntries.toArray()) {
      expect(clientIds.has(te.clientId)).toBe(true);
      expect(projectIds.has(te.projectId)).toBe(true);
      if (te.invoiceId != null) expect(invoiceIds.has(te.invoiceId)).toBe(true);
    }
  });

  it('refuses to load a second time', async () => {
    await loadSampleData();
    await expect(loadSampleData()).rejects.toThrow(/already loaded/i);
  });

  it('clears only demo data, preserving the user\'s real records', async () => {
    const now = new Date();
    const realClient: Client = {
      company: 'Real Client Co', contactName: 'The User', email: 'user@real.co',
      status: 'active', createdAt: now, updatedAt: now,
    };
    const realClientId = await db.clients.add(realClient);
    const realExpense: Expense = {
      date: now, vendor: 'Real Vendor', category: 'Other', amount: 42,
      deductible: true, billable: false, createdAt: now, updatedAt: now,
    };
    await db.expenses.add(realExpense);

    await loadSampleData();
    const total = await countDemoData();
    expect(total).toBeGreaterThan(0);

    const removed = await clearDemoData();
    expect(removed).toBe(total);
    expect(await hasDemoData()).toBe(false);
    expect(await countDemoData()).toBe(0);

    // Real records untouched
    const clients = await db.clients.toArray();
    expect(clients).toHaveLength(1);
    expect(clients[0].id).toBe(realClientId);
    expect(clients[0].isDemo).toBeUndefined();
    expect(await db.expenses.count()).toBe(1);

    // Nothing demo-flagged remains in any table
    for (const table of db.tables) {
      const rows = await table.toArray();
      expect(rows.some((r) => (r as { isDemo?: boolean }).isDemo === true)).toBe(false);
    }
  });

  it('can be reloaded after clearing (round-trip)', async () => {
    await loadSampleData();
    await clearDemoData();
    await expect(loadSampleData()).resolves.toBeUndefined();
    expect(await hasDemoData()).toBe(true);
  });
});
