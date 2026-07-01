import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { CommandPalette } from '../CommandPalette';

function renderPalette(onClose = () => {}) {
  return render(
    <MemoryRouter>
      <CommandPalette isOpen onClose={onClose} />
    </MemoryRouter>,
  );
}

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    render(
      <MemoryRouter>
        <CommandPalette isOpen={false} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows action and navigation commands with an empty query', () => {
    renderPalette();
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    expect(screen.getByText('New Invoice')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('filters commands as the user types', async () => {
    renderPalette();
    await userEvent.type(screen.getByPlaceholderText('Type a command or search…'), 'expense');
    expect(screen.getByText('Add Expense')).toBeInTheDocument();
    expect(screen.queryByText('New Invoice')).not.toBeInTheDocument();
  });

  it('shows an empty message when nothing matches', async () => {
    renderPalette();
    await userEvent.type(screen.getByPlaceholderText('Type a command or search…'), 'zzzzzznope');
    expect(screen.getByText(/No matches/i)).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    renderPalette(onClose);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
