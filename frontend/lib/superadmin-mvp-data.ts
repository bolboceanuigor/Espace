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

export function createAssociationId(name: string) {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'asociatie'}-${Date.now().toString(36)}`;
}
