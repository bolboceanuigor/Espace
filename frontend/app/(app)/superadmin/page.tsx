'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, Building2, CreditCard, Gauge, Plus, ShieldCheck, Timer, UserCog, Users } from 'lucide-react';
import { Card, PageHeader, StatCard } from '@/components/ui';
import { activityApi, superadminApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';
import {
  mockAssociations,
  normalizeApiAdministrator,
  normalizeApiAssociation,
  type MvpAdministrator,
  type MvpAssociation,
} from '@/lib/superadmin-mvp-data';

function nextStepForAssociation(association: MvpAssociation) {
  if (!association.administratorEmail) return 'Invită administrator';
  if (association.status === 'TRIAL') return 'Finalizează onboarding';
  if (association.status === 'INACTIVE') return 'Verifică suportul';
  return association.apartmentsCount > 0 ? 'Monitorizează activitatea' : 'Importă apartamente';
}

export default function SuperadminPage() {
  const localizedPath = useLocalizedPath();
  const [associations, setAssociations] = useState<MvpAssociation[]>([]);
  const [source, setSource] = useState<'loading' | 'api' | 'mock'>('loading');
  const [overview, setOverview] = useState<any | null>(null);
  const [recentAdmins, setRecentAdmins] = useState<MvpAdministrator[]>([]);
  const [platformActivity, setPlatformActivity] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([superadminApi.listPublicOrganizations(), superadminApi.overview(), activityApi.superadminList({ limit: 20 })])
      .then(([organizationsResult, overviewResult, activityResult]) => {
        if (!active) return;
        if (organizationsResult.status === 'fulfilled') {
          const apiRows = (organizationsResult.value.data || []).map(normalizeApiAssociation);
          setAssociations(apiRows);
          setSource('api');
        }
        if (overviewResult.status === 'fulfilled' && overviewResult.value.data) {
          const data = overviewResult.value.data;
          setOverview(data);
          if (Array.isArray(data.recentOrganizations) && organizationsResult.status !== 'fulfilled') {
            setAssociations(data.recentOrganizations.map(normalizeApiAssociation));
          }
          if (Array.isArray(data.recentAdmins)) {
            setRecentAdmins(data.recentAdmins.map(normalizeApiAdministrator));
          }
          setSource('api');
        }
        if (activityResult.status === 'fulfilled') {
          setPlatformActivity(activityResult.value.data || []);
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
      residents: Number(overview?.residentsCount ?? (source === 'mock' ? Math.max(totalApartments * 2, 4820) : totalApartments)),
      apartments: Number(overview?.apartmentsCount ?? totalApartments),
      meters: Number(overview?.totalMeters ?? 0),
      invoices: Number(overview?.totalInvoices ?? 0),
      mrr: `${Number(overview?.estimatedMonthlyRevenue ?? (source === 'mock' ? Math.max(totalApartments * 24, 42900) : 0)).toLocaleString('ro-RO')} MDL`,
    };
  }, [associations, overview, source]);

  const stats = [
    { label: 'Total asociații', value: String(totals.total), description: 'Republica Moldova', icon: <Building2 className="h-5 w-5" /> },
    { label: 'Active', value: String(totals.active), description: 'Abonamente active', icon: <ShieldCheck className="h-5 w-5" />, tone: 'success' as const },
    { label: 'Trial', value: String(totals.trial), description: 'În evaluare', icon: <Timer className="h-5 w-5" />, tone: 'warning' as const },
    { label: 'Inactive', value: String(totals.inactive), description: 'Acces dezactivat', icon: <Building2 className="h-5 w-5" /> },
    { label: 'Administratori', value: String(totals.adminsReal), description: 'Utilizatori cu acces administrativ', icon: <UserCog className="h-5 w-5" /> },
    { label: 'Locatari conectați', value: totals.residents.toLocaleString('ro-RO'), description: 'Conturi rezident active', icon: <Users className="h-5 w-5" />, tone: 'success' as const },
    { label: 'Apartamente', value: totals.apartments.toLocaleString('ro-RO'), description: 'Unități administrate', icon: <Building2 className="h-5 w-5" /> },
    { label: 'Contoare', value: totals.meters.toLocaleString('ro-RO'), description: 'Înregistrate pe platformă', icon: <Gauge className="h-5 w-5" /> },
    { label: 'Facturi', value: totals.invoices.toLocaleString('ro-RO'), description: 'Emise pentru A.P.C.', icon: <CreditCard className="h-5 w-5" /> },
    { label: 'Venit lunar estimat', value: totals.mrr, description: 'Abonamente manuale', icon: <CreditCard className="h-5 w-5" />, tone: 'warning' as const },
  ];

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Platformă"
        description="CRM pentru clienții A.P.C.: asociații, contacte, onboarding, abonamente, activitate și follow-up."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Link href={localizedPath('/superadmin/organizations')} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background">
              Vezi asociații
            </Link>
            <Link href={localizedPath('/superadmin/system/status')} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold text-foreground">
              Status sistem
            </Link>
          </div>
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
              <h2 className="text-base font-semibold text-foreground">Clienți A.P.C.</h2>
              <p className="mt-1 text-sm text-muted-foreground">Asociații urmărite ca profiluri CRM.</p>
            </div>
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {associations.map((association) => (
              <div key={association.name} className="rounded-[1.1rem] border border-border/70 bg-muted/25 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{association.shortName || association.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{association.legalName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{association.city} · {association.apartmentsCount} apartamente</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    association.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {association.status === 'ACTIVE' ? 'Activă' : association.status === 'TRIAL' ? 'Trial' : 'Inactivă'}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                  <Mini label="Contact responsabil" value={association.administratorName || 'Neatribuit'} />
                  <Mini label="Următorul pas" value={nextStepForAssociation(association)} />
                  <Mini label="MRR estimat" value={`${(association.apartmentsCount * 24).toLocaleString('ro-RO')} MDL`} />
                </div>
              </div>
            ))}
            {source === 'loading' ? (
              <div className="rounded-[1.1rem] border border-border/70 bg-muted/25 p-4 text-sm font-medium text-muted-foreground">
                Se încarcă datele...
              </div>
            ) : null}
            {source !== 'loading' && !associations.length ? (
              <div className="rounded-[1.1rem] border border-border/70 bg-muted/25 p-4 text-sm font-medium text-muted-foreground">
                Nu există asociații încă.
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-foreground">Acțiuni rapide</h2>
          <div className="mt-5 space-y-3">
            <QuickAction href={localizedPath('/superadmin/organizations')} icon={<Plus className="h-4 w-4" />} title="Adaugă A.P.C." detail="Creează un client nou" />
            <QuickAction href={localizedPath('/superadmin/admins')} icon={<UserCog className="h-4 w-4" />} title="Invită administrator" detail="Contact responsabil pentru A.P.C." />
            <QuickAction href={localizedPath('/superadmin/tasks')} icon={<Timer className="h-4 w-4" />} title="Sarcini / follow-up" detail="Pași următori și suport" />
            <QuickAction href={localizedPath('/superadmin/subscriptions')} icon={<CreditCard className="h-4 w-4" />} title="Planuri" detail="Abonamente și limite manuale" />
            <QuickAction href={localizedPath('/superadmin/system/status')} icon={<Activity className="h-4 w-4" />} title="Verifică status sistem" detail="API și baza de date" />
          </div>
        </Card>
      </section>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Administratori recenți</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ultimele conturi ADMIN create pe platformă.</p>
          </div>
          <Link href={localizedPath('/superadmin/admins')} className="text-sm font-semibold text-primary">
            Vezi toți
          </Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recentAdmins.map((admin) => (
            <div key={admin.id} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
              <p className="font-semibold text-foreground">{`${admin.firstName} ${admin.lastName}`.trim() || admin.email}</p>
              <p className="mt-1 text-sm text-muted-foreground">{admin.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">{admin.organization?.shortName || admin.organization?.name || 'Asociație neatribuită'}</p>
            </div>
          ))}
          {source === 'loading' ? (
            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm font-medium text-muted-foreground">
              Se încarcă datele...
            </div>
          ) : null}
          {source !== 'loading' && !recentAdmins.length ? (
            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm font-medium text-muted-foreground">
              Nu există administratori recenți.
            </div>
          ) : null}
          </div>
        </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Activitate platformă</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ultimele schimbări reale din asociații și administratori.</p>
          </div>
          <Link href={localizedPath('/superadmin/audit-logs')} className="text-sm font-semibold text-primary">
            Vezi jurnal
          </Link>
        </div>
        <div className="mt-5 space-y-2">
          {platformActivity.slice(0, 10).map((item) => (
            <div key={item.id} className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{item.title || item.type}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.message || 'Activitate înregistrată.'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.organization?.name || 'Platformă'} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString('ro-RO') : '-'}
              </p>
            </div>
          ))}
          {source === 'loading' ? (
            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm font-medium text-muted-foreground">
              Se încarcă activitatea...
            </div>
          ) : null}
          {source !== 'loading' && !platformActivity.length ? (
            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm font-medium text-muted-foreground">
              Nu există activitate recentă în platformă.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function QuickAction({ href, icon, title, detail }: { href: string; icon: ReactNode; title: string; detail: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-white px-4 py-3 hover:bg-muted/40">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-foreground text-background">{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
      </span>
    </Link>
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
