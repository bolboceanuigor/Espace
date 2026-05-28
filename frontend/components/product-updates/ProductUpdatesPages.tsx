'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Clock3, Eye, FileText, Megaphone, Plus, Rocket, ShieldCheck, Sparkles, Tag } from 'lucide-react';
import { productUpdatesApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const AUDIENCES = ['ALL', 'SUPER_ADMIN', 'ADMIN', 'RESIDENT'] as const;
const UPDATE_TYPES = ['FEATURE', 'IMPROVEMENT', 'FIX', 'SECURITY', 'DEPRECATION', 'NOTICE'] as const;
const VISIBILITIES = ['PUBLIC_CHANGELOG', 'IN_APP_ONLY', 'INTERNAL_ONLY'] as const;
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;

const audienceLabel: Record<string, string> = {
  ALL: 'Toți utilizatorii',
  SUPER_ADMIN: 'Superadmin',
  ADMIN: 'Admin APC',
  RESIDENT: 'Resident',
};

const typeLabel: Record<string, string> = {
  FEATURE: 'Feature',
  IMPROVEMENT: 'Îmbunătățire',
  FIX: 'Fix',
  SECURITY: 'Securitate',
  DEPRECATION: 'Deprecare',
  NOTICE: 'Anunț',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ro-MD', { day: '2-digit', month: 'short', year: 'numeric' });
}

function tone(value?: string) {
  if (['PUBLISHED', 'FEATURE', 'PUBLIC_CHANGELOG', 'LOW'].includes(value || '')) return 'emerald';
  if (['DRAFT', 'SCHEDULED', 'IN_APP_ONLY', 'NORMAL', 'IMPROVEMENT', 'NOTICE'].includes(value || '')) return 'blue';
  if (['SECURITY', 'HIGH', 'CRITICAL'].includes(value || '')) return 'red';
  return 'slate';
}

function Badge({ value }: { value?: string | null }) {
  if (!value) return null;
  const cls: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cls[tone(value)]}`}>{audienceLabel[value] || typeLabel[value] || value}</span>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-7xl space-y-5">{children}</div></main>;
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-slate-950">{title}</h2>{action}</div>{children}</section>;
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">{icon}</div><p className="text-2xl font-semibold text-slate-950">{value || 0}</p><p className="text-sm text-slate-500">{label}</p></div>;
}

export function ProductUpdatesInboxPage({ title = "What's New", subtitle = 'Noutăți de produs, îmbunătățiri și anunțuri relevante pentru rolul tău.' }: { title?: string; subtitle?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await productUpdatesApi.list()).data || []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  const unread = items.filter((item) => !item.acknowledgements?.length).length;
  return (
    <Shell>
      <header className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
            <Bell className="h-4 w-4" /> {unread} necitite
          </div>
        </div>
      </header>
      <div className="space-y-3">
        {loading ? <p className="text-sm text-slate-500">Se încarcă...</p> : null}
        {items.map((item) => <UpdateCard key={item.id} item={item} onDone={load} />)}
        {!loading && !items.length ? <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">Nu există noutăți publicate pentru acest rol.</p> : null}
      </div>
    </Shell>
  );
}

function UpdateCard({ item, onDone }: { item: any; onDone: () => void }) {
  const isAcknowledged = !!item.acknowledgements?.length;
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2"><Badge value={item.updateType} /><Badge value={item.audience} />{item.requiresAcknowledgement ? <Badge value="ack required" /> : null}</div>
          <h2 className="text-lg font-semibold text-slate-950">{item.title}</h2>
          <p className="text-sm text-slate-600">{item.summary}</p>
        </div>
        <div className="text-right text-xs text-slate-500">{formatDate(item.publishedAt || item.createdAt)}{item.release?.version ? <p className="mt-1 font-semibold">{item.release.version}</p> : null}</div>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {item.linkedFeatureRequest ? <Badge value={`Roadmap: ${item.linkedFeatureRequest.title}`} /> : null}
        {isAcknowledged ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Confirmat</span>
        ) : (
          <button onClick={async () => { await productUpdatesApi.acknowledge(item.id); await onDone(); }} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
            <CheckCircle2 className="h-4 w-4" /> Marchează citit
          </button>
        )}
      </div>
    </article>
  );
}

export function PublicChangelogPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    productUpdatesApi.publicChangelog().then((res) => setItems(res.data || [])).finally(() => setLoading(false));
  }, []);
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    items.forEach((item) => {
      const key = item.release?.version || item.version || 'Latest';
      map.set(key, [...(map.get(key) || []), item]);
    });
    return Array.from(map.entries());
  }, [items]);
  return (
    <main className="min-h-screen bg-white px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Espace changelog</p>
          <h1 className="mt-2 text-4xl font-semibold">Noutăți lansate</h1>
          <p className="mt-3 max-w-2xl text-slate-600">Doar update-urile publice sunt afișate aici. Roadmap-ul intern, feedback-ul privat și notele operaționale rămân vizibile doar pentru Superadmin.</p>
        </header>
        {loading ? <p className="text-sm text-slate-500">Se încarcă...</p> : null}
        {grouped.map(([version, rows]) => (
          <section key={version} className="border-t border-slate-200 pt-6">
            <h2 className="text-xl font-semibold">{version}</h2>
            <div className="mt-4 space-y-3">
              {rows.map((item) => (
                <article key={item.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center gap-2"><Badge value={item.updateType} /><span className="text-xs text-slate-500">{formatDate(item.publishedAt || item.createdAt)}</span></div>
                  <h3 className="mt-2 font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{item.summary}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
        {!loading && !items.length ? <p className="text-sm text-slate-500">Nu există changelog public încă.</p> : null}
      </div>
    </main>
  );
}

export function SuperadminReleaseManagementPage() {
  const path = useLocalizedPath();
  const [dashboard, setDashboard] = useState<any>(null);
  const [releases, setReleases] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [releaseForm, setReleaseForm] = useState({ version: '', title: '', summary: '' });
  const [updateForm, setUpdateForm] = useState({
    title: '',
    summary: '',
    body: '',
    productReleaseId: '',
    updateType: 'IMPROVEMENT',
    audience: 'ALL',
    visibility: 'IN_APP_ONLY',
    priority: 'NORMAL',
    moduleKey: '',
    version: '',
    linkedFeatureRequestId: '',
    linkedFeedbackId: '',
    requiresAcknowledgement: false,
  });
  const load = useCallback(async () => {
    const [dash, rel, upd] = await Promise.all([
      productUpdatesApi.superadminDashboard(),
      productUpdatesApi.releases(),
      productUpdatesApi.updates(),
    ]);
    setDashboard(dash.data || {});
    setReleases(rel.data || []);
    setUpdates(upd.data || []);
  }, []);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  return (
    <Shell>
      <header className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Release Notes & Product Updates</h1>
            <p className="mt-1 text-sm text-slate-500">Publică noutăți controlat pe roluri, release-uri și changelog public, fără să expui roadmap-ul intern.</p>
          </div>
          <Link href={path('/release-notes')} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><Eye className="h-4 w-4" /> Preview in-app</Link>
        </div>
      </header>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={<FileText />} label="Drafturi" value={dashboard?.drafts} />
        <Kpi icon={<Rocket />} label="Publicate" value={dashboard?.published} />
        <Kpi icon={<Megaphone />} label="Changelog public" value={dashboard?.publicChangelog} />
        <Kpi icon={<ShieldCheck />} label="Necesită confirmare" value={dashboard?.pendingAcknowledgement} />
        <Kpi icon={<Tag />} label="Release-uri" value={dashboard?.releases} />
        <Kpi icon={<Sparkles />} label="Legate de roadmap" value={dashboard?.linkedRoadmap} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="ProductRelease">
          <div className="space-y-2">
            <input className="input" placeholder="Version, ex. v1.2.0" value={releaseForm.version} onChange={(e) => setReleaseForm((p) => ({ ...p, version: e.target.value }))} />
            <input className="input" placeholder="Release title" value={releaseForm.title} onChange={(e) => setReleaseForm((p) => ({ ...p, title: e.target.value }))} />
            <textarea className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" rows={3} placeholder="Summary" value={releaseForm.summary} onChange={(e) => setReleaseForm((p) => ({ ...p, summary: e.target.value }))} />
            <button className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" onClick={async () => { if (!releaseForm.version || !releaseForm.title) return; await productUpdatesApi.createRelease(releaseForm); setReleaseForm({ version: '', title: '', summary: '' }); await load(); }}><Plus className="h-4 w-4" /> Creează release</button>
          </div>
        </Panel>
        <Panel title="ProductUpdate">
          <div className="space-y-2">
            <input className="input" placeholder="Title" value={updateForm.title} onChange={(e) => setUpdateForm((p) => ({ ...p, title: e.target.value }))} />
            <input className="input" placeholder="Short summary" value={updateForm.summary} onChange={(e) => setUpdateForm((p) => ({ ...p, summary: e.target.value }))} />
            <textarea className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" rows={4} placeholder="Body shown in app" value={updateForm.body} onChange={(e) => setUpdateForm((p) => ({ ...p, body: e.target.value }))} />
            <div className="grid gap-2 md:grid-cols-2">
              <select className="input" value={updateForm.productReleaseId} onChange={(e) => setUpdateForm((p) => ({ ...p, productReleaseId: e.target.value }))}><option value="">Fără release</option>{releases.map((item) => <option key={item.id} value={item.id}>{item.version} - {item.title}</option>)}</select>
              <select className="input" value={updateForm.updateType} onChange={(e) => setUpdateForm((p) => ({ ...p, updateType: e.target.value }))}>{UPDATE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select className="input" value={updateForm.audience} onChange={(e) => setUpdateForm((p) => ({ ...p, audience: e.target.value }))}>{AUDIENCES.map((item) => <option key={item} value={item}>{audienceLabel[item]}</option>)}</select>
              <select className="input" value={updateForm.visibility} onChange={(e) => setUpdateForm((p) => ({ ...p, visibility: e.target.value }))}>{VISIBILITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select className="input" value={updateForm.priority} onChange={(e) => setUpdateForm((p) => ({ ...p, priority: e.target.value }))}>{PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <input className="input" placeholder="Module key" value={updateForm.moduleKey} onChange={(e) => setUpdateForm((p) => ({ ...p, moduleKey: e.target.value }))} />
              <input className="input" placeholder="FeatureRequest ID" value={updateForm.linkedFeatureRequestId} onChange={(e) => setUpdateForm((p) => ({ ...p, linkedFeatureRequestId: e.target.value }))} />
              <input className="input" placeholder="Feedback ID" value={updateForm.linkedFeedbackId} onChange={(e) => setUpdateForm((p) => ({ ...p, linkedFeedbackId: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={updateForm.requiresAcknowledgement} onChange={(e) => setUpdateForm((p) => ({ ...p, requiresAcknowledgement: e.target.checked }))} /> Necesită confirmare</label>
            <button className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" onClick={async () => { if (!updateForm.title || !updateForm.summary || !updateForm.body) return; await productUpdatesApi.createUpdate({ ...updateForm, productReleaseId: updateForm.productReleaseId || undefined, linkedFeatureRequestId: updateForm.linkedFeatureRequestId || undefined, linkedFeedbackId: updateForm.linkedFeedbackId || undefined }); setUpdateForm((p) => ({ ...p, title: '', summary: '', body: '', linkedFeatureRequestId: '', linkedFeedbackId: '' })); await load(); }}><Plus className="h-4 w-4" /> Creează update</button>
          </div>
        </Panel>
      </div>
      <Panel title="Release-uri">
        <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Version</th><th>Title</th><th>Status</th><th>Updates</th><th>Published</th><th>Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{releases.map((item) => <tr key={item.id}><td className="p-3 font-semibold">{item.version}</td><td>{item.title}</td><td><Badge value={item.status} /></td><td>{item.updates?.length || 0}</td><td>{formatDate(item.publishedAt)}</td><td><RowActions item={item} publish={() => productUpdatesApi.publishRelease(item.id)} archive={() => productUpdatesApi.archiveRelease(item.id)} onDone={load} /></td></tr>)}</tbody></table></div>
      </Panel>
      <Panel title="Update-uri">
        <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Title</th><th>Type</th><th>Audience</th><th>Visibility</th><th>Status</th><th>Ack</th><th>Linked</th><th>Published</th><th>Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{updates.map((item) => <tr key={item.id} className="align-top"><td className="p-3"><p className="font-semibold">{item.title}</p><p className="text-xs text-slate-500">{item.summary}</p></td><td><Badge value={item.updateType} /></td><td><Badge value={item.audience} /></td><td><Badge value={item.visibility} /></td><td><Badge value={item.status} /></td><td>{item._count?.acknowledgements || 0}{item.requiresAcknowledgement ? <p className="text-xs text-amber-700">required</p> : null}</td><td className="text-xs text-slate-500">{item.linkedFeatureRequest ? `Roadmap: ${item.linkedFeatureRequest.title}` : null}{item.linkedFeedback ? <p>Feedback: {item.linkedFeedback.title}</p> : null}</td><td>{formatDate(item.publishedAt)}</td><td><RowActions item={item} publish={() => productUpdatesApi.publishUpdate(item.id)} archive={() => productUpdatesApi.archiveUpdate(item.id)} onDone={load} /></td></tr>)}</tbody></table></div>
      </Panel>
      <Panel title="Reguli de vizibilitate">
        <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
          <p><b className="text-slate-950">PUBLIC_CHANGELOG</b><br />Apare în changelog public doar dacă audience este ALL.</p>
          <p><b className="text-slate-950">IN_APP_ONLY</b><br />Apare în aplicație pentru rolurile selectate, cu confirmare opțională.</p>
          <p><b className="text-slate-950">INTERNAL_ONLY</b><br />Rămâne exclusiv pentru Superadmin și nu ajunge la Admin/Resident.</p>
        </div>
      </Panel>
    </Shell>
  );
}

function RowActions({ item, publish, archive, onDone }: { item: any; publish: () => Promise<any>; archive: () => Promise<any>; onDone: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {item.status !== 'PUBLISHED' ? <button className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold" onClick={async () => { await publish(); await onDone(); }}><Rocket className="mr-1 inline h-3 w-3" />Publish</button> : null}
      {item.status !== 'ARCHIVED' ? <button className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold" onClick={async () => { await archive(); await onDone(); }}><Clock3 className="mr-1 inline h-3 w-3" />Archive</button> : null}
    </div>
  );
}
