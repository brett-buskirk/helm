import { describe, it, expect } from 'vitest';
import type { TimeEntry } from '../../types';
import {
  entriesForReport,
  formatHours,
  reportFileName,
  sortEntriesByDate,
  totalHours,
} from '../timeReport';

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    clientId: 1,
    projectId: 1,
    date: new Date('2026-09-15T09:00:00'),
    hours: 2,
    description: 'Work',
    billable: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as TimeEntry;
}

const september = {
  from: new Date('2026-09-01T00:00:00'),
  to: new Date('2026-09-30T00:00:00'),
};

describe('formatHours', () => {
  it('keeps whole numbers whole and shows two decimals otherwise', () => {
    expect(formatHours(8)).toBe('8');
    expect(formatHours(7.5)).toBe('7.50');
    expect(formatHours(1.25)).toBe('1.25');
    expect(formatHours(0)).toBe('0');
  });
});

describe('totalHours', () => {
  it('sums hours', () => {
    expect(totalHours([{ hours: 2 }, { hours: 3.5 }, { hours: 0.25 }])).toBe(5.75);
  });

  it('is zero for no entries', () => {
    expect(totalHours([])).toBe(0);
  });

  it('avoids floating-point drift across many entries', () => {
    expect(totalHours(Array.from({ length: 10 }, () => ({ hours: 0.1 })))).toBe(1);
  });
});

describe('sortEntriesByDate', () => {
  it('orders chronologically, as the work happened', () => {
    const sorted = sortEntriesByDate([
      entry({ id: 3, date: new Date('2026-09-20') }),
      entry({ id: 1, date: new Date('2026-09-02') }),
      entry({ id: 2, date: new Date('2026-09-11') }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it('does not mutate its input', () => {
    const input = [entry({ id: 2, date: new Date('2026-09-20') }), entry({ id: 1 })];
    sortEntriesByDate(input);
    expect(input.map((e) => e.id)).toEqual([2, 1]);
  });
});

describe('entriesForReport', () => {
  const entries = [
    entry({ id: 1, date: new Date('2026-09-01T00:00:00') }),
    entry({ id: 2, date: new Date('2026-09-30T18:30:00') }),
    entry({ id: 3, date: new Date('2026-10-01T09:00:00') }), // outside range
    entry({ id: 4, projectId: 2 }), // another project
    entry({ id: 5, billable: false }), // internal time
    entry({ id: 6, invoiceId: 12 }), // already invoiced
  ];

  it('includes only the project in question', () => {
    const result = entriesForReport(entries, 1, september);
    expect(result.every((e) => e.projectId === 1)).toBe(true);
    expect(result.map((e) => e.id)).not.toContain(4);
  });

  it('includes both boundary days, whatever the time of day', () => {
    const ids = entriesForReport(entries, 1, september).map((e) => e.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).not.toContain(3);
  });

  it('reports billed work too — it documents work done, not what is owed', () => {
    expect(entriesForReport(entries, 1, september).map((e) => e.id)).toContain(6);
  });

  it('leaves out non-billable time, which is internal', () => {
    expect(entriesForReport(entries, 1, september).map((e) => e.id)).not.toContain(5);
  });

  it('returns entries in chronological order', () => {
    const result = entriesForReport(entries, 1, september);
    const times = result.map((e) => (e.date as Date).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('is empty when nothing falls in the period', () => {
    expect(
      entriesForReport(entries, 1, {
        from: new Date('2026-12-01T00:00:00'),
        to: new Date('2026-12-31T00:00:00'),
      }),
    ).toEqual([]);
  });
});

describe('reportFileName', () => {
  it('builds a descriptive, filesystem-safe name', () => {
    expect(
      reportFileName(
        { company: 'Acme Corp' },
        { name: 'Platform Hardening' },
        new Date('2026-09-01T00:00:00'),
        new Date('2026-09-30T00:00:00'),
      ),
    ).toBe('Acme-Corp-Platform-Hardening-time-2026-09-01-to-2026-09-30.pdf');
  });

  it('strips characters that would break a file name', () => {
    const name = reportFileName(
      { company: 'Smith & Co. / Legal' },
      { name: 'Q3: "Discovery"' },
      new Date('2026-07-01T00:00:00'),
      new Date('2026-07-31T00:00:00'),
    );
    expect(name).toBe('Smith-Co-Legal-Q3-Discovery-time-2026-07-01-to-2026-07-31.pdf');
    expect(name).not.toMatch(/[/\\:"*?<>|]/);
  });

  it('falls back rather than producing an empty segment', () => {
    const name = reportFileName(
      { company: '???' },
      { name: '!!!' },
      new Date('2026-01-01T00:00:00'),
      new Date('2026-01-31T00:00:00'),
    );
    expect(name).toBe('report-report-time-2026-01-01-to-2026-01-31.pdf');
  });
});
