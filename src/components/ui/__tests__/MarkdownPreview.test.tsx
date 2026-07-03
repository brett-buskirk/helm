import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownPreview } from '../MarkdownPreview';

describe('MarkdownPreview', () => {
  it('renders headings, bold, lists, and links', () => {
    render(
      <MarkdownPreview
        content={'# Title\n\n**bold** text\n\n- one\n- two\n\n[link](https://example.com)'}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'link' })).toHaveAttribute('href', 'https://example.com');
  });

  it('shows a placeholder when empty', () => {
    render(<MarkdownPreview content="" />);
    expect(screen.getByText(/nothing to preview/i)).toBeInTheDocument();
  });
});
