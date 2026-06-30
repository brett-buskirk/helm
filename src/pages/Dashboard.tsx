import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Plus, FileText, TrendingUp, TrendingDown, DollarSign, AlertCircle, RefreshCw, FilePlus } from 'lucide-react';
import { db } from '../db';
import type { Project } from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Toast } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { formatCurrency, formatProjectRate, formatDate } from '../utils/format';
import { getEffectiveStatus } from '../utils/invoice';
import { createRetainerInvoice, findRetainerInvoiceForMonth, retainerPeriodLabel } from '../utils/retainer';
import {
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  coerceDate,
  isInPeriod,
  monthLabel,
  lastNMonths,
} from '../utils/date';

const TAX_SETASIDE_RATE = 0.25;

function MetricCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'green' | 'red' | 'indigo' | 'amber';
  icon: React.ElementType;
  children?: React.ReactNode;
}) {
  const valueColor = {
    green: 'text-emerald-400',
    red: 'text-red-400',
    indigo: 'text-indigo-400',
    amber: 'text-amber-400',
    undefined: 'text-slate-100',
  }[accent ?? 'undefined'];

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <Icon size={16} className="text-slate-600" />
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      {children}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  // Retainer invoice generation
  const [generatingId, setGeneratingId] = useState<number | undefined>();
  const [dupConfirm, setDupConfirm] = useState<Project | undefined>();

  const allPayments = useLiveQuery(() => db.payments.orderBy('date').toArray()) ?? [];
  const allExpenses = useLiveQuery(() => db.expenses.orderBy('date').toArray()) ?? [];
  const allInvoices = useLiveQuery(() => db.invoices.toArray()) ?? [];
  const allClients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const allProjects = useLiveQuery(() => db.projects.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.limit(1).first());

  const ownerFirstName = settings?.ownerName?.split(' ')[0] ?? 'you';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const now = new Date();

  // ── Period ranges ─────────────────────────────────────────────────────────
  const mStart = startOfMonth(now);
  const mEnd = endOfMonth(now);
  const qStart = startOfQuarter(now);
  const qEnd = endOfQuarter(now);
  const yStart = startOfYear(now.getFullYear());

  // ── Income by period ──────────────────────────────────────────────────────
  const { incomeMTD, incomeQTD, incomeYTD } = useMemo(() => {
    let mtd = 0, qtd = 0, ytd = 0;
    for (const p of allPayments) {
      const d = coerceDate(p.date as unknown as Date);
      if (!d) continue;
      if (d >= yStart) ytd += p.amount;
      if (d >= qStart && d <= qEnd) qtd += p.amount;
      if (d >= mStart && d <= mEnd) mtd += p.amount;
    }
    return { incomeMTD: mtd, incomeQTD: qtd, incomeYTD: ytd };
  }, [allPayments, mStart.getTime(), mEnd.getTime(), qStart.getTime(), qEnd.getTime(), yStart.getTime()]);

  // ── Expenses MTD & YTD ────────────────────────────────────────────────────
  const { expensesMTD, expensesYTD } = useMemo(() => {
    let mtd = 0, ytd = 0;
    for (const e of allExpenses) {
      const d = coerceDate(e.date as unknown as Date);
      if (!d) continue;
      if (isInPeriod(d, 'month')) mtd += e.amount;
      if (d >= yStart) ytd += e.amount;
    }
    return { expensesMTD: mtd, expensesYTD: ytd };
  }, [allExpenses, yStart.getTime()]);

  const profitMTD = incomeMTD - expensesMTD;
  const taxSetAsideYTD = incomeYTD * TAX_SETASIDE_RATE;

  // ── Invoice status ────────────────────────────────────────────────────────
  const { outstanding, overdue } = useMemo(() => {
    let outstandingAmount = 0, outstandingCount = 0;
    let overdueAmount = 0, overdueCount = 0;
    for (const inv of allInvoices) {
      const eff = getEffectiveStatus(inv);
      if (eff === 'sent') { outstandingAmount += inv.balanceDue; outstandingCount++; }
      else if (eff === 'overdue') { overdueAmount += inv.balanceDue; overdueCount++; }
    }
    return {
      outstanding: { amount: outstandingAmount, count: outstandingCount },
      overdue: { amount: overdueAmount, count: overdueCount },
    };
  }, [allInvoices]);

  // ── Active retainers ──────────────────────────────────────────────────────
  const clientMap = useMemo(() => new Map(allClients.map((c) => [c.id!, c])), [allClients]);

  const activeRetainers = useMemo(
    () => allProjects.filter((p) => p.type === 'retainer' && p.status === 'active'),
    [allProjects],
  );

  const totalRetainerMRR = useMemo(
    () => activeRetainers.reduce((s, p) => s + (p.rate ?? 0), 0),
    [activeRetainers],
  );

  async function generate(project: Project) {
    if (!project.id) return;
    setGeneratingId(project.id);
    try {
      const invoiceId = await createRetainerInvoice(project);
      showToast('success', `Draft invoice created for ${project.name} — ${retainerPeriodLabel(new Date())}.`);
      navigate(`/invoices/${invoiceId}`);
    } catch {
      showToast('error', 'Could not generate the retainer invoice.');
    } finally {
      setGeneratingId(undefined);
      setDupConfirm(undefined);
    }
  }

  async function handleGenerateClick(project: Project) {
    if (!project.id) return;
    setGeneratingId(project.id);
    const existing = await findRetainerInvoiceForMonth(project.id, new Date());
    setGeneratingId(undefined);
    if (existing) {
      setDupConfirm(project);
    } else {
      await generate(project);
    }
  }

  // ── 6-month trend chart ───────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return lastNMonths(6, now).map((monthDate) => {
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      const income = allPayments.reduce((s, p) => {
        const d = coerceDate(p.date as unknown as Date);
        return d && d >= start && d <= end ? s + p.amount : s;
      }, 0);
      const expenses = allExpenses.reduce((s, e) => {
        const d = coerceDate(e.date as unknown as Date);
        return d && d >= start && d <= end ? s + e.amount : s;
      }, 0);
      return { month: monthLabel(monthDate), income, expenses };
    });
  }, [allPayments, allExpenses]);

  // ── Recent payments ───────────────────────────────────────────────────────
  const recentPayments = useMemo(() => [...allPayments].reverse().slice(0, 5), [allPayments]);

  const activeClients = allClients.filter((c) => c.status === 'active').length;

  return (
    <div className="p-6 space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">
          {greeting}, {ownerFirstName}.
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Income — MTD"
          value={formatCurrency(incomeMTD)}
          icon={TrendingUp}
          accent={incomeMTD > 0 ? 'green' : undefined}
        >
          <div className="mt-2 space-y-0.5">
            <div className="flex justify-between text-xs text-slate-600">
              <span>QTD</span>
              <span className="tabular-nums text-slate-500">{formatCurrency(incomeQTD)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>YTD</span>
              <span className="tabular-nums text-slate-500">{formatCurrency(incomeYTD)}</span>
            </div>
          </div>
        </MetricCard>

        <MetricCard
          label="Expenses — MTD"
          value={formatCurrency(expensesMTD)}
          icon={TrendingDown}
          accent={expensesMTD > 0 ? 'red' : undefined}
        >
          <div className="mt-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>YTD</span>
              <span className="tabular-nums text-slate-500">{formatCurrency(expensesYTD)}</span>
            </div>
          </div>
        </MetricCard>

        <MetricCard
          label="Profit — MTD"
          value={formatCurrency(profitMTD)}
          sub="Income minus expenses"
          icon={DollarSign}
          accent={profitMTD >= 0 ? 'green' : 'red'}
        />

        <MetricCard
          label="Tax Set-Aside — YTD"
          value={formatCurrency(taxSetAsideYTD)}
          sub={`25% of ${formatCurrency(incomeYTD)} YTD income`}
          icon={FileText}
          accent="amber"
        />
      </div>

      {/* Invoice status + retainer MRR + quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-blue-400">
            {formatCurrency(outstanding.amount)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {outstanding.count} invoice{outstanding.count !== 1 ? 's' : ''} sent
          </p>
        </div>

        <div className="rounded-xl border border-red-900 bg-slate-800 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overdue</p>
            {overdue.count > 0 && <AlertCircle size={14} className="text-red-400" />}
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-red-400">
            {formatCurrency(overdue.amount)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {overdue.count} invoice{overdue.count !== 1 ? 's' : ''} past due
          </p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Retainer MRR</p>
            <RefreshCw size={14} className="text-slate-600" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-indigo-400">
            {formatCurrency(totalRetainerMRR)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {activeRetainers.length} active retainer{activeRetainers.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-slate-700 bg-slate-800 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Quick Actions</p>
            <p className="mt-1 text-xs text-slate-500">{activeClients} active client{activeClients !== 1 ? 's' : ''}</p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Button size="sm" onClick={() => navigate('/invoices/new')}>
              <Plus size={13} />
              New Invoice
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/expenses')}>
              <Plus size={13} />
              Add Expense
            </Button>
          </div>
        </div>
      </div>

      {/* Active retainers table */}
      {activeRetainers.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Active Retainers
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-700">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800">
                  {['Client', 'Project', 'Monthly Fee', 'Started', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900">
                {activeRetainers.map((p) => (
                  <tr
                    key={p.id}
                    className="group cursor-pointer hover:bg-slate-800 transition-colors"
                    onClick={() => navigate(`/clients/${p.clientId}`)}
                  >
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {clientMap.get(p.clientId)?.company ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-100">{p.name}</td>
                    <td className="px-4 py-3 text-sm tabular-nums font-medium text-indigo-400">
                      {formatProjectRate(p.rate, 'retainer')}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-slate-500">
                      {p.startDate ? formatDate(p.startDate as unknown as Date) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="success">Active</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={generatingId === p.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateClick(p);
                        }}
                      >
                        <FilePlus size={13} />
                        Generate Invoice
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6-month chart */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Income vs Expenses — Last 6 Months
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={4} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              width={48}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name.charAt(0).toUpperCase() + name.slice(1),
              ]}
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                color: '#e2e8f0',
                fontSize: 12,
              }}
              cursor={{ fill: 'rgba(99,102,241,0.08)' }}
            />
            <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar dataKey="income" fill="#6366f1" radius={[3, 3, 0, 0]} name="income" />
            <Bar dataKey="expenses" fill="#f43f5e" radius={[3, 3, 0, 0]} name="expenses" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent payments */}
      {recentPayments.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Recent Payments
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-700">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800">
                  {['Date', 'Client', 'Method', 'Amount'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900">
                {recentPayments.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer hover:bg-slate-800 transition-colors"
                    onClick={() => navigate(`/invoices/${p.invoiceId}`)}
                  >
                    <td className="px-4 py-3 text-sm tabular-nums text-slate-400">
                      {formatDate(p.date as unknown as Date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-200">
                      {clientMap.get(p.clientId)?.company ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{p.method ?? '—'}</td>
                    <td className="px-4 py-3 text-sm tabular-nums font-medium text-emerald-400">
                      {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {allPayments.length === 0 && allExpenses.length === 0 && allInvoices.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <p className="text-sm font-medium text-slate-400">Your command center is ready.</p>
          <p className="mt-1 text-xs text-slate-600">
            Add clients, create invoices, and log expenses — metrics will appear here.
          </p>
        </div>
      )}

      {/* Duplicate-month confirmation */}
      <ConfirmModal
        isOpen={!!dupConfirm}
        onClose={() => setDupConfirm(undefined)}
        onConfirm={() => dupConfirm && generate(dupConfirm)}
        title="Invoice already exists this month"
        message={`A retainer invoice for "${dupConfirm?.name}" has already been issued in ${retainerPeriodLabel(new Date())}. Generate another anyway?`}
        confirmLabel="Generate Anyway"
        variant="primary"
        loading={generatingId === dupConfirm?.id}
      />

      <Toast toast={toast} />
    </div>
  );
}
