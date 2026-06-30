import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Users, Briefcase, FileText, FolderOpen, X } from 'lucide-react';
import { db } from '../../db';

interface SearchResult {
  id: string;
  label: string;
  sub: string;
  path: string;
  icon: React.ElementType;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  const allClients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const allProjects = useLiveQuery(() => db.projects.toArray()) ?? [];
  const allInvoices = useLiveQuery(() => db.invoices.toArray()) ?? [];
  const allDocuments = useLiveQuery(() => db.documents.toArray()) ?? [];

  const clientMap = useMemo(() => new Map(allClients.map((c) => [c.id!, c])), [allClients]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const clients: SearchResult[] = allClients
      .filter(
        (c) =>
          c.company.toLowerCase().includes(q) ||
          c.contactName?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q),
      )
      .slice(0, 4)
      .map((c) => ({
        id: `client-${c.id}`,
        label: c.company,
        sub: c.contactName ?? c.email ?? 'Client',
        path: `/clients/${c.id}`,
        icon: Users,
      }));

    const projects: SearchResult[] = allProjects
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((p) => ({
        id: `project-${p.id}`,
        label: p.name,
        sub: clientMap.get(p.clientId)?.company ?? 'Project',
        path: `/clients/${p.clientId}`,
        icon: Briefcase,
      }));

    const invoices: SearchResult[] = allInvoices
      .filter((inv) => inv.invoiceNumber.toLowerCase().includes(q))
      .slice(0, 4)
      .map((inv) => ({
        id: `invoice-${inv.id}`,
        label: inv.invoiceNumber,
        sub: clientMap.get(inv.clientId)?.company ?? 'Invoice',
        path: `/invoices/${inv.id}`,
        icon: FileText,
      }));

    const documents: SearchResult[] = allDocuments
      .filter((d) => d.title.toLowerCase().includes(q))
      .slice(0, 4)
      .map((d) => ({
        id: `doc-${d.id}`,
        label: d.title,
        sub: d.isTemplate ? 'Template' : (clientMap.get(d.clientId ?? 0)?.company ?? 'Document'),
        path: `/documents/${d.id}/edit`,
        icon: FolderOpen,
      }));

    return [...clients, ...projects, ...invoices, ...documents];
  }, [query, allClients, allProjects, allInvoices, allDocuments, clientMap]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIdx(0);
  }, [results.length]);

  function handleSelect(result: SearchResult) {
    navigate(result.path);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIdx]) {
      handleSelect(results[activeIdx]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-slate-700 px-4 py-3">
          <Search size={16} className="shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, projects, invoices, documents…"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-600 outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-600 hover:text-slate-400">
              <X size={14} />
            </button>
          )}
          <kbd className="hidden rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-600 sm:inline">
            Esc
          </kbd>
        </div>

        {/* Results */}
        {query.trim() && (
          <div className="max-h-80 overflow-y-auto py-2">
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-600">
                No results for &ldquo;{query}&rdquo;
              </p>
            ) : (
              results.map((result, idx) => {
                const Icon = result.icon;
                return (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={[
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      idx === activeIdx ? 'bg-slate-800' : 'hover:bg-slate-800/60',
                    ].join(' ')}
                  >
                    <Icon size={14} className="shrink-0 text-slate-500" />
                    <span className="flex-1 truncate text-sm text-slate-200">{result.label}</span>
                    <span className="shrink-0 text-xs text-slate-600">{result.sub}</span>
                  </button>
                );
              })
            )}
          </div>
        )}

        {!query.trim() && (
          <div className="px-4 py-5 text-center">
            <p className="text-xs text-slate-600">
              Type to search across clients, projects, invoices, and documents.
            </p>
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-slate-800 px-4 py-2">
          <span className="text-xs text-slate-700">
            <kbd className="mr-1 rounded border border-slate-700 px-1 py-0.5 text-[10px]">↑↓</kbd>
            navigate
          </span>
          <span className="text-xs text-slate-700">
            <kbd className="mr-1 rounded border border-slate-700 px-1 py-0.5 text-[10px]">↵</kbd>
            open
          </span>
        </div>
      </div>
    </div>
  );
}
