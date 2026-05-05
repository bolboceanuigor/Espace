'use client';

import Link from 'next/link';
import { Building2, CreditCard, ShieldCheck, UserCog, Users } from 'lucide-react';
import { Card, PageHeader, StatCard } from '@/components/ui';

const stats = [
  { label: 'Total asociații', value: '38', description: 'În Moldova și România', icon: <Building2 className="h-5 w-5" /> },
  { label: 'Asociații active', value: '31', description: 'Abonamente active', icon: <ShieldCheck className="h-5 w-5" />, tone: 'success' as const },
  { label: 'Administratori', value: '74', description: 'Utilizatori cu acces administrativ', icon: <UserCog className="h-5 w-5" /> },
  { label: 'Locatari conectați', value: '4,820', description: 'Conturi rezident active', icon: <Users className="h-5 w-5" />, tone: 'success' as const },
  { label: 'Venit lunar platformă', value: '42,900 MDL', description: 'MRR estimat', icon: <CreditCard className="h-5 w-5" />, tone: 'warning' as const },
];

const associations = [
  { name: 'APC Alba Iulia 75', city: 'Chișinău', apartments: 142, admins: 3, residents: 286, status: 'Activă', mrr: '3,420 MDL' },
  { name: 'Asociația Teilor Residence', city: 'Iași', apartments: 96, admins: 2, residents: 178, status: 'Trial', mrr: '0 MDL' },
  { name: 'APC Ștefan cel Mare 18', city: 'Bălți', apartments: 64, admins: 2, residents: 121, status: 'Activă', mrr: '1,860 MDL' },
  { name: 'Condominiu Central Park', city: 'București', apartments: 214, admins: 5, residents: 498, status: 'Activă', mrr: '5,980 MDL' },
];

export default function SuperadminPage() {
  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Platformă"
        description="Vedere de ansamblu pentru Espace: asociații, administratori, locatari conectați și venit lunar."
        rightSlot={
          <Link href="/ro/superadmin/organizations" className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background">
            Vezi asociații
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Asociații</h2>
              <p className="mt-1 text-sm text-muted-foreground">Conturi demo pentru monitorizarea platformei.</p>
            </div>
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              Date mock
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {associations.map((association) => (
              <div key={association.name} className="rounded-[1.1rem] border border-border/70 bg-muted/25 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{association.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{association.city} · {association.apartments} apartamente</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    association.status === 'Activă' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {association.status}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                  <Mini label="Administratori" value={String(association.admins)} />
                  <Mini label="Locatari conectați" value={String(association.residents)} />
                  <Mini label="MRR" value={association.mrr} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-foreground">Semnale platformă</h2>
          <div className="mt-5 space-y-3">
            {[
              ['Trial-uri active', '7 asociații în perioada de test'],
              ['Necesită follow-up', '3 administratori trebuie contactați'],
              ['Creștere lunară', '+12% locatari conectați'],
              ['Stocare', '36% din limita planificată'],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-2xl border border-border/70 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}
