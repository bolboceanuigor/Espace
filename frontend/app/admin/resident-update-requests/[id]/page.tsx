'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Home, MessageSquareText, UserRound, XCircle } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader } from '@/components/ui';
import { adminResidentUpdateRequestsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type RequestType =
  | 'FULL_NAME_CHANGE'
  | 'PHONE_CHANGE'
  | 'EMAIL_CHANGE'
  | 'CONTACT_METHOD_CHANGE'
  | 'APARTMENT_RELATION_CHANGE'
  | 'OTHER';

type RequestDetail = {
  request: {
    id: string;
    requestType: RequestType;
    requestTypeLabel?: string;
    status: RequestStatus;
    currentFullName?: string | null;
    requestedFullName?: string | null;
    currentPhone?: string | null;
    requestedPhone?: string | null;
    currentEmail?: string | null;
    requestedEmail?: string | null;
    currentPreferredContactMethod?: string | null;
    requestedPreferredContactMethod?: string | null;
    message?: string | null;
    adminResponse?: string | null;
    internalNotes?: string | null;
    createdAt?: string;
    reviewedAt?: string | null;
    cancelledAt?: string | null;
    appliedAt?: string | null;
  };
  resident: {
    id: string;
    fullName: string;
    phone?: string;
    email?: string;
    preferredContactMethod?: string;
    status?: string;
  };
  association?: {
    shortName?: string;
    associationCode?: string;
  };
  apartment?: {
    id: string;
    apartmentNumber: string;
    staircase?: string;
    role?: string;
    isPrimaryContact?: boolean;
  } | null;
  apartments: Array<{
    apartmentId: string;
    apartmentNumber: string;
    staircase?: string;
    floor?: string;
    role?: string;
    isPrimaryContact?: boolean;
  }>;
  comparison: Array<{
    field: string;
    label: string;
    currentValue: string;
    requestedValue: string;
    resultValue?: string;
  }>;
  availableActions: {
    canApprove: boolean;
    canReject: boolean;
  };
};

const statusLabels: Record<RequestStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Aprobată',
  REJECTED: 'Respinsă',
  CANCELLED: 'Anulată',
};

const statusVariant = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'neutral',
} as const;

const requestTypeLabels: Record<RequestType, string> = {
  FULL_NAME_CHANGE: 'Schimbare nume',
  PHONE_CHANGE: 'Schimbare telefon',
  EMAIL_CHANGE: 'Schimbare email',
  CONTACT_METHOD_CHANGE: 'Schimbare metodă contact',
  APARTMENT_RELATION_CHANGE: 'Relație apartament',
  OTHER: 'Altă solicitare',
};

const roleLabels: Record<string, string> = {
  OWNER: 'Proprietar',
  TENANT: 'Chiriaș',
  RESIDENT: 'Locatar',
  REPRESENTATIVE: 'Reprezentant',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isSimpleType(type?: RequestType) {
  return type === 'FULL_NAME_CHANGE' || type === 'PHONE_CHANGE' || type === 'EMAIL_CHANGE' || type === 'CONTACT_METHOD_CHANGE';
}

export default function AdminResidentUpdateRequestDetailPage() {
  const params = useParams<{ id?: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [adminResponse, setAdminResponse] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [applyChangeNow, setApplyChangeNow] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadRequest = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const response = await adminResidentUpdateRequestsApi.get(id);
      const next = response.data || null;
      setData(next);
      setApplyChangeNow(isSimpleType(next?.request?.requestType));
    } catch (err: any) {
      setData(null);
      setError(String(err?.message || 'Nu am putut încărca solicitarea.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  const typeLabel = useMemo(() => {
    if (!data) return 'Solicitare';
    return data.request.requestTypeLabel || requestTypeLabels[data.request.requestType] || 'Solicitare';
  }, [data]);

  function openApprove() {
    if (!data) return;
    setAdminResponse(data.request.requestType === 'EMAIL_CHANGE' ? 'Datele au fost verificate. Emailul profilului a fost actualizat; emailul de autentificare rămâne neschimbat până la validare separată.' : 'Datele au fost verificate și solicitarea a fost aprobată.');
    setInternalNotes('');
    setApplyChangeNow(isSimpleType(data.request.requestType));
    setConfirmed(false);
    setFormError('');
    setApproveOpen(true);
  }

  function openReject() {
    setAdminResponse('');
    setInternalNotes('');
    setFormError('');
    setRejectOpen(true);
  }

  async function approveRequest() {
    if (!data) return;
    setFormError('');
    if (!confirmed) {
      setFormError('Confirmarea verificării este obligatorie.');
      return;
    }
    setSaving(true);
    try {
      await adminResidentUpdateRequestsApi.approve(data.request.id, {
        adminResponse: adminResponse.trim(),
        internalNotes: internalNotes.trim(),
        applyChangeNow,
      });
      setApproveOpen(false);
      setSuccess('Solicitarea a fost aprobată.');
      await loadRequest();
    } catch (err: any) {
      setFormError(String(err?.message || 'Nu am putut aproba solicitarea.'));
    } finally {
      setSaving(false);
    }
  }

  async function rejectRequest() {
    if (!data) return;
    setFormError('');
    if (!adminResponse.trim()) {
      setFormError('Răspunsul adminului este obligatoriu.');
      return;
    }
    setSaving(true);
    try {
      await adminResidentUpdateRequestsApi.reject(data.request.id, {
        adminResponse: adminResponse.trim(),
        internalNotes: internalNotes.trim(),
      });
      setRejectOpen(false);
      setSuccess('Solicitarea a fost respinsă.');
      await loadRequest();
    } catch (err: any) {
      setFormError(String(err?.message || 'Nu am putut respinge solicitarea.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 pb-8">
        <Card className="h-28 animate-pulse bg-muted/40" />
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="h-64 animate-pulse bg-muted/40" />
          <Card className="h-64 animate-pulse bg-muted/40" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-5 pb-8">
        <Link href={localizedPath('/admin/resident-update-requests')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Înapoi la solicitări
        </Link>
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Solicitarea nu a fost găsită</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'Solicitarea nu există sau nu aparține asociației curente.'}</p>
        </Card>
      </div>
    );
  }

  const isPending = data.request.status === 'PENDING';

  return (
    <div className="space-y-5 pb-8">
      <Link href={localizedPath('/admin/resident-update-requests')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Înapoi la solicitări
      </Link>

      <PageHeader
        title="Detalii solicitare actualizare"
        description="Compară datele actuale cu datele solicitate și procesează cererea locatarului."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{data.association?.shortName || 'A.P.C.'} · {data.association?.associationCode || 'cod necompletat'}</Badge>
            <Badge variant={statusVariant[data.request.status]}>{statusLabels[data.request.status]}</Badge>
            {isPending ? (
              <>
                <Button onClick={openApprove}>
                  <CheckCircle2 className="h-4 w-4" /> Aprobă
                </Button>
                <Button onClick={openReject} variant="danger">
                  <XCircle className="h-4 w-4" /> Respinge
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {success ? <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</Card> : null}
      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card> : null}

      <section className="grid gap-4 lg:grid-cols-[1.05fr_1.2fr]">
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-foreground">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{typeLabel}</p>
              <h1 className="mt-1 text-xl font-semibold text-foreground">{data.resident.fullName}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Trimisă la {formatDate(data.request.createdAt)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Telefon" value={data.resident.phone || 'Necompletat'} />
            <Info label="Email" value={data.resident.email || 'Necompletat'} />
            <Info label="Metodă contact" value={data.resident.preferredContactMethod || 'PHONE'} />
            <Info label="Status locatar" value={data.resident.status || 'NOT_INVITED'} />
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Apartamente legate</h2>
              <ButtonLink href={`/admin/residents/${data.resident.id}`} size="sm" variant="secondary">Vezi locatar</ButtonLink>
            </div>
            <div className="mt-3 space-y-2">
              {data.apartments.length ? data.apartments.map((apartment) => (
                <div key={`${apartment.apartmentId}-${apartment.role}`} className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">Ap. {apartment.apartmentNumber}</p>
                    {apartment.isPrimaryContact ? <Badge variant="success">Contact principal</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scara {apartment.staircase || '-'} · Etaj {apartment.floor || '-'} · {roleLabels[apartment.role || ''] || apartment.role || 'Rol necompletat'}
                  </p>
                </div>
              )) : (
                <p className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">Nu există apartamente legate.</p>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-foreground">Comparație date</h2>
          <p className="mt-1 text-sm text-muted-foreground">Verifică diferența înainte de aprobare sau respingere.</p>
          <div className="mt-4 space-y-3">
            {data.comparison.map((item) => (
              <div key={item.field} className="grid gap-3 rounded-2xl border border-border/70 p-3 md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
                </div>
                <Info label="Valoare actuală" value={item.currentValue || 'Necompletat'} />
                <Info label="Valoare solicitată" value={item.requestedValue || 'Necompletat'} strong />
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Mesaj locatar</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{data.request.message || 'Fără mesaj suplimentar.'}</p>
          </div>

          {data.request.adminResponse ? (
            <div className="mt-4 rounded-2xl border border-border/70 p-4">
              <h2 className="text-sm font-semibold text-foreground">Răspuns admin</h2>
              <p className="mt-2 text-sm text-muted-foreground">{data.request.adminResponse}</p>
              <p className="mt-2 text-xs text-muted-foreground">Review: {formatDate(data.request.reviewedAt)}</p>
            </div>
          ) : null}
        </Card>
      </section>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Context procesare</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.request.status === 'CANCELLED'
                ? `Solicitarea a fost anulată la ${formatDate(data.request.cancelledAt)}.`
                : data.request.status === 'PENDING'
                  ? 'Solicitarea poate fi aprobată sau respinsă.'
                  : `Solicitarea a fost procesată la ${formatDate(data.request.reviewedAt)}.`}
            </p>
          </div>
          {data.apartment ? (
            <ButtonLink href={`/admin/apartments/${data.apartment.id}`} variant="secondary">
              <Home className="h-4 w-4" /> Vezi apartament
            </ButtonLink>
          ) : null}
        </div>
      </Card>

      <Modal isOpen={approveOpen} onClose={() => setApproveOpen(false)} maxWidth="xl">
        <ModalHeader title="Aprobă solicitarea" onClose={() => setApproveOpen(false)} />
        <ModalBody className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm">
            <p className="font-semibold text-foreground">{typeLabel}</p>
            <p className="mt-1 text-muted-foreground">Locatar: {data.resident.fullName}</p>
            {data.comparison[0] ? (
              <p className="mt-2 text-muted-foreground">
                {data.comparison[0].currentValue} → <span className="font-semibold text-foreground">{data.comparison[0].requestedValue}</span>
              </p>
            ) : null}
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-border/70 p-3 text-sm">
            <input
              type="checkbox"
              checked={applyChangeNow}
              onChange={(event) => setApplyChangeNow(event.target.checked)}
              disabled={!isSimpleType(data.request.requestType)}
              className="mt-1"
            />
            <span>
              <span className="font-semibold text-foreground">Aplică modificarea acum</span>
              <span className="mt-1 block text-muted-foreground">
                {isSimpleType(data.request.requestType)
                  ? 'Pentru cererile simple, datele locatarului vor fi actualizate controlat.'
                  : 'Pentru relații apartament sau alte cereri, modificarea se procesează manual în fișa locatarului.'}
              </span>
            </span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Răspuns admin</span>
            <textarea
              value={adminResponse}
              onChange={(event) => setAdminResponse(event.target.value)}
              className="min-h-24 w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Note interne</span>
            <textarea
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
              className="min-h-20 w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
              placeholder="Opțional"
            />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
            <span>Am verificat datele și confirm aplicarea deciziei.</span>
          </label>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setApproveOpen(false)}>Renunță</Button>
          <Button onClick={approveRequest} isLoading={saving}>Confirmă aprobarea</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="xl">
        <ModalHeader title="Respinge solicitarea" onClose={() => setRejectOpen(false)} />
        <ModalBody className="space-y-4">
          <p className="text-sm text-muted-foreground">Locatarul va putea vedea răspunsul în profilul lui.</p>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Motiv respingere</span>
            <textarea
              value={adminResponse}
              onChange={(event) => setAdminResponse(event.target.value)}
              className="min-h-28 w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
              placeholder="Explică de ce solicitarea este respinsă."
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Note interne</span>
            <textarea
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
              className="min-h-20 w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
              placeholder="Opțional"
            />
          </label>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setRejectOpen(false)}>Renunță</Button>
          <Button variant="danger" onClick={rejectRequest} isLoading={saving}>Respinge solicitarea</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-1 break-words text-sm ${strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{value || 'Necompletat'}</p>
    </div>
  );
}
