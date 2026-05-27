'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { billingSaasApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

function Badge({ status }: { status?: string }) {
  const tone = status === 'ACTIVE' || status === 'OK' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : status === 'OVER_LIMIT' || status === 'SUSPENDED' || status === 'CANCELLED' || status === 'EXPIRED' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{status || '—'}</span>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{children}</section>;
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return <Card><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></Card>;
}

export function SuperadminSaasUsagePage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      setData((await billingSaasApi.superadminUsageOverview()).data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load().catch(() => setLoading(false)); }, []);
  const rows = data?.items || [];
  const kpis = data?.kpis || {};
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Usage & Limits</h1>
          <p className="mt-1 text-sm text-slate-500">Monitorizează utilizarea planurilor și depășirile de limite.</p>
        </div>
        <button onClick={load} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"><RefreshCw className="h-4 w-4" /> Reîncarcă</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="Peste limită" value={kpis.overLimit || 0} />
        <Kpi label="Aproape de limită" value={kpis.nearLimit || 0} />
        <Kpi label="Trial expiră" value={kpis.trialEndingSoon || 0} />
        <Kpi label="Suspendate" value={kpis.suspended || 0} />
        <Kpi label="Fără abonament" value={kpis.withoutSubscription || 0} />
        <Kpi label="Plan top" value={kpis.mostUsedPlans?.[0]?.planName || '—'} />
      </div>
      <Card>
        {loading ? <p className="text-sm text-slate-500">Se încarcă...</p> : null}
        {!loading && !rows.length ? <div><p className="font-semibold text-slate-950">Nu există usage disponibil</p><p className="mt-1 text-sm text-slate-500">Utilizarea planurilor va apărea după configurarea abonamentelor.</p></div> : null}
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Asociație</th><th>Plan</th><th>Status</th><th>Apartamente</th><th>Locatari</th><th>Staff</th><th>Contoare</th><th>Facturi/lună</th><th>Warnings</th><th>Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row: any) => (
                  <tr key={row.association.id}>
                    <td className="py-3 font-medium text-slate-950">{row.association.legalName || row.association.name}</td>
                    <td>{row.subscription?.planName || 'Fără abonament'}</td>
                    <td><Badge status={row.subscription?.status || 'NO_SUBSCRIPTION'} /></td>
                    <td>{row.usage.apartmentsCount}</td>
                    <td>{row.usage.residentsCount}</td>
                    <td>{row.usage.staffMembersCount}</td>
                    <td>{row.usage.metersCount}</td>
                    <td>{row.usage.invoicesThisMonth}</td>
                    <td><Badge status={row.usageSummary.overallStatus} /></td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Link className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 font-semibold" href={localizedPath(`/superadmin/associations/${row.association.id}/usage`)}><Eye className="h-4 w-4" /> Usage</Link>
                        {row.subscription?.id ? <Link className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 font-semibold" href={localizedPath(`/superadmin/billing/subscriptions/${row.subscription.id}`)}>Abonament</Link> : null}
                        <Link className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 font-semibold" href={localizedPath(`/superadmin/organizations/${row.association.id}`)}>Asociație</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export function SuperadminAssociationUsagePage({ id, subscriptionId }: { id?: string; subscriptionId?: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    const loader = subscriptionId ? billingSaasApi.getSaasSubscriptionUsage(subscriptionId) : billingSaasApi.getSuperadminAssociationUsage(id || '');
    loader.then((res) => setData(res.data));
  }, [id, subscriptionId]);
  const usage = data?.usage || {};
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Usage asociație</h1>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Apartamente" value={usage.apartmentsCount || 0} />
        <Kpi label="Locatari" value={usage.residentsCount || 0} />
        <Kpi label="Staff" value={usage.staffMembersCount || 0} />
        <Kpi label="Contoare" value={usage.metersCount || 0} />
      </div>
      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          {(data?.limits || []).map((item: any) => <div key={item.limitKey} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><p className="font-medium text-slate-950">{item.label}</p><Badge status={item.status} /></div><p className="mt-1 text-sm text-slate-500">{item.message}</p></div>)}
        </div>
      </Card>
    </div>
  );
}
