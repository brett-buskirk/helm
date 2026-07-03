import { useState } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Eye, Pencil } from 'lucide-react';
import { MarkdownPreview } from './MarkdownPreview';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  rows?: number;
  hasError?: boolean;
}

export function MarkdownEditor({ value, onChange, id, placeholder, rows = 8, hasError }: MarkdownEditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  return (
    <div
      className={[
        'overflow-hidden rounded-md border transition-colors focus-within:ring-2 focus-within:ring-indigo-500',
        hasError ? 'border-red-500' : 'border-slate-700',
      ].join(' ')}
    >
      <div className="flex items-center gap-1 border-b border-slate-700 bg-slate-900 px-2 py-1.5">
        <TabButton active={tab === 'write'} onClick={() => setTab('write')} icon={Pencil}>
          Write
        </TabButton>
        <TabButton active={tab === 'preview'} onClick={() => setTab('preview')} icon={Eye}>
          Preview
        </TabButton>
        <span className="ml-auto pr-1 text-[10px] text-slate-600">Markdown supported</span>
      </div>
      {tab === 'write' ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="block w-full resize-y bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
        />
      ) : (
        <div className="max-h-96 min-h-24 overflow-y-auto bg-slate-900 px-3 py-2">
          <MarkdownPreview content={value} />
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors',
        active ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200',
      ].join(' ')}
    >
      <Icon size={12} />
      {children}
    </button>
  );
}

/** react-hook-form Controller wrapper for MarkdownEditor. */
export function MarkdownField<T extends FieldValues>({
  control,
  name,
  id,
  placeholder,
  rows,
  hasError,
}: {
  control: Control<T>;
  name: Path<T>;
  id?: string;
  placeholder?: string;
  rows?: number;
  hasError?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <MarkdownEditor
          id={id}
          value={(field.value as string) ?? ''}
          onChange={field.onChange}
          placeholder={placeholder}
          rows={rows}
          hasError={hasError}
        />
      )}
    />
  );
}
