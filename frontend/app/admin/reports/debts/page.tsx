'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Badge, Button, Card, PageHeader } from '@/components/ui';
import { adminStructureApi, reportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

const mdl = new Intl.NumberFormat('ro-MD', { style: 'currency', currency: 'MDL', maximumFractionDigits: 2 });

function statusVariant(status: string): 'success' | 'warning' | 'error' {
  if (status === 'Achitat') return 'success';
  if (status === 'Întârziat') return 'error';
  return 'warning';
}

export default function AdminDebtsReportPage() {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [staircases, setStaircases] = useState<any[]>([]);
  const [report, setReport] = useState<any>({ summary: {}, rows: [] });
  const [filters, setFilters] = useState({ buildingId: '', staircaseId: '', minDebt: '', onlyOverdue: false, search: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => ({
    buildingId: filters.buildingId || undefined,
    staircaseId: filters.staircaseId || undefined,
    minDebt: filters.minDebt ? Number(filters.minDebt) : undefined,
    onlyOverdue: filters.onlyOverdue || undefined,
    search: filters.search || undefined,
  }), [filters.buildingId, filters.minDebt, filters.onlyOverdue, filters.search, filters.staircaseId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [reportRes, buildingsRes, apartmentsRes] = await Promise.all([
        reportsApi.adminDebts(params),
        adminStructureApi.listBuildings(),
        adminStructureApi.listApartments(),
      ]);
      setReport(reportRes.data || { summary: {}, rows: [] });
      setBuildings(buildingsRes.data || []);
      const map = new Map<string, any>();
      for (const apartment of apartmentsRes.data?.data || apartmentsRes.data || []) {
        if (apartment.staircase?.id && !map.has(apartment.staircase.id)) map.set(apartment.staircase.id, apartment.staircase);
      }
      setStaircases(Array.from(map.values()));
    } catch {
      setReport({ summary: {}, rows: [] });
      setError('Nu am putut încărca raportul de datorii.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const rows = report.rows || [];
  const summary = report.summary || {};

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Raport datorii"
        description="Apartamente cu sold restant, facturi neachitate și întârzieri."
        rightSlot={
          <Button
            variant="secondary"
            onClick={async () => downloadBlob((await reportsApi.adminDebtsCsv(params)).data, 'raport-datorii.csv')}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Card><p className="text-sm text-muted-foreground">Datorie totală</p><p className="mt-2 text-xl font-semibold text-foreground">{mdl.format(summary.totalDebt || 0)}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Total facturat</p><p className="mt-2 text-xl font-semibold text-foreground">{mdl.format(summary.totalInvoiced || 0)}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Total achitat</p><p className="mt-2 text-xl font-semibold text-foreground">{mdl.format(summary.totalPaid || 0)}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Apartamente cu datorii</p><p className="mt-2 text-xl font-semibold text-foreground">{summary.apartmentsWithDebt || 0}</p></Card>
      </section>

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_160px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input className="input pl-9" placeholder="Caută apartament sau locatar" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
          </label>
          <select className="select" value={filters.buildingId} onChange={(event) => setFilters((current) => ({ ...current, buildingId: event.target.value }))}>
            <option value="">Toate blocurile</option>
            {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
          </select>
          <select className="select" value={filters.staircaseId} onChange={(event) => setFilters((current) => ({ ...current, staircaseId: event.target.value }))}>
            <option value="">Toate scările</option>
            {staircases.map((staircase) => <option key={staircase.id} value={staircase.id}>{staircase.name}</option>)}
          </select>
          <input className="input" type="number" placeholder="Datorie minimă" value={filters.minDebt} onChange={(event) => setFilters((current) => ({ ...current, minDebt: event.target.value }))} />
          <label className="flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-3 text-sm font-semibold">
            <input type="checkbox" checked={filters.onlyOverdue} onChange={(event) => setFilters((current) => ({ ...current, onlyOverdue: event.target.checked }))} />
            Întârziate
          </label>
        </div>
      </Card>

      <section className="grid gap-3">
        {loading ? <Card><p className="text-sm text-muted-foreground">Se încarcă datele...</p></Card> : null}
        {!loading && !rows.length ? <Card><p className="font-semibold text-foreground">Nu există datorii înregistrate.</p></Card> : null}
        {rows.map((row: any) => (
          <Card key={row.apartmentId}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-base font-semibold text-foreground">Apt. {row.apartmentNumber} · {row.staircase}</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.ownerResident || '-'} · Facturi neachitate: {row.unpaidInvoicesCount}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(row.financialStatus)}>{row.financialStatus}</Badge>
                <span className="text-sm font-semibold text-foreground">{mdl.format(row.totalDebt || 0)}</span>
              </div>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
