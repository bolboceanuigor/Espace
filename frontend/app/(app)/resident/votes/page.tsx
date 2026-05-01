'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { votesApi } from '@/lib/api';

export default function ResidentVotesPage() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    votesApi.residentList().then((res) => setRows(res.data || [])).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Voturi asociatie</h1>
      <div className="space-y-2">
        {rows.map((row) => (
          <Link key={row.id} href={`/resident/votes/${row.id}`} className="block rounded-xl border border-border/70 bg-card p-3">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">{row.title}</p>
              {row.canVote ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Can vote</span> : null}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{row.status}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{row.targetType} • {row.votingMethod}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
