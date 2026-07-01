import { useState } from 'react';
import { NavLink } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  Receipt,
  FolderOpen,
  Settings,
  Search,
  ClipboardList,
  Clock,
  Trash2,
  Wrench,
  Lock,
} from 'lucide-react';
import { db } from '../../db';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Toast } from '../ui/Toast';
import { useToast } from '../../hooks/useToast';
import { countDemoData, clearDemoData } from '../../utils/sampleData';
import { isEncryptionEnabled } from '../../db/encryption';
import * as vault from '../../utils/vault';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/projects', label: 'Projects', icon: Briefcase },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/time', label: 'Time', icon: Clock },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/proposals', label: 'Proposals', icon: ClipboardList },
  { to: '/documents', label: 'Documents', icon: FolderOpen },
  { to: '/toolbox', label: 'Toolbox', icon: Wrench },
];

interface SidebarProps {
  onSearchOpen: () => void;
}

export function Sidebar({ onSearchOpen }: SidebarProps) {
  const { toast, showToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const demoCount = useLiveQuery(() => countDemoData(), []) ?? 0;
  const encrypted = useLiveQuery(() => isEncryptionEnabled(), []) ?? false;
  const settings = useLiveQuery(() => db.settings.limit(1).first());
  const logo = settings?.logo;
  const brandName = settings?.businessName?.trim() || 'Helm';

  async function handleClearDemo() {
    setClearing(true);
    try {
      const removed = await clearDemoData();
      showToast('success', `Cleared ${removed} demo record${removed === 1 ? '' : 's'}.`);
    } catch {
      showToast('error', 'Failed to clear demo data.');
    } finally {
      setClearing(false);
      setConfirmOpen(false);
    }
  }

  return (
    <aside className="flex h-full w-56 flex-col bg-slate-950 border-r border-slate-800">
      {/* Brand — the user's logo/business name once set, else Helm's own */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
        {logo ? (
          <img src={logo} alt={brandName} className="max-h-9 max-w-[170px] object-contain" />
        ) : (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <g stroke="white" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="12" y1="12" x2="12" y2="2" />
                  <line x1="12" y1="12" x2="19.1" y2="4.9" />
                  <line x1="12" y1="12" x2="22" y2="12" />
                  <line x1="12" y1="12" x2="19.1" y2="19.1" />
                  <line x1="12" y1="12" x2="12" y2="22" />
                  <line x1="12" y1="12" x2="4.9" y2="19.1" />
                  <line x1="12" y1="12" x2="2" y2="12" />
                  <line x1="12" y1="12" x2="4.9" y2="4.9" />
                </g>
                <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="2.2" fill="white" />
              </svg>
            </div>
            <span className="truncate text-base font-semibold tracking-tight text-slate-100">{brandName}</span>
          </>
        )}
      </div>

      {/* Search */}
      <div className="px-3 pt-2 pb-1">
        <button
          onClick={onSearchOpen}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
        >
          <Search size={14} className="shrink-0" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="hidden rounded border border-slate-700 px-1 py-0.5 text-[10px] sm:inline">⌘K</kbd>
        </button>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-1">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
                  ].join(' ')
                }
              >
                <Icon size={16} className="shrink-0" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Clear demo data — only while a sample dataset is loaded */}
      {demoCount > 0 && (
        <div className="px-3 pt-3 border-t border-slate-800">
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-amber-400/90 transition-colors hover:bg-amber-950/40 hover:text-amber-300"
            title={`${demoCount} demo records loaded`}
          >
            <Trash2 size={16} className="shrink-0" />
            <span className="flex-1 text-left">Clear demo data</span>
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] tabular-nums text-amber-300">
              {demoCount}
            </span>
          </button>
        </div>
      )}

      {/* Lock — only when encryption is on */}
      {encrypted && (
        <div className="px-3 pt-3 border-t border-slate-800">
          <button
            onClick={() => vault.clearKey()}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
            title="Lock the app now"
          >
            <Lock size={16} className="shrink-0" />
            Lock
          </button>
        </div>
      )}

      {/* Settings at bottom */}
      <div className="px-3 py-3 border-t border-slate-800">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            [
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
            ].join(' ')
          }
        >
          <Settings size={16} className="shrink-0" />
          Settings
        </NavLink>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleClearDemo}
        title="Clear demo data"
        message={`Remove all ${demoCount} sample records? This only deletes demo data — anything you've created yourself is kept.`}
        confirmLabel="Clear demo data"
        variant="danger"
        loading={clearing}
      />

      <Toast toast={toast} />
    </aside>
  );
}
