'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Banknote,
  FileText,
  Gauge,
  Home,
  MessageCircle,
  Plus,
  StickyNote,
  Users,
  Wrench,
} from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { defaultLocale, isLocale } from '@/i18n';
import {
  apartmentMeters,
  apartmentPayments,
  apartmentRequests,
  apartmentStatusVariant,
  findApartmentById,
  residentsForApartment,
} from '@/lib/admin-mvp-data';
import { formatMdl } from '@/lib/condo-admin-fallback';

const paymentVariant = {
  Achitat: 'success',
  Neachitat: 'warning',
  Întârziat: 'error',
} as const;

const meterVariant = {
  Actualizat: 'success',
  Lipsă: 'warning',
} as const;

const requestVariant = {
  Nouă: 'default',
  'În lucru': 'warning',
  Rezolvată: 'success',
} as const;

export default function AdminApartmentDetailPage() {
  const params = useParams<{ id?: string; locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const apartment = findApartmentById(params?.id);
  const residents = residentsForApartment(apartment.number);

  return (
    <div className="space-y-5 pb-4">
      <Link href={`/${locale}/admin/apartments`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la apartamente
      </Link>

      <PageHeader
        title={`Apt. ${apartment.number}`}
        description={`${apartment.staircase} · Etaj ${apartment.floor} · ${apartment.areaM2} m² · ${apartment.rooms} camere`}
        rightSlot={<Badge variant={apartmentStatusVariant[apartment.status]}>{apartment.status}</Badge>}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total datorie" value={formatMdl(apartment.debt)} description={`Facturi neachitate: ${apartment.unpaidInvoices}`} icon={<Banknote className="h-5 w-5" />} tone={apartment.debt > 0 ? 'danger' : 'success'} />
        <StatCard label="Proprietar" value={apartment.owner} description={apartment.phone} icon={<Users className="h-5 w-5" />} tone="success" />
        <StatCard label="Contoare" value={`${apartment.metersUpdated} actualizate`} description={`${apartment.metersMissing} lipsă`} icon={<Gauge className="h-5 w-5" />} tone={apartment.metersMissing ? 'warning' : 'success'} />
        <StatCard label="Locatari" value={`${apartment.residents} persoane`} description="Persoane asociate apartamentului" icon={<Home className="h-5 w-5" />} tone="neutral" />
      </section>

      <Card>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ButtonLink href={`/${locale}/admin/meters`} variant="primary"><Plus className="h-4 w-4" /> Adaugă citire</ButtonLink>
          <ButtonLink href={`/${locale}/admin/payments`} variant="secondary"><Banknote className="h-4 w-4" /> Adaugă plată</ButtonLink>
          <ButtonLink href={`/${locale}/admin/chat`} variant="secondary"><MessageCircle className="h-4 w-4" /> Trimite mesaj</ButtonLink>
          <ButtonLink href={`/${locale}/admin/issues`} variant="secondary"><FileText className="h-4 w-4" /> Creează cerere</ButtonLink>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <SectionTitle icon={<Home className="h-5 w-5" />} title="General" description="Datele principale ale apartamentului." />
          <InfoGrid
            rows={[
              ['Apartament', `Apt. ${apartment.number}`],
              ['Scară', apartment.staircase],
              ['Etaj', apartment.floor],
              ['Suprafață', `${apartment.areaM2} m²`],
              ['Camere', apartment.rooms],
              ['Status', <Badge key="status" variant={apartmentStatusVariant[apartment.status]}>{apartment.status}</Badge>],
            ]}
          />
        </Card>

        <Card>
          <SectionTitle icon={<Users className="h-5 w-5" />} title="Locatari" description="Persoane conectate la apartament." />
          <div className="space-y-3">
            {residents.map((person) => (
              <Link key={person.id} href={`/${locale}/admin/residents/${person.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4 hover:bg-muted/45">
                <div>
                  <p className="font-semibold text-foreground">{person.name}</p>
                  <p className="mt-1 text-sm capitalize text-muted-foreground">{person.role}</p>
                </div>
                <Badge variant={person.accountStatus === 'cont creat' ? 'success' : person.accountStatus === 'invitat' ? 'warning' : 'neutral'}>
                  {person.accountStatus}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle icon={<Gauge className="h-5 w-5" />} title="Contoare" description="Citiri mock pentru apă și gaz." />
          <div className="space-y-3">
            {apartmentMeters.map((meter) => (
              <div key={meter.serial} className="grid gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
                <Info label="Tip" value={meter.type} />
                <Info label="Serie" value={meter.serial} />
                <Info label="Citire" value={meter.value} />
                <Badge variant={meterVariant[meter.status as keyof typeof meterVariant]}>{meter.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<Banknote className="h-5 w-5" />} title="Plăți / Datorii" description="Facturi neachitate și istoric plăți." />
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoTile label="Total datorie" value={formatMdl(apartment.debt)} danger={apartment.debt > 0} />
            <InfoTile label="Facturi neachitate" value={apartment.unpaidInvoices} danger={apartment.unpaidInvoices > 0} />
          </div>
          <div className="mt-4 space-y-3">
            {apartmentPayments.map((payment) => (
              <div key={payment.month} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4">
                <div>
                  <p className="font-semibold text-foreground">{payment.month}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{formatMdl(payment.amount)}</p>
                </div>
                <Badge variant={paymentVariant[payment.status as keyof typeof paymentVariant]}>{payment.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle icon={<Wrench className="h-5 w-5" />} title="Cereri" description="Solicitări conectate acestui apartament." />
          <div className="space-y-3">
            {apartmentRequests.map((request) => (
              <div key={request.title} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4">
                <div>
                  <p className="font-semibold text-foreground">{request.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{request.date}</p>
                </div>
                <Badge variant={requestVariant[request.status as keyof typeof requestVariant]}>{request.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<StickyNote className="h-5 w-5" />} title="Note interne" description="Vizibile doar pentru administratori." />
          <div className="space-y-3">
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
              Aceste note sunt interne și nu sunt vizibile pentru locatari.
            </p>
            <p className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
              Contact preferat prin telefon după ora 18:00. De verificat citirea la contorul de gaz la următoarea rundă lunară.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}

function SectionTitle({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-muted/45 text-foreground">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function InfoGrid({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(([label, value]) => (
        <InfoTile key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function InfoTile({ label, value, danger }: { label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className={`mt-1 text-sm font-semibold ${danger ? 'text-rose-600' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
