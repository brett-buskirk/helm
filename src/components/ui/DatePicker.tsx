import { useState, useRef, useEffect } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { monthGrid } from '../../utils/date';
import { parseDateInput, toDateInputValue, formatDate } from '../../utils/format';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface DatePickerProps {
  /** 'YYYY-MM-DD' or '' */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  hasError?: boolean;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * A closable, keyboard-navigable date picker used in place of the native
 * `<input type="date">` (whose popup can't be dismissed in the WSL WebKit
 * webview). Controlled via 'YYYY-MM-DD' strings to match the form date flow.
 */
export function DatePicker({ value, onChange, id, placeholder = 'Select a date', hasError }: DatePickerProps) {
  const selected = value ? parseDateInput(value) ?? null : null;
  const [open, setOpen] = useState(false);
  const [focusDay, setFocusDay] = useState<Date>(selected ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dayRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const today = new Date();

  // Re-anchor the calendar to the selected date each time it opens.
  useEffect(() => {
    if (open) setFocusDay(selected ?? new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Move DOM focus to the active day as it changes while open.
  useEffect(() => {
    if (open) dayRefs.current[toDateInputValue(focusDay)]?.focus();
  }, [focusDay, open]);

  // Close on outside click / Escape; restore focus to the trigger on Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const year = focusDay.getFullYear();
  const month = focusDay.getMonth();
  const grid = monthGrid(year, month);

  function pick(day: Date) {
    onChange(toDateInputValue(day));
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in map) {
      e.preventDefault();
      setFocusDay((d) => addDays(d, map[e.key]));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(focusDay);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={[
          'flex w-full items-center justify-between rounded-md border bg-slate-900 px-3 py-2 text-left text-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500',
          hasError ? 'border-red-500' : 'border-slate-700 hover:border-slate-600',
        ].join(' ')}
      >
        <span className={selected ? 'text-slate-100' : 'text-slate-500'}>
          {selected ? formatDate(selected) : placeholder}
        </span>
        <Calendar size={15} className="shrink-0 text-slate-500" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute left-0 z-50 mt-1 w-64 rounded-xl border border-slate-700 bg-slate-800 p-3 shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setFocusDay(new Date(year, month - 1, 1))}
              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-100"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-slate-100">
              {focusDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setFocusDay(new Date(year, month + 1, 1))}
              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-100"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium uppercase text-slate-600">
                {d}
              </div>
            ))}
          </div>

          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div className="grid grid-cols-7 gap-1" onKeyDown={onGridKeyDown}>
            {grid.map((day) => {
              const inMonth = day.getMonth() === month;
              const isSel = selected != null && sameDay(day, selected);
              const isToday = sameDay(day, today);
              const key = toDateInputValue(day);
              return (
                <button
                  key={key}
                  ref={(el) => {
                    dayRefs.current[key] = el;
                  }}
                  type="button"
                  tabIndex={sameDay(day, focusDay) ? 0 : -1}
                  onClick={() => pick(day)}
                  aria-label={formatDate(day)}
                  aria-current={isToday ? 'date' : undefined}
                  className={[
                    'h-8 rounded-md text-xs transition-colors',
                    isSel
                      ? 'bg-indigo-600 font-semibold text-white'
                      : inMonth
                        ? 'text-slate-200 hover:bg-slate-700'
                        : 'text-slate-600 hover:bg-slate-700/50',
                    !isSel && isToday ? 'ring-1 ring-indigo-500' : '',
                  ].join(' ')}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-700 pt-2">
            <button type="button" onClick={() => pick(new Date())} className="text-xs text-indigo-400 hover:text-indigo-300">
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className="text-xs text-slate-500 transition-colors hover:text-red-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** react-hook-form Controller wrapper for DatePicker. */
export function DateField<T extends FieldValues>({
  control,
  name,
  id,
  hasError,
  placeholder,
}: {
  control: Control<T>;
  name: Path<T>;
  id?: string;
  hasError?: boolean;
  placeholder?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <DatePicker
          id={id}
          value={(field.value as string) ?? ''}
          onChange={field.onChange}
          hasError={hasError}
          placeholder={placeholder}
        />
      )}
    />
  );
}
