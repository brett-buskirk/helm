import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_EXPENSE_CATEGORIES } from '../../db';
import type { Expense } from '../../types';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { FormField } from '../ui/FormField';
import { DateField } from '../ui/DatePicker';
import { toDateInputValue, parseDateInput } from '../../utils/format';

const schema = z.object({
  date: z.string().min(1, 'Required'),
  vendor: z.string().min(1, 'Required'),
  category: z.string().min(1, 'Required'),
  amount: z.coerce.number().min(0.01, 'Must be > 0'),
  deductible: z.boolean(),
  billable: z.boolean(),
  clientId: z.preprocess(
    (v) => (!v || v === '0' ? undefined : Number(v)),
    z.number().positive().optional(),
  ),
  projectId: z.preprocess(
    (v) => (!v || v === '0' ? undefined : Number(v)),
    z.number().positive().optional(),
  ),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  expense?: Expense;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  preselectedClientId?: number;
}

export function ExpenseForm({ expense, isOpen, onClose, onSuccess, preselectedClientId }: Props) {
  const isEditing = !!expense;

  const settings = useLiveQuery(() => db.settings.limit(1).first());
  const allClients = useLiveQuery(() => db.clients.toCollection().sortBy('company')) ?? [];

  const categories = settings?.expenseCategories?.length
    ? settings.expenseCategories
    : DEFAULT_EXPENSE_CATEGORIES;

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: toDateInputValue(new Date()),
      vendor: '',
      category: categories[0] ?? '',
      amount: 0,
      deductible: true,
      billable: false,
      clientId: preselectedClientId,
      projectId: undefined,
      notes: '',
    },
  });

  const watchedBillable = watch('billable');
  const watchedClientId = watch('clientId');

  const clientProjects = useLiveQuery<import('../../types').Project[]>(
    () =>
      watchedClientId
        ? db.projects.where('clientId').equals(Number(watchedClientId)).toArray()
        : Promise.resolve([]),
    [watchedClientId],
  ) ?? [];

  useEffect(() => {
    if (!isOpen) return;
    if (expense) {
      reset({
        date: toDateInputValue(expense.date as unknown as Date),
        vendor: expense.vendor,
        category: expense.category,
        amount: expense.amount,
        deductible: expense.deductible,
        billable: expense.billable,
        clientId: expense.clientId,
        projectId: expense.projectId,
        notes: expense.notes ?? '',
      });
    } else {
      reset({
        date: toDateInputValue(new Date()),
        vendor: '',
        category: categories[0] ?? '',
        amount: 0,
        deductible: true,
        billable: false,
        clientId: preselectedClientId,
        projectId: undefined,
        notes: '',
      });
    }
  }, [isOpen, expense, preselectedClientId]);

  async function onSubmit(data: FormData) {
    const now = new Date();
    const payload = {
      date: parseDateInput(data.date) ?? now,
      vendor: data.vendor,
      category: data.category,
      amount: data.amount,
      deductible: data.deductible,
      billable: data.billable,
      clientId: data.clientId,
      projectId: data.projectId,
      notes: data.notes || undefined,
      updatedAt: now,
    };

    if (isEditing && expense.id) {
      await db.expenses.update(expense.id, payload);
      onSuccess('Expense updated.');
    } else {
      await db.expenses.add({ ...payload, createdAt: now });
      onSuccess('Expense added.');
    }
    onClose();
  }

  const clientOptions = [
    { value: '0', label: 'No client' },
    ...allClients.map((c) => ({ value: String(c.id), label: c.company })),
  ];

  const projectOptions = [
    { value: '0', label: 'No project' },
    ...clientProjects.map((p) => ({ value: String(p.id), label: p.name })),
  ];

  const categoryOptions = categories.map((c) => ({ value: c, label: c }));

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Expense' : 'Add Expense'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" loading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Add Expense'}
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date" htmlFor="exp-date" error={errors.date?.message} required>
            <DateField control={control} name="date" id="exp-date" hasError={!!errors.date} />
          </FormField>
          <FormField label="Amount" htmlFor="exp-amount" error={errors.amount?.message} required>
            <Input
              id="exp-amount"
              type="number"
              min={0.01}
              step={0.01}
              placeholder="0.00"
              {...register('amount')}
              error={errors.amount?.message}
            />
          </FormField>
        </div>

        <FormField label="Vendor" htmlFor="exp-vendor" error={errors.vendor?.message} required>
          <Input
            id="exp-vendor"
            placeholder="e.g. AWS, GitHub, Figma"
            {...register('vendor')}
            error={errors.vendor?.message}
          />
        </FormField>

        <FormField label="Category" htmlFor="exp-category" error={errors.category?.message} required>
          <Select id="exp-category" options={categoryOptions} {...register('category')} />
        </FormField>

        <div className="flex items-center gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" {...register('deductible')} className="rounded border-slate-600 bg-slate-800 accent-indigo-500" />
            Tax deductible
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" {...register('billable')} className="rounded border-slate-600 bg-slate-800 accent-indigo-500" />
            Billable to client
          </label>
        </div>

        {watchedBillable && (
          <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
            <FormField label="Client" htmlFor="exp-client">
              <Select id="exp-client" options={clientOptions} {...register('clientId')} />
            </FormField>
            {watchedClientId && clientProjects.length > 0 && (
              <FormField label="Project" htmlFor="exp-project">
                <Select id="exp-project" options={projectOptions} {...register('projectId')} />
              </FormField>
            )}
          </div>
        )}

        <FormField label="Notes" htmlFor="exp-notes" hint="Optional">
          <Textarea id="exp-notes" rows={3} placeholder="Any additional context…" {...register('notes')} />
        </FormField>
      </form>
    </Drawer>
  );
}
