'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, GitBranch, Layers3, PauseCircle, PlayCircle, Plus, RefreshCw, Search, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
import { billingSaasApi, featureFlagsApi, superadminApi } from '@/lib/api';

const STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
const TYPES = ['RELEASE_FLAG', 'MODULE_AVAILABILITY', 'EXPERIMENT', 'KILL_SWITCH'] as const;
const SCOPES = ['GLOBAL', 'PLAN', 'ORGANIZATION', 'ROLE'] as const;
const EFFECTS = ['ENABLE', 'DISABLE'] as const;
const ROLES = ['SUPERADMIN', 'ADMIN', 'RESIDENT'] as const;

const fieldClass = 'min-h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400';
const buttonClass = 'inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-50';
const secondaryButtonClass = 'inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

const emptyFlag = {
  id: '',
  key: '',
  name: '',
  description: '',
  type: 'RELEASE_FLAG',
  status: 'DRAFT',
  moduleKey: '',
  defaultEnabled: false,
  rolloutPercentage: 100,
  visibleInNavigation: true,
};

const emptyRule = {
  scope: 'GLOBAL',
  effect: 'ENABLE',
  planId: '',
  organizationId: '',
  role: 'ADMIN',
  rolloutPercentage: '',
  priority: 100,
};

function Badge({ value }: { value?: string | null }) {
  const tone = value === 'ACTIVE' || value === 'ENABLE' ? 'emerald' : value === 'PAUSED' || value === 'DRAFT' ? 'amber' : value === 'DISABLE' || value === 'ARCHIVED' ? 'red' : 'slate';
  const cls: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${cls[tone]}`}>{value || '-'}</span>;
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ icon, label, value }: { icon: ReactNode; label: string; value?: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">{icon}</div>
      <p className="text-2xl font-semibold text-slate-950">{value || 0}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function cleanPayload(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== '' && value !== undefined));
}

function flagToForm(flag: any) {
  return {
    id: flag?.id || '',
    key: flag?.key || '',
    name: flag?.name || '',
    description: flag?.description || '',
    type: flag?.type || 'RELEASE_FLAG',
    status: flag?.status || 'DRAFT',
    moduleKey: flag?.moduleKey || '',
    defaultEnabled: !!flag?.defaultEnabled,
    rolloutPercentage: Number(flag?.rolloutPercentage ?? 100),
    visibleInNavigation: flag?.visibleInNavigation !== false,
  };
}

export default function SuperadminFeatureFlagsPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [flags, setFlags] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [filters, setFilters] = useState({ status: '', type: '', moduleKey: '', q: '' });
  const [flagForm, setFlagForm] = useState({ ...emptyFlag });
  const [ruleForm, setRuleForm] = useState({ ...emptyRule });
  const [preview, setPreview] = useState({ organizationId: '', planId: '', role: 'ADMIN' });
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const modules = useMemo(() => catalog.map((item) => item.key), [catalog]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, list] = await Promise.all([
        featureFlagsApi.dashboard(),
        featureFlagsApi.list({
          status: (filters.status as any) || undefined,
          type: (filters.type as any) || undefined,
          moduleKey: filters.moduleKey || undefined,
          q: filters.q || undefined,
        }),
      ]);
      setDashboard(dash.data || {});
      setFlags(list.data || []);
    } finally {
      setLoading(false);
    }
  }, [filters.moduleKey, filters.q, filters.status, filters.type]);

  const loadSelected = useCallback(async (id: string) => {
    const response = await featureFlagsApi.get(id);
    setSelected(response.data);
    setFlagForm(flagToForm(response.data));
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void Promise.all([
      featureFlagsApi.superadminCatalog(),
      superadminApi.listOrgs(),
      billingSaasApi.listPlans({}),
    ]).then(([catalogRes, orgRes, plansRes]) => {
      setCatalog(catalogRes.data || []);
      setOrgs(orgRes.data || []);
      setPlans(plansRes.data?.items || plansRes.data || []);
    });
  }, []);

  const submitFlag = async () => {
    if (!flagForm.key || !flagForm.name) return;
    setSaving(true);
    try {
      const body = cleanPayload({
        key: flagForm.key,
        name: flagForm.name,
        description: flagForm.description,
        type: flagForm.type,
        status: flagForm.status,
        moduleKey: flagForm.moduleKey,
        defaultEnabled: flagForm.defaultEnabled,
        rolloutPercentage: Number(flagForm.rolloutPercentage),
        visibleInNavigation: flagForm.visibleInNavigation,
      });
      const response = flagForm.id ? await featureFlagsApi.update(flagForm.id, body) : await featureFlagsApi.create(body);
      setSelected(response.data);
      setFlagForm(flagToForm(response.data));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (status: typeof STATUSES[number]) => {
    if (!selected?.id) return;
    const response = await featureFlagsApi.updateStatus(selected.id, status);
    setSelected(response.data);
    setFlagForm(flagToForm(response.data));
    await load();
  };

  const submitRule = async () => {
    if (!selected?.id) return;
    const body = cleanPayload({
      scope: ruleForm.scope,
      effect: ruleForm.effect,
      planId: ruleForm.scope === 'PLAN' ? ruleForm.planId : '',
      organizationId: ruleForm.scope === 'ORGANIZATION' ? ruleForm.organizationId : '',
      role: ruleForm.scope === 'ROLE' ? ruleForm.role : '',
      rolloutPercentage: ruleForm.rolloutPercentage === '' ? '' : Number(ruleForm.rolloutPercentage),
      priority: Number(ruleForm.priority),
    });
    const response = await featureFlagsApi.createRule(selected.id, body);
    setSelected(response.data);
    setRuleForm({ ...emptyRule });
    await load();
  };

  const runPreview = async () => {
    const response = await featureFlagsApi.preview(cleanPayload(preview) as any);
    setPreviewResult(response.data);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Feature Flags & Rollouts</h1>
              <p className="mt-1 text-sm text-slate-500">Controleaza module, lansari si kill-switch-uri pe plan, client sau rol.</p>
            </div>
            <button className={secondaryButtonClass} onClick={() => { setSelected(null); setFlagForm({ ...emptyFlag }); }}>
              <Plus className="h-4 w-4" /> Flag nou
            </button>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
          <Kpi icon={<GitBranch className="h-5 w-5" />} label="Total" value={dashboard?.total} />
          <Kpi icon={<PlayCircle className="h-5 w-5" />} label="Active" value={dashboard?.active} />
          <Kpi icon={<PauseCircle className="h-5 w-5" />} label="Pauzate" value={dashboard?.paused} />
          <Kpi icon={<Settings2 className="h-5 w-5" />} label="Draft" value={dashboard?.draft} />
          <Kpi icon={<ShieldCheck className="h-5 w-5" />} label="Arhivate" value={dashboard?.archived} />
          <Kpi icon={<Layers3 className="h-5 w-5" />} label="Module" value={dashboard?.moduleFlags} />
          <Kpi icon={<CheckCircle2 className="h-5 w-5" />} label="Reguli" value={dashboard?.rules} />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-2 md:grid-cols-[1fr_160px_190px_190px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className={`${fieldClass} w-full pl-9`} placeholder="Cauta dupa key, nume sau descriere" value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} />
            </div>
            <select className={fieldClass} value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="">Toate statusurile</option>
              {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select className={fieldClass} value={filters.type} onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}>
              <option value="">Toate tipurile</option>
              {TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select className={fieldClass} value={filters.moduleKey} onChange={(event) => setFilters((prev) => ({ ...prev, moduleKey: event.target.value }))}>
              <option value="">Toate modulele</option>
              {modules.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <Panel title="Flaguri">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr><th className="p-3">Flag</th><th>Tip</th><th>Status</th><th>Modul</th><th>Default</th><th>Rollout</th><th>Reguli</th><th>Actiuni</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flags.map((flag) => (
                    <tr key={flag.id} className="align-top hover:bg-slate-50">
                      <td className="p-3">
                        <p className="font-semibold text-slate-950">{flag.name}</p>
                        <p className="text-xs text-slate-500">{flag.key}</p>
                      </td>
                      <td><Badge value={flag.type} /></td>
                      <td><Badge value={flag.status} /></td>
                      <td>{flag.moduleKey || '-'}</td>
                      <td>{flag.defaultEnabled ? 'On' : 'Off'}</td>
                      <td>{flag.rolloutPercentage}%</td>
                      <td>{flag._count?.rules || 0}</td>
                      <td><button className={secondaryButtonClass} onClick={() => void loadSelected(flag.id)}>Deschide</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && !flags.length ? <p className="p-4 text-sm text-slate-500">Nu exista flaguri pentru filtrele curente.</p> : null}
            </div>
          </Panel>

          <div className="space-y-5">
            <Panel title={flagForm.id ? 'Editeaza flag' : 'Creeaza flag'}>
              <div className="space-y-3">
                <input className={`${fieldClass} w-full`} placeholder="key, ex. billing-run-rollout" value={flagForm.key} onChange={(event) => setFlagForm((prev) => ({ ...prev, key: event.target.value }))} />
                <input className={`${fieldClass} w-full`} placeholder="Nume" value={flagForm.name} onChange={(event) => setFlagForm((prev) => ({ ...prev, name: event.target.value }))} />
                <textarea className={`${fieldClass} min-h-24 w-full`} placeholder="Descriere interna" value={flagForm.description} onChange={(event) => setFlagForm((prev) => ({ ...prev, description: event.target.value }))} />
                <div className="grid gap-2 md:grid-cols-2">
                  <select className={fieldClass} value={flagForm.type} onChange={(event) => setFlagForm((prev) => ({ ...prev, type: event.target.value }))}>
                    {TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select className={fieldClass} value={flagForm.status} onChange={(event) => setFlagForm((prev) => ({ ...prev, status: event.target.value }))}>
                    {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select className={fieldClass} value={flagForm.moduleKey} onChange={(event) => setFlagForm((prev) => ({ ...prev, moduleKey: event.target.value }))}>
                    <option value="">Fara modul</option>
                    {catalog.map((item) => <option key={item.key} value={item.key}>{item.label} ({item.key})</option>)}
                  </select>
                  <input className={fieldClass} type="number" min={0} max={100} value={flagForm.rolloutPercentage} onChange={(event) => setFlagForm((prev) => ({ ...prev, rolloutPercentage: Number(event.target.value) }))} />
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={flagForm.defaultEnabled} onChange={(event) => setFlagForm((prev) => ({ ...prev, defaultEnabled: event.target.checked }))} /> Default activ</label>
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={flagForm.visibleInNavigation} onChange={(event) => setFlagForm((prev) => ({ ...prev, visibleInNavigation: event.target.checked }))} /> Controleaza navigatia</label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={buttonClass} disabled={saving || !flagForm.key || !flagForm.name} onClick={() => void submitFlag()}><RefreshCw className="h-4 w-4" /> Salveaza</button>
                  {selected ? STATUSES.map((status) => <button key={status} className={secondaryButtonClass} onClick={() => void updateStatus(status)}>{status}</button>) : null}
                </div>
              </div>
            </Panel>

            {selected ? (
              <Panel title="Reguli rollout">
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <select className={fieldClass} value={ruleForm.scope} onChange={(event) => setRuleForm((prev) => ({ ...prev, scope: event.target.value }))}>
                      {SCOPES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <select className={fieldClass} value={ruleForm.effect} onChange={(event) => setRuleForm((prev) => ({ ...prev, effect: event.target.value }))}>
                      {EFFECTS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    {ruleForm.scope === 'PLAN' ? <select className={fieldClass} value={ruleForm.planId} onChange={(event) => setRuleForm((prev) => ({ ...prev, planId: event.target.value }))}><option value="">Selecteaza plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name || plan.code}</option>)}</select> : null}
                    {ruleForm.scope === 'ORGANIZATION' ? <select className={fieldClass} value={ruleForm.organizationId} onChange={(event) => setRuleForm((prev) => ({ ...prev, organizationId: event.target.value }))}><option value="">Selecteaza client</option>{orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select> : null}
                    {ruleForm.scope === 'ROLE' ? <select className={fieldClass} value={ruleForm.role} onChange={(event) => setRuleForm((prev) => ({ ...prev, role: event.target.value }))}>{ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select> : null}
                    <input className={fieldClass} type="number" min={0} max={100} placeholder="Rollout %" value={ruleForm.rolloutPercentage} onChange={(event) => setRuleForm((prev) => ({ ...prev, rolloutPercentage: event.target.value }))} />
                    <input className={fieldClass} type="number" min={0} placeholder="Prioritate" value={ruleForm.priority} onChange={(event) => setRuleForm((prev) => ({ ...prev, priority: Number(event.target.value) }))} />
                  </div>
                  <button className={buttonClass} onClick={() => void submitRule()}><Plus className="h-4 w-4" /> Adauga regula</button>
                  <div className="space-y-2">
                    {(selected.rules || []).map((rule: any) => (
                      <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3 text-sm">
                        <div>
                          <div className="flex flex-wrap gap-2"><Badge value={rule.scope} /><Badge value={rule.effect} /><Badge value={`${rule.rolloutPercentage ?? 100}%`} /></div>
                          <p className="mt-1 text-slate-600">{rule.plan?.name || rule.organization?.name || rule.role || 'Global'} · prioritate {rule.priority}</p>
                        </div>
                        <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => void featureFlagsApi.deleteRule(selected.id, rule.id).then(() => loadSelected(selected.id)).then(() => load())} title="Sterge regula" aria-label="Sterge regula">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {!selected.rules?.length ? <p className="text-sm text-slate-500">Nu exista reguli. Se aplica default-ul flagului si planul curent.</p> : null}
                  </div>
                </div>
              </Panel>
            ) : null}
          </div>
        </div>

        <Panel title="Preview disponibilitate">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
            <select className={fieldClass} value={preview.organizationId} onChange={(event) => setPreview((prev) => ({ ...prev, organizationId: event.target.value }))}>
              <option value="">Fara client specific</option>
              {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
            <select className={fieldClass} value={preview.planId} onChange={(event) => setPreview((prev) => ({ ...prev, planId: event.target.value }))}>
              <option value="">Plan din client / niciun plan</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name || plan.code}</option>)}
            </select>
            <select className={fieldClass} value={preview.role} onChange={(event) => setPreview((prev) => ({ ...prev, role: event.target.value }))}>
              {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <button className={buttonClass} onClick={() => void runPreview()}><PlayCircle className="h-4 w-4" /> Ruleaza</button>
          </div>
          {previewResult ? (
            <div className="mt-4 grid gap-2 md:grid-cols-3 lg:grid-cols-5">
              {catalog.map((item) => {
                const enabled = previewResult.modules?.[item.key] !== false;
                return <div key={item.key} className={`rounded-md border p-3 text-sm ${enabled ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-red-100 bg-red-50 text-red-800'}`}><p className="font-semibold">{item.label}</p><p className="text-xs">{item.key} · {enabled ? 'activ' : 'dezactivat'}</p></div>;
              })}
            </div>
          ) : null}
        </Panel>
      </div>
    </main>
  );
}
