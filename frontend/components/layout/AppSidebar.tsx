'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import {
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
  Receipt,
  Settings,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { defaultLocale, isLocale } from '@/i18n';

type AppSidebarProps = {
  organizationName?: string;
  organizationCode?: string;
  userInitials?: string;
  userEmail?: string;
  onNavigate?: () => void;
};

const sections: Array<{
  title: string;
  items: Array<{ label: string; href: string; icon: LucideIcon }>;
}> = [
  {
    title: 'Administrare',
    items: [
      { label: 'Dashboard', href: '/admin', icon: Home },
      { label: 'Apartamente', href: '/admin/apartments', icon: Building2 },
      { label: 'Locatari', href: '/admin/residents', icon: Users },
      { label: 'Tarife', href: '/admin/tariffs', icon: Calculator },
      { label: 'Contoare', href: '/admin/meters', icon: Gauge },
    ],
  },
  {
    title: 'Financiar',
    items: [
      { label: 'Facturare lunară', href: '/admin/billing', icon: Receipt },
      { label: 'Facturi interne', href: '/admin/invoices', icon: FileText },
      { label: 'Plăți', href: '/admin/payments', icon: CreditCard },
      { label: 'Reconciliere', href: '/admin/payments/reconciliation', icon: ListChecks },
      { label: 'Rapoarte', href: '/admin/reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Operațional',
    items: [
      { label: 'Anunțuri', href: '/admin/announcements', icon: Megaphone },
      { label: 'Solicitări', href: '/admin/requests', icon: CircleAlert },
      { label: 'Importuri', href: '/admin/imports', icon: Upload },
      { label: 'Exporturi', href: '/admin/exports', icon: Download },
      { label: 'Calitatea datelor', href: '/admin/data-quality', icon: ListChecks },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { label: 'Notificări', href: '/admin/notifications', icon: Bell },
      { label: 'Setări', href: '/admin/settings/organization', icon: Settings },
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
  const pathname = usePathname();
  const params = useParams<{ locale?: string }>();
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
    <aside className="flex h-full min-h-0 w-72 flex-col border-r border-slate-200/80 bg-white/95 text-slate-900 shadow-[16px_0_50px_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div className="border-b border-slate-200/80 p-4">
        <Link href={localizedHref('/admin')} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-slate-50" onClick={onNavigate}>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-sm">ES</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{organizationName}</span>
            <span className="block truncate text-xs text-slate-500">{organizationCode}</span>
          </span>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{section.title}</p>
              <div className="mt-2 space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={localizedHref(item.href)}
                      onClick={onNavigate}
                      className={`group flex min-h-10 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition ${
                        active
                          ? 'bg-slate-950 text-white shadow-[0_14px_28px_-20px_rgba(15,23,42,0.9)]'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-200/80 p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-900 shadow-sm">{userInitials}</span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-slate-900">Administrator</span>
            <span className="block truncate text-xs text-slate-500">{userEmail}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
