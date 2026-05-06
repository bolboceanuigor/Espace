'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  Gauge,
  Home,
  MessageCircle,
  Plus,
  StickyNote,
  Users,
  Wrench,
} from 'lucide-react';
import { Badge, ButtonLink, Card, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { defaultLocale, isLocale } from '@/i18n';
import { apartmentsApi, metersApi, residentsApi } from '@/lib/api';
import {
  type AdminApartment,
  apartmentMeters,
  apartmentPayments,
  apartmentRequests,
  apartmentStatusVariant,
  findApartmentById,
  normalizeApiApartment,
  normalizeApiApartmentMeters,
  normalizeApiApartmentPayments,
  normalizeApiApartmentRequests,
  normalizeApiApartmentResidents,
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
  'Lipsă citire': 'warning',
} as const;

const requestVariant = {
  Nouă: 'default',
  'În lucru': 'warning',
  Rezolvată: 'success',
} as const;

const emptyResidentForm = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  role: 'RESIDENT' as 'OWNER' | 'RESIDENT' | 'TENANT' | 'FAMILY_MEMBER' | 'REPRESENTATIVE',
  isPrimary: false,
};

const roleLabels = {
  OWNER: 'Proprietar',
  RESIDENT: 'Locatar',
  TENANT: 'Chiriaș',
  FAMILY_MEMBER: 'Membru familie',
  REPRESENTATIVE: 'Reprezentant',
} as const;

const meterTypeLabels = {
  COLD_WATER: 'Apă rece',
  HOT_WATER: 'Apă caldă',
  GAS: 'Gaz',
  ELECTRICITY: 'Electricitate',
  HEATING: 'Încălzire',
} as const;

const meterStatusLabels = {
  ACTIVE: 'Actualizat',
  MISSING_READING: 'Lipsă citire',
  SUSPICIOUS: 'Suspect',
  INACTIVE: 'Inactiv',
} as const;

const emptyMeterForm = {
  type: 'COLD_WATER' as keyof typeof meterTypeLabels,
  serialNumber: '',
  status: 'ACTIVE' as keyof typeof meterStatusLabels,
};

export default function AdminApartmentDetailPage() {
  const params = useParams<{ id?: string; locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const id = typeof params?.id === 'string' ? params.id : '';
  const fallbackApartment = useMemo(() => findApartmentById(id), [id]);
  const [apartment, setApartment] = useState<AdminApartment>(fallbackApartment);
  const [apiDetail, setApiDetail] = useState<any>(null);
  const [source, setSource] = useState<'api' | 'mock'>('mock');
  const [residentModalOpen, setResidentModalOpen] = useState(false);
  const [residentForm, setResidentForm] = useState(emptyResidentForm);
  const [isCreatingResident, setIsCreatingResident] = useState(false);
  const [residentError, setResidentError] = useState('');
  const [meterModalOpen, setMeterModalOpen] = useState(false);
  const [meterForm, setMeterForm] = useState(emptyMeterForm);
  const [isCreatingMeter, setIsCreatingMeter] = useState(false);
  const [meterError, setMeterError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const residents = source === 'api' ? normalizeApiApartmentResidents(apiDetail) : residentsForApartment(apartment.number);
  const meters = source === 'api' ? normalizeApiApartmentMeters(apiDetail) : apartmentMeters;
  const payments = source === 'api' ? normalizeApiApartmentPayments(apiDetail) : apartmentPayments;
  const requests = source === 'api' ? normalizeApiApartmentRequests(apiDetail) : apartmentRequests;

  const loadApartment = useCallback(async () => {
    if (!id) return;
    const res = await apartmentsApi.get(id);
    setApiDetail(res.data);
    setApartment(normalizeApiApartment(res.data));
    setSource('api');
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    loadApartment()
      .then(() => {
        if (!active) return;
      })
      .catch(() => {
        if (!active) return;
        setApiDetail(null);
        setApartment(fallbackApartment);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, [fallbackApartment, id, loadApartment]);

  const createResident = async () => {
    setResidentError('');
    setSuccessMessage('');
    const organizationId = apiDetail?.organizationId || apartment.organizationId;
    const apartmentId = apiDetail?.id || apartment.id;
    if (!organizationId || source !== 'api') {
      setResidentError('Conectarea locatarului necesită date reale din API.');
      return;
    }
    if (!residentForm.firstName.trim() || !residentForm.lastName.trim()) {
      setResidentError('Completează prenumele și numele.');
      return;
    }

    setIsCreatingResident(true);
    try {
      const created = await residentsApi.create({
        organizationId,
        firstName: residentForm.firstName.trim(),
        lastName: residentForm.lastName.trim(),
        phone: residentForm.phone.trim(),
        email: residentForm.email.trim(),
        accountStatus: 'NO_ACCOUNT',
      });
      await apartmentsApi.linkResident(apartmentId, {
        residentId: created.data.id,
        role: residentForm.role,
        isPrimary: residentForm.isPrimary,
      });
      setResidentForm(emptyResidentForm);
      setResidentModalOpen(false);
      setSuccessMessage('Locatarul a fost creat și conectat la apartament.');
      await loadApartment().catch(() => undefined);
    } catch (error: any) {
      const message = String(error?.message || '');
      setResidentError(message.includes('deja conectată') ? 'Această persoană este deja conectată la apartament.' : 'Nu am putut crea locatarul.');
    } finally {
      setIsCreatingResident(false);
    }
  };

  const createMeter = async () => {
    setMeterError('');
    setSuccessMessage('');
    const organizationId = apiDetail?.organizationId || apartment.organizationId;
    const apartmentId = apiDetail?.id || apartment.id;
    if (!organizationId || source !== 'api') {
      setMeterError('Crearea contorului necesită date reale din API.');
      return;
    }
    if (!meterForm.serialNumber.trim()) {
      setMeterError('Completează seria contorului.');
      return;
    }

    setIsCreatingMeter(true);
    try {
      await metersApi.create({
        organizationId,
        apartmentId,
        type: meterForm.type,
        serialNumber: meterForm.serialNumber.trim(),
        status: meterForm.status,
      });
      setMeterForm(emptyMeterForm);
      setMeterModalOpen(false);
      setSuccessMessage('Contorul a fost creat.');
      await loadApartment().catch(() => undefined);
    } catch (error: any) {
      const message = String(error?.message || '');
      setMeterError(message.includes('Acest contor există deja') ? 'Acest contor există deja.' : 'Nu am putut crea contorul.');
    } finally {
      setIsCreatingMeter(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <Link href={`/${locale}/admin/apartments`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la apartamente
      </Link>

      <PageHeader
        title={`Apt. ${apartment.number}`}
        description={`${apartment.staircase} · Etaj ${apartment.floor} · ${apartment.areaM2} m² · ${apartment.rooms} camere`}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'api' ? 'Date reale' : 'Date demo'}
            </span>
            <Badge variant={apartmentStatusVariant[apartment.status]}>{apartment.status}</Badge>
          </div>
        }
      />

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total datorie" value={formatMdl(apartment.debt)} description={`Facturi neachitate: ${apartment.unpaidInvoices}`} icon={<Banknote className="h-5 w-5" />} tone={apartment.debt > 0 ? 'danger' : 'success'} />
        <StatCard label="Proprietar" value={apartment.owner} description={apartment.phone} icon={<Users className="h-5 w-5" />} tone="success" />
        <StatCard label="Contoare" value={`${apartment.metersUpdated} actualizate`} description={`${apartment.metersMissing} lipsă`} icon={<Gauge className="h-5 w-5" />} tone={apartment.metersMissing ? 'warning' : 'success'} />
        <StatCard label="Locatari" value={`${apartment.residents} persoane`} description="Persoane asociate apartamentului" icon={<Home className="h-5 w-5" />} tone="neutral" />
      </section>

      <Card>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <ButtonLink href={`/${locale}/admin/meters`} variant="primary"><Plus className="h-4 w-4" /> Adaugă citire</ButtonLink>
          <button type="button" onClick={() => setMeterModalOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-white px-4 text-sm font-semibold text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] hover:bg-muted/60">
            <Gauge className="h-4 w-4" /> Adaugă contor
          </button>
          <ButtonLink href={`/${locale}/admin/payments`} variant="secondary"><Banknote className="h-4 w-4" /> Adaugă plată</ButtonLink>
          <ButtonLink href={`/${locale}/admin/chat`} variant="secondary"><MessageCircle className="h-4 w-4" /> Trimite mesaj</ButtonLink>
          <button type="button" onClick={() => setResidentModalOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-white px-4 text-sm font-semibold text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] hover:bg-muted/60">
            <Users className="h-4 w-4" /> Adaugă locatar
          </button>
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
            {residents.map((person: any) => (
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
            {meters.map((meter: any) => (
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
            {payments.map((payment: any) => (
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
            {requests.map((request: any) => (
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

      <Modal isOpen={residentModalOpen} onClose={() => setResidentModalOpen(false)} maxWidth="2xl">
        <ModalHeader title={`Adaugă locatar la Apt. ${apartment.number}`} onClose={() => setResidentModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Prenume" value={residentForm.firstName} onChange={(value) => setResidentForm({ ...residentForm, firstName: value })} required />
            <Field label="Nume" value={residentForm.lastName} onChange={(value) => setResidentForm({ ...residentForm, lastName: value })} required />
            <Field label="Telefon" value={residentForm.phone} onChange={(value) => setResidentForm({ ...residentForm, phone: value })} />
            <Field label="Email" value={residentForm.email} onChange={(value) => setResidentForm({ ...residentForm, email: value })} type="email" />
            <label className="block">
              <span className="label">Rol</span>
              <select className="select" value={residentForm.role} onChange={(event) => setResidentForm({ ...residentForm, role: event.target.value as typeof residentForm.role })}>
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium text-foreground">
              <input type="checkbox" checked={residentForm.isPrimary} onChange={(event) => setResidentForm({ ...residentForm, isPrimary: event.target.checked })} />
              Este contact principal
            </label>
          </div>
          {residentError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {residentError}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setResidentModalOpen(false)} disabled={isCreatingResident} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={createResident} disabled={isCreatingResident} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {isCreatingResident ? 'Se creează...' : 'Creează locatar'}
          </button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={meterModalOpen} onClose={() => setMeterModalOpen(false)} maxWidth="xl">
        <ModalHeader title={`Adaugă contor la Apt. ${apartment.number}`} onClose={() => setMeterModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="label">Tip contor</span>
              <select className="select" value={meterForm.type} onChange={(event) => setMeterForm({ ...meterForm, type: event.target.value as typeof meterForm.type })}>
                {Object.entries(meterTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Status</span>
              <select className="select" value={meterForm.status} onChange={(event) => setMeterForm({ ...meterForm, status: event.target.value as typeof meterForm.status })}>
                {Object.entries(meterStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <Field label="Serie contor" value={meterForm.serialNumber} onChange={(value) => setMeterForm({ ...meterForm, serialNumber: value })} required />
          </div>
          {meterError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {meterError}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setMeterModalOpen(false)} disabled={isCreatingMeter} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={createMeter} disabled={isCreatingMeter} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {isCreatingMeter ? 'Se creează...' : 'Creează contor'}
          </button>
        </ModalFooter>
      </Modal>
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

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}{required ? ' *' : ''}</span>
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
