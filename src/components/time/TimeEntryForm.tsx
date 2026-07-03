import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Project, TimeEntry } from '../../types';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { FormField } from '../ui/FormField';
import { DateField } from '../ui/DatePicker';
import { toDateInputValue, parseDateInput } from '../../utils/format';

const schema = z.object({
  clientId: z.coerce.number().min(1, 'Select a client'),
  projectId: z.coerce.number().min(1, 'Select a project'),
  date: z.string().min(1, 'Required'),
  hours: z.coerce.number().min(0.01, 'Must be > 0').max(24, 'Must be ≤ 24'),
  description: z.string().min(1, 'Required'),
  billable: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  entry?: TimeEntry;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  preselectedClientId?: number;
  preselectedProjectId?: number;
}

export function TimeEntryForm({
  entry,
  isOpen,
  onClose,
  onSuccess,
  preselectedClientId,
  preselectedProjectId,
}: Props) {
  const isEditing = !!entry;

  const allClients = useLiveQuery(() => db.clients.toCollection().sortBy('company')) ?? [];

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
      clientId: preselectedClientId ?? 0,
      projectId: preselectedProjectId ?? 0,
      date: toDateInputValue(new Date()),
      hours: 1,
      description: '',
      billable: true,
    },
  });

  const watchedClientId = watch('clientId');

  const clientProjects = useLiveQuery<Project[]>(
    () =>
      watchedClientId
        ? db.projects.where('clientId').equals(Number(watchedClientId)).toArray()
        : Promise.resolve([]),
    [watchedClientId],
  ) ?? [];

  useEffect(() => {
    if (!isOpen) return;
    if (entry) {
      reset({
        clientId: entry.clientId,
        projectId: entry.projectId,
        date: toDateInputValue(entry.date as unknown as Date),
        hours: entry.hours,
        description: entry.description,
        billable: entry.billable,
      });
    } else {
      reset({
        clientId: preselectedClientId ?? 0,
        projectId: preselectedProjectId ?? 0,
        date: toDateInputValue(new Date()),
        hours: 1,
        description: '',
        billable: true,
      });
    }
  }, [isOpen, entry, preselectedClientId, preselectedProjectId, reset]);

  async function onSubmit(data: FormData) {
    const now = new Date();
    const payload = {
      clientId: data.clientId,
      projectId: data.projectId,
      date: parseDateInput(data.date) ?? now,
      hours: data.hours,
      description: data.description,
      billable: data.billable,
      updatedAt: now,
    };

    if (isEditing && entry.id) {
      await db.timeEntries.update(entry.id, payload);
      onSuccess('Time entry updated.');
    } else {
      await db.timeEntries.add({ ...payload, createdAt: now });
      onSuccess('Time logged.');
    }
    onClose();
  }

  const clientOptions = [
    { value: '0', label: 'Select a client…' },
    ...allClients.map((c) => ({ value: String(c.id), label: c.company })),
  ];
  const projectOptions = [
    { value: '0', label: clientProjects.length ? 'Select a project…' : 'No projects for this client' },
    ...clientProjects.map((p) => ({ value: String(p.id), label: p.name })),
  ];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Time Entry' : 'Log Time'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="time-form" loading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Log Time'}
          </Button>
        </>
      }
    >
      <form id="time-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label="Client" htmlFor="time-client" error={errors.clientId?.message} required>
          <Select id="time-client" options={clientOptions} {...register('clientId')} error={errors.clientId?.message} />
        </FormField>

        <FormField label="Project" htmlFor="time-project" error={errors.projectId?.message} required>
          <Select
            id="time-project"
            options={projectOptions}
            disabled={!watchedClientId || clientProjects.length === 0}
            {...register('projectId')}
            error={errors.projectId?.message}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date" htmlFor="time-date" error={errors.date?.message} required>
            <DateField control={control} name="date" id="time-date" hasError={!!errors.date} />
          </FormField>
          <FormField label="Hours" htmlFor="time-hours" error={errors.hours?.message} required>
            <Input
              id="time-hours"
              type="number"
              min={0.01}
              max={24}
              step={0.25}
              placeholder="1.0"
              {...register('hours')}
              error={errors.hours?.message}
            />
          </FormField>
        </div>

        <FormField label="Description" htmlFor="time-desc" error={errors.description?.message} required>
          <Textarea
            id="time-desc"
            rows={3}
            placeholder="What did you work on?"
            {...register('description')}
          />
        </FormField>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            {...register('billable')}
            className="rounded border-slate-600 bg-slate-800 accent-indigo-500"
          />
          Billable to client
        </label>
      </form>
    </Drawer>
  );
}
