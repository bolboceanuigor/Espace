'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Gauge, Plus, Search, TimerReset } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { adminMeters, meterStatusVariant, type AdminMeter, type MeterStatus, type MeterType } from '@/lib/admin-mvp-data';

const statusOptions: Array<'Toate' | MeterStatus> = ['Toate', 'Actualizat', 'Lipsă citire', 'Suspect'];
const typeOptions: Array<'Toate' | MeterType> = ['Toate', 'Apă rece', 'Apă caldă', 'Gaz', 'Electricitate'];

export default function AdminMetersPage() {
  const [staircase, setStaircase] = useState('Toate');
  const [apartment, setApartment] = useState('Toate');
  const [type, setType] = useState<'Toate' | MeterType>('Toate');
  const [status, setStatus] = useState<'Toate' | MeterStatus>('Toate');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return adminMeters.filter((meter) => {
      const matchesSearch = !needle || `${meter.apartment} ${meter.staircase} ${meter.type} ${meter.serial}`.toLowerCase().includes(needle);
      const matchesStaircase = staircase === 'Toate' || meter.staircase === staircase;
      const matchesApartment = apartment === 'Toate' || meter.apartment === apartment;
      const matchesType = type === 'Toate' || meter.type === type;
      const matchesStatus = status === 'Toate' || meter.status === status;
      return matchesSearch && matchesStaircase && matchesApartment && matchesType && matchesStatus;
    });
  }, [apartment, query, staircase, status, type]);

  const staircases = ['Toate', ...Array.from(new Set(adminMeters.map((meter) => meter.staircase)))];
  const apartments = ['Toate', ...Array.from(new Set(adminMeters.map((meter) => meter.apartment)))];

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Contoare" description="Citiri pentru apă, gaz și electricitate în APC Alba Iulia 75." />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total contoare" value="426" description="În toate apartamentele" icon={<Gauge className="h-5 w-5" />} />
        <StatCard label="Citiri actualizate" value="381" description="Citiri confirmate luna curentă" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Citiri lipsă" value="23" description="Necesită transmitere" icon={<TimerReset className="h-5 w-5" />} tone="warning" />
        <StatCard label="Citiri suspecte" value="8" description="Valori de verificat" icon={<AlertTriangle className="h-5 w-5" />} tone="danger" />
      </section>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută apartament, tip sau serie" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Select value={staircase} onChange={setStaircase} options={staircases} label="Scara" />
          <Select value={apartment} onChange={setApartment} options={apartments} label="Apartament" />
          <Select value={type} onChange={(value) => setType(value as 'Toate' | MeterType)} options={typeOptions} label="Tip contor" />
          <Select value={status} onChange={(value) => setStatus(value as 'Toate' | MeterStatus)} options={statusOptions} label="Status" />
        </div>
      </Card>

      <section className="grid gap-3 lg:grid-cols-2">
        {filtered.map((meter) => (
          <MeterCard key={meter.id} meter={meter} />
        ))}
      </section>
    </div>
  );
}

function MeterCard({ meter }: { meter: AdminMeter }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Apt. {meter.apartment}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{meter.staircase} · Etaj {meter.floor}</p>
        </div>
        <Badge variant={meterStatusVariant[meter.status]}>{meter.status}</Badge>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <Info label="Tip" value={meter.type} />
        <Info label="Serie" value={meter.serial} />
        <Info label="Ultima citire" value={meter.reading} />
        <Info label="Data citirii" value={meter.readingDate} />
      </div>

      <Button className="mt-4 w-full sm:w-auto" variant={meter.status === 'Actualizat' ? 'secondary' : 'primary'}>
        <Plus className="h-4 w-4" />
        Adaugă citire
      </Button>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/35 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Select({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: readonly string[]; label: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] outline-none focus:ring-2 focus:ring-foreground/10"
      >
        {options.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}
