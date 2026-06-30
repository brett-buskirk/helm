import { forwardRef, type SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, placeholder, options, className = '', ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={[
          'w-full rounded-md border bg-slate-900 px-3 py-2 text-sm text-slate-100',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors appearance-none',
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-slate-700 hover:border-slate-600',
          className,
        ].join(' ')}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  },
);

Select.displayName = 'Select';
