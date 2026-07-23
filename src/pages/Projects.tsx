import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Briefcase, Search, StickyNote } from 'lucide-react';
import { db } from '../db';
import type { Project, ProjectStatus } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Table, type TableColumn } from '../components/ui/Table';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { ProjectForm } from '../components/projects/ProjectForm';
import { ProjectLinks } from '../components/projects/ProjectLinks';
import { useToast } from '../hooks/useToast';
import { formatDate, formatProjectRate } from '../utils/format';

const STATUS_BADGE: Record<ProjectStatus, { variant: 'success' | 'warning' | 'info' | 'danger' | 'neutral'; label: string }> = {
  lead: { variant: 'neutral', label: 'Lead' },
  active: { variant: 'success', label: 'Active' },
  paused: { variant: 'warning', label: 'Paused' },
  completed: { variant: 'info', label: 'Completed' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
};

const STATUS_FILTER_OPTIONS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'lead', label: 'Lead' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function Projects() {
  const { toast, showToast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Project | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [noteProject, setNoteProject] = useState<Project | undefined>();

  const allProjects = useLiveQuery(() => db.projects.toCollection().sortBy('name')) ?? [];
  const allClients = useLiveQuery(() => db.clients.toArray()) ?? [];

  const clientMap = useMemo(
    () => new Map(allClients.map((c) => [c.id!, c])),
    [allClients],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allProjects.filter((p) => {
      const client = clientMap.get(p.clientId);
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (client?.company ?? '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allProjects, clientMap, search, statusFilter]);

  function openCreate() {
    setEditingProject(undefined);
    setDrawerOpen(true);
  }

  function openEdit(project: Project) {
    setEditingProject(project);
    setDrawerOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    setConfirming(true);
    try {
      await db.projects.delete(deleteTarget.id);
      showToast('success', `"${deleteTarget.name}" deleted.`);
    } catch {
      showToast('error', 'Delete failed.');
    } finally {
      setConfirming(false);
      setDeleteTarget(undefined);
    }
  }

  const columns: TableColumn<Project>[] = [
    {
      key: 'name',
      header: 'Project',
      render: (p) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-100">{p.name}</span>
          {p.description?.trim() && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNoteProject(p);
              }}
              className="shrink-0 text-slate-500 hover:text-indigo-400 transition-colors"
              title="View notes"
              aria-label={`View notes for ${p.name}`}
            >
              <StickyNote size={14} />
            </button>
          )}
          <ProjectLinks project={p} />
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (p) => {
        const client = clientMap.get(p.clientId);
        return client ? (
          <Link
            to={`/clients/${client.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-indigo-400 hover:underline"
          >
            {client.company}
          </Link>
        ) : (
          <span className="text-slate-500">—</span>
        );
      },
    },
    {
      key: 'type',
      header: 'Type',
      render: (p) => (
        <span className="text-xs font-mono uppercase tracking-wide text-slate-400">
          {p.type}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => {
        const { variant, label } = STATUS_BADGE[p.status];
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      key: 'timeline',
      header: 'Timeline',
      render: (p) => (
        <span className="text-slate-400 tabular-nums text-xs">
          {p.startDate ? formatDate(p.startDate) : '—'}
          {p.endDate ? ` → ${formatDate(p.endDate)}` : ''}
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      render: (p) => {
        const client = clientMap.get(p.clientId);
        const rate = p.rate ?? (p.type === 'hourly' ? client?.defaultRate : undefined);
        return <span className="text-slate-400 tabular-nums">{formatProjectRate(rate, p.type)}</span>;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEdit(p)}
            className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => setDeleteTarget(p)}
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
        title="Projects"
        description={`${allProjects.length} project${allProjects.length !== 1 ? 's' : ''} total`}
        action={
          <Button onClick={openCreate}>
            <Plus size={15} />
            New Project
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
            placeholder="Search projects…"
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

      <Table
        columns={columns}
        data={filtered}
        getKey={(p) => p.id!}
        onRowClick={openEdit}
        emptyState={
          <EmptyState
            icon={Briefcase}
            title={search || statusFilter !== 'all' ? 'No projects match your filters' : 'No projects yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Add a client first, then create projects from their detail page.'
            }
            action={
              !search && statusFilter === 'all' && allClients.length > 0 ? (
                <Button onClick={openCreate}>
                  <Plus size={15} />
                  New Project
                </Button>
              ) : undefined
            }
          />
        }
      />

      <ProjectForm
        project={editingProject}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={(msg) => showToast('success', msg)}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={confirming}
      />

      <Modal
        isOpen={!!noteProject}
        onClose={() => setNoteProject(undefined)}
        title={noteProject ? `${noteProject.name} — Notes` : 'Notes'}
        size="md"
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
          {noteProject?.description}
        </p>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
