'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Archive, CheckCircle2, Copy, FileText, Plus, RefreshCw, Scale } from 'lucide-react';
import { legalApi } from '@/lib/api';

const documentTypes = ['PRIVACY_POLICY', 'TERMS_OF_USE', 'COOKIE_POLICY', 'DATA_PROCESSING', 'SECURITY', 'TRUST_CENTER', 'CONTACT_POLICY', 'OTHER'];
const audiences = ['PUBLIC', 'ADMIN', 'RESIDENT', 'SUPERADMIN', 'ALL'];
const statuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

function useLocale() {
  const params = useParams<{ locale?: string; id?: string }>();
  return typeof params?.locale === 'string' ? params.locale : 'ro';
}

function localized(locale: string, href: string) {
  return `/${locale}${href}`;
}

function Badge({ value }: { value: string }) {
  const color = value === 'PUBLISHED' || value === 'RESOLVED' ? 'bg-emerald-50 text-emerald-700' : value === 'DRAFT' || value === 'NEW' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700';
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${color}`}>{value}</span>;
}

function PageShell({ title, subtitle, children, action }: { title: string; subtitle: string; children: ReactNode; action?: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-2 text-slate-600">{subtitle}</p>
          </div>
          {action}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export function SuperadminLegalOverviewPage() {
  const locale = useLocale();
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    legalApi.superadminStats().then((res) => setStats(res.data)).catch(() => setStats(null));
  }, []);
  const cards = [
    ['Documente publicate', stats?.published ?? 0],
    ['Drafturi', stats?.drafts ?? 0],
    ['Arhivate', stats?.archived ?? 0],
    ['Cereri legal noi', stats?.contactNew ?? 0],
  ];
  return (
    <PageShell title="Legal & Trust" subtitle="Gestioneaza documentele publice de incredere, termeni si confidentialitate.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => <div key={label as string} className="rounded-lg border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label as string}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{value as any}</p></div>)}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Link href={localized(locale, '/superadmin/legal/documents')} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200"><FileText className="h-5 w-5 text-emerald-700" /><p className="mt-4 font-semibold">Documente</p><p className="mt-2 text-sm text-slate-500">Publicare, arhivare si versiuni.</p></Link>
        <Link href={localized(locale, '/superadmin/legal/versions')} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200"><Scale className="h-5 w-5 text-emerald-700" /><p className="mt-4 font-semibold">Istoric versiuni</p><p className="mt-2 text-sm text-slate-500">Toate versiunile legal/trust.</p></Link>
        <Link href={localized(locale, '/superadmin/legal/contact-settings')} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200"><CheckCircle2 className="h-5 w-5 text-emerald-700" /><p className="mt-4 font-semibold">Contact legal</p><p className="mt-2 text-sm text-slate-500">Cereri si setari publice.</p></Link>
      </div>
    </PageShell>
  );
}

export function SuperadminLegalDocumentsPage({ versionsOnly = false }: { versionsOnly?: boolean }) {
  const locale = useLocale();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: '', type: '', audience: '', activeOnly: versionsOnly ? '' : 'true' });
  const load = () => {
    setLoading(true);
    legalApi.superadminDocuments(filters).then((res) => setItems(res.data.items || [])).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.type, filters.audience, filters.activeOnly]);
  return (
    <PageShell
      title={versionsOnly ? 'Versiuni documente legal' : 'Legal Documents'}
      subtitle={versionsOnly ? 'Istoricul versiunilor publicate, draft si arhivate.' : 'Gestioneaza documentele legale si de incredere din website.'}
      action={<Link href={localized(locale, '/superadmin/legal/documents/new')} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Document nou</Link>}
    >
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <input placeholder="Cauta" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} className="h-10 rounded-md border border-slate-200 px-3 text-sm md:col-span-2" />
          <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">Status</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">Tip</option>{documentTypes.map((item) => <option key={item}>{item}</option>)}</select>
          <button onClick={load} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold"><RefreshCw className="h-4 w-4" /> Refresh</button>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Titlu</th><th className="p-3">Tip</th><th className="p-3">Audience</th><th className="p-3">Status</th><th className="p-3">Versiune</th><th className="p-3">Active</th><th className="p-3">Actiuni</th></tr></thead>
          <tbody>
            {loading ? <tr><td className="p-4 text-slate-500" colSpan={7}>Se incarca...</td></tr> : null}
            {!loading && items.length === 0 ? <tr><td className="p-4 text-slate-500" colSpan={7}>Nu exista documente.</td></tr> : null}
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="p-3 font-medium text-slate-950">{item.title}<p className="text-xs text-slate-500">{item.slug}</p></td>
                <td className="p-3">{item.type}</td>
                <td className="p-3">{item.audience}</td>
                <td className="p-3"><Badge value={item.status} /></td>
                <td className="p-3">{item.version}</td>
                <td className="p-3">{item.isActive ? 'Da' : 'Nu'}</td>
                <td className="p-3"><Link href={localized(locale, `/superadmin/legal/documents/${item.id}`)} className="font-semibold text-emerald-700">Deschide</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

function LegalDocumentForm({ initial }: { initial?: any }) {
  const router = useRouter();
  const locale = useLocale();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: initial?.title || '',
    slug: initial?.slug || '',
    description: initial?.description || '',
    type: initial?.type || 'PRIVACY_POLICY',
    audience: initial?.audience || 'PUBLIC',
    locale: initial?.locale || 'ro',
    version: initial?.version || '1.0',
    status: initial?.status || 'DRAFT',
    body: initial?.body || '',
    isActive: Boolean(initial?.isActive),
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (initial?.id) await legalApi.superadminUpdateDocument(initial.id, form);
      else await legalApi.superadminCreateDocument(form);
      router.push(localized(locale, '/superadmin/legal/documents'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <input required placeholder="Titlu" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input required placeholder="Slug" value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm">{documentTypes.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={form.audience} onChange={(e) => setForm((p) => ({ ...p, audience: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm">{audiences.map((item) => <option key={item}>{item}</option>)}</select>
        <input value={form.locale} onChange={(e) => setForm((p) => ({ ...p, locale: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input required value={form.version} onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm">{statuses.map((item) => <option key={item}>{item}</option>)}</select>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} /> Marcheaza active la salvare</label>
      </div>
      <textarea placeholder="Descriere" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="mt-4 min-h-[70px] w-full rounded-md border border-slate-200 p-3 text-sm" />
      <textarea required placeholder="Body markdown/plain text" value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} className="mt-4 min-h-[360px] w-full rounded-md border border-slate-200 p-3 font-mono text-sm" />
      <button disabled={saving} className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Se salveaza...' : 'Salveaza'}</button>
    </form>
  );
}

export function SuperadminLegalNewPage() {
  return <PageShell title="Document legal nou" subtitle="Creeaza un draft legal sau trust."><LegalDocumentForm /></PageShell>;
}

export function SuperadminLegalEditPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    if (params?.id) legalApi.superadminGetDocument(params.id).then((res) => setData(res.data.document));
  }, [params?.id]);
  return <PageShell title="Editeaza document legal" subtitle="Modifica textul, versiunea si statusul.">{data ? <LegalDocumentForm initial={data} /> : <div className="rounded-lg bg-white p-5 text-slate-500">Se incarca...</div>}</PageShell>;
}

export function SuperadminLegalDetailPage() {
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const load = () => {
    if (!params?.id) return;
    legalApi.superadminGetDocument(params.id).then((res) => setData(res.data));
  };
  useEffect(() => { load(); }, [params?.id]);
  const doc = data?.document;
  return (
    <PageShell title={doc?.title || 'Document legal'} subtitle="Detalii, preview si versiuni">
      {!doc ? <div className="rounded-lg bg-white p-5 text-slate-500">Se incarca...</div> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <article className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center gap-2"><Badge value={doc.status} /><span className="text-sm text-slate-500">v{doc.version}</span><span className="text-sm text-slate-500">{doc.type}</span></div>
            <pre className="mt-6 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">{doc.body}</pre>
          </article>
          <aside className="space-y-3">
            <Link href={localized(locale, `/superadmin/legal/documents/${doc.id}/edit`)} className="block rounded-md bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white">Editeaza</Link>
            <button onClick={() => legalApi.superadminPublishDocument(doc.id).then(() => load())} className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4" /> Publica</button>
            <button onClick={() => legalApi.superadminArchiveDocument(doc.id).then(() => load())} className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"><Archive className="h-4 w-4" /> Arhiveaza</button>
            <button onClick={() => legalApi.superadminDuplicateDocument(doc.id).then(() => load())} className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"><Copy className="h-4 w-4" /> Duplicate</button>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="font-semibold text-slate-950">Versiuni</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">{(data.versions || []).map((item: any) => <p key={item.id}>v{item.version} - {item.status} {item.isActive ? '(active)' : ''}</p>)}</div>
            </div>
          </aside>
        </div>
      )}
    </PageShell>
  );
}

export function SuperadminLegalContactSettingsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const load = () => legalApi.superadminContactRequests({ status }).then((res) => setItems(res.data.items || []));
  useEffect(() => { load(); }, [status]);
  return (
    <PageShell title="Cereri legal/contact" subtitle="Feedback si solicitari legate de privacy, security si termeni.">
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">Toate statusurile</option>{['NEW', 'IN_REVIEW', 'RESOLVED', 'CLOSED', 'SPAM'].map((item) => <option key={item}>{item}</option>)}</select>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Data</th><th className="p-3">Persoana</th><th className="p-3">Tip</th><th className="p-3">Subiect</th><th className="p-3">Status</th><th className="p-3">Actiune</th></tr></thead>
          <tbody>
            {items.length === 0 ? <tr><td colSpan={6} className="p-4 text-slate-500">Nu exista cereri legal/contact.</td></tr> : null}
            {items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="p-3">{new Date(item.createdAt).toLocaleDateString('ro-RO')}</td><td className="p-3">{item.fullName}<p className="text-xs text-slate-500">{item.email || item.phone}</p></td><td className="p-3">{item.requestType}</td><td className="p-3">{item.subject}</td><td className="p-3"><Badge value={item.status} /></td><td className="p-3"><button onClick={() => legalApi.superadminContactStatus(item.id, item.status === 'NEW' ? 'IN_REVIEW' : 'RESOLVED').then(load)} className="font-semibold text-emerald-700">Actualizeaza</button></td></tr>)}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
