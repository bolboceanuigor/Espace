'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ResidentContextProvider, useResidentContext } from '@/context/ResidentContext';
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
  userName,
  apartmentLabel,
  organizationName,
  notificationsSlot,
  floatingAction,
}: ResidentAppShellProps) {
  return (
    <ResidentContextProvider>
      <ResidentAppShellContent
        userName={userName}
        apartmentLabel={apartmentLabel}
        organizationName={organizationName}
        notificationsSlot={notificationsSlot}
        floatingAction={floatingAction}
      >
        {children}
      </ResidentAppShellContent>
    </ResidentContextProvider>
  );
}

function ResidentAppShellContent({
  children,
  userName,
  apartmentLabel,
  organizationName,
  notificationsSlot,
  floatingAction,
}: ResidentAppShellProps) {
  const params = useParams<{ locale?: string }>();
  const residentContext = useResidentContext();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const firstApartment = residentContext.apartments[0];
  const displayUserName = userName || residentContext.user?.fullName || residentContext.resident?.fullName || 'Locatar';
  const displayApartmentLabel = apartmentLabel || (firstApartment ? `Apartament ${firstApartment.apartmentNumber}` : 'Apartamentele mele');
  const displayOrganizationName =
    organizationName || residentContext.activeAssociation?.shortName || firstApartment?.association?.shortName || 'A.P.C.';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/75 bg-background/94 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center gap-3 px-4">
          <Link href={`/${locale}/resident`} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
            ES
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{displayUserName}</p>
            <p className="truncate text-xs text-muted-foreground">{displayApartmentLabel} · {displayOrganizationName}</p>
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
