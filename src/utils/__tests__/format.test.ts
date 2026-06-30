import { describe, test, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatRate,
  toDateInputValue,
  parseDateInput,
} from '../format';

describe('formatCurrency', () => {
  test('formats a positive amount', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  test('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  test('formats a negative amount', () => {
    expect(formatCurrency(-50)).toBe('-$50.00');
  });

  test('returns em dash for null', () => {
    expect(formatCurrency(null)).toBe('—');
  });

  test('returns em dash for undefined', () => {
    expect(formatCurrency(undefined)).toBe('—');
  });
});

describe('formatDate', () => {
  test('formats a valid Date object', () => {
    const d = new Date(2026, 0, 15); // Jan 15, 2026 local time
    expect(formatDate(d)).toBe('Jan 15, 2026');
  });

  test('formats a valid ISO date string', () => {
    // Use local midnight to avoid UTC-offset surprises
    const d = new Date(2026, 5, 1); // Jun 1, 2026
    expect(formatDate(d.toISOString())).toMatch(/Jun/);
  });

  test('returns em dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  test('returns em dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  test('returns em dash for an invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('—');
  });
});

describe('formatRate', () => {
  test('formats a rate with /hr suffix', () => {
    expect(formatRate(150)).toBe('$150.00/hr');
  });

  test('returns em dash for null', () => {
    expect(formatRate(null)).toBe('—');
  });

  test('returns em dash for undefined', () => {
    expect(formatRate(undefined)).toBe('—');
  });
});

describe('toDateInputValue', () => {
  test('converts a Date to yyyy-MM-dd', () => {
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  test('pads single-digit month and day', () => {
    expect(toDateInputValue(new Date(2026, 8, 3))).toBe('2026-09-03');
  });

  test('returns empty string for null', () => {
    expect(toDateInputValue(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(toDateInputValue(undefined)).toBe('');
  });
});

describe('parseDateInput', () => {
  test('parses a valid yyyy-MM-dd string to a local Date', () => {
    const result = parseDateInput('2026-03-15');
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2026);
    expect(result?.getMonth()).toBe(2); // 0-indexed
    expect(result?.getDate()).toBe(15);
  });

  test('returns undefined for empty string', () => {
    expect(parseDateInput('')).toBeUndefined();
  });

  test('returns undefined for an invalid string', () => {
    expect(parseDateInput('not-a-date')).toBeUndefined();
  });

  test('round-trips with toDateInputValue', () => {
    const original = new Date(2026, 6, 4); // Jul 4, 2026
    const str = toDateInputValue(original);
    const parsed = parseDateInput(str);
    expect(parsed?.getFullYear()).toBe(original.getFullYear());
    expect(parsed?.getMonth()).toBe(original.getMonth());
    expect(parsed?.getDate()).toBe(original.getDate());
  });
});
