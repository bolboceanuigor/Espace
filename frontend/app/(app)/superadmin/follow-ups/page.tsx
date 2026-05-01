'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { superadminApi } from '@/lib/api';

export default function SuperadminFollowUpsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superadminApi.listPendingFollowUps();
      setItems(res.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">Pending follow-ups</h1>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading follow-ups...</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border/70 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Organization</th>
              <th className="px-3 py-2">Note</th>
              <th className="px-3 py-2">Follow-up date</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border/40 align-top">
                <td className="px-3 py-2">
                  <p className="font-medium text-foreground">{item.organization?.name || '-'}</p>
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.content}</p>
                  {item.organization?.id ? (
                    <Link
                      href={`/superadmin/organizations/${item.organization.id}/notes`}
                      className="text-xs text-primary hover:underline"
                    >
                      Open notes
                    </Link>
                  ) : null}
                </td>
                <td className="px-3 py-2">{item.followUpAt ? new Date(item.followUpAt).toLocaleString() : '-'}</td>
                <td className="px-3 py-2">
                  <button
                    className="rounded-md border border-border/70 px-2 py-1 text-xs"
                    onClick={async () => {
                      await superadminApi.markClientNoteFollowUpDone(item.id);
                      await load();
                    }}
                  >
                    Mark done
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !items.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  No pending follow-ups.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
