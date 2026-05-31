'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileSignature,
  ListChecks,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Badge, Card, PageHeader, StatCard } from '@/components/ui';
import { superadminApi, superadminRevenueApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type RevenueFilters = {
  search: string;
  contractStatus: string;
  subscriptionStatus: string;
  launchStatus: string;
  minMonthlyAmount: string;
  maxMonthlyAmount: string;
};

const emptyFilters: RevenueFilters = {
  search: '',
  contractStatus: '',
  subscriptionStatus: '',
  launchStatus: '',
  minMonthlyAmount: '',
  maxMonthlyAmount: '',
};

const contractStatuses = ['', 'NOT_STARTED', 'DRAFT', 'SENT', 'SIGNED', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED'];
const subscriptionStatuses = ['', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'SUSPENDED', 'CANCELLED'];
const launchStatuses = ['', 'DRAFT', 'INTERNAL_REVIEW', 'READY', 'LIVE'];

const contractLabels: Record<string, string> = {
  NOT_STARTED: 'Neînceput',
  DRAFT: 'Draft',
  SENT: 'Trimis',
  SIGNED: 'Semnat',
  ACTIVE: 'Activ',
  PAUSED: 'Pauzat',
  CANCELLED: 'Anulat',
  EXPIRED: 'Expirat',
};

const subscriptionLabels: Record<string, string> = {
  TRIAL: 'Trial',
  ACTIVE: 'Activ',
  PAST_DUE: 'Past due',
  PAUSED: 'Pauzat',
  SUSPENDED: 'Suspendat',
  CANCELLED: 'Anulat',
};

const launchLabels: Record<string, string> = {
  DRAFT: 'Draft',
  INTERNAL_REVIEW: 'Revizie internă',
  READY: 'Ready',
  LIVE: 'Live',
};

const pricingLabels: Record<string, string> = {
  PER_APARTMENT: 'Per apartament',
  FIXED_MONTHLY: 'Fix lunar',
  CUSTOM: 'Custom',
};

export default function SuperadminRevenueDashboardPage() {
  const localizedPath = useLocalizedPath();
  const [overview, setOverview] = useState<any | null>(null);
  const [organizations, setOrganizations] = useState<any>({ items: [], page: 1, total: 0, totalPages: 1 });
  const [pipeline, setPipeline] = useState<any>({ items: [] });
  const [commercialWarnings, setCommercialWarnings] = useState<any>({ summary: [], items: [] });
  const [billingTasksSummary, setBillingTasksSummary] = useState<any>({});
  const [notificationsSummary, setNotificationsSummary] = useState<any>({});
  const [filters, setFilters] = useState<RevenueFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const organizationQuery = useMemo(() => ({
    search: filters.search || undefined,
    contractStatus: filters.contractStatus || undefined,
    subscriptionStatus: filters.subscriptionStatus || undefined,
    launchStatus: filters.launchStatus || undefined,
    minMonthlyAmount: filters.minMonthlyAmount || undefined,
    maxMonthlyAmount: filters.maxMonthlyAmount || undefined,
    page,
    limit: 20,
  }), [filters, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, organizationsRes, pipelineRes, warningsRes, billingTasksRes, notificationsRes] = await Promise.all([
        superadminRevenueApi.getSuperadminRevenueOverview(),
        superadminRevenueApi.getSuperadminRevenueOrganizations(organizationQuery),
        superadminRevenueApi.getSuperadminRevenuePipeline(),
        superadminRevenueApi.getSuperadminRevenueWarnings(),
        superadminApi.getSuperadminBillingTasks({ limit: 1 }).catch(() => ({ data: { summary: {} } })),
        superadminApi.getSuperadminNotificationsSummary().catch(() => ({ data: {} })),
      ]);
      setOverview(overviewRes.data);
      setOrganizations(organizationsRes.data || { items: [], page: 1, total: 0, totalPages: 1 });
      setPipeline(pipelineRes.data || { items: [] });
      setCommercialWarnings(warningsRes.data || { summary: [], items: [] });
      setBillingTasksSummary(billingTasksRes.data?.summary || {});
      setNotificationsSummary(notificationsRes.data || {});
    } catch (loadError: any) {
      setError(String(loadError?.message || 'Nu am putut încărca dashboard-ul revenue.'));
      setOverview(null);
      setOrganizations({ items: [], page: 1, total: 0, totalPages: 1 });
      setPipeline({ items: [] });
      setCommercialWarnings({ summary: [], items: [] });
      setBillingTasksSummary({});
      setNotificationsSummary({});
    } finally {
      setLoading(false);
    }
  }, [organizationQuery]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const warnings = commercialWarnings.summary?.length ? commercialWarnings.summary : overview?.warnings || [];
  const hasCommercialData = Boolean(
    (overview?.estimatedMonthlyRevenue || 0) > 0 ||
    (overview?.readyForBillingCount || 0) > 0 ||
    (organizations.items || []).some((item: any) => item.contractStatus || item.subscriptionStatus),
  );

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Revenue Dashboard"
        description="Venituri estimate, contracte și abonamente Espace."
        badge={<Badge variant="neutral">Estimare internă</Badge>}
        rightSlot={
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? (
        <Card className="border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700">
          {error}
        </Card>
      ) : null}

      {!loading && !hasCommercialData ? (
        <Card className="border-dashed">
          <p className="font-semibold text-foreground">Nu există contracte sau abonamente configurate încă.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            După ce creezi contracte în pagina organizației, estimările vor apărea aici.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Venit lunar estimat" value={`${money(overview?.estimatedMonthlyRevenue)} ${overview?.currency || 'MDL'}`} description="MRR estimat, nu bani încasați real." icon={<Banknote className="h-5 w-5" />} tone="success" />
        <StatCard label="Venit anual estimat" value={`${money(overview?.estimatedAnnualRevenue)} ${overview?.currency || 'MDL'}`} description="Calculat din MRR estimat." icon={<TrendingUp className="h-5 w-5" />} tone="neutral" />
        <StatCard label="Clienți activi" value={overview?.activeOrganizationsCount || 0} description="Organizații marcate active." icon={<Users className="h-5 w-5" />} tone="neutral" />
        <StatCard label="Organizații live" value={overview?.liveOrganizationsCount || 0} description="Launch status LIVE." icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Gata de facturare" value={overview?.readyForBillingCount || 0} description="Live, contract și abonament active." icon={<Building2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Trial" value={overview?.trialOrganizationsCount || 0} description="Abonamente în trial." icon={<CalendarClock className="h-5 w-5" />} tone="warning" />
        <StatCard label="Contracte nesemnate" value={overview?.unsignedContractsCount || 0} description="Draft, sent, expirat sau neactiv." icon={<FileSignature className="h-5 w-5" />} tone="warning" />
        <StatCard label="Fără contract" value={overview?.missingContractsCount || 0} description="Organizații fără contract comercial." icon={<AlertTriangle className="h-5 w-5" />} tone="danger" />
        <StatCard label="Abonamente inactive" value={overview?.inactiveSubscriptionsCount || 0} description="Lipsă sau status neactiv." icon={<CreditCard className="h-5 w-5" />} tone="danger" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <SectionTitle title="MRR estimat" description="Calcul intern bazat pe contracte și abonamente introduse manual." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="MRR" value={`${money(overview?.estimatedMonthlyRevenue)} ${overview?.currency || 'MDL'}`} />
            <Metric label="ARR" value={`${money(overview?.estimatedAnnualRevenue)} ${overview?.currency || 'MDL'}`} />
            <Metric label="ARPO" value={`${money(overview?.averageRevenuePerOrganization)} ${overview?.currency || 'MDL'}`} />
            <Metric label="ARPA" value={`${money(overview?.averageRevenuePerApartment)} ${overview?.currency || 'MDL'}`} />
            <Metric label="Apartamente sub contract" value={overview?.totalApartmentsUnderContract || 0} />
          </div>
        </Card>

        <Card>
          <SectionTitle title="Probleme comerciale" description="Warning-uri agregate din contracte, abonamente și status launch." />
          {warnings.length ? (
            <div className="space-y-2">
              {warnings.slice(0, 6).map((warning: any) => (
                <div key={warning.code || warning.label} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm">
                  <span className="font-medium text-foreground">{warning.label}</span>
                  <Badge variant={warning.count ? 'warning' : 'neutral'}>{warning.count || 0}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyText>Nu există warning-uri comerciale active.</EmptyText>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-muted/40 text-foreground">
              <ListChecks className="h-5 w-5" />
            </span>
            <div>
              <SectionTitle title="Taskuri facturare" description="Transformă warning-urile comerciale în follow-up-uri concrete pentru Superadmin." />
              <div className="flex flex-wrap gap-2">
                <Badge variant={(billingTasksSummary.open || 0) > 0 ? 'warning' : 'neutral'}>{billingTasksSummary.open || 0} deschise</Badge>
                <Badge variant={(billingTasksSummary.urgent || 0) > 0 ? 'error' : 'neutral'}>{billingTasksSummary.urgent || 0} urgente</Badge>
                <Badge variant={(billingTasksSummary.dueNext7Days || 0) > 0 ? 'default' : 'neutral'}>{billingTasksSummary.dueNext7Days || 0} scadente în 7 zile</Badge>
              </div>
            </div>
          </div>
          <Link href={localizedPath('/superadmin/billing-tasks')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
            Deschide taskuri
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-muted/40 text-foreground">
              <Bell className="h-5 w-5" />
            </span>
            <div>
              <SectionTitle title="Notificări Superadmin" description="Evenimente critice și warning-uri operaționale generate din CRM, onboarding și facturare." />
              <div className="flex flex-wrap gap-2">
                <Badge variant={(notificationsSummary.unreadCount || 0) > 0 ? 'warning' : 'neutral'}>{notificationsSummary.unreadCount || 0} necitite</Badge>
                <Badge variant={(notificationsSummary.criticalCount || 0) > 0 ? 'error' : 'neutral'}>{notificationsSummary.criticalCount || 0} critice</Badge>
                <Badge variant={(notificationsSummary.warningCount || 0) > 0 ? 'warning' : 'neutral'}>{notificationsSummary.warningCount || 0} warning-uri</Badge>
              </div>
            </div>
          </div>
          <Link href={localizedPath('/superadmin/notifications')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
            Deschide notificări
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Top clienți după valoare lunară" description="Organizații cu cea mai mare estimare lunară calculabilă." />
        {overview?.topOrganizations?.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {overview.topOrganizations.map((item: any) => (
              <Link key={item.organizationId} href={localizedPath(`/superadmin/organizations/${item.organizationId}?tab=contract`)} className="rounded-lg border border-border/70 p-3 transition hover:bg-muted/50">
                <p className="truncate font-semibold text-foreground">{item.organizationName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.city || 'Oraș lipsă'}</p>
                <p className="mt-3 text-lg font-semibold text-foreground">{money(item.estimatedMonthlyAmount)} {item.currency || 'MDL'}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyText>Nu există organizații cu valoare lunară estimabilă.</EmptyText>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle title="Organizații & revenue" description="Status comercial pe fiecare organizație, calculat din date reale." />
          <button
            type="button"
            onClick={() => {
              setFilters(emptyFilters);
              setPage(1);
            }}
            className="min-h-10 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60"
          >
            Resetează filtre
          </button>
        </div>
        <RevenueFiltersBar
          filters={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
        />
        <OrganizationsTable items={organizations.items || []} localizedPath={localizedPath} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{organizations.total || 0} organizații</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="min-h-9 rounded-xl border border-border/70 px-3 font-semibold disabled:opacity-50">
              Anterior
            </button>
            <span>Pagina {organizations.page || page} / {organizations.totalPages || 1}</span>
            <button type="button" disabled={page >= (organizations.totalPages || 1) || loading} onClick={() => setPage((current) => current + 1)} className="min-h-9 rounded-xl border border-border/70 px-3 font-semibold disabled:opacity-50">
              Următor
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Revenue pipeline" description="Organizații care pot deveni revenue activ sau trebuie convertite comercial." />
        {pipeline.items?.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {pipeline.items.map((item: any) => (
              <article key={item.organizationId} className="rounded-lg border border-border/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={localizedPath(`/superadmin/organizations/${item.organizationId}`)} className="font-semibold text-foreground hover:underline">
                      {item.organizationName}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">{item.city || 'Oraș lipsă'} · {item.apcCode || 'Cod APC lipsă'}</p>
                  </div>
                  <Badge variant={statusTone(item.status)}>{item.status || 'Pipeline'}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{item.reasons?.join(', ')}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{item.nextAction}</p>
                  <span className="text-sm text-muted-foreground">{money(item.estimatedMonthlyAmount)} {item.currency || 'MDL'}/lună</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyText>Nu există organizații în revenue pipeline.</EmptyText>
        )}
      </Card>
    </div>
  );
}

function RevenueFiltersBar({ filters, onChange }: { filters: RevenueFilters; onChange: (filters: RevenueFilters) => void }) {
  return (
    <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr_0.8fr_0.8fr]">
      <label className="block">
        <span className="label">Search</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="input pl-9" value={filters.search} onChange={(event) => onChange({ ...filters, search: event.target.value })} placeholder="Organizație, oraș, cod APC" />
        </div>
      </label>
      <SelectField label="Contract" value={filters.contractStatus} options={contractStatuses} labels={contractLabels} onChange={(value) => onChange({ ...filters, contractStatus: value })} />
      <SelectField label="Abonament" value={filters.subscriptionStatus} options={subscriptionStatuses} labels={subscriptionLabels} onChange={(value) => onChange({ ...filters, subscriptionStatus: value })} />
      <SelectField label="Launch" value={filters.launchStatus} options={launchStatuses} labels={launchLabels} onChange={(value) => onChange({ ...filters, launchStatus: value })} />
      <InputField label="Min lunar" value={filters.minMonthlyAmount} onChange={(value) => onChange({ ...filters, minMonthlyAmount: value })} />
      <InputField label="Max lunar" value={filters.maxMonthlyAmount} onChange={(value) => onChange({ ...filters, maxMonthlyAmount: value })} />
    </div>
  );
}

function OrganizationsTable({ items, localizedPath }: { items: any[]; localizedPath: (path: string) => string }) {
  if (!items.length) {
    return <EmptyText>Nu există organizații pentru filtrele selectate.</EmptyText>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] text-left text-sm">
        <thead className="border-b border-border/70 text-xs uppercase text-muted-foreground">
          <tr>
            {['Organizație', 'Oraș', 'Cod APC', 'Launch', 'Contract', 'Abonament', 'Model tarifare', 'Apartamente', 'Venit lunar estimat', 'Următoarea facturare', 'Warnings', 'Acțiuni'].map((header) => (
              <th key={header} className="px-3 py-3 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {items.map((item) => (
            <tr key={item.organizationId} className="align-top">
              <td className="px-3 py-4">
                <Link href={localizedPath(`/superadmin/organizations/${item.organizationId}`)} className="font-semibold text-foreground hover:underline">
                  {item.organizationName}
                </Link>
                <p className="text-xs text-muted-foreground">{item.legalName || 'Denumire juridică lipsă'}</p>
              </td>
              <td className="px-3 py-4 text-muted-foreground">{item.city || '-'}</td>
              <td className="px-3 py-4 text-muted-foreground">{item.apcCode || '-'}</td>
              <td className="px-3 py-4"><Badge variant={statusTone(item.launchStatus)}>{launchLabels[item.launchStatus] || item.launchStatus || '-'}</Badge></td>
              <td className="px-3 py-4"><Badge variant={statusTone(item.contractStatus)}>{contractLabels[item.contractStatus] || item.contractStatus || 'Lipsă'}</Badge></td>
              <td className="px-3 py-4"><Badge variant={statusTone(item.subscriptionStatus)}>{subscriptionLabels[item.subscriptionStatus] || item.subscriptionStatus || 'Lipsă'}</Badge></td>
              <td className="px-3 py-4 text-muted-foreground">{pricingLabels[item.pricingModel] || '-'}</td>
              <td className="px-3 py-4 font-medium text-foreground">{item.apartmentsCount || 0}</td>
              <td className="px-3 py-4 font-semibold text-foreground">{money(item.estimatedMonthlyAmount)} {item.currency || 'MDL'}</td>
              <td className="px-3 py-4 text-muted-foreground">{date(item.nextBillingDate)}</td>
              <td className="px-3 py-4">
                {item.warnings?.length ? (
                  <div className="flex max-w-[260px] flex-wrap gap-1">
                    {item.warnings.slice(0, 3).map((warning: string) => <Badge key={warning} variant="warning">{warning}</Badge>)}
                    {item.warnings.length > 3 ? <Badge variant="neutral">+{item.warnings.length - 3}</Badge> : null}
                  </div>
                ) : (
                  <Badge variant="success">OK</Badge>
                )}
              </td>
              <td className="px-3 py-4">
                <div className="flex flex-wrap gap-2">
                  <Link href={localizedPath(`/superadmin/organizations/${item.organizationId}`)} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-border/70 px-3 font-semibold text-foreground hover:bg-muted/60">
                    Organizație
                  </Link>
                  <Link href={localizedPath(`/superadmin/organizations/${item.organizationId}?tab=contract`)} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-border/70 px-3 font-semibold text-foreground hover:bg-muted/60">
                    Contract
                  </Link>
                  <Link href={localizedPath(`/superadmin/organizations/${item.organizationId}/onboarding`)} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-border/70 px-3 font-semibold text-foreground hover:bg-muted/60">
                    Onboarding
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SelectField({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option || 'all'} value={option}>{option ? labels[option] || option : 'Toate'}</option>)}
      </select>
    </label>
  );
}

function InputField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function statusTone(value?: string | null): 'default' | 'success' | 'warning' | 'error' | 'neutral' {
  if (!value) return 'neutral';
  if (['ACTIVE', 'SIGNED', 'LIVE', 'READY'].includes(value)) return 'success';
  if (['TRIAL', 'DRAFT', 'SENT', 'INTERNAL_REVIEW', 'NOT_STARTED'].includes(value)) return 'warning';
  if (['PAST_DUE', 'PAUSED', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'Abonament neactiv', 'Fără contract'].includes(value)) return 'error';
  return 'neutral';
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString('ro-MD', { maximumFractionDigits: 2 });
}

function date(value?: string | Date | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ro-MD');
}
