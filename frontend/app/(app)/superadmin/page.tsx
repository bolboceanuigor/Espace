'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { 
  Activity, 
  ArrowRight, 
  ArrowUpRight, 
  Building2, 
  Calendar,
  CheckCircle2, 
  ChevronRight, 
  Clock,
  CreditCard, 
  ExternalLink,
  Home,
  LayoutGrid,
  Plus, 
  Settings, 
  ShieldCheck, 
  Sparkles,
  Timer, 
  TrendingUp, 
  UserCog,
  Users,
  Zap
} from 'lucide-react';
import { superadminApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

// ============================================================================
// TYPES
// ============================================================================
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
  pipeline: { lead: [], onboarding: [], trial: [], active: [], inactive: [] },
  recentOrganizations: [],
  recentAdmins: [],
  tasks: { dueToday: [], overdue: [], upcoming: [] },
  activity: { recent: [] },
};

// ============================================================================
// HELPERS
// ============================================================================
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

const missingLabels: Record<string, string> = {
  admin: 'Administrator',
  building: 'Bloc',
  apartments: 'Apartamente',
  tariff: 'Tarife',
  invoice: 'Facturi',
};

// ============================================================================
// COMPONENTS
// ============================================================================
function KpiCard({ 
  label, 
  value, 
  icon: Icon, 
  trend,
  color = 'emerald' 
}: { 
  label: string; 
  value: string | number; 
  icon: React.ElementType;
  trend?: string;
  color?: 'emerald' | 'blue' | 'amber' | 'slate';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:shadow-md hover:border-slate-300">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className={`flex size-10 items-center justify-center rounded-xl ${colorClasses[color]}`}>
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-4">
        <span className="text-3xl font-semibold text-slate-900">{value}</span>
        {trend && (
          <span className="ml-2 text-sm text-emerald-600">{trend}</span>
        )}
      </div>
    </div>
  );
}

function PipelineColumn({ 
  title, 
  count, 
  items, 
  dotColor,
  localizedPath 
}: { 
  title: string; 
  count: number; 
  items: OrganizationCard[];
  dotColor: string;
  localizedPath: (path: string) => string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${dotColor}`} />
          <span className="text-sm font-semibold text-slate-700">{title}</span>
        </div>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 shadow-sm">
          {count}
        </span>
      </div>
      
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl bg-white p-4 text-center text-sm text-slate-400">
            Nu există asociații
          </div>
        ) : (
          items.slice(0, 3).map((org) => (
            <Link
              key={org.id}
              href={localizedPath(`/superadmin/organizations/${org.id}`)}
              className="block rounded-xl bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-emerald-200 border border-transparent"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{org.shortName}</p>
                  {org.associationCode && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">{org.associationCode}</p>
                  )}
                </div>
                {org.onboardingMissing && Object.keys(org.onboardingMissing).length > 0 && (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {Object.keys(org.onboardingMissing).length} lipsă
                  </span>
                )}
              </div>
              
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Building2 className="size-3.5" />
                  {org.apartmentsCount}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" />
                  {org.residentsCount}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function QuickActionCard({ 
  icon: Icon, 
  title, 
  description, 
  href 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string; 
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:shadow-md hover:border-emerald-200"
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-emerald-50">
        <Icon className="size-6 text-slate-600 transition-colors group-hover:text-emerald-600" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-slate-900">{title}</p>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
      <ChevronRight className="size-5 text-slate-400 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
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

    return () => { active = false; };
  }, []);

  const pipelineColumns = [
    { key: 'lead', title: 'Lead', items: workbench.pipeline.lead, dotColor: 'bg-slate-400' },
    { key: 'onboarding', title: 'Onboarding', items: workbench.pipeline.onboarding, dotColor: 'bg-amber-400' },
    { key: 'trial', title: 'Trial', items: workbench.pipeline.trial, dotColor: 'bg-blue-400' },
    { key: 'active', title: 'Activ', items: workbench.pipeline.active, dotColor: 'bg-emerald-400' },
    { key: 'inactive', title: 'Inactiv', items: workbench.pipeline.inactive, dotColor: 'bg-slate-300' },
  ];

  const allTasks = [...workbench.tasks.overdue, ...workbench.tasks.dueToday, ...workbench.tasks.upcoming];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                <Home className="size-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Platformă Espace</h1>
                <p className="text-sm text-slate-500">CRM pentru gestionarea A.P.C.-urilor din Republica Moldova</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Status badge */}
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                source === 'loading' ? 'bg-slate-100 text-slate-600' : 
                source === 'api' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                <span className={`size-1.5 rounded-full ${
                  source === 'loading' ? 'bg-slate-400 animate-pulse' : 
                  source === 'api' ? 'bg-emerald-500' : 
                  'bg-amber-500'
                }`} />
                {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'Offline'}
              </div>
              
              <Link 
                href={localizedPath('/superadmin/organizations')} 
                className="btn-primary"
              >
                <Plus className="size-4" />
                Adaugă A.P.C.
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-center gap-2">
              <Activity className="size-4" />
              {error}
            </div>
          </div>
        )}

        {/* KPIs */}
        <section className="mb-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard 
              label="Total A.P.C." 
              value={workbench.kpis.totalOrganizations} 
              icon={Building2}
              color="slate"
            />
            <KpiCard 
              label="Active" 
              value={workbench.kpis.activeOrganizations} 
              icon={CheckCircle2}
              color="emerald"
            />
            <KpiCard 
              label="În onboarding" 
              value={workbench.kpis.onboardingOrganizations} 
              icon={Zap}
              color="amber"
            />
            <KpiCard 
              label="Apartamente totale" 
              value={workbench.kpis.totalApartments} 
              icon={LayoutGrid}
              color="blue"
            />
          </div>
        </section>

        {/* Secondary Stats */}
        <section className="mb-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Administratori', value: workbench.kpis.totalAdmins, icon: UserCog },
              { label: 'Locatari', value: workbench.kpis.totalResidents, icon: Users },
              { label: 'Trial', value: workbench.kpis.trialOrganizations, icon: Timer },
              { label: 'Venit lunar estimat', value: `${workbench.kpis.estimatedMonthlyRevenue.toLocaleString('ro-RO')} MDL`, icon: CreditCard },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100">
                  <stat.icon className="size-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                  <p className="text-lg font-semibold text-slate-900">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pipeline */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Pipeline A.P.C.</h2>
              <p className="text-sm text-slate-500">Asociații urmărite ca profiluri CRM</p>
            </div>
            <Link 
              href={localizedPath('/superadmin/organizations')}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              Vezi toate asociațiile
            </Link>
          </div>
          
          <div className="grid gap-4 lg:grid-cols-5">
            {pipelineColumns.map((col) => (
              <PipelineColumn
                key={col.key}
                title={col.title}
                count={col.items.length}
                items={col.items}
                dotColor={col.dotColor}
                localizedPath={localizedPath}
              />
            ))}
          </div>
        </section>

        {/* Bottom Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Quick Actions */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Acțiuni rapide</h2>
            <div className="space-y-3">
              <QuickActionCard
                icon={Plus}
                title="Adaugă asociație nouă"
                description="Creează o nouă A.P.C. în sistem"
                href={localizedPath('/superadmin/organizations')}
              />
              <QuickActionCard
                icon={UserCog}
                title="Gestionează administratori"
                description="Vezi și editează conturile admin"
                href={localizedPath('/superadmin/administrators')}
              />
              <QuickActionCard
                icon={Settings}
                title="Setări platformă"
                description="Configurează opțiunile globale"
                href={localizedPath('/superadmin/settings')}
              />
              <QuickActionCard
                icon={Sparkles}
                title="Help & Docs"
                description="Articole publicate, drafturi și feedback de la utilizatori"
                href={localizedPath('/superadmin/help')}
              />
            </div>
          </section>

          {/* Tasks & Activity */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Sarcini și activitate</h2>
            
            {allTasks.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white">
                {allTasks.slice(0, 5).map((task, idx) => (
                  <div 
                    key={task.id} 
                    className={`flex items-center gap-4 p-4 ${idx < allTasks.length - 1 ? 'border-b border-slate-100' : ''}`}
                  >
                    <div className={`flex size-8 items-center justify-center rounded-full ${
                      task.priority === 'HIGH' ? 'bg-red-50' : 'bg-slate-100'
                    }`}>
                      <Clock className={`size-4 ${task.priority === 'HIGH' ? 'text-red-500' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
                      {task.dueDate && (
                        <p className="text-xs text-slate-500">{formatRelativeDate(task.dueDate)}</p>
                      )}
                    </div>
                    <ChevronRight className="size-4 text-slate-400" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100">
                  <CheckCircle2 className="size-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-900">Nicio sarcină activă</p>
                <p className="mt-1 text-sm text-slate-500">Toate sarcinile au fost finalizate</p>
              </div>
            )}

            {/* Recent Activity */}
            {workbench.activity.recent.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-medium text-slate-700">Activitate recentă</h3>
                <div className="space-y-2">
                  {workbench.activity.recent.slice(0, 3).map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                      <span className="size-2 rounded-full bg-emerald-400" />
                      <p className="flex-1 truncate text-sm text-slate-600">
                        {activity.title || activity.message}
                      </p>
                      <span className="text-xs text-slate-400">{formatRelativeDate(activity.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
