import { forwardRef, useRef, useState, useCallback, useMemo } from 'react';
import { useMentionItems, type MentionItem } from '../../hooks/useMentionItems';
import { getCaretCoordinates } from '../../utils/caret';

interface Props {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
  wrapperClassName?: string;
  spellCheck?: boolean;
}

interface MentionState {
  open: boolean;
  query: string;
  start: number;
  index: number;
  top: number;
  left: number;
}

const CLOSED: MentionState = { open: false, query: '', start: -1, index: 0, top: 0, left: 0 };

/**
 * A textarea that opens a resource picker when you type "@", inserting a
 * markdown link (e.g. `[@INV-0001](#/invoices/1)`) that resolves in the preview
 * and PDF. Controlled via value/onChange; forwards the inner textarea ref.
 */
export const MentionTextarea = forwardRef<HTMLTextAreaElement, Props>(function MentionTextarea(
  { value, onChange, className, wrapperClassName, ...rest },
  ref,
) {
  const items = useMentionItems();
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const [m, setM] = useState<MentionState>(CLOSED);

  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    },
    [ref],
  );

  const filtered = useMemo(() => {
    if (!m.open) return [];
    const q = m.query.toLowerCase();
    // Cap per group so every resource type can appear (not just the first types).
    const perGroup: Record<string, number> = {};
    const out: MentionItem[] = [];
    for (const item of items) {
      if (!item.label.toLowerCase().includes(q)) continue;
      const n = (perGroup[item.group] ?? 0) + 1;
      perGroup[item.group] = n;
      if (n <= 6) out.push(item);
    }
    return out;
  }, [m.open, m.query, items]);

  const detect = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? 0;
    const match = el.value.slice(0, pos).match(/(?:^|\s)@([\w.-]*)$/);
    if (match) {
      const query = match[1];
      const start = pos - query.length - 1;
      const caret = getCaretCoordinates(el, start);
      setM({ open: true, query, start, index: 0, top: caret.top - el.scrollTop + caret.height, left: caret.left });
    } else {
      setM((s) => (s.open ? CLOSED : s));
    }
  }, []);

  const insert = useCallback(
    (item: MentionItem) => {
      const el = innerRef.current;
      const link = `[@${item.label}](${item.href})`;
      const next = value.slice(0, m.start) + link + ' ' + value.slice(m.start + 1 + m.query.length);
      onChange(next);
      setM(CLOSED);
      requestAnimationFrame(() => {
        if (el) {
          const cur = m.start + link.length + 1;
          el.focus();
          el.setSelectionRange(cur, cur);
        }
      });
    },
    [value, onChange, m.start, m.query],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (!m.open || filtered.length === 0) {
      if (e.key === 'Escape' && m.open) setM(CLOSED);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setM((s) => ({ ...s, index: (s.index + 1) % filtered.length }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setM((s) => ({ ...s, index: (s.index - 1 + filtered.length) % filtered.length }));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insert(filtered[m.index]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setM(CLOSED);
    }
  }

  return (
    <div className={['relative', wrapperClassName].filter(Boolean).join(' ')}>
      <textarea
        {...rest}
        ref={setRefs}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          detect();
        }}
        onKeyDown={onKeyDown}
        onClick={detect}
        onBlur={() => window.setTimeout(() => setM(CLOSED), 120)}
        className={className}
      />
      {m.open && filtered.length > 0 && (
        <ul
          role="listbox"
          aria-label="Link a resource"
          className="absolute z-30 max-h-56 w-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-2xl"
          style={{ top: m.top, left: m.left }}
        >
          {filtered.map((item, i) => (
            <li key={item.id} role="option" aria-selected={i === m.index}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(item);
                }}
                onMouseEnter={() => setM((s) => ({ ...s, index: i }))}
                className={[
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
                  i === m.index ? 'bg-slate-700' : 'hover:bg-slate-700/60',
                ].join(' ')}
              >
                <span className="shrink-0 rounded bg-slate-700 px-1 py-0.5 text-[10px] uppercase text-slate-400">
                  {item.group}
                </span>
                <span className="flex-1 truncate text-slate-200">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
