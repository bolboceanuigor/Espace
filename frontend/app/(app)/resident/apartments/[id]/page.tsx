'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, Building2, CheckCircle2, FileText, MessageCircle, ReceiptText, Users, Wallet } from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { requestsApi, residentDemoApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'VOID';
type PaymentStatus = 'CONFIRMED' | 'CANCELLED';

type ApartmentProfile = {
  apartment: {
    id: string;
    apartmentNumber: string;
    building?: string | null;
    staircase?: string | null;
    floor?: string | null;
    areaM2?: number | null;
    cadastralNumber?: string | null;
    status?: string | null;
    updatedAt?: string | null;
  };
  association: {
    id: string | null;
    legalName: string;
    shortName: string;
    associationCode?: string | null;
    address?: string | null;
  };
  myRelation: {
    role: string;
    isPrimaryContact: boolean;
    preferredContactMethod?: string | null;
    status?: string | null;
    relationStartDate?: string | null;
  };
  relatedResidents: Array<{
    id: string;
    fullName: string;
    role: string;
    isPrimaryContact: boolean;
    isCurrentUser: boolean;
    phone?: string | null;
    email?: string | null;
  }>;
  financialSummary: {
    currency: 'MDL';
    currentBalance: number;
    totalInvoices: number;
    unpaidInvoices: number;
    paidInvoices: number;
    overdueInvoices: number;
    totalPaidAmount: number;
    lastInvoice?: {
      id: string;
      invoiceNumber: string;
      billingMonth: string;
      totalAmount: number;
      balanceAmount: number;
      status: InvoiceStatus;
      dueDate?: string | null;
    } | null;
    lastPayment?: {
      id: string;
      amount: number;
      paymentDate?: string | null;
      method: string;
      status: PaymentStatus;
    } | null;
  };
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    billingMonth: string;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    status: InvoiceStatus;
    dueDate?: string | null;
    isOverdue?: boolean;
  }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    currency: 'MDL';
    paymentDate?: string | null;
    method: string;
    status: PaymentStatus;
    referenceNumber?: string | null;
    invoiceNumber?: string | null;
    invoiceId?: string | null;
  }>;
  alerts: Array<{
    type: string;
    severity: 'INFO' | 'WARNING';
    title: string;
    message: string;
  }>;
};

type RecentRequest = {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  priority: string;
  updatedAt?: string | null;
  createdAt?: string | null;
};

const roleLabels: Record<string, string> = {
  OWNER: 'Proprietar',
  TENANT: 'Chiriaș',
  RESIDENT: 'Locatar',
  REPRESENTATIVE: 'Reprezentant',
  FAMILY_MEMBER: 'Membru familie',
};

const contactMethodLabels: Record<string, string> = {
  PHONE: 'Telefon',
  EMAIL: 'Email',
  APP: 'Aplicație',
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
};

const relationStatusLabels: Record<string, string> = {
  ACTIVE: 'Activ',
  INVITED: 'Invitat',
  NOT_INVITED: 'Neinvitat',
  INACTIVE: 'Inactiv',
};

const apartmentStatusLabels: Record<string, string> = {
  OCCUPIED: 'Ocupat',
  VACANT: 'Liber',
  UNKNOWN: 'Necunoscut',
};

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  ISSUED: 'Emisă',
  PARTIALLY_PAID: 'Parțial achitată',
  PAID: 'Achitată',
  CANCELLED: 'Anulată',
  VOID: 'Void',
};

const requestStatusLabels: Record<string, string> = {
  NEW: 'Nouă',
  IN_REVIEW: 'În verificare',
  IN_PROGRESS: 'În lucru',
  WAITING_FOR_RESIDENT: 'Așteaptă răspunsul tău',
  RESOLVED: 'Rezolvată',
  CLOSED: 'Închisă',
  CANCELLED: 'Anulată',
};

const paymentMethodLabels: Record<string, string> = {
  CASH: 'Numerar',
  BANK_TRANSFER: 'Transfer bancar',
  CARD_TERMINAL: 'Terminal card',
  INFOCOM: 'InfoCom',
  OPLATA: 'Oplata',
  OTHER: 'Altă metodă',
};

function formatDate(value?: string | null) {
  if (!value) return 'Necompletat';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Necompletat';
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' });
}

function monthLabel(value?: string | null) {
  if (!value) return 'Necompletat';
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Date(year, month - 1, 1).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
}

function labelFromMap(map: Record<string, string>, value?: string | null, fallback = 'Necompletat') {
  if (!value) return fallback;
  return map[String(value).toUpperCase()] || value;
}

function optionalValue(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return 'Necompletat';
  return String(value);
}

export default function ResidentApartmentDetailsPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const apartmentId = String(params?.id || '');
  const [data, setData] = useState<ApartmentProfile | null>(null);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    residentDemoApi
      .apartment(apartmentId)
      .then((response) => {
        if (!active) return;
        setData(response.data || null);
      })
      .catch((err: any) => {
        if (!active) return;
        setData(null);
        setError(String(err?.message || 'Nu am putut încărca apartamentul.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apartmentId]);

  useEffect(() => {
    let active = true;
    requestsApi
      .residentList({ apartmentId, limit: 3, sortBy: 'updatedAt' })
      .then((response) => {
        if (!active) return;
        setRecentRequests(response.data?.items || []);
      })
      .catch(() => {
        if (!active) return;
        setRecentRequests([]);
      });
    return () => {
      active = false;
    };
  }, [apartmentId]);

  if (!loading && !data) {
    return (
      <div className="space-y-5 pb-24 md:pb-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Apartamentul nu a fost găsit</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Apartamentul nu a fost găsit sau nu aparține contului tău.
          </p>
          {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          <ButtonLink href="/resident/apartments" className="mt-5">Înapoi la apartamente</ButtonLink>
        </Card>
      </div>
    );
  }

  const apartment = data?.apartment;
  const summary = data?.financialSummary;

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      <Link href={localizedPath('/resident/apartments')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la apartamente
      </Link>

      <PageHeader
        title={apartment ? `Apartament ${apartment.apartmentNumber}` : 'Apartament'}
        description="Informații generale și situația financiară a apartamentului."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            {data?.association.shortName ? <Badge variant="neutral">{data.association.shortName}</Badge> : null}
            {data?.association.associationCode ? <Badge variant="neutral">{data.association.associationCode}</Badge> : null}
            {data?.myRelation.role ? <Badge variant="neutral">{labelFromMap(roleLabels, data.myRelation.role)}</Badge> : null}
            {data?.myRelation.isPrimaryContact ? <Badge variant="success">Contact principal</Badge> : null}
          </div>
        }
      />

      {loading ? <Card className="h-28 animate-pulse bg-muted/40" /> : null}

      {data && apartment && summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Sold curent" value={formatMdl(summary.currentBalance)} description="Facturi active" icon={<Wallet className="h-5 w-5" />} tone={summary.currentBalance > 0 ? 'warning' : 'success'} />
            <StatCard label="Total facturi" value={String(summary.totalInvoices)} description={`${summary.unpaidInvoices} neachitate`} icon={<FileText className="h-5 w-5" />} />
            <StatCard label="Total achitat" value={formatMdl(summary.totalPaidAmount)} description="Plăți confirmate" icon={<ReceiptText className="h-5 w-5" />} tone="success" />
            <StatCard label="Întârziate" value={String(summary.overdueInvoices)} description="Scadență depășită" icon={<AlertCircle className="h-5 w-5" />} tone={summary.overdueInvoices > 0 ? 'warning' : 'success'} />
            <StatCard label="Facturi achitate" value={String(summary.paidInvoices)} description="Fără sold" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
            <StatCard label="Ultima factură" value={summary.lastInvoice ? monthLabel(summary.lastInvoice.billingMonth) : 'Necompletat'} description={summary.lastInvoice?.invoiceNumber || 'Nicio factură'} icon={<FileText className="h-5 w-5" />} />
            <StatCard label="Ultima plată" value={summary.lastPayment ? formatMdl(summary.lastPayment.amount) : 'Necompletat'} description={formatDate(summary.lastPayment?.paymentDate)} icon={<ReceiptText className="h-5 w-5" />} />
            <StatCard label="Rolul meu" value={labelFromMap(roleLabels, data.myRelation.role)} description={data.myRelation.isPrimaryContact ? 'Contact principal' : 'Contact secundar'} icon={<Users className="h-5 w-5" />} />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Building2 className="h-4 w-4" />
                Date apartament
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Info label="Număr apartament" value={apartment.apartmentNumber} strong />
                <Info label="Bloc/corp" value={optionalValue(apartment.building)} />
                <Info label="Scară" value={optionalValue(apartment.staircase)} />
                <Info label="Etaj" value={optionalValue(apartment.floor)} />
                <Info label="Suprafață" value={apartment.areaM2 ? `${apartment.areaM2} m²` : 'Necompletat'} />
                <Info label="Număr cadastral" value={optionalValue(apartment.cadastralNumber)} />
                <Info label="Status apartament" value={labelFromMap(apartmentStatusLabels, apartment.status)} />
                <Info label="Ultima actualizare" value={formatDate(apartment.updatedAt)} />
              </div>
            </Card>

            <Card>
              <h2 className="text-base font-semibold text-foreground">Rolul meu</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Info label="Rol" value={labelFromMap(roleLabels, data.myRelation.role)} strong />
                <Info label="Contact principal" value={data.myRelation.isPrimaryContact ? 'Da' : 'Nu'} />
                <Info label="Metodă contact" value={labelFromMap(contactMethodLabels, data.myRelation.preferredContactMethod, 'Telefon')} />
                <Info label="Status" value={labelFromMap(relationStatusLabels, data.myRelation.status, 'Neinvitat')} />
                <Info label="Data legării" value={formatDate(data.myRelation.relationStartDate)} />
              </div>
              <p className="mt-4 rounded-2xl bg-muted/35 px-4 py-3 text-sm leading-6 text-muted-foreground">
                Pentru modificarea acestor date, contactează administratorul asociației sau trimite o solicitare din profilul tău.
              </p>
              <div className="mt-3">
                <ButtonLink href="/resident/profile" variant="secondary" size="sm">Solicită actualizare date</ButtonLink>
              </div>
            </Card>
          </section>

          <Card>
            <h2 className="text-base font-semibold text-foreground">Persoane asociate apartamentului</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {data.relatedResidents.map((resident) => (
                <div key={`${resident.id}-${resident.role}`} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{resident.fullName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{labelFromMap(roleLabels, resident.role)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {resident.isCurrentUser ? <Badge variant="success">Tu</Badge> : null}
                      {resident.isPrimaryContact ? <Badge variant="neutral">Contact principal</Badge> : null}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Info label="Telefon" value={resident.phone || (resident.isCurrentUser ? 'Necompletat' : 'Ascuns')} />
                    <Info label="Email" value={resident.email || (resident.isCurrentUser ? 'Necompletat' : 'Ascuns')} />
                  </div>
                </div>
              ))}
              {!data.relatedResidents.length ? <p className="text-sm text-muted-foreground">Nu există persoane asociate afișabile.</p> : null}
            </div>
          </Card>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Facturi recente</h2>
                  <p className="text-sm text-muted-foreground">Ultimele 5 facturi pentru apartament.</p>
                </div>
                <ButtonLink href={`/resident/invoices?apartmentId=${apartment.id}`} variant="secondary" size="sm">Vezi toate facturile</ButtonLink>
              </div>
              <div className="mt-4 space-y-3">
                {data.recentInvoices.map((invoice) => (
                  <Link key={invoice.id} href={localizedPath(`/resident/invoices/${invoice.id}`)} className="block rounded-2xl border border-border/70 bg-muted/25 p-4 transition hover:bg-white">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{invoice.invoiceNumber}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{monthLabel(invoice.billingMonth)} · scadență {formatDate(invoice.dueDate)}</p>
                      </div>
                      <Badge variant={invoice.status === 'PAID' ? 'success' : invoice.status === 'CANCELLED' || invoice.status === 'VOID' ? 'neutral' : 'warning'}>
                        {invoice.isOverdue ? 'Întârziată' : invoiceStatusLabels[invoice.status]}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <Info label="Total" value={formatMdl(invoice.totalAmount)} />
                      <Info label="Achitat" value={formatMdl(invoice.paidAmount)} />
                      <Info label="Sold" value={formatMdl(invoice.balanceAmount)} danger={invoice.balanceAmount > 0} />
                    </div>
                  </Link>
                ))}
                {!data.recentInvoices.length ? <EmptyBlock title="Nu există facturi pentru apartament" text="Facturile interne vor apărea aici după ce administratorul le generează." /> : null}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Plăți recente</h2>
                  <p className="text-sm text-muted-foreground">Ultimele 5 plăți pentru apartament.</p>
                </div>
                <ButtonLink href={`/resident/payments?apartmentId=${apartment.id}`} variant="secondary" size="sm">Vezi toate plățile</ButtonLink>
              </div>
              <div className="mt-4 space-y-3">
                {data.recentPayments.map((payment) => (
                  <Link key={payment.id} href={localizedPath(`/resident/payments/${payment.id}`)} className="block rounded-2xl border border-border/70 bg-muted/25 p-4 transition hover:bg-white">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{formatMdl(payment.amount)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(payment.paymentDate)} · {labelFromMap(paymentMethodLabels, payment.method)}
                        </p>
                      </div>
                      <Badge variant={payment.status === 'CONFIRMED' ? 'success' : 'neutral'}>{payment.status === 'CONFIRMED' ? 'Confirmată' : 'Anulată'}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <Info label="Factură" value={payment.invoiceNumber || 'Necompletat'} />
                      <Info label="Referință" value={payment.referenceNumber || 'Necompletat'} />
                    </div>
                  </Link>
                ))}
                {!data.recentPayments.length ? <EmptyBlock title="Nu există plăți pentru apartament" text="Plățile vor apărea aici după ce administratorul le înregistrează." /> : null}
              </div>
            </Card>
          </section>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Solicitări pentru acest apartament</h2>
                <p className="text-sm text-muted-foreground">Ultimele solicitări trimise către administrație.</p>
              </div>
              <ButtonLink href={`/resident/requests/new?apartmentId=${apartment.id}`} variant="secondary" size="sm">
                Creează solicitare pentru acest apartament
              </ButtonLink>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {recentRequests.map((request) => (
                <Link key={request.id} href={localizedPath(`/resident/requests/${request.id}`)} className="rounded-2xl border border-border/70 bg-muted/25 p-4 transition hover:bg-white">
                  <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {request.requestNumber}
                  </p>
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{request.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {requestStatusLabels[request.status] || request.status} · {formatDate(request.updatedAt || request.createdAt)}
                  </p>
                </Link>
              ))}
              {!recentRequests.length ? <EmptyBlock title="Nu există solicitări pentru acest apartament" text="Cererile trimise pentru apartament vor apărea aici." /> : null}
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-foreground">Atenționări</h2>
            <div className="mt-4 space-y-2">
              {data.alerts.map((alert) => (
                <div key={`${alert.type}-${alert.title}`} className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                  <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.message}</p>
                </div>
              ))}
              {!data.alerts.length ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                  Nu există atenționări pentru acest apartament.
                </div>
              ) : null}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Info({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/35 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm ${strong ? 'font-semibold' : 'font-medium'} ${danger ? 'text-rose-600' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function EmptyBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}
