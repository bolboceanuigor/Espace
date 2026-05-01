'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Mail, MessageCircle, Phone, Search, UserRound, Users } from 'lucide-react';
import { adminStructureApi } from '@/lib/api';
import { defaultLocale, isLocale } from '@/i18n';
import { CondoPerson, fallbackCondoPeople, formatMdl } from '@/lib/condo-admin-fallback';
import LoadingState from '@/components/common/LoadingState';

const roleOptions = ['toate', 'proprietar', 'locatar', 'chiriaș', 'membru familie', 'reprezentant'];
const accountOptions = ['toate', 'cont creat', 'invitat', 'fără cont'];

function normalizePerson(row: any): CondoPerson {
  const first = row?.user?.firstName || row?.firstName || '';
  const last = row?.user?.lastName || row?.lastName || '';
  const apartmentNumber = row?.apartment?.number || '-';
  const debt = Number(row?.apartment?.debtAmount ?? row?.apartment?.totalDebt ?? row?.debt ?? 0);
  return {
    id: row.id || row?.user?.id || `${apartmentNumber}-${row?.user?.email || first}`,
    fullName: `${first} ${last}`.trim() || row?.user?.email || 'Locatar',
    phone: row.phone || row?.user?.phone || 'Telefon indisponibil',
    email: row?.user?.email || row.email || 'Email indisponibil',
    role: row.type === 'OWNER' ? 'proprietar' : row.type === 'TENANT' ? 'chiriaș' : 'reprezentant',
    accountStatus: row?.user?.id ? 'cont creat' : 'fără cont',
    apartments: [apartmentNumber],
    debt,
  };
}

export default function AdminResidentsPage() {
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const [people, setPeople] = useState<CondoPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'fallback'>('fallback');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('toate');
  const [accountStatus, setAccountStatus] = useState('toate');
  const [withDebt, setWithDebt] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await adminStructureApi.listResidentProfiles({ page: 1, limit: 100 });
        const rows = Array.isArray(response.data?.data) ? response.data.data : Array.isArray(response.data) ? response.data : [];
        if (!active) return;
        setPeople(rows.length ? rows.map(normalizePerson) : fallbackCondoPeople);
        setSource(rows.length ? 'api' : 'fallback');
      } catch {
        if (!active) return;
        setPeople(fallbackCondoPeople);
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

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return people.filter((person) => {
      const matchesSearch =
        !needle ||
        person.fullName.toLowerCase().includes(needle) ||
        person.phone.toLowerCase().includes(needle) ||
        person.email.toLowerCase().includes(needle) ||
        person.apartments.some((apartment) => apartment.toLowerCase().includes(needle));
      const matchesRole = role === 'toate' || person.role === role;
      const matchesAccount = accountStatus === 'toate' || person.accountStatus === accountStatus;
      const matchesDebt = !withDebt || person.debt > 0;
      return matchesSearch && matchesRole && matchesAccount && matchesDebt;
    });
  }, [accountStatus, people, role, search, withDebt]);

  const summary = useMemo(
    () => ({
      total: people.length,
      owners: people.filter((person) => person.role === 'proprietar').length,
      withoutAccount: people.filter((person) => person.accountStatus === 'fără cont').length,
      withDebt: people.filter((person) => person.debt > 0).length,
    }),
    [people],
  );

  const cards = [
    { label: 'Total locatari', value: summary.total, icon: Users },
    { label: 'Proprietari', value: summary.owners, icon: UserRound },
    { label: 'Fără cont creat', value: summary.withoutAccount, icon: Mail },
    { label: 'Cu datorii', value: summary.withDebt, icon: MessageCircle },
  ];

  return (
    <div className="space-y-5 pb-4">
      <section className="rounded-[1.75rem] border border-border/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="inline-flex rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">Administrare bloc</p>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">Locatari</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Persoane conectate la apartamente: proprietari, locatari, chiriași, membri de familie și reprezentanți.
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
        <div className="grid gap-2 md:grid-cols-[1.5fr_1fr_1fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input className="input pl-9" placeholder="Caută nume, telefon, email sau apartament" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <select className="select" value={role} onChange={(event) => setRole(event.target.value)}>
            {roleOptions.map((item) => <option key={item} value={item}>{item === 'toate' ? 'Toate rolurile' : item}</option>)}
          </select>
          <select className="select" value={accountStatus} onChange={(event) => setAccountStatus(event.target.value)}>
            {accountOptions.map((item) => <option key={item} value={item}>{item === 'toate' ? 'Toate conturile' : item}</option>)}
          </select>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border/70 px-3 text-sm text-foreground">
            <input type="checkbox" checked={withDebt} onChange={(event) => setWithDebt(event.target.checked)} />
            Cu datorii
          </label>
        </div>
      </section>

      {loading ? <LoadingState label="Se încarcă locatarii..." rows={6} /> : null}

      <section className="space-y-3 md:hidden">
        {filtered.map((person) => <PersonCard key={person.id} person={person} locale={locale} />)}
      </section>

      <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white/90 shadow-[0_14px_40px_rgba(15,23,42,0.045)] md:block">
        <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Nume</span><span>Contact</span><span>Apartament</span><span>Rol</span><span>Datorie</span><span>Acțiuni</span>
        </div>
        {filtered.map((person) => (
          <div key={person.id} className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto] items-center gap-3 border-b border-border/50 px-4 py-3 text-sm last:border-b-0">
            <div>
              <p className="font-semibold text-foreground">{person.fullName}</p>
              <p className="text-xs text-muted-foreground">{person.accountStatus}</p>
            </div>
            <div className="text-muted-foreground">
              <p>{person.phone}</p>
              <p className="text-xs">{person.email}</p>
            </div>
            <span className="text-foreground">{person.apartments.map((apt) => `Ap. ${apt}`).join(', ')}</span>
            <span className="text-muted-foreground">{person.role}</span>
            <span className={person.debt > 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-700'}>{formatMdl(person.debt)}</span>
            <div className="flex gap-2">
              <Link href={`/${locale}/admin/residents/${person.id}`} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">Deschide</Link>
              <Link href={`/${locale}/admin/chat`} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">Mesaj</Link>
              <a href={`tel:${person.phone}`} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">Sună</a>
            </div>
          </div>
        ))}
      </section>

      {!loading && filtered.length === 0 ? (
        <div className="rounded-[1.35rem] border border-dashed border-border bg-white/80 p-8 text-center text-sm text-muted-foreground">
          Nu există locatari pentru filtrele selectate.
        </div>
      ) : null}
    </div>
  );
}

function PersonCard({ person, locale }: { person: CondoPerson; locale: string }) {
  return (
    <div className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">{person.fullName}</p>
          <p className="mt-1 text-xs text-muted-foreground">{person.role} • {person.accountStatus}</p>
        </div>
        <span className={person.debt > 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-700'}>{formatMdl(person.debt)}</span>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
        <p className="inline-flex items-center gap-2"><Phone className="h-4 w-4" />{person.phone}</p>
        <p className="inline-flex items-center gap-2"><Mail className="h-4 w-4" />{person.email}</p>
        <p>Apartamente: {person.apartments.map((apt) => `Ap. ${apt}`).join(', ')}</p>
      </div>
      <div className="mt-4 flex gap-2">
        <Link href={`/${locale}/admin/residents/${person.id}`} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-2xl border border-border/70 text-sm font-semibold text-foreground hover:bg-muted/60">Deschide</Link>
        <Link href={`/${locale}/admin/chat`} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-2xl border border-border/70 text-sm font-semibold text-foreground hover:bg-muted/60">Mesaj</Link>
        <a href={`tel:${person.phone}`} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-2xl border border-border/70 text-sm font-semibold text-foreground hover:bg-muted/60">Sună</a>
      </div>
    </div>
  );
}
