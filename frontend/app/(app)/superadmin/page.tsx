'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Activity, 
  BookOpen,
  Building2, 
  Calendar,
  CheckCircle2, 
  ChevronRight, 
  Clock,
  CreditCard, 
  Database,
  HeartPulse,
  Kanban,
  LayoutGrid,
  LineChart,
  Phone,
  Plus, 
  Rocket,
  Settings, 
  Sparkles,
  Scale,
  Timer, 
  TrendingUp, 
  UserCog,
  Users,
  Zap,
  type LucideIcon
} from 'lucide-react';
import { ButtonLink, FeatureActionCard, PageHeader, StatusBadge } from '@/components/ui';
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
    emerald: 'bg-success/10 text-success',
    blue: 'bg-info/10 text-info',
    amber: 'bg-warning/10 text-warning',
    slate: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-card transition-all duration-200 hover:border-primary/20 hover:shadow-card-hover">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={`flex size-10 items-center justify-center rounded-xl ${colorClasses[color]}`}>
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-4">
        <span className="text-3xl font-semibold tracking-tight text-foreground">{value}</span>
        {trend && (
          <span className="ml-2 text-sm text-success">{trend}</span>
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
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${dotColor}`} />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <span className="rounded-full border border-border/70 bg-muted/55 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </div>
      
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/35 p-4 text-center text-sm text-muted-foreground">
            Nu există asociații
          </div>
        ) : (
          items.slice(0, 3).map((org) => (
            <Link
              key={org.id}
              href={localizedPath(`/superadmin/organizations/${org.id}`)}
              className="block rounded-2xl border border-border/80 bg-white p-4 shadow-card transition-all hover:border-primary/20 hover:shadow-card-hover"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{org.shortName}</p>
                  {org.associationCode && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{org.associationCode}</p>
                  )}
                </div>
                {org.onboardingMissing && Object.keys(org.onboardingMissing).length > 0 && (
                  <span className="shrink-0 rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                    {Object.keys(org.onboardingMissing).length} lipsă
                  </span>
                )}
              </div>
              
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
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
  icon: LucideIcon;
  title: string; 
  description: string; 
  href: string;
}) {
  return <FeatureActionCard icon={Icon} title={title} description={description} href={href} actionLabel="Deschide" tone="primary" />;
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
    { key: 'lead', title: 'Lead', items: workbench.pipeline.lead, dotColor: 'bg-muted-foreground' },
    { key: 'onboarding', title: 'Onboarding', items: workbench.pipeline.onboarding, dotColor: 'bg-warning' },
    { key: 'trial', title: 'Trial', items: workbench.pipeline.trial, dotColor: 'bg-info' },
    { key: 'active', title: 'Activ', items: workbench.pipeline.active, dotColor: 'bg-success' },
    { key: 'inactive', title: 'Inactiv', items: workbench.pipeline.inactive, dotColor: 'bg-border' },
  ];

  const allTasks = [...workbench.tasks.overdue, ...workbench.tasks.dueToday, ...workbench.tasks.upcoming];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Superadmin"
        title="Platformă Espace"
        description="CRM pentru gestionarea A.P.C.-urilor din Republica Moldova."
        badge={
          <StatusBadge
            status={source === 'loading' ? 'PENDING' : source === 'api' ? 'ACTIVE' : 'WARNING'}
            label={source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'Offline'}
            dot
          />
        }
        actions={
          <ButtonLink href={localizedPath('/superadmin/organizations')}>
            <Plus className="size-4" />
            Adaugă A.P.C.
          </ButtonLink>
        }
      />

      <div>
        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-warning/20 bg-warning/10 p-4 text-sm text-warning">
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
              <div key={stat.label} className="flex items-center gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-card">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <stat.icon className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-semibold text-foreground">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pipeline */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Pipeline A.P.C.</h2>
              <p className="text-sm text-muted-foreground">Asociații urmărite ca profiluri CRM</p>
            </div>
            <Link 
              href={localizedPath('/superadmin/organizations')}
              className="text-sm font-medium text-primary hover:text-primary/80"
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
            <h2 className="mb-4 text-lg font-semibold text-foreground">Acțiuni rapide</h2>
            <div className="grid gap-3 sm:grid-cols-2">
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
                href={localizedPath('/superadmin/admins')}
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
              <QuickActionCard
                icon={Rocket}
                title="Release Notes"
                description="Changelog public, update-uri pe roluri și confirmări de citire"
                href={localizedPath('/superadmin/release-notes')}
              />
              <QuickActionCard
                icon={Phone}
                title="Cereri acces"
                description="Cererile de acces și contact primite prin website"
                href={localizedPath('/superadmin/access-requests')}
              />
              <QuickActionCard
                icon={Kanban}
                title="Client Pipeline"
                description="Lifecycle CRM, follow-up-uri, taskuri si risc client"
                href={localizedPath('/superadmin/clients')}
              />
              <QuickActionCard
                icon={Calendar}
                title="Agenda CRM"
                description="Taskuri, follow-up-uri si reminder-e interne pentru clienti"
                href={localizedPath('/superadmin/clients/my-work')}
              />
              <QuickActionCard
                icon={BookOpen}
                title="Knowledge Base"
                description="Note, contacte, decizii si probleme cunoscute pentru clienti"
                href={localizedPath('/superadmin/knowledge')}
              />
              <QuickActionCard
                icon={HeartPulse}
                title="Client Health"
                description="Health score, clienti in risc si actiuni recomandate"
                href={localizedPath('/superadmin/client-health')}
              />
              <QuickActionCard
                icon={Zap}
                title="Customer Success"
                description="Playbook-uri, interventii si workflow-uri ghidate pentru clienti"
                href={localizedPath('/superadmin/customer-success')}
              />
              <QuickActionCard
                icon={LineChart}
                title="Customer Success Reports"
                description="Portfolio analytics, health, revenue si playbook performance"
                href={localizedPath('/superadmin/customer-success/reports')}
              />
              <QuickActionCard
                icon={CreditCard}
                title="Revenue Operations"
                description="Facturi SaaS restante, promisiuni de plata si follow-up-uri comerciale"
                href={localizedPath('/superadmin/revenue')}
              />
              <QuickActionCard
                icon={TrendingUp}
                title="Revenue Forecast"
                description="Forecast MRR/ARR si oportunitati de upgrade pe planuri SaaS"
                href={localizedPath('/superadmin/revenue/forecast')}
              />
              <QuickActionCard
                icon={Timer}
                title="Retention & Renewals"
                description="Churn risk, reînnoiri si planuri manuale de retenție"
                href={localizedPath('/superadmin/retention')}
              />
              <QuickActionCard
                icon={Scale}
                title="Legal & Trust"
                description="Documente legale, versiuni si cereri privacy/security"
                href={localizedPath('/superadmin/legal')}
              />
              <QuickActionCard
                icon={Rocket}
                title="Go-Live Control Center"
                description="Checklist lansare, servicii critice si costuri lunare"
                href={localizedPath('/superadmin/launch')}
              />
              <QuickActionCard
                icon={Database}
                title="Backup & Recovery"
                description="Plan backup, runbooks, recovery drills si incidente production"
                href={localizedPath('/superadmin/backup')}
              />
            </div>
          </section>

          {/* Tasks & Activity */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Sarcini și activitate</h2>
            
            {allTasks.length > 0 ? (
              <div className="rounded-2xl border border-border/80 bg-card shadow-card">
                {allTasks.slice(0, 5).map((task, idx) => (
                  <div 
                    key={task.id} 
                    className={`flex items-center gap-4 p-4 ${idx < allTasks.length - 1 ? 'border-b border-border/60' : ''}`}
                  >
                    <div className={`flex size-8 items-center justify-center rounded-full ${
                      task.priority === 'HIGH' ? 'bg-critical/10' : 'bg-muted'
                    }`}>
                      <Clock className={`size-4 ${task.priority === 'HIGH' ? 'text-critical' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                      {task.dueDate && (
                        <p className="text-xs text-muted-foreground">{formatRelativeDate(task.dueDate)}</p>
                      )}
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/80 bg-card p-8 text-center shadow-card">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
                  <CheckCircle2 className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Nicio sarcină activă</p>
                <p className="mt-1 text-sm text-muted-foreground">Toate sarcinile au fost finalizate</p>
              </div>
            )}

            {/* Recent Activity */}
            {workbench.activity.recent.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-medium text-foreground">Activitate recentă</h3>
                <div className="space-y-2">
                  {workbench.activity.recent.slice(0, 3).map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3">
                      <span className="size-2 rounded-full bg-success" />
                      <p className="flex-1 truncate text-sm text-muted-foreground">
                        {activity.title || activity.message}
                      </p>
                      <span className="text-xs text-muted-foreground">{formatRelativeDate(activity.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
