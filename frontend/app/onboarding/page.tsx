'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { defaultLocale, isLocale } from '@/i18n';
import { getStoredAuth } from '@/lib/auth';
import { roleHomePath } from '@/lib/role-routing';

export default function OnboardingPage() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;

  useEffect(() => {
    const auth = getStoredAuth();
    const destination = auth.token ? `/${locale}${roleHomePath(auth.role)}` : `/${locale}/login`;
    router.replace(destination);
  }, [locale, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-sm font-medium text-muted-foreground">
      Se redirecționează...
    </main>
  );
}
