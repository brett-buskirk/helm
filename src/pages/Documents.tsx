import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, FolderOpen, Download, Sparkles, Pencil, Trash2 } from 'lucide-react';
import { usePdfDownload } from '../hooks/usePdfDownload';
import { db } from '../db';
import type { Document, DocumentType } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Toast } from '../components/ui/Toast';
import { DocumentPDF } from '../components/documents/DocumentPDF';
import { GenerateDocModal } from '../components/documents/GenerateDocModal';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../utils/format';

const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  msa: 'MSA',
  nda: 'NDA',
  sow: 'SOW',
  proposal: 'Proposal',
  other: 'Other',
};

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'msa', label: 'MSA' },
  { value: 'nda', label: 'NDA' },
  { value: 'sow', label: 'SOW' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'other', label: 'Other' },
];

type TabKey = 'templates' | 'documents';

export default function Documents() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const { download: downloadPdf, busy: pdfBusy } = usePdfDownload((msg) => showToast('error', msg));

  const [tab, setTab] = useState<TabKey>('templates');
  const [typeFilter, setTypeFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Document | undefined>();
  const [deleting, setDeleting] = useState(false);
  const [generateTarget, setGenerateTarget] = useState<Document | undefined>();

  const allDocs = useLiveQuery(() =>
    db.documents.toArray().then((arr) => arr.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)))
  ) ?? [];
  const allClients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.limit(1).first());

  const clientMap = useMemo(() => new Map(allClients.map((c) => [c.id!, c])), [allClients]);

  const templates = useMemo(
    () => allDocs.filter((d) => d.isTemplate && (!typeFilter || d.type === typeFilter)),
    [allDocs, typeFilter],
  );

  const clientDocs = useMemo(
    () =>
      allDocs.filter(
        (d) =>
          !d.isTemplate &&
          (!typeFilter || d.type === typeFilter) &&
          (!clientFilter || String(d.clientId) === clientFilter),
      ),
    [allDocs, typeFilter, clientFilter],
  );

  const clientOptions = [
    { value: '', label: 'All clients' },
    ...allClients.map((c) => ({ value: String(c.id), label: c.company })),
  ];

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

  const tabItems = [
    { key: 'templates', label: 'Templates', count: allDocs.filter((d) => d.isTemplate).length || undefined },
    { key: 'documents', label: 'Documents', count: allDocs.filter((d) => !d.isTemplate).length || undefined },
  ];

  const currentList = tab === 'templates' ? templates : clientDocs;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Documents"
        description={`${allDocs.filter((d) => d.isTemplate).length} templates · ${allDocs.filter((d) => !d.isTemplate).length} documents`}
        action={
          <Button onClick={() => navigate('/documents/new')}>
            <Plus size={15} />
            New Document
          </Button>
        }
      />

      <Tabs items={tabItems} active={tab} onChange={(k) => setTab(k as TabKey)} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          options={TYPE_OPTIONS}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-44"
        />
        {tab === 'documents' && (
          <Select
            options={clientOptions}
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="w-52"
          />
        )}
      </div>

      {currentList.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={
            tab === 'templates'
              ? typeFilter
                ? 'No templates of this type'
                : 'No templates yet'
              : typeFilter || clientFilter
              ? 'No documents match your filters'
              : 'No documents yet'
          }
          description={
            tab === 'templates'
              ? 'Create reusable templates for MSAs, NDAs, SOWs, and proposals.'
              : 'Generate client documents from templates, or create from scratch.'
          }
          action={
            <Button onClick={() => navigate('/documents/new')}>
              <Plus size={15} />
              {tab === 'templates' ? 'New Template' : 'New Document'}
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800">
                {[
                  'Type',
                  'Title',
                  ...(tab === 'documents' ? ['Client'] : []),
                  'Updated',
                  '',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-slate-900">
              {currentList.map((doc) => (
                <tr key={doc.id} className="group border-b border-slate-800 last:border-0">
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
                  {tab === 'documents' && (
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {doc.clientId ? (clientMap.get(doc.clientId)?.company ?? '—') : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-500 whitespace-nowrap">
                    {formatDate(doc.updatedAt as unknown as Date)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {doc.isTemplate && (
                        <button
                          onClick={() => setGenerateTarget(doc)}
                          title="Generate client document from this template"
                          className="rounded p-1.5 text-indigo-400 hover:bg-slate-700 hover:text-indigo-300 transition-colors"
                        >
                          <Sparkles size={13} />
                        </button>
                      )}
                      <button
                        title="Download PDF"
                        disabled={pdfBusy}
                        onClick={() => downloadPdf(<DocumentPDF doc={doc} settings={settings} />, `${doc.title.replace(/[^a-z0-9]/gi, '_')}.pdf`)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors disabled:opacity-40"
                      >
                        <Download size={13} />
                      </button>
                      <button
                        onClick={() => navigate(`/documents/${doc.id}/edit`)}
                        title="Edit"
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(doc)}
                        title="Delete"
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

      <Toast toast={toast} />
    </div>
  );
}
