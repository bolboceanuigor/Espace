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
            className={`w-full rounded-2xl border border-border/40 bg-white/90 p-1 shadow-[0_8px_40px_rgba(0,0,0,0.08)] backdrop-blur-2xl ${
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
                  className={`group flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition-all duration-200 ${
                    isWideMenu ? 'min-w-[130px] flex-1' : ''
                  } ${
                    item.center
                      ? active
                        ? 'bg-foreground text-background shadow-[0_4px_12px_rgba(0,0,0,0.15)]'
                        : 'bg-muted/50 text-foreground hover:bg-muted/70'
                      : active
                        ? 'bg-muted/60 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
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
            className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 rounded-2xl border border-border/40 bg-white/95 shadow-[0_8px_40px_rgba(0,0,0,0.1)] backdrop-blur-2xl md:hidden"
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
                    className={`group flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold leading-none transition-all duration-200 ${
                      active ? 'bg-muted/60 text-foreground' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${active ? 'bg-foreground text-background' : 'bg-transparent group-hover:bg-muted/50'}`}>
                      <Icon className="h-[17px] w-[17px]" />
                    </span>
                    <span className="max-w-full truncate">{item.label}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="group flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold leading-none text-muted-foreground transition-all duration-200 hover:bg-muted/40 hover:text-foreground"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg transition-all group-hover:bg-muted/50">
                  <Menu className="h-[17px] w-[17px]" />
                </span>
                <span className="max-w-full truncate">Mai mult</span>
              </button>
            </div>
          </nav>

          {moreOpen ? (
            <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm md:hidden" onClick={() => setMoreOpen(false)}>
              <div
                className="absolute inset-x-0 bottom-0 max-h-[72vh] overflow-y-auto rounded-t-2xl border-t border-border/40 bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-8px_40px_rgba(0,0,0,0.1)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-muted" />
                <p className="mb-4 text-sm font-semibold text-foreground">Navigare</p>
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
                        className={`flex min-h-12 items-center justify-between rounded-xl border px-4 text-sm font-medium transition-all duration-200 ${
                          active
                            ? 'border-foreground/10 bg-muted/50 text-foreground'
                            : 'border-border/50 bg-white text-foreground hover:bg-muted/30'
                        }`}
                      >
                        <span className="inline-flex min-w-0 items-center gap-3">
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
