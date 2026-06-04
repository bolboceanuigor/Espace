'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  Calculator,
  CircleAlert,
  CreditCard,
  Download,
  FileText,
  Gauge,
  Home,
  ListChecks,
  Megaphone,
  MessageCircle,
  Receipt,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { defaultLocale, isLocale } from '@/i18n';
import { usePermissions, type PermissionAction, type PermissionModule } from '@/hooks/usePermissions';

type AppSidebarProps = {
  organizationName?: string;
  organizationCode?: string;
  userInitials?: string;
  userEmail?: string;
  onNavigate?: () => void;
};

const sections: Array<{
  titleKey: string;
  items: Array<{
    labelKey: string;
    href: string;
    icon: LucideIcon;
    permission?: [PermissionModule, PermissionAction];
    anyPermissions?: Array<[PermissionModule, PermissionAction]>;
  }>;
}> = [
  {
    titleKey: 'sections.management',
    items: [
      { labelKey: 'items.dashboard', href: '/admin', icon: Home, permission: ['DASHBOARD', 'VIEW'] },
      { labelKey: 'items.apartments', href: '/admin/apartments', icon: Building2, permission: ['APARTMENTS', 'VIEW'] },
      { labelKey: 'items.owners', href: '/admin/owners', icon: UserCheck, permission: ['RESIDENTS', 'VIEW'] },
      { labelKey: 'items.residents', href: '/admin/residents', icon: Users, permission: ['RESIDENTS', 'VIEW'] },
      { labelKey: 'items.tariffs', href: '/admin/tariffs', icon: Calculator, permission: ['TARIFFS', 'VIEW'] },
      { labelKey: 'items.meters', href: '/admin/meters', icon: Gauge, permission: ['METERS', 'VIEW'] },
      { labelKey: 'items.meterReadings', href: '/admin/meter-readings', icon: ListChecks, permission: ['METER_READINGS', 'VIEW'] },
      { labelKey: 'items.residentReadings', href: '/admin/resident-readings', icon: ListChecks, permission: ['METER_READINGS', 'VIEW'] },
    ],
  },
  {
    titleKey: 'sections.finance',
    items: [
      { labelKey: 'items.monthlyBilling', href: '/admin/billing', icon: Receipt, permission: ['BILLING', 'VIEW'] },
      { labelKey: 'items.invoiceDrafts', href: '/admin/billing-drafts', icon: FileText, permission: ['BILLING', 'VIEW'] },
      { labelKey: 'items.internalInvoices', href: '/admin/invoices', icon: FileText, permission: ['INVOICES', 'VIEW'] },
      { labelKey: 'items.payments', href: '/admin/payments', icon: CreditCard, permission: ['PAYMENTS', 'VIEW'] },
      { labelKey: 'items.reconciliation', href: '/admin/payments/reconciliation', icon: ListChecks, permission: ['RECONCILIATION', 'VIEW'] },
      { labelKey: 'items.reports', href: '/admin/reports', icon: BarChart3, permission: ['REPORTS', 'VIEW'] },
    ],
  },
  {
    titleKey: 'sections.operations',
    items: [
      { labelKey: 'items.announcements', href: '/admin/announcements', icon: Megaphone, permission: ['ANNOUNCEMENTS', 'VIEW'] },
      { labelKey: 'items.requests', href: '/admin/requests', icon: CircleAlert, permission: ['REQUESTS', 'VIEW'] },
      { labelKey: 'items.maintenance', href: '/admin/maintenance', icon: Wrench, permission: ['REQUESTS', 'VIEW'] },
      { labelKey: 'items.serviceProviders', href: '/admin/service-providers', icon: UserCheck, permission: ['SUPPLIERS', 'VIEW'] },
      { labelKey: 'items.connect', href: '/admin/connect', icon: MessageCircle, permission: ['REQUESTS', 'VIEW'] },
      { labelKey: 'items.imports', href: '/admin/imports', icon: Upload, permission: ['IMPORTS', 'VIEW'] },
      { labelKey: 'items.exports', href: '/admin/exports', icon: Download, permission: ['EXPORTS', 'VIEW'] },
      { labelKey: 'items.dataQuality', href: '/admin/data-quality', icon: ListChecks, permission: ['DATA_QUALITY', 'VIEW'] },
    ],
  },
  {
    titleKey: 'sections.system',
    items: [
      { labelKey: 'items.notifications', href: '/admin/notifications', icon: Bell, permission: ['NOTIFICATIONS', 'VIEW'] },
      { labelKey: 'items.team', href: '/admin/team', icon: Users, permission: ['TEAM', 'VIEW'] },
      { labelKey: 'items.teamInvitations', href: '/admin/team/invitations', icon: Users, permission: ['TEAM', 'INVITE'] },
      { labelKey: 'items.teamActivity', href: '/admin/team/activity', icon: Activity, anyPermissions: [['AUDIT_LOG', 'VIEW'], ['TEAM', 'MANAGE']] },
      { labelKey: 'items.teamSecurity', href: '/admin/team/security', icon: ShieldAlert, anyPermissions: [['AUDIT_LOG', 'VIEW'], ['SETTINGS', 'MANAGE']] },
      { labelKey: 'items.roles', href: '/admin/settings/roles', icon: ShieldCheck, permission: ['TEAM', 'VIEW'] },
      { labelKey: 'items.permissions', href: '/admin/settings/permissions', icon: ShieldCheck, permission: ['TEAM', 'MANAGE'] },
      { labelKey: 'items.settings', href: '/admin/settings/organization', icon: Settings, permission: ['SETTINGS', 'VIEW'] },
    ],
  },
];

export default function AppSidebar({
  organizationName = 'A.P.C. A0123-0940',
  organizationCode = 'A0123-0940',
  userInitials = 'AD',
  userEmail = 'admin@espace.md',
  onNavigate,
}: AppSidebarProps) {
  const t = useTranslations('navigation.adminSidebar');
  const pathname = usePathname();
  const params = useParams<{ locale?: string }>();
  const { can } = usePermissions();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const localePrefix = `/${locale}`;

  function localizedHref(href: string) {
    return `${localePrefix}${href}`;
  }

  function isActive(href: string) {
    const fullHref = localizedHref(href);
    return pathname === href || pathname.startsWith(`${href}/`) || pathname === fullHref || pathname.startsWith(`${fullHref}/`);
  }

  return (
    <aside className="flex h-full min-h-0 w-72 flex-col border-r border-white/10 bg-sidebar text-white shadow-[18px_0_54px_rgba(15,23,42,0.20)]">
      <div className="border-b border-white/10 p-4">
        <Link href={localizedHref('/admin')} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/10" onClick={onNavigate}>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-primary shadow-sm">ES</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{organizationName}</span>
            <span className="block truncate text-xs text-white/50">{organizationCode}</span>
          </span>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {sections.map((section) => {
            const visibleItems = section.items.filter((item) => {
              if (item.permission && !can(item.permission[0], item.permission[1])) return false;
              if (item.anyPermissions?.length && !item.anyPermissions.some((permission) => can(permission[0], permission[1]))) return false;
              return true;
            });
            if (visibleItems.length === 0) return null;
            return (
            <div key={section.titleKey}>
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">{t(section.titleKey)}</p>
              <div className="mt-2 space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={localizedHref(item.href)}
                      onClick={onNavigate}
                      className={`group flex min-h-10 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition ${
                        active
                          ? 'bg-white/15 text-white shadow-[0_16px_32px_-24px_rgba(255,255,255,0.45)]'
                          : 'text-white/60 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-white/55 group-hover:text-white'}`} />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-semibold text-primary shadow-sm">{userInitials}</span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-white">{t('roleLabel')}</span>
            <span className="block truncate text-xs text-white/50">{userEmail}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
