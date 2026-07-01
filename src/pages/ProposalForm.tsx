import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { db } from '../db';
import type { ProposalStatus } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { FormField } from '../components/ui/FormField';
import { Toast } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { toDateInputValue, parseDateInput } from '../utils/format';

const schema = z.object({
  clientId: z.coerce.number().min(1, 'Select a client'),
  projectId: z.preprocess(
    (v) => (!v || v === '0' ? undefined : Number(v)),
    z.number().positive().optional(),
  ),
  title: z.string().min(1, 'Required'),
  scope: z.string().min(1, 'Required'),
  deliverables: z.string().min(1, 'Required'),
  pricing: z.coerce.number().min(0, 'Must be 0 or more'),
  pricingNote: z.string().optional(),
  validUntil: z.string().optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'declined']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const STATUS_OPTIONS: { value: ProposalStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
];

export default function ProposalForm() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const isEditing = !!id;
  const preselectedClientId = searchParams.get('clientId');

  const allClients = useLiveQuery(() => db.clients.toCollection().sortBy('company')) ?? [];
  const existingProposal = useLiveQuery(
    () => (isEditing ? db.proposals.get(Number(id)) : undefined),
    [id, isEditing],
  );

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: preselectedClientId ? Number(preselectedClientId) : 0,
      projectId: undefined,
      title: '',
      scope: '',
      deliverables: '',
      pricing: 0,
      pricingNote: '',
      validUntil: '',
      status: 'draft',
      notes: '',
    },
  });

  const watchedClientId = watch('clientId');

  const clientProjects = useLiveQuery<import('../types').Project[]>(
    () =>
      watchedClientId
        ? db.projects.where('clientId').equals(Number(watchedClientId)).toArray()
        : Promise.resolve([]),
    [watchedClientId],
  ) ?? [];

  useEffect(() => {
    if (isEditing && existingProposal) {
      reset({
        clientId: existingProposal.clientId,
        projectId: existingProposal.projectId,
        title: existingProposal.title,
        scope: existingProposal.scope,
        deliverables: existingProposal.deliverables,
        pricing: existingProposal.pricing,
        pricingNote: existingProposal.pricingNote ?? '',
        validUntil: toDateInputValue(existingProposal.validUntil as unknown as Date),
        status: existingProposal.status,
        notes: existingProposal.notes ?? '',
      });
    }
  }, [isEditing, existingProposal, reset]);

  async function onSubmit(data: FormData) {
    const now = new Date();
    const payload = {
      clientId: data.clientId,
      projectId: data.projectId,
      title: data.title,
      scope: data.scope,
      deliverables: data.deliverables,
      pricing: data.pricing,
      pricingNote: data.pricingNote || undefined,
      validUntil: parseDateInput(data.validUntil ?? ''),
      status: data.status,
      notes: data.notes || undefined,
      updatedAt: now,
    };

    try {
      if (isEditing && existingProposal?.id) {
        await db.proposals.update(existingProposal.id, payload);
        showToast('success', 'Proposal saved.');
        navigate(`/proposals/${existingProposal.id}`);
      } else {
        const newId = await db.proposals.add({ ...payload, createdAt: now });
        navigate(`/proposals/${newId}`);
      }
    } catch {
      showToast('error', 'Failed to save proposal.');
    }
  }

  const clientOptions = [
    { value: '0', label: 'Select a client…' },
    ...allClients.map((c) => ({ value: String(c.id), label: c.company })),
  ];
  const projectOptions = [
    { value: '0', label: 'No project' },
    ...clientProjects.map((p) => ({ value: String(p.id), label: p.name })),
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            to={isEditing ? `/proposals/${id}` : '/proposals'}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ArrowLeft size={14} />
            {isEditing ? 'Back to Proposal' : 'Proposals'}
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-sm font-medium text-slate-200">
            {isEditing ? existingProposal?.title ?? '…' : 'New Proposal'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(isEditing ? `/proposals/${id}` : '/proposals')}
          >
            Cancel
          </Button>
          <Button type="submit" form="proposal-form" size="sm" loading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Proposal'}
          </Button>
        </div>
      </div>

      <form
        id="proposal-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-1 overflow-hidden"
      >
        {/* ── LEFT: Content ── */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          <FormField label="Proposal Title" htmlFor="title" error={errors.title?.message} required>
            <Input
              id="title"
              placeholder="e.g. DevOps Platform Build — Acme Corp"
              {...register('title')}
              error={errors.title?.message}
              className="text-base font-medium"
            />
          </FormField>

          <FormField label="Scope of Work" htmlFor="scope" error={errors.scope?.message} required>
            <Textarea
              id="scope"
              rows={5}
              placeholder="Describe the work, background, and objectives…"
              {...register('scope')}
            />
          </FormField>

          <FormField
            label="Deliverables"
            htmlFor="deliverables"
            error={errors.deliverables?.message}
            required
          >
            <Textarea
              id="deliverables"
              rows={5}
              placeholder="List the concrete outputs the client will receive…"
              {...register('deliverables')}
            />
          </FormField>

          <FormField label="Notes" htmlFor="notes" hint="Additional context, assumptions, or next steps">
            <Textarea
              id="notes"
              rows={3}
              placeholder="Timeline notes, out-of-scope items, acceptance criteria…"
              {...register('notes')}
            />
          </FormField>
        </div>

        {/* ── RIGHT: Metadata ── */}
        <div className="w-72 shrink-0 overflow-y-auto border-l border-slate-700 bg-slate-900 p-5 space-y-4">
          <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-4">
            <FormField label="Client" htmlFor="clientId" error={errors.clientId?.message} required>
              <Select
                id="clientId"
                options={clientOptions}
                {...register('clientId')}
                error={errors.clientId?.message}
              />
            </FormField>

            {watchedClientId && Number(watchedClientId) > 0 && (
              <FormField label="Project" htmlFor="projectId" hint="Optional">
                <Select id="projectId" options={projectOptions} {...register('projectId')} />
              </FormField>
            )}

            <FormField label="Status" htmlFor="status" error={errors.status?.message} required>
              <Select id="status" options={STATUS_OPTIONS} {...register('status')} />
            </FormField>

            <FormField label="Valid Until" htmlFor="validUntil">
              <Input id="validUntil" type="date" {...register('validUntil')} />
            </FormField>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-4">
            <FormField
              label="Total Fee"
              htmlFor="pricing"
              error={errors.pricing?.message}
              required
            >
              <Input
                id="pricing"
                type="number"
                min={0}
                step={100}
                placeholder="0"
                {...register('pricing')}
                error={errors.pricing?.message}
              />
            </FormField>

            <FormField
              label="Payment Schedule"
              htmlFor="pricingNote"
              hint="e.g. 50% upfront, 50% on completion"
            >
              <Input
                id="pricingNote"
                placeholder="Describe payment terms…"
                {...register('pricingNote')}
              />
            </FormField>
          </div>
        </div>
      </form>

      <Toast toast={toast} />
    </div>
  );
}
