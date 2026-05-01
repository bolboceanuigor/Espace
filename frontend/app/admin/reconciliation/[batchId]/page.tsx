'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { reconciliationApi } from '@/lib/api';

const STATUS_FILTERS = ['', 'MATCHED', 'NEEDS_REVIEW', 'DUPLICATE', 'IGNORED'] as const;

export default function AdminReconciliationBatchPage() {
  const params = useParams<{ batchId: string }>();
  const [batch, setBatch] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [batchRes, rowsRes] = await Promise.all([
      reconciliationApi.getBatch(params.batchId),
      reconciliationApi.listMatches(params.batchId, status ? { status } : undefined),
    ]);
    setBatch(batchRes.data);
    setRows(rowsRes.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [params.batchId, status]);

  const summary = useMemo(
    () => ({
      total: batch?.totalRows || 0,
      matched: batch?.matchedRows || 0,
      review: batch?.reviewRows || 0,
      duplicate: batch?.duplicateRows || 0,
    }),
    [batch],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Reconciliation Batch</h1>
        <div className="flex gap-2">
          <Link href={`/admin/reconciliation/${params.batchId}/mapping`} className="rounded-lg border border-border/70 px-3 py-2 text-sm font-medium">
            Edit mapping
          </Link>
          <button
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await reconciliationApi.runBatch(params.batchId);
                await load();
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? 'Running...' : 'Run matching engine'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-lg border border-border/70 bg-card p-3 text-sm">Total rows: {summary.total}</div>
        <div className="rounded-lg border border-border/70 bg-card p-3 text-sm">Incoming matched: {summary.matched}</div>
        <div className="rounded-lg border border-border/70 bg-card p-3 text-sm">Needs review: {summary.review}</div>
        <div className="rounded-lg border border-border/70 bg-card p-3 text-sm">Duplicates: {summary.duplicate}</div>
      </div>
      <div className="rounded-lg border border-border/70 bg-card p-3 text-sm">
        Ignored outgoing transactions: {batch?.ignoredRows || 0}
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <select className="select max-w-xs" value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="">All statuses</option>
            {STATUS_FILTERS.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
          {rows.map((row) => {
            const bestMatch = row.matches?.[0];
            return (
              <details key={row.id} className="rounded-lg border border-border/60 p-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {row.apartmentNumber || '-'} • {row.amount} {row.currency} • {new Date(row.paymentDate).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {row.status} {bestMatch ? `• score ${bestMatch.confidenceScore}` : ''}
                    </span>
                  </div>
                </summary>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <p>Reason: {bestMatch?.reason || '-'}</p>
                  <p>Invoice: {bestMatch?.invoice?.invoiceNumber || row.invoiceNumber || '-'}</p>
                  <p>Description: {row.description || '-'}</p>
                  <div className="rounded-md bg-muted p-2">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(row.rawDataJson, null, 2)}</pre>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {bestMatch ? (
                      <>
                        <button
                          className="rounded border px-2 py-1"
                          onClick={async () => {
                            await reconciliationApi.confirmMatch(bestMatch.id);
                            await load();
                          }}
                        >
                          Confirm
                        </button>
                        <button
                          className="rounded border px-2 py-1"
                          onClick={async () => {
                            await reconciliationApi.rejectMatch(bestMatch.id);
                            await load();
                          }}
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                    <button
                      className="rounded border px-2 py-1"
                      onClick={async () => {
                        await reconciliationApi.ignoreImported(row.id);
                        await load();
                      }}
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}

