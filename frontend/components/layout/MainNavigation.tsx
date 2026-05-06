'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Building2, ChevronRight, CircleAlert, CreditCard, Gauge, Headphones, Home, Megaphone, Menu, MessageCircle, Settings, Shield, UserRound, Users } from 'lucide-react';
import { defaultLocale, isLocale } from '@/i18n';
import {
  getMainNavigationItems,
  type MainNavigationKey,
  type MainNavigationRole,
} from '@/lib/main-navigation';

type MainNavigationProps = {
  role: MainNavigationRole;
  variant?: 'responsive' | 'desktop' | 'mobile';
};

const ICONS: Record<MainNavigationKey, React.ComponentType<{ className?: string }>> = {
  platform: Shield,
  organizations: Building2,
  administrators: Users,
  subscriptions: CreditCard,
  support: Headphones,
  globalSettings: Settings,
  adminHome: Home,
  apartments: Building2,
  announcements: Megaphone,
  residents: Users,
  meters: Gauge,
  payments: CreditCard,
  issues: CircleAlert,
  home: Home,
  chat: MessageCircle,
  buildingSettings: Settings,
  account: UserRound,
};

export default function MainNavigation({ role, variant = 'responsive' }: MainNavigationProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const items = getMainNavigationItems(role).map((item) => ({
    ...item,
    icon: ICONS[item.key],
  }));
  const showDesktop = variant !== 'mobile';
  const showMobile = variant !== 'desktop';
  const isWideMenu = items.length > 5;
  const gridTemplateColumns = `repeat(${items.length}, minmax(0, 1fr))`;
  const mobilePrimaryItems = useMemo(() => items.slice(0, 4), [items]);
  const mobileMoreItems = useMemo(() => items.slice(4), [items]);

  return (
    <>
      {showDesktop ? (
      <nav
        aria-label="Navigare principala"
        className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 hidden px-4 md:block"
      >
        <div className="flex w-full items-center justify-center">
          <div
            className={`w-full rounded-2xl border border-border bg-white p-1 shadow-large ${
              isWideMenu
                ? 'flex max-w-6xl gap-0.5 overflow-x-auto'
                : 'grid max-w-5xl gap-0.5'
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
                  className={`group flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition ${
                    isWideMenu ? 'min-w-[120px] flex-1' : ''
                  } ${
                    item.center
                      ? active
                        ? 'bg-foreground text-white shadow-medium'
                        : 'bg-muted text-foreground hover:bg-muted/80'
                      : active
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
            aria-label="Navigare principala mobila"
            className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 rounded-2xl border border-border bg-white shadow-large md:hidden"
          >
            <div className="mx-auto grid max-w-md grid-cols-5 items-end gap-0.5 px-2 py-1.5">
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
                    className={`group flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium leading-none transition ${
                      active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${active ? 'bg-foreground text-white' : 'bg-transparent group-hover:bg-muted'}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="max-w-full truncate">{item.label}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="group flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium leading-none text-muted-foreground transition hover:text-foreground"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg transition group-hover:bg-muted">
                  <Menu className="h-[18px] w-[18px]" />
                </span>
                <span className="max-w-full truncate">Mai mult</span>
              </button>
            </div>
          </nav>

          {moreOpen ? (
            <div className="fixed inset-0 z-50 bg-black/30 md:hidden" onClick={() => setMoreOpen(false)}>
              <div
                className="absolute inset-x-0 bottom-0 max-h-[72vh] overflow-y-auto rounded-t-2xl border-t border-border bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-large"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
                <p className="mb-3 text-sm font-semibold text-foreground">Navigare</p>
                <div className="grid gap-1.5">
                  {mobileMoreItems.map((item) => {
                    const target = `/${locale}${item.href}`;
                    const active = pathname === target || pathname.startsWith(`${target}/`);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={target}
                        onClick={() => setMoreOpen(false)}
                        className={`flex min-h-11 items-center justify-between rounded-xl border px-3 text-sm font-medium transition ${
                          active
                            ? 'border-border bg-muted text-foreground'
                            : 'border-border bg-white text-foreground hover:bg-muted'
                        }`}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
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
