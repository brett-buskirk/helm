import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from '../DatePicker';

describe('DatePicker', () => {
  it('opens, selects a day, reports YYYY-MM-DD, and closes', async () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-07-15" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /jul 15/i }));
    const dialog = screen.getByRole('dialog', { name: 'Choose date' });
    expect(dialog).toBeVisible();

    await userEvent.click(within(dialog).getByText('20'));
    expect(onChange).toHaveBeenCalledWith('2026-07-20');
    expect(screen.queryByRole('dialog', { name: 'Choose date' })).not.toBeInTheDocument();
  });

  it('clears the date via the field clear button', async () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-07-15" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Clear date' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows no clear button when empty', () => {
    render(<DatePicker value="" onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Clear date' })).not.toBeInTheDocument();
  });

  it('closes on Escape without selecting', async () => {
    const onChange = vi.fn();
    render(<DatePicker value="" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('dialog', { name: 'Choose date' })).toBeVisible();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Choose date' })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
