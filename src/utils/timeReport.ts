import type { Client, Project, TimeEntry } from '../types';
import { coerceDate } from './date';
import { toDateInputValue } from './format';
import { isInRange, type DateRange } from './time';

/**
 * Hours formatted for a client-facing report: whole numbers stay whole, and
 * anything else shows two decimals. Deliberately bare ("7.5", not "7.5 hrs") —
 * the column header already says Hours, and a unit on every row is noise.
 */
export function formatHours(hours: number): string {
  return hours % 1 === 0 ? String(hours) : hours.toFixed(2);
}

/** Total hours, rounded to avoid floating-point drift across many entries. */
export function totalHours(entries: Pick<TimeEntry, 'hours'>[]): number {
  return Math.round(entries.reduce((sum, e) => sum + (e.hours || 0), 0) * 100) / 100;
}

/** Report order is chronological — the client reads the work as it happened. */
export function sortEntriesByDate(entries: TimeEntry[]): TimeEntry[] {
  return entries.slice().sort((a, b) => {
    const da = coerceDate(a.date as unknown as Date)?.getTime() ?? 0;
    const dbb = coerceDate(b.date as unknown as Date)?.getTime() ?? 0;
    return da - dbb;
  });
}

/**
 * Entries for one project inside a date range.
 *
 * Only *billable* entries are reported: non-billable time is internal
 * (admin, rework, goodwill) and putting it in front of a client invites a
 * conversation about hours they were never going to be charged for. Billed and
 * unbilled both appear — the report documents work done, not what's owed.
 */
export function entriesForReport(
  entries: TimeEntry[],
  projectId: number,
  range: DateRange,
): TimeEntry[] {
  return sortEntriesByDate(
    entries.filter((e) => e.projectId === projectId && e.billable && isInRange(e, range)),
  );
}

/**
 * File name for a downloaded report, e.g.
 * `Acme-Corp-Platform-Hardening-time-2026-09-01-to-2026-09-30.pdf`.
 */
export function reportFileName(
  client: Pick<Client, 'company'>,
  project: Pick<Project, 'name'>,
  from: Date,
  to: Date,
): string {
  const slug = (value: string) =>
    value
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'report';
  return `${slug(client.company)}-${slug(project.name)}-time-${toDateInputValue(from)}-to-${toDateInputValue(to)}.pdf`;
}
