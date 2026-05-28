'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, FileText, Link2, MessageSquare, Pin, Users } from 'lucide-react';
import { superadminClientsApi, superadminKnowledgeApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

function fmt(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ro-MD', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-7xl space-y-5">{children}</div></main>;
}

function Header({ title, subtitle, clientId }: { title: string; subtitle: string; clientId?: string }) {
  const path = useLocalizedPath();
  return <header className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-2xl font-semibold text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{clientId ? <nav className="flex flex-wrap gap-2 text-sm"><Link href={path(`/superadmin/clients/${clientId}/knowledge`)} className="rounded-md border border-slate-200 px-3 py-2">Knowledge</Link><Link href={path(`/superadmin/clients/${clientId}/notes`)} className="rounded-md border border-slate-200 px-3 py-2">Notes</Link><Link href={path(`/superadmin/clients/${clientId}/files`)} className="rounded-md border border-slate-200 px-3 py-2">Files</Link><Link href={path(`/superadmin/clients/${clientId}/contacts`)} className="rounded-md border border-slate-200 px-3 py-2">Contacts</Link><Link href={path(`/superadmin/clients/${clientId}/decisions`)} className="rounded-md border border-slate-200 px-3 py-2">Decisions</Link><Link href={path(`/superadmin/clients/${clientId}/known-issues`)} className="rounded-md border border-slate-200 px-3 py-2">Issues</Link><Link href={path(`/superadmin/clients/${clientId}/links`)} className="rounded-md border border-slate-200 px-3 py-2">Links</Link></nav> : null}</div></header>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="mb-4 font-semibold text-slate-950">{title}</h2>{children}</section>;
}

function Badge({ value, tone = 'slate' }: { value: string; tone?: 'slate' | 'emerald' | 'amber' | 'red' | 'blue' }) {
  const tones = { slate: 'bg-slate-100 text-slate-700', emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', blue: 'bg-blue-50 text-blue-700' };
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tones[tone]}`}>{value}</span>;
}

function Empty({ title }: { title: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{title}</div>;
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">{icon}</div><p className="text-2xl font-semibold text-slate-950">{value}</p><p className="text-sm text-slate-500">{label}</p></div>;
}

function SecretWarning() {
  return <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Nu salva parole, tokenuri, carduri sau chei API in baza interna.</div>;
}

export function ClientKnowledgeOverviewPage({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { superadminClientsApi.knowledge(id).then((res) => setData(res.data || res)).catch(() => setData({ summary: {} })); }, [id]);
  const summary = data?.summary || {};
  return <Shell><Header title="Knowledge Base" subtitle="Context intern, note, fisiere, decizii si informatii importante despre client." clientId={id} /><SecretWarning /><div className="grid gap-3 md:grid-cols-6"><Kpi icon={<MessageSquare />} label="Note active" value={summary.notes || 0} /><Kpi icon={<FileText />} label="Fisiere/linkuri" value={(summary.files || 0) + (data?.recentLinks?.length || 0)} /><Kpi icon={<Users />} label="Contacte" value={summary.contacts || 0} /><Kpi icon={<BookOpen />} label="Decizii" value={summary.decisions || 0} /><Kpi icon={<AlertTriangle />} label="Probleme" value={summary.openIssues || 0} /><Kpi icon={<Pin />} label="Pinned" value={summary.pinnedNotes || 0} /></div><div className="grid gap-4 lg:grid-cols-2"><Panel title="Note pinned"><KnowledgeCards items={data?.pinnedNotes || []} empty="Nu exista note pinned." /></Panel><Panel title="Contacte principale"><ContactCards items={data?.primaryContacts || []} /></Panel><Panel title="Probleme deschise"><IssueCards items={data?.openIssues || []} /></Panel><Panel title="Decizii recente"><DecisionCards items={data?.recentDecisions || []} /></Panel><Panel title="Fisiere recente"><FileCards items={data?.recentFiles || []} /></Panel><Panel title="Linkuri utile"><LinkCards items={data?.recentLinks || []} /></Panel></div></Shell>;
}

export function ClientNotesPage({ id }: { id: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', content: '', category: 'GENERAL', priority: 'NORMAL', isPinned: false });
  const load = useCallback(async () => setItems(((await superadminClientsApi.notes(id)).data || {}).items || []), [id]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  const submit = async () => { if (!form.title || !form.content) return; await superadminClientsApi.createNote(id, form); setForm({ title: '', content: '', category: 'GENERAL', priority: 'NORMAL', isPinned: false }); await load(); };
  return <Shell><Header title="Note interne" subtitle="Note categorizate, pinned si cautabile pentru client." clientId={id} /><SecretWarning /><Panel title="Adauga nota"><div className="grid gap-2 md:grid-cols-2"><Input label="Titlu" value={form.title} onChange={(v) => setForm({ ...form, title: v })} /><Select label="Categorie" value={form.category} options={categories} onChange={(v) => setForm({ ...form, category: v })} /><Select label="Prioritate" value={form.priority} options={priorities} onChange={(v) => setForm({ ...form, priority: v })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} /> Pinned</label></div><textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="mt-3 min-h-28 w-full rounded-md border border-slate-200 p-3 text-sm" placeholder="Context intern..." /><button onClick={submit} className="mt-3 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Salveaza nota</button></Panel><Panel title="Note">{items.length ? <KnowledgeCards items={items} onArchive={async (noteId) => { await superadminClientsApi.archiveNote(id, noteId); await load(); }} /> : <Empty title="Nu exista note interne." />}</Panel></Shell>;
}

export function ClientFilesPage({ id }: { id: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ fileName: '', externalUrl: '', description: '', category: 'DOCUMENTS' });
  const load = useCallback(async () => setItems(((await superadminClientsApi.files(id)).data || {}).items || []), [id]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  const submit = async () => { if (!form.fileName) return; await superadminClientsApi.createFile(id, { ...form, storageProvider: form.externalUrl ? 'EXTERNAL_LINK' : 'NONE' }); setForm({ fileName: '', externalUrl: '', description: '', category: 'DOCUMENTS' }); await load(); };
  return <Shell><Header title="Fisiere si referinte" subtitle="Upload direct va fi disponibil dupa configurarea storage-ului; acum se salveaza referinte si linkuri." clientId={id} /><SecretWarning /><Panel title="Adauga referinta"><div className="grid gap-2 md:grid-cols-2"><Input label="Nume document" value={form.fileName} onChange={(v) => setForm({ ...form, fileName: v })} /><Input label="External URL" value={form.externalUrl} onChange={(v) => setForm({ ...form, externalUrl: v })} /><Select label="Categorie" value={form.category} options={categories} onChange={(v) => setForm({ ...form, category: v })} /></div><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-3 min-h-20 w-full rounded-md border border-slate-200 p-3 text-sm" placeholder="Descriere..." /><button onClick={submit} className="mt-3 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Salveaza referinta</button></Panel><Panel title="Fisiere">{items.length ? <FileCards items={items} onArchive={async (fileId) => { await superadminClientsApi.archiveFile(id, fileId); await load(); }} /> : <Empty title="Nu exista fisiere sau linkuri salvate." />}</Panel></Shell>;
}

export function ClientContactsPage({ id }: { id: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ fullName: '', role: '', phone: '', email: '', isPrimary: false });
  const load = useCallback(async () => setItems(((await superadminClientsApi.contacts(id)).data || {}).items || []), [id]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  const submit = async () => { if (!form.fullName) return; await superadminClientsApi.createContact(id, form); setForm({ fullName: '', role: '', phone: '', email: '', isPrimary: false }); await load(); };
  return <Shell><Header title="Contacte client" subtitle="Persoane importante pentru operare, decizii si billing." clientId={id} /><Panel title="Adauga contact"><div className="grid gap-2 md:grid-cols-2"><Input label="Nume" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} /><Input label="Rol" value={form.role} onChange={(v) => setForm({ ...form, role: v })} /><Input label="Telefon" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} /><Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} /> Contact principal</label></div><button onClick={submit} className="mt-3 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Salveaza contact</button></Panel><Panel title="Contacte">{items.length ? <ContactCards items={items} /> : <Empty title="Nu exista contacte salvate." />}</Panel></Shell>;
}

export function ClientDecisionsPage({ id }: { id: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', description: '', impact: 'MEDIUM', category: 'DECISIONS' });
  const load = useCallback(async () => setItems(((await superadminClientsApi.decisions(id)).data || {}).items || []), [id]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  const submit = async () => { if (!form.title || !form.description) return; await superadminClientsApi.createDecision(id, form); setForm({ title: '', description: '', impact: 'MEDIUM', category: 'DECISIONS' }); await load(); };
  return <Shell><Header title="Decizii client" subtitle="Decizii interne importante si impactul lor operational." clientId={id} /><SecretWarning /><Panel title="Adauga decizie"><div className="grid gap-2 md:grid-cols-2"><Input label="Titlu" value={form.title} onChange={(v) => setForm({ ...form, title: v })} /><Select label="Impact" value={form.impact} options={['LOW','MEDIUM','HIGH','CRITICAL']} onChange={(v) => setForm({ ...form, impact: v })} /><Select label="Categorie" value={form.category} options={categories} onChange={(v) => setForm({ ...form, category: v })} /></div><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-3 min-h-24 w-full rounded-md border border-slate-200 p-3 text-sm" /><button onClick={submit} className="mt-3 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Salveaza decizie</button></Panel><Panel title="Decizii">{items.length ? <DecisionCards items={items} /> : <Empty title="Nu exista decizii inregistrate." />}</Panel></Shell>;
}

export function ClientKnownIssuesPage({ id }: { id: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', description: '', severity: 'MEDIUM', category: 'RISKS', workaround: '' });
  const load = useCallback(async () => setItems(((await superadminClientsApi.knownIssues(id)).data || {}).items || []), [id]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  const submit = async () => { if (!form.title || !form.description) return; await superadminClientsApi.createKnownIssue(id, form); setForm({ title: '', description: '', severity: 'MEDIUM', category: 'RISKS', workaround: '' }); await load(); };
  return <Shell><Header title="Probleme cunoscute" subtitle="Riscuri si probleme operationale cunoscute pentru client." clientId={id} /><SecretWarning /><Panel title="Adauga problema"><div className="grid gap-2 md:grid-cols-2"><Input label="Titlu" value={form.title} onChange={(v) => setForm({ ...form, title: v })} /><Select label="Severitate" value={form.severity} options={['LOW','MEDIUM','HIGH','CRITICAL']} onChange={(v) => setForm({ ...form, severity: v })} /><Select label="Categorie" value={form.category} options={categories} onChange={(v) => setForm({ ...form, category: v })} /></div><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-3 min-h-24 w-full rounded-md border border-slate-200 p-3 text-sm" placeholder="Descriere..." /><textarea value={form.workaround} onChange={(e) => setForm({ ...form, workaround: e.target.value })} className="mt-3 min-h-20 w-full rounded-md border border-slate-200 p-3 text-sm" placeholder="Workaround..." /><button onClick={submit} className="mt-3 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Salveaza problema</button></Panel><Panel title="Probleme">{items.length ? <IssueCards items={items} onResolve={async (issueId) => { await superadminClientsApi.resolveKnownIssue(id, issueId); await load(); }} /> : <Empty title="Nu exista probleme cunoscute." />}</Panel></Shell>;
}

export function ClientLinksPage({ id }: { id: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', url: '', description: '', category: 'GENERAL' });
  const load = useCallback(async () => setItems(((await superadminClientsApi.links(id)).data || {}).items || []), [id]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  const submit = async () => { if (!form.title || !form.url) return; await superadminClientsApi.createLink(id, form); setForm({ title: '', url: '', description: '', category: 'GENERAL' }); await load(); };
  return <Shell><Header title="Linkuri utile" subtitle="Linkuri interne relevante pentru client, fara tokenuri sau URL-uri secrete." clientId={id} /><SecretWarning /><Panel title="Adauga link"><div className="grid gap-2 md:grid-cols-2"><Input label="Titlu" value={form.title} onChange={(v) => setForm({ ...form, title: v })} /><Input label="URL" value={form.url} onChange={(v) => setForm({ ...form, url: v })} /><Select label="Categorie" value={form.category} options={categories} onChange={(v) => setForm({ ...form, category: v })} /></div><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-3 min-h-20 w-full rounded-md border border-slate-200 p-3 text-sm" /><button onClick={submit} className="mt-3 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Salveaza link</button></Panel><Panel title="Linkuri">{items.length ? <LinkCards items={items} /> : <Empty title="Nu exista linkuri utile." />}</Panel></Shell>;
}

export function GlobalKnowledgePage({ view = 'knowledge' }: { view?: 'knowledge' | 'search' | 'files' | 'decisions' | 'known-issues' }) {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const load = useCallback(async () => {
    const api = view === 'files' ? superadminKnowledgeApi.files : view === 'decisions' ? superadminKnowledgeApi.decisions : view === 'known-issues' ? superadminKnowledgeApi.knownIssues : superadminKnowledgeApi.search;
    const res = await api({ search: search || undefined });
    setItems((res.data || res).items || []);
  }, [search, view]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  return <Shell><Header title="Knowledge Base Global" subtitle="Cauta note, fisiere, contacte, decizii si probleme cunoscute pentru toti clientii." /><div className="rounded-lg border border-slate-200 bg-white p-4"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cauta in knowledge base..." className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" /><button onClick={load} className="mt-3 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Cauta</button></div><Panel title="Rezultate">{items.length ? <GlobalRows items={items} /> : <Empty title="Nu exista rezultate." />}</Panel></Shell>;
}

const categories = ['GENERAL','ONBOARDING','SUPPORT','BILLING','SUBSCRIPTION','TECHNICAL','LEGAL','SECURITY','DATA_IMPORT','PEOPLE','DECISIONS','RISKS','INCIDENTS','DOCUMENTS','OTHER'];
const priorities = ['LOW','NORMAL','HIGH','CRITICAL'];

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-slate-400">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-slate-400">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function KnowledgeCards({ items, empty = 'Nu exista informatii interne.', onArchive }: { items: any[]; empty?: string; onArchive?: (id: string) => void }) {
  return <div className="space-y-2">{items.length ? items.map((item) => <article key={item.id} className="rounded-md border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-950">{item.title}</p><p className="mt-1 text-sm text-slate-500">{item.content || item.summary || item.note || '-'}</p></div>{item.isPinned ? <Badge value="Pinned" tone="amber" /> : null}</div><div className="mt-3 flex flex-wrap gap-2"><Badge value={item.category || 'GENERAL'} /><Badge value={item.priority || 'NORMAL'} tone={item.priority === 'CRITICAL' || item.priority === 'HIGH' ? 'red' : 'slate'} /><span className="text-xs text-slate-400">{fmt(item.updatedAt || item.createdAt)}</span>{onArchive ? <button onClick={() => onArchive(item.id)} className="text-xs text-slate-500 hover:underline">Archive</button> : null}</div></article>) : <Empty title={empty} />}</div>;
}

function ContactCards({ items }: { items: any[] }) {
  return <div className="space-y-2">{items.length ? items.map((item) => <div key={item.id} className="rounded-md border border-slate-200 p-3"><p className="font-semibold text-slate-950">{item.fullName}</p><p className="text-sm text-slate-500">{item.role || '-'} · {item.phone || item.email || '-'}</p>{item.isPrimary ? <Badge value="Primary" tone="emerald" /> : null}</div>) : <Empty title="Nu exista contacte salvate." />}</div>;
}

function IssueCards({ items, onResolve }: { items: any[]; onResolve?: (id: string) => void }) {
  return <div className="space-y-2">{items.length ? items.map((item) => <div key={item.id} className="rounded-md border border-slate-200 p-3"><div className="flex items-start justify-between"><p className="font-semibold text-slate-950">{item.title}</p><Badge value={item.severity || 'MEDIUM'} tone={item.severity === 'CRITICAL' || item.severity === 'HIGH' ? 'red' : 'amber'} /></div><p className="mt-1 text-sm text-slate-500">{item.description}</p>{item.workaround ? <p className="mt-2 text-xs text-slate-500">Workaround: {item.workaround}</p> : null}<div className="mt-2 flex gap-2">{onResolve && item.status !== 'RESOLVED' ? <button onClick={() => onResolve(item.id)} className="text-xs text-emerald-700 hover:underline">Resolve</button> : null}<Badge value={item.status || 'OPEN'} /></div></div>) : <Empty title="Nu exista probleme cunoscute." />}</div>;
}

function DecisionCards({ items }: { items: any[] }) {
  return <div className="space-y-2">{items.length ? items.map((item) => <div key={item.id} className="rounded-md border border-slate-200 p-3"><p className="font-semibold text-slate-950">{item.title}</p><p className="mt-1 text-sm text-slate-500">{item.description}</p><div className="mt-2 flex gap-2"><Badge value={item.impact || 'MEDIUM'} tone={item.impact === 'CRITICAL' || item.impact === 'HIGH' ? 'red' : 'slate'} /><span className="text-xs text-slate-400">{fmt(item.decisionDate)}</span></div></div>) : <Empty title="Nu exista decizii inregistrate." />}</div>;
}

function FileCards({ items, onArchive }: { items: any[]; onArchive?: (id: string) => void }) {
  return <div className="space-y-2">{items.length ? items.map((item) => <div key={item.id} className="rounded-md border border-slate-200 p-3"><p className="font-semibold text-slate-950">{item.fileName}</p><p className="text-sm text-slate-500">{item.description || item.originalFileName || '-'}</p><div className="mt-2 flex flex-wrap gap-2"><Badge value={item.storageProvider || 'EXTERNAL_LINK'} />{item.externalUrl ? <a href={item.externalUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 hover:underline">Open</a> : null}{onArchive ? <button onClick={() => onArchive(item.id)} className="text-xs text-slate-500 hover:underline">Archive</button> : null}</div></div>) : <Empty title="Nu exista fisiere sau linkuri salvate." />}</div>;
}

function LinkCards({ items }: { items: any[] }) {
  return <div className="space-y-2">{items.length ? items.map((item) => <div key={item.id} className="rounded-md border border-slate-200 p-3"><p className="font-semibold text-slate-950">{item.title}</p><p className="text-sm text-slate-500">{item.description || item.url}</p><a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Link2 className="h-3 w-3" /> Deschide</a></div>) : <Empty title="Nu exista linkuri utile." />}</div>;
}

function GlobalRows({ items }: { items: any[] }) {
  const path = useLocalizedPath();
  return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Titlu</th><th>Client</th><th>Tip/Status</th><th>Categorie</th><th>Updated</th><th>Actiuni</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="p-3 font-semibold text-slate-950">{item.title || item.fileName || item.fullName}</td><td>{item.clientAccount?.displayName || item.clientAccountId || '-'}</td><td>{item.type || item.status || '-'}</td><td>{item.category || '-'}</td><td>{fmt(item.updatedAt || item.createdAt || item.uploadedAt)}</td><td>{item.clientAccountId ? <Link href={path(`/superadmin/clients/${item.clientAccountId}/knowledge`)} className="text-emerald-700 hover:underline">Client</Link> : null}</td></tr>)}</tbody></table></div>;
}
