'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Gauge, Home, Search, UserX } from 'lucide-react';
import { Badge, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { apartmentsApi } from '@/lib/api';
import { adminApartments, apartmentStatusVariant, normalizeApiApartment, type AdminApartment } from '@/lib/admin-mvp-data';
import { useLocalizedPath } from '@/lib/use-localized-path';

const summary = [
  { label: 'Total apartamente', value: '142', description: 'În APC Alba Iulia 75', icon: <Home className="h-5 w-5" /> },
  { label: 'Cu datorii', value: '37', description: 'Au sold neachitat', icon: <AlertCircle className="h-5 w-5" />, tone: 'danger' as const },
  { label: 'Fără cont creat', value: '44', description: 'Necesită invitație', icon: <UserX className="h-5 w-5" />, tone: 'warning' as const },
  { label: 'Citiri lipsă', value: '23', description: 'Contoare neactualizate', icon: <Gauge className="h-5 w-5" />, tone: 'warning' as const },
];

const statusOptions = ['Toate', 'Activ', 'Datornic', 'Nelocuit', 'Problemă'];

export default function AdminApartmentsPage() {
  const localizedPath = useLocalizedPath();
  const [search, setSearch] = useState('');
  const [staircase, setStaircase] = useState('Toate');
  const [floor, setFloor] = useState('Toate');
  const [status, setStatus] = useState('Toate');
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [withoutAccount, setWithoutAccount] = useState(false);
  const [rows, setRows] = useState<AdminApartment[]>(adminApartments);
  const [source, setSource] = useState<'api' | 'mock'>('mock');

  useEffect(() => {
    let active = true;
    apartmentsApi
      .list()
      .then((res) => {
        if (!active) return;
        const apiRows = (res.data || []).map(normalizeApiApartment);
        if (apiRows.length) {
          setRows(apiRows);
          setSource('api');
        }
      })
      .catch(() => {
        if (!active) return;
        setRows(adminApartments);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesSearch =
        !needle ||
        item.number.toLowerCase().includes(needle) ||
        item.owner.toLowerCase().includes(needle) ||
        item.phone.toLowerCase().includes(needle);
      const matchesStaircase = staircase === 'Toate' || item.staircase === staircase;
      const matchesFloor = floor === 'Toate' || String(item.floor) === floor;
      const matchesStatus = status === 'Toate' || item.status === status;
      const matchesDebt = !onlyDebt || item.debt > 0;
      const matchesAccount = !withoutAccount || !item.hasAccount;
      return matchesSearch && matchesStaircase && matchesFloor && matchesStatus && matchesDebt && matchesAccount;
    });
  }, [floor, onlyDebt, rows, search, staircase, status, withoutAccount]);

  const staircases = ['Toate', ...Array.from(new Set(rows.map((item) => item.staircase)))];
  const floors = ['Toate', ...Array.from(new Set(rows.map((item) => String(item.floor))))];
  const totals = useMemo(() => ({
    total: rows.length,
    debt: rows.filter((item) => item.debt > 0).length,
    withoutAccount: rows.filter((item) => !item.hasAccount).length,
    missingReadings: rows.reduce((sum, item) => sum + item.metersMissing, 0),
  }), [rows]);
  const summaryRows = [
    { ...summary[0], value: String(totals.total) },
    { ...summary[1], value: String(totals.debt) },
    { ...summary[2], value: String(totals.withoutAccount) },
    { ...summary[3], value: String(totals.missingReadings) },
  ];

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Apartamente"
        description="Gestionarea apartamentelor, contoarelor și datoriilor"
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'api' ? 'Date reale' : 'Date demo'}
            </span>
            <Link href={localizedPath('/admin/apartments/apt-45')} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background">Deschide Apt. 45</Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryRows.map((item) => <StatCard key={item.label} {...item} />)}
      </section>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută după apartament, proprietar, telefon" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <Select value={staircase} onChange={setStaircase} options={staircases} labelPrefix="" />
          <Select value={floor} onChange={setFloor} options={floors} labelPrefix="Etaj " />
          <Select value={status} onChange={setStatus} options={statusOptions} labelPrefix="" />
          <Toggle checked={onlyDebt} onChange={setOnlyDebt} label="Cu datorii" />
          <Toggle checked={withoutAccount} onChange={setWithoutAccount} label="Fără cont creat" />
        </div>
      </Card>

      <section className="grid gap-3 md:hidden">
        {filtered.map((item) => <ApartmentMobileCard key={item.id} apartment={item} />)}
      </section>

      <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white/92 shadow-[0_14px_40px_rgba(15,23,42,0.045)] md:block">
        <div className="grid grid-cols-[0.7fr_0.9fr_0.9fr_1.4fr_0.9fr_1fr_0.8fr_auto] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Apt.</span>
          <span>Scară / Etaj</span>
          <span>Suprafață</span>
          <span>Proprietar</span>
          <span>Locatari</span>
          <span>Datorie</span>
          <span>Contoare</span>
          <span />
        </div>
        {filtered.map((item) => (
          <div key={item.id} className="grid grid-cols-[0.7fr_0.9fr_0.9fr_1.4fr_0.9fr_1fr_0.8fr_auto] items-center gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0">
            <div>
              <p className="font-semibold text-foreground">Apt. {item.number}</p>
              <Badge variant={apartmentStatusVariant[item.status]} className="mt-1">{item.status}</Badge>
            </div>
            <span className="text-muted-foreground">{item.staircase} · Etaj {item.floor}</span>
            <span className="text-muted-foreground">{item.areaM2} m² · {item.rooms} camere</span>
            <div>
              <p className="font-medium text-foreground">{item.owner}</p>
              <p className="text-xs text-muted-foreground">{item.phone}</p>
            </div>
            <span className="text-muted-foreground">{item.residents} persoane</span>
            <div>
              <p className={item.debt > 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-700'}>{formatMdl(item.debt)}</p>
              <p className="text-xs text-muted-foreground">Ultima plată: {item.lastPayment}</p>
            </div>
            <span className="text-muted-foreground">{item.metersUpdated} actualizate, {item.metersMissing} lipsă</span>
            <Link href={localizedPath(`/admin/apartments/${item.id}`)} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60">Deschide</Link>
          </div>
        ))}
      </section>
    </div>
  );
}

function ApartmentMobileCard({ apartment }: { apartment: AdminApartment }) {
  const localizedPath = useLocalizedPath();

  return (
    <Link href={localizedPath(`/admin/apartments/${apartment.id}`)} className="block rounded-[1.35rem] border border-border/70 bg-white/92 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-foreground">Apt. {apartment.number}</p>
          <p className="mt-1 text-xs text-muted-foreground">{apartment.staircase} · Etaj {apartment.floor} · {apartment.areaM2} m²</p>
        </div>
        <Badge variant={apartmentStatusVariant[apartment.status]}>{apartment.status}</Badge>
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <Info label="Proprietar" value={apartment.owner} />
        <Info label="Locatari" value={`${apartment.residents} persoane`} />
        <Info label="Datorie" value={formatMdl(apartment.debt)} danger={apartment.debt > 0} />
        <Info label="Contoare" value={`${apartment.metersUpdated} actualizate, ${apartment.metersMissing} lipsă`} />
      </div>
      <span className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-foreground text-sm font-semibold text-background">
        Deschide
      </span>
    </Link>
  );
}

function Info({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-medium ${danger ? 'text-rose-600' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function Select({ value, onChange, options, labelPrefix }: { value: string; onChange: (value: string) => void; options: string[]; labelPrefix: string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] outline-none focus:ring-2 focus:ring-foreground/10">
      {options.map((item) => <option key={item} value={item}>{item === 'Toate' ? item : `${labelPrefix}${item}`}</option>)}
    </select>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
