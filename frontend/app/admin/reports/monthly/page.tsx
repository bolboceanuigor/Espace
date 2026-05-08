'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Badge, Button, Card, PageHeader } from '@/components/ui';
import { reportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

const mdl = new Intl.NumberFormat('ro-MD', { style: 'currency', currency: 'MDL', maximumFractionDigits: 2 });

function statusVariant(status: string): 'success' | 'warning' | 'error' {
  if (status === 'PAID') return 'success';
  if (status === 'OVERDUE') return 'error';
  return 'warning';
}

export default function AdminMonthlyReportPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState<any>({ summary: {}, rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => ({ month, year }), [month, year]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.adminMonthly(params);
      setReport(res.data || { summary: {}, rows: [] });
    } catch {
      setReport({ summary: {}, rows: [] });
      setError('Nu am putut încărca raportul lunar.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const summary = report.summary || {};
  const rows = report.rows || report.invoices || [];

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Raport lunar"
        description="Facturi emise, plăți încasate, restanțe și rata de colectare."
        rightSlot={
          <Button variant="secondary" onClick={async () => downloadBlob((await reportsApi.adminMonthlyCsv(params)).data, `raport-lunar-${month}-${year}.csv`)}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}

      <Card>
        <div className="grid gap-3 md:grid-cols-[140px_160px_auto]">
          <input className="input" type="number" min={1} max={12} value={month} onChange={(event) => setMonth(Number(event.target.value))} />
          <input className="input" type="number" min={2000} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} />
          <Button variant="secondary" onClick={load}>Actualizează</Button>
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-4">
        <Card><p className="text-sm text-muted-foreground">Total emis</p><p className="mt-2 text-xl font-semibold text-foreground">{mdl.format(summary.totalIssued || 0)}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Total achitat</p><p className="mt-2 text-xl font-semibold text-foreground">{mdl.format(summary.totalPaid || 0)}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Restanțe</p><p className="mt-2 text-xl font-semibold text-foreground">{mdl.format(summary.totalDebt || 0)}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Rata de colectare</p><p className="mt-2 text-xl font-semibold text-foreground">{summary.collectionRate || 0}%</p></Card>
      </section>

      <section className="grid gap-3">
        {loading ? <Card><p className="text-sm text-muted-foreground">Se încarcă datele...</p></Card> : null}
        {!loading && !rows.length ? <Card><p className="font-semibold text-foreground">Nu există facturi pentru luna selectată.</p></Card> : null}
        {rows.map((row: any) => (
          <Card key={row.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-base font-semibold text-foreground">Apt. {row.apartmentNumber} · {String(row.month).padStart(2, '0')}.{row.year}</p>
                <p className="mt-1 text-sm text-muted-foreground">Scara {row.staircase} · Scadență {row.dueDate ? new Date(row.dueDate).toLocaleDateString('ro-RO') : '-'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(row.status)}>{row.statusLabel}</Badge>
                <span className="text-sm font-semibold text-foreground">{mdl.format(row.remainingAmount || 0)} restant</span>
              </div>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
