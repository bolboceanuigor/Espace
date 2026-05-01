'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { importsApi } from '@/lib/api';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/ui/Button';

export default function AdminImportsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await importsApi.list();
      setRows(res.data || []);
    } catch {
      setError('Nu am putut încărca importurile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Bulk Imports</h1>
        <Link href="/admin/imports/new" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white">
          New Import
        </Link>
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        {loading ? <LoadingState label="Se încarcă importurile..." rows={4} /> : null}
        {!loading && error ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={() => load().catch(() => undefined)}>
              Reîncearcă
            </Button>
          </div>
        ) : null}
        {!loading && !error && !rows.length ? (
          <EmptyState title="Nu există date încă" description="Încarcă primul fișier pentru a începe importul." />
        ) : null}
        {!loading && !error && rows.length ? (
          <div className="space-y-2">
            {rows.map((row) => (
              <Link key={row.id} href={`/admin/imports/${row.id}/preview`} className="block rounded-lg border border-border/60 p-3">
                <p className="text-sm font-medium text-foreground">
                  {row.type} • {row.fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  status: {row.status} • rows: {row.totalRows} • valid: {row.validRows} • invalid: {row.invalidRows}
                </p>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
