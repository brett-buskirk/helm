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
  isInRange,
  unbilledInRange,
  formatRangeLabel,
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

describe('date ranges', () => {
  const sep1 = new Date('2026-09-01T00:00:00');
  const sep15 = new Date('2026-09-15T00:00:00');
  const sep30 = new Date('2026-09-30T00:00:00');
  const oct1 = new Date('2026-10-01T00:00:00');

  it('includes both boundary days', () => {
    const range = { from: sep1, to: sep30 };
    expect(isInRange({ date: sep1 }, range)).toBe(true);
    expect(isInRange({ date: sep30 }, range)).toBe(true);
    expect(isInRange({ date: sep15 }, range)).toBe(true);
  });

  it('includes an end-date entry regardless of its time component', () => {
    // The end is treated as the whole day, so an entry stamped late on the
    // final day still falls inside the window.
    const lateOnSep30 = new Date('2026-09-30T23:45:00');
    expect(isInRange({ date: lateOnSep30 }, { from: sep1, to: sep30 })).toBe(true);
  });

  it('excludes dates outside the window', () => {
    const range = { from: sep1, to: sep30 };
    expect(isInRange({ date: new Date('2026-08-31T12:00:00') }, range)).toBe(false);
    expect(isInRange({ date: oct1 }, range)).toBe(false);
  });

  it('treats an open end as unbounded on that side', () => {
    expect(isInRange({ date: oct1 }, { from: sep1, to: null })).toBe(true);
    expect(isInRange({ date: sep1 }, { from: null, to: sep30 })).toBe(true);
    expect(isInRange({ date: oct1 }, { from: null, to: null })).toBe(true);
    expect(isInRange({ date: oct1 })).toBe(true);
  });

  it('narrows to unbilled entries inside the range', () => {
    const entries = [
      entry({ id: 1, date: sep15, hours: 2 }),
      entry({ id: 2, date: oct1, hours: 3 }),
      entry({ id: 3, date: sep15, hours: 1, billable: false }),
      entry({ id: 4, date: sep15, hours: 4, invoiceId: 7 }),
    ];
    const result = unbilledInRange(entries, { from: sep1, to: sep30 });
    expect(result.map((e) => e.id)).toEqual([1]);
  });

  it('labels a period readably', () => {
    expect(formatRangeLabel(sep1, sep30)).toBe('Sep 1, 2026 – Sep 30, 2026');
  });
});

describe('createInvoiceFromUnbilledHours with a date range', () => {
  beforeEach(async () => {
    await db.timeEntries.clear();
    await db.invoices.clear();
    await db.settings.clear();
    await db.settings.add({
      businessName: 'T', ownerName: 'T', address: '', email: '', paymentInstructions: '',
      defaultRate: 150, taxRate: 25, invoicePrefix: 'INV-', invoiceNextNumber: 3001,
      expenseCategories: [], updatedAt: new Date(),
    });
    await db.timeEntries.bulkAdd([
      entry({ date: new Date('2026-08-20T09:00:00'), hours: 5, description: 'August work' }),
      entry({ date: new Date('2026-09-01T09:00:00'), hours: 2, description: 'First of month' }),
      entry({ date: new Date('2026-09-30T18:30:00'), hours: 3, description: 'Last of month' }),
      entry({ date: new Date('2026-10-02T09:00:00'), hours: 4, description: 'October work' }),
    ]);
  });

  const september = { from: new Date('2026-09-01T00:00:00'), to: new Date('2026-09-30T00:00:00') };

  it('bills only the entries inside the range, inclusive of both ends', async () => {
    const id = await createInvoiceFromUnbilledHours(hourlyProject, new Date(), september);
    const inv = await db.invoices.get(id!);

    expect(inv?.lineItems).toHaveLength(2);
    expect(inv?.subtotal).toBe(750); // (2 + 3) * 150
    expect(inv?.lineItems.map((li) => li.description)).toEqual([
      'Sep 1, 2026 — First of month',
      'Sep 30, 2026 — Last of month',
    ]);
  });

  it('leaves out-of-range hours unbilled for a later invoice', async () => {
    const id = await createInvoiceFromUnbilledHours(hourlyProject, new Date(), september);

    const stillUnbilled = (await db.timeEntries.toArray()).filter(isUnbilled);
    expect(stillUnbilled.map((e) => e.description).sort()).toEqual([
      'August work',
      'October work',
    ]);

    // And the leftovers can be billed separately afterwards.
    const second = await createInvoiceFromUnbilledHours(hourlyProject);
    expect(second).not.toBe(id);
    const secondInv = await db.invoices.get(second!);
    expect(secondInv?.lineItems).toHaveLength(2);
  });

  it('records the period on the invoice so the client can see what it covers', async () => {
    const id = await createInvoiceFromUnbilledHours(hourlyProject, new Date(), september);
    const inv = await db.invoices.get(id!);
    expect(inv?.notes).toBe('Services rendered Sep 1, 2026 – Sep 30, 2026.');
  });

  it('leaves notes unset when billing everything', async () => {
    const id = await createInvoiceFromUnbilledHours(hourlyProject);
    const inv = await db.invoices.get(id!);
    expect(inv?.notes).toBeUndefined();
  });

  it('returns null when the range holds no unbilled hours, without consuming a number', async () => {
    const id = await createInvoiceFromUnbilledHours(hourlyProject, new Date(), {
      from: new Date('2026-12-01T00:00:00'),
      to: new Date('2026-12-31T00:00:00'),
    });
    expect(id).toBeNull();
    const settings = await db.settings.limit(1).first();
    expect(settings?.invoiceNextNumber).toBe(3001);
  });
});
