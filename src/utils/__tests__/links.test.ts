import { describe, it, expect } from 'vitest';
import { normalizeUrl, linkHost, groupByCategory } from '../links';

describe('normalizeUrl', () => {
  it('adds https:// when no scheme is present', () => {
    expect(normalizeUrl('cloud.digitalocean.com')).toBe('https://cloud.digitalocean.com');
  });
  it('leaves an existing http(s) scheme untouched', () => {
    expect(normalizeUrl('http://localhost:3000')).toBe('http://localhost:3000');
    expect(normalizeUrl('https://github.com')).toBe('https://github.com');
  });
  it('preserves mailto: and tel:', () => {
    expect(normalizeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(normalizeUrl('tel:+15551234567')).toBe('tel:+15551234567');
  });
  it('trims whitespace and handles empty input', () => {
    expect(normalizeUrl('  github.com  ')).toBe('https://github.com');
    expect(normalizeUrl('   ')).toBe('');
  });
});

describe('linkHost', () => {
  it('returns the bare hostname without www', () => {
    expect(linkHost('https://www.github.com/foo')).toBe('github.com');
    expect(linkHost('console.cloud.google.com/home')).toBe('console.cloud.google.com');
  });
  it('falls back to the raw input for an unparseable value', () => {
    expect(linkHost('not a url')).toBe('not a url');
  });
});

describe('groupByCategory', () => {
  it('groups items by category, sorted by category name', () => {
    const items = [
      { category: 'Cloud', label: 'DO' },
      { category: 'GitHub', label: 'Repo' },
      { category: 'Cloud', label: 'AWS' },
    ];
    const groups = groupByCategory(items);
    expect(groups.map(([c]) => c)).toEqual(['Cloud', 'GitHub']);
    expect(groups[0][1].map((i) => i.label)).toEqual(['DO', 'AWS']); // insertion order kept
  });
  it('buckets blank categories under "Other"', () => {
    const groups = groupByCategory([{ category: '', label: 'x' }]);
    expect(groups[0][0]).toBe('Other');
  });
  it('returns an empty array for no items', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
