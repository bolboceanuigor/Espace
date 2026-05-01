'use client';

import Link from 'next/link';
import { Bell, Building2, ClipboardList, CreditCard, FileBarChart2, LifeBuoy, Vote } from 'lucide-react';
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
  return (
    <MarketingLayout>
      <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-14 md:pt-20">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold leading-tight text-foreground md:text-5xl">{t('hero.title')}</h1>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            {t('hero.subtitle')}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/demo-request" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">
              {t('hero.ctaDemo')}
            </Link>
            <Link href="/demo" className="rounded-xl border border-border/70 px-4 py-2.5 text-sm font-semibold text-foreground">
              {t('hero.ctaTryDemo')}
            </Link>
            <Link href="/features" className="rounded-xl border border-border/70 px-4 py-2.5 text-sm font-semibold text-foreground">
              {t('hero.ctaFeatures')}
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-muted/30">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 py-10 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="text-lg font-semibold text-foreground">{t('problem.title')}</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>{t('problem.items.excel')}</li>
              <li>{t('problem.items.chaos')}</li>
              <li>{t('problem.items.transparency')}</li>
              <li>{t('problem.items.timeWaste')}</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <h3 className="text-lg font-semibold text-foreground">{t('solution.title')}</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              {t('solution.text')}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-semibold text-foreground">{t('features.title')}</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((item) => (
            <div key={item.title} className="rounded-2xl border border-border/70 bg-card p-4">
              <item.icon className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-semibold text-foreground">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-muted/20">
        <div className="mx-auto w-full max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-semibold text-foreground">{t('pricing.title')}</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>{t('pricing.items.trial')}</li>
            <li>{t('pricing.items.custom')}</li>
            <li>{t('pricing.items.models')}</li>
          </ul>
          <div className="mt-5">
            <Link href="/pricing" className="rounded-xl border border-border/70 bg-card px-4 py-2 text-sm font-semibold text-foreground">
              {t('pricing.cta')}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="rounded-2xl border border-border/70 bg-card p-5 md:p-7">
          <h2 className="text-2xl font-semibold text-foreground">{t('contact.title')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('contact.subtitle')}
          </p>
          <div className="mt-5">
            <DemoRequestForm />
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

