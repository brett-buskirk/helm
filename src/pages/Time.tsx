import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Clock, Pencil, Trash2, FilePlus } from 'lucide-react';
import { db } from '../db';
import type { TimeEntry, Project } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Toast } from '../components/ui/Toast';
import { TimeEntryForm } from '../components/time/TimeEntryForm';
import { useToast } from '../hooks/useToast';
import { formatDate, formatCurrency } from '../utils/format';
import { isInPeriod, type Period } from '../utils/date';
import {
  isUnbilled,
  summarizeHours,
  effectiveHourlyRate,
  createInvoiceFromUnbilledHours,
} from '../utils/time';

const PERIOD_OPTIONS = [
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All entries' },
  { value: 'unbilled', label: 'Unbilled' },
  { value: 'billed', label: 'Billed' },
  { value: 'nonbillable', label: 'Non-billable' },
];

function formatHours(h: number): string {
  return `${h % 1 === 0 ? h : h.toFixed(2)} hr${h === 1 ? '' : 's'}`;
}

export default function Time() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | undefined>();
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [period, setPeriod] = useState<Period>('month');
  const [clientFilter, setClientFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const allEntries = useLiveQuery(() => db.timeEntries.orderBy('date').reverse().toArray()) ?? [];
  const allClients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const allProjects = useLiveQuery(() => db.projects.toArray()) ?? [];

  const clientMap = useMemo(() => new Map(allClients.map((c) => [c.id!, c])), [allClients]);
  const projectMap = useMemo(() => new Map(allProjects.map((p) => [p.id!, p])), [allProjects]);

  // Projects available in the project filter (scoped to selected client)
  const filterProjects = useMemo(
    () => (clientFilter ? allProjects.filter((p) => String(p.clientId) === clientFilter) : allProjects),
    [allProjects, clientFilter],
  );

  const filtered = useMemo(() => {
    return allEntries.filter((e) => {
      const matchesPeriod = isInPeriod(e.date as unknown as Date, period);
      const matchesClient = !clientFilter || String(e.clientId) === clientFilter;
      const matchesProject = !projectFilter || String(e.projectId) === projectFilter;
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'unbilled' && isUnbilled(e)) ||
        (statusFilter === 'billed' && e.invoiceId != null) ||
        (statusFilter === 'nonbillable' && !e.billable);
      return matchesPeriod && matchesClient && matchesProject && matchesStatus;
    });
  }, [allEntries, period, clientFilter, projectFilter, statusFilter]);

  const summary = useMemo(() => {
    const totalHours = filtered.reduce((s, e) => s + e.hours, 0);
    const billableHours = filtered.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0);
    const unbilledHours = filtered.filter(isUnbilled).reduce((s, e) => s + e.hours, 0);
    return {
      totalHours: Math.round(totalHours * 100) / 100,
      billableHours: Math.round(billableHours * 100) / 100,
      unbilledHours: Math.round(unbilledHours * 100) / 100,
    };
  }, [filtered]);

  // When exactly one project is selected, compute its all-time unbilled total so
  // the "Generate Invoice" button reflects what will actually be billed.
  const selectedProject: Project | undefined = projectFilter
    ? projectMap.get(Number(projectFilter))
    : undefined;

  const projectRate = useLiveQuery(
    () => (selectedProject ? effectiveHourlyRate(selectedProject) : Promise.resolve(0)),
    [selectedProject?.id, selectedProject?.rate],
  ) ?? 0;

  const projectUnbilled = useMemo(() => {
    if (!selectedProject) return null;
    const entries = allEntries.filter((e) => e.projectId === selectedProject.id && isUnbilled(e));
    return summarizeHours(entries, projectRate);
  }, [selectedProject, allEntries, projectRate]);

  function openCreate() {
    setEditing(undefined);
    setDrawerOpen(true);
  }
  function openEdit(entry: TimeEntry) {
    setEditing(entry);
    setDrawerOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await db.timeEntries.delete(deleteTarget.id);
      showToast('success', 'Time entry deleted.');
    } catch {
      showToast('error', 'Delete failed.');
    } finally {
      setDeleting(false);
      setDeleteTarget(undefined);
    }
  }

  async function handleGenerateInvoice() {
    if (!selectedProject) return;
    setGenerating(true);
    try {
      const invoiceId = await createInvoiceFromUnbilledHours(selectedProject);
      if (invoiceId == null) {
        showToast('error', 'No unbilled hours for this project.');
        return;
      }
      showToast('success', 'Draft invoice created from unbilled hours.');
      navigate(`/invoices/${invoiceId}`);
    } catch {
      showToast('error', 'Could not generate the invoice.');
    } finally {
      setGenerating(false);
    }
  }

  const clientOptions = [
    { value: '', label: 'All clients' },
    ...allClients.map((c) => ({ value: String(c.id), label: c.company })),
  ];
  const projectOptions = [
    { value: '', label: 'All projects' },
    ...filterProjects.map((p) => ({ value: String(p.id), label: p.name })),
  ];

  const canGenerate =
    !!selectedProject && !!projectUnbilled && projectUnbilled.count > 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Time"
        description={`${allEntries.length} time ${allEntries.length === 1 ? 'entry' : 'entries'} logged`}
        action={
          <Button onClick={openCreate}>
            <Plus size={15} />
            Log Time
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          options={clientOptions}
          value={clientFilter}
          onChange={(e) => {
            setClientFilter(e.target.value);
            setProjectFilter('');
          }}
          className="w-48"
        />
        <Select
          options={projectOptions}
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="w-52"
        />
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
        />
        <div className="flex rounded-md border border-slate-700 overflow-hidden">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value as Period)}
              className={[
                'px-3 py-1.5 text-xs font-medium transition-colors',
                period === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary + generate */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 px-5 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-100">
              {formatHours(summary.totalHours)}
            </p>
          </div>
          <div className="border-l border-slate-700 pl-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Billable</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-300">
              {formatHours(summary.billableHours)}
            </p>
          </div>
          <div className="border-l border-slate-700 pl-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Unbilled</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-amber-400">
              {formatHours(summary.unbilledHours)}
            </p>
          </div>

          {selectedProject && (
            <div className="ml-auto flex items-center gap-3">
              {projectUnbilled && projectUnbilled.count > 0 ? (
                <p className="text-xs text-slate-500">
                  {formatHours(projectUnbilled.hours)} unbilled ·{' '}
                  <span className="text-slate-300">{formatCurrency(projectUnbilled.amount)}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-600">No unbilled hours</p>
              )}
              <Button size="sm" onClick={handleGenerateInvoice} loading={generating} disabled={!canGenerate}>
                <FilePlus size={13} />
                Generate Invoice
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={
            clientFilter || projectFilter || statusFilter
              ? 'No time entries match your filters'
              : period === 'month'
              ? 'No time logged this month'
              : 'No time logged'
          }
          description={
            clientFilter || projectFilter || statusFilter
              ? 'Try adjusting your filters.'
              : 'Log hours against a project to bill them later.'
          }
          action={
            !clientFilter && !projectFilter && !statusFilter ? (
              <Button onClick={openCreate}>
                <Plus size={15} />
                Log Time
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800">
                {['Date', 'Project', 'Description', 'Hours', 'Status', ''].map((h) => (
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
              {filtered.map((entry) => {
                const project = projectMap.get(entry.projectId);
                const client = clientMap.get(entry.clientId);
                const billed = entry.invoiceId != null;
                return (
                  <tr key={entry.id} className="group">
                    <td className="px-4 py-3 text-sm tabular-nums text-slate-400 whitespace-nowrap">
                      {formatDate(entry.date as unknown as Date)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-200">{project?.name ?? '—'}</p>
                      <p className="text-xs text-slate-500">{client?.company ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-[280px]">
                      <p className="truncate">{entry.description}</p>
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums font-medium text-slate-200 whitespace-nowrap">
                      {formatHours(entry.hours)}
                    </td>
                    <td className="px-4 py-3">
                      {!entry.billable ? (
                        <Badge variant="neutral">Non-billable</Badge>
                      ) : billed ? (
                        <button
                          onClick={() => navigate(`/invoices/${entry.invoiceId}`)}
                          title="View invoice"
                        >
                          <Badge variant="success">Billed</Badge>
                        </button>
                      ) : (
                        <Badge variant="warning">Unbilled</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {billed ? (
                          <span className="px-2 text-xs text-slate-600" title="Billed entries are locked">
                            locked
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => openEdit(entry)}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                              aria-label="Edit time entry"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(entry)}
                              className="rounded p-1.5 text-red-500 hover:bg-red-950 hover:text-red-300 transition-colors"
                              aria-label="Delete time entry"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TimeEntryForm
        entry={editing}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={(msg) => showToast('success', msg)}
        preselectedClientId={clientFilter ? Number(clientFilter) : undefined}
        preselectedProjectId={projectFilter ? Number(projectFilter) : undefined}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={handleDelete}
        title="Delete Time Entry"
        message={`Delete this ${deleteTarget ? formatHours(deleteTarget.hours) : ''} entry? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      <Toast toast={toast} />
    </div>
  );
}
