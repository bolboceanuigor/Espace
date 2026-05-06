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
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border/50 bg-gradient-to-b from-white to-muted/20 transition-all duration-200 ease-out ${
        showLabels ? 'w-60' : 'w-[68px]'
      }`}
    >
      {/* Logo section */}
      <div className="border-b border-border/40 p-4">
        <div className="flex items-center">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-foreground text-xs font-bold text-background shadow-sm">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              branding.appName.slice(0, 2).toUpperCase()
            )}
          </div>
          {showLabels ? (
            <span className="ml-3 truncate text-[15px] font-semibold tracking-tight text-foreground">
              {branding.appName}
            </span>
          ) : null}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {showLabels ? (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
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
          <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Management
          </p>
        ) : null}
        {managementItems.map((item) => (
          <SidebarItem key={item.href} item={item} showLabels={showLabels} localePrefix={`/${locale}`} />
        ))}
      </nav>

      {/* User section */}
      <div className="space-y-3 border-t border-border/40 p-4">
        <div className={`rounded-xl bg-muted/40 p-3 ${showLabels ? '' : 'text-center'}`}>
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-[11px] font-bold text-background shadow-sm">
            {userInitials || 'U'}
          </div>
          {showLabels ? (
            <>
              <p className="mt-2 truncate text-[13px] font-medium text-foreground">{userEmail || '-'}</p>
              <p className="truncate text-[11px] text-muted-foreground">{normalizedRole || 'USER'}</p>
              <button
                type="button"
                onClick={onLogout}
                className="mt-3 w-full rounded-lg border border-border/50 bg-white px-3 py-1.5 text-xs font-medium text-foreground transition-all duration-200 hover:bg-muted/60 hover:border-border active:scale-[0.98]"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onLogout}
              className="mt-2 rounded-lg border border-border/50 bg-white px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-all duration-200 hover:bg-muted/60"
            >
              Out
            </button>
          )}
        </div>
        {showLabels ? <LanguageSwitcher /> : null}
        <div className={`${showLabels ? 'justify-between' : 'justify-center'} flex items-center rounded-lg px-1 py-1`}>
          {showLabels ? <span className="text-[11px] text-muted-foreground">{c('showLabels')}</span> : null}
          <Switch checked={showLabels} onCheckedChange={onShowLabelsChange} />
        </div>
      </div>
    </aside>
  );
}
