import type { ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface TableProps<T,> {
  columns: TableColumn<T>[];
  data: T[];
  getKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
}

export function Table<T,>({
  columns,
  data,
  getKey,
  onRowClick,
  emptyState,
}: TableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-800">
            {columns.map((col) => (
              <th
                key={col.key}
                className={[
                  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400',
                  col.headerClassName ?? '',
                ].join(' ')}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                {emptyState ?? (
                  <div className="py-16 text-center text-sm text-slate-500">No items yet.</div>
                )}
              </td>
            </tr>
          ) : (
            data.map((row) => (
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
