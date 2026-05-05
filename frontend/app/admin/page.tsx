'use client';

import Link from 'next/link';
import { AlertCircle, Bell, Building2, CreditCard, FileText, Gauge, Megaphone, MessageCircle, PlusCircle, Users } from 'lucide-react';
import { ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { formatMdl } from '@/lib/condo-admin-fallback';

const BUILDING_NAME = 'APC Alba Iulia 75';

const summaryCards = [
  { label: 'Total apartamente', value: '142', description: 'Unități locative administrate', icon: <Building2 className="h-5 w-5" /> },
  { label: 'Datorii totale', value: formatMdl(86450), description: 'Sold total curent', icon: <CreditCard className="h-5 w-5" />, tone: 'danger' as const },
  { label: 'Citiri lipsă', value: '23', description: 'Contoare de verificat', icon: <Gauge className="h-5 w-5" />, tone: 'warning' as const },
  { label: 'Cereri deschise', value: '12', description: 'În lucru sau noi', icon: <MessageCircle className="h-5 w-5" />, tone: 'warning' as const },
  { label: 'Facturi neachitate', value: '37', description: 'Pentru luna curentă', icon: <FileText className="h-5 w-5" />, tone: 'danger' as const },
  { label: 'Locatari conectați', value: '98', description: 'Conturi active în aplicație', icon: <Users className="h-5 w-5" />, tone: 'success' as const },
];

const recentActivity = [
  'Citire apă rece adăugată pentru Apt. 45',
  'Factura lunii Aprilie a fost marcată neachitată pentru Apt. 31',
  'Popescu Ion a confirmat primirea notificării',
];

const urgentRequests = [
  { title: 'Infiltrație la etajul 6', apartment: 'Apt. 45', status: 'Urgent' },
  { title: 'Lipsă apă caldă pe Scara 2', apartment: 'Scara 2', status: 'Nouă' },
  { title: 'Ușă intrare defectă', apartment: 'Bloc principal', status: 'În lucru' },
];

const latestPayments = [
  { apartment: 'Apt. 18', payer: 'Ionescu Maria', amount: 1860, date: '29 Apr 2026' },
  { apartment: 'Apt. 72', payer: 'Ceban Andrei', amount: 920, date: '28 Apr 2026' },
  { apartment: 'Apt. 11', payer: 'Rusu Elena', amount: 1240, date: '27 Apr 2026' },
];

const announcements = [
  'Lucrări de întreținere la lift pe 3 mai',
  'Program colectare deșeuri voluminoase',
  'Ședință APC - aprobarea bugetului lunar',
];

export default function AdminPage() {
  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Acasă"
        description={`${BUILDING_NAME} - vedere de ansamblu pentru administrarea blocului.`}
        rightSlot={<ButtonLink href="/admin/announcements" variant="secondary">Publică anunț</ButtonLink>}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Activitate recentă</p>
              <p className="text-sm text-muted-foreground">Ultimele evenimente administrative</p>
            </div>
            <Bell className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-4 space-y-2">
            {recentActivity.map((item) => (
              <div key={item} className="rounded-2xl border border-border/60 bg-muted/35 px-3 py-2 text-sm text-foreground">
                {item}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Cereri urgente</p>
              <p className="text-sm text-muted-foreground">Necesită atenție rapidă</p>
            </div>
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4 space-y-2">
            {urgentRequests.map((item) => (
              <Link key={item.title} href="/admin/issues" className="block rounded-2xl border border-border/60 bg-white px-3 py-2 text-sm hover:bg-muted/40">
                <span className="font-medium text-foreground">{item.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{item.apartment} · {item.status}</span>
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Ultimele plăți</p>
            <Link href="/admin/payments" className="text-xs font-semibold text-primary">Vezi toate</Link>
          </div>
          <div className="mt-4 space-y-2">
            {latestPayments.map((payment) => (
              <div key={`${payment.apartment}-${payment.date}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/35 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{payment.apartment}</p>
                  <p className="text-xs text-muted-foreground">{payment.payer} · {payment.date}</p>
                </div>
                <p className="text-sm font-semibold text-foreground">{formatMdl(payment.amount)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Anunțuri recente</p>
            <Link href="/admin/announcements" className="text-xs font-semibold text-primary">Avizier</Link>
          </div>
          <div className="mt-4 space-y-2">
            {announcements.map((title) => (
              <div key={title} className="rounded-2xl border border-border/60 bg-muted/35 px-3 py-2 text-sm text-foreground">
                {title}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card>
        <p className="text-sm font-semibold text-foreground">Acțiuni rapide</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ButtonLink href="/admin/apartments" variant="primary"><PlusCircle className="h-4 w-4" /> Adaugă apartament</ButtonLink>
          <ButtonLink href="/admin/residents" variant="secondary"><Users className="h-4 w-4" /> Adaugă locatar</ButtonLink>
          <ButtonLink href="/admin/invoices" variant="secondary"><FileText className="h-4 w-4" /> Emite facturi</ButtonLink>
          <ButtonLink href="/admin/announcements" variant="secondary"><Megaphone className="h-4 w-4" /> Publică anunț</ButtonLink>
        </div>
      </Card>
    </div>
  );
}
