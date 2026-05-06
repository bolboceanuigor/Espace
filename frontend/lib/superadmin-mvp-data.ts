export type AssociationStatus = 'ACTIVE' | 'TRIAL' | 'INACTIVE';

export type MvpAssociation = {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  currency: 'MDL' | 'RON' | 'EUR';
  status: AssociationStatus;
  apartmentsCount: number;
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
    name: 'APC Alba Iulia 75',
    address: 'Bd. Alba Iulia 75',
    city: 'Chișinău',
    country: 'MD',
    currency: 'MDL',
    status: 'ACTIVE',
    apartmentsCount: 142,
    administratorName: 'Marin Rusu',
    administratorEmail: 'marin.rusu@apc.md',
    administratorPhone: '+373 69 220 175',
  },
  {
    id: 'asociatia-teilor-residence',
    name: 'Asociația Teilor Residence',
    address: 'Str. Teilor 14',
    city: 'Iași',
    country: 'RO',
    currency: 'RON',
    status: 'TRIAL',
    apartmentsCount: 96,
    administratorName: 'Elena Munteanu',
    administratorEmail: 'elena.munteanu@example.ro',
    administratorPhone: '+40 721 300 018',
  },
  {
    id: 'apc-stefan-cel-mare-18',
    name: 'APC Ștefan cel Mare 18',
    address: 'Str. Ștefan cel Mare 18',
    city: 'Bălți',
    country: 'MD',
    currency: 'MDL',
    status: 'ACTIVE',
    apartmentsCount: 64,
    administratorName: 'Sergiu Ceban',
    administratorEmail: 'sergiu.ceban@apc.md',
    administratorPhone: '+373 78 440 018',
  },
  {
    id: 'condominiu-central-park',
    name: 'Condominiu Central Park',
    address: 'Str. Parcului 9',
    city: 'București',
    country: 'RO',
    currency: 'RON',
    status: 'INACTIVE',
    apartmentsCount: 214,
    administratorName: 'Andreea Pop',
    administratorEmail: 'andreea.pop@example.ro',
    administratorPhone: '+40 730 110 214',
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
  return {
    id: String(row?.id || crypto.randomUUID()),
    name: String(row?.name || 'Asociație fără nume'),
    address: String(row?.address || 'Adresă necompletată'),
    city: String(row?.city || 'Chișinău'),
    country: String(row?.country || 'MD'),
    currency: (row?.currency || 'MDL') as MvpAssociation['currency'],
    status: status.includes('TRIAL') ? 'TRIAL' : status.includes('INACTIVE') || status.includes('DISABLED') ? 'INACTIVE' : 'ACTIVE',
    apartmentsCount: Number(row?.apartmentsCount ?? row?.activeApartments ?? 0),
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
