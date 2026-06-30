import { describe, test, expect } from 'vitest';
import {
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  getPeriodRange,
  coerceDate,
  isInPeriod,
  lastNMonths,
} from '../date';

// Fixed reference date: June 15, 2026
const REF = new Date(2026, 5, 15); // month is 0-indexed

describe('startOfMonth / endOfMonth', () => {
  test('startOfMonth returns midnight on the 1st', () => {
    const d = startOfMonth(REF);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  test('endOfMonth returns the last day at 23:59:59', () => {
    const d = endOfMonth(REF);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(30); // June has 30 days
    expect(d.getHours()).toBe(23);
  });

  test('endOfMonth handles December (rolls to day 0 of next month)', () => {
    const dec = new Date(2026, 11, 1);
    const d = endOfMonth(dec);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });
});

describe('startOfQuarter / endOfQuarter', () => {
  test('June is in Q2 (Apr–Jun)', () => {
    const start = startOfQuarter(REF);
    const end = endOfQuarter(REF);
    expect(start.getMonth()).toBe(3); // April
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(5);   // June
    expect(end.getDate()).toBe(30);
  });

  test('January is in Q1', () => {
    const jan = new Date(2026, 0, 15);
    expect(startOfQuarter(jan).getMonth()).toBe(0);
    expect(endOfQuarter(jan).getMonth()).toBe(2);
  });

  test('October is in Q4', () => {
    const oct = new Date(2026, 9, 1);
    expect(startOfQuarter(oct).getMonth()).toBe(9);
    expect(endOfQuarter(oct).getMonth()).toBe(11);
  });
});

describe('startOfYear / endOfYear', () => {
  test('startOfYear is Jan 1', () => {
    const d = startOfYear(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  test('endOfYear is Dec 31', () => {
    const d = endOfYear(2026);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });
});

describe('getPeriodRange', () => {
  test('"month" range covers the reference date', () => {
    const { start, end } = getPeriodRange('month', REF);
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
    expect(REF >= start! && REF <= end!).toBe(true);
  });

  test('"quarter" range covers the reference date', () => {
    const { start, end } = getPeriodRange('quarter', REF);
    expect(REF >= start! && REF <= end!).toBe(true);
  });

  test('"year" range covers the reference date', () => {
    const { start, end } = getPeriodRange('year', REF);
    expect(REF >= start! && REF <= end!).toBe(true);
  });

  test('"all" returns null bounds', () => {
    const { start, end } = getPeriodRange('all', REF);
    expect(start).toBeNull();
    expect(end).toBeNull();
  });
});

describe('coerceDate', () => {
  test('passes through a valid Date', () => {
    const d = new Date(2026, 0, 1);
    expect(coerceDate(d)).toEqual(d);
  });

  test('parses a valid ISO string', () => {
    const result = coerceDate('2026-03-15T00:00:00');
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2026);
  });

  test('returns null for null', () => {
    expect(coerceDate(null)).toBeNull();
  });

  test('returns null for undefined', () => {
    expect(coerceDate(undefined)).toBeNull();
  });

  test('returns null for an invalid string', () => {
    expect(coerceDate('not-a-date')).toBeNull();
  });
});

describe('isInPeriod', () => {
  test('returns true when date falls within the period', () => {
    const midJune = new Date(2026, 5, 15);
    expect(isInPeriod(midJune, 'month', REF)).toBe(true);
  });

  test('returns false when date is before the period', () => {
    const beforeMonth = new Date(2026, 4, 31);
    expect(isInPeriod(beforeMonth, 'month', REF)).toBe(false);
  });

  test('always returns true for "all" period', () => {
    expect(isInPeriod(new Date(2000, 0, 1), 'all', REF)).toBe(true);
    expect(isInPeriod(new Date(2099, 11, 31), 'all', REF)).toBe(true);
  });

  test('returns false for null date', () => {
    expect(isInPeriod(null, 'month', REF)).toBe(false);
  });
});

describe('lastNMonths', () => {
  test('returns N months with the reference month last', () => {
    const months = lastNMonths(3, REF);
    expect(months).toHaveLength(3);
    // Last entry should be the month containing REF
    const last = months[months.length - 1];
    expect(last.getMonth()).toBe(REF.getMonth());
    expect(last.getFullYear()).toBe(REF.getFullYear());
  });

  test('months are ordered oldest first', () => {
    const months = lastNMonths(6, REF);
    for (let i = 1; i < months.length; i++) {
      expect(months[i].getTime()).toBeGreaterThan(months[i - 1].getTime());
    }
  });

  test('each entry is the 1st of its month', () => {
    lastNMonths(6, REF).forEach((d) => {
      expect(d.getDate()).toBe(1);
    });
  });
});
