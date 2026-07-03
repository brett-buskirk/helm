import { forwardRef, useRef, useEffect, useCallback, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  /** Grow to fit content (no inner scrollbar) — good for long descriptions/notes. */
  autoGrow?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = '', autoGrow = false, onChange, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const setRef = useCallback(
      (el: HTMLTextAreaElement | null) => {
        innerRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      },
      [ref],
    );

    const resize = useCallback(() => {
      const el = innerRef.current;
      if (el && autoGrow) {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      }
    }, [autoGrow]);

    // Fit on mount and on every render — catches typing and form-reset population.
    useEffect(() => {
      if (autoGrow) resize();
    });

    return (
      <textarea
        ref={setRef}
        onChange={(e) => {
          onChange?.(e);
          resize();
        }}
        className={[
          'w-full rounded-md border bg-slate-900 px-3 py-2 text-sm text-slate-100',
          'placeholder:text-slate-500',
          autoGrow ? 'resize-none overflow-hidden' : 'resize-y min-h-24',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors',
          error ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 hover:border-slate-600',
          className,
        ].join(' ')}
        {...props}
      />
    );
  },
);

Textarea.displayName = 'Textarea';
