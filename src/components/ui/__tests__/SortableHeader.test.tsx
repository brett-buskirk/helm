import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SortableHeader } from '../SortableHeader';
import type { SortState } from '../../../hooks/useTableSort';

type Key = 'date' | 'vendor';

function renderHeader(sort: SortState<Key>, onSort = vi.fn()) {
  render(
    <table>
      <thead>
        <tr>
          <SortableHeader<Key> label="Date" sortKey="date" defaultDirection="desc" sort={sort} onSort={onSort} />
          <SortableHeader<Key> label="Vendor" sortKey="vendor" sort={sort} onSort={onSort} />
          <SortableHeader<Key> label="Tags" sort={sort} onSort={onSort} />
        </tr>
      </thead>
    </table>,
  );
  return onSort;
}

describe('SortableHeader', () => {
  it('marks only the active column with aria-sort', () => {
    renderHeader({ key: 'date', direction: 'desc' });
    expect(screen.getByRole('columnheader', { name: /date/i })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByRole('columnheader', { name: /vendor/i })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it('reports ascending when the active column is sorted ascending', () => {
    renderHeader({ key: 'vendor', direction: 'asc' });
    expect(screen.getByRole('columnheader', { name: /vendor/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('labels the button with the direction the next click will apply', () => {
    renderHeader({ key: 'date', direction: 'desc' });
    // Active + descending → clicking again goes ascending.
    expect(screen.getByRole('button', { name: 'Date — sort ascending' })).toBeInTheDocument();
    // Inactive → clicking applies the column's declared default (asc for Vendor).
    expect(screen.getByRole('button', { name: 'Vendor — sort ascending' })).toBeInTheDocument();
  });

  it('passes the column key and its default direction to onSort', async () => {
    const onSort = renderHeader({ key: 'vendor', direction: 'asc' });
    await userEvent.click(screen.getByRole('button', { name: /^Date/ }));
    expect(onSort).toHaveBeenCalledWith('date', 'desc');
  });

  it('renders a plain header with no button when no sortKey is given', () => {
    renderHeader({ key: 'date', direction: 'asc' });
    const tags = screen.getByRole('columnheader', { name: 'Tags' });
    expect(tags).toBeInTheDocument();
    expect(tags).not.toHaveAttribute('aria-sort');
    expect(screen.queryByRole('button', { name: /tags/i })).not.toBeInTheDocument();
  });
});
