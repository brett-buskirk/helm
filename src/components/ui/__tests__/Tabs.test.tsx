import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from '../Tabs';

const items = [
  { key: 'a', label: 'Alpha' },
  { key: 'b', label: 'Beta' },
  { key: 'c', label: 'Gamma' },
];

describe('Tabs', () => {
  it('marks the active tab selected with a roving tabindex', () => {
    render(<Tabs items={items} active="b" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves to the next tab on ArrowRight and wraps around', async () => {
    const onChange = vi.fn();
    render(<Tabs items={items} active="c" onChange={onChange} />);
    screen.getByRole('tab', { name: 'Gamma' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('moves to the previous tab on ArrowLeft', async () => {
    const onChange = vi.fn();
    render(<Tabs items={items} active="b" onChange={onChange} />);
    screen.getByRole('tab', { name: 'Beta' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('jumps to first/last with Home and End', async () => {
    const onChange = vi.fn();
    render(<Tabs items={items} active="b" onChange={onChange} />);
    screen.getByRole('tab', { name: 'Beta' }).focus();
    await userEvent.keyboard('{Home}');
    expect(onChange).toHaveBeenCalledWith('a');
    await userEvent.keyboard('{End}');
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('activates a tab on click', async () => {
    const onChange = vi.fn();
    render(<Tabs items={items} active="a" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Gamma' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });
});
