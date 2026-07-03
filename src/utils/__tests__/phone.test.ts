import { describe, it, expect } from 'vitest';
import { formatPhoneNumber } from '../phone';

describe('formatPhoneNumber', () => {
  it('formats a full 10-digit number', () => {
    expect(formatPhoneNumber('5551234567')).toBe('(555) 123-4567');
  });

  it('masks progressively as digits are typed', () => {
    expect(formatPhoneNumber('5')).toBe('(5');
    expect(formatPhoneNumber('555')).toBe('(555');
    expect(formatPhoneNumber('5551')).toBe('(555) 1');
    expect(formatPhoneNumber('555123')).toBe('(555) 123');
    expect(formatPhoneNumber('5551234')).toBe('(555) 123-4');
  });

  it('strips non-digits and caps at 10 digits', () => {
    expect(formatPhoneNumber('(555) 123-4567')).toBe('(555) 123-4567');
    expect(formatPhoneNumber('555.123.4567')).toBe('(555) 123-4567');
    expect(formatPhoneNumber('555123456789')).toBe('(555) 123-4567');
  });

  it('returns empty when there are no digits', () => {
    expect(formatPhoneNumber('')).toBe('');
    expect(formatPhoneNumber('abc')).toBe('');
  });
});
