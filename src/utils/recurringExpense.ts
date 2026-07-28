import { db } from '../db';
import type { Expense, ExpenseRecurrence } from '../types';
import { coerceDate } from './date';

export const RECURRENCE_LABEL: Record<ExpenseRecurrence, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

export const RECURRENCE_OPTIONS = [
  { value: '', label: 'One-time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

/** Monthly-equivalent cost of one recurrence (quarterly ÷ 3, annual ÷ 12). */
export function monthlyEquivalent(recurrence: ExpenseRecurrence, amount: number): number {
  if (recurrence === 'monthly') return amount;
  if (recurrence === 'quarterly') return amount / 3;
  return amount / 12;
}

export interface RecurringSummary {
  count: number;
  /** Total recurring run-rate normalized to a month. */
  monthly: number;
  /** Annual projection (monthly × 12). */
  annual: number;
  /** Per-frequency breakdown, each summed to its monthly-equivalent run-rate. */
  byFrequency: Record<ExpenseRecurrence, { count: number; monthly: number }>;
}

/**
 * Aggregate the recurring "anchors" (expenses with a recurrence) into a
 * monthly/annual run-rate plus a per-frequency breakdown. Generated occurrences
 * carry no recurrence, so they're naturally excluded.
 */
export function summarizeRecurring(expenses: Pick<Expense, 'recurrence' | 'amount'>[]): RecurringSummary {
  const byFrequency: RecurringSummary['byFrequency'] = {
    monthly: { count: 0, monthly: 0 },
    quarterly: { count: 0, monthly: 0 },
    annual: { count: 0, monthly: 0 },
  };
  let monthly = 0;
  let count = 0;
  for (const e of expenses) {
    if (!e.recurrence) continue;
    const m = monthlyEquivalent(e.recurrence, e.amount);
    monthly += m;
    count += 1;
    byFrequency[e.recurrence].count += 1;
    byFrequency[e.recurrence].monthly += m;
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return { count, monthly: round2(monthly), annual: round2(monthly * 12), byFrequency };
}

/** Advance a date by one recurrence interval (calendar-based). */
export function advanceByRecurrence(date: Date, recurrence: ExpenseRecurrence): Date {
  const d = new Date(date);
  if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (recurrence === 'quarterly') d.setMonth(d.getMonth() + 3);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

/**
 * How many occurrences of a recurring anchor are due as of `asOf` — i.e. how
 * many interval steps from `nextDue` are on or before `asOf`. Zero for
 * non-anchors (no recurrence / no nextDue) or a future nextDue.
 */
export function dueOccurrences(
  anchor: Pick<Expense, 'recurrence' | 'nextDue'>,
  asOf: Date = new Date(),
): number {
  if (!anchor.recurrence || !anchor.nextDue) return 0;
  let cursor = coerceDate(anchor.nextDue as unknown as Date);
  if (!cursor) return 0;
  let count = 0;
  // Cap guards against a runaway loop from bad data (e.g. 50 years of monthly).
  while (cursor.getTime() <= asOf.getTime() && count < 600) {
    count += 1;
    cursor = advanceByRecurrence(cursor, anchor.recurrence);
  }
  return count;
}

/**
 * Log every due occurrence of a recurring anchor: create a plain expense (no
 * recurrence/nextDue, so it doesn't itself generate) for each interval from
 * `nextDue` up to `asOf`, copying the anchor's fields, then advance the anchor's
 * `nextDue` past `asOf`. Atomic. Returns how many occurrences were created.
 */
export async function logDueOccurrences(anchor: Expense, asOf: Date = new Date()): Promise<number> {
  if (!anchor.id || !anchor.recurrence || !anchor.nextDue) return 0;
  const recurrence = anchor.recurrence;
  return db.transaction('rw', db.expenses, async () => {
    const now = new Date();
    let cursor = coerceDate(anchor.nextDue as unknown as Date);
    if (!cursor) return 0;
    const occurrences: Omit<Expense, 'id'>[] = [];
    while (cursor.getTime() <= asOf.getTime() && occurrences.length < 600) {
      occurrences.push({
        date: new Date(cursor),
        vendor: anchor.vendor,
        category: anchor.category,
        amount: anchor.amount,
        deductible: anchor.deductible,
        billable: anchor.billable,
        clientId: anchor.clientId,
        projectId: anchor.projectId,
        notes: anchor.notes,
        createdAt: now,
        updatedAt: now,
      });
      cursor = advanceByRecurrence(cursor, recurrence);
    }
    if (occurrences.length) await db.expenses.bulkAdd(occurrences as Expense[]);
    // Advance the anchor to the next not-yet-due occurrence.
    await db.expenses.update(anchor.id, { nextDue: cursor, updatedAt: now });
    return occurrences.length;
  });
}
