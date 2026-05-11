'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Bell, FileText, Gauge, Home, MessageCircle, User, type LucideIcon } from 'lucide-react';
import { defaultLocale, isLocale } from '@/i18n';

const items: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: '/resident', label: 'Acasă', icon: Home },
  { href: '/resident/invoices', label: 'Facturi', icon: FileText },
  { href: '/resident/meters', label: 'Contoare', icon: Gauge },
  { href: '/resident/requests', label: 'Cereri', icon: MessageCircle },
  { href: '/resident/notifications', label: 'Noutăți', icon: Bell },
];

export default function ResidentBottomNav() {
  const pathname = usePathname();
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const prefix = `/${locale}`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-[0_-16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const href = `${prefix}${item.href}`;
          const active = pathname === href || pathname.startsWith(`${href}/`) || pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={href} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition ${active ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'}`}>
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function ResidentProfileShortcut() {
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  return (
    <Link href={`/${locale}/resident/profile`} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm">
      <User className="h-4 w-4" />
    </Link>
  );
}
