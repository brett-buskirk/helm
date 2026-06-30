import { describe, it, expect } from 'vitest';
import { fillTemplate, TEMPLATE_VARS, DEFAULT_TEMPLATES } from '../template';
import type { TemplateContext } from '../template';

const mockCtx: TemplateContext = {
  client: {
    id: 1,
    company: 'Acme Corp',
    contactName: 'Jane Doe',
    email: 'jane@acme.com',
    address: '123 Main St',
    status: 'active',
    defaultRate: 150,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  project: {
    id: 1,
    clientId: 1,
    name: 'Website Redesign',
    type: 'fixed',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  settings: {
    id: 1,
    businessName: 'Brett LLC',
    ownerName: 'Brett Buskirk',
    email: 'brett@example.com',
    address: '456 Dev Lane',
    paymentInstructions: 'Pay via ACH',
    defaultRate: 150,
    taxRate: 25,
    invoicePrefix: 'INV',
    invoiceNextNumber: 1,
    expenseCategories: [],
    updatedAt: new Date(),
  },
};

describe('fillTemplate', () => {
  it('replaces client variables', () => {
    const result = fillTemplate('Client: {{CLIENT_NAME}} — {{CLIENT_CONTACT}}', mockCtx);
    expect(result).toBe('Client: Acme Corp — Jane Doe');
  });

  it('replaces settings variables', () => {
    const result = fillTemplate('{{MY_NAME}} at {{MY_BUSINESS}}', mockCtx);
    expect(result).toBe('Brett Buskirk at Brett LLC');
  });

  it('replaces project variable', () => {
    const result = fillTemplate('Project: {{PROJECT_NAME}}', mockCtx);
    expect(result).toBe('Project: Website Redesign');
  });

  it('replaces all occurrences of a variable', () => {
    const result = fillTemplate('{{CLIENT_NAME}} and {{CLIENT_NAME}}', mockCtx);
    expect(result).toBe('Acme Corp and Acme Corp');
  });

  it('falls back to empty string for missing context', () => {
    const result = fillTemplate('{{CLIENT_NAME}} {{PROJECT_NAME}}', {});
    expect(result).toBe(' ');
  });

  it('injects a date for {{DATE}}', () => {
    const result = fillTemplate('Date: {{DATE}}', mockCtx);
    expect(result).toMatch(/Date: \w+ \d+, \d{4}/);
  });

  it('injects the current year for {{YEAR}}', () => {
    const result = fillTemplate('Year: {{YEAR}}', mockCtx);
    expect(result).toMatch(/Year: \d{4}/);
  });

  it('returns content unchanged when no variables present', () => {
    const content = 'No variables here.';
    expect(fillTemplate(content, mockCtx)).toBe(content);
  });
});

describe('TEMPLATE_VARS', () => {
  it('exports all expected variable keys', () => {
    const keys = TEMPLATE_VARS.map((v) => v.key);
    expect(keys).toContain('{{MY_NAME}}');
    expect(keys).toContain('{{CLIENT_NAME}}');
    expect(keys).toContain('{{PROJECT_NAME}}');
    expect(keys).toContain('{{DATE}}');
    expect(keys).toContain('{{YEAR}}');
  });

  it('every variable has a non-empty description', () => {
    TEMPLATE_VARS.forEach(({ description }) => {
      expect(description.length).toBeGreaterThan(0);
    });
  });
});

describe('DEFAULT_TEMPLATES', () => {
  const types = ['msa', 'nda', 'sow', 'proposal', 'other'] as const;

  it('provides a template for every document type', () => {
    types.forEach((t) => {
      expect(typeof DEFAULT_TEMPLATES[t]).toBe('string');
      expect(DEFAULT_TEMPLATES[t].length).toBeGreaterThan(0);
    });
  });

  it('MSA template contains expected sections', () => {
    expect(DEFAULT_TEMPLATES.msa).toContain('MASTER SERVICES AGREEMENT');
    expect(DEFAULT_TEMPLATES.msa).toContain('{{CLIENT_NAME}}');
    expect(DEFAULT_TEMPLATES.msa).toContain('{{MY_NAME}}');
  });

  it('SOW template references project variable', () => {
    expect(DEFAULT_TEMPLATES.sow).toContain('{{PROJECT_NAME}}');
  });
});
