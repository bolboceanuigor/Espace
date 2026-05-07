'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Droplets, Gauge } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { normalizeResidentMeter, residentMeters, residentMeterStatusVariant, type ResidentMeterStatus } from '@/lib/resident-mvp-data';

export default function ResidentMetersPage() {
  const [meters, setMeters] = useState<typeof residentMeters>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [source, setSource] = useState<'loading' | 'api' | 'mock'>('loading');
  const [isSubmitting, setIsSubmitting] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    residentDemoApi
      .meters()
      .then((res) => {
        if (!active) return;
        const apiRows = (res.data || []).map(normalizeResidentMeter);
        setMeters(apiRows);
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setMeters(residentMeters);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, []);

  const loadMeters = async () => {
    const res = await residentDemoApi.meters();
    const apiRows = (res.data || []).map(normalizeResidentMeter);
    setMeters(apiRows);
    setSource('api');
  };

  const submitReading = async (id: string, unit: string) => {
    const value = drafts[id]?.trim();
    if (!value) return;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      setError('Completează o valoare numerică.');
      return;
    }
    setMessage('');
    setError('');
    setIsSubmitting(id);
    try {
      await residentDemoApi.addMeterReading(id, {
        value: numericValue,
        readingDate: new Date().toISOString().slice(0, 10),
        source: 'RESIDENT',
      });
      setMeters((current) =>
        current.map((meter) =>
          meter.id === id
            ? { ...meter, reading: `${numericValue.toLocaleString('ro-RO')} ${unit}`, date: new Date().toLocaleDateString('ro-MD'), status: 'Actualizat' as ResidentMeterStatus }
            : meter,
        ),
      );
      setDrafts((current) => ({ ...current, [id]: '' }));
      setSource('api');
      setMessage('Citirea a fost transmisă.');
      await loadMeters().catch(() => undefined);
    } catch {
      setError('Nu am putut transmite citirea.');
    } finally {
      setIsSubmitting('');
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Contoare"
        description="Transmite citirile pentru apartamentul tău."
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
          </span>
        }
      />
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}
      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Contoare active" value={meters.length} description="Apartamentul tău" icon={<Gauge className="h-5 w-5" />} />
        <StatCard label="Citiri lipsă" value={meters.filter((meter) => meter.status === 'Lipsă citire').length} description="De completat luna aceasta" icon={<Droplets className="h-5 w-5" />} tone="warning" />
      </section>

      <section className="grid gap-3">
        {meters.map((meter) => (
          <Card key={meter.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">{meter.type}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{meter.serial}</p>
              </div>
              <Badge variant={residentMeterStatusVariant[meter.status]}>{meter.status}</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Ultima citire" value={meter.reading} />
              <Info label="Data ultimei citiri" value={meter.date} />
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input
                value={drafts[meter.id] ?? ''}
                onChange={(event) => setDrafts((current) => ({ ...current, [meter.id]: event.target.value }))}
                placeholder={`Citire nouă (${meter.unit})`}
                inputMode="decimal"
              />
              <Button onClick={() => submitReading(meter.id, meter.unit)} disabled={!drafts[meter.id]?.trim() || isSubmitting === meter.id}>
                <CheckCircle2 className="h-4 w-4" />
                {isSubmitting === meter.id ? 'Se transmite...' : 'Transmite citire'}
              </Button>
            </div>
          </Card>
        ))}
        {!meters.length ? <Card className="p-5 text-sm font-medium text-muted-foreground">{source === 'api' ? 'Nu există contoare conectate pentru acest apartament.' : 'Nu există contoare încă.'}</Card> : null}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/35 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}
