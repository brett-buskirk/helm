import type { ReactNode } from 'react';
import { SortableHeader } from './SortableHeader';
import { applySort, type SortDirection, type SortState, type SortValue } from '../../hooks/useTableSort';

export interface TableColumn<T, K extends string = string> {
  key: K;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  /**
   * Supplying this makes the column sortable. It returns the value to sort on,
   * which needn't be what the cell displays — a Status column sorts by its
   * position in the workflow, a Client column by the looked-up company name.
   */
  sortValue?: (row: T) => SortValue;
  /** Direction applied when this column is first clicked. Dates and amounts read best descending. */
  defaultSortDirection?: SortDirection;
}

interface TableProps<T, K extends string = string> {
  columns: TableColumn<T, K>[];
  data: T[];
  getKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  /**
   * Current sort. Passing it (with `onSort`) turns on sorting: headers for
   * columns that declare a `sortValue` become clickable, and `data` is sorted
   * here rather than by the caller, so the accessor lives with the column.
   */
  sort?: SortState<K>;
  onSort?: (key: K, defaultDirection?: SortDirection) => void;
}

export function Table<T, K extends string = string>({
  columns,
  data,
  getKey,
  onRowClick,
  emptyState,
  sort,
  onSort,
}: TableProps<T, K>) {
  const rows =
    sort && onSort
      ? applySort(data, sort, (row, key) => columns.find((c) => c.key === key)?.sortValue?.(row))
      : data;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-800">
            {columns.map((col) =>
              sort && onSort && col.sortValue ? (
                <SortableHeader
                  key={col.key}
                  label={col.header}
                  sortKey={col.key}
                  sort={sort}
                  onSort={onSort}
                  defaultDirection={col.defaultSortDirection}
                  align={col.headerClassName?.includes('text-right') ? 'right' : 'left'}
                />
              ) : (
                <th
                  key={col.key}
                  className={[
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400',
                    col.headerClassName ?? '',
                  ].join(' ')}
                >
                  {col.header}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                {emptyState ?? (
                  <div className="py-16 text-center text-sm text-slate-500">No items yet.</div>
                )}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={getKey(row)}
                onClick={() => onRowClick?.(row)}
                className={[
                  'bg-slate-900 transition-colors',
                  onRowClick ? 'cursor-pointer hover:bg-slate-800/70' : '',
                ].join(' ')}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={['px-4 py-3 text-sm text-slate-300', col.className ?? ''].join(' ')}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
