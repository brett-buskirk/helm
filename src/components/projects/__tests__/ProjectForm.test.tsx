import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectForm } from '../ProjectForm';

describe('ProjectForm', () => {
  it('clears the fee field when reopened for a new project (no carry-over)', async () => {
    const props = { isOpen: true, onClose: vi.fn(), onSuccess: vi.fn() };
    const { rerender } = render(<ProjectForm {...props} />);

    const fee = screen.getByLabelText(/project fee/i);
    await userEvent.type(fee, '5000');
    expect(fee).toHaveValue(5000);

    // Close, then reopen for another new project — the fee must not carry over.
    rerender(<ProjectForm {...props} isOpen={false} />);
    rerender(<ProjectForm {...props} isOpen />);

    expect(screen.getByLabelText(/project fee/i)).toHaveValue(null);
  });
});
