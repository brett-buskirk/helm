import { useState } from 'react';
import { Link2, ExternalLink } from 'lucide-react';
import type { Project } from '../../types';
import { Modal } from '../ui/Modal';
import { normalizeUrl, linkHost } from '../../utils/links';

/**
 * A link icon shown on a project when it has links; opens a popup listing them
 * as clickable external links. Self-contained (own modal state) so it can drop
 * into any project row. Renders nothing when the project has no links.
 */
export function ProjectLinks({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const links = project.links ?? [];
  if (links.length === 0) return null;

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="shrink-0 text-slate-500 hover:text-indigo-400 transition-colors"
        title={`${links.length} link${links.length === 1 ? '' : 's'}`}
        aria-label={`Links for ${project.name}`}
      >
        <Link2 size={14} />
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={`${project.name} — Links`} size="sm">
        <ul className="space-y-2">
          {links.map((link, i) => (
            <li key={i}>
              <a
                href={normalizeUrl(link.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 p-3 transition-colors hover:border-slate-600"
              >
                <ExternalLink size={15} className="shrink-0 text-indigo-400" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-100">{link.label}</span>
                  <span className="block truncate text-xs text-slate-500">{linkHost(link.url)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
