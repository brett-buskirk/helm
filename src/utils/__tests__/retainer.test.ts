import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../db';
import type { Project } from '../../types';
import {
  buildRetainerInvoice,
  retainerPeriodLabel,
  findRetainerInvoiceForMonth,
  createRetainerInvoice,
} from '../retainer';

const baseProject: Project = {
  id: 7,
  clientId: 3,
  name: 'Acme Platform Ops',
  type: 'retainer',
  status: 'active',
  rate: 4000,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('retainerPeriodLabel', () => {
  it('formats a date as long month + full year', () => {
    expect(retainerPeriodLabel(new Date(2026, 6, 15))).toBe('July 2026');
    expect(retainerPeriodLabel(new Date(2026, 0, 1))).toBe('January 2026');
  });
});

describe('buildRetainerInvoice', () => {
  const issue = new Date(2026, 6, 1);

  it('builds a draft invoice with the monthly fee as the only line item', () => {
    const inv = buildRetainerInvoice(baseProject, 'INV-1005', issue);
    expect(inv.status).toBe('draft');
    expect(inv.lineItems).toHaveLength(1);
    expect(inv.lineItems[0].description).toBe('Monthly Retainer — Acme Platform Ops (July 2026)');
    expect(inv.lineItems[0].unitPrice).toBe(4000);
    expect(inv.lineItems[0].amount).toBe(4000);
  });

  it('carries client and project linkage', () => {
    const inv = buildRetainerInvoice(baseProject, 'INV-1005', issue);
    expect(inv.clientId).toBe(3);
    expect(inv.projectId).toBe(7);
    expect(inv.invoiceNumber).toBe('INV-1005');
  });

  it('defaults to 0% client-facing tax (set-aside is tracked separately)', () => {
    const inv = buildRetainerInvoice(baseProject, 'INV-1005', issue);
    expect(inv.taxRate).toBe(0);
    expect(inv.taxAmount).toBe(0);
    expect(inv.total).toBe(4000);
    expect(inv.balanceDue).toBe(4000);
  });

  it('treats a missing rate as zero', () => {
    const inv = buildRetainerInvoice({ ...baseProject, rate: undefined }, 'INV-1', issue);
    expect(inv.subtotal).toBe(0);
    expect(inv.total).toBe(0);
  });

  it('computes a due date 30 days out by default (Net 30)', () => {
    const inv = buildRetainerInvoice(baseProject, 'INV-1005', issue);
    // July 1 + 30 days = July 31
    expect(inv.dueDate.getMonth()).toBe(6);
    expect(inv.dueDate.getDate()).toBe(31);
  });
});

describe('findRetainerInvoiceForMonth / createRetainerInvoice', () => {
  beforeEach(async () => {
    await db.invoices.clear();
    await db.settings.clear();
    await db.settings.add({
      businessName: 'Test LLC',
      ownerName: 'Tester',
      address: '',
      email: '',
      paymentInstructions: '',
      defaultRate: 150,
      taxRate: 25,
      invoicePrefix: 'INV-',
      invoiceNextNumber: 1005,
      expenseCategories: [],
      updatedAt: new Date(),
    });
  });

  it('returns undefined when no invoice exists for the month', async () => {
    const found = await findRetainerInvoiceForMonth(7, new Date(2026, 6, 10));
    expect(found).toBeUndefined();
  });

  it('persists a draft invoice and increments the invoice number', async () => {
    const id = await createRetainerInvoice(baseProject, new Date(2026, 6, 1));
    const inv = await db.invoices.get(id);
    expect(inv?.invoiceNumber).toBe('INV-1005');
    expect(inv?.status).toBe('draft');
    expect(inv?.total).toBe(4000);

    const settings = await db.settings.limit(1).first();
    expect(settings?.invoiceNextNumber).toBe(1006);
  });

  it('finds the invoice it just created within the same month', async () => {
    await createRetainerInvoice(baseProject, new Date(2026, 6, 1));
    const found = await findRetainerInvoiceForMonth(7, new Date(2026, 6, 28));
    expect(found).toBeDefined();
    expect(found?.projectId).toBe(7);
  });

  it('does not match an invoice from a different month', async () => {
    await createRetainerInvoice(baseProject, new Date(2026, 6, 1));
    const found = await findRetainerInvoiceForMonth(7, new Date(2026, 7, 1));
    expect(found).toBeUndefined();
  });
});
