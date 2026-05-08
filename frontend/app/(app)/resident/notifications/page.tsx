'use client';

import { useEffect, useState } from 'react';
import { notificationsApi } from '@/lib/api';

export default function ResidentNotificationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await notificationsApi.residentList();
      setRows(res.data || []);
    } catch {
      setMessage('Nu am putut încărca notificările.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Notificări</h1>
          <p className="mt-1 text-sm text-muted-foreground">Actualizări despre facturi, plăți, cereri și avizier.</p>
        </div>
        <button
          className="rounded-2xl border border-border/70 px-3 py-2 text-xs font-semibold text-foreground"
          onClick={async () => {
            await notificationsApi.residentReadAll();
            setMessage('Notificările au fost marcate ca citite.');
            await load();
          }}
        >
          Marchează tot ca citit
        </button>
      </div>
      {message ? <p className="rounded-2xl border border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}
      <div className="space-y-2">
        {loading ? <p className="rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">Se încarcă activitatea...</p> : null}
        {rows.map((row) => (
          <button
            key={row.id}
            className={`w-full rounded-xl border p-3 text-left ${row.isRead ? 'border-border/70 bg-card' : 'border-primary/30 bg-primary/5'}`}
            onClick={async () => {
              if (!row.isRead) await notificationsApi.residentRead(row.id);
              setMessage('Notificarea a fost marcată ca citită.');
              await load();
            }}
          >
            <p className="font-medium">{row.title}</p>
            <p className="text-sm text-muted-foreground">{row.message}</p>
            {row.link ? <span className="mt-2 inline-flex text-xs font-semibold text-primary">Deschide</span> : null}
          </button>
        ))}
        {!loading && !rows.length ? <p className="rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">Nu ai notificări noi.</p> : null}
      </div>
    </div>
  );
}
