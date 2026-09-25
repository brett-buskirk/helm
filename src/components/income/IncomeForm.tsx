import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { IncomeSource, Payment } from '../../types';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { FormField } from '../ui/FormField';
import { DateField } from '../ui/DatePicker';
import { toDateInputValue, parseDateInput } from '../../utils/format';
import { INCOME_SOURCES, MANUAL_INCOME_SOURCES, defaultTaxable } from '../../utils/income';

const schema = z.object({
  date: z.string().min(1, 'Required'),
  source: z.string().min(1, 'Required'),
  amount: z.coerce.number().min(0.01, 'Must be > 0'),
  taxable: z.boolean(),
  clientId: z.preprocess(
    (v) => (!v || v === '0' ? undefined : Number(v)),
    z.number().positive().optional(),
  ),
  method: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  income?: Payment;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const DEFAULT_SOURCE: IncomeSource = 'owner-contribution';

function emptyValues(): FormData {
  return {
    date: toDateInputValue(new Date()),
    source: DEFAULT_SOURCE,
    amount: 0,
    taxable: defaultTaxable(DEFAULT_SOURCE),
    clientId: undefined,
    method: '',
    notes: '',
  };
}

/**
 * Record income that never went through an invoice. Invoice payments are
 * created by the invoice flow instead, so this form doesn't offer that source
 * and the Income page keeps those rows read-only.
 */
export function IncomeForm({ income, isOpen, onClose, onSuccess }: Props) {
  const isEditing = !!income;
  const allClients = useLiveQuery(() => db.clients.toCollection().sortBy('company')) ?? [];

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: emptyValues() });

  const watchedSource = watch('source') as IncomeSource;
  const watchedTaxable = watch('taxable');

  useEffect(() => {
    if (!isOpen) return;
    if (income) {
      reset({
        date: toDateInputValue(income.date as unknown as Date),
        source: income.source ?? DEFAULT_SOURCE,
        amount: income.amount,
        taxable: income.taxable ?? defaultTaxable(income.source ?? DEFAULT_SOURCE),
        clientId: income.clientId,
        method: income.method ?? '',
        notes: income.notes ?? '',
      });
    } else {
      reset(emptyValues());
    }
  }, [isOpen, income, reset]);

  /**
   * Changing the source resets the taxable flag to that source's default.
   * Picking "cashback" after "interest" should land on the correct treatment
   * rather than silently keeping the previous one; it stays overridable.
   */
  function handleSourceChange(next: IncomeSource) {
    setValue('source', next);
    setValue('taxable', defaultTaxable(next));
  }

  async function onSubmit(data: FormData) {
    const now = new Date();
    const payload = {
      source: data.source as IncomeSource,
      taxable: data.taxable,
      amount: data.amount,
      date: parseDateInput(data.date) ?? now,
      clientId: data.clientId,
      method: data.method || undefined,
      notes: data.notes || undefined,
      updatedAt: now,
    };

    if (isEditing && income?.id) {
      await db.payments.update(income.id, payload);
      onSuccess('Income updated.');
    } else {
      await db.payments.add({ ...payload, createdAt: now } as Payment);
      onSuccess('Income recorded.');
    }
    onClose();
  }

  const sourceOptions = MANUAL_INCOME_SOURCES.map((s) => ({
    value: s,
    label: INCOME_SOURCES[s].label,
  }));

  const clientOptions = [
    { value: '0', label: 'No client' },
    ...allClients.map((c) => ({ value: String(c.id), label: c.company })),
  ];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Income' : 'Record Income'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="income-form" loading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Record Income'}
          </Button>
        </>
      }
    >
      <form id="income-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date" htmlFor="inc-date" error={errors.date?.message} required>
            <DateField control={control} name="date" id="inc-date" hasError={!!errors.date} />
          </FormField>
          <FormField label="Amount" htmlFor="inc-amount" error={errors.amount?.message} required>
            <Input
              id="inc-amount"
              type="number"
              min={0.01}
              step={0.01}
              {...register('amount')}
              error={errors.amount?.message}
            />
          </FormField>
        </div>

        <FormField label="Source" htmlFor="inc-source" error={errors.source?.message} required>
          <Select
            id="inc-source"
            options={sourceOptions}
            value={watchedSource}
            onChange={(e) => handleSourceChange(e.target.value as IncomeSource)}
          />
        </FormField>

        <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2.5">
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              {...register('taxable')}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-800 accent-indigo-500"
            />
            <span>
              <span className="font-medium text-slate-200">Taxable income</span>
              <span className="mt-0.5 block text-xs text-slate-400">
                {INCOME_SOURCES[watchedSource]?.hint}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {watchedTaxable
                  ? 'Counts toward revenue, profit, and the 25% tax set-aside.'
                  : 'Shows in Money In, but not in revenue, profit, or the tax set-aside.'}
              </span>
            </span>
          </label>
        </div>

        <FormField label="Client" htmlFor="inc-client" hint="Optional">
          <Select id="inc-client" options={clientOptions} {...register('clientId')} />
        </FormField>

        <FormField label="Method" htmlFor="inc-method" hint="Optional">
          <Input id="inc-method" placeholder="e.g. ACH, transfer, check" {...register('method')} />
        </FormField>

        <FormField label="Notes" htmlFor="inc-notes" hint="Optional">
          <Textarea id="inc-notes" rows={2} placeholder="What was this?" {...register('notes')} />
        </FormField>
      </form>
    </Drawer>
  );
}
