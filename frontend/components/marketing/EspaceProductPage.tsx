'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Home,
  MessageSquareText,
  ReceiptText,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';

type ProductPageProps = {
  active?: 'home' | 'features';
};

const featureCards = [
  {
    icon: Building2,
    title: 'Apartamente și scări',
    text: 'Evidență clară pentru blocuri, scări, apartamente, suprafețe, proprietari și solduri.',
  },
  {
    icon: Users,
    title: 'Locatari și proprietari',
    text: 'Contacte, roluri, invitații și acces diferențiat pentru administrație și rezidenți.',
  },
  {
    icon: Gauge,
    title: 'Contoare și citiri',
    text: 'Apă, gaz, electricitate și încălzire, cu urmărirea citirilor lipsă înainte de facturare.',
  },
  {
    icon: ReceiptText,
    title: 'Plăți și datorii',
    text: 'Solduri lunare, încasări, restanțe și rapoarte pregătite pentru administratori.',
  },
  {
    icon: ClipboardList,
    title: 'Cereri și intervenții',
    text: 'Solicitări de reparații, sesizări, priorități și statusuri vizibile pentru echipă.',
  },
  {
    icon: Bell,
    title: 'Avizier digital',
    text: 'Anunțuri pentru asociație, scară sau apartament, cu istoric și comunicare consistentă.',
  },
  {
    icon: MessageSquareText,
    title: 'Mesaje',
    text: 'Conversații organizate între administrație și locatari, fără zgomotul grupurilor informale.',
  },
  {
    icon: Settings,
    title: 'Setări APC',
    text: 'Date fiscale, conturi bancare, configurări de facturare și control pentru echipă.',
  },
];

const dashboardStats = [
  ['Total apartamente', '142'],
  ['Datorii totale', '86,450 MDL'],
  ['Citiri lipsă', '23'],
  ['Cereri deschise', '12'],
];

function Header({ active }: { active: ProductPageProps['active'] }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d1211]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/ro" className="flex items-center gap-3 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#0d1211]">
            <Home className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold">Espace</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-white/72 md:flex" aria-label="Navigare marketing">
          <Link className={active === 'home' ? 'text-white' : 'hover:text-white'} href="/ro">
            Acasă
          </Link>
          <Link className={active === 'features' ? 'text-white' : 'hover:text-white'} href="/ro/features">
            Funcționalități
          </Link>
          <Link className="hover:text-white" href="/ro/pricing">
            Prețuri
          </Link>
          <Link className="hover:text-white" href="/ro/demo-request">
            Demo
          </Link>
        </nav>
        <Link
          href="/ro/demo-request"
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-[#0d1211] shadow-sm transition hover:bg-teal-50"
        >
          Cere demo
        </Link>
      </div>
    </header>
  );
}

function DashboardMockup() {
  return (
    <div className="rounded-lg border border-white/12 bg-white/[0.07] p-3 shadow-2xl shadow-black/30">
      <div className="overflow-hidden rounded-md border border-white/10 bg-[#f7f5f0] text-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-xs text-slate-500">Asociatia Demo · Chisinau</p>
            <p className="text-sm font-semibold">Panou administrator</p>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">Mai 2026</span>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {dashboardStats.map(([label, value]) => (
            <div key={label} className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-3 px-4 pb-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Apt. 45</p>
                <p className="mt-1 text-sm text-slate-500">Scara 2 · Etaj 6 · 72.4 m²</p>
              </div>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">1,240 MDL</span>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-slate-500">Proprietar</p>
                <p className="font-medium">Popescu Ion</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-slate-500">Contoare</p>
                <p className="font-medium">2 actualizate, 1 lipsa</p>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <p className="font-semibold">Cereri active</p>
            <div className="mt-3 space-y-2">
              {['Presiune scazuta la apa', 'Bec ars in hol', 'Curatenie parter'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-md bg-slate-50 p-2 text-sm">
                  <span className="h-2 w-2 rounded-full bg-teal-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero({ active }: { active: ProductPageProps['active'] }) {
  return (
    <section className="relative overflow-hidden bg-[#0d1211] text-white">
      <Header active={active} />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:pb-20">
        <div className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-sm text-white/78">
            <ShieldCheck className="h-4 w-4 text-teal-300" />
            SaaS pentru asociații de proprietari
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.04] text-white sm:text-5xl lg:text-6xl">
            Administrare APC mai clară pentru Moldova și România.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
            Espace centralizează apartamente, locatari, contoare, plăți, cereri, avizier și mesaje într-un produs calm,
            modern și ușor de folosit de către administratori.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/ro/demo-request"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-3 text-sm font-semibold text-[#0d1211] shadow-lg shadow-black/20 transition hover:bg-teal-50"
            >
              Programează un demo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/ro/features"
              className="inline-flex items-center justify-center rounded-md border border-white/16 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Vezi funcționalități
            </Link>
          </div>
        </div>
        <DashboardMockup />
      </div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section className="bg-[#f7f5f0] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">Funcționalități</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
            Tot fluxul unei asociații, fără improvizații.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Pagini rapide, date mock pentru preview și o structură pregătită pentru conectarea ulterioară la API.
          </p>
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-950">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  const steps = ['Importă apartamentele', 'Colectează citiri', 'Emite solduri', 'Comunică transparent'];
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">Flux operațional</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">Construit pentru lucru repetat, nu pentru prezentări.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Interfața pune informația importantă în fața administratorului: restanțe, citiri lipsă, cereri deschise și
            comunicări care trebuie trimise locatarilor.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-[#f7f5f0] p-5">
          <div className="grid gap-3">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-md bg-white p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <span className="font-medium text-slate-900">{step}</span>
                <CheckCircle2 className="ml-auto h-5 w-5 text-teal-700" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="bg-[#0d1211] px-4 py-14 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-lg border border-white/10 bg-white/[0.06] p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Pregătit pentru o previzualizare publică.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/68">
            Pagina funcționează cu date mock, fără API și fără dependențe externe.
          </p>
        </div>
        <Link
          href="/ro/demo-request"
          className="inline-flex items-center justify-center rounded-md bg-white px-4 py-3 text-sm font-semibold text-[#0d1211]"
        >
          Cere acces demo
        </Link>
      </div>
    </section>
  );
}

export default function EspaceProductPage({ active = 'home' }: ProductPageProps) {
  return (
    <main className="min-h-screen bg-[#f7f5f0]">
      <Hero active={active} />
      <FeatureGrid />
      <WorkflowSection />
      <CtaSection />
    </main>
  );
}
