import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden">
        body
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('exposes an accessible dialog named by its title', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Edit Client">
        body
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Edit Client' })).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Hi">
        body
      </Modal>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Hi">
        body
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('moves focus into the dialog on open (focus trap)', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Hi">
        <button>Inside</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('puts the body in a height-capped, scrollable container (long content stays in the viewport)', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Long">
        <p>body content</p>
      </Modal>,
    );
    const body = screen.getByText('body content').parentElement;
    expect(body?.className).toContain('overflow-y-auto');
    const panel = screen.getByRole('dialog').querySelector('.max-h-\\[90vh\\]');
    expect(panel).not.toBeNull();
  });
});
