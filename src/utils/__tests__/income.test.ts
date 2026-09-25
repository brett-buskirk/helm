import { describe, it, expect } from 'vitest';
import type { Payment } from '../../types';
import { stampAsInvoiceIncome } from '../../db';
import {
  INCOME_SOURCES,
  MANUAL_INCOME_SOURCES,
  breakdownBySource,
  defaultTaxable,
  incomeSourceLabel,
  isTaxable,
  paymentSource,
  summarizeIncome,
} from '../income';

function payment(partial: Partial<Payment>): Payment {
  return {
    source: 'invoice',
    taxable: true,
    amount: 100,
    date: new Date('2026-05-01'),
    createdAt: new Date('2026-05-01'),
    ...partial,
  } as Payment;
}

describe('income source metadata', () => {
  it('treats earnings as taxable and capital/rebates as not', () => {
    expect(INCOME_SOURCES.invoice.taxable).toBe(true);
    expect(INCOME_SOURCES.interest.taxable).toBe(true);
    // An owner's transfer is capital, not earnings; cashback is a rebate.
    expect(INCOME_SOURCES['owner-contribution'].taxable).toBe(false);
    expect(INCOME_SOURCES.cashback.taxable).toBe(false);
    expect(INCOME_SOURCES.donation.taxable).toBe(false);
  });

  it('defaults "other" to taxable, erring toward over-reserving', () => {
    expect(defaultTaxable('other')).toBe(true);
  });

  it('excludes invoice from the manually recordable sources', () => {
    expect(MANUAL_INCOME_SOURCES).not.toContain('invoice');
    expect(MANUAL_INCOME_SOURCES).toContain('owner-contribution');
  });

  it('labels every source', () => {
    for (const source of Object.keys(INCOME_SOURCES)) {
      expect(incomeSourceLabel(source as never)).toBeTruthy();
    }
  });
});

describe('legacy payment rows', () => {
  it('reads a row with no source/taxable as a taxable invoice payment', () => {
    // Pre-v6 rows, or rows restored from an older backup, have neither field.
    const legacy = { invoiceId: 3, clientId: 1, amount: 500, date: new Date() } as Payment;
    expect(paymentSource(legacy)).toBe('invoice');
    expect(isTaxable(legacy)).toBe(true);
  });

  it('counts legacy rows toward revenue rather than dropping them', () => {
    const legacy = { amount: 500, date: new Date('2026-05-01') } as Payment;
    const totals = summarizeIncome([legacy], null, null, new Date('2026-06-01'));
    expect(totals.revenue).toBe(500);
    expect(totals.moneyIn).toBe(500);
  });

  it('honours an explicit non-taxable flag over the source default', () => {
    expect(isTaxable(payment({ source: 'other', taxable: false }))).toBe(false);
    expect(isTaxable(payment({ source: 'cashback', taxable: true }))).toBe(true);
  });
});

describe('stampAsInvoiceIncome (the v6 migration step)', () => {
  it('marks a pre-v6 payment as taxable invoice income', () => {
    const row: Partial<Payment> = { invoiceId: 7, clientId: 2, amount: 250 };
    stampAsInvoiceIncome(row);
    expect(row.source).toBe('invoice');
    expect(row.taxable).toBe(true);
    // Nothing else is disturbed.
    expect(row.invoiceId).toBe(7);
    expect(row.clientId).toBe(2);
    expect(row.amount).toBe(250);
  });
});

describe('summarizeIncome', () => {
  const rows = [
    payment({ amount: 5000, source: 'invoice', taxable: true, date: new Date('2026-03-01') }),
    payment({ amount: 1000, source: 'owner-contribution', taxable: false, date: new Date('2026-03-15') }),
    payment({ amount: 250, source: 'cashback', taxable: false, date: new Date('2026-04-01') }),
    payment({ amount: 80, source: 'interest', taxable: true, date: new Date('2026-04-10') }),
  ];

  it('separates taxable revenue from total money in', () => {
    const totals = summarizeIncome(rows, null, null, new Date('2026-06-01'));
    expect(totals.revenue).toBe(5080); // invoice + interest
    expect(totals.moneyIn).toBe(6330); // everything
    expect(totals.nonRevenue).toBe(1250); // owner contribution + cashback
  });

  it('respects a date window', () => {
    const totals = summarizeIncome(
      rows,
      new Date('2026-04-01'),
      new Date('2026-04-30'),
      new Date('2026-06-01'),
    );
    expect(totals.moneyIn).toBe(330);
    expect(totals.revenue).toBe(80);
  });

  it('excludes deposits dated in the future', () => {
    const withFuture = [...rows, payment({ amount: 9999, date: new Date('2026-12-01') })];
    const totals = summarizeIncome(withFuture, null, null, new Date('2026-06-01'));
    expect(totals.moneyIn).toBe(6330);
  });

  it('returns zeroes for an empty ledger', () => {
    expect(summarizeIncome([], null, null)).toEqual({ revenue: 0, moneyIn: 0, nonRevenue: 0 });
  });

  it('avoids floating-point drift', () => {
    const cents = [
      payment({ amount: 0.1, taxable: true, date: new Date('2026-05-01') }),
      payment({ amount: 0.2, taxable: true, date: new Date('2026-05-02') }),
    ];
    expect(summarizeIncome(cents, null, null, new Date('2026-06-01')).revenue).toBe(0.3);
  });
});

describe('breakdownBySource', () => {
  it('groups and totals by source, largest first', () => {
    const rows = [
      payment({ amount: 100, source: 'cashback', taxable: false, date: new Date('2026-05-01') }),
      payment({ amount: 900, source: 'invoice', taxable: true, date: new Date('2026-05-02') }),
      payment({ amount: 50, source: 'cashback', taxable: false, date: new Date('2026-05-03') }),
    ];
    const result = breakdownBySource(rows, null, null);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ source: 'invoice', total: 900, count: 1, taxable: true });
    expect(result[1]).toMatchObject({ source: 'cashback', total: 150, count: 2, taxable: false });
  });

  it('is empty for no rows', () => {
    expect(breakdownBySource([], null, null)).toEqual([]);
  });
});
