'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  Bell,
  Building2,
  CreditCard,
  Database,
  FileText,
  Gauge,
  Import,
  LineChart,
  Lock,
  Menu,
  MessageCircle,
  Phone,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import { accessRequestsApi } from '@/lib/api';

type PageKind = 'home' | 'platform' | 'admins' | 'residents' | 'features' | 'pricing' | 'contact' | 'access' | 'security' | 'help';

function useLocale() {
  const params = useParams<{ locale?: string }>();
  return typeof params?.locale === 'string' ? params.locale : 'ro';
}

function localized(locale: string, href: string) {
  if (href.startsWith('http')) return href;
  return `/${locale}${href === '/' ? '' : href}`;
}

export function PublicNavbar() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const links = [
    ['Platformă', '/platforma'],
    ['Funcționalități', '/functionalitati'],
    ['Administratori', '/pentru-administratori'],
    ['Locatari', '/pentru-locatari'],
    ['Contact', '/contact'],
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#F7F8F6]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href={localized(locale, '/')} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0F172A] text-sm font-semibold text-white shadow-sm">E</span>
          <span className="text-lg font-semibold tracking-tight text-slate-950">Espace</span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map(([label, href]) => (
            <Link key={href} href={localized(locale, href)} className="text-sm font-medium text-slate-600 hover:text-slate-950">
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Link href={localized(locale, '/login')} prefetch={false} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white hover:text-slate-950">Intră în platformă</Link>
          <Link href={localized(locale, '/cere-acces')} className="rounded-full bg-[#145C55] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#104A45]">Cere acces</Link>
        </div>
        <button onClick={() => setOpen((value) => !value)} className="md:hidden" aria-label="Meniu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-slate-200 bg-[#F7F8F6] px-4 py-4 md:hidden">
          <div className="grid gap-2">
            {links.map(([label, href]) => <Link key={href} href={localized(locale, href)} className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">{label}</Link>)}
            <Link href={localized(locale, '/login')} prefetch={false} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">Intră în platformă</Link>
            <Link href={localized(locale, '/cere-acces')} className="rounded-2xl bg-[#145C55] px-3 py-2 text-sm font-semibold text-white">Cere acces</Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function PublicFooter() {
  const locale = useLocale();
  const links = [
    ['Login', '/login'],
    ['Cere acces', '/cere-acces'],
    ['Contact', '/contact'],
  ] as const;
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="max-w-md">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#0F172A] text-sm font-semibold text-white">E</span>
            <span className="font-semibold text-slate-950">Espace</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">Platformă pentru administrarea condominiilor.</p>
        </div>
        <nav className="flex flex-wrap gap-3">
          {links.map(([label, href]) => (
            <Link key={href} href={localized(locale, href)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-[#145C55]/30 hover:text-[#145C55]">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function CookieBanner() {
  const locale = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('espace_cookie_ack') !== 'true') {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-600">
          Folosim cookies necesare pentru functionarea aplicatiei. Cookies optionale vor fi folosite doar daca sunt activate.
        </p>
        <div className="flex gap-2">
          <Link href={localized(locale, '/cookies')} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
            Detalii
          </Link>
          <button
            onClick={() => {
              localStorage.setItem('espace_cookie_ack', 'true');
              setVisible(false);
            }}
            className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
          >
            Am inteles
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductMockup() {
  const modules = [
    ['Locatari', 'Profil, apartamente, acces portal'],
    ['Facturi', 'Draft lunar, publicare, solduri'],
    ['Contoare', 'Citiri, verificare, istoric'],
    ['Connect', 'Mesaje legate de apartament'],
  ];
  return (
    <div className="relative rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.45)]">
      <div className="grid overflow-hidden rounded-[22px] border border-slate-200 bg-[#F7F8F6] md:grid-cols-[170px_1fr]">
        <aside className="hidden bg-[#0F172A] p-4 text-white md:block">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white text-xs font-semibold text-[#145C55]">ES</span>
            <span className="text-sm font-semibold">Espace</span>
          </div>
          <div className="mt-8 space-y-2 text-xs text-white/60">
            {['Dashboard', 'Facturi', 'Contoare', 'Cereri'].map((item, index) => (
              <div key={item} className={`rounded-2xl px-3 py-2 ${index === 1 ? 'bg-white/10 text-white' : ''}`}>{item}</div>
            ))}
          </div>
        </aside>
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#145C55]">Workspace APC</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Operațiuni lunare într-un singur loc</h3>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">Preview produs</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {modules.map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-950">Flux facturare</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-4">
              {['Citiri', 'Draft', 'Revizuire', 'Publicare'].map((item) => (
                <span key={item} className="rounded-full bg-[#E7F3EF] px-3 py-2 text-center font-semibold text-[#145C55]">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow ? <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{eyebrow}</p> : null}
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
      {text ? <p className="mt-4 text-base leading-7 text-slate-600">{text}</p> : null}
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text, badge }: { icon: any; title: string; text: string; badge?: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span>
        {badge ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{badge}</span> : null}
      </div>
      <h3 className="mt-4 font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </article>
  );
}

function CTASection() {
  const locale = useLocale();
  return (
    <section className="bg-[#0F172A] py-20 text-white">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Vrei să testezi Espace pentru asociația ta?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-300">Trimite o cerere și discutăm pașii pentru activarea asociației în Espace.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={localized(locale, '/cere-acces')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#145C55] px-5 font-semibold text-white hover:bg-[#176B60]">
            Cere acces <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href={localized(locale, '/login')} prefetch={false} className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-white px-5 font-semibold text-slate-950 hover:bg-white/90">
            Intră în cont
          </Link>
        </div>
      </div>
    </section>
  );
}

export function AccessRequestForm({ source = 'ACCESS_REQUEST', compact = false }: { source?: 'ACCESS_REQUEST' | 'CONTACT_PAGE' | 'PUBLIC_WEBSITE'; compact?: boolean }) {
  const [form, setForm] = useState({
    contactName: '',
    phone: '',
    email: '',
    city: '',
    type: 'APC',
    associationName: '',
    apcCode: '',
    address: '',
    apartmentsCount: '',
    contactRole: '',
    message: '',
    consent: false,
    website: '',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!form.contactName.trim() || !form.phone.trim() || !form.city.trim()) {
        setError('Completeaza numele, telefonul si orasul.');
        return;
      }
      await accessRequestsApi.createAccessRequest({
        ...form,
        contactName: form.contactName.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        type: form.type as any,
        apartmentsCount: form.apartmentsCount ? Number(form.apartmentsCount) : undefined,
        email: form.email || undefined,
        associationName: form.associationName || undefined,
        apcCode: form.apcCode || undefined,
        address: form.address || undefined,
        contactRole: form.contactRole || undefined,
        message: form.message || undefined,
        source,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Cererea nu a putut fi trimisa.');
    } finally {
      setSaving(false);
    }
  };
  if (done) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <h3 className="font-semibold text-emerald-950">Cererea a fost trimisa</h3>
        <p className="mt-2 text-sm text-emerald-800">Cererea a fost trimisa. Te vom contacta pentru configurarea accesului.</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <input className="hidden" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} />
      <div className={`grid gap-3 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2'}`}>
        <input required placeholder="Nume persoană contact" value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <input required placeholder="Telefon" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <input type="email" placeholder="Email opțional" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <input required placeholder="Oraș" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15">
          <option value="APC">APC / asociatie</option>
          <option value="ADMINISTRATOR">Administrator</option>
          <option value="PROPERTY_MANAGER">Property manager</option>
          <option value="OTHER">Altceva</option>
        </select>
        <input placeholder="Denumire APC/asociație opțional" value={form.associationName} onChange={(e) => setForm((p) => ({ ...p, associationName: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <input placeholder="Cod APC opțional" value={form.apcCode} onChange={(e) => setForm((p) => ({ ...p, apcCode: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <input placeholder="Adresă opțional" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <input type="number" min={1} placeholder="Număr aproximativ apartamente" value={form.apartmentsCount} onChange={(e) => setForm((p) => ({ ...p, apartmentsCount: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <input placeholder="Rol opțional" value={form.contactRole} onChange={(e) => setForm((p) => ({ ...p, contactRole: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
      </div>
      <textarea placeholder="Mesaj opțional" value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} className="min-h-[120px] w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input required type="checkbox" checked={form.consent} onChange={(e) => setForm((p) => ({ ...p, consent: e.target.checked }))} className="mt-1" />
        Sunt de acord sa fiu contactat pentru discutarea activarii asociatiei in Espace.
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button disabled={saving} className="inline-flex h-11 items-center justify-center rounded-full bg-[#145C55] px-5 text-sm font-semibold text-white hover:bg-[#104A45] disabled:opacity-60">
        {saving ? 'Se trimite...' : 'Trimite cererea'}
      </button>
    </form>
  );
}

function HomePageContent() {
  const locale = useLocale();
  const moduleCards = [
    [Users, 'Locatari & apartamente', 'Evidență pentru blocuri, scări, apartamente, proprietari și locatari.'],
    [ReceiptText, 'Facturi & solduri', 'Flux lunar pentru drafturi, publicare facturi, solduri și istoric financiar.'],
    [Gauge, 'Contoare & citiri', 'Contoare, citiri lunare și verificări înainte de facturare.'],
    [MessageCircle, 'Cereri locatari', 'Solicitări urmărite clar, cu statusuri și răspunsuri din partea administrației.'],
    [Bell, 'Documente & anunțuri', 'Comunicări, avizier și documente importante pentru asociație.'],
    [ShieldCheck, 'Espace Connect', 'Conversații legate de apartament, factură, contor, plată sau cerere.'],
  ] as const;
  const roles = [
    [ShieldCheck, 'Superadmin Espace', 'Procesează APC-uri, onboarding, contracte și status client.'],
    [Building2, 'Administrator APC', 'Gestionează blocuri, locatari, facturi, plăți, contoare și cereri.'],
    [Smartphone, 'Locatar', 'Vede facturi, sold, plăți, citiri și poate trimite cereri.'],
  ] as const;
  const moldovaItems = [
    'APC / condominiu',
    'Blocuri, scări, apartamente',
    'Facturi lunare',
    'Contoare și citiri',
    'Comunicare cu locatarii',
  ];
  return (
    <>
      <section className="relative overflow-hidden bg-[#F7F8F6] py-16 md:py-24">
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#E7F3EF] to-transparent" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
          <div className="max-w-2xl">
            <p className="inline-flex rounded-full border border-[#145C55]/15 bg-white px-3 py-1 text-sm font-semibold text-[#145C55] shadow-sm">
              SaaS pentru administrarea condominiilor
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Platformă modernă pentru administrarea condominiilor
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Espace ajută administratorii APC să gestioneze locatari, apartamente, contoare, facturi, plăți, cereri și comunicarea într-un singur loc.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={localized(locale, '/cere-acces')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#145C55] px-6 text-sm font-semibold text-white shadow-sm hover:bg-[#104A45]">
                Cere acces <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={localized(locale, '/login')} prefetch={false} className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-800 shadow-sm hover:border-[#145C55]/30 hover:text-[#145C55]">
                Intră în platformă
              </Link>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-500">
              Construit pentru procese reale de administrare: evidență, facturare, solduri, citiri și comunicare.
            </p>
          </div>
          <ProductMockup />
        </div>
      </section>

      <section className="bg-white py-20">
        <SectionHeader eyebrow="Module Espace" title="Procesele importante, puse într-un sistem clar." text="Cardurile de mai jos descriu capabilitățile produsului, fără date demonstrative sau statistici inventate." />
        <div className="mx-auto mt-10 grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
          {moduleCards.map(([Icon, title, text]) => (
            <FeatureCard key={title} icon={Icon} title={title} text={text} />
          ))}
        </div>
      </section>

      <section className="bg-[#F7F8F6] py-20">
        <SectionHeader eyebrow="Pentru fiecare rol" title="Superadmin, Administrator și Locatar în aceeași platformă." />
        <div className="mx-auto mt-10 grid max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {roles.map(([Icon, title, text]) => (
            <article key={title} className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E7F3EF] text-[#145C55]">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#145C55]">Pentru Republica Moldova</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              Gândit pentru modul în care se administrează APC-urile și condominiile.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Espace organizează activitatea de zi cu zi pentru asociații care lucrează cu blocuri, scări, apartamente, facturi lunare, contoare și comunicare constantă cu locatarii.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {moldovaItems.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-[#F7F8F6] p-5 text-sm font-semibold text-slate-800">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}

function FeatureGrid({ compact = false }: { compact?: boolean }) {
  const features = [
    [Building2, 'CRM apartamente', 'Evidenta organizata pentru fiecare apartament.'],
    [Users, 'CRM locatari', 'Contacte, roluri, portal si preferinte.'],
    [ReceiptText, 'Tarife', 'Reguli clare pentru servicii si calcul lunar.'],
    [FileText, 'Facturare lunara', 'Draft, revizuire, blocare si facturi finale.'],
    [Banknote, 'Plati manuale', 'Inregistrare plati si solduri.'],
    [CreditCard, 'Reconciliere', 'Pregatit pentru verificari si potrivire plati.'],
    [Gauge, 'Contoare', 'Contoare, indici si consum.'],
    [LineChart, 'Rapoarte', 'Financiare si consum.'],
    [Bell, 'Anunturi', 'Avizier pentru locatari.'],
    [MessageCircle, 'Solicitari', 'Cereri si timeline de raspuns.'],
    [Import, 'Import CSV', 'Migrare date controlata.'],
    [Database, 'Data Quality', 'Verificari inainte de facturare.'],
    [Lock, 'Audit Log', 'Istoric actiuni sensibile.'],
    [ShieldCheck, 'Roluri si permisiuni', 'Acces pe responsabilitati.'],
    [Smartphone, 'PWA mobile', 'Portal locatar pregatit pentru mobil.'],
    [CreditCard, 'Plati online', 'In pregatire.'],
    [FileText, 'PDF documente', 'Disponibil pentru print si salvare.'],
    [Bell, 'Email/SMS', 'Configurabil prin provider.'],
  ] as const;
  return (
    <div className={`mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 lg:px-8 ${compact ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
      {features.map(([Icon, title, text]) => <FeatureCard key={title} icon={Icon} title={title} text={text} badge={text === 'In pregatire.' ? 'in pregatire' : undefined} />)}
    </div>
  );
}

function PricingPreview() {
  const locale = useLocale();
  const plans = [
    ['Starter', 'Pentru asociatii mici', ['Apartamente si locatari', 'Facturare interna', 'Portal locatar']],
    ['Standard', 'Pentru administrare lunara completa', ['Contoare', 'Data Quality', 'Rapoarte']],
    ['Pro', 'Pentru asociatii cu procese avansate', ['Roluri staff', 'Import/export', 'Audit log']],
    ['Enterprise', 'Pentru cerinte personalizate', ['Suport implementare', 'Configurare dedicata', 'Plan personalizat']],
  ] as const;
  return (
    <section className="bg-white py-20">
      <SectionHeader title="Planuri pentru asociatii mici si mari." text="Pretul se discuta in functie de marimea asociatiei si modulele necesare." />
      <div className="mx-auto mt-10 grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map(([name, text, items]) => <div key={name} className="rounded-lg border border-slate-200 bg-white p-5"><h3 className="text-xl font-semibold text-slate-950">{name}</h3><p className="mt-2 text-sm text-slate-500">{text}</p><p className="mt-4 font-semibold text-slate-950">Oferta personalizata</p><ul className="mt-4 space-y-2 text-sm text-slate-600">{items.map((item) => <li key={item}>• {item}</li>)}</ul><Link href={localized(locale, '/cere-acces')} className="mt-5 inline-flex rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Cere acces</Link></div>)}
      </div>
    </section>
  );
}

function PlatformPage() {
  return (
    <section className="bg-white py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><SectionHeader title="Platforma Espace" text="Un sistem SaaS pentru administrarea APC: Superadmin gestioneaza clientii si abonamentele, Admin/Staff opereaza asociatia, iar Resident foloseste portalul." /><div className="mt-10 grid gap-4 md:grid-cols-3"><FeatureCard icon={ShieldCheck} title="Superadmin" text="Planuri SaaS, abonamente, cereri clienti, monitorizare si suport." /><FeatureCard icon={Building2} title="Admin/Staff" text="Apartamente, locatari, tarife, facturi, plati, contoare si rapoarte." /><FeatureCard icon={Smartphone} title="Resident" text="Facturi, plati, contoare, avizier, solicitari si profil." /></div><div className="mt-12"><ProductMockup /></div></div></section>
  );
}

function AdminsPage() {
  const locale = useLocale();
  return <section className="bg-white py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><SectionHeader title="Pentru administratori APC" text="Espace ajuta administratorii sa lucreze organizat, cu verificari inainte de facturare si un flux lunar clar." /><div className="mt-10"><FeatureGrid compact /></div><div className="mt-10 text-center"><Link href={localized(locale, '/cere-acces')} className="rounded-md bg-emerald-600 px-5 py-3 font-semibold text-white">Solicita activarea asociatiei</Link></div></div></section>;
}

function ResidentsPage() {
  const items = ['Facturi', 'Plati', 'Contoare', 'Avizier', 'Solicitari', 'Notificari', 'Profil'];
  return <section className="bg-white py-20"><div className="mx-auto max-w-5xl px-4"><SectionHeader title="Pentru locatari" text="Portal simplu, clar si usor de folosit pe telefon." /><div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-white p-5 font-semibold text-slate-800">{item}</div>)}</div><p className="mt-10 text-center text-slate-600">Cere administratorului activarea in Espace.</p></div></section>;
}

function ContactPage({ access = false }: { access?: boolean }) {
  const locale = useLocale();
  return (
    <section className="bg-[#F7F8F6] py-16">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#145C55]">Espace</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{access ? 'Cere acces pentru asociația ta' : 'Contactează Espace'}</h1>
          <p className="mt-4 leading-7 text-slate-600">{access ? 'Trimite datele de contact și discutăm pașii pentru activarea asociației în Espace.' : 'Pentru asociații interesate de activare, completează formularul și vei fi contactat pentru pașii următori.'}</p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-card"><Phone className="mb-3 h-5 w-5 text-[#145C55]" />Implementarea se face asistat, ca datele asociației să fie configurate corect de la început.</div>
          {!access ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-card">
              Pentru întrebări despre confidențialitate, termeni sau securitate, consultă <Link href={localized(locale, '/legal')} className="font-semibold text-[#145C55]">Legal & Trust</Link>.
            </div>
          ) : null}
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-card"><AccessRequestForm source={access ? 'ACCESS_REQUEST' : 'CONTACT_PAGE'} /></div>
      </div>
    </section>
  );
}

function SecurityPage() {
  return <section className="bg-white py-20"><div className="mx-auto max-w-6xl px-4"><SectionHeader title="Securitate si control" text="Espace separa rolurile, limiteaza accesul si pastreaza audit pentru actiunile importante." /><div className="mt-10 grid gap-4 md:grid-cols-3"><FeatureCard icon={Lock} title="Acces pe roluri" text="Admin, Staff, Resident si Superadmin au suprafete separate." /><FeatureCard icon={ShieldCheck} title="Audit" text="Actiunile sensibile pot fi urmarite in istoric." /><FeatureCard icon={Database} title="Date organizate" text="Datele asociatiei sunt operate controlat, fara stergeri automate peste limite." /></div></div></section>;
}

function HelpLandingPage() {
  const locale = useLocale();
  return <section className="bg-white py-20"><div className="mx-auto max-w-4xl px-4 text-center"><h1 className="text-4xl font-semibold text-slate-950">Ajutor Espace</h1><p className="mt-4 text-slate-600">Ghidurile produsului sunt disponibile in Help Center.</p><Link href={localized(locale, '/help')} className="mt-8 inline-flex rounded-md bg-emerald-600 px-5 py-3 font-semibold text-white">Deschide Help Center</Link></div></section>;
}

export function PublicWebsitePage({ page = 'home' }: { page?: PageKind }) {
  return (
    <div className="min-h-screen bg-[#F7F8F6] text-slate-950">
      <PublicNavbar />
      {page === 'home' ? <HomePageContent /> : null}
      {page === 'platform' ? <PlatformPage /> : null}
      {page === 'admins' ? <AdminsPage /> : null}
      {page === 'residents' ? <ResidentsPage /> : null}
      {page === 'features' ? <section className="bg-white py-20"><SectionHeader title="Functionalitati Espace" text="Module disponibile si componente in pregatire." /><div className="mt-10"><FeatureGrid /></div></section> : null}
      {page === 'pricing' ? <PricingPreview /> : null}
      {page === 'contact' ? <ContactPage /> : null}
      {page === 'access' ? <ContactPage access /> : null}
      {page === 'security' ? <SecurityPage /> : null}
      {page === 'help' ? <HelpLandingPage /> : null}
      {page !== 'home' && page !== 'access' && page !== 'contact' ? <CTASection /> : null}
      <PublicFooter />
      <CookieBanner />
    </div>
  );
}
