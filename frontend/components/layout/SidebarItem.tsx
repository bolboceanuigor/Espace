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
        className={`group flex items-center gap-2.5 rounded-2xl px-3 py-2 text-[13px] transition duration-150 ease-out text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 ${
          active ? 'bg-white/15 text-white' : ''
        } ${locked ? 'opacity-60 cursor-not-allowed hover:bg-transparent' : ''}`}
      >
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
            active ? 'bg-white/10 text-white' : ''
          }`}
        >
          <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-white/55 group-hover:text-white'}`} />
        </div>
        {showLabels ? <span className="truncate">{label}</span> : null}
        {showLabels && locked ? (
          <span className="ml-auto rounded-full border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60">
            locked
          </span>
        ) : null}
        {badgeCount && badgeCount > 0 ? (
          <span className="ml-auto rounded-full border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {badgeCount}
          </span>
        ) : null}
      </Link>
    </Tooltip>
  );
}
