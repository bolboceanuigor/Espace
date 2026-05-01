'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { defaultLocale, isLocale } from '@/i18n';
import { roleHomePath } from '@/lib/role-routing';

export default function LocalizedDashboardPage() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const { user, isAuthenticated, loading } = useAuth();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace(`/${locale}/login`);
      return;
    }
    router.replace(`/${locale}${roleHomePath(user?.role)}`);
  }, [isAuthenticated, loading, locale, router, user?.role]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Se verifică sesiunea...
    </div>
  );
}
