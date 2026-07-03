import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MentionTextarea } from '../MentionTextarea';
import { db } from '../../../db';

beforeEach(async () => {
  await Promise.all([
    db.invoices.clear(),
    db.clients.clear(),
    db.projects.clear(),
    db.proposals.clear(),
    db.documents.clear(),
  ]);
});

function Harness() {
  const [v, setV] = useState('');
  return (
    <>
      <MentionTextarea value={v} onChange={setV} />
      <output data-testid="val">{v}</output>
    </>
  );
}

describe('MentionTextarea', () => {
  it('opens a resource picker on @ and inserts a markdown link', async () => {
    await db.invoices.add({
      clientId: 1,
      invoiceNumber: 'INV-0001',
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

    render(<Harness />);
    const textarea = screen.getByRole('textbox');
    await userEvent.click(textarea);
    await userEvent.type(textarea, 'See @INV');

    await userEvent.click(await screen.findByText('INV-0001'));

    expect(screen.getByTestId('val')).toHaveTextContent('[@INV-0001](#/invoices/');
  });

  it('does not open the picker without an @', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole('textbox'), 'hello there');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
