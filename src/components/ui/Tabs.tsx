interface TabItem {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ items, active, onChange, className = '' }: TabsProps) {
  return (
    <div
      className={['flex gap-1 border-b border-slate-700', className].join(' ')}
      role="tablist"
    >
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.key)}
            className={[
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px',
              isActive
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-200',
            ].join(' ')}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={[
                  'rounded-full px-1.5 py-0.5 text-xs font-medium',
                  isActive
                    ? 'bg-indigo-900 text-indigo-300'
                    : 'bg-slate-800 text-slate-400',
                ].join(' ')}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
