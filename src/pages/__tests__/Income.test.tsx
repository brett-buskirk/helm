import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import Income from '../Income';
import { db } from '../../db';
import type { Payment } from '../../types';

const navigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <Income />
    </MemoryRouter>,
  );
}

/**
 * Source labels as they appear in the table body, top to bottom. The source
 * cell also carries an optional notes line, so read the first paragraph rather
 * than the whole cell's text.
 */
async function sourceOrder(): Promise<string[]> {
  const table = await screen.findByRole('table');
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[1].querySelector('p')?.textContent?.trim() ?? '');
}

function income(partial: Partial<Payment>): Payment {
  const date = new Date();
  return {
    source: 'other',
    taxable: true,
    amount: 100,
    date,
    createdAt: date,
    ...partial,
  } as Payment;
}

beforeEach(async () => {
  navigate.mockClear();
  await db.payments.clear();
  await db.clients.clear();
  await db.invoices.clear();

  const acme = (await db.clients.add({
    company: 'Acme Corp',
    contactName: 'A',
    email: 'a@acme.test',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never)) as number;

  // Dated today so the default "This Year" period includes them.
  await db.payments.bulkAdd([
    income({ source: 'invoice', taxable: true, amount: 5000, clientId: acme, invoiceId: 42, method: 'ACH' }),
    income({ source: 'owner-contribution', taxable: false, amount: 1000, method: 'Transfer' }),
    income({ source: 'cashback', taxable: false, amount: 250, notes: 'Amex rewards' }),
  ] as never[]);
});

describe('Income page', () => {
  it('lists every deposit, invoice payments included', async () => {
    renderPage();
    expect((await sourceOrder()).sort()).toEqual(
      ["Cashback / rebate", "Invoice payment", "Owner's contribution"].sort(),
    );
  });

  it('separates revenue from total money in', async () => {
    renderPage();
    // Only the invoice payment is taxable: revenue 5000, money in 6250.
    // ($5,000 shows twice — as the Revenue total and on its own row.)
    expect((await screen.findAllByText('$5,000.00')).length).toBeGreaterThan(0);
    expect(await screen.findByText('$6,250.00')).toBeInTheDocument();
    expect(await screen.findByText('$1,250.00')).toBeInTheDocument(); // non-revenue
  });

  it('marks each row taxable or not', async () => {
    renderPage();
    // Scoped to the table: the per-source breakdown chips carry their own
    // "not taxed" markers above it.
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Taxable')).toBeInTheDocument();
    expect(within(table).getAllByText('Not taxed')).toHaveLength(2);
  });

  it('filters to non-taxable income only', async () => {
    renderPage();
    await userEvent.selectOptions(
      await screen.findByLabelText('Filter by tax treatment'),
      'Non-taxable only',
    );
    expect((await sourceOrder()).sort()).toEqual(["Cashback / rebate", "Owner's contribution"].sort());
  });

  it('filters by source', async () => {
    renderPage();
    await userEvent.selectOptions(await screen.findByLabelText('Filter by source'), 'Cashback / rebate');
    expect(await sourceOrder()).toEqual(['Cashback / rebate']);
  });

  it('sorts by amount, largest first', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    await userEvent.click(within(table).getByRole('button', { name: /^Amount/ }));
    expect(await sourceOrder()).toEqual([
      'Invoice payment',
      "Owner's contribution",
      'Cashback / rebate',
    ]);
  });

  it('keeps invoice payments read-only and links to the invoice instead', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    // Two manual rows are editable; the invoice-backed row is not.
    expect(within(table).getAllByRole('button', { name: 'Edit income' })).toHaveLength(2);
    expect(within(table).getAllByRole('button', { name: 'Delete income' })).toHaveLength(2);

    await userEvent.click(within(table).getByRole('button', { name: 'View invoice' }));
    expect(navigate).toHaveBeenCalledWith('/invoices/42');
  });

  it('explains the empty state when nothing is recorded', async () => {
    await db.payments.clear();
    renderPage();
    expect(await screen.findByText('No income yet')).toBeInTheDocument();
  });
});
