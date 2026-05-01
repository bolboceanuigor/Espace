'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { importsApi } from '@/lib/api';

export default function AdminImportPreviewPage() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const res = await importsApi.preview(params.id);
    setJob(res.data);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [params.id]);

  const rows = useMemo(() => (job?.errorsJson?.rows || []) as any[], [job]);
  const invalid = rows.filter((r) => !r._isValid).length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Import Preview</h1>
      {job ? (
        <>
          <div className="rounded-xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">
            {job.type} • {job.fileName} • status {job.status} • rows {job.totalRows} • valid {job.validRows} • invalid {job.invalidRows}
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="py-2">Row</th>
                    <th className="py-2">Valid</th>
                    <th className="py-2">Errors</th>
                    <th className="py-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row._rowIndex} className="border-b border-border/50 align-top">
                      <td className="py-2 pr-2">{row._rowIndex}</td>
                      <td className="py-2 pr-2">{row._isValid ? 'YES' : 'NO'}</td>
                      <td className="py-2 pr-2 text-rose-600">{(row._errors || []).join(', ')}</td>
                      <td className="py-2">{JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('_'))))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={invalid > 0 || loading}
            onClick={async () => {
              setLoading(true);
              try {
                await importsApi.confirm(job.id);
                await load();
              } finally {
                setLoading(false);
              }
            }}
          >
            Confirm import
          </button>
        </>
      ) : null}
    </div>
  );
}
