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
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border/70 bg-card transition-[width] duration-150 ease-out ${
        showLabels ? 'w-56' : 'w-16'
      }`}
      style={{ backgroundColor: 'var(--sidebar-bg)' }}
    >
      <div className="border-b border-border/60 p-3">
        <div className="flex items-center">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-xs font-semibold text-primary">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              branding.appName.slice(0, 2).toUpperCase()
            )}
          </div>
          {showLabels ? <span className="ml-2.5 truncate text-sm font-semibold text-foreground">{branding.appName}</span> : null}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {showLabels ? <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Principal</p> : null}
        {principalItems.map((item) => (
          <SidebarItem
            key={item.href}
            item={item}
            showLabels={showLabels}
            localePrefix={`/${locale}`}
          />
        ))}
        {managementItems.length > 0 && showLabels ? (
          <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Management</p>
        ) : null}
        {managementItems.map((item) => (
          <SidebarItem key={item.href} item={item} showLabels={showLabels} localePrefix={`/${locale}`} />
        ))}
      </nav>

      <div className="space-y-2 border-t border-border/60 p-3">
        <div className={`rounded-lg border border-border/70 bg-muted/20 p-2.5 ${showLabels ? '' : 'text-center'}`}>
          <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
            {userInitials || 'U'}
          </div>
          {showLabels ? (
            <>
              <p className="mt-1.5 truncate text-xs font-medium text-foreground">{userEmail || '-'}</p>
              <p className="truncate text-[10px] text-muted-foreground">{normalizedRole || 'USER'}</p>
              <button
                type="button"
                onClick={onLogout}
                className="mt-2 w-full rounded-md border border-border/60 px-2 py-1 text-[11px] text-foreground transition hover:bg-muted/60"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onLogout}
              className="mt-2 rounded-lg border border-border/60 px-2 py-1 text-[11px] text-foreground transition hover:bg-muted/60"
            >
              Out
            </button>
          )}
        </div>
        {showLabels ? <LanguageSwitcher /> : null}
        <div className={`${showLabels ? 'justify-between' : 'justify-center'} flex items-center`}>
          {showLabels ? <span className="text-[10px] text-muted-foreground">{c('showLabels')}</span> : null}
          <Switch checked={showLabels} onCheckedChange={onShowLabelsChange} />
        </div>
      </div>
    </aside>
  );
}
