import { describe, test, expect } from 'vitest';
import { getEffectiveStatus, calculateDueDate, computeBalanceDue } from '../invoice';

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
