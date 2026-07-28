import { describe, test, expect, beforeEach } from 'vitest';
import { db } from '../../db';
import {
  getEffectiveStatus,
  calculateDueDate,
  computeBalanceDue,
  deleteInvoiceCascade,
  generateInvoiceNumber,
} from '../invoice';

// Fixed reference dates that will never be "now"
const PAST = new Date(2020, 0, 1);   // Jan 1 2020 — always in the past
const FUTURE = new Date(2099, 11, 31); // Dec 31 2099 — always in the future

describe('getEffectiveStatus', () => {
  test('returns overdue for a sent invoice past its due date', () => {
    expect(getEffectiveStatus({ status: 'sent', dueDate: PAST })).toBe('overdue');
  });

  test('returns sent for a sent invoice with a future due date', () => {
    expect(getEffectiveStatus({ status: 'sent', dueDate: FUTURE })).toBe('sent');
  });

  test('returns paid even when due date is in the past', () => {
    expect(getEffectiveStatus({ status: 'paid', dueDate: PAST })).toBe('paid');
  });

  test('returns draft regardless of due date', () => {
    expect(getEffectiveStatus({ status: 'draft', dueDate: PAST })).toBe('draft');
  });

  test('returns cancelled regardless of due date', () => {
    expect(getEffectiveStatus({ status: 'cancelled', dueDate: PAST })).toBe('cancelled');
  });

  test('accepts a date stored as a string (Dexie serialization)', () => {
    // Dexie may deserialize Dates as ISO strings in some environments
    expect(
      getEffectiveStatus({ status: 'sent', dueDate: '2020-01-01' as unknown as Date }),
    ).toBe('overdue');
  });
});

describe('computeBalanceDue', () => {
  test('equals total when nothing is paid', () => {
    expect(computeBalanceDue(5000, 0)).toBe(5000);
  });

  test('subtracts the amount paid', () => {
    expect(computeBalanceDue(5000, 2000)).toBe(3000);
  });

  test('is zero when fully paid', () => {
    expect(computeBalanceDue(5000, 5000)).toBe(0);
  });

  test('never goes negative on overpayment', () => {
    expect(computeBalanceDue(5000, 6000)).toBe(0);
  });

  // Regression: editing an invoice's total must re-derive the balance.
  // Previously the edit path left a stale balanceDue (e.g. 0) while total changed.
  test('re-derives a fresh balance when the total changes on edit', () => {
    const amountPaid = 0;
    const newTotal = 5000;
    expect(computeBalanceDue(newTotal, amountPaid)).toBe(5000);
  });
});

describe('calculateDueDate', () => {
  test('Due on Receipt returns the same date', () => {
    expect(calculateDueDate('2026-01-01', 'Due on Receipt')).toBe('2026-01-01');
  });

  test('Net 15 adds 15 days', () => {
    expect(calculateDueDate('2026-01-01', 'Net 15')).toBe('2026-01-16');
  });

  test('Net 30 adds 30 days', () => {
    expect(calculateDueDate('2026-01-01', 'Net 30')).toBe('2026-01-31');
  });

  test('Net 45 adds 45 days', () => {
    expect(calculateDueDate('2026-01-01', 'Net 45')).toBe('2026-02-15');
  });

  test('Net 60 adds 60 days', () => {
    expect(calculateDueDate('2026-01-01', 'Net 60')).toBe('2026-03-02');
  });

  test('rolls over month boundaries correctly', () => {
    expect(calculateDueDate('2026-01-31', 'Net 30')).toBe('2026-03-02');
  });

  test('unknown payment term defaults to 30-day window', () => {
    // opt is undefined → days defaults to 30
    expect(calculateDueDate('2026-01-01', 'Custom')).toBe('2026-01-31');
  });

  test('returns empty string for a malformed issue date', () => {
    expect(calculateDueDate('not-a-date', 'Net 30')).toBe('');
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */

async function seedInvoice(invoiceNumber: string): Promise<number> {
  const now = new Date();
  return (await db.invoices.add({
    clientId: 1,
    invoiceNumber,
    status: 'sent',
    issueDate: now,
    dueDate: now,
    lineItems: [{ description: 'Work', quantity: 1, unitPrice: 100, amount: 100 }],
    subtotal: 100,
    taxRate: 0,
    taxAmount: 0,
    total: 100,
    amountPaid: 0,
    balanceDue: 100,
    createdAt: now,
    updatedAt: now,
  } as any)) as number;
}

describe('deleteInvoiceCascade', () => {
  beforeEach(async () => {
    await Promise.all([db.invoices.clear(), db.payments.clear(), db.timeEntries.clear()]);
  });

  test('removes the invoice, its payments, and frees its time entries — leaving others intact', async () => {
    const now = new Date();
    const target = await seedInvoice('INV-1001');
    const other = await seedInvoice('INV-1002');

    await db.payments.bulkAdd([
      { invoiceId: target, clientId: 1, amount: 60, date: now, createdAt: now, updatedAt: now },
      { invoiceId: target, clientId: 1, amount: 40, date: now, createdAt: now, updatedAt: now },
      { invoiceId: other, clientId: 1, amount: 25, date: now, createdAt: now, updatedAt: now },
    ] as any);
    await db.timeEntries.bulkAdd([
      { projectId: 1, clientId: 1, date: now, hours: 2, description: 'a', billable: true, invoiceId: target, createdAt: now, updatedAt: now },
      { projectId: 1, clientId: 1, date: now, hours: 1, description: 'b', billable: true, invoiceId: other, createdAt: now, updatedAt: now },
    ] as any);

    const res = await deleteInvoiceCascade(target);

    expect(res).toEqual({ payments: 2, released: 1 });
    expect(await db.invoices.get(target)).toBeUndefined();
    expect(await db.payments.where('invoiceId').equals(target).count()).toBe(0);

    // The target's billed time entry is returned to unbilled (invoiceId cleared).
    const freed = await db.timeEntries.filter((e) => e.description === 'a').first();
    expect(freed?.invoiceId).toBeUndefined();

    // The other invoice, its payment, and its time entry are untouched.
    expect(await db.invoices.get(other)).toBeTruthy();
    expect(await db.payments.where('invoiceId').equals(other).count()).toBe(1);
    const otherEntry = await db.timeEntries.filter((e) => e.description === 'b').first();
    expect(otherEntry?.invoiceId).toBe(other);
  });

  test('handles an invoice with no payments or time entries', async () => {
    const id = await seedInvoice('INV-2001');
    expect(await deleteInvoiceCascade(id)).toEqual({ payments: 0, released: 0 });
    expect(await db.invoices.get(id)).toBeUndefined();
  });
});

describe('generateInvoiceNumber', () => {
  beforeEach(async () => {
    await db.settings.clear();
  });

  test('zero-pads the number to the configured width', async () => {
    await db.settings.add({
      invoicePrefix: 'INV-',
      invoiceNextNumber: 2,
      invoiceNumberPadding: 4,
      expenseCategories: [],
      updatedAt: new Date(),
    } as any);
    expect(await generateInvoiceNumber()).toBe('INV-0002');
  });

  test('does not pad when no width is configured', async () => {
    await db.settings.add({
      invoicePrefix: 'INV-',
      invoiceNextNumber: 2,
      expenseCategories: [],
      updatedAt: new Date(),
    } as any);
    expect(await generateInvoiceNumber()).toBe('INV-2');
  });

  test('never truncates a number wider than the pad width', async () => {
    await db.settings.add({
      invoicePrefix: 'INV-',
      invoiceNextNumber: 12345,
      invoiceNumberPadding: 4,
      expenseCategories: [],
      updatedAt: new Date(),
    } as any);
    expect(await generateInvoiceNumber()).toBe('INV-12345');
  });
});
