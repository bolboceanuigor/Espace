'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  Plus,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  Settings,
  BarChart3,
  Home,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

// Mock data for Superadmin
const platformStats = {
  totalAssociations: 147,
  totalApartments: 8420,
  activeSubscriptions: 142,
  monthlyRevenue: 284500,
  revenueGrowth: 12.5,
  newAssociationsThisMonth: 8,
  pendingApprovals: 3,
  supportTickets: 12,
};

const recentAssociations = [
  {
    id: '1',
    name: 'APC Alba Iulia 75',
    city: 'Chisinau',
    apartments: 120,
    status: 'active',
    plan: 'Premium',
    joinedDate: '28 Apr 2026',
    admin: 'Maria Popescu',
  },
  {
    id: '2',
    name: 'Bloc Residential Sunrise',
    city: 'Balti',
    apartments: 84,
    status: 'trial',
    plan: 'Trial',
    joinedDate: '25 Apr 2026',
    admin: 'Ion Cebanu',
  },
  {
    id: '3',
    name: 'Condominiu Central Park',
    city: 'Chisinau',
    apartments: 200,
    status: 'active',
    plan: 'Enterprise',
    joinedDate: '20 Apr 2026',
    admin: 'Ana Rotaru',
  },
  {
    id: '4',
    name: 'Asociatia Proprietarilor Bd. Stefan',
    city: 'Orhei',
    apartments: 56,
    status: 'pending',
    plan: 'Standard',
    joinedDate: '18 Apr 2026',
    admin: 'Vasile Ceban',
  },
];

const supportRequests = [
  {
    id: '1',
    association: 'APC Alba Iulia 75',
    subject: 'Problema cu generarea facturilor',
    priority: 'high',
    status: 'open',
    createdAt: '2 ore',
  },
  {
    id: '2',
    association: 'Bloc Sunrise',
    subject: 'Intrebare despre contoare',
    priority: 'medium',
    status: 'open',
    createdAt: '5 ore',
  },
  {
    id: '3',
    association: 'Condominiu Central',
    subject: 'Actualizare date bancare',
    priority: 'low',
    status: 'pending',
    createdAt: '1 zi',
  },
];

const statusColors = {
  active: 'bg-success/10 text-success',
  trial: 'bg-primary/10 text-primary',
  pending: 'bg-warning/10 text-warning',
  inactive: 'bg-muted text-muted-foreground',
};

const priorityColors = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-muted text-muted-foreground',
};

export default function SuperadminPlatformPage() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Superadmin
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              Platforma Espace
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestioneaza toate asociatiile si abonamentele
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-premium transition hover:bg-muted">
              <Settings className="mr-2 inline-block h-4 w-4" />
              Setari
            </button>
            <Link
              href="/superadmin/associations/new"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Asociatie noua
            </Link>
          </div>
        </div>
      </header>

      <main className="p-6">
        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Building2 className="h-5 w-5" />
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <ArrowUpRight className="h-3 w-3" />
                +{platformStats.newAssociationsThisMonth}
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground">
              {platformStats.totalAssociations}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Asociatii totale</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-success/10 p-2.5 text-success">
                <Home className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground">
              {platformStats.totalApartments.toLocaleString('ro-RO')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Apartamente gestionate</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-accent/10 p-2.5 text-accent">
                <CheckCircle2 className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground">
              {platformStats.activeSubscriptions}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Abonamente active</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-warning/10 p-2.5 text-warning">
                <TrendingUp className="h-5 w-5" />
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <ArrowUpRight className="h-3 w-3" />
                +{platformStats.revenueGrowth}%
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground">
              {platformStats.monthlyRevenue.toLocaleString('ro-RO')} MDL
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Venit lunar</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Recent Associations */}
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-premium">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Asociatii recente</h2>
                <p className="text-sm text-muted-foreground">Ultimele asociatii inregistrate</p>
              </div>
              <Link
                href="/superadmin/associations"
                className="text-sm font-medium text-primary hover:underline"
              >
                Vezi toate
              </Link>
            </div>
            <div className="divide-y divide-border">
              {recentAssociations.map((association) => (
                <Link
                  key={association.id}
                  href={`/superadmin/associations/${association.id}`}
                  className="flex items-center gap-4 p-5 transition hover:bg-muted/50"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{association.name}</p>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColors[association.status as keyof typeof statusColors]}`}>
                        {association.status === 'active' ? 'Activ' : association.status === 'trial' ? 'Trial' : 'In asteptare'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {association.city} - {association.apartments} apartamente - {association.plan}
                    </p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm text-foreground">{association.admin}</p>
                    <p className="text-xs text-muted-foreground">{association.joinedDate}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>

          {/* Support & Quick Actions */}
          <div className="space-y-6">
            {/* Pending Approvals */}
            {platformStats.pendingApprovals > 0 && (
              <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-warning/20 p-2.5 text-warning">
                    <Clock className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-medium text-foreground">
                      {platformStats.pendingApprovals} asociatii in asteptare
                    </p>
                    <p className="text-sm text-muted-foreground">Necesita aprobare</p>
                  </div>
                </div>
                <Link
                  href="/superadmin/associations?status=pending"
                  className="mt-4 block w-full rounded-xl bg-warning px-4 py-2.5 text-center text-sm font-medium text-warning-foreground transition hover:bg-warning/90"
                >
                  Revizuieste
                </Link>
              </div>
            )}

            {/* Support Requests */}
            <div className="rounded-2xl border border-border bg-card shadow-premium">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-muted p-2 text-foreground">
                    <MessageSquare className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-foreground">Suport</h3>
                </div>
                <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-white">
                  {platformStats.supportTickets}
                </span>
              </div>
              <div className="divide-y divide-border">
                {supportRequests.slice(0, 3).map((request) => (
                  <Link
                    key={request.id}
                    href={`/superadmin/support/${request.id}`}
                    className="block p-4 transition hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${priorityColors[request.priority as keyof typeof priorityColors]}`}>
                        {request.priority === 'high' ? 'Urgent' : request.priority === 'medium' ? 'Mediu' : 'Normal'}
                      </span>
                      <span className="text-xs text-muted-foreground">{request.createdAt}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">{request.subject}</p>
                    <p className="text-xs text-muted-foreground">{request.association}</p>
                  </Link>
                ))}
              </div>
              <div className="border-t border-border p-4">
                <Link
                  href="/superadmin/support"
                  className="block w-full rounded-xl border border-border bg-background px-4 py-2.5 text-center text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  Vezi toate cererile
                </Link>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
              <h3 className="font-semibold text-foreground">Actiuni rapide</h3>
              <div className="mt-4 space-y-2">
                <Link
                  href="/superadmin/associations/new"
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition hover:bg-muted"
                >
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Plus className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">Adauga asociatie</span>
                </Link>
                <Link
                  href="/superadmin/reports"
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition hover:bg-muted"
                >
                  <span className="rounded-lg bg-accent/10 p-2 text-accent">
                    <BarChart3 className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">Rapoarte platforma</span>
                </Link>
                <Link
                  href="/superadmin/settings"
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition hover:bg-muted"
                >
                  <span className="rounded-lg bg-muted p-2 text-foreground">
                    <Settings className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">Setari platforma</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
