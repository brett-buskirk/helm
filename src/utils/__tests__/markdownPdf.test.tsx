import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { decode, renderMarkdownPdf } from '../markdownPdf';

/** Collect all rendered text from a @react-pdf element tree. */
function collectText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectText).join('');
  // React element
  const props = (node as { props?: { children?: ReactNode } }).props;
  return props ? collectText(props.children) : '';
}

describe('decode', () => {
  it('decodes the entities marked emits', () => {
    expect(decode('&quot;SOW&quot;')).toBe('"SOW"');
    expect(decode('Fees &amp; taxes')).toBe('Fees & taxes');
    expect(decode('&lt;tag&gt;')).toBe('<tag>');
    expect(decode('it&#39;s')).toBe("it's");
    expect(decode('a &#x27;b&#x27;')).toBe("a 'b'");
  });

  it('decodes &amp; last so a literal escaped entity round-trips', () => {
    // Source text of a literal `&quot;` is escaped by marked to `&amp;quot;`.
    expect(decode('&amp;quot;')).toBe('&quot;');
  });

  it('leaves plain text untouched', () => {
    expect(decode('nothing to decode')).toBe('nothing to decode');
  });
});

describe('renderMarkdownPdf', () => {
  it('renders quotes and ampersands literally, not as HTML entities', () => {
    const els = renderMarkdownPdf('Statements of Work ("SOW") & related fees.');
    const text = els.map((e) => collectText(e)).join(' ');
    expect(text).toContain('"SOW"');
    expect(text).toContain('& related');
    expect(text).not.toContain('&quot;');
    expect(text).not.toContain('&amp;');
  });
});
