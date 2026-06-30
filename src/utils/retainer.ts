import { db } from '../db';
import type { Invoice, Project } from '../types';
import { generateInvoiceNumber, incrementInvoiceNumber, calculateDueDate } from './invoice';
import { toDateInputValue, parseDateInput } from './format';
import { startOfMonth, endOfMonth, coerceDate } from './date';

/** Long-form "July 2026" label for a retainer period. */
export function retainerPeriodLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Find an existing invoice for this retainer project whose issue date falls in
 * the same calendar month as `date`. Used to warn before generating a duplicate.
 */
export async function findRetainerInvoiceForMonth(
  projectId: number,
  date: Date,
): Promise<Invoice | undefined> {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const invoices = await db.invoices.where('projectId').equals(projectId).toArray();
  return invoices.find((inv) => {
    const d = coerceDate(inv.issueDate as unknown as Date);
    return d !== null && d >= start && d <= end;
  });
}

/**
 * Build the invoice payload for a retainer project for the given month.
 * Pure (no DB writes) so it can be unit-tested; callers persist the result.
 * Defaults to 0% client-facing tax — the business's self-employment set-aside
 * rate is tracked separately and must not be charged to the client.
 */
export function buildRetainerInvoice(
  project: Project,
  invoiceNumber: string,
  issueDate: Date,
  paymentTerms = 'Net 30',
): Omit<Invoice, 'id'> {
  const rate = project.rate ?? 0;
  const period = retainerPeriodLabel(issueDate);
  const lineItem = {
    description: `Monthly Retainer — ${project.name} (${period})`,
    quantity: 1,
    unitPrice: rate,
    amount: rate,
  };

  const dueStr = calculateDueDate(toDateInputValue(issueDate), paymentTerms);
  const dueDate = parseDateInput(dueStr) ?? issueDate;
  const now = new Date();

  return {
    clientId: project.clientId,
    projectId: project.id,
    invoiceNumber,
    status: 'draft',
    issueDate,
    dueDate,
    lineItems: [lineItem],
    subtotal: rate,
    taxRate: 0,
    taxAmount: 0,
    total: rate,
    amountPaid: 0,
    balanceDue: rate,
    paymentTerms,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generate and persist a draft retainer invoice for the given month.
 * Returns the new invoice id.
 */
export async function createRetainerInvoice(
  project: Project,
  issueDate: Date = new Date(),
): Promise<number> {
  if (!project.id) throw new Error('Cannot create a retainer invoice for an unsaved project.');
  const invoiceNumber = await generateInvoiceNumber();
  const payload = buildRetainerInvoice(project, invoiceNumber, issueDate);
  const id = await db.invoices.add(payload as Invoice);
  await incrementInvoiceNumber();
  return id as number;
}
