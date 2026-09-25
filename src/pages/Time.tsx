import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Clock, Pencil, Trash2, FilePlus, FileDown } from 'lucide-react';
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
import { TimeEntryDetail } from '../components/time/TimeEntryDetail';
import { TimeReportPDF } from '../components/time/TimeReportPDF';
import { useToast } from '../hooks/useToast';
import { usePdfDownload } from '../hooks/usePdfDownload';
import { formatDate, formatCurrency } from '../utils/format';
import { isInPeriod, type Period } from '../utils/date';
import {
  isUnbilled,
  summarizeHours,
  effectiveHourlyRate,
  createInvoiceFromUnbilledHours,
  unbilledInRange,
  formatRangeLabel,
} from '../utils/time';
import { DatePicker } from '../components/ui/DatePicker';
import { parseDateInput } from '../utils/format';
import { entriesForReport, reportFileName } from '../utils/timeReport';

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
  const { download: downloadPdf, busy: pdfBusy } = usePdfDownload((msg) =>
    showToast('error', msg),
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | undefined>();
  const [detail, setDetail] = useState<TimeEntry | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | undefined>();
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Optional inclusive window for the generated invoice. Empty on both ends
  // means "every unbilled hour", which is what this did before ranges existed.
  const [billFrom, setBillFrom] = useState('');
  const [billTo, setBillTo] = useState('');

  const [period, setPeriod] = useState<Period>('month');
  const [clientFilter, setClientFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const allEntries = useLiveQuery(() => db.timeEntries.orderBy('date').reverse().toArray()) ?? [];
  const allClients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const allProjects = useLiveQuery(() => db.projects.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.limit(1).first());

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

  const billRange = useMemo(
    () => ({ from: parseDateInput(billFrom) ?? null, to: parseDateInput(billTo) ?? null }),
    [billFrom, billTo],
  );

  // What "Generate Invoice" will actually bill: this project's unbilled hours,
  // narrowed to the range. Computed with the same helper the write path uses,
  // so the preview can't drift from the result.
  const projectUnbilled = useMemo(() => {
    if (!selectedProject) return null;
    const entries = unbilledInRange(
      allEntries.filter((e) => e.projectId === selectedProject.id),
      billRange,
    );
    return summarizeHours(entries, projectRate);
  }, [selectedProject, allEntries, projectRate, billRange]);

  const rangeInvalid = !!(billRange.from && billRange.to && billRange.from > billRange.to);

  // The report covers billable work in the window whether or not it has been
  // invoiced yet -- it documents the work done, not what is owed.
  const reportEntries = useMemo(
    () => (selectedProject?.id ? entriesForReport(allEntries, selectedProject.id, billRange) : []),
    [selectedProject?.id, allEntries, billRange],
  );

  // A report needs a definite period to print in its header, so unlike invoice
  // generation it requires both dates rather than defaulting to "everything".
  const canDownloadReport =
    !!selectedProject && !!billRange.from && !!billRange.to && !rangeInvalid && reportEntries.length > 0;

  // Value of the entry open in the detail drawer, at its project's effective
  // rate (the project's own, else the client default).
  const detailProject = detail ? projectMap.get(detail.projectId) : undefined;
  const detailRate = useLiveQuery(
    () => (detailProject ? effectiveHourlyRate(detailProject) : Promise.resolve(0)),
    [detailProject?.id, detailProject?.rate],
  ) ?? 0;
  const detailValue =
    detail?.billable ? Math.round(detail.hours * detailRate * 100) / 100 : undefined;

  function openCreate() {
    setEditing(undefined);
    setDrawerOpen(true);
  }
  function openEdit(entry: TimeEntry) {
    setEditing(entry);
    setDrawerOpen(true);
  }
  /**
   * Edit from the detail drawer: close detail first, then open the form. The
   * two drawers share the same slot, so stacking them would trap focus in the
   * one underneath.
   */
  function editFromDetail(entry: TimeEntry) {
    setDetail(undefined);
    openEdit(entry);
  }
  function deleteFromDetail(entry: TimeEntry) {
    setDetail(undefined);
    setDeleteTarget(entry);
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
      const invoiceId = await createInvoiceFromUnbilledHours(
        selectedProject,
        new Date(),
        billRange,
      );
      if (invoiceId == null) {
        showToast(
          'error',
          billRange.from || billRange.to
            ? 'No unbilled hours for this project in that date range.'
            : 'No unbilled hours for this project.',
        );
        return;
      }
      showToast(
        'success',
        billRange.from && billRange.to
          ? `Draft invoice created for ${formatRangeLabel(billRange.from, billRange.to)}.`
          : 'Draft invoice created from unbilled hours.',
      );
      navigate(`/invoices/${invoiceId}`);
    } catch {
      showToast('error', 'Could not generate the invoice.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownloadReport() {
    const client = selectedProject ? clientMap.get(selectedProject.clientId) : undefined;
    if (!selectedProject || !client || !billRange.from || !billRange.to) return;
    await downloadPdf(
      <TimeReportPDF
        project={selectedProject}
        client={client}
        entries={reportEntries}
        from={billRange.from}
        to={billRange.to}
        settings={settings}
      />,
      reportFileName(client, selectedProject, billRange.from, billRange.to),
    );
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
    !!selectedProject && !!projectUnbilled && projectUnbilled.count > 0 && !rangeInvalid;

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
            <div className="ml-auto flex flex-wrap items-end gap-3">
              {/* Optional inclusive window — leave both blank to bill everything */}
              <div>
                <label
                  htmlFor="bill-from"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Bill from
                </label>
                <DatePicker
                  id="bill-from"
                  value={billFrom}
                  onChange={setBillFrom}
                  placeholder="Earliest"
                  hasError={rangeInvalid}
                />
              </div>
              <div>
                <label
                  htmlFor="bill-to"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  To
                </label>
                <DatePicker
                  id="bill-to"
                  value={billTo}
                  onChange={setBillTo}
                  placeholder="Latest"
                  hasError={rangeInvalid}
                />
              </div>

              <div className="flex items-center gap-3 pb-1.5">
                {rangeInvalid ? (
                  <p className="text-xs text-red-400">End date is before the start date.</p>
                ) : projectUnbilled && projectUnbilled.count > 0 ? (
                  <p className="text-xs text-slate-500">
                    {formatHours(projectUnbilled.hours)} unbilled ·{' '}
                    <span className="text-slate-300">{formatCurrency(projectUnbilled.amount)}</span>
                    {(billRange.from || billRange.to) && (
                      <span className="text-slate-600"> in range</span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-slate-600">
                    {billRange.from || billRange.to
                      ? 'No unbilled hours in range'
                      : 'No unbilled hours'}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleDownloadReport}
                  loading={pdfBusy}
                  disabled={!canDownloadReport}
                  title={
                    billRange.from && billRange.to
                      ? 'Download a client-facing report of hours worked'
                      : 'Set both dates to download a report'
                  }
                >
                  <FileDown size={13} />
                  Time Report
                </Button>
                <Button
                  size="sm"
                  onClick={handleGenerateInvoice}
                  loading={generating}
                  disabled={!canGenerate}
                >
                  <FilePlus size={13} />
                  Generate Invoice
                </Button>
              </div>
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
                  <tr
                    key={entry.id}
                    className="group cursor-pointer transition-colors hover:bg-slate-800/60"
                    onClick={() => setDetail(entry)}
                  >
                    <td className="px-4 py-3 text-sm tabular-nums text-slate-400 whitespace-nowrap">
                      {formatDate(entry.date as unknown as Date)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-200">{project?.name ?? '—'}</p>
                      <p className="text-xs text-slate-500">{client?.company ?? '—'}</p>
                    </td>
                    <td className="max-w-[280px] px-4 py-3 text-sm text-slate-400">
                      {/*
                        The row is clickable for the mouse, but a <tr> can't take
                        focus without breaking table semantics for screen readers.
                        The description doubles as the keyboard affordance: it's
                        the field the drawer exists to show in full, so its own
                        text is a meaningful accessible name.
                      */}
                      <button
                        type="button"
                        title="View details"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetail(entry);
                        }}
                        className="block w-full truncate text-left transition-colors hover:text-slate-200"
                      >
                        {entry.description}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums font-medium text-slate-200 whitespace-nowrap">
                      {formatHours(entry.hours)}
                    </td>
                    <td className="px-4 py-3">
                      {!entry.billable ? (
                        <Badge variant="neutral">Non-billable</Badge>
                      ) : billed ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/invoices/${entry.invoiceId}`);
                          }}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(entry);
                              }}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                              aria-label="Edit time entry"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(entry);
                              }}
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

      <TimeEntryDetail
        entry={detail}
        project={detailProject}
        client={detail ? clientMap.get(detail.clientId) : undefined}
        value={detailValue}
        isOpen={!!detail}
        onClose={() => setDetail(undefined)}
        onEdit={editFromDetail}
        onDelete={deleteFromDetail}
        onViewInvoice={(invoiceId) => navigate(`/invoices/${invoiceId}`)}
      />

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
