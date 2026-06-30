import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Receipt, Search, Pencil, Trash2 } from 'lucide-react';
import { db } from '../db';
import type { Expense } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Toast } from '../components/ui/Toast';
import { ExpenseForm } from '../components/expenses/ExpenseForm';
import { useToast } from '../hooks/useToast';
import { formatDate, formatCurrency } from '../utils/format';
import { isInPeriod, type Period } from '../utils/date';

const PERIOD_OPTIONS = [
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

export default function Expenses() {
  const { toast, showToast } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Expense | undefined>();
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('month');
  const [categoryFilter, setCategoryFilter] = useState('');

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allExpenses.filter((e) => {
      const matchesPeriod = isInPeriod(e.date as unknown as Date, period);
      const matchesCategory = !categoryFilter || e.category === categoryFilter;
      const matchesSearch =
        !q ||
        e.vendor.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.notes ?? '').toLowerCase().includes(q);
      return matchesPeriod && matchesCategory && matchesSearch;
    });
  }, [allExpenses, period, categoryFilter, search]);

  const summary = useMemo(() => {
    const total = filtered.reduce((s, e) => s + e.amount, 0);
    const deductible = filtered.filter((e) => e.deductible).reduce((s, e) => s + e.amount, 0);
    return { total, deductible };
  }, [filtered]);

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

  const categoryOptions = [
    { value: '', label: 'All categories' },
    ...categories.map((c) => ({ value: c, label: c })),
  ];

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
          title={search || categoryFilter ? 'No expenses match your filters' : period === 'month' ? 'No expenses this month' : 'No expenses'}
          description={
            search || categoryFilter
              ? 'Try adjusting your search or filters.'
              : 'Add your first expense to start tracking spending.'
          }
          action={
            !search && !categoryFilter ? (
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
                {['Date', 'Vendor', 'Category', 'Client', 'Amount', 'Tags', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900">
              {filtered.map((expense) => (
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
