export type CondoMeterStatus = 'actualizat' | 'lipsă citire' | 'suspect';
export type CondoApartmentStatus = 'activ' | 'nelocuit' | 'datornic' | 'problemă' | 'fără cont creat';
export type CondoPersonRole = 'proprietar' | 'locatar' | 'chiriaș' | 'membru familie' | 'reprezentant';
export type CondoAccountStatus = 'cont creat' | 'invitat' | 'fără cont';

export type CondoMeter = {
  type: 'Apă rece' | 'Apă caldă' | 'Gaz' | 'Electricitate' | 'Încălzire';
  serial: string;
  lastReading: string;
  readingDate: string;
  status: CondoMeterStatus;
};

export type CondoPerson = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  role: CondoPersonRole;
  accountStatus: CondoAccountStatus;
  apartments: string[];
  debt: number;
};

export type CondoApartment = {
  id: string;
  number: string;
  building: string;
  staircase: string;
  floor: number | null;
  areaM2: number | null;
  rooms: number | null;
  status: CondoApartmentStatus;
  owner: CondoPerson | null;
  residents: CondoPerson[];
  peopleCount: number;
  debt: number;
  paymentStatus: 'Achitat' | 'Neachitat' | 'Întârziat';
  lastPayment: string;
  meters: CondoMeter[];
  activeRequests: Array<{ id: string; title: string; status: 'nouă' | 'în lucru' | 'rezolvată' }>;
  notes: string;
};

export const fallbackCondoPeople: CondoPerson[] = [
  {
    id: 'person-1',
    fullName: 'Ion Popescu',
    phone: '+373 69 111 222',
    email: 'ion.popescu@example.com',
    role: 'proprietar',
    accountStatus: 'cont creat',
    apartments: ['24'],
    debt: 0,
  },
  {
    id: 'person-2',
    fullName: 'Maria Rusu',
    phone: '+373 68 333 444',
    email: 'maria.rusu@example.com',
    role: 'proprietar',
    accountStatus: 'invitat',
    apartments: ['31'],
    debt: 1280,
  },
  {
    id: 'person-3',
    fullName: 'Andrei Ceban',
    phone: '+373 67 555 666',
    email: 'andrei.ceban@example.com',
    role: 'chiriaș',
    accountStatus: 'fără cont',
    apartments: ['12'],
    debt: 460,
  },
];

export const fallbackCondoApartments: CondoApartment[] = [
  {
    id: 'apt-24',
    number: '24',
    building: 'Bloc A',
    staircase: 'Scara 1',
    floor: 4,
    areaM2: 68.4,
    rooms: 3,
    status: 'activ',
    owner: fallbackCondoPeople[0],
    residents: [fallbackCondoPeople[0]],
    peopleCount: 3,
    debt: 0,
    paymentStatus: 'Achitat',
    lastPayment: 'Aprilie 2026',
    meters: [
      { type: 'Apă rece', serial: 'AR-2401', lastReading: '128.4 m3', readingDate: '25.04.2026', status: 'actualizat' },
      { type: 'Apă caldă', serial: 'AC-2401', lastReading: '64.1 m3', readingDate: '25.04.2026', status: 'actualizat' },
      { type: 'Gaz', serial: 'G-2401', lastReading: '902 m3', readingDate: '20.04.2026', status: 'actualizat' },
    ],
    activeRequests: [],
    notes: 'Proprietarul preferă notificări pe email.',
  },
  {
    id: 'apt-31',
    number: '31',
    building: 'Bloc A',
    staircase: 'Scara 2',
    floor: 5,
    areaM2: 74.2,
    rooms: 3,
    status: 'datornic',
    owner: fallbackCondoPeople[1],
    residents: [fallbackCondoPeople[1]],
    peopleCount: 2,
    debt: 1280,
    paymentStatus: 'Întârziat',
    lastPayment: 'Februarie 2026',
    meters: [
      { type: 'Apă rece', serial: 'AR-3101', lastReading: '212.0 m3', readingDate: '12.03.2026', status: 'lipsă citire' },
      { type: 'Apă caldă', serial: 'AC-3101', lastReading: '91.8 m3', readingDate: '12.03.2026', status: 'lipsă citire' },
    ],
    activeRequests: [{ id: 'req-1', title: 'Infiltrație pe casa scării', status: 'în lucru' }],
    notes: 'De verificat citirile contoarelor la următoarea vizită.',
  },
  {
    id: 'apt-12',
    number: '12',
    building: 'Bloc B',
    staircase: 'Scara 1',
    floor: 2,
    areaM2: 51.7,
    rooms: 2,
    status: 'fără cont creat',
    owner: null,
    residents: [fallbackCondoPeople[2]],
    peopleCount: 1,
    debt: 460,
    paymentStatus: 'Neachitat',
    lastPayment: 'Martie 2026',
    meters: [
      { type: 'Apă rece', serial: 'AR-1201', lastReading: '88.2 m3', readingDate: '24.04.2026', status: 'actualizat' },
      { type: 'Electricitate', serial: 'E-1201', lastReading: '4810 kWh', readingDate: '10.04.2026', status: 'suspect' },
    ],
    activeRequests: [{ id: 'req-2', title: 'Zgomot la instalația de apă', status: 'nouă' }],
    notes: 'Nu există cont creat pentru proprietar.',
  },
  {
    id: 'apt-8',
    number: '8',
    building: 'Bloc B',
    staircase: 'Scara 1',
    floor: 1,
    areaM2: 47.5,
    rooms: 2,
    status: 'nelocuit',
    owner: null,
    residents: [],
    peopleCount: 0,
    debt: 0,
    paymentStatus: 'Achitat',
    lastPayment: 'Aprilie 2026',
    meters: [],
    activeRequests: [],
    notes: 'Apartament nelocuit temporar.',
  },
];

export function mapApartmentStatus(status: string | null | undefined, debt = 0, residentsCount = 0): CondoApartmentStatus {
  const normalized = String(status || '').toUpperCase();
  if (debt > 0) return 'datornic';
  if (residentsCount === 0) return 'fără cont creat';
  if (normalized === 'EMPTY') return 'nelocuit';
  return 'activ';
}

export function formatMdl(value: number): string {
  return `${Number(value || 0).toLocaleString('ro-MD', { maximumFractionDigits: 0 })} MDL`;
}
