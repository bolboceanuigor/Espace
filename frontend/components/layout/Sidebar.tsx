'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import SidebarItem from './SidebarItem';
import LanguageSwitcher from './LanguageSwitcher';
import Switch from '@/components/ui/Switch';
import { defaultLocale, isLocale } from '@/i18n';
import { useBranding } from '@/context/BrandingContext';
import type { NavigationItem } from '@/lib/navigation-config';

type SidebarProps = {
  role: string | undefined;
  navItems: NavigationItem[];
  authProvider?: 'LOCAL' | 'GOOGLE' | 'BOTH' | string;
  emailVerified?: boolean;
  showLabels: boolean;
  onShowLabelsChange: (next: boolean) => void;
  userInitials: string;
  userEmail?: string;
  onLogout: () => void;
};

export default function Sidebar({
  role,
  navItems,
  authProvider,
  emailVerified,
  showLabels,
  onShowLabelsChange,
  userInitials,
  userEmail,
  onLogout,
}: SidebarProps) {
  const c = useTranslations('common');
  const { branding } = useBranding();
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const normalizedRole = (role || '').toUpperCase();
  void emailVerified;
  const normalizedProvider = (authProvider || 'LOCAL').toUpperCase();
  const providerLabel =
    normalizedProvider === 'GOOGLE'
      ? c('providerGoogle')
      : normalizedProvider === 'BOTH'
        ? c('providerBoth')
        : c('providerLocal');
  const principalItems = navItems.filter((item) => !item.moreMenu);
  const managementItems = navItems.filter((item) => item.moreMenu);

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-white transition-[width] duration-150 ${
        showLabels ? 'w-56' : 'w-16'
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-foreground text-xs font-bold text-white">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            branding.appName.slice(0, 2).toUpperCase()
          )}
        </div>
        {showLabels ? (
          <span className="ml-3 truncate text-sm font-semibold text-foreground">
            {branding.appName}
          </span>
        ) : null}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {showLabels ? (
          <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Principal
          </p>
        ) : null}
        {principalItems.map((item) => (
          <SidebarItem
            key={item.href}
            item={item}
            showLabels={showLabels}
            localePrefix={`/${locale}`}
          />
        ))}
        {managementItems.length > 0 && showLabels ? (
          <p className="mb-2 mt-4 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Management
          </p>
        ) : null}
        {managementItems.map((item) => (
          <SidebarItem key={item.href} item={item} showLabels={showLabels} localePrefix={`/${locale}`} />
        ))}
      </nav>

      {/* User section */}
      <div className="space-y-3 border-t border-border p-3">
        <div className={`rounded-xl bg-muted p-3 ${showLabels ? '' : 'flex justify-center'}`}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-white">
            {userInitials || 'U'}
          </div>
          {showLabels ? (
            <>
              <p className="mt-2 truncate text-sm font-medium text-foreground">{userEmail || '-'}</p>
              <p className="truncate text-xs text-muted-foreground">{normalizedRole || 'USER'}</p>
              <button
                type="button"
                onClick={onLogout}
                className="mt-2 w-full rounded-lg border border-border bg-white py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onLogout}
              className="mt-2 rounded-lg border border-border bg-white px-2 py-1 text-[10px] font-medium text-foreground transition hover:bg-muted"
            >
              Out
            </button>
          )}
        </div>
        {showLabels ? <LanguageSwitcher /> : null}
        <div className={`${showLabels ? 'justify-between' : 'justify-center'} flex items-center`}>
          {showLabels ? <span className="text-xs text-muted-foreground">{c('showLabels')}</span> : null}
          <Switch checked={showLabels} onCheckedChange={onShowLabelsChange} />
        </div>
      </div>
    </aside>
  );
}
