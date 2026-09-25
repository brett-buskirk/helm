import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Wallet, Search, Pencil, Trash2, FileText, Lock } from 'lucide-react';
import { db } from '../db';
import type { IncomeSource, Payment } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { SortableHeader } from '../components/ui/SortableHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Toast } from '../components/ui/Toast';
import { IncomeForm } from '../components/income/IncomeForm';
import { useToast } from '../hooks/useToast';
import { useTableSort } from '../hooks/useTableSort';
import { formatDate, formatCurrency } from '../utils/format';
import { isInPeriod, coerceDate, getPeriodRange, type Period } from '../utils/date';
import {
  INCOME_SOURCES,
  breakdownBySource,
  incomeSourceLabel,
  isTaxable,
  paymentSource,
  summarizeIncome,
} from '../utils/income';

const PERIOD_OPTIONS = [
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

const SOURCE_FILTER_OPTIONS = [
  { value: '', label: 'All sources' },
  ...(Object.keys(INCOME_SOURCES) as IncomeSource[]).map((s) => ({
    value: s,
    label: INCOME_SOURCES[s].label,
  })),
];

const TAX_FILTER_OPTIONS = [
  { value: '', label: 'Taxable & not' },
  { value: 'taxable', label: 'Taxable only' },
  { value: 'nontaxable', label: 'Non-taxable only' },
];

type IncomeSortKey = 'date' | 'source' | 'client' | 'method' | 'amount';

/**
 * Income — the full money-in ledger.
 *
 * Invoice payments appear here alongside manually recorded income, but stay
 * read-only: they belong to their invoice, and editing an amount here would put
 * it out of step with that invoice's balance. The row links to the invoice
 * instead.
 */
export default function Income() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Payment | undefined>();
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('year');
  const [sourceFilter, setSourceFilter] = useState('');
  const [taxFilter, setTaxFilter] = useState('');

  const sort = useTableSort<IncomeSortKey>('date', 'desc');

  const allIncome = useLiveQuery(() => db.payments.orderBy('date').reverse().toArray()) ?? [];
  const allClients = useLiveQuery(() => db.clients.toArray()) ?? [];

  const clientMap = useMemo(() => new Map(allClients.map((c) => [c.id!, c])), [allClients]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allIncome.filter((p) => {
      const matchesPeriod = isInPeriod(p.date as unknown as Date, period);
      const matchesSource = !sourceFilter || paymentSource(p) === sourceFilter;
      const matchesTax =
        !taxFilter ||
        (taxFilter === 'taxable' && isTaxable(p)) ||
        (taxFilter === 'nontaxable' && !isTaxable(p));
      const matchesSearch =
        !q ||
        incomeSourceLabel(paymentSource(p)).toLowerCase().includes(q) ||
        (p.method ?? '').toLowerCase().includes(q) ||
        (p.notes ?? '').toLowerCase().includes(q) ||
        (p.clientId ? (clientMap.get(p.clientId)?.company ?? '').toLowerCase().includes(q) : false);
      return matchesPeriod && matchesSource && matchesTax && matchesSearch;
    });
  }, [allIncome, period, sourceFilter, taxFilter, search, clientMap]);

  const sorted = useMemo(
    () =>
      sort.sortRows(filtered, (p, key) => {
        switch (key) {
          case 'date':
            return coerceDate(p.date as unknown as Date);
          case 'source':
            return incomeSourceLabel(paymentSource(p));
          case 'client':
            return p.clientId ? clientMap.get(p.clientId)?.company : undefined;
          case 'method':
            return p.method;
          case 'amount':
            return p.amount;
        }
      }),
    [filtered, sort, clientMap],
  );

  // Totals follow the active filters, so the summary always describes the rows
  // on screen rather than the whole ledger.
  const { start, end } = getPeriodRange(period);
  const totals = useMemo(() => summarizeIncome(filtered, null, null), [filtered]);
  const bySource = useMemo(() => breakdownBySource(filtered, null, null), [filtered]);

  function openCreate() {
    setEditing(undefined);
    setDrawerOpen(true);
  }

  function openEdit(income: Payment) {
    setEditing(income);
    setDrawerOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await db.payments.delete(deleteTarget.id);
      showToast('success', 'Income deleted.');
    } catch {
      showToast('error', 'Delete failed.');
    } finally {
      setDeleting(false);
      setDeleteTarget(undefined);
    }
  }

  const hasActiveFilters = !!(search || sourceFilter || taxFilter);
  const headerProps = { sort: sort.sort, onSort: sort.toggleSort };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Income"
        description={`${allIncome.length} deposit${allIncome.length !== 1 ? 's' : ''} total`}
        action={
          <Button onClick={openCreate}>
            <Plus size={15} />
            Record Income
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-56">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search income…"
            className="pl-8"
          />
        </div>
        <Select
          options={SOURCE_FILTER_OPTIONS}
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="w-48"
          aria-label="Filter by source"
        />
        <Select
          options={TAX_FILTER_OPTIONS}
          value={taxFilter}
          onChange={(e) => setTaxFilter(e.target.value)}
          className="w-44"
          aria-label="Filter by tax treatment"
        />
        <div className="flex overflow-hidden rounded-md border border-slate-700">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value as Period)}
              className={[
                'px-3 py-1.5 text-xs font-medium transition-colors',
                period === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary — revenue vs total money in */}
      {filtered.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 rounded-xl border border-slate-700 bg-slate-800 px-5 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Revenue</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-400">
                {formatCurrency(totals.revenue)}
              </p>
              <p className="text-[11px] text-slate-600">Taxable earnings</p>
            </div>
            <div className="border-l border-slate-700 pl-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Money In</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-100">
                {formatCurrency(totals.moneyIn)}
              </p>
              <p className="text-[11px] text-slate-600">Every deposit</p>
            </div>
            {totals.nonRevenue > 0 && (
              <div className="border-l border-slate-700 pl-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Non-Revenue
                </p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-400">
                  {formatCurrency(totals.nonRevenue)}
                </p>
                <p className="text-[11px] text-slate-600">Not taxed</p>
              </div>
            )}
            <div className="border-l border-slate-700 pl-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Count</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-300">
                {filtered.length}
              </p>
            </div>
          </div>

          {/* Per-source breakdown */}
          {bySource.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {bySource.map((b) => (
                <span
                  key={b.source}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs"
                >
                  <span className="text-slate-400">{b.label}</span>
                  <span className="font-semibold tabular-nums text-slate-200">
                    {formatCurrency(b.total)}
                  </span>
                  {!b.taxable && (
                    <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-400">
                      not taxed
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={
            hasActiveFilters
              ? 'No income matches your filters'
              : allIncome.length === 0
              ? 'No income yet'
              : start && end
              ? 'No income in this period'
              : 'No income yet'
          }
          description={
            hasActiveFilters
              ? 'Try adjusting your search or filters.'
              : 'Invoice payments land here automatically. Record anything that did not come through an invoice — an owner’s transfer, cashback, a donation.'
          }
          action={
            !hasActiveFilters ? (
              <Button onClick={openCreate}>
                <Plus size={15} />
                Record Income
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800">
                <SortableHeader label="Date" sortKey="date" defaultDirection="desc" {...headerProps} />
                <SortableHeader label="Source" sortKey="source" {...headerProps} />
                <SortableHeader label="Client" sortKey="client" {...headerProps} />
                <SortableHeader label="Method" sortKey="method" {...headerProps} />
                <SortableHeader label="Amount" sortKey="amount" defaultDirection="desc" {...headerProps} />
                <SortableHeader label="Tax" {...headerProps} />
                <SortableHeader label="" {...headerProps} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900">
              {sorted.map((p) => {
                const fromInvoice = p.invoiceId != null;
                return (
                  <tr key={p.id} className="group">
                    <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-slate-400">
                      {formatDate(p.date as unknown as Date)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-200">
                        {incomeSourceLabel(paymentSource(p))}
                      </p>
                      {p.notes && (
                        <p className="max-w-[220px] truncate text-xs text-slate-500">{p.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {p.clientId ? (clientMap.get(p.clientId)?.company ?? '—') : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{p.method || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium tabular-nums text-emerald-400">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {isTaxable(p) ? (
                        <Badge variant="success">Taxable</Badge>
                      ) : (
                        <Badge variant="neutral">Not taxed</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {fromInvoice ? (
                          // Invoice payments belong to their invoice — editing the
                          // amount here would desync that invoice's balance.
                          <>
                            <button
                              onClick={() => navigate(`/invoices/${p.invoiceId}`)}
                              className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-100"
                              aria-label="View invoice"
                              title="View invoice"
                            >
                              <FileText size={13} />
                            </button>
                            <span
                              className="p-1.5 text-slate-600"
                              title="Edit this payment on its invoice"
                            >
                              <Lock size={13} />
                            </span>
                          </>
                        ) : (
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => openEdit(p)}
                              className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-100"
                              aria-label="Edit income"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(p)}
                              className="rounded p-1.5 text-red-500 transition-colors hover:bg-red-950 hover:text-red-300"
                              aria-label="Delete income"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <IncomeForm
        income={editing}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={(msg) => showToast('success', msg)}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={handleDelete}
        title="Delete Income"
        message={`Delete this ${formatCurrency(deleteTarget?.amount ?? 0)} ${incomeSourceLabel(
          deleteTarget ? paymentSource(deleteTarget) : 'other',
        ).toLowerCase()}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      <Toast toast={toast} />
    </div>
  );
}
