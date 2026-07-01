import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from '../FormField';

describe('FormField', () => {
  it('associates the label with the field automatically', () => {
    render(
      <FormField label="Company">
        <input type="text" />
      </FormField>,
    );
    // getByLabelText only resolves if the <label> is wired to the input.
    expect(screen.getByLabelText('Company')).toBeInTheDocument();
  });

  it('marks the field invalid and announces the error', () => {
    render(
      <FormField label="Email" error="Required">
        <input type="text" />
      </FormField>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(input).toHaveAccessibleDescription('Required');
  });

  it('links a hint to the field via aria-describedby', () => {
    render(
      <FormField label="Rate" hint="Per hour">
        <input type="text" />
      </FormField>,
    );
    expect(screen.getByLabelText('Rate')).toHaveAccessibleDescription('Per hour');
  });

  it('sets aria-required when required', () => {
    render(
      <FormField label="Name" required>
        <input type="text" />
      </FormField>,
    );
    expect(screen.getByLabelText(/Name/)).toHaveAttribute('aria-required', 'true');
  });

  it('respects a caller-provided htmlFor without overriding it', () => {
    render(
      <FormField label="Custom" htmlFor="my-id">
        <input id="my-id" type="text" />
      </FormField>,
    );
    expect(screen.getByLabelText('Custom')).toHaveAttribute('id', 'my-id');
  });
});
