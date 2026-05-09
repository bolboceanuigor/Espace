'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { superadminApi } from '@/lib/api';
import { Card, PageHeader } from '@/components/ui';
import { useLocalizedPath } from '@/lib/use-localized-path';

export default function SuperadminFollowUpsPage() {
  const localizedPath = useLocalizedPath();
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
      <PageHeader
        title="Follow-up A.P.C."
        description="Note interne cu scadență pentru clienții A.P.C."
      />

      {loading ? <p className="text-sm text-muted-foreground">Se încarcă follow-up-urile...</p> : null}

      <div className="grid gap-3">
        {items.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{item.organization?.name || 'A.P.C.'}</p>
                <p className="mt-2 font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Scadență: {item.followUpAt ? new Date(item.followUpAt).toLocaleString('ro-RO') : '-'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.organization?.id ? (
                  <Link
                    href={localizedPath(`/superadmin/organizations/${item.organization.id}`)}
                    className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60"
                  >
                    Deschide A.P.C.
                  </Link>
                ) : null}
                <button
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  onClick={async () => {
                    await superadminApi.markClientNoteFollowUpDone(item.id);
                    await load();
                  }}
                >
                  Marchează finalizat
                </button>
              </div>
            </div>
          </Card>
        ))}
        {!loading && !items.length ? (
          <Card className="p-5 text-sm text-muted-foreground">
            Nu există follow-up-uri active.
          </Card>
        ) : null}
      </div>
    </div>
  );
}
