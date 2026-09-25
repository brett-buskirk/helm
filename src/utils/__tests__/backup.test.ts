import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db';
import { DATE_FIELDS } from '../../db/dates';
import { importData } from '../backup';

async function clearAll() {
  for (const name of Object.keys(DATE_FIELDS)) await db.table(name).clear();
}

beforeEach(clearAll);

/** Build a backup file exactly as `exportAllData` would: JSON.stringify'd rows. */
function backupFile(rows: Record<string, unknown>): File {
  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    version: 3,
    clients: [],
    projects: [],
    proposals: [],
    agreements: [],
    invoices: [],
    payments: [],
    expenses: [],
    documents: [],
    ...rows,
  });
  return new File([payload], 'helm-backup.json', { type: 'application/json' });
}

describe('importData', () => {
  it('restores dates as Date objects, not ISO strings', async () => {
    const file = backupFile({
      expenses: [
        {
          date: new Date('2026-05-01T00:00:00.000Z'),
          vendor: 'Acme',
          category: 'Software & Subscriptions',
          amount: 42,
          deductible: true,
          billable: false,
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
          updatedAt: new Date('2026-05-01T00:00:00.000Z'),
        },
      ],
    });

    await importData(file);

    const [expense] = await db.expenses.toArray();
    expect(expense.vendor).toBe('Acme');
    expect(expense.date).toBeInstanceOf(Date);
    expect(expense.createdAt).toBeInstanceOf(Date);
    expect((expense.date as Date).toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('keeps date-ordered queries chronological after a restore', async () => {
    const mk = (vendor: string, iso: string) => ({
      date: new Date(iso),
      vendor,
      category: 'Other',
      amount: 1,
      deductible: true,
      billable: false,
      createdAt: new Date(iso),
      updatedAt: new Date(iso),
    });

    await importData(
      backupFile({
        expenses: [
          mk('jan', '2026-01-15T00:00:00.000Z'),
          mk('dec', '2026-12-25T00:00:00.000Z'),
          mk('mar', '2026-03-10T00:00:00.000Z'),
          mk('sep', '2026-09-01T00:00:00.000Z'),
        ],
      }),
    );

    // Adding a row in-app after the restore used to split the ordering, because
    // the restored rows were strings and this one is a real Date.
    await db.expenses.add({
      date: new Date('2026-06-01T00:00:00.000Z'),
      vendor: 'jun',
      category: 'Other',
      amount: 1,
      deductible: true,
      billable: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const ordered = await db.expenses.orderBy('date').reverse().toArray();
    expect(ordered.map((e) => e.vendor)).toEqual(['dec', 'sep', 'jun', 'mar', 'jan']);
  });

  it('rejects a file that is not a Helm backup', async () => {
    const bad = new File(['{"hello":"world"}'], 'nope.json', { type: 'application/json' });
    await expect(importData(bad)).rejects.toThrow('Invalid backup file format.');
  });

  it('restores older backups that omit timeEntries and toolLinks', async () => {
    const file = backupFile({
      clients: [
        {
          company: 'Legacy Co',
          contactName: 'Pat',
          email: 'pat@example.com',
          status: 'active',
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        },
      ],
    });

    await importData(file);

    const [client] = await db.clients.toArray();
    expect(client.company).toBe('Legacy Co');
    expect(client.createdAt).toBeInstanceOf(Date);
    expect(await db.timeEntries.count()).toBe(0);
    expect(await db.toolLinks.count()).toBe(0);
  });
});
