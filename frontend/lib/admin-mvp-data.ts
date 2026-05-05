export type ApartmentStatus = 'Activ' | 'Datornic' | 'Nelocuit' | 'Problemă';
export type PersonRole = 'proprietar' | 'locatar' | 'chiriaș' | 'membru familie' | 'reprezentant';
export type AccountStatus = 'cont creat' | 'invitat' | 'fără cont';
export type MeterType = 'Apă rece' | 'Apă caldă' | 'Gaz' | 'Electricitate';
export type MeterStatus = 'Actualizat' | 'Lipsă citire' | 'Suspect';
export type InvoiceStatus = 'Achitat' | 'Neachitat' | 'Întârziat';
export type IssueCategory = 'Apă' | 'Încălzire' | 'Curățenie' | 'Lift' | 'Reparații' | 'Altele';
export type IssuePriority = 'Normal' | 'Important' | 'Urgent';
export type IssueStatus = 'Nouă' | 'În lucru' | 'Rezolvată';
export type AnnouncementCategory = 'General' | 'Reparații' | 'Urgent' | 'Administrare';
export type AnnouncementStatus = 'Activ' | 'Arhivat';

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

export type AdminMeter = {
  id: string;
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
  apartment: string;
  staircase: string;
  month: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  status: InvoiceStatus;
  paymentMethod?: string;
  paidDate?: string;
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

export const adminMeters: AdminMeter[] = [
  {
    id: 'meter-45-ar',
    apartment: '45',
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
    apartment: '45',
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
    apartment: '45',
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
    apartment: '45',
    staircase: 'Scara 2',
    month: 'Mai 2026',
    invoiceNumber: 'FAC-2026-05-045',
    amount: 1240,
    dueDate: '10 Iunie 2026',
    status: 'Neachitat',
  },
  {
    id: 'inv-45-2026-04',
    apartment: '45',
    staircase: 'Scara 2',
    month: 'Aprilie 2026',
    invoiceNumber: 'FAC-2026-04-045',
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
    apartment: 'Apt. 45',
    resident: 'Popescu Ion',
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
    apartment: 'Apt. 45',
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
    resident: 'Popescu Ion',
    apartment: 'Apt. 45',
    preview: 'Bună ziua, avem o problemă la balcon după ultima ploaie.',
    time: '18:20',
    unread: true,
    messages: [
      { id: 'm1', sender: 'Popescu Ion', content: 'Bună ziua, avem o problemă la balcon după ultima ploaie.', time: '18:20' },
      { id: 'm2', sender: 'Admin', content: 'Mulțumesc. Am creat o cerere și revenim cu programarea verificării.', mine: true, time: '18:24' },
      { id: 'm3', sender: 'Popescu Ion', content: 'Perfect, pot fi acasă mâine după ora 18:00.', time: '18:29' },
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

export function findIssueById(id?: string) {
  if (!id) return adminIssues[0];
  return adminIssues.find((issue) => issue.id === id) ?? adminIssues[0];
}

export function findAnnouncementById(id?: string) {
  if (!id) return adminAnnouncements[0];
  return adminAnnouncements.find((announcement) => announcement.id === id) ?? adminAnnouncements[0];
}
