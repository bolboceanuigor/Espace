'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Clock3, Mail, MessageCircle, Phone, Plus, Search, StickyNote, Upload, UserRound, Users, UserX, Wrench } from 'lucide-react';
import { Badge, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { apartmentsApi, issuesApi, residentsApi } from '@/lib/api';
import { accountStatusVariant, adminResidents, normalizeApiApartment, normalizeApiResident, type AdminApartment } from '@/lib/admin-mvp-data';
import { useLocalizedPath } from '@/lib/use-localized-path';

const emptyForm = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  apartmentId: '',
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

type ResidentCrmStat = {
  openIssues: number;
  lastActivity: string;
};

function normalizedText(value: string) {
  return value.trim().toLowerCase();
}

function issueBelongsToResident(issue: any, resident: { id: string; name: string }) {
  const issueResidentId = String(issue?.residentId || issue?.residentProfileId || issue?.resident?.id || issue?.residentProfile?.id || '');
  if (issueResidentId && issueResidentId === resident.id) return true;
  const issueResidentName = normalizedText(
    String(
      issue?.residentName ||
        issue?.resident?.name ||
        issue?.resident?.fullName ||
        [issue?.resident?.firstName, issue?.resident?.lastName].filter(Boolean).join(' '),
    ),
  );
  return Boolean(issueResidentName && issueResidentName === normalizedText(resident.name));
}

function isIssueOpen(issue: any) {
  const status = String(issue?.status || '').toUpperCase();
  return !['RESOLVED', 'CLOSED', 'REZOLVATĂ', 'REZOLVATA'].includes(status);
}

function formatActivityDate(value?: string) {
  if (!value) return 'Nu există activitate recentă';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nu există activitate recentă';
  return date.toLocaleDateString('ro-RO');
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidMoldovaPhone(value: string) {
  const normalized = value.replace(/[\s().-]/g, '');
  return /^\+373\d{8}$/.test(normalized) || /^0\d{8}$/.test(normalized);
}

export default function AdminResidentsPage() {
  const localizedPath = useLocalizedPath();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('toate');
  const [account, setAccount] = useState('toate');
  const [withDebt, setWithDebt] = useState(false);
  const [withOpenIssues, setWithOpenIssues] = useState(false);
  const [staircase, setStaircase] = useState('toate');
  const [rows, setRows] = useState<typeof adminResidents>([]);
  const [apartments, setApartments] = useState<AdminApartment[]>([]);
  const [crmStats, setCrmStats] = useState<Record<string, ResidentCrmStat>>({});
  const [source, setSource] = useState<'loading' | 'api' | 'mock'>('loading');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadResidents = async () => {
    const [residentsRes, apartmentsRes] = await Promise.all([
      residentsApi.list(),
      apartmentsApi.list(),
    ]);
    const issuesRes = await issuesApi.list().catch(() => ({ data: [] }));
    const apiRows = (residentsRes.data || []).map(normalizeApiResident);
    const apiApartments = (apartmentsRes.data || []).map(normalizeApiApartment);
    const issues = issuesRes.data || [];
    setRows(apiRows);
    setSource('api');
    setApartments(apiApartments);
    setCrmStats(Object.fromEntries(apiRows.map((resident) => {
      const residentIssues = issues.filter((issue: any) => issueBelongsToResident(issue, resident));
      const openIssues = residentIssues.filter(isIssueOpen).length;
      const lastDate = residentIssues
        .map((issue: any) => String(issue.updatedAt || issue.createdAt || ''))
        .filter(Boolean)
        .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0];
      return [resident.id, { openIssues, lastActivity: formatActivityDate(lastDate) }];
    })));
    setForm((current) => {
      if (current.apartmentId || !apiApartments[0]?.id) return current;
      return { ...current, apartmentId: apiApartments[0].id };
    });
  };

  useEffect(() => {
    let active = true;
    loadResidents().catch(() => {
      if (!active) return;
      setRows(adminResidents);
      setApartments([]);
      setCrmStats({});
      setSource('mock');
    });
    return () => {
      active = false;
    };
  }, []);

  const apartmentStaircaseByNumber = useMemo(() => {
    return new Map(apartments.map((apartment) => [String(apartment.number), String(apartment.staircase || '')]));
  }, [apartments]);

  const staircaseOptions = useMemo(() => {
    const values = Array.from(new Set(apartments.map((apartment) => String(apartment.staircase || '')).filter(Boolean)));
    return ['toate', ...values];
  }, [apartments]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((person) => {
      const matchesQuery = !needle || `${person.name} ${person.phone} ${person.email} ${person.apartments.join(' ')}`.toLowerCase().includes(needle);
      const matchesRole = role === 'toate' || person.role === role;
      const matchesAccount = account === 'toate' || person.accountStatus === account;
      const matchesDebt = !withDebt || person.debt > 0;
      const matchesOpenIssues = !withOpenIssues || (crmStats[person.id]?.openIssues ?? 0) > 0;
      const matchesStaircase =
        staircase === 'toate' ||
        person.apartments.some((number) => apartmentStaircaseByNumber.get(String(number)) === staircase);
      return matchesQuery && matchesRole && matchesAccount && matchesDebt && matchesOpenIssues && matchesStaircase;
    });
  }, [account, apartmentStaircaseByNumber, crmStats, query, role, rows, staircase, withDebt, withOpenIssues]);

  const totals = useMemo(() => ({
    total: rows.length,
    owners: rows.filter((person) => person.role === 'proprietar').length,
    withoutAccount: rows.filter((person) => person.accountStatus === 'fără cont').length,
    withDebt: rows.filter((person) => person.debt > 0).length,
  }), [rows]);

  const createResident = async () => {
    setFormError('');
    setSuccessMessage('');
    const selectedApartment = apartments.find((item) => item.id === form.apartmentId);
    if (!selectedApartment?.organizationId) {
      setFormError('Alege un apartament real din lista API.');
      return;
    }
    if (!form.firstName.trim()) {
      setFormError('Prenumele este obligatoriu.');
      return;
    }
    if (!form.lastName.trim()) {
      setFormError('Numele este obligatoriu.');
      return;
    }
    if (form.phone.trim() && !isValidMoldovaPhone(form.phone.trim())) {
      setFormError('Telefonul nu este valid. Format recomandat: +373 6X XXX XXX');
      return;
    }
    if (form.email.trim() && !isValidEmail(form.email.trim())) {
      setFormError('Emailul nu este valid.');
      return;
    }

    setIsCreating(true);
    try {
      const created = await residentsApi.create({
        organizationId: selectedApartment.organizationId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        accountStatus: 'NO_ACCOUNT',
      });
      await apartmentsApi.linkResident(selectedApartment.id, {
        residentId: created.data.id,
        role: form.role,
        isPrimary: form.isPrimary,
      });
      setForm({ ...emptyForm, apartmentId: selectedApartment.id });
      setModalOpen(false);
      setSuccessMessage('Locatarul a fost creat și conectat la apartament.');
      await loadResidents();
    } catch (error: any) {
      const message = String(error?.message || '');
      setFormError(message || 'Nu am putut crea locatarul.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Locatari"
        description="CRM pentru locatari: profil, apartamente, datorii, cereri, cont și ultimul contact."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
            </span>
            <Link href={localizedPath('/admin/imports/apartments')} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60">
              <Upload className="h-4 w-4" />
              Importă locatari
            </Link>
            <button type="button" onClick={() => setModalOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background">
              <Plus className="h-4 w-4" />
              Adaugă locatar
            </button>
          </div>
        }
      />
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      ) : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total persoane" value={totals.total} description="Persoane asociate apartamentelor" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Proprietari" value={totals.owners} description="Persoane cu rol proprietar" icon={<UserRound className="h-5 w-5" />} tone="success" />
        <StatCard label="Fără cont creat" value={totals.withoutAccount} description="Necesită invitație" icon={<UserX className="h-5 w-5" />} tone="warning" />
        <StatCard label="Cu datorii" value={totals.withDebt} description="Datorie pe apartament" icon={<MessageCircle className="h-5 w-5" />} tone="danger" />
      </section>
      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută nume, telefon, email sau apartament" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Select value={role} onChange={setRole} options={['toate', 'proprietar', 'locatar', 'chiriaș', 'membru familie', 'reprezentant']} />
          <Select value={account} onChange={setAccount} options={['toate', 'cont creat', 'invitat', 'fără cont']} />
          <Select value={staircase} onChange={setStaircase} options={staircaseOptions} />
          <label className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium text-foreground">
            <input type="checkbox" checked={withDebt} onChange={(event) => setWithDebt(event.target.checked)} />
            Cu datorii
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium text-foreground">
            <input type="checkbox" checked={withOpenIssues} onChange={(event) => setWithOpenIssues(event.target.checked)} />
            Cu cereri
          </label>
        </div>
      </Card>
      <section className="grid gap-3 lg:grid-cols-2">
        {filtered.map((person) => (
          <Card key={person.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">{person.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{person.role} · Apt. {person.apartments.join(', ')}</p>
              </div>
              <Badge variant={accountStatusVariant[person.accountStatus]}>{person.accountStatus}</Badge>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" />{person.phone}</span>
              <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" />{person.email}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
              <p className={person.debt > 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-700'}>{formatMdl(person.debt)}</p>
              <div className="flex flex-wrap gap-2">
                <Link href={localizedPath(`/admin/residents/${person.id}`)} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">Profil</Link>
                {person.accountStatus !== 'cont creat' ? (
                  <Link href={localizedPath(`/admin/residents/${person.id}`)} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">Invită</Link>
                ) : null}
                <Link href={localizedPath('/admin/payments')} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">Plată</Link>
                <Link href={localizedPath('/admin/issues')} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">Cerere</Link>
              </div>
            </div>
            <div className="mt-4 grid gap-2 border-t border-border/60 pt-3 text-sm text-muted-foreground sm:grid-cols-3">
              <span className="inline-flex items-center gap-2 rounded-2xl bg-muted/35 px-3 py-2">
                <Wrench className="h-4 w-4" />
                {crmStats[person.id]?.openIssues ?? 0} cereri deschise
              </span>
              <span className="inline-flex items-center gap-2 rounded-2xl bg-muted/35 px-3 py-2">
                <Clock3 className="h-4 w-4" />
                {crmStats[person.id]?.lastActivity || 'Nu există activitate recentă'}
              </span>
              <span className="inline-flex items-center gap-2 rounded-2xl bg-muted/35 px-3 py-2">
                <StickyNote className="h-4 w-4" />
                Note interne: în lucru
              </span>
            </div>
          </Card>
        ))}
        {source === 'loading' ? <Card className="p-5 text-sm font-medium text-muted-foreground">Se încarcă datele...</Card> : null}
        {source !== 'loading' && !filtered.length ? <Card className="p-5 text-sm font-medium text-muted-foreground">Nu există locatari încă. Adaugă primul locatar.</Card> : null}
      </section>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="2xl">
        <ModalHeader title="Adaugă locatar" onClose={() => setModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Prenume" value={form.firstName} onChange={(value) => setForm({ ...form, firstName: value })} required />
            <Field label="Nume" value={form.lastName} onChange={(value) => setForm({ ...form, lastName: value })} required />
            <Field label="Telefon" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
            <Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} type="email" />
            <label className="block">
              <span className="label">Apartament</span>
              <select className="select" value={form.apartmentId} onChange={(event) => setForm({ ...form, apartmentId: event.target.value })}>
                <option value="">Alege apartamentul</option>
                {apartments.map((apartment) => (
                  <option key={apartment.id} value={apartment.id}>Apt. {apartment.number} · {apartment.staircase}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Rol</span>
              <select className="select" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as typeof form.role })}>
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium text-foreground md:col-span-2">
              <input type="checkbox" checked={form.isPrimary} onChange={(event) => setForm({ ...form, isPrimary: event.target.checked })} />
              Este contact principal
            </label>
          </div>
          {formError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {formError}
            </p>
          ) : null}
          <p className="mt-4 text-xs text-muted-foreground">
            Crearea necesită API real. Datele temporare apar doar dacă API-ul este indisponibil.
          </p>
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setModalOpen(false)} disabled={isCreating} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={createResident} disabled={isCreating} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {isCreating ? 'Se creează...' : 'Creează locatar'}
          </button>
        </ModalFooter>
      </Modal>
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

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <select className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((item) => <option key={item} value={item}>{item === 'toate' ? 'Toate' : item}</option>)}
    </select>
  );
}
