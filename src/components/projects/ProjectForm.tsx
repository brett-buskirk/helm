import { useEffect, type ReactNode } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2 } from 'lucide-react';
import { db } from '../../db';
import type { Project } from '../../types';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { FormField } from '../ui/FormField';
import { DateField } from '../ui/DatePicker';
import { toDateInputValue, parseDateInput } from '../../utils/format';
import { normalizeUrl, linkHost } from '../../utils/links';

const schema = z.object({
  clientId: z.coerce.number().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  type: z.enum(['fixed', 'retainer', 'hourly']),
  status: z.enum(['lead', 'active', 'paused', 'completed', 'cancelled']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  rate: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().min(0, 'Must be 0 or more').optional(),
  ),
  description: z.string().optional(),
  links: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
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
  { value: 'lead', label: 'Lead' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Section heading: a small uppercase label with a hairline rule and optional right-side action. */
function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {children}
      </span>
      <span className="h-px flex-1 bg-slate-700/60" />
      {action}
    </div>
  );
}

export function ProjectForm({ project, lockedClientId, isOpen, onClose, onSuccess }: ProjectFormProps) {
  const isEditing = !!project?.id;

  const clients = useLiveQuery(() => db.clients.toCollection().sortBy('company')) ?? [];
  const clientOptions = clients.map((c) => ({ value: String(c.id), label: c.company }));

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
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
      links: [],
    },
  });

  const { fields: linkFields, append: appendLink, remove: removeLink } = useFieldArray({
    control,
    name: 'links',
  });

  useEffect(() => {
    if (!isOpen) return;
    // Reset the number input to '' rather than undefined — RHF leaves an
    // uncontrolled number field's DOM value in place when reset to undefined,
    // so the prior project's fee would otherwise carry into the next new form.
    // '' clears it, and the schema still parses '' back to undefined on submit.
    const emptyRate = '' as unknown as undefined;
    reset(
      project
        ? {
            clientId: project.clientId,
            name: project.name,
            type: project.type,
            status: project.status,
            startDate: toDateInputValue(project.startDate),
            endDate: toDateInputValue(project.endDate),
            rate: project.rate ?? emptyRate,
            description: project.description ?? '',
            links: project.links ?? [],
          }
        : {
            clientId: lockedClientId ?? 0,
            name: '',
            type: 'fixed',
            status: 'active',
            startDate: '',
            endDate: '',
            rate: emptyRate,
            description: '',
            links: [],
          },
    );
  }, [isOpen, project, lockedClientId, reset]);

  async function onSubmit(data: FormData) {
    const now = new Date();
    // Keep only rows with a URL; default a missing label to the host.
    const links = (data.links ?? [])
      .filter((l) => l.url.trim())
      .map((l) => ({ label: l.label.trim() || linkHost(l.url), url: normalizeUrl(l.url) }));
    const payload = {
      clientId: data.clientId,
      name: data.name,
      type: data.type,
      status: data.status,
      startDate: parseDateInput(data.startDate ?? ''),
      endDate: parseDateInput(data.endDate ?? ''),
      rate: data.rate,
      description: data.description || undefined,
      links: links.length ? links : undefined,
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

  const watchedType = watch('type');

  const rateConfig = {
    fixed: {
      label: 'Project Fee',
      hint: 'Total fixed fee for this engagement',
      placeholder: 'Total project price',
    },
    retainer: {
      label: 'Monthly Retainer',
      hint: 'Recurring fee billed each month',
      placeholder: 'Monthly fee',
    },
    hourly: {
      label: 'Hourly Rate',
      hint: 'Overrides client default hourly rate',
      placeholder: 'Leave blank to use client default',
    },
  } as const;

  const { label: rateLabel, hint: rateHint, placeholder: ratePlaceholder } =
    rateConfig[watchedType ?? 'fixed'];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Project' : 'New Project'}
      size="lg"
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
      <form id="project-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* Basics */}
        <section className="space-y-4">
          <SectionLabel>Basics</SectionLabel>
          <FormField label="Project Name" htmlFor="name" error={errors.name?.message} required>
            <Input id="name" {...register('name')} error={errors.name?.message} />
          </FormField>
          <FormField label="Client" htmlFor="clientId" error={errors.clientId?.message} required>
            <Select
              id="clientId"
              options={clientOptions}
              placeholder="Select a client…"
              disabled={!!lockedClientId}
              {...register('clientId')}
              error={errors.clientId?.message}
            />
          </FormField>
        </section>

        {/* Engagement */}
        <section className="space-y-4">
          <SectionLabel>Engagement</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Type" htmlFor="type" error={errors.type?.message} required>
              <Select id="type" options={TYPE_OPTIONS} {...register('type')} error={errors.type?.message} />
            </FormField>
            <FormField label="Status" htmlFor="status" error={errors.status?.message} required>
              <Select id="status" options={STATUS_OPTIONS} {...register('status')} error={errors.status?.message} />
            </FormField>
            <FormField label="Start Date" htmlFor="startDate">
              <DateField control={control} name="startDate" id="startDate" />
            </FormField>
            <FormField label="End Date" htmlFor="endDate">
              <DateField control={control} name="endDate" id="endDate" />
            </FormField>
          </div>
          <FormField label={rateLabel} htmlFor="rate" hint={rateHint} error={errors.rate?.message}>
            <Input
              id="rate"
              type="number"
              min={0}
              step={watchedType === 'hourly' ? 5 : 100}
              placeholder={ratePlaceholder}
              {...register('rate')}
              error={errors.rate?.message}
            />
          </FormField>
        </section>

        {/* Details */}
        <section className="space-y-4">
          <SectionLabel>Details</SectionLabel>
          <FormField label="Description" htmlFor="description">
            <Textarea id="description" rows={3} autoGrow placeholder="Scope, goals, context…" {...register('description')} />
          </FormField>
        </section>

        {/* Links — repo, PRs, dashboards */}
        <section className="space-y-3">
          <SectionLabel
            action={
              <button
                type="button"
                onClick={() => appendLink({ label: '', url: '' })}
                className="flex shrink-0 items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Plus size={12} />
                Add link
              </button>
            }
          >
            Links
          </SectionLabel>
          {linkFields.length === 0 ? (
            <p className="text-xs text-slate-600">
              Attach the repo, key PRs, or a dashboard for this engagement.
            </p>
          ) : (
            <div className="space-y-2">
              {linkFields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-[140px_1fr_28px] gap-2">
                  <Input placeholder="Label (e.g. Repo)" {...register(`links.${idx}.label`)} />
                  <Input placeholder="github.com/org/repo" {...register(`links.${idx}.url`)} />
                  <button
                    type="button"
                    onClick={() => removeLink(idx)}
                    className="flex h-[38px] items-center justify-center rounded text-slate-600 hover:text-red-400 transition-colors"
                    aria-label="Remove link"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </form>
    </Drawer>
  );
}
