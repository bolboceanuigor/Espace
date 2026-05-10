'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Building2, ChevronRight, CircleAlert, CreditCard, FileText, Gauge, Home, Megaphone, Menu, MessageCircle, Settings, Shield, UserRound, Users } from 'lucide-react';
import { defaultLocale, isLocale } from '@/i18n';
import {
  getMainNavigationItems,
  type MainNavigationKey,
  type MainNavigationRole,
} from '@/lib/main-navigation';
import { normalizeRole } from '@/lib/role-routing';

type MainNavigationProps = {
  role: MainNavigationRole;
  variant?: 'responsive' | 'desktop' | 'mobile';
};

const ICONS: Record<MainNavigationKey, React.ComponentType<{ className?: string }>> = {
  platform: Shield,
  organizations: Building2,
  administrators: Users,
  tasks: CircleAlert,
  subscriptions: CreditCard,
  globalSettings: Settings,
  adminHome: Home,
  apartments: Building2,
  invoices: FileText,
  invoiceDraft: FileText,
  reports: FileText,
  announcements: Megaphone,
  residents: Users,
  residentUpdateRequests: UserRound,
  meters: Gauge,
  payments: CreditCard,
  paymentReconciliation: FileText,
  issues: CircleAlert,
  documents: FileText,
  home: Home,
  chat: MessageCircle,
  imports: FileText,
  buildingSettings: Settings,
  account: UserRound,
};

export default function MainNavigation({ role, variant = 'responsive' }: MainNavigationProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const normalizedRole = normalizeRole(role);
  const items = getMainNavigationItems(role).map((item) => ({
    ...item,
    icon: ICONS[item.key],
  }));
  const showDesktop = variant !== 'mobile';
  const showMobile = variant !== 'desktop';
  const isWideMenu = items.length > 5;
  const gridTemplateColumns = `repeat(${items.length}, minmax(0, 1fr))`;
  const mobilePrimaryItems = useMemo(() => {
    const primaryKeys: Partial<Record<ReturnType<typeof normalizeRole>, MainNavigationKey[]>> = {
      SUPER_ADMIN: ['platform', 'organizations', 'administrators'],
      ADMIN: ['adminHome', 'apartments', 'residents', 'invoices'],
      RESIDENT: ['home', 'payments', 'meters', 'issues'],
    };
    const keys = primaryKeys[normalizedRole] || items.slice(0, 4).map((item) => item.key);
    return keys.map((key) => items.find((item) => item.key === key)).filter(Boolean) as typeof items;
  }, [items, normalizedRole]);
  const mobileMoreItems = useMemo(
    () => items.filter((item) => !mobilePrimaryItems.some((primary) => primary.href === item.href)),
    [items, mobilePrimaryItems],
  );

  return (
    <>
      {showDesktop ? (
      <nav
        aria-label="Navigare principală"
        className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 hidden px-4 md:block"
      >
        <div className="flex w-full items-center justify-center">
          <div
            className={`w-full rounded-[1.65rem] border border-border/70 bg-white/88 p-1.5 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/78 ${
              isWideMenu
                ? 'flex max-w-6xl gap-1 overflow-x-auto'
                : 'grid max-w-5xl gap-1'
            }`}
            style={isWideMenu ? undefined : { gridTemplateColumns }}
          >
            {items.map((item) => {
              const target = `/${locale}${item.href}`;
              const active = item.center
                ? pathname === target
                : pathname === target || pathname.startsWith(`${target}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={target}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold transition duration-200 ease-out ${
                    isWideMenu ? 'min-w-[132px] flex-1' : ''
                  } ${
                    item.center
                      ? active
                        ? 'bg-foreground text-background shadow-[0_12px_28px_rgba(15,23,42,0.16)]'
                        : 'bg-muted/70 text-foreground hover:bg-muted'
                      : active
                        ? 'bg-foreground/[0.08] text-foreground'
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      ) : null}

      {showMobile ? (
        <>
          <nav
            aria-label="Navigare principală mobilă"
            className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 rounded-[1.65rem] border border-border/70 bg-white/92 shadow-[0_24px_70px_rgba(15,23,42,0.18)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/82 md:hidden"
          >
            <div
              className="mx-auto grid max-w-md items-end gap-1 px-2.5 py-2"
              style={{ gridTemplateColumns: `repeat(${mobilePrimaryItems.length + 1}, minmax(0, 1fr))` }}
            >
              {mobilePrimaryItems.map((item) => {
                const target = `/${locale}${item.href}`;
                const active = item.center
                  ? pathname === target
                  : pathname === target || pathname.startsWith(`${target}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={target}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold leading-none transition duration-200 ease-out ${
                      active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full transition ${active ? 'bg-white' : 'bg-transparent group-hover:bg-background'}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="max-w-full truncate">{item.label}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="group flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold leading-none text-muted-foreground transition duration-200 ease-out hover:bg-muted/60 hover:text-foreground"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full transition group-hover:bg-background">
                  <Menu className="h-[18px] w-[18px]" />
                </span>
                <span className="max-w-full truncate">Mai mult</span>
              </button>
            </div>
          </nav>

          {moreOpen ? (
            <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setMoreOpen(false)}>
              <div
                className="absolute inset-x-0 bottom-0 max-h-[72vh] overflow-y-auto rounded-t-[1.75rem] border-t border-border/70 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-24px_70px_rgba(15,23,42,0.18)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
                <p className="mb-3 text-sm font-semibold text-foreground">Navigare</p>
                <div className="grid gap-2">
                  {mobileMoreItems.map((item) => {
                    const target = `/${locale}${item.href}`;
                    const active = pathname === target || pathname.startsWith(`${target}/`);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={target}
                        onClick={() => setMoreOpen(false)}
                        className={`flex min-h-12 items-center justify-between rounded-2xl border px-3 text-sm font-semibold ${
                          active
                            ? 'border-foreground/20 bg-muted text-foreground'
                            : 'border-border/70 bg-white text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <span className="inline-flex min-w-0 items-center gap-3">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
