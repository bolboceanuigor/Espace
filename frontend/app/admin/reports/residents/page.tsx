'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Badge, Button, Card, PageHeader } from '@/components/ui';
import { reportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

const mdl = new Intl.NumberFormat('ro-MD', { style: 'currency', currency: 'MDL', maximumFractionDigits: 2 });

function roleLabel(value?: string) {
  const labels: Record<string, string> = {
    OWNER: 'Proprietar',
    RESIDENT: 'Locatar',
    TENANT: 'Chiriaș',
    FAMILY_MEMBER: 'Membru familie',
    REPRESENTATIVE: 'Reprezentant',
  };
  return labels[String(value || '')] || 'Locatar';
}

export default function AdminResidentsReportPage() {
  const [search, setSearch] = useState('');
  const [report, setReport] = useState<any>({ summary: {}, rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => ({ search: search || undefined }), [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.adminResidents(params);
      setReport(res.data || { summary: {}, rows: [] });
    } catch {
      setReport({ summary: {}, rows: [] });
      setError('Nu am putut încărca raportul locatarilor.');
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
        title="Raport locatari"
        description="Evidență locatari, conturi, roluri, apartamente asociate și datorii."
        rightSlot={
          <Button variant="secondary" onClick={async () => downloadBlob((await reportsApi.adminResidentsCsv(params)).data, 'raport-locatari.csv')}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      <section className="grid gap-3 md:grid-cols-3">
        <Card><p className="text-sm text-muted-foreground">Locatari</p><p className="mt-2 text-xl font-semibold text-foreground">{summary.residentsCount || 0}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Conturi create</p><p className="mt-2 text-xl font-semibold text-foreground">{summary.withAccounts || 0}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Datorie asociată</p><p className="mt-2 text-xl font-semibold text-foreground">{mdl.format(summary.totalDebt || 0)}</p></Card>
      </section>
      <Card>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="input pl-9" placeholder="Caută nume, telefon sau email" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </Card>
      <section className="grid gap-3 md:grid-cols-2">
        {loading ? <Card className="md:col-span-2"><p className="text-sm text-muted-foreground">Se încarcă datele...</p></Card> : null}
        {!loading && !rows.length ? <Card className="md:col-span-2"><p className="font-semibold text-foreground">Nu există locatari încă.</p></Card> : null}
        {rows.map((row: any) => (
          <Card key={row.residentId}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-foreground">{row.fullName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.phone || '-'} · {row.email || '-'}</p>
              </div>
              <Badge variant={row.accountStatus === 'CREATED' ? 'success' : 'neutral'}>{row.accountStatus === 'CREATED' ? 'Cont creat' : 'Fără cont'}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="neutral">{roleLabel(row.role)}</Badge>
              {(row.apartments || []).map((apartment: any) => (
                <Badge key={apartment.id} variant="neutral">Apt. {apartment.number} · {apartment.staircase}</Badge>
              ))}
              <Badge variant={row.totalDebt > 0 ? 'warning' : 'success'}>{mdl.format(row.totalDebt || 0)}</Badge>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
