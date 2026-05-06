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
        className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-150 ${
          active
            ? 'bg-foreground text-white'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        } ${locked ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''}`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {showLabels ? <span className="truncate">{label}</span> : null}
        {showLabels && locked ? (
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            locked
          </span>
        ) : null}
        {badgeCount && badgeCount > 0 ? (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            {badgeCount}
          </span>
        ) : null}
      </Link>
    </Tooltip>
  );
}
