'use client';

import { useCallback, useEffect, useState } from 'react';
import { reportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

export default function AdminPaymentsReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  const load = useCallback(async () => {
    const res = await reportsApi.adminPayments({ from: from || undefined, to: to || undefined });
    setRows(res.data || []);
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Payment Register</h1>
      <div className="flex flex-wrap gap-2 rounded-xl border border-border/70 bg-card p-4">
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => downloadBlob((await reportsApi.adminPaymentsXlsx({ from: from || undefined, to: to || undefined })).data, 'payments-register.xlsx')}>
          Export Excel
        </button>
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="space-y-1">
          {rows.map((row) => (
            <div key={row.id} className="text-sm text-foreground">
              {new Date(row.createdAt).toLocaleString()} • #{row.apartment.number} • {row.amount} • {row.method} • {row.note || '-'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
