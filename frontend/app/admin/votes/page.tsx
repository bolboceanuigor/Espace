'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { votesApi } from '@/lib/api';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/ui/Button';
import { useLocalizedPath } from '@/lib/use-localized-path';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  ACTIVE: 'bg-blue-100 text-blue-700',
  CLOSED: 'bg-amber-100 text-amber-800',
  PUBLISHED: 'bg-green-100 text-green-700',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Activă',
  CLOSED: 'Închisă',
  PUBLISHED: 'Publicată',
};

const TARGET_LABEL: Record<string, string> = {
  ORGANIZATION: 'Toată asociația',
  BUILDING: 'Bloc',
  STAIRCASE: 'Scară',
};

const VOTING_METHOD_LABEL: Record<string, string> = {
  BY_APARTMENT: 'Un vot per apartament',
  BY_AREA_M2: 'Pondere după m²',
};

export default function AdminVotesPage() {
  const localizedPath = useLocalizedPath();
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await votesApi.adminList(status ? { status: status as any } : undefined);
      setRows(res.data || []);
    } catch {
      setError('Nu am putut încărca sesiunile de vot.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Sesiuni de vot</h1>
        <Link href={localizedPath('/admin/votes/new')} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white">
          Creează vot
        </Link>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <select className="select max-w-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Toate statusurile</option>
          {['DRAFT', 'ACTIVE', 'CLOSED', 'PUBLISHED'].map((value) => (
            <option key={value} value={value}>{STATUS_LABEL[value] || value}</option>
          ))}
        </select>
      </div>

      {loading ? <LoadingState label="Se încarcă voturile..." rows={4} /> : null}
      {!loading && error ? (
        <div className="space-y-2 rounded-xl border border-border/70 bg-card p-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={() => load().catch(() => undefined)}>
            Reîncearcă
          </Button>
        </div>
      ) : null}
      {!loading && !error && !rows.length ? (
        <EmptyState title="Nu există date încă" description="Creează prima sesiune de vot pentru rezidenți." />
      ) : null}
      {!loading && !error && rows.length ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-border/70 bg-card p-3">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{row.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[row.status] || 'bg-slate-100 text-slate-700'}`}>{STATUS_LABEL[row.status] || row.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {TARGET_LABEL[row.targetType] || row.targetType} • {VOTING_METHOD_LABEL[row.votingMethod] || row.votingMethod} • {new Date(row.startsAt).toLocaleString('ro-MD')} - {new Date(row.endsAt).toLocaleString('ro-MD')}
              </p>
              <div className="mt-3">
                <Link href={localizedPath(`/admin/votes/${row.id}`)} className="rounded-md border border-border/70 px-2 py-1 text-xs">
                  Deschide detalii
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
