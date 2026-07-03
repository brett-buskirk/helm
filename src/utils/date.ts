export type Period = 'month' | 'quarter' | 'year' | 'all';

export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function startOfQuarter(date = new Date()): Date {
  const q = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), q * 3, 1);
}

export function endOfQuarter(date = new Date()): Date {
  const q = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
}

export function startOfYear(year = new Date().getFullYear()): Date {
  return new Date(year, 0, 1);
}

export function endOfYear(year = new Date().getFullYear()): Date {
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

export function getPeriodRange(
  period: Period,
  now = new Date(),
): { start: Date | null; end: Date | null } {
  switch (period) {
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'year':
      return { start: startOfYear(now.getFullYear()), end: endOfYear(now.getFullYear()) };
    case 'all':
      return { start: null, end: null };
  }
}

export function coerceDate(value: Date | string | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function isInPeriod(
  rawDate: Date | string | undefined | null,
  period: Period,
  now = new Date(),
): boolean {
  const d = coerceDate(rawDate);
  if (!d) return false;
  const { start, end } = getPeriodRange(period, now);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

/** Returns the short month + 2-digit year label for a Date (e.g. "Jun '26"). */
export function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/**
 * Returns the 42 days (6 weeks, Sunday-first) that fill a month-view calendar
 * grid for the given year/month — includes trailing days from the adjacent
 * months so the grid is always rectangular.
 */
export function monthGrid(year: number, month: number): Date[] {
  const firstWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
  const start = new Date(year, month, 1 - firstWeekday);
  return Array.from(
    { length: 42 },
    (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
}

/** Returns an array of the last N months (oldest first), each as a Date at the 1st of that month. */
export function lastNMonths(n: number, now = new Date()): Date[] {
  const months: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d);
  }
  return months;
}
