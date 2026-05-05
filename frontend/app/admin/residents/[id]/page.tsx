'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Banknote, Building2, FileText, MessageCircle, Phone, UserRound } from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { defaultLocale, isLocale } from '@/i18n';
import { accountStatusVariant, adminApartments, findResidentById } from '@/lib/admin-mvp-data';
import { formatMdl } from '@/lib/condo-admin-fallback';

export default function AdminResidentDetailPage() {
  const params = useParams<{ id?: string; locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const resident = findResidentById(params?.id);
  const apartments = adminApartments.filter((apartment) => resident.apartments.includes(apartment.number));

  return (
    <div className="space-y-5 pb-4">
      <Link href={`/${locale}/admin/residents`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la locatari
      </Link>

      <PageHeader
        title={resident.name}
        description={`${resident.role} · Apt. ${resident.apartments.join(', ')}`}
        rightSlot={<Badge variant={accountStatusVariant[resident.accountStatus]}>{resident.accountStatus}</Badge>}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Telefon" value={resident.phone} description={resident.email} icon={<Phone className="h-5 w-5" />} tone="neutral" />
        <StatCard label="Rol" value={resident.role} description="Rol în asociație" icon={<UserRound className="h-5 w-5" />} tone="success" />
        <StatCard label="Apartamente" value={resident.apartments.join(', ')} description={`${apartments.length} apartament(e) asociate`} icon={<Building2 className="h-5 w-5" />} tone="neutral" />
        <StatCard label="Datorie asociată" value={formatMdl(resident.debt)} description={resident.debt > 0 ? 'Există sold neachitat' : 'Fără datorii'} icon={<Banknote className="h-5 w-5" />} tone={resident.debt > 0 ? 'danger' : 'success'} />
      </section>

      <Card>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ButtonLink href={`/${locale}/admin/chat`} variant="primary"><MessageCircle className="h-4 w-4" /> Mesaj</ButtonLink>
          <ButtonLink href={`/${locale}/admin/payments`} variant="secondary"><Banknote className="h-4 w-4" /> Adaugă plată</ButtonLink>
          <ButtonLink href={`/${locale}/admin/issues`} variant="secondary"><FileText className="h-4 w-4" /> Creează cerere</ButtonLink>
          <ButtonLink href={`/${locale}/admin/residents`} variant="secondary"><UserRound className="h-4 w-4" /> Lista locatari</ButtonLink>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <SectionTitle icon={<UserRound className="h-5 w-5" />} title="Profil" description="Date de contact și status cont." />
          <InfoGrid
            rows={[
              ['Nume complet', resident.name],
              ['Telefon', resident.phone],
              ['Email', resident.email],
              ['Rol', <span key="role" className="capitalize">{resident.role}</span>],
              ['Status cont', <Badge key="account" variant={accountStatusVariant[resident.accountStatus]}>{resident.accountStatus}</Badge>],
            ]}
          />
        </Card>

        <Card>
          <SectionTitle icon={<Building2 className="h-5 w-5" />} title="Apartamente" description="Unități locative asociate profilului." />
          <div className="grid gap-3 md:grid-cols-2">
            {apartments.map((apartment) => (
              <Link key={apartment.id} href={`/${locale}/admin/apartments/${apartment.id}`} className="rounded-2xl border border-border/70 bg-muted/25 p-4 hover:bg-muted/45">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">Apt. {apartment.number}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{apartment.staircase} · Etaj {apartment.floor}</p>
                  </div>
                  <Badge variant={apartment.debt > 0 ? 'error' : 'success'}>{apartment.debt > 0 ? 'Cu datorii' : 'Achitat'}</Badge>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Sold: <span className="font-semibold text-foreground">{formatMdl(apartment.debt)}</span></p>
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <SectionTitle icon={<Banknote className="h-5 w-5" />} title="Plăți / Datorii" description="Sumar financiar pentru profil." />
          <div className="space-y-3">
            <InfoTile label="Total datorie" value={formatMdl(resident.debt)} danger={resident.debt > 0} />
            <InfoTile label="Status" value={resident.debt > 0 ? 'Întârziat' : 'Achitat'} danger={resident.debt > 0} />
            <InfoTile label="Ultima plată" value={resident.debt > 0 ? 'Martie 2026' : 'Aprilie 2026'} />
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<MessageCircle className="h-5 w-5" />} title="Mesaje" description="Comunicare rapidă cu administratorul." />
          <div className="space-y-3">
            <p className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
              Mesaj trimis administratorului despre citirea contorului.
            </p>
            <ButtonLink href={`/${locale}/admin/chat`} variant="secondary" className="w-full justify-center">
              Deschide mesaje
            </ButtonLink>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<FileText className="h-5 w-5" />} title="Cereri" description="Solicitări conectate acestui locatar." />
          <div className="space-y-3">
            <p className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm font-medium text-foreground">
              Verificare presiune apă caldă
            </p>
            <p className="text-sm text-muted-foreground">Status: în lucru · Apt. {resident.apartments[0]}</p>
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
    <div className="grid gap-3 sm:grid-cols-2">
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
