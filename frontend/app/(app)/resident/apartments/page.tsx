'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Building2, FileText, ReceiptText, Wallet } from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';

type ResidentApartmentItem = {
  id: string;
  apartmentNumber: string;
  building?: string | null;
  staircase?: string | null;
  floor?: string | null;
  areaM2?: number | null;
  status?: string;
  myRole?: string;
  isPrimaryContact?: boolean;
  financialSummary: {
    currency: 'MDL';
    currentBalance: number;
    unpaidInvoices: number;
    overdueInvoices: number;
    lastInvoiceBillingMonth?: string | null;
    lastPaymentDate?: string | null;
  };
};

type ApartmentListResponse = {
  items: ResidentApartmentItem[];
  meta?: { total: number };
  association?: {
    shortName?: string;
    associationCode?: string | null;
    address?: string | null;
  };
  emptyStateCode?: string | null;
  emptyStateMessage?: string | null;
};

const roleLabels: Record<string, string> = {
  OWNER: 'Proprietar',
  TENANT: 'Chiriaș',
  RESIDENT: 'Locatar',
  REPRESENTATIVE: 'Reprezentant',
  FAMILY_MEMBER: 'Membru familie',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' });
}

function monthLabel(value?: string | null) {
  if (!value) return '-';
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Date(year, month - 1, 1).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
}

function labelFromMap(map: Record<string, string>, value?: string | null, fallback = '-') {
  if (!value) return fallback;
  return map[String(value).toUpperCase()] || value;
}

export default function ResidentApartmentsPage() {
  const [data, setData] = useState<ApartmentListResponse>({ items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    residentDemoApi
      .apartments()
      .then((response) => {
        if (!active) return;
        setData({ items: [], ...(response.data || {}) });
      })
      .catch((err: any) => {
        if (!active) return;
        setData({ items: [] });
        setError(String(err?.message || 'Nu am putut încărca apartamentele.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const totalApartments = data.meta?.total ?? data.items.length;
  const totalBalance = data.items.reduce((sum, apartment) => sum + Number(apartment.financialSummary?.currentBalance || 0), 0);
  const unpaidInvoices = data.items.reduce((sum, apartment) => sum + Number(apartment.financialSummary?.unpaidInvoices || 0), 0);
  const overdueInvoices = data.items.reduce((sum, apartment) => sum + Number(apartment.financialSummary?.overdueInvoices || 0), 0);

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      <PageHeader
        title="Apartamentele mele"
        description="Vezi apartamentele asociate contului tău și situația lor financiară."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{data.association?.shortName || 'A.P.C.'}</Badge>
            <Badge variant="neutral">{data.association?.associationCode || 'cod A.P.C. necompletat'}</Badge>
            <Badge variant="neutral">{totalApartments} apartamente</Badge>
          </div>
        }
      />

      {loading ? <Card className="h-28 animate-pulse bg-muted/40" /> : null}
      {error ? <Card className="border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{error}</Card> : null}

      {!loading && !data.items.length ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-foreground">Nu ai un apartament asociat contului</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Pentru a vedea apartamentul, facturile și plățile, contul tău trebuie legat de un apartament de către administratorul asociației.
          </p>
          <ButtonLink href="/resident" className="mt-5">Înapoi la Acasă</ButtonLink>
        </Card>
      ) : null}

      {data.items.length ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Apartamente asociate" value={String(totalApartments)} description="Legate de contul tău" icon={<Building2 className="h-5 w-5" />} />
            <StatCard label="Sold total" value={formatMdl(totalBalance)} description="Facturi active" icon={<Wallet className="h-5 w-5" />} tone={totalBalance > 0 ? 'warning' : 'success'} />
            <StatCard label="Facturi neachitate" value={String(unpaidInvoices)} description="Pentru apartamentele tale" icon={<FileText className="h-5 w-5" />} tone={unpaidInvoices > 0 ? 'warning' : 'success'} />
            <StatCard label="Întârziate" value={String(overdueInvoices)} description="Scadență depășită" icon={<ReceiptText className="h-5 w-5" />} tone={overdueInvoices > 0 ? 'warning' : 'success'} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {data.items.map((apartment) => (
              <Card
                key={apartment.id}
                className="rounded-[8px] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <Building2 className="h-4 w-4" />
                      Apartament {apartment.apartmentNumber}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Scara {apartment.staircase || 'Necompletat'} · Etaj {apartment.floor || 'Necompletat'} · {apartment.areaM2 ? `${apartment.areaM2} m²` : 'suprafață necompletată'}
                    </p>
                  </div>
                  <Badge variant={apartment.financialSummary.currentBalance > 0 ? 'warning' : 'success'}>
                    {apartment.financialSummary.currentBalance > 0 ? 'Sold restant' : 'La zi'}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <Info label="Rolul meu" value={labelFromMap(roleLabels, apartment.myRole, 'Locatar')} />
                  <Info label="Contact principal" value={apartment.isPrimaryContact ? 'Da' : 'Nu'} />
                  <Info label="Sold curent" value={formatMdl(apartment.financialSummary.currentBalance)} danger={apartment.financialSummary.currentBalance > 0} />
                  <Info label="Facturi neachitate" value={String(apartment.financialSummary.unpaidInvoices)} />
                  <Info label="Ultima factură" value={monthLabel(apartment.financialSummary.lastInvoiceBillingMonth)} />
                  <Info label="Ultima plată" value={formatDate(apartment.financialSummary.lastPaymentDate)} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink href={`/resident/apartments/${apartment.id}`} size="sm">
                    Deschide <ArrowRight className="h-3.5 w-3.5" />
                  </ButtonLink>
                  <ButtonLink href={`/resident/invoices?apartmentId=${apartment.id}`} variant="secondary" size="sm">
                    Vezi facturi
                  </ButtonLink>
                  <ButtonLink href={`/resident/payments?apartmentId=${apartment.id}`} variant="secondary" size="sm">
                    Vezi plăți
                  </ButtonLink>
                </div>
              </Card>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}

function Info({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/35 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${danger ? 'text-rose-600' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
