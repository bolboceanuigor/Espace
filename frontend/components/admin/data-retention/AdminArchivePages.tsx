'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Archive, FileLock2, RotateCcw, ShieldAlert } from 'lucide-react';
import { dataRetentionApi } from '@/lib/api';

function Badge({ value }: { value?: string | boolean }) {
  const text = String(value ?? 'UNKNOWN');
  const color = text === 'ARCHIVED' || text.includes('ARCHIVE')
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : text === 'RESTORED' || text === 'false'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : text === 'true'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${color}`}>{text}</span>;
}

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="text-sm font-semibold text-emerald-700">Admin</p>
          <h1 className="text-3xl font-bold text-slate-950">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </div>
        <nav className="mb-6 flex flex-wrap gap-2 text-sm">
          {[
            ['/ro/admin/archive', 'Archive Center'],
            ['/ro/admin/archive/apartments', 'Apartamente'],
            ['/ro/admin/archive/residents', 'Locatari'],
            ['/ro/admin/archive/requests', 'Solicitări'],
            ['/ro/admin/archive/announcements', 'Anunțuri'],
            ['/ro/admin/archive/meters', 'Contoare'],
            ['/ro/admin/settings/data-retention', 'Politici'],
          ].map(([href, label]) => <Link key={href} href={href} className="rounded-md border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700">{label}</Link>)}
        </nav>
        {children}
      </div>
    </main>
  );
}

export function AdminArchivePage({ entityType }: { entityType?: string }) {
  const [data, setData] = useState<any>(null);
  const load = useCallback(() => dataRetentionApi.adminArchive(entityType ? { entityType } : undefined).then((res) => setData(res.data)), [entityType]);
  useEffect(() => { load(); }, [load]);
  return (
    <Shell title="Archive Center" subtitle="Arhivări logice pentru asociația ta. Datele rămân păstrate în istoric.">
      <section className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Resursele arhivate sunt ascunse din listele active, dar nu sunt șterse definitiv. Pentru cereri speciale de ștergere/anonymizare, contactează Espace/Superadmin.
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-950">Date arhivate</h2>
        <div className="mt-4"><ArchiveTable items={data?.items || []} onChange={load} /></div>
      </section>
    </Shell>
  );
}

export function AdminDataRetentionSettingsPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { dataRetentionApi.adminSettings().then((res) => setData(res.data)); }, []);
  if (!data) return <Shell title="Data retention" subtitle="Se încarcă politicile."><div className="h-32 animate-pulse rounded-lg bg-white" /></Shell>;
  return (
    <Shell title="Data retention" subtitle="Ce date sunt păstrate, ce poate fi arhivat și ce nu poate fi șters definitiv.">
      <section className="grid gap-4 md:grid-cols-3">
        <Kpi title="Politici disponibile" value={data.policies?.length || 0} icon={FileLock2} />
        <Kpi title="Arhivări asociație" value={data.archiveCount || 0} icon={Archive} />
        <Kpi title="Hard delete" value="Blocat" icon={ShieldAlert} />
      </section>
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-950">Politici Admin</h2>
        <div className="mt-4 grid gap-3">
          {(data.policies || []).map((policy: any) => (
            <div key={policy.id} className="rounded-md border border-slate-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><b>{policy.title}</b><p className="text-sm text-slate-500">{policy.description}</p></div>
                <div className="flex gap-2"><Badge value={policy.retentionAction} /><Badge value={`hardDelete=${policy.hardDeleteAllowed}`} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}

function Kpi({ title, value, icon: Icon }: { title: string; value: ReactNode; icon: any }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{title}</p><Icon className="h-5 w-5 text-emerald-600" /></div><div className="mt-3 text-2xl font-bold text-slate-950">{value}</div></div>;
}

function ArchiveTable({ items, onChange }: { items: any[]; onChange: () => void }) {
  if (!items.length) return <p className="text-sm text-slate-500">Nu există date arhivate.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500"><tr><th className="p-2">Entitate</th><th className="p-2">Status</th><th className="p-2">Motiv</th><th className="p-2">Data</th><th className="p-2">Acțiuni</th></tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-slate-100">
              <td className="p-2 font-semibold">{item.entityDisplayName || item.entityId}<p className="text-xs text-slate-500">{item.entityType}</p></td>
              <td className="p-2"><Badge value={item.status} /></td>
              <td className="p-2 text-slate-600">{item.archiveReason}</td>
              <td className="p-2">{item.archivedAt ? new Date(item.archivedAt).toLocaleDateString('ro-RO') : '-'}</td>
              <td className="p-2">{item.canRestore && <button onClick={() => { const reason = window.prompt('Motiv restaurare'); if (reason) dataRetentionApi.adminRestoreArchive(item.id, { reason }).then(onChange); }} className="inline-flex items-center gap-1 font-semibold text-emerald-700"><RotateCcw className="h-3 w-3" /> Restore</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
