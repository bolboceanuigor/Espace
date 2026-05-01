'use client';

import MarketingLayout from '@/components/marketing/MarketingLayout';
import DemoRequestForm from '@/components/marketing/DemoRequestForm';
import { useTranslations } from 'next-intl';

export default function ContactPage() {
  const t = useTranslations('marketing.contactPage');
  return (
    <MarketingLayout>
      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">{t('title')}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          {t('subtitle')}
        </p>
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <p className="text-sm font-semibold text-foreground">{t('detailsTitle')}</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>{t('email')}</li>
              <li>{t('phone')}</li>
              <li>{t('hours')}</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <p className="mb-3 text-sm font-semibold text-foreground">{t('formTitle')}</p>
            <DemoRequestForm compact />
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

