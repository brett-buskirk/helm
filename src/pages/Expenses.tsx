import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Receipt, Search, Pencil, Trash2, Repeat } from 'lucide-react';
import { db } from '../db';
import type { Expense, ExpenseRecurrence } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { SortableHeader } from '../components/ui/SortableHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Toast } from '../components/ui/Toast';
import { ExpenseForm } from '../components/expenses/ExpenseForm';
import { useToast } from '../hooks/useToast';
import { useTableSort } from '../hooks/useTableSort';
import { formatDate, formatCurrency } from '../utils/format';
import { isInPeriod, coerceDate, isProjected, type Period } from '../utils/date';
import {
  RECURRENCE_LABEL,
  dueOccurrences,
  logDueOccurrences,
  summarizeRecurring,
  monthlyEquivalent,
} from '../utils/recurringExpense';

const PERIOD_OPTIONS = [
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

/**
 * Tag filters mirror the badges in the Tags column, so every column on the
 * table is either sortable or filterable (or both).
 */
type TagFilter = '' | 'deductible' | 'nondeductible' | 'billable' | 'recurring' | 'projected';

const TAG_FILTER_OPTIONS: { value: TagFilter; label: string }[] = [
  { value: '', label: 'All tags' },
  { value: 'deductible', label: 'Deductible' },
  { value: 'nondeductible', label: 'Non-deductible' },
  { value: 'billable', label: 'Billable' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'projected', label: 'Projected' },
];

/** Columns the All tab can sort on. */
type ExpenseSortKey = 'date' | 'vendor' | 'category' | 'client' | 'amount';

/** Columns the Recurring tab can sort on. */
type RecurringSortKey = 'vendor' | 'category' | 'recurrence' | 'amount' | 'perYear' | 'nextDue';

const RECURRING_FILTER_OPTIONS: { value: ExpenseRecurrence | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

export default function Expenses() {
  const { toast, showToast } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Expense | undefined>();
  const [deleting, setDeleting] = useState(false);
  const [loggingId, setLoggingId] = useState<number | undefined>();
  const [loggingAll, setLoggingAll] = useState(false);

  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('month');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [tagFilter, setTagFilter] = useState<TagFilter>('');
  const [tab, setTab] = useState<'all' | 'recurring'>('all');
  const [recFreq, setRecFreq] = useState<ExpenseRecurrence | 'all'>('all');

  // Newest first by default — the natural reading order for a ledger.
  const allSort = useTableSort<ExpenseSortKey>('date', 'desc');
  const recurringSort = useTableSort<RecurringSortKey>('nextDue', 'asc');

  const allExpenses = useLiveQuery(() =>
    db.expenses.orderBy('date').reverse().toArray(),
  ) ?? [];
  const allClients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.limit(1).first());

  const clientMap = useMemo(() => new Map(allClients.map((c) => [c.id!, c])), [allClients]);

  const categories = useMemo(() => {
    const cats = settings?.expenseCategories?.length
      ? settings.expenseCategories
      : [...new Set(allExpenses.map((e) => e.category))];
    return cats.sort();
  }, [settings, allExpenses]);

  function matchesTag(e: Expense, tag: TagFilter): boolean {
    switch (tag) {
      case 'deductible':
        return e.deductible;
      case 'nondeductible':
        return !e.deductible;
      case 'billable':
        return e.billable;
      case 'recurring':
        return !!e.recurrence;
      case 'projected':
        return isProjected(e.date);
      default:
        return true;
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allExpenses.filter((e) => {
      const matchesPeriod = isInPeriod(e.date as unknown as Date, period);
      const matchesCategory = !categoryFilter || e.category === categoryFilter;
      const matchesClient =
        !clientFilter ||
        (clientFilter === 'none' ? e.clientId == null : String(e.clientId) === clientFilter);
      const matchesSearch =
        !q ||
        e.vendor.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.notes ?? '').toLowerCase().includes(q);
      return matchesPeriod && matchesCategory && matchesClient && matchesTag(e, tagFilter) && matchesSearch;
    });
  }, [allExpenses, period, categoryFilter, clientFilter, tagFilter, search]);

  // Sorted view of the filtered rows. The summary bar deliberately reads from
  // `filtered`, not this — reordering rows must never change the totals.
  const sortedExpenses = useMemo(
    () =>
      allSort.sortRows(filtered, (e, key) => {
        switch (key) {
          case 'date':
            return coerceDate(e.date as unknown as Date);
          case 'vendor':
            return e.vendor;
          case 'category':
            return e.category;
          case 'client':
            return e.clientId ? clientMap.get(e.clientId)?.company : undefined;
          case 'amount':
            return e.amount;
        }
      }),
    [filtered, allSort, clientMap],
  );

  const summary = useMemo(() => {
    // Totals reflect actuals (up to today); future-dated rows are summed
    // separately as "projected" so they don't inflate the real spend.
    let total = 0;
    let deductible = 0;
    let projected = 0;
    for (const e of filtered) {
      if (isProjected(e.date)) {
        projected += e.amount;
        continue;
      }
      total += e.amount;
      if (e.deductible) deductible += e.amount;
    }
    return { total, deductible, projected };
  }, [filtered]);

  // Recurring anchors with at least one occurrence due (nextDue on/before today).
  const dueAnchors = useMemo(() => allExpenses.filter((e) => dueOccurrences(e) > 0), [allExpenses]);

  // Recurring definitions (anchors) for the Recurring tab, filtered by frequency
  // and sorted by next-due (soonest / already-due first).
  const recurringAnchors = useMemo(() => allExpenses.filter((e) => e.recurrence), [allExpenses]);
  const recurringFiltered = useMemo(
    () => (recFreq === 'all' ? recurringAnchors : recurringAnchors.filter((e) => e.recurrence === recFreq)),
    [recurringAnchors, recFreq],
  );

  // Defaults to next-due ascending, so whatever is closest to due reads first.
  const sortedRecurring = useMemo(
    () =>
      recurringSort.sortRows(recurringFiltered, (e, key) => {
        switch (key) {
          case 'vendor':
            return e.vendor;
          case 'category':
            return e.category;
          case 'recurrence':
            return e.recurrence ? RECURRENCE_LABEL[e.recurrence] : undefined;
          case 'amount':
            return e.amount;
          case 'perYear':
            return e.recurrence ? monthlyEquivalent(e.recurrence, e.amount) * 12 : undefined;
          case 'nextDue':
            return coerceDate(e.nextDue as unknown as Date);
        }
      }),
    [recurringFiltered, recurringSort],
  );
  const recurringSummary = useMemo(() => summarizeRecurring(recurringFiltered), [recurringFiltered]);

  function openCreate() {
    setEditingExpense(undefined);
    setDrawerOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense);
    setDrawerOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await db.expenses.delete(deleteTarget.id);
      showToast('success', 'Expense deleted.');
    } catch {
      showToast('error', 'Delete failed.');
    } finally {
      setDeleting(false);
      setDeleteTarget(undefined);
    }
  }

  async function handleLogDue(anchor: Expense) {
    if (!anchor.id) return;
    setLoggingId(anchor.id);
    try {
      const n = await logDueOccurrences(anchor);
      showToast('success', `Logged ${n} ${anchor.vendor} expense${n === 1 ? '' : 's'}.`);
    } catch {
      showToast('error', 'Failed to log recurring expense.');
    } finally {
      setLoggingId(undefined);
    }
  }

  async function handleLogAll() {
    setLoggingAll(true);
    try {
      let total = 0;
      for (const anchor of dueAnchors) total += await logDueOccurrences(anchor);
      showToast('success', `Logged ${total} recurring expense${total === 1 ? '' : 's'}.`);
    } catch {
      showToast('error', 'Failed to log some recurring expenses.');
    } finally {
      setLoggingAll(false);
    }
  }

  const categoryOptions = [
    { value: '', label: 'All categories' },
    ...categories.map((c) => ({ value: c, label: c })),
  ];

  const clientFilterOptions = [
    { value: '', label: 'All clients' },
    { value: 'none', label: 'No client' },
    ...[...allClients]
      .sort((a, b) => a.company.localeCompare(b.company))
      .map((c) => ({ value: String(c.id), label: c.company })),
  ];

  const hasActiveFilters = !!(search || categoryFilter || clientFilter || tagFilter);

  // Spread into each SortableHeader so the sort state/handler pair stays in one place.
  const headerProps = { sort: allSort.sort, onSort: allSort.toggleSort };
  const recurringHeaderProps = { sort: recurringSort.sort, onSort: recurringSort.toggleSort };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Expenses"
        description={`${allExpenses.length} expense${allExpenses.length !== 1 ? 's' : ''} total`}
        action={
          <Button onClick={openCreate}>
            <Plus size={15} />
            Add Expense
          </Button>
        }
      />

      {/* Recurring expenses due — one-click log (catches up multiple periods) */}
      {dueAnchors.length > 0 && (
        <section className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Repeat size={16} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-100">
                Recurring {dueAnchors.length === 1 ? 'expense' : 'expenses'} due
              </h2>
            </div>
            {dueAnchors.length > 1 && (
              <Button size="sm" variant="secondary" loading={loggingAll} onClick={handleLogAll}>
                Log all
              </Button>
            )}
          </div>
          <ul className="mt-3 space-y-2">
            {dueAnchors.map((e) => {
              const n = dueOccurrences(e);
              return (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {e.vendor} · {formatCurrency(e.amount)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {RECURRENCE_LABEL[e.recurrence!]} · {n} occurrence{n === 1 ? '' : 's'} due since{' '}
                      {formatDate(e.nextDue as unknown as Date)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    loading={loggingId === e.id}
                    disabled={loggingAll}
                    onClick={() => handleLogDue(e)}
                    className="shrink-0"
                  >
                    Log {n}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Tabs
        items={[
          { key: 'all', label: 'All', count: allExpenses.length || undefined },
          { key: 'recurring', label: 'Recurring', count: recurringAnchors.length || undefined },
        ]}
        active={tab}
        onChange={(k) => setTab(k as 'all' | 'recurring')}
      />

      {tab === 'all' && (
      <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses…"
            className="pl-8"
          />
        </div>
        <Select
          options={categoryOptions}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-52"
          aria-label="Filter by category"
        />
        <Select
          options={clientFilterOptions}
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="w-48"
          aria-label="Filter by client"
        />
        <Select
          options={TAG_FILTER_OPTIONS}
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value as TagFilter)}
          className="w-40"
          aria-label="Filter by tag"
        />
        <div className="flex rounded-md border border-slate-700 overflow-hidden">
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

      {/* Summary bar */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-4 rounded-xl border border-slate-700 bg-slate-800 px-5 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-100">
              {formatCurrency(summary.total)}
            </p>
          </div>
          <div className="border-l border-slate-700 pl-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Deductible</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-400">
              {formatCurrency(summary.deductible)}
            </p>
          </div>
          <div className="border-l border-slate-700 pl-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Non-Deductible</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-400">
              {formatCurrency(summary.total - summary.deductible)}
            </p>
          </div>
          {summary.projected > 0 && (
            <div className="border-l border-slate-700 pl-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Projected</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-amber-400">
                {formatCurrency(summary.projected)}
              </p>
            </div>
          )}
          <div className="border-l border-slate-700 pl-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Count</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-300">
              {filtered.length}
            </p>
          </div>
        </div>
      )}

      {/* Expense table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={
            hasActiveFilters
              ? 'No expenses match your filters'
              : period === 'month'
              ? 'No expenses this month'
              : 'No expenses'
          }
          description={
            hasActiveFilters
              ? 'Try adjusting your search or filters.'
              : 'Add your first expense to start tracking spending.'
          }
          action={
            !hasActiveFilters ? (
              <Button onClick={openCreate}>
                <Plus size={15} />
                Add Expense
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
                <SortableHeader label="Vendor" sortKey="vendor" {...headerProps} />
                <SortableHeader label="Category" sortKey="category" {...headerProps} />
                <SortableHeader label="Client" sortKey="client" {...headerProps} />
                <SortableHeader label="Amount" sortKey="amount" defaultDirection="desc" {...headerProps} />
                <SortableHeader label="Tags" {...headerProps} />
                <SortableHeader label="" {...headerProps} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900">
              {sortedExpenses.map((expense) => (
                <tr key={expense.id} className="group">
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-400 whitespace-nowrap">
                    {formatDate(expense.date as unknown as Date)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-200">{expense.vendor}</p>
                    {expense.notes && (
                      <p className="text-xs text-slate-500 truncate max-w-[200px]">{expense.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{expense.category}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {expense.clientId ? (clientMap.get(expense.clientId)?.company ?? '—') : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums font-medium text-slate-200 whitespace-nowrap">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {isProjected(expense.date) && <Badge variant="warning">Projected</Badge>}
                      {expense.recurrence && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/60 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                          <Repeat size={10} /> {RECURRENCE_LABEL[expense.recurrence]}
                        </span>
                      )}
                      {expense.deductible && (
                        <Badge variant="success">Deductible</Badge>
                      )}
                      {expense.billable && (
                        <Badge variant="info">Billable</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(expense)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                        aria-label="Edit expense"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(expense)}
                        className="rounded p-1.5 text-red-500 hover:bg-red-950 hover:text-red-300 transition-colors"
                        aria-label="Delete expense"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
      )}

      {tab === 'recurring' && (
        <div className="space-y-6">
          {/* Frequency filter */}
          <div className="flex w-max overflow-hidden rounded-md border border-slate-700">
            {RECURRING_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRecFreq(opt.value)}
                className={[
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  recFreq === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Run-rate summary */}
          {recurringFiltered.length > 0 && (
            <div className="flex flex-wrap gap-4 rounded-xl border border-slate-700 bg-slate-800 px-5 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly run-rate</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-100">
                  {formatCurrency(recurringSummary.monthly)}
                  <span className="text-xs font-normal text-slate-500">/mo</span>
                </p>
              </div>
              <div className="border-l border-slate-700 pl-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Annual</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-orange-400">
                  {formatCurrency(recurringSummary.annual)}
                </p>
              </div>
              <div className="border-l border-slate-700 pl-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Count</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-300">{recurringFiltered.length}</p>
              </div>
            </div>
          )}

          {/* Recurring table */}
          {recurringFiltered.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title={recFreq === 'all' ? 'No recurring expenses yet' : `No ${RECURRENCE_LABEL[recFreq]} recurring expenses`}
              description="Set an expense to repeat (Monthly / Quarterly / Annual) in its form to track it here."
              action={
                <Button onClick={openCreate}>
                  <Plus size={15} />
                  Add Expense
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-700">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800">
                    <SortableHeader label="Vendor" sortKey="vendor" {...recurringHeaderProps} />
                    <SortableHeader label="Category" sortKey="category" {...recurringHeaderProps} />
                    <SortableHeader label="Repeats" sortKey="recurrence" {...recurringHeaderProps} />
                    <SortableHeader label="Amount" sortKey="amount" defaultDirection="desc" {...recurringHeaderProps} />
                    <SortableHeader label="Per Year" sortKey="perYear" defaultDirection="desc" {...recurringHeaderProps} />
                    <SortableHeader label="Next Due" sortKey="nextDue" {...recurringHeaderProps} />
                    <SortableHeader label="" {...recurringHeaderProps} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900">
                  {sortedRecurring.map((e) => {
                    const due = dueOccurrences(e) > 0;
                    const perYear = e.recurrence ? monthlyEquivalent(e.recurrence, e.amount) * 12 : 0;
                    return (
                      <tr key={e.id}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-200">{e.vendor}</p>
                          {e.notes && <p className="max-w-[200px] truncate text-xs text-slate-500">{e.notes}</p>}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">{e.category}</td>
                        <td className="px-4 py-3">
                          <Badge variant="neutral">{e.recurrence ? RECURRENCE_LABEL[e.recurrence] : '—'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium tabular-nums text-slate-200 whitespace-nowrap">
                          {formatCurrency(e.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums text-slate-400 whitespace-nowrap">
                          {formatCurrency(perYear)}
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums whitespace-nowrap">
                          <span className={due ? 'font-semibold text-amber-400' : 'text-slate-400'}>
                            {formatDate(e.nextDue as unknown as Date)}
                            {due ? ' · due' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {due && (
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={loggingId === e.id}
                                onClick={() => handleLogDue(e)}
                              >
                                Log
                              </Button>
                            )}
                            <button
                              onClick={() => openEdit(e)}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                              aria-label="Edit expense"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(e)}
                              className="rounded p-1.5 text-red-500 hover:bg-red-950 hover:text-red-300 transition-colors"
                              aria-label="Delete expense"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ExpenseForm
        expense={editingExpense}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={(msg) => showToast('success', msg)}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={handleDelete}
        title="Delete Expense"
        message={`Delete "${deleteTarget?.vendor}" (${formatCurrency(deleteTarget?.amount ?? 0)})? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      <Toast toast={toast} />
    </div>
  );
}
