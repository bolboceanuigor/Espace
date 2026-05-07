'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calculator, CalendarDays, CheckCircle2, Clock3, FileText, Search, Send } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { apartmentsApi, invoicesApi, paymentsApi } from '@/lib/api';
import { adminInvoices, invoiceStatusVariant, normalizeApiApartment, normalizeApiInvoice, type AdminApartment, type AdminInvoice, type InvoiceStatus } from '@/lib/admin-mvp-data';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

const months = ['Toate', 'Mai 2026', 'Aprilie 2026', 'Martie 2026'];
const statuses: Array<'Toate' | InvoiceStatus> = ['Toate', 'Achitat', 'Neachitat', 'Întârziat'];
const invoiceStatuses = {
  UNPAID: 'Neachitat',
  PAID: 'Achitat',
  OVERDUE: 'Întârziat',
} as const;
const emptyInvoiceForm = {
  apartmentId: '',
  month: String(new Date().getMonth() + 1),
  year: String(new Date().getFullYear()),
  amount: '',
  dueDate: new Date().toISOString().slice(0, 10),
  status: 'UNPAID' as keyof typeof invoiceStatuses,
};
const emptyGenerationForm = {
  month: String(new Date().getMonth() + 1),
  year: String(new Date().getFullYear()),
  dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 25).toISOString().slice(0, 10),
};

export default function AdminInvoicesPage() {
  const localizedPath = useLocalizedPath();
  const [month, setMonth] = useState('Toate');
  const [status, setStatus] = useState<'Toate' | InvoiceStatus>('Toate');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AdminInvoice[]>([]);
  const [apartmentRows, setApartmentRows] = useState<AdminApartment[]>([]);
  const [source, setSource] = useState<'loading' | 'api' | 'mock'>('loading');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyInvoiceForm);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [generationForm, setGenerationForm] = useState(emptyGenerationForm);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generationResult, setGenerationResult] = useState<{
    createdInvoicesCount: number;
    skippedDuplicatesCount: number;
    totalAmount: number;
  } | null>(null);

  const loadInvoices = async () => {
    const [invoiceRes, paymentRes, apartmentsRes] = await Promise.all([
      invoicesApi.list(),
      paymentsApi.list().catch(() => ({ data: [] })),
      apartmentsApi.list().catch(() => ({ data: [] })),
    ]);
    const apiRows = (invoiceRes.data || []).map((invoice) => normalizeApiInvoice(invoice, paymentRes.data || []));
    const apiApartments = (apartmentsRes.data || []).map(normalizeApiApartment);
    setRows(apiRows);
    setSource('api');
    setApartmentRows(apiApartments);
    setForm((current) => {
      if (current.apartmentId || !apiApartments[0]?.id) return current;
      return { ...current, apartmentId: apiApartments[0].id };
    });
  };

  useEffect(() => {
    let active = true;
    loadInvoices().catch(() => {
        if (!active) return;
        setRows(adminInvoices);
        setApartmentRows([]);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((invoice) => {
      const matchesSearch = !needle || `${invoice.apartment} ${invoice.staircase} ${invoice.month} ${invoice.invoiceNumber}`.toLowerCase().includes(needle);
      const matchesMonth = month === 'Toate' || invoice.month === month;
      const matchesStatus = status === 'Toate' || invoice.status === status;
      return matchesSearch && matchesMonth && matchesStatus;
    });
  }, [month, query, rows, status]);

  const currentMonths = ['Toate', ...Array.from(new Set(rows.map((invoice) => invoice.month)))];
  const totals = useMemo(() => ({
    issued: rows.length,
    paid: rows.filter((invoice) => invoice.status === 'Achitat'),
    unpaid: rows.filter((invoice) => invoice.status !== 'Achitat'),
    nextDue: rows.find((invoice) => invoice.status !== 'Achitat')?.dueDate || 'Nu există',
  }), [rows]);

  const createInvoice = async () => {
    setFormError('');
    setSuccessMessage('');
    const selectedApartment = apartmentRows.find((item) => item.id === form.apartmentId);
    const amount = Number(form.amount);
    const monthNumber = Number(form.month);
    const yearNumber = Number(form.year);
    if (!selectedApartment?.organizationId) {
      setFormError('Alege un apartament real din lista API.');
      return;
    }
    if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12 || !Number.isInteger(yearNumber)) {
      setFormError('Completează luna și anul.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Completează suma facturii.');
      return;
    }

    setIsCreating(true);
    try {
      await invoicesApi.create({
        organizationId: selectedApartment.organizationId,
        apartmentId: selectedApartment.id,
        month: monthNumber,
        year: yearNumber,
        amount,
        dueDate: form.dueDate,
        status: form.status,
      });
      setModalOpen(false);
      setForm({ ...emptyInvoiceForm, apartmentId: selectedApartment.id });
      setSuccessMessage('Factura a fost emisă.');
      setSource('api');
      await loadInvoices().catch(() => undefined);
    } catch (error: any) {
      const message = String(error?.message || '');
      setFormError(message.includes('există deja') ? 'Factura pentru acest apartament și această lună există deja.' : 'Nu am putut emite factura.');
    } finally {
      setIsCreating(false);
    }
  };

  const generateMonthlyInvoices = async () => {
    setGenerationError('');
    setSuccessMessage('');
    setGenerationResult(null);
    const monthNumber = Number(generationForm.month);
    const yearNumber = Number(generationForm.year);
    if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12 || !Number.isInteger(yearNumber)) {
      setGenerationError('Completează luna și anul.');
      return;
    }
    if (!generationForm.dueDate) {
      setGenerationError('Completează data scadentă.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await invoicesApi.generateMonthly({
        month: monthNumber,
        year: yearNumber,
        dueDate: generationForm.dueDate,
      });
      const result = response.data || {};
      const createdInvoicesCount = Number(result.createdInvoicesCount ?? result.createdCount ?? result.count ?? 0);
      const skippedDuplicatesCount = Number(result.skippedDuplicatesCount ?? result.skippedDuplicates ?? 0);
      const totalAmount = Number(result.totalAmount ?? 0);
      setGenerationResult({ createdInvoicesCount, skippedDuplicatesCount, totalAmount });
      setSuccessMessage(
        skippedDuplicatesCount > 0
          ? 'Facturile au fost generate. Unele facturi existau deja și au fost omise.'
          : 'Facturile au fost generate.',
      );
      setSource('api');
      await loadInvoices().catch(() => undefined);
    } catch (error: any) {
      const message = String(error?.message || '');
      setGenerationError(message || 'Nu am putut genera facturile lunare.');
    } finally {
      setIsGenerating(false);
    }
  };

  const exportCsv = () => {
    const headers = ['Apartament', 'Luna', 'Anul', 'Suma', 'Status', 'Data scadentă', 'Datorie'];
    const lines = filtered.map((invoice) => [
      `Apt. ${invoice.apartment}`,
      String(invoice.monthNumber || ''),
      String(invoice.yearNumber || ''),
      invoice.amount.toFixed(2),
      invoice.status,
      invoice.dueDate,
      Number(invoice.remainingDebt ?? (invoice.status === 'Achitat' ? 0 : invoice.amount)).toFixed(2),
    ]);
    const csv = [headers, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `facturi-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Facturi"
        description="Facturi lunare pe apartament, cu status de plată și scadențe."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
            </span>
            <Button type="button" variant="secondary" onClick={exportCsv}>Export CSV</Button>
            <ButtonLink href={localizedPath('/admin/payments')} variant="secondary">Vezi plăți</ButtonLink>
          </div>
        }
      />

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Facturi emise" value={String(totals.issued)} description="În evidența curentă" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Achitate" value={String(totals.paid.length)} description={formatMdl(totals.paid.reduce((sum, invoice) => sum + invoice.amount, 0))} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Neachitate" value={String(totals.unpaid.length)} description={formatMdl(totals.unpaid.reduce((sum, invoice) => sum + invoice.amount, 0))} icon={<Clock3 className="h-5 w-5" />} tone="danger" />
        <StatCard label="Următoarea scadență" value={totals.nextDue} description="Termen de plată curent" icon={<CalendarDays className="h-5 w-5" />} tone="warning" />
      </section>

      <Card>
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
          <div>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-muted/45 text-foreground">
              <Calculator className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-base font-semibold text-foreground">Generare facturi lunare</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Generează facturi reale pe baza tarifelor APC active: deservire bloc, fond reparație și fond dezvoltare.
            </p>
            <ButtonLink href="/admin/tariffs" variant="secondary" className="mt-4">Configurează tarife</ButtonLink>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <Field label="Luna" value={generationForm.month} onChange={(value) => setGenerationForm({ ...generationForm, month: value })} type="number" required />
            <Field label="Anul" value={generationForm.year} onChange={(value) => setGenerationForm({ ...generationForm, year: value })} type="number" required />
            <Field label="Data scadentă" value={generationForm.dueDate} onChange={(value) => setGenerationForm({ ...generationForm, dueDate: value })} type="date" required />
            <Button type="button" onClick={generateMonthlyInvoices} isLoading={isGenerating} className="self-end">
              Generează facturi
            </Button>
          </div>
        </div>
        {generationResult ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MiniResult label="Facturi create" value={String(generationResult.createdInvoicesCount)} />
            <MiniResult label="Omise duplicate" value={String(generationResult.skippedDuplicatesCount)} />
            <MiniResult label="Total generat" value={formatMdl(generationResult.totalAmount)} />
          </div>
        ) : null}
        {generationError ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {generationError}
          </p>
        ) : null}
      </Card>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută apartament, lună sau număr factură" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Select value={month} onChange={setMonth} options={currentMonths.length > 1 ? currentMonths : months} label="Luna" />
          <Select value={status} onChange={(value) => setStatus(value as 'Toate' | InvoiceStatus)} options={statuses} label="Status" />
          <Button type="button" onClick={() => setModalOpen(true)} className="self-end" variant="primary"><Send className="h-4 w-4" /> Emite factură</Button>
        </div>
      </Card>

      <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)] md:block">
        <div className="grid grid-cols-[1fr_0.8fr_0.9fr_0.9fr_0.9fr_0.9fr_auto] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Factura</span>
          <span>Apartament</span>
          <span>Luna</span>
          <span>Suma</span>
          <span>Scadență</span>
          <span>Status</span>
          <span />
        </div>
        {filtered.map((invoice) => (
          <div key={invoice.id} className="grid grid-cols-[1fr_0.8fr_0.9fr_0.9fr_0.9fr_0.9fr_auto] items-center gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0">
            <div>
              <p className="font-semibold text-foreground">{invoice.invoiceNumber}</p>
              <p className="text-xs text-muted-foreground">{invoice.paymentMethod ? `${invoice.paymentMethod} · ${invoice.paidDate}` : 'Așteaptă plată'}</p>
            </div>
            <span className="text-muted-foreground">Apt. {invoice.apartment}</span>
            <span className="text-muted-foreground">{invoice.month}</span>
            <span className="font-semibold text-foreground">{formatMdl(invoice.amount)}</span>
            <span className="text-muted-foreground">{invoice.dueDate}</span>
            <Badge variant={invoiceStatusVariant[invoice.status]}>{invoice.status}</Badge>
            <ButtonLink href={localizedPath(`/admin/invoices/${invoice.id}`)} size="sm" variant="secondary">Deschide</ButtonLink>
          </div>
        ))}
        {source === 'loading' ? <div className="px-4 py-8 text-sm font-medium text-muted-foreground">Se încarcă datele...</div> : null}
        {source !== 'loading' && !filtered.length ? <div className="px-4 py-8 text-sm font-medium text-muted-foreground">Nu există facturi încă.</div> : null}
      </section>

      <section className="grid gap-3 md:hidden">
        {filtered.map((invoice) => (
          <InvoiceCard key={invoice.id} invoice={invoice} href={localizedPath(`/admin/invoices/${invoice.id}`)} />
        ))}
        {source === 'loading' ? <Card className="p-5 text-sm font-medium text-muted-foreground">Se încarcă datele...</Card> : null}
        {source !== 'loading' && !filtered.length ? <Card className="p-5 text-sm font-medium text-muted-foreground">Nu există facturi încă.</Card> : null}
      </section>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="2xl">
        <ModalHeader title="Emite factură" onClose={() => setModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="label">Apartament</span>
              <select className="select" value={form.apartmentId} onChange={(event) => setForm({ ...form, apartmentId: event.target.value })}>
                <option value="">Alege apartamentul</option>
                {apartmentRows.map((apartment) => (
                  <option key={apartment.id} value={apartment.id}>Apt. {apartment.number} · {apartment.staircase}</option>
                ))}
              </select>
            </label>
            <Field label="Luna" value={form.month} onChange={(value) => setForm({ ...form, month: value })} type="number" required />
            <Field label="Anul" value={form.year} onChange={(value) => setForm({ ...form, year: value })} type="number" required />
            <Field label="Suma" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} type="number" required />
            <Field label="Data scadentă" value={form.dueDate} onChange={(value) => setForm({ ...form, dueDate: value })} type="date" required />
            <label className="block">
              <span className="label">Status</span>
              <select className="select" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as typeof form.status })}>
                {Object.entries(invoiceStatuses).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          {formError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {formError}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setModalOpen(false)} disabled={isCreating} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={createInvoice} disabled={isCreating} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {isCreating ? 'Se emite...' : 'Emite factură'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function InvoiceCard({ invoice, href }: { invoice: AdminInvoice; href: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">{invoice.invoiceNumber}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Apt. {invoice.apartment} · {invoice.month}</p>
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

function MiniResult({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
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

function Select({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: readonly string[]; label: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] outline-none focus:ring-2 focus:ring-foreground/10"
      >
        {options.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}
