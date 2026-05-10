'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell, Building2, CheckCircle2, ClipboardList, Mail, Phone, Save, Send, UserRound } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, PageHeader } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type ContactMethod = 'PHONE' | 'EMAIL' | 'APP' | 'WHATSAPP' | 'TELEGRAM';
type UpdateRequestType =
  | 'FULL_NAME_CHANGE'
  | 'PHONE_CHANGE'
  | 'EMAIL_CHANGE'
  | 'CONTACT_METHOD_CHANGE'
  | 'APARTMENT_RELATION_CHANGE'
  | 'OTHER';

type ProfileResponse = {
  user: { id: string; fullName: string; email?: string | null };
  resident: {
    id: string;
    fullName: string;
    phone?: string | null;
    email?: string | null;
    preferredContactMethod: ContactMethod;
    status: string;
    createdAt?: string | null;
    updatedAt?: string | null;
  } | null;
  preferences: {
    preferredContactMethod: ContactMethod;
    receiveInvoiceNotifications: boolean;
    receivePaymentNotifications: boolean;
    receiveAnnouncementNotifications: boolean;
    receiveMaintenanceNotifications: boolean;
    language: string;
  };
  association: {
    id: string | null;
    shortName: string;
    associationCode?: string | null;
    address?: string | null;
  };
  apartments: Array<{
    id: string;
    apartmentNumber: string;
    staircase?: string | null;
    floor?: string | null;
    areaM2?: number | null;
    role: string;
    isPrimaryContact: boolean;
    relationStatus?: string | null;
  }>;
  recentUpdateRequests: UpdateRequest[];
};

type UpdateRequest = {
  id: string;
  requestType: UpdateRequestType;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  message?: string | null;
  adminResponse?: string | null;
  createdAt?: string | null;
  reviewedAt?: string | null;
  resolvedAt?: string | null;
};

const contactMethodLabels: Record<ContactMethod, string> = {
  PHONE: 'Telefon',
  EMAIL: 'Email',
  APP: 'Aplicație',
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
};

const requestTypeLabels: Record<UpdateRequestType, string> = {
  FULL_NAME_CHANGE: 'Schimbare nume',
  PHONE_CHANGE: 'Schimbare telefon',
  EMAIL_CHANGE: 'Schimbare email',
  CONTACT_METHOD_CHANGE: 'Schimbare metodă contact',
  APARTMENT_RELATION_CHANGE: 'Relație apartament',
  OTHER: 'Altă solicitare',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Activ',
  INVITED: 'Invitat',
  NOT_INVITED: 'Neinvitat',
  INACTIVE: 'Inactiv',
  PENDING: 'În așteptare',
  APPROVED: 'Aprobată',
  REJECTED: 'Respinsă',
  CANCELLED: 'Anulată',
};

const roleLabels: Record<string, string> = {
  OWNER: 'Proprietar',
  TENANT: 'Chiriaș',
  RESIDENT: 'Locatar',
  REPRESENTATIVE: 'Reprezentant',
  FAMILY_MEMBER: 'Membru familie',
};

const emptyPreferences = {
  preferredContactMethod: 'PHONE' as ContactMethod,
  receiveInvoiceNotifications: true,
  receivePaymentNotifications: true,
  receiveAnnouncementNotifications: true,
  receiveMaintenanceNotifications: true,
  language: 'ro',
};

const emptyRequestForm = {
  requestType: 'PHONE_CHANGE' as UpdateRequestType,
  requestedFullName: '',
  requestedPhone: '',
  requestedEmail: '',
  requestedPreferredContactMethod: 'PHONE' as ContactMethod,
  apartmentId: '',
  message: '',
};

function formatDate(value?: string | null) {
  if (!value) return 'Necompletat';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Necompletat';
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' });
}

function labelFromMap(map: Record<string, string>, value?: string | null, fallback = 'Necompletat') {
  if (!value) return fallback;
  return map[String(value).toUpperCase()] || value;
}

function optionalValue(value?: string | null) {
  return value && value.trim() ? value : 'Necompletat';
}

export default function ResidentProfilePage() {
  const localizedPath = useLocalizedPath();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [preferences, setPreferences] = useState(emptyPreferences);
  const [requestForm, setRequestForm] = useState(emptyRequestForm);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadProfile = () => {
    setLoading(true);
    setError('');
    residentDemoApi
      .profile()
      .then((response) => {
        const data = response.data as ProfileResponse;
        setProfile(data);
        setPreferences({ ...emptyPreferences, ...(data.preferences || {}) });
      })
      .catch(() => {
        setProfile(null);
        setError('Nu am putut încărca profilul.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const apartmentLabel = useMemo(() => {
    if (!profile?.apartments.length) return 'Fără apartament asociat';
    return profile.apartments.map((apartment) => `Apt. ${apartment.apartmentNumber}`).join(', ');
  }, [profile?.apartments]);

  const validateRequest = () => {
    if (requestForm.requestType === 'FULL_NAME_CHANGE' && !requestForm.requestedFullName.trim()) return 'Numele solicitat este obligatoriu.';
    if (requestForm.requestType === 'PHONE_CHANGE' && !requestForm.requestedPhone.trim()) return 'Telefonul solicitat este obligatoriu.';
    if (requestForm.requestType === 'EMAIL_CHANGE') {
      if (!requestForm.requestedEmail.trim()) return 'Emailul solicitat este obligatoriu.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestForm.requestedEmail.trim())) return 'Emailul nu este valid.';
    }
    if (requestForm.requestType === 'CONTACT_METHOD_CHANGE' && !requestForm.requestedPreferredContactMethod) return 'Metoda preferată este obligatorie.';
    if (requestForm.requestType === 'OTHER' && !requestForm.message.trim()) return 'Mesajul este obligatoriu.';
    return '';
  };

  const savePreferences = async () => {
    setSavingPreferences(true);
    setMessage('');
    setError('');
    try {
      const response = await residentDemoApi.updatePreferences(preferences);
      setPreferences({ ...emptyPreferences, ...(response.data?.preferences || preferences) });
      setMessage('Preferințele au fost salvate.');
      loadProfile();
    } catch {
      setError('Nu am putut salva preferințele.');
    } finally {
      setSavingPreferences(false);
    }
  };

  const submitRequest = async () => {
    const validation = validateRequest();
    if (validation) {
      setError(validation);
      return;
    }
    setSubmittingRequest(true);
    setMessage('');
    setError('');
    try {
      await residentDemoApi.createUpdateRequest({
        ...requestForm,
        apartmentId: requestForm.apartmentId || undefined,
      });
      setRequestForm(emptyRequestForm);
      setShowRequestForm(false);
      setMessage('Solicitarea a fost trimisă.');
      loadProfile();
    } catch {
      setError('Nu am putut trimite solicitarea.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const cancelRequest = async (id: string) => {
    setMessage('');
    setError('');
    try {
      await residentDemoApi.cancelUpdateRequest(id);
      setMessage('Solicitarea a fost anulată.');
      loadProfile();
    } catch {
      setError('Nu am putut anula solicitarea.');
    }
  };

  if (!loading && !profile?.resident) {
    return (
      <div className="space-y-5 pb-24 md:pb-6">
        <PageHeader title="Profilul meu" description="Vezi datele contului tău și preferințele de comunicare." />
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Profilul nu a fost găsit</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Contactează administratorul asociației pentru verificarea contului.
          </p>
          {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      <PageHeader
        title="Profilul meu"
        description="Vezi datele contului tău și preferințele de comunicare."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            {profile?.association.shortName ? <Badge variant="neutral">{profile.association.shortName}</Badge> : null}
            <Badge variant="neutral">{apartmentLabel}</Badge>
            {profile?.resident?.status ? <Badge variant="success">{labelFromMap(statusLabels, profile.resident.status)}</Badge> : null}
          </div>
        }
      />

      {loading ? <Card className="h-28 animate-pulse bg-muted/40" /> : null}
      {message ? <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</Card> : null}
      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</Card> : null}

      {profile?.resident ? (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[8px] bg-foreground text-xl font-semibold text-background">
                  {profile.resident.fullName.slice(0, 1)}
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{profile.resident.fullName}</p>
                  <p className="text-sm text-muted-foreground">{profile.association.shortName}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowRequestForm((value) => !value)}>
                  <Send className="h-4 w-4" />
                  Solicită actualizare date
                </Button>
                <Button type="button" onClick={savePreferences} isLoading={savingPreferences}>
                  <Save className="h-4 w-4" />
                  Salvează preferințe
                </Button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Info icon={<UserRound className="h-4 w-4" />} label="Nume complet" value={profile.resident.fullName} />
              <Info icon={<Phone className="h-4 w-4" />} label="Telefon" value={optionalValue(profile.resident.phone)} hint={!profile.resident.phone ? 'Poți solicita actualizarea datelor.' : undefined} />
              <Info icon={<Mail className="h-4 w-4" />} label="Email" value={optionalValue(profile.resident.email)} hint={!profile.resident.email ? 'Poți solicita actualizarea datelor.' : undefined} />
              <Info icon={<Bell className="h-4 w-4" />} label="Metodă contact" value={labelFromMap(contactMethodLabels, profile.resident.preferredContactMethod)} />
              <Info icon={<CheckCircle2 className="h-4 w-4" />} label="Status" value={labelFromMap(statusLabels, profile.resident.status)} />
              <Info icon={<ClipboardList className="h-4 w-4" />} label="Creat la" value={formatDate(profile.resident.createdAt)} />
              <Info icon={<ClipboardList className="h-4 w-4" />} label="Ultima actualizare" value={formatDate(profile.resident.updatedAt)} />
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-foreground">Preferințe contact</h2>
            <p className="mt-1 text-sm text-muted-foreground">Poți modifica doar preferințele simple. Datele personale se schimbă prin solicitare.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-foreground">
                Metodă preferată de contact
                <select
                  value={preferences.preferredContactMethod}
                  onChange={(event) => setPreferences((current) => ({ ...current, preferredContactMethod: event.target.value as ContactMethod }))}
                  className="h-10 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/25"
                >
                  {Object.entries(contactMethodLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-foreground">
                Limba interfeței
                <select
                  value={preferences.language}
                  onChange={(event) => setPreferences((current) => ({ ...current, language: event.target.value }))}
                  className="h-10 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/25"
                >
                  <option value="ro">Română</option>
                  <option value="ru">Rusă</option>
                </select>
              </label>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <PreferenceCheck label="Notificări facturi" checked={preferences.receiveInvoiceNotifications} onChange={(checked) => setPreferences((current) => ({ ...current, receiveInvoiceNotifications: checked }))} />
              <PreferenceCheck label="Notificări plăți" checked={preferences.receivePaymentNotifications} onChange={(checked) => setPreferences((current) => ({ ...current, receivePaymentNotifications: checked }))} />
              <PreferenceCheck label="Anunțuri A.P.C." checked={preferences.receiveAnnouncementNotifications} onChange={(checked) => setPreferences((current) => ({ ...current, receiveAnnouncementNotifications: checked }))} />
              <PreferenceCheck label="Lucrări și mentenanță" checked={preferences.receiveMaintenanceNotifications} onChange={(checked) => setPreferences((current) => ({ ...current, receiveMaintenanceNotifications: checked }))} />
            </div>
          </Card>

          {showRequestForm ? (
            <Card>
              <h2 className="text-base font-semibold text-foreground">Solicită actualizare date</h2>
              <p className="mt-1 text-sm text-muted-foreground">Cererea va fi trimisă administratorului. Datele nu se modifică automat.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field label="Tip solicitare">
                  <select
                    value={requestForm.requestType}
                    onChange={(event) => setRequestForm((current) => ({ ...current, requestType: event.target.value as UpdateRequestType }))}
                    className="h-10 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/25"
                  >
                    {Object.entries(requestTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Apartament">
                  <select
                    value={requestForm.apartmentId}
                    onChange={(event) => setRequestForm((current) => ({ ...current, apartmentId: event.target.value }))}
                    className="h-10 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/25"
                  >
                    <option value="">Fără apartament specific</option>
                    {profile.apartments.map((apartment) => (
                      <option key={apartment.id} value={apartment.id}>Apartament {apartment.apartmentNumber}</option>
                    ))}
                  </select>
                </Field>
                {requestForm.requestType === 'FULL_NAME_CHANGE' ? (
                  <Field label="Nume solicitat">
                    <TextInput value={requestForm.requestedFullName} onChange={(value) => setRequestForm((current) => ({ ...current, requestedFullName: value }))} />
                  </Field>
                ) : null}
                {requestForm.requestType === 'PHONE_CHANGE' ? (
                  <Field label="Telefon solicitat">
                    <TextInput value={requestForm.requestedPhone} onChange={(value) => setRequestForm((current) => ({ ...current, requestedPhone: value }))} placeholder="+373..." />
                  </Field>
                ) : null}
                {requestForm.requestType === 'EMAIL_CHANGE' ? (
                  <Field label="Email solicitat">
                    <TextInput value={requestForm.requestedEmail} onChange={(value) => setRequestForm((current) => ({ ...current, requestedEmail: value }))} placeholder="nume@example.com" />
                  </Field>
                ) : null}
                {requestForm.requestType === 'CONTACT_METHOD_CHANGE' ? (
                  <Field label="Metodă contact solicitată">
                    <select
                      value={requestForm.requestedPreferredContactMethod}
                      onChange={(event) => setRequestForm((current) => ({ ...current, requestedPreferredContactMethod: event.target.value as ContactMethod }))}
                      className="h-10 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/25"
                    >
                      {Object.entries(contactMethodLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </Field>
                ) : null}
                <Field label="Mesaj" className="md:col-span-2">
                  <textarea
                    value={requestForm.message}
                    onChange={(event) => setRequestForm((current) => ({ ...current, message: event.target.value }))}
                    rows={4}
                    className="w-full rounded-2xl border border-border/70 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                    placeholder="Scrie câteva detalii pentru administrator."
                  />
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={submitRequest} isLoading={submittingRequest}>
                  <Send className="h-4 w-4" />
                  Trimite solicitarea
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowRequestForm(false)}>Închide</Button>
              </div>
            </Card>
          ) : null}

          <Card>
            <h2 className="text-base font-semibold text-foreground">Apartamente asociate</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {profile.apartments.map((apartment) => (
                <div key={apartment.id} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">Apartament {apartment.apartmentNumber}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Scara {apartment.staircase || 'Necompletat'} · Etaj {apartment.floor || 'Necompletat'} · {apartment.areaM2 ? `${apartment.areaM2} m²` : 'suprafață necompletată'}
                      </p>
                    </div>
                    <Badge variant={apartment.isPrimaryContact ? 'success' : 'neutral'}>{apartment.isPrimaryContact ? 'Contact principal' : 'Contact secundar'}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <MiniInfo label="Rol" value={labelFromMap(roleLabels, apartment.role)} />
                    <MiniInfo label="Status relație" value={labelFromMap(statusLabels, apartment.relationStatus)} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ButtonLink href={`/resident/apartments/${apartment.id}`} variant="secondary" size="sm">Vezi apartament</ButtonLink>
                    <ButtonLink href={`/resident/invoices?apartmentId=${apartment.id}`} variant="secondary" size="sm">Vezi facturi</ButtonLink>
                    <ButtonLink href={`/resident/payments?apartmentId=${apartment.id}`} variant="secondary" size="sm">Vezi plăți</ButtonLink>
                  </div>
                </div>
              ))}
              {!profile.apartments.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm font-semibold text-amber-900">
                  Nu ai un apartament asociat contului. Contul tău trebuie legat de un apartament de către administrator pentru a vedea facturi și plăți.
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-foreground">Solicitări de actualizare</h2>
            <div className="mt-4 space-y-3">
              {profile.recentUpdateRequests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{requestTypeLabels[request.requestType]}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(request.createdAt)}</p>
                    </div>
                    <Badge variant={request.status === 'PENDING' ? 'warning' : request.status === 'APPROVED' ? 'success' : 'neutral'}>
                      {statusLabels[request.status]}
                    </Badge>
                  </div>
                  {request.message ? <p className="mt-2 text-sm text-muted-foreground">{request.message}</p> : null}
                  {request.adminResponse ? <p className="mt-2 text-sm font-medium text-foreground">Răspuns admin: {request.adminResponse}</p> : null}
                  {request.status === 'PENDING' ? (
                    <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => cancelRequest(request.id)}>
                      Anulează solicitarea
                    </Button>
                  ) : null}
                </div>
              ))}
              {!profile.recentUpdateRequests.length ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5 text-center">
                  <p className="text-sm font-semibold text-foreground">Nu ai solicitări trimise</p>
                  <p className="mt-1 text-sm text-muted-foreground">Solicitările de actualizare date vor apărea aici după ce le trimiți.</p>
                </div>
              ) : null}
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Link href={localizedPath('/resident/account')} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
              Setări cont și deconectare
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Info({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-medium text-foreground">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function PreferenceCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/25 px-4 text-sm font-semibold text-foreground">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-foreground"
      />
    </label>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`space-y-1 text-sm font-semibold text-foreground ${className}`.trim()}>
      {label}
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder = '' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/25"
    />
  );
}
