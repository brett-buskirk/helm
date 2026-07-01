import type { Payment, Client, Project, TimeEntry } from '../types';
import { coerceDate } from './date';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ClientRevenue {
  clientId: number;
  company: string;
  total: number;
}

/** Top clients by payments received since `since` (null = all time), highest first. */
export function topClientsByRevenue(
  payments: Payment[],
  clients: Client[],
  since: Date | null,
  limit = 5,
): ClientRevenue[] {
  const byClient = new Map<number, number>();
  for (const p of payments) {
    if (since) {
      const d = coerceDate(p.date as unknown as Date);
      if (!d || d < since) continue;
    }
    byClient.set(p.clientId, (byClient.get(p.clientId) ?? 0) + p.amount);
  }
  const nameOf = new Map(clients.map((c) => [c.id, c.company]));
  return [...byClient.entries()]
    .map(([clientId, total]) => ({ clientId, company: nameOf.get(clientId) ?? 'Unknown', total: round2(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export interface UnbilledSummary {
  count: number;
  hours: number;
  amount: number;
}

/** Total unbilled billable time, valued at each project's rate (or the client default). */
export function unbilledValue(
  timeEntries: TimeEntry[],
  projects: Project[],
  clients: Client[],
): UnbilledSummary {
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  let count = 0;
  let hours = 0;
  let amount = 0;
  for (const e of timeEntries) {
    if (!e.billable || e.invoiceId != null) continue;
    const project = projectById.get(e.projectId);
    const rate = project?.rate ?? clientById.get(project?.clientId ?? e.clientId)?.defaultRate ?? 0;
    count += 1;
    hours += e.hours;
    amount += e.hours * rate;
  }
  return { count, hours: round2(hours), amount: round2(amount) };
}
