'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Badge, Button, Card, PageHeader } from '@/components/ui';
import { reportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

const mdl = new Intl.NumberFormat('ro-MD', { style: 'currency', currency: 'MDL', maximumFractionDigits: 2 });

export default function AdminApartmentsReportPage() {
  const [search, setSearch] = useState('');
  const [report, setReport] = useState<any>({ summary: {}, rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => ({ search: search || undefined }), [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.adminApartments(params);
      setReport(res.data || { summary: {}, rows: [] });
    } catch {
      setReport({ summary: {}, rows: [] });
      setError('Nu am putut încărca raportul apartamentelor.');
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
        title="Raport apartamente"
        description="Inventar apartamente, suprafețe, locatari, contoare și datorii."
        rightSlot={
          <Button variant="secondary" onClick={async () => downloadBlob((await reportsApi.adminApartmentsCsv(params)).data, 'raport-apartamente.csv')}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      <section className="grid gap-3 md:grid-cols-3">
        <Card><p className="text-sm text-muted-foreground">Apartamente</p><p className="mt-2 text-xl font-semibold text-foreground">{summary.apartmentsCount || 0}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Suprafață totală</p><p className="mt-2 text-xl font-semibold text-foreground">{summary.totalAreaM2 || 0} m²</p></Card>
        <Card><p className="text-sm text-muted-foreground">Datorie totală</p><p className="mt-2 text-xl font-semibold text-foreground">{mdl.format(summary.totalDebt || 0)}</p></Card>
      </section>
      <Card>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="input pl-9" placeholder="Caută apartament, scară sau proprietar" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </Card>
      <section className="grid gap-3 md:grid-cols-2">
        {loading ? <Card className="md:col-span-2"><p className="text-sm text-muted-foreground">Se încarcă datele...</p></Card> : null}
        {!loading && !rows.length ? <Card className="md:col-span-2"><p className="font-semibold text-foreground">Nu există apartamente încă.</p></Card> : null}
        {rows.map((row: any) => (
          <Card key={row.apartmentId}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-foreground">Apt. {row.apartmentNumber} · {row.staircase}</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.ownerName || '-'} · {row.areaM2 || 0} m² · {row.rooms || 0} camere</p>
              </div>
              <Badge variant={row.totalDebt > 0 ? 'warning' : 'success'}>{row.totalDebt > 0 ? 'Datornic' : 'Achitat'}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div><p className="text-muted-foreground">Locatari</p><p className="font-semibold">{row.residentsCount || 0}</p></div>
              <div><p className="text-muted-foreground">Contoare</p><p className="font-semibold">{row.metersCount || 0}</p></div>
              <div><p className="text-muted-foreground">Datorie</p><p className="font-semibold">{mdl.format(row.totalDebt || 0)}</p></div>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
