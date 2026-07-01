import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { GettingStarted } from '../GettingStarted';
import { db } from '../../../db';

async function clearDb() {
  await Promise.all([db.clients.clear(), db.projects.clear(), db.invoices.clear(), db.settings.clear()]);
}

beforeEach(async () => {
  localStorage.clear();
  await clearDb();
});

function renderGettingStarted() {
  return render(
    <MemoryRouter>
      <GettingStarted />
    </MemoryRouter>,
  );
}

describe('GettingStarted', () => {
  it('shows the checklist and sample-data offer when the app is empty', async () => {
    renderGettingStarted();
    expect(await screen.findByText('Welcome to Helm')).toBeInTheDocument();
    expect(screen.getByText('Add your first client')).toBeInTheDocument();
    expect(screen.getByText('0 of 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /load sample data/i })).toBeInTheDocument();
  });

  it('stays hidden once every setup step is complete', async () => {
    await db.settings.add({
      businessName: 'Acme LLC',
      ownerName: 'Owner',
      address: '1 St',
      email: 'a@b.co',
      paymentInstructions: 'Net 30',
      defaultRate: 100,
      taxRate: 25,
      invoicePrefix: 'INV-',
      invoiceNextNumber: 1,
      expenseCategories: [],
      updatedAt: new Date(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.clients.add({ company: 'C', status: 'active', createdAt: new Date(), updatedAt: new Date() } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.projects.add({ clientId: 1, name: 'P', type: 'hourly', status: 'active', createdAt: new Date(), updatedAt: new Date() } as any);
    await db.invoices.add({
      clientId: 1,
      invoiceNumber: 'INV-1',
      status: 'draft',
      issueDate: new Date(),
      dueDate: new Date(),
      lineItems: [],
      subtotal: 0,
      taxRate: 0,
      taxAmount: 0,
      total: 0,
      amountPaid: 0,
      balanceDue: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderGettingStarted();
    // Give the live queries a chance to resolve, then confirm it never appears.
    await waitFor(() => expect(screen.queryByText('Welcome to Helm')).not.toBeInTheDocument());
  });

  it('stays dismissed after the user closes it', async () => {
    renderGettingStarted();
    const dismiss = await screen.findByRole('button', { name: /dismiss getting started/i });
    await userEvent.click(dismiss);
    expect(screen.queryByText('Welcome to Helm')).not.toBeInTheDocument();
    expect(localStorage.getItem('helm-onboarding-dismissed')).toBe('1');
  });
});
