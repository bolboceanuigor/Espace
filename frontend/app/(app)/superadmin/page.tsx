'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Building2, CreditCard, ShieldCheck, Timer, UserCog, Users } from 'lucide-react';
import { Card, PageHeader, StatCard } from '@/components/ui';
import { superadminApi } from '@/lib/api';
import {
  mockAssociations,
  normalizeApiAssociation,
  type MvpAssociation,
} from '@/lib/superadmin-mvp-data';

export default function SuperadminPage() {
  const [associations, setAssociations] = useState<MvpAssociation[]>(mockAssociations);
  const [source, setSource] = useState<'api' | 'mock'>('mock');
  const [overview, setOverview] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([superadminApi.listPublicOrganizations(), superadminApi.overview()])
      .then(([organizationsResult, overviewResult]) => {
        if (!active) return;
        if (organizationsResult.status === 'fulfilled') {
          const apiRows = (organizationsResult.value.data || []).map(normalizeApiAssociation);
          if (apiRows.length) setAssociations(apiRows);
        }
        if (overviewResult.status === 'fulfilled' && overviewResult.value.data) {
          setOverview(overviewResult.value.data);
          setSource('api');
        }
      })
      .catch(() => {
        if (!active) return;
        setAssociations(mockAssociations);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    const totalApartments = associations.reduce((sum, item) => sum + item.apartmentsCount, 0);
    const active = associations.filter((item) => item.status === 'ACTIVE').length;
    return {
      total: Number(overview?.organizationsTotal ?? associations.length),
      active: Number(overview?.organizationsActive ?? active),
      trial: Number(overview?.organizationsTrial ?? associations.filter((item) => item.status === 'TRIAL').length),
      inactive: Number(overview?.organizationsInactive ?? associations.filter((item) => item.status === 'INACTIVE').length),
      admins: associations.filter((item) => item.administratorEmail).length,
      adminsReal: Number(overview?.adminsCount ?? associations.filter((item) => item.administratorEmail).length),
      residents: Number(overview?.residentsCount ?? Math.max(totalApartments * 2, source === 'api' ? totalApartments : 4820)),
      apartments: Number(overview?.apartmentsCount ?? totalApartments),
      mrr: `${Number(overview?.estimatedMonthlyRevenue ?? Math.max(totalApartments * 24, source === 'api' ? 0 : 42900)).toLocaleString('ro-RO')} MDL`,
    };
  }, [associations, overview, source]);

  const stats = [
    { label: 'Total asociații', value: String(totals.total), description: 'În Moldova și România', icon: <Building2 className="h-5 w-5" /> },
    { label: 'Active', value: String(totals.active), description: 'Abonamente active', icon: <ShieldCheck className="h-5 w-5" />, tone: 'success' as const },
    { label: 'Trial', value: String(totals.trial), description: 'În evaluare', icon: <Timer className="h-5 w-5" />, tone: 'warning' as const },
    { label: 'Inactive', value: String(totals.inactive), description: 'Acces dezactivat', icon: <Building2 className="h-5 w-5" /> },
    { label: 'Administratori', value: String(totals.adminsReal), description: 'Utilizatori cu acces administrativ', icon: <UserCog className="h-5 w-5" /> },
    { label: 'Locatari conectați', value: totals.residents.toLocaleString('ro-RO'), description: 'Conturi rezident active', icon: <Users className="h-5 w-5" />, tone: 'success' as const },
    { label: 'Apartamente', value: totals.apartments.toLocaleString('ro-RO'), description: 'Unități administrate', icon: <Building2 className="h-5 w-5" /> },
    { label: 'Venit lunar estimat', value: totals.mrr, description: 'Abonamente manuale', icon: <CreditCard className="h-5 w-5" />, tone: 'warning' as const },
  ];

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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              {source === 'api' ? 'Date API' : 'Date demo · API indisponibil temporar'}
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {associations.map((association) => (
              <div key={association.name} className="rounded-[1.1rem] border border-border/70 bg-muted/25 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{association.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{association.city} · {association.apartmentsCount} apartamente</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    association.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {association.status === 'ACTIVE' ? 'Activă' : association.status === 'TRIAL' ? 'Trial' : 'Inactivă'}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                  <Mini label="Administrator" value={association.administratorName} />
                  <Mini label="Email" value={association.administratorEmail || '-'} />
                  <Mini label="MRR estimat" value={`${(association.apartmentsCount * 24).toLocaleString('ro-RO')} MDL`} />
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
