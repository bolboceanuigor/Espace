'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { CreditCard, FileText, Home, Menu, Wrench } from 'lucide-react';
import { defaultLocale, isLocale } from '@/i18n';

const ITEMS = [
  { href: '/resident', label: 'Home', icon: Home },
  { href: '/resident/invoices', label: 'Invoices', icon: FileText },
  { href: '/resident/payments/new', label: 'Pay', icon: CreditCard },
  { href: '/resident/issues', label: 'Issues', icon: Wrench },
  { href: '/resident/profile', label: 'More', icon: Menu },
];

export default function ResidentBottomNav() {
  const pathname = usePathname();
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 md:hidden">
      <div className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const target = `/${locale}${item.href}`;
          const active = pathname === target || pathname.startsWith(`${target}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={target}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

