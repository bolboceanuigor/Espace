import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { defaultLocale, isLocale } from '@/i18n';
import AppShell from '@/components/layout/AppShell';

type LocalizedAppLayoutProps = {
  children: React.ReactNode;
  params: { locale?: string } | Promise<{ locale?: string }>;
};

export default async function LocalizedAppLayout({ children, params }: LocalizedAppLayoutProps) {
  const resolved = typeof (params as Promise<{ locale?: string }>)?.then === 'function'
    ? await (params as Promise<{ locale?: string }>)
    : (params as { locale?: string });
  const locale = resolved?.locale && isLocale(resolved.locale) ? resolved.locale : defaultLocale;
  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token = cookieStore.get('accessToken')?.value;
  } catch {
    token = undefined;
  }

  if (!token) {
    redirect('/login');
  }

  return <AppShell>{children}</AppShell>;
}
