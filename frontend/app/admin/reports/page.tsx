'use client';

import Link from 'next/link';
import MobilePageHeader from '@/components/common/MobilePageHeader';

const cards = [
  { href: '/admin/reports/monthly', title: 'Monthly Financial Report', description: 'Charges, payments, debt and top debt apartments' },
  { href: '/admin/reports/debts', title: 'Apartment Debt Report', description: 'Debt table with building/staircase/floor filters' },
  { href: '/admin/reports/payments', title: 'Payment Register', description: 'Payments list by date range and export to Excel' },
  { href: '/admin/reports/monthly', title: 'Tariff / Charges Report', description: 'Charges breakdown by tariff and period' },
];

export default function AdminReportsHomePage() {
  return (
    <div className="space-y-4">
      <MobilePageHeader title="Financial Reports" subtitle="Choose report type and export financial data." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="rounded-xl border border-border/70 bg-card p-4 transition hover:bg-muted/20">
            <p className="font-medium text-foreground">{card.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
