'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, FileText, Home, UserRound, Wrench } from 'lucide-react';
import { useLocalizedPath } from '@/lib/use-localized-path';

const ITEMS = [
  { href: '/resident', label: 'Acasă', icon: Home },
  { href: '/resident/invoices', label: 'Facturi', icon: FileText },
  { href: '/resident/balance', label: 'Sold', icon: CreditCard },
  { href: '/resident/requests', label: 'Solicitări', icon: Wrench },
  { href: '/resident/profile', label: 'Cont', icon: UserRound },
];

export default function ResidentBottomNav({ unpaidCount = 0 }: { unpaidCount?: number }) {
  const pathname = usePathname();
  const localizedPath = useLocalizedPath();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-14px_34px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-2xl grid-cols-5 px-1">
        {ITEMS.map((item) => {
          const target = localizedPath(item.href);
          const active = pathname === target || pathname.startsWith(`${target}/`);
          const Icon = item.icon;
          const showInvoiceBadge = item.href === '/resident/invoices' && unpaidCount > 0;
          return (
            <Link
              key={item.href}
              href={target}
              className={`relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition ${
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`flex h-8 w-10 items-center justify-center rounded-2xl ${active ? 'bg-muted' : ''}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="leading-none">{item.label}</span>
              {showInvoiceBadge ? (
                <span className="absolute right-3 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] text-white">
                  {Math.min(unpaidCount, 9)}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
