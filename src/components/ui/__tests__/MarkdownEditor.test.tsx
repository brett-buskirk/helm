import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarkdownEditor } from '../MarkdownEditor';

describe('MarkdownEditor', () => {
  it('toggles between write (textarea) and rendered preview', async () => {
    render(<MarkdownEditor value={'# Heading'} onChange={() => {}} />);

    expect(screen.getByRole('textbox')).toHaveValue('# Heading');

    await userEvent.click(screen.getByRole('button', { name: /preview/i }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /write/i }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('reports edits via onChange in write mode', async () => {
    const onChange = vi.fn();
    render(<MarkdownEditor value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'x');
    expect(onChange).toHaveBeenCalled();
  });
});
