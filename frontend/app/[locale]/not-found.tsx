import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, isLocale } from '@/i18n';
import { roleHomePath } from '@/lib/role-routing';

type NotFoundPageProps = {
  params?: { locale?: string };
};

export default async function NotFoundPage({ params }: NotFoundPageProps) {
  const localeCandidate = params?.locale;
  const locale =
    typeof localeCandidate === 'string' && isLocale(localeCandidate)
      ? localeCandidate
      : defaultLocale;
  const tErrors = await getTranslations({ locale, namespace: 'errors' });
  const role = cookies().get('role')?.value || '';
  const homeHref = role ? `/${locale}${roleHomePath(role)}` : `/${locale}/login`;

  return (
    <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-border/60 bg-card p-5 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">404</h1>
      <p className="mt-2 text-sm text-muted-foreground">{tErrors('notFound')}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link
          href={homeHref}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-border/60 px-3 text-sm font-medium text-foreground transition duration-150 ease-out hover:bg-muted/60"
        >
          Pagina principală
        </Link>
        <Link
          href={`/${locale}/login`}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-border/60 px-3 text-sm font-medium text-foreground transition duration-150 ease-out hover:bg-muted/60"
        >
          Autentificare
        </Link>
      </div>
    </div>
  );
}
