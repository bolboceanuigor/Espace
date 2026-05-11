'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Link2,
  Lock,
  Mail,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageHeader,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper,
} from '@/components/ui';
import EmptyState from '@/components/common/EmptyState';
import { residentAccessApi } from '@/lib/api';
import { saveAuth } from '@/lib/auth';
import { useLocalizedPath } from '@/lib/use-localized-path';

type PortalAccessStatus = 'NO_ACCESS' | 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
type InvitationStatus = 'DRAFT' | 'PENDING' | 'SENT' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED' | 'REVOKED';
type DeliveryMethod = 'COPY_LINK' | 'EMAIL_PLACEHOLDER' | 'SMS_PLACEHOLDER' | 'MANUAL';

type ResidentAccessItem = {
  resident: {
    id: string;
    fullName: string;
    phone?: string;
    email?: string;
    status?: string;
  };
  apartments: Array<{
    id: string;
    apartmentNumber: string;
    staircase?: string;
    role?: string;
    isPrimaryContact?: boolean;
  }>;
  portalAccess: {
    status: PortalAccessStatus;
    statusLabel?: string;
    userId?: string | null;
    user?: { id: string; fullName: string; email: string; isActive?: boolean } | null;
    activatedAt?: string | null;
    latestInvitation?: InvitationItem | null;
  };
};

type InvitationItem = {
  id: string;
  residentId: string;
  invitedEmail?: string;
  invitedPhone?: string;
  status: InvitationStatus;
  deliveryMethod: DeliveryMethod;
  expiresAt?: string;
  acceptedAt?: string | null;
  lastSentAt?: string | null;
  sendCount?: number;
  tokenPreview?: string;
  inviteLink?: string;
  rawToken?: string;
  resident?: { id: string; fullName: string; email?: string; phone?: string } | null;
  apartment?: { id: string; apartmentNumber: string; staircase?: string } | null;
  apartments?: Array<{ apartmentNumber: string; staircase?: string; role?: string }>;
  createdBy?: { fullName?: string; email?: string } | null;
  acceptedBy?: { fullName?: string; email?: string } | null;
};

type ResidentAccessResponse = {
  items: ResidentAccessItem[];
  meta: { page: number; limit: number; total: number; totalPages?: number };
  stats: ResidentAccessStats;
};

type ResidentAccessStats = {
  totalResidents: number;
  activeAccess: number;
  noAccess: number;
  invited: number;
  expiredInvitations: number;
  cancelledInvitations?: number;
  suspended: number;
  revoked: number;
  withoutEmailOrPhone: number;
};

const emptyStats: ResidentAccessStats = {
  totalResidents: 0,
  activeAccess: 0,
  noAccess: 0,
  invited: 0,
  expiredInvitations: 0,
  cancelledInvitations: 0,
  suspended: 0,
  revoked: 0,
  withoutEmailOrPhone: 0,
};

const emptyAccessResponse: ResidentAccessResponse = {
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
  stats: emptyStats,
};

const accessLabel: Record<PortalAccessStatus, string> = {
  NO_ACCESS: 'Fără acces',
  INVITED: 'Invitat',
  ACTIVE: 'Activ',
  SUSPENDED: 'Suspendat',
  REVOKED: 'Revocat',
};

const accessVariant: Record<PortalAccessStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  NO_ACCESS: 'neutral',
  INVITED: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'error',
  REVOKED: 'error',
};

const invitationLabel: Record<InvitationStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'În așteptare',
  SENT: 'Trimisă',
  ACCEPTED: 'Acceptată',
  EXPIRED: 'Expirată',
  CANCELLED: 'Anulată',
  REVOKED: 'Revocată',
};

const invitationVariant: Record<InvitationStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  DRAFT: 'neutral',
  PENDING: 'warning',
  SENT: 'warning',
  ACCEPTED: 'success',
  EXPIRED: 'error',
  CANCELLED: 'neutral',
  REVOKED: 'error',
};

const deliveryLabel: Record<DeliveryMethod, string> = {
  COPY_LINK: 'Copiază link',
  EMAIL_PLACEHOLDER: 'Email placeholder',
  SMS_PLACEHOLDER: 'SMS placeholder',
  MANUAL: 'Manual',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ro-MD', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function unwrap<T>(res: any): T {
  return res?.data || res;
}

function apartmentsLabel(apartments?: ResidentAccessItem['apartments'] | InvitationItem['apartments']) {
  if (!apartments?.length) return '—';
  return apartments
    .map((item: any) => `Ap. ${item.apartmentNumber}${item.staircase ? ` · sc. ${item.staircase}` : ''}`)
    .join(', ');
}

async function copyText(value?: string) {
  if (!value || typeof navigator === 'undefined') return false;
  await navigator.clipboard.writeText(value);
  return true;
}

export function AdminResidentAccessPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<ResidentAccessResponse>(emptyAccessResponse);
  const [filters, setFilters] = useState({ search: '', portalAccessStatus: 'ALL', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedResident, setSelectedResident] = useState<ResidentAccessItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await residentAccessApi.list({
        search: filters.search,
        portalAccessStatus: filters.portalAccessStatus === 'ALL' ? undefined : filters.portalAccessStatus,
        page: filters.page,
        limit: 20,
      });
      setData(unwrap<ResidentAccessResponse>(response) || emptyAccessResponse);
    } catch (err: any) {
      setData(emptyAccessResponse);
      setError(String(err?.message || 'Nu am putut încărca accesul locatarilor.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  async function action(name: string, run: () => Promise<any>) {
    setError('');
    setNotice('');
    try {
      await run();
      setNotice(name);
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Acțiunea nu a putut fi aplicată.'));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Acces portal locatari"
        description={`Gestionează invitațiile și accesul locatarilor în portal. ${data.stats.totalResidents} locatari · ${data.stats.activeAccess} activi.`}
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Link href={localizedPath('/admin/resident-access/invitations')} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-3 text-sm font-semibold">
              Vezi invitații
            </Link>
            <Button onClick={load}><RefreshCw className="h-4 w-4" /> Actualizează</Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total locatari" value={data.stats.totalResidents} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Cu acces activ" value={data.stats.activeAccess} icon={<ShieldCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Fără acces" value={data.stats.noAccess} icon={<ShieldOff className="h-5 w-5" />} tone="warning" />
        <StatCard label="Invitați" value={data.stats.invited} icon={<Mail className="h-5 w-5" />} />
        <StatCard label="Invitații expirate" value={data.stats.expiredInvitations} icon={<XCircle className="h-5 w-5" />} tone="danger" />
        <StatCard label="Suspendat/revocat" value={data.stats.suspended + data.stats.revoked} icon={<Lock className="h-5 w-5" />} tone="danger" />
        <StatCard label="Fără email/telefon" value={data.stats.withoutEmailOrPhone} icon={<UserPlus className="h-5 w-5" />} tone="warning" />
        <StatCard label="Anulate" value={data.stats.cancelledInvitations || 0} icon={<XCircle className="h-5 w-5" />} />
      </div>

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <Input label="Caută locatar, telefon, email sau apartament" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))} />
          <Select label="Status acces" value={filters.portalAccessStatus} onChange={(value) => setFilters((current) => ({ ...current, portalAccessStatus: value, page: 1 }))} options={['ALL', 'NO_ACCESS', 'INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED']} labels={{ ALL: 'Toate', ...accessLabel }} />
          <Button variant="secondary" onClick={() => setFilters({ search: '', portalAccessStatus: 'ALL', page: 1 })}>Resetează</Button>
        </div>
      </Card>

      {notice ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <Card>
        <TableWrapper>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Locatar</TableHeaderCell>
                <TableHeaderCell>Contact</TableHeaderCell>
                <TableHeaderCell>Apartamente</TableHeaderCell>
                <TableHeaderCell>Status acces</TableHeaderCell>
                <TableHeaderCell>Ultima invitație</TableHeaderCell>
                <TableHeaderCell>User legat</TableHeaderCell>
                <TableHeaderCell align="right">Acțiuni</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableEmpty colSpan={7}>Se încarcă accesul locatarilor...</TableEmpty>
              ) : data.items.length ? (
                data.items.map((item) => (
                  <TableRow key={item.resident.id}>
                    <TableCell>
                      <div className="font-semibold text-foreground">{item.resident.fullName}</div>
                      <div className="text-xs text-muted-foreground">ID {item.resident.id.slice(0, 8)}</div>
                    </TableCell>
                    <TableCell>
                      <div>{item.resident.phone || '—'}</div>
                      <div className="text-xs text-muted-foreground">{item.resident.email || '—'}</div>
                    </TableCell>
                    <TableCell>{apartmentsLabel(item.apartments)}</TableCell>
                    <TableCell>
                      <Badge variant={accessVariant[item.portalAccess.status]}>{accessLabel[item.portalAccess.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      {item.portalAccess.latestInvitation ? (
                        <div className="space-y-1">
                          <Badge variant={invitationVariant[item.portalAccess.latestInvitation.status]}>{invitationLabel[item.portalAccess.latestInvitation.status]}</Badge>
                          <div className="text-xs text-muted-foreground">Expiră {formatDate(item.portalAccess.latestInvitation.expiresAt)}</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{item.portalAccess.user?.email || '—'}</TableCell>
                    <TableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Link href={localizedPath(`/admin/residents/${item.resident.id}/access`)} className="inline-flex h-9 items-center justify-center rounded-xl border border-border/70 px-3 text-xs font-semibold">
                          Deschide
                        </Link>
                        <Button size="sm" variant="secondary" onClick={() => setSelectedResident(item)}>Invită</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty colSpan={7}>
                  <EmptyState title="Nu există locatari pentru acces portal" description="Adaugă locatari sau importă lista de proprietari pentru a pregăti accesul în portal." />
                </TableEmpty>
              )}
            </TableBody>
          </Table>
        </TableWrapper>
      </Card>

      <InviteModal
        resident={selectedResident}
        onClose={() => setSelectedResident(null)}
        onCreated={async (message) => {
          setSelectedResident(null);
          setNotice(message);
          await load();
        }}
      />
    </div>
  );
}

export function AdminResidentAccessInvitationsPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<{ items: InvitationItem[]; meta: { total: number } }>({ items: [], meta: { total: 0 } });
  const [filters, setFilters] = useState({ search: '', status: 'ALL' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await residentAccessApi.listInvitations({
        search: filters.search,
        status: filters.status === 'ALL' ? undefined : filters.status,
      });
      setData(unwrap<any>(response) || { items: [], meta: { total: 0 } });
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca invitațiile.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  async function mutate(message: string, run: () => Promise<any>) {
    setError('');
    setNotice('');
    try {
      const result = await run();
      const invitation = unwrap<any>(result)?.invitation;
      if (invitation?.inviteLink) {
        await copyText(invitation.inviteLink);
        setNotice(`${message} Linkul nou a fost copiat.`);
      } else {
        setNotice(message);
      }
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Acțiunea nu a putut fi aplicată.'));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invitații portal"
        description={`Urmărește invitațiile trimise locatarilor pentru activarea contului. ${data.meta.total || data.items.length} invitații.`}
        rightSlot={<Link href={localizedPath('/admin/resident-access')} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-3 text-sm font-semibold">Înapoi la acces</Link>}
      />
      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Input label="Caută invitație" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
          <Select label="Status" value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} options={['ALL', 'PENDING', 'SENT', 'ACCEPTED', 'EXPIRED', 'CANCELLED', 'REVOKED']} labels={{ ALL: 'Toate', ...invitationLabel }} />
        </div>
      </Card>
      {notice ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      <Card>
        <TableWrapper>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Resident</TableHeaderCell>
                <TableHeaderCell>Contact invitat</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Metodă</TableHeaderCell>
                <TableHeaderCell>Expiră</TableHeaderCell>
                <TableHeaderCell>Acceptată</TableHeaderCell>
                <TableHeaderCell align="right">Acțiuni</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableEmpty colSpan={7}>Se încarcă invitațiile...</TableEmpty>
              ) : data.items.length ? (
                data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.resident?.fullName || '—'}</TableCell>
                    <TableCell>
                      <div>{item.invitedEmail || '—'}</div>
                      <div className="text-xs text-muted-foreground">{item.invitedPhone || '—'}</div>
                    </TableCell>
                    <TableCell><Badge variant={invitationVariant[item.status]}>{invitationLabel[item.status]}</Badge></TableCell>
                    <TableCell>{deliveryLabel[item.deliveryMethod]}</TableCell>
                    <TableCell>{formatDate(item.expiresAt)}</TableCell>
                    <TableCell>{formatDate(item.acceptedAt)}</TableCell>
                    <TableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Link href={localizedPath(`/admin/resident-access/invitations/${item.id}`)} className="inline-flex h-9 items-center justify-center rounded-xl border border-border/70 px-3 text-xs font-semibold">
                          Deschide
                        </Link>
                        <Button size="sm" variant="secondary" onClick={() => mutate('Invitația a fost regenerată.', () => residentAccessApi.regenerateInvitation(item.id))}>Regenerează</Button>
                        <Button size="sm" variant="secondary" onClick={() => mutate('Invitația a fost marcată ca trimisă.', () => residentAccessApi.markSent(item.id))}>Trimisă</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty colSpan={7}>
                  <EmptyState title="Nu există invitații" description="Invitațiile de portal vor apărea aici după ce creezi primul link de activare." />
                </TableEmpty>
              )}
            </TableBody>
          </Table>
        </TableWrapper>
      </Card>
    </div>
  );
}

export function AdminResidentAccessDetailPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  const residentId = params?.id;
  const load = useCallback(async () => {
    if (!residentId) return;
    setLoading(true);
    setError('');
    try {
      const response = await residentAccessApi.getResidentAccess(residentId);
      setData(unwrap<any>(response));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca detaliile accesului.'));
    } finally {
      setLoading(false);
    }
  }, [residentId]);

  useEffect(() => {
    load();
  }, [load]);

  const item = data as ResidentAccessItem & { invitations?: InvitationItem[]; association?: any };

  async function run(message: string, action: () => Promise<any>) {
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(message);
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Acțiunea nu a putut fi aplicată.'));
    }
  }

  if (loading) return <Card className="h-40 animate-pulse bg-muted/40" />;
  if (error && !item?.resident) return <EmptyState title="Nu am putut încărca accesul" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Acces portal · ${item.resident.fullName}`}
        description={`Invitații, user legat și acțiuni de acces pentru acest locatar. ${item.association?.shortName || 'A.P.C.'} · ${item.association?.associationCode || 'cod necompletat'}.`}
        rightSlot={<Link href={localizedPath('/admin/resident-access')} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-3 text-sm font-semibold"><ArrowLeft className="mr-2 h-4 w-4" /> Înapoi</Link>}
      />
      {notice ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Status acces</h2>
              <p className="text-sm text-muted-foreground">{item.resident.email || item.resident.phone || 'Fără email/telefon pentru invitație'}</p>
            </div>
            <Badge variant={accessVariant[item.portalAccess.status]}>{accessLabel[item.portalAccess.status]}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="Apartamente" value={apartmentsLabel(item.apartments)} />
            <Info label="User legat" value={item.portalAccess.user?.email || '—'} />
            <Info label="Activat la" value={formatDate(item.portalAccess.activatedAt)} />
            <Info label="Ultima invitație" value={item.portalAccess.latestInvitation ? invitationLabel[item.portalAccess.latestInvitation.status] : '—'} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" /> Creează invitație</Button>
            <Button variant="secondary" onClick={() => run('Accesul a fost suspendat.', () => residentAccessApi.suspend(item.resident.id, 'Suspendat din pagina de acces.'))}>Suspendă</Button>
            <Button variant="secondary" onClick={() => run('Accesul a fost reactivat.', () => residentAccessApi.reactivate(item.resident.id))}>Reactivează</Button>
            <Button variant="secondary" onClick={() => run('Accesul a fost revocat.', () => residentAccessApi.revoke(item.resident.id, 'Revocat din pagina de acces.'))}>Revocă</Button>
          </div>
        </Card>
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Legare user existent</h2>
          <LinkUserForm residentId={item.resident.id} onDone={() => run('Userul a fost legat.', async () => undefined)} reload={load} />
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Istoric invitații</h2>
        <div className="grid gap-3">
          {item.invitations?.length ? item.invitations.map((invitation) => (
            <div key={invitation.id} className="rounded-2xl border border-border/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Badge variant={invitationVariant[invitation.status]}>{invitationLabel[invitation.status]}</Badge>
                  <p className="mt-2 text-sm text-muted-foreground">{deliveryLabel[invitation.deliveryMethod]} · expiră {formatDate(invitation.expiresAt)}</p>
                </div>
                <Link href={localizedPath(`/admin/resident-access/invitations/${invitation.id}`)} className="inline-flex h-9 items-center justify-center rounded-xl border border-border/70 px-3 text-xs font-semibold">
                  Deschide
                </Link>
              </div>
            </div>
          )) : <EmptyState title="Nu există invitații" description="Creează o invitație pentru a genera un link securizat de activare." />}
        </div>
      </Card>

      <InviteModal
        resident={item}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreated={async (message) => {
          setInviteOpen(false);
          setNotice(message);
          await load();
        }}
      />
    </div>
  );
}

export function AdminResidentAccessInvitationDetailPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const [invitation, setInvitation] = useState<InvitationItem | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    setError('');
    try {
      const response = await residentAccessApi.getInvitation(params.id);
      setInvitation(unwrap<any>(response)?.invitation || null);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca invitația.'));
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function mutate(message: string, action: () => Promise<any>) {
    setError('');
    setNotice('');
    try {
      const response = await action();
      const updated = unwrap<any>(response)?.invitation;
      if (updated?.inviteLink) await copyText(updated.inviteLink);
      setInvitation(updated || invitation);
      setNotice(updated?.inviteLink ? `${message} Linkul a fost copiat.` : message);
    } catch (err: any) {
      setError(String(err?.message || 'Acțiunea nu a putut fi aplicată.'));
    }
  }

  if (loading) return <Card className="h-40 animate-pulse bg-muted/40" />;
  if (!invitation) return <EmptyState title="Invitația nu a fost găsită" description={error || 'Verifică lista invitațiilor.'} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detalii invitație portal"
        description={`Status, expirare, metoda de livrare și acțiuni disponibile. Token ${invitation.tokenPreview || '—'}.`}
        rightSlot={<Link href={localizedPath('/admin/resident-access/invitations')} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-3 text-sm font-semibold"><ArrowLeft className="mr-2 h-4 w-4" /> Înapoi</Link>}
      />
      {notice ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{invitation.resident?.fullName || 'Locatar'}</h2>
            <p className="text-sm text-muted-foreground">{invitation.invitedEmail || invitation.invitedPhone || 'Contact necompletat'}</p>
          </div>
          <Badge variant={invitationVariant[invitation.status]}>{invitationLabel[invitation.status]}</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Info label="Metodă" value={deliveryLabel[invitation.deliveryMethod]} />
          <Info label="Expiră la" value={formatDate(invitation.expiresAt)} />
          <Info label="Acceptată la" value={formatDate(invitation.acceptedAt)} />
          <Info label="Creată de" value={invitation.createdBy?.fullName || invitation.createdBy?.email || '—'} />
          <Info label="Trimiteri" value={String(invitation.sendCount || 0)} />
          <Info label="Apartament" value={invitation.apartment ? `Ap. ${invitation.apartment.apartmentNumber}` : apartmentsLabel(invitation.apartments)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => mutate('Invitația a fost regenerată.', () => residentAccessApi.regenerateInvitation(invitation.id))}><RotateCcw className="h-4 w-4" /> Regenerează link</Button>
          <Button variant="secondary" onClick={() => mutate('Invitația a fost marcată ca trimisă.', () => residentAccessApi.markSent(invitation.id))}>Marchează ca trimisă</Button>
          <Button variant="secondary" onClick={() => mutate('Invitația a fost anulată.', () => residentAccessApi.cancelInvitation(invitation.id, 'Anulată din detalii invitație.'))}>Anulează</Button>
          <Link href={localizedPath(`/admin/residents/${invitation.residentId}/access`)} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-3 text-sm font-semibold">Vezi resident access</Link>
        </div>
      </Card>
    </div>
  );
}

export function PublicInvitationPage({ accept = false }: { accept?: boolean }) {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const token = params?.token || '';

  useEffect(() => {
    let active = true;
    setLoading(true);
    residentAccessApi
      .publicInvitation(token)
      .then((res) => {
        if (!active) return;
        const payload = unwrap<any>(res);
        setData(payload);
        setForm((current) => ({
          ...current,
          fullName: payload?.resident?.fullName || '',
          email: payload?.resident?.email || '',
          phone: payload?.resident?.phone || '',
        }));
      })
      .catch((err) => active && setError(String(err?.message || 'Invitația nu este validă.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  async function submit() {
    setError('');
    setSaving(true);
    try {
      const response = await residentAccessApi.acceptInvitation(token, form);
      const payload = unwrap<any>(response);
      if (payload?.accessToken && payload?.user) {
        saveAuth(payload.accessToken, payload.user);
      }
      router.push(payload?.redirectPath || '/ro/resident');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut activa contul.'));
    } finally {
      setSaving(false);
    }
  }

  const status = data?.invitation?.status as InvitationStatus | undefined;
  const valid = Boolean(data?.valid);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),linear-gradient(180deg,#ffffff,#f7f7f4)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
        <Card className="w-full space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-700">{data?.association?.shortName || 'Espace'}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Ai fost invitat să activezi contul în Espace.</h1>
              <p className="mt-3 text-sm text-muted-foreground">Portalul îți permite să vezi facturi, contoare, cereri și anunțuri ale asociației.</p>
            </div>
            <KeyRound className="h-8 w-8 text-emerald-700" />
          </div>

          {loading ? <div className="h-24 animate-pulse rounded-2xl bg-muted/50" /> : null}
          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          {!loading && !error ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status invitație</span>
                  <Badge variant={status ? invitationVariant[status] : 'neutral'}>{status ? invitationLabel[status] : 'Invalidă'}</Badge>
                </div>
                <Info label="Nume" value={data?.resident?.fullName || '—'} />
                <Info label="Contact" value={data?.resident?.email || data?.resident?.phone || '—'} />
                <Info label="Apartamente" value={apartmentsLabel(data?.apartments)} />
                <Info label="Expiră la" value={formatDate(data?.invitation?.expiresAt)} />
              </div>

              {!valid ? (
                <EmptyState
                  title={status === 'EXPIRED' ? 'Invitația a expirat' : status === 'ACCEPTED' ? 'Această invitație a fost deja folosită' : 'Această invitație nu mai este validă'}
                  description="Contactează administratorul pentru o invitație nouă."
                />
              ) : accept ? (
                <div className="space-y-3">
                  <Input label="Nume complet" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
                  <Input label="Email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                  <Input label="Telefon" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                  <Input label="Parolă" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
                  <Input label="Confirmă parola" type="password" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} />
                  <label className="flex items-start gap-2 rounded-2xl border border-border/70 p-3 text-sm text-muted-foreground">
                    <input type="checkbox" className="mt-1" defaultChecked />
                    Accept termenii portalului și confirm că datele afișate sunt corecte.
                  </label>
                  <Button className="w-full" isLoading={saving} onClick={submit}><CheckCircle2 className="h-4 w-4" /> Creează cont</Button>
                </div>
              ) : (
                <Button className="w-full" onClick={() => router.push(`/ro/invite/${token}/accept`)}><UserCheck className="h-4 w-4" /> Activează cont</Button>
              )}
            </div>
          ) : null}
        </Card>
      </div>
    </main>
  );
}

function InviteModal({
  resident,
  open,
  onClose,
  onCreated,
}: {
  resident: ResidentAccessItem | null;
  open?: boolean;
  onClose: () => void;
  onCreated: (message: string) => Promise<void>;
}) {
  const isOpen = open ?? Boolean(resident);
  const [form, setForm] = useState({
    invitedEmail: '',
    invitedPhone: '',
    deliveryMethod: 'COPY_LINK' as DeliveryMethod,
    expiresInDays: 7,
    replaceActiveInvitation: false,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  useEffect(() => {
    if (!resident) return;
    setForm({
      invitedEmail: resident.resident.email || '',
      invitedPhone: resident.resident.phone || '',
      deliveryMethod: 'COPY_LINK',
      expiresInDays: 7,
      replaceActiveInvitation: false,
    });
    setGeneratedLink('');
    setError('');
  }, [resident]);

  async function create() {
    if (!resident) return;
    setSaving(true);
    setError('');
    try {
      const response = await residentAccessApi.createInvitation(resident.resident.id, form);
      const invitation = unwrap<any>(response)?.invitation;
      const link = invitation?.inviteLink || '';
      setGeneratedLink(link);
      if (link) await copyText(link);
      await onCreated(link ? 'Invitația a fost creată. Linkul a fost copiat.' : 'Invitația a fost creată.');
    } catch (err: any) {
      setError(String(err?.message || 'Invitația nu a putut fi creată.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={`Creează invitație${resident ? ` · ${resident.resident.fullName}` : ''}`} onClose={onClose} />
      <ModalBody>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Email invitat" value={form.invitedEmail} onChange={(event) => setForm((current) => ({ ...current, invitedEmail: event.target.value }))} />
          <Input label="Telefon invitat" value={form.invitedPhone} onChange={(event) => setForm((current) => ({ ...current, invitedPhone: event.target.value }))} />
          <Select label="Metodă" value={form.deliveryMethod} onChange={(value) => setForm((current) => ({ ...current, deliveryMethod: value as DeliveryMethod }))} options={['COPY_LINK', 'EMAIL_PLACEHOLDER', 'SMS_PLACEHOLDER', 'MANUAL']} labels={deliveryLabel} />
          <Input label="Expiră în zile" type="number" min={1} max={30} value={String(form.expiresInDays)} onChange={(event) => setForm((current) => ({ ...current, expiresInDays: Number(event.target.value || 7) }))} />
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-medium md:col-span-2">
            <input type="checkbox" checked={form.replaceActiveInvitation} onChange={(event) => setForm((current) => ({ ...current, replaceActiveInvitation: event.target.checked }))} />
            Anulează invitația activă existentă și creează una nouă
          </label>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Email/SMS sunt placeholder. Pentru MVP, adminul copiază linkul securizat și îl trimite manual.</p>
        {generatedLink ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <div className="font-semibold">Link generat</div>
            <div className="mt-1 break-all">{generatedLink}</div>
          </div>
        ) : null}
        {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" disabled={saving} onClick={onClose}>Închide</Button>
        <Button isLoading={saving} onClick={create}><Link2 className="h-4 w-4" /> Generează link</Button>
      </ModalFooter>
    </Modal>
  );
}

function LinkUserForm({ residentId, reload, onDone }: { residentId: string; reload: () => Promise<void>; onDone: () => void }) {
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await residentAccessApi.linkUser(residentId, { userEmail, confirm: true });
      await reload();
      onDone();
      setUserEmail('');
    } catch (err: any) {
      setError(String(err?.message || 'Userul nu a putut fi legat.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Input label="Email user existent" value={userEmail} onChange={(event) => setUserEmail(event.target.value)} />
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      <Button isLoading={saving} onClick={submit}><Link2 className="h-4 w-4" /> Leagă user</Button>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] outline-none focus:ring-2 focus:ring-foreground/10">
        {options.map((item) => <option key={item} value={item}>{labels?.[item] || item}</option>)}
      </select>
    </label>
  );
}
