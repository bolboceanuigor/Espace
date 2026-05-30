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
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/10 bg-sidebar text-white shadow-[18px_0_54px_rgba(15,23,42,0.20)] transition-[width] duration-150 ease-out ${
        showLabels ? 'w-56' : 'w-16'
      }`}
    >
      <div className="border-b border-white/10 p-3">
        <div className="flex items-center">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white text-xs font-semibold text-primary">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              branding.appName.slice(0, 2).toUpperCase()
            )}
          </div>
          {showLabels ? <span className="ml-2.5 truncate text-sm font-semibold text-white">{branding.appName}</span> : null}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {showLabels ? <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-white/35">Principal</p> : null}
        {principalItems.map((item) => (
          <SidebarItem
            key={item.href}
            item={item}
            showLabels={showLabels}
            localePrefix={`/${locale}`}
          />
        ))}
        {managementItems.length > 0 && showLabels ? (
          <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-white/35">Management</p>
        ) : null}
        {managementItems.map((item) => (
          <SidebarItem key={item.href} item={item} showLabels={showLabels} localePrefix={`/${locale}`} />
        ))}
      </nav>

      <div className="space-y-2 border-t border-white/10 p-3">
        <div className={`rounded-2xl border border-white/10 bg-white/10 p-2.5 ${showLabels ? '' : 'text-center'}`}>
          <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-primary">
            {userInitials || 'U'}
          </div>
          {showLabels ? (
            <>
              <p className="mt-1.5 truncate text-xs font-medium text-white">{userEmail || '-'}</p>
              <p className="truncate text-[10px] text-white/50">{normalizedRole || 'USER'}</p>
              <button
                type="button"
                onClick={onLogout}
                className="mt-2 w-full rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onLogout}
              className="mt-2 rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Out
            </button>
          )}
        </div>
        {showLabels ? <LanguageSwitcher /> : null}
        <div className={`${showLabels ? 'justify-between' : 'justify-center'} flex items-center`}>
          {showLabels ? <span className="text-[10px] text-white/45">{c('showLabels')}</span> : null}
          <Switch checked={showLabels} onCheckedChange={onShowLabelsChange} />
        </div>
      </div>
    </aside>
  );
}
