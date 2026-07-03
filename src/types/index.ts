export type ClientStatus = 'lead' | 'active' | 'past';
export type ProjectType = 'fixed' | 'retainer' | 'hourly';
export type ProjectStatus = 'lead' | 'active' | 'paused' | 'completed' | 'cancelled';
export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'declined';
export type AgreementStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type DocumentType = 'msa' | 'nda' | 'sow' | 'proposal' | 'other';

export interface Client {
  id?: number;
  /** Present and true only on seeded sample data; absent on real user records. */
  isDemo?: boolean;
  company: string;
  contactName: string;
  email: string;
  phone?: string;
  address?: string;
  taxId?: string;
  defaultRate?: number;
  status: ClientStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectLink {
  label: string;
  url: string;
}

export interface Project {
  id?: number;
  isDemo?: boolean;
  clientId: number;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  startDate?: Date;
  endDate?: Date;
  description?: string;
  rate?: number;
  /** Repo / PR / dashboard links for the engagement. */
  links?: ProjectLink[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Proposal {
  id?: number;
  isDemo?: boolean;
  clientId: number;
  projectId?: number;
  title: string;
  scope: string;
  deliverables: string;
  pricing: number;
  pricingNote?: string;
  validUntil?: Date;
  status: ProposalStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Agreement {
  id?: number;
  projectId: number;
  clientId: number;
  proposalId?: number;
  title: string;
  scope: string;
  deliverables: string;
  milestones: string;
  fees: number;
  paymentSchedule: string;
  msaReference?: string;
  status: AgreementStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id?: number;
  isDemo?: boolean;
  clientId: number;
  projectId?: number;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentTerms?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id?: number;
  isDemo?: boolean;
  invoiceId: number;
  clientId: number;
  amount: number;
  date: Date;
  method?: string;
  notes?: string;
  createdAt: Date;
}

export interface Expense {
  id?: number;
  isDemo?: boolean;
  date: Date;
  vendor: string;
  category: string;
  amount: number;
  deductible: boolean;
  billable: boolean;
  clientId?: number;
  projectId?: number;
  notes?: string;
  receiptPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id?: number;
  isDemo?: boolean;
  clientId?: number;
  projectId?: number;
  type: DocumentType;
  title: string;
  content: string;
  isTemplate: boolean;
  generatedFrom?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntry {
  id?: number;
  isDemo?: boolean;
  clientId: number;
  projectId: number;
  date: Date;
  hours: number;
  description: string;
  billable: boolean;
  /** Set when the entry has been rolled into an invoice; absent means unbilled. */
  invoiceId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolLink {
  id?: number;
  label: string;
  url: string;
  /** Free-text group heading, e.g. "Cloud", "GitHub", "Google", "Monitoring". */
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Singleton row holding at-rest encryption state (never itself encrypted). */
export interface SecurityConfig {
  id?: number;
  enabled: boolean;
  kdfSalt: string;
  iterations: number;
  /** Ciphertext of a known token; decrypting it verifies the passphrase. */
  verifier: string;
  updatedAt: Date;
}

export interface Settings {
  id?: number;
  businessName: string;
  ownerName: string;
  ein?: string;
  address: string;
  email: string;
  phone?: string;
  website?: string;
  paymentInstructions: string;
  /** Hex accent color for client-facing PDFs (e.g. "#6366f1"). */
  brandColor?: string;
  /** Business logo as a data URL, shown on PDFs. */
  logo?: string;
  /** GitHub personal access token — opt-in; encrypted at rest when encryption is on. */
  githubToken?: string;
  /** Connected GitHub username, for display. Presence of githubToken = connected. */
  githubUser?: string;
  defaultRate: number;
  taxRate: number;
  invoicePrefix: string;
  invoiceNextNumber: number;
  expenseCategories: string[];
  updatedAt: Date;
}
