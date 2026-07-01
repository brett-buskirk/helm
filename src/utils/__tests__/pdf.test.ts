import { describe, it, expect } from 'vitest';
import type { Settings } from '../../types';
import { brandColor, initials, DEFAULT_BRAND } from '../pdf';

describe('brandColor', () => {
  it('returns a valid configured hex color', () => {
    expect(brandColor({ brandColor: '#ff8800' } as Settings)).toBe('#ff8800');
  });
  it('falls back to the default for missing or invalid values', () => {
    expect(brandColor(undefined)).toBe(DEFAULT_BRAND);
    expect(brandColor({ brandColor: 'blue' } as Settings)).toBe(DEFAULT_BRAND);
    expect(brandColor({ brandColor: '#fff' } as Settings)).toBe(DEFAULT_BRAND); // 3-digit not accepted
    expect(brandColor({} as Settings)).toBe(DEFAULT_BRAND);
  });
});

describe('initials', () => {
  it('takes up to two initials, uppercased', () => {
    expect(initials('Brett Buskirk LLC')).toBe('BB');
    expect(initials('lumen')).toBe('L');
    expect(initials('')).toBe('');
    expect(initials(undefined)).toBe('');
  });
});
