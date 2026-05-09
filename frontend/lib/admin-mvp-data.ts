export type ApartmentStatus = 'Activ' | 'Datornic' | 'Nelocuit' | 'Problemă';
export type PersonRole = 'proprietar' | 'locatar' | 'chiriaș' | 'membru familie' | 'reprezentant';
export type AccountStatus = 'cont creat' | 'invitat' | 'fără cont';
export type MeterType = 'Apă rece' | 'Apă caldă' | 'Gaz' | 'Electricitate' | 'Încălzire';
export type MeterStatus = 'Actualizat' | 'Lipsă citire' | 'Suspect';
export type InvoiceStatus = 'Achitat' | 'Neachitat' | 'Întârziat';
export type IssueCategory = 'Apă' | 'Încălzire' | 'Curățenie' | 'Lift' | 'Reparații' | 'Altele';
export type IssuePriority = 'Normal' | 'Important' | 'Urgent';
export type IssueStatus = 'Nouă' | 'În lucru' | 'Rezolvată';
export type AnnouncementCategory = 'General' | 'Reparații' | 'Urgent' | 'Administrare';
export type AnnouncementStatus = 'Activ' | 'Arhivat';

export type AdminApartment = {
  id: string;
  organizationId?: string;
  buildingId?: string;
  buildingName?: string;
  staircaseId?: string;
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
  financialSummary?: {
    apartmentId: string;
    totalInvoiced: number;
    totalPaid: number;
    totalDebt: number;
    unpaidInvoicesCount: number;
    overdueInvoicesCount: number;
    lastPaymentDate?: string | null;
    lastInvoiceMonth?: string | null;
  };
};

export type AdminResident = {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  email: string;
  apartments: string[];
  role: PersonRole;
  accountStatus: AccountStatus;
  debt: number;
};

export type AdminMeter = {
  id: string;
  organizationId?: string;
  apartmentId?: string;
  apartment: string;
  staircase: string;
  floor: number;
  type: MeterType;
  serial: string;
  reading: string;
  readingDate: string;
  status: MeterStatus;
};

export type AdminInvoice = {
  id: string;
  organizationId?: string;
  apartmentId?: string;
  monthNumber?: number;
  yearNumber?: number;
  apartment: string;
  staircase: string;
  month: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  status: InvoiceStatus;
  paymentMethod?: string;
  paidDate?: string;
  paidAmount?: number;
  remainingAmount?: number;
  remainingDebt?: number;
};

export type AdminIssue = {
  id: string;
  title: string;
  category: IssueCategory;
  apartment: string;
  resident: string;
  message: string;
  description: string;
  date: string;
  priority: IssuePriority;
  status: IssueStatus;
  timeline: Array<{ title: string; date: string; note: string }>;
  internalNotes: string[];
};

export type AdminAnnouncement = {
  id: string;
  organizationId?: string;
  title: string;
  category: AnnouncementCategory;
  date: string;
  preview: string;
  content: string;
  status: AnnouncementStatus;
  audience: string;
};

export type AdminConversation = {
  id: string;
  resident: string;
  apartment: string;
  preview: string;
  time: string;
  unread: boolean;
  messages: Array<{ id: string; sender: string; content: string; mine?: boolean; time: string }>;
};

export const adminApartments: AdminApartment[] = [
  {
    id: 'apt-temp',
    number: 'T-1',
    staircase: 'Scara 2',
    floor: 6,
    areaM2: 72.4,
    rooms: 3,
    owner: 'Locatar temporar',
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
    id: 'locatar-temporar',
    name: 'Locatar temporar',
    phone: '+373 69 111 222',
    email: 'locatar.temporar@example.com',
    apartments: ['T-1'],
    role: 'proprietar',
    accountStatus: 'cont creat',
    debt: 1240,
  },
  {
    id: 'popescu-maria',
    name: 'Popescu Maria',
    phone: '+373 69 111 223',
    email: 'maria.popescu@example.com',
    apartments: ['T-1'],
    role: 'membru familie',
    accountStatus: 'cont creat',
    debt: 1240,
  },
  {
    id: 'popescu-andrei',
    name: 'Popescu Andrei',
    phone: '+373 69 111 224',
    email: 'andrei.popescu@example.com',
    apartments: ['T-1'],
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

export const adminMeters: AdminMeter[] = [
  {
    id: 'meter-45-ar',
    apartment: 'T-1',
    staircase: 'Scara 2',
    floor: 6,
    type: 'Apă rece',
    serial: 'AR-024531',
    reading: '124 m³',
    readingDate: '30 Aprilie 2026',
    status: 'Actualizat',
  },
  {
    id: 'meter-45-ac',
    apartment: 'T-1',
    staircase: 'Scara 2',
    floor: 6,
    type: 'Apă caldă',
    serial: 'AC-018992',
    reading: '89 m³',
    readingDate: '30 Aprilie 2026',
    status: 'Actualizat',
  },
  {
    id: 'meter-45-gz',
    apartment: 'T-1',
    staircase: 'Scara 2',
    floor: 6,
    type: 'Gaz',
    serial: 'GZ-771209',
    reading: 'Lipsă citire',
    readingDate: '12 Martie 2026',
    status: 'Lipsă citire',
  },
  {
    id: 'meter-72-ac',
    apartment: '72',
    staircase: 'Scara 3',
    floor: 9,
    type: 'Apă caldă',
    serial: 'AC-307218',
    reading: '91.8 m³',
    readingDate: '14 Martie 2026',
    status: 'Suspect',
  },
  {
    id: 'meter-18-el',
    apartment: '18',
    staircase: 'Scara 1',
    floor: 3,
    type: 'Electricitate',
    serial: 'EL-181903',
    reading: '4,810 kWh',
    readingDate: '28 Aprilie 2026',
    status: 'Actualizat',
  },
  {
    id: 'meter-8-ar',
    apartment: '8',
    staircase: 'Scara 1',
    floor: 1,
    type: 'Apă rece',
    serial: 'AR-080112',
    reading: 'Lipsă citire',
    readingDate: 'Nu există',
    status: 'Lipsă citire',
  },
];

export const adminInvoices: AdminInvoice[] = [
  {
    id: 'inv-45-2026-05',
    apartment: 'T-1',
    staircase: 'Scara 2',
    month: 'Mai 2026',
    invoiceNumber: 'FAC-2026-05-TMP',
    amount: 1240,
    dueDate: '10 Iunie 2026',
    status: 'Neachitat',
  },
  {
    id: 'inv-45-2026-04',
    apartment: 'T-1',
    staircase: 'Scara 2',
    month: 'Aprilie 2026',
    invoiceNumber: 'FAC-2026-04-TMP',
    amount: 620,
    dueDate: '10 Mai 2026',
    status: 'Întârziat',
  },
  {
    id: 'inv-18-2026-05',
    apartment: '18',
    staircase: 'Scara 1',
    month: 'Mai 2026',
    invoiceNumber: 'FAC-2026-05-018',
    amount: 1860,
    dueDate: '10 Iunie 2026',
    status: 'Achitat',
    paymentMethod: 'Card bancar',
    paidDate: '04 Mai 2026',
  },
  {
    id: 'inv-72-2026-05',
    apartment: '72',
    staircase: 'Scara 3',
    month: 'Mai 2026',
    invoiceNumber: 'FAC-2026-05-072',
    amount: 3860,
    dueDate: '10 Iunie 2026',
    status: 'Întârziat',
  },
  {
    id: 'inv-11-2026-05',
    apartment: '11',
    staircase: 'Scara 1',
    month: 'Mai 2026',
    invoiceNumber: 'FAC-2026-05-011',
    amount: 920,
    dueDate: '10 Iunie 2026',
    status: 'Neachitat',
  },
];

export const meterStatusVariant: Record<MeterStatus, 'success' | 'warning' | 'error'> = {
  Actualizat: 'success',
  'Lipsă citire': 'warning',
  Suspect: 'error',
};

export const invoiceStatusVariant: Record<InvoiceStatus, 'success' | 'warning' | 'error'> = {
  Achitat: 'success',
  Neachitat: 'warning',
  Întârziat: 'error',
};

export const adminIssues: AdminIssue[] = [
  {
    id: 'req-1',
    title: 'Infiltrație la balcon după ploaie',
    category: 'Apă',
    apartment: 'Apartament temporar',
    resident: 'Locatar temporar',
    message: 'Apa se scurge pe lângă rama balconului după ploile puternice.',
    description: 'Locatarul raportează infiltrații repetate în zona balconului. Este nevoie de verificarea hidroizolației și a scurgerii exterioare.',
    date: '30 Aprilie 2026',
    priority: 'Urgent',
    status: 'În lucru',
    timeline: [
      { title: 'Cerere primită', date: '30 Aprilie 2026, 18:20', note: 'Locatarul a trimis descrierea problemei.' },
      { title: 'Preluată de administrator', date: '30 Aprilie 2026, 18:32', note: 'Cererea a fost marcată în lucru.' },
      { title: 'Programare verificare', date: '02 Mai 2026, 09:00', note: 'Echipa tehnică verifică balconul și scurgerea.' },
    ],
    internalNotes: ['Prioritate ridicată din cauza riscului de deteriorare a finisajelor.', 'Verifică dacă problema afectează și Apt. 46.'],
  },
  {
    id: 'req-2',
    title: 'Verificare presiune apă caldă',
    category: 'Încălzire',
    apartment: 'Apartament temporar',
    resident: 'Popescu Maria',
    message: 'Presiunea apei calde este scăzută seara.',
    description: 'Presiunea apei calde scade după ora 20:00. Este necesară verificarea coloanei și a consumului pe scară.',
    date: '02 Mai 2026',
    priority: 'Important',
    status: 'Nouă',
    timeline: [{ title: 'Cerere primită', date: '02 Mai 2026, 20:14', note: 'Cerere nouă, încă nealocată.' }],
    internalNotes: ['Poate fi legată de lucrările recente pe Scara 2.'],
  },
  {
    id: 'req-3',
    title: 'Bec ars pe palier',
    category: 'Curățenie',
    apartment: 'Scara 1',
    resident: 'Ionescu Maria',
    message: 'Becul de la etajul 3 nu funcționează.',
    description: 'Iluminatul de pe palierul etajului 3, Scara 1, trebuie înlocuit.',
    date: '27 Aprilie 2026',
    priority: 'Normal',
    status: 'Rezolvată',
    timeline: [
      { title: 'Cerere primită', date: '27 Aprilie 2026, 10:12', note: 'Raportată de locatar.' },
      { title: 'Rezolvată', date: '28 Aprilie 2026, 12:40', note: 'Becul a fost înlocuit.' },
    ],
    internalNotes: ['Consumabil înlocuit din stocul APC.'],
  },
  {
    id: 'req-4',
    title: 'Ușă intrare defectă',
    category: 'Reparații',
    apartment: 'Bloc principal',
    resident: 'Grup locatari',
    message: 'Ușa de la intrare nu se închide complet.',
    description: 'Yala ușii de intrare trebuie reglată. Problema afectează accesul în bloc.',
    date: '04 Mai 2026',
    priority: 'Urgent',
    status: 'Nouă',
    timeline: [{ title: 'Cerere primită', date: '04 Mai 2026, 08:05', note: 'Raportată de mai mulți locatari.' }],
    internalNotes: ['Contactează furnizorul de mentenanță pentru acces.'],
  },
];

export const issueStatusVariant: Record<IssueStatus, 'default' | 'warning' | 'success'> = {
  Nouă: 'default',
  'În lucru': 'warning',
  Rezolvată: 'success',
};

export const issuePriorityVariant: Record<IssuePriority, 'neutral' | 'warning' | 'error'> = {
  Normal: 'neutral',
  Important: 'warning',
  Urgent: 'error',
};

export const adminAnnouncements: AdminAnnouncement[] = [
  {
    id: 'ann-1',
    title: 'Lucrări de întreținere la lift',
    category: 'Reparații',
    date: '03 Mai 2026',
    preview: 'Liftul de pe Scara 2 va fi verificat între orele 10:00 și 13:00.',
    content: 'Stimați locatari, liftul de pe Scara 2 va fi verificat între orele 10:00 și 13:00. Vă rugăm să planificați deplasările în avans. Echipa tehnică va afișa actualizări dacă intervenția durează mai mult.',
    status: 'Activ',
    audience: 'Toți locatarii de pe Scara 2',
  },
  {
    id: 'ann-2',
    title: 'Ședință APC pentru aprobarea bugetului',
    category: 'Administrare',
    date: '08 Mai 2026',
    preview: 'Locatarii sunt invitați la ședința lunară pentru aprobarea cheltuielilor comune.',
    content: 'Ședința APC va avea loc în data de 08 Mai 2026, ora 18:30, în spațiul comun de la parter. Pe agendă: cheltuieli comune, fond de reparații și planul de lucrări pentru luna următoare.',
    status: 'Activ',
    audience: 'Toți proprietarii și reprezentanții',
  },
  {
    id: 'ann-3',
    title: 'Avarie apă caldă pe Scara 3',
    category: 'Urgent',
    date: '01 Mai 2026',
    preview: 'Echipa tehnică investighează întreruperea apei calde.',
    content: 'Echipa tehnică investighează întreruperea apei calde pe Scara 3. Revenim cu actualizări imediat ce furnizorul confirmă ora estimată de remediere.',
    status: 'Activ',
    audience: 'Locatarii de pe Scara 3',
  },
  {
    id: 'ann-4',
    title: 'Program colectare deșeuri voluminoase',
    category: 'General',
    date: '25 Aprilie 2026',
    preview: 'Colectarea deșeurilor voluminoase a fost programată pentru weekend.',
    content: 'Colectarea deșeurilor voluminoase va avea loc sâmbătă, între orele 09:00 și 12:00. Vă rugăm să depozitați obiectele doar în zona marcată.',
    status: 'Arhivat',
    audience: 'Toți locatarii',
  },
];

export const announcementCategoryVariant: Record<AnnouncementCategory, 'default' | 'warning' | 'error' | 'neutral'> = {
  General: 'neutral',
  Reparații: 'warning',
  Urgent: 'error',
  Administrare: 'default',
};

export const adminConversations: AdminConversation[] = [
  {
    id: 'chat-1',
    resident: 'Locatar temporar',
    apartment: 'Apartament temporar',
    preview: 'Bună ziua, avem o problemă la balcon după ultima ploaie.',
    time: '18:20',
    unread: true,
    messages: [
      { id: 'm1', sender: 'Locatar temporar', content: 'Bună ziua, avem o problemă la balcon după ultima ploaie.', time: '18:20' },
      { id: 'm2', sender: 'Admin', content: 'Mulțumesc. Am creat o cerere și revenim cu programarea verificării.', mine: true, time: '18:24' },
      { id: 'm3', sender: 'Locatar temporar', content: 'Perfect, pot fi acasă mâine după ora 18:00.', time: '18:29' },
    ],
  },
  {
    id: 'chat-2',
    resident: 'Ionescu Maria',
    apartment: 'Apt. 18',
    preview: 'Mulțumesc, plata a fost confirmată.',
    time: '11:10',
    unread: false,
    messages: [
      { id: 'm4', sender: 'Admin', content: 'Plata pentru luna Mai a fost confirmată în sistem.', mine: true, time: '11:08' },
      { id: 'm5', sender: 'Ionescu Maria', content: 'Mulțumesc, plata a fost confirmată.', time: '11:10' },
    ],
  },
  {
    id: 'chat-3',
    resident: 'Grup Scara 2',
    apartment: 'Comunitate',
    preview: 'Discuție despre programul curățeniei.',
    time: '09:45',
    unread: false,
    messages: [
      { id: 'm6', sender: 'Grup Scara 2', content: 'Propunem curățenie suplimentară vinerea.', time: '09:45' },
      { id: 'm7', sender: 'Admin', content: 'Notat. Verific disponibilitatea furnizorului și revin cu opțiuni.', mine: true, time: '09:51' },
    ],
  },
];

export const coldWaterMeter = { type: 'Apă rece', serial: 'AR-024531', value: '124 m³', status: 'Actualizat' };
export const hotWaterMeter = { type: 'Apă caldă', serial: 'AC-018992', value: '89 m³', status: 'Actualizat' };
export const gasMeter = { type: 'Gaz', serial: 'GZ-771209', value: 'Lipsă citire', status: 'Lipsă citire' };

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

function statusFromApi(status?: string): ApartmentStatus {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'DEBTOR') return 'Datornic';
  if (normalized === 'PROBLEM') return 'Problemă';
  if (normalized === 'EMPTY') return 'Nelocuit';
  return 'Activ';
}

function lastPaymentLabel(value?: string | null) {
  if (!value) return 'Nu există';
  return new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(new Date(value));
}

export function normalizeApiApartment(row: any): AdminApartment {
  const number = String(row?.number || '');
  return {
    id: String(row?.id || `apt-${number || 'nou'}`),
    organizationId: row?.organizationId ? String(row.organizationId) : undefined,
    buildingId: row?.building?.id ? String(row.building.id) : row?.buildingId ? String(row.buildingId) : undefined,
    buildingName: row?.building?.name ? String(row.building.name) : row?.buildingName ? String(row.buildingName) : undefined,
    staircaseId: row?.staircase?.id ? String(row.staircase.id) : row?.staircaseId ? String(row.staircaseId) : undefined,
    number,
    staircase: String(row?.staircase?.name || row?.staircaseName || 'Scara -'),
    floor: Number(row?.floor ?? 0),
    areaM2: Number(row?.areaM2 ?? 0),
    rooms: Number(row?.rooms ?? 0),
    owner: String(row?.owner?.name || 'Fără proprietar conectat'),
    phone: String(row?.owner?.phone || '-'),
    residents: Number(row?.residentsCount ?? row?.residents?.length ?? 0),
    debt: Number(row?.debt ?? 0),
    unpaidInvoices: Number(row?.unpaidInvoices ?? 0),
    lastPayment: lastPaymentLabel(row?.lastPayment),
    metersUpdated: Number(row?.metersUpdated ?? 0),
    metersMissing: Number(row?.metersMissing ?? 0),
    status: statusFromApi(row?.status),
    hasAccount: Boolean(row?.owner?.email),
    financialSummary: row?.financialSummary
      ? {
          apartmentId: String(row.financialSummary.apartmentId || row?.id || ''),
          totalInvoiced: Number(row.financialSummary.totalInvoiced || 0),
          totalPaid: Number(row.financialSummary.totalPaid || 0),
          totalDebt: Number(row.financialSummary.totalDebt || 0),
          unpaidInvoicesCount: Number(row.financialSummary.unpaidInvoicesCount || 0),
          overdueInvoicesCount: Number(row.financialSummary.overdueInvoicesCount || 0),
          lastPaymentDate: row.financialSummary.lastPaymentDate || null,
          lastInvoiceMonth: row.financialSummary.lastInvoiceMonth || null,
        }
      : undefined,
  };
}

export function normalizeApiApartmentResidents(row: any) {
  return Array.isArray(row?.residents)
    ? row.residents.map((resident: any) => ({
        id: String(resident.id),
        name: String(resident.name || 'Locatar'),
        role:
          String(resident.role || '').toUpperCase() === 'OWNER'
            ? 'proprietar'
            : String(resident.role || '').toUpperCase() === 'FAMILY_MEMBER'
              ? 'membru familie'
              : 'locatar',
        accountStatus:
          String(resident.accountStatus || '').toUpperCase() === 'CREATED'
            ? 'cont creat'
            : String(resident.accountStatus || '').toUpperCase() === 'INVITED'
              ? 'invitat'
              : 'fără cont',
      }))
    : [];
}

export function normalizeApiApartmentMeters(row: any) {
  const typeLabel: Record<string, string> = {
    COLD_WATER: 'Apă rece',
    HOT_WATER: 'Apă caldă',
    GAS: 'Gaz',
    ELECTRICITY: 'Electricitate',
    HEATING: 'Încălzire',
  };
  return Array.isArray(row?.meters)
    ? row.meters.map((meter: any) => ({
        id: String(meter.id || meter.serialNumber || 'meter'),
        type: typeLabel[String(meter.type)] || String(meter.type || 'Contor'),
        serial: String(meter.serialNumber || '-'),
        value: meter.lastReading === null || meter.lastReading === undefined ? 'Lipsă citire' : `${meter.lastReading} m³`,
        status: String(meter.status || '').toUpperCase() === 'MISSING_READING' ? 'Lipsă citire' : 'Actualizat',
      }))
    : [];
}

function meterTypeFromApi(type?: string): MeterType {
  const normalized = String(type || '').toUpperCase();
  if (normalized === 'HOT_WATER') return 'Apă caldă';
  if (normalized === 'GAS') return 'Gaz';
  if (normalized === 'ELECTRICITY') return 'Electricitate';
  if (normalized === 'HEATING') return 'Încălzire';
  return 'Apă rece';
}

function meterStatusFromApi(status?: string, hasReading = true): MeterStatus {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'SUSPICIOUS') return 'Suspect';
  if (normalized === 'MISSING_READING' || normalized === 'INACTIVE' || !hasReading) return 'Lipsă citire';
  return 'Actualizat';
}

function meterReadingLabel(type: MeterType, value?: number | string | null) {
  if (value === null || value === undefined || value === '') return 'Lipsă citire';
  const unit = type === 'Electricitate' ? 'kWh' : type === 'Gaz' ? 'm³' : type === 'Încălzire' ? 'MWh' : 'm³';
  return `${Number(value).toLocaleString('ro-RO')} ${unit}`;
}

function dateLabel(value?: string | null) {
  if (!value) return 'Nu există';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}

export function normalizeApiMeter(row: any): AdminMeter {
  const type = meterTypeFromApi(row?.type);
  const hasReading = row?.lastReading?.value !== null && row?.lastReading?.value !== undefined;
  const apartmentNumber = String(row?.apartment?.number || '-');

  return {
    id: String(row?.id || row?.serialNumber || `meter-${apartmentNumber}`),
    organizationId: row?.organizationId ? String(row.organizationId) : row?.apartment?.organizationId ? String(row.apartment.organizationId) : undefined,
    apartmentId: row?.apartmentId ? String(row.apartmentId) : row?.apartment?.id ? String(row.apartment.id) : undefined,
    apartment: apartmentNumber,
    staircase: String(row?.staircase?.name || 'Scara -'),
    floor: Number(row?.apartment?.floor ?? 0),
    type,
    serial: String(row?.serialNumber || '-'),
    reading: meterReadingLabel(type, row?.lastReading?.value),
    readingDate: dateLabel(row?.lastReading?.readingDate),
    status: meterStatusFromApi(row?.status, hasReading),
  };
}

function invoiceStatusFromApi(status?: string): InvoiceStatus {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PAID') return 'Achitat';
  if (normalized === 'OVERDUE') return 'Întârziat';
  return 'Neachitat';
}

function invoiceMonthLabel(month?: number | string | null, year?: number | string | null) {
  const monthNumber = Number(month || 0);
  const yearNumber = Number(year || new Date().getFullYear());
  if (!monthNumber) return 'Luna curentă';
  const date = new Date(yearNumber, monthNumber - 1, 1);
  return new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(date);
}

function paymentMethodFromApi(method?: string | null) {
  const normalized = String(method || '').toUpperCase();
  if (normalized === 'CASH') return 'Numerar';
  if (normalized === 'BANK_TRANSFER') return 'Transfer bancar';
  if (normalized === 'CARD') return 'Card';
  if (normalized === 'BANK' || normalized === 'OTHER' || normalized === 'ONLINE') return 'Altă metodă';
  return undefined;
}

export function normalizeApiInvoice(row: any, payments: any[] = []): AdminInvoice {
  const apartment = String(row?.apartmentNumber || row?.apartment?.number || '-');
  const invoicePaymentNote = row?.id ? `Invoice ${row.id}` : '';
  const paidPayment =
    payments.find((payment) => invoicePaymentNote && payment.note === invoicePaymentNote && payment.status === 'CONFIRMED') ||
    payments.find((payment) => String(payment.apartmentId || '') === String(row?.apartmentId || '') && payment.status === 'CONFIRMED');

  return {
    id: String(row?.id || `invoice-${apartment}`),
    organizationId: row?.organizationId ? String(row.organizationId) : undefined,
    apartmentId: row?.apartmentId ? String(row.apartmentId) : row?.apartment?.id ? String(row.apartment.id) : undefined,
    monthNumber: Number(row?.month || 0) || undefined,
    yearNumber: Number(row?.year || 0) || undefined,
    apartment,
    staircase: String(row?.apartment?.staircase?.name || row?.staircase?.name || 'Scara -'),
    month: invoiceMonthLabel(row?.month, row?.year),
    invoiceNumber: String(row?.invoiceNumber || `FAC-${row?.year || '2026'}-${String(row?.month || '').padStart(2, '0')}-${apartment}`),
    amount: Number(row?.amount ?? row?.finalAmount ?? 0),
    dueDate: dateLabel(row?.dueDate),
    status: invoiceStatusFromApi(row?.status),
    paymentMethod: paymentMethodFromApi(paidPayment?.method) || paymentMethodFromApi(row?.paymentMethod),
    paidDate: dateLabel(paidPayment?.paidAt || row?.paidAt),
    paidAmount: Number(row?.paidAmount ?? paidPayment?.amount ?? 0),
    remainingAmount: Number(row?.remainingAmount ?? row?.remainingDebt ?? (String(row?.status || '').toUpperCase() === 'PAID' ? 0 : row?.amount ?? row?.finalAmount ?? 0)),
    remainingDebt: Number(row?.remainingDebt ?? row?.remainingAmount ?? (String(row?.status || '').toUpperCase() === 'PAID' ? 0 : row?.amount ?? row?.finalAmount ?? 0)),
  };
}

export function normalizeApiApartmentPayments(row: any) {
  if (Array.isArray(row?.invoices) && row.invoices.length) {
    return row.invoices.map((invoice: any) => ({
      month: `${String(invoice.month || '').padStart(2, '0')}.${invoice.year || ''}`,
      amount: Number(invoice.finalAmount || invoice.amount || 0),
      status:
        String(invoice.status || '').toUpperCase() === 'PAID'
          ? 'Achitat'
          : String(invoice.status || '').toUpperCase() === 'OVERDUE'
            ? 'Întârziat'
            : 'Neachitat',
    }));
  }
  return [];
}

export function normalizeApiApartmentRequests(row: any) {
  return Array.isArray(row?.issues)
    ? row.issues.map((issue: any) => ({
        title: String(issue.title || 'Cerere'),
        status:
          String(issue.status || '').toUpperCase() === 'RESOLVED'
            ? 'Rezolvată'
            : String(issue.status || '').toUpperCase() === 'IN_PROGRESS'
              ? 'În lucru'
              : 'Nouă',
        date: issue.createdAt ? new Intl.DateTimeFormat('ro-RO').format(new Date(issue.createdAt)) : '-',
      }))
    : [];
}

function roleFromApi(role?: string): PersonRole {
  const normalized = String(role || '').toUpperCase();
  if (normalized === 'OWNER') return 'proprietar';
  if (normalized === 'TENANT') return 'chiriaș';
  if (normalized === 'FAMILY_MEMBER') return 'membru familie';
  if (normalized === 'REPRESENTATIVE') return 'reprezentant';
  return 'locatar';
}

function accountFromApi(status?: string): AccountStatus {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'CREATED') return 'cont creat';
  if (normalized === 'INVITED') return 'invitat';
  return 'fără cont';
}

export function normalizeApiResident(row: any): AdminResident {
  const apartments = Array.isArray(row?.apartments) ? row.apartments.map((apartment: any) => String(apartment.number || '')) : [];
  return {
    id: String(row?.id || 'resident'),
    userId: row?.userId ? String(row.userId) : undefined,
    name: String(row?.name || `${row?.firstName || ''} ${row?.lastName || ''}`.trim() || 'Locatar'),
    phone: String(row?.phone || '-'),
    email: String(row?.email || '-'),
    apartments,
    role: roleFromApi(row?.role),
    accountStatus: accountFromApi(row?.accountStatus),
    debt: Number(row?.debt ?? 0),
  };
}

export function normalizeApiResidentApartments(row: any) {
  return Array.isArray(row?.apartments)
    ? row.apartments.map((apartment: any) => ({
        id: String(apartment.id),
        number: String(apartment.number || ''),
        staircase: String(apartment.staircase?.name || 'Scara -'),
        floor: Number(apartment.floor ?? 0),
        debt: Number(apartment.debt ?? 0),
        role: roleFromApi(apartment.role),
      }))
    : [];
}

export function normalizeApiResidentIssues(row: any) {
  return Array.isArray(row?.issues)
    ? row.issues.map((issue: any) => ({
        id: String(issue.id),
        title: String(issue.title || 'Cerere'),
        status:
          String(issue.status || '').toUpperCase() === 'RESOLVED'
            ? 'Rezolvată'
            : String(issue.status || '').toUpperCase() === 'IN_PROGRESS'
              ? 'În lucru'
              : 'Nouă',
        apartment: issue.apartment?.number ? `Apt. ${issue.apartment.number}` : 'Apt. -',
      }))
    : [];
}

export function normalizeApiResidentMessages(row: any) {
  return Array.isArray(row?.messages)
    ? row.messages.map((message: any) => ({
        id: String(message.id),
        subject: String(message.subject || 'Mesaj'),
        apartment: message.apartment?.number ? `Apt. ${message.apartment.number}` : 'Apt. -',
      }))
    : [];
}

function issueCategoryFromApi(category?: string): IssueCategory {
  const normalized = String(category || '').toUpperCase();
  if (normalized === 'WATER') return 'Apă';
  if (normalized === 'HEATING') return 'Încălzire';
  if (normalized === 'CLEANING') return 'Curățenie';
  if (normalized === 'ELEVATOR') return 'Lift';
  if (normalized === 'REPAIR') return 'Reparații';
  return 'Altele';
}

function issuePriorityFromApi(priority?: string): IssuePriority {
  const normalized = String(priority || '').toUpperCase();
  if (normalized === 'URGENT' || normalized === 'HIGH') return 'Urgent';
  if (normalized === 'IMPORTANT' || normalized === 'MEDIUM') return 'Important';
  return 'Normal';
}

function issueStatusFromApi(status?: string): IssueStatus {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'RESOLVED' || normalized === 'CLOSED') return 'Rezolvată';
  if (normalized === 'IN_PROGRESS' || normalized === 'WAITING') return 'În lucru';
  return 'Nouă';
}

export function normalizeApiIssue(row: any): AdminIssue {
  const category = issueCategoryFromApi(row?.category);
  const priority = issuePriorityFromApi(row?.priority);
  const status = issueStatusFromApi(row?.status);
  const apartment = row?.apartmentNumber ? `Apt. ${row.apartmentNumber}` : row?.apartment?.number ? `Apt. ${row.apartment.number}` : 'Spații comune';
  const resident = String(row?.residentName || row?.resident?.name || 'Locatar');
  const createdDate = dateLabel(row?.createdAt);

  return {
    id: String(row?.id || 'issue'),
    title: String(row?.title || 'Cerere'),
    category,
    apartment,
    resident,
    message: String(row?.preview || row?.description || ''),
    description: String(row?.description || row?.preview || ''),
    date: createdDate,
    priority,
    status,
    timeline: [
      { title: 'Cerere primită', date: createdDate, note: 'Înregistrată în platformă.' },
      ...(status !== 'Nouă' ? [{ title: 'Status actualizat', date: dateLabel(row?.updatedAt), note: `Status curent: ${status}.` }] : []),
    ],
    internalNotes: ['Note interne vizibile doar administratorilor.'],
  };
}

function announcementCategoryFromApi(category?: string): AnnouncementCategory {
  const normalized = String(category || '').toUpperCase();
  if (normalized === 'REPAIR') return 'Reparații';
  if (normalized === 'URGENT') return 'Urgent';
  if (normalized === 'ADMINISTRATION') return 'Administrare';
  return 'General';
}

function announcementStatusFromApi(status?: string): AnnouncementStatus {
  return String(status || '').toUpperCase() === 'ARCHIVED' ? 'Arhivat' : 'Activ';
}

function audienceFromApi(audience?: string | null) {
  const normalized = String(audience || '').toUpperCase();
  if (normalized === 'BUILDING') return 'Locatarii din blocul selectat';
  if (normalized === 'STAIRCASE') return 'Locatarii de pe scara selectată';
  if (normalized === 'APARTMENT') return 'Apartamentul selectat';
  return 'Toți locatarii';
}

export function normalizeApiAnnouncement(row: any): AdminAnnouncement {
  return {
    id: String(row?.id || 'announcement'),
    organizationId: row?.organizationId ? String(row.organizationId) : undefined,
    title: String(row?.title || 'Anunț'),
    category: announcementCategoryFromApi(row?.category),
    date: dateLabel(row?.createdAt),
    preview: String(row?.preview || row?.content || ''),
    content: String(row?.content || row?.preview || ''),
    status: announcementStatusFromApi(row?.status),
    audience: audienceFromApi(row?.audience),
  };
}

export function findIssueById(id?: string) {
  if (!id) return adminIssues[0];
  return adminIssues.find((issue) => issue.id === id) ?? adminIssues[0];
}

export function findAnnouncementById(id?: string) {
  if (!id) return adminAnnouncements[0];
  return adminAnnouncements.find((announcement) => announcement.id === id) ?? adminAnnouncements[0];
}
