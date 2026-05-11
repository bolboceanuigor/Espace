'use client';

import Link from 'next/link';
import {
  Building2,
  Users,
  FileText,
  CreditCard,
  CircleAlert,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Megaphone,
  ListChecks,
  Receipt,
} from 'lucide-react';
import {
  KpiCard,
  SectionCard,
  StatusBadge,
  Button,
} from '@/components/ui';

// Mock data for demo
const kpiData = {
  totalApartments: 48,
  totalResidents: 127,
  issuedInvoices: 48,
  outstandingBalance: 24850,
  collectedPayments: 156420,
  openRequests: 3,
};

const billingStatus = {
  month: 'Mai 2025',
  status: 'PENDING',
  nextAction: 'Rulează verificări',
  completedSteps: 2,
  totalSteps: 6,
};

const dataQualityIssues = [
  { id: '1', type: 'CRITICAL', message: 'Ap. 12 - Lipsește suprafața utilă', category: 'apartments' },
  { id: '2', type: 'WARNING', message: 'Ap. 7 - Contact principal nesetat', category: 'apartments' },
  { id: '3', type: 'WARNING', message: 'Contor apă rece - Index lipsă luna curentă', category: 'meters' },
];

const recentRequests = [
  { id: '1', title: 'Reparație țeavă apă caldă', apartment: 'Ap. 24', status: 'NEW', date: '10 Mai' },
  { id: '2', title: 'Interfon defect', apartment: 'Ap. 8', status: 'IN_PROGRESS', date: '8 Mai' },
  { id: '3', title: 'Scurgere apă subsol', apartment: 'Ap. 3', status: 'RESOLVED', date: '5 Mai' },
];

const recentPayments = [
  { id: '1', resident: 'Ion Popescu', apartment: 'Ap. 24', amount: 1250, date: '10 Mai' },
  { id: '2', resident: 'Maria Ionescu', apartment: 'Ap. 15', amount: 980, date: '9 Mai' },
  { id: '3', resident: 'Andrei Rusu', apartment: 'Ap. 7', amount: 1100, date: '8 Mai' },
];

const announcements = [
  { id: '1', title: 'Deconectare apă - 15 Mai', date: '10 Mai', status: 'ACTIVE' },
  { id: '2', title: 'Adunare generală - 20 Mai', date: '8 Mai', status: 'ACTIVE' },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header with org info */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bun venit! Iată o privire de ansamblu asupra asociației.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm">
            <ListChecks className="size-4" />
            Calitatea datelor
          </Button>
          <Button size="sm">
            <Receipt className="size-4" />
            Facturare lunară
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="Apartamente"
          value={kpiData.totalApartments}
          icon={<Building2 className="size-5" />}
        />
        <KpiCard
          title="Locatari"
          value={kpiData.totalResidents}
          icon={<Users className="size-5" />}
        />
        <KpiCard
          title="Facturi emise"
          value={kpiData.issuedInvoices}
          subtitle="Luna curentă"
          icon={<FileText className="size-5" />}
        />
        <KpiCard
          title="Sold restant"
          value={`${kpiData.outstandingBalance.toLocaleString('ro-MD')} MDL`}
          variant="warning"
          icon={<AlertTriangle className="size-5" />}
        />
        <KpiCard
          title="Plăți încasate"
          value={`${kpiData.collectedPayments.toLocaleString('ro-MD')} MDL`}
          subtitle="Luna curentă"
          variant="accent"
          icon={<CreditCard className="size-5" />}
        />
        <KpiCard
          title="Solicitări deschise"
          value={kpiData.openRequests}
          icon={<CircleAlert className="size-5" />}
        />
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - 2/3 width */}
        <div className="space-y-6 lg:col-span-2">
          {/* Billing Status Card */}
          <SectionCard
            title="Facturare lunară"
            description={`Perioada: ${billingStatus.month}`}
            actions={
              <Link href="/ro/admin/billing">
                <Button size="sm">{billingStatus.nextAction}</Button>
              </Link>
            }
          >
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progres</span>
                  <span className="font-medium text-foreground">
                    {billingStatus.completedSteps}/{billingStatus.totalSteps} pași completați
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${(billingStatus.completedSteps / billingStatus.totalSteps) * 100}%` }}
                  />
                </div>
              </div>
              <StatusBadge status={billingStatus.status} />
            </div>
          </SectionCard>

          {/* Data Quality Issues */}
          <SectionCard
            title="Probleme calitate date"
            description="Probleme care necesită atenție"
            actions={
              <Link
                href="/ro/admin/data-quality"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Vezi toate <ChevronRight className="size-4" />
              </Link>
            }
          >
            {dataQualityIssues.length > 0 ? (
              <div className="space-y-2">
                {dataQualityIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5"
                  >
                    <StatusBadge status={issue.type} size="sm" />
                    <span className="flex-1 text-sm text-foreground">{issue.message}</span>
                    <Button variant="ghost" size="sm">
                      Rezolvă
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nu există probleme de calitate a datelor.
              </p>
            )}
          </SectionCard>

          {/* Recent Requests */}
          <SectionCard
            title="Solicitări recente"
            actions={
              <Link
                href="/ro/admin/requests"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Vezi toate <ChevronRight className="size-4" />
              </Link>
            }
          >
            <div className="divide-y divide-border/50">
              {recentRequests.map((request) => (
                <div key={request.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{request.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.apartment} • {request.date}
                    </p>
                  </div>
                  <StatusBadge status={request.status} size="sm" />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Right column - 1/3 width */}
        <div className="space-y-6">
          {/* Next Action Card */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Receipt className="size-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">Următoarea acțiune</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Finalizează facturarea pentru Mai 2025. Rămân 4 pași.
                </p>
                <Link href="/ro/admin/billing">
                  <Button size="sm" className="mt-3">
                    Continuă facturarea <ArrowRight className="size-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Payments */}
          <SectionCard
            title="Plăți recente"
            actions={
              <Link
                href="/ro/admin/payments"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Vezi toate <ChevronRight className="size-4" />
              </Link>
            }
          >
            <div className="divide-y divide-border/50">
              {recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{payment.resident}</p>
                    <p className="text-xs text-muted-foreground">{payment.apartment}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">
                      +{payment.amount.toLocaleString('ro-MD')} MDL
                    </p>
                    <p className="text-xs text-muted-foreground">{payment.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Announcements */}
          <SectionCard
            title="Anunțuri"
            actions={
              <Link
                href="/ro/admin/announcements"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Vezi toate <ChevronRight className="size-4" />
              </Link>
            }
          >
            <div className="space-y-2">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
                >
                  <Megaphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{announcement.title}</p>
                    <p className="text-xs text-muted-foreground">{announcement.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
