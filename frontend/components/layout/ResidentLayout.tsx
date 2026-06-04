'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Home,
  FileText,
  Gauge,
  WalletCards,
  CircleAlert,
  MessageCircle,
  Megaphone,
  User,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import { defaultLocale, isLocale } from '@/i18n';

// Resident navigation items
const residentNavigation: { href: string; labelKey: string; icon: LucideIcon; mobileOnly?: boolean }[] = [
  { href: '/resident', labelKey: 'items.home', icon: Home },
  { href: '/resident/invoices', labelKey: 'items.invoices', icon: FileText },
  { href: '/resident/balance', labelKey: 'items.balance', icon: WalletCards },
  { href: '/resident/meters', labelKey: 'items.meters', icon: Gauge },
  { href: '/resident/requests', labelKey: 'items.requests', icon: CircleAlert },
  { href: '/resident/connect', labelKey: 'items.messages', icon: MessageCircle },
  { href: '/resident/announcements', labelKey: 'items.announcements', icon: Megaphone, mobileOnly: true },
  { href: '/resident/profile', labelKey: 'items.account', icon: User },
];

interface ResidentLayoutProps {
  children: ReactNode;
  userName?: string;
  apartmentNumber?: string;
  organizationName?: string;
  notificationsCount?: number;
}

export default function ResidentLayout({
  children,
  userName = 'Locatar',
  apartmentNumber = 'Apartament',
  organizationName = 'Espace',
  notificationsCount = 0,
}: ResidentLayoutProps) {
  const t = useTranslations('navigation.resident');
  const pathname = usePathname();
  const params = useParams<{ locale?: string }>();
  
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const localePrefix = `/${locale}`;

  const isActive = (href: string) => {
    const fullHref = `${localePrefix}${href}`;
    return pathname === fullHref || pathname.startsWith(`${fullHref}/`);
  };

  const mainNavItems = residentNavigation.filter((item) => !item.mobileOnly);
  const mobileNavItems = residentNavigation.slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 to-background">
      {/* Desktop Header */}
      <header className="sticky top-0 z-30 hidden border-b border-border/50 bg-card/95 backdrop-blur-sm md:block">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex items-center justify-between py-3">
            {/* Logo & Org */}
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                ES
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{organizationName}</p>
                <p className="text-xs text-muted-foreground">{apartmentNumber}</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="flex items-center gap-1">
              {mainNavItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={`${localePrefix}${item.href}`}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-4" />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Notifications */}
            <Link
              href={`${localePrefix}/resident/notifications`}
              className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <Bell className="size-5" />
              {notificationsCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">
                  {notificationsCount > 9 ? '9+' : notificationsCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/50 bg-card/95 px-4 py-3 backdrop-blur-sm md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            ES
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{userName}</p>
            <p className="text-[10px] text-muted-foreground">{apartmentNumber} • {organizationName}</p>
          </div>
        </div>
        
        <Link
          href={`${localePrefix}/resident/notifications`}
          className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <Bell className="size-5" />
          {notificationsCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">
              {notificationsCount > 9 ? '9+' : notificationsCount}
            </span>
          )}
        </Link>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-5xl px-4 py-5 pb-24 md:py-8 md:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-card/95 backdrop-blur-sm md:hidden safe-area-pb">
        <div className="grid grid-cols-5">
          {mobileNavItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={`${localePrefix}${item.href}`}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <div
                  className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                    active ? 'bg-primary/10' : ''
                  }`}
                >
                  <Icon className="size-5" />
                </div>
                <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// Resident greeting component
export function ResidentGreeting({ name, time }: { name: string; time?: Date }) {
  const t = useTranslations('navigation.resident');
  const hour = (time || new Date()).getHours();
  const greeting =
    hour < 12 ? t('greetings.morning') : hour < 18 ? t('greetings.afternoon') : t('greetings.evening');

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-foreground">
        {greeting}, {name.split(' ')[0]}!
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('welcome')}
      </p>
    </div>
  );
}
