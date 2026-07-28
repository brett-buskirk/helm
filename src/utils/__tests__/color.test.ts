import { describe, test, expect } from 'vitest';
import { normalizeHex } from '../color';

describe('normalizeHex', () => {
  test('normalizes a 6-digit hex to lowercase', () => {
    expect(normalizeHex('#6366F1')).toBe('#6366f1');
  });
  test('adds a missing leading #', () => {
    expect(normalizeHex('6366f1')).toBe('#6366f1');
  });
  test('expands 3-digit shorthand', () => {
    expect(normalizeHex('#0af')).toBe('#00aaff');
    expect(normalizeHex('abc')).toBe('#aabbcc');
  });
  test('trims surrounding whitespace', () => {
    expect(normalizeHex('  #ABCDEF ')).toBe('#abcdef');
  });
  test('returns null for invalid input', () => {
    expect(normalizeHex('#12')).toBeNull();
    expect(normalizeHex('nope')).toBeNull();
    expect(normalizeHex('#12345g')).toBeNull();
    expect(normalizeHex('')).toBeNull();
  });
});
