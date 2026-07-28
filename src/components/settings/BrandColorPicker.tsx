import { useEffect, useState } from 'react';
import { normalizeHex } from '../../utils/color';

const PRESETS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#334155'];

interface Props {
  value: string;
  onChange: (hex: string) => void;
}

/**
 * Brand-color control: the OS color picker, an editable hex field (type or paste
 * an exact color), and quick preset swatches. The hex field keeps a local draft
 * so partial typing is smooth; it only commits a valid, normalized hex.
 */
export function BrandColorPicker({ value, onChange }: Props) {
  const [draft, setDraft] = useState(value);
  // Reflect external changes (picker, presets) into the hex field.
  useEffect(() => setDraft(value), [value]);

  function onHexInput(raw: string) {
    setDraft(raw);
    const normalized = normalizeHex(raw);
    if (normalized) onChange(normalized);
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 shrink-0 cursor-pointer rounded border border-slate-700 bg-slate-800"
          aria-label="Pick brand color"
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => onHexInput(e.target.value)}
          onBlur={() => setDraft(value)}
          spellCheck={false}
          placeholder="#6366F1"
          aria-label="Brand color hex"
          className="w-28 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-mono text-sm uppercase text-slate-200 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((sw) => (
          <button
            key={sw}
            type="button"
            onClick={() => onChange(sw)}
            style={{ backgroundColor: sw }}
            aria-label={`Use ${sw}`}
            className={[
              'h-6 w-6 rounded-full transition-transform hover:scale-110',
              value.toLowerCase() === sw ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : 'border border-slate-600',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  );
}
