'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminStructureApi, reportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

export default function AdminDebtsReportPage() {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [staircases, setStaircases] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [filters, setFilters] = useState({ buildingId: '', staircaseId: '', floor: '', minDebt: '', maxDebt: '' });

  const load = useCallback(async () => {
    const res = await reportsApi.adminDebts({
      buildingId: filters.buildingId || undefined,
      staircaseId: filters.staircaseId || undefined,
      floor: filters.floor ? Number(filters.floor) : undefined,
      minDebt: filters.minDebt ? Number(filters.minDebt) : undefined,
      maxDebt: filters.maxDebt ? Number(filters.maxDebt) : undefined,
    });
    setRows(res.data || []);
  }, [filters.buildingId, filters.staircaseId, filters.floor, filters.minDebt, filters.maxDebt]);

  useEffect(() => {
    Promise.all([adminStructureApi.listBuildings(), adminStructureApi.listApartments()])
      .then(([bRes, aRes]) => {
        setBuildings(bRes.data || []);
        const map = new Map<string, any>();
        for (const a of aRes.data || []) if (a.staircase?.id && !map.has(a.staircase.id)) map.set(a.staircase.id, a.staircase);
        setStaircases(Array.from(map.values()));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const exportParams = {
    buildingId: filters.buildingId || undefined,
    staircaseId: filters.staircaseId || undefined,
    floor: filters.floor || undefined,
    minDebt: filters.minDebt || undefined,
    maxDebt: filters.maxDebt || undefined,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Apartment Debt Report</h1>
      <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/70 bg-card p-4 md:grid-cols-5">
        <select className="select" value={filters.buildingId} onChange={(e) => setFilters((p) => ({ ...p, buildingId: e.target.value }))}>
          <option value="">All buildings</option>
          {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="select" value={filters.staircaseId} onChange={(e) => setFilters((p) => ({ ...p, staircaseId: e.target.value }))}>
          <option value="">All staircases</option>
          {staircases.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input className="input" type="number" placeholder="Floor" value={filters.floor} onChange={(e) => setFilters((p) => ({ ...p, floor: e.target.value }))} />
        <input className="input" type="number" placeholder="Min debt" value={filters.minDebt} onChange={(e) => setFilters((p) => ({ ...p, minDebt: e.target.value }))} />
        <input className="input" type="number" placeholder="Max debt" value={filters.maxDebt} onChange={(e) => setFilters((p) => ({ ...p, maxDebt: e.target.value }))} />
      </div>
      <div className="flex gap-2">
        <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => downloadBlob((await reportsApi.adminDebtsPdf(exportParams)).data, 'debts-report.pdf')}>Export PDF</button>
        <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => downloadBlob((await reportsApi.adminDebtsXlsx(exportParams)).data, 'debts-report.xlsx')}>Export Excel</button>
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="space-y-1">
          {rows.map((row) => (
            <div key={row.apartmentId} className="text-sm text-foreground">
              #{row.apartmentNumber} • {row.building}/{row.staircase} • owner: {row.ownerResident} • debt: {row.currentDebt}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
