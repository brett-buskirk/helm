import { describe, it, expect } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '../invoices/InvoicePDF';
import { ProposalPDF } from '../proposals/ProposalPDF';
import { DocumentPDF } from '../documents/DocumentPDF';
import type { Invoice, Client, Settings, Proposal, Document as Doc } from '../../types';

const settings = {
  businessName: 'Brett Buskirk LLC',
  ownerName: 'Brett Buskirk',
  address: '1 Main St',
  email: 'brett@example.com',
  paymentInstructions: 'Net 30',
  brandColor: '#10b981',
  defaultRate: 150,
  taxRate: 25,
  invoicePrefix: 'INV-',
  invoiceNextNumber: 1001,
  expenseCategories: [],
  updatedAt: new Date(),
} as Settings;

const client = {
  company: 'Acme Corp',
  contactName: 'Jane Doe',
  email: 'jane@acme.com',
  address: '2 Oak Ave',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
} as Client;

const invoice = {
  clientId: 1,
  invoiceNumber: 'INV-1001',
  status: 'sent',
  issueDate: new Date(),
  dueDate: new Date(),
  lineItems: [{ description: 'Work', quantity: 2, unitPrice: 100, amount: 200 }],
  subtotal: 200,
  taxRate: 0,
  taxAmount: 0,
  total: 200,
  amountPaid: 0,
  balanceDue: 200,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Invoice;

const proposal = {
  clientId: 1,
  title: 'Cloud Foundation',
  scope: '## Scope\n\nA **fixed-fee** engagement:\n\n1. Discovery\n2. Build',
  deliverables: '- Terraform modules\n- Runbooks\n- [Repo](https://github.com/x/y)',
  pricing: 12000,
  status: 'sent',
  createdAt: new Date(),
  updatedAt: new Date(),
} as Proposal;

const doc = {
  type: 'sow',
  title: 'SOW — Acme',
  content: '# Statement of Work\n\nCovers **infrastructure**:\n\n- VPC setup\n- Monitoring\n\n> Phased delivery.',
  isTemplate: false,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Doc;

describe('PDF rendering (regression guard)', () => {
  it('renders an invoice without throwing', async () => {
    const buf = await renderToBuffer(<InvoicePDF invoice={invoice} client={client} settings={settings} />);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('renders a proposal without throwing', async () => {
    const buf = await renderToBuffer(<ProposalPDF proposal={proposal} client={client} settings={settings} />);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('renders a document without throwing', async () => {
    const buf = await renderToBuffer(<DocumentPDF doc={doc} settings={settings} />);
    expect(buf.length).toBeGreaterThan(0);
  });
});
