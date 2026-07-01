import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, FileText, Trash2, Pencil } from 'lucide-react';
import { db } from '../db';
import type { Proposal, ProposalStatus } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Toast } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { formatCurrency, formatDate } from '../utils/format';

const STATUS_BADGE: Record<ProposalStatus, { variant: 'neutral' | 'info' | 'success' | 'danger'; label: string }> = {
  draft: { variant: 'neutral', label: 'Draft' },
  sent: { variant: 'info', label: 'Sent' },
  accepted: { variant: 'success', label: 'Accepted' },
  declined: { variant: 'danger', label: 'Declined' },
};

type TabKey = 'all' | ProposalStatus;

const TAB_ITEMS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
];

export default function Proposals() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const [tab, setTab] = useState<TabKey>('all');
  const [deleteTarget, setDeleteTarget] = useState<Proposal | undefined>();
  const [deleting, setDeleting] = useState(false);

  const allProposals = useLiveQuery(() =>
    db.proposals.toArray().then((arr) =>
      arr.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    )
  ) ?? [];
  const allClients = useLiveQuery(() => db.clients.toArray()) ?? [];

  const clientMap = useMemo(() => new Map(allClients.map((c) => [c.id!, c])), [allClients]);

  const filtered = useMemo(
    () => (tab === 'all' ? allProposals : allProposals.filter((p) => p.status === tab)),
    [allProposals, tab],
  );

  const tabItems = TAB_ITEMS.map((t) => ({
    ...t,
    count:
      t.key === 'all'
        ? undefined
        : (allProposals.filter((p) => p.status === t.key).length || undefined),
  }));

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await db.proposals.delete(deleteTarget.id);
      showToast('success', 'Proposal deleted.');
    } catch {
      showToast('error', 'Delete failed.');
    } finally {
      setDeleting(false);
      setDeleteTarget(undefined);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Proposals"
        description={`${allProposals.length} total · ${allProposals.filter((p) => p.status === 'sent').length} awaiting response`}
        action={
          <Button onClick={() => navigate('/proposals/new')}>
            <Plus size={15} />
            New Proposal
          </Button>
        }
      />

      <Tabs items={tabItems} active={tab} onChange={(k) => setTab(k as TabKey)} />

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={tab === 'all' ? 'No proposals yet' : `No ${tab} proposals`}
          description="Create a proposal to start the client engagement pipeline."
          action={
            <Button onClick={() => navigate('/proposals/new')}>
              <Plus size={15} />
              New Proposal
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800">
                {['Title', 'Client', 'Amount', 'Valid Until', 'Status', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900">
              {filtered.map((proposal) => {
                const { variant, label } = STATUS_BADGE[proposal.status];
                const isExpired =
                  proposal.validUntil &&
                  new Date(proposal.validUntil as unknown as Date) < new Date();
                return (
                  <tr
                    key={proposal.id}
                    className="group cursor-pointer hover:bg-slate-800 transition-colors"
                    onClick={() => navigate(`/proposals/${proposal.id}`)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-100">
                      {proposal.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {clientMap.get(proposal.clientId)?.company ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums font-medium text-slate-100">
                      {formatCurrency(proposal.pricing)}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-slate-500 whitespace-nowrap">
                      {proposal.validUntil ? (
                        <span className={isExpired ? 'text-red-400' : ''}>
                          {formatDate(proposal.validUntil as unknown as Date)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={variant}>{label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => navigate(`/proposals/${proposal.id}/edit`)}
                          aria-label="Edit proposal"
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(proposal)}
                          aria-label="Delete proposal"
                          className="rounded p-1.5 text-red-500 hover:bg-red-950 hover:text-red-300 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={handleDelete}
        title="Delete Proposal"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      <Toast toast={toast} />
    </div>
  );
}
