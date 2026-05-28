'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  ArrowRight,
  Bug,
  Building2,
  Clock,
  Command,
  CreditCard,
  DatabaseBackup,
  Download,
  FileSearch,
  FileText,
  HeartPulse,
  HelpCircle,
  Inbox,
  Layers,
  LifeBuoy,
  Loader2,
  Repeat,
  Rocket,
  Scale,
  Search,
  Server,
  Shield,
  TriangleAlert,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { Badge, Button, Card, PageHeader, StatCard } from '@/components/ui';
import { superadminSearchApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type GlobalResult = {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  url: string;
  icon?: string;
  metadata?: Record<string, any>;
};

type GlobalGroup = {
  type: string;
  label: string;
  items: GlobalResult[];
};

const RECENT_KEY = 'espace.superadmin.recentSearchItems';

export function SuperadminGlobalSearchInput({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="hidden h-9 w-full items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-left transition hover:bg-white lg:flex">
      <Search className="h-4 w-4 text-neutral-400" />
      <span className="min-w-0 flex-1 px-3 text-sm text-neutral-400">Caută global...</span>
      <kbd className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] text-neutral-400">⌘K</kbd>
    </button>
  );
}

export function SuperadminCommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<GlobalGroup[]>([]);
  const [recentLocal, setRecentLocal] = useState<GlobalResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const flatItems = useMemo(() => groups.flatMap((group) => group.items.map((item) => ({ ...item, groupLabel: group.label }))), [groups]);

  const load = useCallback(async (value: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await superadminSearchApi.search({ q: value, includeCommands: true, includeRecent: true });
      setGroups(res.data?.groups || []);
      setActiveIndex(0);
    } catch (err: any) {
      setError(String(err?.message || 'Căutarea nu este disponibilă momentan. Încearcă din nou.'));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const openItem = useCallback(async (item: GlobalResult) => {
    const url = localizedPath(item.url || '/superadmin/search');
    const nextRecent = [item, ...recentLocal.filter((recent) => recent.url !== item.url)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent));
    setRecentLocal(nextRecent);
    await superadminSearchApi.saveRecent({
      query,
      selectedResultType: item.type,
      selectedResultId: item.id,
      selectedResultTitle: item.title,
      selectedUrl: item.url,
    }).catch(() => undefined);
    onOpenChange(false);
    router.push(url);
  }, [localizedPath, onOpenChange, query, recentLocal, router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (!open || (isTyping && target !== inputRef.current)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => Math.min(current + 1, Math.max(flatItems.length - 1, 0)));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
      }
      if (event.key === 'Enter' && flatItems[activeIndex]) {
        event.preventDefault();
        void openItem(flatItems[activeIndex]);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, flatItems, onOpenChange, open, openItem]);

  useEffect(() => {
    if (!open) return;
    const stored = localStorage.getItem(RECENT_KEY);
    setRecentLocal(stored ? JSON.parse(stored).slice(0, 6) : []);
    setTimeout(() => inputRef.current?.focus(), 30);
    void load(query);
  }, [load, open, query]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void load(query), query.trim().length ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, open, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/35 p-0 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl md:max-h-[84vh] md:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Search className="h-5 w-5 text-slate-400" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută asociații, utilizatori, abonamente, facturi SaaS..." className="h-11 min-w-0 flex-1 bg-transparent text-base font-medium text-slate-950 outline-none placeholder:text-slate-400" />
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          <button type="button" onClick={() => onOpenChange(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Închide">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
          {!query.trim() && recentLocal.length ? <SuperadminSearchResultGroup label="Deschise recent" items={recentLocal} activeIndex={activeIndex} offset={0} onSelect={openItem} /> : null}
          {groups.map((group, groupIndex) => {
            const offset = groups.slice(0, groupIndex).reduce((sum, item) => sum + item.items.length, 0);
            return <SuperadminSearchResultGroup key={`${group.type}-${group.label}`} label={group.label} items={group.items} activeIndex={activeIndex} offset={offset} onSelect={openItem} />;
          })}
          {!loading && !groups.length && !error ? <SuperadminSearchEmpty query={query} /> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-xs font-semibold text-slate-500">
          <span>Enter pentru deschidere · Esc pentru închidere</span>
          <span className="inline-flex items-center gap-1"><Command className="h-3.5 w-3.5" /> Cmd/Ctrl + K</span>
        </div>
      </div>
    </div>
  );
}

export function SuperadminSearchResultGroup({ label, items, activeIndex, offset, onSelect }: { label: string; items: GlobalResult[]; activeIndex?: number; offset?: number; onSelect: (item: GlobalResult) => void }) {
  if (!items.length) return null;
  return (
    <section className="mb-4">
      <h3 className="px-2 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</h3>
      <div className="space-y-1">
        {items.map((item, index) => <SuperadminSearchResultItem key={`${item.type}-${item.id}-${item.url}`} item={item} active={(offset || 0) + index === activeIndex} onSelect={() => onSelect(item)} />)}
      </div>
    </section>
  );
}

export function SuperadminSearchResultItem({ item, active, onSelect }: { item: GlobalResult; active?: boolean; onSelect: () => void }) {
  const Icon = iconFor(item.icon || item.type);
  return (
    <button type="button" onClick={onSelect} className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${active ? 'bg-slate-950 text-white' : 'hover:bg-slate-100'}`}>
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-white/10' : 'bg-slate-100 text-slate-600'}`}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{item.title}</span>
        <span className={`block truncate text-xs ${active ? 'text-white/70' : 'text-slate-500'}`}>{item.subtitle || item.description || item.url}</span>
      </span>
      {item.badge ? <Badge variant={badgeVariant(item.badge)}>{item.badge}</Badge> : null}
      <ArrowRight className={`h-4 w-4 ${active ? 'text-white/70' : 'text-slate-300'}`} />
    </button>
  );
}

export function SuperadminSearchPage() {
  const localizedPath = useLocalizedPath();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<GlobalGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superadminSearchApi.search({ q: query, includeCommands: true, includeRecent: true, limitPerType: 10 });
      setGroups(res.data?.groups || []);
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => { void load(); }, [load]);
  async function openItem(item: GlobalResult) {
    await superadminSearchApi.saveRecent({ query, selectedResultType: item.type, selectedResultId: item.id, selectedResultTitle: item.title, selectedUrl: item.url }).catch(() => undefined);
    router.push(localizedPath(item.url));
  }
  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Căutare globală" description="Caută rapid clienți, utilizatori, abonamente, facturi SaaS și servicii platformă." />
      <Card className="flex items-center gap-3 p-3"><Search className="h-5 w-5 text-slate-400" /><input className="h-12 flex-1 bg-transparent text-base outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută global..." /><Button onClick={load} isLoading={loading}>Caută</Button></Card>
      {groups.map((group, index) => <SuperadminSearchResultGroup key={group.label} label={group.label} items={group.items} activeIndex={-1} offset={index * 1000} onSelect={openItem} />)}
      {!groups.length && !loading ? <SuperadminSearchEmpty query={query} /> : null}
    </div>
  );
}

export function SuperadminCommandsPage() {
  const localizedPath = useLocalizedPath();
  const [groups, setGroups] = useState<Array<{ label: string; items: any[] }>>([]);
  useEffect(() => { superadminSearchApi.commands().then((res) => setGroups(res.data?.groups || [])).catch(() => setGroups([])); }, []);
  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Comenzi Superadmin" description="Navigare rapidă și acțiuni sigure, fără mutații riscante directe." />
      {groups.map((group) => (
        <section key={group.label} className="space-y-3">
          <h2 className="text-lg font-bold text-slate-950">{group.label}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => {
              const Icon = iconFor(item.icon);
              return <Card key={item.key}><Icon className="h-5 w-5 text-slate-500" /><h3 className="mt-3 font-bold text-slate-950">{item.title}</h3><p className="mt-1 text-sm text-slate-500">{item.subtitle}</p><a className="mt-4 inline-flex min-h-10 items-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white" href={localizedPath(item.url)}>Deschide</a></Card>;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function SuperadminRecentPage() {
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => {
    const res = await superadminSearchApi.recent();
    setItems(res.data?.items || []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Recente" description="Elemente deschise recent în Superadmin." rightSlot={<Button variant="secondary" onClick={async () => { await superadminSearchApi.clearRecent(); await load(); }}>Curăță istoricul</Button>} />
      <Card className="divide-y divide-slate-100 p-0">
        {items.length ? items.map((item) => <a key={item.id} href={item.selectedUrl || '/superadmin/search'} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-slate-50"><Clock className="h-4 w-4 text-slate-400" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{item.selectedResultTitle || item.query}</span><span className="block text-xs text-slate-500">{item.query || item.selectedResultType}</span></span></a>) : <SuperadminSearchEmpty />}
      </Card>
    </div>
  );
}

export function ClientNavigatorPage({ associationId }: { associationId: string }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    superadminSearchApi.clientNavigator(associationId).then((res) => setData(res.data)).catch((err) => setError(String(err?.message || 'Nu am putut încărca contextul clientului.')));
  }, [associationId]);
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>;
  if (!data) return <div className="p-8 text-sm text-slate-500">Se încarcă...</div>;
  return (
    <div className="space-y-5 pb-8">
      <PageHeader title={data.association.shortName || data.association.legalName} description={`${data.association.associationCode || 'Fără cod'} · ${data.association.status}`} rightSlot={<a className="inline-flex min-h-10 items-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white" href={localizedPath(`/superadmin/associations/${associationId}`)}>Open association</a>} />
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Plan" value={data.subscription.planName || '-'} />
        <StatCard label="Status abonament" value={data.subscription.status || '-'} />
        <StatCard label="Sold SaaS" value={`${Number(data.saasBilling.outstandingBalance || 0).toFixed(2)} MDL`} tone={data.saasBilling.outstandingBalance > 0 ? 'warning' : 'success'} />
        <StatCard label="Support activ" value={data.support.activeSessions || 0} />
      </section>
      {data.clientLifecycle ? (
        <Card>
          <h2 className="font-bold text-slate-950">Client lifecycle</h2>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-5">
            <span><b>Etapa:</b> {data.clientLifecycle.lifecycleStage}</span>
            <span><b>Status:</b> {data.clientLifecycle.status}</span>
            <span><b>Prioritate:</b> {data.clientLifecycle.priority}</span>
            <span><b>Risc:</b> {data.clientLifecycle.riskLevel}</span>
            <a href={localizedPath(`/superadmin/clients/${data.clientLifecycle.id}`)} className="font-semibold text-emerald-700 hover:underline">Deschide client</a>
          </div>
        </Card>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-3">
        <ClientNavigatorSection title="Product usage" items={[['Apartamente', data.usage.apartments], ['Locatari', data.usage.residents], ['Staff', data.usage.staff], ['Facturi', data.usage.invoices], ['Plăți', data.usage.payments], ['Contoare', data.usage.meters], ['Solicitări', data.usage.requests], ['Data Quality open', data.usage.dataQualityOpenIssues]]} />
        <ClientNavigatorSection title="SaaS billing" items={[['Total issued', `${data.saasBilling.totalIssued.toFixed(2)} MDL`], ['Total paid', `${data.saasBilling.totalPaid.toFixed(2)} MDL`], ['Outstanding', `${data.saasBilling.outstandingBalance.toFixed(2)} MDL`], ['Overdue invoices', data.saasBilling.overdueInvoices]]} />
        <Card><h2 className="font-bold text-slate-950">Quick links</h2><div className="mt-3 grid gap-2">{data.quickLinks.map((link: any) => <a key={link.url} href={localizedPath(link.url)} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">{link.label}</a>)}</div></Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="font-bold text-slate-950">Support recent</h2><pre className="mt-3 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-white">{JSON.stringify(data.support.recentSessions, null, 2)}</pre></Card>
        <Card><h2 className="font-bold text-slate-950">Security & errors</h2><pre className="mt-3 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-white">{JSON.stringify(data.security, null, 2)}</pre></Card>
      </section>
    </div>
  );
}

function ClientNavigatorSection({ title, items }: { title: string; items: Array<[string, any]> }) {
  return <Card><h2 className="font-bold text-slate-950">{title}</h2><dl className="mt-3 space-y-2">{items.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="font-bold text-slate-950">{value}</dd></div>)}</dl></Card>;
}

function SuperadminSearchEmpty({ query }: { query?: string }) {
  return <div className="px-4 py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Search className="h-5 w-5" /></div><h2 className="mt-4 text-lg font-bold text-slate-950">{query?.trim() ? 'Nu am găsit rezultate.' : 'Caută un client, utilizator, abonament sau comandă.'}</h2><p className="mt-1 text-sm text-slate-500">{query?.trim() ? 'Încearcă alt termen sau verifică entitatea căutată.' : 'Rezultatele recente și comenzile rapide apar aici.'}</p></div>;
}

function badgeVariant(value: string) {
  const text = value.toUpperCase();
  if (text.includes('ACTIVE') || text.includes('PAID') || text.includes('READY')) return 'success';
  if (text.includes('CRITICAL') || text.includes('ERROR') || text.includes('FAILED') || text.includes('OVERDUE')) return 'error';
  if (text.includes('WARNING') || text.includes('DUE') || text.includes('NEW')) return 'warning';
  return 'neutral';
}

function iconFor(icon: string) {
  const key = icon.toLowerCase();
  const icons: Record<string, any> = {
    activity: Activity,
    archive: Archive,
    bug: Bug,
    building: Building2,
    'building-plus': Building2,
    clock: Clock,
    command: Command,
    'credit-card': CreditCard,
    'database-backup': DatabaseBackup,
    download: Download,
    'file-search': FileSearch,
    'file-text': FileText,
    'heart-pulse': HeartPulse,
    'help-circle': HelpCircle,
    inbox: Inbox,
    layers: Layers,
    'life-buoy': LifeBuoy,
    repeat: Repeat,
    rocket: Rocket,
    scale: Scale,
    search: Search,
    server: Server,
    shield: Shield,
    'triangle-alert': TriangleAlert,
    user: User,
    wallet: Wallet,
    ASSOCIATION: Building2,
    USER: User,
  };
  return icons[icon] || icons[key] || Search;
}
