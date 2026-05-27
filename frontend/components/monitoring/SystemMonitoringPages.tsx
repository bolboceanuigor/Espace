'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Activity, AlertTriangle, CheckCircle2, Clock, Database, GitBranch, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { systemMonitoringApi } from '@/lib/api';

const statusLabels: Record<string, string> = {
  OPERATIONAL: 'Operațional',
  DEGRADED: 'Degradat',
  DOWN: 'Indisponibil',
  UNKNOWN: 'Necunoscut',
  READY: 'Ready',
  FAILED: 'Eșuat',
};

const severityVariant: Record<string, any> = {
  INFO: 'neutral',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'error',
};

const statusVariant: Record<string, any> = {
  OPERATIONAL: 'success',
  DEGRADED: 'warning',
  DOWN: 'error',
  UNKNOWN: 'neutral',
  READY: 'success',
  FAILED: 'error',
};

function useLoad(loader: () => Promise<any>, deps: unknown[] = []) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await loader();
      setData(res.data ?? res);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca datele.'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading, error, reload: load, setData };
}

export function MonitoringOverviewPage() {
  const { data, loading, error, reload } = useLoad(() => systemMonitoringApi.overview(), []);
  const health = data?.health;
  const errors = data?.errors || {};
  const services = health?.services || [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring"
        description="Monitorizează starea platformei, erorile și deploy-urile Espace."
        rightSlot={<Button onClick={reload} isLoading={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>}
      />
      {error ? <Notice tone="error" text={error} /> : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Platform status" value={statusLabels[health?.status] || '...'} icon={<Activity className="h-5 w-5" />} tone={health?.status === 'OPERATIONAL' ? 'success' : 'warning'} />
        <StatCard label="Backend API" value={serviceStatus(services, 'BACKEND_API')} icon={<Server className="h-5 w-5" />} />
        <StatCard label="Database" value={serviceStatus(services, 'DATABASE')} icon={<Database className="h-5 w-5" />} />
        <StatCard label="Erori deschise" value={String(errors.open ?? 0)} icon={<AlertTriangle className="h-5 w-5" />} tone={errors.open ? 'warning' : 'success'} />
        <StatCard label="Critice" value={String(errors.criticalOpen ?? 0)} icon={<ShieldCheck className="h-5 w-5" />} tone={errors.criticalOpen ? 'danger' : 'success'} />
        <StatCard label="Erori 24h" value={String(errors.last24h ?? 0)} icon={<Clock className="h-5 w-5" />} />
        <StatCard label="Deploy" value={data?.deployments?.[0]?.status || data?.kpis?.lastDeploy?.status || 'UNKNOWN'} icon={<GitBranch className="h-5 w-5" />} />
        <StatCard label="Versiune" value={health?.version || '-'} icon={<CheckCircle2 className="h-5 w-5" />} />
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <ServiceList services={services.slice(0, 6)} />
        <RecentErrors items={data?.errors?.items || data?.recentErrors || []} />
      </section>
      <Card>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/superadmin/monitoring/health" variant="secondary">Health</ButtonLink>
          <ButtonLink href="/superadmin/monitoring/errors" variant="secondary">Errors</ButtonLink>
          <ButtonLink href="/superadmin/monitoring/deployments" variant="secondary">Deployments</ButtonLink>
          <ButtonLink href="/superadmin/monitoring/services" variant="secondary">Services</ButtonLink>
        </div>
      </Card>
    </div>
  );
}

export function MonitoringHealthPage() {
  const { data, loading, error, reload } = useLoad(() => systemMonitoringApi.monitoringHealth(), []);
  return (
    <div className="space-y-6">
      <PageHeader title="Health" description="Status global, service checks și environment diagnostics." rightSlot={<Button onClick={reload} isLoading={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>} />
      {error ? <Notice tone="error" text={error} /> : null}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Status global</p>
            <h2 className="mt-1 text-2xl font-semibold">{statusLabels[data?.status] || data?.status || '...'}</h2>
          </div>
          <Badge variant={statusVariant[data?.status] || 'neutral'}>{data?.status || 'UNKNOWN'}</Badge>
        </div>
      </Card>
      <ServiceList services={data?.services || []} />
      <Card>
        <h2 className="font-semibold">Environment diagnostics</h2>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(data?.diagnostics || {}, null, 2)}</pre>
      </Card>
    </div>
  );
}

export function MonitoringServicesPage() {
  const { data, loading, reload } = useLoad(() => systemMonitoringApi.monitoringServices(), []);
  return (
    <div className="space-y-6">
      <PageHeader title="Services" description="Status pe serviciile principale ale platformei." rightSlot={<Button onClick={reload} isLoading={loading}>Refresh</Button>} />
      <ServiceList services={data?.services || []} />
    </div>
  );
}

export function MonitoringErrorsPage() {
  const { data, loading, reload } = useLoad(() => systemMonitoringApi.errors({ resolved: false }), []);
  const items = data?.items || [];
  return (
    <div className="space-y-6">
      <PageHeader title="Erori aplicație" description="Erori deschise, deduplicate și sanitizate." rightSlot={<Button onClick={reload} isLoading={loading}>Refresh</Button>} />
      {!items.length ? <Card className="p-8 text-center"><h2 className="text-lg font-semibold">Nu există erori deschise</h2><p className="mt-2 text-sm text-muted-foreground">Erorile aplicației vor apărea aici dacă sunt detectate.</p></Card> : null}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr><th className="py-2">Last seen</th><th>Severity</th><th>Source</th><th>Message</th><th>Route</th><th>Occurrences</th><th>Status</th><th>Acțiuni</th></tr></thead>
            <tbody className="divide-y divide-border">
              {items.map((item: any) => (
                <tr key={item.id}>
                  <td className="py-3">{date(item.lastSeenAt)}</td>
                  <td><Badge variant={severityVariant[item.severity] || 'neutral'}>{item.severity}</Badge></td>
                  <td>{item.source}</td>
                  <td className="max-w-xs truncate font-medium">{item.message}</td>
                  <td className="max-w-xs truncate">{item.route || '-'}</td>
                  <td>{item.occurrenceCount}</td>
                  <td>{item.resolvedAt ? 'Resolved' : 'Open'}</td>
                  <td><ButtonLink href={`/superadmin/monitoring/errors/${item.id}`} size="sm" variant="secondary">Deschide</ButtonLink></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function MonitoringErrorDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '');
  const { data, setData } = useLoad(() => systemMonitoringApi.error(id), [id]);
  const item = data?.error;
  async function resolve() {
    const res = await systemMonitoringApi.resolveError(id, 'Rezolvat din Monitoring.');
    setData({ error: res.data ?? res });
  }
  if (!item) return <Card className="h-40 animate-pulse bg-muted/40" />;
  return (
    <div className="space-y-6">
      <PageHeader title="Detalii eroare" description={item.requestId ? `Request ${item.requestId}` : 'Eveniment de eroare'} rightSlot={!item.resolvedAt ? <Button onClick={resolve}>Mark resolved</Button> : <Badge variant="success">Resolved</Badge>} />
      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <Info label="Severity" value={<Badge variant={severityVariant[item.severity] || 'neutral'}>{item.severity}</Badge>} />
          <Info label="Source" value={item.source} />
          <Info label="Occurrences" value={item.occurrenceCount} />
          <Info label="Route" value={item.route || '-'} />
          <Info label="Method" value={item.method || '-'} />
          <Info label="Status code" value={item.statusCode || '-'} />
          <Info label="First seen" value={date(item.firstSeenAt)} />
          <Info label="Last seen" value={date(item.lastSeenAt)} />
          <Info label="Resolved" value={item.resolvedAt ? date(item.resolvedAt) : 'Open'} />
        </div>
      </Card>
      <Card><h2 className="font-semibold">Message</h2><p className="mt-3 text-sm">{item.message}</p></Card>
      {item.stack ? <Card><h2 className="font-semibold">Stack</h2><pre className="mt-4 max-h-96 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{item.stack}</pre></Card> : null}
      <Card><h2 className="font-semibold">Metadata sanitizată</h2><pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(item.metadata || {}, null, 2)}</pre></Card>
    </div>
  );
}

export function MonitoringDeploymentsPage() {
  const { data } = useLoad(() => systemMonitoringApi.deployments(), []);
  const items = data?.items || [];
  return (
    <div className="space-y-6">
      <PageHeader title="Deployments" description="Informații despre deploy-ul curent și viitoare integrări Vercel/Render." />
      {data?.message ? <Notice text={data.message} /> : null}
      <Card>
        <div className="grid gap-3">
          {items.map((item: any) => (
            <div key={item.id} className="rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.provider} · {item.environment || 'environment necunoscut'}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.branch || 'branch necunoscut'} · {item.commitSha || 'commit indisponibil'}</p>
                </div>
                <Badge variant={statusVariant[item.status] || 'neutral'}>{item.status}</Badge>
              </div>
              {item.commitMessage ? <p className="mt-3 text-sm">{item.commitMessage}</p> : null}
              {item.url ? <p className="mt-2 text-sm text-muted-foreground">{item.url}</p> : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function SuperadminStatusPage() {
  return <MonitoringHealthPage />;
}

function ServiceList({ services }: { services: any[] }) {
  return (
    <Card>
      <h2 className="font-semibold">Service diagnostics</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {services.map((service) => (
          <div key={service.key} className="rounded-2xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{service.key}</p>
              <Badge variant={statusVariant[service.status] || 'neutral'}>{statusLabels[service.status] || service.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{service.message}</p>
            <p className="mt-2 text-xs text-muted-foreground">Latency: {service.latencyMs ?? '-'} ms</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecentErrors({ items }: { items: any[] }) {
  return (
    <Card>
      <h2 className="font-semibold">Recent errors</h2>
      {!items.length ? <p className="mt-3 text-sm text-muted-foreground">Nu există erori recente în overview.</p> : null}
    </Card>
  );
}

function Notice({ text, tone = 'warning' }: { text: string; tone?: 'warning' | 'error' }) {
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{text}</div>;
}

function Info({ label, value }: { label: string; value: any }) {
  return <div className="rounded-2xl bg-muted/35 p-3"><p className="text-xs text-muted-foreground">{label}</p><div className="mt-1 text-sm font-semibold">{value}</div></div>;
}

function serviceStatus(services: any[], key: string) {
  return statusLabels[services.find((item) => item.key === key)?.status] || '...';
}

function date(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ro-RO');
}
