import type { IncomeSource, Payment } from '../types';
import { coerceDate } from './date';

/**
 * Income sources and how each is treated for tax.
 *
 * The distinction matters: an owner's transfer is capital moving between your
 * own accounts, not earnings, and card cashback is normally a rebate that
 * reduces an expense rather than income. Counting either as revenue would
 * inflate profit, margin, and the quarterly tax set-aside. `taxable` here is
 * only the *default* a new entry starts from — the value is stored per record
 * so an unusual case can be classified correctly and still be auditable later.
 */
export const INCOME_SOURCES: Record<
  IncomeSource,
  { label: string; taxable: boolean; hint: string }
> = {
  invoice: {
    label: 'Invoice payment',
    taxable: true,
    hint: 'Money received against an invoice.',
  },
  'owner-contribution': {
    label: "Owner's contribution",
    taxable: false,
    hint: 'Your own money moved into the business — capital, not earnings.',
  },
  cashback: {
    label: 'Cashback / rebate',
    taxable: false,
    hint: 'Card rewards and vendor rebates normally reduce an expense rather than count as income.',
  },
  donation: {
    label: 'Donation / gift',
    taxable: false,
    hint: 'Received as a gift rather than earned. Confirm the treatment with your accountant.',
  },
  interest: {
    label: 'Interest',
    taxable: true,
    hint: 'Interest earned on a business account.',
  },
  other: {
    label: 'Other income',
    taxable: true,
    hint: 'Anything else. Defaults to taxable — clear the flag if it is not earnings.',
  },
};

/** Sources a person can record by hand. `invoice` is created by the invoice flow. */
export const MANUAL_INCOME_SOURCES = (Object.keys(INCOME_SOURCES) as IncomeSource[]).filter(
  (s) => s !== 'invoice',
);

export function incomeSourceLabel(source: IncomeSource | undefined): string {
  return source ? INCOME_SOURCES[source]?.label ?? 'Other income' : 'Other income';
}

/** Whether a source is taxable by default. Used to pre-fill the form. */
export function defaultTaxable(source: IncomeSource): boolean {
  return INCOME_SOURCES[source]?.taxable ?? true;
}

/**
 * A payment predating the v6 ledger migration, or one restored from an older
 * backup, may be missing `source`/`taxable`. Both used to mean "invoice
 * payment", so read them that way rather than dropping the row from totals.
 */
export function paymentSource(payment: Pick<Payment, 'source' | 'invoiceId'>): IncomeSource {
  return payment.source ?? 'invoice';
}

export function isTaxable(payment: Pick<Payment, 'taxable' | 'source' | 'invoiceId'>): boolean {
  return payment.taxable ?? defaultTaxable(paymentSource(payment));
}

export interface IncomeTotals {
  /** Taxable earnings — drives profit, margin, and the tax set-aside. */
  revenue: number;
  /** Every deposit, taxable or not — what actually landed in the account. */
  moneyIn: number;
  /** moneyIn − revenue, i.e. deposits that are not earnings. */
  nonRevenue: number;
}

/**
 * Split deposits into revenue and total money in over an optional date window.
 * Future-dated deposits are excluded, matching how expenses treat projections.
 */
export function summarizeIncome(
  payments: Payment[],
  start: Date | null,
  end: Date | null,
  asOf: Date = new Date(),
): IncomeTotals {
  let revenue = 0;
  let moneyIn = 0;
  for (const p of payments) {
    const d = coerceDate(p.date as unknown as Date);
    if (!d || d > asOf) continue;
    if (start && d < start) continue;
    if (end && d > end) continue;
    moneyIn += p.amount;
    if (isTaxable(p)) revenue += p.amount;
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    revenue: round2(revenue),
    moneyIn: round2(moneyIn),
    nonRevenue: round2(moneyIn - revenue),
  };
}

export interface SourceBreakdown {
  source: IncomeSource;
  label: string;
  taxable: boolean;
  total: number;
  count: number;
}

/** Per-source totals over a window, largest first. Used by the Income summary. */
export function breakdownBySource(
  payments: Payment[],
  start: Date | null,
  end: Date | null,
): SourceBreakdown[] {
  const totals = new Map<IncomeSource, { total: number; count: number; taxable: boolean }>();
  for (const p of payments) {
    const d = coerceDate(p.date as unknown as Date);
    if (!d) continue;
    if (start && d < start) continue;
    if (end && d > end) continue;
    const source = paymentSource(p);
    const entry = totals.get(source) ?? { total: 0, count: 0, taxable: isTaxable(p) };
    entry.total += p.amount;
    entry.count += 1;
    totals.set(source, entry);
  }
  return [...totals.entries()]
    .map(([source, { total, count, taxable }]) => ({
      source,
      label: incomeSourceLabel(source),
      taxable,
      total: Math.round(total * 100) / 100,
      count,
    }))
    .sort((a, b) => b.total - a.total);
}
