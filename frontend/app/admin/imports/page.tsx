'use client';

import Link from 'next/link';
import { Building2, FileSpreadsheet, Layers3, Upload } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';
import EmptyState from '@/components/common/EmptyState';
import { useLocalizedPath } from '@/lib/use-localized-path';

const importOptions = [
  {
    title: 'Import apartamente și locatari',
    description: 'Încarcă un CSV cu scări, apartamente, suprafețe și proprietari/locatari.',
    href: '/admin/imports/apartments',
    icon: Upload,
    action: 'Importă apartamente',
  },
  {
    title: 'Adăugare apartamente în masă',
    description: 'Creează rapid un interval de apartamente pentru o scară existentă.',
    href: '/admin/apartments/bulk-create',
    icon: Layers3,
    action: 'Adaugă în masă',
  },
  {
    title: 'Pregătește blocul',
    description: 'Importul are nevoie de un bloc real al A.P.C. înainte de încărcarea fișierului.',
    href: '/admin/buildings',
    icon: Building2,
    action: 'Gestionează blocuri',
  },
];

export default function AdminImportsPage() {
  const localizedPath = useLocalizedPath();

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Import date"
        description="Onboarding rapid pentru apartamente, locatari și relația proprietar-apartament într-o A.P.C."
        rightSlot={
          <Link href={localizedPath('/admin/imports/apartments')} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background">
            <FileSpreadsheet className="h-4 w-4" />
            Importă apartamente
          </Link>
        }
      />

      <section className="grid gap-3 lg:grid-cols-3">
        {importOptions.map((option) => {
          const Icon = option.icon;
          return (
            <Card key={option.href} className="flex h-full flex-col justify-between p-4">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/50 text-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-foreground">{option.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{option.description}</p>
              </div>
              <Link href={localizedPath(option.href)} className="mt-5 inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
                {option.action}
              </Link>
            </Card>
          );
        })}
      </section>

      <EmptyState
        title="Nu ai încă importuri efectuate."
        description="Pentru MVP, rezultatul importului este afișat imediat după încărcarea fișierului CSV."
      />
    </div>
  );
}
