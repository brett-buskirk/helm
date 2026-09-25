import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Expenses from '../Expenses';
import { db } from '../../db';
import type { Expense } from '../../types';

/**
 * Sort buttons are queried inside the table on purpose: the ExpenseForm drawer
 * stays mounted while closed and its DatePicker renders a button whose name
 * also starts with "Date", which would make a page-wide query ambiguous.
 */
async function sortButton(label: string) {
  const table = await screen.findByRole('table');
  return within(table).getByRole('button', { name: new RegExp(`^${label}`) });
}

/** Vendor names as they currently appear in the table body, top to bottom. */
async function vendorOrder(): Promise<string[]> {
  const table = await screen.findByRole('table');
  const rows = within(table).getAllByRole('row').slice(1); // drop the header row
  return rows.map((r) => within(r).getAllByRole('cell')[1].textContent?.split('\n')[0]?.trim() ?? '');
}

function expense(partial: Partial<Expense> & Pick<Expense, 'vendor' | 'date' | 'amount'>): Expense {
  const now = new Date('2026-06-01');
  return {
    category: 'Other',
    deductible: true,
    billable: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  } as Expense;
}

beforeEach(async () => {
  await db.expenses.clear();
  await db.clients.clear();
  await db.settings.clear();

  const acme = (await db.clients.add({
    company: 'Acme Corp',
    contactName: 'A',
    email: 'a@acme.test',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never)) as number;

  await db.expenses.bulkAdd([
    expense({ vendor: 'Zeta Hosting', date: new Date('2026-01-10'), amount: 300, category: 'Utilities & Internet' }),
    expense({ vendor: 'Alpha Tools', date: new Date('2026-03-15'), amount: 50, category: 'Software & Subscriptions', clientId: acme, billable: true }),
    expense({ vendor: 'Mid Supply', date: new Date('2026-02-20'), amount: 120, category: 'Office & Supplies', deductible: false }),
  ] as never[]);
});

/** The seeded data spans Jan–Mar 2026, so every test views All Time. */
async function renderAllTime() {
  render(<Expenses />);
  await userEvent.click(await screen.findByRole('button', { name: 'All Time' }));
}

describe('Expenses table sorting', () => {
  it('defaults to newest-first by date', async () => {
    await renderAllTime();
    expect(await vendorOrder()).toEqual(['Alpha Tools', 'Mid Supply', 'Zeta Hosting']);
  });

  it('flips to oldest-first when the Date header is clicked', async () => {
    await renderAllTime();
    await userEvent.click(await sortButton('Date'));
    expect(await vendorOrder()).toEqual(['Zeta Hosting', 'Mid Supply', 'Alpha Tools']);
  });

  it('sorts by vendor A–Z, then Z–A', async () => {
    await renderAllTime();
    await userEvent.click(await sortButton('Vendor'));
    expect(await vendorOrder()).toEqual(['Alpha Tools', 'Mid Supply', 'Zeta Hosting']);

    await userEvent.click(await sortButton('Vendor'));
    expect(await vendorOrder()).toEqual(['Zeta Hosting', 'Mid Supply', 'Alpha Tools']);
  });

  it('sorts by amount, largest first', async () => {
    await renderAllTime();
    await userEvent.click(await sortButton('Amount'));
    expect(await vendorOrder()).toEqual(['Zeta Hosting', 'Mid Supply', 'Alpha Tools']);
  });

  it('sorts by client, leaving expenses with no client last', async () => {
    await renderAllTime();
    await userEvent.click(await sortButton('Client'));
    // Only Alpha Tools has a client; the other two are blank and sort last.
    expect((await vendorOrder())[0]).toBe('Alpha Tools');
  });
});

describe('Expenses filters', () => {
  it('filters by client', async () => {
    await renderAllTime();
    await userEvent.selectOptions(screen.getByLabelText('Filter by client'), 'Acme Corp');
    expect(await vendorOrder()).toEqual(['Alpha Tools']);
  });

  it('filters to expenses with no client', async () => {
    await renderAllTime();
    await userEvent.selectOptions(screen.getByLabelText('Filter by client'), 'No client');
    expect(await vendorOrder()).toEqual(['Mid Supply', 'Zeta Hosting']);
  });

  it('filters by tag', async () => {
    await renderAllTime();
    await userEvent.selectOptions(screen.getByLabelText('Filter by tag'), 'Non-deductible');
    expect(await vendorOrder()).toEqual(['Mid Supply']);

    await userEvent.selectOptions(screen.getByLabelText('Filter by tag'), 'Billable');
    expect(await vendorOrder()).toEqual(['Alpha Tools']);
  });

  it('filters by category', async () => {
    await renderAllTime();
    await userEvent.selectOptions(screen.getByLabelText('Filter by category'), 'Office & Supplies');
    expect(await vendorOrder()).toEqual(['Mid Supply']);
  });

  it('keeps the summary total tied to the filters, not the sort order', async () => {
    await renderAllTime();
    // 300 + 50 + 120 = 470 across all three rows, in any sort order.
    expect(await screen.findByText('$470.00')).toBeInTheDocument();
    await userEvent.click(await sortButton('Amount'));
    expect(await screen.findByText('$470.00')).toBeInTheDocument();

    // Filtering does move the total. ($120 shows twice here — as the Total and
    // as the Non-Deductible subtotal — so match all occurrences.)
    await userEvent.selectOptions(screen.getByLabelText('Filter by tag'), 'Non-deductible');
    expect((await screen.findAllByText('$120.00')).length).toBeGreaterThan(0);
    expect(screen.queryByText('$470.00')).not.toBeInTheDocument();
  });

  it('explains an empty result when combined filters exclude everything', async () => {
    await renderAllTime();
    // Zeta Hosting is the only Utilities expense, and it isn't billable.
    await userEvent.selectOptions(screen.getByLabelText('Filter by category'), 'Utilities & Internet');
    await userEvent.selectOptions(screen.getByLabelText('Filter by tag'), 'Billable');
    expect(await screen.findByText('No expenses match your filters')).toBeInTheDocument();
  });
});
