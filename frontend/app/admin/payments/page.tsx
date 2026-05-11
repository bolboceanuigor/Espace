'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarDays, CheckCircle2, CreditCard, Download, FileText, ReceiptText, Search, UserRound, XCircle } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { exportsApi, paymentsApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { downloadBlob } from '@/lib/download';
import { useLocalizedPath } from '@/lib/use-localized-path';

type PaymentStatus = 'CONFIRMED' | 'CANCELLED';
type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'VOID';
type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD_TERMINAL' | 'INFOCOM' | 'OPLATA' | 'OTHER';

type AdminPayment = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  billingMonth: string;
  apartment?: { id: string; apartmentNumber: string; staircase?: string | null } | null;
  resident?: { id: string; fullName: string; phone?: string | null } | null;
  amount: number;
  currency: 'MDL';
  paymentDate?: string | null;
  method: PaymentMethod;
  referenceNumber?: string;
  payerName?: string;
  notes?: string;
  status: PaymentStatus;
  createdBy?: { id: string; fullName?: string | null; email?: string | null } | null;
  createdAt: string;
};

type InvoiceOption = {
  id: string;
  invoiceNumber: string;
  billingMonth: string;
  status: InvoiceStatus;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate?: string | null;
  apartment: { id: string; apartmentNumber: string; staircase?: string | null };
  resident?: { id: string; fullName: string; phone?: string | null } | null;
};

const methodLabels: Record<PaymentMethod, string> = {
  CASH: 'Numerar',
  BANK_TRANSFER: 'Transfer bancar',
  CARD_TERMINAL: 'Terminal card',
  INFOCOM: 'InfoCom',
  OPLATA: 'Oplata',
  OTHER: 'Altă metodă',
};

const statusLabels: Record<PaymentStatus, string> = {
  CONFIRMED: 'Confirmată',
  CANCELLED: 'Anulată',
};

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  ISSUED: 'Emisă',
  PARTIALLY_PAID: 'Achitată parțial',
  PAID: 'Achitată',
  CANCELLED: 'Anulată',
  VOID: 'VOID',
};

const emptyForm = {
  invoiceId: '',
  amount: '',
  paymentDate: new Date().toISOString().slice(0, 10),
  method: 'CASH' as PaymentMethod,
  referenceNumber: '',
  payerName: '',
  notes: '',
};

export default function AdminPaymentsPage() {
  const localizedPath = useLocalizedPath();
  const [rows, setRows] = useState<AdminPayment[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [association, setAssociation] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [billingMonth, setBillingMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceOption | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [prefillInvoiceId, setPrefillInvoiceId] = useState('');

  const [cancelPayment, setCancelPayment] = useState<AdminPayment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await paymentsApi.adminList({
        search: query || undefined,
        method: method || undefined,
        status: status || undefined,
        billingMonth: billingMonth || undefined,
        page: 1,
        limit: 50,
      });
      setRows(res.data?.items || []);
      setStats(res.data?.stats || null);
      setAssociation(res.data?.association || null);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca plățile.'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [billingMonth, method, query, status]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invoiceId = params.get('invoiceId') || '';
    if (invoiceId) {
      setPrefillInvoiceId(invoiceId);
      setInvoiceSearch(invoiceId);
      setPaymentModalOpen(true);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    if (!paymentModalOpen) return;
    let active = true;
    paymentsApi
      .adminInvoiceSearch({ search: invoiceSearch || undefined, unpaidOnly: true })
      .then((res) => {
        if (!active) return;
        const items = res.data?.items || [];
        setInvoiceOptions(items);
        if (prefillInvoiceId && items[0]) {
          selectInvoice(items[0]);
          setPrefillInvoiceId('');
        }
      })
      .catch(() => {
        if (active) setInvoiceOptions([]);
      });
    return () => {
      active = false;
    };
  }, [invoiceSearch, paymentModalOpen, prefillInvoiceId]);

  const kpi = stats || {
    totalCollected: 0,
    totalUnpaidBalance: 0,
    currentMonthPayments: 0,
    unpaidInvoices: 0,
    partiallyPaidInvoices: 0,
    paidInvoices: 0,
    lastPaymentDate: null,
  };

  function openPaymentModal(invoice?: InvoiceOption) {
    setMessage('');
    setFormError('');
    setInvoiceSearch('');
    setInvoiceOptions([]);
    setSelectedInvoice(null);
    setForm(emptyForm);
    if (invoice) selectInvoice(invoice);
    setPaymentModalOpen(true);
  }

  function selectInvoice(invoice: InvoiceOption) {
    setSelectedInvoice(invoice);
    setForm((current) => ({
      ...current,
      invoiceId: invoice.id,
      amount: String(invoice.balanceAmount || ''),
    }));
  }

  async function registerPayment() {
    setFormError('');
    setMessage('');
    const amount = Number(form.amount);
    if (!form.invoiceId) {
      setFormError('Factura este obligatorie.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Suma plății trebuie să fie mai mare decât 0.');
      return;
    }
    if (selectedInvoice && amount > selectedInvoice.balanceAmount + 0.001) {
      setFormError('Suma nu poate depăși soldul facturii.');
      return;
    }
    if (!form.paymentDate || Number.isNaN(new Date(form.paymentDate).getTime())) {
      setFormError('Data plății nu este validă.');
      return;
    }
    setSaving(true);
    try {
      await paymentsApi.adminCreate({
        invoiceId: form.invoiceId,
        amount,
        paymentDate: form.paymentDate,
        method: form.method,
        referenceNumber: form.referenceNumber || undefined,
        payerName: form.payerName || undefined,
        notes: form.notes || undefined,
      });
      setPaymentModalOpen(false);
      setMessage('Plata a fost înregistrată.');
      await loadPayments();
    } catch (err: any) {
      setFormError(String(err?.message || 'Nu am putut înregistra plata.'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmCancelPayment() {
    if (!cancelPayment) return;
    if (!cancelReason.trim()) return;
    setCancelBusy(true);
    setError('');
    setMessage('');
    try {
      await paymentsApi.adminCancelManual(cancelPayment.id, { reason: cancelReason.trim() });
      setMessage('Plata a fost anulată.');
      setCancelPayment(null);
      setCancelReason('');
      await loadPayments();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut anula plata.'));
    } finally {
      setCancelBusy(false);
    }
  }

  const canReset = Boolean(query || method || status || billingMonth);

  async function exportCsv() {
    setError('');
    setMessage('');
    try {
      const res = await exportsApi.adminPaymentsCsv({
        billingMonth: billingMonth || undefined,
        status: status || undefined,
        method: method || undefined,
      });
      downloadBlob(res.data, `plati-${billingMonth || 'toate'}.csv`);
      setMessage('Exportul CSV pentru plăți a fost generat.');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut genera exportul CSV.'));
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Plăți înregistrate"
        description="Înregistrează și urmărește plățile manuale ale facturilor interne."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            {association ? <Badge variant="neutral">{association.shortName} · {association.associationCode}</Badge> : null}
            <Badge variant="neutral">MDL</Badge>
            <ButtonLink href="/admin/payments/reconciliation" variant="secondary">
              Vezi reconciliere
            </ButtonLink>
            <Button type="button" variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button type="button" onClick={() => openPaymentModal()}>
              <Banknote className="h-4 w-4" />
              Înregistrează plată
            </Button>
          </div>
        }
      />

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <StatCard label="Total încasat" value={formatMdl(kpi.totalCollected)} description="Plăți confirmate" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Sold neachitat" value={formatMdl(kpi.totalUnpaidBalance)} description="Facturi interne" icon={<ReceiptText className="h-5 w-5" />} tone={kpi.totalUnpaidBalance > 0 ? 'warning' : 'success'} />
        <StatCard label="Plăți luna curentă" value={formatMdl(kpi.currentMonthPayments)} description="Încasări lunare" icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="Facturi neachitate" value={String(kpi.unpaidInvoices)} description="Emise cu sold" icon={<FileText className="h-5 w-5" />} tone="warning" />
        <StatCard label="Parțial achitate" value={String(kpi.partiallyPaidInvoices)} description="Necesită urmărire" icon={<CreditCard className="h-5 w-5" />} tone="warning" />
        <StatCard label="Facturi achitate" value={String(kpi.paidInvoices)} description="Sold zero" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Ultima plată" value={formatDate(kpi.lastPaymentDate)} description="Înregistrare recentă" icon={<Banknote className="h-5 w-5" />} />
      </section>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută factură, apartament, locatar, telefon sau referință" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Input label="Luna facturii" type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
          <Select label="Metodă" value={method} onChange={setMethod} options={[['', 'Toate metodele'], ...Object.entries(methodLabels)]} />
          <Select label="Status" value={status} onChange={setStatus} options={[['', 'Toate'], ['CONFIRMED', 'Confirmate'], ['CANCELLED', 'Anulate']]} />
          <Button type="button" variant="secondary" disabled={!canReset} onClick={() => { setQuery(''); setMethod(''); setStatus(''); setBillingMonth(''); }} className="self-end">
            Resetează
          </Button>
        </div>
      </Card>

      <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)] xl:block">
        <div className="grid grid-cols-[0.8fr_1fr_0.8fr_1fr_0.75fr_0.85fr_0.8fr_0.85fr_0.75fr_1fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Data</span>
          <span>Factură</span>
          <span>Apartament</span>
          <span>Locatar</span>
          <span>Sumă</span>
          <span>Metodă</span>
          <span>Referință</span>
          <span>Înregistrat de</span>
          <span>Status</span>
          <span>Acțiuni</span>
        </div>
        {rows.map((payment) => (
          <div key={payment.id} className="grid grid-cols-[0.8fr_1fr_0.8fr_1fr_0.75fr_0.85fr_0.8fr_0.85fr_0.75fr_1fr] items-center gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0">
            <span className="text-muted-foreground">{formatDate(payment.paymentDate)}</span>
            <strong className="text-foreground">{payment.invoiceNumber}</strong>
            <span className="text-muted-foreground">Apt. {payment.apartment?.apartmentNumber || '-'}</span>
            <span className="text-muted-foreground">{payment.resident?.fullName || payment.payerName || '-'}</span>
            <strong className="text-foreground">{formatMdl(payment.amount)}</strong>
            <span className="text-muted-foreground">{methodLabels[payment.method] || payment.method}</span>
            <span className="text-muted-foreground">{payment.referenceNumber || '-'}</span>
            <span className="text-muted-foreground">{payment.createdBy?.fullName || payment.createdBy?.email || '-'}</span>
            <Badge variant={payment.status === 'CANCELLED' ? 'neutral' : 'success'}>{statusLabels[payment.status]}</Badge>
            <PaymentActions payment={payment} localizedPath={localizedPath} onCancel={setCancelPayment} />
          </div>
        ))}
        {loading ? <div className="px-4 py-8 text-sm font-medium text-muted-foreground">Se încarcă datele...</div> : null}
        {!loading && !rows.length ? <EmptyState onRegister={() => openPaymentModal()} /> : null}
      </section>

      <section className="grid gap-3 xl:hidden">
        {rows.map((payment) => (
          <Card key={payment.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">{payment.invoiceNumber}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Apt. {payment.apartment?.apartmentNumber || '-'} · {formatDate(payment.paymentDate)}</p>
              </div>
              <Badge variant={payment.status === 'CANCELLED' ? 'neutral' : 'success'}>{statusLabels[payment.status]}</Badge>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <Info label="Sumă" value={formatMdl(payment.amount)} strong />
              <Info label="Locatar" value={payment.resident?.fullName || payment.payerName || '-'} />
              <Info label="Metodă" value={methodLabels[payment.method] || payment.method} />
              <Info label="Referință" value={payment.referenceNumber || '-'} />
            </div>
            <div className="mt-4">
              <PaymentActions payment={payment} localizedPath={localizedPath} onCancel={setCancelPayment} />
            </div>
          </Card>
        ))}
        {loading ? <Card className="p-5 text-sm font-medium text-muted-foreground">Se încarcă datele...</Card> : null}
        {!loading && !rows.length ? <Card className="p-6"><EmptyState onRegister={() => openPaymentModal()} compact /></Card> : null}
      </section>

      <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} maxWidth="2xl">
        <ModalHeader title="Înregistrează plată" onClose={() => setPaymentModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-4">
            <label className="relative">
              <span className="label">Caută factura *</span>
              <Search className="pointer-events-none absolute left-3 top-[2.35rem] z-10 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Număr factură, apartament, locatar, telefon sau luna" value={invoiceSearch} onChange={(event) => setInvoiceSearch(event.target.value)} />
            </label>
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-border/70 bg-muted/20 p-2">
              {invoiceOptions.map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => selectInvoice(invoice)}
                  className={`mb-2 grid w-full gap-2 rounded-2xl border px-3 py-3 text-left text-sm transition last:mb-0 ${
                    selectedInvoice?.id === invoice.id ? 'border-foreground bg-white' : 'border-border/60 bg-white/70 hover:bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-foreground">{invoice.invoiceNumber}</strong>
                    <Badge variant={invoice.status === 'PARTIALLY_PAID' ? 'warning' : 'neutral'}>{invoiceStatusLabels[invoice.status]}</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Apt. {invoice.apartment.apartmentNumber}{invoice.apartment.staircase ? ` · sc. ${invoice.apartment.staircase}` : ''} · {invoice.resident?.fullName || 'fără contact principal'}
                  </p>
                  <p className="font-semibold text-foreground">
                    Total {formatMdl(invoice.totalAmount)} · Achitat {formatMdl(invoice.paidAmount)} · Sold {formatMdl(invoice.balanceAmount)}
                  </p>
                </button>
              ))}
              {!invoiceOptions.length ? <p className="px-3 py-4 text-sm text-muted-foreground">Nu există facturi neachitate pentru căutarea curentă.</p> : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Suma achitată" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} type="number" required />
              <Field label="Data plății" value={form.paymentDate} onChange={(value) => setForm({ ...form, paymentDate: value })} type="date" required />
              <Select label="Metodă plată" value={form.method} onChange={(value) => setForm({ ...form, method: value as PaymentMethod })} options={Object.entries(methodLabels)} />
              <Field label="Referință" value={form.referenceNumber} onChange={(value) => setForm({ ...form, referenceNumber: value })} />
              <Field label="Plătitor" value={form.payerName} onChange={(value) => setForm({ ...form, payerName: value })} />
              <Field label="Note" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
            </div>
            <p className="rounded-2xl bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
              Înregistrarea este manuală. Nu se inițiază plată online, nu se conectează BPay și nu se verifică automat procesatori externi.
            </p>
            {formError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</p> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" disabled={saving} onClick={() => setPaymentModalOpen(false)}>Anulează</Button>
          <Button type="button" isLoading={saving} onClick={registerPayment}>Înregistrează plată</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(cancelPayment)} onClose={() => setCancelPayment(null)} maxWidth="lg">
        <ModalHeader title="Anulează plata" onClose={() => setCancelPayment(null)} />
        <ModalBody>
          <p className="text-sm text-muted-foreground">
            Plata va fi marcată ca anulată, fără ștergere fizică. Soldul facturii se va recalcula automat.
          </p>
          <label className="mt-4 block">
            <span className="label">Motiv anulare *</span>
            <textarea className="input min-h-24" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </label>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" disabled={cancelBusy} onClick={() => setCancelPayment(null)}>Renunță</Button>
          <Button type="button" variant="danger" isLoading={cancelBusy} disabled={!cancelReason.trim()} onClick={confirmCancelPayment}>Anulează plata</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function PaymentActions({ payment, localizedPath, onCancel }: { payment: AdminPayment; localizedPath: (path: string) => string; onCancel: (payment: AdminPayment) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <ButtonLink href={localizedPath(`/admin/payments/${payment.id}/print`)} size="sm" variant="secondary">Deschide</ButtonLink>
      <ButtonLink href={localizedPath(`/admin/invoices/${payment.invoiceId}`)} size="sm" variant="secondary">Vezi factură</ButtonLink>
      {payment.status !== 'CANCELLED' ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => onCancel(payment)}>
          <XCircle className="h-3.5 w-3.5" />
          Anulează
        </Button>
      ) : null}
    </div>
  );
}

function EmptyState({ onRegister, compact }: { onRegister: () => void; compact?: boolean }) {
  return (
    <div className={compact ? 'text-center' : 'px-4 py-10 text-center'}>
      <h2 className="text-lg font-semibold text-foreground">Nu există plăți înregistrate</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        După ce înregistrezi manual o plată, aceasta va apărea aici.
      </p>
      <Button type="button" className="mt-4" onClick={onRegister}>Înregistrează plată</Button>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue || 'all'} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function Field({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}{required ? ' *' : ''}</span>
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${strong ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>{value}</span>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
