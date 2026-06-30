import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Users, Search } from 'lucide-react';
import { db } from '../db';
import type { Client, ClientStatus } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Table, type TableColumn } from '../components/ui/Table';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Toast } from '../components/ui/Toast';
import { ClientForm } from '../components/clients/ClientForm';
import { useToast } from '../hooks/useToast';
import { formatRate } from '../utils/format';

const STATUS_BADGE: Record<ClientStatus, { variant: 'info' | 'success' | 'neutral'; label: string }> = {
  lead: { variant: 'info', label: 'Lead' },
  active: { variant: 'success', label: 'Active' },
  past: { variant: 'neutral', label: 'Past' },
};

const STATUS_FILTER_OPTIONS: { value: ClientStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'lead', label: 'Leads' },
  { value: 'active', label: 'Active' },
  { value: 'past', label: 'Past' },
];

export default function Clients() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();
  const [archiveTarget, setArchiveTarget] = useState<Client | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Client | undefined>();
  const [confirming, setConfirming] = useState(false);

  const allClients = useLiveQuery(() => db.clients.orderBy('company').toArray()) ?? [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allClients.filter((c) => {
      const matchesSearch =
        !q ||
        c.company.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allClients, search, statusFilter]);

  function openCreate() {
    setEditingClient(undefined);
    setDrawerOpen(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setDrawerOpen(true);
  }

  async function handleArchive() {
    if (!archiveTarget?.id) return;
    setConfirming(true);
    try {
      await db.clients.update(archiveTarget.id, { status: 'past', updatedAt: new Date() });
      showToast('success', `${archiveTarget.company} archived.`);
    } catch {
      showToast('error', 'Archive failed.');
    } finally {
      setConfirming(false);
      setArchiveTarget(undefined);
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    setConfirming(true);
    try {
      await db.clients.delete(deleteTarget.id);
      showToast('success', `${deleteTarget.company} deleted.`);
    } catch {
      showToast('error', 'Delete failed.');
    } finally {
      setConfirming(false);
      setDeleteTarget(undefined);
    }
  }

  const columns: TableColumn<Client>[] = [
    {
      key: 'company',
      header: 'Company',
      render: (c) => <span className="font-medium text-slate-100">{c.company}</span>,
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (c) => c.contactName,
    },
    {
      key: 'email',
      header: 'Email',
      render: (c) => (
        <a
          href={`mailto:${c.email}`}
          onClick={(e) => e.stopPropagation()}
          className="text-indigo-400 hover:underline"
        >
          {c.email}
        </a>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => {
        const { variant, label } = STATUS_BADGE[c.status];
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      key: 'rate',
      header: 'Rate',
      render: (c) => formatRate(c.defaultRate),
      className: 'text-slate-400 tabular-nums',
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEdit(c)}
            className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
          >
            Edit
          </button>
          {c.status !== 'past' && (
            <button
              onClick={() => setArchiveTarget(c)}
              className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
            >
              Archive
            </button>
          )}
          <button
            onClick={() => setDeleteTarget(c)}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-950 hover:text-red-300 transition-colors"
          >
            Delete
          </button>
        </div>
      ),
      headerClassName: 'text-right',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Clients"
        description={`${allClients.length} client${allClients.length !== 1 ? 's' : ''} total`}
        action={
          <Button onClick={openCreate}>
            <Plus size={15} />
            New Client
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="pl-8"
          />
        </div>
        <div className="flex rounded-md border border-slate-700 overflow-hidden">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={[
                'px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={filtered}
        getKey={(c) => c.id!}
        onRowClick={(c) => navigate(`/clients/${c.id}`)}
        emptyState={
          <EmptyState
            icon={Users}
            title={search || statusFilter !== 'all' ? 'No clients match your filters' : 'No clients yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Add your first client to get started.'
            }
            action={
              !search && statusFilter === 'all' ? (
                <Button onClick={openCreate}>
                  <Plus size={15} />
                  New Client
                </Button>
              ) : undefined
            }
          />
        }
      />

      <ClientForm
        client={editingClient}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={(msg) => showToast('success', msg)}
      />

      <ConfirmModal
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(undefined)}
        onConfirm={handleArchive}
        title="Archive Client"
        message={`Archive ${archiveTarget?.company}? Their status will be set to "Past". You can still view and edit them.`}
        confirmLabel="Archive"
        variant="primary"
        loading={confirming}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={handleDelete}
        title="Delete Client"
        message={`Permanently delete ${deleteTarget?.company}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={confirming}
      />

      <Toast toast={toast} />
    </div>
  );
}
