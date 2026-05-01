'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, Building2, Gauge, Home, Search } from 'lucide-react';
import { adminStructureApi } from '@/lib/api';
import { defaultLocale, isLocale } from '@/i18n';
import {
  CondoApartment,
  fallbackCondoApartments,
  formatMdl,
  mapApartmentStatus,
} from '@/lib/condo-admin-fallback';
import LoadingState from '@/components/common/LoadingState';

function personName(profile: any): string {
  const first = profile?.user?.firstName || '';
  const last = profile?.user?.lastName || '';
  return `${first} ${last}`.trim() || profile?.user?.email || 'Fără nume';
}

function normalizeApartment(row: any): CondoApartment {
  const residents = Array.isArray(row?.residents) ? row.residents : [];
  const primary = residents.find((item: any) => item.isPrimary) || residents[0];
  const debt = Number(row?.debtAmount ?? row?.totalDebt ?? row?.currentDebt ?? row?.balanceDue ?? 0);
  const mappedResidents = residents.map((profile: any) => ({
    id: profile.id || profile.user?.id || `${row.id}-${personName(profile)}`,
    fullName: personName(profile),
    phone: profile.phone || profile.user?.phone || 'Telefon indisponibil',
    email: profile.user?.email || 'Email indisponibil',
    role: profile.type === 'OWNER' ? 'proprietar' : profile.type === 'TENANT' ? 'chiriaș' : 'reprezentant',
    accountStatus: profile.user?.id ? 'cont creat' : 'fără cont',
    apartments: [row.number],
    debt,
  })) as CondoApartment['residents'];

  return {
    id: row.id,
    number: row.number || '-',
    building: row.building?.name || 'Bloc',
    staircase: row.staircase?.name || 'Scară',
    floor: row.floor ?? null,
    areaM2: row.areaM2 ?? null,
    rooms: row.rooms ?? null,
    status: mapApartmentStatus(row.status, debt, residents.length),
    owner: primary
      ? {
          id: primary.id || primary.user?.id || `${row.id}-owner`,
          fullName: personName(primary),
          phone: primary.phone || 'Telefon indisponibil',
          email: primary.user?.email || 'Email indisponibil',
          role: primary.type === 'OWNER' ? 'proprietar' : 'locatar',
          accountStatus: primary.user?.id ? 'cont creat' : 'fără cont',
          apartments: [row.number],
          debt,
        }
      : null,
    residents: mappedResidents,
    peopleCount: Number(row.peopleCount ?? mappedResidents.length ?? 0),
    debt,
    paymentStatus: debt > 0 ? 'Întârziat' : 'Achitat',
    lastPayment: row.lastPaymentMonth || 'Indisponibil',
    meters: [],
    activeRequests: [],
    notes: '',
  };
}

const statusOptions = ['toate', 'activ', 'nelocuit', 'datornic', 'problemă', 'fără cont creat'];

export default function AdminApartmentsPage() {
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const [apartments, setApartments] = useState<CondoApartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'fallback'>('fallback');
  const [search, setSearch] = useState('');
  const [staircase, setStaircase] = useState('toate');
  const [floor, setFloor] = useState('toate');
  const [status, setStatus] = useState('toate');
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [withoutAccount, setWithoutAccount] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await adminStructureApi.listApartments({ limit: 100 });
        const rows = Array.isArray(response.data?.data) ? response.data.data : Array.isArray(response.data) ? response.data : [];
        if (!active) return;
        setApartments(rows.length ? rows.map(normalizeApartment) : fallbackCondoApartments);
        setSource(rows.length ? 'api' : 'fallback');
      } catch {
        if (!active) return;
        setApartments(fallbackCondoApartments);
        setSource('fallback');
      } finally {
        if (active) setLoading(false);
      }
    };
    load().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const staircases = useMemo(() => ['toate', ...Array.from(new Set(apartments.map((item) => item.staircase)))], [apartments]);
  const floors = useMemo(() => ['toate', ...Array.from(new Set(apartments.map((item) => String(item.floor ?? '-'))))], [apartments]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return apartments.filter((item) => {
      const matchesSearch =
        !needle ||
        item.number.toLowerCase().includes(needle) ||
        item.owner?.fullName.toLowerCase().includes(needle) ||
        item.owner?.phone.toLowerCase().includes(needle) ||
        item.residents.some((resident) => resident.fullName.toLowerCase().includes(needle) || resident.phone.toLowerCase().includes(needle));
      const matchesStaircase = staircase === 'toate' || item.staircase === staircase;
      const matchesFloor = floor === 'toate' || String(item.floor ?? '-') === floor;
      const matchesStatus = status === 'toate' || item.status === status;
      const matchesDebt = !onlyDebt || item.debt > 0;
      const matchesAccount = !withoutAccount || item.status === 'fără cont creat' || item.residents.some((resident) => resident.accountStatus === 'fără cont');
      return matchesSearch && matchesStaircase && matchesFloor && matchesStatus && matchesDebt && matchesAccount;
    });
  }, [apartments, floor, onlyDebt, search, staircase, status, withoutAccount]);

  const summary = useMemo(
    () => ({
      total: apartments.length,
      withDebt: apartments.filter((item) => item.debt > 0).length,
      totalDebt: apartments.reduce((sum, item) => sum + item.debt, 0),
      missingMeters: apartments.filter((item) => item.meters.some((meter) => meter.status !== 'actualizat') || item.meters.length === 0).length,
    }),
    [apartments],
  );

  const cards = [
    { label: 'Total apartamente', value: summary.total, icon: Home },
    { label: 'Apartamente cu datorii', value: summary.withDebt, icon: AlertCircle },
    { label: 'Datorie totală', value: formatMdl(summary.totalDebt), icon: Building2 },
    { label: 'Contoare neverificate', value: summary.missingMeters, icon: Gauge },
  ];

  return (
    <div className="space-y-5 pb-4">
      <section className="rounded-[1.75rem] border border-border/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="inline-flex rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">Administrare bloc</p>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">Apartamente</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Evidență pe unități locative: proprietari, locatari, datorii, contoare și cereri asociate apartamentului.
            </p>
          </div>
          {source === 'fallback' ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">Date demonstrative</span>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
                </div>
                <span className="rounded-2xl bg-muted p-2 text-foreground"><Icon className="h-5 w-5" /></span>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
        <div className="grid gap-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input className="input pl-9" placeholder="Caută apartament, proprietar, telefon" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <select className="select" value={staircase} onChange={(event) => setStaircase(event.target.value)}>
            {staircases.map((item) => <option key={item} value={item}>{item === 'toate' ? 'Toate scările' : item}</option>)}
          </select>
          <select className="select" value={floor} onChange={(event) => setFloor(event.target.value)}>
            {floors.map((item) => <option key={item} value={item}>{item === 'toate' ? 'Toate etajele' : `Etaj ${item}`}</option>)}
          </select>
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((item) => <option key={item} value={item}>{item === 'toate' ? 'Toate statusurile' : item}</option>)}
          </select>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border/70 px-3 text-sm text-foreground">
            <input type="checkbox" checked={onlyDebt} onChange={(event) => setOnlyDebt(event.target.checked)} />
            Cu datorii
          </label>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border/70 px-3 text-sm text-foreground">
            <input type="checkbox" checked={withoutAccount} onChange={(event) => setWithoutAccount(event.target.checked)} />
            Fără cont
          </label>
        </div>
      </section>

      {loading ? <LoadingState label="Se încarcă apartamentele..." rows={6} /> : null}

      <section className="space-y-3 md:hidden">
        {filtered.map((item) => (
          <ApartmentCard key={item.id} item={item} locale={locale} />
        ))}
      </section>

      <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white/90 shadow-[0_14px_40px_rgba(15,23,42,0.045)] md:block">
        <div className="grid grid-cols-[1fr_1fr_1fr_1.4fr_1fr_1fr_auto] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Apartament</span><span>Scară / Etaj</span><span>Suprafață</span><span>Proprietar / Locatar</span><span>Datorie</span><span>Contoare</span><span></span>
        </div>
        {filtered.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_1fr_1fr_1.4fr_1fr_1fr_auto] items-center gap-3 border-b border-border/50 px-4 py-3 text-sm last:border-b-0">
            <div>
              <p className="font-semibold text-foreground">Ap. {item.number}</p>
              <p className="text-xs text-muted-foreground">{item.status}</p>
            </div>
            <span className="text-muted-foreground">{item.staircase} / {item.floor ?? '-'}</span>
            <span className="text-muted-foreground">{item.areaM2 ?? '-'} m²</span>
            <span className="text-foreground">{item.owner?.fullName || item.residents[0]?.fullName || 'Fără locatar'}</span>
            <span className={item.debt > 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-700'}>{formatMdl(item.debt)}</span>
            <span className="text-muted-foreground">{item.meters.filter((meter) => meter.status === 'actualizat').length}/{item.meters.length || 0} actualizate</span>
            <Link href={`/${locale}/admin/apartments/${item.id}`} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60">Deschide</Link>
          </div>
        ))}
      </section>

      {!loading && filtered.length === 0 ? (
        <div className="rounded-[1.35rem] border border-dashed border-border bg-white/80 p-8 text-center text-sm text-muted-foreground">
          Nu există apartamente pentru filtrele selectate.
        </div>
      ) : null}
    </div>
  );
}

function ApartmentCard({ item, locale }: { item: CondoApartment; locale: string }) {
  const meterIssue = item.meters.some((meter) => meter.status !== 'actualizat') || item.meters.length === 0;
  return (
    <Link href={`/${locale}/admin/apartments/${item.id}`} className="block rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-foreground">Ap. {item.number}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.staircase} • Etaj {item.floor ?? '-'} • {item.areaM2 ?? '-'} m²</p>
        </div>
        <span className="rounded-full border border-border/70 bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">{item.status}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Proprietar / locatar</p>
          <p className="mt-1 font-medium text-foreground">{item.owner?.fullName || item.residents[0]?.fullName || 'Fără locatar'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Datorie</p>
          <p className={`mt-1 font-semibold ${item.debt > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatMdl(item.debt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Contoare</p>
          <p className={`mt-1 font-medium ${meterIssue ? 'text-amber-700' : 'text-emerald-700'}`}>{meterIssue ? 'De verificat' : 'Actualizate'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Locuiesc</p>
          <p className="mt-1 font-medium text-foreground">{item.peopleCount} persoane</p>
        </div>
      </div>
    </Link>
  );
}
