'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Download,
} from 'lucide-react';

// Mock data
const balance = {
  total: 1240,
  current: 450,
  overdue: 790,
};

const invoices = [
  { id: '1', month: 'Aprilie 2026', amount: 450, status: 'UNPAID', dueDate: '15 Mai 2026' },
  { id: '2', month: 'Martie 2026', amount: 420, status: 'UNPAID', dueDate: '15 Apr 2026' },
  { id: '3', month: 'Februarie 2026', amount: 370, status: 'OVERDUE', dueDate: '15 Mar 2026' },
  { id: '4', month: 'Ianuarie 2026', amount: 380, status: 'PAID', dueDate: '15 Feb 2026', paidDate: '12 Feb 2026' },
  { id: '5', month: 'Decembrie 2025', amount: 395, status: 'PAID', dueDate: '15 Ian 2026', paidDate: '10 Ian 2026' },
];

type TabType = 'all' | 'unpaid' | 'paid';

export default function ResidentPaymentsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const filteredInvoices = invoices.filter((invoice) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unpaid') return invoice.status === 'UNPAID' || invoice.status === 'OVERDUE';
    if (activeTab === 'paid') return invoice.status === 'PAID';
    return true;
  });

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-premium">
        <p className="inline-flex rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
          Plati
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          Facturi si plati
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vizualizeaza facturile si efectueaza plati.
        </p>
      </section>

      {/* Balance Summary */}
      <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-premium">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Sold de achitat</p>
            <p className={`mt-1 text-3xl font-bold ${balance.total > 0 ? 'text-destructive' : 'text-success'}`}>
              {balance.total.toLocaleString('ro-RO')} MDL
            </p>
            {balance.overdue > 0 && (
              <p className="mt-1 text-xs text-destructive">
                Din care intarziat: {balance.overdue.toLocaleString('ro-RO')} MDL
              </p>
            )}
          </div>
          <Link
            href="/resident/payments/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90"
          >
            <CreditCard className="h-4 w-4" />
            Achita acum
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex rounded-xl border border-border bg-card p-1">
        {[
          { id: 'all' as const, label: 'Toate' },
          { id: 'unpaid' as const, label: 'Neachitate' },
          { id: 'paid' as const, label: 'Achitate' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      <section className="space-y-3">
        {filteredInvoices.map((invoice) => (
          <InvoiceCard key={invoice.id} invoice={invoice} />
        ))}
        {filteredInvoices.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-foreground">Nicio factura gasita</p>
            <p className="mt-1 text-sm text-muted-foreground">Nu exista facturi in aceasta categorie.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function InvoiceCard({ invoice }: { invoice: (typeof invoices)[0] }) {
  const statusConfig: Record<string, { icon: React.ElementType; label: string; style: string }> = {
    PAID: { icon: CheckCircle2, label: 'Achitat', style: 'bg-success/10 text-success' },
    UNPAID: { icon: Clock, label: 'Neachitat', style: 'bg-warning/10 text-warning' },
    OVERDUE: { icon: AlertCircle, label: 'Intarziat', style: 'bg-destructive/10 text-destructive' },
  };

  const config = statusConfig[invoice.status];
  const StatusIcon = config.icon;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-premium">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-semibold text-foreground">{invoice.month}</p>
          <p className="mt-0.5 text-xl font-bold text-foreground">{invoice.amount} MDL</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Scadent: {invoice.dueDate}
            {invoice.paidDate && ` | Achitat: ${invoice.paidDate}`}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${config.style}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {config.label}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {invoice.status !== 'PAID' && (
          <Link
            href={`/resident/payments/new?invoice=${invoice.id}`}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90"
          >
            Achita acum
          </Link>
        )}
        <button className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted">
          <Download className="h-4 w-4" />
          Descarca
        </button>
      </div>
    </div>
  );
}
