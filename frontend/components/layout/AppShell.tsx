'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Bell, X } from 'lucide-react';
import MainNavigation from './MainNavigation';
import OrgSwitcher from './OrgSwitcher';
import { useAuth } from '@/context/AuthContext';
import { ManagerUiProvider } from '@/context/ManagerUiContext';
import { defaultLocale, isLocale } from '@/i18n';
import { featureFlags } from '@/lib/featureFlags';
import { authApi, billingSaasApi, notificationsApi, onboardingApi, releaseNotesApi, subscriptionApi, superadminApi, usageApi } from '@/lib/api';
import { normalizeRole, roleHomePath } from '@/lib/role-routing';
import { isAdminHardBlocked } from '@/lib/subscription-access';
import { NAVIGATION_CONFIG, type NavigationItem } from '@/lib/navigation-config';
import SubscriptionStatusBanner from '@/components/subscription/SubscriptionStatusBanner';
import FeedbackModal from '@/components/feedback/FeedbackModal';
import { DEMO_PRESENTATION_MODE_KEY } from '@/lib/demo-presentation';

type AppShellProps = { children: React.ReactNode };

export default function AppShell({ children }: AppShellProps) {
  return (
    <ManagerUiProvider>
      <AppShellContent>{children}</AppShellContent>
    </ManagerUiProvider>
  );
}

function AppShellContent({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ locale?: string }>();
  const c = useTranslations('common');
  const billingT = useTranslations('billing');
  const { user, org, prefs, system, loading, isAuthenticated, updatePreferences } = useAuth();
  const [search, setSearch] = useState('');
  const [planLimitWarning, setPlanLimitWarning] = useState<string | null>(null);
  const [trialInfo, setTrialInfo] = useState<{ status: string; daysRemaining: number } | null>(null);
  const [adminSubscription, setAdminSubscription] = useState<{ status: string; trialEndDate?: string | null } | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [supportSession, setSupportSession] = useState<any | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([]);
  const [unreadReleaseNotes, setUnreadReleaseNotes] = useState<any[]>([]);
  const [releaseNotesPromptOpen, setReleaseNotesPromptOpen] = useState(false);
  const [showOnboardingTips, setShowOnboardingTips] = useState(false);
  const [demoPresentationMode, setDemoPresentationMode] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const normalizedRole = normalizeRole(user?.role);
  const homeRoute = `/${locale}${roleHomePath(normalizedRole)}`;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMetaF = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f';
      if (!isMetaF) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace(`/${locale}/login`);
    }
  }, [isAuthenticated, loading, locale, router]);

  useEffect(() => {
    if (loading || !user) return;
    const isTeamRoute = pathname.includes('/team');
    const isSuperadminRoute = pathname.includes('/superadmin');
    if (isTeamRoute && normalizedRole !== 'ADMIN' && normalizedRole !== 'SUPER_ADMIN') {
      router.replace(homeRoute);
      return;
    }
    if (isSuperadminRoute && normalizedRole !== 'SUPER_ADMIN') {
      router.replace(homeRoute);
    }
  }, [homeRoute, loading, pathname, router, user, normalizedRole]);

  useEffect(() => {
    if (!featureFlags.softLimits || !isAuthenticated || !user?.organizationId) {
      setPlanLimitWarning(null);
      return;
    }
    let active = true;
    Promise.all([subscriptionApi.get(), usageApi.today()])
      .then(([subscriptionRes]) => {
        if (!active) return;
        const currentPropertyCount = Number(subscriptionRes.data?.currentPropertyCount ?? 0);
        const propertyLimit = Number(subscriptionRes.data?.propertyLimit ?? -1);
        if (propertyLimit >= 0 && currentPropertyCount > propertyLimit) {
          setPlanLimitWarning(billingT('limitWarning'));
          return;
        }
        setPlanLimitWarning(null);
      })
      .catch(() => {
        if (!active) return;
        setPlanLimitWarning(null);
      });
    return () => {
      active = false;
    };
  }, [billingT, isAuthenticated, user?.organizationId]);

  useEffect(() => {
    if (!isAuthenticated || !user?.organizationId) {
      setTrialInfo(null);
      return;
    }
    let active = true;
    subscriptionApi
      .get()
      .then((res) => {
        if (!active) return;
        const status = String(res.data?.status || '').toUpperCase();
        const daysRemaining = Number(res.data?.daysRemaining ?? 0);
        setTrialInfo({ status, daysRemaining });
      })
      .catch(() => {
        if (!active) return;
        setTrialInfo(null);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.organizationId]);

  useEffect(() => {
    if (!isAuthenticated || normalizedRole !== 'ADMIN') {
      setAdminSubscription(null);
      return;
    }
    let active = true;
    billingSaasApi
      .getAdminSubscription()
      .then((res) => {
        if (!active) return;
        setAdminSubscription({
          status: String(res.data?.status || '').toUpperCase(),
          trialEndDate: res.data?.trialEndDate || null,
        });
      })
      .catch(() => {
        if (!active) return;
        setAdminSubscription(null);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, normalizedRole, user?.organizationId]);

  useEffect(() => {
    if (normalizedRole !== 'ADMIN') return;
    if (!adminSubscription?.status) return;
    if (!isAdminHardBlocked(adminSubscription.status)) return;
    const isAllowedRoute = pathname.includes('/admin/subscription') || pathname.includes('/support');
    if (!isAllowedRoute) {
      router.replace(`/${locale}/admin/subscription`);
    }
  }, [adminSubscription?.status, locale, normalizedRole, pathname, router]);

  useEffect(() => {
    if (!navigationItems.length) return;
    const currentPath = pathname.replace(`/${locale}`, '');
    const matched = navigationItems.find((item) => currentPath === item.href || currentPath.startsWith(`${item.href}/`));
    if (matched?.locked) {
      router.replace(homeRoute);
    }
  }, [homeRoute, locale, navigationItems, pathname, router]);

  useEffect(() => {
    if (normalizedRole !== 'ADMIN') return;
    const allowedDuringOnboarding = [
      '/admin/onboarding',
      '/admin/settings',
      '/admin/imports',
      '/admin/subscription',
    ];
    const currentPath = pathname.replace(`/${locale}`, '');
    const isAllowed = allowedDuringOnboarding.some((prefix) => currentPath.startsWith(prefix));
    if (isAllowed) return;
    let active = true;
    onboardingApi
      .adminGet()
      .then((res) => {
        if (!active) return;
        const status = String(res.data?.organization?.onboardingStatus || '').toUpperCase();
        if (status !== 'COMPLETED') {
          router.replace(`/${locale}/admin/onboarding`);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [locale, normalizedRole, pathname, router]);

  useEffect(() => {
    if (normalizedRole !== 'ADMIN') {
      setShowOnboardingTips(false);
      return;
    }
    let active = true;
    onboardingApi
      .adminGet()
      .then((res) => {
        if (!active) return;
        const status = String(res.data?.organization?.onboardingStatus || '').toUpperCase();
        setShowOnboardingTips(status === 'COMPLETED');
      })
      .catch(() => {
        if (!active) return;
        setShowOnboardingTips(false);
      });
    return () => {
      active = false;
    };
  }, [normalizedRole, pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDemoPresentationMode(localStorage.getItem(DEMO_PRESENTATION_MODE_KEY) === 'true');
  }, []);

  useEffect(() => {
    if (normalizedRole !== 'SUPER_ADMIN') {
      setSupportSession(null);
      return;
    }
    let active = true;
    superadminApi
      .currentSupportSession()
      .then((res) => {
        if (!active) return;
        setSupportSession(res.data || null);
      })
      .catch(() => {
        if (!active) return;
        setSupportSession(null);
      });
    return () => {
      active = false;
    };
  }, [normalizedRole, pathname]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setUnreadReleaseNotes([]);
      setReleaseNotesPromptOpen(false);
      return;
    }
    let active = true;
    releaseNotesApi
      .unread()
      .then((res) => {
        if (!active) return;
        const rows = res.data || [];
        setUnreadReleaseNotes(rows);
        setReleaseNotesPromptOpen(rows.length > 0);
      })
      .catch(() => {
        if (!active) return;
        setUnreadReleaseNotes([]);
        setReleaseNotesPromptOpen(false);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setNavigationItems([]);
      return;
    }
    let active = true;
    authApi
      .getNavigation()
      .then((res) => {
        if (!active) return;
        const byHref = new Map((res.data || []).map((item: any) => [item.href, item]));
        const merged = NAVIGATION_CONFIG
          .filter((item) => byHref.has(item.href))
          .map((item) => ({ ...item, ...(byHref.get(item.href) || {}) })) as NavigationItem[];
        setNavigationItems(merged);
      })
      .catch(() => {
        if (!active) return;
        setNavigationItems([]);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.id, normalizedRole]);

  useEffect(() => {
    if (!['RESIDENT', 'TENANT'].includes(normalizedRole)) {
      setNotifications([]);
      return;
    }
    let active = true;
    notificationsApi
      .residentList()
      .then((res) => {
        if (!active) return;
        setNotifications(res.data || []);
      })
      .catch(() => {
        if (!active) return;
        setNotifications([]);
      });
    return () => {
      active = false;
    };
  }, [normalizedRole, pathname]);

  const canUseDemoPresentation = normalizedRole === 'SUPER_ADMIN' && !!supportSession?.organization?.isDemo;
  const effectiveDemoPresentationMode = canUseDemoPresentation && demoPresentationMode;
  const searchPlaceholder =
    normalizedRole === 'SUPER_ADMIN'
      ? 'Caută asociații, administratori, abonamente...'
      : normalizedRole === 'ADMIN'
        ? 'Caută apartamente, locatari, plăți...'
        : 'Caută anunțuri, plăți, cereri...';
  const searchTarget =
    normalizedRole === 'SUPER_ADMIN'
      ? '/superadmin/organizations'
      : normalizedRole === 'ADMIN'
        ? '/admin/apartments'
        : '/resident/announcements';

  if (loading || !isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Se verifică sesiunea...
      </div>
    );
  }
  const betaBlocked =
    featureFlags.requireBetaAccess &&
    normalizedRole !== 'SUPER_ADMIN' &&
    ['ADMIN', 'RESIDENT', 'TENANT'].includes(normalizedRole) &&
    org?.betaAccessEnabled === false;
  const maintenanceBlocked = normalizedRole !== 'SUPER_ADMIN' && !!system?.maintenanceMode;
  const providerLabel =
    (user.authProvider || 'LOCAL').toUpperCase() === 'GOOGLE'
      ? c('providerGoogle')
      : (user.authProvider || 'LOCAL').toUpperCase() === 'BOTH'
        ? c('providerBoth')
        : c('providerLocal');

  if (['RESIDENT', 'TENANT'].includes(normalizedRole)) {
    if (maintenanceBlocked) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
          <p className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm text-foreground">
            Aplicatia este in mentenanta.
          </p>
        </div>
      );
    }
    if (betaBlocked) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
          <p className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm text-foreground">
            Accesul beta nu este activ pentru această organizație.
          </p>
        </div>
      );
    }
    return (
      <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,hsl(var(--muted))_0,transparent_34rem),linear-gradient(180deg,#fbfaf7_0%,hsl(var(--background))_48rem)] text-foreground md:pl-0">
        <header className="sticky top-0 z-30 hidden border-b border-border/60 bg-background/82 px-4 py-3 backdrop-blur-xl md:block">
          <div className="mx-auto max-w-5xl">
            <MainNavigation role={normalizedRole} variant="desktop" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+8.75rem)] md:py-8 md:pb-[calc(env(safe-area-inset-bottom)+8.75rem)]">{children}</main>
        <button
          type="button"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+8.25rem)] right-4 z-40 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-md"
          onClick={() => setFeedbackOpen(true)}
        >
          Trimite feedback
        </button>
        <MainNavigation role={normalizedRole} variant="mobile" />
        <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} pageUrl={pathname || '/'} />
      </div>
    );
  }

  if (betaBlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <p className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm text-foreground">
          Accesul beta nu este activ pentru această organizație.
        </p>
      </div>
    );
  }
  if (maintenanceBlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <p className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm text-foreground">
          Aplicatia este in mentenanta.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,hsl(var(--muted))_0,transparent_36rem),linear-gradient(180deg,#fbfaf7_0%,hsl(var(--background))_46rem)] text-foreground">
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/82 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push(homeRoute)}
              className="inline-flex items-center gap-2 rounded-2xl px-2 py-2 text-sm font-semibold text-foreground transition duration-150 ease-out hover:bg-white/70"
            >
              <span className="inline-block h-7 w-7 rounded-2xl bg-foreground shadow-sm" />
              <span>Espace</span>
              <span className="rounded-full border border-border/70 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Beta
              </span>
            </button>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  const query = search.trim();
                  router.push(`/${locale}${searchTarget}${query ? `?query=${encodeURIComponent(query)}` : ''}`);
                }
              }}
              placeholder={searchPlaceholder}
              className="hidden h-10 w-72 rounded-2xl border border-border/70 bg-white/85 px-4 text-sm text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.04)] outline-none transition focus:border-foreground/20 focus:ring-2 focus:ring-foreground/10 lg:block"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="hidden rounded-2xl border border-border/60 bg-white/85 px-3 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-white sm:inline-flex"
                onClick={() => setFeedbackOpen(true)}
              >
                Trimite feedback
              </button>
              {normalizedRole === 'SUPER_ADMIN' ? <OrgSwitcher /> : null}
              {['RESIDENT', 'TENANT'].includes(normalizedRole) ? (
                <div className="relative">
                  <button
                    type="button"
                    className="relative rounded-2xl border border-border/60 bg-white/85 p-2 text-muted-foreground shadow-sm hover:bg-white"
                    onClick={() => setNotificationsOpen((value) => !value)}
                  >
                    <Bell className="h-4 w-4" />
                    {notifications.filter((item) => !item.isRead).length > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                        {notifications.filter((item) => !item.isRead).length}
                      </span>
                    ) : null}
                  </button>
                  {notificationsOpen ? (
                    <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border/70 bg-card p-2 shadow-lg">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground">Notifications</p>
                        <button
                          className="text-[11px] text-primary"
                          onClick={async () => {
                            await notificationsApi.residentReadAll();
                            setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
                          }}
                        >
                          Mark all read
                        </button>
                      </div>
                      <div className="max-h-72 space-y-1 overflow-y-auto">
                        {notifications.map((item) => (
                          <button
                            key={item.id}
                            className={`w-full rounded-lg border px-2 py-1 text-left text-xs ${
                              item.isRead ? 'border-border/60 text-muted-foreground' : 'border-primary/30 bg-primary/5 text-foreground'
                            }`}
                            onClick={async () => {
                              if (!item.isRead) {
                                await notificationsApi.residentRead(item.id);
                                setNotifications((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
                              }
                              if (item.link) router.push(`/${locale}${item.link}`);
                              setNotificationsOpen(false);
                            }}
                          >
                            <p className="font-medium">{item.title}</p>
                            <p className="line-clamp-2">{item.message}</p>
                          </button>
                        ))}
                        {!notifications.length ? <p className="text-xs text-muted-foreground">No notifications.</p> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="hidden text-right md:block">
                <p className="text-sm font-medium text-foreground">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <div className="mt-1 flex justify-end gap-1">
                  <span className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {user.emailVerifiedAt ? c('verified') : c('notVerified')}
                  </span>
                  <span className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {providerLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <MainNavigation role={normalizedRole} variant="desktop" />
          </div>
          {(normalizeRole(user.role) === 'ADMIN' || normalizeRole(user.role) === 'SUPER_ADMIN') &&
          !prefs?.welcomeDismissed &&
          user.createdAt &&
          Date.now() - new Date(user.createdAt).getTime() < 24 * 60 * 60 * 1000 ? (
            <div className="mt-3 rounded-2xl border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground">
              <div className="flex flex-wrap items-center justify-between gap-2">
              <p>Bun venit în Espace</p>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => {
                    updatePreferences({ welcomeDismissed: true }).catch(() => undefined);
                  }}
                >
                  Dismiss
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Link href={`/${locale}/admin/apartments`} className="rounded-xl border border-border/60 px-2 py-1 hover:bg-background">
                  Apartamente
                </Link>
                <Link href={`/${locale}/admin/residents`} className="rounded-xl border border-border/60 px-2 py-1 hover:bg-background">
                  Locatari
                </Link>
                <Link href={`/${locale}/admin/announcements`} className="rounded-xl border border-border/60 px-2 py-1 hover:bg-background">
                  Avizier
                </Link>
              </div>
            </div>
          ) : null}
          {trialInfo?.status === 'TRIAL' ? (
            <div className="mt-3 rounded-2xl border border-border/60 bg-muted/50 px-3 py-2 text-sm text-foreground">
              <span className="inline-flex items-center rounded-md border border-border/60 bg-background px-2 py-0.5 text-xs font-medium">
                Trial
              </span>{' '}
              — {trialInfo.daysRemaining} days left
            </div>
          ) : null}
          {trialInfo?.status === 'EXPIRED' || trialInfo?.status === 'PAST_DUE' ? (
            <div className="mt-3 rounded-2xl border border-border/60 bg-muted/50 px-3 py-2 text-sm text-foreground">
              Trial ended — contact us
            </div>
          ) : null}
          {planLimitWarning ? (
            <div className="mt-3 rounded-2xl border border-border/60 bg-muted/50 px-3 py-2 text-sm text-foreground">
              {planLimitWarning}
            </div>
          ) : null}
          {normalizedRole === 'SUPER_ADMIN' && supportSession?.isActive ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span>Support mode active: {supportSession.organization?.name || 'Organization'}</span>
              <div className="flex items-center gap-2">
                {canUseDemoPresentation ? (
                  <>
                    <label className="inline-flex items-center gap-2 rounded-md border border-amber-400 bg-white px-2 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={demoPresentationMode}
                        onChange={(event) => {
                          const next = event.target.checked;
                          setDemoPresentationMode(next);
                          localStorage.setItem(DEMO_PRESENTATION_MODE_KEY, next ? 'true' : 'false');
                        }}
                      />
                      demoPresentationMode
                    </label>
                    <button
                      className="rounded-md border border-amber-400 bg-white px-2 py-1 text-xs"
                      onClick={() => router.push(`/${locale}/admin`)}
                    >
                      Start Demo
                    </button>
                  </>
                ) : null}
                <button
                  className="rounded-md border border-amber-400 bg-white px-2 py-1 text-xs"
                  onClick={async () => {
                    await superadminApi.endSupportSession(supportSession.id);
                    setSupportSession(null);
                    setDemoPresentationMode(false);
                    localStorage.setItem(DEMO_PRESENTATION_MODE_KEY, 'false');
                  }}
                >
                  Exit support mode
                </button>
              </div>
            </div>
          ) : null}
          {effectiveDemoPresentationMode ? (
            <div className="mt-3 rounded-2xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Mod prezentare activ</span>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    className="rounded-md border border-sky-400 bg-white px-2 py-1"
                    onClick={() => router.push(`/${locale}/admin`)}
                  >
                    Start Demo
                  </button>
                  <Link href={`/${locale}/superadmin/demo`} className="rounded-md border border-sky-400 bg-white px-2 py-1">
                    Reset demo data
                  </Link>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border border-sky-300 bg-white px-2 py-1">
                  Navigația principală rămâne bara de jos, adaptată rolului.
                </span>
              </div>
            </div>
          ) : null}
          {(user?.isDemoUser || org?.isDemo) ? (
            <div className="mt-3 rounded-2xl border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
              Mod demo activ — datele sunt demonstrative.
            </div>
          ) : null}
          {normalizedRole === 'ADMIN' ? (
            <div className="mt-3">
              <SubscriptionStatusBanner status={adminSubscription?.status} trialEndDate={adminSubscription?.trialEndDate} />
            </div>
          ) : null}
          {showOnboardingTips ? (
            <div className="mt-3 rounded-2xl border border-border/60 bg-card px-3 py-2 text-sm text-foreground">
              <p className="font-medium">Pași recomandați pentru lansare</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Link href={`/${locale}/admin/buildings`} className="rounded-xl border border-border/60 px-2 py-1 hover:bg-background">
                  Adaugă primul bloc
                </Link>
                <Link href={`/${locale}/admin/imports/new`} className="rounded-xl border border-border/60 px-2 py-1 hover:bg-background">
                  Importă apartamente
                </Link>
                <Link href={`/${locale}/admin/invoices`} className="rounded-xl border border-border/60 px-2 py-1 hover:bg-background">
                  Generează primele facturi
                </Link>
              </div>
            </div>
          ) : null}
          </div>
        </header>

        {releaseNotesPromptOpen ? (
          <div className="fixed right-4 top-24 z-50 w-full max-w-sm rounded-xl border border-border/70 bg-card p-4 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">What&apos;s new</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ai {unreadReleaseNotes.length} release note{unreadReleaseNotes.length > 1 ? 's' : ''} necitite.
                </p>
              </div>
              <button className="rounded-md border border-border/70 p-1" onClick={() => setReleaseNotesPromptOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {unreadReleaseNotes.slice(0, 2).map((note) => (
                <div key={note.id} className="rounded-lg border border-border/60 bg-background p-2">
                  <p className="text-xs font-medium text-foreground">{note.title}</p>
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">{note.content}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="rounded-md border border-border/70 px-3 py-1.5 text-xs"
                onClick={() => {
                  router.push(`/${locale}/release-notes`);
                  setReleaseNotesPromptOpen(false);
                }}
              >
                View release notes
              </button>
              <button className="rounded-md border border-border/70 px-3 py-1.5 text-xs" onClick={() => setReleaseNotesPromptOpen(false)}>
                Later
              </button>
            </div>
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-6xl px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+8.75rem)] md:py-8 md:pb-[calc(env(safe-area-inset-bottom)+8.75rem)]">{children}</main>
        <footer className="mx-auto flex w-full max-w-6xl items-center justify-end gap-3 px-5 pb-5 text-xs text-muted-foreground">
          <span>v{process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0-beta'}</span>
          <Link href={`/${locale}/pricing`} className="hover:text-foreground">
            Prețuri
          </Link>
          <Link href={`/${locale}/terms`} className="hover:text-foreground">
            Termeni
          </Link>
          <Link href={`/${locale}/privacy`} className="hover:text-foreground">
            Confidențialitate
          </Link>
        </footer>
      </div>
      <MainNavigation role={normalizedRole} variant="mobile" />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} pageUrl={pathname || '/'} />
    </div>
  );
}
