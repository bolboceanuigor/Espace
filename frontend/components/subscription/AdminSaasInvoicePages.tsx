'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';
import { billingSaasApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

function money(value?: number, currency = 'MDL') {
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency }).format(Number(value || 0));
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium' }).format(new Date(value));
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = { ISSUED: 'Emisă', PARTIALLY_PAID: 'Parțial achitată', PAID: 'Achitată', OVERDUE: 'Întârziată', CANCELLED: 'Anulată', VOID: 'Void' };
  return labels[status || ''] || status || '—';
}

function statusClass(status?: string) {
  if (status === 'PAID') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'OVERDUE' || status === 'CANCELLED' || status === 'VOID') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function Badge({ status }: { status?: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}>{statusLabel(status)}</span>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border border-border/70 bg-card p-5">{children}</section>;
}

function Header({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}

export function AdminSaasInvoicesPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  useEffect(() => { billingSaasApi.listAdminSaasInvoices().then((res) => setData(res.data ?? res)).catch(() => undefined); }, []);
  const items = data?.items || [];
  const stats = data?.stats || {};
  const nextDue = items.filter((item: any) => item.balanceAmount > 0).sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  return (
    <div className="space-y-5">
      <Header title="Facturi abonament" subtitle="Vezi facturile emise de Espace pentru abonamentul asociației." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-sm text-muted-foreground">Total facturi</p><p className="mt-2 text-2xl font-semibold">{stats.totalInvoices || 0}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Sold restant</p><p className="mt-2 text-2xl font-semibold">{money(stats.outstandingBalance)}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Următoarea scadență</p><p className="mt-2 text-2xl font-semibold">{fmtDate(nextDue?.dueDate)}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Întârziate</p><p className="mt-2 text-2xl font-semibold">{stats.overdue || 0}</p></Card>
      </div>
      <Card>
        {!items.length ? <div><p className="font-semibold text-foreground">Nu există facturi de abonament</p><p className="mt-1 text-sm text-muted-foreground">Facturile emise de Espace pentru abonamentul asociației vor apărea aici.</p></div> : null}
        {items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="text-xs uppercase text-muted-foreground"><tr><th className="py-2">Număr factură</th><th>Perioadă</th><th>Status</th><th>Total</th><th>Achitat</th><th>Sold</th><th>Scadență</th><th>Acțiuni</th></tr></thead><tbody className="divide-y divide-border">{items.map((item: any) => <tr key={item.id}><td className="py-3 font-medium text-foreground">{item.invoiceNumber}</td><td>{fmtDate(item.billingPeriodStart)} - {fmtDate(item.billingPeriodEnd)}</td><td><Badge status={item.status} /></td><td>{money(item.totalAmount, item.currency)}</td><td>{money(item.paidAmount, item.currency)}</td><td>{money(item.balanceAmount, item.currency)}</td><td>{fmtDate(item.dueDate)}</td><td><Link href={localizedPath(`/admin/subscription/invoices/${item.id}`)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border/70 px-3 font-semibold"><Eye className="h-4 w-4" /> Deschide</Link></td></tr>)}</tbody></table></div> : null}
      </Card>
    </div>
  );
}

export function AdminSaasInvoiceDetailPage({ id }: { id: string }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  useEffect(() => { billingSaasApi.getAdminSaasInvoice(id).then((res) => setData(res.data ?? res)).catch(() => undefined); }, [id]);
  const invoice = data?.invoice;
  if (!invoice) return <Card><p className="text-sm text-muted-foreground">Se încarcă...</p></Card>;
  return (
    <div className="space-y-5">
      <Header title={invoice.invoiceNumber} subtitle="Detalii read-only pentru factura de abonament." actions={<Link href={localizedPath('/admin/subscription/invoices')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border/70 px-4 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Înapoi</Link>} />
      <Card><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><p>Status<br /><Badge status={invoice.status} /></p><p>Total<br /><b>{money(invoice.totalAmount, invoice.currency)}</b></p><p>Achitat<br /><b>{money(invoice.paidAmount, invoice.currency)}</b></p><p>Sold<br /><b>{money(invoice.balanceAmount, invoice.currency)}</b></p><p>Plan<br /><b>{data.plan?.name || '—'}</b></p><p>Perioadă<br /><b>{fmtDate(invoice.billingPeriodStart)} - {fmtDate(invoice.billingPeriodEnd)}</b></p><p>Data emiterii<br /><b>{fmtDate(invoice.issueDate)}</b></p><p>Scadență<br /><b>{fmtDate(invoice.dueDate)}</b></p></div></Card>
      <Card><h2 className="font-semibold text-foreground">Linii factură</h2><div className="mt-4 divide-y divide-border">{(data.lines || []).map((line: any) => <div key={line.id} className="flex justify-between gap-3 py-3"><div><p className="font-medium">{line.name}</p><p className="text-sm text-muted-foreground">{line.description || line.lineType}</p></div><p className="font-semibold">{money(line.amount, line.currency)}</p></div>)}</div></Card>
      {invoice.notes ? <Card><h2 className="font-semibold text-foreground">Note</h2><p className="mt-2 text-sm text-muted-foreground">{invoice.notes}</p></Card> : null}
    </div>
  );
}
