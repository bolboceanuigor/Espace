'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Building2, Mail, MapPin, Phone, UserPlus } from 'lucide-react';
import { Badge, Card, PageHeader, StatCard } from '@/components/ui';
import {
  mockAdministrators,
  mockAssociations,
  statusBadgeVariant,
  statusLabel,
  type MvpAssociation,
} from '@/lib/superadmin-mvp-data';

function associationFromId(id: string): MvpAssociation {
  return {
    id,
    name: 'Asociație nouă',
    address: 'Adresă necompletată',
    city: 'Chișinău',
    country: 'MD',
    currency: 'MDL',
    status: 'TRIAL',
    apartmentsCount: 0,
    administratorName: 'Administrator neatribuit',
    administratorEmail: '',
    administratorPhone: '',
  };
}

export default function SuperadminOrganizationDetailsPage() {
  const params = useParams<{ id?: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const association = mockAssociations.find((item) => item.id === id) ?? associationFromId(id);
  const administrators = mockAdministrators.filter((admin) => admin.organizationId === association.id);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title={association.name}
        description="Detalii minime pentru asociație, administrator și activarea MVP."
        rightSlot={
          <Link href="/ro/superadmin/organizations" className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60">
            Înapoi la asociații
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Apartamente" value={association.apartmentsCount} description="Unități administrate" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Status" value={statusLabel(association.status)} description="Stare platformă" icon={<Building2 className="h-5 w-5" />} tone={association.status === 'ACTIVE' ? 'success' : 'warning'} />
        <StatCard label="Monedă" value={association.currency} description="Pentru plăți și solduri" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Administratori" value={Math.max(administrators.length, association.administratorEmail ? 1 : 0)} description="Conturi ADMIN" icon={<UserPlus className="h-5 w-5" />} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Date asociație</h2>
              <p className="mt-1 text-sm text-muted-foreground">Informațiile folosite în fluxul superadmin minim.</p>
            </div>
            <Badge variant={statusBadgeVariant(association.status)}>{statusLabel(association.status)}</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Info icon={<MapPin className="h-4 w-4" />} label="Adresă" value={`${association.address}, ${association.city}, ${association.country}`} />
            <Info icon={<Building2 className="h-4 w-4" />} label="Apartamente" value={`${association.apartmentsCount} apartamente`} />
            <Info icon={<Mail className="h-4 w-4" />} label="Email administrator" value={association.administratorEmail || '-'} />
            <Info icon={<Phone className="h-4 w-4" />} label="Telefon administrator" value={association.administratorPhone || '-'} />
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-foreground">Administrator principal</h2>
          <div className="mt-5 rounded-[1.1rem] border border-border/70 bg-muted/25 p-4">
            <p className="font-semibold text-foreground">{association.administratorName}</p>
            <p className="mt-1 text-sm text-muted-foreground">{association.administratorEmail || 'Email necompletat'}</p>
            <p className="text-sm text-muted-foreground">{association.administratorPhone || 'Telefon necompletat'}</p>
            <Badge className="mt-3" variant="success">ADMIN</Badge>
          </div>
          <Link href="/ro/superadmin/admins" className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
            Creează sau invită administrator
          </Link>
        </Card>
      </section>

      <Card>
        <h2 className="text-base font-semibold text-foreground">Pași MVP</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {['Asociație creată', 'Administrator atribuit', 'Pregătită pentru import apartamente'].map((step) => (
            <div key={step} className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm font-medium text-foreground">
              {step}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</p>
      <p className="mt-2 font-medium text-foreground">{value}</p>
    </div>
  );
}
