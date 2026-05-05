export type ResidentInvoiceStatus = 'Achitat' | 'Neachitat' | 'Întârziat';
export type ResidentMeterStatus = 'Actualizat' | 'Lipsă citire';
export type ResidentIssueStatus = 'Nouă' | 'În lucru' | 'Rezolvată';
export type ResidentIssuePriority = 'Normal' | 'Important' | 'Urgent';
export type ResidentAnnouncementCategory = 'General' | 'Reparații' | 'Urgent' | 'Administrare';

export const residentProfile = {
  name: 'Popescu Ion',
  phone: '+373 69 111 222',
  email: 'ion.popescu@example.com',
  apartment: 'Apt. 45',
  staircase: 'Scara 2',
  role: 'Proprietar',
  building: 'APC Alba Iulia 75',
  currentBalance: 1240,
  status: 'Întârziat',
  nextDueDate: '25 Mai 2026',
};

export const residentInvoices = [
  {
    id: 'res-inv-2026-05',
    number: 'FAC-2026-05-045',
    month: 'Mai 2026',
    amount: 1240,
    dueDate: '25 Mai 2026',
    status: 'Întârziat' as ResidentInvoiceStatus,
    services: ['întreținere', 'fond reparații', 'apă', 'încălzire', 'curățenie', 'lift'],
    paidDate: '',
  },
  {
    id: 'res-inv-2026-04',
    number: 'FAC-2026-04-045',
    month: 'Aprilie 2026',
    amount: 1160,
    dueDate: '25 Aprilie 2026',
    status: 'Achitat' as ResidentInvoiceStatus,
    services: ['întreținere', 'fond reparații', 'apă', 'curățenie', 'lift'],
    paidDate: '21 Aprilie 2026',
  },
  {
    id: 'res-inv-2026-03',
    number: 'FAC-2026-03-045',
    month: 'Martie 2026',
    amount: 980,
    dueDate: '25 Martie 2026',
    status: 'Achitat' as ResidentInvoiceStatus,
    services: ['întreținere', 'apă', 'încălzire', 'curățenie'],
    paidDate: '18 Martie 2026',
  },
  {
    id: 'res-inv-2026-02',
    number: 'FAC-2026-02-045',
    month: 'Februarie 2026',
    amount: 1020,
    dueDate: '25 Februarie 2026',
    status: 'Neachitat' as ResidentInvoiceStatus,
    services: ['întreținere', 'fond reparații', 'apă', 'lift'],
    paidDate: '',
  },
];

export const residentMeters = [
  { id: 'meter-ar', type: 'Apă rece', serial: 'AR-024531', reading: '124 m³', date: '30 Aprilie 2026', status: 'Actualizat' as ResidentMeterStatus, unit: 'm³' },
  { id: 'meter-ac', type: 'Apă caldă', serial: 'AC-018992', reading: '89 m³', date: '30 Aprilie 2026', status: 'Actualizat' as ResidentMeterStatus, unit: 'm³' },
  { id: 'meter-gz', type: 'Gaz', serial: 'GZ-771209', reading: 'Lipsă citire', date: '12 Martie 2026', status: 'Lipsă citire' as ResidentMeterStatus, unit: 'm³' },
  { id: 'meter-el', type: 'Electricitate', serial: 'EL-450118', reading: '4,810 kWh', date: '29 Aprilie 2026', status: 'Actualizat' as ResidentMeterStatus, unit: 'kWh' },
];

export const residentIssues = [
  {
    id: 'res-issue-1',
    title: 'Verificare presiune apă caldă',
    category: 'Apă',
    date: '02 Mai 2026',
    status: 'În lucru' as ResidentIssueStatus,
    priority: 'Important' as ResidentIssuePriority,
    message: 'Presiunea apei calde este scăzută seara.',
  },
  {
    id: 'res-issue-2',
    title: 'Bec ars pe coridor',
    category: 'Curățenie',
    date: '24 Aprilie 2026',
    status: 'Rezolvată' as ResidentIssueStatus,
    priority: 'Normal' as ResidentIssuePriority,
    message: 'Becul de la etajul 6 a fost înlocuit.',
  },
  {
    id: 'res-issue-3',
    title: 'Ușă intrare defectă',
    category: 'Reparații',
    date: '04 Mai 2026',
    status: 'Nouă' as ResidentIssueStatus,
    priority: 'Urgent' as ResidentIssuePriority,
    message: 'Ușa de la intrare nu se închide complet.',
  },
];

export const residentAnnouncements = [
  {
    id: 'res-ann-1',
    title: 'Lucrări de întreținere la lift',
    category: 'Reparații' as ResidentAnnouncementCategory,
    date: '03 Mai 2026',
    content: 'Liftul de pe Scara 2 va fi verificat între orele 10:00 și 13:00.',
  },
  {
    id: 'res-ann-2',
    title: 'Avarie apă caldă pe Scara 3',
    category: 'Urgent' as ResidentAnnouncementCategory,
    date: '01 Mai 2026',
    content: 'Echipa tehnică investighează întreruperea. Revenim cu actualizări.',
  },
  {
    id: 'res-ann-3',
    title: 'Ședință APC pentru buget lunar',
    category: 'Administrare' as ResidentAnnouncementCategory,
    date: '08 Mai 2026',
    content: 'Proprietarii sunt invitați la ședința lunară pentru aprobarea cheltuielilor comune.',
  },
  {
    id: 'res-ann-4',
    title: 'Program colectare deșeuri voluminoase',
    category: 'General' as ResidentAnnouncementCategory,
    date: '25 Aprilie 2026',
    content: 'Colectarea deșeurilor voluminoase va avea loc sâmbătă, între 09:00 și 12:00.',
  },
];

export const residentMessages = [
  { id: 'msg-1', sender: 'Tu', content: 'Bună ziua, avem presiune mică la apa caldă.', mine: true, time: '18:20' },
  { id: 'msg-2', sender: 'Administrație', content: 'Mulțumim. Am creat o cerere și revenim cu programarea verificării.', mine: false, time: '18:24' },
  { id: 'msg-3', sender: 'Tu', content: 'Perfect, sunt acasă după ora 18:00.', mine: true, time: '18:29' },
];

export const residentInvoiceStatusVariant: Record<ResidentInvoiceStatus, 'success' | 'warning' | 'error'> = {
  Achitat: 'success',
  Neachitat: 'warning',
  Întârziat: 'error',
};

export const residentMeterStatusVariant: Record<ResidentMeterStatus, 'success' | 'warning'> = {
  Actualizat: 'success',
  'Lipsă citire': 'warning',
};

export const residentIssueStatusVariant: Record<ResidentIssueStatus, 'default' | 'warning' | 'success'> = {
  Nouă: 'default',
  'În lucru': 'warning',
  Rezolvată: 'success',
};

export const residentIssuePriorityVariant: Record<ResidentIssuePriority, 'neutral' | 'warning' | 'error'> = {
  Normal: 'neutral',
  Important: 'warning',
  Urgent: 'error',
};

export const residentAnnouncementVariant: Record<ResidentAnnouncementCategory, 'neutral' | 'warning' | 'error' | 'default'> = {
  General: 'neutral',
  Reparații: 'warning',
  Urgent: 'error',
  Administrare: 'default',
};
