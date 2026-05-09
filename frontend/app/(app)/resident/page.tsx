'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell, FileText, Gauge, Wrench } from 'lucide-react';
import { Badge, Card, PageHeader, StatCard } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type ResidentHomeItem = {
  id: string;
  title?: string;
  content?: string;
  preview?: string;
  category?: string;
  status?: string;
  priority?: string;
  type?: string;
  serialNumber?: string | null;
  lastReading?: { value?: number; readingDate?: string } | null;
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string | null;
  fileName?: string;
};

type ResidentHome = {
  resident: {
    id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    role?: string | null;
  } | null;
  organization: {
    id: string | null;
    shortName: string;
    legalName: string;
    associationCode?: string | null;
  };
  primaryApartment: {
    id: string;
    number: string;
    staircase?: string | null;
    building?: string | null;
    floor?: number | null;
    areaM2?: number | null;
    rooms?: number | null;
  } | null;
  finance: {
    totalDebt: number;
    unpaidInvoicesCount: number;
    overdueInvoicesCount: number;
    nextDueDate?: string | null;
    lastPaymentDate?: string | null;
    status?: string;
  };
  meters: {
    total: number;
    missingReadings: number;
    latest: ResidentHomeItem[];
  };
  issues: {
    activeCount: number;
    latest: ResidentHomeItem[];
  };
  announcements: {
    latest: ResidentHomeItem[];
  };
  documents: {
    latest: ResidentHomeItem[];
  };
  emptyStateMessage?: string | null;
};

const emptyHome: ResidentHome = {
  resident: null,
  organization: {
    id: null,
    shortName: 'A.P.C.',
    legalName: 'Asociația de Proprietari din Condominiu',
    associationCode: null,
  },
  primaryApartment: null,
  finance: {
    totalDebt: 0,
    unpaidInvoicesCount: 0,
    overdueInvoicesCount: 0,
    nextDueDate: null,
    lastPaymentDate: null,
    status: 'NO_DATA',
  },
  meters: {
    total: 0,
    missingReadings: 0,
    latest: [],
  },
  issues: {
    activeCount: 0,
    latest: [],
  },
  announcements: {
    latest: [],
  },
  documents: {
    latest: [],
  },
  emptyStateMessage: null,
};

const roleLabels: Record<string, string> = {
  OWNER: 'Proprietar',
  RESIDENT: 'Locatar',
  TENANT: 'Locatar',
  FAMILY_MEMBER: 'Membru familie',
  REPRESENTATIVE: 'Reprezentant',
};

const statusLabels: Record<string, string> = {
  PAID: 'Achitat',
  UNPAID: 'Neachitat',
  OVERDUE: 'Întârziat',
  NEW: 'Nouă',
  IN_PROGRESS: 'În lucru',
  RESOLVED: 'Rezolvată',
  WAITING: 'În așteptare',
  CLOSED: 'Închisă',
};

const meterTypeLabels: Record<string, string> = {
  COLD_WATER: 'Apă rece',
  HOT_WATER: 'Apă caldă',
  GAS: 'Gaz',
  ELECTRICITY: 'Electricitate',
  HEATING: 'Încălzire',
};

const documentCategoryLabels: Record<string, string> = {
  STATUT: 'Statut A.P.C.',
  PROCES_VERBAL: 'Proces-verbal',
  HOTARARE: 'Hotărâre',
  CONTRACT: 'Contract',
  FINANCIAR: 'Financiar',
  TEHNIC: 'Tehnic',
  ANUNT: 'Anunț',
  ALTUL: 'Altul',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' });
}

function labelFromMap(map: Record<string, string>, value?: string | null, fallback = '-') {
  if (!value) return fallback;
  return map[String(value).toUpperCase()] || value;
}

function residentName(home: ResidentHome) {
  const direct = home.resident?.name;
  const composed = `${home.resident?.firstName || ''} ${home.resident?.lastName || ''}`.trim();
  return direct || composed || 'Locatar';
}

function residentFirstName(home: ResidentHome) {
  return home.resident?.firstName || residentName(home).split(' ')[0] || 'Locatar';
}

function financeStatus(home: ResidentHome) {
  if (home.finance.overdueInvoicesCount > 0 || home.finance.status === 'OVERDUE') {
    return { label: 'Întârziat', variant: 'error' as const };
  }
  if (home.finance.totalDebt > 0 || home.finance.unpaidInvoicesCount > 0 || home.finance.status === 'UNPAID') {
    return { label: 'Datornic', variant: 'warning' as const };
  }
  return { label: 'Achitat', variant: 'success' as const };
}

export default function ResidentDashboardPage() {
  const localizedPath = useLocalizedPath();
  const [home, setHome] = useState<ResidentHome>(emptyHome);
  const [source, setSource] = useState<'loading' | 'api' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setSource('loading');
    setError('');

    residentDemoApi
      .home()
      .then((response) => {
        if (!active) return;
        setHome({ ...emptyHome, ...(response.data || {}) });
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setHome(emptyHome);
        setError('Nu am putut încărca datele.');
        setSource('error');
      });

    return () => {
      active = false;
    };
  }, []);

  const apartmentSubtitle = useMemo(() => {
    if (!home.primaryApartment) return home.organization.shortName;
    return [
      `Apt. ${home.primaryApartment.number}`,
      home.primaryApartment.staircase,
      home.organization.shortName,
    ].filter(Boolean).join(' · ');
  }, [home]);

  const quickActions = [
    { label: 'Transmite citire', icon: <Gauge className="h-5 w-5" />, href: '/resident/meters' },
    { label: 'Trimite cerere', icon: <Wrench className="h-5 w-5" />, href: '/resident/issues/new' },
    { label: 'Vezi avizier', icon: <Bell className="h-5 w-5" />, href: '/resident/announcements' },
    { label: 'Vezi documente', icon: <FileText className="h-5 w-5" />, href: '/resident/documents' },
  ];
  const currentFinanceStatus = financeStatus(home);

  const topCards = [
    {
      label: 'Facturi neachitate',
      value: String(home.finance.unpaidInvoicesCount),
      description: `${home.finance.overdueInvoicesCount} întârziate`,
      icon: <FileText className="h-5 w-5" />,
      tone: home.finance.unpaidInvoicesCount > 0 ? ('warning' as const) : ('success' as const),
    },
    {
      label: 'Citiri lipsă',
      value: String(home.meters.missingReadings),
      description: `${home.meters.total} contoare conectate`,
      icon: <Gauge className="h-5 w-5" />,
      tone: home.meters.missingReadings > 0 ? ('warning' as const) : ('success' as const),
    },
    {
      label: 'Cereri active',
      value: String(home.issues.activeCount),
      description: 'Cereri în lucru sau noi',
      icon: <Wrench className="h-5 w-5" />,
      tone: home.issues.activeCount > 0 ? ('warning' as const) : ('success' as const),
    },
  ];

  return (
    <div className="space-y-5 pb-24 md:pb-4">
      <PageHeader
        title={`Bună, ${residentFirstName(home)}`}
        description={apartmentSubtitle}
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {source === 'loading' ? 'Se încarcă datele...' : source === 'api' ? 'Date reale' : 'Datele nu sunt disponibile temporar'}
          </span>
        }
      />

      {source === 'loading' ? (
        <Card className="p-5">
          <p className="text-sm font-medium text-foreground">Se încarcă datele...</p>
          <p className="mt-1 text-sm text-muted-foreground">Pregătim informațiile apartamentului tău.</p>
        </Card>
      ) : null}

      {error ? <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</Card> : null}

      {!home.primaryApartment && source !== 'loading' ? (
        <Card className="border-amber-200 bg-amber-50/70 p-5 text-sm font-semibold text-amber-900">
          {home.emptyStateMessage || 'Contul tău nu este conectat încă la un apartament. Contactează administratorul.'}
        </Card>
      ) : null}

      {home.primaryApartment ? (
        <Card className="overflow-hidden p-0">
          <div className="grid gap-4 bg-foreground p-5 text-background md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm opacity-75">{home.organization.shortName}</p>
                <Badge variant={currentFinanceStatus.variant}>{currentFinanceStatus.label}</Badge>
              </div>
              <h1 className="mt-3 text-3xl font-semibold">{formatMdl(home.finance.totalDebt)}</h1>
              <p className="mt-1 text-sm opacity-75">
                {home.finance.totalDebt > 0 ? 'Sold curent pentru apartamentul tău' : 'Nu ai datorii restante'}
              </p>
            </div>
            <Link
              href={localizedPath('/resident/invoices')}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-foreground transition hover:bg-white/90"
            >
              Vezi facturile
            </Link>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-4">
            <Info label="Apartament" value={`Apt. ${home.primaryApartment.number}`} />
            <Info label="Scara" value={home.primaryApartment.staircase || '-'} />
            <Info label="Următoarea scadență" value={formatDate(home.finance.nextDueDate)} />
            <Info label="Rol" value={labelFromMap(roleLabels, home.resident?.role, 'Locatar')} />
          </div>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {topCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      <Card>
        <h2 className="font-semibold text-foreground">Acțiuni rapide</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((item) => (
            <Link
              key={item.label}
              href={localizedPath(item.href)}
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/70 bg-muted/25 px-4 text-sm font-semibold text-foreground transition hover:bg-white"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-foreground text-background">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Facturi recente</h2>
              <p className="text-sm text-muted-foreground">Scadența și ultima plată pentru apartamentul tău.</p>
            </div>
            <Link href={localizedPath('/resident/invoices')} className="text-xs font-semibold text-primary">Vezi facturile</Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Info label="Sold curent" value={formatMdl(home.finance.totalDebt)} danger={home.finance.totalDebt > 0} />
            <Info label="Următoarea scadență" value={formatDate(home.finance.nextDueDate)} />
            <Info label="Ultima plată" value={formatDate(home.finance.lastPaymentDate)} />
            <Info label="Status" value={labelFromMap(statusLabels, home.finance.status, 'Neindicat')} />
          </div>
          {home.finance.unpaidInvoicesCount === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nu există facturi pentru apartamentul tău.</p>
          ) : null}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Contoare</h2>
              <p className="text-sm text-muted-foreground">Citirile transmise pentru apartament.</p>
            </div>
            <Link href={localizedPath('/resident/meters')} className="text-xs font-semibold text-primary">Transmite citire</Link>
          </div>
          <div className="mt-4 space-y-2">
            {home.meters.latest.map((meter) => (
              <div key={meter.id} className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                <p className="text-sm font-medium text-foreground">{labelFromMap(meterTypeLabels, meter.type, 'Contor')}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Serie: {meter.serialNumber || '-'} · Ultima citire: {meter.lastReading?.value ?? '-'} · {formatDate(meter.lastReading?.readingDate)}
                </p>
              </div>
            ))}
            {!home.meters.latest.length ? <p className="text-sm text-muted-foreground">Nu există contoare conectate pentru apartamentul tău.</p> : null}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Cererile mele</h2>
            <Link href={localizedPath('/resident/issues')} className="text-xs font-semibold text-primary">Deschide</Link>
          </div>
          <div className="mt-4 space-y-2">
            {home.issues.latest.map((issue) => (
              <div key={issue.id} className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                <p className="text-sm font-medium text-foreground">{issue.title || 'Cerere'}</p>
                <p className="mt-1 text-xs text-muted-foreground">Status: {labelFromMap(statusLabels, issue.status, 'Nouă')}</p>
              </div>
            ))}
            {!home.issues.latest.length ? <p className="text-sm text-muted-foreground">Nu ai cereri active.</p> : null}
          </div>
          <Link href={localizedPath('/resident/issues/new')} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-border/70 text-sm font-semibold">
            Trimite cerere
          </Link>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Avizier</h2>
            <Link href={localizedPath('/resident/announcements')} className="text-xs font-semibold text-primary">Vezi avizierul</Link>
          </div>
          <div className="mt-4 space-y-2">
            {home.announcements.latest.map((announcement) => (
              <div key={announcement.id} className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{announcement.title || 'Anunț'}</p>
                  <Badge variant={announcement.category === 'URGENT' ? 'error' : 'warning'}>{announcement.category || 'General'}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{announcement.preview || announcement.content}</p>
              </div>
            ))}
            {!home.announcements.latest.length ? <p className="text-sm text-muted-foreground">Nu există anunțuri active.</p> : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Documente A.P.C.</h2>
            <Link href={localizedPath('/resident/documents')} className="text-xs font-semibold text-primary">Vezi documentele</Link>
          </div>
          <div className="mt-4 space-y-2">
            {home.documents.latest.map((document) => (
              <div key={document.id} className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                <p className="text-sm font-medium text-foreground">{document.title || document.fileName || 'Document'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {labelFromMap(documentCategoryLabels, document.category, 'Document')} · {formatDate(document.createdAt)}
                </p>
              </div>
            ))}
            {!home.documents.latest.length ? <p className="text-sm text-muted-foreground">Nu există documente publice încă.</p> : null}
          </div>
        </Card>
      </section>
    </div>
  );
}

function Info({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/35 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold ${danger ? 'text-rose-600' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
