'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { defaultLocale, isLocale } from '@/i18n';
import ResidentBottomNav, { ResidentProfileShortcut } from './ResidentBottomNav';

type ResidentAppShellProps = {
  children: ReactNode;
  userName?: string;
  apartmentLabel?: string;
  organizationName?: string;
  notificationsSlot?: ReactNode;
  floatingAction?: ReactNode;
};

export default function ResidentAppShell({
  children,
  userName = 'Ion Popescu',
  apartmentLabel = 'Apartament 24',
  organizationName = 'A.P.C. A0123-0940',
  notificationsSlot,
  floatingAction,
}: ResidentAppShellProps) {
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-slate-50/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center gap-3 px-4">
          <Link href={`/${locale}/resident`} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-sm">
            ES
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-950">{userName}</p>
            <p className="truncate text-xs text-slate-500">{apartmentLabel} · {organizationName}</p>
          </div>
          {notificationsSlot}
          <div className="hidden md:block">
            <ResidentProfileShortcut />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:py-8 md:pb-10">
        {children}
      </main>

      {floatingAction}
      <ResidentBottomNav />
    </div>
  );
}
