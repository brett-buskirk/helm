import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Briefcase, FileText, FolderOpen, Pencil } from 'lucide-react';
import { db } from '../db';
import type { Project, ProjectStatus, ProjectType } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { Textarea } from '../components/ui/Textarea';
import { Table, type TableColumn } from '../components/ui/Table';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Toast } from '../components/ui/Toast';
import { ClientForm } from '../components/clients/ClientForm';
import { ProjectForm } from '../components/projects/ProjectForm';
import { useToast } from '../hooks/useToast';
import { formatDate, formatRate } from '../utils/format';

const CLIENT_STATUS_BADGE = {
  lead: { variant: 'info' as const, label: 'Lead' },
  active: { variant: 'success' as const, label: 'Active' },
  past: { variant: 'neutral' as const, label: 'Past' },
};

const PROJECT_STATUS_BADGE: Record<ProjectStatus, { variant: 'success' | 'warning' | 'info' | 'danger' | 'neutral'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  paused: { variant: 'warning', label: 'Paused' },
  completed: { variant: 'info', label: 'Completed' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
};

const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  fixed: 'Fixed',
  retainer: 'Retainer',
  hourly: 'Hourly',
};

type TabKey = 'overview' | 'projects' | 'invoices' | 'documents';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast, showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [notes, setNotes] = useState('');
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [projectDrawerOpen, setProjectDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<Project | undefined>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const clientId = Number(id);
  const client = useLiveQuery(() => db.clients.get(clientId), [clientId]);
  const projects = useLiveQuery(
    () => db.projects.where('clientId').equals(clientId).sortBy('name'),
    [clientId],
  ) ?? [];

  useEffect(() => {
    if (client) setNotes(client.notes ?? '');
  }, [client?.notes]);

  // undefined = still loading; also shown if record doesn't exist
  if (!client) {
    return (
      <div className="p-6">
        <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100">
          <ArrowLeft size={14} /> Back to Clients
        </Link>
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  const { variant: statusVariant, label: statusLabel } = CLIENT_STATUS_BADGE[client.status];

  async function handleSaveNotes() {
    if (!client || !client.id || notes === client.notes) return;
    await db.clients.update(client.id, { notes, updatedAt: new Date() });
  }

  async function handleArchiveClient() {
    if (!client || !client.id) return;
    await db.clients.update(client.id, { status: 'past', updatedAt: new Date() });
    showToast('success', `${client.company} archived.`);
  }

  function openProjectCreate() {
    setEditingProject(undefined);
    setProjectDrawerOpen(true);
  }

  function openProjectEdit(project: Project) {
    setEditingProject(project);
    setProjectDrawerOpen(true);
  }

  async function handleDeleteProject() {
    if (!deleteProjectTarget?.id) return;
    setConfirmingDelete(true);
    try {
      await db.projects.delete(deleteProjectTarget.id);
      showToast('success', `${deleteProjectTarget.name} deleted.`);
    } catch {
      showToast('error', 'Delete failed.');
    } finally {
      setConfirmingDelete(false);
      setDeleteProjectTarget(undefined);
    }
  }

  const projectColumns: TableColumn<Project>[] = [
    {
      key: 'name',
      header: 'Project',
      render: (p) => <span className="font-medium text-slate-100">{p.name}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (p) => (
        <span className="text-xs text-slate-400 font-mono uppercase tracking-wide">
          {PROJECT_TYPE_LABEL[p.type]}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => {
        const { variant, label } = PROJECT_STATUS_BADGE[p.status];
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      key: 'dates',
      header: 'Timeline',
      render: (p) => (
        <span className="text-slate-400 tabular-nums">
          {p.startDate ? formatDate(p.startDate) : '—'}
          {p.endDate ? ` → ${formatDate(p.endDate)}` : ''}
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      render: (p) => formatRate(p.rate ?? client.defaultRate),
      className: 'text-slate-400 tabular-nums',
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openProjectEdit(p)}
            className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => setDeleteProjectTarget(p)}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-950 hover:text-red-300 transition-colors"
          >
            Delete
          </button>
        </div>
      ),
      headerClassName: 'text-right',
    },
  ];

  const tabItems = [
    { key: 'overview', label: 'Overview' },
    { key: 'projects', label: 'Projects', count: projects.length },
    { key: 'invoices', label: 'Invoices' },
    { key: 'documents', label: 'Documents' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Back nav */}
      <Link
        to="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Clients
      </Link>

      {/* Client header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-100">{client.company}</h1>
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
            <span>{client.contactName}</span>
            {client.email && (
              <a href={`mailto:${client.email}`} className="text-indigo-400 hover:underline">
                {client.email}
              </a>
            )}
            {client.phone && <span>{client.phone}</span>}
            {client.defaultRate && (
              <span className="font-mono text-xs text-slate-500">{formatRate(client.defaultRate)}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {client.status !== 'past' && (
            <Button variant="ghost" size="sm" onClick={handleArchiveClient}>
              Archive
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setEditDrawerOpen(true)}>
            <Pencil size={13} />
            Edit
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        items={tabItems}
        active={activeTab}
        onChange={(k) => setActiveTab(k as TabKey)}
      />

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key info */}
          {(client.address || client.taxId) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {client.address && (
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Address</p>
                  <p className="whitespace-pre-line text-sm text-slate-300">{client.address}</p>
                </div>
              )}
              {client.taxId && (
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Tax ID / EIN</p>
                  <p className="text-sm font-mono text-slate-300">{client.taxId}</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              rows={5}
              placeholder="Internal notes about this client… (auto-saved on blur)"
            />
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={openProjectCreate}>
              <Plus size={14} />
              New Project
            </Button>
          </div>
          <Table
            columns={projectColumns}
            data={projects}
            getKey={(p) => p.id!}
            emptyState={
              <EmptyState
                icon={Briefcase}
                title="No projects yet"
                description="Add a project to track work for this client."
                action={
                  <Button size="sm" onClick={openProjectCreate}>
                    <Plus size={14} />
                    New Project
                  </Button>
                }
              />
            }
          />
        </div>
      )}

      {activeTab === 'invoices' && (
        <EmptyState
          icon={FileText}
          title="Invoices coming in Phase 2"
          description="You'll be able to create and track invoices linked to this client."
        />
      )}

      {activeTab === 'documents' && (
        <EmptyState
          icon={FolderOpen}
          title="Documents coming in Phase 4"
          description="Contract templates and generated documents will live here."
        />
      )}

      {/* Drawers & modals */}
      <ClientForm
        client={client}
        isOpen={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        onSuccess={(msg) => showToast('success', msg)}
      />

      <ProjectForm
        project={editingProject}
        lockedClientId={client.id}
        isOpen={projectDrawerOpen}
        onClose={() => setProjectDrawerOpen(false)}
        onSuccess={(msg) => showToast('success', msg)}
      />

      <ConfirmModal
        isOpen={!!deleteProjectTarget}
        onClose={() => setDeleteProjectTarget(undefined)}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        message={`Permanently delete "${deleteProjectTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={confirmingDelete}
      />

      <Toast toast={toast} />
    </div>
  );
}
