'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Gauge,
  Megaphone,
  MessageCircle,
  PlusCircle,
  UserX,
  Users,
} from 'lucide-react';
import { ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { workbenchApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type WorkbenchItem = {
  id?: string;
  title?: string;
  message?: string;
  link?: string | null;
  createdAt?: string;
  apartmentNumber?: string | null;
  staircaseName?: string | null;
  residentName?: string | null;
  priority?: string;
  status?: string;
  type?: string;
  amount?: number;
  method?: string;
  paidAt?: string;
  totalDebt?: number;
  accountStatus?: string | null;
  lastReadingDate?: string | null;
};

type WorkbenchData = {
  organization: {
    id: string;
    shortName: string;
    legalName: string;
    associationCode?: string | null;
    associationNumber?: string | null;
  };
  finance: {
    totalDebt: number;
    totalIssued: number;
    totalPaid: number;
    overdueInvoices: number;
    apartmentsWithDebt: number;
    collectionRate: number;
  };
  issues: {
    newCount: number;
    urgentCount: number;
    inProgressCount: number;
    latest: WorkbenchItem[];
  };
  meters: {
    missingReadings: number;
    suspiciousReadings: number;
    latestMissing: WorkbenchItem[];
  };
  residents: {
    withoutAccount: number;
    withDebt: number;
    latestWithDebt: WorkbenchItem[];
  };
  payments: {
    recent: WorkbenchItem[];
  };
  tasks: {
    dueToday: number;
    overdue: number;
    items: WorkbenchItem[];
  };
  activity: {
    recent: WorkbenchItem[];
  };
};

const emptyWorkbench: WorkbenchData = {
  organization: {
    id: '',
    shortName: 'A.P.C.',
    legalName: 'Asociația de Proprietari din Condominiu',
    associationCode: null,
    associationNumber: null,
  },
  finance: {
    totalDebt: 0,
    totalIssued: 0,
    totalPaid: 0,
    overdueInvoices: 0,
    apartmentsWithDebt: 0,
    collectionRate: 0,
  },
  issues: {
    newCount: 0,
    urgentCount: 0,
    inProgressCount: 0,
    latest: [],
  },
  meters: {
    missingReadings: 0,
    suspiciousReadings: 0,
    latestMissing: [],
  },
  residents: {
    withoutAccount: 0,
    withDebt: 0,
    latestWithDebt: [],
  },
  payments: {
    recent: [],
  },
  tasks: {
    dueToday: 0,
    overdue: 0,
    items: [],
  },
  activity: {
    recent: [],
  },
};

const issuePriorityLabels: Record<string, string> = {
  NORMAL: 'Normal',
  IMPORTANT: 'Important',
  LOW: 'Scăzută',
  MEDIUM: 'Normală',
  HIGH: 'Înaltă',
  URGENT: 'Urgentă',
};

const issueStatusLabels: Record<string, string> = {
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

const paymentMethodLabels: Record<string, string> = {
  CASH: 'Numerar',
  BANK: 'Transfer bancar',
  BANK_TRANSFER: 'Transfer bancar',
  CARD: 'Card',
  ONLINE: 'Online',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusLabel(value?: string | null) {
  if (!value) return 'Status necunoscut';
  return issueStatusLabels[String(value).toUpperCase()] || value;
}

function priorityLabel(value?: string | null) {
  if (!value) return 'Normal';
  return issuePriorityLabels[String(value).toUpperCase()] || value;
}

function meterLabel(value?: string | null) {
  if (!value) return 'Contor';
  return meterTypeLabels[String(value).toUpperCase()] || value;
}

function paymentMethodLabel(value?: string | null) {
  if (!value) return 'Plată';
  return paymentMethodLabels[String(value).toUpperCase()] || value;
}

function safeLocalizedLink(localizedPath: (href: string) => string, href?: string | null, fallback = '/admin') {
  return localizedPath(href || fallback);
}

export default function AdminPage() {
  const localizedPath = useLocalizedPath();
  const [source, setSource] = useState<'loading' | 'api' | 'error'>('loading');
  const [error, setError] = useState('');
  const [workbench, setWorkbench] = useState<WorkbenchData>(emptyWorkbench);

  useEffect(() => {
    let active = true;
    setSource('loading');
    setError('');

    workbenchApi
      .admin()
      .then((response) => {
        if (!active) return;
        setWorkbench({ ...emptyWorkbench, ...(response.data || {}) });
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setWorkbench(emptyWorkbench);
        setError('Nu am putut încărca panoul administratorului.');
        setSource('error');
      });

    return () => {
      active = false;
    };
  }, []);

  const priorityItems = useMemo(() => {
    const items = [];
    if (workbench.issues.urgentCount > 0) {
      items.push({
        title: 'Cereri urgente',
        value: String(workbench.issues.urgentCount),
        description: 'Necesită răspuns rapid',
        href: '/admin/issues',
        tone: 'danger' as const,
      });
    }
    if (workbench.finance.overdueInvoices > 0) {
      items.push({
        title: 'Facturi întârziate',
        value: String(workbench.finance.overdueInvoices),
        description: 'De urmărit cu locatarii',
        href: '/admin/invoices',
        tone: 'danger' as const,
      });
    }
    if (workbench.meters.missingReadings > 0) {
      items.push({
        title: 'Citiri lipsă',
        value: String(workbench.meters.missingReadings),
        description: 'Contoare fără citire curentă',
        href: '/admin/meters',
        tone: 'warning' as const,
      });
    }
    if (workbench.tasks.dueToday + workbench.tasks.overdue > 0) {
      items.push({
        title: 'Sarcini scadente',
        value: String(workbench.tasks.dueToday + workbench.tasks.overdue),
        description: `${workbench.tasks.overdue} întârziate`,
        href: '/admin',
        tone: 'warning' as const,
      });
    }
    return items;
  }, [workbench]);

  const kpiCards = [
    {
      label: 'Restanțe totale',
      value: formatMdl(workbench.finance.totalDebt),
      description: `${workbench.finance.apartmentsWithDebt} apartamente cu datorii`,
      icon: <CreditCard className="h-5 w-5" />,
      tone: workbench.finance.totalDebt > 0 ? ('danger' as const) : ('success' as const),
    },
    {
      label: 'Facturi întârziate',
      value: String(workbench.finance.overdueInvoices),
      description: 'Facturi trecute de scadență',
      icon: <FileText className="h-5 w-5" />,
      tone: workbench.finance.overdueInvoices > 0 ? ('danger' as const) : ('success' as const),
    },
    {
      label: 'Cereri urgente',
      value: String(workbench.issues.urgentCount),
      description: `${workbench.issues.newCount} cereri noi`,
      icon: <MessageCircle className="h-5 w-5" />,
      tone: workbench.issues.urgentCount > 0 ? ('warning' as const) : ('success' as const),
    },
    {
      label: 'Citiri lipsă',
      value: String(workbench.meters.missingReadings),
      description: `${workbench.meters.suspiciousReadings} citiri suspecte`,
      icon: <Gauge className="h-5 w-5" />,
      tone: workbench.meters.missingReadings > 0 ? ('warning' as const) : ('success' as const),
    },
    {
      label: 'Locatari fără cont',
      value: String(workbench.residents.withoutAccount),
      description: 'Necesită invitație',
      icon: <UserX className="h-5 w-5" />,
      tone: workbench.residents.withoutAccount > 0 ? ('warning' as const) : ('success' as const),
    },
    {
      label: 'Plăți recente',
      value: String(workbench.payments.recent.length),
      description: 'Ultimele înregistrări',
      icon: <Bell className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Panou administrator"
        description={`Lucru zilnic pentru ${workbench.organization.shortName || 'A.P.C.'}`}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'loading' ? 'Se încarcă datele...' : source === 'api' ? 'Date reale' : 'API-ul nu este disponibil temporar'}
            </span>
            <ButtonLink href={localizedPath('/admin/announcements')} variant="secondary">
              <Megaphone className="h-4 w-4" /> Publică anunț
            </ButtonLink>
          </div>
        }
      />

      {source === 'loading' ? (
        <Card className="p-5">
          <p className="text-sm font-medium text-foreground">Se încarcă panoul administratorului...</p>
          <p className="mt-1 text-sm text-muted-foreground">Pregătim datele operaționale ale asociației.</p>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {error} Datele reale vor apărea imediat ce API-ul răspunde.
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Asociația curentă</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">{workbench.organization.shortName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{workbench.organization.legalName}</p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <span className="rounded-2xl border border-border/70 bg-muted/25 px-3 py-2 font-medium text-foreground">
              Cod APC: {workbench.organization.associationCode || '-'}
            </span>
            <span className="rounded-2xl border border-border/70 bg-muted/25 px-3 py-2 font-medium text-foreground">
              Nr. intern: {workbench.organization.associationNumber || '-'}
            </span>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Priorități azi</p>
              <p className="text-sm text-muted-foreground">Elemente care cer atenția administratorului.</p>
            </div>
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {priorityItems.map((item) => (
              <Link
                key={item.title}
                href={localizedPath(item.href)}
                className="rounded-2xl border border-border/60 bg-white p-3 transition hover:bg-muted/40"
              >
                <span className="text-xs font-semibold uppercase text-muted-foreground">{item.title}</span>
                <span className={`mt-2 block text-2xl font-semibold ${item.tone === 'danger' ? 'text-red-700' : 'text-amber-700'}`}>
                  {item.value}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
              </Link>
            ))}
            {!priorityItems.length ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 sm:col-span-2">
                Nu există priorități urgente azi.
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Datorii și plăți</p>
              <p className="text-sm text-muted-foreground">Situația financiară curentă.</p>
            </div>
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-4 grid gap-2">
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Total emis</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatMdl(workbench.finance.totalIssued)}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Total achitat</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatMdl(workbench.finance.totalPaid)}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Rată de colectare</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{workbench.finance.collectionRate.toLocaleString('ro-RO')}%</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href={localizedPath('/admin/payments')} variant="secondary">Vezi plăți</ButtonLink>
            <ButtonLink href={localizedPath('/admin/invoices')} variant="secondary">Vezi facturi</ButtonLink>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Cereri urgente</p>
              <p className="text-sm text-muted-foreground">Cereri noi sau importante de la locatari.</p>
            </div>
            <Link href={localizedPath('/admin/issues')} className="text-xs font-semibold text-primary">
              Vezi cereri
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {workbench.issues.latest.map((issue, index) => (
              <Link
                key={issue.id || `${issue.title}-${index}`}
                href={safeLocalizedLink(localizedPath, issue.link, '/admin/issues')}
                className="block rounded-2xl border border-border/60 bg-white px-3 py-2 text-sm hover:bg-muted/40"
              >
                <span className="font-medium text-foreground">{issue.title || 'Cerere'}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {issue.apartmentNumber ? `Apt. ${issue.apartmentNumber}` : 'Spațiu comun'}
                  {issue.staircaseName ? ` · ${issue.staircaseName}` : ''} · {priorityLabel(issue.priority)} · {statusLabel(issue.status)}
                </span>
              </Link>
            ))}
            {!workbench.issues.latest.length ? <p className="text-sm text-muted-foreground">Nu există cereri urgente.</p> : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Citiri contoare</p>
              <p className="text-sm text-muted-foreground">Apartamente cu citiri lipsă sau vechi.</p>
            </div>
            <Link href={localizedPath('/admin/meters')} className="text-xs font-semibold text-primary">
              Vezi contoare
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {workbench.meters.latestMissing.map((meter, index) => (
              <Link
                key={meter.id || `${meter.type}-${index}`}
                href={localizedPath('/admin/meters')}
                className="block rounded-2xl border border-border/60 bg-white px-3 py-2 text-sm hover:bg-muted/40"
              >
                <span className="font-medium text-foreground">{meterLabel(meter.type)}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {meter.apartmentNumber ? `Apt. ${meter.apartmentNumber}` : 'Apartament'} · {meter.staircaseName || 'scară neindicată'} · ultima citire:{' '}
                  {formatDate(meter.lastReadingDate)}
                </span>
              </Link>
            ))}
            {!workbench.meters.latestMissing.length ? <p className="text-sm text-muted-foreground">Nu există citiri lipsă.</p> : null}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Locatari de urmărit</p>
              <p className="text-sm text-muted-foreground">Datorii și conturi care necesită acțiune.</p>
            </div>
            <Link href={localizedPath('/admin/residents')} className="text-xs font-semibold text-primary">
              Locatari
            </Link>
          </div>
          {workbench.residents.withoutAccount > 0 ? (
            <Link
              href={localizedPath('/admin/residents')}
              className="mt-4 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:bg-amber-100"
            >
              <span>{workbench.residents.withoutAccount} locatari nu au cont creat.</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
          <div className="mt-4 space-y-2">
            {workbench.residents.latestWithDebt.map((resident, index) => (
              <Link
                key={resident.id || `${resident.apartmentNumber}-${index}`}
                href={safeLocalizedLink(localizedPath, resident.link, '/admin/apartments')}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white px-3 py-2 text-sm hover:bg-muted/40"
              >
                <div>
                  <p className="font-medium text-foreground">{resident.residentName || 'Locatar neindicat'}</p>
                  <p className="text-xs text-muted-foreground">
                    Apt. {resident.apartmentNumber || '-'} {resident.staircaseName ? `· ${resident.staircaseName}` : ''}
                  </p>
                </div>
                <span className="text-sm font-semibold text-red-700">{formatMdl(resident.totalDebt || 0)}</span>
              </Link>
            ))}
            {!workbench.residents.latestWithDebt.length ? <p className="text-sm text-muted-foreground">Nu există datorii înregistrate.</p> : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Plăți recente</p>
              <p className="text-sm text-muted-foreground">Ultimele plăți înregistrate în sistem.</p>
            </div>
            <Link href={localizedPath('/admin/payments')} className="text-xs font-semibold text-primary">
              Vezi toate
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {workbench.payments.recent.map((payment, index) => (
              <Link
                key={payment.id || `${payment.amount}-${index}`}
                href={localizedPath('/admin/payments')}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white px-3 py-2 hover:bg-muted/40"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {payment.apartmentNumber ? `Apt. ${payment.apartmentNumber}` : 'Apartament'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {paymentMethodLabel(payment.method)} · {formatDate(payment.paidAt)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground">{formatMdl(payment.amount || 0)}</p>
              </Link>
            ))}
            {!workbench.payments.recent.length ? <p className="text-sm text-muted-foreground">Nu există plăți încă.</p> : null}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Activitate recentă</p>
              <p className="text-sm text-muted-foreground">Evenimente administrative din asociație.</p>
            </div>
            <Bell className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-4 space-y-2">
            {workbench.activity.recent.map((activity, index) => (
              <div key={activity.id || `${activity.title}-${index}`} className="rounded-2xl border border-border/60 bg-muted/35 px-3 py-2">
                <p className="text-sm font-medium text-foreground">{activity.title || 'Activitate'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{activity.message || formatDate(activity.createdAt)}</p>
              </div>
            ))}
            {!workbench.activity.recent.length ? <p className="text-sm text-muted-foreground">Nu există activitate recentă.</p> : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Sarcini / follow-up</p>
              <p className="text-sm text-muted-foreground">Sarcini operaționale ale administratorului.</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-4 space-y-2">
            {workbench.tasks.items.map((task, index) => (
              <div key={task.id || `${task.title}-${index}`} className="rounded-2xl border border-border/60 bg-white px-3 py-2 text-sm">
                <p className="font-medium text-foreground">{task.title || 'Sarcină'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{task.message || statusLabel(task.status)}</p>
              </div>
            ))}
            {!workbench.tasks.items.length ? <p className="text-sm text-muted-foreground">Nu există sarcini active.</p> : null}
          </div>
        </Card>
      </section>

      <Card>
        <p className="text-sm font-semibold text-foreground">Acțiuni rapide</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ButtonLink href={localizedPath('/admin/apartments')} variant="primary">
            <PlusCircle className="h-4 w-4" /> Adaugă apartament
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/residents')} variant="secondary">
            <Users className="h-4 w-4" /> Adaugă locatar
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/meters')} variant="secondary">
            <Gauge className="h-4 w-4" /> Adaugă contor
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/invoices')} variant="secondary">
            <FileText className="h-4 w-4" /> Emite facturi
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/payments')} variant="secondary">
            <CreditCard className="h-4 w-4" /> Înregistrează plată
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/announcements')} variant="secondary">
            <Megaphone className="h-4 w-4" /> Publică anunț
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/issues')} variant="secondary">
            <MessageCircle className="h-4 w-4" /> Vezi cereri
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/imports/apartments')} variant="secondary">
            <Building2 className="h-4 w-4" /> Importă apartamente
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
