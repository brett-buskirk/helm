import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { db } from '../../db';
import { DATE_FIELDS } from '../../db/dates';
import { useDateRepair } from '../useDateRepair';

function expenseRow(vendor: string, date: Date | string) {
  return {
    date,
    vendor,
    category: 'Other',
    amount: 10,
    deductible: true,
    billable: false,
    createdAt: date,
    updatedAt: date,
  } as never;
}

beforeEach(async () => {
  for (const name of Object.keys(DATE_FIELDS)) await db.table(name).clear();
});

describe('useDateRepair', () => {
  it('repairs string-typed dates and reports how many rows changed', async () => {
    await db.expenses.bulkAdd([
      expenseRow('restored', '2026-01-15T00:00:00.000Z'),
      expenseRow('typed', new Date('2026-03-10T00:00:00.000Z')),
    ]);

    const onRepaired = vi.fn();
    renderHook(() => useDateRepair(onRepaired));

    await waitFor(() => expect(onRepaired).toHaveBeenCalledWith(1));

    const rows = await db.expenses.toArray();
    for (const row of rows) expect(row.date).toBeInstanceOf(Date);
  });

  it('restores correct ordering, which is the point of the pass', async () => {
    await db.expenses.bulkAdd([
      expenseRow('jan', '2026-01-15T00:00:00.000Z'),
      expenseRow('sep', '2026-09-01T00:00:00.000Z'),
      expenseRow('mar', new Date('2026-03-10T00:00:00.000Z')),
      expenseRow('dec', new Date('2026-12-25T00:00:00.000Z')),
    ]);

    // Before: the type split puts the two string rows in their own run.
    const before = await db.expenses.orderBy('date').reverse().toArray();
    expect(before.map((e) => e.vendor)).toEqual(['sep', 'jan', 'dec', 'mar']);

    const onRepaired = vi.fn();
    renderHook(() => useDateRepair(onRepaired));
    await waitFor(() => expect(onRepaired).toHaveBeenCalled());

    const after = await db.expenses.orderBy('date').reverse().toArray();
    expect(after.map((e) => e.vendor)).toEqual(['dec', 'sep', 'mar', 'jan']);
  });

  it('stays silent on a healthy database', async () => {
    await db.expenses.bulkAdd([expenseRow('typed', new Date('2026-04-01T00:00:00.000Z'))]);

    const onRepaired = vi.fn();
    renderHook(() => useDateRepair(onRepaired));

    // Give the pass time to run and decide there is nothing to do.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onRepaired).not.toHaveBeenCalled();
  });

  it('stays silent on an empty database', async () => {
    const onRepaired = vi.fn();
    renderHook(() => useDateRepair(onRepaired));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onRepaired).not.toHaveBeenCalled();
  });

  it('runs once per mount, not once per render', async () => {
    await db.expenses.bulkAdd([expenseRow('restored', '2026-01-15T00:00:00.000Z')]);

    const onRepaired = vi.fn();
    const { rerender } = renderHook(() => useDateRepair(onRepaired));
    await waitFor(() => expect(onRepaired).toHaveBeenCalledTimes(1));

    rerender();
    rerender();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onRepaired).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the repair fails', async () => {
    // The app must still start if the maintenance pass errors; the manual
    // control on Security remains the fallback.
    const spy = vi.spyOn(db.expenses, 'toArray').mockRejectedValue(new Error('boom'));
    const onRepaired = vi.fn();

    expect(() => renderHook(() => useDateRepair(onRepaired))).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onRepaired).not.toHaveBeenCalled();

    spy.mockRestore();
  });
});
