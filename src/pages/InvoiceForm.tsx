import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { db } from '../db';
import type { Invoice, Project } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { FormField } from '../components/ui/FormField';
import { Toast } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { formatCurrency, toDateInputValue, parseDateInput } from '../utils/format';
import {
  PAYMENT_TERMS_OPTIONS,
  calculateDueDate,
  generateInvoiceNumber,
  incrementInvoiceNumber,
} from '../utils/invoice';

const lineItemSchema = z.object({
  description: z.string().min(1, 'Required'),
  quantity: z.coerce.number().min(0.001, 'Must be > 0'),
  unitPrice: z.coerce.number().min(0, 'Must be ≥ 0'),
});

const schema = z.object({
  clientId: z.coerce.number().min(1, 'Select a client'),
  projectId: z.preprocess(
    (v) => (v === '' || v === '0' || v == null ? undefined : Number(v)),
    z.number().positive().optional(),
  ),
  invoiceNumber: z.string().min(1, 'Required'),
  issueDate: z.string().min(1, 'Required'),
  dueDate: z.string().min(1, 'Required'),
  paymentTerms: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(100),
  lineItems: z.array(lineItemSchema).min(1, 'Add at least one line item'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TERMS_OPTIONS = [
  { value: '', label: 'Custom' },
  ...PAYMENT_TERMS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
];

export default function InvoiceForm() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const isEditing = !!id;
  const preselectedClientId = searchParams.get('clientId');

  const allClients = useLiveQuery(() => db.clients.orderBy('company').toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.limit(1).first());
  const existingInvoice = useLiveQuery<Invoice | undefined>(
    () => (isEditing ? db.invoices.get(Number(id)) : undefined),
    [id, isEditing],
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: preselectedClientId ? Number(preselectedClientId) : 0,
      projectId: undefined,
      invoiceNumber: '',
      issueDate: toDateInputValue(new Date()),
      dueDate: '',
      paymentTerms: 'Net 30',
      taxRate: 0,
      lineItems: [{ description: '', quantity: 1, unitPrice: 0 }],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const watchedItems = useWatch({ control, name: 'lineItems' });
  const watchedClientId = watch('clientId');
  const watchedProjectId = watch('projectId');
  const watchedTaxRate = watch('taxRate');
  const watchedIssueDate = watch('issueDate');
  const watchedPaymentTerms = watch('paymentTerms');

  // Projects for selected client
  const clientProjects = useLiveQuery<Project[]>(
    () =>
      watchedClientId
        ? db.projects.where('clientId').equals(Number(watchedClientId)).toArray()
        : Promise.resolve([] as Project[]),
    [watchedClientId],
  ) ?? [];

  const PROJECT_TYPE_SUFFIX: Record<string, string> = {
    fixed: 'Fixed', retainer: 'Retainer', hourly: 'Hourly',
  };
  const projectOptions = [
    { value: '', label: 'No project' },
    ...clientProjects.map((p) => ({
      value: String(p.id),
      label: `${p.name} (${PROJECT_TYPE_SUFFIX[p.type] ?? p.type})`,
    })),
  ];

  const clientOptions = [
    { value: '0', label: 'Select a client…' },
    ...allClients.map((c) => ({ value: String(c.id), label: c.company })),
  ];

  // Totals (computed, not stored in form state)
  const { subtotal, taxAmount, total } = useMemo(() => {
    const sub = (watchedItems ?? []).reduce((acc, item) => {
      const qty = Number(item?.quantity) || 0;
      const rate = Number(item?.unitPrice) || 0;
      return acc + qty * rate;
    }, 0);
    const rate = Number(watchedTaxRate) || 0;
    const tax = (sub * rate) / 100;
    return { subtotal: sub, taxAmount: tax, total: sub + tax };
  }, [watchedItems, watchedTaxRate]);

  // Pre-fill line items when a project is selected on a new invoice
  useEffect(() => {
    if (isEditing || !watchedProjectId) return;
    const project = clientProjects.find((p) => p.id === Number(watchedProjectId));
    if (!project) return;
    const client = allClients.find((c) => c.id === project.clientId);
    const rate = project.rate ?? (project.type === 'hourly' ? client?.defaultRate : undefined) ?? 0;
    if (project.type === 'fixed') {
      setValue('lineItems', [{ description: `Project Fee — ${project.name}`, quantity: 1, unitPrice: rate }]);
    } else if (project.type === 'retainer') {
      setValue('lineItems', [{ description: `Monthly Retainer — ${project.name}`, quantity: 1, unitPrice: rate }]);
    } else {
      setValue('lineItems', [{ description: '', quantity: 1, unitPrice: rate }]);
    }
  // Fires on project selection only — clientProjects excluded intentionally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, watchedProjectId]);

  // Auto-fill invoice number and tax rate on create
  useEffect(() => {
    if (isEditing || settings === undefined) return;
    generateInvoiceNumber().then((num) => setValue('invoiceNumber', num));
    if (settings) setValue('taxRate', settings.taxRate);
  }, [isEditing, settings, setValue]);

  // Auto-calculate due date when issue date or payment terms change (create only)
  useEffect(() => {
    if (isEditing || !watchedIssueDate || !watchedPaymentTerms) return;
    const due = calculateDueDate(watchedIssueDate, watchedPaymentTerms);
    if (due) setValue('dueDate', due);
  }, [isEditing, watchedIssueDate, watchedPaymentTerms, setValue]);

  // Populate form when editing
  useEffect(() => {
    if (!isEditing || !existingInvoice) return;
    if (existingInvoice.status === 'paid' || existingInvoice.status === 'cancelled') {
      showToast('error', 'Paid and cancelled invoices cannot be edited.');
      navigate(`/invoices/${id}`);
      return;
    }
    reset({
      clientId: existingInvoice.clientId,
      projectId: existingInvoice.projectId,
      invoiceNumber: existingInvoice.invoiceNumber,
      issueDate: toDateInputValue(existingInvoice.issueDate as unknown as Date),
      dueDate: toDateInputValue(existingInvoice.dueDate as unknown as Date),
      paymentTerms: existingInvoice.paymentTerms ?? '',
      taxRate: existingInvoice.taxRate,
      lineItems: existingInvoice.lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
      })),
      notes: existingInvoice.notes ?? '',
    });
  }, [isEditing, existingInvoice, reset, navigate, id, showToast]);

  async function onSubmit(data: FormData) {
    const now = new Date();
    const computedItems = data.lineItems.map((li) => ({
      description: li.description,
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
      amount: Number(li.quantity) * Number(li.unitPrice),
    }));
    const sub = computedItems.reduce((acc, li) => acc + li.amount, 0);
    const taxAmt = (sub * Number(data.taxRate)) / 100;
    const tot = sub + taxAmt;

    const payload = {
      clientId: data.clientId,
      projectId: data.projectId,
      invoiceNumber: data.invoiceNumber,
      issueDate: parseDateInput(data.issueDate) ?? now,
      dueDate: parseDateInput(data.dueDate) ?? now,
      paymentTerms: data.paymentTerms || undefined,
      taxRate: Number(data.taxRate),
      lineItems: computedItems,
      subtotal: sub,
      taxAmount: taxAmt,
      total: tot,
      notes: data.notes || undefined,
      updatedAt: now,
    };

    if (isEditing && existingInvoice?.id) {
      await db.invoices.update(existingInvoice.id, payload);
      navigate(`/invoices/${existingInvoice.id}`);
    } else {
      const newId = await db.invoices.add({
        ...payload,
        status: 'draft',
        amountPaid: 0,
        balanceDue: tot,
        createdAt: now,
      });
      await incrementInvoiceNumber();
      navigate(`/invoices/${newId}`);
    }
  }

  return (
    <div className="min-h-full pb-12">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            to={isEditing ? `/invoices/${id}` : '/invoices'}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ArrowLeft size={14} />
            {isEditing ? 'Back to Invoice' : 'Invoices'}
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-sm font-medium text-slate-200">
            {isEditing ? `Edit ${existingInvoice?.invoiceNumber ?? '…'}` : 'New Invoice'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(isEditing ? `/invoices/${id}` : '/invoices')}>
            Cancel
          </Button>
          <Button type="submit" form="invoice-form" size="sm" loading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Invoice'}
          </Button>
        </div>
      </div>

      <form id="invoice-form" onSubmit={handleSubmit(onSubmit)} noValidate className="mx-auto max-w-5xl px-6 py-6">
        {isEditing && existingInvoice?.status === 'sent' && (
          <div className="mb-4 rounded-lg border border-amber-700 bg-amber-950 px-4 py-3 text-sm text-amber-200">
            This invoice has been sent. Editing it won't resend it to the client.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          {/* ── LEFT: Line items ── */}
          <div className="order-2 lg:order-1">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Line Items
              </h2>
              {errors.lineItems?.root && (
                <p className="text-xs text-red-400">{errors.lineItems.root.message}</p>
              )}
            </div>

            {/* Table header */}
            <div className="mb-1 grid grid-cols-[1fr_72px_100px_96px_28px] gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            <div className="space-y-2">
              {fields.map((field, idx) => {
                const qty = Number(watchedItems?.[idx]?.quantity) || 0;
                const rate = Number(watchedItems?.[idx]?.unitPrice) || 0;
                const amount = qty * rate;
                return (
                  <div key={field.id} className="grid grid-cols-[1fr_72px_100px_96px_28px] gap-2 items-start">
                    <div>
                      <Input
                        {...register(`lineItems.${idx}.description`)}
                        placeholder="Description"
                        error={errors.lineItems?.[idx]?.description?.message}
                      />
                    </div>
                    <div>
                      <Input
                        {...register(`lineItems.${idx}.quantity`)}
                        type="number"
                        min={0}
                        step="any"
                        placeholder="1"
                        className="text-right"
                        error={errors.lineItems?.[idx]?.quantity?.message}
                      />
                    </div>
                    <div>
                      <Input
                        {...register(`lineItems.${idx}.unitPrice`)}
                        type="number"
                        min={0}
                        step="any"
                        placeholder="0.00"
                        className="text-right"
                        error={errors.lineItems?.[idx]?.unitPrice?.message}
                      />
                    </div>
                    <div className="flex h-[38px] items-center justify-end rounded-md border border-slate-700 bg-slate-900 px-3 text-sm tabular-nums text-slate-300">
                      {formatCurrency(amount)}
                    </div>
                    <div className="flex h-[38px] items-center justify-center">
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        disabled={fields.length === 1}
                        className="rounded p-1 text-slate-600 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Remove line item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
              className="mt-3 flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Plus size={14} />
              Add line item
            </button>

            {/* Totals summary */}
            <div className="mt-6 flex justify-end">
              <div className="w-64 space-y-1.5 rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                {watchedTaxRate > 0 && (
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>Tax ({watchedTaxRate}%)</span>
                    <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-700 pt-2 text-base font-semibold text-slate-100">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mt-6">
              <FormField label="Notes" htmlFor="notes" hint="Appears at the bottom of the invoice">
                <Textarea id="notes" rows={3} placeholder="Additional notes for the client…" {...register('notes')} />
              </FormField>
            </div>
          </div>

          {/* ── RIGHT: Metadata ── */}
          <div className="order-1 space-y-4 lg:order-2">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
              <FormField label="Client" htmlFor="clientId" error={errors.clientId?.message} required>
                <Select
                  id="clientId"
                  options={clientOptions}
                  {...register('clientId')}
                  error={errors.clientId?.message}
                />
              </FormField>

              <FormField label="Project" htmlFor="projectId" hint="Optional">
                <Select id="projectId" options={projectOptions} {...register('projectId')} />
              </FormField>

              <FormField label="Invoice #" htmlFor="invoiceNumber" error={errors.invoiceNumber?.message} required>
                <Input id="invoiceNumber" {...register('invoiceNumber')} error={errors.invoiceNumber?.message} />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Issue Date" htmlFor="issueDate" error={errors.issueDate?.message} required>
                  <Input id="issueDate" type="date" {...register('issueDate')} error={errors.issueDate?.message} />
                </FormField>
                <FormField label="Due Date" htmlFor="dueDate" error={errors.dueDate?.message} required>
                  <Input id="dueDate" type="date" {...register('dueDate')} error={errors.dueDate?.message} />
                </FormField>
              </div>

              <FormField label="Payment Terms" htmlFor="paymentTerms" hint="Auto-calculates due date">
                <Select id="paymentTerms" options={TERMS_OPTIONS} {...register('paymentTerms')} />
              </FormField>

              <FormField label="Tax Rate (%)" htmlFor="taxRate" error={errors.taxRate?.message}>
                <Input
                  id="taxRate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  {...register('taxRate')}
                  error={errors.taxRate?.message}
                />
              </FormField>
            </div>
          </div>
        </div>
      </form>

      <Toast toast={toast} />
    </div>
  );
}
