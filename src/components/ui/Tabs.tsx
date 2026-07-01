import { useRef } from 'react';

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
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].key);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className={['flex gap-1 border-b border-slate-700', className].join(' ')} role="tablist">
      {items.map((item, idx) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.key)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
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
                  isActive ? 'bg-indigo-900 text-indigo-300' : 'bg-slate-800 text-slate-400',
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
