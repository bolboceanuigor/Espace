'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, FileText, Printer, Receipt, Send, Wallet, XCircle } from 'lucide-react';
import { billingSaasApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Emisă',
  PARTIALLY_PAID: 'Parțial achitată',
  PAID: 'Achitată',
  OVERDUE: 'Întârziată',
  CANCELLED: 'Anulată',
  VOID: 'Void',
};

const lineTypes = ['SUBSCRIPTION_FEE', 'PLAN_UPGRADE', 'PLAN_DOWNGRADE_CREDIT', 'DISCOUNT', 'MANUAL_ADJUSTMENT', 'SETUP_FEE', 'OTHER'];

function money(value?: number, currency = 'MDL') {
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency }).format(Number(value || 0));
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium' }).format(new Date(value));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthEnd() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

function statusClass(status?: string) {
  if (status === 'PAID') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'DRAFT' || status === 'ISSUED' || status === 'PARTIALLY_PAID') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'OVERDUE' || status === 'CANCELLED' || status === 'VOID') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

function Badge({ status }: { status?: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}>{statusLabels[status || ''] || status || '—'}</span>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{children}</section>;
}

function Header({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

function ButtonLink({ href, children, variant = 'primary' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'secondary' }) {
  return <Link href={href} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ${variant === 'primary' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'}`}>{children}</Link>;
}

function ActionButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={`inline-flex min-h-9 items-center gap-1 rounded-lg border px-3 text-sm font-semibold ${danger ? 'border-red-200 text-red-700' : 'border-slate-200 text-slate-800 hover:bg-slate-50'}`}>{children}</button>;
}

export function SuperadminSaasInvoicesPage({ associationId }: { associationId?: string }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const load = () => (associationId ? billingSaasApi.getAssociationSaasInvoices(associationId) : billingSaasApi.listSaasInvoices()).then((res) => setData(res.data ?? res));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => undefined); }, [associationId]);
  const items = data?.items || [];
  const stats = data?.stats || {};
  return (
    <div className="space-y-5 bg-slate-50">
      <Header title={associationId ? 'Facturi SaaS asociație' : 'Facturi SaaS'} subtitle="Gestionează facturile Espace emise către APC-uri pentru abonamente." actions={<ButtonLink href={localizedPath('/superadmin/billing/saas-invoices/new')}><Receipt className="h-4 w-4" /> Factură nouă</ButtonLink>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-sm text-slate-500">Total facturi</p><p className="mt-2 text-2xl font-semibold">{stats.totalInvoices || 0}</p></Card>
        <Card><p className="text-sm text-slate-500">Total emis</p><p className="mt-2 text-2xl font-semibold">{money(stats.totalIssued)}</p></Card>
        <Card><p className="text-sm text-slate-500">Total achitat</p><p className="mt-2 text-2xl font-semibold">{money(stats.totalPaid)}</p></Card>
        <Card><p className="text-sm text-slate-500">Sold restant</p><p className="mt-2 text-2xl font-semibold">{money(stats.outstandingBalance)}</p></Card>
        <Card><p className="text-sm text-slate-500">Draft</p><p className="mt-2 text-2xl font-semibold">{stats.draft || 0}</p></Card>
        <Card><p className="text-sm text-slate-500">Emise</p><p className="mt-2 text-2xl font-semibold">{stats.issued || 0}</p></Card>
        <Card><p className="text-sm text-slate-500">Întârziate</p><p className="mt-2 text-2xl font-semibold">{stats.overdue || 0}</p></Card>
        <Card><p className="text-sm text-slate-500">Achitate</p><p className="mt-2 text-2xl font-semibold">{stats.paid || 0}</p></Card>
      </div>
      <Card>
        {!items.length ? <div><p className="font-semibold text-slate-950">Nu există facturi SaaS</p><p className="mt-1 text-sm text-slate-500">Generează prima factură pentru un abonament APC.</p></div> : null}
        {items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Număr factură</th><th>Asociație</th><th>Plan</th><th>Perioadă</th><th>Status</th><th>Total</th><th>Achitat</th><th>Sold</th><th>Scadență</th><th>Acțiuni</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{items.map((item: any) => <InvoiceRow key={item.id} item={item} onChanged={load} />)}</tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function InvoiceRow({ item, onChanged }: { item: any; onChanged: () => void }) {
  const localizedPath = useLocalizedPath();
  const issue = async () => {
    if (!confirm('După emitere, factura devine vizibilă pentru Adminul asociației și nu mai poate fi editată direct.')) return;
    await billingSaasApi.issueSaasInvoice(item.id); await onChanged();
  };
  const paid = async () => {
    const amount = prompt('Suma achitată manual', String(item.balanceAmount || ''));
    if (!amount) return;
    await billingSaasApi.markSaasInvoicePaid(item.id, { paidAmount: Number(amount), paymentDate: today(), method: 'BANK_TRANSFER' }); await onChanged();
  };
  const close = async (kind: 'cancel' | 'void') => {
    const reason = prompt(kind === 'cancel' ? 'Motiv anulare' : 'Motiv void');
    if (!reason) return;
    if (kind === 'cancel') await billingSaasApi.cancelSaasInvoice(item.id, reason);
    else await billingSaasApi.voidSaasInvoice(item.id, reason);
    await onChanged();
  };
  return (
    <tr>
      <td className="py-3 font-medium text-slate-950">{item.invoiceNumber}</td>
      <td>{item.association?.shortName || item.association?.name || '—'}</td>
      <td>{item.plan?.name || '—'}</td>
      <td>{fmtDate(item.billingPeriodStart)} - {fmtDate(item.billingPeriodEnd)}</td>
      <td><Badge status={item.status} /></td>
      <td>{money(item.totalAmount, item.currency)}</td>
      <td>{money(item.paidAmount, item.currency)}</td>
      <td>{money(item.balanceAmount, item.currency)}</td>
      <td>{fmtDate(item.dueDate)}</td>
      <td><div className="flex flex-wrap gap-2">
        <ButtonLink href={localizedPath(`/superadmin/billing/saas-invoices/${item.id}`)} variant="secondary"><Eye className="h-4 w-4" /> Deschide</ButtonLink>
        {item.storedStatus === 'DRAFT' ? <ButtonLink href={localizedPath(`/superadmin/billing/saas-invoices/${item.id}/edit`)} variant="secondary">Editează</ButtonLink> : null}
        {item.storedStatus === 'DRAFT' ? <ActionButton onClick={issue}><Send className="h-4 w-4" /> Emite</ActionButton> : null}
        {['ISSUED', 'PARTIALLY_PAID'].includes(item.storedStatus) ? <ActionButton onClick={paid}><Wallet className="h-4 w-4" /> Paid</ActionButton> : null}
        {!['CANCELLED', 'VOID'].includes(item.storedStatus) ? <ActionButton danger onClick={() => close('cancel')}><XCircle className="h-4 w-4" /> Anulează</ActionButton> : null}
      </div></td>
    </tr>
  );
}

export function SaasInvoiceFormPage({ id }: { id?: string }) {
  const localizedPath = useLocalizedPath();
  const [mode, setMode] = useState<'subscription' | 'manual'>('subscription');
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ associationId: '', subscriptionId: '', billingPeriodStart: today().slice(0, 8) + '01', billingPeriodEnd: monthEnd(), issueDate: today(), dueDate: monthEnd(), notes: '', lineName: 'Servicii SaaS Espace', lineType: 'OTHER', unitPrice: 0 });
  useEffect(() => {
    billingSaasApi.listSaasSubscriptions({ limit: 100 }).then((res) => setSubscriptions((res.data ?? res).items || [])).catch(() => undefined);
    if (id) billingSaasApi.getSaasInvoice(id).then((res) => {
      const data = res.data ?? res;
      const invoice = data.invoice;
      const line = data.lines?.[0] || {};
      setForm({ ...invoice, lineName: line.name, lineType: line.lineType || 'OTHER', unitPrice: line.unitPrice || invoice.totalAmount });
      setMode(invoice.subscriptionId ? 'subscription' : 'manual');
    }).catch(() => undefined);
  }, [id]);
  const selected = subscriptions.find((sub) => sub.id === form.subscriptionId);
  const save = async () => {
    const base = { ...form, associationId: form.associationId || selected?.associationId, subscriptionId: form.subscriptionId || undefined };
    const payload = mode === 'subscription'
      ? base
      : { ...base, lines: [{ lineType: form.lineType, name: form.lineName, quantity: 1, unitPrice: Number(form.unitPrice), amount: Number(form.unitPrice) }] };
    const res = id ? await billingSaasApi.updateSaasInvoice(id, payload) : mode === 'subscription' ? await billingSaasApi.createSaasInvoiceFromSubscription(payload) : await billingSaasApi.createSaasInvoice(payload);
    const saved = (res.data ?? res).invoice || (res.data ?? res);
    window.location.href = localizedPath(`/superadmin/billing/saas-invoices/${saved.id}`);
  };
  return (
    <div className="space-y-5 bg-slate-50">
      <Header title={id ? 'Editează factură SaaS' : 'Factură SaaS nouă'} subtitle="Creează draft manual sau din abonamentul curent al unei asociații." actions={<ButtonLink href={localizedPath('/superadmin/billing/saas-invoices')} variant="secondary"><ArrowLeft className="h-4 w-4" /> Înapoi</ButtonLink>} />
      <Card>
        {!id ? <div className="mb-5 flex gap-2"><button onClick={() => setMode('subscription')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${mode === 'subscription' ? 'bg-slate-950 text-white' : 'border border-slate-200'}`}>Din abonament</button><button onClick={() => setMode('manual')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${mode === 'manual' ? 'bg-slate-950 text-white' : 'border border-slate-200'}`}>Manual</button></div> : null}
        <div className="grid gap-4 md:grid-cols-2">
          {mode === 'subscription' ? <label className="text-sm font-medium">Abonament<select value={form.subscriptionId || ''} onChange={(e) => { const sub = subscriptions.find((item) => item.id === e.target.value); setForm({ ...form, subscriptionId: e.target.value, associationId: sub?.associationId || sub?.association?.id || '' }); }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Selectează abonament</option>{subscriptions.map((sub) => <option key={sub.id} value={sub.id}>{sub.association?.shortName || sub.association?.name} - {sub.planName || sub.plan?.name}</option>)}</select></label> : <label className="text-sm font-medium">Association ID<input value={form.associationId || ''} onChange={(e) => setForm({ ...form, associationId: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>}
          <label className="text-sm font-medium">Scadență<input type="date" value={String(form.dueDate || '').slice(0, 10)} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <label className="text-sm font-medium">Perioadă start<input type="date" value={String(form.billingPeriodStart || '').slice(0, 10)} onChange={(e) => setForm({ ...form, billingPeriodStart: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <label className="text-sm font-medium">Perioadă end<input type="date" value={String(form.billingPeriodEnd || '').slice(0, 10)} onChange={(e) => setForm({ ...form, billingPeriodEnd: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          {mode === 'manual' ? <><label className="text-sm font-medium">Tip linie<select value={form.lineType} onChange={(e) => setForm({ ...form, lineType: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{lineTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="text-sm font-medium">Nume linie<input value={form.lineName || ''} onChange={(e) => setForm({ ...form, lineName: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-medium">Suma<input type="number" value={form.unitPrice || 0} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label></> : null}
          <label className="text-sm font-medium md:col-span-2">Note<textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
        </div>
        <button onClick={save} className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">Creează draft</button>
      </Card>
    </div>
  );
}

export function SaasInvoiceDetailPage({ id, print = false }: { id: string; print?: boolean }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const load = () => billingSaasApi.getSaasInvoice(id).then((res) => setData(res.data ?? res));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => undefined); }, [id]);
  const invoice = data?.invoice;
  const lines = data?.lines || [];
  if (!invoice) return <Card><p className="text-sm text-slate-500">Se încarcă...</p></Card>;
  if (print) return <InvoicePrint data={data} />;
  return (
    <div className="space-y-5 bg-slate-50">
      <Header title={invoice.invoiceNumber} subtitle="Detalii factură SaaS, linii și timeline." actions={<><ButtonLink href={localizedPath('/superadmin/billing/saas-invoices')} variant="secondary"><ArrowLeft className="h-4 w-4" /> Înapoi</ButtonLink><ButtonLink href={localizedPath(`/superadmin/billing/saas-invoices/${id}/print`)} variant="secondary"><Printer className="h-4 w-4" /> Print</ButtonLink></>} />
      <Card><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><p>Status<br /><Badge status={invoice.status} /></p><p>Total<br /><b>{money(invoice.totalAmount, invoice.currency)}</b></p><p>Achitat<br /><b>{money(invoice.paidAmount, invoice.currency)}</b></p><p>Sold<br /><b>{money(invoice.balanceAmount, invoice.currency)}</b></p><p>Asociație<br /><b>{data.association?.shortName}</b></p><p>Plan<br /><b>{data.plan?.name || '—'}</b></p><p>Perioadă<br /><b>{fmtDate(invoice.billingPeriodStart)} - {fmtDate(invoice.billingPeriodEnd)}</b></p><p>Scadență<br /><b>{fmtDate(invoice.dueDate)}</b></p></div></Card>
      <Card><h2 className="font-semibold text-slate-950">Linii factură</h2><div className="mt-4 divide-y divide-slate-100">{lines.map((line: any) => <div key={line.id} className="flex justify-between py-3"><div><p className="font-medium">{line.name}</p><p className="text-sm text-slate-500">{line.description || line.lineType}</p></div><p className="font-semibold">{money(line.amount, line.currency)}</p></div>)}</div></Card>
      <Card><h2 className="font-semibold text-slate-950">Timeline</h2><div className="mt-4 divide-y divide-slate-100">{(data.events || []).map((event: any) => <div key={event.id} className="py-3"><p className="font-medium">{event.title}</p><p className="text-sm text-slate-500">{event.message}</p><p className="text-xs text-slate-400">{fmtDate(event.createdAt)}</p></div>)}</div></Card>
    </div>
  );
}

function InvoicePrint({ data }: { data: any }) {
  const invoice = data.invoice;
  return (
    <main className="mx-auto max-w-4xl bg-white p-10 text-slate-950 print:p-0">
      <div className="flex justify-between border-b pb-6"><div><h1 className="text-3xl font-bold">Espace</h1><p>SaaS platform</p></div><div className="text-right"><p className="text-xl font-semibold">{invoice.invoiceNumber}</p><Badge status={invoice.status} /></div></div>
      <div className="mt-8 grid grid-cols-2 gap-8"><div><p className="text-sm uppercase text-slate-500">Furnizor</p><p className="font-semibold">Espace</p><p>SaaS platform</p></div><div><p className="text-sm uppercase text-slate-500">APC</p><p className="font-semibold">{data.association?.legalName || data.association?.name}</p><p>{data.association?.associationCode}</p><p>{data.association?.address}</p></div></div>
      <div className="mt-8 grid grid-cols-3 gap-4 text-sm"><p>Data: <b>{fmtDate(invoice.issueDate)}</b></p><p>Scadență: <b>{fmtDate(invoice.dueDate)}</b></p><p>Perioadă: <b>{fmtDate(invoice.billingPeriodStart)} - {fmtDate(invoice.billingPeriodEnd)}</b></p></div>
      <table className="mt-8 w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Descriere</th><th>Cant.</th><th>Preț</th><th className="text-right">Total</th></tr></thead><tbody>{(data.lines || []).map((line: any) => <tr key={line.id} className="border-b"><td className="py-3">{line.name}<br /><span className="text-slate-500">{line.description}</span></td><td>{line.quantity}</td><td>{money(line.unitPrice, line.currency)}</td><td className="text-right font-semibold">{money(line.amount, line.currency)}</td></tr>)}</tbody></table>
      <div className="mt-8 flex justify-end"><div className="w-72 space-y-2 text-sm"><p className="flex justify-between"><span>Subtotal</span><b>{money(invoice.subtotalAmount, invoice.currency)}</b></p><p className="flex justify-between"><span>Discount</span><b>{money(invoice.discountAmount, invoice.currency)}</b></p><p className="flex justify-between"><span>Total</span><b>{money(invoice.totalAmount, invoice.currency)}</b></p><p className="flex justify-between"><span>Sold</span><b>{money(invoice.balanceAmount, invoice.currency)}</b></p></div></div>
    </main>
  );
}
