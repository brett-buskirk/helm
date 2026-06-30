import { describe, test, expect, afterAll } from 'vitest';
import { db } from '../index';

// fake-indexeddb/auto is loaded in src/test/setup.ts before this runs

afterAll(async () => {
  // Clean up the fake DB so it doesn't bleed into other test files
  db.close();
  await db.delete();
});

describe('HelmDB schema', () => {
  test('database opens without errors', async () => {
    await expect(db.open()).resolves.not.toThrow();
  });

  test('invoices.orderBy issueDate resolves (regression: issueDate must be indexed)', async () => {
    await expect(db.invoices.orderBy('issueDate').toArray()).resolves.toEqual([]);
  });

  test('invoices.orderBy dueDate resolves', async () => {
    await expect(db.invoices.orderBy('dueDate').toArray()).resolves.toEqual([]);
  });

  test('all expected tables exist', () => {
    const tables = db.tables.map((t) => t.name).sort();
    expect(tables).toEqual([
      'agreements',
      'clients',
      'documents',
      'expenses',
      'invoices',
      'payments',
      'projects',
      'proposals',
      'settings',
      'timeEntries',
    ]);
  });

  test('timeEntries.where invoiceId resolves (invoiceId must be indexed)', async () => {
    await expect(db.timeEntries.where('invoiceId').equals(1).toArray()).resolves.toEqual([]);
  });
});
