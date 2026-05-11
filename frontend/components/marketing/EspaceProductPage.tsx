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
  ReceiptText,
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
    title: 'Facturi și datorii',
    text: 'Facturi lunare, restanțe și solduri pregătite pentru administratorii de A.P.C.',
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
];

const dashboardStats = [
  ['Total apartamente', '142'],
  ['Datorii totale', '86,450 MDL'],
  ['Citiri lipsă', '23'],
  ['Cereri deschise', '12'],
];

const roleCards = [
  {
    title: 'Administrator',
    text: 'Controlează apartamente, locatari, contoare, facturi, cereri și avizier dintr-un singur spațiu calm.',
    href: '/ro/admin',
    metric: '142 apartamente',
  },
  {
    title: 'Locatar',
    text: 'Vede soldul, transmite citiri, urmărește anunțurile și trimite cereri către administrație.',
    href: '/ro/resident',
    metric: 'Cont locatar',
  },
  {
    title: 'Superadmin',
    text: 'Monitorizează asociațiile A.P.C., activarea administratorilor, planurile și utilizarea platformei.',
    href: '/ro/superadmin',
    metric: '38 asociații',
  },
];

function Header({ active }: { active: ProductPageProps['active'] }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-foreground/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/ro" className="flex items-center gap-3 text-white">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white text-foreground">
            <Home className="size-4" />
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
          <Link className="hover:text-white" href="/ro/contact">
            Contact
          </Link>
        </nav>
        <Link
          href="/ro/login"
          className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground"
        >
          Intră în platformă
        </Link>
      </div>
    </header>
  );
}

function DashboardMockup() {
  return (
    <div className="rounded-xl border border-white/12 bg-white/[0.07] p-3 shadow-2xl shadow-black/30">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-background text-foreground">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">A.P.C. configurată · Chișinău</p>
            <p className="text-sm font-semibold">Panou administrator</p>
          </div>
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">Mai 2026</span>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {dashboardStats.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-card p-3 shadow-card">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-3 px-4 pb-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Apartament conectat</p>
                <p className="mt-1 text-sm text-muted-foreground">Scara 2 · Etaj 6 · 72.4 m²</p>
              </div>
              <span className="rounded-full bg-critical/10 px-2.5 py-1 text-xs font-medium text-critical">1,240 MDL</span>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-muted-foreground">Proprietar</p>
                <p className="font-medium">Locatar conectat</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-muted-foreground">Contoare</p>
                <p className="font-medium">2 actualizate, 1 lipsă</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 shadow-card">
            <p className="font-semibold">Cereri active</p>
            <div className="mt-3 space-y-2">
              {['Presiune scazuta la apa', 'Bec ars in hol', 'Curatenie parter'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg bg-muted p-2 text-sm">
                  <span className="size-2 rounded-full bg-accent" />
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
    <section className="relative overflow-hidden bg-foreground text-white">
      <Header active={active} />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:pb-20">
        <div className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-sm text-white/78">
            <ShieldCheck className="size-4 text-accent" />
            Platformă pentru administrarea A.P.C. și condominiilor din Republica Moldova
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.04] text-white sm:text-5xl lg:text-6xl">
            Administrare A.P.C. mai clară pentru Republica Moldova.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
            Espace centralizează apartamente, locatari, contoare, facturi și datorii, cereri și avizier într-un produs calm,
            modern și ușor de folosit de către administratori.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/ro/contact"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition hover:bg-accent/90"
            >
              Contact
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/ro/login"
              className="inline-flex items-center justify-center rounded-lg border border-white/16 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Intră în platformă
            </Link>
          </div>
        </div>
        <DashboardMockup />
      </div>
    </section>
  );
}

function RoleSection() {
  return (
    <section className="bg-card px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">Roluri</p>
          <h2 className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl">Un produs pentru fiecare parte din asociație.</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Administrația lucrează eficient, locatarii au informațiile la îndemână, iar platforma poate fi urmărită la nivel global.
          </p>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {roleCards.map((role) => (
            <Link
              key={role.title}
              href={role.href}
              className="group rounded-xl border border-border bg-background p-5 shadow-card transition hover:-translate-y-0.5 hover:bg-card hover:shadow-card-hover"
            >
              <p className="text-sm font-medium text-accent">{role.metric}</p>
              <h3 className="mt-3 text-xl font-semibold text-foreground">{role.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{role.text}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                Deschide
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section className="bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">Funcționalități</p>
          <h2 className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl">
            Tot fluxul unei asociații, fără improvizații.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Funcționalități de bază pentru administratori: apartamente, locatari, contoare, facturi și datorii, cereri și avizier.
          </p>
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="flex size-11 items-center justify-center rounded-lg bg-foreground text-background">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.text}</p>
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
    <section className="bg-card px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">Flux operațional</p>
          <h2 className="mt-3 text-3xl font-semibold text-foreground">Construit pentru lucru repetat, nu pentru prezentări.</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Interfața pune informația importantă în fața administratorului: restanțe, citiri lipsă, cereri deschise și
            comunicări care trebuie trimise locatarilor.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background p-5 shadow-card">
          <div className="grid gap-3">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-lg bg-card p-4 shadow-card">
                <span className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {index + 1}
                </span>
                <span className="font-medium text-foreground">{step}</span>
                <CheckCircle2 className="ml-auto size-5 text-accent" />
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
    <section className="bg-foreground px-4 py-14 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-xl border border-white/10 bg-white/[0.06] p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Pregătit pentru primele asociații din Republica Moldova.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/68">
            Platformă pentru administrarea A.P.C. și condominiilor: apartamente, locatari, contoare, facturi, datorii, cereri și avizier.
          </p>
        </div>
        <Link
          href="/ro/login"
          className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90"
        >
          Intră în platformă
        </Link>
      </div>
    </section>
  );
}

export default function EspaceProductPage({ active = 'home' }: ProductPageProps) {
  return (
    <main className="min-h-screen bg-background">
      <Hero active={active} />
      <RoleSection />
      <FeatureGrid />
      <WorkflowSection />
      <CtaSection />
    </main>
  );
}
