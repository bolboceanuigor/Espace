'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileText,
  Home,
  ReceiptText,
  Wallet,
} from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'VOID';
type PaymentStatus = 'CONFIRMED' | 'CANCELLED';
type FinancialStatus = 'UP_TO_DATE' | 'BALANCE_DUE' | 'PARTIALLY_PAID' | 'NO_INVOICES' | 'NO_APARTMENT';

type DashboardApartment = {
  id: string;
  apartmentNumber: string;
  staircase?: string | null;
  building?: string | null;
  floor?: string | null;
  areaM2?: number | null;
  rooms?: number | null;
  role?: string | null;
  isPrimaryContact?: boolean;
};

type DashboardInvoice = {
  id: string;
  invoiceNumber: string;
  billingMonth: string;
  apartmentId?: string;
  apartmentNumber: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: InvoiceStatus;
  dueDate?: string | null;
  issueDate?: string | null;
  isOverdue?: boolean;
};

type DashboardPayment = {
  id: string;
  amount: number;
  currency: 'MDL';
  paymentDate?: string | null;
  method: string;
  status: PaymentStatus;
  invoiceNumber?: string;
  invoiceId?: string;
  apartmentNumber?: string;
  apartmentId?: string;
};

type ApartmentSummary = {
  apartmentId: string;
  apartmentNumber: string;
  staircase?: string | null;
  floor?: string | null;
  areaM2?: number | null;
  role?: string | null;
  isPrimaryContact?: boolean;
  currentBalance: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  lastInvoiceBillingMonth?: string | null;
  lastPaymentDate?: string | null;
};

type DashboardAlert = {
  type: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
};

type ResidentDashboard = {
  user: {
    id: string;
    fullName?: string;
    email?: string;
  };
  association: {
    id: string | null;
    legalName: string;
    shortName: string;
    associationCode?: string | null;
    address?: string | null;
  };
  apartments: DashboardApartment[];
  selectedApartmentId?: string | null;
  financialSummary: {
    currency: 'MDL';
    currentBalance: number;
    totalInvoices: number;
    unpaidInvoices: number;
    partiallyPaidInvoices: number;
    paidInvoices: number;
    overdueInvoices: number;
    totalPaidAmount: number;
    status: FinancialStatus;
    nextDueDate?: string | null;
    lastInvoice?: DashboardInvoice | null;
    lastPayment?: DashboardPayment | null;
  };
  apartmentSummaries: ApartmentSummary[];
  recentInvoices: DashboardInvoice[];
  recentPayments: DashboardPayment[];
  alerts: DashboardAlert[];
  emptyStateCode?: string | null;
  emptyStateMessage?: string | null;
};

const emptyDashboard: ResidentDashboard = {
  user: { id: '', fullName: 'Locatar' },
  association: {
    id: null,
    legalName: 'Asociația de Proprietari din Condominiu',
    shortName: 'A.P.C.',
    associationCode: null,
    address: null,
  },
  apartments: [],
  selectedApartmentId: null,
  financialSummary: {
    currency: 'MDL',
    currentBalance: 0,
    totalInvoices: 0,
    unpaidInvoices: 0,
    partiallyPaidInvoices: 0,
    paidInvoices: 0,
    overdueInvoices: 0,
    totalPaidAmount: 0,
    status: 'NO_INVOICES',
    nextDueDate: null,
    lastInvoice: null,
    lastPayment: null,
  },
  apartmentSummaries: [],
  recentInvoices: [],
  recentPayments: [],
  alerts: [],
  emptyStateCode: null,
};

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  ISSUED: 'Emisă',
  PARTIALLY_PAID: 'Parțial achitată',
  PAID: 'Achitată',
  CANCELLED: 'Anulată',
  VOID: 'Void',
};

const methodLabels: Record<string, string> = {
  CASH: 'Numerar',
  BANK_TRANSFER: 'Transfer bancar',
  CARD_TERMINAL: 'Terminal card',
  INFOCOM: 'InfoCom',
  OPLATA: 'Oplata',
  OTHER: 'Altă metodă',
};

const roleLabels: Record<string, string> = {
  OWNER: 'Proprietar',
  TENANT: 'Chiriaș',
  RESIDENT: 'Locatar',
  REPRESENTATIVE: 'Reprezentant',
  FAMILY_MEMBER: 'Membru familie',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' });
}

function monthLabel(value?: string | null) {
  if (!value) return '-';
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Date(year, month - 1, 1).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
}

function labelFromMap(map: Record<string, string>, value?: string | null, fallback = '-') {
  if (!value) return fallback;
  return map[String(value).toUpperCase()] || value;
}

function statusCopy(summary: ResidentDashboard['financialSummary']) {
  if (summary.totalInvoices === 0 || summary.status === 'NO_INVOICES') {
    return {
      label: 'Nu există facturi emise',
      text: 'Facturile interne vor apărea aici după ce administratorul le generează.',
      badge: 'neutral' as const,
    };
  }
  if (summary.currentBalance <= 0 || summary.status === 'UP_TO_DATE') {
    return {
      label: 'La zi',
      text: 'Ești la zi cu plățile.',
      badge: 'success' as const,
    };
  }
  if (summary.partiallyPaidInvoices > 0 || summary.status === 'PARTIALLY_PAID') {
    return {
      label: 'Facturi parțial achitate',
      text: `Ai un sold restant de ${formatMdl(summary.currentBalance)}.`,
      badge: 'warning' as const,
    };
  }
  return {
    label: 'Sold restant',
    text: `Ai un sold restant de ${formatMdl(summary.currentBalance)}.`,
    badge: 'warning' as const,
  };
}

export default function ResidentDashboardPage() {
  const localizedPath = useLocalizedPath();
  const [dashboard, setDashboard] = useState<ResidentDashboard>(emptyDashboard);
  const [selectedApartmentId, setSelectedApartmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    residentDemoApi
      .dashboard({ apartmentId: selectedApartmentId || undefined, includeRecent: true })
      .then((response) => {
        if (!active) return;
        setDashboard({ ...emptyDashboard, ...(response.data || {}) });
      })
      .catch((err: any) => {
        if (!active) return;
        setDashboard(emptyDashboard);
        setError(String(err?.message || 'Nu am putut încărca dashboard-ul financiar.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedApartmentId]);

  const summary = dashboard.financialSummary;
  const currentStatus = useMemo(() => statusCopy(summary), [summary]);
  const apartmentLabel = dashboard.apartments.length
    ? dashboard.apartments.map((apartment) => `Apt. ${apartment.apartmentNumber}`).join(', ')
    : 'Fără apartament asociat';
  const hasApartment = dashboard.apartments.length > 0;

  if (!loading && !hasApartment) {
    return (
      <div className="space-y-5 pb-24 md:pb-6">
        <PageHeader
          title="Acasă"
          description="Situația ta financiară și informațiile apartamentului într-un singur loc."
          rightSlot={<Badge variant="neutral">{dashboard.association.shortName}</Badge>}
        />
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Home className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-foreground">Nu ai un apartament asociat contului</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Pentru a vedea facturile și plățile, contul tău trebuie legat de un apartament de către administratorul asociației.
          </p>
          {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <ButtonLink href="/resident/profile" variant="secondary">Vezi profilul meu</ButtonLink>
            <ButtonLink href="/resident/announcements" variant="secondary">Vezi avizierul</ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      <PageHeader
        title="Acasă"
        description="Situația ta financiară și informațiile apartamentului într-un singur loc."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{dashboard.association.shortName}</Badge>
            <Badge variant="neutral">{dashboard.association.associationCode || 'cod A.P.C. necompletat'}</Badge>
            <Badge variant="neutral">MDL</Badge>
          </div>
        }
      />

      {loading ? <Card className="h-28 animate-pulse bg-muted/40" /> : null}
      {error ? <Card className="border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{error}</Card> : null}

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Bună, {dashboard.user.fullName || dashboard.user.email || 'Locatar'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {dashboard.association.shortName} · {apartmentLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {dashboard.apartments.length > 1 ? (
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                Apartament
                <select
                  value={selectedApartmentId}
                  onChange={(event) => setSelectedApartmentId(event.target.value)}
                  className="h-10 rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/25"
                >
                  <option value="">Toate apartamentele</option>
                  {dashboard.apartments.map((apartment) => (
                    <option key={apartment.id} value={apartment.id}>Apartament {apartment.apartmentNumber}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <ButtonLink href="/resident/profile" variant="secondary">Profilul meu</ButtonLink>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="grid gap-4 bg-foreground p-5 text-background lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm opacity-75">Sold curent</p>
              <Badge variant={currentStatus.badge}>{currentStatus.label}</Badge>
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal">{formatMdl(summary.currentBalance)}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 opacity-80">
              {summary.unpaidInvoices > 0 && summary.nextDueDate
                ? `Ai ${summary.unpaidInvoices} facturi neachitate, cea mai apropiată scadență este ${formatDate(summary.nextDueDate)}.`
                : currentStatus.text}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/resident/invoices" variant="secondary">Vezi facturi</ButtonLink>
            <ButtonLink href="/resident/payments" variant="secondary">Vezi plăți</ButtonLink>
          </div>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <MiniInfo label="Următoarea scadență" value={formatDate(summary.nextDueDate)} />
          <MiniInfo label="Facturi neachitate" value={String(summary.unpaidInvoices)} />
          <MiniInfo label="Ultima plată" value={formatDate(summary.lastPayment?.paymentDate)} />
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sold curent" value={formatMdl(summary.currentBalance)} description="Facturi active" icon={<Wallet className="h-5 w-5" />} tone={summary.currentBalance > 0 ? 'warning' : 'success'} />
        <StatCard label="Total facturi" value={String(summary.totalInvoices)} description={`${summary.unpaidInvoices} neachitate`} icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Total achitat" value={formatMdl(summary.totalPaidAmount)} description="Plăți confirmate" icon={<Banknote className="h-5 w-5" />} tone="success" />
        <StatCard label="Facturi întârziate" value={String(summary.overdueInvoices)} description="Scadență depășită" icon={<CalendarClock className="h-5 w-5" />} tone={summary.overdueInvoices > 0 ? 'warning' : 'success'} />
        <StatCard label="Ultima factură" value={summary.lastInvoice ? monthLabel(summary.lastInvoice.billingMonth) : '-'} description={summary.lastInvoice?.invoiceNumber || 'Nicio factură'} icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Ultima plată" value={summary.lastPayment ? formatMdl(summary.lastPayment.amount) : '-'} description={formatDate(summary.lastPayment?.paymentDate)} icon={<CreditCard className="h-5 w-5" />} />
        <StatCard label="Achitate" value={String(summary.paidInvoices)} description="Facturi fără sold" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Parțial achitate" value={String(summary.partiallyPaidInvoices)} description="Facturi cu sold rămas" icon={<AlertCircle className="h-5 w-5" />} tone={summary.partiallyPaidInvoices > 0 ? 'warning' : 'neutral'} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">Atenționări</h2>
              <p className="text-sm text-muted-foreground">Mesaje simple despre situația financiară.</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {dashboard.alerts.map((alert) => (
              <div key={`${alert.type}-${alert.title}`} className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className={`mt-0.5 h-4 w-4 ${alert.severity === 'WARNING' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.message}</p>
                  </div>
                </div>
              </div>
            ))}
            {!dashboard.alerts.length ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                Nu există atenționări financiare pentru contul tău.
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">Apartamentele mele</h2>
              <p className="text-sm text-muted-foreground">Apartamentele asociate contului tău.</p>
            </div>
            <ButtonLink href="/resident/apartments" variant="secondary" size="sm">Vezi toate apartamentele</ButtonLink>
          </div>
          <div className="mt-4 space-y-3">
            {dashboard.apartmentSummaries.map((apartment) => (
              <ApartmentCard key={apartment.apartmentId} apartment={apartment} />
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Facturi recente</h2>
              <p className="text-sm text-muted-foreground">Ultimele facturi interne vizibile pentru contul tău.</p>
            </div>
            <ButtonLink href="/resident/invoices" variant="secondary" size="sm">Vezi toate facturile</ButtonLink>
          </div>
          <div className="mt-4 space-y-3">
            {dashboard.recentInvoices.map((invoice) => (
              <Link key={invoice.id} href={localizedPath(`/resident/invoices/${invoice.id}`)} className="block rounded-2xl border border-border/70 bg-muted/25 p-4 transition hover:bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{invoice.invoiceNumber}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{monthLabel(invoice.billingMonth)} · Apt. {invoice.apartmentNumber}</p>
                  </div>
                  <Badge variant={invoice.status === 'PAID' ? 'success' : invoice.status === 'CANCELLED' || invoice.status === 'VOID' ? 'neutral' : 'warning'}>
                    {invoice.isOverdue ? 'Întârziată' : invoiceStatusLabels[invoice.status]}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniInfo label="Total" value={formatMdl(invoice.totalAmount)} />
                  <MiniInfo label="Achitat" value={formatMdl(invoice.paidAmount)} />
                  <MiniInfo label="Sold" value={formatMdl(invoice.balanceAmount)} danger={invoice.balanceAmount > 0} />
                </div>
              </Link>
            ))}
            {!dashboard.recentInvoices.length ? (
              <EmptyBlock title="Nu ai facturi emise" text="Facturile interne vor apărea aici după ce administratorul le generează." />
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Plăți recente</h2>
              <p className="text-sm text-muted-foreground">Ultimele plăți înregistrate de administrator.</p>
            </div>
            <ButtonLink href="/resident/payments" variant="secondary" size="sm">Vezi toate plățile</ButtonLink>
          </div>
          <div className="mt-4 space-y-3">
            {dashboard.recentPayments.map((payment) => (
              <Link key={payment.id} href={localizedPath(`/resident/payments/${payment.id}`)} className="block rounded-2xl border border-border/70 bg-muted/25 p-4 transition hover:bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{formatMdl(payment.amount)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(payment.paymentDate)} · {methodLabels[payment.method] || payment.method}
                    </p>
                  </div>
                  <Badge variant={payment.status === 'CONFIRMED' ? 'success' : 'neutral'}>{payment.status === 'CONFIRMED' ? 'Confirmată' : 'Anulată'}</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <MiniInfo label="Factură" value={payment.invoiceNumber || '-'} />
                  <MiniInfo label="Apartament" value={`Apt. ${payment.apartmentNumber || '-'}`} />
                </div>
              </Link>
            ))}
            {!dashboard.recentPayments.length ? (
              <EmptyBlock title="Nu ai plăți înregistrate" text="Plățile vor apărea aici după ce administratorul le înregistrează." />
            ) : null}
          </div>
        </Card>
      </section>
    </div>
  );
}

function ApartmentCard({ apartment }: { apartment: ApartmentSummary }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4" />
            Apartament {apartment.apartmentNumber}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Scara {apartment.staircase || '-'} · Etaj {apartment.floor || '-'} · {apartment.areaM2 ? `${apartment.areaM2} m²` : 'suprafață lipsă'}
          </p>
        </div>
        <Badge variant={apartment.currentBalance > 0 ? 'warning' : 'success'}>
          {apartment.currentBalance > 0 ? 'Sold restant' : 'La zi'}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniInfo label="Rol" value={labelFromMap(roleLabels, apartment.role, 'Locatar')} />
        <MiniInfo label="Sold" value={formatMdl(apartment.currentBalance)} danger={apartment.currentBalance > 0} />
        <MiniInfo label="Neachitate" value={String(apartment.unpaidInvoices)} />
        <MiniInfo label="Ultima factură" value={monthLabel(apartment.lastInvoiceBillingMonth)} />
        <MiniInfo label="Ultima plată" value={formatDate(apartment.lastPaymentDate)} />
        <MiniInfo label="Contact principal" value={apartment.isPrimaryContact ? 'Da' : 'Nu'} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <ButtonLink href={`/resident/invoices?apartmentId=${apartment.apartmentId}`} variant="secondary" size="sm">Vezi facturile</ButtonLink>
        <ButtonLink href={`/resident/payments?apartmentId=${apartment.apartmentId}`} variant="secondary" size="sm">Vezi plățile</ButtonLink>
        <ButtonLink href={`/resident/apartments/${apartment.apartmentId}`} variant="secondary" size="sm">
          Detalii apartament
          <ArrowRight className="h-3.5 w-3.5" />
        </ButtonLink>
      </div>
    </div>
  );
}

function MiniInfo({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${danger ? 'text-rose-600' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function EmptyBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}
