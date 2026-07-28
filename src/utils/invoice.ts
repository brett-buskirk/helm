import { db } from '../db';
import type { Invoice, InvoiceStatus } from '../types';
import { toDateInputValue } from './format';

export const PAYMENT_TERMS_OPTIONS = [
  { value: 'Due on Receipt', label: 'Due on Receipt', days: 0 },
  { value: 'Net 15', label: 'Net 15', days: 15 },
  { value: 'Net 30', label: 'Net 30', days: 30 },
  { value: 'Net 45', label: 'Net 45', days: 45 },
  { value: 'Net 60', label: 'Net 60', days: 60 },
];

/**
 * The balance-due invariant for an invoice: never negative, always the total
 * minus what's been paid. Centralized so create/edit/payment paths agree.
 */
export function computeBalanceDue(total: number, amountPaid: number): number {
  return Math.max(0, total - amountPaid);
}

/**
 * Permanently delete an invoice and everything tied to it, atomically:
 * its recorded payments (so income and the 25% tax set-aside adjust on the
 * dashboard) and any time entries billed to it (returned to unbilled so they
 * can be re-invoiced). The dashboard, being `useLiveQuery`-driven off the
 * payments and invoices tables, recomputes on its own once these are gone.
 *
 * Returns how many payments were removed and how many time entries were freed.
 * (The time-release is inlined rather than importing `time.ts` to avoid an
 * invoice ↔ time circular import.)
 */
export async function deleteInvoiceCascade(
  invoiceId: number,
): Promise<{ payments: number; released: number }> {
  return db.transaction('rw', [db.invoices, db.payments, db.timeEntries], async () => {
    const payments = await db.payments.where('invoiceId').equals(invoiceId).count();
    await db.payments.where('invoiceId').equals(invoiceId).delete();
    const released = await db.timeEntries
      .where('invoiceId')
      .equals(invoiceId)
      .modify((entry) => {
        entry.invoiceId = undefined;
        entry.updatedAt = new Date();
      });
    await db.invoices.delete(invoiceId);
    return { payments, released };
  });
}

/** Returns 'overdue' if sent and past due date; otherwise the stored status. */
export function getEffectiveStatus(invoice: Pick<Invoice, 'status' | 'dueDate'>): InvoiceStatus {
  if (invoice.status === 'sent') {
    const due =
      invoice.dueDate instanceof Date ? invoice.dueDate : new Date(invoice.dueDate as unknown as string);
    if (due < new Date()) return 'overdue';
  }
  return invoice.status;
}

export function calculateDueDate(issueDate: string, paymentTerms: string): string {
  const opt = PAYMENT_TERMS_OPTIONS.find((o) => o.value === paymentTerms);
  const days = opt?.days ?? 30;
  const [year, month, day] = issueDate.split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day + days);
  return toDateInputValue(date);
}

export async function generateInvoiceNumber(): Promise<string> {
  const settings = await db.settings.limit(1).first();
  const prefix = settings?.invoicePrefix ?? 'INV-';
  const next = settings?.invoiceNextNumber ?? 1001;
  return `${prefix}${next}`;
}

export async function incrementInvoiceNumber(): Promise<void> {
  const settings = await db.settings.limit(1).first();
  if (settings?.id) {
    await db.settings.update(settings.id, {
      invoiceNextNumber: (settings.invoiceNextNumber ?? 1001) + 1,
      updatedAt: new Date(),
    });
  }
}
