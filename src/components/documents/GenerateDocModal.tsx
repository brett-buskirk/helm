import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Document } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { FormField } from '../ui/FormField';
import { fillTemplate } from '../../utils/template';

interface Props {
  template: Document;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export function GenerateDocModal({ template, isOpen, onClose, onSuccess }: Props) {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);

  const allClients = useLiveQuery(() => db.clients.toCollection().sortBy('company')) ?? [];
  const settings = useLiveQuery(() => db.settings.limit(1).first());

  const clientProjects = useLiveQuery<import('../../types').Project[]>(
    () =>
      clientId
        ? db.projects.where('clientId').equals(Number(clientId)).toArray()
        : Promise.resolve([]),
    [clientId],
  ) ?? [];

  const clientOptions = [
    { value: '', label: 'Select a client…' },
    ...allClients.map((c) => ({ value: String(c.id), label: c.company })),
  ];

  const projectOptions = [
    { value: '', label: 'No project' },
    ...clientProjects.map((p) => ({ value: String(p.id), label: p.name })),
  ];

  async function handleGenerate() {
    const client = clientId ? allClients.find((c) => c.id === Number(clientId)) : null;
    const project = projectId ? clientProjects.find((p) => p.id === Number(projectId)) : null;

    const filledContent = fillTemplate(template.content, {
      client: client ?? null,
      project: project ?? null,
      settings: settings ?? null,
    });

    setSaving(true);
    try {
      const now = new Date();
      const newId = await db.documents.add({
        type: template.type,
        title: template.title + (client ? ` — ${client.company}` : ''),
        content: filledContent,
        isTemplate: false,
        generatedFrom: template.id,
        clientId: client?.id,
        projectId: project?.id,
        createdAt: now,
        updatedAt: now,
      });
      onSuccess('Document generated.');
      onClose();
      navigate(`/documents/${newId}/edit`);
    } catch {
      onSuccess('Failed to generate document.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Generate from "${template.title}"`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} loading={saving} disabled={!clientId}>
            Generate Document
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Select a client to fill in the template variables and create a copy for that client.
        </p>
        <FormField label="Client" htmlFor="gen-client" required>
          <Select
            id="gen-client"
            options={clientOptions}
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setProjectId('');
            }}
          />
        </FormField>
        {clientId && (
          <FormField label="Project" htmlFor="gen-project" hint="Optional">
            <Select
              id="gen-project"
              options={projectOptions}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
          </FormField>
        )}
      </div>
    </Modal>
  );
}
