'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
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
  type LucideIcon,
} from 'lucide-react';
import { Tooltip } from '@/components/ui';
import { defaultLocale, isLocale } from '@/i18n';

// Admin navigation structure
const adminNavigation = {
  main: [
    { label: 'Dashboard', href: '/admin', icon: Home },
    { label: 'Apartamente', href: '/admin/apartments', icon: Building2 },
    { label: 'Locatari', href: '/admin/residents', icon: Users },
    { label: 'Tarife', href: '/admin/tariffs', icon: Calculator },
    { label: 'Contoare', href: '/admin/meters', icon: Gauge },
    { label: 'Citiri contoare', href: '/admin/meter-readings', icon: ListChecks },
    { label: 'Facturare', href: '/admin/billing', icon: Receipt },
    { label: 'Facturi', href: '/admin/invoices', icon: FileText },
    { label: 'Plăți', href: '/admin/payments', icon: CreditCard },
    { label: 'Rapoarte', href: '/admin/reports', icon: BarChart3 },
  ],
  secondary: [
    { label: 'Avizier', href: '/admin/announcements', icon: Megaphone },
    { label: 'Solicitări', href: '/admin/requests', icon: CircleAlert },
    { label: 'Calitatea datelor', href: '/admin/data-quality', icon: ListChecks },
    { label: 'Import / Export', href: '/admin/imports', icon: Upload },
  ],
  footer: [
    { label: 'Notificări', href: '/admin/notifications', icon: Bell },
    { label: 'Setări', href: '/admin/settings', icon: Settings },
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
  organizationName = 'A.P.C. Centru',
  organizationCode = 'A0123-0940',
  onLogout,
}: AdminSidebarProps) {
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
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border/50 bg-card transition-[width] duration-200 ease-out ${
        collapsed ? 'w-[68px]' : 'w-60'
      }`}
    >
      {/* Header - Organization Info */}
      <div className="flex items-center gap-3 border-b border-border/50 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
          ES
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{organizationName}</p>
            <p className="truncate text-xs text-muted-foreground">{organizationCode}</p>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <NavSection items={adminNavigation.main} collapsed={collapsed} isActive={isActive} localePrefix={localePrefix} />
        
        {!collapsed && (
          <div className="mx-3 my-3 h-px bg-border/50" />
        )}
        
        <NavSection items={adminNavigation.secondary} collapsed={collapsed} isActive={isActive} localePrefix={localePrefix} />
      </nav>

      {/* Footer Navigation */}
      <div className="border-t border-border/50 p-2">
        <NavSection items={adminNavigation.footer} collapsed={collapsed} isActive={isActive} localePrefix={localePrefix} />
        
        {/* User Info */}
        <div className={`mt-2 rounded-lg border border-border/50 bg-muted/30 p-2 ${collapsed ? 'flex flex-col items-center' : ''}`}>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
              {userInitials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{userEmail}</p>
                <p className="truncate text-[10px] text-muted-foreground">Administrator</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onLogout}
            className={`mt-2 flex items-center justify-center gap-1.5 rounded-md border border-border/50 bg-card px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground ${
              collapsed ? 'w-full' : 'w-full'
            }`}
          >
            <LogOut className="size-3.5" />
            {!collapsed && <span>Deconectare</span>}
          </button>
        </div>

        {/* Collapse Toggle */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <>
              <ChevronLeft className="size-4" />
              <span>Restrânge</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

interface NavSectionProps {
  items: { label: string; href: string; icon: LucideIcon }[];
  collapsed: boolean;
  isActive: (href: string) => boolean;
  localePrefix: string;
}

function NavSection({ items, collapsed, isActive, localePrefix }: NavSectionProps) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        
        const linkContent = (
          <Link
            href={`${localePrefix}${item.href}`}
            className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
              active
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <div
              className={`flex size-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                active ? 'bg-card shadow-sm' : 'group-hover:bg-card/50'
              }`}
            >
              <Icon className="size-[18px]" />
            </div>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={item.href} content={item.label}>
              {linkContent}
            </Tooltip>
          );
        }

        return <div key={item.href}>{linkContent}</div>;
      })}
    </div>
  );
}
