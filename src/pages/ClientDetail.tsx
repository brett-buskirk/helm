import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Briefcase, FileText, FolderOpen, Pencil, Download, Sparkles, StickyNote, Trash2 } from 'lucide-react';
import { usePdfDownload } from '../hooks/usePdfDownload';
import { db } from '../db';
import type { Project, ProjectStatus, ProjectType, Invoice, InvoiceStatus, Document, DocumentType, Proposal, ProposalStatus } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { Textarea } from '../components/ui/Textarea';
import { Table, type TableColumn } from '../components/ui/Table';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { ClientForm } from '../components/clients/ClientForm';
import { ProjectForm } from '../components/projects/ProjectForm';
import { ProjectLinks } from '../components/projects/ProjectLinks';
import { DocumentPDF } from '../components/documents/DocumentPDF';
import { GenerateDocModal } from '../components/documents/GenerateDocModal';
import { useToast } from '../hooks/useToast';
import { formatDate, formatCurrency, formatRate, formatProjectRate } from '../utils/format';
import { getEffectiveStatus } from '../utils/invoice';

const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  msa: 'MSA', nda: 'NDA', sow: 'SOW', proposal: 'Proposal', other: 'Other',
};

function ClientDocumentsTab({ clientId }: { clientId: number }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { download: downloadPdf, busy: pdfBusy } = usePdfDownload((msg) => showToast('error', msg));
  const [generateTarget, setGenerateTarget] = useState<Document | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Document | undefined>();
  const [deleting, setDeleting] = useState(false);
  const docs = useLiveQuery(
    () =>
      db.documents
        .where('clientId')
        .equals(clientId)
        .toArray()
        .then((arr) => arr.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))),
    [clientId],
  ) ?? [];
  const templates = useLiveQuery(() => db.documents.where('isTemplate').equals(1).toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.limit(1).first());

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await db.documents.delete(deleteTarget.id);
      showToast('success', 'Document deleted.');
    } catch {
      showToast('error', 'Delete failed.');
    } finally {
      setDeleting(false);
      setDeleteTarget(undefined);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {templates.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => navigate('/documents')}>
              <Sparkles size={13} />
              Generate from Template
            </Button>
          )}
        </div>
        <Button size="sm" onClick={() => navigate(`/documents/new`)}>
          <Plus size={14} />
          New Document
        </Button>
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No documents for this client"
          description="Create a document or generate one from a template."
          action={
            <Button size="sm" onClick={() => navigate('/documents/new')}>
              <Plus size={14} />
              New Document
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800">
                {['Type', 'Title', 'Updated', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {(docs as Document[]).map((doc) => (
                <tr key={doc.id} className="group">
                  <td className="px-4 py-3">
                    <Badge variant="neutral">{DOC_TYPE_LABEL[doc.type]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/documents/${doc.id}/edit`)}
                      className="text-left text-sm font-medium text-slate-100 hover:text-indigo-400 transition-colors"
                    >
                      {doc.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-500 whitespace-nowrap">
                    {formatDate(doc.updatedAt as unknown as Date)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        disabled={pdfBusy}
                        title="Download PDF"
                        onClick={() => downloadPdf(<DocumentPDF doc={doc} settings={settings} />, `${doc.title.replace(/[^a-z0-9]/gi, '_')}.pdf`)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors disabled:opacity-40"
                      >
                        <Download size={13} />
                      </button>
                      <button
                        onClick={() => navigate(`/documents/${doc.id}/edit`)}
                        aria-label="Edit document"
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(doc)}
                        aria-label="Delete document"
                        className="rounded p-1.5 text-red-500 hover:bg-red-950 hover:text-red-300 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {generateTarget && (
        <GenerateDocModal
          template={generateTarget}
          isOpen={!!generateTarget}
          onClose={() => setGenerateTarget(undefined)}
          onSuccess={(msg) => showToast('success', msg)}
        />
      )}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={handleDelete}
        title="Delete Document"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

const CLIENT_STATUS_BADGE = {
  lead: { variant: 'info' as const, label: 'Lead' },
  active: { variant: 'success' as const, label: 'Active' },
  past: { variant: 'neutral' as const, label: 'Past' },
};

const PROJECT_STATUS_BADGE: Record<ProjectStatus, { variant: 'success' | 'warning' | 'info' | 'danger' | 'neutral'; label: string }> = {
  lead: { variant: 'neutral', label: 'Lead' },
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

const PROPOSAL_STATUS_BADGE: Record<ProposalStatus, { variant: 'neutral' | 'info' | 'success' | 'danger'; label: string }> = {
  draft: { variant: 'neutral', label: 'Draft' },
  sent: { variant: 'info', label: 'Sent' },
  accepted: { variant: 'success', label: 'Accepted' },
  declined: { variant: 'danger', label: 'Declined' },
};

function ClientProposalsTab({ clientId }: { clientId: number }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<Proposal | undefined>();
  const [deleting, setDeleting] = useState(false);

  const proposals = useLiveQuery(
    () =>
      db.proposals
        .where('clientId')
        .equals(clientId)
        .toArray()
        .then((arr) => arr.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))),
    [clientId],
  ) ?? [];

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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => navigate(`/proposals/new?clientId=${clientId}`)}>
          <Plus size={14} />
          New Proposal
        </Button>
      </div>

      {proposals.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No proposals for this client"
          description="Create a proposal to kick off the engagement."
          action={
            <Button size="sm" onClick={() => navigate(`/proposals/new?clientId=${clientId}`)}>
              <Plus size={14} />
              New Proposal
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800">
                {['Title', 'Amount', 'Valid Until', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {(proposals as Proposal[]).map((p) => {
                const { variant, label } = PROPOSAL_STATUS_BADGE[p.status];
                const isExpired = p.validUntil && new Date(p.validUntil as unknown as Date) < new Date();
                return (
                  <tr key={p.id} className="group cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => navigate(`/proposals/${p.id}`)}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-100">{p.title}</td>
                    <td className="px-4 py-3 text-sm tabular-nums font-medium text-slate-100">{formatCurrency(p.pricing)}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-slate-500 whitespace-nowrap">
                      {p.validUntil ? (
                        <span className={isExpired ? 'text-red-400' : ''}>{formatDate(p.validUntil as unknown as Date)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3"><Badge variant={variant}>{label}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => navigate(`/proposals/${p.id}/edit`)} aria-label="Edit proposal" className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteTarget(p)} aria-label="Delete proposal" className="rounded p-1.5 text-red-500 hover:bg-red-950 hover:text-red-300 transition-colors"><Trash2 size={13} /></button>
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
    </div>
  );
}

type TabKey = 'overview' | 'projects' | 'invoices' | 'proposals' | 'documents';

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
  const [noteProject, setNoteProject] = useState<Project | undefined>();

  const navigate = useNavigate();
  const clientId = Number(id);
  const client = useLiveQuery(() => db.clients.get(clientId), [clientId]);
  const projects = useLiveQuery(
    () => db.projects.where('clientId').equals(clientId).sortBy('name'),
    [clientId],
  ) ?? [];
  const clientInvoices = useLiveQuery(
    () => db.invoices.where('clientId').equals(clientId).reverse().sortBy('issueDate'),
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
      render: (p) => formatProjectRate(p.rate ?? (p.type === 'hourly' ? client.defaultRate : undefined), p.type),
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
    { key: 'invoices', label: 'Invoices', count: clientInvoices.length || undefined },
    { key: 'proposals', label: 'Proposals' },
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
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => navigate(`/invoices/new?clientId=${clientId}`)}>
              <Plus size={14} />
              New Invoice
            </Button>
          </div>
          {clientInvoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description="Create an invoice for this client to get started."
              action={
                <Button size="sm" onClick={() => navigate(`/invoices/new?clientId=${clientId}`)}>
                  <Plus size={14} />
                  New Invoice
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-700">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800">
                    {['Invoice #', 'Status', 'Total', 'Balance', 'Due'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900">
                  {(clientInvoices as Invoice[]).map((inv) => {
                    const eff = getEffectiveStatus(inv);
                    const statusColor: Record<InvoiceStatus, string> = {
                      draft: 'text-slate-400',
                      sent: 'text-blue-400',
                      overdue: 'text-red-400',
                      paid: 'text-emerald-400',
                      cancelled: 'text-slate-600',
                    };
                    return (
                      <tr
                        key={inv.id}
                        className="cursor-pointer hover:bg-slate-800 transition-colors"
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                      >
                        <td className="px-4 py-3 font-mono text-sm font-medium text-slate-100">
                          {inv.invoiceNumber}
                        </td>
                        <td className={`px-4 py-3 text-sm font-medium ${statusColor[eff]}`}>
                          {eff.charAt(0).toUpperCase() + eff.slice(1)}
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums text-slate-200">
                          {formatCurrency(inv.total)}
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums text-slate-400">
                          {inv.balanceDue > 0 ? formatCurrency(inv.balanceDue) : '—'}
                        </td>
                        <td className={`px-4 py-3 text-sm tabular-nums ${eff === 'overdue' ? 'font-semibold text-red-400' : 'text-slate-400'}`}>
                          {formatDate(inv.dueDate as unknown as Date)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'proposals' && (
        <ClientProposalsTab clientId={clientId} />
      )}

      {activeTab === 'documents' && (
        <ClientDocumentsTab clientId={clientId} />
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
