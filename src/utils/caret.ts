const MIRROR_PROPS = [
  'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
  'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent',
  'letterSpacing', 'wordSpacing', 'tabSize', 'whiteSpace', 'wordWrap',
] as const;

/**
 * Pixel position of the caret within a textarea (relative to its box), via a
 * hidden mirror element. Used to anchor the @-mention dropdown near the caret.
 */
export function getCaretCoordinates(
  el: HTMLTextAreaElement,
  position: number,
): { top: number; left: number; height: number } {
  const computed = window.getComputedStyle(el);
  const div = document.createElement('div');
  const style = div.style as unknown as Record<string, string>;
  const src = computed as unknown as Record<string, string>;
  style.position = 'absolute';
  style.visibility = 'hidden';
  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';
  for (const prop of MIRROR_PROPS) style[prop] = src[prop];

  div.textContent = el.value.slice(0, position);
  const span = document.createElement('span');
  span.textContent = el.value.slice(position) || '.';
  div.appendChild(span);
  document.body.appendChild(div);
  const top = span.offsetTop + (parseInt(computed.borderTopWidth, 10) || 0);
  const left = span.offsetLeft + (parseInt(computed.borderLeftWidth, 10) || 0);
  const height = parseInt(computed.lineHeight, 10) || parseInt(computed.fontSize, 10) || 16;
  document.body.removeChild(div);
  return { top, left, height };
}
