import { db } from '../db';
import type { Invoice, InvoiceLineItem, Project, TimeEntry } from '../types';
import { generateInvoiceNumber, incrementInvoiceNumber, calculateDueDate } from './invoice';
import { formatDate, toDateInputValue, parseDateInput } from './format';
import { coerceDate } from './date';

/** Round to cents to avoid floating-point drift in money math. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** An entry is billable income only if flagged billable and not yet on an invoice. */
export function isUnbilled(entry: TimeEntry): boolean {
  return entry.billable && entry.invoiceId == null;
}

export interface HoursSummary {
  count: number;
  hours: number;
  amount: number;
}

/** Total hours and value of the given entries at a flat hourly rate. */
export function summarizeHours(entries: TimeEntry[], rate: number): HoursSummary {
  const hours = entries.reduce((s, e) => s + (e.hours || 0), 0);
  return {
    count: entries.length,
    hours: round2(hours),
    amount: round2(hours * rate),
  };
}

/** One invoice line item per time entry: "Jun 14, 2026 — {description}". */
export function buildHourlyLineItems(entries: TimeEntry[], rate: number): InvoiceLineItem[] {
  return entries
    .slice()
    .sort((a, b) => {
      const da = coerceDate(a.date as unknown as Date);
      const dbb = coerceDate(b.date as unknown as Date);
      return (da?.getTime() ?? 0) - (dbb?.getTime() ?? 0);
    })
    .map((e) => ({
      description: `${formatDate(e.date as unknown as Date)} — ${e.description}`,
      quantity: e.hours,
      unitPrice: rate,
      amount: round2(e.hours * rate),
    }));
}

/** Effective hourly rate for a project: its own rate, else the client default. */
export async function effectiveHourlyRate(project: Project): Promise<number> {
  if (project.rate != null) return project.rate;
  const client = project.clientId ? await db.clients.get(project.clientId) : undefined;
  return client?.defaultRate ?? 0;
}

/**
 * Roll a project's unbilled, billable time entries into a single draft invoice,
 * then mark those entries as billed (invoiceId set). Atomic. Returns the new
 * invoice id, or null when there are no unbilled hours to bill.
 */
export async function createInvoiceFromUnbilledHours(
  project: Project,
  issueDate: Date = new Date(),
): Promise<number | null> {
  if (!project.id) throw new Error('Cannot invoice hours for an unsaved project.');
  const projectId = project.id;
  const rate = await effectiveHourlyRate(project);

  return db.transaction('rw', [db.timeEntries, db.invoices, db.settings], async () => {
    const entries = (await db.timeEntries.where('projectId').equals(projectId).toArray()).filter(
      isUnbilled,
    );
    if (entries.length === 0) return null;

    const lineItems = buildHourlyLineItems(entries, rate);
    const subtotal = round2(lineItems.reduce((s, li) => s + li.amount, 0));
    const paymentTerms = 'Net 30';
    const dueDate =
      parseDateInput(calculateDueDate(toDateInputValue(issueDate), paymentTerms)) ?? issueDate;
    const invoiceNumber = await generateInvoiceNumber();
    const now = new Date();

    const payload: Omit<Invoice, 'id'> = {
      clientId: project.clientId,
      projectId,
      invoiceNumber,
      status: 'draft',
      issueDate,
      dueDate,
      lineItems,
      subtotal,
      taxRate: 0,
      taxAmount: 0,
      total: subtotal,
      amountPaid: 0,
      balanceDue: subtotal,
      paymentTerms,
      createdAt: now,
      updatedAt: now,
    };

    const invoiceId = (await db.invoices.add(payload as Invoice)) as number;
    await incrementInvoiceNumber();
    const ids = entries.map((e) => e.id!).filter((id) => id != null);
    await db.timeEntries.where('id').anyOf(ids).modify({ invoiceId, updatedAt: now });
    return invoiceId;
  });
}

/**
 * Detach any time entries billed to this invoice, returning them to unbilled.
 * Call when an invoice is cancelled so its hours can be re-invoiced.
 */
export async function releaseTimeEntriesForInvoice(invoiceId: number): Promise<number> {
  return db.timeEntries
    .where('invoiceId')
    .equals(invoiceId)
    .modify((entry) => {
      entry.invoiceId = undefined;
      entry.updatedAt = new Date();
    });
}
