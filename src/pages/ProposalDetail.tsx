import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Pencil, Trash2, Download, FileText, CheckCircle, XCircle, Send } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { db } from '../db';
import type { ProposalStatus } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Toast } from '../components/ui/Toast';
import { ProposalPDF } from '../components/proposals/ProposalPDF';
import { useToast } from '../hooks/useToast';
import { formatCurrency, formatDate } from '../utils/format';

const STATUS_BADGE: Record<ProposalStatus, { variant: 'neutral' | 'info' | 'success' | 'danger'; label: string }> = {
  draft: { variant: 'neutral', label: 'Draft' },
  sent: { variant: 'info', label: 'Sent' },
  accepted: { variant: 'success', label: 'Accepted' },
  declined: { variant: 'danger', label: 'Declined' },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="text-sm text-slate-200 whitespace-pre-wrap">{children}</div>
    </div>
  );
}

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);

  const proposal = useLiveQuery(() => db.proposals.get(Number(id)), [id]);
  const client = useLiveQuery(
    () => (proposal?.clientId ? db.clients.get(proposal.clientId) : undefined),
    [proposal?.clientId],
  );
  const project = useLiveQuery(
    () => (proposal?.projectId ? db.projects.get(proposal.projectId) : undefined),
    [proposal?.projectId],
  );
  const settings = useLiveQuery(() => db.settings.limit(1).first());

  if (proposal === undefined) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500 text-sm">
        Loading…
      </div>
    );
  }
  if (proposal === null) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500 text-sm">
        Proposal not found.
      </div>
    );
  }

  const { variant, label } = STATUS_BADGE[proposal.status];
  const isExpired = proposal.validUntil
    ? new Date(proposal.validUntil as unknown as Date) < new Date()
    : false;

  async function updateStatus(status: ProposalStatus) {
    if (!proposal?.id) return;
    setUpdating(true);
    try {
      await db.proposals.update(proposal.id, { status, updatedAt: new Date() });
      showToast('success', `Proposal marked as ${status}.`);
    } catch {
      showToast('error', 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!proposal?.id) return;
    setDeleting(true);
    try {
      await db.proposals.delete(proposal.id);
      navigate('/proposals');
    } catch {
      showToast('error', 'Failed to delete proposal.');
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  function handleCreateInvoice() {
    if (!proposal?.id) return;
    navigate(`/invoices/new?proposalId=${proposal.id}`);
  }

  const safeFilename = proposal.title.replace(/[^a-z0-9]/gi, '_');

  return (
    <div className="min-h-full pb-12">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/proposals"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ArrowLeft size={14} /> Proposals
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-sm font-medium text-slate-200 truncate max-w-xs">
            {proposal.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <PDFDownloadLink
            document={<ProposalPDF proposal={proposal} client={client} project={project} settings={settings} />}
            fileName={`${safeFilename}.pdf`}
          >
            {({ loading }) => (
              <Button variant="ghost" size="sm" disabled={loading}>
                <Download size={14} />
                PDF
              </Button>
            )}
          </PDFDownloadLink>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/proposals/${id}/edit`)}>
            <Pencil size={14} />
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant={variant}>{label}</Badge>
              {isExpired && proposal.status === 'sent' && (
                <Badge variant="danger">Expired</Badge>
              )}
            </div>
            <h1 className="text-2xl font-semibold text-slate-100">{proposal.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {client?.company ?? '—'}
              {project ? ` · ${project.name}` : ''}
              {' · '}Created {formatDate(proposal.createdAt)}
            </p>
          </div>

          {/* Status action buttons */}
          <div className="flex flex-col gap-2 shrink-0">
            {proposal.status === 'draft' && (
              <Button size="sm" onClick={() => updateStatus('sent')} loading={updating}>
                <Send size={13} />
                Mark Sent
              </Button>
            )}
            {proposal.status === 'sent' && (
              <>
                <Button size="sm" onClick={() => updateStatus('accepted')} loading={updating}>
                  <CheckCircle size={13} />
                  Mark Accepted
                </Button>
                <Button size="sm" variant="secondary" onClick={() => updateStatus('declined')} loading={updating}>
                  <XCircle size={13} />
                  Mark Declined
                </Button>
              </>
            )}
            {proposal.status === 'accepted' && (
              <Button size="sm" onClick={handleCreateInvoice}>
                <FileText size={13} />
                Create Invoice
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          {/* Main content */}
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 space-y-5">
              <Field label="Scope of Work">{proposal.scope}</Field>
              <div className="border-t border-slate-700" />
              <Field label="Deliverables">{proposal.deliverables}</Field>
              {proposal.notes && (
                <>
                  <div className="border-t border-slate-700" />
                  <Field label="Notes">{proposal.notes}</Field>
                </>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Pricing */}
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Fee
              </p>
              <p className="text-3xl font-bold tabular-nums text-slate-100">
                {formatCurrency(proposal.pricing)}
              </p>
              {proposal.pricingNote && (
                <p className="mt-2 text-xs text-slate-500">{proposal.pricingNote}</p>
              )}
            </div>

            {/* Details */}
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
              <Field label="Client">{client?.company ?? '—'}</Field>
              {project && <Field label="Project">{project.name}</Field>}
              <Field label="Status">
                <Badge variant={variant}>{label}</Badge>
              </Field>
              {proposal.validUntil && (
                <Field label="Valid Until">
                  <span className={isExpired ? 'text-red-400' : ''}>
                    {formatDate(proposal.validUntil as unknown as Date)}
                    {isExpired ? ' · Expired' : ''}
                  </span>
                </Field>
              )}
              <Field label="Created">{formatDate(proposal.createdAt)}</Field>
              <Field label="Updated">{formatDate(proposal.updatedAt)}</Field>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Proposal"
        message={`Delete "${proposal.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      <Toast toast={toast} />
    </div>
  );
}
