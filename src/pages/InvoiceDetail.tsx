import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Pencil, Download, Send, DollarSign, XCircle } from 'lucide-react';
import { usePdfDownload } from '../hooks/usePdfDownload';
import { db } from '../db';
import type { Client, Project, Payment } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Toast } from '../components/ui/Toast';
import { InvoicePDF } from '../components/invoices/InvoicePDF';
import { PaymentModal } from '../components/invoices/PaymentModal';
import { useToast } from '../hooks/useToast';
import { formatDate, formatCurrency } from '../utils/format';
import { getEffectiveStatus } from '../utils/invoice';
import { releaseTimeEntriesForInvoice } from '../utils/time';

const STATUS_BADGE = {
  draft: { variant: 'neutral' as const, label: 'Draft' },
  sent: { variant: 'info' as const, label: 'Sent' },
  overdue: { variant: 'danger' as const, label: 'Overdue' },
  paid: { variant: 'success' as const, label: 'Paid' },
  cancelled: { variant: 'neutral' as const, label: 'Cancelled' },
};

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const { download: downloadPdf, busy: pdfBusy } = usePdfDownload((msg) => showToast('error', msg));

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const invoiceId = Number(id);
  const invoice = useLiveQuery(() => db.invoices.get(invoiceId), [invoiceId]);
  const client = useLiveQuery<Client | undefined>(
    () => invoice?.clientId != null ? db.clients.get(invoice.clientId) : undefined,
    [invoice?.clientId],
  );
  const project = useLiveQuery<Project | undefined>(
    () => invoice?.projectId != null ? db.projects.get(invoice.projectId) : undefined,
    [invoice?.projectId],
  );
  const payments = useLiveQuery(
    () => db.payments.where('invoiceId').equals(invoiceId).sortBy('date'),
    [invoiceId],
  ) ?? [];
  const settings = useLiveQuery(() => db.settings.limit(1).first());

  if (!invoice || !client) {
    return (
      <div className="p-6">
        <Link to="/invoices" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100">
          <ArrowLeft size={14} /> Back to Invoices
        </Link>
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  const effectiveStatus = getEffectiveStatus(invoice);
  const { variant: statusVariant, label: statusLabel } = STATUS_BADGE[effectiveStatus];
  const canEdit = effectiveStatus !== 'paid' && effectiveStatus !== 'cancelled';
  const canSend = effectiveStatus === 'draft';
  const canRecordPayment = effectiveStatus === 'sent' || effectiveStatus === 'overdue';
  const canCancel = effectiveStatus === 'draft' || effectiveStatus === 'sent';

  async function handleMarkSent() {
    if (!invoice || !invoice.id) return;
    await db.invoices.update(invoice.id, { status: 'sent', updatedAt: new Date() });
    showToast('success', 'Invoice marked as sent.');
  }

  async function handleCancel() {
    if (!invoice || !invoice.id) return;
    setCancelling(true);
    try {
      if (!invoice || !invoice.id) return;
      await db.invoices.update(invoice.id, { status: 'cancelled', updatedAt: new Date() });
      // Return any time entries billed to this invoice back to unbilled so they
      // can be re-invoiced.
      const released = await releaseTimeEntriesForInvoice(invoice.id);
      showToast(
        'success',
        released > 0
          ? `Invoice cancelled. ${released} time ${released === 1 ? 'entry' : 'entries'} returned to unbilled.`
          : 'Invoice cancelled.',
      );
    } catch {
      showToast('error', 'Failed to cancel invoice.');
    } finally {
      setCancelling(false);
      setCancelModalOpen(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back nav */}
      <Link
        to="/invoices"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Invoices
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-100">{invoice.invoiceNumber}</h1>
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
            <Link to={`/clients/${client.id}`} className="text-indigo-400 hover:underline">
              {client.company}
            </Link>
            {project && <span>· {project.name}</span>}
            <span>· Due {formatDate(invoice.dueDate as unknown as Date)}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canSend && (
            <Button variant="secondary" size="sm" onClick={handleMarkSent}>
              <Send size={13} />
              Mark Sent
            </Button>
          )}
          {canRecordPayment && (
            <Button size="sm" onClick={() => setPaymentModalOpen(true)}>
              <DollarSign size={13} />
              Record Payment
            </Button>
          )}
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
              <Pencil size={13} />
              Edit
            </Button>
          )}
          {/* PDF download */}
          <Button
            variant="ghost"
            size="sm"
            loading={pdfBusy}
            onClick={() => downloadPdf(<InvoicePDF invoice={invoice} client={client} settings={settings} />, `${invoice.invoiceNumber}.pdf`)}
          >
            <Download size={13} />
            PDF
          </Button>
          {canCancel && (
            <Button variant="ghost" size="sm" onClick={() => setCancelModalOpen(true)}>
              <XCircle size={13} />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Invoice card */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 space-y-6">
        {/* Bill-to + meta */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Bill To</p>
            <p className="font-semibold text-slate-100">{client.company}</p>
            <p className="text-sm text-slate-400">{client.contactName}</p>
            {client.email && <p className="text-sm text-slate-400">{client.email}</p>}
            {client.address && (
              <p className="whitespace-pre-line text-sm text-slate-500">{client.address}</p>
            )}
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice #</span>
              <span className="font-mono text-slate-200">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Issued</span>
              <span className="text-slate-200">{formatDate(invoice.issueDate as unknown as Date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Due</span>
              <span className={effectiveStatus === 'overdue' ? 'font-semibold text-red-400' : 'text-slate-200'}>
                {formatDate(invoice.dueDate as unknown as Date)}
              </span>
            </div>
            {invoice.paymentTerms && (
              <div className="flex justify-between">
                <span className="text-slate-500">Terms</span>
                <span className="text-slate-400">{invoice.paymentTerms}</span>
              </div>
            )}
          </div>
        </div>

        {/* Line items */}
        <div>
          <div className="overflow-hidden rounded-lg border border-slate-700">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Description
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Qty
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Rate
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {invoice.lineItems.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-sm text-slate-200">{item.description}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-400">
                      {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-400">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-200">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Subtotal</span>
              <span className="tabular-nums text-slate-200">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.taxRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Tax ({invoice.taxRate}%)</span>
                <span className="tabular-nums text-slate-200">{formatCurrency(invoice.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-700 pt-2 text-base font-semibold">
              <span className="text-slate-200">Total</span>
              <span className="tabular-nums text-slate-100">{formatCurrency(invoice.total)}</span>
            </div>
            {invoice.amountPaid > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Amount Paid</span>
                <span className="tabular-nums text-emerald-400">({formatCurrency(invoice.amountPaid)})</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-700 pt-2 text-base font-bold">
              <span className="text-indigo-300">Balance Due</span>
              <span className="tabular-nums text-indigo-300">{formatCurrency(invoice.balanceDue)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="border-t border-slate-700 pt-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</p>
            <p className="text-sm text-slate-400">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Payment History
          </h2>
          <div className="rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Method</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900">
                {(payments as Payment[]).map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-sm text-slate-300">{formatDate(p.date as unknown as Date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{p.method ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{p.notes ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums font-medium text-emerald-400">
                      {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <PaymentModal
        invoice={invoice}
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={(msg) => showToast('success', msg)}
      />

      <ConfirmModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Invoice"
        message={`Cancel invoice ${invoice.invoiceNumber}? This marks it as cancelled and cannot be undone.`}
        confirmLabel="Cancel Invoice"
        variant="danger"
        loading={cancelling}
      />

      <Toast toast={toast} />
    </div>
  );
}
