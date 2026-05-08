import { authApi, organizationSettingsApi, residentDemoApi } from '@/lib/api';

export type ApcOrganizationInfo = {
  shortName: string;
  legalName: string;
  associationCode?: string | null;
  associationNumber?: string | null;
  address?: string | null;
  city?: string | null;
  country: string;
  phone?: string | null;
  email?: string | null;
  bankName?: string | null;
  bankAccountIban?: string | null;
  bankSwift?: string | null;
  paymentInstructions?: string | null;
};

const APC_CODE_RE = /A\d{4}-\d{4}/i;

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function extractAssociationCode(...values: unknown[]) {
  for (const value of values) {
    const match = text(value)?.match(APC_CODE_RE);
    if (match?.[0]) return match[0].toUpperCase();
  }
  return null;
}

function associationNumberFromCode(code?: string | null) {
  const match = code?.match(/-(\d{4})$/);
  return match?.[1] || null;
}

export function toApcOrganizationInfo(input?: any): ApcOrganizationInfo {
  const organization = input?.organization && typeof input.organization === 'object' ? input.organization : input || {};
  const associationCode =
    text(organization.associationCode) ||
    text(organization.code) ||
    extractAssociationCode(organization.shortName, organization.legalName, organization.name, organization.fiscalCode);
  const associationNumber =
    text(organization.associationNumber) ||
    text(organization.internalNumber) ||
    text(organization.registrationNumber) ||
    associationNumberFromCode(associationCode);
  const shortName =
    text(organization.shortName) ||
    (associationCode ? `A.P.C. ${associationCode}` : null) ||
    text(organization.name) ||
    'A.P.C.';
  const legalName =
    text(organization.legalName) ||
    (associationCode ? `Asociația de Proprietari din Condominiu ${associationCode}` : null) ||
    text(organization.name) ||
    shortName;

  return {
    shortName,
    legalName,
    associationCode,
    associationNumber,
    address: text(organization.address),
    city: text(organization.city),
    country: text(organization.country) || 'Republica Moldova',
    phone: text(organization.phone),
    email: text(organization.email),
    bankName: text(organization.bankName),
    bankAccountIban: text(organization.bankAccountIban),
    bankSwift: text(organization.bankSwift),
    paymentInstructions: text(organization.paymentInstructions),
  };
}

export function mergePaymentInfo(organization: ApcOrganizationInfo, paymentInfo?: any): ApcOrganizationInfo {
  if (!paymentInfo || typeof paymentInfo !== 'object') return organization;
  return {
    ...organization,
    bankName: organization.bankName || text(paymentInfo.bankName),
    bankAccountIban: organization.bankAccountIban || text(paymentInfo.bankAccountIban),
    bankSwift: organization.bankSwift || text(paymentInfo.bankSwift),
    paymentInstructions: organization.paymentInstructions || text(paymentInfo.paymentInstructions),
  };
}

export async function loadAdminApcOrganization(): Promise<ApcOrganizationInfo> {
  try {
    const settings = await organizationSettingsApi.adminGet();
    return toApcOrganizationInfo(settings.data);
  } catch {
    try {
      const me = await authApi.getMe();
      return toApcOrganizationInfo(me.data?.user?.organization || me.data?.user);
    } catch {
      return toApcOrganizationInfo();
    }
  }
}

export async function loadResidentApcOrganization(): Promise<ApcOrganizationInfo> {
  try {
    const info = await organizationSettingsApi.residentPublicInfo();
    return toApcOrganizationInfo(info.data);
  } catch {
    try {
      const context = await residentDemoApi.context();
      return toApcOrganizationInfo(context.data?.organization || context.data?.primaryApartment?.organization);
    } catch {
      return toApcOrganizationInfo();
    }
  }
}

export function formatMdlPrint(value: unknown) {
  return new Intl.NumberFormat('ro-MD', {
    style: 'currency',
    currency: 'MDL',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatDatePrint(value?: string | Date | null) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ro-MD').format(date);
}

export function monthYearPrint(month?: number | string | null, year?: number | string | null) {
  const monthNumber = Number(month || 0);
  const yearNumber = Number(year || new Date().getFullYear());
  if (!monthNumber) return '-';
  return new Intl.DateTimeFormat('ro-MD', { month: 'long', year: 'numeric' }).format(new Date(yearNumber, monthNumber - 1, 1));
}

export function invoiceStatusLabel(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PAID') return 'Achitat';
  if (normalized === 'OVERDUE') return 'Întârziat';
  if (normalized === 'PARTIAL') return 'Achitat parțial';
  return 'Neachitat';
}

export function paymentMethodLabel(method?: string | null) {
  const normalized = String(method || '').toUpperCase();
  if (normalized === 'CASH') return 'Numerar';
  if (normalized === 'BANK' || normalized === 'BANK_TRANSFER') return 'Transfer bancar';
  if (normalized === 'CARD') return 'Card';
  return 'Altă metodă';
}
