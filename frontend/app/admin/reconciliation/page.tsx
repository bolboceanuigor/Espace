'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { reconciliationApi } from '@/lib/api';
import { isDemoPresentationModeEnabled } from '@/lib/demo-presentation';

const SOURCES = [
  'INFOCOM',
  'BANK_STATEMENT',
  'MAIB_BANK_STATEMENT',
  'VICTORIABANK_STATEMENT',
  'MOLDINDCONBANK_STATEMENT',
  'OPLATA',
  'PAYNET',
  'MAIB',
  'OTHER_BANK_STATEMENT',
  'OTHER',
] as const;

export default function AdminReconciliationPage() {
  const [source, setSource] = useState<(typeof SOURCES)[number]>('INFOCOM');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const res = await reconciliationApi.listBatches();
    setRows(res.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Payment Reconciliation</h1>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Upload payment report</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Upload incoming bank statement export. You can map columns before reconciliation.
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <select className="select" value={source} onChange={(e) => setSource(e.target.value as any)}>
            {SOURCES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            className="input md:col-span-2"
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        <button
          className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!file || loading}
          onClick={async () => {
            if (!file) return;
            if (isDemoPresentationModeEnabled()) {
              window.alert('Demo: reconcilierea este simulată. Nu se modifică date reale.');
              return;
            }
            setLoading(true);
            try {
              await reconciliationApi.upload(source, file);
              setFile(null);
              await load();
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? 'Uploading...' : 'Upload report'}
        </button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Imported batches</p>
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-lg border border-border/60 p-3">
              <p className="text-sm font-medium text-foreground">
                {row.source} • {row.fileName}
              </p>
              <p className="text-xs text-muted-foreground">
                status: {row.status} • total: {row.totalRows} • matched: {row.matchedRows} • review: {row.reviewRows} • duplicates: {row.duplicateRows}
              </p>
              <div className="mt-2 flex gap-2">
                <Link href={`/admin/reconciliation/${row.id}/mapping`} className="rounded border px-2 py-1 text-xs">
                  Mapping
                </Link>
                <Link href={`/admin/reconciliation/${row.id}`} className="rounded border px-2 py-1 text-xs">
                  Open batch
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

