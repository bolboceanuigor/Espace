'use client';

import { useEffect, useState } from 'react';
import { notificationsApi } from '@/lib/api';

export default function ResidentNotificationsPage() {
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const res = await notificationsApi.residentList();
    setRows(res.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await notificationsApi.residentReadAll(); await load(); }}>
          Mark all read
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <button
            key={row.id}
            className={`w-full rounded-xl border p-3 text-left ${row.isRead ? 'border-border/70 bg-card' : 'border-primary/30 bg-primary/5'}`}
            onClick={async () => {
              if (!row.isRead) await notificationsApi.residentRead(row.id);
              await load();
            }}
          >
            <p className="font-medium">{row.title}</p>
            <p className="text-sm text-muted-foreground">{row.message}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

