'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, CreditCard, ReceiptText, Search } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { apartmentsApi, invoicesApi, paymentsApi } from '@/lib/api';
import { adminInvoices, invoiceStatusVariant, normalizeApiApartment, normalizeApiInvoice, type AdminApartment, type AdminInvoice, type InvoiceStatus } from '@/lib/admin-mvp-data';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

const filters: Array<'Toate' | InvoiceStatus> = ['Toate', 'Achitat', 'Neachitat', 'Întârziat'];
const paymentMethods = {
  CASH: 'Numerar',
  BANK_TRANSFER: 'Transfer bancar',
  CARD: 'Card bancar',
  ONLINE: 'Online',
} as const;
const emptyPaymentForm = {
  apartmentId: '',
  invoiceId: '',
  amount: '',
  method: 'CASH' as keyof typeof paymentMethods,
  paidAt: new Date().toISOString().slice(0, 10),
};

export default function AdminPaymentsPage() {
  const localizedPath = useLocalizedPath();
  const [status, setStatus] = useState<'Toate' | InvoiceStatus>('Toate');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AdminInvoice[]>(adminInvoices);
  const [apartments, setApartments] = useState<AdminApartment[]>([]);
  const [source, setSource] = useState<'api' | 'mock'>('mock');
  const [summary, setSummary] = useState({
    totalIssued: 218400,
    totalPaid: 131950,
    totalDebt: 86450,
    overdueInvoices: 37,
  });
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadBilling = async () => {
    const [invoiceRes, paymentRes, summaryRes] = await Promise.all([
      invoicesApi.list(),
      paymentsApi.list().catch(() => ({ data: [] })),
      paymentsApi.summary().catch(() => ({ data: null })),
    ]);
    const apartmentsRes = await apartmentsApi.list().catch(() => ({ data: [] }));
    const payments = paymentRes.data || [];
    const apiRows = (invoiceRes.data || []).map((invoice) => normalizeApiInvoice(invoice, payments));
    const apiApartments = (apartmentsRes.data || []).map(normalizeApiApartment);
    setRows(apiRows);
    setSource('api');
    setPaymentForm((current) => {
      if (current.invoiceId || current.apartmentId || !apiRows[0]?.id) return current;
      return {
        ...current,
        apartmentId: apiRows[0].apartmentId || '',
        invoiceId: apiRows[0].id,
        amount: String(apiRows[0].amount || ''),
      };
    });
    setApartments(apiApartments);
    if (!apiRows.length && apiApartments[0]?.id) {
      setPaymentForm((current) => current.apartmentId ? current : { ...current, apartmentId: apiApartments[0].id });
    }
    if (summaryRes.data) {
      setSummary({
        totalIssued: Number(summaryRes.data.totalIssued ?? 0),
        totalPaid: Number(summaryRes.data.totalPaid ?? 0),
        totalDebt: Number(summaryRes.data.totalDebt ?? 0),
        overdueInvoices: Number(summaryRes.data.overdueInvoices ?? 0),
      });
    }
  };

  useEffect(() => {
    let active = true;
    loadBilling().catch(() => {
        if (!active) return;
        setRows(adminInvoices);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((invoice) => {
      const matchesSearch = !needle || `${invoice.apartment} ${invoice.month} ${invoice.invoiceNumber} ${invoice.staircase}`.toLowerCase().includes(needle);
      const matchesStatus = status === 'Toate' || invoice.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [query, rows, status]);

  const openPaymentModal = (invoice?: AdminInvoice) => {
    setPaymentError('');
    setSuccessMessage('');
    const selected = invoice || rows.find((item) => item.status !== 'Achitat') || rows[0];
    setPaymentForm({
      apartmentId: selected?.apartmentId || apartments[0]?.id || '',
      invoiceId: selected?.id || '',
      amount: selected?.remainingDebt || selected?.amount ? String(selected.remainingDebt || selected.amount) : '',
      method: 'CASH',
      paidAt: new Date().toISOString().slice(0, 10),
    });
    setPaymentModalOpen(true);
  };

  const registerPayment = async () => {
    setPaymentError('');
    setSuccessMessage('');
    const selectedInvoice = rows.find((item) => item.id === paymentForm.invoiceId);
    const selectedApartment = apartments.find((item) => item.id === paymentForm.apartmentId) || apartments.find((item) => item.id === selectedInvoice?.apartmentId);
    const amount = Number(paymentForm.amount);
    const organizationId = selectedInvoice?.organizationId || selectedApartment?.organizationId;
    const apartmentId = selectedInvoice?.apartmentId || selectedApartment?.id;
    if (!organizationId || !apartmentId) {
      setPaymentError('Alege un apartament real din lista API.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Completează suma plății.');
      return;
    }

    setIsRegisteringPayment(true);
    try {
      await paymentsApi.create({
        organizationId,
        apartmentId,
        invoiceId: selectedInvoice?.id || undefined,
        amount,
        method: paymentForm.method,
        paidAt: paymentForm.paidAt,
      });
      setPaymentModalOpen(false);
      setSuccessMessage('Plata a fost înregistrată.');
      setSource('api');
      await loadBilling().catch(() => undefined);
    } catch {
      setPaymentError('Nu am putut înregistra plata.');
    } finally {
      setIsRegisteringPayment(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Plăți / Datorii"
        description="Facturi, încasări și restanțe pentru asociația curentă."
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
          </span>
        }
      />

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total emis" value={formatMdl(summary.totalIssued)} description="Facturi emise" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Total achitat" value={formatMdl(summary.totalPaid)} description="Plăți confirmate" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Restanțe" value={formatMdl(summary.totalDebt)} description="Solduri neachitate" icon={<CreditCard className="h-5 w-5" />} tone="danger" />
        <StatCard label="Facturi întârziate" value={String(summary.overdueInvoices)} description="Scadență depășită" icon={<Clock3 className="h-5 w-5" />} tone="warning" />
      </section>

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută apartament, lună sau număr factură" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={`h-11 shrink-0 rounded-2xl border px-4 text-sm font-semibold transition ${
                  status === item ? 'border-foreground bg-foreground text-background' : 'border-border/70 bg-white text-foreground hover:bg-muted/70'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)] md:block">
        <div className="grid grid-cols-[0.9fr_0.9fr_0.8fr_0.9fr_0.9fr_0.9fr_auto] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Apartament</span>
          <span>Luna</span>
          <span>Suma</span>
          <span>Scadență</span>
          <span>Status</span>
          <span>Metodă</span>
          <span />
        </div>
        {visible.map((invoice) => (
          <div key={invoice.id} className="grid grid-cols-[0.9fr_0.9fr_0.8fr_0.9fr_0.9fr_0.9fr_auto] items-center gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0">
            <div>
              <p className="font-semibold text-foreground">Apt. {invoice.apartment}</p>
              <p className="text-xs text-muted-foreground">{invoice.staircase}</p>
            </div>
            <span className="text-muted-foreground">{invoice.month}</span>
            <span className="font-semibold text-foreground">{formatMdl(invoice.amount)}</span>
            <span className="text-muted-foreground">{invoice.dueDate}</span>
            <Badge variant={invoiceStatusVariant[invoice.status]}>{invoice.status}</Badge>
            <span className="text-muted-foreground">{invoice.paymentMethod ?? '-'}</span>
            <div className="flex items-center gap-2">
              <Button type="button" onClick={() => openPaymentModal(invoice)} size="sm" variant="secondary">Plată</Button>
              <ButtonLink href={localizedPath(`/admin/invoices/${invoice.id}`)} size="sm" variant="secondary">Deschide</ButtonLink>
            </div>
          </div>
        ))}
        {!visible.length ? <div className="px-4 py-8 text-sm font-medium text-muted-foreground">Nu există plăți sau facturi încă.</div> : null}
      </section>

      <section className="grid gap-3 md:hidden">
        {visible.map((invoice) => (
          <PaymentCard key={invoice.id} invoice={invoice} href={localizedPath(`/admin/invoices/${invoice.id}`)} />
        ))}
        {!visible.length ? <Card className="p-5 text-sm font-medium text-muted-foreground">Nu există plăți sau facturi încă.</Card> : null}
      </section>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">Emitere facturi lunare</p>
            <p className="mt-1 text-sm text-muted-foreground">Plățile online și procesatorii bancari vor fi conectați într-o etapă separată.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={() => openPaymentModal()}>Înregistrează plată</Button>
            <Link href={localizedPath('/admin/invoices')} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
              Vezi facturi
            </Link>
          </div>
        </div>
      </Card>

      <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} maxWidth="2xl">
        <ModalHeader title="Înregistrează plată" onClose={() => setPaymentModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="label">Apartament</span>
              <select
                className="select"
                value={paymentForm.apartmentId}
                onChange={(event) => setPaymentForm({ ...paymentForm, apartmentId: event.target.value, invoiceId: '' })}
              >
                <option value="">Alege apartamentul</option>
                {apartments.map((apartment) => (
                  <option key={apartment.id} value={apartment.id}>Apt. {apartment.number} · {apartment.staircase}</option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="label">Factură opțională</span>
              <select
                className="select"
                value={paymentForm.invoiceId}
                onChange={(event) => {
                  const selected = rows.find((item) => item.id === event.target.value);
                  setPaymentForm({
                    ...paymentForm,
                    apartmentId: selected?.apartmentId || paymentForm.apartmentId,
                    invoiceId: event.target.value,
                    amount: selected?.amount ? String(selected.amount) : paymentForm.amount,
                  });
                }}
              >
                <option value="">Fără factură asociată</option>
                {rows
                  .filter((invoice) => !paymentForm.apartmentId || invoice.apartmentId === paymentForm.apartmentId)
                  .map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>Apt. {invoice.apartment} · {invoice.month} · {formatMdl(invoice.amount)}</option>
                ))}
              </select>
            </label>
            <Field label="Suma" value={paymentForm.amount} onChange={(value) => setPaymentForm({ ...paymentForm, amount: value })} type="number" required />
            <label className="block">
              <span className="label">Metodă</span>
              <select className="select" value={paymentForm.method} onChange={(event) => setPaymentForm({ ...paymentForm, method: event.target.value as typeof paymentForm.method })}>
                {Object.entries(paymentMethods).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <Field label="Data plății" value={paymentForm.paidAt} onChange={(value) => setPaymentForm({ ...paymentForm, paidAt: value })} type="date" required />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Aceasta este înregistrare manuală a plății. Integrarea procesatorilor bancari va fi conectată ulterior.
          </p>
          {paymentError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {paymentError}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setPaymentModalOpen(false)} disabled={isRegisteringPayment} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={registerPayment} disabled={isRegisteringPayment} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {isRegisteringPayment ? 'Se înregistrează...' : 'Înregistrează plată'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function PaymentCard({ invoice, href }: { invoice: AdminInvoice; href: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Apt. {invoice.apartment}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{invoice.month} · {invoice.invoiceNumber}</p>
        </div>
        <Badge variant={invoiceStatusVariant[invoice.status]}>{invoice.status}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        <Info label="Suma" value={formatMdl(invoice.amount)} strong />
        <Info label="Data scadentă" value={invoice.dueDate} />
        <Info label="Metodă plată" value={invoice.paymentMethod ?? '-'} />
      </div>
      <ButtonLink href={href} className="mt-4 w-full" variant="secondary">Deschide</ButtonLink>
    </Card>
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

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}{required ? ' *' : ''}</span>
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
