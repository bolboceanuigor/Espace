'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Building2, CircleAlert, CreditCard, Gauge, Headphones, Home, Megaphone, MessageCircle, Settings, Shield, UserRound, Users } from 'lucide-react';
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
  const mobileGridTemplateColumns = `repeat(${items.length}, minmax(${isWideMenu ? '76px' : '0'}, 1fr))`;

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
      <nav
        aria-label="Navigare principală mobilă"
        className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 overflow-x-auto rounded-[1.65rem] border border-border/70 bg-white/92 shadow-[0_24px_70px_rgba(15,23,42,0.18)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/82 md:hidden"
      >
        <div
          className={`mx-auto grid items-end gap-1 px-2.5 py-2 ${
            isWideMenu ? 'min-w-max max-w-none' : 'max-w-md'
          }`}
          style={{ gridTemplateColumns: mobileGridTemplateColumns }}
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
              className={`group flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold leading-none transition duration-200 ease-out ${
                item.center && !isWideMenu
                  ? `relative -translate-y-4 mx-0.5 min-h-[76px] rounded-[1.35rem] border shadow-[0_16px_36px_rgba(15,23,42,0.16)] ${
                      active
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-background text-foreground'
                    }`
                  : active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              <span
                className={`flex items-center justify-center rounded-full transition ${
                  item.center
                    ? active
                      ? 'bg-white/15'
                      : 'bg-muted'
                    : active
                      ? 'bg-white'
                      : 'bg-transparent group-hover:bg-background'
                } ${item.center ? 'h-10 w-10' : 'h-8 w-8'}`}
              >
                <Icon className={item.center ? 'h-5 w-5' : 'h-[18px] w-[18px]'} />
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        </div>
      </nav>
      ) : null}
    </>
  );
}
