'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bookmark,
  Calculator,
  Clock,
  Command,
  Download,
  FileText,
  Gauge,
  HelpCircle,
  Home,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Megaphone,
  MessageSquare,
  Receipt,
  Search,
  ShieldAlert,
  Sparkles,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import { adminSearchApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';
import { Badge, Button, Card, PageHeader } from '@/components/ui';

export type AdminSearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  status?: string;
  url: string;
  icon?: string;
  score?: number;
  metadata?: Record<string, any>;
};

type SearchGroup = {
  type: string;
  label: string;
  items: AdminSearchResult[];
};

const RECENT_KEY = 'espace.admin.recentSearchItems';

export function AdminGlobalSearchInput({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hidden w-full max-w-sm items-center rounded-2xl border border-slate-200 bg-white px-3 text-left shadow-sm transition hover:border-slate-300 md:flex"
    >
      <Search className="h-4 w-4 text-slate-400" />
      <span className="h-10 min-w-0 flex-1 px-3 pt-2.5 text-sm text-slate-400">Caută în asociație...</span>
      <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400">⌘K</kbd>
    </button>
  );
}

export function AdminCommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [recentLocal, setRecentLocal] = useState<AdminSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const flatItems = useMemo(() => groups.flatMap((group) => group.items.map((item) => ({ ...item, groupLabel: group.label }))), [groups]);

  const load = useCallback(async (value: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await adminSearchApi.search({ q: value, includeCommands: true, includeRecent: true });
      setGroups(res.data?.groups || []);
      setActiveIndex(0);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut căuta acum. Încearcă din nou.'));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const openItem = useCallback(async (item: AdminSearchResult) => {
    const url = localizedPath(item.url || '/admin/search');
    const nextRecent = [item, ...recentLocal.filter((recent) => recent.url !== item.url)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent));
    setRecentLocal(nextRecent);
    await adminSearchApi.saveRecent({
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
      if (!open || isTyping && target !== inputRef.current) return;
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
    <div className="fixed inset-0 z-[90] bg-slate-950/35 p-0 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl md:max-h-[82vh] md:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Caută apartamente, locatari, facturi, plăți..."
            className="h-11 min-w-0 flex-1 bg-transparent text-base font-medium text-slate-950 outline-none placeholder:text-slate-400"
          />
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          <button type="button" onClick={() => onOpenChange(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Închide">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
          {!query.trim() && recentLocal.length ? (
            <SearchResultGroup label="Deschise recent" items={recentLocal} activeIndex={activeIndex} offset={0} onSelect={openItem} />
          ) : null}
          {groups.length ? groups.map((group, groupIndex) => {
            const offset = groups.slice(0, groupIndex).reduce((sum, item) => sum + item.items.length, 0);
            return <SearchResultGroup key={`${group.type}-${group.label}`} label={group.label} items={group.items} activeIndex={activeIndex} offset={offset} onSelect={openItem} />;
          }) : null}
          {!loading && !groups.length && !error ? (
            <SearchEmptyState query={query} />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-xs font-semibold text-slate-500">
          <span>Enter pentru deschidere · Esc pentru închidere</span>
          <span className="inline-flex items-center gap-1"><Command className="h-3.5 w-3.5" /> Cmd/Ctrl + K</span>
        </div>
      </div>
    </div>
  );
}

export function SearchResultGroup({ label, items, activeIndex, offset, onSelect }: { label: string; items: AdminSearchResult[]; activeIndex?: number; offset?: number; onSelect: (item: AdminSearchResult) => void }) {
  if (!items.length) return null;
  return (
    <section className="mb-4">
      <h3 className="px-2 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</h3>
      <div className="space-y-1">
        {items.map((item, index) => (
          <SearchResultItem key={`${item.type}-${item.id}-${item.url}`} item={item} active={(offset || 0) + index === activeIndex} onSelect={() => onSelect(item)} />
        ))}
      </div>
    </section>
  );
}

export function SearchResultItem({ item, active, onSelect }: { item: AdminSearchResult; active?: boolean; onSelect: () => void }) {
  const Icon = iconFor(item.icon || item.type);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${active ? 'bg-slate-950 text-white' : 'hover:bg-slate-100'}`}
    >
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-white/10' : 'bg-slate-100 text-slate-600'}`}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{item.title}</span>
        <span className={`block truncate text-xs ${active ? 'text-white/70' : 'text-slate-500'}`}>{item.subtitle || item.description || item.url}</span>
      </span>
      {item.badge ? <Badge variant={item.badge.includes('Fara') ? 'warning' : 'neutral'}>{item.badge}</Badge> : null}
      <ArrowRight className={`h-4 w-4 ${active ? 'text-white/70' : 'text-slate-300'}`} />
    </button>
  );
}

export function SearchEmptyState({ query }: { query?: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Search className="h-5 w-5" /></div>
      <h2 className="mt-4 text-lg font-bold text-slate-950">{query?.trim() ? 'Nu am găsit rezultate' : 'Ce cauți?'}</h2>
      <p className="mt-1 text-sm text-slate-500">{query?.trim() ? 'Încearcă alt termen sau verifică filtrele.' : 'Caută apartamente, locatari, facturi, plăți sau folosește o comandă rapidă.'}</p>
    </div>
  );
}

export function AdminSearchPage() {
  const localizedPath = useLocalizedPath();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminSearchApi.search({ q: query, includeCommands: true, includeRecent: true, limitPerType: 10 });
      setGroups(res.data?.groups || []);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  async function openItem(item: AdminSearchResult) {
    await adminSearchApi.saveRecent({ query, selectedResultType: item.type, selectedResultId: item.id, selectedResultTitle: item.title, selectedUrl: item.url }).catch(() => undefined);
    router.push(localizedPath(item.url));
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Căutare" description="Caută rapid în datele asociației și în comenzile Admin." />
      <Card className="flex items-center gap-3 p-3">
        <Search className="h-5 w-5 text-slate-400" />
        <input className="h-12 flex-1 bg-transparent text-base outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută în Espace..." />
        <Button onClick={load} isLoading={loading}>Caută</Button>
      </Card>
      {groups.map((group, index) => <SearchResultGroup key={group.label} label={group.label} items={group.items} activeIndex={-1} offset={index * 1000} onSelect={openItem} />)}
      {!groups.length && !loading ? <SearchEmptyState query={query} /> : null}
    </div>
  );
}

export function AdminCommandsPage() {
  const localizedPath = useLocalizedPath();
  const [groups, setGroups] = useState<Array<{ label: string; items: any[] }>>([]);
  useEffect(() => { adminSearchApi.commands().then((res) => setGroups(res.data?.groups || [])).catch(() => setGroups([])); }, []);
  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Comenzi rapide" description="Navigare și acțiuni sigure disponibile pentru rolul tău." />
      {groups.map((group) => (
        <section key={group.label} className="space-y-3">
          <h2 className="text-lg font-bold text-slate-950">{group.label}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => {
              const Icon = iconFor(item.icon);
              return (
                <Card key={item.key} className={item.disabled ? 'opacity-60' : ''}>
                  <Icon className="h-5 w-5 text-slate-500" />
                  <h3 className="mt-3 font-bold text-slate-950">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{item.disabled ? item.disabledReason : item.subtitle}</p>
                  <a className="mt-4 inline-flex min-h-10 items-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white aria-disabled:pointer-events-none aria-disabled:opacity-50" href={localizedPath(item.url)} aria-disabled={item.disabled}>Deschide</a>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function RecentSearchesPage() {
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => {
    const res = await adminSearchApi.recent();
    setItems(res.data?.items || []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Căutări recente" description="Istoric personal pentru asociația curentă." rightSlot={<Button variant="secondary" onClick={async () => { await adminSearchApi.clearRecent(); await load(); }}>Curăță istoricul</Button>} />
      <Card className="divide-y divide-slate-100 p-0">
        {items.length ? items.map((item) => (
          <a key={item.id} href={item.selectedUrl || '/admin/search'} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-slate-50">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{item.selectedResultTitle || item.query}</span><span className="block text-xs text-slate-500">{item.query || item.selectedResultType}</span></span>
          </a>
        )) : <SearchEmptyState />}
      </Card>
    </div>
  );
}

function iconFor(icon: string) {
  const key = icon.toLowerCase();
  const icons: Record<string, any> = {
    activity: Activity,
    apartment: Home,
    'bar-chart': BarChart3,
    bookmark: Bookmark,
    calculator: Calculator,
    clock: Clock,
    command: Command,
    download: Download,
    'file-text': FileText,
    gauge: Gauge,
    help: HelpCircle,
    'help-circle': HelpCircle,
    home: Home,
    'layout-dashboard': LayoutDashboard,
    'list-checks': ListChecks,
    megaphone: Megaphone,
    'message-square': MessageSquare,
    'message-square-plus': MessageSquare,
    receipt: Receipt,
    search: Search,
    'shield-alert': ShieldAlert,
    'shield-check': ShieldAlert,
    sparkles: Sparkles,
    upload: Upload,
    user: User,
    'user-plus': User,
    users: Users,
    'users-round': Users,
    APARTMENT: Home,
    RESIDENT: User,
  };
  return icons[icon] || icons[key] || Search;
}
