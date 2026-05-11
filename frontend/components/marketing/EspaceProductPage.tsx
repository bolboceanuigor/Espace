'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Gauge,
  Home,
  LineChart,
  MessageSquare,
  Shield,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

type ProductPageProps = {
  active?: 'home' | 'features';
};

// ============================================================================
// HEADER
// ============================================================================
function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/ro" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Home className="size-4" />
          </span>
          <span className="text-lg font-semibold text-slate-900">Espace</span>
        </Link>
        
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
          <Link href="/ro" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            Platformă
          </Link>
          <Link href="/ro/admin" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            Pentru administratori
          </Link>
          <Link href="/ro/resident" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            Pentru locatari
          </Link>
          <Link href="/ro/contact" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/ro/login"
            className="hidden text-sm font-medium text-slate-600 transition hover:text-slate-900 sm:block"
          >
            Autentificare
          </Link>
          <Link
            href="/ro/contact"
            className="btn-primary text-sm"
          >
            Solicită demo
          </Link>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// HERO
// ============================================================================
function Hero() {
  return (
    <section className="relative overflow-hidden bg-white pb-20 pt-16 sm:pb-28 sm:pt-20">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-50/50 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm text-emerald-700">
            <Sparkles className="size-4" />
            Platformă SaaS pentru APC-uri din Moldova
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Administrarea asociației tale,
            <span className="block text-emerald-600">simplă și digitală.</span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            Facturi, plăți, contoare, solicitări, anunțuri și comunicare cu locatarii — 
            toate într-o platformă modernă pentru asociațiile de proprietari.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/ro/contact" className="btn-primary px-8 py-3 text-base">
              Solicită demo
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/ro/login" className="btn-secondary px-8 py-3 text-base">
              Vezi cum funcționează
            </Link>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-200/50">
            <div className="rounded-xl bg-slate-50 p-6">
              {/* Browser bar */}
              <div className="mb-4 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="size-3 rounded-full bg-slate-300" />
                  <span className="size-3 rounded-full bg-slate-300" />
                  <span className="size-3 rounded-full bg-slate-300" />
                </div>
                <div className="ml-4 flex-1 rounded-lg bg-white px-4 py-1.5 text-xs text-slate-400">
                  espace.md/admin
                </div>
              </div>
              
              {/* Mock dashboard */}
              <div className="grid gap-4 lg:grid-cols-4">
                {[
                  { label: 'Total apartamente', value: '142', icon: Building2 },
                  { label: 'Facturi emise', value: '89', icon: FileText },
                  { label: 'Plăți încasate', value: '156,420 MDL', icon: CreditCard },
                  { label: 'Calitatea datelor', value: '94%', icon: Shield },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">{stat.label}</span>
                      <stat.icon className="size-4 text-slate-400" />
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// VALUE STRIP
// ============================================================================
function ValueStrip() {
  const values = [
    { icon: Building2, text: 'Pentru APC-uri din Moldova' },
    { icon: FileText, text: 'Facturare internă' },
    { icon: Users, text: 'Portal locatar' },
    { icon: LineChart, text: 'Rapoarte și transparență' },
  ];

  return (
    <section className="border-y border-slate-200 bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {values.map((item) => (
            <div key={item.text} className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white shadow-sm">
                <item.icon className="size-5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// PROBLEM SECTION
// ============================================================================
function ProblemSection() {
  const problems = [
    'Date împrăștiate în Excel',
    'Facturi greu de urmărit',
    'Locatari greu de informat',
    'Indici contoare colectați manual',
    'Solduri și restanțe greu de verificat',
  ];

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Administrarea clasică consumă timp și creează confuzie.
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Multe asociații încă lucrează cu tabele Excel, carnete și comunicări fragmentate.
          </p>
        </div>

        <div className="mx-auto mt-12 flex max-w-4xl flex-wrap justify-center gap-3">
          {problems.map((problem) => (
            <div
              key={problem}
              className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
            >
              <span className="size-1.5 rounded-full bg-red-400" />
              {problem}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// SOLUTION SECTION
// ============================================================================
function SolutionSection() {
  const solutions = [
    { icon: Building2, label: 'Apartamente și locatari' },
    { icon: CreditCard, label: 'Tarife și servicii' },
    { icon: FileText, label: 'Facturi interne' },
    { icon: CheckCircle2, label: 'Plăți înregistrate' },
    { icon: Gauge, label: 'Contoare și indici' },
    { icon: Bell, label: 'Anunțuri și solicitări' },
    { icon: LineChart, label: 'Rapoarte financiare' },
    { icon: Shield, label: 'Calitatea datelor' },
  ];

  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
            Soluția Espace
          </span>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
            Espace aduce totul într-un singur loc.
          </h2>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          {solutions.map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-50">
                <item.icon className="size-6 text-emerald-600" />
              </div>
              <span className="text-center text-sm font-medium text-slate-700">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// ADMIN EXPERIENCE
// ============================================================================
function AdminExperience() {
  const features = [
    'KPI-uri în timp real',
    'Facturare lunară controlată',
    'Reconciliere plăți',
    'Centru calitatea datelor',
    'CRM apartamente și locatari',
  ];

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
              Pentru administratori
            </span>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              Un workspace modern pentru administrator.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Administratorul vede rapid ce trebuie rezolvat: apartamente fără contact principal, 
              tarife lipsă, indici neaprobați, drafturi de facturi și solduri restante.
            </p>

            <ul className="mt-8 space-y-4">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <div className="flex size-6 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  </div>
                  <span className="text-slate-700">{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/ro/admin"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Explorează panoul admin
              <ChevronRight className="size-4" />
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="space-y-4">
              {[
                { label: 'Apartamente active', value: '142', badge: 'Complet' },
                { label: 'Facturi luna curentă', value: '89', badge: 'Draft' },
                { label: 'Plăți de reconciliat', value: '23', badge: 'În așteptare' },
                { label: 'Scor calitate date', value: '94/100', badge: 'Bun' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
                >
                  <div>
                    <p className="text-sm text-slate-500">{item.label}</p>
                    <p className="text-xl font-semibold text-slate-900">{item.value}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    {item.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// RESIDENT EXPERIENCE
// ============================================================================
function ResidentExperience() {
  const features = [
    'Sold curent vizibil',
    'Istoricul facturilor',
    'Transmitere indici contoare',
    'Avizier digital',
    'Solicitări și sesizări',
  ];

  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100">
                  <Home className="size-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Apartament 42</p>
                  <p className="text-sm text-slate-500">Scara B, Etaj 4</p>
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-sm text-emerald-700">Sold curent</p>
                <p className="text-3xl font-semibold text-emerald-700">1,240 MDL</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button className="rounded-xl bg-slate-100 p-3 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-200">
                  Vezi facturile
                </button>
                <button className="rounded-xl bg-slate-100 p-3 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-200">
                  Transmite indici
                </button>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <span className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
              Pentru locatari
            </span>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              Un portal simplu pentru locatari.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Locatarul vede facturile, plățile, anunțurile și poate transmite indicii 
              sau solicitări fără drumuri și mesaje pierdute.
            </p>

            <ul className="mt-8 space-y-4">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <div className="flex size-6 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  </div>
                  <span className="text-slate-700">{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/ro/resident"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Explorează portalul locatar
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FEATURE GRID
// ============================================================================
function FeatureGrid() {
  const features = [
    { icon: Building2, title: 'CRM apartamente', desc: 'Evidență completă pentru fiecare unitate' },
    { icon: Users, title: 'CRM locatari', desc: 'Contacte, roluri și comunicări' },
    { icon: FileText, title: 'Facturare lunară', desc: 'Generare automată de facturi' },
    { icon: CreditCard, title: 'Plăți manuale', desc: 'Înregistrare și reconciliere' },
    { icon: Gauge, title: 'Contoare', desc: 'Citiri și consum lunar' },
    { icon: LineChart, title: 'Rapoarte consum', desc: 'Statistici și tendințe' },
    { icon: Zap, title: 'Import/Export CSV', desc: 'Migrare rapidă a datelor' },
    { icon: Shield, title: 'Calitatea datelor', desc: 'Validări înainte de facturare' },
    { icon: Bell, title: 'Avizier', desc: 'Anunțuri pentru locatari' },
    { icon: MessageSquare, title: 'Solicitări', desc: 'Sesizări și intervenții' },
    { icon: Home, title: 'Portal locatar', desc: 'Acces simplificat pentru rezidenți' },
    { icon: CalendarCheck, title: 'Workflow lunar', desc: 'Pași clari pentru facturare' },
  ];

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
            Funcționalități
          </span>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
            Tot ce ai nevoie pentru administrare
          </h2>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50">
                <feature.icon className="size-5 text-emerald-600" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// BILLING WORKFLOW
// ============================================================================
function BillingWorkflow() {
  const steps = [
    { step: 1, title: 'Verificări inițiale', desc: 'Validare date apartamente' },
    { step: 2, title: 'Tarife', desc: 'Configurare servicii lunare' },
    { step: 3, title: 'Contoare', desc: 'Colectare și aprobare indici' },
    { step: 4, title: 'Calcul draft', desc: 'Generare facturi preliminare' },
    { step: 5, title: 'Review', desc: 'Verificare și ajustări' },
    { step: 6, title: 'Lock & Emit', desc: 'Blocare și emitere finală' },
  ];

  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
            Workflow
          </span>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
            Facturare lunară controlată, pas cu pas.
          </h2>
        </div>

        <div className="mx-auto mt-12 max-w-4xl">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {steps.map((item) => (
              <div
                key={item.step}
                className="flex items-start gap-4 rounded-2xl bg-white p-5 shadow-sm"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                  {item.step}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// DATA QUALITY
// ============================================================================
function DataQuality() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
              Calitatea datelor
            </span>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              Mai puține greșeli înainte de facturare.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Espace detectează date lipsă sau greșite înainte ca acestea să afecteze facturarea.
              Validări automate pentru apartamente, tarife, contoare și contacte.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 text-center">
              <p className="text-sm text-slate-500">Data Quality Score</p>
              <p className="text-5xl font-bold text-emerald-600">94<span className="text-2xl">/100</span></p>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Critical', count: 0, color: 'bg-emerald-500' },
                { label: 'Warnings', count: 8, color: 'bg-amber-500' },
                { label: 'Suggestions', count: 12, color: 'bg-slate-300' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    <span className={`size-2.5 rounded-full ${item.color}`} />
                    <span className="text-sm text-slate-700">{item.label}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-900">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// CTA
// ============================================================================
function CtaSection() {
  return (
    <section className="bg-slate-900 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">
            Pregătit pentru prima asociație digitală?
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Începe să administrezi mai eficient cu Espace. Solicită un demo gratuit.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/ro/contact"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500"
            >
              Solicită demo
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/ro/login"
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-8 py-3 text-base font-semibold text-white transition hover:bg-slate-800"
            >
              Discută cu echipa Espace
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FOOTER
// ============================================================================
function Footer() {
  const columns = [
    {
      title: 'Platformă',
      links: ['Funcționalități', 'Prețuri', 'Securitate', 'Actualizări'],
    },
    {
      title: 'Admin',
      links: ['Dashboard', 'Apartamente', 'Facturare', 'Rapoarte'],
    },
    {
      title: 'Locatar',
      links: ['Portal', 'Facturi', 'Contoare', 'Solicitări'],
    },
    {
      title: 'Companie',
      links: ['Despre noi', 'Contact', 'Blog', 'Cariere'],
    },
  ];

  return (
    <footer className="border-t border-slate-200 bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link href="/ro" className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Home className="size-4" />
              </span>
              <span className="text-lg font-semibold text-slate-900">Espace</span>
            </Link>
            <p className="mt-4 text-sm text-slate-500">
              Platformă SaaS pentru administrarea asociațiilor de proprietari din Moldova.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h4 className="text-sm font-semibold text-slate-900">{column.title}</h4>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-slate-500 transition hover:text-slate-700">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-slate-200 pt-8">
          <p className="text-center text-sm text-slate-500">
            © 2024 Espace. Toate drepturile rezervate.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function EspaceProductPage({ active = 'home' }: ProductPageProps) {
  return (
    <main className="min-h-screen bg-white">
      <Header />
      <Hero />
      <ValueStrip />
      <ProblemSection />
      <SolutionSection />
      <AdminExperience />
      <ResidentExperience />
      <FeatureGrid />
      <BillingWorkflow />
      <DataQuality />
      <CtaSection />
      <Footer />
    </main>
  );
}
