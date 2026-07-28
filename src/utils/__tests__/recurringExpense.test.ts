import { describe, test, expect, beforeEach } from 'vitest';
import { db } from '../../db';
import type { Expense } from '../../types';
import { advanceByRecurrence, dueOccurrences, logDueOccurrences } from '../recurringExpense';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('advanceByRecurrence', () => {
  test('monthly adds a month', () => {
    expect(advanceByRecurrence(new Date(2026, 0, 2), 'monthly')).toEqual(new Date(2026, 1, 2));
  });
  test('quarterly adds three months', () => {
    expect(advanceByRecurrence(new Date(2026, 0, 2), 'quarterly')).toEqual(new Date(2026, 3, 2));
  });
  test('annual adds a year', () => {
    expect(advanceByRecurrence(new Date(2026, 0, 2), 'annual')).toEqual(new Date(2027, 0, 2));
  });
});

describe('dueOccurrences', () => {
  const asOf = new Date(2026, 6, 28); // Jul 28 2026

  test('is zero for a non-recurring expense', () => {
    expect(dueOccurrences({ recurrence: undefined, nextDue: undefined }, asOf)).toBe(0);
  });
  test('is zero when nextDue is in the future', () => {
    expect(dueOccurrences({ recurrence: 'monthly', nextDue: new Date(2026, 7, 2) }, asOf)).toBe(0);
  });
  test('counts one when a single period is due', () => {
    expect(dueOccurrences({ recurrence: 'monthly', nextDue: new Date(2026, 6, 2) }, asOf)).toBe(1);
  });
  test('catches up multiple missed periods', () => {
    // Apr 2 → Apr, May, Jun, Jul all on/before Jul 28 = 4
    expect(dueOccurrences({ recurrence: 'monthly', nextDue: new Date(2026, 3, 2) }, asOf)).toBe(4);
  });
  test('annual counts once when a year is due', () => {
    expect(dueOccurrences({ recurrence: 'annual', nextDue: new Date(2026, 0, 1) }, asOf)).toBe(1);
  });
});

describe('logDueOccurrences', () => {
  beforeEach(async () => {
    await db.expenses.clear();
  });

  test('creates one plain occurrence per due period and advances the anchor', async () => {
    const asOf = new Date(2026, 6, 28); // Jul 28
    const anchorId = (await db.expenses.add({
      date: new Date(2026, 3, 2), // Apr 2 (first occurrence)
      vendor: 'DigitalOcean',
      category: 'Software & Subscriptions',
      amount: 142.5,
      deductible: true,
      billable: false,
      recurrence: 'monthly',
      nextDue: new Date(2026, 4, 2), // May 2
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)) as number;

    const anchor = (await db.expenses.get(anchorId)) as Expense;
    const created = await logDueOccurrences(anchor, asOf);

    // May 2, Jun 2, Jul 2 are on/before Jul 28 → 3 occurrences
    expect(created).toBe(3);

    const all = await db.expenses.toArray();
    expect(all.length).toBe(1 + 3); // anchor + 3 occurrences

    // Generated occurrences are plain (no recurrence/nextDue), so they don't re-generate.
    const occurrences = all.filter((e) => e.id !== anchorId);
    expect(occurrences.every((o) => o.recurrence === undefined && o.nextDue === undefined)).toBe(true);
    expect(occurrences.every((o) => o.amount === 142.5 && o.vendor === 'DigitalOcean')).toBe(true);

    // Anchor advanced past asOf → nextDue = Aug 2, no longer due.
    const updated = (await db.expenses.get(anchorId)) as Expense;
    expect(updated.nextDue).toEqual(new Date(2026, 7, 2));
    expect(dueOccurrences(updated, asOf)).toBe(0);
  });

  test('creates nothing when the anchor is not yet due', async () => {
    const id = (await db.expenses.add({
      date: new Date(2026, 6, 2),
      vendor: 'X',
      category: 'Y',
      amount: 10,
      deductible: true,
      billable: false,
      recurrence: 'monthly',
      nextDue: new Date(2026, 11, 1), // Dec 1 — future
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)) as number;
    const anchor = (await db.expenses.get(id)) as Expense;
    expect(await logDueOccurrences(anchor, new Date(2026, 6, 28))).toBe(0);
    expect(await db.expenses.count()).toBe(1);
  });
});
