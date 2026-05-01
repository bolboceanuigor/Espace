'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { importsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

type ImportType = 'BUILDINGS' | 'STAIRCASES' | 'APARTMENTS' | 'RESIDENTS' | 'INITIAL_BALANCES';

export default function AdminImportsNewPage() {
  const router = useRouter();
  const [type, setType] = useState<ImportType>('BUILDINGS');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const templateFileName: Record<ImportType, string> = {
    BUILDINGS: 'buildings-template.xlsx',
    STAIRCASES: 'staircases-template.xlsx',
    APARTMENTS: 'apartments-template.xlsx',
    RESIDENTS: 'residents-template.xlsx',
    INITIAL_BALANCES: 'initial-balances-template.xlsx',
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">New Import</h1>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <select className="select" value={type} onChange={(e) => setType(e.target.value as ImportType)}>
            <option value="BUILDINGS">BUILDINGS</option>
            <option value="STAIRCASES">STAIRCASES</option>
            <option value="APARTMENTS">APARTMENTS</option>
            <option value="RESIDENTS">RESIDENTS</option>
            <option value="INITIAL_BALANCES">INITIAL_BALANCES</option>
          </select>
          <input
            className="input"
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            className="rounded-md border border-border/70 px-3 py-2 text-sm"
            onClick={async () => {
              const blob = (await importsApi.downloadTemplate(type)).data;
              downloadBlob(blob, templateFileName[type]);
            }}
          >
            Download sample template
          </button>
          <button
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={!file || loading}
            onClick={async () => {
              if (!file) return;
              setLoading(true);
              try {
                const created = await importsApi.upload(type, file);
                router.push(`/admin/imports/${created.data.id}/preview`);
              } finally {
                setLoading(false);
              }
            }}
          >
            Upload and validate
          </button>
        </div>
      </div>
    </div>
  );
}
