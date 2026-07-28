import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Security from '../Security';
import { db } from '../../db';

beforeEach(async () => {
  // Encryption off → the page shows the "Enable Encryption" branch.
  await db.security.clear();
});

describe('Security page', () => {
  it('renders the backup and encryption controls', async () => {
    render(<Security />);
    expect(screen.getByRole('heading', { name: 'Data & Backup' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Encryption' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export all data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export encrypted/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import backup/i })).toBeInTheDocument();
    // With encryption off, the enable CTA is shown (not the disable one).
    expect(await screen.findByRole('button', { name: /enable encryption/i })).toBeInTheDocument();
  });

  it('opens the enable-encryption modal with passphrase fields', async () => {
    render(<Security />);
    await userEvent.click(await screen.findByRole('button', { name: /enable encryption/i }));
    await waitFor(() => expect(screen.getByLabelText('Passphrase')).toBeInTheDocument());
    expect(screen.getByLabelText('Confirm passphrase')).toBeInTheDocument();
  });
});
