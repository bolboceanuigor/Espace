'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { reportsApi } from '@/lib/api';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/ui/Button';

export default function AdminTariffsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportsApi.adminCharges({ month, year });
      setRows(res.data || []);
    } catch {
      setRows([]);
      setError('Nu am putut încărca tarifele.');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const tariffs = useMemo(() => {
    const map = new Map<string, { tariffName: string; apartments: number; totalAmount: number }>();
    for (const row of rows) {
      const key = String(row.tariffName || 'UNKNOWN');
      const existing = map.get(key) || { tariffName: key, apartments: 0, totalAmount: 0 };
      existing.apartments += 1;
      existing.totalAmount += Number(row.amount || 0);
      map.set(key, existing);
    }
    return Array.from(map.values());
  }, [rows]);

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <MobilePageHeader title="Tariffs" subtitle="Current tariff breakdown from generated monthly charges." />

      {loading ? <LoadingState label="Se încarcă tarifele..." /> : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
          <Button className="ml-2" size="sm" variant="secondary" onClick={() => load()}>
            Reîncearcă
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-xl border border-border/70 bg-card p-4">
        <input className="input w-28" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
        <input className="input w-32" type="number" min={2000} value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-3 text-sm text-muted-foreground">
        Tarifele afișate aici sunt calculate din taxele lunare generate. Pentru actualizare, rulează generarea de taxe și facturi pentru perioada dorită.
      </div>

      <div className="space-y-2">
        {tariffs.map((tariff) => (
          <div key={tariff.tariffName} className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
            <p className="font-medium text-foreground">{tariff.tariffName}</p>
            <p className="text-xs text-muted-foreground">
              Apartments: {tariff.apartments} • Total amount: {tariff.totalAmount.toFixed(2)}
            </p>
          </div>
        ))}
        {!loading && !tariffs.length ? (
          <EmptyState title="Nu există tarife în perioada selectată" description="Generează mai întâi taxele lunare pentru a vedea tarifele." />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/charges" className="rounded-lg border border-border/70 px-3 py-2 text-sm font-medium text-foreground">
          Deschide Charges
        </Link>
        <Link href="/admin/invoices" className="rounded-lg border border-border/70 px-3 py-2 text-sm font-medium text-foreground">
          Deschide Invoices
        </Link>
      </div>
    </div>
  );
}
