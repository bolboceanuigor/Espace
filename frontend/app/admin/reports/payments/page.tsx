'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Badge, Button, Card, PageHeader } from '@/components/ui';
import { reportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

const mdl = new Intl.NumberFormat('ro-MD', { style: 'currency', currency: 'MDL', maximumFractionDigits: 2 });

const methods = [
  { value: '', label: 'Toate metodele' },
  { value: 'CASH', label: 'Numerar' },
  { value: 'BANK_TRANSFER', label: 'Transfer bancar' },
  { value: 'BANK', label: 'Transfer bancar' },
  { value: 'CARD', label: 'Card' },
  { value: 'ONLINE', label: 'Online' },
];

export default function AdminPaymentsReportPage() {
  const [filters, setFilters] = useState({ from: '', to: '', method: '' });
  const [report, setReport] = useState<any>({ summary: {}, rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => ({
    from: filters.from || undefined,
    to: filters.to || undefined,
    method: filters.method || undefined,
  }), [filters.from, filters.method, filters.to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.adminPayments(params);
      setReport(res.data || { summary: {}, rows: [] });
    } catch {
      setReport({ summary: {}, rows: [] });
      setError('Nu am putut încărca raportul de plăți.');
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
        title="Raport plăți"
        description="Registru plăți înregistrate de administrator, cu export CSV."
        rightSlot={
          <Button variant="secondary" onClick={async () => downloadBlob((await reportsApi.adminPaymentsCsv(params)).data, 'raport-plati.csv')}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}

      <section className="grid gap-3 md:grid-cols-2">
        <Card><p className="text-sm text-muted-foreground">Total achitat</p><p className="mt-2 text-xl font-semibold text-foreground">{mdl.format(summary.totalPaid || 0)}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Plăți în listă</p><p className="mt-2 text-xl font-semibold text-foreground">{summary.paymentsCount || 0}</p></Card>
      </section>

      <Card>
        <div className="grid gap-3 md:grid-cols-[180px_180px_220px]">
          <input className="input" type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
          <input className="input" type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
          <select className="select" value={filters.method} onChange={(event) => setFilters((current) => ({ ...current, method: event.target.value }))}>
            {methods.map((method) => <option key={method.value || 'all'} value={method.value}>{method.label}</option>)}
          </select>
        </div>
      </Card>

      <section className="grid gap-3">
        {loading ? <Card><p className="text-sm text-muted-foreground">Se încarcă datele...</p></Card> : null}
        {!loading && !rows.length ? <Card><p className="font-semibold text-foreground">Nu există plăți în perioada selectată.</p></Card> : null}
        {rows.map((row: any) => (
          <Card key={row.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-base font-semibold text-foreground">{mdl.format(row.amount || 0)} · Apt. {row.apartmentNumber}</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.residentName || '-'} · {row.paidAt ? new Date(row.paidAt).toLocaleDateString('ro-RO') : '-'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">{row.methodLabel}</Badge>
                {row.invoiceMonth ? <Badge variant="success">Factura {String(row.invoiceMonth).padStart(2, '0')}.{row.invoiceYear}</Badge> : null}
              </div>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
