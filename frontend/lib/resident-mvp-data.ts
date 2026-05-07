export type ResidentInvoiceStatus = 'Achitat' | 'Neachitat' | 'Întârziat';
export type ResidentMeterStatus = 'Actualizat' | 'Lipsă citire';
export type ResidentIssueStatus = 'Nouă' | 'În lucru' | 'Rezolvată';
export type ResidentIssuePriority = 'Normal' | 'Important' | 'Urgent';
export type ResidentAnnouncementCategory = 'General' | 'Reparații' | 'Urgent' | 'Administrare';
export type ResidentPayment = {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  status: string;
};

export const residentProfile = {
  name: 'Popescu Ion',
  phone: '+373 69 111 222',
  email: 'ion.popescu@example.com',
  apartment: 'Apt. 45',
  staircase: 'Scara 2',
  role: 'Proprietar',
  building: 'A.P.C. A0123-0940',
  buildingName: 'Bloc principal',
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
    paidAmount: 0,
    remainingAmount: 1240,
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
    paidAmount: 1160,
    remainingAmount: 0,
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
    paidAmount: 980,
    remainingAmount: 0,
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
    paidAmount: 0,
    remainingAmount: 1020,
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

export const residentPayments: ResidentPayment[] = [
  { id: 'pay-2026-04', amount: 1160, method: 'Card bancar', paidAt: '21 Aprilie 2026', status: 'CONFIRMED' },
  { id: 'pay-2026-03', amount: 980, method: 'Transfer bancar', paidAt: '18 Martie 2026', status: 'CONFIRMED' },
];

function dateLabel(value?: string | null) {
  if (!value) return 'Nu există';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}

function monthLabel(month?: number | string | null, year?: number | string | null) {
  const monthNumber = Number(month || 0);
  const yearNumber = Number(year || new Date().getFullYear());
  if (!monthNumber) return 'Luna curentă';
  return new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(new Date(yearNumber, monthNumber - 1, 1));
}

function invoiceStatusFromApi(status?: string): ResidentInvoiceStatus {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PAID') return 'Achitat';
  if (normalized === 'OVERDUE') return 'Întârziat';
  return 'Neachitat';
}

function invoiceStatusFromAmounts(status: ResidentInvoiceStatus, remainingAmount: number): ResidentInvoiceStatus {
  if (remainingAmount <= 0) return 'Achitat';
  return status;
}

function meterTypeFromApi(type?: string) {
  const normalized = String(type || '').toUpperCase();
  if (normalized === 'HOT_WATER') return 'Apă caldă';
  if (normalized === 'GAS') return 'Gaz';
  if (normalized === 'ELECTRICITY') return 'Electricitate';
  if (normalized === 'HEATING') return 'Încălzire';
  return 'Apă rece';
}

function meterUnit(type: string) {
  if (type === 'Electricitate') return 'kWh';
  if (type === 'Încălzire') return 'MWh';
  return 'm³';
}

function meterStatusFromApi(status?: string, hasReading = true): ResidentMeterStatus {
  const normalized = String(status || '').toUpperCase();
  return normalized === 'MISSING_READING' || normalized === 'INACTIVE' || !hasReading ? 'Lipsă citire' : 'Actualizat';
}

function issueCategoryFromApi(category?: string) {
  const normalized = String(category || '').toUpperCase();
  if (normalized === 'WATER') return 'Apă';
  if (normalized === 'HEATING') return 'Încălzire';
  if (normalized === 'CLEANING') return 'Curățenie';
  if (normalized === 'ELEVATOR') return 'Lift';
  if (normalized === 'REPAIR') return 'Reparații';
  return 'Altele';
}

function issuePriorityFromApi(priority?: string): ResidentIssuePriority {
  const normalized = String(priority || '').toUpperCase();
  if (normalized === 'URGENT' || normalized === 'HIGH') return 'Urgent';
  if (normalized === 'IMPORTANT' || normalized === 'MEDIUM') return 'Important';
  return 'Normal';
}

function issueStatusFromApi(status?: string): ResidentIssueStatus {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'RESOLVED' || normalized === 'CLOSED') return 'Rezolvată';
  if (normalized === 'IN_PROGRESS' || normalized === 'WAITING') return 'În lucru';
  return 'Nouă';
}

function announcementCategoryFromApi(category?: string): ResidentAnnouncementCategory {
  const normalized = String(category || '').toUpperCase();
  if (normalized === 'REPAIR') return 'Reparații';
  if (normalized === 'URGENT') return 'Urgent';
  if (normalized === 'ADMINISTRATION') return 'Administrare';
  return 'General';
}

function paymentMethodFromApi(method?: string | null) {
  const normalized = String(method || '').toUpperCase();
  if (normalized === 'CASH') return 'Numerar';
  if (normalized === 'BANK' || normalized === 'BANK_TRANSFER') return 'Transfer bancar';
  if (normalized === 'CARD') return 'Card bancar';
  if (normalized === 'ONLINE') return 'Online';
  return '-';
}

export function normalizeResidentInvoice(row: any) {
  const apartmentNumber = row?.apartmentNumber || row?.apartment?.number || '';
  const amount = Number(row?.amount ?? 0);
  const paidAmount = Number(row?.paidAmount ?? 0);
  const remainingAmount = Number(row?.remainingAmount ?? row?.remainingDebt ?? (String(row?.status || '').toUpperCase() === 'PAID' ? 0 : amount));
  const status = invoiceStatusFromAmounts(invoiceStatusFromApi(row?.status), remainingAmount);
  const services = Array.isArray(row?.services)
    ? row.services
        .map((service: any) => (typeof service === 'string' ? service : service?.tariffName || service?.name))
        .filter(Boolean)
    : [];

  return {
    id: String(row?.id || 'invoice'),
    number: String(row?.invoiceNumber || `FAC-${row?.year || '----'}-${String(row?.month || '').padStart(2, '0')}${apartmentNumber ? `-${apartmentNumber}` : ''}`),
    month: monthLabel(row?.month, row?.year),
    amount,
    paidAmount,
    remainingAmount,
    dueDate: dateLabel(row?.dueDate),
    status,
    services,
    paidDate: row?.paidAt ? dateLabel(row.paidAt) : '',
  };
}

export function normalizeResidentPayment(row: any): ResidentPayment {
  return {
    id: String(row?.id || 'payment'),
    amount: Number(row?.amount || 0),
    method: paymentMethodFromApi(row?.method),
    paidAt: dateLabel(row?.paidAt || row?.createdAt),
    status: String(row?.status || 'CONFIRMED'),
  };
}

export function normalizeResidentMeter(row: any) {
  const type = meterTypeFromApi(row?.type);
  const unit = meterUnit(type);
  const lastValue = row?.lastReading?.value;
  const hasReading = lastValue !== null && lastValue !== undefined;
  return {
    id: String(row?.id || 'meter'),
    type,
    serial: String(row?.serialNumber || '-'),
    reading: hasReading ? `${Number(lastValue).toLocaleString('ro-RO')} ${unit}` : 'Lipsă citire',
    date: dateLabel(row?.lastReading?.readingDate),
    status: meterStatusFromApi(row?.status, hasReading),
    unit,
  };
}

export function normalizeResidentIssue(row: any) {
  return {
    id: String(row?.id || 'issue'),
    title: String(row?.title || 'Cerere'),
    category: issueCategoryFromApi(row?.category),
    date: dateLabel(row?.createdAt),
    status: issueStatusFromApi(row?.status),
    priority: issuePriorityFromApi(row?.priority),
    message: String(row?.preview || row?.description || ''),
  };
}

export function normalizeResidentAnnouncement(row: any) {
  return {
    id: String(row?.id || 'announcement'),
    title: String(row?.title || 'Anunț'),
    category: announcementCategoryFromApi(row?.category),
    date: dateLabel(row?.createdAt),
    content: String(row?.content || row?.preview || ''),
  };
}

export function normalizeResidentContext(row: any) {
  const apartment = row?.primaryApartment || row?.apartment || row?.apartments?.[0];
  const resident = row?.resident;
  const user = row?.user;
  const organization = row?.organization;
  const status = String(row?.balance?.status || '').toUpperCase();
  const firstName = resident?.firstName || user?.firstName || '';
  const lastName = resident?.lastName || user?.lastName || '';
  const name = String(resident?.name || `${firstName} ${lastName}`.trim() || user?.email || residentProfile.name);
  const associationName = String(organization?.legalName || organization?.shortName || organization?.name || residentProfile.building);
  const buildingName = apartment?.building?.name ? String(apartment.building.name) : '';
  return {
    name,
    phone: String(resident?.phone || user?.phone || 'Necompletat'),
    email: String(resident?.email || user?.email || 'Necompletat'),
    apartment: apartment?.number ? `Apt. ${apartment.number}` : 'Apartament neconectat',
    staircase: apartment?.staircase?.name ? String(apartment.staircase.name) : '',
    role: String(apartment?.relationRole || resident?.role || residentProfile.role),
    building: associationName,
    buildingName,
    currentBalance: Number(row?.balance?.current ?? 0),
    status: status === 'PAID' ? 'Achitat' : status === 'OVERDUE' ? 'Întârziat' : 'Neachitat',
    nextDueDate: row?.balance?.nextDueDate ? dateLabel(row.balance.nextDueDate) : 'Nu există',
    hasApartment: Boolean(apartment?.id),
    emptyStateMessage: String(row?.emptyStateMessage || 'Contul tău nu este conectat încă la un apartament.'),
  };
}

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
