import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Search,
  X,
  CornerDownLeft,
  Users,
  Briefcase,
  FileText,
  FolderOpen,
  ClipboardList,
  FilePlus,
  Clock,
  Receipt,
  Download,
  Lock,
  LayoutDashboard,
  Wrench,
  Settings as SettingsIcon,
} from 'lucide-react';
import { db } from '../../db';
import { exportAllData } from '../../utils/backup';
import { isEncryptionEnabled } from '../../db/encryption';
import * as vault from '../../utils/vault';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface PaletteItem {
  id: string;
  label: string;
  sub?: string;
  icon: React.ElementType;
  group: string;
  keywords?: string;
  run: () => void;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  const allClients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const allProjects = useLiveQuery(() => db.projects.toArray()) ?? [];
  const allInvoices = useLiveQuery(() => db.invoices.toArray()) ?? [];
  const allProposals = useLiveQuery(() => db.proposals.toArray()) ?? [];
  const allDocuments = useLiveQuery(() => db.documents.toArray()) ?? [];
  const encrypted = useLiveQuery(() => isEncryptionEnabled(), []) ?? false;

  const clientMap = useMemo(() => new Map(allClients.map((c) => [c.id!, c])), [allClients]);

  const go = (path: string) => {
    navigate(path);
    onClose();
  };

  // ── Static commands (navigate + actions) ──────────────────────────────────
  const commands: PaletteItem[] = useMemo(() => {
    const actions: PaletteItem[] = [
      { id: 'new-invoice', label: 'New Invoice', group: 'Actions', icon: FilePlus, keywords: 'create bill', run: () => go('/invoices/new') },
      { id: 'new-proposal', label: 'New Proposal', group: 'Actions', icon: ClipboardList, keywords: 'create quote', run: () => go('/proposals/new') },
      { id: 'new-document', label: 'New Document', group: 'Actions', icon: FileText, keywords: 'create template contract', run: () => go('/documents/new') },
      { id: 'log-time', label: 'Log Time', group: 'Actions', icon: Clock, keywords: 'track hours', run: () => go('/time') },
      { id: 'add-expense', label: 'Add Expense', group: 'Actions', icon: Receipt, keywords: 'spend cost', run: () => go('/expenses') },
      {
        id: 'export-backup',
        label: 'Export Backup',
        group: 'Actions',
        icon: Download,
        keywords: 'save data json download',
        run: () => {
          onClose();
          void exportAllData();
        },
      },
    ];
    if (encrypted) {
      actions.push({
        id: 'lock',
        label: 'Lock App',
        group: 'Actions',
        icon: Lock,
        keywords: 'secure encrypt sign out',
        run: () => {
          onClose();
          vault.clearKey();
        },
      });
    }

    const nav: PaletteItem[] = [
      { id: 'go-dashboard', label: 'Dashboard', group: 'Go to', icon: LayoutDashboard, run: () => go('/') },
      { id: 'go-clients', label: 'Clients', group: 'Go to', icon: Users, run: () => go('/clients') },
      { id: 'go-projects', label: 'Projects', group: 'Go to', icon: Briefcase, run: () => go('/projects') },
      { id: 'go-invoices', label: 'Invoices', group: 'Go to', icon: FileText, run: () => go('/invoices') },
      { id: 'go-time', label: 'Time', group: 'Go to', icon: Clock, run: () => go('/time') },
      { id: 'go-expenses', label: 'Expenses', group: 'Go to', icon: Receipt, run: () => go('/expenses') },
      { id: 'go-proposals', label: 'Proposals', group: 'Go to', icon: ClipboardList, run: () => go('/proposals') },
      { id: 'go-documents', label: 'Documents', group: 'Go to', icon: FolderOpen, run: () => go('/documents') },
      { id: 'go-toolbox', label: 'Toolbox', group: 'Go to', icon: Wrench, run: () => go('/toolbox') },
      { id: 'go-settings', label: 'Settings', group: 'Go to', icon: SettingsIcon, run: () => go('/settings') },
    ];
    return [...actions, ...nav];
    // go/onClose are stable enough for a transient modal; recompute on encrypted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encrypted]);

  // ── Entity search results ─────────────────────────────────────────────────
  const entityResults: PaletteItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const clients = allClients
      .filter((c) => c.company.toLowerCase().includes(q) || c.contactName?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      .slice(0, 4)
      .map<PaletteItem>((c) => ({ id: `client-${c.id}`, label: c.company, sub: c.contactName ?? c.email ?? 'Client', group: 'Clients', icon: Users, run: () => go(`/clients/${c.id}`) }));
    const projects = allProjects
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map<PaletteItem>((p) => ({ id: `project-${p.id}`, label: p.name, sub: clientMap.get(p.clientId)?.company ?? 'Project', group: 'Projects', icon: Briefcase, run: () => go(`/clients/${p.clientId}`) }));
    const invoices = allInvoices
      .filter((inv) => inv.invoiceNumber.toLowerCase().includes(q))
      .slice(0, 4)
      .map<PaletteItem>((inv) => ({ id: `invoice-${inv.id}`, label: inv.invoiceNumber, sub: clientMap.get(inv.clientId)?.company ?? 'Invoice', group: 'Invoices', icon: FileText, run: () => go(`/invoices/${inv.id}`) }));
    const proposals = allProposals
      .filter((p) => p.title.toLowerCase().includes(q))
      .slice(0, 4)
      .map<PaletteItem>((p) => ({ id: `proposal-${p.id}`, label: p.title, sub: clientMap.get(p.clientId)?.company ?? 'Proposal', group: 'Proposals', icon: ClipboardList, run: () => go(`/proposals/${p.id}`) }));
    const documents = allDocuments
      .filter((d) => d.title.toLowerCase().includes(q))
      .slice(0, 4)
      .map<PaletteItem>((d) => ({ id: `doc-${d.id}`, label: d.title, sub: d.isTemplate ? 'Template' : (clientMap.get(d.clientId ?? 0)?.company ?? 'Document'), group: 'Documents', icon: FolderOpen, run: () => go(`/documents/${d.id}/edit`) }));
    return [...clients, ...projects, ...invoices, ...proposals, ...documents];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, allClients, allProjects, allInvoices, allProposals, allDocuments, clientMap]);

  // ── Combined, filtered list ───────────────────────────────────────────────
  const items: PaletteItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const matchedCommands = commands.filter((cmd) =>
      `${cmd.label} ${cmd.keywords ?? ''} ${cmd.group}`.toLowerCase().includes(q),
    );
    return [...matchedCommands, ...entityResults];
  }, [query, commands, entityResults]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIdx(0);
  }, [items.length]);

  useEffect(() => {
    itemRefs.current[activeIdx]?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[activeIdx]?.run();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  if (!isOpen) return null;

  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-slate-700 px-4 py-3">
          <Search size={16} className="shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-600 outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="text-slate-600 hover:text-slate-400">
              <X size={14} />
            </button>
          )}
          <kbd className="hidden rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-600 sm:inline">Esc</kbd>
        </div>

        {/* Items */}
        <div className="max-h-96 overflow-y-auto py-2">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-600">No matches for &ldquo;{query}&rdquo;</p>
          ) : (
            items.map((item, idx) => {
              const Icon = item.icon;
              const showHeader = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <div key={item.id}>
                  {showHeader && (
                    <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600 first:pt-1">
                      {item.group}
                    </p>
                  )}
                  <button
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    onClick={() => item.run()}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={[
                      'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                      idx === activeIdx ? 'bg-slate-800' : 'hover:bg-slate-800/60',
                    ].join(' ')}
                  >
                    <Icon size={15} className="shrink-0 text-slate-500" />
                    <span className="flex-1 truncate text-sm text-slate-200">{item.label}</span>
                    {item.sub && <span className="shrink-0 text-xs text-slate-600">{item.sub}</span>}
                    {idx === activeIdx && <CornerDownLeft size={13} className="shrink-0 text-slate-600" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-slate-800 px-4 py-2">
          <span className="text-xs text-slate-700">
            <kbd className="mr-1 rounded border border-slate-700 px-1 py-0.5 text-[10px]">↑↓</kbd>navigate
          </span>
          <span className="text-xs text-slate-700">
            <kbd className="mr-1 rounded border border-slate-700 px-1 py-0.5 text-[10px]">↵</kbd>run
          </span>
        </div>
      </div>
    </div>
  );
}
