'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { helpApi } from '@/lib/api';

export default function HelpArticlePage() {
  const t = useTranslations('help');
  const params = useParams<{ slug: string; locale?: string }>();
  const slug = params?.slug;
  const locale = typeof params?.locale === 'string' ? params.locale : 'ro';
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const run = async () => {
      setIsLoading(true);
      setIsError(false);
      try {
        const res = await helpApi.getBySlug(slug);
        setData(res.data || null);
      } catch {
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };
    run().catch(() => {
      setIsError(true);
      setIsLoading(false);
    });
  }, [slug]);

  if (isLoading) {
    return <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">{t('loading')}</div>;
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <p className="text-sm text-destructive">{t('articleNotFound')}</p>
        <Link href={`/${locale}/help`} className="text-sm text-primary hover:underline">
          {t('backToCenter')}
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <Link href={`/${locale}/help`} className="text-sm text-primary hover:underline">
        {t('backToArticles')}
      </Link>
      <header className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{data.category}</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">{data.title}</h1>
      </header>
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">{data.content}</div>
      </section>
    </article>
  );
}

