'use client';

import Link from 'next/link';
import { Bell, CreditCard, Gauge, MessageCircle, Send, Wrench } from 'lucide-react';
import { Badge, Card, PageHeader } from '@/components/ui';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { residentAnnouncements, residentIssues, residentMeters, residentProfile } from '@/lib/resident-mvp-data';

const quickActions = [
  { label: 'Transmite citiri', icon: <Gauge className="h-5 w-5" />, href: '/resident/meters' },
  { label: 'Achită factura', icon: <CreditCard className="h-5 w-5" />, href: '/resident/payments' },
  { label: 'Trimite cerere', icon: <Wrench className="h-5 w-5" />, href: '/resident/issues/new' },
  { label: 'Scrie administratorului', icon: <MessageCircle className="h-5 w-5" />, href: '/resident/chat' },
];

export default function ResidentDashboardPage() {
  const latestAnnouncement = residentAnnouncements[0];
  const missingMeters = residentMeters.filter((meter) => meter.status === 'Lipsă citire');
  const activeIssues = residentIssues.filter((issue) => issue.status !== 'Rezolvată');

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Acasă" description="Tot ce contează pentru locuința ta, într-un singur loc." />

      <Card className="overflow-hidden p-0">
        <div className="bg-foreground p-5 text-background">
          <p className="text-sm opacity-75">{residentProfile.building}</p>
          <h1 className="mt-2 text-3xl font-semibold">{residentProfile.apartment}</h1>
          <p className="mt-1 text-sm opacity-75">{residentProfile.staircase}</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Info label="Sold curent" value={formatMdl(residentProfile.currentBalance)} danger />
          <Info label="Status" value={residentProfile.status} danger />
          <Info label="Următoarea scadență" value={residentProfile.nextDueDate} />
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Acțiuni rapide</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {quickActions.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/70 bg-muted/25 px-4 text-sm font-semibold text-foreground transition hover:bg-white"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-foreground text-background">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Ultimul anunț</h2>
            <Link href="/resident/announcements" className="text-xs font-semibold text-primary">Vezi tot</Link>
          </div>
          <div className="mt-4 rounded-2xl border border-border/70 bg-muted/25 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{latestAnnouncement.title}</p>
              <Badge variant={latestAnnouncement.category === 'Urgent' ? 'error' : 'warning'}>{latestAnnouncement.category}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{latestAnnouncement.content}</p>
            <p className="mt-2 text-xs text-muted-foreground">{latestAnnouncement.date}</p>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-foreground">Reminder citiri contoare</h2>
          <p className="mt-4 inline-flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/25 p-3 text-sm text-muted-foreground">
            <Bell className="mt-0.5 h-4 w-4" />
            Ai {missingMeters.length} citire lipsă pentru contorul de gaz.
          </p>
          <Link href="/resident/meters" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border/70 text-sm font-semibold">
            <Send className="h-4 w-4" />
            Transmite acum
          </Link>
        </Card>

        <Card>
          <h2 className="font-semibold text-foreground">Cereri active</h2>
          <div className="mt-4 space-y-2">
            {activeIssues.map((issue) => (
              <div key={issue.id} className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <Wrench className="h-4 w-4" />
                  {issue.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Status: {issue.status}</p>
              </div>
            ))}
          </div>
          <Link href="/resident/issues" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-border/70 text-sm font-semibold">Deschide cereri</Link>
        </Card>
      </section>
    </div>
  );
}

function Info({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/35 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold ${danger ? 'text-rose-600' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
