'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader } from '@/components/ui';
import {
  associationOnboardingApi,
  type AssociationOnboardingApartment,
  type AssociationOnboardingResident,
  type AssociationOnboardingStepOne,
} from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type StepId = 0 | 1 | 2 | 3 | 4 | 5;
type ApartmentStatus = AssociationOnboardingApartment['status'];
type ResidentRole = AssociationOnboardingResident['role'];
type ResidentStatus = AssociationOnboardingResident['status'];
type ContactMethod = AssociationOnboardingResident['preferredContactMethod'];

type StepOneState = AssociationOnboardingStepOne;
type StructureState = {
  buildingsCount: string;
  staircasesCount: string;
  floorsCount: string;
  apartmentsCount: string;
  constructionYear: string;
  internalNotes: string;
};
type ApartmentRow = {
  id?: string;
  apartmentNumber: string;
  building: string;
  entrance: string;
  floor: string;
  areaM2: string;
  rooms: string;
  cadastralNumber: string;
  status: ApartmentStatus;
};
type ResidentRow = {
  residentId?: string;
  apartmentId?: string;
  apartmentNumber: string;
  building: string;
  entrance: string;
  fullName: string;
  phone: string;
  email: string;
  role: ResidentRole;
  isPrimaryContact: boolean;
  preferredContactMethod: ContactMethod;
  status: ResidentStatus;
};

const steps = [
  'Date A.P.C.',
  'Structura blocului',
  'Apartamente',
  'Locatari',
  'Tarife',
  'Review',
] as const;

const emptyStepOne: StepOneState = {
  legalName: '',
  shortName: '',
  associationCode: '',
  internalNumber: '',
  fiscalCode: '',
  address: '',
  city: 'Chișinău',
  country: 'Republica Moldova',
  status: 'DRAFT',
};

const emptyStructure: StructureState = {
  buildingsCount: '1',
  staircasesCount: '4',
  floorsCount: '9',
  apartmentsCount: '142',
  constructionYear: '',
  internalNotes: '',
};

const defaultTariffs = {
  deservireBlocPerM2: '2.85',
  fondReparatiePerM2: '0.50',
  fondInvestitiiPerApartment: '60',
};

const defaultRanges = [
  { entrance: '1', from: '1', to: '30' },
  { entrance: '2', from: '31', to: '60' },
  { entrance: '3', from: '61', to: '100' },
  { entrance: '4', from: '101', to: '142' },
];

function normalizeAssociationCode(value: string) {
  return value.trim().toUpperCase();
}

function legalNameForCode(code: string) {
  return code ? `Asociația de Proprietari din Condominiu ${code}` : '';
}

function shortNameForCode(code: string) {
  return code ? `A.P.C. ${code}` : '';
}

function associationNumberFromCode(code: string) {
  return code.match(/-(\d{4})$/)?.[1] || '';
}

function toNumberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMdl(value: number) {
  return new Intl.NumberFormat('ro-MD', {
    style: 'currency',
    currency: 'MDL',
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function AssociationOnboardingWizard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const localizedPath = useLocalizedPath();
  const queryId = searchParams.get('id') || '';
  const [onboardingId, setOnboardingId] = useState(queryId);
  const [activeStep, setActiveStep] = useState<StepId>(0);
  const [stepOne, setStepOne] = useState<StepOneState>(emptyStepOne);
  const [structure, setStructure] = useState<StructureState>(emptyStructure);
  const [apartments, setApartments] = useState<ApartmentRow[]>([]);
  const [residents, setResidents] = useState<ResidentRow[]>([]);
  const [tariffs, setTariffs] = useState(defaultTariffs);
  const [ranges, setRanges] = useState(defaultRanges);
  const [isLoading, setIsLoading] = useState(Boolean(queryId));
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!queryId) return;
    setOnboardingId(queryId);
    setIsLoading(true);
    associationOnboardingApi
      .get(queryId)
      .then((res) => applyBackendState(res.data))
      .catch((err: any) => setError(String(err?.message || 'Nu am putut încărca onboarding-ul.')))
      .finally(() => setIsLoading(false));
  }, [queryId]);

  const summary = useMemo(() => {
    const totalAreaM2 = apartments.reduce((sum, apartment) => sum + Number(toNumberOrNull(apartment.areaM2) || 0), 0);
    const totalResidents = residents.filter((resident) => resident.fullName.trim()).length;
    return {
      totalStaircases: Number(structure.staircasesCount || 0),
      totalApartments: apartments.length,
      totalAreaM2,
      totalResidents,
      tariffsConfigured: Number(tariffs.deservireBlocPerM2) > 0 || Number(tariffs.fondReparatiePerM2) > 0 || Number(tariffs.fondInvestitiiPerApartment) > 0,
    };
  }, [apartments, residents, structure.staircasesCount, tariffs]);

  function applyBackendState(data: any) {
    if (!data) return;
    setOnboardingId(String(data.id || ''));
    setStepOne({
      legalName: data.association?.legalName || '',
      shortName: data.association?.shortName || '',
      associationCode: data.association?.associationCode || '',
      internalNumber: data.association?.internalNumber || '',
      fiscalCode: data.association?.fiscalCode || '',
      address: data.association?.address || '',
      city: data.association?.city || 'Chișinău',
      country: data.association?.country || 'Republica Moldova',
      status: data.association?.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
    });
    setStructure({
      buildingsCount: String(data.structure?.buildingsCount || '1'),
      staircasesCount: String(data.structure?.staircasesCount || '4'),
      floorsCount: String(data.structure?.floorsCount || '9'),
      apartmentsCount: String(data.structure?.apartmentsCount || '142'),
      constructionYear: String(data.structure?.constructionYear || ''),
      internalNotes: data.structure?.internalNotes || '',
    });
    setApartments(
      (data.apartments || []).map((apartment: any) => ({
        id: apartment.id,
        apartmentNumber: String(apartment.apartmentNumber || ''),
        building: String(apartment.building || 'Bloc principal'),
        entrance: String(apartment.entrance || ''),
        floor: apartment.floor === null || apartment.floor === undefined ? '' : String(apartment.floor),
        areaM2: apartment.areaM2 === null || apartment.areaM2 === undefined ? '' : String(apartment.areaM2),
        rooms: apartment.rooms === null || apartment.rooms === undefined ? '' : String(apartment.rooms),
        cadastralNumber: apartment.cadastralNumber || '',
        status: ['VACANT', 'OCCUPIED', 'UNKNOWN'].includes(apartment.status) ? apartment.status : 'UNKNOWN',
      })),
    );
    setResidents(
      (data.residents || []).map((resident: any) => ({
        residentId: resident.residentId,
        apartmentId: resident.apartmentId,
        apartmentNumber: String(resident.apartmentNumber || ''),
        building: String(resident.building || 'Bloc principal'),
        entrance: String(resident.entrance || ''),
        fullName: String(resident.fullName || ''),
        phone: String(resident.phone || ''),
        email: String(resident.email || ''),
        role: ['OWNER', 'TENANT', 'REPRESENTATIVE'].includes(resident.role) ? resident.role : 'OWNER',
        isPrimaryContact: Boolean(resident.isPrimaryContact),
        preferredContactMethod: ['PHONE', 'EMAIL', 'APP', 'WHATSAPP', 'TELEGRAM'].includes(resident.preferredContactMethod)
          ? resident.preferredContactMethod
          : 'PHONE',
        status: ['INVITED', 'ACTIVE', 'NOT_INVITED'].includes(resident.status) ? resident.status : 'NOT_INVITED',
      })),
    );
    setTariffs({
      deservireBlocPerM2: String(data.tariffs?.deservireBlocPerM2 ?? '2.85'),
      fondReparatiePerM2: String(data.tariffs?.fondReparatiePerM2 ?? '0.50'),
      fondInvestitiiPerApartment: String(data.tariffs?.fondInvestitiiPerApartment ?? '60'),
    });
  }

  function validateStepOne() {
    const code = normalizeAssociationCode(stepOne.associationCode);
    if (!stepOne.legalName.trim()) return 'Denumirea lungă este obligatorie.';
    if (!stepOne.shortName.trim()) return 'Denumirea scurtă este obligatorie.';
    if (!code) return 'Codul A.P.C. este obligatoriu.';
    if (!/^A\d{4}-\d{4}$/.test(code)) return 'Format recomandat: A0123-0940.';
    if (!stepOne.address.trim()) return 'Adresa este obligatorie.';
    return '';
  }

  function validateStructure() {
    if (Number(structure.apartmentsCount) <= 0) return 'Total apartamente trebuie să fie mai mare decât 0.';
    if (Number(structure.staircasesCount) <= 0) return 'Numărul de scări trebuie să fie pozitiv.';
    if (Number(structure.floorsCount) <= 0) return 'Numărul de etaje trebuie să fie pozitiv.';
    return '';
  }

  function validateApartments() {
    if (!apartments.length) return 'Adaugă sau generează apartamente înainte de activare.';
    const seen = new Set<string>();
    for (const apartment of apartments) {
      if (!apartment.apartmentNumber.trim()) return 'Numărul apartamentului este obligatoriu.';
      if (!apartment.entrance.trim()) return 'Scara este obligatorie.';
      const key = `${apartment.building.trim().toLowerCase()}-${apartment.entrance.trim().toLowerCase()}-${apartment.apartmentNumber.trim().toLowerCase()}`;
      if (seen.has(key)) return 'Apartamentele nu trebuie să aibă numere duplicate în aceeași asociație.';
      seen.add(key);
      const area = toNumberOrNull(apartment.areaM2);
      if (apartment.areaM2.trim() && (!area || area <= 0)) return 'Suprafața m² trebuie să fie pozitivă dacă este introdusă.';
    }
    return '';
  }

  function validateResidents() {
    for (const resident of residents) {
      const hasData = Object.values(resident).some((value) => String(value ?? '').trim());
      if (hasData && !resident.fullName.trim()) return 'Numele locatarului este obligatoriu.';
    }
    return '';
  }

  function validateTariffs() {
    if (Number(tariffs.deservireBlocPerM2) < 0 || Number(tariffs.fondReparatiePerM2) < 0 || Number(tariffs.fondInvestitiiPerApartment) < 0) {
      return 'Tarifele trebuie să fie numere pozitive.';
    }
    return '';
  }

  async function saveCurrentStep() {
    setError('');
    setSuccess('');
    setIsSaving(true);
    try {
      let result: any;
      if (activeStep === 0) {
        const validation = validateStepOne();
        if (validation) throw new Error(validation);
        const payload = {
          ...stepOne,
          associationCode: normalizeAssociationCode(stepOne.associationCode),
          internalNumber: associationNumberFromCode(stepOne.associationCode),
          country: 'Republica Moldova',
        };
        result = onboardingId
          ? await associationOnboardingApi.updateStepOne(onboardingId, payload)
          : await associationOnboardingApi.start(payload);
        if (!onboardingId) {
          const nextId = result.data?.id;
          setOnboardingId(nextId);
          router.replace(`${pathname}?id=${nextId}`);
        }
      }
      if (activeStep === 1) {
        if (!onboardingId) throw new Error('Salvează datele A.P.C. înainte de acest pas.');
        const validation = validateStructure();
        if (validation) throw new Error(validation);
        result = await associationOnboardingApi.updateStepTwo(onboardingId, {
          buildingsCount: Number(structure.buildingsCount),
          staircasesCount: Number(structure.staircasesCount),
          floorsCount: Number(structure.floorsCount),
          apartmentsCount: Number(structure.apartmentsCount),
          constructionYear: structure.constructionYear ? Number(structure.constructionYear) : null,
          internalNotes: structure.internalNotes,
        });
      }
      if (activeStep === 2) {
        if (!onboardingId) throw new Error('Salvează datele A.P.C. înainte de apartamente.');
        const validation = validateApartments();
        if (validation) throw new Error(validation);
        result = await associationOnboardingApi.updateApartments(onboardingId, apartments.map(toApartmentPayload));
      }
      if (activeStep === 3) {
        if (!onboardingId) throw new Error('Salvează datele A.P.C. înainte de locatari.');
        const validation = validateResidents();
        if (validation) throw new Error(validation);
        result = await associationOnboardingApi.updateResidents(onboardingId, residents.map(toResidentPayload).filter((row) => row.fullName.trim()));
      }
      if (activeStep === 4) {
        if (!onboardingId) throw new Error('Salvează datele A.P.C. înainte de tarife.');
        const validation = validateTariffs();
        if (validation) throw new Error(validation);
        result = await associationOnboardingApi.updateTariffs(onboardingId, {
          deservireBlocPerM2: Number(tariffs.deservireBlocPerM2 || 0),
          fondReparatiePerM2: Number(tariffs.fondReparatiePerM2 || 0),
          fondInvestitiiPerApartment: Number(tariffs.fondInvestitiiPerApartment || 0),
          otherFixedServices: [],
        });
      }
      if (result?.data) applyBackendState(result.data);
      setSuccess('Draftul a fost salvat.');
      return true;
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut salva draftul.'));
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function saveAndNext() {
    const ok = await saveCurrentStep();
    if (ok && activeStep < 5) setActiveStep((activeStep + 1) as StepId);
  }

  async function activateAssociation() {
    if (!onboardingId) {
      setError('Salvează draftul înainte de activare.');
      return;
    }
    setError('');
    setSuccess('');
    setIsActivating(true);
    try {
      const res = await associationOnboardingApi.activate(onboardingId);
      setSuccess('Asociația a fost activată.');
      router.push(localizedPath(`/superadmin/associations/${res.data?.id || onboardingId}`));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut activa asociația.'));
    } finally {
      setIsActivating(false);
    }
  }

  function generateApartments() {
    const floors = Math.max(1, Number(structure.floorsCount || 1));
    const generated: ApartmentRow[] = [];
    for (const range of ranges) {
      const from = Number(range.from);
      const to = Number(range.to);
      if (!range.entrance.trim() || !Number.isFinite(from) || !Number.isFinite(to) || to < from) continue;
      const count = to - from + 1;
      const apartmentsPerFloor = Math.max(1, Math.ceil(count / floors));
      for (let number = from; number <= to; number += 1) {
        const index = number - from;
        generated.push({
          apartmentNumber: String(number),
          building: 'Bloc principal',
          entrance: range.entrance.trim(),
          floor: String(Math.min(floors, Math.ceil((index + 1) / apartmentsPerFloor))),
          areaM2: '',
          rooms: '',
          cadastralNumber: '',
          status: 'UNKNOWN',
        });
      }
    }
    setApartments(generated);
    setSuccess(`${generated.length} apartamente au fost generate. Poți edita manual fiecare rând.`);
  }

  function toApartmentPayload(row: ApartmentRow): AssociationOnboardingApartment {
    return {
      id: row.id,
      apartmentNumber: row.apartmentNumber.trim(),
      building: row.building.trim() || 'Bloc principal',
      entrance: row.entrance.trim(),
      floor: toNumberOrNull(row.floor),
      areaM2: toNumberOrNull(row.areaM2),
      rooms: toNumberOrNull(row.rooms),
      cadastralNumber: row.cadastralNumber.trim(),
      status: row.status,
    };
  }

  function toResidentPayload(row: ResidentRow): AssociationOnboardingResident {
    return {
      residentId: row.residentId,
      apartmentId: row.apartmentId,
      apartmentNumber: row.apartmentNumber.trim(),
      building: row.building.trim() || 'Bloc principal',
      entrance: row.entrance.trim(),
      fullName: row.fullName.trim(),
      phone: row.phone.trim(),
      email: row.email.trim(),
      role: row.role,
      isPrimaryContact: row.isPrimaryContact,
      preferredContactMethod: row.preferredContactMethod,
      status: row.status,
    };
  }

  function updateApartment(index: number, patch: Partial<ApartmentRow>) {
    setApartments((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function updateResident(index: number, patch: Partial<ResidentRow>) {
    setResidents((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addApartment() {
    setApartments((current) => [
      ...current,
      { apartmentNumber: '', building: 'Bloc principal', entrance: '1', floor: '', areaM2: '', rooms: '', cadastralNumber: '', status: 'UNKNOWN' },
    ]);
  }

  function addResident(apartment?: ApartmentRow) {
    setResidents((current) => [
      ...current,
      {
        apartmentId: apartment?.id,
        apartmentNumber: apartment?.apartmentNumber || '',
        building: apartment?.building || 'Bloc principal',
        entrance: apartment?.entrance || '',
        fullName: '',
        phone: '',
        email: '',
        role: 'OWNER',
        isPrimaryContact: true,
        preferredContactMethod: 'PHONE',
        status: 'NOT_INVITED',
      },
    ]);
  }

  if (isLoading) {
    return <Card className="p-6 text-sm font-semibold text-muted-foreground">Se încarcă onboarding-ul...</Card>;
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Onboarding A.P.C."
        description="Activează prima asociație reală: date A.P.C., structură, apartamente, locatari și tarife inițiale."
      />

      <Card className="overflow-hidden p-0">
        <div className="grid gap-0 md:grid-cols-6">
          {steps.map((label, index) => {
            const active = index === activeStep;
            const done = index < activeStep;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setActiveStep(index as StepId)}
                className={`flex min-h-16 items-center gap-3 border-b border-border/70 px-4 text-left md:border-b-0 md:border-r ${
                  active ? 'bg-foreground text-background' : done ? 'bg-emerald-50 text-emerald-800' : 'bg-white text-muted-foreground'
                }`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? 'bg-white text-foreground' : 'bg-muted text-foreground'}`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </span>
                <span className="text-sm font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      {activeStep === 0 ? (
        <StepCard title="Date A.P.C." description="Codul A.P.C. generează automat denumirea lungă, denumirea scurtă și numărul intern.">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Cod A.P.C."
              value={stepOne.associationCode}
              placeholder="A0123-0940"
              onChange={(event) => {
                const code = normalizeAssociationCode(event.target.value);
                const previousCode = normalizeAssociationCode(stepOne.associationCode);
                setStepOne({
                  ...stepOne,
                  associationCode: code,
                  internalNumber: associationNumberFromCode(code),
                  legalName: !stepOne.legalName || stepOne.legalName === legalNameForCode(previousCode) ? legalNameForCode(code) : stepOne.legalName,
                  shortName: !stepOne.shortName || stepOne.shortName === shortNameForCode(previousCode) ? shortNameForCode(code) : stepOne.shortName,
                });
              }}
            />
            <Input label="Număr intern" value={stepOne.internalNumber || associationNumberFromCode(stepOne.associationCode)} disabled />
            <Input label="Denumire lungă" value={stepOne.legalName} onChange={(event) => setStepOne({ ...stepOne, legalName: event.target.value })} />
            <Input label="Denumire scurtă" value={stepOne.shortName} onChange={(event) => setStepOne({ ...stepOne, shortName: event.target.value })} />
            <Input label="IDNO / cod fiscal" hint="Opțional, dacă există deja." value={stepOne.fiscalCode || ''} onChange={(event) => setStepOne({ ...stepOne, fiscalCode: event.target.value })} />
            <Input label="Oraș" value={stepOne.city} onChange={(event) => setStepOne({ ...stepOne, city: event.target.value })} />
            <Input label="Adresă" value={stepOne.address} onChange={(event) => setStepOne({ ...stepOne, address: event.target.value })} />
            <Input label="Țară" value={stepOne.country} disabled />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Status onboarding</span>
              <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm" value={stepOne.status} onChange={(event) => setStepOne({ ...stepOne, status: event.target.value as StepOneState['status'] })}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Activă după confirmare</option>
              </select>
            </label>
          </div>
        </StepCard>
      ) : null}

      {activeStep === 1 ? (
        <StepCard title="Structura blocului" description="Creează structura inițială pentru blocuri/corpuri și scări.">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Număr blocuri/corpuri" type="number" min="1" value={structure.buildingsCount} onChange={(event) => setStructure({ ...structure, buildingsCount: event.target.value })} />
            <Input label="Număr scări" type="number" min="1" value={structure.staircasesCount} onChange={(event) => setStructure({ ...structure, staircasesCount: event.target.value })} />
            <Input label="Număr etaje" type="number" min="1" value={structure.floorsCount} onChange={(event) => setStructure({ ...structure, floorsCount: event.target.value })} />
            <Input label="Total apartamente" type="number" min="1" value={structure.apartmentsCount} onChange={(event) => setStructure({ ...structure, apartmentsCount: event.target.value })} />
            <Input label="Anul construcției" type="number" value={structure.constructionYear} onChange={(event) => setStructure({ ...structure, constructionYear: event.target.value })} />
            <label className="block space-y-1.5 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Note interne pentru superadmin</span>
              <textarea
                value={structure.internalNotes}
                onChange={(event) => setStructure({ ...structure, internalNotes: event.target.value })}
                className="min-h-28 w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
              />
            </label>
          </div>
        </StepCard>
      ) : null}

      {activeStep === 2 ? (
        <StepCard
          title="Apartamente"
          description="Generează rapid apartamentele, apoi ajustează manual numărul, scara, etajul și suprafața."
          rightSlot={<Button variant="secondary" onClick={addApartment}><Plus className="h-4 w-4" /> Adaugă rând</Button>}
        >
          <Card className="mb-4 border-dashed bg-muted/20">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Generare automată</h3>
                <p className="text-sm text-muted-foreground">Exemplu pilot: scările 1–4, apartamentele 1–142.</p>
              </div>
              <Button onClick={generateApartments}><Sparkles className="h-4 w-4" /> Generează apartamente automat</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {ranges.map((range, index) => (
                <div key={index} className="rounded-2xl border border-border/70 bg-white p-3">
                  <Input label="Scara" value={range.entrance} onChange={(event) => setRanges((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, entrance: event.target.value } : row)))} />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Input label="De la" type="number" value={range.from} onChange={(event) => setRanges((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, from: event.target.value } : row)))} />
                    <Input label="Până la" type="number" value={range.to} onChange={(event) => setRanges((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, to: event.target.value } : row)))} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-3">
            {apartments.map((apartment, index) => (
              <div key={`${apartment.id || 'new'}-${index}`} className="rounded-2xl border border-border/70 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Apartament #{index + 1}</p>
                  <button type="button" className="rounded-xl p-2 text-rose-600 hover:bg-rose-50" onClick={() => setApartments((current) => current.filter((_, rowIndex) => rowIndex !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <Input label="Apartament" value={apartment.apartmentNumber} onChange={(event) => updateApartment(index, { apartmentNumber: event.target.value })} />
                  <Input label="Bloc/corp" value={apartment.building} onChange={(event) => updateApartment(index, { building: event.target.value })} />
                  <Input label="Scara" value={apartment.entrance} onChange={(event) => updateApartment(index, { entrance: event.target.value })} />
                  <Input label="Etaj" type="number" value={apartment.floor} onChange={(event) => updateApartment(index, { floor: event.target.value })} />
                  <Input label="Suprafață m²" value={apartment.areaM2} onChange={(event) => updateApartment(index, { areaM2: event.target.value })} />
                  <Input label="Camere" type="number" value={apartment.rooms} onChange={(event) => updateApartment(index, { rooms: event.target.value })} />
                  <Input label="Număr cadastral" value={apartment.cadastralNumber} onChange={(event) => updateApartment(index, { cadastralNumber: event.target.value })} />
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-foreground">Status</span>
                    <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm" value={apartment.status} onChange={(event) => updateApartment(index, { status: event.target.value as ApartmentStatus })}>
                      <option value="UNKNOWN">Necunoscut</option>
                      <option value="OCCUPIED">Ocupat</option>
                      <option value="VACANT">Liber</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
            {!apartments.length ? <EmptyText>Nu există apartamente încă. Generează automat sau adaugă primul rând.</EmptyText> : null}
          </div>
        </StepCard>
      ) : null}

      {activeStep === 3 ? (
        <StepCard title="Locatari / proprietari" description="Pregătește contactele. Invitațiile reale nu sunt trimise din acest wizard." rightSlot={<Button variant="secondary" onClick={() => addResident()}><Plus className="h-4 w-4" /> Adaugă locatar</Button>}>
          <div className="grid gap-3">
            {residents.map((resident, index) => (
              <div key={`${resident.residentId || 'new'}-${index}`} className="rounded-2xl border border-border/70 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Contact #{index + 1}</p>
                  <button type="button" className="rounded-xl p-2 text-rose-600 hover:bg-rose-50" onClick={() => setResidents((current) => current.filter((_, rowIndex) => rowIndex !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-foreground">Apartament</span>
                    <select
                      className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm"
                      value={`${resident.building}|${resident.entrance}|${resident.apartmentNumber}`}
                      onChange={(event) => {
                        const [building, entrance, apartmentNumber] = event.target.value.split('|');
                        const apartment = apartments.find((row) => row.building === building && row.entrance === entrance && row.apartmentNumber === apartmentNumber);
                        updateResident(index, {
                          apartmentId: apartment?.id,
                          building,
                          entrance,
                          apartmentNumber,
                        });
                      }}
                    >
                      <option value="||">Alege apartamentul</option>
                      {apartments.map((apartment, apartmentIndex) => (
                        <option key={`${apartment.apartmentNumber}-${apartmentIndex}`} value={`${apartment.building}|${apartment.entrance}|${apartment.apartmentNumber}`}>
                          Apt. {apartment.apartmentNumber} · Scara {apartment.entrance}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input label="Nume complet" value={resident.fullName} onChange={(event) => updateResident(index, { fullName: event.target.value })} />
                  <Input label="Telefon" value={resident.phone} placeholder="+37360000000" onChange={(event) => updateResident(index, { phone: event.target.value })} />
                  <Input label="Email" value={resident.email} onChange={(event) => updateResident(index, { email: event.target.value })} />
                  <SelectField label="Rol" value={resident.role} options={[['OWNER', 'Proprietar'], ['TENANT', 'Chiriaș'], ['REPRESENTATIVE', 'Reprezentant']]} onChange={(value) => updateResident(index, { role: value as ResidentRole })} />
                  <SelectField label="Contact preferat" value={resident.preferredContactMethod} options={[['PHONE', 'Telefon'], ['EMAIL', 'Email'], ['APP', 'Aplicație'], ['WHATSAPP', 'WhatsApp'], ['TELEGRAM', 'Telegram']]} onChange={(value) => updateResident(index, { preferredContactMethod: value as ContactMethod })} />
                  <SelectField label="Status cont" value={resident.status} options={[['NOT_INVITED', 'Neinvitat'], ['INVITED', 'Invitat'], ['ACTIVE', 'Activ']]} onChange={(value) => updateResident(index, { status: value as ResidentStatus })} />
                  <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-medium">
                    <input type="checkbox" checked={resident.isPrimaryContact} onChange={(event) => updateResident(index, { isPrimaryContact: event.target.checked })} />
                    Contact principal
                  </label>
                </div>
              </div>
            ))}
            {!residents.length ? <EmptyText>Nu există locatari introduși încă. Poți continua și îi poți adăuga ulterior.</EmptyText> : null}
          </div>
        </StepCard>
      ) : null}

      {activeStep === 4 ? (
        <StepCard title="Tarife inițiale" description="Configurează doar structura internă pentru facturare. Plățile online nu se activează în acest pas.">
          <div className="grid gap-4 md:grid-cols-3">
            <Input label="Deservire bloc, MDL/m²" value={tariffs.deservireBlocPerM2} onChange={(event) => setTariffs({ ...tariffs, deservireBlocPerM2: event.target.value })} />
            <Input label="Fond reparație, MDL/m²" value={tariffs.fondReparatiePerM2} onChange={(event) => setTariffs({ ...tariffs, fondReparatiePerM2: event.target.value })} />
            <Input label="Fond investiții, MDL/apartament" value={tariffs.fondInvestitiiPerApartment} onChange={(event) => setTariffs({ ...tariffs, fondInvestitiiPerApartment: event.target.value })} />
          </div>
          <div className="mt-4 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
            Exemplu pentru 72.4 m²: {formatMdl(72.4 * Number(tariffs.deservireBlocPerM2 || 0))} deservire + {formatMdl(72.4 * Number(tariffs.fondReparatiePerM2 || 0))} fond reparație + {formatMdl(Number(tariffs.fondInvestitiiPerApartment || 0))} fond investiții.
          </div>
        </StepCard>
      ) : null}

      {activeStep === 5 ? (
        <StepCard title="Review & Activate" description="Verifică sumarul înainte de activarea asociației.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryTile label="A.P.C." value={stepOne.shortName || '-'} />
            <SummaryTile label="Cod A.P.C." value={stepOne.associationCode || '-'} />
            <SummaryTile label="Adresă" value={stepOne.address || '-'} />
            <SummaryTile label="Status onboarding" value={stepOne.status === 'ACTIVE' ? 'Pregătită pentru activare' : 'Draft'} />
            <SummaryTile label="Total scări" value={summary.totalStaircases} />
            <SummaryTile label="Total apartamente" value={summary.totalApartments} />
            <SummaryTile label="Total m²" value={summary.totalAreaM2.toFixed(2)} />
            <SummaryTile label="Locatari introduși" value={summary.totalResidents} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <SummaryTile label="Deservire bloc" value={`${tariffs.deservireBlocPerM2} MDL/m²`} />
            <SummaryTile label="Fond reparație" value={`${tariffs.fondReparatiePerM2} MDL/m²`} />
            <SummaryTile label="Fond investiții" value={`${tariffs.fondInvestitiiPerApartment} MDL/apartament`} />
          </div>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            După activare, A.P.C.-ul devine activ și datele salvate vor fi vizibile în fluxurile reale ale platformei.
          </div>
        </StepCard>
      ) : null}

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Badge variant={onboardingId ? 'success' : 'warning'}>{onboardingId ? 'Draft salvat în backend' : 'Draft nesalvat'}</Badge>
          <Badge variant="default">Date reale</Badge>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" disabled={activeStep === 0 || isSaving || isActivating} onClick={() => setActiveStep((activeStep - 1) as StepId)}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          {activeStep < 5 ? (
            <>
              <Button variant="outline" isLoading={isSaving} onClick={saveCurrentStep}>
                <Save className="h-4 w-4" /> Save Draft
              </Button>
              <Button isLoading={isSaving} onClick={saveAndNext}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button isLoading={isActivating} onClick={activateAssociation}>
              Activează asociația
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function StepCard({ title, description, rightSlot, children }: { title: string; description: string; rightSlot?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <div className="mb-5 flex flex-col gap-3 border-b border-border/70 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {rightSlot}
      </div>
      {children}
    </Card>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm font-medium text-muted-foreground">{children}</div>;
}

function SummaryTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
