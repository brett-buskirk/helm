import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileDown } from 'lucide-react';
import { db } from '../../db';
import type { Client, Project, TimeEntry } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { FormField } from '../ui/FormField';
import { DatePicker } from '../ui/DatePicker';
import { TimeReportPDF } from './TimeReportPDF';
import { usePdfDownload } from '../../hooks/usePdfDownload';
import { toDateInputValue, parseDateInput } from '../../utils/format';
import { startOfMonth } from '../../utils/date';
import { entriesForReport, formatHours, reportFileName, totalHours } from '../../utils/timeReport';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onError: (message: string) => void;
  /** Preselects the project when opened from a filtered Time view. */
  initialProjectId?: number;
}

/**
 * Generate a client-facing time report.
 *
 * Self-contained on purpose: it asks for the project and period itself rather
 * than reading the Time page's filters. The controls originally lived inline in
 * the summary bar, which only renders when the current period filter matches an
 * entry — so the whole feature vanished if you were looking at the wrong month,
 * with nothing on screen to suggest it existed.
 */
export function TimeReportModal({ isOpen, onClose, onError, initialProjectId }: Props) {
  const { download, busy } = usePdfDownload(onError);

  const [projectId, setProjectId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const allEntries = useLiveQuery(() => db.timeEntries.toArray()) ?? [];
  const allProjects = useLiveQuery(() => db.projects.toArray()) ?? [];
  const allClients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.limit(1).first());

  const clientMap = useMemo(() => new Map(allClients.map((c) => [c.id!, c])), [allClients]);

  // Only projects that actually have billable time — picking one with nothing to
  // report is a dead end, and the list stays short as the practice grows.
  const reportableProjects = useMemo(() => {
    const withTime = new Set(
      allEntries.filter((e) => e.billable).map((e) => e.projectId),
    );
    return allProjects
      .filter((p) => p.id != null && withTime.has(p.id))
      .sort((a, b) => {
        const ca = clientMap.get(a.clientId)?.company ?? '';
        const cb = clientMap.get(b.clientId)?.company ?? '';
        return ca.localeCompare(cb) || a.name.localeCompare(b.name);
      });
  }, [allEntries, allProjects, clientMap]);

  // Reset to a fresh month-to-date window each time it opens, so a previous
  // run's dates never quietly carry into the next report.
  useEffect(() => {
    if (!isOpen) return;
    const today = new Date();
    setFrom(toDateInputValue(startOfMonth(today)));
    setTo(toDateInputValue(today));
    setProjectId(
      initialProjectId && reportableProjects.some((p) => p.id === initialProjectId)
        ? String(initialProjectId)
        : reportableProjects.length === 1
          ? String(reportableProjects[0].id)
          : '',
    );
    // reportableProjects is intentionally omitted: re-running on every live
    // query update would fight the user's own selection while the modal is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialProjectId]);

  const project: Project | undefined = projectId
    ? reportableProjects.find((p) => String(p.id) === projectId)
    : undefined;
  const client: Client | undefined = project ? clientMap.get(project.clientId) : undefined;

  const range = useMemo(
    () => ({ from: parseDateInput(from) ?? null, to: parseDateInput(to) ?? null }),
    [from, to],
  );
  const rangeInvalid = !!(range.from && range.to && range.from > range.to);

  const entries: TimeEntry[] = useMemo(
    () => (project?.id ? entriesForReport(allEntries, project.id, range) : []),
    [project?.id, allEntries, range],
  );

  const canDownload =
    !!project && !!client && !!range.from && !!range.to && !rangeInvalid && entries.length > 0;

  async function handleDownload() {
    if (!project || !client || !range.from || !range.to) return;
    await download(
      <TimeReportPDF
        project={project}
        client={client}
        entries={entries}
        from={range.from}
        to={range.to}
        settings={settings}
      />,
      reportFileName(client, project, range.from, range.to),
    );
    onClose();
  }

  const projectOptions = [
    { value: '', label: 'Select a project…' },
    ...reportableProjects.map((p) => ({
      value: String(p.id),
      label: `${clientMap.get(p.clientId)?.company ?? 'Unknown'} — ${p.name}`,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Time Report"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleDownload} loading={busy} disabled={!canDownload}>
            <FileDown size={15} />
            Download PDF
          </Button>
        </>
      }
    >
      {reportableProjects.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">
          No billable time has been logged yet. Log hours against a project and its report will be
          available here.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            A branded PDF of the hours worked on one project over a period — the work and the time,
            with a total. No rates or amounts; the invoice carries those.
          </p>

          <FormField label="Project" htmlFor="report-project" required>
            <Select
              id="report-project"
              options={projectOptions}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="From" htmlFor="report-from" required>
              <DatePicker id="report-from" value={from} onChange={setFrom} hasError={rangeInvalid} />
            </FormField>
            <FormField label="To" htmlFor="report-to" required>
              <DatePicker id="report-to" value={to} onChange={setTo} hasError={rangeInvalid} />
            </FormField>
          </div>

          {/* Live preview of exactly what will be in the PDF */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm">
            {rangeInvalid ? (
              <p className="text-red-400">The end date is before the start date.</p>
            ) : !project ? (
              <p className="text-slate-500">Choose a project to see what the report will cover.</p>
            ) : entries.length === 0 ? (
              <p className="text-slate-500">No billable time in this period.</p>
            ) : (
              <p className="text-slate-300">
                <span className="font-medium text-slate-100">
                  {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                </span>{' '}
                · <span className="font-medium text-slate-100">{formatHours(totalHours(entries))} hrs</span>
                <span className="mt-1 block text-xs text-slate-500">
                  Billable time only. Work that has already been invoiced is included — the report
                  records what was done, not what is owed.
                </span>
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
