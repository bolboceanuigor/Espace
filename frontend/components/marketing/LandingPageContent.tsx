'use client';

import Link from 'next/link';
import { ArrowRight, Building2, CreditCard, Bell, ClipboardList, Vote, FileBarChart2, LifeBuoy, CheckCircle2, Users, Shield, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import DemoRequestForm from './DemoRequestForm';
import MarketingLayout from './MarketingLayout';

export default function LandingPageContent() {
  const t = useTranslations('marketing');
  
  const features = [
    { icon: Building2, title: t('features.items.apartments.title'), text: t('features.items.apartments.text') },
    { icon: CreditCard, title: t('features.items.payments.title'), text: t('features.items.payments.text') },
    { icon: Bell, title: t('features.items.notifications.title'), text: t('features.items.notifications.text') },
    { icon: ClipboardList, title: t('features.items.issues.title'), text: t('features.items.issues.text') },
    { icon: Vote, title: t('features.items.votes.title'), text: t('features.items.votes.text') },
    { icon: FileBarChart2, title: t('features.items.reports.title'), text: t('features.items.reports.text') },
    { icon: LifeBuoy, title: t('features.items.portal.title'), text: t('features.items.portal.text') },
  ];

  const stats = [
    { value: '500+', label: 'Asociații active' },
    { value: '15k+', label: 'Apartamente gestionate' },
    { value: '99.9%', label: 'Timp funcțional' },
  ];

  const benefits = [
    { icon: Zap, title: 'Automatizare completă', text: 'Facturi, notificări și rapoarte generate automat' },
    { icon: Shield, title: 'Securitate maximă', text: 'Date protejate și backup-uri zilnice' },
    { icon: Users, title: 'Portal pentru locatari', text: 'Acces facil la facturi și plăți online' },
  ];

  return (
    <MarketingLayout>
      {/* Hero Section - Clean, elegant typography */}
      <section className="relative overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-20 md:pt-32 md:pb-28">
          <div className="flex flex-col items-center text-center">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Platformă modernă pentru administrare
            </div>
            
            {/* Main heading - Large, elegant serif-like styling */}
            <h1 className="max-w-4xl text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-6xl lg:text-7xl text-balance">
              Administrare optimală pentru{' '}
              <span className="italic">asociații de locatari</span>
            </h1>
            
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl leading-relaxed">
              {t('hero.subtitle')}
            </p>
            
            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
              <Link 
                href="/demo-request" 
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-white transition-all hover:opacity-90"
              >
                {t('hero.ctaDemo')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link 
                href="/demo" 
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-8 py-4 text-base font-semibold text-foreground transition-all hover:bg-muted"
              >
                {t('hero.ctaTryDemo')}
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-accent/5 blur-3xl" />
      </section>

      {/* Stats Section */}
      <section className="border-y border-border/40 bg-card/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-12">
          <div className="grid grid-cols-3 gap-8 text-center">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-semibold text-foreground md:text-4xl">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem / Solution Section */}
      <section className="bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 md:py-28">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Problem Card */}
            <div className="rounded-3xl border border-border/60 bg-card p-8 md:p-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
                Problema
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-foreground md:text-3xl">
                {t('problem.title')}
              </h2>
              <ul className="mt-6 space-y-4 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  {t('problem.items.excel')}
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  {t('problem.items.chaos')}
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  {t('problem.items.transparency')}
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  {t('problem.items.timeWaste')}
                </li>
              </ul>
            </div>

            {/* Solution Card */}
            <div className="rounded-3xl border border-emerald-200/60 bg-emerald-50/30 p-8 md:p-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700">
                Soluția
              </div>
              <h3 className="mt-6 text-2xl font-semibold text-foreground md:text-3xl">
                {t('solution.title')}
              </h3>
              <p className="mt-6 text-muted-foreground leading-relaxed">
                {t('solution.text')}
              </p>
              <div className="mt-8 flex items-center gap-4">
                <Link 
                  href="/features" 
                  className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:underline"
                >
                  Descoperă toate funcțiile
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="border-y border-border/40 bg-card/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 md:py-28">
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-foreground md:text-4xl text-balance">
              De ce Espace?
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              O platformă completă care simplifică administrarea asociațiilor de proprietari
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="relative rounded-2xl border border-border/60 bg-card p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <benefit.icon className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-foreground">{benefit.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 md:py-28">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
                {t('features.title')}
              </h2>
              <p className="mt-3 text-muted-foreground max-w-xl">
                Tot ce ai nevoie pentru o administrare eficientă
              </p>
            </div>
            <Link 
              href="/features" 
              className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:underline"
            >
              Vezi toate funcțiile
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {features.map((item) => (
              <div 
                key={item.title} 
                className="group rounded-2xl border border-border/60 bg-card p-6 transition-all hover:border-border hover:shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-primary/5">
                  <item.icon className="h-5 w-5 text-foreground/70" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="border-y border-border/40 bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 md:py-28">
          <div className="flex flex-col items-center text-center">
            <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
              {t('pricing.title')}
            </h2>
            <ul className="mt-8 flex flex-col gap-3 text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                {t('pricing.items.trial')}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                {t('pricing.items.custom')}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                {t('pricing.items.models')}
              </li>
            </ul>
            <div className="mt-10">
              <Link 
                href="/pricing" 
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-8 py-4 text-base font-semibold text-foreground transition-all hover:bg-muted"
              >
                {t('pricing.cta')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact / Demo Request Section */}
      <section className="bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 md:py-28">
          <div className="mx-auto max-w-2xl">
            <div className="rounded-3xl border border-border/60 bg-card p-8 md:p-12">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
                  {t('contact.title')}
                </h2>
                <p className="mt-3 text-muted-foreground">
                  {t('contact.subtitle')}
                </p>
              </div>
              <div className="mt-10">
                <DemoRequestForm />
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
