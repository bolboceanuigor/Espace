'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ChevronRight, Menu } from 'lucide-react';
import { defaultLocale, isLocale } from '@/i18n';
import type { NavigationItem } from '@/lib/navigation-config';
import { NAVIGATION_ICON_MAP } from './navigation-icons';

export default function MobileBottomNav({ navItems }: { navItems: NavigationItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;

  const primaryItems = useMemo(
    () => navItems.filter((item) => item.mobileVisible && !item.moreMenu).slice(0, 4),
    [navItems],
  );
  const moreItems = useMemo(() => navItems.filter((item) => item.moreMenu), [navItems]);
  const resolveTarget = (item: NavigationItem) => {
    if (!item.locked) return `/${locale}${item.href}`;
    if (item.lockReason === 'SUBSCRIPTION_LIMIT' && item.role === 'ADMIN') return `/${locale}/admin/subscription`;
    if (item.role === 'SUPER_ADMIN') return `/${locale}/superadmin`;
    if (item.role === 'RESIDENT') return `/${locale}/resident`;
    return `/${locale}/admin`;
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 xl:hidden">
        <div className="grid grid-cols-5 items-end px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2">
          {primaryItems.map((item, idx) => {
            const activeTarget = `/${locale}${item.href}`;
            const target = resolveTarget(item);
            const active = pathname === activeTarget || pathname.startsWith(`${activeTarget}/`);
            const Icon = NAVIGATION_ICON_MAP[item.icon];
            const isCenter = idx === 2;
            return (
              <Link
                key={item.href}
                href={target}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium transition ${
                  isCenter
                    ? `relative -translate-y-3 mx-1 min-h-[64px] rounded-2xl border border-primary/30 shadow-md ${
                        active ? 'bg-primary text-white' : 'bg-card text-primary'
                      }`
                    : active
                      ? 'text-primary'
                      : 'text-muted-foreground'
                } ${item.locked ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <Icon className={isCenter ? 'h-5 w-5' : 'h-4.5 w-4.5'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
          >
            <Menu className="h-4.5 w-4.5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/45 xl:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[72vh] overflow-y-auto rounded-t-2xl border-t border-border/70 bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted" />
            <p className="mb-3 text-sm font-semibold text-foreground">More</p>
            <div className="space-y-1">
              {moreItems.map((item) => {
                const target = resolveTarget(item);
                const activeTarget = `/${locale}${item.href}`;
                const Icon = NAVIGATION_ICON_MAP[item.icon];
                const active = pathname === activeTarget || pathname.startsWith(`${activeTarget}/`);
                return (
                  <Link
                    key={item.href}
                    href={target}
                    onClick={() => {
                      setOpen(false);
                    }}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm ${
                      active
                        ? 'border-primary/30 bg-primary/5 text-primary'
                        : 'border-border/60 text-foreground hover:bg-muted/50'
                    } ${item.locked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {item.label}
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
  );
}
