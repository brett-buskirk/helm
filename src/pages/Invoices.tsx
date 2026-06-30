import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, FileText, Search } from 'lucide-react';
import { db } from '../db';
import type { InvoiceStatus } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Table, type TableColumn } from '../components/ui/Table';
import { EmptyState } from '../components/ui/EmptyState';
import { Toast } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { formatDate, formatCurrency } from '../utils/format';
import { getEffectiveStatus } from '../utils/invoice';

type EffectiveStatus = InvoiceStatus | 'overdue';

const STATUS_BADGE: Record<EffectiveStatus, { variant: 'neutral' | 'info' | 'danger' | 'success'; label: string }> = {
  draft: { variant: 'neutral', label: 'Draft' },
  sent: { variant: 'info', label: 'Sent' },
  overdue: { variant: 'danger', label: 'Overdue' },
  paid: { variant: 'success', label: 'Paid' },
  cancelled: { variant: 'neutral', label: 'Cancelled' },
};

const FILTER_OPTIONS: { value: EffectiveStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
];

export default function Invoices() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EffectiveStatus | 'all'>('all');

  const allInvoices = useLiveQuery(() => db.invoices.orderBy('issueDate').reverse().toArray()) ?? [];
  const allClients = useLiveQuery(() => db.clients.toArray()) ?? [];

  const clientMap = useMemo(() => new Map(allClients.map((c) => [c.id!, c])), [allClients]);

  const enriched = useMemo(
    () =>
      allInvoices.map((inv) => ({
        ...inv,
        effectiveStatus: getEffectiveStatus(inv),
        clientName: clientMap.get(inv.clientId)?.company ?? '—',
      })),
    [allInvoices, clientMap],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return enriched.filter((inv) => {
      const matchesSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || inv.effectiveStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [enriched, search, statusFilter]);

  const columns: TableColumn<(typeof filtered)[0]>[] = [
    {
      key: 'number',
      header: 'Invoice #',
      render: (inv) => (
        <span className="font-mono font-medium text-slate-100">{inv.invoiceNumber}</span>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (inv) => (
        <Link
          to={`/clients/${inv.clientId}`}
          onClick={(e) => e.stopPropagation()}
          className="text-indigo-400 hover:underline"
        >
          {inv.clientName}
        </Link>
      ),
    },
    {
      key: 'issued',
      header: 'Issued',
      render: (inv) => (
        <span className="tabular-nums text-slate-400">
          {formatDate(inv.issueDate as unknown as Date)}
        </span>
      ),
    },
    {
      key: 'due',
      header: 'Due',
      render: (inv) => (
        <span
          className={[
            'tabular-nums',
            inv.effectiveStatus === 'overdue' ? 'font-semibold text-red-400' : 'text-slate-400',
          ].join(' ')}
        >
          {formatDate(inv.dueDate as unknown as Date)}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (inv) => (
        <span className="tabular-nums font-medium text-slate-200">{formatCurrency(inv.total)}</span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      render: (inv) =>
        inv.balanceDue > 0 ? (
          <span className="tabular-nums text-slate-400">{formatCurrency(inv.balanceDue)}</span>
        ) : (
          <span className="text-emerald-500 text-xs font-medium">Paid</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (inv) => {
        const { variant, label } = STATUS_BADGE[inv.effectiveStatus];
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Invoices"
        description={`${allInvoices.length} invoice${allInvoices.length !== 1 ? 's' : ''} total`}
        action={
          <Button onClick={() => navigate('/invoices/new')}>
            <Plus size={15} />
            New Invoice
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoices…"
            className="pl-8"
          />
        </div>
        <div className="flex rounded-md border border-slate-700 overflow-hidden">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={[
                'px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Table
        columns={columns}
        data={filtered}
        getKey={(inv) => inv.id!}
        onRowClick={(inv) => navigate(`/invoices/${inv.id}`)}
        emptyState={
          <EmptyState
            icon={FileText}
            title={search || statusFilter !== 'all' ? 'No invoices match your filters' : 'No invoices yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Create your first invoice to get started.'
            }
            action={
              !search && statusFilter === 'all' ? (
                <Button onClick={() => navigate('/invoices/new')}>
                  <Plus size={15} />
                  New Invoice
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Toast toast={toast} />
    </div>
  );
}
