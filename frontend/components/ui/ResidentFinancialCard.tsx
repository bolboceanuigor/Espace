'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3, FileText, WalletCards } from 'lucide-react';
import Badge from './Badge';

type ResidentFinancialCardProps = {
  balance: string;
  statusLabel: string;
  statusVariant?: 'success' | 'warning' | 'error' | 'neutral';
  unpaidInvoices: number | string;
  nextDueDate?: string;
  lastInvoice?: string;
  href?: string;
};

export default function ResidentFinancialCard({
  balance,
  statusLabel,
  statusVariant = 'neutral',
  unpaidInvoices,
  nextDueDate = '-',
  lastInvoice = '-',
  href = '/resident/invoices',
}: ResidentFinancialCardProps) {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="bg-slate-950 p-5 text-white md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-white/65">Sold curent</p>
              <Badge variant={statusVariant}>{statusLabel}</Badge>
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{balance}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              Situația este calculată din facturile interne și plățile înregistrate de administrator.
            </p>
          </div>
          <Link href={href} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100">
            Vezi facturi
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3">
        <Metric icon={<FileText className="h-4 w-4" />} label="Facturi neachitate" value={String(unpaidInvoices)} />
        <Metric icon={<Clock3 className="h-4 w-4" />} label="Scadență apropiată" value={nextDueDate} />
        <Metric icon={<WalletCards className="h-4 w-4" />} label="Ultima factură" value={lastInvoice} />
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
