'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { defaultLocale } from '@/i18n';
import { roleHomePath } from '@/lib/role-routing';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    router.replace(`/${defaultLocale}${roleHomePath(user?.role)}`);
  }, [isAuthenticated, loading, router, user?.role]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Se verifică sesiunea...
    </div>
  );
}
