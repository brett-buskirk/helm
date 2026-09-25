import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableSort, type SortValue } from '../useTableSort';

type Key = 'name' | 'amount' | 'date';

interface Row {
  name: string;
  amount: number;
  date?: Date;
}

const ROWS: Row[] = [
  { name: 'charlie', amount: 30, date: new Date('2026-03-01') },
  { name: 'Alpha', amount: 10, date: new Date('2026-01-01') },
  { name: 'bravo', amount: 20 }, // no date — always sorts last
];

const accessor = (row: Row, key: Key): SortValue =>
  key === 'name' ? row.name : key === 'amount' ? row.amount : row.date;

function setup(initialKey: Key = 'name', dir: 'asc' | 'desc' = 'asc') {
  return renderHook(() => useTableSort<Key>(initialKey, dir));
}

describe('useTableSort', () => {
  it('sorts strings case-insensitively', () => {
    const { result } = setup('name', 'asc');
    expect(result.current.sortRows(ROWS, accessor).map((r) => r.name)).toEqual([
      'Alpha',
      'bravo',
      'charlie',
    ]);
  });

  it('sorts numbers numerically, not lexically', () => {
    const { result } = setup('amount', 'asc');
    const rows = [{ name: 'a', amount: 100 }, { name: 'b', amount: 9 }, { name: 'c', amount: 80 }];
    expect(result.current.sortRows(rows, accessor).map((r) => r.amount)).toEqual([9, 80, 100]);
  });

  it('sorts dates chronologically', () => {
    const { result } = setup('date', 'asc');
    expect(result.current.sortRows(ROWS, accessor).map((r) => r.name)).toEqual([
      'Alpha',
      'charlie',
      'bravo', // undefined date
    ]);
  });

  it('keeps blank values last in BOTH directions', () => {
    const asc = setup('date', 'asc');
    expect(asc.result.current.sortRows(ROWS, accessor).at(-1)?.name).toBe('bravo');

    const desc = setup('date', 'desc');
    expect(desc.result.current.sortRows(ROWS, accessor).at(-1)?.name).toBe('bravo');
  });

  it('flips direction when the active column is clicked again', () => {
    const { result } = setup('name', 'asc');
    act(() => result.current.toggleSort('name'));
    expect(result.current.sort).toEqual({ key: 'name', direction: 'desc' });

    act(() => result.current.toggleSort('name'));
    expect(result.current.sort).toEqual({ key: 'name', direction: 'asc' });
  });

  it('starts a newly selected column at its natural direction', () => {
    const { result } = setup('name', 'desc');
    act(() => result.current.toggleSort('amount', 'desc'));
    expect(result.current.sort).toEqual({ key: 'amount', direction: 'desc' });

    act(() => result.current.toggleSort('name', 'asc'));
    expect(result.current.sort).toEqual({ key: 'name', direction: 'asc' });
  });

  it('does not mutate the array it is given', () => {
    const { result } = setup('amount', 'asc');
    const input = [...ROWS];
    const snapshot = input.map((r) => r.name);
    result.current.sortRows(input, accessor);
    expect(input.map((r) => r.name)).toEqual(snapshot);
  });

  it('is stable — equal rows keep their incoming order', () => {
    const { result } = setup('amount', 'asc');
    const rows = [
      { name: 'first', amount: 5 },
      { name: 'second', amount: 5 },
      { name: 'third', amount: 5 },
    ];
    expect(result.current.sortRows(rows, accessor).map((r) => r.name)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });
});
