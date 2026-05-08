'use client';

import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';

const cards = [
  { href: '/admin/reports/debts', title: 'Datorii', description: 'Solduri pe apartamente, facturi neachitate și întârzieri.' },
  { href: '/admin/reports/payments', title: 'Plăți', description: 'Registru plăți cu filtre după perioadă și metodă.' },
  { href: '/admin/reports/monthly', title: 'Lunar', description: 'Total emis, achitat, restant și rata de colectare.' },
  { href: '/admin/reports/apartments', title: 'Apartamente', description: 'Inventar apartamente, suprafețe, locatari, contoare și datorii.' },
  { href: '/admin/reports/residents', title: 'Locatari', description: 'Evidență locatari, conturi, roluri și apartamente asociate.' },
];

export default function AdminReportsHomePage() {
  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Rapoarte A.P.C."
        description="Rapoarte operaționale utile pentru administrarea asociației: datorii, plăți, facturi, apartamente și locatari."
      />
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card className="h-full transition hover:border-foreground/20 hover:bg-muted/30">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-foreground">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-foreground">{card.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
