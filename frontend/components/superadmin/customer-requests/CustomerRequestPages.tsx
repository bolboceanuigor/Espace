'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { customerRequestsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const statuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'IN_ONBOARDING', 'CONVERTED', 'CLOSED', 'SPAM'];
const statusLabels: Record<string, string> = {
  NEW: 'Noi',
  CONTACTED: 'Contactate',
  QUALIFIED: 'Calificate',
  IN_ONBOARDING: 'In onboarding',
  CONVERTED: 'Convertite',
  CLOSED: 'Inchise',
  SPAM: 'Spam',
};
const priorityLabels: Record<string, string> = { LOW: 'Low', NORMAL: 'Normal', HIGH: 'High' };

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

export function CustomerRequestsListPage({ kanban = false, statsOnly = false }: { kanban?: boolean; statsOnly?: boolean }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>({ items: [], stats: {} });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const res = await customerRequestsApi.superadminList({ search: search || undefined, status: status || undefined });
    setData(res.data || res);
    setLoading(false);
  };
  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  const items = data.items || [];
  const stats = data.stats || {};
  if (statsOnly) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-5">
          <h1 className="text-2xl font-semibold text-slate-950">Statistici cereri clienti</h1>
          <StatsGrid stats={stats} />
        </div>
      </main>
    );
  }
  if (kanban) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <Header title="Kanban cereri clienti" subtitle="Urmareste cererile pe etape." />
          <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {statuses.filter((item) => item !== 'SPAM').map((column) => (
              <section key={column} className="rounded-lg border border-slate-200 bg-white p-3">
                <h2 className="text-sm font-semibold text-slate-950">{statusLabels[column]}</h2>
                <div className="mt-3 space-y-2">
                  {items.filter((item: any) => item.status === column).map((item: any) => (
                    <Link key={item.id} href={localizedPath(`/superadmin/customer-requests/${item.id}`)} className="block rounded-lg border border-slate-200 p-3 hover:border-emerald-300">
                      <p className="text-sm font-semibold text-slate-950">{item.associationName}</p>
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
        <Header title="Cereri clienti" subtitle="Proceseaza cererile primite de la asociatii interesate de Espace." />
        <StatsGrid stats={stats} />
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-4 grid gap-2 md:grid-cols-[1fr_220px_auto]">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cauta nume, telefon, email, asociatie..." className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
              <option value="">Toate statusurile</option>
              {statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}
            </select>
            <button onClick={load} className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Filtreaza</button>
          </div>
          {loading ? <p className="p-4 text-sm text-slate-500">Se incarca cererile...</p> : null}
          {!loading && !items.length ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
              <h2 className="font-semibold text-slate-950">Nu exista cereri clienti</h2>
              <p className="mt-1 text-sm text-slate-500">Cererile trimise prin website vor aparea aici.</p>
            </div>
          ) : null}
          {items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Data</th><th>Persoana</th><th>Telefon</th><th>Email</th><th>Asociatie</th><th>Apartamente</th><th>Status</th><th>Prioritate</th><th>Sursa</th><th>Actiuni</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="p-3">{fmt(item.createdAt)}</td>
                      <td className="font-medium text-slate-950">{item.fullName}</td>
                      <td>{item.phone}</td>
                      <td>{item.email || '-'}</td>
                      <td>{item.associationName}</td>
                      <td>{item.apartmentsCount || '-'}</td>
                      <td><Badge value={statusLabels[item.status] || item.status} tone={item.status === 'NEW' ? 'amber' : item.status === 'CONVERTED' ? 'emerald' : 'slate'} /></td>
                      <td><Badge value={priorityLabels[item.priority] || item.priority} tone={item.priority === 'HIGH' ? 'red' : 'slate'} /></td>
                      <td>{item.source}</td>
                      <td><Link href={localizedPath(`/superadmin/customer-requests/${item.id}`)} className="text-emerald-700 hover:underline">Deschide</Link></td>
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

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  const localizedPath = useLocalizedPath();
  return (
    <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 md:flex-row md:items-center md:justify-between">
      <div><h1 className="text-2xl font-semibold text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>
      <div className="flex gap-2"><Link href={localizedPath('/superadmin/customer-requests/kanban')} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Kanban</Link><Link href={localizedPath('/superadmin/customer-requests/stats')} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Stats</Link></div>
    </header>
  );
}

function StatsGrid({ stats }: { stats: any }) {
  const cards = [
    ['Noi', stats.NEW || 0],
    ['Contactate', stats.CONTACTED || 0],
    ['Calificate', stats.QUALIFIED || 0],
    ['In onboarding', stats.IN_ONBOARDING || 0],
    ['Convertite', stats.CONVERTED || 0],
    ['Inchise', stats.CLOSED || 0],
    ['Cereri luna curenta', stats.currentMonth || 0],
    ['Ultima cerere', fmt(stats.lastRequestAt)],
  ];
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div key={label as string} className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>)}</div>;
}

export function CustomerRequestDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const [item, setItem] = useState<any>(null);
  const [note, setNote] = useState('');
  const load = async () => setItem((await customerRequestsApi.superadminGet(params.id)).data);
  useEffect(() => { if (params.id) load().catch(() => {}); }, [params.id]);
  if (!item) return <main className="min-h-screen bg-slate-50 p-6 text-sm text-slate-500">Se incarca cererea...</main>;
  const updateStatus = async (status: string) => { await customerRequestsApi.superadminStatus(item.id, { status }); await load(); };
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href={localizedPath('/superadmin/customer-requests')} className="text-sm font-medium text-emerald-700 hover:underline">Inapoi la cereri</Link>
        <header className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h1 className="text-2xl font-semibold text-slate-950">{item.associationName}</h1><p className="mt-1 text-sm text-slate-500">{item.fullName} · {item.phone} · {item.email || 'email necompletat'}</p></div>
            <Badge value={statusLabels[item.status] || item.status} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => updateStatus('CONTACTED')} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Marcheaza contactat</button>
            <button onClick={() => updateStatus('QUALIFIED')} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Califica</button>
            <button onClick={() => updateStatus('IN_ONBOARDING')} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Incepe onboarding</button>
            <button onClick={() => updateStatus('CLOSED')} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Inchide</button>
            <button onClick={() => updateStatus('SPAM')} className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700">Spam</button>
            <button onClick={async () => { await customerRequestsApi.superadminConvert(item.id); router.refresh(); }} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Convertește în asociatie</button>
          </div>
        </header>
        <section className="grid gap-4 md:grid-cols-2">
          <Info title="Date contact" rows={[['Nume', item.fullName], ['Telefon', item.phone], ['Email', item.email || '-'], ['Metoda preferata', item.preferredContactMethod || '-'], ['Rol', item.role || '-']]} />
          <Info title="Date asociatie" rows={[['Asociatie', item.associationName], ['Cod', item.associationCode || '-'], ['Adresa', item.address || '-'], ['Apartamente', item.apartmentsCount || '-'], ['Administrare curenta', item.currentManagementMethod || '-']]} />
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Mesaj si module interes</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{item.message || 'Fara mesaj.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">{(item.interestedModules || []).map((mod: string) => <span key={mod} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{mod}</span>)}</div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Note interne</h2>
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{item.internalNotes || 'Nu exista note.'}</pre>
          <div className="mt-3 flex gap-2"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Adauga nota..." className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm" /><button onClick={async () => { if (!note.trim()) return; await customerRequestsApi.superadminNote(item.id, note); setNote(''); await load(); }} className="rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Adauga</button></div>
        </section>
      </div>
    </main>
  );
}

function Info({ title, rows }: { title: string; rows: Array<[string, any]> }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">{title}</h2><dl className="mt-4 space-y-3">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 text-sm"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-slate-900">{value}</dd></div>)}</dl></section>;
}
