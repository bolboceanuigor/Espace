'use client';

import MarketingLayout from '@/components/marketing/MarketingLayout';
import { Bell, Building2, ClipboardList, CreditCard, FileBarChart2, LifeBuoy, Vote } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function FeaturesPage() {
  const t = useTranslations('marketing.featuresPage');
  const items = [
    { icon: Building2, title: t('items.apartments.title'), desc: t('items.apartments.text') },
    { icon: CreditCard, title: t('items.payments.title'), desc: t('items.payments.text') },
    { icon: Bell, title: t('items.notifications.title'), desc: t('items.notifications.text') },
    { icon: ClipboardList, title: t('items.issues.title'), desc: t('items.issues.text') },
    { icon: Vote, title: t('items.votes.title'), desc: t('items.votes.text') },
    { icon: FileBarChart2, title: t('items.reports.title'), desc: t('items.reports.text') },
    { icon: LifeBuoy, title: t('items.portal.title'), desc: t('items.portal.text') },
  ];
  return (
    <MarketingLayout>
      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">{t('title')}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          {t('subtitle')}
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.title} className="rounded-2xl border border-border/70 bg-card p-5">
              <item.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-3 text-base font-semibold text-foreground">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}

