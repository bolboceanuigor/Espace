'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Droplets, Gauge, Search } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader, StatCard } from '@/components/ui';

type MeterStatus = 'actualizat' | 'lipsă citire' | 'suspect';

const initialMeters = [
  { id: 'm1', apartment: '45', staircase: 'Scara 2', floor: 6, type: 'Apă rece', serial: 'AR-2045-11', reading: '128.4 m³', date: '25 Apr 2026', status: 'actualizat' as MeterStatus },
  { id: 'm2', apartment: '45', staircase: 'Scara 2', floor: 6, type: 'Gaz', serial: 'GZ-8712-45', reading: '392.0 m³', date: '12 Mar 2026', status: 'lipsă citire' as MeterStatus },
  { id: 'm3', apartment: '72', staircase: 'Scara 3', floor: 9, type: 'Apă caldă', serial: 'AC-3072-18', reading: '91.8 m³', date: '14 Mar 2026', status: 'suspect' as MeterStatus },
  { id: 'm4', apartment: '18', staircase: 'Scara 1', floor: 3, type: 'Electricitate', serial: 'EL-1819-03', reading: '4,810 kWh', date: '28 Apr 2026', status: 'actualizat' as MeterStatus },
];

const statusVariant: Record<MeterStatus, 'success' | 'warning' | 'error'> = {
  actualizat: 'success',
  'lipsă citire': 'warning',
  suspect: 'error',
};

export default function AdminMetersPage() {
  const [meters, setMeters] = useState(initialMeters);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('toate');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return meters.filter((meter) => {
      const matchesQuery = !needle || `${meter.apartment} ${meter.staircase} ${meter.type} ${meter.serial}`.toLowerCase().includes(needle);
      const matchesStatus = status === 'toate' || meter.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [meters, query, status]);

  const markUpdated = (id: string) => {
    setMeters((current) =>
      current.map((meter) => meter.id === id ? { ...meter, status: 'actualizat', date: new Date().toLocaleDateString('ro-MD') } : meter),
    );
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Contoare" description="Evidența citirilor pentru apă, gaz, electricitate și încălzire." />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total contoare" value="426" description="În toate apartamentele" icon={<Gauge className="h-5 w-5" />} />
        <StatCard label="Actualizate" value="381" description="Citiri recente" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Citiri lipsă" value="23" description="Necesită verificare" icon={<Droplets className="h-5 w-5" />} tone="warning" />
        <StatCard label="Suspecte" value="8" description="Valori de verificat" icon={<AlertTriangle className="h-5 w-5" />} tone="danger" />
      </section>
      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută apartament, scară, tip sau serie" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="toate">Toate statusurile</option>
            <option value="actualizat">Actualizat</option>
            <option value="lipsă citire">Lipsă citire</option>
            <option value="suspect">Suspect</option>
          </select>
        </div>
      </Card>
      <section className="grid gap-3">
        {filtered.map((meter) => (
          <Card key={meter.id} className="p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-center">
              <Info label="Apartament" value={`Apt. ${meter.apartment} · ${meter.staircase} · Etaj ${meter.floor}`} />
              <Info label="Contor" value={`${meter.type} · ${meter.serial}`} />
              <Info label="Ultima citire" value={meter.reading} />
              <Info label="Data" value={meter.date} />
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant[meter.status]}>{meter.status}</Badge>
                {meter.status !== 'actualizat' ? <Button size="sm" variant="secondary" onClick={() => markUpdated(meter.id)}>Marchează actualizat</Button> : null}
              </div>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
