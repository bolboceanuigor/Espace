'use client';

import { useState } from 'react';
import { CheckCircle2, Droplets, Gauge } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { residentMeters, residentMeterStatusVariant, type ResidentMeterStatus } from '@/lib/resident-mvp-data';

export default function ResidentMetersPage() {
  const [meters, setMeters] = useState(residentMeters);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const submitReading = (id: string, unit: string) => {
    const value = drafts[id]?.trim();
    if (!value) return;
    setMeters((current) =>
      current.map((meter) =>
        meter.id === id
          ? { ...meter, reading: `${value} ${unit}`, date: new Date().toLocaleDateString('ro-MD'), status: 'Actualizat' as ResidentMeterStatus }
          : meter,
      ),
    );
    setDrafts((current) => ({ ...current, [id]: '' }));
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Contoare" description="Transmite citirile pentru apartamentul tău." />
      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Contoare active" value={meters.length} description="Apt. 45" icon={<Gauge className="h-5 w-5" />} />
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
              <Button onClick={() => submitReading(meter.id, meter.unit)} disabled={!drafts[meter.id]?.trim()}>
                <CheckCircle2 className="h-4 w-4" />
                Transmite citire
              </Button>
            </div>
          </Card>
        ))}
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
