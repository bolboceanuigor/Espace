'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Home,
  Users,
  CreditCard,
  Gauge,
  MessageSquare,
  Megaphone,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  ChevronRight,
  Plus,
  Building2,
  Calendar,
  FileText,
  Settings,
} from 'lucide-react';

// Mock data for Admin dashboard
const buildingStats = {
  totalApartments: 120,
  occupiedApartments: 112,
  totalResidents: 287,
  totalDebt: 45600,
  collectionRate: 87.5,
  pendingMeterReadings: 34,
  openRequests: 8,
  unreadMessages: 5,
};

const recentActivity = [
  {
    id: '1',
    type: 'payment',
    description: 'Plata primita - Ap. 45',
    amount: 850,
    time: '10 min',
    icon: CreditCard,
    color: 'text-success bg-success/10',
  },
  {
    id: '2',
    type: 'meter',
    description: 'Citire transmisa - Ap. 23',
    time: '25 min',
    icon: Gauge,
    color: 'text-primary bg-primary/10',
  },
  {
    id: '3',
    type: 'request',
    description: 'Cerere noua - Ap. 67',
    time: '1 ora',
    icon: MessageSquare,
    color: 'text-warning bg-warning/10',
  },
  {
    id: '4',
    type: 'payment',
    description: 'Plata primita - Ap. 12',
    amount: 1200,
    time: '2 ore',
    icon: CreditCard,
    color: 'text-success bg-success/10',
  },
];

const urgentRequests = [
  {
    id: '1',
    apartment: '45',
    subject: 'Scurgere la etajul 6',
    priority: 'high',
    status: 'open',
    createdAt: '2 ore',
  },
  {
    id: '2',
    apartment: '23',
    subject: 'Interfon defect',
    priority: 'medium',
    status: 'in_progress',
    createdAt: '1 zi',
  },
];

const recentPayments = [
  { id: '1', apartment: '45', owner: 'Ion Popescu', amount: 850, date: '1 Mai 2026' },
  { id: '2', apartment: '12', owner: 'Maria Ionescu', amount: 1200, date: '1 Mai 2026' },
  { id: '3', apartment: '78', owner: 'Andrei Rusu', amount: 650, date: '30 Apr 2026' },
];

const announcements = [
  {
    id: '1',
    title: 'Intrerupere apa calda - 5 Mai',
    category: 'URGENT',
    date: '30 Apr 2026',
    views: 87,
  },
  {
    id: '2',
    title: 'Sedinta asociatiei - 10 Mai',
    category: 'INFO',
    date: '28 Apr 2026',
    views: 56,
  },
];

const priorityColors = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-muted text-muted-foreground',
};

const statusColors = {
  open: 'bg-destructive/10 text-destructive',
  in_progress: 'bg-warning/10 text-warning',
  resolved: 'bg-success/10 text-success',
};

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Building2 className="h-3 w-3" />
              Administrator
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              APC Alba Iulia 75
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Chisinau - 120 apartamente - 4 scari
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/announcements/new"
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-premium transition hover:bg-muted"
            >
              <Megaphone className="mr-2 inline-block h-4 w-4" />
              Anunt nou
            </Link>
            <Link
              href="/admin/invoices/generate"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90"
            >
              <FileText className="h-4 w-4" />
              Genereaza facturi
            </Link>
          </div>
        </div>
      </header>

      <main className="p-6">
        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/apartments"
            className="rounded-2xl border border-border bg-card p-5 shadow-premium transition hover:border-primary/30 hover:shadow-premium-md"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Home className="h-5 w-5" />
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground">
              {buildingStats.occupiedApartments}/{buildingStats.totalApartments}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Apartamente ocupate</p>
          </Link>

          <Link
            href="/admin/finances"
            className="rounded-2xl border border-border bg-card p-5 shadow-premium transition hover:border-primary/30 hover:shadow-premium-md"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-destructive/10 p-2.5 text-destructive">
                <CreditCard className="h-5 w-5" />
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                <TrendingDown className="h-3 w-3" />
                {100 - buildingStats.collectionRate}%
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground">
              {buildingStats.totalDebt.toLocaleString('ro-RO')} MDL
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Datorii totale</p>
          </Link>

          <Link
            href="/admin/meters"
            className="rounded-2xl border border-border bg-card p-5 shadow-premium transition hover:border-primary/30 hover:shadow-premium-md"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-warning/10 p-2.5 text-warning">
                <Gauge className="h-5 w-5" />
              </span>
              {buildingStats.pendingMeterReadings > 0 && (
                <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
                  {buildingStats.pendingMeterReadings} noi
                </span>
              )}
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground">
              {buildingStats.pendingMeterReadings}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Citiri in asteptare</p>
          </Link>

          <Link
            href="/admin/requests"
            className="rounded-2xl border border-border bg-card p-5 shadow-premium transition hover:border-primary/30 hover:shadow-premium-md"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-accent/10 p-2.5 text-accent">
                <MessageSquare className="h-5 w-5" />
              </span>
              {buildingStats.openRequests > 0 && (
                <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-white">
                  {buildingStats.openRequests}
                </span>
              )}
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground">
              {buildingStats.openRequests}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Cereri deschise</p>
          </Link>
        </div>

        {/* Main Content Grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Activity Feed */}
          <div className="lg:col-span-2 space-y-6">
            {/* Urgent Requests Alert */}
            {urgentRequests.length > 0 && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-destructive/20 p-2.5 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Cereri urgente</p>
                    <p className="text-sm text-muted-foreground">
                      {urgentRequests.filter((r) => r.priority === 'high').length} cereri necesita atentie imediata
                    </p>
                  </div>
                  <Link
                    href="/admin/requests?priority=high"
                    className="rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-white transition hover:bg-destructive/90"
                  >
                    Vezi
                  </Link>
                </div>
                <div className="mt-4 space-y-2">
                  {urgentRequests.slice(0, 2).map((request) => (
                    <Link
                      key={request.id}
                      href={`/admin/requests/${request.id}`}
                      className="flex items-center gap-3 rounded-xl bg-card p-3 transition hover:bg-muted/50"
                    >
                      <span className="text-sm font-medium text-foreground">Ap. {request.apartment}</span>
                      <span className="flex-1 text-sm text-muted-foreground truncate">{request.subject}</span>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColors[request.status as keyof typeof statusColors]}`}>
                        {request.status === 'open' ? 'Deschis' : 'In lucru'}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="rounded-2xl border border-border bg-card shadow-premium">
              <div className="flex items-center justify-between border-b border-border p-5">
                <h2 className="text-lg font-semibold text-foreground">Activitate recenta</h2>
                <span className="text-sm text-muted-foreground">Astazi</span>
              </div>
              <div className="divide-y divide-border">
                {recentActivity.map((activity) => {
                  const Icon = activity.icon;
                  return (
                    <div key={activity.id} className="flex items-center gap-4 p-4">
                      <span className={`rounded-xl p-2.5 ${activity.color}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                      {activity.amount && (
                        <span className="text-sm font-semibold text-success">
                          +{activity.amount.toLocaleString('ro-RO')} MDL
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Payments */}
            <div className="rounded-2xl border border-border bg-card shadow-premium">
              <div className="flex items-center justify-between border-b border-border p-5">
                <h2 className="text-lg font-semibold text-foreground">Plati recente</h2>
                <Link href="/admin/finances" className="text-sm font-medium text-primary hover:underline">
                  Vezi toate
                </Link>
              </div>
              <div className="divide-y divide-border">
                {recentPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Ap. {payment.apartment} - {payment.owner}</p>
                      <p className="text-xs text-muted-foreground">{payment.date}</p>
                    </div>
                    <span className="text-sm font-semibold text-success">
                      +{payment.amount.toLocaleString('ro-RO')} MDL
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Announcements */}
            <div className="rounded-2xl border border-border bg-card shadow-premium">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-muted p-2 text-foreground">
                    <Megaphone className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-foreground">Anunturi</h3>
                </div>
                <Link
                  href="/admin/announcements/new"
                  className="rounded-lg bg-primary/10 p-1.5 text-primary transition hover:bg-primary/20"
                >
                  <Plus className="h-4 w-4" />
                </Link>
              </div>
              <div className="divide-y divide-border">
                {announcements.map((announcement) => (
                  <Link
                    key={announcement.id}
                    href={`/admin/announcements/${announcement.id}`}
                    className="block p-4 transition hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${announcement.category === 'URGENT' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                        {announcement.category}
                      </span>
                      <span className="text-xs text-muted-foreground">{announcement.views} vizualizari</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">{announcement.title}</p>
                    <p className="text-xs text-muted-foreground">{announcement.date}</p>
                  </Link>
                ))}
              </div>
              <div className="border-t border-border p-4">
                <Link
                  href="/admin/announcements"
                  className="block w-full rounded-xl border border-border bg-background px-4 py-2.5 text-center text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  Vezi toate anunturile
                </Link>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
              <h3 className="font-semibold text-foreground">Actiuni rapide</h3>
              <div className="mt-4 space-y-2">
                <Link
                  href="/admin/apartments"
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition hover:bg-muted"
                >
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Home className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">Apartamente</span>
                </Link>
                <Link
                  href="/admin/residents"
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition hover:bg-muted"
                >
                  <span className="rounded-lg bg-accent/10 p-2 text-accent">
                    <Users className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">Locatari</span>
                </Link>
                <Link
                  href="/admin/meters"
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition hover:bg-muted"
                >
                  <span className="rounded-lg bg-warning/10 p-2 text-warning">
                    <Gauge className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">Contoare</span>
                </Link>
                <Link
                  href="/admin/settings"
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition hover:bg-muted"
                >
                  <span className="rounded-lg bg-muted p-2 text-foreground">
                    <Settings className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">Setari asociatie</span>
                </Link>
              </div>
            </div>

            {/* Upcoming */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-muted p-2 text-foreground">
                  <Calendar className="h-5 w-5" />
                </span>
                <h3 className="font-semibold text-foreground">Calendar</h3>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-medium text-primary">5 Mai 2026</p>
                  <p className="mt-1 text-sm text-foreground">Termen citiri contoare</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-medium text-primary">10 Mai 2026</p>
                  <p className="mt-1 text-sm text-foreground">Sedinta asociatiei</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-medium text-primary">15 Mai 2026</p>
                  <p className="mt-1 text-sm text-foreground">Scadenta facturi</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
