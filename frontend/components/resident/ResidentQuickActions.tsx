'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { useLocalizedPath } from '@/lib/use-localized-path';

export default function ResidentQuickActions({ items }: { items: Array<{ href: string; label: string; icon?: ReactNode }> }) {
  const localizedPath = useLocalizedPath();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.href}
          href={localizedPath(item.href)}
          className="flex min-h-24 flex-col justify-between rounded-2xl border border-border/75 bg-white p-4 text-sm font-semibold text-foreground shadow-card transition hover:border-primary/20 hover:bg-accent/20"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent/45 text-primary">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
