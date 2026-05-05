'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Gauge,
  Home,
  MessageSquareText,
  ReceiptText,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
  Wrench,
  Zap,
  BarChart3,
  FileText,
  Vote,
} from 'lucide-react';

type ProductPageProps = {
  active?: 'home' | 'features';
};

// Ecosystem products for floating visualization
const ecosystemProducts = [
  { id: 'resident', icon: Smartphone, label: 'Aplicația Locatar', position: 'top-left' },
  { id: 'admin', icon: Building2, label: 'Panou Admin', position: 'top-right' },
  { id: 'billing', icon: CreditCard, label: 'Facturare', position: 'right' },
  { id: 'maintenance', icon: Wrench, label: 'Mentenanță', position: 'bottom-right' },
  { id: 'reports', icon: BarChart3, label: 'Rapoarte', position: 'bottom-left' },
  { id: 'communication', icon: MessageSquareText, label: 'Comunicare', position: 'left' },
];

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

const stats = [
  { value: '250+', label: 'Asociații active', suffix: '' },
  { value: '15,000', label: 'Apartamente gestionate', suffix: '+' },
  { value: '98', label: 'Satisfacție clienți', suffix: '%' },
  { value: '45,000', label: 'Economie medie/an', suffix: ' MDL' },
];

const roleCards = [
  {
    title: 'Administrator',
    text: 'Controlează apartamente, locatari, contoare, plăți, cereri și avizier dintr-un singur spațiu calm.',
    href: '/ro/admin',
    metric: '142 apartamente',
    icon: Building2,
  },
  {
    title: 'Locatar',
    text: 'Vede soldul, transmite citiri, urmărește anunțurile și trimite cereri către administrație.',
    href: '/ro/resident',
    metric: 'Portal rezident',
    icon: Users,
  },
  {
    title: 'Superadmin',
    text: 'Monitorizează asociațiile, activarea administratorilor, utilizarea platformei și venitul lunar.',
    href: '/ro/superadmin',
    metric: '38 asociații',
    icon: ShieldCheck,
  },
];

const workflowBenefits = [
  { title: 'Simplificați gestionarea cererilor', icon: ClipboardList },
  { title: 'Reduceți datoriile restante', icon: CreditCard },
  { title: 'Comunicare transparentă cu locatarii', icon: MessageSquareText },
];

function Header({ active }: { active: ProductPageProps['active'] }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0f0e]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/20">
            <Home className="h-5 w-5 text-white" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Espace</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-white/60 md:flex" aria-label="Navigare marketing">
          <Link className={`transition hover:text-white ${active === 'home' ? 'text-white' : ''}`} href="/">
            Acasă
          </Link>
          <Link className={`transition hover:text-white ${active === 'features' ? 'text-white' : ''}`} href="/features">
            Funcționalități
          </Link>
          <Link className="transition hover:text-white" href="/pricing">
            Prețuri
          </Link>
          <Link className="transition hover:text-white" href="/demo-request">
            Contact
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden rounded-lg px-4 py-2.5 text-sm font-medium text-white/70 transition hover:text-white sm:block"
          >
            Autentificare
          </Link>
          <Link
            href="/demo-request"
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0a0f0e] shadow-lg shadow-white/10 transition hover:bg-teal-50 hover:shadow-teal-500/20"
          >
            Începe gratuit
          </Link>
        </div>
      </div>
    </header>
  );
}

function EcosystemVisualization() {
  return (
    <div className="relative mx-auto h-[400px] w-full max-w-[500px] md:h-[480px]">
      {/* Central glow */}
      <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/20 blur-[80px] animate-pulse-glow" />
      
      {/* Central platform badge */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="glass flex h-24 w-24 flex-col items-center justify-center rounded-2xl text-white shadow-2xl shadow-teal-500/10">
          <Zap className="h-8 w-8 text-teal-400" />
          <span className="mt-1 text-xs font-medium text-white/70">Espace</span>
        </div>
      </div>

      {/* Floating product cards */}
      {ecosystemProducts.map((product, index) => {
        const positions: Record<string, string> = {
          'top-left': 'top-8 left-4 md:top-12 md:left-8',
          'top-right': 'top-8 right-4 md:top-12 md:right-8',
          'right': 'top-1/2 right-0 -translate-y-1/2 md:right-4',
          'bottom-right': 'bottom-8 right-4 md:bottom-12 md:right-8',
          'bottom-left': 'bottom-8 left-4 md:bottom-12 md:left-8',
          'left': 'top-1/2 left-0 -translate-y-1/2 md:left-4',
        };
        const Icon = product.icon;
        const animationClass = index % 2 === 0 ? 'animate-float' : 'animate-float-reverse';
        const delay = `animate-delay-${(index + 1) * 100}`;
        
        return (
          <div
            key={product.id}
            className={`absolute ${positions[product.position]} ${animationClass} ${delay}`}
          >
            <div className="glass group flex items-center gap-3 rounded-xl px-4 py-3 text-white transition-all hover:scale-105 hover:bg-white/[0.08] cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500/20 to-teal-600/10 group-hover:from-teal-500/30 group-hover:to-teal-600/20">
                <Icon className="h-5 w-5 text-teal-400" />
              </div>
              <span className="text-sm font-medium">{product.label}</span>
            </div>
          </div>
        );
      })}

      {/* Connection lines (decorative) */}
      <svg className="absolute inset-0 h-full w-full opacity-20" viewBox="0 0 500 480">
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="250" cy="240" r="80" fill="none" stroke="url(#lineGrad)" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="250" cy="240" r="140" fill="none" stroke="url(#lineGrad)" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="250" cy="240" r="200" fill="none" stroke="url(#lineGrad)" strokeWidth="1" strokeDasharray="4 4" />
      </svg>
    </div>
  );
}

function Hero({ active }: { active: ProductPageProps['active'] }) {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#0a0f0e] text-white">
      <Header active={active} />
      
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 top-0 h-[600px] w-[600px] rounded-full bg-teal-500/5 blur-[120px]" />
        <div className="absolute -right-1/4 bottom-0 h-[600px] w-[600px] rounded-full bg-teal-600/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 md:pt-16 lg:px-8 lg:pb-24">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Left content */}
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 animate-fade-up">
              <span className="flex h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
              Ecosistem complet pentru asociații
            </div>
            
            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl animate-fade-up animate-delay-100">
              Tot ce aveți nevoie pentru{' '}
              <span className="bg-gradient-to-r from-teal-300 to-teal-500 bg-clip-text text-transparent">
                administrarea asociației
              </span>
            </h1>
            
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/60 animate-fade-up animate-delay-200">
              Espace centralizează apartamente, locatari, contoare, plăți, cereri și comunicări într-o platformă modernă, 
              ușor de folosit de administratori și accesibilă pentru locatari.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row animate-fade-up animate-delay-300">
              <Link
                href="/demo-request"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-[#0a0f0e] shadow-xl shadow-white/10 transition hover:bg-teal-50 hover:shadow-teal-500/20"
              >
                Începe gratuit
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/ro/admin"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Vezi demo live
              </Link>
            </div>

            {/* Quick stats */}
            <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4 animate-fade-up animate-delay-400">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center sm:text-left">
                  <p className="text-2xl font-bold text-white lg:text-3xl">
                    {stat.value}<span className="text-teal-400">{stat.suffix}</span>
                  </p>
                  <p className="mt-1 text-xs text-white/50">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Ecosystem visualization */}
          <div className="flex items-center justify-center animate-scale-in animate-delay-200">
            <EcosystemVisualization />
          </div>
        </div>
      </div>

      {/* Bottom wave separator */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 100" fill="none" className="w-full">
          <path d="M0 100V40C240 80 480 20 720 40C960 60 1200 20 1440 40V100H0Z" fill="#f7f5f0" />
        </svg>
      </div>
    </section>
  );
}

function BenefitsStrip() {
  return (
    <section className="bg-[#f7f5f0] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {workflowBenefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={benefit.title}
                className="flex items-center gap-3 animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 shadow-lg shadow-teal-600/20">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-sm font-semibold text-gray-900">{benefit.title}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RoleSection() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">Roluri</p>
          <h2 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">
            Un produs pentru fiecare parte din asociație
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Administrația lucrează eficient, locatarii au informațiile la îndemână, iar platforma poate fi urmărită la nivel global.
          </p>
        </div>
        
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {roleCards.map((role, index) => {
            const Icon = role.icon;
            return (
              <Link
                key={role.title}
                href={role.href}
                className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/50 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-200/50"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 shadow-lg">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                    {role.metric}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-gray-900">{role.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{role.text}</p>
                <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  Deschide
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
                
                {/* Decorative gradient */}
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-teal-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section className="bg-[#f7f5f0] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">Funcționalități</p>
          <h2 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">
            Tot fluxul unei asociații, fără improvizații
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Pagini rapide, interfață intuitivă și toate instrumentele necesare pentru administrarea eficientă.
          </p>
        </div>
        
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="group rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-200/50"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 shadow-lg transition-transform group-hover:scale-105">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-5 text-base font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{feature.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  const steps = [
    { step: 1, title: 'Importă apartamentele', desc: 'Adaugă blocuri, scări și apartamente rapid' },
    { step: 2, title: 'Colectează citiri', desc: 'Locatarii trimit citirile din aplicație' },
    { step: 3, title: 'Emite solduri', desc: 'Calculează automat și distribuie facturile' },
    { step: 4, title: 'Comunică transparent', desc: 'Anunțuri și mesaje directe către locatari' },
  ];

  return (
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">Flux operațional</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">
              Construit pentru lucru repetat, nu pentru prezentări
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Interfața pune informația importantă în fața administratorului: restanțe, citiri lipsă, 
              cereri deschise și comunicări care trebuie trimise locatarilor.
            </p>
            
            <div className="mt-8">
              <Link
                href="/features"
                className="inline-flex items-center gap-2 text-sm font-semibold text-teal-600 transition hover:text-teal-700"
              >
                Vezi toate funcționalitățile
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-[#f7f5f0] p-6">
            <div className="space-y-4">
              {steps.map((item, index) => (
                <div
                  key={item.step}
                  className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm transition-all hover:shadow-md"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white shadow-lg shadow-teal-600/20">
                    {item.step}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                  <CheckCircle2 className="ml-auto h-5 w-5 flex-shrink-0 text-teal-600" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const testimonials = [
    {
      quote: 'Am redus timpul de administrare cu 60%. Acum totul e într-un singur loc.',
      author: 'Maria Popescu',
      role: 'Administrator, Bloc Dacia',
    },
    {
      quote: 'Locatarii sunt mulțumiți că pot vedea soldurile și trimite cereri online.',
      author: 'Ion Rusu',
      role: 'Președinte, APC Centurion',
    },
    {
      quote: 'Rapoartele se generează automat. Nu mai pierdem zile cu excele.',
      author: 'Elena Moraru',
      role: 'Contabil, APC Florilor',
    },
  ];

  return (
    <section className="bg-[#f7f5f0] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">Testimoniale</p>
          <h2 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">
            Ce spun clienții noștri
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, index) => (
            <div
              key={index}
              className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm"
            >
              <p className="text-gray-600 italic">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t.author}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="bg-[#0a0f0e] px-4 py-20 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-8 md:p-12 lg:p-16">
          {/* Background decoration */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-teal-500/10 blur-[80px]" />
          
          <div className="relative flex flex-col items-center text-center lg:flex-row lg:justify-between lg:text-left">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold sm:text-4xl">
                Pregătit să simplificați administrarea?
              </h2>
              <p className="mt-4 text-lg text-white/60">
                Începeți gratuit cu toate funcționalitățile. Fără card de credit, fără angajamente.
              </p>
            </div>
            
            <div className="mt-8 flex flex-col gap-4 sm:flex-row lg:mt-0">
              <Link
                href="/demo-request"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-[#0a0f0e] shadow-xl transition hover:bg-teal-50"
              >
                Începe gratuit
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Contactează vânzări
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-[#f7f5f0] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/20">
              <Home className="h-5 w-5 text-white" />
            </span>
            <span className="text-lg font-semibold text-gray-900">Espace</span>
          </div>
          
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600">
            <Link href="/features" className="transition hover:text-gray-900">Funcționalități</Link>
            <Link href="/pricing" className="transition hover:text-gray-900">Prețuri</Link>
            <Link href="/contact" className="transition hover:text-gray-900">Contact</Link>
            <Link href="/demo-request" className="transition hover:text-gray-900">Demo</Link>
          </nav>
          
          <p className="text-sm text-gray-500">
            &copy; 2024 Espace. Toate drepturile rezervate.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function EspaceProductPage({ active = 'home' }: ProductPageProps) {
  return (
    <main className="min-h-screen bg-[#f7f5f0]">
      <Hero active={active} />
      <BenefitsStrip />
      <RoleSection />
      <FeatureGrid />
      <WorkflowSection />
      <TestimonialsSection />
      <CtaSection />
      <Footer />
    </main>
  );
}
