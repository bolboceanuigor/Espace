'use client';

import MarketingLayout from '@/components/marketing/MarketingLayout';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function PricingPage() {
  const t = useTranslations('marketing.pricingPage');
  return (
    <MarketingLayout>
      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">{t('title')}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          {t('subtitle')}
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-border/70 bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('cards.trial.label')}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{t('cards.trial.value')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t('cards.trial.text')}</p>
          </article>
          <article className="rounded-2xl border border-border/70 bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('cards.custom.label')}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{t('cards.custom.value')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t('cards.custom.text')}</p>
          </article>
          <article className="rounded-2xl border border-border/70 bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('cards.models.label')}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{t('cards.models.value')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t('cards.models.text')}</p>
          </article>
        </div>
        <div className="mt-8">
          <Link href="/demo-request" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">
            {t('cta')}
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}

