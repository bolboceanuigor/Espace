export type ApartmentStatus = 'Activ' | 'Datornic' | 'Nelocuit' | 'Problemă';
export type PersonRole = 'proprietar' | 'locatar' | 'chiriaș' | 'membru familie' | 'reprezentant';
export type AccountStatus = 'cont creat' | 'invitat' | 'fără cont';

export type AdminApartment = {
  id: string;
  number: string;
  staircase: string;
  floor: number;
  areaM2: number;
  rooms: number;
  owner: string;
  phone: string;
  residents: number;
  debt: number;
  unpaidInvoices: number;
  lastPayment: string;
  metersUpdated: number;
  metersMissing: number;
  status: ApartmentStatus;
  hasAccount: boolean;
};

export type AdminResident = {
  id: string;
  name: string;
  phone: string;
  email: string;
  apartments: string[];
  role: PersonRole;
  accountStatus: AccountStatus;
  debt: number;
};

export const adminApartments: AdminApartment[] = [
  {
    id: 'apt-45',
    number: '45',
    staircase: 'Scara 2',
    floor: 6,
    areaM2: 72.4,
    rooms: 3,
    owner: 'Popescu Ion',
    phone: '+373 69 111 222',
    residents: 3,
    debt: 1240,
    unpaidInvoices: 2,
    lastPayment: 'Martie 2026',
    metersUpdated: 2,
    metersMissing: 1,
    status: 'Datornic',
    hasAccount: true,
  },
  {
    id: 'apt-18',
    number: '18',
    staircase: 'Scara 1',
    floor: 3,
    areaM2: 58.2,
    rooms: 2,
    owner: 'Ionescu Maria',
    phone: '+373 68 333 444',
    residents: 2,
    debt: 0,
    unpaidInvoices: 0,
    lastPayment: 'Aprilie 2026',
    metersUpdated: 3,
    metersMissing: 0,
    status: 'Activ',
    hasAccount: true,
  },
  {
    id: 'apt-72',
    number: '72',
    staircase: 'Scara 3',
    floor: 9,
    areaM2: 81.6,
    rooms: 4,
    owner: 'Ceban Andrei',
    phone: '+373 67 555 666',
    residents: 4,
    debt: 3860,
    unpaidInvoices: 4,
    lastPayment: 'Februarie 2026',
    metersUpdated: 1,
    metersMissing: 2,
    status: 'Problemă',
    hasAccount: false,
  },
  {
    id: 'apt-8',
    number: '8',
    staircase: 'Scara 1',
    floor: 1,
    areaM2: 47.5,
    rooms: 2,
    owner: 'Fără proprietar conectat',
    phone: '-',
    residents: 0,
    debt: 0,
    unpaidInvoices: 0,
    lastPayment: 'Aprilie 2026',
    metersUpdated: 0,
    metersMissing: 3,
    status: 'Nelocuit',
    hasAccount: false,
  },
];

export const adminResidents: AdminResident[] = [
  {
    id: 'popescu-ion',
    name: 'Popescu Ion',
    phone: '+373 69 111 222',
    email: 'ion.popescu@example.com',
    apartments: ['45'],
    role: 'proprietar',
    accountStatus: 'cont creat',
    debt: 1240,
  },
  {
    id: 'popescu-maria',
    name: 'Popescu Maria',
    phone: '+373 69 111 223',
    email: 'maria.popescu@example.com',
    apartments: ['45'],
    role: 'membru familie',
    accountStatus: 'cont creat',
    debt: 1240,
  },
  {
    id: 'popescu-andrei',
    name: 'Popescu Andrei',
    phone: '+373 69 111 224',
    email: 'andrei.popescu@example.com',
    apartments: ['45'],
    role: 'locatar',
    accountStatus: 'invitat',
    debt: 1240,
  },
  {
    id: 'ionescu-maria',
    name: 'Ionescu Maria',
    phone: '+373 68 333 444',
    email: 'maria.ionescu@example.com',
    apartments: ['18'],
    role: 'proprietar',
    accountStatus: 'invitat',
    debt: 0,
  },
  {
    id: 'ceban-andrei',
    name: 'Ceban Andrei',
    phone: '+373 67 555 666',
    email: 'andrei.ceban@example.com',
    apartments: ['72'],
    role: 'chiriaș',
    accountStatus: 'fără cont',
    debt: 3860,
  },
];

export const apartmentStatusVariant: Record<ApartmentStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  Activ: 'success',
  Datornic: 'error',
  Nelocuit: 'neutral',
  Problemă: 'warning',
};

export const accountStatusVariant: Record<AccountStatus, 'success' | 'warning' | 'neutral'> = {
  'cont creat': 'success',
  invitat: 'warning',
  'fără cont': 'neutral',
};

export const coldWaterMeter = { type: 'Apă rece', serial: 'AR-024531', value: '124 m³', status: 'Actualizat' };
export const hotWaterMeter = { type: 'Apă caldă', serial: 'AC-018992', value: '89 m³', status: 'Actualizat' };
export const gasMeter = { type: 'Gaz', serial: 'GZ-771209', value: 'Lipsă citire', status: 'Lipsă' };

export const apartmentMeters = [coldWaterMeter, hotWaterMeter, gasMeter];

export const apartmentPayments = [
  { month: 'Mai 2026', amount: 620, status: 'Neachitat' },
  { month: 'Aprilie 2026', amount: 620, status: 'Întârziat' },
  { month: 'Martie 2026', amount: 610, status: 'Achitat' },
];

export const apartmentRequests = [
  { title: 'Verificare presiune apă caldă', status: 'În lucru', date: '02 Mai 2026' },
  { title: 'Bec ars pe palier', status: 'Nouă', date: '04 Mai 2026' },
];

export function findApartmentById(id?: string) {
  if (!id) return adminApartments[0];
  return adminApartments.find((apartment) => apartment.id === id || apartment.number === id.replace(/^apt-/, '')) ?? adminApartments[0];
}

export function findResidentById(id?: string) {
  if (!id) return adminResidents[0];
  return adminResidents.find((resident) => resident.id === id) ?? adminResidents[0];
}

export function residentsForApartment(number: string) {
  return adminResidents.filter((resident) => resident.apartments.includes(number));
}
