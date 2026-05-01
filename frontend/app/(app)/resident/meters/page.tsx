'use client';

import { useState } from 'react';
import { CheckCircle2, Droplets, Gauge } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader, StatCard } from '@/components/ui';

type MeterStatus = 'actualizat' | 'lipsă citire';

const initialMeters = [
  { id: 'm1', type: 'Apă rece', serial: 'AR-2045-11', reading: '128.4 m³', date: '25 Apr 2026', status: 'actualizat' as MeterStatus },
  { id: 'm2', type: 'Apă caldă', serial: 'AC-2045-09', reading: '76.1 m³', date: '25 Apr 2026', status: 'actualizat' as MeterStatus },
  { id: 'm3', type: 'Gaz', serial: 'GZ-8712-45', reading: '392.0 m³', date: '12 Mar 2026', status: 'lipsă citire' as MeterStatus },
];

export default function ResidentMetersPage() {
  const [meters, setMeters] = useState(initialMeters);
  const [draft, setDraft] = useState('');

  const submitGasReading = () => {
    if (!draft.trim()) return;
    setMeters((current) => current.map((meter) => meter.id === 'm3' ? { ...meter, reading: `${draft.trim()} m³`, date: new Date().toLocaleDateString('ro-MD'), status: 'actualizat' } : meter));
    setDraft('');
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Contoare" description="Citirile pentru apartamentul tău." />
      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Contoare active" value="3" description="Apt. 45" icon={<Gauge className="h-5 w-5" />} />
        <StatCard label="Citiri lipsă" value={meters.filter((meter) => meter.status === 'lipsă citire').length} description="De completat când poți" icon={<Droplets className="h-5 w-5" />} tone="warning" />
      </section>
      <section className="grid gap-3">
        {meters.map((meter) => (
          <Card key={meter.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="font-semibold text-foreground">{meter.type}</h2><p className="mt-1 text-sm text-muted-foreground">{meter.serial}</p></div>
              <Badge variant={meter.status === 'actualizat' ? 'success' : 'warning'}>{meter.status}</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Ultima citire" value={meter.reading} />
              <Info label="Data" value={meter.date} />
            </div>
          </Card>
        ))}
      </section>
      <Card>
        <h2 className="inline-flex items-center gap-2 font-semibold text-foreground"><CheckCircle2 className="h-4 w-4" /> Trimite citire gaz</h2>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ex: 395.2" inputMode="decimal" />
          <Button onClick={submitGasReading} disabled={!draft.trim()}>Trimite</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Citirea este actualizată local în această versiune.</p>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-muted/35 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold text-foreground">{value}</p></div>;
}
