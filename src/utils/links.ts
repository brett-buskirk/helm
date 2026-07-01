/** Ensure a user-entered URL has a scheme so it resolves as an absolute link. */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed; // already scheme://…
  if (/^(mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Short display host for a URL, e.g. "github.com". Falls back to the raw input. */
export function linkHost(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return url.trim();
  }
}

/**
 * Group items by their `category` (blank → "Other"), returning entries sorted by
 * category name with insertion order preserved within each group.
 */
export function groupByCategory<T extends { category: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = item.category.trim() || 'Other';
    const group = map.get(key);
    if (group) group.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
