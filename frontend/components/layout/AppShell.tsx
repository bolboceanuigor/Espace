'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { 
  Bell, Building2, ChevronLeft, CreditCard, FileText, 
  HelpCircle, Home, LogOut, Search, Settings, Shield, 
  Users, X, Menu, BarChart3
} from 'lucide-react';
import OrgSwitcher from './OrgSwitcher';
import { useAuth } from '@/context/AuthContext';
import { ManagerUiProvider } from '@/context/ManagerUiContext';
import { defaultLocale, isLocale } from '@/i18n';
import { featureFlags } from '@/lib/featureFlags';
import { authApi, billingSaasApi, notificationsApi, onboardingApi, subscriptionApi, superadminApi, usageApi } from '@/lib/api';
import { normalizeRole, roleHomePath } from '@/lib/role-routing';
import { isAdminHardBlocked } from '@/lib/subscription-access';
import FeedbackModal from '@/components/feedback/FeedbackModal';
import ResidentAppShell from '@/components/resident/ResidentAppShell';

type AppShellProps = { children: React.ReactNode };

export default function AppShell({ children }: AppShellProps) {
  return (
    <ManagerUiProvider>
      <AppShellContent>{children}</AppShellContent>
    </ManagerUiProvider>
  );
}

// Sidebar navigation items per role
const SUPER_ADMIN_NAV = [
  { key: 'platform', label: 'Platformă', href: '/superadmin', icon: Home },
  { key: 'organizations', label: 'Asociații', href: '/superadmin/organizations', icon: Building2 },
  { key: 'administrators', label: 'Administratori', href: '/superadmin/administrators', icon: Users },
  { key: 'subscriptions', label: 'Abonamente', href: '/superadmin/subscriptions', icon: CreditCard },
  { key: 'reports', label: 'Rapoarte', href: '/superadmin/reports', icon: BarChart3 },
  { key: 'settings', label: 'Setări', href: '/superadmin/settings', icon: Settings },
];

const ADMIN_NAV = [
  { key: 'home', label: 'Acasă', href: '/admin', icon: Home },
  { key: 'apartments', label: 'Apartamente', href: '/admin/apartments', icon: Building2 },
  { key: 'residents', label: 'Locatari', href: '/admin/residents', icon: Users },
  { key: 'invoices', label: 'Facturi', href: '/admin/invoices', icon: FileText },
  { key: 'payments', label: 'Plăți', href: '/admin/payments', icon: CreditCard },
  { key: 'reports', label: 'Rapoarte', href: '/admin/reports', icon: BarChart3 },
  { key: 'settings', label: 'Setări', href: '/admin/settings', icon: Settings },
];

function AppShellContent({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ locale?: string }>();
  const c = useTranslations('common');
  const billingT = useTranslations('billing');
  const { user, org, prefs, system, loading, isAuthenticated, isDemoAuthenticated, updatePreferences, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [adminSubscription, setAdminSubscription] = useState<{ status: string; trialEndDate?: string | null } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  
  const previewRole = pathname.includes('/superadmin')
    ? 'SUPER_ADMIN'
    : pathname.includes('/resident')
      ? 'RESIDENT'
      : 'ADMIN';
  const isPreviewSession = !loading && !isAuthenticated && isDemoAuthenticated;
  const previewUser = isPreviewSession
    ? {
        id: 'preview-user',
        email: 'preview@espace.md',
        firstName: previewRole === 'SUPER_ADMIN' ? 'Espace' : previewRole === 'RESIDENT' ? 'Ion' : 'Admin',
        lastName: previewRole === 'SUPER_ADMIN' ? 'Platform' : previewRole === 'RESIDENT' ? 'Popescu' : 'APC',
        role: previewRole,
        organizationId: 'preview-org',
        emailVerifiedAt: new Date().toISOString(),
        authProvider: 'LOCAL' as const,
        createdAt: '2026-05-01T00:00:00.000Z',
        isDemoUser: true,
      }
    : null;
  const activeUser = user ?? previewUser;
  const activeOrg = org ?? {
    id: 'preview-org',
    name: 'A.P.C. Demo',
    weekStart: 'MONDAY' as const,
    defaultLocale: 'ro' as const,
    betaAccessEnabled: true,
    isDemo: true,
  };
  const normalizedRole = normalizeRole(activeUser?.role);
  const homeRoute = `/${locale}${roleHomePath(normalizedRole)}`;

  // Get nav items based on role
  const navItems = normalizedRole === 'SUPER_ADMIN' ? SUPER_ADMIN_NAV : ADMIN_NAV;

  // Auth redirect
  useEffect(() => {
    if (loading) return;
    if (isPreviewSession) return;
    if (!isAuthenticated) {
      router.replace(`/${locale}/login`);
    }
  }, [isAuthenticated, isPreviewSession, loading, locale, router]);

  // Role-based route protection
  useEffect(() => {
    if (loading || !activeUser || isPreviewSession) return;
    const isSuperadminRoute = pathname.includes('/superadmin');
    const isAdminRoute = pathname.includes('/admin');
    const isResidentRoute = pathname.includes('/resident');
    if (isSuperadminRoute && normalizedRole !== 'SUPER_ADMIN') {
      router.replace(homeRoute);
      return;
    }
    if (isAdminRoute && normalizedRole !== 'ADMIN') {
      router.replace(homeRoute);
      return;
    }
    if (isResidentRoute && normalizedRole !== 'RESIDENT') {
      router.replace(homeRoute);
    }
  }, [activeUser, homeRoute, isPreviewSession, loading, pathname, router, normalizedRole]);

  // Fetch notifications
  useEffect(() => {
    if (!isAuthenticated || isPreviewSession) return;
    const fetchNotifications = async () => {
      try {
        const mode = normalizedRole === 'RESIDENT' ? 'resident' : 'admin';
        const res = mode === 'admin' 
          ? await notificationsApi.adminList() 
          : await notificationsApi.residentList();
        const items = res.data?.items || [];
        setNotifications(items);
        setNotificationsUnreadCount(items.filter((n: any) => !n.isRead).length);
      } catch {
        // ignore
      }
    };
    fetchNotifications();
  }, [isAuthenticated, isPreviewSession, normalizedRole]);

  // Admin subscription status
  useEffect(() => {
    if (!isAuthenticated || normalizedRole !== 'ADMIN') {
      setAdminSubscription(null);
      return;
    }
    billingSaasApi
      .getAdminSubscription()
      .then((res) => {
        const subscription = res.data?.subscription || res.data;
        setAdminSubscription({
          status: String(subscription?.status || '').toUpperCase(),
          trialEndDate: subscription?.trialEndsAt || subscription?.trialEndDate || null,
        });
      })
      .catch(() => setAdminSubscription(null));
  }, [isAuthenticated, normalizedRole]);

  // Check for admin hard block
  useEffect(() => {
    if (isPreviewSession || normalizedRole !== 'ADMIN') return;
    if (!adminSubscription?.status) return;
    if (!isAdminHardBlocked(adminSubscription.status)) return;
    const isAllowedRoute = pathname.includes('/admin/subscription') || pathname.includes('/support');
    if (!isAllowedRoute) {
      router.replace(`/${locale}/admin/subscription`);
    }
  }, [adminSubscription?.status, isPreviewSession, locale, normalizedRole, pathname, router]);

  // Keyboard shortcut for search
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMetaK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isMetaK) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push(`/${locale}/login`);
  };

  if (loading || !activeUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
          <p className="text-sm text-neutral-500">Se încarcă...</p>
        </div>
      </div>
    );
  }

  const betaBlocked =
    featureFlags.requireBetaAccess &&
    normalizedRole !== 'SUPER_ADMIN' &&
    ['ADMIN', 'RESIDENT', 'TENANT'].includes(normalizedRole) &&
    activeOrg?.betaAccessEnabled === false;
  const maintenanceBlocked = normalizedRole !== 'SUPER_ADMIN' && !!system?.maintenanceMode;

  if (betaBlocked || maintenanceBlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 text-center">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-600">
            {maintenanceBlocked ? 'Aplicația este în mentenanță.' : 'Accesul beta nu este activ.'}
          </p>
        </div>
      </div>
    );
  }

  // Resident layout - simplified mobile-first
  if (['RESIDENT', 'TENANT'].includes(normalizedRole)) {
    return <ResidentAppShell unreadNotifications={notificationsUnreadCount}>{children}</ResidentAppShell>;
  }

  // Admin & SuperAdmin layout - Fresha-style with sidebar
  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* Sidebar - Desktop */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-neutral-200 bg-white transition-all duration-200 lg:flex ${
          sidebarCollapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-4">
          {!sidebarCollapsed && (
            <Link href={homeRoute} className="text-lg font-semibold text-neutral-900">
              Espace
            </Link>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <ChevronLeft className={`size-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const href = `/${locale}${item.href}`;
              const isActive = pathname === href || 
                (item.key !== 'platform' && item.key !== 'home' && pathname.startsWith(href + '/'));
              const Icon = item.icon;
              
              return (
                <li key={item.key}>
                  <Link
                    href={href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-neutral-100 text-neutral-900'
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon className="size-4 shrink-0" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-neutral-200 p-3">
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            <HelpCircle className="size-4" />
            {!sidebarCollapsed && <span>Ajutor</span>}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 hover:text-red-600 ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="size-4" />
            {!sidebarCollapsed && <span>Ieșire</span>}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Mobile sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-xl transition-transform duration-200 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-4">
          <span className="text-lg font-semibold text-neutral-900">Espace</span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="p-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const href = `/${locale}${item.href}`;
              const isActive = pathname === href || pathname.startsWith(href + '/');
              const Icon = item.icon;
              
              return (
                <li key={item.key}>
                  <Link
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-neutral-100 text-neutral-900'
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main content */}
      <div className={`flex-1 ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-56'}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
          <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-6">
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden"
            >
              <Menu className="size-5" />
            </button>

            {/* Search */}
            <div className="hidden flex-1 lg:block lg:max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Caută... (⌘K)"
                  className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition-colors focus:border-neutral-300 focus:bg-white focus:ring-1 focus:ring-neutral-200"
                />
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {normalizedRole === 'SUPER_ADMIN' && <OrgSwitcher />}
              
              {/* Demo badge */}
              {(activeUser?.isDemoUser || activeOrg?.isDemo) && (
                <span className="hidden rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 sm:inline-flex">
                  Demo
                </span>
              )}

              {/* Notifications */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative rounded-lg p-2 text-neutral-600 hover:bg-neutral-100"
                >
                  <Bell className="size-5" />
                  {notificationsUnreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                      {notificationsUnreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
                    <div className="mb-2 flex items-center justify-between px-2">
                      <span className="text-sm font-medium text-neutral-900">Notificări</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (normalizedRole === 'ADMIN') await notificationsApi.adminReadAll();
                          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                          setNotificationsUnreadCount(0);
                        }}
                        className="text-xs text-neutral-500 hover:text-neutral-700"
                      >
                        Marchează citite
                      </button>
                    </div>
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {notifications.slice(0, 5).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            setNotificationsOpen(false);
                            if (n.actionUrl) router.push(n.actionUrl);
                          }}
                          className={`w-full rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                            n.isRead ? 'text-neutral-500' : 'bg-neutral-50 text-neutral-900'
                          } hover:bg-neutral-100`}
                        >
                          <p className="font-medium">{n.title}</p>
                          <p className="line-clamp-1 text-xs text-neutral-500">{n.message}</p>
                        </button>
                      ))}
                      {!notifications.length && (
                        <p className="px-2 py-4 text-center text-sm text-neutral-500">
                          Nicio notificare
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User menu */}
              <div className="hidden items-center gap-2 lg:flex">
                <div className="text-right">
                  <p className="text-sm font-medium text-neutral-900">
                    {activeUser.firstName} {activeUser.lastName}
                  </p>
                  <p className="text-xs text-neutral-500">{activeUser.email}</p>
                </div>
                <div className="flex size-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-medium text-white">
                  {activeUser.firstName?.[0]}{activeUser.lastName?.[0]}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Feedback modal */}
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} pageUrl={pathname || '/'} />
    </div>
  );
}
