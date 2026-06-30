import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../db';
import type { Project, TimeEntry } from '../../types';
import {
  isUnbilled,
  summarizeHours,
  buildHourlyLineItems,
  effectiveHourlyRate,
  createInvoiceFromUnbilledHours,
  releaseTimeEntriesForInvoice,
} from '../time';

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    clientId: 1,
    projectId: 1,
    date: new Date('2026-06-15'),
    hours: 2,
    description: 'Work',
    billable: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

const hourlyProject: Project = {
  id: 1,
  clientId: 1,
  name: 'Acme API',
  type: 'hourly',
  status: 'active',
  rate: 150,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('isUnbilled', () => {
  it('is true for a billable entry with no invoice', () => {
    expect(isUnbilled(entry({}))).toBe(true);
  });
  it('is false for a non-billable entry', () => {
    expect(isUnbilled(entry({ billable: false }))).toBe(false);
  });
  it('is false once an invoiceId is set', () => {
    expect(isUnbilled(entry({ invoiceId: 5 }))).toBe(false);
  });
});

describe('summarizeHours', () => {
  it('sums hours and computes value at the rate', () => {
    const s = summarizeHours([entry({ hours: 2 }), entry({ hours: 1.5 })], 150);
    expect(s.count).toBe(2);
    expect(s.hours).toBe(3.5);
    expect(s.amount).toBe(525);
  });
  it('handles an empty list', () => {
    expect(summarizeHours([], 150)).toEqual({ count: 0, hours: 0, amount: 0 });
  });
  it('rounds fractional money to cents', () => {
    const s = summarizeHours([entry({ hours: 0.333 })], 150);
    expect(s.amount).toBe(49.95);
  });
});

describe('buildHourlyLineItems', () => {
  it('creates one line per entry, oldest first, with dated descriptions', () => {
    const items = buildHourlyLineItems(
      [
        entry({ date: new Date('2026-06-20'), hours: 1, description: 'Later task' }),
        entry({ date: new Date('2026-06-10'), hours: 3, description: 'Earlier task' }),
      ],
      150,
    );
    expect(items).toHaveLength(2);
    expect(items[0].description).toContain('Earlier task');
    expect(items[1].description).toContain('Later task');
    expect(items[0].quantity).toBe(3);
    expect(items[0].unitPrice).toBe(150);
    expect(items[0].amount).toBe(450);
  });
});

describe('effectiveHourlyRate', () => {
  beforeEach(async () => {
    await db.clients.clear();
    await db.clients.add({
      id: 1,
      company: 'Acme',
      contactName: 'A',
      email: 'a@acme.com',
      status: 'active',
      defaultRate: 120,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("uses the project's own rate when set", async () => {
    expect(await effectiveHourlyRate(hourlyProject)).toBe(150);
  });
  it('falls back to the client default rate', async () => {
    expect(await effectiveHourlyRate({ ...hourlyProject, rate: undefined })).toBe(120);
  });
});

describe('createInvoiceFromUnbilledHours / releaseTimeEntriesForInvoice', () => {
  beforeEach(async () => {
    await db.timeEntries.clear();
    await db.invoices.clear();
    await db.settings.clear();
    await db.settings.add({
      businessName: 'T', ownerName: 'T', address: '', email: '', paymentInstructions: '',
      defaultRate: 150, taxRate: 25, invoicePrefix: 'INV-', invoiceNextNumber: 2001,
      expenseCategories: [], updatedAt: new Date(),
    });
  });

  it('returns null when there are no unbilled hours', async () => {
    const id = await createInvoiceFromUnbilledHours(hourlyProject);
    expect(id).toBeNull();
  });

  it('rolls unbilled billable hours into a draft invoice and marks them billed', async () => {
    await db.timeEntries.bulkAdd([
      entry({ hours: 2, description: 'Design' }),
      entry({ hours: 3, description: 'Build' }),
      entry({ hours: 1, description: 'Non-billable', billable: false }),
    ]);

    const id = await createInvoiceFromUnbilledHours(hourlyProject);
    expect(id).not.toBeNull();

    const inv = await db.invoices.get(id!);
    expect(inv?.status).toBe('draft');
    expect(inv?.lineItems).toHaveLength(2); // non-billable excluded
    expect(inv?.subtotal).toBe(750); // (2+3) * 150
    expect(inv?.taxRate).toBe(0);
    expect(inv?.total).toBe(750);
    expect(inv?.invoiceNumber).toBe('INV-2001');

    // billable entries now point at the invoice; non-billable untouched
    const billed = await db.timeEntries.where('invoiceId').equals(id!).toArray();
    expect(billed).toHaveLength(2);
    const settings = await db.settings.limit(1).first();
    expect(settings?.invoiceNextNumber).toBe(2002);
  });

  it('does not re-bill already-billed hours on a second run', async () => {
    await db.timeEntries.bulkAdd([entry({ hours: 2 }), entry({ hours: 3 })]);
    await createInvoiceFromUnbilledHours(hourlyProject);
    const second = await createInvoiceFromUnbilledHours(hourlyProject);
    expect(second).toBeNull();
  });

  it('releases billed entries back to unbilled', async () => {
    await db.timeEntries.bulkAdd([entry({ hours: 2 }), entry({ hours: 3 })]);
    const id = await createInvoiceFromUnbilledHours(hourlyProject);
    const releasedCount = await releaseTimeEntriesForInvoice(id!);
    expect(releasedCount).toBe(2);

    const stillBilled = await db.timeEntries.where('invoiceId').equals(id!).toArray();
    expect(stillBilled).toHaveLength(0);

    // they can now be re-invoiced
    const reInvoice = await createInvoiceFromUnbilledHours(hourlyProject);
    expect(reInvoice).not.toBeNull();
  });
});
