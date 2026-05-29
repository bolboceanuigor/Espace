'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Gauge,
  ListChecks,
  Megaphone,
  MessageCircle,
  PlusCircle,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react';
import { ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { adminRbacApi, adminResidentUpdateRequestsApi, billingApi, communicationsApi, dataQualityApi, invitationsApi, onboardingApi, workbenchApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type CrmOrganization = {
  id: string;
  shortName: string;
  legalName: string;
  associationCode?: string | null;
  associationNumber?: string | null;
};

type PriorityResident = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  role?: string | null;
  accountStatus?: string | null;
  apartmentNumber?: string | null;
  staircaseName?: string | null;
  totalDebt: number;
  openIssuesCount: number;
  missingContact?: boolean;
  link?: string | null;
  inviteLink?: string | null;
  paymentLink?: string | null;
  issueLink?: string | null;
};

type PriorityApartment = {
  id: string;
  apartmentNumber?: string | null;
  staircaseName?: string | null;
  residentName?: string | null;
  totalDebt: number;
  unpaidInvoicesCount: number;
  overdueInvoicesCount: number;
  lastPaymentDate?: string | null;
  link?: string | null;
};

type CrmIssue = {
  id: string;
  title?: string;
  apartmentNumber?: string | null;
  staircaseName?: string | null;
  residentName?: string | null;
  priority?: string | null;
  status?: string | null;
  createdAt?: string | null;
  link?: string | null;
};

type CrmMeter = {
  id: string;
  type?: string | null;
  serialNumber?: string | null;
  apartmentNumber?: string | null;
  staircaseName?: string | null;
  lastReadingDate?: string | null;
  link?: string | null;
};

type CrmPayment = {
  id: string;
  amount: number;
  method?: string | null;
  paidAt?: string | null;
  apartmentNumber?: string | null;
  staircaseName?: string | null;
  invoice?: { invoiceNumber?: string | null; month?: number | null; year?: number | null } | null;
  link?: string | null;
};

type CrmTask = {
  id: string;
  title?: string;
  message?: string | null;
  priority?: string | null;
  status?: string | null;
  dueDate?: string | null;
  link?: string | null;
};

type CrmActivity = {
  id: string;
  title?: string;
  message?: string;
  createdAt?: string | null;
  link?: string | null;
};

type SetupStep = {
  key: string;
  title: string;
  completed?: boolean;
  href?: string;
  actionLabel?: string;
};

type SetupChecklist = {
  steps: SetupStep[];
  progressDetails?: {
    completed?: number;
    total?: number;
    percent?: number;
    label?: string;
  };
  nextStep?: SetupStep;
};

type ResidentCrmData = {
  organization: CrmOrganization;
  kpis: {
    totalApartments: number;
    totalResidents: number;
    residentsWithoutAccount: number;
    totalIssued: number;
    totalPaid: number;
    apartmentsWithDebt: number;
    totalDebt: number;
    overdueInvoices: number;
    collectionRate: number;
    openIssues: number;
    urgentIssues: number;
    missingMeterReadings: number;
  };
  priorityResidents: PriorityResident[];
  priorityApartments: PriorityApartment[];
  urgentIssues: CrmIssue[];
  missingReadings: CrmMeter[];
  recentPayments: CrmPayment[];
  tasks: CrmTask[];
  activity: CrmActivity[];
};

const emptyCrm: ResidentCrmData = {
  organization: {
    id: '',
    shortName: 'A.P.C.',
    legalName: 'Asociația de Proprietari din Condominiu',
    associationCode: null,
    associationNumber: null,
  },
  kpis: {
    totalApartments: 0,
    totalResidents: 0,
    residentsWithoutAccount: 0,
    totalIssued: 0,
    totalPaid: 0,
    apartmentsWithDebt: 0,
    totalDebt: 0,
    overdueInvoices: 0,
    collectionRate: 0,
    openIssues: 0,
    urgentIssues: 0,
    missingMeterReadings: 0,
  },
  priorityResidents: [],
  priorityApartments: [],
  urgentIssues: [],
  missingReadings: [],
  recentPayments: [],
  tasks: [],
  activity: [],
};

const roleLabels: Record<string, string> = {
  OWNER: 'Proprietar',
  RESIDENT: 'Locatar',
  TENANT: 'Chiriaș',
  FAMILY_MEMBER: 'Membru familie',
  REPRESENTATIVE: 'Reprezentant',
};

const accountStatusLabels: Record<string, string> = {
  CREATED: 'Cont creat',
  INVITED: 'Invitat',
  NO_ACCOUNT: 'Fără cont',
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
  BANK: 'Altă metodă',
  BANK_TRANSFER: 'Transfer bancar',
  CARD: 'Card',
  OTHER: 'Altă metodă',
};

function normalizeCrm(data?: Partial<ResidentCrmData>): ResidentCrmData {
  return {
    ...emptyCrm,
    ...(data || {}),
    organization: { ...emptyCrm.organization, ...(data?.organization || {}) },
    kpis: { ...emptyCrm.kpis, ...(data?.kpis || {}) },
    priorityResidents: data?.priorityResidents || [],
    priorityApartments: data?.priorityApartments || [],
    urgentIssues: data?.urgentIssues || [],
    missingReadings: data?.missingReadings || [],
    recentPayments: data?.recentPayments || [],
    tasks: data?.tasks || [],
    activity: data?.activity || [],
  };
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function label(map: Record<string, string>, value?: string | null, fallback = '-') {
  if (!value) return fallback;
  return map[String(value).toUpperCase()] || value;
}

function safeLocalizedLink(localizedPath: (href: string) => string, href?: string | null, fallback = '/admin') {
  return localizedPath((href || fallback).replace('/admin/issues', '/admin/requests'));
}

function currentBillingMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminPage() {
  const localizedPath = useLocalizedPath();
  const [source, setSource] = useState<'loading' | 'api' | 'error'>('loading');
  const [error, setError] = useState('');
  const [crm, setCrm] = useState<ResidentCrmData>(emptyCrm);
  const [setup, setSetup] = useState<SetupChecklist | null>(null);
  const [setupError, setSetupError] = useState('');
  const [pendingUpdateRequests, setPendingUpdateRequests] = useState(0);
  const [announcementStats, setAnnouncementStats] = useState<any>({});
  const [billingOverview, setBillingOverview] = useState<any>(null);
  const [dataQualitySummary, setDataQualitySummary] = useState<any>(null);
  const [teamStats, setTeamStats] = useState<any>(null);
  const [teamActivityStats, setTeamActivityStats] = useState<any>(null);
  const [firstLogin, setFirstLogin] = useState<any>(null);

  useEffect(() => {
    let active = true;
    setSource('loading');
    setError('');

    workbenchApi
      .residentCrm()
      .then((response) => {
        if (!active) return;
        setCrm(normalizeCrm(response.data));
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setCrm(emptyCrm);
        setError('Nu am putut încărca datele CRM.');
        setSource('error');
      });

    onboardingApi
      .adminGet()
      .then((response) => {
        if (!active) return;
        setSetup({
          steps: response.data?.steps || [],
          progressDetails: response.data?.progressDetails,
          nextStep: response.data?.nextStep,
        });
        setSetupError('');
      })
      .catch(() => {
        if (!active) return;
        setSetup(null);
        setSetupError('Nu am putut încărca checklistul de configurare inițială.');
      });

    adminResidentUpdateRequestsApi
      .stats()
      .then((response) => {
        if (!active) return;
        setPendingUpdateRequests(Number(response.data?.pending || 0));
      })
      .catch(() => {
        if (!active) return;
        setPendingUpdateRequests(0);
      });

    communicationsApi
      .adminAnnouncementStats()
      .then((response) => {
        if (!active) return;
        setAnnouncementStats(response.data || {});
      })
      .catch(() => {
        if (!active) return;
        setAnnouncementStats({});
      });

    billingApi
      .overview({ billingMonth: currentBillingMonth() })
      .then((response) => {
        if (!active) return;
        setBillingOverview(response.data || null);
      })
      .catch(() => {
        if (!active) return;
        setBillingOverview(null);
      });

    dataQualityApi
      .stats()
      .then((response) => {
        if (!active) return;
        setDataQualitySummary(response.data || null);
      })
      .catch(() => {
        if (!active) return;
        setDataQualitySummary(null);
      });

    adminRbacApi
      .teamStats()
      .then((response) => {
        if (!active) return;
        setTeamStats(response.data || null);
      })
      .catch(() => {
        if (!active) return;
        setTeamStats(null);
      });

    adminRbacApi
      .teamActivityStats()
      .then((response) => {
        if (!active) return;
        setTeamActivityStats(response.data || null);
      })
      .catch(() => {
        if (!active) return;
        setTeamActivityStats(null);
      });

    invitationsApi
      .getAdminFirstLogin()
      .then((response) => {
        if (!active) return;
        setFirstLogin(response.data || null);
      })
      .catch(() => {
        if (!active) return;
        setFirstLogin(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const priorityCards = useMemo(
    () => [
      {
        title: 'Datorii mari',
        value: formatMdl(crm.kpis.totalDebt),
        description: `${crm.kpis.apartmentsWithDebt} apartamente cu datorii`,
        href: '/admin/payments',
        active: crm.kpis.totalDebt > 0,
      },
      {
        title: 'Solicitări urgente',
        value: String(crm.kpis.urgentIssues),
        description: 'Necesită răspuns rapid',
        href: '/admin/requests',
        active: crm.kpis.urgentIssues > 0,
      },
      {
        title: 'Citiri lipsă',
        value: String(crm.kpis.missingMeterReadings),
        description: 'Contoare fără citire curentă',
        href: '/admin/meter-readings/reports',
        active: crm.kpis.missingMeterReadings > 0,
      },
      {
        title: 'Rapoarte consum',
        value: 'Vezi raport',
        description: 'Indici aprobați, lipsă și needs review',
        href: '/admin/meter-readings/reports',
        active: true,
      },
      {
        title: 'Acces portal locatari',
        value: String(crm.kpis.residentsWithoutAccount),
        description: 'Fără cont activ sau invitație',
        href: '/admin/resident-access',
        active: crm.kpis.residentsWithoutAccount > 0,
      },
      {
        title: 'Solicitări date pending',
        value: String(pendingUpdateRequests),
        description: 'Cererile locatarilor pentru actualizare date',
        href: '/admin/resident-update-requests',
        active: pendingUpdateRequests > 0,
      },
      {
        title: 'Anunțuri draft',
        value: String(announcementStats.draft || 0),
        description: `${announcementStats.published || 0} publicate în avizier`,
        href: '/admin/announcements',
        active: Number(announcementStats.draft || 0) > 0,
      },
      {
        title: 'Facturare lunară',
        value: billingOverview?.billingRun ? billingOverview.billingRun.status : 'Nepornit',
        description: billingOverview?.nextAction?.label || 'Pornește procesul lunar',
        href: '/admin/billing',
        active: Boolean(billingOverview?.summary?.errorsCount || billingOverview?.summary?.warningsCount || !billingOverview?.billingRun),
      },
      {
        title: 'Calitatea datelor',
        value: dataQualitySummary ? `${dataQualitySummary.score || 0}/100` : 'Verifică',
        description: dataQualitySummary
          ? `${dataQualitySummary.criticalCount || 0} critice · ${dataQualitySummary.warningCount || 0} warnings`
          : 'Rulează verificările de date',
        href: '/admin/data-quality',
        active: Boolean(dataQualitySummary?.criticalCount || dataQualitySummary?.warningCount || !dataQualitySummary?.lastRunAt),
      },
      {
        title: 'Echipă',
        value: teamStats ? String(teamStats.active || 0) : 'Vezi echipa',
        description: teamStats
          ? `${teamStats.pendingInvitations || 0} invitații pending · ${teamStats.suspended || 0} suspendați`
          : 'Membri interni și invitații',
        href: '/admin/team',
        active: Boolean(teamStats?.pendingInvitations || teamStats?.suspended || !teamStats),
      },
      {
        title: 'Activitate echipă',
        value: teamActivityStats ? String(teamActivityStats.critical || 0) : 'Vezi audit',
        description: teamActivityStats
          ? `${teamActivityStats.sensitive || 0} acțiuni sensibile · ${teamActivityStats.today || 0} azi`
          : 'Acțiuni sensibile și audit intern',
        href: '/admin/team/activity',
        active: Boolean(teamActivityStats?.critical || teamActivityStats?.sensitive || !teamActivityStats),
      },
    ],
    [announcementStats, billingOverview, crm, dataQualitySummary, pendingUpdateRequests, teamActivityStats, teamStats],
  );

  const kpiCards = [
    {
      label: 'Apartamente',
      value: String(crm.kpis.totalApartments),
      description: 'Unități în asociație',
      icon: <Building2 className="h-5 w-5" />,
    },
    {
      label: 'Locatari',
      value: String(crm.kpis.totalResidents),
      description: 'Profiluri conectate',
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: 'Fără cont',
      value: String(crm.kpis.residentsWithoutAccount),
      description: 'Necesită invitație',
      icon: <UserX className="h-5 w-5" />,
      tone: crm.kpis.residentsWithoutAccount > 0 ? ('warning' as const) : ('success' as const),
    },
    {
      label: 'Apartamente cu datorii',
      value: String(crm.kpis.apartmentsWithDebt),
      description: formatMdl(crm.kpis.totalDebt),
      icon: <CreditCard className="h-5 w-5" />,
      tone: crm.kpis.apartmentsWithDebt > 0 ? ('danger' as const) : ('success' as const),
    },
    {
      label: 'Cereri urgente',
      value: String(crm.kpis.urgentIssues),
      description: `${crm.kpis.openIssues} cereri active`,
      icon: <MessageCircle className="h-5 w-5" />,
      tone: crm.kpis.urgentIssues > 0 ? ('warning' as const) : ('success' as const),
    },
    {
      label: 'Acțiuni sensibile',
      value: String(teamActivityStats?.sensitive || 0),
      description: `${teamActivityStats?.critical || 0} critice în audit`,
      icon: <Activity className="h-5 w-5" />,
      tone: teamActivityStats?.critical ? ('danger' as const) : teamActivityStats?.sensitive ? ('warning' as const) : ('success' as const),
    },
    {
      label: 'Citiri lipsă',
      value: String(crm.kpis.missingMeterReadings),
      description: 'De colectat luna curentă',
      icon: <Gauge className="h-5 w-5" />,
      tone: crm.kpis.missingMeterReadings > 0 ? ('warning' as const) : ('success' as const),
    },
  ];

  const financeKpiCards = [
    {
      label: 'Total emis',
      value: formatMdl(crm.kpis.totalIssued),
      description: 'Facturi emise',
      icon: <FileText className="h-5 w-5" />,
    },
    {
      label: 'Total achitat',
      value: formatMdl(crm.kpis.totalPaid),
      description: 'Plăți confirmate',
      icon: <CheckCircle2 className="h-5 w-5" />,
      tone: 'success' as const,
    },
    {
      label: 'Restanțe',
      value: formatMdl(crm.kpis.totalDebt),
      description: 'Solduri neachitate',
      icon: <CreditCard className="h-5 w-5" />,
      tone: crm.kpis.totalDebt > 0 ? ('danger' as const) : ('success' as const),
    },
    {
      label: 'Facturi întârziate',
      value: String(crm.kpis.overdueInvoices),
      description: 'Scadență depășită',
      icon: <AlertCircle className="h-5 w-5" />,
      tone: crm.kpis.overdueInvoices > 0 ? ('warning' as const) : ('success' as const),
    },
    {
      label: 'Apartamente cu datorii',
      value: String(crm.kpis.apartmentsWithDebt),
      description: formatMdl(crm.kpis.totalDebt),
      icon: <Building2 className="h-5 w-5" />,
      tone: crm.kpis.apartmentsWithDebt > 0 ? ('danger' as const) : ('success' as const),
    },
    {
      label: 'Rata de colectare',
      value: `${Number(crm.kpis.collectionRate || 0).toLocaleString('ro-RO')}%`,
      description: 'Achitat din total emis',
      icon: <Banknote className="h-5 w-5" />,
      tone: crm.kpis.collectionRate >= 90 ? ('success' as const) : ('warning' as const),
    },
  ];

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="CRM locatari"
        description={`Gestionarea locatarilor, apartamentelor și acțiunilor zilnice pentru ${crm.organization.shortName || 'A.P.C.'}`}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'loading' ? 'Se încarcă datele...' : source === 'api' ? 'Date reale' : 'API-ul nu este disponibil temporar'}
            </span>
            <ButtonLink href={localizedPath('/admin/residents')} variant="secondary">
              <UserPlus className="h-4 w-4" /> Adaugă locatar
            </ButtonLink>
          </div>
        }
      />

      {source === 'loading' ? (
        <Card className="p-5">
          <p className="text-sm font-medium text-foreground">Se încarcă datele...</p>
          <p className="mt-1 text-sm text-muted-foreground">Pregătim prioritățile pentru locatari și apartamente.</p>
        </Card>
      ) : null}

      {error ? <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</Card> : null}
      {source === 'api' && !crm.organization.id ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Contul tău nu este conectat la o A.P.C. Contactează Superadminul.
        </Card>
      ) : null}

      {firstLogin?.organization && firstLogin.organization.adminHandoverStatus !== 'ACTIVE' ? (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-950">Finalizează verificarea inițială</p>
              <p className="mt-1 text-sm text-amber-800">
                Confirmă datele APC-ului și punctele de pornire înainte de lucrul operațional.
              </p>
            </div>
            <ButtonLink href={localizedPath('/admin/first-login')} variant="secondary">
              <ListChecks className="h-4 w-4" /> Deschide checklist
            </ButtonLink>
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Asociația curentă</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">{crm.organization.shortName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{crm.organization.legalName}</p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <span className="rounded-2xl border border-border/70 bg-muted/25 px-3 py-2 font-medium text-foreground">
              Cod A.P.C.: {crm.organization.associationCode || '-'}
            </span>
            <span className="rounded-2xl border border-border/70 bg-muted/25 px-3 py-2 font-medium text-foreground">
              Nr. intern: {crm.organization.associationNumber || '-'}
            </span>
          </div>
        </div>
      </Card>

      <SetupChecklistCard setup={setup} setupError={setupError} localizedPath={localizedPath} />

      {dataQualitySummary?.criticalCount ? (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-950">Ai probleme în datele importate</p>
              <p className="mt-1 text-sm text-amber-800">
                {dataQualitySummary.criticalCount} probleme critice trebuie verificate înainte de facturare.
              </p>
            </div>
            <ButtonLink href={localizedPath('/admin/data-quality')} variant="secondary">
              <ListChecks className="h-4 w-4" /> Calitatea datelor
            </ButtonLink>
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Ghid de configurare</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Parcurge ghidul pas-cu-pas pentru apartamente, locatari, tarife, facturi si invitatii portal.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/onboarding-guide" variant="primary">Continua ghidul</ButtonLink>
            <ButtonLink href="/admin/help" variant="secondary">Ajutor</ButtonLink>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">Financiar</p>
          <p className="text-sm text-muted-foreground">Facturi, plăți și restanțe calculate din datele reale ale A.P.C.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {financeKpiCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-border/70 bg-muted/25 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Facturare lunară</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {billingOverview?.billingRun
                  ? `${billingOverview.billingMonth}: ${billingOverview.nextAction?.label || 'Proces în lucru'} · ${billingOverview.summary?.warningsCount || 0} warnings · ${billingOverview.summary?.errorsCount || 0} errors`
                  : `${currentBillingMonth()}: procesul lunar nu este pornit`}
              </p>
            </div>
            <ButtonLink href={localizedPath('/admin/billing')} variant="secondary">
              <ListChecks className="h-4 w-4" /> Deschide facturarea
            </ButtonLink>
            <ButtonLink href={localizedPath('/admin/reports/financial')} variant="secondary">
              <BarChart3 className="h-4 w-4" /> Vezi rapoarte financiare
            </ButtonLink>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Calitatea datelor</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {dataQualitySummary?.lastRunAt
                  ? `Scor ${dataQualitySummary.score}/100 · ${dataQualitySummary.criticalCount || 0} critice · ${dataQualitySummary.warningCount || 0} warnings`
                  : 'Nu există încă o verificare Data Quality rulată.'}
              </p>
            </div>
            <ButtonLink href={localizedPath('/admin/data-quality')} variant="secondary">
              <ListChecks className="h-4 w-4" /> Verifică datele
            </ButtonLink>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Priorități</p>
            <p className="text-sm text-muted-foreground">Datorii, cereri, citiri și conturi care cer acțiune.</p>
          </div>
          <AlertCircle className="h-5 w-5 text-amber-600" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {priorityCards.map((item) => (
            <Link
              key={item.title}
              href={localizedPath(item.href)}
              className={`rounded-2xl border p-4 transition hover:bg-muted/40 ${
                item.active ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'
              }`}
            >
              <span className="text-xs font-semibold uppercase">{item.title}</span>
              <span className="mt-2 block text-xl font-semibold">{item.value}</span>
              <span className="mt-1 block text-xs opacity-80">{item.description}</span>
            </Link>
          ))}
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <SectionHeader title="Locatari de urmărit" description="Datorii, conturi lipsă, cereri active sau contacte incomplete." href={localizedPath('/admin/residents')} />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {crm.priorityResidents.map((resident) => (
              <ResidentCard key={resident.id} resident={resident} localizedPath={localizedPath} />
            ))}
            {!crm.priorityResidents.length ? <p className="text-sm text-muted-foreground">Nu există locatari de urmărit.</p> : null}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Apartamente cu datorii" description="Apartamente ordonate după sold restant." href={localizedPath('/admin/apartments')} />
          <div className="mt-4 space-y-2">
            {crm.priorityApartments.map((apartment) => (
              <Link
                key={apartment.id}
                href={safeLocalizedLink(localizedPath, apartment.link, '/admin/apartments')}
                className="block rounded-2xl border border-border/70 bg-white px-4 py-3 hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">Apt. {apartment.apartmentNumber || '-'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{apartment.staircaseName || 'scară neindicată'} · {apartment.residentName || 'locatar neindicat'}</p>
                  </div>
                  <span className="text-sm font-semibold text-rose-700">{formatMdl(apartment.totalDebt)}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {apartment.unpaidInvoicesCount} facturi neachitate · {apartment.overdueInvoicesCount} întârziate · ultima plată {formatDate(apartment.lastPaymentDate)}
                </p>
              </Link>
            ))}
            {!crm.priorityApartments.length ? <p className="text-sm text-muted-foreground">Nu există apartamente cu datorii.</p> : null}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Solicitări urgente" description="Solicitări care au prioritate mare sau urgentă." href={localizedPath('/admin/requests')} />
          <div className="mt-4 space-y-2">
            {crm.urgentIssues.map((issue) => (
              <Link key={issue.id} href={safeLocalizedLink(localizedPath, issue.link, '/admin/requests')} className="block rounded-2xl border border-border/70 bg-white px-4 py-3 hover:bg-muted/40">
                <p className="font-semibold text-foreground">{issue.title || 'Cerere'}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Apt. {issue.apartmentNumber || '-'} · {issue.residentName || 'locatar neindicat'} · {label(issuePriorityLabels, issue.priority, 'Normal')} · {label(issueStatusLabels, issue.status, 'Status')}
                </p>
              </Link>
            ))}
            {!crm.urgentIssues.length ? <p className="text-sm text-muted-foreground">Nu există solicitări urgente.</p> : null}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Citiri lipsă" description="Contoare fără citire în luna curentă." href={localizedPath('/admin/meter-readings/reports')} />
          <div className="mt-4 space-y-2">
            {crm.missingReadings.map((meter) => (
              <Link key={meter.id} href={safeLocalizedLink(localizedPath, meter.link, '/admin/meters')} className="block rounded-2xl border border-border/70 bg-white px-4 py-3 hover:bg-muted/40">
                <p className="font-semibold text-foreground">{label(meterTypeLabels, meter.type, 'Contor')}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Apt. {meter.apartmentNumber || '-'} · {meter.staircaseName || 'scară neindicată'} · seria {meter.serialNumber || '-'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Ultima citire: {formatDate(meter.lastReadingDate)}</p>
              </Link>
            ))}
            {!crm.missingReadings.length ? <p className="text-sm text-muted-foreground">Nu există citiri lipsă.</p> : null}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Plăți recente" description="Ultimele plăți înregistrate de administrator." href={localizedPath('/admin/payments')} />
          <div className="mt-4 space-y-2">
            {crm.recentPayments.map((payment) => (
              <Link key={payment.id} href={safeLocalizedLink(localizedPath, payment.link, '/admin/payments')} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-white px-4 py-3 hover:bg-muted/40">
                <div>
                  <p className="font-semibold text-foreground">Apt. {payment.apartmentNumber || '-'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {label(paymentMethodLabels, payment.method, 'Plată')} · {formatDate(payment.paidAt)}
                    {payment.invoice?.month && payment.invoice?.year ? ` · factura ${payment.invoice.month}/${payment.invoice.year}` : ''}
                  </p>
                </div>
                <span className="font-semibold text-foreground">{formatMdl(payment.amount || 0)}</span>
              </Link>
            ))}
            {!crm.recentPayments.length ? <p className="text-sm text-muted-foreground">Nu există plăți recente.</p> : null}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Sarcini / follow-up" description="Sarcini operaționale legate de locatari, apartamente sau solicitări." href={localizedPath('/admin/requests')} />
          <div className="mt-4 space-y-2">
            {crm.tasks.map((task) => (
              <Link key={task.id} href={safeLocalizedLink(localizedPath, task.link, '/admin/requests')} className="block rounded-2xl border border-border/70 bg-white px-4 py-3 hover:bg-muted/40">
                <p className="font-semibold text-foreground">{task.title || 'Sarcină'}</p>
                <p className="mt-1 text-sm text-muted-foreground">{task.message || label(issueStatusLabels, task.status, 'În lucru')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{label(issuePriorityLabels, task.priority, 'Normal')} · scadență {formatDate(task.dueDate)}</p>
              </Link>
            ))}
            {!crm.tasks.length ? <p className="text-sm text-muted-foreground">Nu există sarcini active.</p> : null}
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
          <ButtonLink href={localizedPath('/admin/payments')} variant="secondary">
            <Banknote className="h-4 w-4" /> Înregistrează plată
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/requests')} variant="secondary">
            <MessageCircle className="h-4 w-4" /> Vezi solicitări
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/meters')} variant="secondary">
            <Gauge className="h-4 w-4" /> Adaugă contor
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/meter-readings/reports')} variant="secondary">
            <Gauge className="h-4 w-4" /> Rapoarte consum
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/billing')} variant="secondary">
            <ListChecks className="h-4 w-4" /> Facturare lunară
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/data-quality')} variant="secondary">
            <ListChecks className="h-4 w-4" /> Calitatea datelor
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/audit-log')} variant="secondary">
            <ListChecks className="h-4 w-4" /> Istoric activitate
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/invoices')} variant="secondary">
            <FileText className="h-4 w-4" /> Emite facturi
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/announcements')} variant="secondary">
            <Megaphone className="h-4 w-4" /> Publică anunț
          </ButtonLink>
          <ButtonLink href={localizedPath('/admin/imports/apartments')} variant="secondary">
            <Building2 className="h-4 w-4" /> Importă apartamente
          </ButtonLink>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Activitate recentă</p>
            <p className="text-sm text-muted-foreground">Evenimente administrative din această asociație.</p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {crm.activity.slice(0, 6).map((activity) => (
            <div key={activity.id} className="rounded-2xl border border-border/70 bg-muted/35 px-4 py-3">
              <p className="text-sm font-medium text-foreground">{activity.title || 'Activitate'}</p>
              <p className="mt-1 text-xs text-muted-foreground">{activity.message || formatDate(activity.createdAt)}</p>
            </div>
          ))}
          {!crm.activity.length ? <p className="text-sm text-muted-foreground">Nu există activitate recentă.</p> : null}
        </div>
      </Card>
    </div>
  );
}

function SetupChecklistCard({
  setup,
  setupError,
  localizedPath,
}: {
  setup: SetupChecklist | null;
  setupError: string;
  localizedPath: (href: string) => string;
}) {
  const steps = setup?.steps || [];
  const completed = Number(setup?.progressDetails?.completed ?? steps.filter((step) => step.completed).length);
  const total = Number(setup?.progressDetails?.total ?? steps.length);
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const nextStep = setup?.nextStep || steps.find((step) => !step.completed);

  return (
    <Card>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/35 px-3 py-1 text-xs font-semibold text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5" />
            Configurare inițială
          </div>
          <h2 className="mt-3 text-base font-semibold text-foreground">
            {!setup && !setupError
              ? 'Se încarcă checklistul de configurare...'
              : setup?.progressDetails?.label || `Configurare inițială: ${completed}/${total || 8} pași completați`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Checklist bazat pe date reale: profil A.P.C., bloc, scări, apartamente, locatari, contoare, tarife și facturi.
          </p>
        </div>
        {nextStep ? (
          <ButtonLink href={localizedPath(nextStep.href || '/admin/onboarding')} variant="primary">
            {nextStep.actionLabel || 'Continuă configurarea'}
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        ) : (
          <ButtonLink href={localizedPath('/admin/onboarding')} variant="secondary">
            Vezi checklist
          </ButtonLink>
        )}
      </div>

      <div className="mt-4 h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>

      {setupError ? <p className="mt-4 text-sm font-medium text-amber-700">{setupError}</p> : null}
      {!setup && !setupError ? <p className="mt-4 text-sm font-medium text-muted-foreground">Se încarcă checklistul de configurare...</p> : null}

      {steps.length ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <div key={step.key} className="rounded-2xl border border-border/70 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${step.completed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {step.completed ? 'Completat' : 'Incomplet'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={localizedPath(step.href || '/admin/onboarding')} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">
                  {step.actionLabel || 'Deschide'}
                </Link>
                {step.key === 'ADD_APARTMENTS' ? (
                  <Link href={localizedPath('/admin/imports/apartments')} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">
                    Importă apartamente
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function SectionHeader({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Link href={href} className="shrink-0 text-xs font-semibold text-primary">
        Deschide
      </Link>
    </div>
  );
}

function ResidentCard({ resident, localizedPath }: { resident: PriorityResident; localizedPath: (href: string) => string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{resident.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Apt. {resident.apartmentNumber || '-'} {resident.staircaseName ? `· ${resident.staircaseName}` : ''} · {label(roleLabels, resident.role, 'Locatar')}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${resident.totalDebt > 0 ? 'bg-rose-50 text-rose-700' : 'bg-muted text-muted-foreground'}`}>
          {formatMdl(resident.totalDebt)}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <span>{resident.phone || 'Telefon lipsă'}</span>
        <span>{resident.email || 'Email lipsă'}</span>
        <span>{label(accountStatusLabels, resident.accountStatus, 'Fără cont')}</span>
        <span>{resident.openIssuesCount} cereri active</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={safeLocalizedLink(localizedPath, resident.link, '/admin/residents')} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">
          Deschide profil
        </Link>
        {resident.accountStatus !== 'CREATED' ? (
          <Link href={safeLocalizedLink(localizedPath, resident.inviteLink, '/admin/residents')} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">
            Invită locatar
          </Link>
        ) : null}
        <Link href={safeLocalizedLink(localizedPath, resident.paymentLink, '/admin/payments')} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">
          Înregistrează plată
        </Link>
        <Link href={safeLocalizedLink(localizedPath, resident.issueLink, '/admin/requests')} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">
          Solicitări
        </Link>
      </div>
    </div>
  );
}
