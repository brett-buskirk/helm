import Dexie, { type EntityTable } from 'dexie';
import type {
  Client,
  Project,
  Proposal,
  Agreement,
  Invoice,
  Payment,
  Expense,
  Document,
  TimeEntry,
  ToolLink,
  SecurityConfig,
  Settings,
} from '../types';

class HelmDB extends Dexie {
  clients!: EntityTable<Client, 'id'>;
  projects!: EntityTable<Project, 'id'>;
  proposals!: EntityTable<Proposal, 'id'>;
  agreements!: EntityTable<Agreement, 'id'>;
  invoices!: EntityTable<Invoice, 'id'>;
  payments!: EntityTable<Payment, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  documents!: EntityTable<Document, 'id'>;
  timeEntries!: EntityTable<TimeEntry, 'id'>;
  toolLinks!: EntityTable<ToolLink, 'id'>;
  security!: EntityTable<SecurityConfig, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor() {
    super('HelmDB');
    this.version(1).stores({
      clients: '++id, company, email, status',
      projects: '++id, clientId, name, status, type',
      proposals: '++id, clientId, projectId, status',
      agreements: '++id, projectId, clientId, proposalId, status',
      invoices: '++id, clientId, projectId, invoiceNumber, status, dueDate',
      payments: '++id, invoiceId, clientId, date',
      expenses: '++id, clientId, projectId, category, date, deductible, billable',
      documents: '++id, clientId, projectId, type, isTemplate',
      settings: '++id',
    });
    // v2: add issueDate index to invoices so orderBy('issueDate') works
    this.version(2).stores({
      invoices: '++id, clientId, projectId, invoiceNumber, status, dueDate, issueDate',
    });
    // v3: time tracking for hourly projects
    this.version(3).stores({
      timeEntries: '++id, clientId, projectId, date, billable, invoiceId',
    });
    // v4: customizable dev-tool quick links (Toolbox)
    this.version(4).stores({
      toolLinks: '++id, category',
    });
    // v5: opt-in at-rest encryption. Adds the security table and drops the
    // indexes on now-encryptable identity fields (client company/email, project
    // name) — those are sorted/filtered in memory after the read hook decrypts.
    this.version(5).stores({
      clients: '++id, status',
      projects: '++id, clientId, status, type',
      security: '++id',
    });
    // v6: payments become the single income ledger. invoiceId/clientId turn
    // optional so non-invoice income (owner's transfers, cashback, donations)
    // lives alongside invoice payments, and `source`/`taxable` classify each
    // deposit. Dexie skips undefined keys, so the invoiceId index keeps working
    // for the invoice lookups -- rows without one simply aren't in it.
    this.version(6)
      .stores({
        payments: '++id, invoiceId, clientId, date, source',
      })
      .upgrade(async (tx) => {
        await tx.table('payments').toCollection().modify(stampAsInvoiceIncome);
      });
  }
}

/**
 * The v6 upgrade step, applied to each pre-v6 payment row.
 *
 * Every payment that existed before the income ledger was, by definition, money
 * against an invoice — so it is taxable revenue. Exported so the migration's
 * behaviour can be asserted directly rather than only through a version bump.
 */
export function stampAsInvoiceIncome(payment: Partial<Payment>): void {
  payment.source = 'invoice';
  payment.taxable = true;
}

export const db = new HelmDB();

// Note: encryption hooks are installed from the app entry point (main.tsx) and
// the test setup — NOT here — so this module doesn't import ./encryption, which
// would create an import cycle (encryption.ts imports db from here). See #23.

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Software & Subscriptions',
  'Hardware & Equipment',
  'Professional Development',
  'Office & Supplies',
  'Travel & Transportation',
  'Marketing & Advertising',
  'Professional Services',
  'Utilities & Internet',
  'Other',
];
