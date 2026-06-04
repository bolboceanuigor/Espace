'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Home,
  Building2,
  Users,
  Receipt,
  CreditCard,
  Gauge,
  FileText,
  Megaphone,
  CircleAlert,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  BarChart3,
  Upload,
  Download,
  ListChecks,
  Bell,
  Calculator,
  Wallet,
  MessageCircle,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { Tooltip } from '@/components/ui';
import { defaultLocale, isLocale } from '@/i18n';

// Admin navigation structure
const adminNavigation = {
  main: [
    { labelKey: 'items.dashboard', href: '/admin', icon: Home },
    { labelKey: 'items.apartments', href: '/admin/apartments', icon: Building2 },
    { labelKey: 'items.residents', href: '/admin/residents', icon: Users },
    { labelKey: 'items.tariffs', href: '/admin/tariffs', icon: Calculator },
    { labelKey: 'items.meters', href: '/admin/meters', icon: Gauge },
    { labelKey: 'items.meterReadings', href: '/admin/meter-readings', icon: ListChecks },
    { labelKey: 'items.residentReadings', href: '/admin/resident-readings', icon: ListChecks },
    { labelKey: 'items.billing', href: '/admin/billing', icon: Receipt },
    { labelKey: 'items.invoiceDrafts', href: '/admin/billing-drafts', icon: FileText },
    { labelKey: 'items.invoices', href: '/admin/invoices', icon: FileText },
    { labelKey: 'items.payments', href: '/admin/payments', icon: CreditCard },
    { labelKey: 'items.reports', href: '/admin/reports', icon: BarChart3 },
  ],
  secondary: [
    { labelKey: 'items.announcements', href: '/admin/announcements', icon: Megaphone },
    { labelKey: 'items.requests', href: '/admin/requests', icon: CircleAlert },
    { labelKey: 'items.serviceProviders', href: '/admin/service-providers', icon: UserCheck },
    { labelKey: 'items.connect', href: '/admin/connect', icon: MessageCircle },
    { labelKey: 'items.dataQuality', href: '/admin/data-quality', icon: ListChecks },
    { labelKey: 'items.importExport', href: '/admin/imports', icon: Upload },
  ],
  footer: [
    { labelKey: 'items.notifications', href: '/admin/notifications', icon: Bell },
    { labelKey: 'items.settings', href: '/admin/settings', icon: Settings },
  ],
};

interface AdminSidebarProps {
  userInitials?: string;
  userEmail?: string;
  organizationName?: string;
  organizationCode?: string;
  onLogout?: () => void;
}

export default function AdminSidebar({
  userInitials = 'AD',
  userEmail = 'admin@espace.md',
  organizationName = 'Espace',
  organizationCode = '—',
  onLogout,
}: AdminSidebarProps) {
  const t = useTranslations('navigation.adminCompactSidebar');
  const pathname = usePathname();
  const params = useParams<{ locale?: string }>();
  const [collapsed, setCollapsed] = useState(false);
  
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const localePrefix = `/${locale}`;

  const isActive = (href: string) => {
    const fullHref = `${localePrefix}${href}`;
    return pathname === fullHref || pathname.startsWith(`${fullHref}/`);
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/10 bg-sidebar text-white shadow-[18px_0_54px_rgba(15,23,42,0.20)] transition-[width] duration-200 ease-out ${
        collapsed ? 'w-[68px]' : 'w-60'
      }`}
    >
      {/* Header - Organization Info */}
      <div className="flex items-center gap-3 border-b border-white/10 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-white text-xs font-bold text-primary">
          ES
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-white">{organizationName}</p>
            <p className="truncate text-xs text-white/50">{organizationCode}</p>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <NavSection items={adminNavigation.main} collapsed={collapsed} isActive={isActive} localePrefix={localePrefix} />
        
        {!collapsed && (
          <div className="mx-3 my-3 h-px bg-white/10" />
        )}
        
        <NavSection items={adminNavigation.secondary} collapsed={collapsed} isActive={isActive} localePrefix={localePrefix} />
      </nav>

      {/* Footer Navigation */}
      <div className="border-t border-white/10 p-2">
        <NavSection items={adminNavigation.footer} collapsed={collapsed} isActive={isActive} localePrefix={localePrefix} />
        
        {/* User Info */}
        <div className={`mt-2 rounded-2xl border border-white/10 bg-white/10 p-2 ${collapsed ? 'flex flex-col items-center' : ''}`}>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-primary">
              {userInitials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-white">{userEmail}</p>
                <p className="truncate text-[10px] text-white/50">{t('roleLabel')}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onLogout}
            className={`mt-2 flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/15 hover:text-white ${
              collapsed ? 'w-full' : 'w-full'
            }`}
          >
            <LogOut className="size-3.5" />
            {!collapsed && <span>{t('logout')}</span>}
          </button>
        </div>

        {/* Collapse Toggle */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full px-2 py-1.5 text-xs text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <>
              <ChevronLeft className="size-4" />
              <span>{t('collapse')}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

interface NavSectionProps {
  items: { labelKey: string; href: string; icon: LucideIcon }[];
  collapsed: boolean;
  isActive: (href: string) => boolean;
  localePrefix: string;
}

function NavSection({ items, collapsed, isActive, localePrefix }: NavSectionProps) {
  const t = useTranslations('navigation.adminCompactSidebar');
  return (
    <div className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        
        const linkContent = (
          <Link
            href={`${localePrefix}${item.href}`}
            className={`group flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-[13px] font-medium transition-colors ${
              active
                ? 'bg-white/15 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <div
              className={`flex size-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                active ? 'bg-white/10 shadow-sm' : 'group-hover:bg-white/10'
              }`}
            >
              <Icon className="size-[18px]" />
            </div>
            {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={item.href} content={t(item.labelKey)}>
              {linkContent}
            </Tooltip>
          );
        }

        return <div key={item.href}>{linkContent}</div>;
      })}
    </div>
  );
}
