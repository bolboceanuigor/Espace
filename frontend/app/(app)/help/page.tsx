'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { helpApi } from '@/lib/api';

const CATEGORIES = ['ALL', 'GETTING_STARTED', 'PAYMENTS', 'INVOICES', 'RESIDENTS', 'ISSUES', 'SETTINGS', 'OTHER'] as const;

export default function HelpPage() {
  const t = useTranslations('help');
  const params = useParams<{ locale?: string }>();
  const locale = typeof params?.locale === 'string' ? params.locale : 'ro';
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('ALL');
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      try {
        const res = await helpApi.list({ search: search || undefined, category: category === 'ALL' ? undefined : category });
        setData(res.data || []);
      } finally {
        setIsLoading(false);
      }
    };
    run().catch(() => setIsLoading(false));
  }, [search, category]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    (data || []).forEach((item) => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)?.push(item);
    });
    return Array.from(map.entries());
  }, [data]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary md:col-span-2"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        >
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : null}

      <div className="space-y-5">
        {grouped.map(([group, items]) => (
          <section key={group} className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group}</h2>
            <div className="space-y-2">
              {items.map((article) => (
                <Link
                  key={article.id}
                  href={`/${locale}/help/${article.slug}`}
                  className="block rounded-lg border border-border/60 p-3 transition hover:border-primary/40 hover:bg-muted/20"
                >
                  <p className="font-medium text-foreground">{article.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('updatedAt')}: {new Date(article.updatedAt).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

