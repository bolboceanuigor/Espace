'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, FlaskConical, GitBranch, MessageSquare, PauseCircle, PlayCircle, Plus, Search, Trash2, Users } from 'lucide-react';
import { betaProgramsApi, featureFlagsApi, superadminApi } from '@/lib/api';

const PROGRAM_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const;
const MEMBER_TYPES = ['ORGANIZATION', 'USER'] as const;
const MEMBER_STATUSES = ['INVITED', 'ACTIVE', 'PAUSED', 'REMOVED', 'COMPLETED'] as const;
const ROLES = ['ADMIN', 'RESIDENT'] as const;

const fieldClass = 'min-h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400';
const buttonClass = 'inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-50';
const secondaryButtonClass = 'inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

const emptyProgram = {
  id: '',
  key: '',
  name: '',
  description: '',
  status: 'DRAFT',
  moduleKey: '',
  featureFlagId: '',
  targetRelease: '',
  riskNotes: '',
};

const emptyCohort = {
  key: '',
  name: '',
  description: '',
  status: 'DRAFT',
  moduleKey: '',
  featureFlagId: '',
  rolloutPercentage: 100,
};

const emptyMember = {
  memberType: 'ORGANIZATION',
  organizationId: '',
  userId: '',
  role: 'ADMIN',
  status: 'ACTIVE',
  notes: '',
};

function cleanPayload(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== '' && value !== undefined));
}

function Badge({ value }: { value?: string | null }) {
  const tone = value === 'ACTIVE' || value === 'POSITIVE' ? 'emerald' : value === 'PAUSED' || value === 'DRAFT' || value === 'INVITED' ? 'amber' : value === 'REMOVED' || value === 'ARCHIVED' || value === 'NEGATIVE' ? 'red' : 'slate';
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

function programToForm(program: any) {
  return {
    id: program?.id || '',
    key: program?.key || '',
    name: program?.name || '',
    description: program?.description || '',
    status: program?.status || 'DRAFT',
    moduleKey: program?.moduleKey || '',
    featureFlagId: program?.featureFlagId || '',
    targetRelease: program?.targetRelease || '',
    riskNotes: program?.riskNotes || '',
  };
}

export default function SuperadminBetaProgramPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [filters, setFilters] = useState({ q: '', status: '', moduleKey: '' });
  const [programForm, setProgramForm] = useState({ ...emptyProgram });
  const [cohortForm, setCohortForm] = useState({ ...emptyCohort });
  const [memberForm, setMemberForm] = useState({ ...emptyMember });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const modules = useMemo(() => Array.from(new Set(flags.map((flag) => flag.moduleKey).filter(Boolean))), [flags]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, list, feedbackRes] = await Promise.all([
        betaProgramsApi.dashboard(),
        betaProgramsApi.listPrograms({
          q: filters.q || undefined,
          status: (filters.status as any) || undefined,
          moduleKey: filters.moduleKey || undefined,
        }),
        betaProgramsApi.listFeedback({ status: 'NEW' }),
      ]);
      setDashboard(dash.data || {});
      setPrograms(list.data || []);
      setFeedback(feedbackRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [filters.moduleKey, filters.q, filters.status]);

  const loadSelected = useCallback(async (id: string) => {
    const response = await betaProgramsApi.getProgram(id);
    setSelected(response.data);
    setProgramForm(programToForm(response.data));
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void Promise.all([
      featureFlagsApi.list(),
      superadminApi.listOrgs(),
    ]).then(([flagRes, orgRes]) => {
      setFlags(flagRes.data || []);
      setOrgs(orgRes.data || []);
    });
  }, []);

  useEffect(() => {
    if (!memberForm.organizationId || memberForm.memberType !== 'USER') {
      setUsers([]);
      return;
    }
    void superadminApi.listUsers(memberForm.organizationId).then((res) => setUsers(res.data || [])).catch(() => setUsers([]));
  }, [memberForm.memberType, memberForm.organizationId]);

  const submitProgram = async () => {
    if (!programForm.key || !programForm.name) return;
    setSaving(true);
    try {
      const body = cleanPayload({
        key: programForm.key,
        name: programForm.name,
        description: programForm.description,
        status: programForm.status,
        moduleKey: programForm.moduleKey,
        featureFlagId: programForm.featureFlagId,
        targetRelease: programForm.targetRelease,
        riskNotes: programForm.riskNotes,
      });
      const response = programForm.id ? await betaProgramsApi.updateProgram(programForm.id, body) : await betaProgramsApi.createProgram(body);
      setSelected(response.data);
      setProgramForm(programToForm(response.data));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const updateProgramStatus = async (status: typeof PROGRAM_STATUSES[number]) => {
    if (!selected?.id) return;
    const response = await betaProgramsApi.updateProgramStatus(selected.id, status);
    setSelected(response.data);
    setProgramForm(programToForm(response.data));
    await load();
  };

  const submitCohort = async () => {
    if (!selected?.id || !cohortForm.key || !cohortForm.name) return;
    const response = await betaProgramsApi.createCohort(selected.id, cleanPayload({
      ...cohortForm,
      rolloutPercentage: Number(cohortForm.rolloutPercentage),
    }));
    setSelected(response.data);
    setCohortForm({ ...emptyCohort });
    await load();
  };

  const addMember = async (cohortId: string) => {
    const body = cleanPayload({
      memberType: memberForm.memberType,
      organizationId: memberForm.memberType === 'ORGANIZATION' ? memberForm.organizationId : '',
      userId: memberForm.memberType === 'USER' ? memberForm.userId : '',
      role: memberForm.memberType === 'USER' ? memberForm.role : '',
      status: memberForm.status,
      notes: memberForm.notes,
    });
    const response = await betaProgramsApi.addMember(cohortId, body);
    setSelected(response.data);
    setMemberForm({ ...emptyMember });
    await load();
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Beta Program & Early Access</h1>
              <p className="mt-1 text-sm text-slate-500">Grupeaza asociatii si utilizatori in cohorte de test, leaga feature flags si colecteaza feedback inainte de rollout global.</p>
            </div>
            <button className={secondaryButtonClass} onClick={() => { setSelected(null); setProgramForm({ ...emptyProgram }); }}>
              <Plus className="h-4 w-4" /> Program nou
            </button>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
          <Kpi icon={<FlaskConical className="h-5 w-5" />} label="Programe" value={dashboard?.programs} />
          <Kpi icon={<PlayCircle className="h-5 w-5" />} label="Programe active" value={dashboard?.activePrograms} />
          <Kpi icon={<GitBranch className="h-5 w-5" />} label="Cohorte" value={dashboard?.cohorts} />
          <Kpi icon={<CheckCircle2 className="h-5 w-5" />} label="Cohorte active" value={dashboard?.activeCohorts} />
          <Kpi icon={<Users className="h-5 w-5" />} label="Participanti activi" value={dashboard?.activeMembers} />
          <Kpi icon={<MessageSquare className="h-5 w-5" />} label="Feedback nou" value={dashboard?.newFeedback} />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-2 md:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className={`${fieldClass} w-full pl-9`} placeholder="Cauta program" value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} />
            </div>
            <select className={fieldClass} value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="">Toate statusurile</option>
              {PROGRAM_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select className={fieldClass} value={filters.moduleKey} onChange={(event) => setFilters((prev) => ({ ...prev, moduleKey: event.target.value }))}>
              <option value="">Toate modulele</option>
              {modules.map((moduleKey) => <option key={moduleKey} value={moduleKey}>{moduleKey}</option>)}
            </select>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
          <Panel title="Programe beta">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr><th className="p-3">Program</th><th>Status</th><th>Modul</th><th>Flag</th><th>Cohorte</th><th>Feedback</th><th>Actiuni</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {programs.map((program) => (
                    <tr key={program.id} className="align-top hover:bg-slate-50">
                      <td className="p-3"><p className="font-semibold text-slate-950">{program.name}</p><p className="text-xs text-slate-500">{program.key}</p></td>
                      <td><Badge value={program.status} /></td>
                      <td>{program.moduleKey || '-'}</td>
                      <td>{program.featureFlag?.key || '-'}</td>
                      <td>{program._count?.cohorts || 0}</td>
                      <td>{program._count?.feedback || 0}</td>
                      <td><button className={secondaryButtonClass} onClick={() => void loadSelected(program.id)}>Deschide</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && !programs.length ? <p className="p-4 text-sm text-slate-500">Nu exista programe beta pentru filtrele curente.</p> : null}
            </div>
          </Panel>

          <div className="space-y-5">
            <Panel title={programForm.id ? 'Editeaza program' : 'Creeaza program'}>
              <div className="space-y-3">
                <input className={`${fieldClass} w-full`} placeholder="key, ex. online-payments-beta" value={programForm.key} onChange={(event) => setProgramForm((prev) => ({ ...prev, key: event.target.value }))} />
                <input className={`${fieldClass} w-full`} placeholder="Nume program" value={programForm.name} onChange={(event) => setProgramForm((prev) => ({ ...prev, name: event.target.value }))} />
                <textarea className={`${fieldClass} min-h-24 w-full`} placeholder="Descriere" value={programForm.description} onChange={(event) => setProgramForm((prev) => ({ ...prev, description: event.target.value }))} />
                <div className="grid gap-2 md:grid-cols-2">
                  <select className={fieldClass} value={programForm.status} onChange={(event) => setProgramForm((prev) => ({ ...prev, status: event.target.value }))}>{PROGRAM_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                  <input className={fieldClass} placeholder="Target release" value={programForm.targetRelease} onChange={(event) => setProgramForm((prev) => ({ ...prev, targetRelease: event.target.value }))} />
                  <select className={fieldClass} value={programForm.featureFlagId} onChange={(event) => {
                    const flag = flags.find((item) => item.id === event.target.value);
                    setProgramForm((prev) => ({ ...prev, featureFlagId: event.target.value, moduleKey: flag?.moduleKey || prev.moduleKey }));
                  }}>
                    <option value="">Fara feature flag</option>
                    {flags.map((flag) => <option key={flag.id} value={flag.id}>{flag.key}</option>)}
                  </select>
                  <input className={fieldClass} placeholder="Module key" value={programForm.moduleKey} onChange={(event) => setProgramForm((prev) => ({ ...prev, moduleKey: event.target.value }))} />
                </div>
                <textarea className={`${fieldClass} min-h-20 w-full`} placeholder="Riscuri / criterii de go-live" value={programForm.riskNotes} onChange={(event) => setProgramForm((prev) => ({ ...prev, riskNotes: event.target.value }))} />
                <div className="flex flex-wrap gap-2">
                  <button className={buttonClass} disabled={saving || !programForm.key || !programForm.name} onClick={() => void submitProgram()}><Plus className="h-4 w-4" /> Salveaza</button>
                  {selected ? PROGRAM_STATUSES.map((status) => <button key={status} className={secondaryButtonClass} onClick={() => void updateProgramStatus(status)}>{status}</button>) : null}
                </div>
              </div>
            </Panel>

            {selected ? (
              <Panel title="Cohorta noua">
                <div className="space-y-3">
                  <input className={`${fieldClass} w-full`} placeholder="key cohorta" value={cohortForm.key} onChange={(event) => setCohortForm((prev) => ({ ...prev, key: event.target.value }))} />
                  <input className={`${fieldClass} w-full`} placeholder="Nume cohorta" value={cohortForm.name} onChange={(event) => setCohortForm((prev) => ({ ...prev, name: event.target.value }))} />
                  <div className="grid gap-2 md:grid-cols-2">
                    <select className={fieldClass} value={cohortForm.status} onChange={(event) => setCohortForm((prev) => ({ ...prev, status: event.target.value }))}>{PROGRAM_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                    <input className={fieldClass} type="number" min={0} max={100} value={cohortForm.rolloutPercentage} onChange={(event) => setCohortForm((prev) => ({ ...prev, rolloutPercentage: Number(event.target.value) }))} />
                    <select className={fieldClass} value={cohortForm.featureFlagId} onChange={(event) => {
                      const flag = flags.find((item) => item.id === event.target.value);
                      setCohortForm((prev) => ({ ...prev, featureFlagId: event.target.value, moduleKey: flag?.moduleKey || prev.moduleKey }));
                    }}>
                      <option value="">Feature flag din program</option>
                      {flags.map((flag) => <option key={flag.id} value={flag.id}>{flag.key}</option>)}
                    </select>
                    <input className={fieldClass} placeholder="Module key" value={cohortForm.moduleKey} onChange={(event) => setCohortForm((prev) => ({ ...prev, moduleKey: event.target.value }))} />
                  </div>
                  <textarea className={`${fieldClass} min-h-20 w-full`} placeholder="Descriere cohorta" value={cohortForm.description} onChange={(event) => setCohortForm((prev) => ({ ...prev, description: event.target.value }))} />
                  <button className={buttonClass} disabled={!cohortForm.key || !cohortForm.name} onClick={() => void submitCohort()}><GitBranch className="h-4 w-4" /> Creeaza cohorta</button>
                </div>
              </Panel>
            ) : null}
          </div>
        </div>

        {selected ? (
          <Panel title="Cohorte si participanti">
            <div className="space-y-4">
              {(selected.cohorts || []).map((cohort: any) => (
                <section key={cohort.id} className="rounded-md border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2"><Badge value={cohort.status} /><Badge value={cohort.featureFlag?.key || 'no-flag'} /><Badge value={`${cohort.rolloutPercentage}%`} /></div>
                      <h3 className="mt-2 font-semibold text-slate-950">{cohort.name}</h3>
                      <p className="text-xs text-slate-500">{cohort.key} · {cohort.moduleKey || '-'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {PROGRAM_STATUSES.map((status) => <button key={status} className={secondaryButtonClass} onClick={() => void betaProgramsApi.updateCohortStatus(cohort.id, status).then((res) => setSelected(res.data)).then(() => load())}>{status}</button>)}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-[160px_1fr_1fr_120px_auto]">
                    <select className={fieldClass} value={memberForm.memberType} onChange={(event) => setMemberForm((prev) => ({ ...prev, memberType: event.target.value }))}>{MEMBER_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                    <select className={fieldClass} value={memberForm.organizationId} onChange={(event) => setMemberForm((prev) => ({ ...prev, organizationId: event.target.value, userId: '' }))}>
                      <option value="">Selecteaza asociatie</option>
                      {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                    </select>
                    {memberForm.memberType === 'USER' ? (
                      <select className={fieldClass} value={memberForm.userId} onChange={(event) => setMemberForm((prev) => ({ ...prev, userId: event.target.value }))}>
                        <option value="">Selecteaza user</option>
                        {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
                      </select>
                    ) : (
                      <input className={fieldClass} placeholder="Note" value={memberForm.notes} onChange={(event) => setMemberForm((prev) => ({ ...prev, notes: event.target.value }))} />
                    )}
                    <select className={fieldClass} value={memberForm.status} onChange={(event) => setMemberForm((prev) => ({ ...prev, status: event.target.value }))}>{MEMBER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                    <button className={buttonClass} onClick={() => void addMember(cohort.id)}><Plus className="h-4 w-4" /> Adauga</button>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[780px] text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500"><tr><th className="p-2">Participant</th><th>Tip</th><th>Status</th><th>Rol</th><th>Note</th><th>Actiuni</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {(cohort.members || []).map((member: any) => (
                          <tr key={member.id}>
                            <td className="p-2">{member.organization?.name || member.user?.email || '-'}</td>
                            <td>{member.memberType}</td>
                            <td><Badge value={member.status} /></td>
                            <td>{member.role || '-'}</td>
                            <td>{member.notes || '-'}</td>
                            <td><button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600" title="Remove member" aria-label="Remove member" onClick={() => void betaProgramsApi.removeMember(cohort.id, member.id).then((res) => setSelected(res.data)).then(() => load())}><Trash2 className="h-4 w-4" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
              {!selected.cohorts?.length ? <p className="text-sm text-slate-500">Creeaza o cohorta pentru a adauga participanti.</p> : null}
            </div>
          </Panel>
        ) : null}

        <Panel title="Feedback beta nou">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="p-3">Feedback</th><th>Program</th><th>Client</th><th>Sentiment</th><th>Severity</th><th>Status</th><th>Actiuni</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {feedback.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="p-3"><p className="font-semibold text-slate-950">{item.title}</p><p className="line-clamp-2 text-slate-600">{item.message}</p></td>
                    <td>{item.betaProgram?.name || '-'}</td>
                    <td>{item.organization?.name || item.user?.email || '-'}</td>
                    <td><Badge value={item.sentiment} /></td>
                    <td><Badge value={item.severity} /></td>
                    <td><Badge value={item.status} /></td>
                    <td><button className={secondaryButtonClass} onClick={() => void betaProgramsApi.updateFeedback(item.id, { status: 'REVIEWED' }).then(() => load())}><PauseCircle className="h-4 w-4" /> Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!feedback.length ? <p className="p-4 text-sm text-slate-500">Nu exista feedback beta nou.</p> : null}
          </div>
        </Panel>
      </div>
    </main>
  );
}
