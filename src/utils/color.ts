const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Normalize a user-typed hex color to lowercase `#rrggbb`, adding a missing `#`
 * and expanding shorthand (`#0af` → `#00aaff`). Returns null if it isn't a valid
 * 3- or 6-digit hex — callers keep the previous value in that case.
 */
export function normalizeHex(raw: string): string | null {
  let v = raw.trim().toLowerCase();
  if (v && !v.startsWith('#')) v = `#${v}`;
  if (!HEX_RE.test(v)) return null;
  if (v.length === 4) {
    v = `#${v.slice(1).split('').map((c) => c + c).join('')}`;
  }
  return v;
}
