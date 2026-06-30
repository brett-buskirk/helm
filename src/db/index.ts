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
  }
}

export const db = new HelmDB();

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
