import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={[
          'w-full rounded-md border bg-slate-900 px-3 py-2 text-sm text-slate-100',
          'placeholder:text-slate-500',
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

Input.displayName = 'Input';
