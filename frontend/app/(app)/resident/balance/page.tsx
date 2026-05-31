'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Building2, CalendarClock, CheckCircle2, Clock3, FileText, MessageCircle, ReceiptText, RefreshCw, WalletCards } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { residentBalanceApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type BalanceOverview = {
  currency: string;
  apartmentsCount: number;
  totalInvoicedAmount: number;
  totalPaidAmount: number;
  totalUnpaidAmount: number;
  totalOverdueAmount: number;
  unpaidInvoicesCount: number;
  overdueInvoicesCount: number;
  paidInvoicesCount: number;
  partiallyPaidInvoicesCount: number;
  pendingPaymentProofsCount: number;
  rejectedPaymentProofsCount: number;
  nextDueInvoice?: any | null;
  lastPayment?: any | null;
  lastPublishedInvoice?: any | null;
};

type ApartmentBalance = {
  apartmentId: string;
  apartmentNumber: string;
  buildingName?: string | null;
  entranceName?: string | null;
  totalInvoicedAmount: number;
  totalPaidAmount: number;
  totalUnpaidAmount: number;
  overdueAmount: number;
  unpaidInvoicesCount: number;
  overdueInvoicesCount: number;
  status: 'CLEAR' | 'UNPAID' | 'PARTIALLY_PAID' | 'OVERDUE';
  lastInvoice?: any | null;
  lastPayment?: any | null;
};

type TimelineEntry = {
  id: string;
  date: string;
  type: string;
  title: string;
  description?: string | null;
  amount?: number | null;
  currency?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  paymentProofId?: string | null;
  apartment?: { apartmentNumber?: string; number?: string; staircase?: { name?: string } | null } | null;
  status?: string | null;
};

type Issue = {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  amount?: number;
  invoice?: any;
  payment?: any;
  apartment?: any;
  recommendation?: string;
};

const emptyOverview: BalanceOverview = {
  currency: 'MDL',
  apartmentsCount: 0,
  totalInvoicedAmount: 0,
  totalPaidAmount: 0,
  totalUnpaidAmount: 0,
  totalOverdueAmount: 0,
  unpaidInvoicesCount: 0,
  overdueInvoicesCount: 0,
  paidInvoicesCount: 0,
  partiallyPaidInvoicesCount: 0,
  pendingPaymentProofsCount: 0,
  rejectedPaymentProofsCount: 0,
  nextDueInvoice: null,
  lastPayment: null,
  lastPublishedInvoice: null,
};

const apartmentStatusLabels = {
  CLEAR: 'La zi',
  UNPAID: 'Neachitat',
  PARTIALLY_PAID: 'Parțial',
  OVERDUE: 'Restant',
};

const issueLabels: Record<string, string> = {
  OVERDUE_INVOICE: 'Factură restantă',
  UNPAID_INVOICE: 'Factură neachitată',
  PARTIALLY_PAID_INVOICE: 'Factură parțial achitată',
  PAYMENT_PROOF_PENDING: 'Dovadă în verificare',
  PAYMENT_PROOF_REJECTED: 'Dovadă respinsă',
  PAYMENT_REVERSED: 'Plată inversată',
};

export default function ResidentBalancePage() {
  const localizedPath = useLocalizedPath();
  const [overview, setOverview] = useState<BalanceOverview>(emptyOverview);
  const [apartments, setApartments] = useState<ApartmentBalance[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, apartmentsRes, timelineRes, issuesRes] = await Promise.all([
        residentBalanceApi.getResidentBalanceOverview(),
        residentBalanceApi.getResidentApartmentBalances(),
        residentBalanceApi.getResidentFinancialTimeline({ limit: 8 }),
        residentBalanceApi.getResidentBalanceIssues(),
      ]);
      setOverview(overviewRes.data || emptyOverview);
      setApartments(apartmentsRes.data?.items || []);
      setTimeline(timelineRes.data?.items || []);
      setIssues(issuesRes.data?.issues || []);
    } catch (err: any) {
      setOverview(emptyOverview);
      setApartments([]);
      setTimeline([]);
      setIssues([]);
      setError(String(err?.message || 'Nu am putut încărca soldul.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hasInvoices = overview.totalInvoicedAmount > 0 || overview.unpaidInvoicesCount > 0 || overview.paidInvoicesCount > 0;
  const mainTone = overview.totalOverdueAmount > 0 ? 'warning' : overview.totalUnpaidAmount > 0 ? 'neutral' : 'success';
  const nextDueLabel = overview.nextDueInvoice?.dueDate ? formatDate(overview.nextDueInvoice.dueDate) : '-';

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Soldul meu"
        description="Vezi facturile, plățile și restanțele pentru apartamentul tău."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <ButtonLink href="/resident/payments" variant="secondary">Istoric plăți</ButtonLink>
          </div>
        }
      />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Total de achitat" value={formatMdl(overview.totalUnpaidAmount)} description="Facturi publicate neînchise" icon={<WalletCards className="h-5 w-5" />} tone={mainTone} />
        <StatCard label="Restanțe" value={formatMdl(overview.totalOverdueAmount)} description={`${overview.overdueInvoicesCount} facturi restante`} icon={<AlertTriangle className="h-5 w-5" />} tone={overview.totalOverdueAmount > 0 ? 'warning' : 'success'} />
        <StatCard label="Facturi neachitate" value={overview.unpaidInvoicesCount} description={`${overview.partiallyPaidInvoicesCount} parțial achitate`} icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Dovezi în verificare" value={overview.pendingPaymentProofsCount} description={overview.rejectedPaymentProofsCount ? `${overview.rejectedPaymentProofsCount} respinse` : 'Fără dovezi respinse'} icon={<Clock3 className="h-5 w-5" />} tone={overview.rejectedPaymentProofsCount > 0 ? 'warning' : 'neutral'} />
        <StatCard label="Ultima plată" value={overview.lastPayment ? formatMdl(overview.lastPayment.amount || 0) : '-'} description={formatDate(overview.lastPayment?.acceptedAt || overview.lastPayment?.paidAt)} icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Următoarea scadență" value={nextDueLabel} description={overview.nextDueInvoice?.invoiceNumber || 'Nicio scadență'} icon={<CalendarClock className="h-5 w-5" />} />
      </section>

      <Card className={overview.totalUnpaidAmount > 0 ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60'}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge variant={overview.totalUnpaidAmount > 0 ? 'warning' : 'success'}>{overview.totalUnpaidAmount > 0 ? 'Sold deschis' : 'La zi'}</Badge>
            <h2 className="mt-3 text-2xl font-semibold text-foreground">{overview.totalUnpaidAmount > 0 ? formatMdl(overview.totalUnpaidAmount) : 'Ești la zi.'}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {overview.totalUnpaidAmount > 0
                ? 'Ai facturi neachitate. Consultă detaliile și trimite dovada plății din fluxul disponibil pentru factură.'
                : 'Nu ai datorii active în acest moment.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/resident/invoices">Vezi facturile</ButtonLink>
            <ButtonLink href="/resident/payments" variant="secondary">Vezi plățile</ButtonLink>
            <ButtonLink href="/resident/connect?new=1&type=PAYMENT&subject=%C3%8Entrebare%20despre%20sold" variant="secondary">
              <MessageCircle className="h-4 w-4" />
              Întreabă despre sold
            </ButtonLink>
          </div>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Apartamentele mele</h2>
              <p className="mt-1 text-sm text-muted-foreground">Soldul este calculat din facturi publicate și plăți manuale acceptate.</p>
            </div>
            <Badge variant="neutral">{overview.apartmentsCount} apartamente</Badge>
          </div>

          {loading ? <div className="mt-4 h-32 animate-pulse rounded-2xl bg-muted/50" /> : null}

          {!loading && !apartments.length ? (
            <EmptyState icon={<Building2 className="h-5 w-5" />} title={hasInvoices ? 'Nu există apartamente asociate' : 'Nu există facturi publicate încă'} text={hasInvoices ? 'Contactează administrația pentru legarea contului.' : 'Când administrația publică o factură, soldul va apărea aici.'} />
          ) : null}

          <div className="mt-4 grid gap-3">
            {apartments.map((apartment) => (
              <div key={apartment.apartmentId} className="rounded-2xl border border-border/70 bg-background p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">Apartament {apartment.apartmentNumber}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{[apartment.buildingName, apartment.entranceName].filter(Boolean).join(' · ') || 'Bloc/scară necompletate'}</p>
                  </div>
                  <Badge variant={apartment.status === 'CLEAR' ? 'success' : apartment.status === 'OVERDUE' ? 'warning' : 'neutral'}>{apartmentStatusLabels[apartment.status]}</Badge>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Info label="Sold" value={formatMdl(apartment.totalUnpaidAmount)} strong={apartment.totalUnpaidAmount > 0} />
                  <Info label="Restanțe" value={formatMdl(apartment.overdueAmount)} />
                  <Info label="Facturat" value={formatMdl(apartment.totalInvoicedAmount)} />
                  <Info label="Achitat" value={formatMdl(apartment.totalPaidAmount)} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink href={`/resident/invoices?apartmentId=${apartment.apartmentId}`} variant="secondary">Facturi</ButtonLink>
                  <ButtonLink href={`/resident/payments?apartmentId=${apartment.apartmentId}`} variant="secondary">Plăți</ButtonLink>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-foreground">Probleme / Acțiuni necesare</h2>
          <p className="mt-1 text-sm text-muted-foreground">Elemente care pot necesita atenția ta sau verificarea administrației.</p>
          <div className="mt-4 space-y-3">
            {loading ? <div className="h-28 animate-pulse rounded-2xl bg-muted/50" /> : null}
            {!loading && !issues.length ? (
              <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="Nu există acțiuni necesare" text="Nu sunt detectate restanțe sau dovezi respinse în acest moment." />
            ) : null}
            {issues.map((issue) => (
              <div key={issue.id} className="rounded-2xl border border-border/70 bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{issueLabels[issue.type] || issue.type}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{issue.recommendation || 'Verifică detaliile.'}</p>
                  </div>
                  <Badge variant={issue.severity === 'WARNING' ? 'warning' : 'neutral'}>{issue.severity === 'WARNING' ? 'Atenție' : 'Info'}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {issue.amount ? <span className="font-semibold text-foreground">{formatMdl(issue.amount)}</span> : null}
                  {issue.invoice?.id ? <Link className="font-semibold text-foreground underline-offset-4 hover:underline" href={localizedPath(`/resident/invoices/${issue.invoice.id}`)}>Vezi factura</Link> : null}
                  {issue.payment?.id ? <Link className="font-semibold text-foreground underline-offset-4 hover:underline" href={localizedPath(`/resident/payments/${issue.payment.id}`)}>Vezi plata</Link> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Istoric financiar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Facturi publicate, plăți acceptate și dovezi trimise.</p>
          </div>
          <ButtonLink href="/resident/payments" variant="secondary">
            Istoric complet
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
        <div className="mt-4 space-y-3">
          {loading ? <div className="h-28 animate-pulse rounded-2xl bg-muted/50" /> : null}
          {!loading && !timeline.length ? <EmptyState icon={<ReceiptText className="h-5 w-5" />} title="Nu există activitate financiară încă" text="Istoricul va apărea după publicarea facturilor sau înregistrarea plăților." /> : null}
          {timeline.map((entry) => (
            <div key={entry.id} className="flex gap-3 rounded-2xl border border-border/70 bg-background p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                {entry.type.includes('PAYMENT') ? <ReceiptText className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{entry.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{entry.description || '-'}</p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">{formatDate(entry.date)}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {typeof entry.amount === 'number' ? <Badge variant="neutral">{formatMdl(entry.amount)}</Badge> : null}
                  {entry.invoiceId ? <Link href={localizedPath(`/resident/invoices/${entry.invoiceId}`)} className="font-semibold text-foreground underline-offset-4 hover:underline">Factură</Link> : null}
                  {entry.paymentId ? <Link href={localizedPath(`/resident/payments/${entry.paymentId}`)} className="font-semibold text-foreground underline-offset-4 hover:underline">Plată</Link> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-muted-foreground">{icon}</div>
      <h3 className="mt-3 font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/35 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 break-words ${strong ? 'text-lg font-semibold' : 'font-medium'} text-foreground`}>{value}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
