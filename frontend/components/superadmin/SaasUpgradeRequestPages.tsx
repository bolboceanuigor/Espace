'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, RefreshCw, XCircle } from 'lucide-react';
import { billingSaasApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const statusLabels: Record<string, string> = { PENDING: 'În așteptare', IN_REVIEW: 'În verificare', APPROVED: 'Aprobată', REJECTED: 'Respinsă', CANCELLED: 'Anulată' };
const reasonLabels: Record<string, string> = { LIMIT_REACHED: 'Limită atinsă', NEAR_LIMIT: 'Aproape de limită', FEATURE_NEEDED: 'Funcționalitate necesară', MORE_STAFF: 'Mai mulți membri', MORE_APARTMENTS: 'Mai multe apartamente', MORE_METERS: 'Mai multe contoare', MORE_INVOICES: 'Mai multe facturi', ADVANCED_REPORTS: 'Rapoarte avansate', DATA_QUALITY: 'Calitatea datelor', SUPPORT_ACCESS: 'Acces suport', OTHER: 'Alt motiv' };

function Card({ children }: { children: React.ReactNode }) { return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{children}</section>; }
function Badge({ status }: { status?: string }) {
  const tone = status === 'APPROVED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : status === 'REJECTED' || status === 'CANCELLED' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{statusLabels[status || ''] || status || '—'}</span>;
}
function fmt(value?: string | null) { return value ? new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium' }).format(new Date(value)) : '—'; }
function Kpi({ label, value }: { label: string; value: React.ReactNode }) { return <Card><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></Card>; }

export function SuperadminUpgradeRequestsPage({ associationId }: { associationId?: string }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const load = async () => {
    const [listRes, statsRes] = await Promise.all([
      associationId ? billingSaasApi.getAssociationUpgradeRequests(associationId) : billingSaasApi.listSuperadminUpgradeRequests(),
      associationId ? Promise.resolve({ data: null }) : billingSaasApi.superadminUpgradeRequestStats(),
    ]);
    setData(listRes.data);
    setStats(statsRes.data);
  };
  useEffect(() => {
    load();
    // First paint and association switch only; manual refresh uses the same loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [associationId]);
  const items = data?.items || [];
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight text-slate-950">Cereri upgrade</h1><p className="mt-1 text-sm text-slate-500">Procesează cererile de upgrade trimise de asociații.</p></div>
        <button onClick={load} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold"><RefreshCw className="h-4 w-4" /> Reîncarcă</button>
      </div>
      {stats ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7"><Kpi label="Pending" value={stats.pending || 0} /><Kpi label="În review" value={stats.inReview || 0} /><Kpi label="Aprobate" value={stats.approved || 0} /><Kpi label="Respinse" value={stats.rejected || 0} /><Kpi label="Anulate" value={stats.cancelled || 0} /><Kpi label="Luna curentă" value={stats.thisMonth || 0} /><Kpi label="Limite" value={stats.limitRelated || 0} /></div> : null}
      <Card>
        {!items.length ? <div><p className="font-semibold text-slate-950">Nu există cereri de upgrade</p><p className="mt-1 text-sm text-slate-500">Cererile trimise de asociații vor apărea aici.</p></div> : null}
        {items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Data</th><th>Asociație</th><th>Plan curent</th><th>Plan dorit</th><th>Motiv</th><th>Status</th><th>Solicitat de</th><th>Reviewed by</th><th>Acțiuni</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item: any) => <tr key={item.id}><td className="py-3">{fmt(item.createdAt)}</td><td className="font-medium text-slate-950">{item.association?.legalName || item.association?.name}</td><td>{item.currentPlan?.name || '—'}</td><td>{item.requestedPlan?.name || '—'}</td><td>{reasonLabels[item.reason] || item.reason}</td><td><Badge status={item.status} /></td><td>{item.requestedBy?.fullName || '—'}</td><td>{item.reviewedBy?.fullName || '—'}</td><td><div className="flex flex-wrap gap-2"><Link className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 font-semibold" href={localizedPath(`/superadmin/billing/upgrade-requests/${item.id}`)}><Eye className="h-4 w-4" /> Deschide</Link><Link className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 font-semibold" href={localizedPath(`/superadmin/organizations/${item.associationId}`)}>Asociație</Link></div></td></tr>)}</tbody></table></div> : null}
      </Card>
    </div>
  );
}

export function SuperadminUpgradeRequestDetailPage({ id }: { id: string }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [response, setResponse] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [applyNow, setApplyNow] = useState(false);
  const load = () => billingSaasApi.getSuperadminUpgradeRequest(id).then((res) => { setData(res.data); setSelectedPlanId(res.data?.requestedPlan?.id || ''); });
  useEffect(() => {
    load();
    // First paint and id switch only; review actions reload explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const request = data?.request;
  const approve = async () => { await billingSaasApi.approveUpgradeRequest(id, { adminResponse: response, applyPlanChangeNow: applyNow, selectedPlanId, billingCycle: 'MONTHLY' }); await load(); };
  const reject = async () => { await billingSaasApi.rejectUpgradeRequest(id, { adminResponse: response }); await load(); };
  const inReview = async () => { await billingSaasApi.markUpgradeRequestInReview(id); await load(); };
  if (!request) return <Card><p className="text-sm text-slate-500">Se încarcă...</p></Card>;
  const reviewable = request.status === 'PENDING' || request.status === 'IN_REVIEW';
  const plans = [data.requestedPlan, data.currentPlan].filter(Boolean);
  return (
    <div className="space-y-5">
      <Link href={localizedPath('/superadmin/billing/upgrade-requests')} className="text-sm font-semibold text-slate-500">Înapoi</Link>
      <div><h1 className="text-2xl font-semibold tracking-tight text-slate-950">Procesează cererea</h1><p className="mt-1 text-sm text-slate-500">{data.association?.legalName || data.association?.name}</p></div>
      <Card><div className="grid gap-4 md:grid-cols-3"><Info label="Status" value={<Badge status={request.status} />} /><Info label="Plan curent" value={data.currentPlan?.name || '—'} /><Info label="Plan dorit" value={data.requestedPlan?.name || '—'} /><Info label="Motiv" value={reasonLabels[request.reason] || request.reason} /><Info label="Solicitat" value={fmt(request.createdAt)} /><Info label="Plan schimbat" value={request.appliedPlanChange ? 'Da' : 'Nu'} /></div><p className="mt-5 text-sm text-slate-600">{request.message || 'Fără mesaj.'}</p></Card>
      <Card><h2 className="font-semibold text-slate-950">Usage snapshot</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{(data.usageSnapshot || []).map((item: any) => <p key={item.limitKey} className="rounded-xl border border-slate-200 p-3 text-sm text-slate-600">{item.label}: {item.used ?? 0}/{item.limit ?? 'nelimitat'} · {item.status}</p>)}</div></Card>
      <Card>
        <h2 className="font-semibold text-slate-950">Review</h2>
        <textarea className="mt-4 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm" value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Răspuns către Admin" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={applyNow} onChange={(e) => setApplyNow(e.target.checked)} /> Aprobă și schimbă planul</label>
          <select className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm" value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
            {plans.map((plan: any) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {request.status === 'PENDING' ? <button onClick={inReview} className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold">Marchează în review</button> : null}
          <button disabled={!reviewable} onClick={approve} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Aprobă</button>
          <button disabled={!reviewable} onClick={reject} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><XCircle className="h-4 w-4" /> Respinge cu motiv</button>
        </div>
      </Card>
      <Card><h2 className="font-semibold text-slate-950">Cereri anterioare</h2><div className="mt-3 space-y-2">{(data.previousRequests || []).map((item: any) => <p key={item.id} className="text-sm text-slate-600">{fmt(item.createdAt)} · {reasonLabels[item.reason] || item.reason} · {statusLabels[item.status] || item.status}</p>)}</div></Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) { return <div><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><div className="mt-1 text-sm font-medium text-slate-950">{value}</div></div>; }
