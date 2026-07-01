import { useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { db } from '../db';
import type { DocumentType } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { FormField } from '../components/ui/FormField';
import { Toast } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { TEMPLATE_VARS, DEFAULT_TEMPLATES } from '../utils/template';

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'msa', label: 'MSA — Master Services Agreement' },
  { value: 'nda', label: 'NDA — Non-Disclosure Agreement' },
  { value: 'sow', label: 'SOW — Statement of Work' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'other', label: 'Other' },
];

const schema = z.object({
  title: z.string().min(1, 'Required'),
  type: z.enum(['msa', 'nda', 'sow', 'proposal', 'other']),
  isTemplate: z.boolean(),
  content: z.string().min(1, 'Content is required'),
  clientId: z.preprocess(
    (v) => (!v || v === '0' ? undefined : Number(v)),
    z.number().positive().optional(),
  ),
  projectId: z.preprocess(
    (v) => (!v || v === '0' ? undefined : Number(v)),
    z.number().positive().optional(),
  ),
});

type FormData = z.infer<typeof schema>;

export default function DocumentEditor() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);


  const isEditing = !!id;

  const existingDoc = useLiveQuery<import('../types').Document | undefined>(
    () => (isEditing ? db.documents.get(Number(id)) : undefined),
    [id, isEditing],
  );
  const allClients = useLiveQuery(() => db.clients.toCollection().sortBy('company')) ?? [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      type: 'proposal',
      isTemplate: true,
      content: '',
      clientId: undefined,
      projectId: undefined,
    },
  });

  const watchedType = watch('type');
  const watchedIsTemplate = watch('isTemplate');
  const watchedClientId = watch('clientId');

  const clientProjects = useLiveQuery<import('../types').Project[]>(
    () =>
      watchedClientId
        ? db.projects.where('clientId').equals(Number(watchedClientId)).toArray()
        : Promise.resolve([]),
    [watchedClientId],
  ) ?? [];

  useEffect(() => {
    if (isEditing && existingDoc) {
      reset({
        title: existingDoc.title,
        type: existingDoc.type,
        isTemplate: existingDoc.isTemplate,
        content: existingDoc.content,
        clientId: existingDoc.clientId,
        projectId: existingDoc.projectId,
      });
    }
  }, [isEditing, existingDoc, reset]);

  function insertVariable(key: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = watch('content');
    const updated = current.slice(0, start) + key + current.slice(end);
    setValue('content', updated, { shouldDirty: true });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + key.length, start + key.length);
    });
  }

  function loadStarter() {
    const starter = DEFAULT_TEMPLATES[watchedType as DocumentType];
    if (starter) setValue('content', starter, { shouldDirty: true });
  }

  async function onSubmit(data: FormData) {
    const now = new Date();
    const payload = {
      title: data.title,
      type: data.type,
      isTemplate: data.isTemplate,
      content: data.content,
      clientId: data.isTemplate ? undefined : data.clientId,
      projectId: data.isTemplate ? undefined : data.projectId,
      updatedAt: now,
    };

    if (isEditing && existingDoc?.id) {
      await db.documents.update(existingDoc.id, payload);
      showToast('success', 'Document saved.');
    } else {
      const newId = await db.documents.add({ ...payload, createdAt: now });
      navigate(`/documents/${newId}/edit`, { replace: true });
      showToast('success', 'Document created.');
    }
  }

  const clientOptions = [
    { value: '0', label: 'No client' },
    ...allClients.map((c) => ({ value: String(c.id), label: c.company })),
  ];
  const projectOptions = [
    { value: '0', label: 'No project' },
    ...clientProjects.map((p) => ({ value: String(p.id), label: p.name })),
  ];

  const contentField = register('content');

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/documents"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ArrowLeft size={14} /> Documents
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-sm font-medium text-slate-200">
            {isEditing ? existingDoc?.title ?? '…' : 'New Document'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
            Cancel
          </Button>
          <Button type="submit" form="doc-form" size="sm" loading={isSubmitting}>
            {isEditing ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>

      <form
        id="doc-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-1 overflow-hidden"
      >
        {/* ── LEFT: Editor ── */}
        <div className="flex flex-1 flex-col overflow-hidden p-6">
          <FormField label="Title" htmlFor="doc-title" error={errors.title?.message} required>
            <Input
              id="doc-title"
              placeholder="e.g. MSA — Acme Corp"
              {...register('title')}
              error={errors.title?.message}
              className="text-base font-medium"
            />
          </FormField>

          <div className="mt-4 flex flex-1 flex-col">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Content
              </label>
              <button
                type="button"
                onClick={loadStarter}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Sparkles size={11} />
                Load starter template
              </button>
            </div>
            {errors.content && (
              <p className="mb-1 text-xs text-red-400">{errors.content.message}</p>
            )}
            <textarea
              id="doc-content"
              {...contentField}
              ref={(el) => {
                contentField.ref(el);
                (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
              }}
              className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950 p-4 font-mono text-sm leading-relaxed text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Start writing, or click 'Load starter template' above…"
              spellCheck={false}
            />
          </div>
        </div>

        {/* ── RIGHT: Metadata + Variable reference ── */}
        <div className="w-72 shrink-0 overflow-y-auto border-l border-slate-700 bg-slate-900 p-5 space-y-5">
          <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-4">
            <FormField label="Type" htmlFor="doc-type" error={errors.type?.message} required>
              <Select id="doc-type" options={DOC_TYPE_OPTIONS} {...register('type')} />
            </FormField>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                {...register('isTemplate')}
                className="rounded border-slate-600 bg-slate-800 accent-indigo-500"
              />
              <span>Reusable template</span>
            </label>

            {!watchedIsTemplate && (
              <>
                <FormField label="Client" htmlFor="doc-client">
                  <Select id="doc-client" options={clientOptions} {...register('clientId')} />
                </FormField>
                {watchedClientId && clientProjects.length > 0 && (
                  <FormField label="Project" htmlFor="doc-project">
                    <Select id="doc-project" options={projectOptions} {...register('projectId')} />
                  </FormField>
                )}
              </>
            )}
          </div>

          {/* Variable reference */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Template Variables
            </p>
            <p className="mb-3 text-xs text-slate-600">
              Click a variable to insert it at the cursor.
            </p>
            <div className="space-y-1">
              {TEMPLATE_VARS.map(({ key, description }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => insertVariable(key)}
                  className="w-full rounded px-2 py-1.5 text-left hover:bg-slate-800 transition-colors group"
                >
                  <span className="block font-mono text-xs text-indigo-400 group-hover:text-indigo-300">
                    {key}
                  </span>
                  <span className="block text-xs text-slate-600">{description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </form>

      <Toast toast={toast} />
    </div>
  );
}
