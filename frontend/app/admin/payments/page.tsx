'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  History,
  ReceiptText,
  RotateCcw,
  Search,
  WalletCards,
} from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { exportsApi, paymentsApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { downloadBlob } from '@/lib/download';
import { useLocalizedPath } from '@/lib/use-localized-path';

type TabKey = 'payments' | 'balances' | 'debts' | 'issues' | 'ledger';

type AdminPayment = {
  id: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  billingMonth?: string | null;
  apartment?: ApartmentSummary | null;
  resident?: ContactSummary | null;
  owner?: ContactSummary | null;
  amount: number;
  currency?: string;
  method: string;
  status: string;
  source?: string;
  paidAt?: string | null;
  paymentDate?: string | null;
  acceptedAt?: string | null;
  externalReference?: string | null;
  referenceNumber?: string | null;
  note?: string | null;
  internalNote?: string | null;
  linkedProof?: { id: string } | null;
  createdBy?: ContactSummary | null;
  acceptedBy?: ContactSummary | null;
  reversedAt?: string | null;
  reversalReason?: string | null;
  invoice?: InvoiceOption | null;
  reconciliation?: any;
  createdAt?: string;
};

type ApartmentSummary = {
  id: string;
  number?: string | null;
  apartmentNumber?: string | null;
  building?: { id: string; name: string } | null;
  staircase?: { id: string; name: string } | null;
  entrance?: { id: string; name: string } | null;
  floor?: number | null;
  areaM2?: number | null;
};

type ContactSummary = {
  id?: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  hasUserAccount?: boolean;
};

type InvoiceOption = {
  id: string;
  invoiceNumber?: string | null;
  billingMonth?: string | null;
  status?: string;
  totalAmount?: number;
  total?: number;
  paidAmount?: number;
  balanceAmount?: number;
  remainingAmount?: number;
  dueDate?: string | null;
  apartment?: ApartmentSummary | null;
  resident?: ContactSummary | null;
  owner?: ContactSummary | null;
};

type ApartmentBalance = {
  apartment: ApartmentSummary | null;
  resident?: ContactSummary | null;
  totalInvoiced: number;
  totalPaid: number;
  totalRemaining: number;
  balance: number;
  overdueAmount: number;
  overpaidAmount: number;
  unpaidInvoicesCount: number;
  partiallyPaidInvoicesCount: number;
  paidInvoicesCount: number;
  lastPaymentAt?: string | null;
  status: 'CLEAR' | 'DEBT' | 'OVERPAID' | 'PARTIAL';
};

type LedgerEntry = {
  id: string;
  type: 'INVOICE' | 'PAYMENT' | 'REVERSAL' | 'ADJUSTMENT';
  date?: string | null;
  amount: number;
  runningBalance: number;
  invoice?: InvoiceOption | null;
  payment?: AdminPayment | null;
};

const methodLabels: Record<string, string> = {
  CASH: 'Numerar',
  BANK: 'Bancă',
  BANK_TRANSFER: 'Transfer bancar',
  MANUAL_BANK_TRANSFER: 'Transfer bancar manual',
  TERMINAL: 'Terminal',
  CARD: 'Card',
  CARD_EXTERNAL: 'Card extern',
  BANK_STATEMENT: 'Extras bancar',
  ADJUSTMENT: 'Ajustare',
  OTHER: 'Altă metodă',
};

const statusLabels: Record<string, string> = {
  PENDING: 'În așteptare',
  ACCEPTED: 'Acceptată',
  PARTIALLY_ACCEPTED: 'Parțial acceptată',
  CONFIRMED: 'Confirmată',
  REJECTED: 'Respinsă',
  FAILED: 'Eșuată',
  CANCELLED: 'Anulată',
  REVERSED: 'Reversed',
};

const sourceLabels: Record<string, string> = {
  PAYMENT_PROOF: 'Dovadă plată',
  MANUAL_ENTRY: 'Manual',
  IMPORT: 'Import',
  ADJUSTMENT: 'Ajustare',
  SYSTEM: 'Sistem',
};

const issueLabels: Record<string, string> = {
  PAYMENT_WITHOUT_INVOICE: 'Plată fără factură',
  PAYMENT_AMOUNT_EXCEEDS_REMAINING: 'Supraplată',
  INVOICE_PARTIALLY_PAID: 'Factură parțial achitată',
  INVOICE_OVERDUE: 'Factură restantă',
  APARTMENT_HAS_DEBT: 'Apartament cu datorie',
  APARTMENT_OVERPAID: 'Apartament cu supraplată',
  PAYMENT_REVERSED: 'Plată reversată',
  DUPLICATE_PAYMENT_REFERENCE: 'Referință duplicată',
  PAYMENT_CURRENCY_MISMATCH: 'Monedă diferită',
  PAYMENT_WITHOUT_PROOF: 'Plată fără dovadă',
  PROOF_ACCEPTED_WITHOUT_PAYMENT: 'Dovadă fără plată',
};

const initialForm = {
  invoiceId: '',
  apartmentId: '',
  amount: '',
  currency: 'MDL',
  method: 'CASH',
  paidAt: new Date().toISOString().slice(0, 10),
  externalReference: '',
  note: '',
  internalNote: '',
  confirmed: false,
};

export default function AdminPaymentsPage() {
  const localizedPath = useLocalizedPath();
  const [activeTab, setActiveTab] = useState<TabKey>('payments');
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [balances, setBalances] = useState<ApartmentBalance[]>([]);
  const [debtBalances, setDebtBalances] = useState<ApartmentBalance[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any>(null);
  const [selectedLedgerApartmentId, setSelectedLedgerApartmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [source, setSource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [manualOpen, setManualOpen] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceOption | null>(null);
  const [selectedApartment, setSelectedApartment] = useState<ApartmentSummary | null>(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [detailPayment, setDetailPayment] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reversePayment, setReversePayment] = useState<AdminPayment | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [reverseConfirmed, setReverseConfirmed] = useState(false);
  const [reverseBusy, setReverseBusy] = useState(false);

  const loadOverview = useCallback(async () => {
    const res = await paymentsApi.getAdminPaymentsOverview();
    setOverview(res.data || res);
  }, []);

  const loadPayments = useCallback(async () => {
    const res = await paymentsApi.getAdminPayments({
      search: search || undefined,
      status: status || undefined,
      method: method || undefined,
      source: source || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page: 1,
      limit: 75,
    });
    const data = res.data || res;
    setPayments(data.items || []);
  }, [dateFrom, dateTo, method, search, source, status]);

  const loadBalances = useCallback(async () => {
    const [allRes, debtsRes] = await Promise.all([
      paymentsApi.getAdminApartmentBalances({ page: 1, limit: 100 }),
      paymentsApi.getAdminApartmentBalances({ onlyWithDebt: true, page: 1, limit: 100 }),
    ]);
    setBalances((allRes.data || allRes).items || []);
    setDebtBalances((debtsRes.data || debtsRes).items || []);
  }, []);

  const loadIssues = useCallback(async () => {
    const res = await paymentsApi.getAdminReconciliationIssues({ page: 1, limit: 100 });
    const data = res.data || res;
    setIssues(data.issues || data.items || []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadOverview(), loadPayments(), loadBalances(), loadIssues()]);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca registrul de plăți.'));
    } finally {
      setLoading(false);
    }
  }, [loadBalances, loadIssues, loadOverview, loadPayments]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as TabKey | null;
    const invoiceId = params.get('invoiceId');
    if (tab && ['payments', 'balances', 'debts', 'issues', 'ledger'].includes(tab)) setActiveTab(tab);
    if (invoiceId) {
      setManualOpen(true);
      setInvoiceSearch(invoiceId);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!manualOpen) return;
    let active = true;
    paymentsApi
      .adminInvoiceSearch({ search: invoiceSearch || undefined, unpaidOnly: true })
      .then((res) => {
        if (!active) return;
        const items = (res.data || res).items || [];
        setInvoiceOptions(items);
        if (invoiceSearch && items.length === 1 && !selectedInvoice) selectInvoice(items[0]);
      })
      .catch(() => {
        if (active) setInvoiceOptions([]);
      });
    return () => {
      active = false;
    };
  }, [invoiceSearch, manualOpen, selectedInvoice]);

  async function refreshCurrentTab() {
    setSectionLoading(true);
    setError('');
    try {
      if (activeTab === 'payments') await loadPayments();
      if (activeTab === 'balances' || activeTab === 'debts') await loadBalances();
      if (activeTab === 'issues') await loadIssues();
      await loadOverview();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut reîncărca datele.'));
    } finally {
      setSectionLoading(false);
    }
  }

  async function runReconciliation() {
    setSectionLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await paymentsApi.recalculateAdminReconciliation();
      const data = res.data || res;
      setMessage(data.message || `Reconcilierea a recalculat ${data.recalculatedInvoices || 0} facturi.`);
      await loadAll();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut recalcula soldurile.'));
    } finally {
      setSectionLoading(false);
    }
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    setMethod('');
    setSource('');
    setDateFrom('');
    setDateTo('');
  }

  function openManualPayment(invoice?: InvoiceOption | null, apartment?: ApartmentSummary | null) {
    setManualOpen(true);
    setFormError('');
    setMessage('');
    setInvoiceSearch('');
    setInvoiceOptions([]);
    setSelectedInvoice(null);
    setSelectedApartment(apartment || null);
    setForm({
      ...initialForm,
      apartmentId: apartment?.id || '',
    });
    if (invoice) selectInvoice(invoice);
  }

  function selectInvoice(invoice: InvoiceOption) {
    setSelectedInvoice(invoice);
    const remaining = invoice.remainingAmount ?? invoice.balanceAmount ?? 0;
    setSelectedApartment(invoice.apartment || null);
    setForm((current) => ({
      ...current,
      invoiceId: invoice.id,
      apartmentId: invoice.apartment?.id || current.apartmentId,
      amount: remaining > 0 ? String(remaining) : current.amount,
    }));
  }

  async function createManualPayment() {
    setFormError('');
    const amount = Number(form.amount);
    if (!form.invoiceId && !form.apartmentId) {
      setFormError('Alege factura sau apartamentul.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Suma trebuie să fie mai mare decât 0.');
      return;
    }
    if (!form.paidAt || Number.isNaN(new Date(form.paidAt).getTime())) {
      setFormError('Data plății nu este validă.');
      return;
    }
    if (!form.confirmed) {
      setFormError('Confirmarea verificării manuale este obligatorie.');
      return;
    }
    setSaving(true);
    try {
      await paymentsApi.createAdminManualPayment({
        invoiceId: form.invoiceId || undefined,
        apartmentId: form.apartmentId || undefined,
        amount,
        currency: form.currency,
        method: form.method,
        paidAt: form.paidAt,
        externalReference: form.externalReference || undefined,
        note: form.note || undefined,
        internalNote: form.internalNote || undefined,
      });
      setManualOpen(false);
      setMessage('Plata manuală a fost înregistrată și soldul facturii a fost recalculat.');
      await loadAll();
    } catch (err: any) {
      setFormError(String(err?.message || 'Nu am putut înregistra plata.'));
    } finally {
      setSaving(false);
    }
  }

  async function openPaymentDetail(payment: AdminPayment) {
    setDetailLoading(true);
    setDetailPayment({ payment });
    try {
      const res = await paymentsApi.getAdminPayment(payment.id);
      setDetailPayment(res.data || res);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca detaliile plății.'));
    } finally {
      setDetailLoading(false);
    }
  }

  async function confirmReversePayment() {
    if (!reversePayment) return;
    if (!reverseReason.trim() || !reverseConfirmed) return;
    setReverseBusy(true);
    setError('');
    setMessage('');
    try {
      await paymentsApi.reverseAdminPayment(reversePayment.id, { reason: reverseReason.trim(), confirm: true });
      setReversePayment(null);
      setReverseReason('');
      setReverseConfirmed(false);
      setMessage('Plata a fost marcată ca reversed și soldul a fost recalculat.');
      await loadAll();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut reversa plata.'));
    } finally {
      setReverseBusy(false);
    }
  }

  async function loadApartmentLedger(apartmentId: string) {
    setSelectedLedgerApartmentId(apartmentId);
    if (!apartmentId) {
      setLedger(null);
      return;
    }
    setSectionLoading(true);
    try {
      const res = await paymentsApi.getAdminApartmentLedger(apartmentId);
      setLedger(res.data || res);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca ledgerul apartamentului.'));
      setLedger(null);
    } finally {
      setSectionLoading(false);
    }
  }

  async function exportCsv() {
    setError('');
    setMessage('');
    try {
      const res = await exportsApi.adminPaymentsCsv({
        status: status || undefined,
        method: method || undefined,
      });
      downloadBlob(res.data, 'registru-plati.csv');
      setMessage('Exportul CSV pentru plăți a fost generat.');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut genera exportul CSV.'));
    }
  }

  const o = overview || {};
  const activePayment = detailPayment?.payment || null;
  const manualOverpayWarning = selectedInvoice && Number(form.amount) > (selectedInvoice.remainingAmount ?? selectedInvoice.balanceAmount ?? 0);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Registru plăți"
        description="Urmărește plățile acceptate, soldurile și restanțele."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">MDL</Badge>
            <Button type="button" variant="secondary" onClick={() => setActiveTab('issues')}>
              <AlertTriangle className="h-4 w-4" />
              Probleme reconciliere
            </Button>
            <Button type="button" variant="secondary" isLoading={sectionLoading} onClick={runReconciliation}>
              <RotateCcw className="h-4 w-4" />
              Recalculează solduri
            </Button>
            <Button type="button" variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button type="button" onClick={() => openManualPayment()}>
              <Banknote className="h-4 w-4" />
              Adaugă plată manuală
            </Button>
          </div>
        }
      />

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Încasări luna curentă" value={formatMdl(o.paymentsThisMonth || 0)} description="Plăți acceptate" icon={<CalendarDays className="h-5 w-5" />} tone="success" />
        <StatCard label="Plăți acceptate" value={String(o.acceptedPayments || 0)} description={`${o.totalPayments || 0} plăți totale`} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Restanțe totale" value={formatMdl(o.totalOutstandingAmount || 0)} description={`${o.overdueInvoices || 0} facturi restante`} icon={<ReceiptText className="h-5 w-5" />} tone={(o.totalOutstandingAmount || 0) > 0 ? 'warning' : 'success'} />
        <StatCard label="Facturi neachitate" value={String(o.unpaidInvoices || 0)} description="Facturi publicate cu sold" icon={<FileText className="h-5 w-5" />} tone="warning" />
        <StatCard label="Apartamente cu datorii" value={String(o.apartmentsWithDebt || 0)} description={`${o.apartmentsWithOverpayment || 0} cu supraplată`} icon={<WalletCards className="h-5 w-5" />} tone={(o.apartmentsWithDebt || 0) > 0 ? 'warning' : 'success'} />
        <StatCard label="Plăți parțiale" value={String(o.partiallyPaidInvoices || 0)} description="Necesită follow-up" icon={<Banknote className="h-5 w-5" />} tone="warning" />
      </section>

      <Card className="p-2">
        <div className="flex flex-wrap gap-2">
          {[
            ['payments', 'Plăți'],
            ['balances', 'Solduri apartamente'],
            ['debts', 'Restanțe'],
            ['issues', 'Probleme'],
            ['ledger', 'Ledger apartament'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key as TabKey)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${activeTab === key ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {activeTab === 'payments' ? (
        <section className="space-y-4">
          <Card>
            <div className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.75fr_0.75fr_auto]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Caută factură, apartament, locatar sau referință" value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
              <Select label="Status" value={status} onChange={setStatus} options={[['', 'Toate'], ...Object.entries(statusLabels)]} />
              <Select label="Metodă" value={method} onChange={setMethod} options={[['', 'Toate'], ...Object.entries(methodLabels)]} />
              <Select label="Sursă" value={source} onChange={setSource} options={[['', 'Toate'], ...Object.entries(sourceLabels)]} />
              <Input label="De la" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              <Input label="Până la" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              <Button type="button" variant="secondary" onClick={resetFilters} className="self-end">
                Resetează
              </Button>
            </div>
          </Card>
          <PaymentsTable rows={payments} loading={loading || sectionLoading} localizedPath={localizedPath} onDetail={openPaymentDetail} onReverse={setReversePayment} />
        </section>
      ) : null}

      {activeTab === 'balances' ? (
        <BalancesTable rows={balances} loading={loading || sectionLoading} localizedPath={localizedPath} onLedger={loadApartmentLedger} onManualPayment={(apartment) => openManualPayment(null, apartment)} />
      ) : null}

      {activeTab === 'debts' ? (
        <BalancesTable rows={debtBalances} loading={loading || sectionLoading} localizedPath={localizedPath} debtsOnly onLedger={loadApartmentLedger} onManualPayment={(apartment) => openManualPayment(null, apartment)} />
      ) : null}

      {activeTab === 'issues' ? (
        <IssuesTable rows={issues} loading={loading || sectionLoading} localizedPath={localizedPath} onOpenInvoice={(invoice) => openManualPayment(invoice, invoice?.apartment || null)} />
      ) : null}

      {activeTab === 'ledger' ? (
        <section className="space-y-4">
          <Card>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <Select
                label="Apartament"
                value={selectedLedgerApartmentId}
                onChange={loadApartmentLedger}
                options={[
                  ['', 'Alege apartamentul'],
                  ...balances.map((row) => [row.apartment?.id || '', apartmentLabel(row.apartment)] as [string, string]),
                ]}
              />
              <Button type="button" variant="secondary" disabled={!selectedLedgerApartmentId} onClick={() => selectedLedgerApartmentId && loadApartmentLedger(selectedLedgerApartmentId)} className="self-end">
                <History className="h-4 w-4" />
                Reîncarcă ledger
              </Button>
            </div>
          </Card>
          <LedgerView ledger={ledger} loading={sectionLoading} localizedPath={localizedPath} />
        </section>
      ) : null}

      <Modal isOpen={manualOpen} onClose={() => setManualOpen(false)} maxWidth="2xl">
        <ModalHeader title="Adaugă plată manuală" onClose={() => setManualOpen(false)} />
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="relative block">
                <span className="label">Factură</span>
                <Search className="pointer-events-none absolute left-3 top-[2.35rem] z-10 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Caută după factură, apartament sau locatar" value={invoiceSearch} onChange={(event) => { setInvoiceSearch(event.target.value); setSelectedInvoice(null); }} />
              </label>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-border/70 bg-muted/20 p-2">
                {invoiceOptions.map((invoice) => (
                  <button
                    key={invoice.id}
                    type="button"
                    onClick={() => selectInvoice(invoice)}
                    className={`mb-2 w-full rounded-2xl border px-3 py-3 text-left text-sm transition last:mb-0 ${selectedInvoice?.id === invoice.id ? 'border-foreground bg-white' : 'border-border/60 bg-white/80 hover:bg-white'}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>{invoice.invoiceNumber || invoice.id}</strong>
                      <Badge variant={invoice.status === 'PARTIALLY_PAID' ? 'warning' : 'neutral'}>{invoice.status || 'PUBLISHED'}</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {apartmentLabel(invoice.apartment)} · {invoice.resident?.fullName || invoice.owner?.fullName || 'fără contact principal'}
                    </p>
                    <p className="mt-1 font-semibold">Sold {formatMdl(invoice.remainingAmount ?? invoice.balanceAmount ?? 0)} din {formatMdl(invoice.totalAmount ?? invoice.total ?? 0)}</p>
                  </button>
                ))}
                {!invoiceOptions.length ? <p className="px-3 py-4 text-sm text-muted-foreground">Nu există facturi neachitate pentru căutarea curentă. Poți înregistra plata pe apartament dacă este avans sau corecție manuală.</p> : null}
              </div>
            </div>

            {selectedApartment ? (
              <div className="rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm">
                <span className="text-muted-foreground">Apartament selectat</span>
                <p className="font-semibold text-foreground">{apartmentLabel(selectedApartment)}</p>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Sumă" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} type="number" required />
              <Field label="Monedă" value={form.currency} onChange={(value) => setForm({ ...form, currency: value })} required />
              <Select label="Metodă" value={form.method} onChange={(value) => setForm({ ...form, method: value })} options={Object.entries(methodLabels)} />
              <Field label="Data plății" value={form.paidAt} onChange={(value) => setForm({ ...form, paidAt: value })} type="date" required />
              <Field label="Referință externă" value={form.externalReference} onChange={(value) => setForm({ ...form, externalReference: value })} />
              <Field label="Notă" value={form.note} onChange={(value) => setForm({ ...form, note: value })} />
              <label className="md:col-span-2">
                <span className="label">Notă internă</span>
                <textarea className="input min-h-24" value={form.internalNote} onChange={(event) => setForm({ ...form, internalNote: event.target.value })} />
              </label>
            </div>
            {manualOverpayWarning ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                Suma depășește soldul facturii. Plata poate crea supraplată și va apărea în problemele de reconciliere.
              </div>
            ) : null}
            <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm">
              <input type="checkbox" className="mt-1" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} />
              <span>Confirm că plata a fost verificată manual. Nu se procesează plăți reale și nu se conectează procesatori externi.</span>
            </label>
            {formError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</p> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" disabled={saving} onClick={() => setManualOpen(false)}>Renunță</Button>
          <Button type="button" isLoading={saving} onClick={createManualPayment}>Salvează plata</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(activePayment)} onClose={() => setDetailPayment(null)} maxWidth="2xl">
        <ModalHeader title="Detalii plată" onClose={() => setDetailPayment(null)} />
        <ModalBody>
          {detailLoading ? <p className="text-sm text-muted-foreground">Se încarcă detaliile...</p> : null}
          {activePayment ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Info label="Sumă" value={formatMdl(activePayment.amount || 0)} strong />
                <Info label="Status" value={statusLabels[activePayment.status] || activePayment.status} />
                <Info label="Metodă" value={methodLabels[activePayment.method] || activePayment.method} />
                <Info label="Sursă" value={sourceLabels[activePayment.source || ''] || activePayment.source || '-'} />
                <Info label="Factura" value={activePayment.invoiceNumber || activePayment.invoice?.invoiceNumber || '-'} />
                <Info label="Apartament" value={apartmentLabel(activePayment.apartment || activePayment.invoice?.apartment)} />
                <Info label="Data plății" value={formatDate(activePayment.paidAt || activePayment.paymentDate)} />
                <Info label="Acceptată la" value={formatDate(activePayment.acceptedAt)} />
                <Info label="Referință" value={activePayment.externalReference || activePayment.referenceNumber || '-'} />
                <Info label="Dovadă plată" value={activePayment.linkedProof?.id || activePayment.paymentProofId || '-'} />
              </div>
              {activePayment.note || activePayment.internalNote ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <NoteCard title="Notă" value={activePayment.note} />
                  <NoteCard title="Notă internă" value={activePayment.internalNote} />
                </div>
              ) : null}
              {detailPayment?.reconciliation ? (
                <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
                  <strong className="text-foreground">{issueLabels[detailPayment.reconciliation.type] || detailPayment.reconciliation.type}</strong>
                  <p className="mt-1 text-muted-foreground">{detailPayment.reconciliation.message || detailPayment.reconciliation.recommendation || 'Reconciliere calculată automat.'}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter>
          {activePayment?.invoiceId ? <ButtonLink href={localizedPath(`/admin/invoices/${activePayment.invoiceId}`)} variant="secondary">Vezi factura</ButtonLink> : null}
          {activePayment && canReverse(activePayment) ? <Button type="button" variant="secondary" onClick={() => { setReversePayment(activePayment); setDetailPayment(null); }}>Reverse payment</Button> : null}
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(reversePayment)} onClose={() => setReversePayment(null)} maxWidth="lg">
        <ModalHeader title="Reverse payment" onClose={() => setReversePayment(null)} />
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Plata nu va fi ștearsă. Va fi marcată ca reversed, iar soldul facturii va fi recalculat.
            </p>
            <label className="block">
              <span className="label">Motiv *</span>
              <textarea className="input min-h-24" value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} />
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm">
              <input type="checkbox" className="mt-1" checked={reverseConfirmed} onChange={(event) => setReverseConfirmed(event.target.checked)} />
              <span>Confirm reversal-ul acestei plăți.</span>
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" disabled={reverseBusy} onClick={() => setReversePayment(null)}>Renunță</Button>
          <Button type="button" variant="danger" isLoading={reverseBusy} disabled={!reverseReason.trim() || !reverseConfirmed} onClick={confirmReversePayment}>Reverse payment</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function PaymentsTable({ rows, loading, localizedPath, onDetail, onReverse }: { rows: AdminPayment[]; loading: boolean; localizedPath: (path: string) => string; onDetail: (payment: AdminPayment) => void; onReverse: (payment: AdminPayment) => void }) {
  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
      <div className="hidden grid-cols-[1fr_1fr_1fr_1.1fr_0.8fr_0.9fr_0.8fr_0.8fr_1.25fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground xl:grid">
        <span>Plată</span>
        <span>Factură</span>
        <span>Apartament</span>
        <span>Locatar/Proprietar</span>
        <span>Sumă</span>
        <span>Metodă</span>
        <span>Status</span>
        <span>Sursă</span>
        <span>Acțiuni</span>
      </div>
      {rows.map((payment) => (
        <div key={payment.id} className="grid gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0 xl:grid-cols-[1fr_1fr_1fr_1.1fr_0.8fr_0.9fr_0.8fr_0.8fr_1.25fr] xl:items-center">
          <div>
            <strong className="text-foreground">{formatDate(payment.paidAt || payment.paymentDate)}</strong>
            <p className="text-xs text-muted-foreground">{payment.externalReference || payment.referenceNumber || payment.id.slice(0, 8)}</p>
          </div>
          <span className="font-medium text-foreground">{payment.invoiceNumber || '-'}</span>
          <span className="text-muted-foreground">{apartmentLabel(payment.apartment)}</span>
          <span className="text-muted-foreground">{payment.resident?.fullName || payment.owner?.fullName || '-'}</span>
          <strong className="text-foreground">{formatMdl(payment.amount || 0)}</strong>
          <span className="text-muted-foreground">{methodLabels[payment.method] || payment.method}</span>
          <Badge variant={statusVariant(payment.status)}>{statusLabels[payment.status] || payment.status}</Badge>
          <span className="text-muted-foreground">{sourceLabels[payment.source || ''] || payment.source || '-'}</span>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="secondary" onClick={() => onDetail(payment)}>Deschide</Button>
            {payment.invoiceId ? <ButtonLink href={localizedPath(`/admin/invoices/${payment.invoiceId}`)} size="sm" variant="secondary">Factura</ButtonLink> : null}
            {payment.linkedProof?.id ? <Badge variant="neutral">Dovadă</Badge> : null}
            {canReverse(payment) ? <Button type="button" size="sm" variant="secondary" onClick={() => onReverse(payment)}>Reverse</Button> : null}
          </div>
        </div>
      ))}
      {loading ? <div className="px-4 py-8 text-sm font-medium text-muted-foreground">Se încarcă plățile...</div> : null}
      {!loading && !rows.length ? <EmptyState title="Nu există plăți înregistrate încă." description="După ce accepți dovezi de plată sau adaugi manual o plată, aceasta va apărea aici." /> : null}
    </section>
  );
}

function BalancesTable({ rows, loading, localizedPath, debtsOnly, onLedger, onManualPayment }: { rows: ApartmentBalance[]; loading: boolean; localizedPath: (path: string) => string; debtsOnly?: boolean; onLedger: (apartmentId: string) => void; onManualPayment: (apartment: ApartmentSummary | null) => void }) {
  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
      <div className="hidden grid-cols-[1fr_1.1fr_0.9fr_0.9fr_0.9fr_0.9fr_0.9fr_1.2fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground xl:grid">
        <span>Apartament</span>
        <span>Locatar/Proprietar</span>
        <span>Total facturat</span>
        <span>Total achitat</span>
        <span>Sold</span>
        <span>Restanță</span>
        <span>Status</span>
        <span>Acțiuni</span>
      </div>
      {rows.map((row) => (
        <div key={row.apartment?.id || apartmentLabel(row.apartment)} className="grid gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0 xl:grid-cols-[1fr_1.1fr_0.9fr_0.9fr_0.9fr_0.9fr_0.9fr_1.2fr] xl:items-center">
          <div>
            <strong>{apartmentLabel(row.apartment)}</strong>
            <p className="text-xs text-muted-foreground">{row.lastPaymentAt ? `Ultima plată ${formatDate(row.lastPaymentAt)}` : 'Fără plată înregistrată'}</p>
          </div>
          <span className="text-muted-foreground">{row.resident?.fullName || '-'}</span>
          <span className="font-medium">{formatMdl(row.totalInvoiced || 0)}</span>
          <span className="font-medium">{formatMdl(row.totalPaid || 0)}</span>
          <span className="font-semibold">{formatMdl(row.totalRemaining || row.balance || 0)}</span>
          <span className="font-medium text-amber-700">{formatMdl(row.overdueAmount || 0)}</span>
          <Badge variant={balanceVariant(row.status)}>{balanceLabel(row.status)}</Badge>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="secondary" onClick={() => row.apartment?.id && onLedger(row.apartment.id)}>Ledger</Button>
            {row.apartment?.id ? <ButtonLink href={localizedPath(`/admin/invoices?apartmentId=${row.apartment.id}`)} size="sm" variant="secondary">Facturi</ButtonLink> : null}
            <Button type="button" size="sm" variant="secondary" onClick={() => onManualPayment(row.apartment)}>Adaugă plată</Button>
          </div>
        </div>
      ))}
      {loading ? <div className="px-4 py-8 text-sm font-medium text-muted-foreground">Se încarcă soldurile...</div> : null}
      {!loading && !rows.length ? <EmptyState title={debtsOnly ? 'Nu există restanțe detectate.' : 'Nu există facturi publicate pentru calcularea soldurilor.'} description={debtsOnly ? 'Apartamentele cu datorii vor apărea aici după publicarea facturilor.' : 'După publicarea facturilor și înregistrarea plăților, soldurile vor apărea aici.'} /> : null}
    </section>
  );
}

function IssuesTable({ rows, loading, localizedPath, onOpenInvoice }: { rows: any[]; loading: boolean; localizedPath: (path: string) => string; onOpenInvoice: (invoice: InvoiceOption | null) => void }) {
  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
      <div className="hidden grid-cols-[1.1fr_1fr_0.75fr_0.8fr_1.4fr_1fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground xl:grid">
        <span>Problemă</span>
        <span>Entitate</span>
        <span>Severitate</span>
        <span>Suma</span>
        <span>Recomandare</span>
        <span>Acțiuni</span>
      </div>
      {rows.map((issue) => (
        <div key={issue.id || `${issue.type}-${issue.invoice?.id || issue.payment?.id || issue.apartment?.id}`} className="grid gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0 xl:grid-cols-[1.1fr_1fr_0.75fr_0.8fr_1.4fr_1fr] xl:items-center">
          <strong>{issueLabels[issue.type] || issue.type}</strong>
          <span className="text-muted-foreground">{issue.invoice?.invoiceNumber || issue.payment?.invoiceNumber || apartmentLabel(issue.apartment) || '-'}</span>
          <Badge variant={severityVariant(issue.severity)}>{issue.severity || 'INFO'}</Badge>
          <span className="font-medium">{issue.amount ? formatMdl(issue.amount) : '-'}</span>
          <span className="text-muted-foreground">{issue.recommendation || '-'}</span>
          <div className="flex flex-wrap gap-1.5">
            {issue.invoice?.id ? <ButtonLink href={localizedPath(`/admin/invoices/${issue.invoice.id}`)} size="sm" variant="secondary">Factura</ButtonLink> : null}
            {issue.invoice ? <Button type="button" size="sm" variant="secondary" onClick={() => onOpenInvoice(issue.invoice)}>Adaugă plată</Button> : null}
          </div>
        </div>
      ))}
      {loading ? <div className="px-4 py-8 text-sm font-medium text-muted-foreground">Se încarcă problemele...</div> : null}
      {!loading && !rows.length ? <EmptyState title="Nu există probleme de reconciliere detectate." description="Supraplățile, plățile fără factură și restanțele vor apărea aici când există date reale." /> : null}
    </section>
  );
}

function LedgerView({ ledger, loading, localizedPath }: { ledger: any; loading: boolean; localizedPath: (path: string) => string }) {
  if (loading) return <Card className="p-6 text-sm font-medium text-muted-foreground">Se încarcă ledgerul...</Card>;
  if (!ledger) return <Card className="p-6"><EmptyState title="Alege un apartament pentru ledger." description="Vei vedea facturile, plățile, reversal-urile și soldul curent cronologic." /></Card>;
  const entries: LedgerEntry[] = ledger.entries || [];
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total facturat" value={formatMdl(ledger.summary?.totalInvoiced || 0)} icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Total achitat" value={formatMdl(ledger.summary?.totalPaid || 0)} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Sold" value={formatMdl(ledger.summary?.totalRemaining || 0)} icon={<WalletCards className="h-5 w-5" />} tone={(ledger.summary?.totalRemaining || 0) > 0 ? 'warning' : 'success'} />
        <StatCard label="Restanță" value={formatMdl(ledger.summary?.overdueAmount || 0)} icon={<AlertTriangle className="h-5 w-5" />} tone={(ledger.summary?.overdueAmount || 0) > 0 ? 'warning' : 'success'} />
      </section>
      <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
        {entries.map((entry) => (
          <div key={`${entry.type}-${entry.id}`} className="grid gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[0.9fr_0.8fr_1.4fr_0.8fr_0.8fr_1fr] md:items-center">
            <span className="text-muted-foreground">{formatDate(entry.date)}</span>
            <Badge variant={entry.type === 'INVOICE' ? 'neutral' : entry.type === 'REVERSAL' ? 'warning' : 'success'}>{entry.type}</Badge>
            <span className="font-medium">{entry.invoice?.invoiceNumber || entry.payment?.externalReference || entry.payment?.invoiceNumber || entry.id}</span>
            <span className="font-semibold">{formatMdl(Math.abs(entry.amount || 0))}</span>
            <span className="font-semibold">{formatMdl(entry.runningBalance || 0)}</span>
            <div className="flex flex-wrap gap-1.5">
              {entry.invoice?.id ? <ButtonLink href={localizedPath(`/admin/invoices/${entry.invoice.id}`)} size="sm" variant="secondary">Factura</ButtonLink> : null}
            </div>
          </div>
        ))}
        {!entries.length ? <EmptyState title="Ledgerul nu are intrări încă." description="După publicarea facturilor sau înregistrarea plăților, istoricul va apărea aici." /> : null}
      </section>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
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

function NoteCard({ title, value }: { title: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm">
      <strong className="text-foreground">{title}</strong>
      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{value || '-'}</p>
    </div>
  );
}

function canReverse(payment: AdminPayment) {
  return ['ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONFIRMED'].includes(payment.status);
}

function statusVariant(status?: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (status === 'ACCEPTED' || status === 'PARTIALLY_ACCEPTED' || status === 'CONFIRMED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'REJECTED' || status === 'FAILED') return 'error';
  return 'neutral';
}

function severityVariant(severity?: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (severity === 'CRITICAL' || severity === 'ERROR') return 'error';
  if (severity === 'WARNING') return 'warning';
  return 'neutral';
}

function balanceVariant(status?: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (status === 'CLEAR') return 'success';
  if (status === 'OVERPAID') return 'neutral';
  return 'warning';
}

function balanceLabel(status?: string) {
  if (status === 'CLEAR') return 'La zi';
  if (status === 'OVERPAID') return 'Supraplată';
  if (status === 'PARTIAL') return 'Parțial';
  if (status === 'DEBT') return 'Datorie';
  return status || '-';
}

function apartmentLabel(apartment?: ApartmentSummary | null) {
  if (!apartment) return '-';
  const number = apartment.apartmentNumber || apartment.number || '-';
  const building = apartment.building?.name ? `Bloc ${apartment.building.name}` : '';
  const entrance = apartment.staircase?.name || apartment.entrance?.name ? `Sc. ${apartment.staircase?.name || apartment.entrance?.name}` : '';
  return [building, entrance, `Apt. ${number}`].filter(Boolean).join(' · ');
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
