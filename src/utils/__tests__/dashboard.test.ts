import { describe, it, expect } from 'vitest';
import type { Payment, Client, Project, TimeEntry } from '../../types';
import { topClientsByRevenue, unbilledValue } from '../dashboard';

const clients = [
  { id: 1, company: 'Acme', defaultRate: 150 },
  { id: 2, company: 'Globex', defaultRate: 100 },
] as Client[];

function pay(clientId: number, amount: number, date: Date): Payment {
  return { clientId, amount, date, invoiceId: 1, createdAt: date } as Payment;
}

describe('topClientsByRevenue', () => {
  const payments = [
    pay(1, 5000, new Date('2026-03-01')),
    pay(2, 8000, new Date('2026-03-01')),
    pay(1, 3000, new Date('2026-04-01')),
    pay(2, 1000, new Date('2025-12-01')), // before "since"
  ];

  it('sums per client and ranks highest first', () => {
    const top = topClientsByRevenue(payments, clients, null);
    expect(top).toEqual([
      { clientId: 2, company: 'Globex', total: 9000 },
      { clientId: 1, company: 'Acme', total: 8000 },
    ]);
  });

  it('respects the since cutoff', () => {
    const top = topClientsByRevenue(payments, clients, new Date('2026-01-01'));
    expect(top.find((c) => c.clientId === 2)?.total).toBe(8000); // 2025 payment excluded
    expect(top.find((c) => c.clientId === 1)?.total).toBe(8000);
  });

  it('honors the limit and labels unknown clients', () => {
    const orphan = [pay(99, 500, new Date('2026-05-01'))];
    const top = topClientsByRevenue(orphan, clients, null, 1);
    expect(top).toHaveLength(1);
    expect(top[0].company).toBe('Unknown');
  });
});

describe('unbilledValue', () => {
  const projects = [
    { id: 10, clientId: 1, rate: 200 },
    { id: 11, clientId: 2 }, // no rate → falls back to client default (100)
  ] as Project[];

  function entry(over: Partial<TimeEntry>): TimeEntry {
    return { clientId: 1, projectId: 10, date: new Date(), hours: 1, description: '', billable: true, ...over } as TimeEntry;
  }

  it('values unbilled billable hours at the project rate', () => {
    const s = unbilledValue([entry({ hours: 3, projectId: 10 })], projects, clients);
    expect(s).toEqual({ count: 1, hours: 3, amount: 600 });
  });

  it('falls back to the client default rate when the project has none', () => {
    const s = unbilledValue([entry({ hours: 2, projectId: 11, clientId: 2 })], projects, clients);
    expect(s.amount).toBe(200); // 2h × 100
  });

  it('excludes billed and non-billable entries', () => {
    const s = unbilledValue(
      [
        entry({ hours: 2, invoiceId: 5 }), // billed
        entry({ hours: 4, billable: false }), // non-billable
        entry({ hours: 1 }), // counts
      ],
      projects,
      clients,
    );
    expect(s.count).toBe(1);
    expect(s.hours).toBe(1);
  });
});
