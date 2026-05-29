'use client';

import Link from 'next/link';
import { Bell, ChevronLeft, RefreshCw, UserRound } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useLocalizedPath } from '@/lib/use-localized-path';

type ResidentMobileHeaderProps = {
  title?: string;
  userName?: string;
  organizationName?: string;
  apartmentLabel?: string;
  unreadNotifications?: number;
  onRefresh?: () => void;
};

function routeTitle(pathname: string) {
  if (pathname.includes('/resident/balance')) return 'Soldul meu';
  if (pathname.includes('/resident/invoices')) return 'Facturile mele';
  if (pathname.includes('/resident/payments')) return 'Plăți';
  if (pathname.includes('/resident/announcements')) return 'Avizier';
  if (pathname.includes('/resident/requests')) return 'Solicitări';
  if (pathname.includes('/resident/meters')) return 'Contoare';
  if (pathname.includes('/resident/profile')) return 'Cont';
  if (pathname.includes('/resident/notifications')) return 'Notificări';
  return 'Acasă';
}

export default function ResidentMobileHeader({
  title,
  userName,
  organizationName,
  apartmentLabel,
  unreadNotifications = 0,
  onRefresh,
}: ResidentMobileHeaderProps) {
  const pathname = usePathname();
  const localizedPath = useLocalizedPath();
  const isDetail = /\/resident\/[^/]+\/[^/]+/.test(pathname) && !pathname.endsWith('/new');
  const displayTitle = title || routeTitle(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-slate-50/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-2xl items-center gap-3 px-4">
        {isDetail ? (
          <Link href={localizedPath('/resident')} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : (
          <Link href={localizedPath('/resident')} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-sm">
            E
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-950">{displayTitle}</p>
          <p className="truncate text-xs text-slate-500">
            {organizationName || 'A.P.C.'}{apartmentLabel ? ` · ${apartmentLabel}` : userName ? ` · ${userName}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 sm:flex"
          aria-label="Actualizează"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <Link href={localizedPath('/resident/notifications')} className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200" aria-label="Notificări">
          <Bell className="h-5 w-5" />
          {unreadNotifications > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {Math.min(unreadNotifications, 9)}
            </span>
          ) : null}
        </Link>
        <Link href={localizedPath('/resident/profile')} className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 md:flex" aria-label="Profil">
          <UserRound className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
