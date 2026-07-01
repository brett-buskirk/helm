import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Wrench, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { db } from '../db';
import type { ToolLink } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { FormField } from '../components/ui/FormField';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Toast } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { normalizeUrl, linkHost, groupByCategory } from '../utils/links';

const SUGGESTED_CATEGORIES = ['Cloud', 'GitHub', 'Google', 'Monitoring', 'Docs', 'Other'];

const schema = z.object({
  label: z.string().min(1, 'Required'),
  url: z.string().min(1, 'Required'),
  category: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function Toolbox() {
  const { toast, showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ToolLink | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ToolLink | undefined>();
  const [deleting, setDeleting] = useState(false);

  const links = useLiveQuery(() => db.toolLinks.toArray()) ?? [];
  const groups = useMemo(() => groupByCategory(links), [links]);
  const existingCategories = useMemo(
    () => [...new Set([...links.map((l) => l.category).filter(Boolean), ...SUGGESTED_CATEGORIES])],
    [links],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { label: '', url: '', category: '' },
  });

  function openCreate() {
    setEditing(undefined);
    reset({ label: '', url: '', category: '' });
    setModalOpen(true);
  }

  function openEdit(link: ToolLink) {
    setEditing(link);
    reset({ label: link.label, url: link.url, category: link.category });
    setModalOpen(true);
  }

  async function onSubmit(data: FormData) {
    const now = new Date();
    const payload = {
      label: data.label.trim(),
      url: normalizeUrl(data.url),
      category: data.category?.trim() || 'Other',
      updatedAt: now,
    };
    try {
      if (editing?.id) {
        await db.toolLinks.update(editing.id, payload);
        showToast('success', 'Link updated.');
      } else {
        await db.toolLinks.add({ ...payload, createdAt: now });
        showToast('success', 'Link added.');
      }
      setModalOpen(false);
    } catch {
      showToast('error', 'Could not save the link.');
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await db.toolLinks.delete(deleteTarget.id);
      showToast('success', 'Link removed.');
    } catch {
      showToast('error', 'Delete failed.');
    } finally {
      setDeleting(false);
      setDeleteTarget(undefined);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Toolbox"
        description="Quick links to the tools you use — cloud consoles, admin panels, dashboards, and docs."
        action={
          <Button onClick={openCreate}>
            <Plus size={15} />
            Add Link
          </Button>
        }
      />

      {links.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No links yet"
          description="Add quick links to the tools you reach for daily — DigitalOcean, Google Workspace admin, GitHub, Grafana…"
          action={
            <Button onClick={openCreate}>
              <Plus size={15} />
              Add your first link
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {category}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((link) => (
                  <div
                    key={link.id}
                    className="group relative flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 p-4 transition-colors hover:border-slate-600"
                  >
                    <a
                      href={normalizeUrl(link.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-indigo-400">
                        <ExternalLink size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-100 group-hover:text-indigo-300">
                          {link.label}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{linkHost(link.url)}</span>
                      </span>
                    </a>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => openEdit(link)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                        aria-label={`Edit ${link.label}`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(link)}
                        className="rounded p-1.5 text-red-500 hover:bg-red-950 hover:text-red-300 transition-colors"
                        aria-label={`Remove ${link.label}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Add / edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Link' : 'Add Link'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="toollink-form" loading={isSubmitting}>
              {editing ? 'Save Changes' : 'Add Link'}
            </Button>
          </>
        }
      >
        <form id="toollink-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField label="Label" htmlFor="tl-label" error={errors.label?.message} required>
            <Input id="tl-label" placeholder="e.g. DigitalOcean Console" {...register('label')} error={errors.label?.message} />
          </FormField>
          <FormField label="URL" htmlFor="tl-url" error={errors.url?.message} required>
            <Input id="tl-url" placeholder="cloud.digitalocean.com" {...register('url')} error={errors.url?.message} />
          </FormField>
          <FormField label="Category" htmlFor="tl-category" hint="Groups links on the page">
            <Input id="tl-category" placeholder="Cloud" list="tool-categories" {...register('category')} />
            <datalist id="tool-categories">
              {existingCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </FormField>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={handleDelete}
        title="Remove Link"
        message={`Remove "${deleteTarget?.label}" from your Toolbox?`}
        confirmLabel="Remove"
        variant="danger"
        loading={deleting}
      />

      <Toast toast={toast} />
    </div>
  );
}
