'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Star } from 'lucide-react';
import { Badge, Button, Card, PageHeader, StatCard } from '@/components/ui';
import { savedViewsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';
import { FilterSummaryChips, SmartListCard } from './SavedViewsComponents';

type SmartListItem = {
  key: string;
  module: string;
  name: string;
  description?: string;
  filters: Record<string, any>;
  severity?: string;
  actionHint?: string;
  count?: number;
};

export function SavedViewsPage() {
  const localizedPath = useLocalizedPath();
  const [items, setItems] = useState<any[]>([]);
  const [module, setModule] = useState('');
  const [scope, setScope] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await savedViewsApi.list({ module, scope });
      setItems(res.data?.items || []);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca view-urile.'));
    } finally {
      setLoading(false);
    }
  }, [module, scope]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="View-uri salvate" description="Gestionează filtrele salvate și listele favorite pentru asociație." rightSlot={<Button variant="secondary" onClick={load} isLoading={loading}><RefreshCw className="h-4 w-4" />Actualizează</Button>} />
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      <section className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={items.length} />
        <StatCard label="Favorite" value={items.filter((item) => item.isFavorite).length} tone="success" />
        <StatCard label="Team" value={items.filter((item) => item.scope === 'TEAM').length} />
        <StatCard label="Default" value={items.filter((item) => item.isDefault).length} />
      </section>
      <Card className="grid gap-3 md:grid-cols-3">
        <select className="select" value={module} onChange={(event) => setModule(event.target.value)}>
          <option value="">Toate modulele</option>
          {MODULES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="select" value={scope} onChange={(event) => setScope(event.target.value)}>
          <option value="">Toate scope-urile</option>
          <option value="PERSONAL">Personal</option>
          <option value="TEAM">Team</option>
          <option value="SYSTEM">System</option>
        </select>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 text-sm font-semibold" href={localizedPath('/admin/smart-lists')}>Vezi smart lists</Link>
      </Card>
      <Card className="overflow-hidden p-0">
        {items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Nume</th><th className="px-4 py-3">Modul</th><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Default</th><th className="px-4 py-3">Favorite</th><th className="px-4 py-3">Folosit</th><th className="px-4 py-3">Ultima folosire</th><th className="px-4 py-3">Acțiuni</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-semibold">{item.name}</td>
                    <td className="px-4 py-3">{item.module}</td>
                    <td className="px-4 py-3"><Badge variant="neutral">{item.scope}</Badge></td>
                    <td className="px-4 py-3">{item.isDefault ? 'Da' : '—'}</td>
                    <td className="px-4 py-3">{item.isFavorite ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> : '—'}</td>
                    <td className="px-4 py-3">{item.usageCount || 0}</td>
                    <td className="px-4 py-3">{formatDate(item.lastUsedAt)}</td>
                    <td className="px-4 py-3"><Link className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold" href={localizedPath(`/admin/saved-views/${item.id}`)}>Deschide</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="Nu ai view-uri salvate." text="Salvează filtrele curente din listele Admin pentru a le accesa rapid." />}
      </Card>
    </div>
  );
}

export function SavedViewDetailPage({ id }: { id: string }) {
  const localizedPath = useLocalizedPath();
  const [item, setItem] = useState<any>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await savedViewsApi.get(id);
      setItem(res.data?.item || res.data);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca view-ul.'));
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function run(action: 'favorite' | 'default' | 'duplicate' | 'archive') {
    if (!item) return;
    if (action === 'favorite') await savedViewsApi.favorite(item.id, !item.isFavorite);
    if (action === 'default') await savedViewsApi.setDefault(item.id);
    if (action === 'duplicate') await savedViewsApi.duplicate(item.id);
    if (action === 'archive') await savedViewsApi.archive(item.id);
    await load();
  }

  const applyUrl = item ? moduleUrl(item.module, item.filters) : '/admin';
  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Saved View" description="Detalii, filtre și acțiuni pentru view-ul salvat." rightSlot={<Link className="inline-flex min-h-10 items-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold" href={localizedPath('/admin/saved-views')}>Înapoi</Link>} />
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {item ? (
        <>
          <section className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Modul" value={item.module} />
            <StatCard label="Scope" value={item.scope} />
            <StatCard label="Folosiri" value={item.usageCount || 0} />
            <StatCard label="Status" value={item.status} />
          </section>
          <Card>
            <h2 className="text-2xl font-bold text-slate-950">{item.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{item.description || 'Fără descriere.'}</p>
            <div className="mt-4"><FilterSummaryChips filters={item.filters || {}} /></div>
            <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-white">{JSON.stringify({ filters: item.filters, sort: item.sort, columns: item.columns }, null, 2)}</pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="inline-flex min-h-10 items-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white" href={localizedPath(applyUrl)}>Aplică view</Link>
              <Button variant="secondary" onClick={() => run('favorite')}>{item.isFavorite ? 'Scoate favorite' : 'Favorite'}</Button>
              <Button variant="secondary" onClick={() => run('default')}>Set default</Button>
              <Button variant="secondary" onClick={() => run('duplicate')}>Duplicate</Button>
              <Button variant="secondary" onClick={() => run('archive')}>Archive</Button>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

export function SmartListsPage() {
  const [items, setItems] = useState<SmartListItem[]>([]);
  const [module, setModule] = useState('');
  const localizedPath = useLocalizedPath();

  const load = useCallback(async () => {
    const res = await savedViewsApi.smartLists({ module });
    setItems((res.data?.items || []) as SmartListItem[]);
  }, [module]);

  useEffect(() => { void load(); }, [load]);
  const grouped = useMemo<Record<string, SmartListItem[]>>(() => {
    return items.reduce<Record<string, SmartListItem[]>>((acc, item) => {
      acc[item.module] = [...(acc[item.module] || []), item];
      return acc;
    }, {});
  }, [items]);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Liste inteligente" description="Accesează rapid datele care necesită atenție." rightSlot={<Link className="inline-flex min-h-10 items-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold" href={localizedPath('/admin/saved-views')}>View-uri salvate</Link>} />
      <Card><select className="select max-w-sm" value={module} onChange={(event) => setModule(event.target.value)}><option value="">Toate modulele</option>{MODULES.map((item) => <option key={item} value={item}>{item}</option>)}</select></Card>
      {Object.entries(grouped).map(([group, list]) => (
        <section key={group} className="space-y-3">
          <h2 className="text-lg font-bold text-slate-950">{group}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((item) => <SmartListCard key={item.key} item={item} onApply={() => { window.location.href = localizedPath(moduleUrl(item.module, item.filters)); }} onDuplicate={async () => { await savedViewsApi.duplicateSmartList(item.key); await load(); }} />)}
          </div>
        </section>
      ))}
      {!items.length ? <Empty title="Nu există liste inteligente pentru acest modul." text="Alege alt modul sau revino după ce există date." /> : null}
    </div>
  );
}

export function SmartListDetailPage({ smartKey }: { smartKey: string }) {
  const [data, setData] = useState<any>(null);
  const localizedPath = useLocalizedPath();
  useEffect(() => { savedViewsApi.smartList(smartKey).then((res) => setData(res.data)).catch(() => setData(null)); }, [smartKey]);
  const item = data?.smartList;
  return (
    <div className="space-y-5 pb-8">
      <PageHeader title={item?.name || 'Smart list'} description={item?.description || 'Listă inteligentă generată de sistem.'} />
      {item ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Modul" value={item.module} />
            <StatCard label="Rezultate" value={data.count || 0} tone={data.count ? 'warning' : 'success'} />
            <StatCard label="Severitate" value={item.severity} />
          </section>
          <Card>
            <FilterSummaryChips filters={item.filters || {}} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="inline-flex min-h-10 items-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white" href={localizedPath(moduleUrl(item.module, item.filters))}>Aplică filtre</Link>
              <Button variant="secondary" onClick={async () => savedViewsApi.duplicateSmartList(item.key)}>Salvează ca view</Button>
            </div>
          </Card>
          <Card>
            <h2 className="font-bold text-slate-950">Preview</h2>
            <pre className="mt-3 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-white">{JSON.stringify(data.previewItems || [], null, 2)}</pre>
          </Card>
        </>
      ) : <Empty title="Lista inteligentă nu a fost găsită." text="Verifică cheia sau revino la Smart Lists." />}
    </div>
  );
}

const MODULES = ['APARTMENTS', 'RESIDENTS', 'INVOICES', 'PAYMENTS', 'METERS', 'METER_READINGS', 'REQUESTS', 'ANNOUNCEMENTS', 'DATA_QUALITY', 'AUDIT_LOG', 'IMPORTS', 'EXPORTS', 'FINANCIAL_REPORTS'];

function moduleUrl(module: string, filters: Record<string, any>) {
  const base: Record<string, string> = {
    APARTMENTS: '/admin/apartments',
    RESIDENTS: '/admin/residents',
    INVOICES: '/admin/invoices',
    PAYMENTS: '/admin/payments',
    METERS: '/admin/meters',
    METER_READINGS: '/admin/meter-readings',
    REQUESTS: '/admin/requests',
    ANNOUNCEMENTS: '/admin/announcements',
    DATA_QUALITY: '/admin/data-quality/issues',
    IMPORTS: '/admin/imports',
    EXPORTS: '/admin/data-exports',
    FINANCIAL_REPORTS: '/admin/reports/financial',
  };
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return `${base[module] || '/admin'}${qs ? `?${qs}` : ''}`;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <Card className="p-10 text-center"><h2 className="text-lg font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{text}</p></Card>;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ro-MD', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
