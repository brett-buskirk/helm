import type { ReactNode } from 'react';
import { FileText, Pencil, Trash2 } from 'lucide-react';
import type { Client, Project, TimeEntry } from '../../types';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatDate, formatCurrency } from '../../utils/format';

interface Props {
  entry?: TimeEntry;
  project?: Project;
  client?: Client;
  /** The entry's value at the project's effective hourly rate, if it's billable. */
  value?: number;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
  onViewInvoice: (invoiceId: number) => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1 text-sm text-slate-200">{children}</div>
    </div>
  );
}

function formatHours(h: number): string {
  return `${h % 1 === 0 ? h : h.toFixed(2)} hr${h === 1 ? '' : 's'}`;
}

/**
 * Read-only detail for one time entry.
 *
 * The table truncates descriptions to keep rows scannable, which makes the most
 * useful field the hardest one to read. This shows it in full, with edit and
 * delete reachable from the same place.
 *
 * Billed entries stay locked, matching the table: their hours are already on an
 * invoice, so changing them would put that invoice's total out of step. The
 * drawer links to the invoice instead of offering an edit that would be wrong.
 */
export function TimeEntryDetail({
  entry,
  project,
  client,
  value,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onViewInvoice,
}: Props) {
  const billed = entry?.invoiceId != null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Time Entry"
      footer={
        entry ? (
          billed ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button variant="secondary" onClick={() => onViewInvoice(entry.invoiceId!)}>
                <FileText size={15} />
                View Invoice
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onDelete(entry)}>
                <Trash2 size={15} />
                Delete
              </Button>
              <Button onClick={() => onEdit(entry)}>
                <Pencil size={15} />
                Edit
              </Button>
            </>
          )
        ) : undefined
      }
    >
      {entry && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date">{formatDate(entry.date as unknown as Date)}</Field>
            <Field label="Hours">
              <span className="font-medium tabular-nums">{formatHours(entry.hours)}</span>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Client">{client?.company ?? '—'}</Field>
            <Field label="Project">{project?.name ?? '—'}</Field>
          </div>

          <Field label="Description">
            {/* whitespace-pre-wrap so multi-line notes keep their shape */}
            <p className="whitespace-pre-wrap leading-relaxed text-slate-300">
              {entry.description || '—'}
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              {!entry.billable ? (
                <Badge variant="neutral">Non-billable</Badge>
              ) : billed ? (
                <Badge variant="success">Billed</Badge>
              ) : (
                <Badge variant="warning">Unbilled</Badge>
              )}
            </Field>
            {entry.billable && value != null && (
              <Field label="Value">
                <span className="font-medium tabular-nums text-slate-200">
                  {formatCurrency(value)}
                </span>
              </Field>
            )}
          </div>

          {billed && (
            <p className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-xs text-slate-400">
              These hours are on an invoice, so the entry is locked. Cancelling or deleting that
              invoice releases them back to unbilled.
            </p>
          )}
        </div>
      )}
    </Drawer>
  );
}
