type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-indigo-950 text-indigo-300 ring-indigo-800',
  success: 'bg-emerald-950 text-emerald-300 ring-emerald-800',
  warning: 'bg-amber-950 text-amber-300 ring-amber-800',
  danger: 'bg-red-950 text-red-300 ring-red-800',
  info: 'bg-sky-950 text-sky-300 ring-sky-800',
  neutral: 'bg-slate-800 text-slate-300 ring-slate-700',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
