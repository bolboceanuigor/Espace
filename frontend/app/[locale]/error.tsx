'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { defaultLocale, isLocale } from '@/i18n';
import { roleHomePath } from '@/lib/role-routing';

export default function LocaleErrorPage({ error }: { error?: Error & { digest?: string } }) {
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const { user, isAuthenticated } = useAuth();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const homeHref = isAuthenticated ? `/${locale}${roleHomePath(user?.role)}` : `/${locale}/login`;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold text-foreground">{tCommon('error')}</h1>
      <p className="text-sm text-muted-foreground">
        Pagina nu s-a încărcat corect. Poți încerca din nou sau poți reveni în aplicație.
      </p>
      {error?.digest ? <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p> : null}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button size="sm" onClick={() => router.refresh()}>
          {tCommon('refresh')}
        </Button>
        <Link
          href={homeHref}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-border/60 px-3 text-sm font-medium text-foreground transition hover:bg-muted/60"
        >
          Pagina principală
        </Link>
        <Link
          href={`/${locale}/login`}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-border/60 px-3 text-sm font-medium text-foreground transition hover:bg-muted/60"
        >
          Autentificare
        </Link>
      </div>
    </div>
  );
}
