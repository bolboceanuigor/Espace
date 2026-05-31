'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  CreditCard,
  DoorOpen,
  ExternalLink,
  FileSignature,
  FileText,
  Gauge,
  Home,
  Layers3,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  Rocket,
  RotateCcw,
  Shield,
  UserPlus,
  Users,
} from 'lucide-react';
import { Badge, Card, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { invitationsApi, superadminApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type TabKey =
  | 'overview'
  | 'onboarding'
  | 'handover'
  | 'users'
  | 'structure'
  | 'apartments'
  | 'billing'
  | 'documents'
  | 'contract'
  | 'activity';

type BadgeTone = 'default' | 'success' | 'warning' | 'error' | 'neutral';

const tabs: Array<{ key: TabKey; label: string; icon: ReactNode }> = [
  { key: 'overview', label: 'Overview', icon: <Gauge className="h-4 w-4" /> },
  { key: 'onboarding', label: 'Onboarding', icon: <ClipboardList className="h-4 w-4" /> },
  { key: 'handover', label: 'Admin handover', icon: <UserPlus className="h-4 w-4" /> },
  { key: 'users', label: 'Utilizatori', icon: <Users className="h-4 w-4" /> },
  { key: 'structure', label: 'Structură', icon: <Layers3 className="h-4 w-4" /> },
  { key: 'apartments', label: 'Apartamente', icon: <Home className="h-4 w-4" /> },
  { key: 'billing', label: 'Facturare', icon: <Receipt className="h-4 w-4" /> },
  { key: 'documents', label: 'Documente', icon: <FileText className="h-4 w-4" /> },
  { key: 'contract', label: 'Contract', icon: <FileSignature className="h-4 w-4" /> },
  { key: 'activity', label: 'Activitate', icon: <Activity className="h-4 w-4" /> },
];

function isTabKey(value: string | null): value is TabKey {
  return Boolean(value && tabs.some((tab) => tab.key === value));
}

const clientStatusLabels: Record<string, string> = {
  ACTIVE: 'Activ',
  TRIAL: 'Trial',
  INACTIVE: 'Inactiv',
};

const onboardingLabels: Record<string, string> = {
  NOT_STARTED: 'Neînceput',
  IN_PROGRESS: 'În configurare',
  READY_FOR_LAUNCH: 'Gata de lansare',
  LAUNCHED: 'Lansat',
  BLOCKED: 'Blocat',
  COMPLETED: 'Finalizat',
};

const launchLabels: Record<string, string> = {
  DRAFT: 'Draft',
  INTERNAL_REVIEW: 'Revizie internă',
  READY: 'Ready',
  LIVE: 'Live',
};

const handoverLabels: Record<string, string> = {
  NOT_STARTED: 'Neînceput',
  INVITED: 'Invitație trimisă',
  ACCEPTED: 'Acceptată',
  FIRST_LOGIN_DONE: 'First login finalizat',
  ACTIVE: 'Activ',
};

const userRoleLabels: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  RESIDENT: 'Locatar',
};

const apartmentStatusLabels: Record<string, string> = {
  EMPTY: 'Liber',
  OCCUPIED: 'Ocupat',
  RENTED: 'Închiriat',
  INACTIVE: 'Inactiv',
};

const emptyEditForm = {
  name: '',
  legalName: '',
  apcCode: '',
  city: '',
  address: '',
  contactPhone: '',
  contactEmail: '',
  internalNote: '',
  status: 'TRIAL',
};

const emptyAdminForm = {
  name: '',
  email: '',
  phone: '',
  expiresInDays: '7',
  sendEmail: false,
};

const emptyContractForm = {
  status: 'DRAFT',
  contractNumber: '',
  startDate: '',
  endDate: '',
  signedAt: '',
  billingCycle: 'MONTHLY',
  pricingModel: 'PER_APARTMENT',
  pricePerApartment: '',
  fixedMonthlyPrice: '',
  apartmentsIncluded: '',
  minimumMonthlyFee: '',
  paymentDueDay: '10',
  currency: 'MDL',
  documentUrl: '',
  internalNote: '',
};

const emptySubscriptionForm = {
  status: 'TRIAL',
  planName: '',
  startedAt: '',
  trialEndsAt: '',
  nextBillingDate: '',
  currentMonthlyAmount: '',
  currency: 'MDL',
  internalNote: '',
};

function detailEditForm(detail: any) {
  const organization = detail?.organization || {};
  return {
    name: organization.name || '',
    legalName: organization.legalName || '',
    apcCode: organization.apcCode || organization.associationCode || '',
    city: organization.city || '',
    address: organization.address || '',
    contactPhone: organization.contactPhone || '',
    contactEmail: organization.contactEmail || '',
    internalNote: organization.internalNote || '',
    status: organization.status || 'TRIAL',
  };
}

function contractFormFromDetail(detail: any) {
  const contract = detail?.contract || {};
  return {
    status: contract.status || 'DRAFT',
    contractNumber: contract.contractNumber || '',
    startDate: dateInputValue(contract.startDate),
    endDate: dateInputValue(contract.endDate),
    signedAt: dateInputValue(contract.signedAt),
    billingCycle: contract.billingCycle || 'MONTHLY',
    pricingModel: contract.pricingModel || 'PER_APARTMENT',
    pricePerApartment: valueInput(contract.pricePerApartment),
    fixedMonthlyPrice: valueInput(contract.fixedMonthlyPrice),
    apartmentsIncluded: valueInput(contract.apartmentsIncluded),
    minimumMonthlyFee: valueInput(contract.minimumMonthlyFee),
    paymentDueDay: valueInput(contract.paymentDueDay || 10),
    currency: contract.currency || detail?.organization?.currency || 'MDL',
    documentUrl: contract.documentUrl || '',
    internalNote: contract.internalNote || '',
  };
}

function subscriptionFormFromDetail(detail: any) {
  const subscription = detail?.subscription || detail?.billing?.platformSubscription || {};
  return {
    status: subscription.status || 'TRIAL',
    planName: subscription.planName || subscription.plan?.name || '',
    startedAt: dateInputValue(subscription.startedAt || subscription.subscriptionStartDate),
    trialEndsAt: dateInputValue(subscription.trialEndsAt || subscription.trialEndDate),
    nextBillingDate: dateInputValue(subscription.nextBillingDate),
    currentMonthlyAmount: valueInput(subscription.currentMonthlyAmount ?? subscription.price),
    currency: subscription.currency || detail?.organization?.currency || 'MDL',
    internalNote: subscription.internalNote || subscription.notes || '',
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function SuperadminOrganizationDetailsPage() {
  const localizedPath = useLocalizedPath();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const params = useParams<{ id?: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [detail, setDetail] = useState<any | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [billingTasks, setBillingTasks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>(() => (isTabKey(tabParam) ? tabParam : 'overview'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminForm, setAdminForm] = useState(emptyAdminForm);
  const [adminError, setAdminError] = useState('');
  const [adminInvitationLink, setAdminInvitationLink] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [handoverActionLoading, setHandoverActionLoading] = useState('');
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractForm, setContractForm] = useState(emptyContractForm);
  const [contractError, setContractError] = useState('');
  const [savingContract, setSavingContract] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState(emptySubscriptionForm);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [openingAdminArea, setOpeningAdminArea] = useState(false);
  const [userActionError, setUserActionError] = useState('');
  const [apartmentSearch, setApartmentSearch] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [detailRes, activityRes, billingTasksRes] = await Promise.all([
        superadminApi.getSuperadminOrganizationDetail(id),
        superadminApi.getSuperadminOrganizationActivity(id, { limit: 30 }).catch(() => ({ data: { items: [] } })),
        superadminApi.getSuperadminBillingTasks({ organizationId: id, limit: 5 }).catch(() => ({ data: { items: [] } })),
      ]);
      setDetail(detailRes.data);
      setEditForm(detailEditForm(detailRes.data));
      setActivity(activityRes.data?.items || activityRes.data?.data || []);
      setBillingTasks(billingTasksRes.data?.items || []);
    } catch (loadError: any) {
      setError(String(loadError?.message || 'Nu am putut încărca organizația.'));
      setDetail(null);
      setActivity([]);
      setBillingTasks([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isTabKey(tabParam)) setActiveTab(tabParam);
  }, [tabParam]);

  const organization = detail?.organization;
  const stats = detail?.stats || {};
  const warnings = detail?.warnings || [];
  const filteredApartments = useMemo(() => {
    const items = detail?.apartments?.items || [];
    const search = apartmentSearch.trim().toLowerCase();
    if (!search) return items;
    return items.filter((item: any) => {
      const residentName = item.ownerResident?.name || item.residents?.map((link: any) => link.resident?.name).join(' ') || '';
      return `${item.number} ${item.building?.name || ''} ${item.staircase?.name || ''} ${residentName}`.toLowerCase().includes(search);
    });
  }, [apartmentSearch, detail]);

  const openEditModal = () => {
    setEditForm(detailEditForm(detail));
    setEditError('');
    setEditModalOpen(true);
  };

  const saveOrganization = async () => {
    setEditError('');
    setSuccessMessage('');
    if (!editForm.name.trim()) {
      setEditError('Numele organizației este obligatoriu.');
      return;
    }
    if (editForm.contactEmail.trim() && !isValidEmail(editForm.contactEmail.trim())) {
      setEditError('Emailul de contact nu este valid.');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await superadminApi.updateSuperadminOrganization(id, {
        name: editForm.name.trim(),
        legalName: editForm.legalName.trim() || null,
        apcCode: editForm.apcCode.trim() || null,
        city: editForm.city.trim() || null,
        address: editForm.address.trim() || null,
        contactPhone: editForm.contactPhone.trim() || null,
        contactEmail: editForm.contactEmail.trim() || null,
        internalNote: editForm.internalNote.trim() || null,
        status: editForm.status as 'ACTIVE' | 'TRIAL' | 'INACTIVE',
      });
      setDetail(res.data);
      setEditForm(detailEditForm(res.data));
      setEditModalOpen(false);
      setSuccessMessage('Organizația a fost actualizată.');
      superadminApi.getSuperadminOrganizationActivity(id, { limit: 30 }).then((activityRes) => setActivity(activityRes.data?.items || activityRes.data?.data || [])).catch(() => undefined);
    } catch (saveError: any) {
      setEditError(String(saveError?.message || 'Nu am putut salva organizația.'));
    } finally {
      setSavingEdit(false);
    }
  };

  const openContractModal = () => {
    setContractForm(contractFormFromDetail(detail));
    setContractError('');
    setContractModalOpen(true);
  };

  const openSubscriptionModal = () => {
    setSubscriptionForm(subscriptionFormFromDetail(detail));
    setSubscriptionError('');
    setSubscriptionModalOpen(true);
  };

  const saveContract = async () => {
    setContractError('');
    setSuccessMessage('');
    if (contractForm.pricingModel === 'PER_APARTMENT' && !contractForm.pricePerApartment.trim()) {
      setContractError('Tariful per apartament este obligatoriu pentru modelul per apartament.');
      return;
    }
    if (contractForm.pricingModel === 'FIXED_MONTHLY' && !contractForm.fixedMonthlyPrice.trim()) {
      setContractError('Tariful lunar fix este obligatoriu pentru modelul fix lunar.');
      return;
    }
    const dueDay = numberOrNull(contractForm.paymentDueDay);
    if (dueDay !== null && (dueDay < 1 || dueDay > 31 || !Number.isInteger(dueDay))) {
      setContractError('Ziua de scadență trebuie să fie între 1 și 31.');
      return;
    }
    setSavingContract(true);
    try {
      await superadminApi.updateSuperadminOrganizationContract(id, {
        status: contractForm.status as any,
        contractNumber: contractForm.contractNumber.trim() || null,
        startDate: contractForm.startDate || null,
        endDate: contractForm.endDate || null,
        signedAt: contractForm.signedAt || null,
        billingCycle: contractForm.billingCycle as any,
        pricingModel: contractForm.pricingModel as any,
        pricePerApartment: numberOrNull(contractForm.pricePerApartment),
        fixedMonthlyPrice: numberOrNull(contractForm.fixedMonthlyPrice),
        apartmentsIncluded: numberOrNull(contractForm.apartmentsIncluded),
        minimumMonthlyFee: numberOrNull(contractForm.minimumMonthlyFee),
        paymentDueDay: dueDay,
        currency: contractForm.currency as 'MDL' | 'EUR' | 'USD',
        documentUrl: contractForm.documentUrl.trim() || null,
        internalNote: contractForm.internalNote.trim() || null,
      });
      setContractModalOpen(false);
      setSuccessMessage('Contractul comercial a fost salvat.');
      await load();
    } catch (saveContractError: any) {
      setContractError(String(saveContractError?.message || 'Nu am putut salva contractul.'));
    } finally {
      setSavingContract(false);
    }
  };

  const saveSubscription = async () => {
    setSubscriptionError('');
    setSuccessMessage('');
    if (!subscriptionForm.planName.trim()) {
      setSubscriptionError('Numele planului este obligatoriu.');
      return;
    }
    const amount = numberOrNull(subscriptionForm.currentMonthlyAmount);
    if (amount !== null && amount < 0) {
      setSubscriptionError('Suma lunară trebuie să fie pozitivă.');
      return;
    }
    setSavingSubscription(true);
    try {
      await superadminApi.updateSuperadminOrganizationSubscription(id, {
        status: subscriptionForm.status as any,
        planName: subscriptionForm.planName.trim(),
        startedAt: subscriptionForm.startedAt || null,
        trialEndsAt: subscriptionForm.trialEndsAt || null,
        nextBillingDate: subscriptionForm.nextBillingDate || null,
        currentMonthlyAmount: amount,
        currency: subscriptionForm.currency as 'MDL' | 'EUR' | 'USD',
        internalNote: subscriptionForm.internalNote.trim() || null,
      });
      setSubscriptionModalOpen(false);
      setSuccessMessage('Abonamentul a fost salvat.');
      await load();
    } catch (saveSubscriptionError: any) {
      setSubscriptionError(String(saveSubscriptionError?.message || 'Nu am putut salva abonamentul.'));
    } finally {
      setSavingSubscription(false);
    }
  };

  const createAdminInvitation = async () => {
    setAdminError('');
    setSuccessMessage('');
    setAdminInvitationLink('');
    const payload = {
      name: adminForm.name.trim(),
      email: adminForm.email.trim(),
      phone: adminForm.phone.trim(),
      expiresInDays: Number(adminForm.expiresInDays) || 7,
      sendEmail: adminForm.sendEmail,
    };
    if (!payload.name) {
      setAdminError('Numele administratorului este obligatoriu.');
      return;
    }
    if (!payload.email || !isValidEmail(payload.email)) {
      setAdminError('Emailul administratorului nu este valid.');
      return;
    }
    if (!payload.phone) {
      setAdminError('Telefonul administratorului este obligatoriu.');
      return;
    }
    setCreatingAdmin(true);
    try {
      const created = await invitationsApi.createAdminInvitation(id, payload);
      setAdminInvitationLink(created.data?.inviteUrl || created.data?.activationLink || created.data?.inviteLink || '');
      setAdminForm(emptyAdminForm);
      setSuccessMessage(created.data?.emailSent ? 'Invitația a fost trimisă pe email.' : 'Invitația a fost creată pentru trimitere manuală.');
      await load();
    } catch (adminCreateError: any) {
      setAdminError(String(adminCreateError?.message || 'Nu am putut crea invitația.'));
    } finally {
      setCreatingAdmin(false);
    }
  };

  const resendAdminInvitation = async (invitationId: string) => {
    setHandoverActionLoading(invitationId);
    setSuccessMessage('');
    setAdminInvitationLink('');
    try {
      const res = await invitationsApi.resendAdminInvitation(invitationId);
      setAdminInvitationLink(res.data?.inviteUrl || res.data?.activationLink || res.data?.inviteLink || '');
      setSuccessMessage('Invitația a fost retrimisă. Linkul nou este disponibil pentru copiere.');
      await load();
    } catch (resendError: any) {
      setUserActionError(String(resendError?.message || 'Nu am putut retrimite invitația.'));
    } finally {
      setHandoverActionLoading('');
    }
  };

  const cancelAdminInvitation = async (invitationId: string) => {
    if (!window.confirm('Anulezi invitația Admin?')) return;
    setHandoverActionLoading(invitationId);
    setSuccessMessage('');
    try {
      await invitationsApi.cancelAdminInvitation(invitationId);
      setSuccessMessage('Invitația a fost anulată.');
      await load();
    } catch (cancelError: any) {
      setUserActionError(String(cancelError?.message || 'Nu am putut anula invitația.'));
    } finally {
      setHandoverActionLoading('');
    }
  };

  const openInviteModal = () => {
    setAdminInvitationLink('');
    setAdminError('');
    setAdminForm({
      ...emptyAdminForm,
      name: detail?.mainAdmin?.name || detail?.sourceAccessRequest?.contactName || '',
      email: detail?.mainAdmin?.email || detail?.sourceAccessRequest?.email || '',
      phone: detail?.mainAdmin?.phone || detail?.sourceAccessRequest?.phone || '',
    });
    setAdminModalOpen(true);
  };

  const deactivateAdmin = async (user: any) => {
    if (!window.confirm(`Dezactivezi utilizatorul ${user.name || user.email}?`)) return;
    setUserActionError('');
    setSuccessMessage('');
    try {
      await superadminApi.updatePublicAdmin(user.id, { isActive: false });
      setSuccessMessage('Utilizatorul a fost dezactivat.');
      await load();
    } catch (deactivateError: any) {
      setUserActionError(String(deactivateError?.message || 'Nu am putut dezactiva utilizatorul.'));
    }
  };

  const openAdminArea = async () => {
    setOpeningAdminArea(true);
    setUserActionError('');
    try {
      await superadminApi.startSupportSession(id, `Acces Superadmin din fișa organizației ${organization?.name || id}`);
      router.push(localizedPath('/admin'));
    } catch (supportError: any) {
      setUserActionError(String(supportError?.message || 'Nu am putut porni sesiunea de support.'));
    } finally {
      setOpeningAdminArea(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5 pb-4">
        <PageHeader
          title="Se încarcă organizația"
          description="Preluăm fișa completă a clientului."
          rightSlot={<HeaderBackLink href={localizedPath('/superadmin/organizations')} />}
        />
        <Card className="p-5 text-sm font-medium text-muted-foreground">Se încarcă datele reale...</Card>
      </div>
    );
  }

  if (error || !detail || !organization) {
    return (
      <div className="space-y-5 pb-4">
        <PageHeader
          title="Organizație indisponibilă"
          description="Nu sunt afișate date demo."
          rightSlot={<HeaderBackLink href={localizedPath('/superadmin/organizations')} />}
        />
        <Card className="p-5">
          <p className="text-sm font-semibold text-rose-700">{error || 'Organizația nu a fost găsită.'}</p>
          <button type="button" onClick={load} className="mt-4 rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold">
            Reîncearcă
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title={organization.name || 'Organizație fără nume'}
        description={[organization.apcCode || 'Cod APC lipsă', organization.city || 'Oraș necompletat'].join(' · ')}
        badge={<Badge variant={statusTone(organization.status)}>{clientStatusLabels[organization.status] || organization.status}</Badge>}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={localizedPath('/superadmin/organizations')} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
              <ArrowLeft className="h-4 w-4" />
              Înapoi la organizații
            </Link>
            <button type="button" onClick={openEditModal} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
              <Pencil className="h-4 w-4" />
              Editează
            </button>
            <Link href={localizedPath(`/superadmin/organizations/${id}/onboarding`)} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
              <ClipboardList className="h-4 w-4" />
              Onboarding
            </Link>
            <button type="button" onClick={openAdminArea} disabled={openingAdminArea} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">
              <ExternalLink className="h-4 w-4" />
              {openingAdminArea ? 'Se deschide...' : 'Deschide zona Admin'}
            </button>
          </div>
        }
        tabs={
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border/70 bg-white text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      {successMessage ? <Notice tone="success">{successMessage}</Notice> : null}
      {userActionError ? <Notice tone="error">{userActionError}</Notice> : null}

      {warnings.length ? (
        <WarningsPanel warnings={warnings} />
      ) : null}

      {activeTab === 'overview' ? <OverviewTab detail={detail} localizedPath={localizedPath} onOpenContract={() => setActiveTab('contract')} /> : null}
      {activeTab === 'onboarding' ? <OnboardingTab detail={detail} localizedPath={localizedPath} id={id} /> : null}
      {activeTab === 'handover' ? (
        <HandoverTab
          detail={detail}
          onInvite={openInviteModal}
          onResend={resendAdminInvitation}
          onCancel={cancelAdminInvitation}
          loadingInvitationId={handoverActionLoading}
          latestInviteLink={adminInvitationLink}
        />
      ) : null}
      {activeTab === 'users' ? (
        <UsersTab
          detail={detail}
          onInvite={openInviteModal}
          onDeactivate={deactivateAdmin}
          userActionError={userActionError}
        />
      ) : null}
      {activeTab === 'structure' ? <StructureTab detail={detail} localizedPath={localizedPath} id={id} /> : null}
      {activeTab === 'apartments' ? (
        <ApartmentsTab
          detail={detail}
          filteredApartments={filteredApartments}
          search={apartmentSearch}
          onSearch={setApartmentSearch}
        />
      ) : null}
      {activeTab === 'billing' ? <BillingTab detail={detail} localizedPath={localizedPath} id={id} /> : null}
      {activeTab === 'documents' ? <DocumentsTab detail={detail} /> : null}
      {activeTab === 'contract' ? <ContractTab detail={detail} billingTasks={billingTasks} localizedPath={localizedPath} onEditContract={openContractModal} onEditSubscription={openSubscriptionModal} /> : null}
      {activeTab === 'activity' ? <ActivityTab items={activity} /> : null}

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} maxWidth="2xl">
        <ModalHeader title="Editează organizația" onClose={() => setEditModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nume" value={editForm.name} onChange={(value) => setEditForm({ ...editForm, name: value })} required />
            <Field label="Denumire juridică" value={editForm.legalName} onChange={(value) => setEditForm({ ...editForm, legalName: value })} />
            <Field label="Cod APC" value={editForm.apcCode} onChange={(value) => setEditForm({ ...editForm, apcCode: value.trim().toUpperCase() })} />
            <Field label="Oraș" value={editForm.city} onChange={(value) => setEditForm({ ...editForm, city: value })} />
            <Field label="Adresă" value={editForm.address} onChange={(value) => setEditForm({ ...editForm, address: value })} />
            <Field label="Telefon contact" value={editForm.contactPhone} onChange={(value) => setEditForm({ ...editForm, contactPhone: value })} />
            <Field label="Email contact" value={editForm.contactEmail} onChange={(value) => setEditForm({ ...editForm, contactEmail: value })} type="email" />
            <label className="block">
              <span className="label">Status client</span>
              <select className="select" value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>
                <option value="ACTIVE">Activ</option>
                <option value="TRIAL">Trial</option>
                <option value="INACTIVE">Inactiv</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="label">Notă internă</span>
              <textarea
                className="min-h-[110px] w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-foreground"
                value={editForm.internalNote}
                onChange={(event) => setEditForm({ ...editForm, internalNote: event.target.value })}
              />
            </label>
          </div>
          {editError ? <Notice tone="error" className="mt-4">{editError}</Notice> : null}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setEditModalOpen(false)} disabled={savingEdit} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={saveOrganization} disabled={savingEdit} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {savingEdit ? 'Se salvează...' : 'Salvează'}
          </button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={adminModalOpen} onClose={() => setAdminModalOpen(false)} maxWidth="xl">
        <ModalHeader title="Trimite invitație Admin" onClose={() => setAdminModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nume admin" value={adminForm.name} onChange={(value) => setAdminForm({ ...adminForm, name: value })} required />
            <Field label="Email" value={adminForm.email} onChange={(value) => setAdminForm({ ...adminForm, email: value })} type="email" required />
            <Field label="Telefon" value={adminForm.phone} onChange={(value) => setAdminForm({ ...adminForm, phone: value })} required />
            <Field label="Expiră în zile" value={adminForm.expiresInDays} onChange={(value) => setAdminForm({ ...adminForm, expiresInDays: value })} type="number" />
            <label className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium text-foreground md:col-span-2">
              <input type="checkbox" checked={adminForm.sendEmail} onChange={(event) => setAdminForm({ ...adminForm, sendEmail: event.target.checked })} />
              Trimite invitația pe email
            </label>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Dacă emailul real nu este conectat încă, linkul de invitație poate fi copiat și trimis manual.
          </p>
          {adminError ? <Notice tone="error" className="mt-4">{adminError}</Notice> : null}
          {adminInvitationLink ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-semibold text-emerald-900">Invitația a fost creată.</p>
              <input className="input mt-2 bg-white" readOnly value={adminInvitationLink} />
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(adminInvitationLink).catch(() => undefined)}
                className="mt-2 rounded-2xl border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-900"
              >
                Copiază linkul
              </button>
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setAdminModalOpen(false)} disabled={creatingAdmin} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={createAdminInvitation} disabled={creatingAdmin} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {creatingAdmin ? 'Se creează...' : 'Creează invitația'}
          </button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={contractModalOpen} onClose={() => setContractModalOpen(false)} maxWidth="2xl">
        <ModalHeader title={detail.contract ? 'Editează contract' : 'Creează contract'} onClose={() => setContractModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="label">Status contract</span>
              <select className="select" value={contractForm.status} onChange={(event) => setContractForm({ ...contractForm, status: event.target.value })}>
                <option value="NOT_STARTED">NOT_STARTED</option>
                <option value="DRAFT">DRAFT</option>
                <option value="SENT">SENT</option>
                <option value="SIGNED">SIGNED</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PAUSED">PAUSED</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
            </label>
            <Field label="Număr contract" value={contractForm.contractNumber} onChange={(value) => setContractForm({ ...contractForm, contractNumber: value })} />
            <Field label="Start date" type="date" value={contractForm.startDate} onChange={(value) => setContractForm({ ...contractForm, startDate: value })} />
            <Field label="End date" type="date" value={contractForm.endDate} onChange={(value) => setContractForm({ ...contractForm, endDate: value })} />
            <Field label="Signed date" type="date" value={contractForm.signedAt} onChange={(value) => setContractForm({ ...contractForm, signedAt: value })} />
            <label className="block">
              <span className="label">Billing cycle</span>
              <select className="select" value={contractForm.billingCycle} onChange={(event) => setContractForm({ ...contractForm, billingCycle: event.target.value })}>
                <option value="MONTHLY">MONTHLY</option>
                <option value="QUARTERLY">QUARTERLY</option>
                <option value="YEARLY">YEARLY</option>
                <option value="CUSTOM">CUSTOM</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Pricing model</span>
              <select className="select" value={contractForm.pricingModel} onChange={(event) => setContractForm({ ...contractForm, pricingModel: event.target.value })}>
                <option value="PER_APARTMENT">PER_APARTMENT</option>
                <option value="FIXED_MONTHLY">FIXED_MONTHLY</option>
                <option value="CUSTOM">CUSTOM</option>
              </select>
            </label>
            <Field label="Price per apartment" type="number" value={contractForm.pricePerApartment} onChange={(value) => setContractForm({ ...contractForm, pricePerApartment: value })} />
            <Field label="Fixed monthly price" type="number" value={contractForm.fixedMonthlyPrice} onChange={(value) => setContractForm({ ...contractForm, fixedMonthlyPrice: value })} />
            <Field label="Apartments included" type="number" value={contractForm.apartmentsIncluded} onChange={(value) => setContractForm({ ...contractForm, apartmentsIncluded: value })} />
            <Field label="Minimum monthly fee" type="number" value={contractForm.minimumMonthlyFee} onChange={(value) => setContractForm({ ...contractForm, minimumMonthlyFee: value })} />
            <Field label="Payment due day" type="number" value={contractForm.paymentDueDay} onChange={(value) => setContractForm({ ...contractForm, paymentDueDay: value })} />
            <label className="block">
              <span className="label">Currency</span>
              <select className="select" value={contractForm.currency} onChange={(event) => setContractForm({ ...contractForm, currency: event.target.value })}>
                <option value="MDL">MDL</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <Field label="Document URL" value={contractForm.documentUrl} onChange={(value) => setContractForm({ ...contractForm, documentUrl: value })} />
            <label className="block md:col-span-2">
              <span className="label">Internal note</span>
              <textarea
                className="min-h-[100px] w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-foreground"
                value={contractForm.internalNote}
                onChange={(event) => setContractForm({ ...contractForm, internalNote: event.target.value })}
              />
            </label>
          </div>
          {contractError ? <Notice tone="error" className="mt-4">{contractError}</Notice> : null}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setContractModalOpen(false)} disabled={savingContract} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={saveContract} disabled={savingContract} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {savingContract ? 'Se salvează...' : 'Salvează contract'}
          </button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={subscriptionModalOpen} onClose={() => setSubscriptionModalOpen(false)} maxWidth="xl">
        <ModalHeader title={detail.subscription ? 'Editează abonament' : 'Creează abonament'} onClose={() => setSubscriptionModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Plan name" value={subscriptionForm.planName} onChange={(value) => setSubscriptionForm({ ...subscriptionForm, planName: value })} required />
            <label className="block">
              <span className="label">Status</span>
              <select className="select" value={subscriptionForm.status} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, status: event.target.value })}>
                <option value="TRIAL">TRIAL</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PAST_DUE">PAST_DUE</option>
                <option value="PAUSED">PAUSED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </label>
            <Field label="Started at" type="date" value={subscriptionForm.startedAt} onChange={(value) => setSubscriptionForm({ ...subscriptionForm, startedAt: value })} />
            <Field label="Trial ends at" type="date" value={subscriptionForm.trialEndsAt} onChange={(value) => setSubscriptionForm({ ...subscriptionForm, trialEndsAt: value })} />
            <Field label="Next billing date" type="date" value={subscriptionForm.nextBillingDate} onChange={(value) => setSubscriptionForm({ ...subscriptionForm, nextBillingDate: value })} />
            <Field label="Current monthly amount" type="number" value={subscriptionForm.currentMonthlyAmount} onChange={(value) => setSubscriptionForm({ ...subscriptionForm, currentMonthlyAmount: value })} />
            <label className="block">
              <span className="label">Currency</span>
              <select className="select" value={subscriptionForm.currency} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, currency: event.target.value })}>
                <option value="MDL">MDL</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="label">Internal note</span>
              <textarea
                className="min-h-[100px] w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-foreground"
                value={subscriptionForm.internalNote}
                onChange={(event) => setSubscriptionForm({ ...subscriptionForm, internalNote: event.target.value })}
              />
            </label>
          </div>
          {subscriptionError ? <Notice tone="error" className="mt-4">{subscriptionError}</Notice> : null}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setSubscriptionModalOpen(false)} disabled={savingSubscription} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={saveSubscription} disabled={savingSubscription} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {savingSubscription ? 'Se salvează...' : 'Salvează abonament'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function OverviewTab({ detail, localizedPath, onOpenContract }: { detail: any; localizedPath: (path: string) => string; onOpenContract: () => void }) {
  const organization = detail.organization;
  const stats = detail.stats || {};
  const source = detail.sourceAccessRequest;
  const contractSummary = detail.contractSummary || {};
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Blocuri" value={stats.buildingsCount || 0} description="Structură administrată" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Scări" value={stats.entrancesCount || 0} description="Intrări configurate" icon={<DoorOpen className="h-5 w-5" />} />
        <StatCard label="Apartamente" value={stats.apartmentsCount || 0} description="Unități reale" icon={<Home className="h-5 w-5" />} />
        <StatCard label="Locatari" value={stats.residentsCount || 0} description="Profiluri active" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Utilizatori activi" value={stats.activeUsersCount || 0} description={`${stats.usersCount || 0} utilizatori total`} icon={<Shield className="h-5 w-5" />} />
        <StatCard label="Contoare" value={stats.metersCount || 0} description="Contoare configurate" icon={<Gauge className="h-5 w-5" />} />
        <StatCard label="Facturi" value={stats.invoicesCount || 0} description="Facturi client/locatari" icon={<Receipt className="h-5 w-5" />} />
        <StatCard label="Documente" value={stats.documentsCount || 0} description="Fișiere încărcate" icon={<FileText className="h-5 w-5" />} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <SectionHeader title="Date generale" description="Identitatea clientului în Superadmin CRM." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Denumire juridică" value={organization.legalName || '-'} icon={<Building2 className="h-4 w-4" />} />
            <Info label="Nume scurt" value={organization.shortName || organization.name || '-'} icon={<Building2 className="h-4 w-4" />} />
            <Info label="Cod APC" value={organization.apcCode || '-'} icon={<Shield className="h-4 w-4" />} />
            <Info label="Oraș" value={organization.city || '-'} icon={<MapPin className="h-4 w-4" />} />
            <Info label="Adresă" value={organization.address || '-'} icon={<MapPin className="h-4 w-4" />} />
            <Info label="Telefon contact" value={organization.contactPhone || '-'} icon={<Phone className="h-4 w-4" />} />
            <Info label="Email contact" value={organization.contactEmail || '-'} icon={<Mail className="h-4 w-4" />} />
            <Info label="Creată la" value={formatDate(organization.createdAt)} icon={<Activity className="h-4 w-4" />} />
            <Info label="Lansată la" value={organization.launchedAt ? formatDate(organization.launchedAt) : '-'} icon={<Rocket className="h-4 w-4" />} />
          </div>
        </Card>

        <Card>
          <SectionHeader title="Client status" description="Starea operațională a organizației." />
          <div className="space-y-3">
            <StatusRow label="Status client" value={clientStatusLabels[organization.status] || organization.status} tone={statusTone(organization.status)} />
            <StatusRow label="Onboarding" value={onboardingLabels[organization.onboardingStatus] || organization.onboardingStatus} tone={onboardingTone(organization.onboardingStatus)} />
            <StatusRow label="Launch" value={launchLabels[organization.launchStatus] || organization.launchStatus} tone={launchTone(organization.launchStatus)} />
            <StatusRow label="Admin handover" value={handoverLabels[organization.adminHandoverStatus] || organization.adminHandoverStatus || 'Neînceput'} tone={handoverTone(organization.adminHandoverStatus)} />
            <StatusRow label="Admin principal" value={detail.mainAdmin?.name || 'Neatribuit'} tone={detail.mainAdmin ? 'success' : 'warning'} />
          </div>
        </Card>
      </section>

      {source ? (
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <SectionHeader title="Creată din cerere de acces" description="Legătura cu lead-ul inițial." />
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span>Contact: {source.contactName || '-'}</span>
                <span>Telefon: {source.phone || '-'}</span>
                <span>Email: {source.email || '-'}</span>
                <span>Cerere: {formatDate(source.createdAt)}</span>
              </div>
            </div>
            <Link href={localizedPath(`/superadmin/access-requests/${source.id}`)} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
              Deschide cererea inițială
            </Link>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <SectionHeader title="Contract & abonament" description="Sumar comercial intern pentru relația cu clientul." />
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatusRow label="Contract" value={contractStatusLabel(contractSummary.contractStatus || 'NOT_STARTED')} tone={contractStatusTone(contractSummary.contractStatus || 'NOT_STARTED')} />
              <StatusRow label="Abonament" value={subscriptionStatusLabel(contractSummary.subscriptionStatus || 'Neactivat')} tone={subscriptionStatusTone(contractSummary.subscriptionStatus || '')} />
              <StatusRow label="Plan" value={contractSummary.planName || '-'} tone={contractSummary.planName ? 'default' : 'neutral'} />
              <StatusRow label="Sumă lunară estimată" value={formatMoney(contractSummary.estimatedMonthlyAmount, organization.currency || 'MDL')} tone={contractSummary.estimatedMonthlyAmount ? 'success' : 'warning'} />
            </div>
          </div>
          <button type="button" onClick={onOpenContract} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
            Deschide contract
          </button>
        </div>
      </Card>
    </div>
  );
}

function OnboardingTab({ detail, localizedPath, id }: { detail: any; localizedPath: (path: string) => string; id: string }) {
  const onboarding = detail.onboarding || {};
  const progress = onboarding.progress || {};
  return (
    <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <SectionHeader title="Sumar onboarding" description="Pregătire lansare pentru organizație." />
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-4xl font-semibold tracking-tight text-foreground">{progress.percent || 0}%</p>
            <p className="mt-1 text-sm text-muted-foreground">{progress.completedSteps || 0} din {progress.totalSteps || 0} pași finalizați</p>
          </div>
          <Badge variant={onboardingTone(onboarding.status)}>{onboardingLabels[onboarding.status] || onboarding.status}</Badge>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.min(Math.max(progress.percent || 0, 0), 100)}%` }} />
        </div>
        <div className="mt-5 rounded-2xl border border-border/70 bg-muted/25 p-4">
          <p className="text-sm font-semibold text-foreground">Următorul pas recomandat</p>
          <p className="mt-1 text-sm text-muted-foreground">{onboarding.nextRecommendedStep?.label || 'Revizuire finală'}</p>
        </div>
        <Link href={localizedPath(`/superadmin/organizations/${id}/onboarding`)} className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
          <ClipboardList className="h-4 w-4" />
          Deschide workspace onboarding
        </Link>
      </Card>

      <Card>
        <SectionHeader title="Date client" description="Informații utile pentru pregătirea lansării." />
        {detail.sourceAccessRequest ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Persoană contact" value={detail.sourceAccessRequest.contactName || '-'} icon={<Users className="h-4 w-4" />} />
            <Info label="Telefon" value={detail.sourceAccessRequest.phone || '-'} icon={<Phone className="h-4 w-4" />} />
            <Info label="Email" value={detail.sourceAccessRequest.email || '-'} icon={<Mail className="h-4 w-4" />} />
            <Info label="Data cererii" value={formatDate(detail.sourceAccessRequest.createdAt)} icon={<Activity className="h-4 w-4" />} />
          </div>
        ) : (
          <EmptyBlock title="Nu există cerere inițială legată" description="Organizația nu pare să fi fost creată prin fluxul Cere acces." />
        )}
      </Card>
    </section>
  );
}

function HandoverTab({
  detail,
  onInvite,
  onResend,
  onCancel,
  loadingInvitationId,
  latestInviteLink,
}: {
  detail: any;
  onInvite: () => void;
  onResend: (invitationId: string) => void;
  onCancel: (invitationId: string) => void;
  loadingInvitationId: string;
  latestInviteLink: string;
}) {
  const handover = detail.adminHandover || {};
  const invitations = handover.invitations || [];
  const mainAdmin = handover.mainAdmin || detail.mainAdmin;
  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <SectionHeader title="Admin handover" description="Predarea accesului către administratorul real al APC-ului." />
          <div className="space-y-3">
            <StatusRow label="Status predare" value={handoverLabels[handover.status] || handover.status || 'Neînceput'} tone={handoverTone(handover.status)} />
            <StatusRow label="Admin principal" value={mainAdmin?.name || 'Neatribuit'} tone={mainAdmin ? 'success' : 'warning'} />
            <StatusRow label="Invitat la" value={handover.invitedAt ? formatDate(handover.invitedAt) : '-'} tone={handover.invitedAt ? 'default' : 'neutral'} />
            <StatusRow label="Acceptat la" value={handover.acceptedAt ? formatDate(handover.acceptedAt) : '-'} tone={handover.acceptedAt ? 'success' : 'neutral'} />
            <StatusRow label="First login" value={handover.firstLoginAt ? formatDate(handover.firstLoginAt) : '-'} tone={handover.firstLoginAt ? 'success' : 'warning'} />
          </div>
          <button type="button" onClick={onInvite} className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
            <UserPlus className="h-4 w-4" />
            Trimite invitație Admin
          </button>
        </Card>

        <Card>
          <SectionHeader title="Link invitație" description="Linkul este disponibil imediat după creare sau retrimitere." />
          {latestInviteLink ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-semibold text-emerald-900">Link nou generat</p>
              <input className="input mt-2 bg-white" readOnly value={latestInviteLink} />
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(latestInviteLink).catch(() => undefined)}
                className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-2xl border border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-900"
              >
                <Copy className="h-4 w-4" />
                Copiază link invitație
              </button>
            </div>
          ) : (
            <EmptyBlock title="Adminul nu a fost invitat încă." description="Creează o invitație sau retrimite una existentă pentru a genera un link nou." />
          )}
        </Card>
      </section>

      <Card noPadding>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-5">
          <SectionHeader title="Invitații trimise" description="Istoricul invitațiilor Admin pentru această organizație." className="mb-0" />
          <button type="button" onClick={onInvite} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
            <UserPlus className="h-4 w-4" />
            Invitație nouă
          </button>
        </div>
        {invitations.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border/70 bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Admin</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Expiră</th>
                  <th className="px-5 py-3">Acceptată</th>
                  <th className="px-5 py-3">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {invitations.map((invitation: any) => (
                  <tr key={invitation.id}>
                    <td className="px-5 py-4 font-semibold text-foreground">{invitation.name || invitation.acceptedBy?.name || '-'}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      <div>{invitation.email || '-'}</div>
                      <div>{invitation.phone || '-'}</div>
                    </td>
                    <td className="px-5 py-4"><Badge variant={invitationStatusTone(invitation.status)}>{invitationStatusLabel(invitation.status)}</Badge></td>
                    <td className="px-5 py-4 text-muted-foreground">{formatDate(invitation.expiresAt)}</td>
                    <td className="px-5 py-4 text-muted-foreground">{invitation.acceptedAt ? formatDate(invitation.acceptedAt) : '-'}</td>
                    <td className="px-5 py-4">
                      {invitation.status === 'PENDING' ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onResend(invitation.id)}
                            disabled={loadingInvitationId === invitation.id}
                            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-border/70 px-3 text-xs font-semibold text-foreground hover:bg-muted/60 disabled:opacity-60"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Retrimite
                          </button>
                          <button
                            type="button"
                            onClick={() => onCancel(invitation.id)}
                            disabled={loadingInvitationId === invitation.id}
                            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Anulează
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">Fără acțiuni</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyBlock title="Adminul nu a fost invitat încă." description="Când trimiți prima invitație, statusul de predare va apărea aici." />
          </div>
        )}
      </Card>
    </div>
  );
}

function UsersTab({
  detail,
  onInvite,
  onDeactivate,
  userActionError,
}: {
  detail: any;
  onInvite: () => void;
  onDeactivate: (user: any) => void;
  userActionError: string;
}) {
  const users = detail.users || [];
  return (
    <Card noPadding>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-5">
        <SectionHeader title="Utilizatori organizație" description="Conturile legate strict de această organizație." className="mb-0" />
        <button type="button" onClick={onInvite} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
          <UserPlus className="h-4 w-4" />
          Invită admin
        </button>
      </div>
      {userActionError ? <Notice tone="error" className="m-5">{userActionError}</Notice> : null}
      {users.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border/70 bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Nume</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Telefon</th>
                <th className="px-5 py-3">Rol</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Creat</th>
                <th className="px-5 py-3">Last login</th>
                <th className="px-5 py-3">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {users.map((user: any) => (
                <tr key={user.id}>
                  <td className="px-5 py-4 font-semibold text-foreground">{user.name || '-'}</td>
                  <td className="px-5 py-4 text-muted-foreground">{user.email || '-'}</td>
                  <td className="px-5 py-4 text-muted-foreground">{user.phone || '-'}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="neutral">{userRoleLabels[user.role] || user.role}</Badge>
                      {user.membershipRole ? <Badge variant="default">{user.membershipRole}</Badge> : null}
                    </div>
                  </td>
                  <td className="px-5 py-4"><Badge variant={user.isActive ? 'success' : 'neutral'}>{user.isActive ? 'Activ' : 'Inactiv'}</Badge></td>
                  <td className="px-5 py-4 text-muted-foreground">{formatDate(user.createdAt)}</td>
                  <td className="px-5 py-4 text-muted-foreground">{user.lastLoginAt ? formatDate(user.lastLoginAt) : '-'}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {user.role === 'ADMIN' && user.isActive ? (
                        <button type="button" onClick={() => onDeactivate(user)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100">
                          Dezactivează
                        </button>
                      ) : null}
                      <span className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                        Rol prin Team
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-5">
          <EmptyBlock title="Nu există utilizatori încă" description="Invită primul admin pentru această organizație." />
        </div>
      )}
    </Card>
  );
}

function StructureTab({ detail, localizedPath, id }: { detail: any; localizedPath: (path: string) => string; id: string }) {
  const buildings = detail.structure?.buildings || [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href={localizedPath(`/superadmin/associations/new?id=${id}`)} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
          <Building2 className="h-4 w-4" />
          Mergi la configurare structură
        </Link>
        <Link href={localizedPath(`/superadmin/associations/new?id=${id}`)} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
          Adaugă bloc
        </Link>
        <Link href={localizedPath(`/superadmin/associations/new?id=${id}`)} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
          Adaugă scară
        </Link>
      </div>
      {buildings.length ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {buildings.map((building: any) => (
            <Card key={building.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{building.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{building.address || 'Adresă necompletată'}</p>
                </div>
                <Badge variant="neutral">{building.apartmentsCount || 0} apartamente</Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Info label="Etaje" value={String(building.totalFloors || 0)} icon={<Layers3 className="h-4 w-4" />} />
                <Info label="Scări" value={String(building.staircasesCount || 0)} icon={<DoorOpen className="h-4 w-4" />} />
                <Info label="Creat" value={formatDate(building.createdAt)} icon={<Activity className="h-4 w-4" />} />
              </div>
              <div className="mt-4 space-y-2">
                {building.staircases?.length ? building.staircases.map((staircase: any) => (
                  <div key={staircase.id} className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/25 px-3 py-2 text-sm">
                    <span className="font-medium text-foreground">{staircase.name}</span>
                    <span className="text-muted-foreground">{staircase.apartmentsCount || 0} apartamente · {staircase.floorsCount || 0} etaje</span>
                  </div>
                )) : (
                  <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Nu există scări configurate pentru acest bloc.</p>
                )}
              </div>
            </Card>
          ))}
        </section>
      ) : (
        <Card>
          <EmptyBlock title="Nu există structură configurată" description="Adaugă blocuri și scări pentru a pregăti organizația." />
        </Card>
      )}
    </div>
  );
}

function ApartmentsTab({ detail, filteredApartments, search, onSearch }: { detail: any; filteredApartments: any[]; search: string; onSearch: (value: string) => void }) {
  const meta = detail.apartments?.meta || {};
  return (
    <Card noPadding>
      <div className="flex flex-col gap-3 border-b border-border/70 p-5 lg:flex-row lg:items-center lg:justify-between">
        <SectionHeader title="Apartamente" description={`${meta.total || 0} apartamente reale în organizație.`} className="mb-0" />
        <input className="input max-w-sm" placeholder="Caută apartament, bloc, scară, locatar" value={search} onChange={(event) => onSearch(event.target.value)} />
      </div>
      {meta.total > meta.returned ? (
        <p className="mx-5 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          Se afișează primele {meta.returned} din {meta.total} apartamente. Pentru liste mari folosește modulele Admin dedicate.
        </p>
      ) : null}
      {filteredApartments.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-border/70 bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Nr.</th>
                <th className="px-5 py-3">Bloc / scară</th>
                <th className="px-5 py-3">Etaj</th>
                <th className="px-5 py-3">Suprafață</th>
                <th className="px-5 py-3">Locatar/proprietar</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filteredApartments.map((apartment) => (
                <tr key={apartment.id}>
                  <td className="px-5 py-4 font-semibold text-foreground">{apartment.number}</td>
                  <td className="px-5 py-4 text-muted-foreground">{apartment.building?.name || '-'} / {apartment.staircase?.name || '-'}</td>
                  <td className="px-5 py-4 text-muted-foreground">{apartment.floor ?? '-'}</td>
                  <td className="px-5 py-4 text-muted-foreground">{apartment.areaM2 ? `${apartment.areaM2} m²` : '-'}</td>
                  <td className="px-5 py-4 text-muted-foreground">{apartment.ownerResident?.name || apartment.residents?.[0]?.resident?.name || '-'}</td>
                  <td className="px-5 py-4"><Badge variant="neutral">{apartmentStatusLabels[apartment.status] || apartment.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-5">
          <EmptyBlock title="Nu există apartamente afișabile" description={search ? 'Nu există rezultate pentru căutarea curentă.' : 'Apartamentele vor apărea aici după import sau adăugare manuală.'} />
        </div>
      )}
    </Card>
  );
}

function BillingTab({ detail, localizedPath, id }: { detail: any; localizedPath: (path: string) => string; id: string }) {
  const billing = detail.billing || {};
  if (!billing.configured) {
    return (
      <Card>
        <EmptyBlock title="Facturarea nu este configurată încă." description="Când există setări, plan sau facturi, informațiile vor apărea aici." />
        <Link href={localizedPath(`/superadmin/organizations/${id}/subscription`)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
          <CreditCard className="h-4 w-4" />
          Configurează abonament
        </Link>
      </Card>
    );
  }
  const plan = billing.platformSubscription || billing.legacySubscription;
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total facturi" value={billing.invoicesCount || 0} description="Facturare locatari/client" icon={<Receipt className="h-5 w-5" />} />
        <StatCard label="Total plăți" value={billing.paymentsCount || 0} description="Plăți înregistrate" icon={<CreditCard className="h-5 w-5" />} />
        <StatCard label="Facturi SaaS" value={billing.platformInvoicesCount || 0} description="Facturi platformă" icon={<Receipt className="h-5 w-5" />} />
        <StatCard label="Plăți SaaS" value={billing.platformPaymentsCount || 0} description="Plăți platformă" icon={<CreditCard className="h-5 w-5" />} />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Plan / platform billing" description="Abonamentul clientului dacă este configurat." />
          {plan ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Plan" value={plan.plan?.name || plan.plan?.code || plan.plan || '-'} icon={<CreditCard className="h-4 w-4" />} />
              <Info label="Status" value={plan.status || '-'} icon={<Shield className="h-4 w-4" />} />
              <Info label="Preț" value={plan.price !== undefined ? `${plan.price} ${plan.currency || ''}` : '-'} icon={<Receipt className="h-4 w-4" />} />
              <Info label="Următoarea facturare" value={plan.nextBillingDate ? formatDate(plan.nextBillingDate) : '-'} icon={<Activity className="h-4 w-4" />} />
            </div>
          ) : (
            <EmptyBlock title="Nu există plan configurat" description="Abonamentul poate fi configurat din pagina dedicată." />
          )}
        </Card>
        <Card>
          <SectionHeader title="Ultima factură / plată" description="Rezumat financiar recent." />
          <div className="space-y-3">
            <StatusRow label="Ultima factură" value={billing.latestInvoices?.[0] ? `${billing.latestInvoices[0].finalAmount || billing.latestInvoices[0].amount} MDL` : '-'} tone={billing.latestInvoices?.[0] ? 'default' : 'neutral'} />
            <StatusRow label="Ultima plată" value={billing.latestPayments?.[0] ? `${billing.latestPayments[0].amount} ${billing.latestPayments[0].currency || 'MDL'}` : '-'} tone={billing.latestPayments?.[0] ? 'success' : 'neutral'} />
            <StatusRow label="Setări facturare" value={billing.settings ? 'Inițializate' : 'Neconfigurate'} tone={billing.settings ? 'success' : 'warning'} />
          </div>
        </Card>
      </section>
    </div>
  );
}

function DocumentsTab({ detail }: { detail: any }) {
  const documents = detail.documents?.items || [];
  return (
    <Card noPadding>
      <div className="border-b border-border/70 p-5">
        <SectionHeader title="Documente" description={`${detail.documents?.meta?.total || 0} documente încărcate.`} className="mb-0" />
      </div>
      {documents.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border/70 bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Document</th>
                <th className="px-5 py-3">Categorie</th>
                <th className="px-5 py-3">Visibility</th>
                <th className="px-5 py-3">Încărcat de</th>
                <th className="px-5 py-3">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {documents.map((document: any) => (
                <tr key={document.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-foreground">{document.title || document.fileName}</p>
                    <p className="text-xs text-muted-foreground">{document.fileName}</p>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{document.fileType || '-'}</td>
                  <td className="px-5 py-4"><Badge variant="neutral">{document.targetType || 'ORGANIZATION'}</Badge></td>
                  <td className="px-5 py-4 text-muted-foreground">{document.uploadedBy?.name || '-'}</td>
                  <td className="px-5 py-4 text-muted-foreground">{formatDate(document.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-5">
          <EmptyBlock title="Nu există documente încărcate pentru această organizație." description="Documentele încărcate de Admin sau Superadmin vor apărea aici." />
        </div>
      )}
    </Card>
  );
}

function ContractTab({
  detail,
  billingTasks,
  localizedPath,
  onEditContract,
  onEditSubscription,
}: {
  detail: any;
  billingTasks: any[];
  localizedPath: (path: string) => string;
  onEditContract: () => void;
  onEditSubscription: () => void;
}) {
  const contract = detail.contract || null;
  const subscription = detail.subscription || detail.billing?.platformSubscription || null;
  const summary = detail.contractSummary || {};
  const warnings = summary.warnings || [];
  const currency = contract?.currency || subscription?.currency || detail.organization?.currency || 'MDL';
  return (
    <div className="space-y-4">
      {warnings.length ? (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <h2 className="font-semibold text-amber-950">Atenție</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {warnings.map((warning: string) => <Badge key={warning} variant="warning">{warning}</Badge>)}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="Contract & abonament" description="Evidență comercială internă pentru acest client." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusRow label="Status contract" value={contractStatusLabel(summary.contractStatus || contract?.status || 'NOT_STARTED')} tone={contractStatusTone(summary.contractStatus || contract?.status || 'NOT_STARTED')} />
          <StatusRow label="Status abonament" value={subscriptionStatusLabel(summary.subscriptionStatus || subscription?.status || 'Neactivat')} tone={subscriptionStatusTone(summary.subscriptionStatus || subscription?.status || '')} />
          <Info label="Plan" value={summary.planName || subscription?.planName || '-'} icon={<CreditCard className="h-4 w-4" />} />
          <Info label="Sumă lunară estimată" value={formatMoney(summary.estimatedMonthlyAmount, currency)} icon={<Receipt className="h-4 w-4" />} />
          <Info label="Billing cycle" value={contract?.billingCycle || '-'} icon={<Activity className="h-4 w-4" />} />
          <Info label="Data început" value={contract?.startDate ? formatDate(contract.startDate) : '-'} icon={<Activity className="h-4 w-4" />} />
          <Info label="Data expirare" value={contract?.endDate ? formatDate(contract.endDate) : '-'} icon={<Activity className="h-4 w-4" />} />
          <Info label="Următoarea facturare" value={subscription?.nextBillingDate ? formatDate(subscription.nextBillingDate) : '-'} icon={<Receipt className="h-4 w-4" />} />
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader title="Contract comercial" description="Termenii contractuali dintre Espace și organizație." />
            <button type="button" onClick={onEditContract} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60">
              {contract ? 'Editează contract' : 'Creează contract'}
            </button>
          </div>
          {contract ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Număr contract" value={contract.contractNumber || '-'} icon={<FileSignature className="h-4 w-4" />} />
              <StatusRow label="Status" value={contractStatusLabel(contract.status)} tone={contractStatusTone(contract.status)} />
              <Info label="Data început" value={contract.startDate ? formatDate(contract.startDate) : '-'} icon={<Activity className="h-4 w-4" />} />
              <Info label="Data expirare" value={contract.endDate ? formatDate(contract.endDate) : '-'} icon={<Activity className="h-4 w-4" />} />
              <Info label="Data semnării" value={contract.signedAt ? formatDate(contract.signedAt) : '-'} icon={<CheckCircle2 className="h-4 w-4" />} />
              <Info label="Document" value={contract.documentUrl ? <a className="font-semibold text-foreground underline" href={contract.documentUrl} target="_blank" rel="noreferrer">Deschide document</a> : '-'} icon={<FileText className="h-4 w-4" />} />
              <div className="sm:col-span-2">
                <Info label="Notă internă" value={contract.internalNote || '-'} icon={<FileText className="h-4 w-4" />} />
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyBlock title="Contractul comercial nu este creat încă." description="Creează contractul când clientul intră în negociere sau semnare." />
            </div>
          )}
        </Card>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader title="Abonament" description="Planul comercial și statusul intern al abonamentului." />
            <button type="button" onClick={onEditSubscription} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60">
              {subscription ? 'Editează abonament' : 'Creează abonament'}
            </button>
          </div>
          {subscription ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Plan" value={subscription.planName || '-'} icon={<CreditCard className="h-4 w-4" />} />
              <StatusRow label="Status" value={subscriptionStatusLabel(subscription.status)} tone={subscriptionStatusTone(subscription.status)} />
              <Info label="Started at" value={subscription.startedAt ? formatDate(subscription.startedAt) : '-'} icon={<Activity className="h-4 w-4" />} />
              <Info label="Trial ends at" value={subscription.trialEndsAt ? formatDate(subscription.trialEndsAt) : '-'} icon={<Activity className="h-4 w-4" />} />
              <Info label="Next billing date" value={subscription.nextBillingDate ? formatDate(subscription.nextBillingDate) : '-'} icon={<Receipt className="h-4 w-4" />} />
              <Info label="Current monthly amount" value={formatMoney(subscription.currentMonthlyAmount ?? subscription.price, subscription.currency || currency)} icon={<Receipt className="h-4 w-4" />} />
              <Info label="Currency" value={subscription.currency || currency} icon={<CreditCard className="h-4 w-4" />} />
              <Info label="Notă internă" value={subscription.internalNote || '-'} icon={<FileText className="h-4 w-4" />} />
            </div>
          ) : (
            <div className="mt-4">
              <EmptyBlock title="Abonamentul nu este activat încă." description="Creează abonamentul pentru a urmări planul, suma lunară și următoarea facturare." />
            </div>
          )}
        </Card>
      </section>

      <Card>
        <SectionHeader title="Pricing" description="Calcul intern al sumei lunare estimate. Nu procesează plăți reale." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Model tarifare" value={pricingModelLabel(contract?.pricingModel)} icon={<CreditCard className="h-4 w-4" />} />
          <Info label="Tarif per apartament" value={formatMoney(contract?.pricePerApartment, currency)} icon={<Home className="h-4 w-4" />} />
          <Info label="Apartamente reale" value={String(detail.stats?.apartmentsCount || 0)} icon={<Home className="h-4 w-4" />} />
          <Info label="Sumă estimată lunară" value={formatMoney(summary.estimatedMonthlyAmount, currency)} icon={<Receipt className="h-4 w-4" />} />
          <Info label="Minimum monthly fee" value={formatMoney(contract?.minimumMonthlyFee, currency)} icon={<Receipt className="h-4 w-4" />} />
          <Info label="Preț fix lunar" value={formatMoney(contract?.fixedMonthlyPrice, currency)} icon={<Receipt className="h-4 w-4" />} />
          <Info label="Apartamente incluse" value={contract?.apartmentsIncluded ?? '-'} icon={<Home className="h-4 w-4" />} />
          <Info label="Zi scadență" value={contract?.paymentDueDay ? `Ziua ${contract.paymentDueDay}` : '-'} icon={<Activity className="h-4 w-4" />} />
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeader title="Taskuri comerciale" description="Ultimele follow-up-uri de facturare legate de această organizație." />
          <Link href={localizedPath(`/superadmin/billing-tasks?organizationId=${detail.organization.id}`)} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
            Vezi toate taskurile
          </Link>
        </div>
        {billingTasks.length ? (
          <div className="mt-4 space-y-2">
            {billingTasks.map((task) => (
              <div key={task.id} className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-muted/25 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{task.dueDate ? `Scadență: ${formatDate(task.dueDate)}` : 'Fără scadență'}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Badge variant={taskPriorityTone(task.priority)}>{taskPriorityLabel(task.priority)}</Badge>
                  <Badge variant={taskStatusTone(task.status)}>{taskStatusLabel(task.status)}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyBlock title="Nu există taskuri comerciale pentru această organizație." description="Taskurile generate sau create manual vor apărea aici." />
          </div>
        )}
      </Card>
    </div>
  );
}

function ActivityTab({ items }: { items: any[] }) {
  return (
    <Card>
      <SectionHeader title="Activitate" description="Timeline Superadmin bazat pe audit log real." />
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4">
              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-white text-foreground">
                <Activity className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">{item.title || item.action || item.type}</p>
                  <Badge variant={item.severity === 'SUCCESS' ? 'success' : item.severity === 'WARNING' || item.severity === 'CRITICAL' ? 'warning' : 'neutral'}>{item.severity || 'INFO'}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.message || item.description || '-'}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatDate(item.createdAt)}</span>
                  {item.actor ? <span>Autor: {item.actor.fullName || item.actor.name || item.actor.email}</span> : <span>Autor: Sistem</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyBlock title="Nu există activitate încă." description="Evenimentele vor apărea aici când organizația este actualizată sau utilizată." />
      )}
    </Card>
  );
}

function WarningsPanel({ warnings }: { warnings: any[] }) {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <h2 className="font-semibold text-amber-950">Probleme de rezolvat</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {warnings.map((warning) => (
              <Badge key={warning.key} variant={warning.severity === 'blocking' ? 'error' : 'warning'}>{warning.message}</Badge>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function HeaderBackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
      <ArrowLeft className="h-4 w-4" />
      Înapoi la organizații
    </Link>
  );
}

function SectionHeader({ title, description, className = '' }: { title: string; description?: string; className?: string }) {
  return (
    <div className={className}>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</p>
      <p className="mt-2 break-words font-medium text-foreground">{value}</p>
    </div>
  );
}

function StatusRow({ label, value, tone }: { label: string; value: string; tone: BadgeTone }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/25 p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant={tone}>{value}</Badge>
    </div>
  );
}

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-5">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Notice({ tone, children, className = '' }: { tone: 'success' | 'error'; children: ReactNode; className?: string }) {
  const classes = tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-rose-200 bg-rose-50 text-rose-800';
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${classes} ${className}`.trim()}>{children}</div>;
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

function valueInput(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  return String(value);
}

function dateInputValue(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatMoney(value: unknown, currency = 'MDL') {
  if (value === undefined || value === null || value === '') return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(number);
}

function contractStatusLabel(status: string) {
  const labels: Record<string, string> = {
    NOT_STARTED: 'Neînceput',
    DRAFT: 'Draft',
    SENT: 'Trimis',
    SIGNED: 'Semnat',
    ACTIVE: 'Activ',
    PAUSED: 'Pauzat',
    CANCELLED: 'Anulat',
    EXPIRED: 'Expirat',
  };
  return labels[status] || status || '-';
}

function contractStatusTone(status: string): BadgeTone {
  if (status === 'SIGNED' || status === 'ACTIVE') return 'success';
  if (status === 'SENT' || status === 'DRAFT') return 'warning';
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'error';
  if (status === 'PAUSED') return 'neutral';
  return 'neutral';
}

function subscriptionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    TRIAL: 'Trial',
    ACTIVE: 'Activ',
    PAST_DUE: 'Restanță',
    PAUSED: 'Pauzat',
    SUSPENDED: 'Suspendat',
    CANCELLED: 'Anulat',
  };
  return labels[status] || status || '-';
}

function subscriptionStatusTone(status: string): BadgeTone {
  if (status === 'ACTIVE') return 'success';
  if (status === 'TRIAL') return 'default';
  if (status === 'PAST_DUE') return 'warning';
  if (status === 'CANCELLED' || status === 'SUSPENDED') return 'error';
  if (status === 'PAUSED') return 'neutral';
  return 'neutral';
}

function taskStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    OPEN: 'Deschis',
    IN_PROGRESS: 'În lucru',
    DONE: 'Finalizat',
    DISMISSED: 'Respins',
  };
  return status ? labels[status] || status : '-';
}

function taskStatusTone(status?: string): BadgeTone {
  if (status === 'DONE') return 'success';
  if (status === 'IN_PROGRESS') return 'warning';
  if (status === 'DISMISSED') return 'neutral';
  return 'default';
}

function taskPriorityLabel(priority?: string) {
  const labels: Record<string, string> = {
    LOW: 'Scăzută',
    NORMAL: 'Normală',
    HIGH: 'Ridicată',
    URGENT: 'Urgent',
  };
  return priority ? labels[priority] || priority : '-';
}

function taskPriorityTone(priority?: string): BadgeTone {
  if (priority === 'URGENT') return 'error';
  if (priority === 'HIGH') return 'warning';
  if (priority === 'LOW') return 'neutral';
  return 'default';
}

function pricingModelLabel(value?: string | null) {
  const labels: Record<string, string> = {
    PER_APARTMENT: 'Per apartament',
    FIXED_MONTHLY: 'Fix lunar',
    CUSTOM: 'Custom',
  };
  return value ? labels[value] || value : '-';
}

function invitationStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    PENDING: 'În așteptare',
    ACCEPTED: 'Acceptată',
    EXPIRED: 'Expirată',
    CANCELLED: 'Anulată',
  };
  return status ? labels[status] || status : '-';
}

function invitationStatusTone(status?: string): BadgeTone {
  if (status === 'ACCEPTED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'EXPIRED' || status === 'CANCELLED') return 'neutral';
  return 'neutral';
}

function handoverTone(status?: string): BadgeTone {
  if (status === 'ACTIVE' || status === 'FIRST_LOGIN_DONE') return 'success';
  if (status === 'ACCEPTED') return 'default';
  if (status === 'INVITED') return 'warning';
  return 'neutral';
}

function statusTone(status: string): BadgeTone {
  if (status === 'ACTIVE') return 'success';
  if (status === 'INACTIVE') return 'neutral';
  return 'warning';
}

function onboardingTone(status: string): BadgeTone {
  if (status === 'LAUNCHED' || status === 'COMPLETED' || status === 'READY_FOR_LAUNCH') return 'success';
  if (status === 'BLOCKED') return 'error';
  if (status === 'IN_PROGRESS') return 'default';
  return 'warning';
}

function launchTone(status: string): BadgeTone {
  if (status === 'LIVE') return 'success';
  if (status === 'READY') return 'default';
  if (status === 'INTERNAL_REVIEW') return 'warning';
  return 'neutral';
}

function formatDate(value?: string | Date | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
