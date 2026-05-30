'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Bell, Menu, Search, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AdminContextProvider, useAdminContext } from '@/context/AdminContext';
import { PermissionsProvider } from '@/hooks/usePermissions';
import { AdminCommandPalette, AdminGlobalSearchInput } from '@/components/admin-search/AdminCommandPalette';
import { StatusBadge } from '@/components/ui';
import AppSidebar from './AppSidebar';

type AdminAppShellProps = {
  children: ReactNode;
  organizationName?: string;
  organizationCode?: string;
  organizationStatus?: string;
  userName?: string;
  userEmail?: string;
  userInitials?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: () => void;
  notificationsSlot?: ReactNode;
  topContent?: ReactNode;
  floatingAction?: ReactNode;
  footerSlot?: ReactNode;
};

function initialsFromName(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split('@')[0] || 'Admin';
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AD';
}

export default function AdminAppShell(props: AdminAppShellProps) {
  return (
    <AdminContextProvider>
      <PermissionsProvider>
        <AdminAppShellContent {...props} />
      </PermissionsProvider>
    </AdminContextProvider>
  );
}

function AdminAppShellContent({
  children,
  organizationName,
  organizationCode,
  organizationStatus = 'ACTIVE',
  userName,
  userEmail,
  userInitials,
  searchValue,
  searchPlaceholder = 'Caută locatari, apartamente, facturi...',
  onSearchChange,
  onSearchSubmit,
  notificationsSlot,
  topContent,
  floatingAction,
  footerSlot,
}: AdminAppShellProps) {
  const { user, org } = useAuth();
  const adminContext = useAdminContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const displayName = userName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Administrator';
  const displayEmail = userEmail || user?.email || 'admin@espace.md';
  const displayInitials = userInitials || initialsFromName(displayName, displayEmail);
  const activeAssociation = adminContext.activeAssociation;
  const displayOrgName = organizationName || activeAssociation?.shortName || org?.name || 'A.P.C. A0123-0940';
  const displayOrgCode = organizationCode || activeAssociation?.associationCode || 'A0123-0940';
  const statusValue = activeAssociation?.status || organizationStatus;
  const statusText = statusValue === 'ACTIVE' ? 'Activă' : statusValue;
  const roleName = adminContext.membership?.role?.name || 'Administrator';

  const defaultNotifications = useMemo(
    () => (
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-muted-foreground shadow-sm transition hover:bg-accent/25 hover:text-foreground"
        aria-label="Notificări"
      >
        <Bell className="h-4 w-4" />
      </button>
    ),
    [],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <AppSidebar
          organizationName={displayOrgName}
          organizationCode={displayOrgCode}
          userInitials={displayInitials}
          userEmail={displayEmail}
        />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/25 backdrop-blur-sm" aria-label="Închide meniul" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0">
            <AppSidebar
              organizationName={displayOrgName}
              organizationCode={displayOrgCode}
              userInitials={displayInitials}
              userEmail={displayEmail}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg"
            aria-label="Închide meniul"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-border/75 bg-background/95 backdrop-blur-xl">
          <div className="flex min-h-16 items-center gap-3 px-4 md:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-muted-foreground shadow-sm transition hover:bg-accent/25 hover:text-foreground lg:hidden"
              aria-label="Deschide meniul"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{displayOrgName}</p>
                <StatusBadge status={statusValue} label={statusText} size="sm" className="hidden sm:inline-flex" />
              </div>
              <p className="truncate text-xs text-muted-foreground">{displayOrgCode} · {roleName}</p>
            </div>

            {adminContext.availableAssociations.length > 1 ? (
              <select
                value={activeAssociation?.id || ''}
                onChange={(event) => void adminContext.switchAssociation(event.target.value)}
                className="hidden h-10 max-w-56 rounded-full border border-border bg-white px-3 text-sm font-medium text-foreground shadow-sm outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/15 md:block"
                aria-label="Schimbă asociația activă"
              >
                {adminContext.availableAssociations.map((association) => (
                  <option key={association.id} value={association.id}>
                    {association.shortName}
                  </option>
                ))}
              </select>
            ) : null}

            <AdminGlobalSearchInput onOpen={() => setCommandOpen(true)} />
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-muted-foreground shadow-sm transition hover:bg-accent/25 hover:text-foreground md:hidden"
              aria-label="Caută"
            >
              <Search className="h-5 w-5" />
            </button>

            {notificationsSlot || defaultNotifications}

            <div className="hidden items-center gap-3 rounded-2xl border border-border bg-white px-3 py-2 shadow-sm md:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{displayInitials}</span>
              <span className="min-w-0">
                <span className="block max-w-36 truncate text-xs font-semibold text-foreground">{displayName}</span>
                <span className="block max-w-36 truncate text-[11px] text-muted-foreground">{displayEmail}</span>
              </span>
            </div>
          </div>
          {topContent ? <div className="border-t border-border/70 px-4 py-3 md:px-6">{topContent}</div> : null}
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-7">{children}</main>
        {footerSlot ? <footer className="mx-auto w-full max-w-7xl px-4 pb-6 md:px-6">{footerSlot}</footer> : null}
      </div>

      {floatingAction}
      <AdminCommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
