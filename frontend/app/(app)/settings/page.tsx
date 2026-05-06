'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useBranding } from '@/context/BrandingContext';
import { feedbackApi, settingsApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button, PageHeader, useToast } from '@/components/ui';
import { defaultLocale, isLocale } from '@/i18n';
import { featureFlags } from '@/lib/featureFlags';
import { BRANDING_MENU_LABELS, normalizeMenuConfig, type BrandingMenuItem } from '@/lib/branding';

export default function SettingsPage() {
  const tPages = useTranslations('pages.settings');
  const tSupport = useTranslations('support');
  const tActions = useTranslations('actions');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const { user, prefs, updatePreferences } = useAuth();
  const { refreshBranding } = useBranding();
  const params = useParams<{ locale?: string }>();
  const { showToast } = useToast();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const normalizedRole = (user?.role || '').toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN';
  const [organizationName, setOrganizationName] = useState('');
  const [defaultLocaleSetting, setDefaultLocaleSetting] = useState<'ro' | 'ru' | 'en'>('ro');
  const [weekStart, setWeekStart] = useState<'MONDAY' | 'SUNDAY'>('MONDAY');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [supportEmail, setSupportEmail] = useState('support@espace.md');
  const [appName, setAppName] = useState('Espace');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [sidebarColor, setSidebarColor] = useState('#ffffff');
  const [themeMode, setThemeMode] = useState<'LIGHT' | 'DARK'>('LIGHT');
  const [menuConfig, setMenuConfig] = useState<BrandingMenuItem[]>(normalizeMenuConfig([]));
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [preferredLocale, setPreferredLocale] = useState<'ro' | 'ru' | 'en'>('ro');

  useEffect(() => {
    let active = true;
    settingsApi
      .get()
      .then((res) => {
        if (!active) return;
        setOrganizationName(res.data?.org?.name || '');
        setDefaultLocaleSetting((res.data?.org?.defaultLocale || 'ro') as 'ro' | 'ru' | 'en');
        setWeekStart((res.data?.org?.weekStart || 'MONDAY') as 'MONDAY' | 'SUNDAY');
        setAppName(res.data?.org?.appName || 'Espace');
        setLogoUrl(res.data?.org?.logoUrl || '');
        setPrimaryColor(res.data?.org?.primaryColor || '#2563eb');
        setSidebarColor(res.data?.org?.sidebarColor || '#ffffff');
        setThemeMode(res.data?.org?.themeMode === 'DARK' ? 'DARK' : 'LIGHT');
        setMenuConfig(normalizeMenuConfig(res.data?.org?.menuConfig));
        setFirstName(res.data?.profile?.firstName || '');
        setLastName(res.data?.profile?.lastName || '');
        setSupportEmail(res.data?.supportEmail || 'support@espace.md');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (prefs?.locale) {
      setPreferredLocale(prefs.locale);
    }
  }, [prefs?.locale]);

  const saveOrg = async () => {
    setSaving(true);
    try {
      await settingsApi.updateOrg({
        name: organizationName.trim(),
        defaultLocale: defaultLocaleSetting,
        weekStart,
        appName: appName.trim() || 'Espace',
        logoUrl: logoUrl.trim() || '',
        primaryColor,
        sidebarColor,
        themeMode,
        menuConfig,
      });
      await refreshBranding();
      showToast(tCommon('saved'), 'success');
    } catch (error: unknown) {
      showToast(getApiErrorMessage(error, tErrors, tCommon('error')), 'error');
    } finally {
      setSaving(false);
    }
  };

  const onLogoUpload = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setLogoUrl(dataUrl);
  };

  const toggleMenuItem = (key: string, enabled: boolean) => {
    setMenuConfig((prev) => prev.map((item) => (item.key === key ? { ...item, enabled } : item)));
  };

  const moveMenuItem = (key: string, direction: -1 | 1) => {
    setMenuConfig((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((item) => item.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= sorted.length) return prev;
      [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
      return sorted.map((item, idx) => ({ ...item, order: idx }));
    });
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      await settingsApi.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      showToast(tCommon('saved'), 'success');
    } catch (error: unknown) {
      showToast(getApiErrorMessage(error, tErrors, tCommon('error')), 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={tPages('title')} description={tPages('desc')} />
      <p className="text-xs text-muted-foreground">
        Version: {process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0-beta'}
      </p>

      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-30px_rgba(109,40,217,0.35)]">
        <h2 className="text-base font-semibold text-foreground">{tPages('organization')}</h2>
        {loading ? <p className="mt-2 text-sm text-muted-foreground">{tCommon('loading')}</p> : null}
        {!loading ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                className="h-9 w-full max-w-md rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                disabled={!isAdmin}
              />
              {isAdmin ? (
                <Button size="sm" onClick={saveOrg} disabled={saving}>
                  {saving ? '...' : tActions('save')}
                </Button>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <select
                className="h-9 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground"
                value={defaultLocaleSetting}
                onChange={(event) => setDefaultLocaleSetting(event.target.value as 'ro' | 'ru' | 'en')}
                disabled={!isAdmin}
              >
                <option value="ro">RO</option>
                <option value="ru">RU</option>
                <option value="en">EN</option>
              </select>
              <select
                className="h-9 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground"
                value={weekStart}
                onChange={(event) => setWeekStart(event.target.value as 'MONDAY' | 'SUNDAY')}
                disabled={!isAdmin}
              >
                <option value="MONDAY">{tPages('weekStartMonday')}</option>
                <option value="SUNDAY">{tPages('weekStartSunday')}</option>
              </select>
            </div>
            {isAdmin ? (
              <div className="mt-5 space-y-4 rounded-2xl border border-border/60 bg-background/60 p-4">
                <h3 className="text-sm font-semibold text-foreground">Branding</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">App name</span>
                    <input
                      className="h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
                      value={appName}
                      onChange={(event) => setAppName(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">Theme mode</span>
                    <select
                      className="h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
                      value={themeMode}
                      onChange={(event) => setThemeMode(event.target.value as 'LIGHT' | 'DARK')}
                    >
                      <option value="LIGHT">Light</option>
                      <option value="DARK">Dark</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">Primary color</span>
                    <div className="flex items-center gap-2">
                      <input type="color" className="h-9 w-12 rounded border border-border/60 bg-background p-1" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} />
                      <input
                        className="h-9 flex-1 rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
                        value={primaryColor}
                        onChange={(event) => setPrimaryColor(event.target.value)}
                      />
                    </div>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">Sidebar color</span>
                    <div className="flex items-center gap-2">
                      <input type="color" className="h-9 w-12 rounded border border-border/60 bg-background p-1" value={sidebarColor} onChange={(event) => setSidebarColor(event.target.value)} />
                      <input
                        className="h-9 flex-1 rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
                        value={sidebarColor}
                        onChange={(event) => setSidebarColor(event.target.value)}
                      />
                    </div>
                  </label>
                  <label className="space-y-1 text-sm md:col-span-2">
                    <span className="text-muted-foreground">Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="h-9 w-full rounded-xl border border-border/60 bg-background px-3 py-1.5 text-sm text-foreground"
                      onChange={(event) => onLogoUpload(event.target.files?.[0] || null)}
                    />
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Organization logo" className="mt-2 h-12 w-12 rounded-lg border border-border/60 object-cover" />
                    ) : null}
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">Sidebar menu configuration</p>
                  <div className="space-y-2">
                    {[...menuConfig].sort((a, b) => a.order - b.order).map((item, index) => (
                      <div key={item.key} className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{BRANDING_MENU_LABELS[item.key] || item.key}</p>
                          <p className="text-xs text-muted-foreground">Position {index + 1}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="h-8 rounded-lg border border-border/60 px-2 text-xs text-foreground disabled:opacity-40"
                            onClick={() => moveMenuItem(item.key, -1)}
                            disabled={index === 0}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            className="h-8 rounded-lg border border-border/60 px-2 text-xs text-foreground disabled:opacity-40"
                            onClick={() => moveMenuItem(item.key, 1)}
                            disabled={index === menuConfig.length - 1}
                          >
                            Down
                          </button>
                          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={item.enabled}
                              onChange={(event) => toggleMenuItem(item.key, event.target.checked)}
                            />
                            Enabled
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-30px_rgba(109,40,217,0.35)]">
        <h2 className="text-base font-semibold text-foreground">{tPages('profile')}</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <input
            className="h-9 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder={tPages('firstName')}
          />
          <input
            className="h-9 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder={tPages('lastName')}
          />
          <input className="h-9 rounded-2xl border border-border/60 bg-muted/40 px-3 text-sm text-foreground" value={user?.email || ''} readOnly />
          <input className="h-9 rounded-2xl border border-border/60 bg-muted/40 px-3 text-sm text-foreground" value={user?.role || ''} readOnly />
          <select
            className="h-9 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground"
            value={preferredLocale}
            onChange={async (event) => {
              const next = event.target.value as 'ro' | 'ru' | 'en';
              setPreferredLocale(next);
              await updatePreferences({ locale: next });
            }}
          >
            <option value="ro">{tPages('languageRo')}</option>
            <option value="ru">{tPages('languageRu')}</option>
            <option value="en">{tPages('languageEn')}</option>
          </select>
        </div>
        <div className="mt-3">
          <Button size="sm" onClick={saveProfile} disabled={profileSaving}>
            {profileSaving ? '...' : tActions('save')}
          </Button>
        </div>
        <div className="mt-3 rounded-2xl border border-border/60 bg-muted/30 px-3 py-2">
          <p className="text-sm font-medium text-foreground">{tCommon('connectGoogleAccount')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tCommon('comingSoon')}</p>
        </div>
      </div>

      {isAdmin ? (
        <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-30px_rgba(109,40,217,0.35)]">
          <h2 className="text-base font-semibold text-foreground">{tPages('activityTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tPages('activityDesc')}</p>
          <div className="mt-3">
            <Link href={`/${locale}/settings/activity`}>
              <Button size="sm" variant="secondary">
                {tPages('openActivity')}
              </Button>
            </Link>
            <Link href={`/${locale}/settings/permissions`} className="ml-2">
              <Button size="sm" variant="secondary">
                {tPages('permissions')}
              </Button>
            </Link>
            <Link href={`/${locale}/settings/whats-new`} className="ml-2">
              <Button size="sm" variant="secondary">
                What&apos;s new
              </Button>
            </Link>
            <Link href={`/${locale}/settings/roadmap`} className="ml-2">
              <Button size="sm" variant="secondary">
                Roadmap
              </Button>
            </Link>
            {featureFlags.billingUi ? (
              <Link href={`/${locale}/settings/billing`} className="ml-2">
                <Button size="sm" variant="secondary">
                  Billing
                </Button>
              </Link>
            ) : null}
            {featureFlags.channelsUi ? (
              <Link href={`/${locale}/settings/channels`} className="ml-2">
                <Button size="sm" variant="secondary">
                  Channels
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-30px_rgba(109,40,217,0.35)]">
        <h2 className="text-base font-semibold text-foreground">{tPages('sendFeedback')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tPages('sendFeedbackDesc')}</p>
        <div className="mt-3 space-y-2">
          <input
            className="h-9 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground"
            placeholder={tPages('feedbackSubject')}
            value={feedbackSubject}
            onChange={(event) => setFeedbackSubject(event.target.value)}
          />
          <textarea
            className="w-full rounded-2xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
            rows={4}
            placeholder={tPages('feedbackMessage')}
            value={feedbackMessage}
            onChange={(event) => setFeedbackMessage(event.target.value)}
          />
          <Button
            size="sm"
            onClick={async () => {
              if (!feedbackSubject.trim() || !feedbackMessage.trim()) {
                showToast(tErrors('required'), 'error');
                return;
              }
              setFeedbackSending(true);
              try {
                await feedbackApi.create({
                  type: 'QUESTION',
                  title: feedbackSubject.trim(),
                  message: feedbackMessage.trim(),
                  pageUrl: typeof window !== 'undefined' ? window.location.pathname : '/settings',
                });
                setFeedbackSubject('');
                setFeedbackMessage('');
                showToast(tCommon('saved'), 'success');
              } catch (error: unknown) {
                showToast(getApiErrorMessage(error, tErrors, tCommon('error')), 'error');
              } finally {
                setFeedbackSending(false);
              }
            }}
            disabled={feedbackSending}
          >
            {feedbackSending ? '...' : tPages('sendFeedback')}
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-30px_rgba(109,40,217,0.35)]">
        <h2 className="text-base font-semibold text-foreground">{tSupport('title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tSupport('desc')}</p>
        <p className="mt-3 text-sm text-foreground">{supportEmail}</p>
        <div className="mt-3 flex items-center gap-2">
          <Link href={`/${locale}/terms`} className="text-sm text-foreground underline underline-offset-2">
            {tPages('terms')}
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link href={`/${locale}/privacy`} className="text-sm text-foreground underline underline-offset-2">
            {tPages('privacy')}
          </Link>
        </div>
      </div>

      {isAdmin ? (
        <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-30px_rgba(109,40,217,0.35)]">
          <h2 className="text-base font-semibold text-foreground">{tPages('feedbackInbox')}</h2>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={async () => {
              try {
                const res = await feedbackApi.list();
                setFeedbackList(res.data ?? []);
              } catch (error: unknown) {
                showToast(getApiErrorMessage(error, tErrors, tCommon('error')), 'error');
              }
            }}
          >
            Refresh
          </Button>
          <div className="mt-3 space-y-2">
            {feedbackList.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/60 px-3 py-2">
                <p className="text-sm font-medium text-foreground">{item.subject}</p>
                <p className="text-xs text-muted-foreground">{item.user?.email || '-'}</p>
                <p className="mt-1 text-sm text-foreground">{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isAdmin ? (
        <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-30px_rgba(109,40,217,0.35)]">
          <h2 className="text-base font-semibold text-foreground">Backups & Export</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Exporturile pentru apartamente, locatari, facturi și plăți vor fi conectate ulterior.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-background px-3 py-2">Apartamente</span>
            <span className="rounded-full border border-border/70 bg-background px-3 py-2">Locatari</span>
            <span className="rounded-full border border-border/70 bg-background px-3 py-2">Facturi</span>
            <span className="rounded-full border border-border/70 bg-background px-3 py-2">Plăți</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
