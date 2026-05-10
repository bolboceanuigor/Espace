'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Calculator, Ruler, TriangleAlert, WalletCards } from 'lucide-react';
import { Card, PageHeader, StatCard } from '@/components/ui';
import { tariffsApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type PreviewItem = {
  apartmentId: string;
  apartmentNumber: string;
  staircase: string;
  areaM2: number | null;
  lines: Array<{ tariffId: string; name: string; amount: number }>;
  total: number;
  warnings: string[];
};

type PreviewResponse = {
  summary: {
    totalApartments: number;
    totalAreaM2: number;
    estimatedMonthlyTotal: number;
    apartmentsWithoutArea: number;
  };
  items: PreviewItem[];
  warnings: string[];
};

const emptyPreview: PreviewResponse = {
  summary: {
    totalApartments: 0,
    totalAreaM2: 0,
    estimatedMonthlyTotal: 0,
    apartmentsWithoutArea: 0,
  },
  items: [],
  warnings: [],
};

export default function AdminTariffsPreviewPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<PreviewResponse>(emptyPreview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await tariffsApi.preview();
      setData(res.data || emptyPreview);
    } catch (err: any) {
      setData(emptyPreview);
      setError(String(err?.message || 'Nu am putut încărca previzualizarea.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  return (
    <div className="space-y-5 pb-8">
      <Link href={localizedPath('/admin/tariffs')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la tarife
      </Link>

      <PageHeader
        title="Previzualizare calcul"
        description="Estimare internă pentru primele 20 apartamente. Această pagină nu creează facturi."
      />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {data.warnings.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {data.warnings.join(' ')}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total apartamente" value={data.summary.totalApartments} description="În asociația curentă" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Total m²" value={data.summary.totalAreaM2.toLocaleString('ro-RO')} description="Suprafață declarată" icon={<Ruler className="h-5 w-5" />} />
        <StatCard label="Total lunar estimat" value={formatMdl(data.summary.estimatedMonthlyTotal)} description="Fără facturi create" icon={<Calculator className="h-5 w-5" />} />
        <StatCard label="Fără suprafață" value={data.summary.apartmentsWithoutArea} description="Avertizare per m²" icon={<TriangleAlert className="h-5 w-5" />} tone="warning" />
      </section>

      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => <Card key={item} className="h-24 animate-pulse bg-muted/40" />)}
        </div>
      ) : null}

      {!loading ? (
        <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="hidden grid-cols-[0.8fr_0.7fr_0.9fr_1fr_1fr_1fr_1fr_1fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
            <span>Apartament</span>
            <span>Scara</span>
            <span>Suprafață</span>
            <span>Deservire bloc</span>
            <span>Fond reparație</span>
            <span>Fond investiții</span>
            <span>Total estimat</span>
            <span>Avertizări</span>
          </div>
          {data.items.map((item) => (
            <div key={item.apartmentId} className="grid gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0 lg:grid-cols-[0.8fr_0.7fr_0.9fr_1fr_1fr_1fr_1fr_1fr] lg:items-center">
              <strong className="text-foreground">Apt. {item.apartmentNumber}</strong>
              <span className="text-muted-foreground">{item.staircase || '-'}</span>
              <span className="text-muted-foreground">{item.areaM2 ? `${item.areaM2} m²` : '-'}</span>
              <span className="text-muted-foreground">{formatMdl(lineAmount(item, 'Deservire'))}</span>
              <span className="text-muted-foreground">{formatMdl(lineAmount(item, 'repara'))}</span>
              <span className="text-muted-foreground">{formatMdl(lineAmount(item, 'invest'))}</span>
              <span className="font-semibold text-foreground">{formatMdl(item.total)}</span>
              <span className="text-muted-foreground">{item.warnings.length ? item.warnings.join(' ') : '-'}</span>
            </div>
          ))}
          {!data.items.length ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nu există apartamente pentru previzualizare.
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function lineAmount(item: PreviewItem, needle: string) {
  const normalizedNeedle = needle.toLowerCase();
  return item.lines.find((line) => line.name.toLowerCase().includes(normalizedNeedle))?.amount || 0;
}
