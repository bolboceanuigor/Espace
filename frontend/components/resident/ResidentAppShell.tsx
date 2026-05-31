'use client';

import { ReactNode } from 'react';
import OfflineBanner from '@/components/pwa/OfflineBanner';
import PwaInstallPrompt from '@/components/pwa/PwaInstallPrompt';
import { ResidentContextProvider, useResidentContext } from '@/context/ResidentContext';
import ResidentBottomNav from './ResidentBottomNav';
import ResidentMobileHeader from './ResidentMobileHeader';

type ResidentAppShellProps = {
  children: ReactNode;
  unreadNotifications?: number;
  unpaidInvoices?: number;
};

export default function ResidentAppShell(props: ResidentAppShellProps) {
  return (
    <ResidentContextProvider>
      <ResidentAppShellInner {...props} />
    </ResidentContextProvider>
  );
}

function ResidentAppShellInner({ children, unreadNotifications = 0, unpaidInvoices = 0 }: ResidentAppShellProps) {
  const context = useResidentContext();
  const firstApartment = context.apartments[0];
  const userName = context.user?.fullName || context.resident?.fullName || 'Locatar';
  const apartmentLabel = firstApartment ? `Apt. ${firstApartment.apartmentNumber}` : 'Apartamentele mele';
  const organizationName = context.activeAssociation?.shortName || firstApartment?.association?.shortName || 'A.P.C.';

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <OfflineBanner />
      <ResidentMobileHeader
        userName={userName}
        organizationName={organizationName}
        apartmentLabel={apartmentLabel}
        unreadNotifications={unreadNotifications}
        onRefresh={() => {
          void context.reload();
        }}
      />
      <main className="mx-auto w-full max-w-2xl px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+6.25rem)] md:max-w-5xl md:py-8 md:pb-10">
        <div className="mb-4 md:hidden">
          <PwaInstallPrompt />
        </div>
        {context.error ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-card">
            {context.error}
          </div>
        ) : null}
        {children}
      </main>
      <ResidentBottomNav unpaidCount={unpaidInvoices} />
    </div>
  );
}
