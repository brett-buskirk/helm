import { db } from '../db';

interface BackupData {
  exportedAt: string;
  version: number;
  clients: unknown[];
  projects: unknown[];
  proposals: unknown[];
  agreements: unknown[];
  invoices: unknown[];
  payments: unknown[];
  expenses: unknown[];
  documents: unknown[];
  timeEntries?: unknown[];
  toolLinks?: unknown[];
  settings: unknown[];
}

export async function exportAllData(): Promise<void> {
  const data: BackupData = {
    exportedAt: new Date().toISOString(),
    version: 3,
    clients: await db.clients.toArray(),
    projects: await db.projects.toArray(),
    proposals: await db.proposals.toArray(),
    agreements: await db.agreements.toArray(),
    invoices: await db.invoices.toArray(),
    payments: await db.payments.toArray(),
    expenses: await db.expenses.toArray(),
    documents: await db.documents.toArray(),
    timeEntries: await db.timeEntries.toArray(),
    toolLinks: await db.toolLinks.toArray(),
    settings: await db.settings.toArray(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `helm-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importData(file: File): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text) as BackupData;

  if (!data.version || !data.exportedAt) {
    throw new Error('Invalid backup file format.');
  }

  await db.transaction(
    'rw',
    [
      db.clients,
      db.projects,
      db.proposals,
      db.agreements,
      db.invoices,
      db.payments,
      db.expenses,
      db.documents,
      db.timeEntries,
      db.toolLinks,
      db.settings,
    ],
    async () => {
      await db.clients.clear();
      await db.projects.clear();
      await db.proposals.clear();
      await db.agreements.clear();
      await db.invoices.clear();
      await db.payments.clear();
      await db.expenses.clear();
      await db.documents.clear();
      await db.timeEntries.clear();
      await db.toolLinks.clear();
      await db.settings.clear();

      if (data.clients?.length) await db.clients.bulkAdd(data.clients as never[]);
      if (data.projects?.length) await db.projects.bulkAdd(data.projects as never[]);
      if (data.proposals?.length) await db.proposals.bulkAdd(data.proposals as never[]);
      if (data.agreements?.length) await db.agreements.bulkAdd(data.agreements as never[]);
      if (data.invoices?.length) await db.invoices.bulkAdd(data.invoices as never[]);
      if (data.payments?.length) await db.payments.bulkAdd(data.payments as never[]);
      if (data.expenses?.length) await db.expenses.bulkAdd(data.expenses as never[]);
      if (data.documents?.length) await db.documents.bulkAdd(data.documents as never[]);
      // timeEntries absent in v1 backups — guard keeps restore back-compatible
      if (data.timeEntries?.length) await db.timeEntries.bulkAdd(data.timeEntries as never[]);
      // toolLinks absent in v1/v2 backups — same back-compat guard
      if (data.toolLinks?.length) await db.toolLinks.bulkAdd(data.toolLinks as never[]);
      if (data.settings?.length) await db.settings.bulkAdd(data.settings as never[]);
    },
  );
}
