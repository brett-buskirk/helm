import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientForm } from '../ClientForm';
import { db } from '../../../db';

beforeEach(async () => {
  await db.clients.clear();
});

describe('ClientForm (integration)', () => {
  it('writes a new client to the database on submit', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<ClientForm isOpen onClose={onClose} onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/company/i), 'Globex');
    await userEvent.type(screen.getByLabelText(/contact name/i), 'Jane Doe');
    await userEvent.type(screen.getByLabelText(/email/i), 'jane@globex.com');
    await userEvent.click(screen.getByRole('button', { name: /create client/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('Client created.'));
    expect(onClose).toHaveBeenCalled();

    const clients = await db.clients.toArray();
    expect(clients).toHaveLength(1);
    expect(clients[0]).toMatchObject({
      company: 'Globex',
      contactName: 'Jane Doe',
      email: 'jane@globex.com',
      status: 'lead',
    });
  });

  it('blocks submit and surfaces validation errors when required fields are empty', async () => {
    const onSuccess = vi.fn();
    render(<ClientForm isOpen onClose={() => {}} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole('button', { name: /create client/i }));

    expect((await screen.findAllByText('Required')).length).toBeGreaterThan(0);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(await db.clients.count()).toBe(0);
  });
});
