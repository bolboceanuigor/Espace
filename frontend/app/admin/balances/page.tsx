'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminStructureApi, reportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';

export default function AdminBalancesPage() {
  const { showToast } = useToast();
  const [buildings, setBuildings] = useState<any[]>([]);
  const [staircases, setStaircases] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [filters, setFilters] = useState({ buildingId: '', staircaseId: '', floor: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [debtsRes, buildingsRes, apartmentsRes] = await Promise.all([
        reportsApi.adminDebts({
          buildingId: filters.buildingId || undefined,
          staircaseId: filters.staircaseId || undefined,
          floor: filters.floor ? Number(filters.floor) : undefined,
        }),
        adminStructureApi.listBuildings(),
        adminStructureApi.listApartments(),
      ]);
      setRows(debtsRes.data?.rows || debtsRes.data || []);
      setBuildings(buildingsRes.data || []);
      const map = new Map<string, any>();
      for (const apartment of apartmentsRes.data || []) {
        if (apartment.staircase?.id && !map.has(apartment.staircase.id)) map.set(apartment.staircase.id, apartment.staircase);
      }
      setStaircases(Array.from(map.values()));
    } catch {
      setRows([]);
      setError('Nu am putut încărca soldurile apartamentelor.');
    } finally {
      setLoading(false);
    }
  }, [filters.buildingId, filters.floor, filters.staircaseId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <MobilePageHeader title="Balances" subtitle="Current apartment debts with quick filters and export." />

      {loading ? <LoadingState label="Se încarcă soldurile..." /> : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
          <Button className="ml-2" size="sm" variant="secondary" onClick={() => load()}>
            Reîncearcă
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/70 bg-card p-4 md:grid-cols-4">
        <select className="select" value={filters.buildingId} onChange={(e) => setFilters((prev) => ({ ...prev, buildingId: e.target.value }))}>
          <option value="">All buildings</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select className="select" value={filters.staircaseId} onChange={(e) => setFilters((prev) => ({ ...prev, staircaseId: e.target.value }))}>
          <option value="">All staircases</option>
          {staircases.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="number"
          placeholder="Floor"
          value={filters.floor}
          onChange={(e) => setFilters((prev) => ({ ...prev, floor: e.target.value }))}
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await downloadBlob(
                  (await reportsApi.adminDebtsCsv({
                    buildingId: filters.buildingId || undefined,
                    staircaseId: filters.staircaseId || undefined,
                    floor: filters.floor || undefined,
                  })).data,
                  'solduri-apartamente.csv',
                );
              } catch {
                showToast('Exportul soldurilor a eșuat.', 'error');
              }
            }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.apartmentId} className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
            <p className="font-medium text-foreground">
              #{row.apartmentNumber} • {row.building}/{row.staircase}
            </p>
            <p className="text-xs text-muted-foreground">Owner: {row.ownerResident || '-'}</p>
            <p className={`mt-1 text-sm font-semibold ${Number(row.currentDebt) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              Debt: {row.currentDebt}
            </p>
          </div>
        ))}
        {!loading && !rows.length ? (
          <EmptyState title="Nu există solduri pentru filtrele selectate" description="Încearcă alte filtre sau verifică dacă există apartamente în organizație." />
        ) : null}
      </div>
    </div>
  );
}
