'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Bell, Menu, Search, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PermissionsProvider } from '@/hooks/usePermissions';
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

export default function AdminAppShell({
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayName = userName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Administrator';
  const displayEmail = userEmail || user?.email || 'admin@espace.md';
  const displayInitials = userInitials || initialsFromName(displayName, displayEmail);
  const displayOrgName = organizationName || org?.name || 'A.P.C. A0123-0940';
  const displayOrgCode = organizationCode || 'A0123-0940';
  const statusText = organizationStatus === 'ACTIVE' ? 'Activă' : organizationStatus;

  const defaultNotifications = useMemo(
    () => (
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-950"
        aria-label="Notificări"
      >
        <Bell className="h-4 w-4" />
      </button>
    ),
    [],
  );

  return (
    <PermissionsProvider>
    <div className="min-h-screen bg-slate-50 text-slate-900">
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
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-slate-50/85 backdrop-blur-xl">
          <div className="flex min-h-16 items-center gap-3 px-4 md:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm lg:hidden"
              aria-label="Deschide meniul"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-950">{displayOrgName}</p>
                <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 sm:inline-flex">
                  {statusText}
                </span>
              </div>
              <p className="truncate text-xs text-slate-500">{displayOrgCode}</p>
            </div>

            <div className="hidden w-full max-w-sm items-center rounded-2xl border border-slate-200 bg-white px-3 shadow-sm md:flex">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={searchValue}
                onChange={(event) => onSearchChange?.(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSearchSubmit?.();
                }}
                placeholder={searchPlaceholder}
                className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400">⌘F</kbd>
            </div>

            {notificationsSlot || defaultNotifications}

            <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm md:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-[11px] font-semibold text-white">{displayInitials}</span>
              <span className="min-w-0">
                <span className="block max-w-36 truncate text-xs font-semibold text-slate-900">{displayName}</span>
                <span className="block max-w-36 truncate text-[11px] text-slate-500">{displayEmail}</span>
              </span>
            </div>
          </div>
          {topContent ? <div className="border-t border-slate-200/70 px-4 py-3 md:px-6">{topContent}</div> : null}
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-7">{children}</main>
        {footerSlot ? <footer className="mx-auto w-full max-w-7xl px-4 pb-6 md:px-6">{footerSlot}</footer> : null}
      </div>

      {floatingAction}
    </div>
    </PermissionsProvider>
  );
}
