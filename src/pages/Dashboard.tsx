import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  RefreshCw,
  FilePlus,
  Clock,
  Landmark,
  Users,
} from 'lucide-react';
import { db } from '../db';
import type { Project } from '../types';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Toast } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { formatCurrency, formatProjectRate, formatDate } from '../utils/format';
import { getEffectiveStatus } from '../utils/invoice';
import { createRetainerInvoice, findRetainerInvoiceForMonth, retainerPeriodLabel } from '../utils/retainer';
import { topClientsByRevenue, unbilledValue } from '../utils/dashboard';
import { GettingStarted } from '../components/onboarding/GettingStarted';
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

function KpiCard({
  label,
  value,
  accent,
  icon: Icon,
  badge,
  children,
}: {
  label: string;
  value: string;
  accent?: 'green' | 'red' | 'indigo' | 'amber';
  icon: React.ElementType;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const valueColor = {
    green: 'text-emerald-400',
    red: 'text-red-400',
    indigo: 'text-indigo-400',
    amber: 'text-amber-400',
    undefined: 'text-slate-100',
  }[accent ?? 'undefined'];
  const ring = {
    green: 'bg-emerald-500/10 text-emerald-400',
    red: 'bg-red-500/10 text-red-400',
    indigo: 'bg-indigo-500/10 text-indigo-400',
    amber: 'bg-amber-500/10 text-amber-400',
    undefined: 'bg-slate-700/60 text-slate-400',
  }[accent ?? 'undefined'];

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${ring}`}>
          <Icon size={15} />
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
        {badge}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const [generatingId, setGeneratingId] = useState<number | undefined>();
  const [dupConfirm, setDupConfirm] = useState<Project | undefined>();

  const allPayments = useLiveQuery(() => db.payments.orderBy('date').toArray()) ?? [];
  const allExpenses = useLiveQuery(() => db.expenses.orderBy('date').toArray()) ?? [];
  const allInvoices = useLiveQuery(() => db.invoices.toArray()) ?? [];
  const allClients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const allProjects = useLiveQuery(() => db.projects.toArray()) ?? [];
  const allTimeEntries = useLiveQuery(() => db.timeEntries.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.limit(1).first());

  const ownerFirstName = settings?.ownerName?.split(' ')[0] ?? 'you';
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const mStart = startOfMonth(now);
  const mEnd = endOfMonth(now);
  const qStart = startOfQuarter(now);
  const qEnd = endOfQuarter(now);
  const yStart = startOfYear(now.getFullYear());

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

  const profitYTD = incomeYTD - expensesYTD;
  const profitMargin = incomeYTD > 0 ? Math.round((profitYTD / incomeYTD) * 100) : 0;
  const taxOwedYTD = incomeYTD * TAX_SETASIDE_RATE;

  const { outstanding, overdue } = useMemo(() => {
    let oa = 0, oc = 0, va = 0, vc = 0;
    for (const inv of allInvoices) {
      const eff = getEffectiveStatus(inv);
      if (eff === 'sent') { oa += inv.balanceDue; oc++; }
      else if (eff === 'overdue') { va += inv.balanceDue; vc++; }
    }
    return { outstanding: { amount: oa, count: oc }, overdue: { amount: va, count: vc } };
  }, [allInvoices]);

  const clientMap = useMemo(() => new Map(allClients.map((c) => [c.id!, c])), [allClients]);
  const activeRetainers = useMemo(
    () => allProjects.filter((p) => p.type === 'retainer' && p.status === 'active'),
    [allProjects],
  );
  const totalRetainerMRR = useMemo(
    () => activeRetainers.reduce((s, p) => s + (p.rate ?? 0), 0),
    [activeRetainers],
  );

  const unbilled = useMemo(
    () => unbilledValue(allTimeEntries, allProjects, allClients),
    [allTimeEntries, allProjects, allClients],
  );
  const topClients = useMemo(
    () => topClientsByRevenue(allPayments, allClients, yStart),
    [allPayments, allClients, yStart.getTime()],
  );
  const topClientMax = topClients[0]?.total ?? 0;

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
      return { month: monthLabel(monthDate), income, expenses, net: income - expenses };
    });
  }, [allPayments, allExpenses]);

  const recentPayments = useMemo(() => [...allPayments].reverse().slice(0, 6), [allPayments]);

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
    if (existing) setDupConfirm(project);
    else await generate(project);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            {greeting}, {ownerFirstName}.
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {incomeYTD > 0 && (
              <>
                {' · '}
                <span className="text-slate-400">
                  {formatCurrency(incomeYTD)} earned in {now.getFullYear()}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigate('/invoices/new')}>
            <Plus size={14} /> New Invoice
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/time')}>
            <Clock size={14} /> Log Time
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/expenses')}>
            <Plus size={14} /> Expense
          </Button>
        </div>
      </div>

      {/* First-run guide — self-hides once set up or dismissed */}
      <GettingStarted />

      {/* KPI row — year to date */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Income — YTD" value={formatCurrency(incomeYTD)} icon={TrendingUp} accent={incomeYTD > 0 ? 'green' : undefined}>
          <div className="mt-2 flex justify-between text-xs text-slate-600">
            <span>MTD {formatCurrency(incomeMTD)}</span>
            <span>QTD {formatCurrency(incomeQTD)}</span>
          </div>
        </KpiCard>

        <KpiCard
          label="Profit — YTD"
          value={formatCurrency(profitYTD)}
          icon={DollarSign}
          accent={profitYTD >= 0 ? 'green' : 'red'}
          badge={
            incomeYTD > 0 ? (
              <span className="rounded bg-slate-700/70 px-1.5 py-0.5 text-xs font-medium text-slate-300">
                {profitMargin}% margin
              </span>
            ) : undefined
          }
        >
          <p className="mt-2 text-xs text-slate-600">Income minus expenses</p>
        </KpiCard>

        <KpiCard label="Expenses — YTD" value={formatCurrency(expensesYTD)} icon={TrendingDown} accent={expensesYTD > 0 ? 'red' : undefined}>
          <div className="mt-2 text-xs text-slate-600">MTD {formatCurrency(expensesMTD)}</div>
        </KpiCard>

        <KpiCard label="Tax Set-Aside — YTD" value={formatCurrency(taxOwedYTD)} icon={Landmark} accent="amber">
          <p className="mt-2 text-xs text-slate-600">25% reserve on income</p>
        </KpiCard>
      </div>

      {/* Money to collect */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => navigate('/invoices')}
          className="rounded-xl border border-slate-700 bg-slate-800 p-5 text-left transition-colors hover:border-slate-600"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-blue-400">{formatCurrency(outstanding.amount)}</p>
          <p className="mt-1 text-xs text-slate-500">{outstanding.count} invoice{outstanding.count !== 1 ? 's' : ''} sent</p>
        </button>

        <button
          onClick={() => navigate('/invoices')}
          className="rounded-xl border border-red-900/70 bg-slate-800 p-5 text-left transition-colors hover:border-red-800"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overdue</p>
            {overdue.count > 0 && <AlertCircle size={14} className="text-red-400" />}
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-red-400">{formatCurrency(overdue.amount)}</p>
          <p className="mt-1 text-xs text-slate-500">{overdue.count} invoice{overdue.count !== 1 ? 's' : ''} past due</p>
        </button>

        <button
          onClick={() => navigate('/time')}
          className="rounded-xl border border-slate-700 bg-slate-800 p-5 text-left transition-colors hover:border-slate-600"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Unbilled Time</p>
            <Clock size={14} className="text-slate-600" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-amber-400">{formatCurrency(unbilled.amount)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {unbilled.hours} hr{unbilled.hours === 1 ? '' : 's'} ready to invoice
          </p>
        </button>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Retainer MRR</p>
            <RefreshCw size={14} className="text-slate-600" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-indigo-400">{formatCurrency(totalRetainerMRR)}</p>
          <p className="mt-1 text-xs text-slate-500">{activeRetainers.length} active retainer{activeRetainers.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Cash flow chart */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Cash Flow — Last 6 Months
        </h2>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} barGap={4} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              width={48}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatCurrency(value), name[0].toUpperCase() + name.slice(1)]}
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
              cursor={{ fill: 'rgba(99,102,241,0.08)' }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar dataKey="income" fill="#6366f1" radius={[3, 3, 0, 0]} name="income" />
            <Bar dataKey="expenses" fill="#f43f5e" radius={[3, 3, 0, 0]} name="expenses" />
            <Line type="monotone" dataKey="net" stroke="#34d399" strokeWidth={2} dot={{ r: 3, fill: '#34d399' }} name="net" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Top clients + recent payments */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top clients */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <Users size={14} /> Top Clients — {now.getFullYear()}
          </h2>
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            {topClients.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-600">No payments recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {topClients.map((c) => (
                  <button
                    key={c.clientId}
                    onClick={() => navigate(`/clients/${c.clientId}`)}
                    className="block w-full text-left"
                  >
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="truncate text-sm font-medium text-slate-200">{c.company}</span>
                      <span className="ml-2 shrink-0 text-sm tabular-nums text-slate-400">{formatCurrency(c.total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
                        style={{ width: `${topClientMax > 0 ? (c.total / topClientMax) * 100 : 0}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent payments */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Recent Payments</h2>
          <div className="overflow-hidden rounded-xl border border-slate-700">
            {recentPayments.length === 0 ? (
              <div className="bg-slate-800 py-6 text-center text-sm text-slate-600">No payments yet.</div>
            ) : (
              <table className="w-full">
                <tbody className="divide-y divide-slate-800 bg-slate-900">
                  {recentPayments.map((p) => (
                    <tr
                      key={p.id}
                      className="cursor-pointer hover:bg-slate-800 transition-colors"
                      onClick={() => navigate(`/invoices/${p.invoiceId}`)}
                    >
                      <td className="px-4 py-3 text-sm tabular-nums text-slate-500 whitespace-nowrap">
                        {formatDate(p.date as unknown as Date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-200">{clientMap.get(p.clientId)?.company ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums font-medium text-emerald-400">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Active retainers */}
      {activeRetainers.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Active Retainers</h2>
          <div className="overflow-hidden rounded-xl border border-slate-700">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800">
                  {['Client', 'Project', 'Monthly Fee', 'Started', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
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
                    <td className="px-4 py-3 text-sm text-slate-300">{clientMap.get(p.clientId)?.company ?? '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-100">{p.name}</td>
                    <td className="px-4 py-3 text-sm tabular-nums font-medium text-indigo-400">{formatProjectRate(p.rate, 'retainer')}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-slate-500">
                      {p.startDate ? formatDate(p.startDate as unknown as Date) : '—'}
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
                        <FilePlus size={13} /> Generate Invoice
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
