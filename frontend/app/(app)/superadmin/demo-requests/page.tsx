'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { demoRequestsApi } from '@/lib/api';

const STATUSES = ['NEW', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;

export default function SuperadminDemoRequestsPage() {
  const params = useParams<{ locale?: string }>();
  const locale = typeof params?.locale === 'string' ? params.locale : 'ro';
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'calendar'>('table');
  const [scheduleDraft, setScheduleDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await demoRequestsApi.superadminList({ status: (status || undefined) as any });
      setItems(res.data || []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of items) {
      const key =
        item.scheduledAt
          ? new Date(item.scheduledAt).toISOString().slice(0, 10)
          : item.preferredDate || 'Fara data';
      map.set(key, [...(map.get(key) || []), item]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">Programari demo</h1>
        <div className="flex items-center gap-2">
          <select className="input h-9 w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Toate statusurile</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button className="rounded-md border border-border/70 px-3 py-2 text-xs" onClick={() => setView((prev) => (prev === 'table' ? 'calendar' : 'table'))}>
            {view === 'table' ? 'Calendar view' : 'Table view'}
          </button>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Se incarca solicitarile...</p> : null}

      {view === 'table' ? (
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border/70 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Lead</th>
                <th className="px-3 py-2">Asociatie</th>
                <th className="px-3 py-2">Preferinte</th>
                <th className="px-3 py-2">Programat</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actiuni</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border/40 align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.phone} · {item.email}</p>
                    {item.leadId ? (
                      <Link href={`/${locale}/superadmin/leads/${item.leadId}`} className="text-xs text-primary hover:underline">
                        Vezi lead
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Fara lead</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{item.associationName || '-'}</td>
                  <td className="px-3 py-2">
                    <p>{item.preferredDate || '-'}</p>
                    <p className="text-xs text-muted-foreground">{item.preferredTime || '-'}</p>
                  </td>
                  <td className="px-3 py-2">{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : '-'}</td>
                  <td className="px-3 py-2">{item.status}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="datetime-local"
                        className="input h-8 w-48"
                        value={scheduleDraft[item.id] || ''}
                        onChange={(e) => setScheduleDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                      <button
                        className="rounded-md border border-border/70 px-2 py-1 text-xs"
                        onClick={async () => {
                          if (!scheduleDraft[item.id]) return;
                          await demoRequestsApi.superadminSchedule(item.id, { scheduledAt: new Date(scheduleDraft[item.id]).toISOString() });
                          await load();
                        }}
                      >
                        Programeaza
                      </button>
                      <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await demoRequestsApi.superadminComplete(item.id); await load(); }}>
                        Marcat complet
                      </button>
                      <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await demoRequestsApi.superadminCancel(item.id, { status: 'NO_SHOW' }); await load(); }}>
                        No-show
                      </button>
                      <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await demoRequestsApi.superadminCancel(item.id, { status: 'CANCELLED' }); await load(); }}>
                        Anuleaza
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Nu exista solicitari demo
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groupedByDate.map(([day, rows]) => (
            <div key={day} className="rounded-xl border border-border/70 bg-card p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{day}</p>
              <div className="mt-2 space-y-2">
                {rows.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/60 p-2 text-xs">
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-muted-foreground">{item.associationName || item.email}</p>
                    <p className="text-muted-foreground">Status: {item.status}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
