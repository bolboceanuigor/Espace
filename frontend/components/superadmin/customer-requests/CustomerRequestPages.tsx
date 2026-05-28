'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { accessRequestsApi, customerRequestsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const statuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'ONBOARDING', 'CONVERTED', 'REJECTED'];
const statusLabels: Record<string, string> = {
  NEW: 'Noi',
  CONTACTED: 'Contactate',
  QUALIFIED: 'Calificate',
  IN_ONBOARDING: 'In onboarding',
  ONBOARDING: 'In onboarding',
  CONVERTED: 'Convertite',
  CLOSED: 'Respinse',
  REJECTED: 'Respinse',
  SPAM: 'Spam',
};
const priorityLabels: Record<string, string> = { LOW: 'Low', NORMAL: 'Normal', HIGH: 'High' };
const typeLabels: Record<string, string> = { APC: 'APC', ADMINISTRATOR: 'Administrator', PROPERTY_MANAGER: 'Property manager', OTHER: 'Altceva' };

function fmt(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ro-MD', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Badge({ value, tone = 'slate' }: { value: string; tone?: 'slate' | 'emerald' | 'amber' | 'red' }) {
  const classes = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes[tone]}`}>{value}</span>;
}

export function CustomerRequestsListPage({ kanban = false, statsOnly = false, basePath = '/superadmin/customer-requests', title = 'Cereri acces', subtitle = 'Proceseaza cererile primite de la APC-uri si administratori interesati de Espace.' }: { kanban?: boolean; statsOnly?: boolean; basePath?: string; title?: string; subtitle?: string }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>({ items: [], stats: {} });
  const [filters, setFilters] = useState({ search: '', status: '', city: '', type: '', priority: '' });
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const res = await accessRequestsApi.getSuperadminAccessRequests({
      search: filters.search || undefined,
      status: filters.status || undefined,
      city: filters.city || undefined,
      type: filters.type || undefined,
      priority: filters.priority || undefined,
    });
    setData(res.data || res);
    setLoading(false);
  }, [filters.city, filters.priority, filters.search, filters.status, filters.type]);
  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);

  const items = data.items || [];
  const stats = data.stats || {};
  if (statsOnly) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-5">
          <h1 className="text-2xl font-semibold text-slate-950">Statistici cereri acces</h1>
          <StatsGrid stats={stats} />
        </div>
      </main>
    );
  }
  if (kanban) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <Header title="Kanban cereri acces" subtitle="Urmareste cererile pe etape." basePath={basePath} />
          <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {statuses.filter((item) => item !== 'SPAM').map((column) => (
              <section key={column} className="rounded-lg border border-slate-200 bg-white p-3">
                <h2 className="text-sm font-semibold text-slate-950">{statusLabels[column]}</h2>
                <div className="mt-3 space-y-2">
                  {items.filter((item: any) => item.status === column).map((item: any) => (
                    <Link key={item.id} href={localizedPath(`${basePath}/${item.id}`)} className="block rounded-lg border border-slate-200 p-3 hover:border-emerald-300">
                      <p className="text-sm font-semibold text-slate-950">{item.associationName || item.legalName || item.fullName}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.fullName} · {item.phone}</p>
                    </Link>
                  ))}
                  {!items.filter((item: any) => item.status === column).length ? <p className="text-xs text-slate-400">Nu exista cereri in aceasta etapa.</p> : null}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <Header title={title} subtitle={subtitle} basePath={basePath} />
        <StatsGrid stats={stats} />
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-4 grid gap-2 md:grid-cols-[1fr_160px_170px_170px_150px_auto]">
            <input value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder="Cauta nume, telefon, email, asociatie..." className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
            <input value={filters.city} onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))} placeholder="Oras" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
            <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
              <option value="">Toate statusurile</option>
              {statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}
            </select>
            <select value={filters.type} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
              <option value="">Toate tipurile</option>
              {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={filters.priority} onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
              <option value="">Prioritate</option>
              {Object.keys(priorityLabels).map((item) => <option key={item} value={item}>{priorityLabels[item]}</option>)}
            </select>
            <button onClick={load} className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Filtreaza</button>
          </div>
          {loading ? <p className="p-4 text-sm text-slate-500">Se incarca cererile...</p> : null}
          {!loading && !items.length ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
              <h2 className="font-semibold text-slate-950">Nu exista cereri de acces inca.</h2>
              <p className="mt-1 text-sm text-slate-500">Cand cineva completeaza formularul Cere acces, cererea va aparea aici.</p>
            </div>
          ) : null}
          {items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Data</th><th>Contact</th><th>Telefon</th><th>Oras</th><th>Tip</th><th>Asociatie</th><th>Apartamente</th><th>Status</th><th>Prioritate</th><th>Actiuni</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="p-3">{fmt(item.createdAt)}</td>
                      <td className="font-medium text-slate-950">{item.fullName}</td>
                      <td>{item.phone}</td>
                      <td>{item.city || '-'}</td>
                      <td>{typeLabels[item.type] || item.type || '-'}</td>
                      <td>{item.associationName || item.legalName || '-'}</td>
                      <td>{item.apartmentsCount || '-'}</td>
                      <td><Badge value={statusLabels[item.status] || item.status} tone={item.status === 'NEW' ? 'amber' : item.status === 'CONVERTED' ? 'emerald' : 'slate'} /></td>
                      <td><Badge value={priorityLabels[item.priority] || item.priority} tone={item.priority === 'HIGH' ? 'red' : 'slate'} /></td>
                      <td><Link href={localizedPath(`${basePath}/${item.id}`)} className="text-emerald-700 hover:underline">Deschide</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Header({ title, subtitle, basePath }: { title: string; subtitle: string; basePath: string }) {
  const localizedPath = useLocalizedPath();
  return (
    <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 md:flex-row md:items-center md:justify-between">
      <div><h1 className="text-2xl font-semibold text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>
      <div className="flex gap-2"><Link href={localizedPath(`${basePath}/kanban`)} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Kanban</Link><Link href={localizedPath('/superadmin/customer-requests/stats')} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Stats</Link></div>
    </header>
  );
}

function StatsGrid({ stats }: { stats: any }) {
  const cards = [
    ['Noi', stats.NEW || 0],
    ['Contactate', stats.CONTACTED || 0],
    ['Calificate', stats.QUALIFIED || 0],
    ['In onboarding', (stats.ONBOARDING || 0) + (stats.IN_ONBOARDING || 0)],
    ['Convertite', stats.CONVERTED || 0],
    ['Respinse', (stats.REJECTED || 0) + (stats.CLOSED || 0)],
    ['Cereri luna curenta', stats.currentMonth || 0],
    ['Ultima cerere', fmt(stats.lastRequestAt)],
  ];
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div key={label as string} className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>)}</div>;
}

export function CustomerRequestDetailsPage({ basePath = '/superadmin/customer-requests' }: { basePath?: string }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const [item, setItem] = useState<any>(null);
  const [internalNote, setInternalNote] = useState('');
  const load = useCallback(async () => {
    const response = await accessRequestsApi.getSuperadminAccessRequest(params.id);
    const next = response.data;
    setItem(next);
    setInternalNote(next?.internalNotes || '');
  }, [params.id]);
  useEffect(() => { if (params.id) load().catch(() => {}); }, [params.id, load]);
  if (!item) return <main className="min-h-screen bg-slate-50 p-6 text-sm text-slate-500">Se incarca cererea...</main>;
  const update = async (payload: Record<string, unknown>) => { await accessRequestsApi.updateSuperadminAccessRequest(item.id, payload); await load(); };
  const updateStatus = async (status: string) => update({ status });
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href={localizedPath(basePath)} className="text-sm font-medium text-emerald-700 hover:underline">Inapoi la cereri</Link>
        <header className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h1 className="text-2xl font-semibold text-slate-950">{item.associationName || item.legalName || 'Cerere acces'}</h1><p className="mt-1 text-sm text-slate-500">{item.fullName} · {item.phone} · {item.email || 'email necompletat'}</p></div>
            <Badge value={statusLabels[item.status] || item.status} />
          </div>
          {item.possibleDuplicate ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Posibil duplicat: exista o cerere similara in ultimele 30 zile pentru acelasi contact si oras/adresa.
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => updateStatus('CONTACTED')} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Marcheaza contactat</button>
            <button onClick={() => updateStatus('ONBOARDING')} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Muta in onboarding</button>
            <button onClick={() => updateStatus('REJECTED')} className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700">Respinge</button>
            <button onClick={async () => { await customerRequestsApi.superadminConvert(item.id); router.refresh(); }} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Convertește în asociatie</button>
          </div>
        </header>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Procesare CRM</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select value={item.status} onChange={(event) => update({ status: event.target.value })} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
              {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
            <select value={item.priority} onChange={(event) => update({ priority: event.target.value })} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
              {Object.keys(priorityLabels).map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
            </select>
            <button onClick={() => update({ status: 'CONTACTED', lastContactedAt: new Date().toISOString() })} className="h-10 rounded-md border border-slate-200 px-3 text-sm">Actualizeaza ultimul contact</button>
          </div>
          <p className="mt-3 text-sm text-slate-500">Ultimul contact: {item.lastContactedAt ? new Date(item.lastContactedAt).toLocaleString('ro-MD') : '-'}</p>
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          <Info title="Date contact" rows={[['Nume', item.fullName], ['Telefon', item.phone], ['Email', item.email || '-'], ['Oras', item.city || '-'], ['Rol', item.contactRole || item.role || '-']]} />
          <Info title="Date APC/asociatie" rows={[['Tip solicitant', typeLabels[item.type] || item.type || '-'], ['Asociatie', item.associationName || '-'], ['Nume legal', item.legalName || '-'], ['Cod APC', item.apcCode || item.associationCode || '-'], ['Adresa', item.address || '-'], ['Blocuri', item.blocksCount || '-'], ['Apartamente', item.apartmentsCount || '-']]} />
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Mesaj</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{item.message || 'Fara mesaj.'}</p>
          {item.possibleDuplicates?.length ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-950">Cereri similare</h3>
              <div className="mt-2 space-y-2">{item.possibleDuplicates.map((duplicate: any) => <Link key={duplicate.id} href={localizedPath(`${basePath}/${duplicate.id}`)} className="block rounded-md border border-slate-200 p-3 text-sm text-slate-700 hover:border-amber-300">{duplicate.fullName} · {duplicate.phone} · {fmt(duplicate.createdAt)}</Link>)}</div>
            </div>
          ) : null}
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Note interne</h2>
          <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} placeholder="Note interne pentru follow-up, calificare sau onboarding..." className="mt-3 min-h-36 w-full rounded-md border border-slate-200 p-3 text-sm text-slate-700" />
          <button onClick={() => update({ internalNote })} className="mt-3 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Salveaza note</button>
        </section>
      </div>
    </main>
  );
}

function Info({ title, rows }: { title: string; rows: Array<[string, any]> }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">{title}</h2><dl className="mt-4 space-y-3">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 text-sm"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-slate-900">{value}</dd></div>)}</dl></section>;
}
