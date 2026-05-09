'use client';

import Link from 'next/link';
import { X } from 'lucide-react';

const links = [
  { href: '/admin', label: 'Acasă' },
  { href: '/admin/apartments', label: 'Apartamente' },
  { href: '/admin/residents', label: 'Locatari' },
  { href: '/admin/invoices', label: 'Facturi' },
  { href: '/admin/payments', label: 'Plăți' },
  { href: '/admin/issues', label: 'Cereri' },
  { href: '/admin/announcements', label: 'Avizier' },
  { href: '/admin/documents', label: 'Documente' },
  { href: '/admin/settings/organization', label: 'Setări' },
];

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm lg:hidden" onClick={onClose}>
      <aside
        className="h-full w-72 border-r border-border/70 bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold text-foreground">Navigare</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={onClose} className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted/70">
              {link.label}
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
