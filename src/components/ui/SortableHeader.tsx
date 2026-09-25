import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import type { SortDirection, SortState } from '../../hooks/useTableSort';

const TH_BASE = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500';

interface SortableHeaderProps<K extends string> {
  label: string;
  /** Omit to render a plain, non-sortable header cell (e.g. the actions column). */
  sortKey?: K;
  sort: SortState<K>;
  onSort: (key: K, defaultDirection?: SortDirection) => void;
  /** Direction applied when this column is first clicked. Dates/amounts read best descending. */
  defaultDirection?: SortDirection;
  align?: 'left' | 'right';
}

/**
 * A table header cell that sorts its column. Carries `aria-sort` so screen
 * readers announce the active column and direction, and the button label spells
 * out what a click will do rather than relying on the chevron alone.
 */
export function SortableHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  defaultDirection = 'asc',
  align = 'left',
}: SortableHeaderProps<K>) {
  const alignClass = align === 'right' ? 'text-right' : 'text-left';

  if (!sortKey) {
    return <th className={`${TH_BASE} ${alignClass}`}>{label}</th>;
  }

  const isActive = sort.key === sortKey;
  const direction = isActive ? sort.direction : undefined;
  const nextDirection: SortDirection = isActive
    ? sort.direction === 'asc'
      ? 'desc'
      : 'asc'
    : defaultDirection;

  const Icon = !isActive ? ChevronsUpDown : direction === 'asc' ? ChevronUp : ChevronDown;

  return (
    <th
      className={`${TH_BASE} ${alignClass} p-0`}
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey, defaultDirection)}
        aria-label={`${label} — sort ${nextDirection === 'asc' ? 'ascending' : 'descending'}`}
        className={[
          'group flex w-full items-center gap-1.5 px-4 py-2.5 transition-colors',
          align === 'right' ? 'justify-end' : 'justify-start',
          isActive ? 'text-slate-300' : 'hover:text-slate-300',
        ].join(' ')}
      >
        <span className="uppercase tracking-wider">{label}</span>
        <Icon
          size={13}
          className={[
            'shrink-0 transition-opacity',
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
          ].join(' ')}
        />
      </button>
    </th>
  );
}
