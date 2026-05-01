'use client';

import Link from 'next/link';
import {
  Home,
  CreditCard,
  Gauge,
  MessageSquare,
  Megaphone,
  User,
  ArrowRight,
  AlertCircle,
  Bell,
  Clock,
} from 'lucide-react';

// Mock data for resident home
const residentData = {
  apartment: {
    number: '45',
    building: 'APC Alba Iulia 75',
    staircase: 2,
    floor: 6,
  },
  balance: 1240,
  nextPaymentDue: '15 Mai 2026',
  meterReminder: true,
  openRequests: 1,
  unreadMessages: 2,
};

const latestAnnouncement = {
  id: '1',
  title: 'Intrerupere apa calda',
  preview: 'Atentie! In data de 5 mai, intre orele 9:00-17:00, va fi intrerupta apa calda pentru lucrari de mentenanta.',
  date: '30 Apr 2026',
  category: 'URGENT',
};

const quickActions = [
  { icon: Gauge, label: 'Transmite citiri', href: '/resident/meters', color: 'bg-primary/10 text-primary' },
  { icon: CreditCard, label: 'Achita factura', href: '/resident/payments/new', color: 'bg-success/10 text-success' },
  { icon: MessageSquare, label: 'Trimite cerere', href: '/resident/requests/new', color: 'bg-warning/10 text-warning' },
  { icon: User, label: 'Scrie adminului', href: '/resident/chat', color: 'bg-muted text-foreground' },
];

export default function ResidentHomePage() {
  return (
    <div className="space-y-5 pb-24">
      {/* Welcome Section */}
      <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-premium">
        <p className="inline-flex rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
          Acasa
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          Bine ai venit!
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apartament {residentData.apartment.number} - {residentData.apartment.building}
        </p>
      </section>

      {/* Balance Card */}
      <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-premium">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Sold curent</p>
            <p className={`mt-1 text-3xl font-bold ${residentData.balance > 0 ? 'text-destructive' : 'text-success'}`}>
              {residentData.balance.toLocaleString('ro-RO')} MDL
            </p>
            {residentData.balance > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Scadent: {residentData.nextPaymentDue}
              </p>
            )}
          </div>
          <Link
            href="/resident/payments/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90"
          >
            Achita
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Alerts */}
      {(residentData.meterReminder || residentData.openRequests > 0) && (
        <section className="space-y-3">
          {residentData.meterReminder && (
            <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
              <span className="rounded-xl bg-warning/20 p-2 text-warning">
                <Gauge className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Transmite citirile contoarelor</p>
                <p className="text-xs text-muted-foreground">Termen: pana la 5 Mai 2026</p>
              </div>
              <Link href="/resident/meters" className="text-sm font-medium text-primary hover:underline">
                Transmite
              </Link>
            </div>
          )}
          {residentData.openRequests > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <span className="rounded-xl bg-primary/10 p-2 text-primary">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Ai {residentData.openRequests} cerere deschisa</p>
                <p className="text-xs text-muted-foreground">In asteptare raspuns</p>
              </div>
              <Link href="/resident/requests" className="text-sm font-medium text-primary hover:underline">
                Vezi
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Quick Actions */}
      <section className="grid grid-cols-2 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 text-center shadow-premium transition hover:border-primary/30 hover:shadow-premium-md"
            >
              <span className={`rounded-2xl p-3 ${action.color}`}>
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-sm font-medium text-foreground">{action.label}</span>
            </Link>
          );
        })}
      </section>

      {/* Latest Announcement */}
      {latestAnnouncement && (
        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-premium">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-muted p-2 text-foreground">
                <Megaphone className="h-5 w-5" />
              </span>
              <h2 className="text-base font-semibold text-foreground">Ultimul anunt</h2>
            </div>
            <Link href="/resident/announcements" className="text-sm font-medium text-primary hover:underline">
              Vezi toate
            </Link>
          </div>
          <Link
            href={`/resident/announcements/${latestAnnouncement.id}`}
            className="mt-4 block rounded-xl border border-border bg-background p-4 transition hover:border-primary/30"
          >
            <div className="flex items-center gap-2">
              {latestAnnouncement.category === 'URGENT' && (
                <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  URGENT
                </span>
              )}
              <span className="text-xs text-muted-foreground">{latestAnnouncement.date}</span>
            </div>
            <p className="mt-2 font-medium text-foreground">{latestAnnouncement.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{latestAnnouncement.preview}</p>
          </Link>
        </section>
      )}

      {/* Notifications */}
      {residentData.unreadMessages > 0 && (
        <Link
          href="/resident/chat"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-premium transition hover:border-primary/30"
        >
          <span className="relative rounded-xl bg-primary/10 p-2.5 text-primary">
            <Bell className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
              {residentData.unreadMessages}
            </span>
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Mesaje noi</p>
            <p className="text-xs text-muted-foreground">Ai {residentData.unreadMessages} mesaje necitite</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}
