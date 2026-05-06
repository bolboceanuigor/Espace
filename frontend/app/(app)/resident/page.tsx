'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, CreditCard, Gauge, MessageCircle, Send, Wrench } from 'lucide-react';
import { Badge, Card, PageHeader } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import {
  normalizeResidentAnnouncement,
  normalizeResidentContext,
  normalizeResidentIssue,
  normalizeResidentMeter,
  residentAnnouncements,
  residentIssues,
  residentMeters,
  residentProfile,
} from '@/lib/resident-mvp-data';
import { useLocalizedPath } from '@/lib/use-localized-path';

const quickActions = [
  { label: 'Transmite citiri', icon: <Gauge className="h-5 w-5" />, href: '/resident/meters' },
  { label: 'Achită factura', icon: <CreditCard className="h-5 w-5" />, href: '/resident/payments' },
  { label: 'Trimite cerere', icon: <Wrench className="h-5 w-5" />, href: '/resident/issues/new' },
  { label: 'Scrie administratorului', icon: <MessageCircle className="h-5 w-5" />, href: '/resident/chat' },
];

export default function ResidentDashboardPage() {
  const localizedPath = useLocalizedPath();
  const [profile, setProfile] = useState(residentProfile);
  const [announcements, setAnnouncements] = useState(residentAnnouncements);
  const [meters, setMeters] = useState(residentMeters);
  const [issues, setIssues] = useState(residentIssues);
  const [source, setSource] = useState<'api' | 'mock'>('mock');
  const latestAnnouncement = announcements[0];
  const missingMeters = meters.filter((meter) => meter.status === 'Lipsă citire');
  const activeIssues = issues.filter((issue) => issue.status !== 'Rezolvată');

  useEffect(() => {
    let active = true;
    Promise.all([
      residentDemoApi.context(),
      residentDemoApi.announcements().catch(() => ({ data: [] })),
      residentDemoApi.meters().catch(() => ({ data: [] })),
      residentDemoApi.issues().catch(() => ({ data: [] })),
    ])
      .then(([contextRes, announcementsRes, metersRes, issuesRes]) => {
        if (!active) return;
        setProfile(normalizeResidentContext(contextRes.data));
        const apiAnnouncements = (announcementsRes.data || []).map(normalizeResidentAnnouncement);
        const apiMeters = (metersRes.data || []).map(normalizeResidentMeter);
        const apiIssues = (issuesRes.data || []).map(normalizeResidentIssue);
        setAnnouncements(apiAnnouncements);
        setMeters(apiMeters);
        setIssues(apiIssues);
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setProfile(residentProfile);
        setAnnouncements(residentAnnouncements);
        setMeters(residentMeters);
        setIssues(residentIssues);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Acasă"
        description="Tot ce contează pentru locuința ta, într-un singur loc."
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
          </span>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="bg-foreground p-5 text-background">
          <p className="text-sm opacity-75">{profile.building}</p>
          <h1 className="mt-2 text-3xl font-semibold">{profile.apartment}</h1>
          <p className="mt-1 text-sm opacity-75">{profile.staircase}</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Info label="Sold curent" value={formatMdl(profile.currentBalance)} danger={profile.currentBalance > 0} />
          <Info label="Status" value={profile.status} danger={profile.status !== 'Achitat'} />
          <Info label="Următoarea scadență" value={profile.nextDueDate} />
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Acțiuni rapide</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {quickActions.map((item) => (
            <Link
              key={item.label}
              href={localizedPath(item.href)}
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
            <Link href={localizedPath('/resident/announcements')} className="text-xs font-semibold text-primary">Vezi tot</Link>
          </div>
          <div className="mt-4 rounded-2xl border border-border/70 bg-muted/25 p-3">
            {latestAnnouncement ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{latestAnnouncement.title}</p>
                  <Badge variant={latestAnnouncement.category === 'Urgent' ? 'error' : 'warning'}>{latestAnnouncement.category}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{latestAnnouncement.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">{latestAnnouncement.date}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nu există anunțuri încă.</p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-foreground">Reminder citiri contoare</h2>
          <p className="mt-4 inline-flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/25 p-3 text-sm text-muted-foreground">
            <Bell className="mt-0.5 h-4 w-4" />
            Ai {missingMeters.length} citiri lipsă.
          </p>
          <Link href={localizedPath('/resident/meters')} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border/70 text-sm font-semibold">
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
            {!activeIssues.length ? <p className="text-sm text-muted-foreground">Nu există cereri active.</p> : null}
          </div>
          <Link href={localizedPath('/resident/issues')} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-border/70 text-sm font-semibold">Deschide cereri</Link>
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
