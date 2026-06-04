'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Mail, Phone, Search, UserCheck, UserPlus, Users } from 'lucide-react';
import { Badge, ButtonLink, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { adminOwnersApi } from '@/lib/api';

type OwnerStatus = 'ACTIVE' | 'INVITED' | 'NOT_INVITED' | 'INACTIVE';
type ContactMethod = 'PHONE' | 'EMAIL' | 'APP' | 'WHATSAPP' | 'TELEGRAM';

type ApartmentLink = {
  apartmentId: string;
  apartmentNumber: string;
  staircase: string;
  floor: string;
  role: string;
  isPrimaryContact: boolean;
};

type OwnerRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  preferredContactMethod: ContactMethod;
  status: OwnerStatus;
  role: string;
  apartments: ApartmentLink[];
  apartmentsCount: number;
  isPrimaryContactSomewhere: boolean;
  updatedAt: string;
  portalAccess?: {
    status?: 'NO_ACCESS' | 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  };
};

type ListResponse = {
  organization?: {
    shortName?: string;
    associationCode?: string;
  };
  items: OwnerRow[];
  meta: { page: number; limit: number; total: number; totalPages?: number };
  stats: {
    totalResidents: number;
    owners: number;
    withoutPhone: number;
    withoutEmail: number;
    withoutApartment: number;
    primaryContacts: number;
  };
};

const emptyList: ListResponse = {
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
  stats: {
    totalResidents: 0,
    owners: 0,
    withoutPhone: 0,
    withoutEmail: 0,
    withoutApartment: 0,
    primaryContacts: 0,
  },
};

const statusLabels: Record<OwnerStatus, string> = {
  ACTIVE: 'Activ',
  INVITED: 'Invitat',
  NOT_INVITED: 'Neinvitat',
  INACTIVE: 'Inactiv',
};

const portalAccessLabels = {
  NO_ACCESS: 'Fără acces',
  INVITED: 'Invitat',
  ACTIVE: 'Activ',
  SUSPENDED: 'Suspendat',
  REVOKED: 'Revocat',
} as const;

export default function AdminOwnersPage() {
  const [data, setData] = useState<ListResponse>(emptyList);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadOwners = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await adminOwnersApi.list({
        search: search.trim() || undefined,
        page: 1,
        limit: 50,
      });
      setData(res.data || emptyList);
    } catch (err: any) {
      setData(emptyList);
      setError(String(err?.message || 'Nu am putut încărca proprietarii.'));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadOwners();
  }, [loadOwners]);

  const badge = useMemo(() => {
    const shortName = data.organization?.shortName || 'A.P.C.';
    const code = data.organization?.associationCode || 'cod necompletat';
    return `${shortName} · ${code} · ${data.stats.owners} proprietari`;
  }, [data.organization, data.stats.owners]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proprietari"
        description="Suprafață dedicată pentru proprietarii asociației, peste modelul existent de rezidenți din Espace."
        badge={<Badge>{badge}</Badge>}
        actions={
          <>
            <ButtonLink href="/admin/residents" variant="secondary">
              Vezi toți locatarii
            </ButtonLink>
            <ButtonLink href="/admin/residents" variant="primary">
              <UserPlus className="h-4 w-4" />
              Adaugă proprietar
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Proprietari" value={data.stats.owners} description="Contacte cu rol owner" icon={<UserCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Fără telefon" value={data.stats.withoutPhone} description="Necesită completare contact" icon={<Phone className="h-5 w-5" />} tone="warning" />
        <StatCard label="Fără email" value={data.stats.withoutEmail} description="Acces portal dificil" icon={<Mail className="h-5 w-5" />} tone="warning" />
        <StatCard label="Fără apartament" value={data.stats.withoutApartment} description="Necesită legare la structură" icon={<Building2 className="h-5 w-5" />} tone="danger" />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Caută proprietar</p>
            <p className="text-xs text-muted-foreground">Filtrare rapidă după nume, telefon, email sau apartament.</p>
          </div>
          <div className="w-full md:max-w-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nume, apartament, telefon..."
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </Card>

      {error ? <Card className="border-critical/30 p-4 text-sm text-critical">{error}</Card> : null}

      {loading ? <Card className="p-4 text-sm text-muted-foreground">Se încarcă proprietarii...</Card> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {(data.items || []).map((owner) => (
          <Card key={owner.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-foreground">{owner.fullName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{owner.phone || 'Telefon lipsă'}</span>
                  <span>{owner.email || 'Email lipsă'}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={owner.status === 'ACTIVE' ? 'success' : owner.status === 'INACTIVE' ? 'error' : 'warning'}>
                  {statusLabels[owner.status] || owner.status}
                </Badge>
                <Badge variant={owner.portalAccess?.status === 'ACTIVE' ? 'success' : owner.portalAccess?.status === 'INVITED' ? 'warning' : 'neutral'}>
                  {portalAccessLabels[owner.portalAccess?.status || 'NO_ACCESS']}
                </Badge>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Apartamente</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{owner.apartmentsCount}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Contact principal</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{owner.isPrimaryContactSomewhere ? 'Da' : 'Nu'}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Metodă preferată</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{owner.preferredContactMethod || 'PHONE'}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-foreground">Relații active</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(owner.apartments || []).length ? (
                  owner.apartments.map((apartment) => (
                    <Badge key={`${owner.id}:${apartment.apartmentId}`} variant={apartment.isPrimaryContact ? 'success' : 'neutral'}>
                      Apt. {apartment.apartmentNumber}
                      {apartment.staircase ? ` · Scara ${apartment.staircase}` : ''}
                      {apartment.floor ? ` · Etaj ${apartment.floor}` : ''}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Niciun apartament legat încă.</span>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href={`/admin/residents/${owner.id}`} variant="secondary" size="sm">
                Deschide fișa
              </ButtonLink>
              {owner.apartments[0] ? (
                <ButtonLink href={`/admin/apartments/${owner.apartments[0].apartmentId}`} variant="secondary" size="sm">
                  Vezi apartamentul
                </ButtonLink>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      {!loading && !data.items.length ? (
        <Card className="p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-base font-semibold text-foreground">Nu există proprietari afișați.</p>
          <p className="mt-1 text-sm text-muted-foreground">În Espace, proprietarii folosesc modelul existent de rezidenți și relații pe apartament.</p>
        </Card>
      ) : null}
    </div>
  );
}
