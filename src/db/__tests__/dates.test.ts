import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../index';
import {
  DATE_FIELDS,
  reviveDateFields,
  reviveBackupDates,
  countRowsWithStringDates,
  repairDateFields,
} from '../dates';

async function clearAll() {
  for (const name of Object.keys(DATE_FIELDS)) await db.table(name).clear();
}

beforeEach(clearAll);

describe('reviveDateFields', () => {
  it('converts ISO strings to Date for the listed fields only', () => {
    const row = reviveDateFields(
      { date: '2026-03-10T00:00:00.000Z', vendor: '2026-03-10', notes: 'hello' },
      ['date'],
    );
    expect(row.date).toBeInstanceOf(Date);
    expect((row.date as Date).toISOString()).toBe('2026-03-10T00:00:00.000Z');
    // `vendor` parses as a date but isn't a listed date field, so it's untouched
    expect(row.vendor).toBe('2026-03-10');
    expect(row.notes).toBe('hello');
  });

  it('leaves real Dates, nullish values, and unparseable strings alone', () => {
    const already = new Date('2026-01-01T00:00:00.000Z');
    const row = reviveDateFields(
      { date: already, nextDue: undefined, createdAt: 'not a date at all' },
      ['date', 'nextDue', 'createdAt'],
    );
    expect(row.date).toBe(already);
    expect(row.nextDue).toBeUndefined();
    expect(row.createdAt).toBe('not a date at all');
  });
});

describe('reviveBackupDates', () => {
  it('revives every known table and skips absent ones', () => {
    const data: Record<string, unknown> = {
      version: 3,
      expenses: [{ date: '2026-05-01T00:00:00.000Z', createdAt: '2026-05-01T00:00:00.000Z' }],
      invoices: [{ issueDate: '2026-06-01T00:00:00.000Z', dueDate: '2026-07-01T00:00:00.000Z' }],
      // timeEntries deliberately absent — older backups omit it
    };
    reviveBackupDates(data);

    const expense = (data.expenses as Record<string, unknown>[])[0];
    expect(expense.date).toBeInstanceOf(Date);
    expect(expense.createdAt).toBeInstanceOf(Date);
    const invoice = (data.invoices as Record<string, unknown>[])[0];
    expect(invoice.issueDate).toBeInstanceOf(Date);
    expect(invoice.dueDate).toBeInstanceOf(Date);
    expect(data.timeEntries).toBeUndefined();
  });

  it('tolerates a malformed payload without throwing', () => {
    const data: Record<string, unknown> = { expenses: 'not an array', clients: [null, 42] };
    expect(() => reviveBackupDates(data)).not.toThrow();
  });
});

describe('date-type corruption and repair', () => {
  /** A restored-from-JSON expense: dates arrive as ISO strings. */
  function restoredExpense(label: string, iso: string) {
    return {
      date: iso,
      vendor: label,
      category: 'Software & Subscriptions',
      amount: 10,
      deductible: true,
      billable: false,
      createdAt: iso,
      updatedAt: iso,
    } as never;
  }

  function typedExpense(label: string, iso: string) {
    return {
      date: new Date(iso),
      vendor: label,
      category: 'Software & Subscriptions',
      amount: 10,
      deductible: true,
      billable: false,
      createdAt: new Date(iso),
      updatedAt: new Date(iso),
    } as never;
  }

  it('orders correctly once repaired — the bug this module exists for', async () => {
    // Two rows restored from a backup, two created in-app afterwards.
    await db.expenses.bulkAdd([
      restoredExpense('restored-jan', '2026-01-15T00:00:00.000Z'),
      restoredExpense('restored-sep', '2026-09-01T00:00:00.000Z'),
      typedExpense('typed-mar', '2026-03-10T00:00:00.000Z'),
      typedExpense('typed-dec', '2026-12-25T00:00:00.000Z'),
    ]);

    // Before repair: IndexedDB orders by key TYPE first (date < string), so the
    // two Date rows sort as one run and the two string rows as another.
    const before = await db.expenses.orderBy('date').reverse().toArray();
    expect(before.map((e) => e.vendor)).toEqual([
      'restored-sep',
      'restored-jan',
      'typed-dec',
      'typed-mar',
    ]);

    expect(await countRowsWithStringDates()).toBe(2);
    expect(await repairDateFields()).toBe(2);
    expect(await countRowsWithStringDates()).toBe(0);

    const after = await db.expenses.orderBy('date').reverse().toArray();
    expect(after.map((e) => e.vendor)).toEqual([
      'typed-dec',
      'restored-sep',
      'typed-mar',
      'restored-jan',
    ]);
    for (const e of after) expect(e.date).toBeInstanceOf(Date);
  });

  it('is idempotent and a no-op on a healthy database', async () => {
    await db.expenses.bulkAdd([typedExpense('typed', '2026-04-01T00:00:00.000Z')]);
    expect(await countRowsWithStringDates()).toBe(0);
    expect(await repairDateFields()).toBe(0);
    expect(await repairDateFields()).toBe(0);
  });

  it('repairs across tables and preserves non-date fields', async () => {
    const iso = '2026-02-02T00:00:00.000Z';
    await db.expenses.bulkAdd([restoredExpense('acme', iso)]);
    await db.timeEntries.bulkAdd([
      { clientId: 1, projectId: 1, date: iso, hours: 2, description: 'work', billable: true, createdAt: iso, updatedAt: iso } as never,
    ]);
    await db.invoices.bulkAdd([
      { clientId: 1, invoiceNumber: 'INV-0001', status: 'draft', issueDate: iso, dueDate: iso, lineItems: [], subtotal: 0, taxRate: 0, taxAmount: 0, total: 0, amountPaid: 0, balanceDue: 0, createdAt: iso, updatedAt: iso } as never,
    ]);

    expect(await countRowsWithStringDates()).toBe(3);
    expect(await repairDateFields()).toBe(3);

    const expense = (await db.expenses.toArray())[0];
    expect(expense.date).toBeInstanceOf(Date);
    expect(expense.vendor).toBe('acme');
    expect(expense.amount).toBe(10);

    const entry = (await db.timeEntries.toArray())[0];
    expect(entry.date).toBeInstanceOf(Date);
    expect(entry.description).toBe('work');

    const invoice = (await db.invoices.toArray())[0];
    expect(invoice.issueDate).toBeInstanceOf(Date);
    expect(invoice.dueDate).toBeInstanceOf(Date);
    expect(invoice.invoiceNumber).toBe('INV-0001');
  });
});
