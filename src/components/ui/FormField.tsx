import { useId, cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className = '',
}: FormFieldProps) {
  const autoId = useId();
  const fieldId = htmlFor ?? autoId;
  const hintId = hint && !error ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  // When the caller hasn't wired an id themselves, associate the label with the
  // field and connect hint/error text + validity for screen readers — automatically,
  // for every form that uses FormField.
  let field = children;
  if (!htmlFor && isValidElement(children)) {
    const el = children as ReactElement<Record<string, unknown>>;
    field = cloneElement(el, {
      id: el.props.id ?? fieldId,
      'aria-describedby': el.props['aria-describedby'] ?? describedBy,
      'aria-invalid': error ? true : el.props['aria-invalid'],
      'aria-required': required || undefined,
    });
  }

  return (
    <div className={['flex flex-col gap-1.5', className].join(' ')}>
      <label htmlFor={fieldId} className="text-sm font-medium text-slate-300">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>
      {field}
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
