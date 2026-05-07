export type AssociationStatus = 'ACTIVE' | 'TRIAL' | 'INACTIVE';

export type MvpAssociation = {
  id: string;
  name: string;
  legalName: string;
  shortName: string;
  associationCode: string;
  associationNumber: string;
  address: string;
  city: string;
  country: string;
  currency: 'MDL' | 'EUR' | 'USD';
  status: AssociationStatus;
  apartmentsCount: number;
  adminsCount?: number;
  usersCount?: number;
  administratorName: string;
  administratorEmail: string;
  administratorPhone: string;
};

export type MvpAdministrator = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organizationId: string;
  role: 'ADMIN';
  isActive?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  organization?: {
    id: string;
    name: string;
    shortName?: string;
    legalName?: string;
    associationCode?: string;
  } | null;
};

export type MvpPlan = {
  id: string;
  name: string;
  code: 'FREE' | 'TRIAL' | 'STARTER' | 'PRO';
  priceMonthly: number;
  currency: 'MDL' | 'EUR' | 'USD';
  apartmentLimit: number;
  features: string[];
  status: 'ACTIVE' | 'INACTIVE';
};

export type MvpUsage = {
  apartmentsCount: number;
  usersCount: number;
  residentsCount: number;
  metersCount: number;
  invoicesCount: number;
  apartmentLimit: number;
  usagePercentage: number;
};

export type MvpSubscription = {
  id: string;
  organizationId: string;
  planId: string;
  planCode: MvpPlan['code'];
  planName: string;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  trialEndsAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  monthlyCost: number;
  currency: MvpPlan['currency'];
  apartmentLimit: number;
  apartmentsCount: number;
  usagePercentage: number;
};

export const mockAssociations: MvpAssociation[] = [
  {
    id: 'apc-alba-iulia-75',
    name: 'A.P.C. A0123-0940',
    legalName: 'Asociația de Proprietari din Condominiu A0123-0940',
    shortName: 'A.P.C. A0123-0940',
    associationCode: 'A0123-0940',
    associationNumber: '0940',
    address: 'Bd. Alba Iulia 75',
    city: 'Chișinău',
    country: 'Republica Moldova',
    currency: 'MDL',
    status: 'ACTIVE',
    apartmentsCount: 142,
    adminsCount: 1,
    administratorName: 'Marin Rusu',
    administratorEmail: 'marin.rusu@apc.md',
    administratorPhone: '+373 69 220 175',
  },
  {
    id: 'apc-dacia-118',
    name: 'A.P.C. A0123-1180',
    legalName: 'Asociația de Proprietari din Condominiu A0123-1180',
    shortName: 'A.P.C. A0123-1180',
    associationCode: 'A0123-1180',
    associationNumber: '1180',
    address: 'Bd. Dacia 118',
    city: 'Chișinău',
    country: 'Republica Moldova',
    currency: 'MDL',
    status: 'TRIAL',
    apartmentsCount: 96,
    adminsCount: 1,
    administratorName: 'Elena Munteanu',
    administratorEmail: 'elena.munteanu@apc.md',
    administratorPhone: '+373 69 300 018',
  },
  {
    id: 'apc-stefan-cel-mare-18',
    name: 'A.P.C. A0123-0018',
    legalName: 'Asociația de Proprietari din Condominiu A0123-0018',
    shortName: 'A.P.C. A0123-0018',
    associationCode: 'A0123-0018',
    associationNumber: '0018',
    address: 'Str. Ștefan cel Mare 18',
    city: 'Bălți',
    country: 'Republica Moldova',
    currency: 'MDL',
    status: 'ACTIVE',
    apartmentsCount: 64,
    adminsCount: 1,
    administratorName: 'Sergiu Ceban',
    administratorEmail: 'sergiu.ceban@apc.md',
    administratorPhone: '+373 78 440 018',
  },
  {
    id: 'apc-independentei-44',
    name: 'A.P.C. A0123-0044',
    legalName: 'Asociația de Proprietari din Condominiu A0123-0044',
    shortName: 'A.P.C. A0123-0044',
    associationCode: 'A0123-0044',
    associationNumber: '0044',
    address: 'Str. Independenței 44',
    city: 'Orhei',
    country: 'Republica Moldova',
    currency: 'MDL',
    status: 'INACTIVE',
    apartmentsCount: 214,
    adminsCount: 1,
    administratorName: 'Ana Lungu',
    administratorEmail: 'ana.lungu@apc.md',
    administratorPhone: '+373 68 110 214',
  },
];

export const mockAdministrators: MvpAdministrator[] = mockAssociations.map((association, index) => {
  const [firstName, ...rest] = association.administratorName.split(' ');
  return {
    id: `admin-${index + 1}`,
    firstName,
    lastName: rest.join(' ') || 'Administrator',
    email: association.administratorEmail,
    phone: association.administratorPhone,
    organizationId: association.id,
    role: 'ADMIN',
    isActive: true,
    status: 'ACTIVE',
    organization: {
      id: association.id,
      name: association.shortName,
      shortName: association.shortName,
      legalName: association.legalName,
      associationCode: association.associationCode,
    },
  };
});

export const mockPlans: MvpPlan[] = [
  {
    id: 'plan-starter',
    name: 'Starter',
    code: 'STARTER',
    priceMonthly: 1290,
    currency: 'MDL',
    apartmentLimit: 150,
    features: ['Apartamente', 'Locatari', 'Contoare', 'Plăți', 'Cereri'],
    status: 'ACTIVE',
  },
  {
    id: 'plan-pro',
    name: 'Pro',
    code: 'PRO',
    priceMonthly: 2490,
    currency: 'MDL',
    apartmentLimit: 500,
    features: ['Apartamente', 'Locatari', 'Contoare', 'Plăți', 'Cereri', 'Mesaje', 'Rapoarte'],
    status: 'ACTIVE',
  },
  {
    id: 'plan-trial',
    name: 'Trial',
    code: 'TRIAL',
    priceMonthly: 0,
    currency: 'MDL',
    apartmentLimit: 75,
    features: ['Apartamente', 'Locatari', 'Contoare', 'Cereri'],
    status: 'ACTIVE',
  },
];

export const mockUsage: MvpUsage = {
  apartmentsCount: 142,
  usersCount: 4,
  residentsCount: 386,
  metersCount: 219,
  invoicesCount: 37,
  apartmentLimit: 150,
  usagePercentage: 95,
};

export function statusLabel(status: AssociationStatus) {
  if (status === 'ACTIVE') return 'Activă';
  if (status === 'TRIAL') return 'Trial';
  return 'Inactivă';
}

export function statusBadgeVariant(status: AssociationStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'TRIAL') return 'warning';
  return 'neutral';
}

export function normalizeApiAssociation(row: any): MvpAssociation {
  const status = String(row?.status || row?.subscriptionStatus || (row?.isActive === false ? 'INACTIVE' : 'ACTIVE')).toUpperCase();
  const associationCode = String(row?.associationCode || row?.fiscalCode || '').toUpperCase();
  const shortName = String(row?.shortName || row?.name || (associationCode ? `A.P.C. ${associationCode}` : 'A.P.C.'));
  const legalName = String(
    row?.legalName ||
      (associationCode ? `Asociația de Proprietari din Condominiu ${associationCode}` : row?.name || 'Asociația de Proprietari din Condominiu'),
  );
  const associationNumber = String(row?.associationNumber || associationCode.match(/-(\d{4})$/)?.[1] || '');
  const rawCountry = String(row?.country || 'Republica Moldova');
  const country = rawCountry === 'MD' || rawCountry.toLowerCase() === 'moldova' ? 'Republica Moldova' : rawCountry;
  return {
    id: String(row?.id || crypto.randomUUID()),
    name: shortName,
    shortName,
    legalName,
    associationCode,
    associationNumber,
    address: String(row?.address || 'Adresă necompletată'),
    city: String(row?.city || 'Chișinău'),
    country,
    currency: (row?.currency || 'MDL') as MvpAssociation['currency'],
    status: status.includes('TRIAL') ? 'TRIAL' : status.includes('INACTIVE') || status.includes('DISABLED') ? 'INACTIVE' : 'ACTIVE',
    apartmentsCount: Number(row?.apartmentsCount ?? row?.activeApartments ?? 0),
    adminsCount: Number(row?.adminsCount ?? 0),
    usersCount: Number(row?.usersCount ?? 0),
    administratorName: String(row?.administratorName || row?.adminName || 'Administrator neatribuit'),
    administratorEmail: String(row?.administratorEmail || row?.adminEmail || ''),
    administratorPhone: String(row?.administratorPhone || row?.adminPhone || ''),
  };
}

export function normalizeApiAdministrator(row: any): MvpAdministrator {
  const fullName = String(row?.fullName || '').trim();
  const [firstFromFull, ...restFromFull] = fullName.split(' ').filter(Boolean);
  return {
    id: String(row?.id || crypto.randomUUID()),
    firstName: String(row?.firstName || firstFromFull || 'Administrator'),
    lastName: String(row?.lastName || restFromFull.join(' ') || ''),
    email: String(row?.email || ''),
    phone: String(row?.phone || ''),
    organizationId: String(row?.organizationId || row?.organization?.id || ''),
    role: 'ADMIN',
    isActive: row?.isActive !== false && String(row?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE',
    status: row?.isActive === false || String(row?.status || '').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    createdAt: row?.createdAt ? String(row.createdAt) : undefined,
    organization: row?.organization
      ? {
          id: String(row.organization.id || ''),
          name: String(row.organization.name || ''),
          shortName: String(row.organization.shortName || row.organization.name || ''),
          legalName: String(row.organization.legalName || ''),
          associationCode: String(row.organization.associationCode || row.organization.fiscalCode || ''),
        }
      : null,
  };
}

export function normalizeApiPlan(row: any): MvpPlan {
  const code = String(row?.code || 'STARTER').toUpperCase();
  return {
    id: String(row?.id || crypto.randomUUID()),
    name: String(row?.name || 'Starter'),
    code: (['FREE', 'TRIAL', 'STARTER', 'PRO'].includes(code) ? code : 'STARTER') as MvpPlan['code'],
    priceMonthly: Number(row?.priceMonthly ?? row?.price ?? 0),
    currency: (row?.currency || 'MDL') as MvpPlan['currency'],
    apartmentLimit: Number(row?.apartmentLimit ?? 150),
    features: Array.isArray(row?.features) ? row.features.map(String) : ['Apartamente', 'Locatari', 'Contoare'],
    status: String(row?.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  };
}

export function normalizeApiUsage(row: any): MvpUsage {
  return {
    apartmentsCount: Number(row?.apartmentsCount ?? 0),
    usersCount: Number(row?.usersCount ?? 0),
    residentsCount: Number(row?.residentsCount ?? 0),
    metersCount: Number(row?.metersCount ?? 0),
    invoicesCount: Number(row?.invoicesCount ?? 0),
    apartmentLimit: Number(row?.apartmentLimit ?? 150),
    usagePercentage: Number(row?.usagePercentage ?? 0),
  };
}

export function normalizeApiSubscription(row: any, fallbackOrganizationId = ''): MvpSubscription | null {
  const source = row?.subscription ?? row;
  if (!source) return null;
  const status = String(source.status || 'TRIAL').toUpperCase();
  const code = String(source.planCode || source.plan || 'STARTER').toUpperCase();
  return {
    id: String(source.id || ''),
    organizationId: String(source.organizationId || row?.organizationId || fallbackOrganizationId),
    planId: String(source.planId || ''),
    planCode: (['FREE', 'TRIAL', 'STARTER', 'PRO'].includes(code) ? code : 'STARTER') as MvpPlan['code'],
    planName: String(source.planName || source.plan || 'Starter'),
    status: (['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'].includes(status) ? status : 'TRIAL') as MvpSubscription['status'],
    trialEndsAt: String(source.trialEndsAt || ''),
    currentPeriodStart: String(source.currentPeriodStart || ''),
    currentPeriodEnd: String(source.currentPeriodEnd || ''),
    monthlyCost: Number(source.monthlyCost ?? source.customPrice ?? source.price ?? 0),
    currency: (source.currency || 'MDL') as MvpPlan['currency'],
    apartmentLimit: Number(source.apartmentLimit ?? 150),
    apartmentsCount: Number(source.apartmentsCount ?? row?.apartmentsCount ?? 0),
    usagePercentage: Number(source.usagePercentage ?? 0),
  };
}

export function createAssociationId(name: string) {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'asociatie'}-${Date.now().toString(36)}`;
}
