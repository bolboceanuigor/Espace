'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, Bell, Building2, CheckCircle2, CreditCard, FileText, Gauge, Megaphone, MessageCircle, PlusCircle, Users } from 'lucide-react';
import { ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { announcementsApi, apartmentsApi, financeApi, invoicesApi, issuesApi, metersApi, onboardingApi, paymentsApi, residentsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const fallbackRecentActivity = [
  'Citire apă rece adăugată pentru un apartament',
  'Factura lunii curente a fost marcată neachitată',
  'Un locatar a confirmat primirea notificării',
];

const fallbackUrgentRequests = [
  { title: 'Infiltrație la etaj superior', apartment: 'Apartament', status: 'Urgent' },
  { title: 'Lipsă apă caldă pe Scara 2', apartment: 'Scara 2', status: 'Nouă' },
  { title: 'Ușă intrare defectă', apartment: 'Bloc principal', status: 'În lucru' },
];

const fallbackLatestPayments = [
  { apartment: 'Apt. 18', payer: 'Ionescu Maria', amount: 1860, date: '29 Apr 2026' },
  { apartment: 'Apt. 72', payer: 'Ceban Andrei', amount: 920, date: '28 Apr 2026' },
  { apartment: 'Apt. 11', payer: 'Rusu Elena', amount: 1240, date: '27 Apr 2026' },
];

const fallbackAnnouncements = [
  'Lucrări de întreținere la lift pe 3 mai',
  'Program colectare deșeuri voluminoase',
  'Ședință APC - aprobarea bugetului lunar',
];

const currentAssociationIdentity = {
  shortName: 'A.P.C. A0123-0940',
  legalName: 'Asociația de Proprietari din Condominiu A0123-0940',
  code: 'A0123-0940',
  internalNumber: '0940',
};

type SetupStep = {
  key: string;
  title: string;
  completed: boolean;
  href: string;
  actionLabel: string;
};

export default function AdminPage() {
  const localizedPath = useLocalizedPath();
  const [source, setSource] = useState<'loading' | 'api' | 'fallback'>('loading');
  const [summary, setSummary] = useState({
    apartments: 0,
    totalDebt: 0,
    missingReadings: 0,
    openIssues: 0,
    unpaidInvoices: 0,
    residents: 0,
    totalIssued: 0,
    totalPaid: 0,
    overdueInvoices: 0,
    apartmentsWithDebt: 0,
    collectionRate: 0,
    currentMonthIssued: 0,
    currentMonthPaid: 0,
  });
  const [recentActivity, setRecentActivity] = useState<string[]>([]);
  const [urgentRequests, setUrgentRequests] = useState<typeof fallbackUrgentRequests>([]);
  const [latestPayments, setLatestPayments] = useState<typeof fallbackLatestPayments>([]);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [setup, setSetup] = useState<{
    steps: SetupStep[];
    progressDetails: { completed: number; total: number; percent: number; label: string };
    nextStep?: SetupStep;
  } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apartmentsApi.list(),
      invoicesApi.list().catch(() => ({ data: [] })),
      metersApi.list().catch(() => ({ data: [] })),
      issuesApi.list().catch(() => ({ data: [] })),
      residentsApi.list().catch(() => ({ data: [] })),
      paymentsApi.list().catch(() => ({ data: [] })),
      announcementsApi.list().catch(() => ({ data: [] })),
      financeApi.overview().catch(() => ({ data: null })),
      onboardingApi.adminGet().catch(() => ({ data: null })),
    ])
      .then(([apartmentsRes, invoicesRes, metersRes, issuesRes, residentsRes, paymentsRes, announcementsRes, financeRes, onboardingRes]) => {
        if (!active) return;
        const apartments = apartmentsRes.data || [];
        const invoices = invoicesRes.data || [];
        const meters = metersRes.data || [];
        const issues = issuesRes.data || [];
        const residents = residentsRes.data || [];
        const payments = paymentsRes.data || [];
        const apiAnnouncements = announcementsRes.data || [];
        const unpaidInvoices = invoices.filter((invoice: any) => ['UNPAID', 'OVERDUE', 'Neachitat', 'Întârziat'].includes(String(invoice.status)));
        const openIssues = issues.filter((issue: any) => !['RESOLVED', 'Rezolvată'].includes(String(issue.status)));

        setSummary({
          apartments: apartments.length,
          totalDebt: Number(financeRes.data?.totalDebt ?? unpaidInvoices.reduce((sum: number, invoice: any) => sum + Number(invoice.remainingDebt ?? invoice.finalAmount ?? invoice.amount ?? 0), 0)),
          missingReadings: meters.filter((meter: any) => String(meter.status).toUpperCase() === 'MISSING_READING').length,
          openIssues: openIssues.length,
          unpaidInvoices: Number(financeRes.data?.unpaidInvoices ?? unpaidInvoices.length),
          residents: residents.length,
          totalIssued: Number(financeRes.data?.totalIssued ?? invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.finalAmount ?? invoice.amount ?? 0), 0)),
          totalPaid: Number(financeRes.data?.totalPaid ?? payments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0)),
          overdueInvoices: Number(financeRes.data?.overdueInvoices ?? 0),
          apartmentsWithDebt: Number(financeRes.data?.apartmentsWithDebt ?? 0),
          collectionRate: Number(financeRes.data?.collectionRate ?? 0),
          currentMonthIssued: Number(financeRes.data?.currentMonthIssued ?? 0),
          currentMonthPaid: Number(financeRes.data?.currentMonthPaid ?? 0),
        });
        setUrgentRequests(
          openIssues.slice(0, 3).map((issue: any) => ({
            title: String(issue.title || 'Cerere'),
            apartment: issue.apartmentNumber ? `Apt. ${issue.apartmentNumber}` : 'Spațiu comun',
            status: String(issue.priority || issue.status || 'Nouă'),
          })),
        );
        setLatestPayments(
          payments.slice(0, 3).map((payment: any) => ({
            apartment: payment.apartmentNumber ? `Apt. ${payment.apartmentNumber}` : 'Apartament',
            payer: String(payment.method || 'Plată înregistrată'),
            amount: Number(payment.amount || 0),
            date: payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('ro-RO') : '-',
          })),
        );
        setAnnouncements(apiAnnouncements.slice(0, 3).map((item: any) => String(item.title || 'Anunț')));
        if (onboardingRes.data?.steps?.length) {
          setSetup({
            steps: onboardingRes.data.steps,
            progressDetails: onboardingRes.data.progressDetails,
            nextStep: onboardingRes.data.nextStep,
          });
        }
        setRecentActivity([
          `${apartments.length} apartamente în evidență`,
          `${unpaidInvoices.length} facturi neachitate`,
          `${openIssues.length} cereri deschise`,
        ]);
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setSummary({
          apartments: 142,
          totalDebt: 86450,
          missingReadings: 23,
          openIssues: 12,
          unpaidInvoices: 37,
          residents: 98,
          totalIssued: 218400,
          totalPaid: 131950,
          overdueInvoices: 37,
          apartmentsWithDebt: 37,
          collectionRate: 60,
          currentMonthIssued: 0,
          currentMonthPaid: 0,
        });
        setRecentActivity(fallbackRecentActivity);
        setUrgentRequests(fallbackUrgentRequests);
        setLatestPayments(fallbackLatestPayments);
        setAnnouncements(fallbackAnnouncements);
        setSetup(null);
        setSource('fallback');
      });
    return () => {
      active = false;
    };
  }, []);

  const summaryCards = [
    { label: 'Total apartamente', value: String(summary.apartments), description: 'Unități locative administrate', icon: <Building2 className="h-5 w-5" /> },
    { label: 'Datorii totale', value: formatMdl(summary.totalDebt), description: 'Sold total curent', icon: <CreditCard className="h-5 w-5" />, tone: 'danger' as const },
    { label: 'Citiri lipsă', value: String(summary.missingReadings), description: 'Contoare de verificat', icon: <Gauge className="h-5 w-5" />, tone: 'warning' as const },
    { label: 'Cereri deschise', value: String(summary.openIssues), description: 'În lucru sau noi', icon: <MessageCircle className="h-5 w-5" />, tone: 'warning' as const },
    { label: 'Facturi neachitate', value: String(summary.unpaidInvoices), description: 'Pentru luna curentă', icon: <FileText className="h-5 w-5" />, tone: 'danger' as const },
    { label: 'Locatari conectați', value: String(summary.residents), description: 'Persoane în evidență', icon: <Users className="h-5 w-5" />, tone: 'success' as const },
  ];
  const financeCards = [
    { label: 'Total emis', value: formatMdl(summary.totalIssued), description: 'Facturi create', icon: <FileText className="h-5 w-5" /> },
    { label: 'Total încasat', value: formatMdl(summary.totalPaid), description: 'Plăți confirmate', icon: <CreditCard className="h-5 w-5" />, tone: 'success' as const },
    { label: 'Apartamente cu datorii', value: String(summary.apartmentsWithDebt), description: `${summary.overdueInvoices} facturi întârziate`, icon: <AlertCircle className="h-5 w-5" />, tone: 'danger' as const },
    { label: 'Rată încasare', value: `${summary.collectionRate.toLocaleString('ro-RO')}%`, description: `${formatMdl(summary.currentMonthPaid)} luna curentă`, icon: <Gauge className="h-5 w-5" />, tone: 'warning' as const },
  ];

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Acasă"
        description="Vedere de ansamblu pentru administrarea A.P.C. curente."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
            </span>
            <ButtonLink href={localizedPath('/admin/announcements')} variant="secondary">Publică anunț</ButtonLink>
          </div>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Asociația curentă</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">{currentAssociationIdentity.shortName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{currentAssociationIdentity.legalName}</p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <span className="rounded-2xl border border-border/70 bg-muted/25 px-3 py-2 font-medium text-foreground">Cod APC: {currentAssociationIdentity.code}</span>
            <span className="rounded-2xl border border-border/70 bg-muted/25 px-3 py-2 font-medium text-foreground">Nr. intern: {currentAssociationIdentity.internalNumber}</span>
          </div>
        </div>
      </Card>

      {setup ? (
        <Card className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Configurare inițială</p>
              <p className="mt-1 text-sm text-muted-foreground">{setup.progressDetails.label}</p>
            </div>
            {setup.nextStep && !setup.nextStep.completed ? (
              <ButtonLink href={localizedPath(setup.nextStep.href)} variant="primary">
                {setup.nextStep.actionLabel}
              </ButtonLink>
            ) : null}
          </div>
          <div className="mt-4 h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${setup.progressDetails.percent}%` }} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {setup.steps.map((step) => (
              <Link
                key={step.key}
                href={localizedPath(step.href)}
                className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/25 px-3 py-2 text-sm hover:bg-muted/40"
              >
                <CheckCircle2 className={`h-4 w-4 ${step.completed ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                <span className={step.completed ? 'text-foreground' : 'text-muted-foreground'}>{step.title}</span>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {financeCards.map((card) => (
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
              <Link key={item.title} href={localizedPath('/admin/issues')} className="block rounded-2xl border border-border/60 bg-white px-3 py-2 text-sm hover:bg-muted/40">
                <span className="font-medium text-foreground">{item.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{item.apartment} · {item.status}</span>
              </Link>
            ))}
            {!urgentRequests.length ? <p className="text-sm text-muted-foreground">Nu există cereri urgente.</p> : null}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Ultimele plăți</p>
            <Link href={localizedPath('/admin/payments')} className="text-xs font-semibold text-primary">Vezi toate</Link>
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
            {!latestPayments.length ? <p className="text-sm text-muted-foreground">Nu există plăți încă.</p> : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Anunțuri recente</p>
            <Link href={localizedPath('/admin/announcements')} className="text-xs font-semibold text-primary">Avizier</Link>
          </div>
          <div className="mt-4 space-y-2">
            {announcements.map((title) => (
              <div key={title} className="rounded-2xl border border-border/60 bg-muted/35 px-3 py-2 text-sm text-foreground">
                {title}
              </div>
            ))}
            {!announcements.length ? <p className="text-sm text-muted-foreground">Nu există anunțuri încă. Publică primul anunț pe avizier.</p> : null}
          </div>
        </Card>
      </section>

      <Card>
        <p className="text-sm font-semibold text-foreground">Acțiuni rapide</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ButtonLink href={localizedPath('/admin/apartments')} variant="primary"><PlusCircle className="h-4 w-4" /> Adaugă apartament</ButtonLink>
          <ButtonLink href={localizedPath('/admin/residents')} variant="secondary"><Users className="h-4 w-4" /> Adaugă locatar</ButtonLink>
          <ButtonLink href={localizedPath('/admin/invoices')} variant="secondary"><FileText className="h-4 w-4" /> Emite facturi</ButtonLink>
          <ButtonLink href={localizedPath('/admin/announcements')} variant="secondary"><Megaphone className="h-4 w-4" /> Publică anunț</ButtonLink>
        </div>
      </Card>
    </div>
  );
}
