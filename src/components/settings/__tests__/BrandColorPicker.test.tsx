import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrandColorPicker } from '../BrandColorPicker';

describe('BrandColorPicker', () => {
  it('commits a valid typed hex, normalized', async () => {
    const onChange = vi.fn();
    render(<BrandColorPicker value="#6366f1" onChange={onChange} />);
    const hex = screen.getByLabelText('Brand color hex');
    await userEvent.clear(hex);
    await userEvent.type(hex, '0af');
    expect(onChange).toHaveBeenLastCalledWith('#00aaff');
  });

  it('does not commit an incomplete hex', async () => {
    const onChange = vi.fn();
    render(<BrandColorPicker value="#6366f1" onChange={onChange} />);
    const hex = screen.getByLabelText('Brand color hex');
    await userEvent.clear(hex);
    await userEvent.type(hex, '#12');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies a preset swatch', async () => {
    const onChange = vi.fn();
    render(<BrandColorPicker value="#6366f1" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Use #10b981'));
    expect(onChange).toHaveBeenCalledWith('#10b981');
  });
});
