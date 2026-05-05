'use client';

import { useCallback, useEffect, useState } from 'react';
import { downloadBlob } from '@/lib/download';
import { reportsApi } from '@/lib/api';

export default function AdminMonthlyReportPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    const res = await reportsApi.adminMonthly({ month, year });
    setData(res.data);
  }, [month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Monthly Financial Report</h1>
      <div className="flex flex-wrap gap-2 rounded-xl border border-border/70 bg-card p-4">
        <input className="input w-32" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
        <input className="input w-40" type="number" min={2000} value={year} onChange={(e) => setYear(Number(e.target.value))} />
        <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => downloadBlob((await reportsApi.adminMonthlyPdf({ month, year })).data, `monthly-${month}-${year}.pdf`)}>Export PDF</button>
        <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => downloadBlob((await reportsApi.adminMonthlyXlsx({ month, year })).data, `monthly-${month}-${year}.xlsx`)}>Export Excel</button>
      </div>

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-border/70 bg-card p-3">Total charges: {data.totalCharges}</div>
            <div className="rounded-xl border border-border/70 bg-card p-3">Total payments: {data.totalPayments}</div>
            <div className="rounded-xl border border-border/70 bg-card p-3">Total debt: {data.totalDebt}</div>
            <div className="rounded-xl border border-border/70 bg-card p-3">Unpaid apartments: {data.unpaidApartmentsCount}</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-sm font-medium text-foreground">Top debt apartments</p>
            <div className="mt-2 space-y-1">
              {(data.topDebtApartments || []).map((row: any, index: number) => (
                <div key={`${row.apartmentNumber}-${index}`} className="text-sm text-foreground">
                  #{row.apartmentNumber} • {row.building} / {row.staircase} • debt: {row.currentDebt}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
