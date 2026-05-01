'use client';

import Link from 'next/link';

const actions = [
  { href: '/properties', label: 'Add apartment' },
  { href: '/reservations', label: 'New reservation' },
  { href: '/clients', label: 'Add client' },
  { href: '/settings', label: 'Open settings' },
];

export function QuickActions() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <h3 className="text-base font-semibold text-foreground">Quick actions</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-xl border border-border/70 bg-background px-3 py-2 text-center text-sm text-foreground transition hover:bg-muted"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
