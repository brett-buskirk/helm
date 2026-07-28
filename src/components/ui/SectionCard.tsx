import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  children: ReactNode;
}

/**
 * A titled panel used to group related controls on the settings-style config
 * pages (Settings, Security). Shared so both pages stay visually consistent.
 */
export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
      <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h2>
      {children}
    </div>
  );
}
