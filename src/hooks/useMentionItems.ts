import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export interface MentionItem {
  id: string;
  label: string;
  href: string;
  group: string;
}

/**
 * The list of linkable resources for @-mentions: invoices, clients, proposals,
 * projects (linked via their client), and non-template documents. `href` is a
 * hash route so the link navigates in-app and renders as a link in the preview.
 */
export function useMentionItems(): MentionItem[] {
  const invoices = useLiveQuery(() => db.invoices.toArray()) ?? [];
  const clients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const projects = useLiveQuery(() => db.projects.toArray()) ?? [];
  const proposals = useLiveQuery(() => db.proposals.toArray()) ?? [];
  const documents = useLiveQuery(() => db.documents.toArray()) ?? [];

  return useMemo(
    () => [
      ...invoices.map((i) => ({ id: `inv-${i.id}`, label: i.invoiceNumber, href: `#/invoices/${i.id}`, group: 'Invoice' })),
      ...clients.map((c) => ({ id: `cli-${c.id}`, label: c.company, href: `#/clients/${c.id}`, group: 'Client' })),
      ...proposals.map((p) => ({ id: `pro-${p.id}`, label: p.title, href: `#/proposals/${p.id}`, group: 'Proposal' })),
      ...projects.map((p) => ({ id: `prj-${p.id}`, label: p.name, href: `#/clients/${p.clientId}`, group: 'Project' })),
      ...documents
        .filter((d) => !d.isTemplate)
        .map((d) => ({ id: `doc-${d.id}`, label: d.title, href: `#/documents/${d.id}/edit`, group: 'Document' })),
    ],
    [invoices, clients, projects, proposals, documents],
  );
}
