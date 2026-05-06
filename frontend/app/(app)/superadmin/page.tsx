'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { 
  Building2, 
  Users,
  ArrowRight,
  TrendingUp,
  Clock,
  AlertCircle,
  Banknote,
  CheckCircle2,
  Plus,
  MessageSquare,
  FileText,
  Settings
} from 'lucide-react';
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
    return () => { active = false; };
  }, []);

  const totals = useMemo(() => {
    const totalApartments = associations.reduce((sum, a) => sum + a.apartmentsCount, 0);
    const active = associations.filter((a) => a.status === 'ACTIVE').length;
    return {
      total: associations.length,
      active,
      residents: Math.max(totalApartments * 2, source === 'api' ? totalApartments : 4820),
      mrr: Math.max(totalApartments * 24, source === 'api' ? 0 : 42900),
    };
  }, [associations, source]);

  return (
    <div className="animate-page-in space-y-8 pb-12">
      {/* Hero Header */}
      <header className="relative overflow-hidden rounded-2xl bg-foreground p-8 text-white">
        <div className="relative z-10">
          <p className="text-sm font-medium text-white/60">Super Admin</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Buna ziua!</h1>
          <p className="mt-2 max-w-xl text-base text-white/70">
            Platforma Espace gestioneaza {totals.total} asociatii cu {totals.residents.toLocaleString('ro-RO')} locatari conectati.
          </p>
        </div>
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -right-20 h-48 w-48 rounded-full bg-white/5" />
      </header>

      {/* Stats Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          label="Asociatii" 
          value={totals.total} 
          change="+3 luna aceasta"
          icon={Building2}
          color="bg-blue-500"
        />
        <StatCard 
          label="Active" 
          value={totals.active} 
          change={`${Math.round((totals.active / totals.total) * 100)}% rata activare`}
          icon={CheckCircle2}
          color="bg-emerald-500"
        />
        <StatCard 
          label="Locatari" 
          value={totals.residents.toLocaleString('ro-RO')} 
          change="+12% vs. luna trecuta"
          icon={Users}
          color="bg-violet-500"
        />
        <StatCard 
          label="Venit lunar" 
          value={`${totals.mrr.toLocaleString('ro-RO')} MDL`} 
          change="MRR estimat"
          icon={Banknote}
          color="bg-amber-500"
        />
      </section>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Organizations */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Asociatii recente</h2>
            <Link 
              href="/ro/superadmin/organizations"
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Vezi toate <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          
          <div className="space-y-3">
            {associations.slice(0, 5).map((org) => (
              <div 
                key={org.name}
                className="group flex items-center gap-4 rounded-xl border border-border bg-white p-4 transition hover:border-gray-300 hover:shadow-sm"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{org.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      org.status === 'ACTIVE' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : org.status === 'TRIAL'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {org.status === 'ACTIVE' ? 'Activ' : org.status === 'TRIAL' ? 'Trial' : 'Inactiv'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {org.city} · {org.apartmentsCount} apartamente · {org.administratorName || 'Fara admin'}
                  </p>
                </div>

                <Link 
                  href={`/ro/superadmin/organizations/${org.id || org.name}`}
                  className="rounded-lg border border-border p-2 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-muted hover:text-foreground"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Alerts */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Atentie necesara</h3>
            <div className="space-y-2">
              <AlertItem 
                icon={Clock} 
                title="7 trial-uri expira" 
                desc="In urmatoarele 7 zile"
                color="text-blue-600 bg-blue-50"
              />
              <AlertItem 
                icon={AlertCircle} 
                title="3 necesita follow-up" 
                desc="Administratori de contactat"
                color="text-amber-600 bg-amber-50"
              />
              <AlertItem 
                icon={TrendingUp} 
                title="+24% crestere" 
                desc="Locatari noi saptamana aceasta"
                color="text-emerald-600 bg-emerald-50"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Actiuni rapide</h3>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction href="/ro/superadmin/organizations" icon={Plus} label="Asociatie noua" />
              <QuickAction href="/ro/superadmin/leads" icon={Users} label="Vezi leads" />
              <QuickAction href="/ro/superadmin/feedback" icon={MessageSquare} label="Feedback" />
              <QuickAction href="/ro/superadmin/demo-requests" icon={FileText} label="Demo requests" />
            </div>
          </div>

          {/* Data Source */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${source === 'api' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {source === 'api' ? 'Date live' : 'Date demonstrative'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {source === 'api' ? 'Conectat la API' : 'Foloseste date mock'}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  change, 
  icon: Icon, 
  color 
}: { 
  label: string; 
  value: number | string; 
  change: string; 
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{change}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function AlertItem({ 
  icon: Icon, 
  title, 
  desc, 
  color 
}: { 
  icon: React.ElementType; 
  title: string; 
  desc: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 transition hover:border-gray-300">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function QuickAction({ 
  href, 
  icon: Icon, 
  label 
}: { 
  href: string; 
  icon: React.ElementType; 
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-4 text-center transition hover:border-gray-300 hover:bg-muted/50"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </Link>
  );
}
