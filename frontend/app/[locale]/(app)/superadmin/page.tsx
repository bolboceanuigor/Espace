'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { 
  Building2, 
  CreditCard, 
  ShieldCheck, 
  UserCog, 
  Users,
  ArrowUpRight,
  TrendingUp,
  Clock,
  AlertCircle,
  HardDrive
} from 'lucide-react';
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

  useEffect(() => {
    let active = true;
    superadminApi
      .listPublicOrganizations()
      .then((res) => {
        if (!active) return;
        const apiRows = (res.data || []).map(normalizeApiAssociation);
        if (apiRows.length) {
          setAssociations(apiRows);
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
      total: associations.length,
      active,
      admins: associations.filter((item) => item.administratorEmail).length,
      residents: Math.max(totalApartments * 2, source === 'api' ? totalApartments : 4820),
      mrr: `${Math.max(totalApartments * 24, source === 'api' ? 0 : 42900).toLocaleString('ro-RO')} MDL`,
    };
  }, [associations, source]);

  const stats = [
    { label: 'Total asociatii', value: String(totals.total), description: 'In Moldova si Romania', icon: <Building2 className="h-5 w-5" /> },
    { label: 'Asociatii active', value: String(totals.active), description: 'Abonamente active', icon: <ShieldCheck className="h-5 w-5" />, tone: 'success' as const },
    { label: 'Administratori', value: String(totals.admins), description: 'Utilizatori cu acces administrativ', icon: <UserCog className="h-5 w-5" /> },
    { label: 'Locatari conectati', value: totals.residents.toLocaleString('ro-RO'), description: 'Conturi rezident active', icon: <Users className="h-5 w-5" />, tone: 'success' as const },
    { label: 'Venit lunar platforma', value: totals.mrr, description: 'MRR estimat', icon: <CreditCard className="h-5 w-5" />, tone: 'warning' as const },
  ];

  const signals = [
    { 
      title: 'Trial-uri active', 
      detail: '7 asociatii in perioada de test',
      icon: Clock,
      color: 'text-blue-600 bg-blue-50'
    },
    { 
      title: 'Necesita follow-up', 
      detail: '3 administratori trebuie contactati',
      icon: AlertCircle,
      color: 'text-amber-600 bg-amber-50'
    },
    { 
      title: 'Crestere lunara', 
      detail: '+12% locatari conectati',
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-50'
    },
    { 
      title: 'Stocare', 
      detail: '36% din limita planificata',
      icon: HardDrive,
      color: 'text-slate-600 bg-slate-50'
    },
  ];

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Platforma</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vedere de ansamblu pentru Espace: asociatii, administratori, locatari si venit lunar.
          </p>
        </div>
        <Link 
          href="/ro/superadmin/organizations" 
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-white transition hover:bg-foreground/90"
        >
          Vezi asociatii
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stats Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </section>

      {/* Main Content Grid */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Associations List - Takes 2 columns */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Asociatii</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">Conturi pentru monitorizarea platformei</p>
              </div>
              <span className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                source === 'api' 
                  ? 'bg-emerald-50 text-emerald-700' 
                  : 'bg-amber-50 text-amber-700'
              }`}>
                {source === 'api' ? 'Date API' : 'Date demo'}
              </span>
            </div>
            
            <div className="mt-4 space-y-3">
              {associations.slice(0, 5).map((association) => (
                <div 
                  key={association.name} 
                  className="rounded-xl border border-border bg-white p-4 transition hover:border-border/80 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{association.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {association.city} · {association.apartmentsCount} apartamente
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      association.status === 'ACTIVE' 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {association.status === 'ACTIVE' ? 'Activa' : association.status === 'TRIAL' ? 'Trial' : 'Inactiva'}
                    </span>
                  </div>
                  
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <InfoCell label="Administrator" value={association.administratorName} />
                    <InfoCell label="Email" value={association.administratorEmail || '-'} />
                    <InfoCell label="MRR estimat" value={`${(association.apartmentsCount * 24).toLocaleString('ro-RO')} MDL`} />
                  </div>
                </div>
              ))}
            </div>

            {associations.length > 5 && (
              <Link 
                href="/ro/superadmin/organizations"
                className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Vezi toate asociatiile
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
          </Card>
        </div>

        {/* Signals Panel */}
        <div>
          <Card>
            <div className="border-b border-border pb-4">
              <h2 className="text-base font-semibold text-foreground">Semnale platforma</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Alerte si metrici importante</p>
            </div>
            
            <div className="mt-4 space-y-3">
              {signals.map((signal) => {
                const Icon = signal.icon;
                return (
                  <div 
                    key={signal.title} 
                    className="flex items-start gap-3 rounded-xl border border-border bg-white p-4 transition hover:border-border/80"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${signal.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{signal.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{signal.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="mt-4">
            <h3 className="text-sm font-semibold text-foreground">Actiuni rapide</h3>
            <div className="mt-3 space-y-2">
              {[
                { label: 'Adauga asociatie', href: '/ro/superadmin/organizations' },
                { label: 'Vezi leads', href: '/ro/superadmin/leads' },
                { label: 'Demo requests', href: '/ro/superadmin/demo-requests' },
                { label: 'System status', href: '/ro/superadmin/system/status' },
              ].map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  {action.label}
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
