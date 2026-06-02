'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, BarChart3, Building2, CreditCard, RefreshCw, ShieldAlert, TrendingDown, Users } from 'lucide-react';
import { Button, ButtonLink, EmptyState, ErrorState, PageHeader } from '@/components/ui';
import { billingSaasApi, superadminApi, superadminRevenueApi, superadminRetentionApi } from '@/lib/api';

type ReportsState = {
  workbench: any | null;
  usage: any | null;
  revenue: any | null;
  retention: any | null;
};

const emptyState: ReportsState = {
  workbench: null,
  usage: null,
  revenue: null,
  retention: null,
};

function money(value: unknown) {
  const amount = Number(value || 0);
  return amount.toLocaleString('ro-RO');
}

function KpiCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  note?: string;
  icon: React.ElementType;
}) {
  return (
    <article className="rounded-2xl border border-border/80 bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="flex size-10 items-center justify-center rounded-2xl border border-primary/15 bg-accent/35 text-primary">
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
    </article>
  );
}

function SectionCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MiniTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
}) {
  if (!rows.length) {
    return <EmptyState size="sm" title="Nu există date suficiente" description="Această secțiune se va popula când există activitate reală în platformă." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-3 text-foreground">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SuperadminReportsPage() {
  const [data, setData] = useState<ReportsState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      superadminApi.workbench(),
      billingSaasApi.superadminUsageOverview({ limit: 8 }),
      superadminRevenueApi.reports(),
      superadminRetentionApi.reports(),
    ]);

    const nextState: ReportsState = {
      workbench: results[0].status === 'fulfilled' ? results[0].value.data : null,
      usage: results[1].status === 'fulfilled' ? results[1].value.data : null,
      revenue: results[2].status === 'fulfilled' ? results[2].value.data : null,
      retention: results[3].status === 'fulfilled' ? results[3].value.data : null,
    };

    const failedCount = results.filter((item) => item.status === 'rejected').length;
    const successCount = results.length - failedCount;

    setData(nextState);

    if (successCount === 0) {
      setError('Nu am putut încărca niciun raport din backend. Verifică API-ul și sesiunea de superadmin.');
    } else if (failedCount > 0) {
      setError('O parte din rapoarte nu s-au încărcat. Pagina afișează tot ce a putut citi din backend.');
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Rapoarte"
          description="Centralizează sănătatea platformei, riscurile comerciale și semnalele de retenție."
        />
        <div className="rounded-2xl border border-border/80 bg-card p-6 text-sm text-muted-foreground shadow-card">
          Se încarcă rapoartele platformei...
        </div>
      </div>
    );
  }

  if (!data.workbench && !data.usage && !data.revenue && !data.retention) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Rapoarte"
          description="Centralizează sănătatea platformei, riscurile comerciale și semnalele de retenție."
          actions={<Button onClick={() => void load()} variant="secondary"><RefreshCw className="h-4 w-4" />Reîncarcă</Button>}
        />
        <ErrorState
          title="Rapoartele nu sunt disponibile"
          message={error || 'Nu am putut încărca datele necesare pentru această pagină.'}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  const workbenchKpis = data.workbench?.kpis || {};
  const usageKpis = data.usage?.kpis || {};
  const revenueDashboard = data.revenue?.dashboard || {};
  const retentionSummary = data.retention?.summary || {};
  const recentOrganizations = data.workbench?.recentOrganizations || [];
  const recentActivity = data.workbench?.activity?.recent || [];
  const topPlans = data.usage?.kpis?.mostUsedPlans || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapoarte"
        description="Centralizează sănătatea platformei, veniturile SaaS, retenția și semnalele operaționale într-un singur loc."
        actions={
          <>
            <Button onClick={() => void load()} variant="secondary">
              <RefreshCw className="h-4 w-4" />
              Reîncarcă
            </Button>
            <ButtonLink href="/superadmin/revenue/reports" variant="primary">
              Deschide Revenue Reports
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </>
        }
      />

      {error ? (
        <ErrorState
          title="Date încărcate parțial"
          message={error}
          retryLabel="Încearcă din nou"
          onRetry={() => void load()}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Asociații în platformă"
          value={workbenchKpis.totalOrganizations || 0}
          note={`${workbenchKpis.activeOrganizations || 0} active, ${workbenchKpis.trialOrganizations || 0} în trial`}
          icon={Building2}
        />
        <KpiCard
          label="Administratori și locatari"
          value={`${workbenchKpis.totalAdmins || 0} / ${workbenchKpis.totalResidents || 0}`}
          note={`${workbenchKpis.totalApartments || 0} apartamente gestionate`}
          icon={Users}
        />
        <KpiCard
          label="Venit lunar estimat"
          value={`${money(workbenchKpis.estimatedMonthlyRevenue)} MDL`}
          note="Estimare operațională internă"
          icon={CreditCard}
        />
        <KpiCard
          label="Venit la risc"
          value={`${money(retentionSummary.revenueAtRisk)} MDL`}
          note={`${retentionSummary.openRisks || 0} riscuri active de retenție`}
          icon={TrendingDown}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Utilizare și limite SaaS"
          description="Vezi rapid unde platforma are clienți blocați sau aproape de limită."
          actions={<ButtonLink href="/superadmin/billing/usage" variant="secondary" size="sm">Detalii usage</ButtonLink>}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Peste limită" value={usageKpis.overLimit || 0} icon={AlertTriangle} />
            <KpiCard label="Aproape de limită" value={usageKpis.nearLimit || 0} icon={BarChart3} />
            <KpiCard label="Suspendate" value={usageKpis.suspended || 0} icon={ShieldAlert} />
            <KpiCard label="Fără abonament" value={usageKpis.withoutSubscription || 0} icon={CreditCard} />
          </div>
          <div className="mt-5">
            <MiniTable
              headers={['Plan', 'Asociații']}
              rows={topPlans.slice(0, 6).map((item: any) => [item.planName || 'Fără abonament', item.count || 0])}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Revenue operations"
          description="Rezumat pentru solduri restante, aging și cazuri deschise de collections."
          actions={<ButtonLink href="/superadmin/revenue/dashboard" variant="secondary" size="sm">Dashboard revenue</ButtonLink>}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="MRR estimat" value={`${money(revenueDashboard.estimatedMrr)} MDL`} icon={CreditCard} />
            <KpiCard label="Sold restant" value={`${money(revenueDashboard.outstandingBalance)} MDL`} icon={AlertTriangle} />
            <KpiCard label="Sold overdue" value={`${money(revenueDashboard.overdueBalance)} MDL`} icon={ShieldAlert} />
            <KpiCard label="Cazuri deschise" value={revenueDashboard.openCollectionCases || 0} icon={BarChart3} />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Retenție"
          description="Risc de churn, renewals și activitate recentă care afectează păstrarea clienților."
          actions={<ButtonLink href="/superadmin/retention/reports" variant="secondary" size="sm">Detalii retenție</ButtonLink>}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Riscuri deschise" value={retentionSummary.openRisks || 0} icon={AlertTriangle} />
            <KpiCard label="Riscuri salvate" value={retentionSummary.savedRisks || 0} icon={Users} />
            <KpiCard label="Clienți pierduți" value={retentionSummary.lostRisks || 0} icon={TrendingDown} />
            <KpiCard label="Venit la risc" value={`${money(retentionSummary.revenueAtRisk)} MDL`} icon={ShieldAlert} />
          </div>
        </SectionCard>

        <SectionCard
          title="Navigare rapidă"
          description="Scurtături către rapoartele și zonele pe care le folosești cel mai des în superadmin."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <ButtonLink href="/superadmin/organizations" variant="secondary" className="justify-between rounded-2xl px-4">
              Organizații
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/superadmin/admins" variant="secondary" className="justify-between rounded-2xl px-4">
              Administratori
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/superadmin/customer-success/reports" variant="secondary" className="justify-between rounded-2xl px-4">
              Customer Success Reports
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/superadmin/revenue/reports" variant="secondary" className="justify-between rounded-2xl px-4">
              Revenue Reports
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/superadmin/retention/reports" variant="secondary" className="justify-between rounded-2xl px-4">
              Retention Reports
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/superadmin/billing/usage" variant="secondary" className="justify-between rounded-2xl px-4">
              Billing usage
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Asociații recente"
          description="Ultimele organizații intrate în pipeline-ul superadmin."
          actions={<ButtonLink href="/superadmin/organizations" variant="secondary" size="sm">Vezi toate</ButtonLink>}
        >
          <MiniTable
            headers={['Asociație', 'Status', 'Apartamente', 'Administratori']}
            rows={recentOrganizations.slice(0, 6).map((org: any) => [
              <div key={`${org.id}-name`}>
                <p className="font-semibold text-foreground">{org.shortName || org.legalName || 'Asociație'}</p>
                <p className="text-xs text-muted-foreground">{org.city || org.address || '-'}</p>
              </div>,
              org.status || '-',
              org.apartmentsCount || 0,
              org.adminsCount || 0,
            ])}
          />
        </SectionCard>

        <SectionCard
          title="Activitate recentă"
          description="Semnale operaționale utile când verifici rapid starea platformei."
          actions={<ButtonLink href="/superadmin/activity" variant="secondary" size="sm">Timeline complet</ButtonLink>}
        >
          <MiniTable
            headers={['Eveniment', 'Organizație', 'Moment']}
            rows={recentActivity.slice(0, 6).map((item: any) => [
              item.title || item.message || 'Activitate internă',
              item.organization?.name || item.organization?.shortName || '-',
              item.createdAt ? new Date(item.createdAt).toLocaleString('ro-RO') : '-',
            ])}
          />
        </SectionCard>
      </div>
    </div>
  );
}
