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
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Database,
  FileText,
  Gauge,
  Home,
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
import { customerRequestsApi } from '@/lib/api';

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
    ['Platforma', '/platforma'],
    ['Administratori', '/pentru-administratori'],
    ['Locatari', '/pentru-locatari'],
    ['Functionalitati', '/functionalitati'],
    ['Preturi', '/preturi'],
    ['Contact', '/contact'],
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href={localized(locale, '/')} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white">E</span>
          <span className="text-lg font-semibold text-slate-950">Espace</span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map(([label, href]) => (
            <Link key={href} href={localized(locale, href)} className="text-sm font-medium text-slate-600 hover:text-slate-950">
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Link href={localized(locale, '/login')} className="text-sm font-medium text-slate-600 hover:text-slate-950">Autentificare</Link>
          <Link href={localized(locale, '/cere-acces')} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Cere acces</Link>
        </div>
        <button onClick={() => setOpen((value) => !value)} className="md:hidden" aria-label="Meniu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <div className="grid gap-2">
            {links.map(([label, href]) => <Link key={href} href={localized(locale, href)} className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">{label}</Link>)}
            <Link href={localized(locale, '/cere-acces')} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Cere acces</Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function PublicFooter() {
  const locale = useLocale();
  const cols = [
    ['Platforma', [['Platforma', '/platforma'], ['Functionalitati', '/functionalitati'], ['Securitate', '/securitate']]],
    ['Pentru administratori', [['Administratori', '/pentru-administratori'], ['Preturi', '/preturi'], ['Cere acces', '/cere-acces']]],
    ['Pentru locatari', [['Locatari', '/pentru-locatari'], ['Ajutor', '/ajutor'], ['Contact', '/contact']]],
    ['Legal', [['Securitate', '/securitate'], ['Confidentialitate', '/confidentialitate'], ['Termeni', '/termeni'], ['Cookies', '/cookies'], ['Prelucrarea datelor', '/prelucrarea-datelor']]],
    ['Contact', [['Contacteaza Espace', '/contact'], ['Incepe', '/incepe']]],
  ] as const;
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-6 lg:px-8">
        <div>
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-white">E</span><span className="font-semibold text-slate-950">Espace</span></div>
          <p className="mt-4 text-sm leading-6 text-slate-500">Platforma SaaS pentru administrarea APC-urilor din Republica Moldova.</p>
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
            <div className="mt-3 grid gap-2">
              {links.map(([label, href]) => <Link key={href} href={localized(locale, href)} className="text-sm text-slate-500 hover:text-slate-950">{label}</Link>)}
            </div>
          </div>
        ))}
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
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/70">
      <div className="rounded-lg bg-slate-50 p-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-slate-300" />
          <span className="h-3 w-3 rounded-full bg-slate-300" />
          <span className="h-3 w-3 rounded-full bg-slate-300" />
          <span className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-xs text-slate-400">espace.md/admin/billing</span>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ['Apartamente', '142', Building2],
            ['Facturi luna', '89', FileText],
            ['Plati', '156 420 MDL', CreditCard],
            ['Data Quality', '82/100', ShieldCheck],
          ].map(([label, value, Icon]) => (
            <div key={label as string} className="rounded-lg bg-white p-4">
              <Icon className="h-4 w-4 text-emerald-600" />
              <p className="mt-3 text-xs text-slate-500">{label as string}</p>
              <p className="text-xl font-semibold text-slate-950">{value as string}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg bg-white p-4">
            <p className="font-semibold text-slate-950">Facturare lunara</p>
            {['Verificari initiale', 'Calcul draft', 'Revizuire', 'Facturi finale'].map((item, index) => (
              <div key={item} className="mt-3 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">{index + 1}</span>
                <span className="text-sm text-slate-600">{item}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-white p-4">
            <p className="font-semibold text-slate-950">Portal locatar</p>
            <div className="mt-3 rounded-lg bg-slate-950 p-4 text-white">
              <p className="text-xs text-slate-300">Sold curent</p>
              <p className="text-2xl font-semibold">1 240 MDL</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <span className="rounded-md bg-slate-100 p-2 text-slate-700">Facturi</span>
              <span className="rounded-md bg-slate-100 p-2 text-slate-700">Indici</span>
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
    <section className="bg-slate-950 py-20 text-white">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="text-3xl font-semibold md:text-4xl">Vrei sa administrezi asociatia mai clar?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-300">Trimite o cerere si discutam pasii pentru activarea asociatiei in Espace.</p>
        <Link href={localized(locale, '/cere-acces')} className="mt-8 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-500">
          Cere acces <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export function AccessRequestForm({ source = 'ACCESS_REQUEST', compact = false }: { source?: 'ACCESS_REQUEST' | 'CONTACT_PAGE' | 'PUBLIC_WEBSITE'; compact?: boolean }) {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    associationName: '',
    associationCode: '',
    address: '',
    apartmentsCount: '',
    role: '',
    currentManagementMethod: '',
    interestedModules: [] as string[],
    preferredContactMethod: 'PHONE',
    message: '',
    consent: false,
    website: '',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const modules = ['Facturi', 'Plati', 'Contoare', 'Portal locatar', 'Rapoarte', 'Import date', 'Altceva'];
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await customerRequestsApi.createPublic({
        ...form,
        apartmentsCount: form.apartmentsCount ? Number(form.apartmentsCount) : undefined,
        email: form.email || undefined,
        associationCode: form.associationCode || undefined,
        address: form.address || undefined,
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
        <p className="mt-2 text-sm text-emerald-800">Vei fi contactat pentru pasii urmatori de activare.</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <input className="hidden" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} />
      <div className={`grid gap-3 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2'}`}>
        <input required placeholder="Nume si prenume" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input required placeholder="Telefon" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="email" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input required placeholder="Denumirea asociatiei" value={form.associationName} onChange={(e) => setForm((p) => ({ ...p, associationName: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Cod asociatie (optional)" value={form.associationCode} onChange={(e) => setForm((p) => ({ ...p, associationCode: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="number" min={1} placeholder="Numar apartamente" value={form.apartmentsCount} onChange={(e) => setForm((p) => ({ ...p, apartmentsCount: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm">
          <option value="">Rolul tau</option>
          <option>Administrator APC</option>
          <option>Membru comitet</option>
          <option>Locatar</option>
          <option>Altul</option>
        </select>
        <select value={form.currentManagementMethod} onChange={(e) => setForm((p) => ({ ...p, currentManagementMethod: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm">
          <option value="">Cum administrati acum?</option>
          <option>Excel</option>
          <option>Documente fizice</option>
          <option>Alt software</option>
          <option>Nu stiu</option>
        </select>
      </div>
      <input placeholder="Adresa (optional)" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm" />
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Module de interes</p>
        <div className="flex flex-wrap gap-2">
          {modules.map((item) => (
            <label key={item} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={form.interestedModules.includes(item)} onChange={(e) => setForm((p) => ({ ...p, interestedModules: e.target.checked ? [...p.interestedModules, item] : p.interestedModules.filter((value) => value !== item) }))} />
              {item}
            </label>
          ))}
        </div>
      </div>
      <select value={form.preferredContactMethod} onChange={(e) => setForm((p) => ({ ...p, preferredContactMethod: e.target.value }))} className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm">
        <option value="PHONE">Telefon</option>
        <option value="EMAIL">Email</option>
        <option value="WHATSAPP">WhatsApp</option>
        <option value="TELEGRAM">Telegram</option>
      </select>
      <textarea placeholder="Mesaj optional" value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} className="min-h-[120px] w-full rounded-md border border-slate-200 p-3 text-sm" />
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input required type="checkbox" checked={form.consent} onChange={(e) => setForm((p) => ({ ...p, consent: e.target.checked }))} className="mt-1" />
        Sunt de acord sa fiu contactat pentru discutarea activarii asociatiei in Espace.
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button disabled={saving} className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
        {saving ? 'Se trimite...' : 'Trimite cererea'}
      </button>
    </form>
  );
}

function HomePageContent() {
  const locale = useLocale();
  const problems = ['Excel-uri greu de mentinut', 'Facturi si plati greu de urmarit', 'Indici colectati manual', 'Locatari greu de informat', 'Restante greu de verificat', 'Erori inainte de facturare'];
  const workflow = ['Verificari initiale', 'Tarife', 'Contoare', 'Calcul draft', 'Revizuire', 'Blocare draft', 'Facturi finale', 'Plati si reconciliere'];
  return (
    <>
      <section className="bg-white py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">Platforma functionala pentru APC-uri din Moldova</p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">Administrarea asociatiei tale, intr-o platforma clara si moderna.</h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">Espace centralizeaza apartamentele, locatarii, facturile, platile, contoarele, solicitarile si comunicarea cu locatarii pentru APC-uri care vor ordine si transparenta.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={localized(locale, '/cere-acces')} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700">Cere acces <ArrowRight className="h-4 w-4" /></Link>
              <Link href={localized(locale, '/functionalitati')} className="rounded-md border border-slate-200 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50">Vezi functionalitatile</Link>
            </div>
          </div>
          <ProductMockup />
        </div>
      </section>
      <section className="border-y border-slate-200 bg-slate-50 py-8">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {['Pentru APC-uri din Moldova', 'Facturare interna', 'Portal locatar', 'Onboarding asistat'].map((item) => <div key={item} className="rounded-lg bg-white p-4 text-sm font-semibold text-slate-700">{item}</div>)}
        </div>
      </section>
      <section className="bg-white py-20">
        <SectionHeader title="Administrarea clasica inseamna timp pierdut si date imprastiate." text="Espace este construit pentru problemele practice ale administratorilor APC." />
        <div className="mx-auto mt-10 grid max-w-6xl gap-3 px-4 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-white p-5 text-slate-700">{item}</div>)}
        </div>
      </section>
      <section className="bg-slate-50 py-20">
        <SectionHeader title="Espace aduce toate procesele intr-un singur loc." />
        <FeatureGrid compact />
      </section>
      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div><SectionHeader eyebrow="Admin workspace" title="Un workspace complet pentru administrator." text="Administratorul vede rapid ce trebuie verificat: contacte lipsa, tarife, indici, drafturi de facturi, plati si solduri restante." /></div>
          <ProductMockup />
        </div>
      </section>
      <section className="bg-slate-50 py-20">
        <SectionHeader eyebrow="Portal locatar" title="Un portal simplu pentru locatari." text="Locatarii pot vedea facturile, istoricul platilor, anunturile si pot transmite solicitari sau indici direct din portal." />
        <div className="mx-auto mt-10 grid max-w-5xl gap-3 px-4 sm:grid-cols-2 lg:grid-cols-3">
          {['Facturile mele', 'Platile mele', 'Contoarele mele', 'Avizier', 'Solicitari', 'Profil'].map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-white p-5 font-semibold text-slate-800">{item}</div>)}
        </div>
      </section>
      <section className="bg-white py-20">
        <SectionHeader title="Facturare lunara controlata pas cu pas." />
        <div className="mx-auto mt-10 grid max-w-6xl gap-3 px-4 sm:grid-cols-2 lg:grid-cols-4">
          {workflow.map((item, index) => <div key={item} className="rounded-lg border border-slate-200 p-5"><span className="text-sm font-semibold text-emerald-700">{index + 1}</span><p className="mt-2 font-semibold text-slate-950">{item}</p></div>)}
        </div>
      </section>
      <section className="bg-slate-50 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div><SectionHeader eyebrow="Data Quality" title="Mai putine greseli inainte de facturare." text="Espace evidentiaza datele lipsa sau inconsistente inainte sa afecteze facturarea." /></div>
          <div className="rounded-lg border border-slate-200 bg-white p-6"><p className="text-sm text-slate-500">Data Quality Score</p><p className="mt-2 text-5xl font-semibold text-emerald-600">82/100</p><div className="mt-5 space-y-2 text-sm"><p>1 problema critica</p><p>12 warnings</p><p>Quick fixes disponibile</p></div></div>
        </div>
      </section>
      <section className="bg-white py-20">
        <SectionHeader title="Configurare asistata pentru prima asociatie." text="Primele date - apartamente, locatari, tarife, contoare si procesul lunar - pot fi configurate ghidat, ca sistemul sa fie pregatit corect." />
        <div className="mt-8 text-center"><Link href={localized(locale, '/cere-acces')} className="rounded-md bg-emerald-600 px-5 py-3 font-semibold text-white">Cere acces pentru asociatia ta</Link></div>
      </section>
      <PricingPreview />
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
    <section className="bg-slate-50 py-16">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold text-slate-950">{access ? 'Cere acces pentru asociatia ta' : 'Contacteaza Espace'}</h1>
          <p className="mt-4 leading-7 text-slate-600">{access ? 'Trimite datele de contact si discutam pasii pentru activarea asociatiei in Espace.' : 'Pentru asociatii interesate de activare, completeaza formularul si vei fi contactat pentru pasii urmatori.'}</p>
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600"><Phone className="mb-3 h-5 w-5 text-emerald-700" />Implementarea se face asistat, ca datele asociatiei sa fie configurate corect de la inceput.</div>
          {!access ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Pentru intrebari despre confidentialitate, termeni sau securitate, consulta <Link href={localized(locale, '/legal')} className="font-semibold text-emerald-700">Legal & Trust</Link>.
            </div>
          ) : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5"><AccessRequestForm source={access ? 'ACCESS_REQUEST' : 'CONTACT_PAGE'} /></div>
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
    <div className="min-h-screen bg-white text-slate-950">
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
