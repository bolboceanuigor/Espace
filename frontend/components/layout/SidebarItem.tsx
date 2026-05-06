'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tooltip } from '@/components/ui';
import type { NavigationItem } from '@/lib/navigation-config';
import { NAVIGATION_ICON_MAP } from './navigation-icons';

type SidebarItemProps = {
  item: NavigationItem;
  showLabels: boolean;
  badgeCount?: number;
  localePrefix?: string;
};

export default function SidebarItem({ item, showLabels, badgeCount, localePrefix = '' }: SidebarItemProps) {
  const pathname = usePathname();
  const fallbackPath =
    item.lockReason === 'SUBSCRIPTION_LIMIT' && item.role === 'ADMIN'
      ? '/admin/subscription'
      : item.role === 'SUPER_ADMIN'
        ? '/superadmin'
        : item.role === 'RESIDENT'
          ? '/resident'
          : '/admin';
  const destination = item.locked ? fallbackPath : item.href;
  const target = `${localePrefix}${destination}`;
  const active = pathname === `${localePrefix}${item.href}` || pathname.startsWith(`${localePrefix}${item.href}/`);
  const Icon = NAVIGATION_ICON_MAP[item.icon];
  const label = item.label;
  const locked = !!item.locked;

  return (
    <Tooltip content={label} disabled={showLabels}>
      <Link
        href={target}
        aria-disabled={locked}
        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ease-out text-muted-foreground hover:text-foreground hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
          active ? 'bg-white text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.04)]' : ''
        } ${locked ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''}`}
      >
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${
            active ? 'bg-foreground text-background' : 'bg-muted/50 group-hover:bg-muted'
          }`}
        >
          <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? 'text-background' : 'text-muted-foreground group-hover:text-foreground'}`} />
        </div>
        {showLabels ? <span className="truncate">{label}</span> : null}
        {showLabels && locked ? (
          <span className="ml-auto rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            locked
          </span>
        ) : null}
        {badgeCount && badgeCount > 0 ? (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-md bg-foreground px-1.5 text-[10px] font-semibold text-background">
            {badgeCount}
          </span>
        ) : null}
      </Link>
    </Tooltip>
  );
}
