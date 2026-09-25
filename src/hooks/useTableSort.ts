import { useCallback, useMemo, useState } from 'react';
import { coerceDate } from '../utils/date';

export type SortDirection = 'asc' | 'desc';

/** A value a column can be sorted on. Rows missing one always sort last. */
export type SortValue = string | number | Date | null | undefined;

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

function isEmpty(value: SortValue): boolean {
  return value == null || value === '';
}

/**
 * Compare two present (non-empty) sort values of the same column.
 * Strings compare case- and accent-insensitively, and with `numeric` so
 * "Invoice 2" lands before "Invoice 10".
 */
function compareValues(a: SortValue, b: SortValue): number {
  if (a instanceof Date || b instanceof Date) {
    const da = coerceDate(a as Date | string)?.getTime() ?? 0;
    const dbb = coerceDate(b as Date | string)?.getTime() ?? 0;
    return da - dbb;
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en-US', { sensitivity: 'base', numeric: true });
}

/**
 * Client-side table sorting.
 *
 * Sorting happens in memory rather than through a Dexie index on purpose: with
 * at-rest encryption on, the sortable identity fields (vendor, amount, client
 * company) are ciphertext in IndexedDB and only become readable after the
 * decrypting read hook runs — so an index would order by ciphertext. The row
 * counts here are a single consultant's books, so the cost is negligible.
 *
 * `sortRows` is passed an accessor rather than a field name so a column can sort
 * on something it doesn't literally store — e.g. sorting the Client column by
 * the looked-up company name instead of the raw `clientId`.
 */
export function useTableSort<K extends string>(initialKey: K, initialDirection: SortDirection = 'desc') {
  const [sort, setSort] = useState<SortState<K>>({ key: initialKey, direction: initialDirection });

  /**
   * Clicking the active column flips its direction; clicking a new one starts
   * at that column's natural direction (dates and amounts read best newest /
   * largest first, text best A–Z).
   */
  const toggleSort = useCallback((key: K, defaultDirection: SortDirection = 'asc') => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: defaultDirection },
    );
  }, []);

  const sortRows = useCallback(
    <T,>(rows: T[], accessor: (row: T, key: K) => SortValue): T[] => {
      const dir = sort.direction === 'asc' ? 1 : -1;
      // Array#sort is stable, so equal rows keep the order they arrived in.
      return rows.slice().sort((x, y) => {
        const a = accessor(x, sort.key);
        const b = accessor(y, sort.key);
        const aEmpty = isEmpty(a);
        const bEmpty = isEmpty(b);
        // Blanks sort last in both directions — flipping the sort shouldn't
        // bring a screenful of "—" to the top.
        if (aEmpty || bEmpty) return aEmpty && bEmpty ? 0 : aEmpty ? 1 : -1;
        return dir * compareValues(a, b);
      });
    },
    [sort],
  );

  return useMemo(() => ({ sort, toggleSort, sortRows }), [sort, toggleSort, sortRows]);
}
