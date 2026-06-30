import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Project } from '../../types';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { FormField } from '../ui/FormField';
import { toDateInputValue, parseDateInput } from '../../utils/format';

const schema = z.object({
  clientId: z.coerce.number().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  type: z.enum(['fixed', 'retainer', 'hourly']),
  status: z.enum(['active', 'paused', 'completed', 'cancelled']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  rate: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().min(0, 'Must be 0 or more').optional(),
  ),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ProjectFormProps {
  project?: Project;
  lockedClientId?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const TYPE_OPTIONS = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'hourly', label: 'Hourly' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function ProjectForm({ project, lockedClientId, isOpen, onClose, onSuccess }: ProjectFormProps) {
  const isEditing = !!project?.id;

  const clients = useLiveQuery(() => db.clients.orderBy('company').toArray()) ?? [];
  const clientOptions = clients.map((c) => ({ value: String(c.id), label: c.company }));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: lockedClientId ?? 0,
      name: '',
      type: 'fixed',
      status: 'active',
      startDate: '',
      endDate: '',
      rate: undefined,
      description: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset(
        project
          ? {
              clientId: project.clientId,
              name: project.name,
              type: project.type,
              status: project.status,
              startDate: toDateInputValue(project.startDate),
              endDate: toDateInputValue(project.endDate),
              rate: project.rate,
              description: project.description ?? '',
            }
          : {
              clientId: lockedClientId ?? 0,
              name: '',
              type: 'fixed',
              status: 'active',
              startDate: '',
              endDate: '',
              rate: undefined,
              description: '',
            },
      );
    }
  }, [isOpen, project, lockedClientId, reset]);

  async function onSubmit(data: FormData) {
    const now = new Date();
    const payload = {
      clientId: data.clientId,
      name: data.name,
      type: data.type,
      status: data.status,
      startDate: parseDateInput(data.startDate ?? ''),
      endDate: parseDateInput(data.endDate ?? ''),
      rate: data.rate,
      description: data.description || undefined,
      updatedAt: now,
    };

    if (isEditing && project.id) {
      await db.projects.update(project.id, payload);
      onSuccess('Project updated.');
    } else {
      await db.projects.add({ ...payload, createdAt: now });
      onSuccess('Project created.');
    }
    onClose();
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Project' : 'New Project'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" loading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Project'}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Project Name"
              htmlFor="name"
              error={errors.name?.message}
              required
              className="col-span-2"
            >
              <Input id="name" {...register('name')} error={errors.name?.message} />
            </FormField>

            <FormField
              label="Client"
              htmlFor="clientId"
              error={errors.clientId?.message}
              required
              className="col-span-2"
            >
              <Select
                id="clientId"
                options={clientOptions}
                placeholder="Select a client…"
                disabled={!!lockedClientId}
                {...register('clientId')}
                error={errors.clientId?.message}
              />
            </FormField>

            <FormField
              label="Type"
              htmlFor="type"
              error={errors.type?.message}
              required
            >
              <Select id="type" options={TYPE_OPTIONS} {...register('type')} error={errors.type?.message} />
            </FormField>

            <FormField
              label="Status"
              htmlFor="status"
              error={errors.status?.message}
              required
            >
              <Select id="status" options={STATUS_OPTIONS} {...register('status')} error={errors.status?.message} />
            </FormField>

            <FormField label="Start Date" htmlFor="startDate">
              <Input id="startDate" type="date" {...register('startDate')} />
            </FormField>

            <FormField label="End Date" htmlFor="endDate">
              <Input id="endDate" type="date" {...register('endDate')} />
            </FormField>

            <FormField
              label="Rate ($/hr)"
              htmlFor="rate"
              hint="Overrides client default rate"
              error={errors.rate?.message}
              className="col-span-2"
            >
              <Input
                id="rate"
                type="number"
                min={0}
                step={5}
                placeholder="Leave blank to use client default"
                {...register('rate')}
                error={errors.rate?.message}
              />
            </FormField>

            <FormField label="Description" htmlFor="description" className="col-span-2">
              <Textarea id="description" rows={3} placeholder="Scope, goals, context…" {...register('description')} />
            </FormField>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
