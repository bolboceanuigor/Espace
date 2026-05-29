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
  Gauge,
  Home,
  MessageCircle,
  Megaphone,
  ReceiptText,
  Wallet,
} from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { communicationsApi, invoicesApi, metersApi, requestsApi, residentBalanceApi, residentDemoApi } from '@/lib/api';
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

type RecentAnnouncement = {
  id: string;
  title: string;
  excerpt?: string | null;
  category?: string | null;
  priority?: string | null;
  pinned?: boolean;
  publishedAt?: string | null;
  createdAt?: string | null;
  isRead?: boolean;
};

type RecentRequest = {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  apartment?: { apartmentNumber?: string | null } | null;
  updatedAt?: string | null;
  createdAt?: string | null;
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

type ResidentInvoicesOverview = {
  totalPublishedInvoices: number;
  unpaidInvoices: number;
  paidInvoices: number;
  partiallyPaidInvoices: number;
  overdueInvoices: number;
  totalUnpaidAmount: number;
  totalOverdueAmount: number;
  nextDueInvoice?: { invoiceNumber?: string | null; dueDate?: string | null; remainingAmount?: number; billingMonth?: string | null } | null;
  lastPublishedInvoice?: { invoiceNumber?: string | null; publishedAt?: string | null; billingMonth?: string | null } | null;
  apartmentsCount: number;
  currency: 'MDL';
};

type ResidentBalanceOverview = {
  totalUnpaidAmount: number;
  totalOverdueAmount: number;
  unpaidInvoicesCount: number;
  overdueInvoicesCount: number;
  pendingPaymentProofsCount: number;
  rejectedPaymentProofsCount?: number;
  nextDueInvoice?: { dueDate?: string | null; invoiceNumber?: string | null } | null;
  lastPayment?: { paidAt?: string | null; acceptedAt?: string | null; amount?: number | null } | null;
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

const announcementCategoryLabels: Record<string, string> = {
  GENERAL: 'General',
  MAINTENANCE: 'Mentenanță',
  PAYMENTS: 'Plăți',
  EMERGENCY: 'Urgență',
  MEETING: 'Ședință',
  DOCUMENTS: 'Documente',
  OTHER: 'Altul',
};

const requestStatusLabels: Record<string, string> = {
  NEW: 'Nouă',
  OPEN: 'Deschisă',
  IN_PROGRESS: 'În lucru',
  WAITING_RESIDENT: 'Așteaptă răspunsul tău',
  WAITING_VENDOR: 'Așteaptă prestator',
  RESOLVED: 'Rezolvată',
  CLOSED: 'Închisă',
  CANCELLED: 'Anulată',
};

const requestPriorityLabels: Record<string, string> = {
  LOW: 'Scăzută',
  NORMAL: 'Normală',
  HIGH: 'Înaltă',
  URGENT: 'Urgentă',
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
  const [recentAnnouncements, setRecentAnnouncements] = useState<RecentAnnouncement[]>([]);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [requestStats, setRequestStats] = useState<any>({});
  const [meterStats, setMeterStats] = useState<any>({});
  const [readingPeriodSummary, setReadingPeriodSummary] = useState<any>(null);
  const [invoiceOverview, setInvoiceOverview] = useState<ResidentInvoicesOverview | null>(null);
  const [balanceOverview, setBalanceOverview] = useState<ResidentBalanceOverview | null>(null);

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

  useEffect(() => {
    let active = true;
    communicationsApi
      .listRecentResidentAnnouncements()
      .then((response) => {
        if (!active) return;
        setRecentAnnouncements(response.data?.items || []);
      })
      .catch(() => {
        if (!active) return;
        setRecentAnnouncements([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    requestsApi
      .residentList({ limit: 3, sortBy: 'updatedAt' })
      .then((response) => {
        if (!active) return;
        setRecentRequests(response.data?.items || []);
        setRequestStats(response.data?.stats || {});
      })
      .catch(() => {
        if (!active) return;
        setRecentRequests([]);
        setRequestStats({});
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    metersApi
      .residentList({ apartmentId: selectedApartmentId || undefined })
      .then((response) => {
        if (!active) return;
        setMeterStats(response.data?.stats || {});
      })
      .catch(() => {
        if (!active) return;
        setMeterStats({});
      });
    metersApi
      .getResidentMeterReadingPeriods()
      .then((response) => {
        if (!active) return;
        const period = (response.data?.items || []).find((item: any) => Number(item.missingCount || 0) > 0 || Number(item.rejectedCount || 0) > 0);
        setReadingPeriodSummary(period || null);
      })
      .catch(() => {
        if (!active) return;
        setReadingPeriodSummary(null);
      });
    return () => {
      active = false;
    };
  }, [selectedApartmentId]);

  useEffect(() => {
    let active = true;
    invoicesApi
      .getResidentInvoicesOverview()
      .then((response) => {
        if (!active) return;
        setInvoiceOverview(response.data || null);
      })
      .catch(() => {
        if (!active) return;
        setInvoiceOverview(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    residentBalanceApi
      .getResidentBalanceOverview()
      .then((response) => {
        if (!active) return;
        setBalanceOverview(response.data || null);
      })
      .catch(() => {
        if (!active) return;
        setBalanceOverview(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const summary = dashboard.financialSummary;
  const currentBalance = balanceOverview?.totalUnpaidAmount ?? summary.currentBalance;
  const overdueBalance = balanceOverview?.totalOverdueAmount ?? 0;
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
            <h1 className="mt-3 text-4xl font-semibold tracking-normal">{formatMdl(currentBalance)}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 opacity-80">
              {(balanceOverview?.unpaidInvoicesCount || summary.unpaidInvoices) > 0 && (balanceOverview?.nextDueInvoice?.dueDate || summary.nextDueDate)
                ? `Ai ${balanceOverview?.unpaidInvoicesCount ?? summary.unpaidInvoices} facturi neachitate, cea mai apropiată scadență este ${formatDate(balanceOverview?.nextDueInvoice?.dueDate || summary.nextDueDate)}.`
                : currentStatus.text}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/resident/balance" variant="secondary">Vezi sold</ButtonLink>
            <ButtonLink href="/resident/invoices" variant="secondary">Vezi facturi</ButtonLink>
            <ButtonLink href="/resident/payments" variant="secondary">Vezi plăți</ButtonLink>
          </div>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <MiniInfo label="Următoarea scadență" value={formatDate(balanceOverview?.nextDueInvoice?.dueDate || summary.nextDueDate)} />
          <MiniInfo label="Facturi neachitate" value={String(balanceOverview?.unpaidInvoicesCount ?? summary.unpaidInvoices)} />
          <MiniInfo label="Ultima plată" value={formatDate(balanceOverview?.lastPayment?.acceptedAt || balanceOverview?.lastPayment?.paidAt || summary.lastPayment?.paymentDate)} />
        </div>
      </Card>

      <Card className="border-border/70 bg-white p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Facturi</h2>
              <Badge variant={(invoiceOverview?.overdueInvoices || 0) > 0 ? 'error' : (invoiceOverview?.totalUnpaidAmount || 0) > 0 ? 'warning' : 'success'}>
                {(invoiceOverview?.overdueInvoices || 0) > 0 ? 'Restanțe' : (invoiceOverview?.totalUnpaidAmount || 0) > 0 ? 'Neachitate' : 'La zi'}
              </Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {invoiceOverview?.totalPublishedInvoices
                ? `Ai ${invoiceOverview.unpaidInvoices} facturi neachitate și ${invoiceOverview.overdueInvoices} restante. Plata online va fi disponibilă ulterior.`
                : 'Nu există facturi publicate încă. Când administrația publică o factură, aceasta va apărea aici.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/resident/balance" variant="secondary">Vezi sold</ButtonLink>
            <ButtonLink href="/resident/invoices" variant="primary">Vezi facturi</ButtonLink>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <MiniInfo label="Total neachitat" value={formatMdl(invoiceOverview?.totalUnpaidAmount || 0)} danger={(invoiceOverview?.totalUnpaidAmount || 0) > 0} />
          <MiniInfo label="Următoarea scadență" value={formatDate(invoiceOverview?.nextDueInvoice?.dueDate)} danger={(invoiceOverview?.overdueInvoices || 0) > 0} />
          <MiniInfo label="Restante" value={String(invoiceOverview?.overdueInvoices || 0)} danger={(invoiceOverview?.overdueInvoices || 0) > 0} />
          <MiniInfo label="Achitate" value={String(invoiceOverview?.paidInvoices || 0)} />
        </div>
      </Card>

      {Number(balanceOverview?.pendingPaymentProofsCount || 0) > 0 || Number(balanceOverview?.rejectedPaymentProofsCount || 0) > 0 ? (
        <Card className={Number(balanceOverview?.rejectedPaymentProofsCount || 0) > 0 ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className={Number(balanceOverview?.rejectedPaymentProofsCount || 0) > 0 ? 'text-sm font-semibold text-rose-950' : 'text-sm font-semibold text-amber-950'}>
                {Number(balanceOverview?.rejectedPaymentProofsCount || 0) > 0 ? 'Ai dovezi de plată respinse' : 'Dovezi de plată în verificare'}
              </p>
              <p className={Number(balanceOverview?.rejectedPaymentProofsCount || 0) > 0 ? 'mt-1 text-sm text-rose-800' : 'mt-1 text-sm text-amber-800'}>
                {Number(balanceOverview?.rejectedPaymentProofsCount || 0) > 0
                  ? `${balanceOverview?.rejectedPaymentProofsCount} dovezi trebuie verificate sau retrimise.`
                  : `${balanceOverview?.pendingPaymentProofsCount} dovezi sunt în așteptarea verificării de către administrație.`}
              </p>
            </div>
            <ButtonLink href="/resident/payment-proofs" variant="secondary">
              <ReceiptText className="h-4 w-4" /> Vezi dovezile
            </ButtonLink>
          </div>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sold curent" value={formatMdl(currentBalance)} description={`${formatMdl(overdueBalance)} restante`} icon={<Wallet className="h-5 w-5" />} tone={currentBalance > 0 ? 'warning' : 'success'} />
        <StatCard label="Total facturi" value={String(summary.totalInvoices)} description={`${summary.unpaidInvoices} neachitate`} icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Total achitat" value={formatMdl(summary.totalPaidAmount)} description="Plăți confirmate" icon={<Banknote className="h-5 w-5" />} tone="success" />
        <StatCard label="Facturi întârziate" value={String(summary.overdueInvoices)} description="Scadență depășită" icon={<CalendarClock className="h-5 w-5" />} tone={summary.overdueInvoices > 0 ? 'warning' : 'success'} />
        <StatCard label="Ultima factură" value={summary.lastInvoice ? monthLabel(summary.lastInvoice.billingMonth) : '-'} description={summary.lastInvoice?.invoiceNumber || 'Nicio factură'} icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Ultima plată" value={summary.lastPayment ? formatMdl(summary.lastPayment.amount) : '-'} description={formatDate(summary.lastPayment?.paymentDate)} icon={<CreditCard className="h-5 w-5" />} />
        <StatCard label="Achitate" value={String(summary.paidInvoices)} description="Facturi fără sold" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Parțial achitate" value={String(summary.partiallyPaidInvoices)} description="Facturi cu sold rămas" icon={<AlertCircle className="h-5 w-5" />} tone={summary.partiallyPaidInvoices > 0 ? 'warning' : 'neutral'} />
        <StatCard label="Solicitări deschise" value={String(requestStats.open || 0)} description="Către administrație" icon={<MessageCircle className="h-5 w-5" />} tone={Number(requestStats.open || 0) > 0 ? 'warning' : 'neutral'} />
        <StatCard label="Contoare active" value={String(meterStats.activeMeters || 0)} description={`${meterStats.submittedCurrentMonth || 0} indici transmiși luna curentă`} icon={<Gauge className="h-5 w-5" />} />
      </section>

      {readingPeriodSummary ? (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-950">
                {Number(readingPeriodSummary.rejectedCount || 0) > 0 ? 'Ai citiri respinse' : 'Trimite citirile contoarelor'}
              </p>
              <p className="mt-1 text-sm text-amber-800">
                {Number(readingPeriodSummary.rejectedCount || 0) > 0
                  ? `${readingPeriodSummary.rejectedCount} citiri trebuie corectate pentru ${readingPeriodSummary.label || readingPeriodSummary.periodMonth}.`
                  : `${readingPeriodSummary.missingCount || 0} contoare așteaptă citirea pentru ${readingPeriodSummary.label || readingPeriodSummary.periodMonth}.`}
              </p>
            </div>
            <ButtonLink href="/resident/meters" variant="secondary">
              <Gauge className="h-4 w-4" /> Deschide contoare
            </ButtonLink>
          </div>
        </Card>
      ) : null}

      {Number(requestStats.waitingResident || requestStats.waitingForResident || 0) > 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-950">Adminul a cerut informații</p>
              <p className="mt-1 text-sm text-amber-800">
                Ai {requestStats.waitingResident || requestStats.waitingForResident} cereri care așteaptă răspunsul tău.
              </p>
            </div>
            <ButtonLink href="/resident/requests?status=WAITING_RESIDENT" variant="secondary">
              Deschide cererile
            </ButtonLink>
          </div>
        </Card>
      ) : null}

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

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Ai nevoie de ajutor?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ghiduri simple pentru facturi, plati, transmitere indici si solicitari.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/resident/help/cum-vad-facturile" variant="secondary" size="sm">Facturi</ButtonLink>
            <ButtonLink href="/resident/help/cum-vad-istoricul-platilor" variant="secondary" size="sm">Plati</ButtonLink>
            <ButtonLink href="/resident/help/cum-transmit-indicii-contoarelor" variant="secondary" size="sm">Indici</ButtonLink>
            <ButtonLink href="/resident/help" variant="primary" size="sm">Ajutor</ButtonLink>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Anunțuri recente</h2>
            <p className="text-sm text-muted-foreground">Ultimele informații publicate de administrația asociației.</p>
          </div>
          <ButtonLink href="/resident/announcements" variant="secondary" size="sm">Vezi toate anunțurile</ButtonLink>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recentAnnouncements.slice(0, 5).map((announcement) => (
            <Link
              key={announcement.id}
              href={localizedPath(`/resident/announcements/${announcement.id}`)}
              className={`rounded-2xl border p-4 transition hover:bg-white ${
                announcement.priority === 'URGENT'
                  ? 'border-rose-200 bg-rose-50/45'
                  : announcement.priority === 'HIGH'
                    ? 'border-amber-200 bg-amber-50/45'
                    : 'border-border/70 bg-muted/25'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <Megaphone className="h-3.5 w-3.5" />
                    {announcementCategoryLabels[String(announcement.category || 'GENERAL')] || announcement.category || 'General'}
                  </p>
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{announcement.title}</h3>
                </div>
                {!announcement.isRead ? <span className="rounded-full bg-foreground px-2 py-1 text-[11px] font-semibold text-background">Nou</span> : null}
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{announcement.excerpt || 'Anunț publicat pe avizier.'}</p>
              <p className="mt-3 text-xs text-muted-foreground">{formatDate(announcement.publishedAt || announcement.createdAt)}</p>
            </Link>
          ))}
          {!recentAnnouncements.length ? (
            <EmptyBlock title="Nu există anunțuri" text="Anunțurile publicate de administrator vor apărea aici." />
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Solicitări recente</h2>
            <p className="text-sm text-muted-foreground">Ultimele cereri trimise către administrație.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/resident/requests/new" variant="secondary" size="sm">Creează solicitare</ButtonLink>
            <ButtonLink href="/resident/requests" variant="secondary" size="sm">Vezi toate</ButtonLink>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recentRequests.map((request) => (
            <Link key={request.id} href={localizedPath(`/resident/requests/${request.id}`)} className="rounded-2xl border border-border/70 bg-muted/25 p-4 transition hover:bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">{request.requestNumber}</p>
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{request.title}</h3>
                </div>
                <Badge variant={request.status === 'RESOLVED' || request.status === 'CLOSED' ? 'success' : 'warning'}>
                  {requestStatusLabels[request.status] || request.status}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Apt. {request.apartment?.apartmentNumber || '-'} · {requestPriorityLabels[request.priority] || request.priority} · {formatDate(request.updatedAt || request.createdAt)}
              </p>
            </Link>
          ))}
          {!recentRequests.length ? (
            <EmptyBlock title="Nu ai solicitări trimise" text="Solicitările către administrație vor apărea aici după ce le creezi." />
          ) : null}
        </div>
      </Card>

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
