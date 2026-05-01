'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { issuesApi } from '@/lib/api';

const STATUS_COLOR: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  WAITING: 'bg-amber-100 text-amber-800',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-slate-100 text-slate-700',
};

export default function ResidentIssuesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('');

  const load = async () => {
    const res = await issuesApi.residentList(status ? { status: status as any } : undefined);
    setRows(res.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [status]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      open: rows.filter((row) => ['NEW', 'IN_PROGRESS', 'WAITING'].includes(row.status)).length,
      urgent: rows.filter((row) => row.priority === 'URGENT').length,
    }),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Sesizarile mele</h1>
        <Link href="/resident/issues/new" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white">
          Creeaza sesizare
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card p-3 text-sm">Total: {stats.total}</div>
        <div className="rounded-xl border border-border/70 bg-card p-3 text-sm">Deschise: {stats.open}</div>
        <div className="rounded-xl border border-border/70 bg-card p-3 text-sm">Urgente: {stats.urgent}</div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <select className="select mb-3 max-w-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Toate statusurile</option>
          <option value="NEW">NEW</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="WAITING">WAITING</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="CLOSED">CLOSED</option>
        </select>
        <div className="space-y-2">
          {rows.map((row) => (
            <Link key={row.id} href={`/resident/issues/${row.id}`} className="block rounded-lg border border-border/60 p-3 transition hover:bg-muted/20">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{row.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[row.status] || 'bg-slate-100 text-slate-700'}`}>
                  {row.status}
                </span>
                {row.priority === 'URGENT' ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">URGENT</span> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.category} • {row.locationType} • {new Date(row.createdAt).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
