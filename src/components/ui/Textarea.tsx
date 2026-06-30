import { forwardRef, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={[
          'w-full rounded-md border bg-slate-900 px-3 py-2 text-sm text-slate-100',
          'placeholder:text-slate-500 resize-y min-h-24',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors',
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-slate-700 hover:border-slate-600',
          className,
        ].join(' ')}
        {...props}
      />
    );
  },
);

Textarea.displayName = 'Textarea';
