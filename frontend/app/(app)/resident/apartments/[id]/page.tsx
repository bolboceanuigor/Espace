'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, FileText, ReceiptText, Wallet } from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type ApartmentDetails = {
  id: string;
  apartmentNumber: string;
  staircase?: string | null;
  building?: string | null;
  floor?: string | null;
  areaM2?: number | null;
  rooms?: number | null;
  role?: string | null;
  isPrimaryContact?: boolean;
};

type ApartmentSummary = {
  apartmentId: string;
  apartmentNumber: string;
  staircase?: string | null;
  floor?: string | null;
  areaM2?: number | null;
  role?: string | null;
  isPrimaryContact?: boolean;
  currentBalance: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  lastInvoiceBillingMonth?: string | null;
  lastPaymentDate?: string | null;
};

type DashboardResponse = {
  association?: {
    shortName?: string;
    legalName?: string;
    associationCode?: string | null;
    address?: string | null;
  };
  apartments?: ApartmentDetails[];
  apartmentSummaries?: ApartmentSummary[];
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

export default function ResidentApartmentDetailsPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const apartmentId = String(params?.id || '');
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    residentDemoApi
      .dashboard({ apartmentId, includeRecent: false })
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

  const apartment = useMemo(
    () => data?.apartments?.find((item) => item.id === apartmentId) || null,
    [apartmentId, data?.apartments],
  );
  const summary = useMemo(
    () => data?.apartmentSummaries?.find((item) => item.apartmentId === apartmentId) || null,
    [apartmentId, data?.apartmentSummaries],
  );

  if (!loading && (!data || !apartment)) {
    return (
      <div className="space-y-5 pb-24 md:pb-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Apartamentul nu a fost găsit</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Apartamentul solicitat nu există sau nu aparține contului tău.
          </p>
          {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          <ButtonLink href="/resident" className="mt-5">Înapoi acasă</ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      <Link href={localizedPath('/resident')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi acasă
      </Link>

      <PageHeader
        title={apartment ? `Apartament ${apartment.apartmentNumber}` : 'Detalii apartament'}
        description="Date simple, doar pentru citire."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            {data?.association?.shortName ? <Badge variant="neutral">{data.association.shortName}</Badge> : null}
            {data?.association?.associationCode ? <Badge variant="neutral">{data.association.associationCode}</Badge> : null}
          </div>
        }
      />

      {loading ? <Card className="h-28 animate-pulse bg-muted/40" /> : null}

      {apartment && summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Sold curent" value={formatMdl(summary.currentBalance)} description="Facturi active" icon={<Wallet className="h-5 w-5" />} tone={summary.currentBalance > 0 ? 'warning' : 'success'} />
            <StatCard label="Facturi neachitate" value={String(summary.unpaidInvoices)} description={`${summary.overdueInvoices} întârziate`} icon={<FileText className="h-5 w-5" />} tone={summary.unpaidInvoices > 0 ? 'warning' : 'success'} />
            <StatCard label="Ultima factură" value={monthLabel(summary.lastInvoiceBillingMonth)} description="Luna facturată" icon={<ReceiptText className="h-5 w-5" />} />
            <StatCard label="Ultima plată" value={formatDate(summary.lastPaymentDate)} description="Plată confirmată" icon={<ReceiptText className="h-5 w-5" />} />
          </section>

          <Card>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Building2 className="h-4 w-4" />
              Informații apartament
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Apartament" value={apartment.apartmentNumber} strong />
              <Info label="Bloc" value={apartment.building || '-'} />
              <Info label="Scara" value={apartment.staircase || '-'} />
              <Info label="Etaj" value={apartment.floor || '-'} />
              <Info label="Suprafață" value={apartment.areaM2 ? `${apartment.areaM2} m²` : '-'} />
              <Info label="Camere" value={apartment.rooms ? String(apartment.rooms) : '-'} />
              <Info label="Rol" value={labelFromMap(roleLabels, apartment.role, 'Locatar')} />
              <Info label="Contact principal" value={apartment.isPrimaryContact ? 'Da' : 'Nu'} />
            </div>
            <p className="mt-4 rounded-2xl bg-muted/35 px-4 py-3 text-sm leading-6 text-muted-foreground">
              Această pagină este informativă. Pentru modificări de date, contactează administratorul asociației.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href={`/resident/invoices?apartmentId=${apartment.id}`} variant="secondary">Vezi facturile</ButtonLink>
              <ButtonLink href={`/resident/payments?apartmentId=${apartment.id}`} variant="secondary">Vezi plățile</ButtonLink>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/35 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm ${strong ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>{value}</p>
    </div>
  );
}
