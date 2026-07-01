import type { Settings } from '../types';

/** Default brand accent (indigo) used on client-facing PDFs. */
export const DEFAULT_BRAND = '#6366f1';

/** The configured brand color if it's a valid 6-digit hex, else the default. */
export function brandColor(settings?: Settings | null): string {
  const value = settings?.brandColor?.trim();
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : DEFAULT_BRAND;
}

/** Up to two initials from a business name, for a logo fallback. */
export function initials(name?: string): string {
  if (!name) return '';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
