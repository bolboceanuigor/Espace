'use client';

import MarketingLayout from '@/components/marketing/MarketingLayout';
import DemoRequestForm from '@/components/marketing/DemoRequestForm';
import { useTranslations } from 'next-intl';

export default function DemoRequestPage() {
  const t = useTranslations('marketing.demoPage');
  return (
    <MarketingLayout>
      <section className="mx-auto w-full max-w-3xl px-4 py-14">
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">{t('title')}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t('subtitle')}
        </p>
        <div className="mt-7 rounded-2xl border border-border/70 bg-card p-5">
          <DemoRequestForm />
        </div>
      </section>
    </MarketingLayout>
  );
}

