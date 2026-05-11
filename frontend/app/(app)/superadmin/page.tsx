'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { 
  Activity, 
  ArrowRight, 
  ArrowUpRight, 
  Building2, 
  Calendar, 
  CheckCircle2, 
  ChevronRight, 
  CreditCard, 
  ExternalLink,
  LayoutGrid,
  Plus, 
  Settings2, 
  ShieldCheck, 
  Sparkles,
  Timer, 
  TrendingUp, 
  UserCog,
  Users2,
  Zap
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { PageHeader, StatCard } from '@/components/ui';
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

const pipelineStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  LEAD: { label: 'Lead', color: 'text-gray-600', bg: 'bg-gray-100' },
  ONBOARDING: { label: 'Onboarding', color: 'text-amber-600', bg: 'bg-amber-50' },
  TRIAL: { label: 'Trial', color: 'text-blue-600', bg: 'bg-blue-50' },
  ACTIVE: { label: 'Activ', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  INACTIVE: { label: 'Inactiv', color: 'text-gray-500', bg: 'bg-gray-100' },
};

const missingLabels: Record<string, string> = {
  admin: 'Administrator',
  building: 'Bloc',
  apartments: 'Apartamente',
  tariff: 'Tarife',
  invoice: 'Facturi',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRelativeDate(value?: string | null) {
  if (!value) return 'Niciodată';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Niciodată';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Azi';
  if (days === 1) return 'Ieri';
  if (days < 7) return `Acum ${days} zile`;
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
}

function adminName(admin: WorkbenchAdmin) {
  return `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email;
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

  const pipelineColumns = [
    { key: 'lead', title: 'Lead', items: workbench.pipeline.lead, dotColor: 'bg-gray-400' },
    { key: 'onboarding', title: 'Onboarding', items: workbench.pipeline.onboarding, dotColor: 'bg-amber-400' },
    { key: 'trial', title: 'Trial', items: workbench.pipeline.trial, dotColor: 'bg-blue-400' },
    { key: 'active', title: 'Activ', items: workbench.pipeline.active, dotColor: 'bg-emerald-400' },
    { key: 'inactive', title: 'Inactiv', items: workbench.pipeline.inactive, dotColor: 'bg-gray-300' },
  ];

  const onboardingItems = workbench.pipeline.onboarding.slice(0, 4);
  const taskItems = [...workbench.tasks.overdue, ...workbench.tasks.dueToday, ...workbench.tasks.upcoming].slice(0, 5);
  const totalPipelineCount = pipelineColumns.reduce((acc, col) => acc + col.items.length, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">Platformă Espace</h1>
                  <p className="text-sm text-muted-foreground">CRM pentru gestionarea asociațiilor de proprietari</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                source === 'loading' ? 'bg-muted text-muted-foreground' : 
                source === 'api' ? 'bg-emerald-50 text-emerald-700' : 
                'bg-amber-50 text-amber-700'
              }`}>
                <span className={`size-1.5 rounded-full ${
                  source === 'loading' ? 'bg-muted-foreground animate-pulse' : 
                  source === 'api' ? 'bg-emerald-500' : 
                  'bg-amber-500'
                }`} />
                {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date live' : 'Offline'}
              </div>
              <Link 
                href={localizedPath('/superadmin/organizations')} 
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
              >
                <Plus className="size-4" />
                Adaugă A.P.C.
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-center gap-2">
              <Activity className="size-4" />
              {error}
            </div>
          </div>
        )}

        {/* KPI Grid */}
        <section className="animate-fade-up">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              label="Total Asociații" 
              value={workbench.kpis.totalOrganizations} 
              description="Clienți în platformă"
              icon={<Building2 className="size-5" />}
              tone="neutral"
            />
            <StatCard 
              label="Active" 
              value={workbench.kpis.activeOrganizations} 
              description="Cu acces complet"
              icon={<CheckCircle2 className="size-5" />}
              tone="success"
            />
            <StatCard 
              label="În Trial" 
              value={workbench.kpis.trialOrganizations} 
              description="Perioadă de evaluare"
              icon={<Timer className="size-5" />}
              tone="warning"
            />
            <StatCard 
              label="Venit Lunar" 
              value={`${workbench.kpis.estimatedMonthlyRevenue.toLocaleString('ro-RO')} MDL`} 
              description="Abonamente active"
              icon={<TrendingUp className="size-5" />}
              tone="neutral"
            />
          </div>
        </section>

        {/* Secondary Stats */}
        <section className="animate-fade-up-delay-1">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <UserCog className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{workbench.kpis.totalAdmins}</p>
                <p className="text-xs text-muted-foreground">Administratori</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <LayoutGrid className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{workbench.kpis.totalApartments.toLocaleString('ro-RO')}</p>
                <p className="text-xs text-muted-foreground">Apartamente</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <Users2 className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{workbench.kpis.totalResidents.toLocaleString('ro-RO')}</p>
                <p className="text-xs text-muted-foreground">Locatari</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50">
                <Zap className="size-4 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{workbench.kpis.onboardingOrganizations}</p>
                <p className="text-xs text-muted-foreground">În onboarding</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pipeline Section */}
        <section className="animate-fade-up-delay-2">
          <Card>
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-foreground">Pipeline Asociații</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {totalPipelineCount} total
                </span>
              </div>
              <Link 
                href={localizedPath('/superadmin/organizations')} 
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Vezi toate
                <ChevronRight className="size-4" />
              </Link>
            </div>
            
            <div className="grid gap-3 lg:grid-cols-5">
              {pipelineColumns.map((column) => (
                <div key={column.key} className="rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${column.dotColor}`} />
                      <span className="text-sm font-medium text-foreground">{column.title}</span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{column.items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {column.items.slice(0, 3).map((org) => (
                      <PipelineCard key={org.id} organization={org} href={localizedPath(`/superadmin/organizations/${org.id}`)} />
                    ))}
                    {column.items.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border bg-card/50 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Nicio asociație</p>
                      </div>
                    )}
                    {column.items.length > 3 && (
                      <Link 
                        href={localizedPath('/superadmin/organizations')} 
                        className="block rounded-lg bg-card/50 p-2 text-center text-xs font-medium text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
                      >
                        +{column.items.length - 3} mai multe
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Onboarding Section */}
          <section className="lg:col-span-3 animate-fade-up-delay-3">
            <Card>
              <div className="flex items-center justify-between pb-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Asociații în Onboarding</h2>
                  <p className="text-sm text-muted-foreground">Necesită configurare pentru activare</p>
                </div>
                <Link 
                  href={localizedPath('/superadmin/organizations')} 
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Deschide
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>
              
              {onboardingItems.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {onboardingItems.map((org) => (
                    <OnboardingCard key={org.id} organization={org} href={localizedPath(`/superadmin/organizations/${org.id}`)} />
                  ))}
                </div>
              ) : (
                <EmptyState 
                  icon={<CheckCircle2 className="size-5" />}
                  title="Totul e configurat"
                  description="Nu există asociații care necesită onboarding"
                />
              )}
            </Card>
          </section>

          {/* Quick Actions */}
          <section className="lg:col-span-2 animate-fade-up-delay-3">
            <Card>
              <h2 className="text-base font-semibold text-foreground pb-4">Acțiuni rapide</h2>
              <div className="space-y-2">
                <QuickAction 
                  href={localizedPath('/superadmin/organizations')} 
                  icon={<Plus className="size-4" />} 
                  title="Adaugă asociație" 
                  description="Creează un client nou"
                />
                <QuickAction 
                  href={localizedPath('/superadmin/admins')} 
                  icon={<UserCog className="size-4" />} 
                  title="Gestionează admini" 
                  description="Utilizatori responsabili"
                />
                <QuickAction 
                  href={localizedPath('/superadmin/subscriptions')} 
                  icon={<CreditCard className="size-4" />} 
                  title="Abonamente" 
                  description="Planuri și facturare"
                />
                <QuickAction 
                  href={localizedPath('/superadmin/system/status')} 
                  icon={<Activity className="size-4" />} 
                  title="Status sistem" 
                  description="Monitorizare platformă"
                />
                <QuickAction 
                  href={localizedPath('/superadmin/audit-logs')} 
                  icon={<Settings2 className="size-4" />} 
                  title="Jurnal activitate" 
                  description="Evenimente și loguri"
                />
              </div>
            </Card>
          </section>
        </div>

        {/* Bottom Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tasks */}
          <Card>
            <div className="flex items-center justify-between pb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Sarcini & Follow-up</h2>
                <p className="text-sm text-muted-foreground">Activități programate</p>
              </div>
              <Link 
                href={localizedPath('/superadmin/tasks')} 
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Vezi toate
                <ChevronRight className="size-4" />
              </Link>
            </div>
            
            {taskItems.length > 0 ? (
              <div className="space-y-2">
                {taskItems.map((task) => (
                  <TaskCard key={task.id} task={task} href={task.relatedId ? localizedPath(`/superadmin/organizations/${task.relatedId}`) : localizedPath('/superadmin/tasks')} />
                ))}
              </div>
            ) : (
              <EmptyState 
                icon={<CheckCircle2 className="size-5" />}
                title="Nicio sarcină"
                description="Nu ai sarcini active momentan"
              />
            )}
          </Card>

          {/* Recent Admins */}
          <Card>
            <div className="flex items-center justify-between pb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Administratori recenți</h2>
                <p className="text-sm text-muted-foreground">Conturi nou create</p>
              </div>
              <Link 
                href={localizedPath('/superadmin/admins')} 
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Vezi toți
                <ChevronRight className="size-4" />
              </Link>
            </div>
            
            {workbench.recentAdmins.length > 0 ? (
              <div className="space-y-2">
                {workbench.recentAdmins.slice(0, 5).map((admin) => (
                  <AdminCard key={admin.id} admin={admin} />
                ))}
              </div>
            ) : (
              <EmptyState 
                icon={<Users2 className="size-5" />}
                title="Niciun administrator"
                description="Nu există administratori înregistrați"
              />
            )}
          </Card>
        </div>

        {/* Activity Section */}
        <Card>
          <div className="flex items-center justify-between pb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Activitate recentă</h2>
              <p className="text-sm text-muted-foreground">Evenimente din platformă</p>
            </div>
            <Link 
              href={localizedPath('/superadmin/audit-logs')} 
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Jurnal complet
              <ExternalLink className="size-4" />
            </Link>
          </div>
          
          {workbench.activity.recent.length > 0 ? (
            <div className="space-y-1">
              {workbench.activity.recent.slice(0, 8).map((item) => (
                <ActivityItem key={item.id} activity={item} />
              ))}
            </div>
          ) : (
            <EmptyState 
              icon={<Activity className="size-5" />}
              title="Nicio activitate"
              description="Nu există evenimente recente"
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function PipelineCard({ organization, href }: { organization: OrganizationCard; href: string }) {
  const statusConfig = pipelineStatusConfig[organization.pipelineStatus] || pipelineStatusConfig.LEAD;
  
  return (
    <Link 
      href={href} 
      className="block rounded-lg border border-border bg-card p-3 transition-all hover:shadow-sm hover:border-primary/20"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{organization.shortName}</p>
          <p className="text-xs text-muted-foreground truncate">{organization.city || 'Oraș nespecificat'}</p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground shrink-0" />
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{organization.apartmentsCount} apt.</span>
        <span>·</span>
        <span>{organization.adminsCount} admin</span>
      </div>
    </Link>
  );
}

function OnboardingCard({ organization, href }: { organization: OrganizationCard; href: string }) {
  const missingItems = Object.entries(organization.onboardingMissing || {})
    .filter(([, missing]) => missing)
    .map(([key]) => missingLabels[key] || key);
  
  return (
    <Link 
      href={href} 
      className="block rounded-lg border border-border bg-card p-4 transition-all hover:shadow-sm hover:border-primary/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{organization.shortName}</p>
          <p className="text-sm text-muted-foreground">{organization.city || 'Oraș nespecificat'}</p>
        </div>
        <ArrowUpRight className="size-4 text-muted-foreground shrink-0" />
      </div>
      {missingItems.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Necesită configurare:</p>
          <div className="flex flex-wrap gap-1.5">
            {missingItems.map((item) => (
              <span 
                key={item} 
                className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </Link>
  );
}

function QuickAction({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link 
      href={href} 
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:shadow-sm hover:border-primary/20 group"
    >
      <div className="flex size-9 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
        <span className="text-muted-foreground group-hover:text-primary transition-colors">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </Link>
  );
}

function TaskCard({ task, href }: { task: WorkbenchTask; href: string }) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
  
  return (
    <Link 
      href={href} 
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:shadow-sm hover:border-primary/20"
    >
      <div className={`flex size-8 items-center justify-center rounded-lg ${isOverdue ? 'bg-rose-50' : 'bg-muted'}`}>
        <Calendar className={`size-4 ${isOverdue ? 'text-rose-600' : 'text-muted-foreground'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
        <p className="text-xs text-muted-foreground">
          Scadență: {formatDate(task.dueDate)}
          {isOverdue && <span className="text-rose-600 ml-1">• Întârziată</span>}
        </p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
    </Link>
  );
}

function AdminCard({ admin }: { admin: WorkbenchAdmin }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
        {adminName(admin).charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{adminName(admin)}</p>
        <p className="text-xs text-muted-foreground truncate">
          {admin.organization?.shortName || 'Neatribuit'} • {formatRelativeDate(admin.createdAt)}
        </p>
      </div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: WorkbenchActivity }) {
  return (
    <div className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors">
      <div className="flex size-8 items-center justify-center rounded-lg bg-muted mt-0.5">
        <Activity className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">{activity.title || activity.type || 'Activitate'}</p>
        <p className="text-xs text-muted-foreground">
          {activity.organization?.shortName || 'Platformă'} • {formatRelativeDate(activity.createdAt)}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
