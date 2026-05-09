'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, Building2, CreditCard, Plus, ShieldCheck, Timer, UserCog } from 'lucide-react';
import { Card, PageHeader, StatCard } from '@/components/ui';
import { superadminApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type OrganizationCard = {
  id: string;
  shortName: string;
  legalName: string;
  associationCode?: string | null;
  associationNumber?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  status: 'ACTIVE' | 'TRIAL' | 'INACTIVE' | string;
  pipelineStatus: 'LEAD' | 'ONBOARDING' | 'TRIAL' | 'ACTIVE' | 'INACTIVE' | string;
  subscriptionStatus?: string | null;
  plan?: string | null;
  apartmentsCount: number;
  residentsCount: number;
  adminsCount: number;
  nextFollowUpAt?: string | null;
  lastActivityAt?: string | null;
  onboardingMissing?: Record<string, boolean>;
  contact?: { name?: string | null; email?: string | null; phone?: string | null } | null;
};

type WorkbenchTask = {
  id: string;
  title: string;
  description?: string | null;
  priority?: string;
  status?: string;
  relatedId?: string | null;
  dueDate?: string | null;
};

type WorkbenchActivity = {
  id: string;
  title?: string;
  message?: string;
  type?: string;
  createdAt?: string;
  organization?: { name?: string | null; shortName?: string | null } | null;
};

type WorkbenchAdmin = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  createdAt?: string;
  organization?: { id: string; name?: string | null; shortName?: string | null; associationCode?: string | null } | null;
};

type SuperadminWorkbench = {
  kpis: {
    totalOrganizations: number;
    activeOrganizations: number;
    trialOrganizations: number;
    inactiveOrganizations: number;
    onboardingOrganizations: number;
    totalAdmins: number;
    totalResidents: number;
    totalApartments: number;
    estimatedMonthlyRevenue: number;
  };
  pipeline: {
    lead: OrganizationCard[];
    onboarding: OrganizationCard[];
    trial: OrganizationCard[];
    active: OrganizationCard[];
    inactive: OrganizationCard[];
  };
  recentOrganizations: OrganizationCard[];
  recentAdmins: WorkbenchAdmin[];
  tasks: {
    dueToday: WorkbenchTask[];
    overdue: WorkbenchTask[];
    upcoming: WorkbenchTask[];
  };
  activity: {
    recent: WorkbenchActivity[];
  };
};

const emptyWorkbench: SuperadminWorkbench = {
  kpis: {
    totalOrganizations: 0,
    activeOrganizations: 0,
    trialOrganizations: 0,
    inactiveOrganizations: 0,
    onboardingOrganizations: 0,
    totalAdmins: 0,
    totalResidents: 0,
    totalApartments: 0,
    estimatedMonthlyRevenue: 0,
  },
  pipeline: {
    lead: [],
    onboarding: [],
    trial: [],
    active: [],
    inactive: [],
  },
  recentOrganizations: [],
  recentAdmins: [],
  tasks: {
    dueToday: [],
    overdue: [],
    upcoming: [],
  },
  activity: {
    recent: [],
  },
};

const statusLabels: Record<string, string> = {
  LEAD: 'Lead',
  ONBOARDING: 'Onboarding',
  TRIAL: 'Trial',
  ACTIVE: 'Activă',
  INACTIVE: 'Inactivă',
};

const missingLabels: Record<string, string> = {
  admin: 'administrator',
  building: 'bloc',
  apartments: 'apartamente',
  tariff: 'tarife',
  invoice: 'facturi',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function adminName(admin: WorkbenchAdmin) {
  return `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email;
}

function taskLabel(value?: string | null) {
  if (!value) return 'Normală';
  const normalized = value.toUpperCase();
  if (normalized === 'URGENT') return 'Urgentă';
  if (normalized === 'HIGH') return 'Înaltă';
  if (normalized === 'LOW') return 'Scăzută';
  return 'Normală';
}

function subscriptionLabel(organization: OrganizationCard) {
  const status = organization.subscriptionStatus ? String(organization.subscriptionStatus).toUpperCase() : '';
  const plan = organization.plan ? String(organization.plan) : '';
  if (!status && !plan) return 'Abonament neconfigurat';
  const statusLabel = status === 'ACTIVE' ? 'Activ' : status === 'TRIAL' ? 'Trial' : status === 'PAST_DUE' ? 'Restant' : status || 'Plan';
  return [plan, statusLabel].filter(Boolean).join(' · ');
}

function normalizeWorkbench(data: Partial<SuperadminWorkbench> | undefined): SuperadminWorkbench {
  return {
    ...emptyWorkbench,
    ...(data || {}),
    kpis: { ...emptyWorkbench.kpis, ...(data?.kpis || {}) },
    pipeline: { ...emptyWorkbench.pipeline, ...(data?.pipeline || {}) },
    tasks: { ...emptyWorkbench.tasks, ...(data?.tasks || {}) },
    activity: { ...emptyWorkbench.activity, ...(data?.activity || {}) },
    recentOrganizations: data?.recentOrganizations || [],
    recentAdmins: data?.recentAdmins || [],
  };
}

export default function SuperadminPage() {
  const localizedPath = useLocalizedPath();
  const [source, setSource] = useState<'loading' | 'api' | 'error'>('loading');
  const [error, setError] = useState('');
  const [workbench, setWorkbench] = useState<SuperadminWorkbench>(emptyWorkbench);

  useEffect(() => {
    let active = true;
    setSource('loading');
    setError('');

    superadminApi
      .workbench()
      .then((response) => {
        if (!active) return;
        setWorkbench(normalizeWorkbench(response.data));
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setWorkbench(emptyWorkbench);
        setError('Nu am putut încărca datele platformei.');
        setSource('error');
      });

    return () => {
      active = false;
    };
  }, []);

  const stats = [
    { label: 'Total A.P.C.', value: String(workbench.kpis.totalOrganizations), description: 'Clienți în platformă', icon: <Building2 className="h-5 w-5" /> },
    { label: 'Active', value: String(workbench.kpis.activeOrganizations), description: 'Asociații cu acces activ', icon: <ShieldCheck className="h-5 w-5" />, tone: 'success' as const },
    { label: 'Trial', value: String(workbench.kpis.trialOrganizations), description: 'În evaluare', icon: <Timer className="h-5 w-5" />, tone: 'warning' as const },
    { label: 'În onboarding', value: String(workbench.kpis.onboardingOrganizations), description: 'Necesită configurare', icon: <Activity className="h-5 w-5" />, tone: 'warning' as const },
    { label: 'Administratori', value: String(workbench.kpis.totalAdmins), description: 'Utilizatori ADMIN', icon: <UserCog className="h-5 w-5" /> },
    { label: 'Apartamente', value: workbench.kpis.totalApartments.toLocaleString('ro-RO'), description: 'Unități administrate', icon: <Building2 className="h-5 w-5" /> },
    {
      label: 'Venit lunar estimat',
      value: `${workbench.kpis.estimatedMonthlyRevenue.toLocaleString('ro-RO')} MDL`,
      description: 'Abonamente manuale',
      icon: <CreditCard className="h-5 w-5" />,
    },
  ];

  const pipelineColumns = [
    { key: 'lead', title: 'Lead', items: workbench.pipeline.lead },
    { key: 'onboarding', title: 'Onboarding', items: workbench.pipeline.onboarding },
    { key: 'trial', title: 'Trial', items: workbench.pipeline.trial },
    { key: 'active', title: 'Activ', items: workbench.pipeline.active },
    { key: 'inactive', title: 'Inactiv', items: workbench.pipeline.inactive },
  ];
  const onboardingItems = workbench.pipeline.onboarding.slice(0, 6);
  const taskItems = [...workbench.tasks.overdue, ...workbench.tasks.dueToday, ...workbench.tasks.upcoming].slice(0, 8);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Platformă Espace"
        description="CRM pentru gestionarea A.P.C.-urilor din Republica Moldova"
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'loading' ? 'Se încarcă datele platformei...' : source === 'api' ? 'Date reale' : 'API-ul nu este disponibil temporar'}
            </span>
            <Link href={localizedPath('/superadmin/organizations')} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background">
              Adaugă A.P.C.
            </Link>
          </div>
        }
      />

      {source === 'loading' ? (
        <Card className="p-5">
          <p className="text-sm font-medium text-foreground">Se încarcă datele platformei...</p>
          <p className="mt-1 text-sm text-muted-foreground">Pregătim pipeline-ul A.P.C. și activitatea recentă.</p>
        </Card>
      ) : null}

      {error ? <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</Card> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </section>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Pipeline A.P.C.</h2>
            <p className="mt-1 text-sm text-muted-foreground">Asociații urmărite ca profiluri CRM.</p>
          </div>
          <Link href={localizedPath('/superadmin/organizations')} className="text-sm font-semibold text-primary">
            Vezi asociații
          </Link>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-5">
          {pipelineColumns.map((column) => (
            <div key={column.key} className="rounded-2xl border border-border/70 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{column.title}</p>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-muted-foreground">{column.items.length}</span>
              </div>
              <div className="mt-3 space-y-2">
                {column.items.slice(0, 4).map((organization) => (
                  <OrganizationMiniCard key={organization.id} organization={organization} href={localizedPath(`/superadmin/organizations/${organization.id}`)} />
                ))}
                {!column.items.length ? <p className="rounded-xl bg-white p-3 text-xs text-muted-foreground">Nu există A.P.C.-uri încă.</p> : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">A.P.C.-uri în onboarding</h2>
              <p className="mt-1 text-sm text-muted-foreground">Asociații care mai au pași de configurare.</p>
            </div>
            <Link href={localizedPath('/superadmin/organizations')} className="text-sm font-semibold text-primary">
              Deschide onboarding
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {onboardingItems.map((organization) => (
              <div key={organization.id} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{organization.shortName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{organization.city || 'Oraș neindicat'}</p>
                  </div>
                  <Link href={localizedPath(`/superadmin/organizations/${organization.id}`)} className="text-xs font-semibold text-primary">
                    Deschide
                  </Link>
                </div>
                <p className="mt-3 text-xs font-semibold uppercase text-muted-foreground">Lipsește</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(organization.onboardingMissing || {})
                    .filter(([, missing]) => missing)
                    .map(([key]) => (
                      <span key={key} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        {missingLabels[key] || key}
                      </span>
                    ))}
                </div>
              </div>
            ))}
            {!onboardingItems.length ? <p className="text-sm text-muted-foreground">Nu există A.P.C.-uri în onboarding.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-foreground">Acțiuni rapide</h2>
          <div className="mt-5 space-y-3">
            <QuickAction href={localizedPath('/superadmin/organizations')} icon={<Plus className="h-4 w-4" />} title="Adaugă A.P.C." detail="Creează o asociație nouă" />
            <QuickAction href={localizedPath('/superadmin/admins')} icon={<UserCog className="h-4 w-4" />} title="Adaugă administrator" detail="Invită contactul responsabil" />
            <QuickAction href={localizedPath('/superadmin/organizations')} icon={<Building2 className="h-4 w-4" />} title="Vezi asociații" detail="CRM-ul clienților A.P.C." />
            <QuickAction href={localizedPath('/superadmin/subscriptions')} icon={<CreditCard className="h-4 w-4" />} title="Vezi abonamente" detail="Planuri și limite manuale" />
            <QuickAction href={localizedPath('/superadmin/system/status')} icon={<Activity className="h-4 w-4" />} title="Verifică sistem" detail="API și bază de date" />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Follow-up-uri / sarcini</h2>
              <p className="mt-1 text-sm text-muted-foreground">Sarcini scadente pentru clienții A.P.C.</p>
            </div>
            <Link href={localizedPath('/superadmin/tasks')} className="text-sm font-semibold text-primary">
              Vezi sarcini
            </Link>
          </div>
          <div className="mt-5 space-y-2">
            {taskItems.map((task) => (
              <Link
                key={task.id}
                href={task.relatedId ? localizedPath(`/superadmin/organizations/${task.relatedId}`) : localizedPath('/superadmin/tasks')}
                className="block rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 hover:bg-muted/40"
              >
                <p className="text-sm font-semibold text-foreground">{task.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {taskLabel(task.priority)} · scadență {formatDate(task.dueDate)}
                </p>
              </Link>
            ))}
            {!taskItems.length ? <p className="text-sm text-muted-foreground">Nu există sarcini active.</p> : null}
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Administratori recenți</h2>
              <p className="mt-1 text-sm text-muted-foreground">Ultimele conturi ADMIN create.</p>
            </div>
            <Link href={localizedPath('/superadmin/admins')} className="text-sm font-semibold text-primary">
              Vezi toți
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {workbench.recentAdmins.map((admin) => (
              <div key={admin.id} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                <p className="font-semibold text-foreground">{adminName(admin)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{admin.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">{admin.organization?.shortName || admin.organization?.name || 'A.P.C. neatribuită'}</p>
              </div>
            ))}
            {!workbench.recentAdmins.length ? <p className="text-sm text-muted-foreground">Nu există administratori încă.</p> : null}
          </div>
        </Card>
      </section>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Activitate recentă platformă</h2>
            <p className="mt-1 text-sm text-muted-foreground">Evenimente despre A.P.C.-uri, administratori și onboarding.</p>
          </div>
          <Link href={localizedPath('/superadmin/audit-logs')} className="text-sm font-semibold text-primary">
            Vezi jurnal
          </Link>
        </div>
        <div className="mt-5 space-y-2">
          {workbench.activity.recent.slice(0, 12).map((item) => (
            <div key={item.id} className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{item.title || item.type || 'Activitate'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.message || 'Activitate înregistrată.'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.organization?.shortName || item.organization?.name || 'Platformă'} · {formatDate(item.createdAt)}
              </p>
            </div>
          ))}
          {!workbench.activity.recent.length ? <p className="text-sm text-muted-foreground">Nu există activitate recentă.</p> : null}
        </div>
      </Card>
    </div>
  );
}

function OrganizationMiniCard({ organization, href }: { organization: OrganizationCard; href: string }) {
  return (
    <Link href={href} className="block rounded-xl border border-border/70 bg-white p-3 hover:bg-muted/40">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{organization.shortName}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{organization.legalName}</p>
        </div>
        <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
          {statusLabels[organization.pipelineStatus] || organization.pipelineStatus}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
        <span>{organization.associationCode || 'Cod A.P.C. neindicat'} · {organization.city || 'Oraș neindicat'}</span>
        <span>Contact: {organization.contact?.name || organization.contact?.email || 'Neatribuit'}</span>
        <span>Plan: {subscriptionLabel(organization)}</span>
        <span>{organization.apartmentsCount} apartamente · {organization.residentsCount} locatari</span>
        <span>{organization.adminsCount} administratori</span>
        <span>Follow-up: {formatDate(organization.nextFollowUpAt)}</span>
        <span>Ultima activitate: {formatDate(organization.lastActivityAt)}</span>
      </div>
      <span className="mt-3 inline-flex rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-semibold text-foreground">
        Deschide
      </span>
    </Link>
  );
}

function QuickAction({ href, icon, title, detail }: { href: string; icon: ReactNode; title: string; detail: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-white px-4 py-3 hover:bg-muted/40">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-foreground text-background">{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
      </span>
    </Link>
  );
}
