import { describe, it, expect } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '../invoices/InvoicePDF';
import { ProposalPDF } from '../proposals/ProposalPDF';
import { DocumentPDF } from '../documents/DocumentPDF';
import { TimeReportPDF } from '../time/TimeReportPDF';
import type {
  Invoice,
  Client,
  Settings,
  Proposal,
  Document as Doc,
  Project,
  TimeEntry,
} from '../../types';

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

// Local midnight, matching parseDateInput — the app's own construction.
// new Date('2026-09-01') parses as UTC and renders a day early west of GMT.
const SEP_1 = new Date(2026, 8, 1);
const SEP_30 = new Date(2026, 8, 30);

const project = {
  id: 1,
  clientId: 1,
  name: 'Platform Hardening',
  type: 'hourly',
  status: 'active',
  rate: 200,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Project;

const timeEntries = [
  {
    id: 1, clientId: 1, projectId: 1, date: new Date('2026-09-04'), hours: 3.5,
    description: 'Traced intermittent 502s to connection-pool exhaustion under burst load.',
    billable: true, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: 2, clientId: 1, projectId: 1, date: new Date('2026-09-18'), hours: 2,
    description: 'Reworked the readiness probe so pods drain before refusing traffic.',
    billable: true, invoiceId: 9, createdAt: new Date(), updatedAt: new Date(),
  },
] as TimeEntry[];

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

  it('renders a time report without throwing', async () => {
    const buf = await renderToBuffer(
      <TimeReportPDF
        project={project}
        client={client}
        entries={timeEntries}
        from={SEP_1}
        to={SEP_30}
        settings={settings}
      />,
    );
    expect(buf.length).toBeGreaterThan(0);
  });

  it('renders a time report with no entries in the period', async () => {
    const buf = await renderToBuffer(
      <TimeReportPDF
        project={project}
        client={client}
        entries={[]}
        from={SEP_1}
        to={SEP_30}
        settings={settings}
      />,
    );
    expect(buf.length).toBeGreaterThan(0);
  });

  it('renders a time report with no business settings configured', async () => {
    // A brand-new install has no settings row yet; the PDF must still render.
    const buf = await renderToBuffer(
      <TimeReportPDF
        project={project}
        client={client}
        entries={timeEntries}
        from={SEP_1}
        to={SEP_30}
        settings={null}
      />,
    );
    expect(buf.length).toBeGreaterThan(0);
  });

  it('renders a multi-page time report', async () => {
    // Enough entries to spill past one page, exercising the repeating table
    // header and the page-number footer.
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1, clientId: 1, projectId: 1,
      date: new Date(2026, 8, (i % 30) + 1), hours: 1.25,
      description: `Entry ${i + 1} — a description long enough to wrap onto a second line in the Work column.`,
      billable: true, createdAt: new Date(), updatedAt: new Date(),
    })) as TimeEntry[];

    const buf = await renderToBuffer(
      <TimeReportPDF
        project={project}
        client={client}
        entries={many}
        from={SEP_1}
        to={SEP_30}
        settings={settings}
      />,
    );
    expect(buf.length).toBeGreaterThan(0);
  });
});
