'use client';

import { useState, type ReactNode } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { Bell, Search, Menu, X, ChevronRight } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import { StatusBadge } from '@/components/ui';
import { defaultLocale, isLocale } from '@/i18n';

interface AdminLayoutProps {
  children: ReactNode;
  organizationName?: string;
  organizationCode?: string;
  organizationStatus?: string;
  userInitials?: string;
  userEmail?: string;
  notificationsCount?: number;
  onLogout?: () => void;
}

export default function AdminLayout({
  children,
  organizationName = 'A.P.C. Centru',
  organizationCode = 'A0123-0940',
  organizationStatus = 'ACTIVE',
  userInitials = 'AD',
  userEmail = 'admin@espace.md',
  notificationsCount = 0,
  onLogout,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const params = useParams<{ locale?: string }>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;

  // Generate breadcrumbs from pathname
  const breadcrumbs = generateBreadcrumbs(pathname, locale);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <AdminSidebar
          userInitials={userInitials}
          userEmail={userEmail}
          organizationName={organizationName}
          organizationCode={organizationCode}
          onLogout={onLogout}
        />
      </div>

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/50 bg-card/95 px-4 py-3 backdrop-blur-sm lg:hidden">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          <Menu className="size-5" />
        </button>
        
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            ES
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">{organizationName}</span>
            <span className="text-[10px] text-muted-foreground">{organizationCode}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            <Search className="size-5" />
          </button>
          <Link
            href={`/${locale}/admin/notifications`}
            className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            <Bell className="size-5" />
            {notificationsCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">
                {notificationsCount > 9 ? '9+' : notificationsCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 animate-slide-up">
            <AdminSidebar
              userInitials={userInitials}
              userEmail={userEmail}
              organizationName={organizationName}
              organizationCode={organizationCode}
              onLogout={onLogout}
            />
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed right-4 top-4 flex size-10 items-center justify-center rounded-full bg-card shadow-lg"
          >
            <X className="size-5" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="lg:pl-60 transition-[padding] duration-200">
        {/* Desktop Header */}
        <header className="sticky top-0 z-20 hidden border-b border-border/50 bg-card/95 px-6 py-3 backdrop-blur-sm lg:block">
          <div className="flex items-center justify-between">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1.5 text-sm">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.href} className="flex items-center gap-1.5">
                  {index > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
                  {index === breadcrumbs.length - 1 ? (
                    <span className="font-medium text-foreground">{crumb.label}</span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </div>
              ))}
              {organizationStatus && breadcrumbs.length === 1 && (
                <StatusBadge status={organizationStatus} size="sm" className="ml-2" />
              )}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Caută locatari, apartamente..."
                  className="w-64 rounded-lg border border-border/50 bg-muted/30 pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden items-center gap-0.5 rounded border border-border/60 bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground lg:inline-flex">
                  <span>⌘</span>
                  <span>F</span>
                </kbd>
              </div>

              {/* Notifications */}
              <Link
                href={`/${locale}/admin/notifications`}
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

        {/* Page Content */}
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}

// Breadcrumb generation helper
function generateBreadcrumbs(pathname: string, locale: string) {
  const routeLabels: Record<string, string> = {
    admin: 'Dashboard',
    apartments: 'Apartamente',
    residents: 'Locatari',
    tariffs: 'Tarife',
    meters: 'Contoare',
    'meter-readings': 'Citiri contoare',
    billing: 'Facturare',
    invoices: 'Facturi',
    payments: 'Plăți',
    reports: 'Rapoarte',
    announcements: 'Avizier',
    requests: 'Solicitări',
    'data-quality': 'Calitatea datelor',
    imports: 'Import',
    exports: 'Export',
    notifications: 'Notificări',
    settings: 'Setări',
  };

  const pathWithoutLocale = pathname.replace(`/${locale}`, '');
  const segments = pathWithoutLocale.split('/').filter(Boolean);
  
  const crumbs: { label: string; href: string }[] = [];
  let currentPath = `/${locale}`;

  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    crumbs.push({ label, href: currentPath });
  }

  return crumbs.length ? crumbs : [{ label: 'Dashboard', href: `/${locale}/admin` }];
}
