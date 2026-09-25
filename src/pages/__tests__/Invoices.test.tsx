import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import Invoices from '../Invoices';
import { db } from '../../db';
import type { Invoice } from '../../types';

const navigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <Invoices />
    </MemoryRouter>,
  );
}

/**
 * Invoice numbers as they appear in the table body, top to bottom.
 *
 * Waits for the expected row count first: the table renders its empty state
 * immediately while `useLiveQuery` is still resolving, so reading straight away
 * sees one placeholder row rather than the data.
 */
async function numberOrder(expected: number): Promise<string[]> {
  const table = await screen.findByRole('table');
  await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(expected + 1));
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0].textContent?.trim() ?? '');
}

async function sortButton(label: string) {
  const table = await screen.findByRole('table');
  return within(table).getByRole('button', { name: new RegExp(`^${label}`) });
}

function invoice(over: Partial<Invoice>): Invoice {
  return {
    clientId: 1,
    status: 'draft',
    lineItems: [],
    subtotal: 0,
    taxRate: 0,
    taxAmount: 0,
    total: 1000,
    amountPaid: 0,
    balanceDue: 1000,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Invoice;
}

beforeEach(async () => {
  navigate.mockClear();
  await db.invoices.clear();
  await db.clients.clear();
  await db.payments.clear();

  await db.clients.add({
    id: 1,
    company: 'Patriot Consulting',
    contactName: 'Dana',
    email: 'dana@patriot.test',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never);
});

describe('Invoices ordering', () => {
  it('lists newest-issued first by default', async () => {
    await db.invoices.bulkAdd([
      invoice({ invoiceNumber: 'INV-0001', issueDate: new Date(2026, 6, 23), dueDate: new Date(2026, 7, 22) }),
      invoice({ invoiceNumber: 'INV-0002', issueDate: new Date(2026, 8, 4), dueDate: new Date(2026, 9, 4) }),
      invoice({ invoiceNumber: 'INV-0003', issueDate: new Date(2026, 8, 25), dueDate: new Date(2026, 9, 25) }),
    ] as never[]);

    renderPage();
    expect(await numberOrder(3)).toEqual(['INV-0003', 'INV-0002', 'INV-0001']);
  });

  it('orders correctly even when a restored row holds its date as a string', async () => {
    // Reproduces the reported bug exactly: a database restored before the
    // date-type fix has some dates as ISO strings, and IndexedDB orders keys by
    // TYPE before value — so `orderBy('issueDate').reverse()` rendered
    // INV-0001, INV-0003, INV-0002. Sorting in memory through coerceDate makes
    // the list correct whether or not the stored data has been repaired.
    await db.invoices.bulkAdd([
      invoice({ invoiceNumber: 'INV-0001', issueDate: '2026-07-23T00:00:00' as never, dueDate: '2026-08-22T00:00:00' as never }),
      invoice({ invoiceNumber: 'INV-0002', issueDate: new Date(2026, 8, 4), dueDate: new Date(2026, 9, 4) }),
      invoice({ invoiceNumber: 'INV-0003', issueDate: new Date(2026, 8, 25), dueDate: new Date(2026, 9, 25) }),
    ] as never[]);

    renderPage();
    expect(await numberOrder(3)).toEqual(['INV-0003', 'INV-0002', 'INV-0001']);
  });
});

describe('Invoices sorting', () => {
  beforeEach(async () => {
    await db.invoices.bulkAdd([
      invoice({
        invoiceNumber: 'INV-0001', issueDate: new Date(2026, 6, 23), dueDate: new Date(2026, 7, 22),
        total: 2000, amountPaid: 2000, balanceDue: 0, status: 'paid',
      }),
      invoice({
        invoiceNumber: 'INV-0002', issueDate: new Date(2026, 8, 4), dueDate: new Date(2026, 9, 4),
        total: 5000, balanceDue: 5000, status: 'draft',
      }),
      invoice({
        invoiceNumber: 'INV-0003', issueDate: new Date(2026, 8, 25), dueDate: new Date(2026, 9, 25),
        total: 2400, balanceDue: 2400, status: 'sent',
      }),
    ] as never[]);
  });

  it('sorts by invoice number', async () => {
    renderPage();
    await userEvent.click(await sortButton('Invoice #'));
    expect(await numberOrder(3)).toEqual(['INV-0001', 'INV-0002', 'INV-0003']);

    await userEvent.click(await sortButton('Invoice #'));
    expect(await numberOrder(3)).toEqual(['INV-0003', 'INV-0002', 'INV-0001']);
  });

  it('flips the issue date to oldest-first', async () => {
    renderPage();
    await userEvent.click(await sortButton('Issued'));
    expect(await numberOrder(3)).toEqual(['INV-0001', 'INV-0002', 'INV-0003']);
  });

  it('sorts by total, largest first', async () => {
    renderPage();
    await userEvent.click(await sortButton('Total'));
    expect(await numberOrder(3)).toEqual(['INV-0002', 'INV-0003', 'INV-0001']);
  });

  it('sorts by balance, largest first', async () => {
    renderPage();
    await userEvent.click(await sortButton('Balance'));
    // INV-0001 is fully paid, so its balance is 0 and it lands last.
    expect(await numberOrder(3)).toEqual(['INV-0002', 'INV-0003', 'INV-0001']);
  });

  it('sorts status by workflow position, not alphabetically', async () => {
    renderPage();
    await userEvent.click(await sortButton('Status'));
    // draft → sent → paid, rather than Draft, Paid, Sent.
    expect(await numberOrder(3)).toEqual(['INV-0002', 'INV-0003', 'INV-0001']);
  });

  it('marks the active column for screen readers', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    // Issued is the default sort, descending.
    expect(within(table).getByRole('columnheader', { name: /issued/i })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await userEvent.click(await sortButton('Total'));
    expect(within(table).getByRole('columnheader', { name: /total/i })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(within(table).getByRole('columnheader', { name: /issued/i })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it('leaves the actions column unsortable', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    expect(headers[headers.length - 1]).not.toHaveAttribute('aria-sort');
  });

  it('keeps sorting applied within a status filter', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Paid' }));
    expect(await numberOrder(1)).toEqual(['INV-0001']);
  });
});
