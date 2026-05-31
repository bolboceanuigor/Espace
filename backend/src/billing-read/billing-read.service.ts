import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApartmentStatus, BillingCurrency, InvoiceStatus, NotificationType, PaymentMethod, PaymentStatus, Prisma, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import { AuditService } from '../audit/audit.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type SupportedTariffId = 'DESERVIRE_BLOC_PER_M2' | 'FOND_REPARATIE_PER_M2' | 'FOND_DEZVOLTARE_FIXED';
type TariffCalculationType = 'PER_M2' | 'FIXED_PER_APARTMENT' | 'MANUAL' | 'PER_METER_CONSUMPTION';
type TariffStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
type TariffPeriodicity = 'MONTHLY' | 'ONE_TIME';
type TariffAppliesTo = 'ALL_APARTMENTS' | 'ONLY_OCCUPIED' | 'CUSTOM_SELECTION';
type MeterTariffMissingReadingPolicy = 'SKIP_WITH_WARNING' | 'ZERO_WITH_WARNING' | 'BLOCK_DRAFT';
type MeterReadingWorkflowStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW' | 'CANCELLED';
type TariffRow = {
  id: string;
  organizationId: string;
  name: string;
  internalCode: string;
  code: string;
  description: string;
  calculationType: TariffCalculationType;
  type: TariffCalculationType;
  pricePerM2: number | null;
  fixedAmount: number | null;
  defaultManualAmount: number | null;
  meterType?: string | null;
  pricePerUnit?: number | null;
  amount: number;
  currency: 'MDL';
  periodicity: TariffPeriodicity;
  status: TariffStatus;
  isActive: boolean;
  appliesTo: TariffAppliesTo;
  includeInMonthlyEstimate: boolean;
  includeInDraftInvoices?: boolean;
  visibleToResidents: boolean;
  requiresApprovedReading?: boolean;
  missingReadingPolicy?: MeterTariffMissingReadingPolicy;
  startsAt: string | null;
  endsAt: string | null;
  monthlyEstimate: number;
  affectedApartments: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
  createdById?: string | null;
  updatedById?: string | null;
  internalNotes?: string;
};
type BillingDraftStatus = 'DRAFT' | 'LOCKED' | 'CANCELLED';
type BillingDraftLineStatus = 'READY' | 'WARNING' | 'ERROR' | 'EXCLUDED';
type BillingDraftLine = {
  id: string;
  lineType: 'TARIFF' | 'MANUAL' | 'ADJUSTMENT' | 'METER_CONSUMPTION';
  tariffId: string | null;
  meterId?: string | null;
  meterReadingId?: string | null;
  meterType?: string | null;
  unit?: string | null;
  source?: 'TARIFF' | 'METER_READING' | 'MANUAL' | 'ADJUSTMENT';
  isManual?: boolean;
  manualType?: 'MANUAL_ADJUSTMENT' | 'DISCOUNT' | 'CORRECTION' | null;
  name: string;
  description: string;
  calculationType: TariffCalculationType;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency: 'MDL';
  formulaLabel: string;
  status: BillingDraftLineStatus;
  warnings: string[];
  excludedAt?: string | null;
  excludedById?: string | null;
  exclusionReason?: string | null;
};
type BillingDraftItem = {
  id: string;
  apartmentId: string;
  apartmentNumber: string;
  staircase: string;
  floor: string | null;
  areaM2: number | null;
  primaryContact: { id: string; fullName: string; phone: string | null } | null;
  lines: BillingDraftLine[];
  total: number;
  status: BillingDraftLineStatus;
  warnings: string[];
  internalNotes: string;
};
type BillingDraftRecord = {
  id: string;
  associationId: string;
  organizationId: string;
  billingMonth: string;
  dueDate: string | null;
  description: string;
  status: BillingDraftStatus;
  currency: 'MDL';
  totalAmount: number;
  apartmentsCount: number;
  warningsCount: number;
  errorsCount: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lockedAt?: string | null;
  lockedById?: string | null;
  cancelledAt?: string | null;
  cancelledById?: string | null;
  cancellationReason?: string | null;
  includedAmount?: number;
  excludedAmount?: number;
  includedApartments?: number;
  excludedApartments?: number;
  finalizedAt?: string | null;
  finalizedById?: string | null;
  invoicesGenerated?: boolean;
  invoicesCount?: number;
  finalizedAmount?: number;
  summary: Record<string, unknown>;
  tariffsUsed: Array<Record<string, unknown>>;
  items: BillingDraftItem[];
  warnings: string[];
};
type BillingRunStatus = 'NOT_STARTED' | 'PRECHECK' | 'READY_FOR_DRAFT' | 'DRAFT_CALCULATED' | 'IN_REVIEW' | 'DRAFT_LOCKED' | 'FINALIZED' | 'CANCELLED';
type BillingRunCheckStatus = 'PASSED' | 'WARNING' | 'FAILED' | 'NOT_APPLICABLE';
type BillingRunCheckSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
type BillingRunCheckCategory = 'ASSOCIATION' | 'APARTMENTS' | 'RESIDENTS' | 'TARIFFS' | 'METERS' | 'DRAFT' | 'FINALIZATION';
type BillingRunCheck = {
  id: string;
  key: string;
  label: string;
  category: BillingRunCheckCategory;
  status: BillingRunCheckStatus;
  severity: BillingRunCheckSeverity;
  message: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};
type BillingRunRecord = {
  id: string;
  associationId: string;
  organizationId: string;
  billingMonth: string;
  status: BillingRunStatus;
  currency: 'MDL';
  draftId: string | null;
  finalizedAt: string | null;
  finalizedById: string | null;
  invoicesCount: number;
  totalAmount: number;
  warningsCount: number;
  errorsCount: number;
  startedById: string;
  cancelledAt: string | null;
  cancelledById: string | null;
  cancellationReason: string | null;
  checks: BillingRunCheck[];
  createdAt: string;
  updatedAt: string;
};
type InternalInvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'VOID';
type InternalInvoiceLineMetadata = {
  id: string;
  sourceDraftLineId: string | null;
  tariffId: string | null;
  lineType: 'TARIFF' | 'MANUAL_ADJUSTMENT' | 'DISCOUNT' | 'CORRECTION' | 'METER_CONSUMPTION';
  meterId?: string | null;
  meterReadingId?: string | null;
  meterType?: string | null;
  unit?: string | null;
  name: string;
  description: string;
  calculationType: TariffCalculationType;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency: 'MDL';
  formulaLabel: string;
};
type InternalInvoiceMetadata = {
  id: string;
  invoiceId: string;
  associationId: string;
  organizationId: string;
  apartmentId: string;
  primaryContactId: string | null;
  sourceDraftId: string;
  invoiceNumber: string;
  billingMonth: string;
  issueDate: string;
  dueDate: string | null;
  status: InternalInvoiceStatus;
  currency: 'MDL';
  subtotalAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  notes: string;
  apartment: {
    id: string;
    apartmentNumber: string;
    staircase: string;
    floor: string | null;
  };
  primaryContact: { id: string; fullName: string; phone: string | null } | null;
  lines: InternalInvoiceLineMetadata[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
};
type ManualPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD_TERMINAL' | 'INFOCOM' | 'OPLATA' | 'OTHER';
type InternalPaymentNote = {
  version: 1;
  kind: 'INTERNAL_INVOICE_PAYMENT';
  invoiceId: string;
  invoiceMetadataId: string;
  invoiceNumber: string;
  billingMonth: string;
  method: ManualPaymentMethod;
  referenceNumber: string;
  payerName: string;
  notes: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledById?: string;
};
type CsvColumn = {
  key: string;
  header: string;
  value?: (row: any) => unknown;
};
type CsvExportResult = {
  csv: string;
  fileName: string;
  rowsCount: number;
};

const TARIFF_METADATA_NOTE_TITLE = 'Tariff settings metadata';
const BILLING_DRAFT_NOTE_TITLE = 'Internal invoice draft metadata';
const BILLING_RUN_NOTE_TITLE = 'Monthly billing run metadata';
const INTERNAL_INVOICE_NOTE_TITLE = 'Internal invoices metadata';
const INTERNAL_PAYMENT_NOTE_PREFIX = 'INTERNAL_INVOICE_PAYMENT:';
const METER_WORKFLOW_METADATA_NOTE_TITLE = 'ESPACE_METER_WORKFLOW_METADATA_V1';

const SUPPORTED_TARIFFS: Record<
  SupportedTariffId,
  {
    name: string;
    calculationType: 'PER_M2' | 'FIXED_PER_APARTMENT';
    field: 'maintenanceFeePerM2' | 'repairFundPerM2' | 'developmentFundFixed';
    unit: string;
  }
> = {
  DESERVIRE_BLOC_PER_M2: {
    name: 'Deservire bloc',
    calculationType: 'PER_M2',
    field: 'maintenanceFeePerM2',
    unit: 'MDL/m²',
  },
  FOND_REPARATIE_PER_M2: {
    name: 'Fond reparație',
    calculationType: 'PER_M2',
    field: 'repairFundPerM2',
    unit: 'MDL/m²',
  },
  FOND_DEZVOLTARE_FIXED: {
    name: 'Fond dezvoltare',
    calculationType: 'FIXED_PER_APARTMENT',
    field: 'developmentFundFixed',
    unit: 'MDL/apartament',
  },
};

const RECOMMENDED_TARIFFS = [
  {
    name: 'Deservire bloc',
    internalCode: 'BUILDING_SERVICE',
    description: 'Serviciu lunar calculat după suprafața apartamentului.',
    calculationType: 'PER_M2' as TariffCalculationType,
    pricePerM2: 2.85,
    fixedAmount: null,
    defaultManualAmount: null,
    periodicity: 'MONTHLY' as TariffPeriodicity,
    status: 'ACTIVE' as TariffStatus,
    appliesTo: 'ALL_APARTMENTS' as TariffAppliesTo,
    includeInMonthlyEstimate: true,
    visibleToResidents: true,
  },
  {
    name: 'Fond reparație',
    internalCode: 'REPAIR_FUND',
    description: 'Fond lunar pentru reparații, calculat per m².',
    calculationType: 'PER_M2' as TariffCalculationType,
    pricePerM2: 0.5,
    fixedAmount: null,
    defaultManualAmount: null,
    periodicity: 'MONTHLY' as TariffPeriodicity,
    status: 'ACTIVE' as TariffStatus,
    appliesTo: 'ALL_APARTMENTS' as TariffAppliesTo,
    includeInMonthlyEstimate: true,
    visibleToResidents: true,
  },
  {
    name: 'Fond investiții',
    internalCode: 'INVESTMENT_FUND',
    description: 'Sumă fixă lunară per apartament.',
    calculationType: 'FIXED_PER_APARTMENT' as TariffCalculationType,
    pricePerM2: null,
    fixedAmount: 60,
    defaultManualAmount: null,
    periodicity: 'MONTHLY' as TariffPeriodicity,
    status: 'ACTIVE' as TariffStatus,
    appliesTo: 'ALL_APARTMENTS' as TariffAppliesTo,
    includeInMonthlyEstimate: true,
    visibleToResidents: true,
  },
];

@Injectable()
export class BillingReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityMvpService,
    private readonly audit: AuditService,
  ) {}

  private invoiceSelect(): Prisma.InvoiceSelect {
    return {
      id: true,
      organizationId: true,
      apartmentId: true,
      month: true,
      year: true,
      amount: true,
      finalAmount: true,
      status: true,
      issuedAt: true,
      paidAt: true,
      dueDate: true,
      createdAt: true,
      updatedAt: true,
      apartment: {
        select: {
          id: true,
          number: true,
          floor: true,
          building: { select: { id: true, name: true } },
          staircase: { select: { id: true, name: true } },
        },
      },
    };
  }

  private paymentSelect(): Prisma.PaymentSelect {
    return {
      id: true,
      organizationId: true,
      apartmentId: true,
      invoiceId: true,
      amount: true,
      currency: true,
      method: true,
      status: true,
      paidAt: true,
      confirmedAt: true,
      month: true,
      note: true,
      createdAt: true,
      updatedAt: true,
      apartment: {
        select: {
          id: true,
          number: true,
          floor: true,
          building: { select: { id: true, name: true } },
          staircase: { select: { id: true, name: true } },
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          month: true,
          year: true,
          totalDue: true,
          status: true,
          dueDate: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          email: true,
        },
      },
    };
  }

  private invoicePaymentNote(invoiceId: string) {
    return `Invoice ${invoiceId}`;
  }

  private monthLabel(month?: number | null, year?: number | null) {
    if (!month || !year) return 'perioada selectată';
    return `${String(month).padStart(2, '0')}.${year}`;
  }

  private invoiceAmount(row: { finalAmount?: number | null; amount?: number | null }) {
    return Number(row.finalAmount || row.amount || 0);
  }

  private confirmedPaymentTotal(payments: any[]) {
    return this.money(
      (payments || [])
        .filter((payment) => payment.status === PaymentStatus.CONFIRMED || String(payment.status).toUpperCase() === 'CONFIRMED')
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    );
  }

  private remainingDebtForInvoice(row: { status?: InvoiceStatus; finalAmount?: number | null; amount?: number | null }, payments: any[] = []) {
    if (row.status === InvoiceStatus.PAID) return 0;
    return this.money(Math.max(this.invoiceAmount(row) - this.confirmedPaymentTotal(payments), 0));
  }

  private calculateInvoiceStatus(
    row: { status?: InvoiceStatus; finalAmount?: number | null; amount?: number | null; dueDate?: Date | string | null },
    payments: any[] = [],
  ) {
    const amount = this.invoiceAmount(row);
    const paidAmount = this.confirmedPaymentTotal(payments);
    if (row.status === InvoiceStatus.PAID || paidAmount >= amount) return InvoiceStatus.PAID;
    if (row.dueDate && new Date(row.dueDate) < new Date()) return InvoiceStatus.OVERDUE;
    return InvoiceStatus.UNPAID;
  }

  private toInvoice(row: any, relatedPayments: any[] = [], services: any[] = []) {
    const paidAmount = this.confirmedPaymentTotal(relatedPayments);
    const calculatedStatus = this.calculateInvoiceStatus(row, relatedPayments);
    const remainingDebt =
      calculatedStatus === InvoiceStatus.PAID
        ? 0
        : this.money(Math.max(this.invoiceAmount(row) - paidAmount, 0));
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      apartment: row.apartment
        ? {
            id: row.apartment.id,
            number: row.apartment.number,
            floor: row.apartment.floor,
            building: row.apartment.building,
            staircase: row.apartment.staircase,
          }
        : null,
      apartmentNumber: row.apartment?.number ?? null,
      month: row.month,
      year: row.year,
      amount: Number(row.finalAmount || row.amount || 0),
      originalAmount: Number(row.amount || 0),
      status: calculatedStatus,
      issuedAt: row.issuedAt,
      paidAt: row.paidAt,
      dueDate: row.dueDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      payments: relatedPayments,
      services,
      paidAmount,
      remainingAmount: remainingDebt,
      remainingDebt,
    };
  }

  private toPayment(row: any) {
    const method = row.method === PaymentMethod.BANK ? 'OTHER' : row.method;
    const internalNote = this.parseInternalPaymentNote(row.note);
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      invoiceId: row.invoiceId ?? internalNote?.invoiceId ?? null,
      invoiceNumber: internalNote?.invoiceNumber ?? row.invoice?.invoiceNumber ?? null,
      billingMonth: internalNote?.billingMonth ?? (row.invoice?.month && row.invoice?.year ? `${row.invoice.year}-${String(row.invoice.month).padStart(2, '0')}` : row.month),
      apartment: row.apartment
        ? {
            id: row.apartment.id,
            number: row.apartment.number,
            floor: row.apartment.floor,
            building: row.apartment.building,
            staircase: row.apartment.staircase,
          }
        : null,
      apartmentNumber: row.apartment?.number ?? null,
      invoice: row.invoice ?? null,
      amount: Number(row.amount || 0),
      currency: row.currency,
      method: internalNote?.method ?? method,
      referenceNumber: internalNote?.referenceNumber ?? '',
      payerName: internalNote?.payerName ?? '',
      notes: internalNote?.notes ?? '',
      cancellationReason: internalNote?.cancellationReason ?? '',
      status: row.status,
      paidAt: row.paidAt ?? row.confirmedAt,
      paymentDate: row.paidAt ?? row.confirmedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      month: row.month,
      note: row.note,
      createdBy: row.createdBy
        ? {
            id: row.createdBy.id,
            fullName: this.userDisplayName(row.createdBy),
            email: row.createdBy.email,
          }
        : null,
    };
  }

  private userDisplayName(user?: { firstName?: string | null; lastName?: string | null; fullName?: string | null; email?: string | null } | null) {
    return user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || null;
  }

  private parseInternalPaymentNote(note?: string | null): InternalPaymentNote | null {
    if (!note || !note.startsWith(INTERNAL_PAYMENT_NOTE_PREFIX)) return null;
    try {
      const parsed = JSON.parse(note.slice(INTERNAL_PAYMENT_NOTE_PREFIX.length));
      if (parsed?.kind !== 'INTERNAL_INVOICE_PAYMENT' || !parsed.invoiceId) return null;
      return {
        version: 1,
        kind: 'INTERNAL_INVOICE_PAYMENT',
        invoiceId: String(parsed.invoiceId),
        invoiceMetadataId: String(parsed.invoiceMetadataId || parsed.invoiceId),
        invoiceNumber: String(parsed.invoiceNumber || ''),
        billingMonth: String(parsed.billingMonth || ''),
        method: this.parseManualPaymentMethod(parsed.method, true),
        referenceNumber: String(parsed.referenceNumber || ''),
        payerName: String(parsed.payerName || ''),
        notes: String(parsed.notes || ''),
        cancellationReason: parsed.cancellationReason ? String(parsed.cancellationReason) : undefined,
        cancelledAt: parsed.cancelledAt ? String(parsed.cancelledAt) : undefined,
        cancelledById: parsed.cancelledById ? String(parsed.cancelledById) : undefined,
      };
    } catch {
      return null;
    }
  }

  private buildInternalPaymentNote(note: InternalPaymentNote) {
    return `${INTERNAL_PAYMENT_NOTE_PREFIX}${JSON.stringify(note)}`;
  }

  private parseManualPaymentMethod(value: unknown, fallbackToCash = false): ManualPaymentMethod {
    const normalized = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : '';
    if (!normalized && fallbackToCash) return 'CASH';
    if (['CASH', 'BANK_TRANSFER', 'CARD_TERMINAL', 'INFOCOM', 'OPLATA', 'OTHER'].includes(normalized)) {
      return normalized as ManualPaymentMethod;
    }
    throw new BadRequestException('Metoda de plată nu este validă.');
  }

  private paymentMethodForDb(method: ManualPaymentMethod): PaymentMethod {
    if (method === 'BANK_TRANSFER') return PaymentMethod.BANK_TRANSFER;
    if (method === 'CARD_TERMINAL') return PaymentMethod.CARD;
    if (method === 'INFOCOM' || method === 'OPLATA') return PaymentMethod.ONLINE;
    if (method === 'OTHER') return PaymentMethod.BANK;
    return PaymentMethod.CASH;
  }

  private isSuperadmin(user: MvpUser) {
    return String(user.role).toUpperCase() === Role.SUPERADMIN;
  }

  private organizationWhere(user: MvpUser) {
    return this.isSuperadmin(user) ? {} : { organizationId: user.organizationId };
  }

  private assertOrganizationAccess(user: MvpUser, organizationId: string) {
    if (!this.isSuperadmin(user) && organizationId !== user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ORGANIZATION',
        message: 'Nu ai acces la aceste date.',
      });
    }
  }

  private resolveOrganizationId(user: MvpUser, payload?: Record<string, unknown>) {
    if (!this.isSuperadmin(user)) return user.organizationId;
    const requested = typeof payload?.organizationId === 'string' && payload.organizationId.trim() ? payload.organizationId.trim() : user.organizationId;
    if (!requested) {
      throw new BadRequestException('Organizația este obligatorie.');
    }
    return requested;
  }

  private async getOrCreateOrganizationSettings(organizationId: string) {
    return this.prisma.organizationSetting.upsert({
      where: { organizationId },
      update: {},
      create: {
        organizationId,
        appName: 'Espace',
        defaultLocale: 'ro',
        weekStart: 'MONDAY',
      },
    });
  }

  private async tariffContext(organizationId: string) {
    const [organization, apartments] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, legalName: true, fiscalCode: true, currency: true },
      }),
      this.prisma.apartment.findMany({
        where: { organizationId },
        orderBy: [{ staircase: { name: 'asc' } }, { floor: 'asc' }, { number: 'asc' }],
        select: {
          id: true,
          number: true,
          areaM2: true,
          status: true,
          floor: true,
          staircase: { select: { id: true, name: true } },
        },
      }),
    ]);
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return { organization, apartments };
  }

  private apartmentEligibilityCount(apartments: Array<{ status?: ApartmentStatus | string | null }>, appliesTo: TariffAppliesTo) {
    if (appliesTo !== 'ONLY_OCCUPIED') return apartments.length;
    const occupiedStatuses = new Set(['ACTIVE', 'DEBTOR', 'PROBLEM', 'OCCUPIED']);
    return apartments.filter((apartment) => occupiedStatuses.has(String(apartment.status || '').toUpperCase())).length;
  }

  private tariffAmount(row: Pick<TariffRow, 'calculationType' | 'pricePerM2' | 'fixedAmount' | 'defaultManualAmount'>) {
    if (row.calculationType === 'PER_M2') return Number(row.pricePerM2 || 0);
    if (row.calculationType === 'FIXED_PER_APARTMENT') return Number(row.fixedAmount || 0);
    if (row.calculationType === 'PER_METER_CONSUMPTION') return Number((row as Pick<TariffRow, 'pricePerUnit'>).pricePerUnit || 0);
    return Number(row.defaultManualAmount || 0);
  }

  private tariffUnit(row: Pick<TariffRow, 'calculationType'> & Partial<Pick<TariffRow, 'unit'>>) {
    if (row.calculationType === 'PER_M2') return 'MDL/m²';
    if (row.calculationType === 'FIXED_PER_APARTMENT') return 'MDL/apartament';
    if (row.calculationType === 'PER_METER_CONSUMPTION') {
      return `MDL/${row.unit || 'unitate'}`;
    }
    return 'MDL/manual';
  }

  private monthlyEstimateForTariff(
    row: Pick<TariffRow, 'status' | 'periodicity' | 'includeInMonthlyEstimate' | 'calculationType' | 'pricePerM2' | 'fixedAmount' | 'defaultManualAmount' | 'appliesTo'>,
    apartments: Array<{ areaM2?: number | null; status?: ApartmentStatus | string | null }>,
  ) {
    if (row.status !== 'ACTIVE' || row.periodicity !== 'MONTHLY' || !row.includeInMonthlyEstimate) return 0;
    const totalAreaM2 = apartments.reduce((sum, apartment) => sum + Number(apartment.areaM2 || 0), 0);
    const affectedApartments = this.apartmentEligibilityCount(apartments, row.appliesTo);
    if (row.calculationType === 'PER_M2') return this.money(totalAreaM2 * Number(row.pricePerM2 || 0));
    if (row.calculationType === 'FIXED_PER_APARTMENT') return this.money(affectedApartments * Number(row.fixedAmount || 0));
    if (row.calculationType === 'PER_METER_CONSUMPTION') return 0;
    return this.money(affectedApartments * Number(row.defaultManualAmount || 0));
  }

  private normalizeTariffRow(raw: any, organizationId: string, apartments: Array<{ areaM2?: number | null; status?: ApartmentStatus | string | null }>): TariffRow {
    const now = new Date().toISOString();
    const calculationType = this.parseTariffCalculationType(raw.calculationType || raw.type || (raw.pricePerUnit ? 'PER_METER_CONSUMPTION' : raw.pricePerM2 ? 'PER_M2' : raw.fixedAmount ? 'FIXED_PER_APARTMENT' : 'MANUAL'));
    const status = this.parseTariffStatus(raw.status || (raw.isActive ? 'ACTIVE' : 'DRAFT'));
    const periodicity = this.parseTariffPeriodicity(raw.periodicity || 'MONTHLY');
    const appliesTo = this.parseTariffAppliesTo(raw.appliesTo || 'ALL_APARTMENTS');
    const pricePerM2 = calculationType === 'PER_M2' ? this.money(Number(raw.pricePerM2 ?? raw.amount ?? 0)) : null;
    const fixedAmount = calculationType === 'FIXED_PER_APARTMENT' ? this.money(Number(raw.fixedAmount ?? raw.amount ?? 0)) : null;
    const pricePerUnit = calculationType === 'PER_METER_CONSUMPTION' ? this.money(Number(raw.pricePerUnit ?? raw.amount ?? 0)) : null;
    const meterType = calculationType === 'PER_METER_CONSUMPTION' ? this.normalizeMeterTypeForTariff(raw.meterType || raw.typeOfMeter || raw.meter) : null;
    const defaultManualAmount = calculationType === 'MANUAL' && raw.defaultManualAmount !== undefined && raw.defaultManualAmount !== null && raw.defaultManualAmount !== ''
      ? this.money(Number(raw.defaultManualAmount))
      : null;
    const row: TariffRow = {
      id: String(raw.id || randomUUID()),
      organizationId,
      name: String(raw.name || 'Tarif').trim(),
      internalCode: String(raw.internalCode || raw.code || '').trim().toUpperCase(),
      code: String(raw.internalCode || raw.code || raw.id || '').trim().toUpperCase(),
      description: String(raw.description || '').trim(),
      calculationType,
      type: calculationType,
      pricePerM2,
      fixedAmount,
      defaultManualAmount,
      meterType,
      pricePerUnit,
      amount: 0,
      currency: 'MDL',
      periodicity,
      status,
      isActive: status === 'ACTIVE',
      appliesTo,
      includeInMonthlyEstimate: raw.includeInMonthlyEstimate !== false,
      includeInDraftInvoices: raw.includeInDraftInvoices !== false,
      visibleToResidents: raw.visibleToResidents !== false,
      requiresApprovedReading: raw.requiresApprovedReading !== false,
      missingReadingPolicy: this.parseMissingReadingPolicy(raw.missingReadingPolicy || 'SKIP_WITH_WARNING'),
      startsAt: raw.startsAt || null,
      endsAt: raw.endsAt || null,
      monthlyEstimate: 0,
      affectedApartments: this.apartmentEligibilityCount(apartments, appliesTo),
      unit: 'MDL',
      createdAt: raw.createdAt || now,
      updatedAt: raw.updatedAt || now,
      createdById: raw.createdById || null,
      updatedById: raw.updatedById || null,
      internalNotes: String(raw.internalNotes || ''),
    };
    row.amount = this.tariffAmount(row);
    row.unit = this.tariffUnit(row);
    if (row.calculationType === 'PER_METER_CONSUMPTION') row.unit = String(raw.unit || this.defaultMeterUnit(row.meterType)).trim();
    row.monthlyEstimate = this.monthlyEstimateForTariff(row, apartments);
    return row;
  }

  private legacyRowsFromSettings(settings: {
    organizationId: string;
    maintenanceFeePerM2: number;
    repairFundPerM2: number;
    developmentFundFixed: number;
    updatedAt: Date;
  }, apartments: Array<{ areaM2?: number | null; status?: ApartmentStatus | string | null }>) {
    const rows = [
      {
        id: 'BUILDING_SERVICE',
        name: 'Deservire bloc',
        internalCode: 'BUILDING_SERVICE',
        calculationType: 'PER_M2',
        pricePerM2: Number(settings.maintenanceFeePerM2 || 0),
        status: Number(settings.maintenanceFeePerM2 || 0) > 0 ? 'ACTIVE' : 'INACTIVE',
      },
      {
        id: 'REPAIR_FUND',
        name: 'Fond reparație',
        internalCode: 'REPAIR_FUND',
        calculationType: 'PER_M2',
        pricePerM2: Number(settings.repairFundPerM2 || 0),
        status: Number(settings.repairFundPerM2 || 0) > 0 ? 'ACTIVE' : 'INACTIVE',
      },
      {
        id: 'INVESTMENT_FUND',
        name: 'Fond investiții',
        internalCode: 'INVESTMENT_FUND',
        calculationType: 'FIXED_PER_APARTMENT',
        fixedAmount: Number(settings.developmentFundFixed || 0),
        status: Number(settings.developmentFundFixed || 0) > 0 ? 'ACTIVE' : 'INACTIVE',
      },
    ];
    return rows
      .filter((row) => row.status === 'ACTIVE')
      .map((row) =>
        this.normalizeTariffRow(
          {
            ...row,
            currency: 'MDL',
            periodicity: 'MONTHLY',
            appliesTo: 'ALL_APARTMENTS',
            includeInMonthlyEstimate: true,
            visibleToResidents: true,
            createdAt: settings.updatedAt.toISOString(),
            updatedAt: settings.updatedAt.toISOString(),
          },
          settings.organizationId,
          apartments,
        ),
      );
  }

  private async readTariffRows(organizationId: string, apartments: Array<{ areaM2?: number | null; status?: ApartmentStatus | string | null }>): Promise<TariffRow[]> {
    const note = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: TARIFF_METADATA_NOTE_TITLE },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (note?.content) {
      try {
        const parsed = JSON.parse(note.content);
        const rows = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
        return rows.map((row) => this.normalizeTariffRow(row, organizationId, apartments));
      } catch {
        return [];
      }
    }
    const settings = await this.getOrCreateOrganizationSettings(organizationId);
    return this.legacyRowsFromSettings(settings, apartments);
  }

  private async writeTariffRows(organizationId: string, actorUserId: string, rows: TariffRow[]) {
    const payload = {
      version: 1,
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        internalCode: row.internalCode,
        description: row.description,
        calculationType: row.calculationType,
        pricePerM2: row.pricePerM2,
        fixedAmount: row.fixedAmount,
        defaultManualAmount: row.defaultManualAmount,
        meterType: row.meterType || null,
        unit: row.unit,
        pricePerUnit: row.pricePerUnit ?? null,
        currency: row.currency,
        periodicity: row.periodicity,
        status: row.status,
        appliesTo: row.appliesTo,
        includeInMonthlyEstimate: row.includeInMonthlyEstimate,
        includeInDraftInvoices: row.includeInDraftInvoices !== false,
        visibleToResidents: row.visibleToResidents,
        requiresApprovedReading: row.requiresApprovedReading !== false,
        missingReadingPolicy: row.missingReadingPolicy || 'SKIP_WITH_WARNING',
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdById: row.createdById,
        updatedById: row.updatedById,
        internalNotes: row.internalNotes || '',
      })),
    };
    const existing = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: TARIFF_METADATA_NOTE_TITLE },
      select: { id: true },
    });
    const content = JSON.stringify(payload);
    if (existing) {
      await this.prisma.clientNote.update({
        where: { id: existing.id },
        data: { content },
      });
    } else {
      await this.prisma.clientNote.create({
        data: {
          organizationId,
          createdByUserId: actorUserId,
          title: TARIFF_METADATA_NOTE_TITLE,
          content,
        },
      });
    }
    await this.syncLegacyTariffSettings(organizationId, rows);
  }

  private async syncLegacyTariffSettings(organizationId: string, rows: TariffRow[]) {
    const activeByCode = new Map(rows.filter((row) => row.status === 'ACTIVE').map((row) => [row.internalCode, row]));
    const maintenance = activeByCode.get('BUILDING_SERVICE') || activeByCode.get('DESERVIRE_BLOC_PER_M2');
    const repair = activeByCode.get('REPAIR_FUND') || activeByCode.get('FOND_REPARATIE_PER_M2');
    const investment = activeByCode.get('INVESTMENT_FUND') || activeByCode.get('FOND_DEZVOLTARE_FIXED');
    await this.prisma.organizationSetting.upsert({
      where: { organizationId },
      update: {
        maintenanceFeePerM2: maintenance?.calculationType === 'PER_M2' ? Number(maintenance.pricePerM2 || 0) : 0,
        repairFundPerM2: repair?.calculationType === 'PER_M2' ? Number(repair.pricePerM2 || 0) : 0,
        developmentFundFixed: investment?.calculationType === 'FIXED_PER_APARTMENT' ? Number(investment.fixedAmount || 0) : 0,
      },
      create: {
        organizationId,
        maintenanceFeePerM2: maintenance?.calculationType === 'PER_M2' ? Number(maintenance.pricePerM2 || 0) : 0,
        repairFundPerM2: repair?.calculationType === 'PER_M2' ? Number(repair.pricePerM2 || 0) : 0,
        developmentFundFixed: investment?.calculationType === 'FIXED_PER_APARTMENT' ? Number(investment.fixedAmount || 0) : 0,
        appName: 'Espace',
        defaultLocale: 'ro',
        weekStart: 'MONDAY',
      },
    });
  }

  private tariffStats(rows: TariffRow[], apartments: Array<{ areaM2?: number | null; status?: ApartmentStatus | string | null }>) {
    return {
      activeTariffs: rows.filter((row) => row.status === 'ACTIVE').length,
      inactiveTariffs: rows.filter((row) => row.status === 'INACTIVE').length,
      perM2Services: rows.filter((row) => row.calculationType === 'PER_M2').length,
      fixedServices: rows.filter((row) => row.calculationType === 'FIXED_PER_APARTMENT').length,
      meterConsumptionServices: rows.filter((row) => row.calculationType === 'PER_METER_CONSUMPTION').length,
      estimatedMonthlyTotal: this.money(rows.reduce((sum, row) => sum + row.monthlyEstimate, 0)),
      apartmentsWithoutArea: apartments.filter((apartment) => !apartment.areaM2 || Number(apartment.areaM2) <= 0).length,
      totalApartments: apartments.length,
      totalAreaM2: this.money(apartments.reduce((sum, apartment) => sum + Number(apartment.areaM2 || 0), 0)),
    };
  }

  private async tariffListPayload(user: MvpUser) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const { organization, apartments } = await this.tariffContext(organizationId);
    const items = await this.readTariffRows(organizationId, apartments);
    return {
      organization: {
        id: organization.id,
        shortName: organization.name,
        legalName: organization.legalName || organization.name,
        associationCode: organization.fiscalCode || '',
        currency: 'MDL',
      },
      items,
      stats: this.tariffStats(items, apartments),
    };
  }

  async listTariffs(user: MvpUser) {
    return this.tariffListPayload(user);
  }

  async getTariffStats(user: MvpUser) {
    const payload = await this.tariffListPayload(user);
    return payload.stats;
  }

  async getTariff(user: MvpUser, id: string) {
    const payload = await this.tariffListPayload(user);
    const item = payload.items.find((row) => row.id === id);
    if (!item) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return {
      ...item,
      organization: payload.organization,
      activity: [
        { label: 'Creat', date: item.createdAt },
        { label: 'Actualizat', date: item.updatedAt },
      ],
    };
  }

  async saveTariff(user: MvpUser, body: unknown, tariffId?: string) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const { apartments } = await this.tariffContext(organizationId);
    const rows = await this.readTariffRows(organizationId, apartments);
    const input = this.parseTariffPayload(payload, Boolean(tariffId));
    const existingIndex = tariffId ? rows.findIndex((row) => row.id === tariffId) : -1;
    if (tariffId && existingIndex === -1) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    this.assertNoActiveTariffCodeDuplicate(rows, input.internalCode, input.status, tariffId);
    const now = new Date().toISOString();
    const next = this.normalizeTariffRow(
      {
        ...(existingIndex >= 0 ? rows[existingIndex] : {}),
        ...input,
        id: tariffId || randomUUID(),
        createdAt: existingIndex >= 0 ? rows[existingIndex].createdAt : now,
        updatedAt: now,
        createdById: existingIndex >= 0 ? rows[existingIndex].createdById : user.id,
        updatedById: user.id,
      },
      organizationId,
      apartments,
    );
    const nextRows = existingIndex >= 0 ? rows.map((row, index) => (index === existingIndex ? next : row)) : [...rows, next];
    await this.writeTariffRows(organizationId, user.id, nextRows);
    await this.audit
      .logTariffChanged({
        associationId: organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        action: existingIndex >= 0 ? 'TARIFF_UPDATED' : 'TARIFF_CREATED',
        entityId: next.id,
        message: existingIndex >= 0 ? `Tariful "${next.name}" a fost actualizat.` : `Tariful "${next.name}" a fost creat.`,
        actionUrl: `/admin/tariffs/${next.id}`,
        metadata: { name: next.name, internalCode: next.internalCode, calculationType: next.calculationType, status: next.status },
        beforeSnapshot: existingIndex >= 0 ? rows[existingIndex] : null,
        afterSnapshot: next,
      })
      .catch(() => undefined);
    return next;
  }

  async deactivateTariff(user: MvpUser, tariffId: string) {
    return this.updateTariffStatus(user, tariffId, { status: 'INACTIVE' });
  }

  async updateTariffStatus(user: MvpUser, tariffId: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const { apartments } = await this.tariffContext(organizationId);
    const rows = await this.readTariffRows(organizationId, apartments);
    const index = rows.findIndex((row) => row.id === tariffId);
    if (index === -1) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const status = this.parseTariffStatus(payload.status || (payload.isActive ? 'ACTIVE' : 'INACTIVE'));
    this.assertNoActiveTariffCodeDuplicate(rows, rows[index].internalCode, status, tariffId);
    const updated = this.normalizeTariffRow({ ...rows[index], status, updatedAt: new Date().toISOString(), updatedById: user.id }, organizationId, apartments);
    const nextRows = rows.map((row, rowIndex) => (rowIndex === index ? updated : row));
    await this.writeTariffRows(organizationId, user.id, nextRows);
    await this.audit
      .logTariffChanged({
        associationId: organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        action: 'TARIFF_STATUS_CHANGED',
        entityId: updated.id,
        message: `Statusul tarifului "${updated.name}" a fost schimbat din ${rows[index].status} în ${status}.`,
        actionUrl: `/admin/tariffs/${updated.id}`,
        metadata: { name: updated.name, internalCode: updated.internalCode, oldStatus: rows[index].status, newStatus: status },
        beforeSnapshot: { status: rows[index].status },
        afterSnapshot: { status },
      })
      .catch(() => undefined);
    return updated;
  }

  async createDefaultTariffs(user: MvpUser) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const { apartments } = await this.tariffContext(organizationId);
    const rows = await this.readTariffRows(organizationId, apartments);
    const existingCodes = new Set(rows.filter((row) => row.status !== 'INACTIVE').map((row) => row.internalCode));
    const now = new Date().toISOString();
    const additions = RECOMMENDED_TARIFFS
      .filter((row) => !existingCodes.has(row.internalCode))
      .map((row) =>
        this.normalizeTariffRow(
          {
            ...row,
            id: randomUUID(),
            createdAt: now,
            updatedAt: now,
            createdById: user.id,
            updatedById: user.id,
          },
          organizationId,
          apartments,
        ),
      );
    const nextRows = [...rows, ...additions];
    await this.writeTariffRows(organizationId, user.id, nextRows);
    return {
      createdCount: additions.length,
      items: nextRows,
      stats: this.tariffStats(nextRows, apartments),
    };
  }

  async duplicateTariff(user: MvpUser, tariffId: string) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const { apartments } = await this.tariffContext(organizationId);
    const rows = await this.readTariffRows(organizationId, apartments);
    const source = rows.find((row) => row.id === tariffId);
    if (!source) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const now = new Date().toISOString();
    const copy = this.normalizeTariffRow(
      {
        ...source,
        id: randomUUID(),
        name: `${source.name} (copie)`,
        internalCode: source.internalCode ? `${source.internalCode}_COPY` : '',
        status: 'DRAFT',
        createdAt: now,
        updatedAt: now,
        createdById: user.id,
        updatedById: user.id,
      },
      organizationId,
      apartments,
    );
    const nextRows = [...rows, copy];
    await this.writeTariffRows(organizationId, user.id, nextRows);
    return copy;
  }

  async previewTariffs(user: MvpUser) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const { apartments } = await this.tariffContext(organizationId);
    const rows = (await this.readTariffRows(organizationId, apartments)).filter(
      (row) => row.status === 'ACTIVE' && row.periodicity === 'MONTHLY' && row.includeInMonthlyEstimate,
    );
    const items = apartments.slice(0, 20).map((apartment) => {
      const areaM2 = Number(apartment.areaM2 || 0);
      const warnings: string[] = [];
      const lines = rows.map((tariff) => {
        let amount = 0;
        if (tariff.calculationType === 'PER_M2') {
          if (!areaM2) warnings.push(`Apt. ${apartment.number}: lipsește suprafața pentru ${tariff.name}.`);
          amount = this.money(areaM2 * Number(tariff.pricePerM2 || 0));
        } else if (tariff.calculationType === 'FIXED_PER_APARTMENT') {
          amount = this.money(Number(tariff.fixedAmount || 0));
        } else {
          amount = this.money(Number(tariff.defaultManualAmount || 0));
        }
        return {
          tariffId: tariff.id,
          name: tariff.name,
          amount,
        };
      });
      return {
        apartmentId: apartment.id,
        apartmentNumber: apartment.number,
        staircase: apartment.staircase?.name || '',
        areaM2: apartment.areaM2 === null || apartment.areaM2 === undefined ? null : Number(apartment.areaM2),
        lines,
        total: this.money(lines.reduce((sum, line) => sum + line.amount, 0)),
        warnings,
      };
    });
    const summary = this.tariffStats(rows, apartments);
    const warnings = summary.apartmentsWithoutArea && rows.some((row) => row.calculationType === 'PER_M2')
      ? ['Există apartamente fără suprafață. Tarifele per m² nu pot fi calculate complet pentru acestea.']
      : [];
    return {
      summary: {
        totalApartments: summary.totalApartments,
        totalAreaM2: summary.totalAreaM2,
        estimatedMonthlyTotal: summary.estimatedMonthlyTotal,
        apartmentsWithoutArea: summary.apartmentsWithoutArea,
      },
      items,
      warnings,
    };
  }

  private async meterBasedTariffPayload(user: MvpUser) {
    const payload = await this.tariffListPayload(user);
    const billingMonth = this.currentBillingMonth();
    const preview = await this.buildMeterChargesPreview(user, { billingMonth, includeDraftLines: true, limit: 10000 });
    const estimateByTariff = new Map<string, number>();
    (preview.allItems || []).forEach((item: any) => {
      if (!item.tariff?.id) return;
      estimateByTariff.set(item.tariff.id, this.money((estimateByTariff.get(item.tariff.id) || 0) + Number(item.amount || 0)));
    });
    const items = payload.items
      .filter((row) => row.calculationType === 'PER_METER_CONSUMPTION')
      .map((row) => ({
        ...row,
        monthlyEstimate: estimateByTariff.get(row.id) || 0,
        typeLabel: this.meterTypeLabel(row.meterType),
      }));
    return {
      organization: payload.organization,
      items,
      stats: {
        activeMeterTariffs: items.filter((row) => row.status === 'ACTIVE').length,
        draftMeterTariffs: items.filter((row) => row.status === 'DRAFT').length,
        inactiveMeterTariffs: items.filter((row) => row.status === 'INACTIVE').length,
        coveredMeterTypes: new Set(items.filter((row) => row.status === 'ACTIVE').map((row) => row.meterType).filter(Boolean)).size,
        currentMonthEstimatedTotal: preview.summary.estimatedAmount,
        apartmentsWithApprovedReadings: preview.summary.calculatedApartments,
        apartmentsWithoutApprovedReadings: preview.summary.apartmentsWithoutApprovedReadings,
        needsReviewReadings: preview.summary.needsReviewReadings,
        billingMonth,
      },
    };
  }

  async listMeterBasedTariffs(user: MvpUser) {
    return this.meterBasedTariffPayload(user);
  }

  async getMeterBasedTariffStats(user: MvpUser) {
    const payload = await this.meterBasedTariffPayload(user);
    return payload.stats;
  }

  async getMeterBasedTariff(user: MvpUser, id: string) {
    const payload = await this.meterBasedTariffPayload(user);
    const item = payload.items.find((row) => row.id === id);
    if (!item) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const impact = await this.getMeterBasedTariffImpact(user, id, { billingMonth: this.currentBillingMonth(), limit: 10000 });
    return {
      ...item,
      organization: payload.organization,
      impact: impact.summary,
      previewItems: impact.items.slice(0, 10),
      activity: [
        { label: 'Creat', date: item.createdAt },
        { label: 'Actualizat', date: item.updatedAt },
      ],
    };
  }

  private async assertMeterBasedTariff(user: MvpUser, id: string) {
    const payload = await this.tariffListPayload(user);
    const item = payload.items.find((row) => row.id === id);
    if (!item || item.calculationType !== 'PER_METER_CONSUMPTION') throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return item;
  }

  async saveMeterBasedTariff(user: MvpUser, body: unknown, tariffId?: string) {
    if (tariffId) await this.assertMeterBasedTariff(user, tariffId);
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    return this.saveTariff(
      user,
      {
        ...payload,
        calculationType: 'PER_METER_CONSUMPTION',
        includeInDraftInvoices: payload.includeInDraftInvoices !== false,
        includeInMonthlyEstimate: payload.includeInMonthlyEstimate !== false,
      },
      tariffId,
    );
  }

  async updateMeterBasedTariffStatus(user: MvpUser, id: string, body: unknown) {
    await this.assertMeterBasedTariff(user, id);
    return this.updateTariffStatus(user, id, body);
  }

  async duplicateMeterBasedTariff(user: MvpUser, id: string) {
    await this.assertMeterBasedTariff(user, id);
    return this.duplicateTariff(user, id);
  }

  async getMeterBasedTariffImpact(user: MvpUser, id: string, query: Record<string, unknown>) {
    await this.assertMeterBasedTariff(user, id);
    const billingMonth = query.billingMonth || query.periodMonth || this.currentBillingMonth();
    return this.buildMeterChargesPreview(user, { ...query, billingMonth, tariffId: id, includeDraftLines: true });
  }

  async getMeterChargesPreview(user: MvpUser, query: Record<string, unknown>) {
    const preview = await this.buildMeterChargesPreview(user, query);
    const { allItems: _allItems, linesByApartment: _linesByApartment, tariffRows: _tariffRows, periodReadings: _periodReadings, ...publicPreview } = preview;
    return publicPreview;
  }

  private billingMonthWindow(billingMonth: string) {
    const [yearValue, monthValue] = billingMonth.split('-').map((part) => Number(part));
    const startsAt = new Date(Date.UTC(yearValue, monthValue - 1, 1));
    const endsAt = new Date(Date.UTC(yearValue, monthValue, 0, 23, 59, 59, 999));
    return { month: monthValue, year: yearValue, startsAt, endsAt };
  }

  private parseBillingMonth(value: unknown) {
    const billingMonth = this.requiredString(value, 'Luna de facturare este obligatorie.');
    if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
      throw new BadRequestException('Luna de facturare nu este validă.');
    }
    const { month, year } = this.billingMonthWindow(billingMonth);
    if (month < 1 || month > 12) throw new BadRequestException('Luna nu este validă.');
    if (year < 2000 || year > 2100) throw new BadRequestException('Anul nu este valid.');
    return billingMonth;
  }

  private parseDraftPayload(payload: Record<string, unknown>) {
    const billingMonth = this.parseBillingMonth(payload.billingMonth);
    const dueDate =
      typeof payload.dueDate === 'string' && payload.dueDate.trim()
        ? this.requiredDate(payload.dueDate, 'Data scadentă nu este validă.').toISOString().slice(0, 10)
        : null;
    const description = typeof payload.description === 'string' ? payload.description.trim() : '';
    const includeMeterCharges = payload.includeMeterCharges !== false;
    return { billingMonth, dueDate, description, includeMeterCharges };
  }

  private isTariffActiveForBillingMonth(tariff: TariffRow, billingMonth: string) {
    if (tariff.status !== 'ACTIVE' || tariff.periodicity !== 'MONTHLY') return false;
    const { startsAt, endsAt } = this.billingMonthWindow(billingMonth);
    if (tariff.startsAt && new Date(tariff.startsAt) > endsAt) return false;
    if (tariff.endsAt && new Date(tariff.endsAt) < startsAt) return false;
    return true;
  }

  private apartmentMatchesTariff(apartment: { status?: ApartmentStatus | string | null }, tariff: Pick<TariffRow, 'appliesTo'>) {
    if (tariff.appliesTo !== 'ONLY_OCCUPIED') return true;
    const occupiedStatuses = new Set(['ACTIVE', 'DEBTOR', 'PROBLEM', 'OCCUPIED']);
    return occupiedStatuses.has(String(apartment.status || '').toUpperCase());
  }

  private residentFullName(resident?: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null } | null) {
    if (!resident) return '';
    return `${resident.firstName || ''} ${resident.lastName || ''}`.trim() || resident.email || resident.phone || '';
  }

  private primaryContactFromApartment(apartment: any) {
    const owner = apartment.ownerResident;
    const primaryRelation = (apartment.apartmentResidents || []).find((relation: any) => relation.isPrimary);
    const fallbackRelation = (apartment.apartmentResidents || [])[0];
    const resident = owner || primaryRelation?.resident || fallbackRelation?.resident || null;
    if (!resident) return null;
    return {
      id: resident.id,
      fullName: this.residentFullName(resident),
      phone: resident.phone || null,
    };
  }

  private draftLineStatus(lines: BillingDraftLine[], warnings: string[]): BillingDraftLineStatus {
    if (lines.length && lines.every((line) => line.status === 'EXCLUDED')) return 'EXCLUDED';
    const includedLines = lines.filter((line) => line.status !== 'EXCLUDED');
    if (includedLines.some((line) => line.status === 'ERROR')) return 'ERROR';
    if (warnings.length || includedLines.some((line) => line.status === 'WARNING')) return 'WARNING';
    return 'READY';
  }

  private restoreDraftLineStatus(line: BillingDraftLine): BillingDraftLineStatus {
    if (line.warnings?.length) return 'WARNING';
    return 'READY';
  }

  private recomputeDraftItem(item: BillingDraftItem): BillingDraftItem {
    if (item.status === 'EXCLUDED') {
      return {
        ...item,
        lines: item.lines.map((line) => ({ ...line, status: 'EXCLUDED' as BillingDraftLineStatus })),
        total: 0,
      };
    }
    const total = this.money(item.lines.filter((line) => line.status !== 'EXCLUDED').reduce((sum, line) => sum + Number(line.amount || 0), 0));
    const status = this.draftLineStatus(item.lines, item.warnings || []);
    return { ...item, total, status };
  }

  private draftTotals(items: BillingDraftItem[]) {
    const normalizedItems = items.map((item) => this.recomputeDraftItem(item));
    const includedItems = normalizedItems.filter((item) => item.status !== 'EXCLUDED');
    const excludedItems = normalizedItems.filter((item) => item.status === 'EXCLUDED');
    const allLines = normalizedItems.flatMap((item) => item.lines || []);
    return {
      totalAmount: this.money(includedItems.reduce((sum, item) => sum + item.total, 0)),
      includedAmount: this.money(includedItems.reduce((sum, item) => sum + item.total, 0)),
      excludedAmount: this.money(allLines.filter((line) => line.status === 'EXCLUDED').reduce((sum, line) => sum + Number(line.amount || 0), 0)),
      apartmentsCount: normalizedItems.length,
      includedApartments: includedItems.length,
      excludedApartments: excludedItems.length,
      calculatedApartments: includedItems.filter((item) => item.status === 'READY' || item.status === 'WARNING').length,
      warningsCount: includedItems.filter((item) => item.status === 'WARNING').length,
      errorsCount: includedItems.filter((item) => item.status === 'ERROR').length,
      tariffLinesCount: allLines.length,
    };
  }

  private draftResponse(draft: BillingDraftRecord) {
    const normalizedItems = (draft.items || []).map((item) => this.recomputeDraftItem(item));
    const totals = this.draftTotals(normalizedItems);
    const manualExcluded = Number(draft.summary?.manualServicesExcluded || 0);
    return {
      ...draft,
      associationId: draft.organizationId,
      items: normalizedItems,
      totalAmount: totals.totalAmount,
      includedAmount: totals.includedAmount,
      excludedAmount: totals.excludedAmount,
      apartmentsCount: totals.apartmentsCount,
      includedApartments: totals.includedApartments,
      excludedApartments: totals.excludedApartments,
      warningsCount: totals.warningsCount,
      errorsCount: totals.errorsCount,
      summary: {
        ...draft.summary,
        billingMonth: draft.billingMonth,
        currency: draft.currency,
        totalApartments: totals.apartmentsCount,
        calculatedApartments: totals.calculatedApartments,
        totalAmount: totals.totalAmount,
        warningsCount: totals.warningsCount,
        errorsCount: totals.errorsCount,
        manualServicesExcluded: manualExcluded,
        includedAmount: totals.includedAmount,
        excludedAmount: totals.excludedAmount,
        includedApartments: totals.includedApartments,
        excludedApartments: totals.excludedApartments,
        tariffLinesCount: totals.tariffLinesCount,
      },
    };
  }

  private async invoiceDraftContext(organizationId: string) {
    const [organization, apartments] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, legalName: true, fiscalCode: true, currency: true },
      }),
      this.prisma.apartment.findMany({
        where: { organizationId },
        orderBy: [{ staircase: { name: 'asc' } }, { floor: 'asc' }, { number: 'asc' }],
        select: {
          id: true,
          number: true,
          areaM2: true,
          status: true,
          floor: true,
          staircase: { select: { id: true, name: true } },
          ownerResident: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          apartmentResidents: {
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            select: {
              role: true,
              isPrimary: true,
              resident: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
            },
          },
        },
      }),
    ]);
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return { organization, apartments };
  }

  private parseMeterChargePreviewQuery(rawQuery: Record<string, unknown>) {
    const billingMonth = this.parseBillingMonth(rawQuery.billingMonth || rawQuery.periodMonth || this.currentBillingMonth());
    const meterType =
      rawQuery.meterType && String(rawQuery.meterType).toUpperCase() !== 'ALL'
        ? this.normalizeMeterTypeForTariff(rawQuery.meterType)
        : null;
    const status =
      rawQuery.status && String(rawQuery.status).toUpperCase() !== 'ALL'
        ? this.normalizeMeterReadingStatus(rawQuery.status)
        : null;
    if (rawQuery.status && String(rawQuery.status).toUpperCase() !== 'ALL' && !status) {
      throw new BadRequestException('Statusul indicelui nu este valid.');
    }
    const source =
      rawQuery.source && String(rawQuery.source).toUpperCase() !== 'ALL'
        ? String(rawQuery.source).trim().toUpperCase()
        : null;
    if (source && !['RESIDENT', 'ADMIN', 'SYSTEM'].includes(source)) throw new BadRequestException('Sursa indicelui nu este validă.');
    const page = Math.max(1, Number(rawQuery.page || 1) || 1);
    const limit = Math.min(200, Math.max(1, Number(rawQuery.limit || 20) || 20));
    return {
      billingMonth,
      meterType,
      tariffId: typeof rawQuery.tariffId === 'string' && rawQuery.tariffId.trim() ? rawQuery.tariffId.trim() : null,
      staircase: typeof rawQuery.staircase === 'string' && rawQuery.staircase.trim() ? rawQuery.staircase.trim().toLowerCase() : null,
      apartmentNumber: typeof rawQuery.apartmentNumber === 'string' && rawQuery.apartmentNumber.trim() ? rawQuery.apartmentNumber.trim().toLowerCase() : null,
      apartmentId: typeof rawQuery.apartmentId === 'string' && rawQuery.apartmentId.trim() ? rawQuery.apartmentId.trim() : null,
      warningsOnly: rawQuery.warningsOnly === true || rawQuery.warningsOnly === 'true' || rawQuery.includeWarningsOnly === true || rawQuery.includeWarningsOnly === 'true',
      status,
      source,
      page,
      limit,
    };
  }

  private async buildMeterChargesPreview(user: MvpUser, rawQuery: Record<string, unknown> = {}) {
    const organizationId = this.resolveOrganizationId(user, rawQuery);
    this.assertOrganizationAccess(user, organizationId);
    const query = this.parseMeterChargePreviewQuery(rawQuery);
    const includeDraftLines = rawQuery.includeDraftLines === true;
    const { organization, apartments } = await this.invoiceDraftContext(organizationId);
    const apartmentMap = new Map(apartments.map((apartment: any) => [apartment.id, apartment]));
    if (query.apartmentId && !apartmentMap.has(query.apartmentId)) throw new NotFoundException('Apartamentul nu a fost găsit.');

    const tariffRows = await this.readTariffRows(organizationId, apartments);
    const meterTariffs = tariffRows
      .filter((tariff) => tariff.calculationType === 'PER_METER_CONSUMPTION')
      .filter((tariff) => this.isTariffActiveForBillingMonth(tariff, query.billingMonth))
      .filter((tariff) => tariff.includeInDraftInvoices !== false || tariff.includeInMonthlyEstimate !== false)
      .filter((tariff) => !query.tariffId || tariff.id === query.tariffId)
      .filter((tariff) => !query.meterType || tariff.meterType === query.meterType);

    const store = await this.readMeterWorkflowMetadata(organizationId);
    const [meters, rawReadings] = await Promise.all([
      this.prisma.meter.findMany({
        where: { organizationId },
        orderBy: [{ apartment: { staircase: { name: 'asc' } } }, { apartment: { number: 'asc' } }, { type: 'asc' }],
        select: {
          id: true,
          organizationId: true,
          apartmentId: true,
          type: true,
          serialNumber: true,
          status: true,
          apartment: {
            select: {
              id: true,
              number: true,
              floor: true,
              staircase: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.meterReading.findMany({
        where: { organizationId },
        orderBy: [{ readingDate: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          meterId: true,
          apartmentId: true,
          organizationId: true,
          value: true,
          readingDate: true,
          source: true,
          createdAt: true,
          meter: { select: { id: true, type: true, serialNumber: true, status: true } },
        },
      }),
    ]);

    const activeMeters = meters.filter((meter: any) => {
      const alias = store.meters?.[meter.id]?.statusAlias;
      return String(alias || meter.status || '').toUpperCase() === 'ACTIVE';
    });
    const readings = rawReadings.map((reading: any) => {
      const metadata = this.readingMetadataForCharge(store, reading);
      return {
        ...reading,
        periodMonth: metadata.periodMonth,
        status: metadata.status,
        unit: metadata.unit,
        source: metadata.source || String(reading.source || 'ADMIN'),
        readingValue: Number(reading.value || 0),
        previousReadingValue: metadata.previousReadingValue,
        consumptionValue: metadata.consumptionValue,
        submittedAt: metadata.submittedAt || reading.createdAt,
      };
    });
    const readingsByMeter = new Map<string, any[]>();
    readings.forEach((reading) => {
      if (!readingsByMeter.has(reading.meterId)) readingsByMeter.set(reading.meterId, []);
      readingsByMeter.get(reading.meterId)!.push(reading);
    });
    readingsByMeter.forEach((list) => {
      list.sort((left, right) => String(left.periodMonth).localeCompare(String(right.periodMonth)));
      list.forEach((reading) => {
        if (reading.previousReadingValue !== null && reading.consumptionValue !== null) return;
        const previous = [...list]
          .reverse()
          .find((candidate) => candidate.id !== reading.id && candidate.status === 'APPROVED' && String(candidate.periodMonth) < String(reading.periodMonth));
        if (reading.previousReadingValue === null && previous) reading.previousReadingValue = Number(previous.readingValue || 0);
        if (reading.consumptionValue === null && reading.previousReadingValue !== null) {
          reading.consumptionValue = this.money(Number(reading.readingValue || 0) - Number(reading.previousReadingValue || 0));
        }
      });
    });

    const relevantMeterTypes = new Set(meterTariffs.map((tariff) => this.meterTypeForPrisma(tariff.meterType)));
    const periodReadings = readings.filter((reading) => {
      if (reading.periodMonth !== query.billingMonth) return false;
      if (!relevantMeterTypes.has(String(reading.meter?.type || '').toUpperCase())) return false;
      if (query.status && reading.status !== query.status) return false;
      if (query.source && String(reading.source || '').toUpperCase() !== query.source) return false;
      return true;
    });
    const needsReviewReadings = readings.filter((reading) => reading.periodMonth === query.billingMonth && reading.status === 'NEEDS_REVIEW').length;
    const rejectedReadings = readings.filter((reading) => reading.periodMonth === query.billingMonth && reading.status === 'REJECTED').length;

    const items: any[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    const totalApprovedConsumption: Record<string, { value: number; unit: string }> = {};
    const calculatedApartments = new Set<string>();
    const apartmentsWithoutApprovedReadings = new Set<string>();

    for (const apartment of apartments as any[]) {
      if (query.apartmentId && apartment.id !== query.apartmentId) continue;
      if (query.staircase && String(apartment.staircase?.name || '').toLowerCase() !== query.staircase) continue;
      if (query.apartmentNumber && !String(apartment.number || '').toLowerCase().includes(query.apartmentNumber)) continue;
      const apartmentMeters = activeMeters.filter((meter: any) => meter.apartmentId === apartment.id);
      for (const tariff of meterTariffs) {
        if (!this.apartmentMatchesTariff(apartment, tariff)) continue;
        const tariffMeterType = this.meterTypeForPrisma(tariff.meterType);
        const metersForTariff = apartmentMeters.filter((meter: any) => String(meter.type).toUpperCase() === tariffMeterType);
        if (!metersForTariff.length) {
          const warning = `Apartamentul ${apartment.number} nu are contor activ pentru ${this.meterTypeLabel(tariff.meterType)}.`;
          warnings.push(warning);
          apartmentsWithoutApprovedReadings.add(apartment.id);
          continue;
        }
        for (const meter of metersForTariff) {
          const meterPeriodReadings = readings
            .filter((reading) => reading.meterId === meter.id && reading.periodMonth === query.billingMonth && reading.status !== 'CANCELLED')
            .sort((left, right) => new Date(right.submittedAt || right.createdAt).getTime() - new Date(left.submittedAt || left.createdAt).getTime());
          const approved = meterPeriodReadings.find((reading) => reading.status === 'APPROVED') || null;
          const visibleReading = approved || meterPeriodReadings.find((reading) => query.status ? reading.status === query.status : reading.status !== 'APPROVED') || null;
          if (!approved) apartmentsWithoutApprovedReadings.add(apartment.id);
          if (query.status && !visibleReading) continue;

          const lineWarnings: string[] = [];
          let status: BillingDraftLineStatus = 'READY';
          let quantity = approved && Number.isFinite(Number(approved.consumptionValue)) ? Number(approved.consumptionValue) : 0;
          const unit = approved?.unit || store.meters?.[meter.id]?.unit || tariff.unit || this.defaultMeterUnit(tariff.meterType);
          const unitPrice = Number(tariff.pricePerUnit || 0);
          const missingPolicy = tariff.missingReadingPolicy || 'SKIP_WITH_WARNING';
          let amount = approved ? this.money(quantity * unitPrice) : 0;
          let draftLine: BillingDraftLine | null = null;

          if (approved && quantity < 0) {
            status = 'ERROR';
            lineWarnings.push(`Consumul calculat pentru contorul ${meter.serialNumber || meter.id} este negativ.`);
          }
          if (!approved) {
            status = missingPolicy === 'BLOCK_DRAFT' ? 'ERROR' : 'WARNING';
            const baseWarning = `Apartamentul ${apartment.number} nu are indice aprobat pentru ${this.meterTypeLabel(tariff.meterType)} în luna ${query.billingMonth}.`;
            lineWarnings.push(baseWarning);
            warnings.push(baseWarning);
            if (visibleReading?.status === 'NEEDS_REVIEW') lineWarnings.push('Indicele transmis necesită verificare și nu a fost inclus în calcul.');
            if (visibleReading?.status === 'REJECTED') lineWarnings.push('Indicele transmis a fost respins și nu a fost inclus în calcul.');
            if (missingPolicy === 'BLOCK_DRAFT') errors.push(baseWarning);
          }

          if (approved || missingPolicy !== 'SKIP_WITH_WARNING') {
            draftLine = {
              id: `meter:${apartment.id}:${tariff.id}:${meter.id}:${approved?.id || query.billingMonth}`,
              lineType: 'METER_CONSUMPTION',
              tariffId: tariff.id,
              meterId: meter.id,
              meterReadingId: approved?.id || null,
              meterType: this.meterTypeExternal(meter.type),
              unit,
              source: 'METER_READING',
              isManual: false,
              manualType: null,
              name: tariff.name,
              description: approved
                ? `Contor ${meter.serialNumber || meter.id}, perioada ${query.billingMonth}`
                : `Fără indice aprobat pentru contorul ${meter.serialNumber || meter.id}, perioada ${query.billingMonth}`,
              calculationType: 'PER_METER_CONSUMPTION',
              quantity,
              unitPrice,
              amount,
              currency: 'MDL',
              formulaLabel: this.formatMeterFormula(quantity, unit, unitPrice),
              status,
              warnings: lineWarnings,
              excludedAt: null,
              excludedById: null,
              exclusionReason: null,
            };
          }

          if (approved) {
            calculatedApartments.add(apartment.id);
            const key = this.meterTypeExternal(meter.type);
            totalApprovedConsumption[key] = totalApprovedConsumption[key] || { value: 0, unit };
            totalApprovedConsumption[key].value = this.money(totalApprovedConsumption[key].value + Math.max(quantity, 0));
          }

          const row = {
            apartment: {
              id: apartment.id,
              apartmentNumber: apartment.number,
              staircase: apartment.staircase?.name || '',
              floor: apartment.floor === null || apartment.floor === undefined ? null : String(apartment.floor),
            },
            primaryContact: this.primaryContactFromApartment(apartment),
            meter: {
              id: meter.id,
              meterNumber: meter.serialNumber || '',
              type: this.meterTypeExternal(meter.type),
              unit,
            },
            reading: approved || visibleReading
              ? {
                  id: (approved || visibleReading).id,
                  periodMonth: (approved || visibleReading).periodMonth,
                  previousReadingValue: (approved || visibleReading).previousReadingValue,
                  readingValue: (approved || visibleReading).readingValue,
                  consumptionValue: (approved || visibleReading).consumptionValue,
                  status: (approved || visibleReading).status,
                }
              : null,
            tariff: {
              id: tariff.id,
              name: tariff.name,
              pricePerUnit: unitPrice,
              currency: 'MDL',
              missingReadingPolicy: missingPolicy,
            },
            amount,
            formulaLabel: this.formatMeterFormula(quantity, unit, unitPrice),
            status,
            warnings: lineWarnings,
            draftLine,
          };
          items.push(row);
        }
      }
    }

    const filteredItems = query.warningsOnly ? items.filter((item) => item.warnings?.length || item.status === 'ERROR' || item.status === 'WARNING') : items;
    const estimatedAmount = this.money(items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
    const page = includeDraftLines ? 1 : query.page;
    const limit = includeDraftLines ? Math.max(filteredItems.length, 1) : query.limit;
    const start = (page - 1) * limit;
    const pagedItems = filteredItems.slice(start, start + limit);
    return {
      billingMonth: query.billingMonth,
      association: {
        id: organization.id,
        shortName: organization.name,
        legalName: organization.legalName || organization.name,
        associationCode: organization.fiscalCode || '',
      },
      summary: {
        currency: 'MDL',
        activeMeterTariffs: meterTariffs.length,
        totalApprovedConsumption,
        estimatedAmount,
        calculatedApartments: calculatedApartments.size,
        apartmentsWithoutApprovedReadings: apartmentsWithoutApprovedReadings.size,
        warningsCount: Array.from(new Set(warnings)).length,
        errorsCount: Array.from(new Set(errors)).length,
        needsReviewReadings,
        rejectedReadings,
      },
      items: pagedItems,
      allItems: filteredItems,
      linesByApartment: filteredItems.reduce((acc: Record<string, BillingDraftLine[]>, item) => {
        if (item.draftLine) {
          const apartmentId = item.apartment.id;
          acc[apartmentId] = acc[apartmentId] || [];
          acc[apartmentId].push(item.draftLine);
        }
        return acc;
      }, {}),
      warnings: Array.from(new Set(warnings.length ? warnings : meterTariffs.length ? [] : ['Nu există tarife pe consum active pentru perioada selectată.'])),
      meta: {
        page,
        limit,
        total: filteredItems.length,
      },
      tariffRows: meterTariffs,
      periodReadings,
    };
  }

  private async calculateDraftRecord(
    user: MvpUser,
    input: { billingMonth: string; dueDate: string | null; description: string; includeMeterCharges?: boolean },
    existing?: BillingDraftRecord | null,
  ): Promise<BillingDraftRecord> {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const { organization, apartments } = await this.invoiceDraftContext(organizationId);
    const tariffRows = await this.readTariffRows(organizationId, apartments);
    const tariffsActiveInPeriod = tariffRows.filter((tariff) => this.isTariffActiveForBillingMonth(tariff, input.billingMonth));
    const tariffsUsed = tariffsActiveInPeriod.filter((tariff) => {
      if (tariff.calculationType === 'PER_METER_CONSUMPTION' && input.includeMeterCharges === false) return false;
      if (!tariff.includeInMonthlyEstimate) return false;
      if (tariff.calculationType === 'MANUAL') return Number(tariff.defaultManualAmount || 0) > 0;
      return true;
    });
    const standardTariffsUsed = tariffsUsed.filter((tariff) => tariff.calculationType !== 'PER_METER_CONSUMPTION');
    const meterChargePreview = input.includeMeterCharges
      ? await this.buildMeterChargesPreview(user, { billingMonth: input.billingMonth, includeDraftLines: true, limit: 10000 })
      : null;
    const meterLinesByApartment = (meterChargePreview?.linesByApartment || {}) as Record<string, BillingDraftLine[]>;
    const meterWarningsByApartment = new Map<string, string[]>();
    (meterChargePreview?.allItems || []).forEach((item: any) => {
      if (!item?.apartment?.id || !item.warnings?.length) return;
      const current = meterWarningsByApartment.get(item.apartment.id) || [];
      current.push(...item.warnings);
      meterWarningsByApartment.set(item.apartment.id, Array.from(new Set(current)));
    });
    const manualServicesExcluded = tariffsActiveInPeriod.filter(
      (tariff) => tariff.calculationType === 'MANUAL' && (!tariff.includeInMonthlyEstimate || Number(tariff.defaultManualAmount || 0) <= 0),
    ).length;
    const previousStatuses = new Map<string, BillingDraftLineStatus>();
    (existing?.items || []).forEach((item) => {
      previousStatuses.set(item.id, item.status);
      previousStatuses.set(item.apartmentId, item.status);
    });

    const items: BillingDraftItem[] = apartments.map((apartment: any) => {
      const areaM2 = apartment.areaM2 === null || apartment.areaM2 === undefined ? null : Number(apartment.areaM2);
      const warnings: string[] = [];
      const baseLines: BillingDraftLine[] = standardTariffsUsed
        .filter((tariff) => this.apartmentMatchesTariff(apartment, tariff))
        .map((tariff) => {
          const lineWarnings: string[] = [];
          let quantity = 1;
          let unitPrice = 0;
          let amount = 0;
          let formulaLabel = '';
          if (tariff.calculationType === 'PER_M2') {
            quantity = Number(areaM2 || 0);
            unitPrice = Number(tariff.pricePerM2 || 0);
            if (!areaM2 || areaM2 <= 0) {
              lineWarnings.push('Lipsește suprafața apartamentului. Tariful per m² nu poate fi calculat.');
            }
            amount = this.money(quantity * unitPrice);
            formulaLabel = `${quantity.toLocaleString('ro-RO')} m² × ${unitPrice.toLocaleString('ro-RO')} MDL`;
          } else if (tariff.calculationType === 'FIXED_PER_APARTMENT') {
            quantity = 1;
            unitPrice = Number(tariff.fixedAmount || 0);
            amount = this.money(unitPrice);
            formulaLabel = `${unitPrice.toLocaleString('ro-RO')} MDL`;
          } else {
            quantity = 1;
            unitPrice = Number(tariff.defaultManualAmount || 0);
            amount = this.money(unitPrice);
            formulaLabel = `sumă manuală default ${unitPrice.toLocaleString('ro-RO')} MDL`;
          }
          warnings.push(...lineWarnings);
          return {
            id: `line:${apartment.id}:${tariff.id}`,
            lineType: tariff.calculationType === 'MANUAL' ? 'MANUAL' : 'TARIFF',
            tariffId: tariff.id,
            isManual: false,
            manualType: null,
            name: tariff.name,
            description: tariff.description || '',
            calculationType: tariff.calculationType,
            quantity,
            unitPrice,
            amount,
            currency: 'MDL',
            formulaLabel,
            status: lineWarnings.length ? 'WARNING' : 'READY',
            warnings: lineWarnings,
            excludedAt: null,
            excludedById: null,
            exclusionReason: null,
          };
        });
      const meterLines = meterLinesByApartment[apartment.id] || [];
      warnings.push(...(meterWarningsByApartment.get(apartment.id) || []));
      const lines = [...baseLines, ...meterLines];
      if (!lines.length && tariffsUsed.length === 0 && !(meterChargePreview?.tariffRows || []).length) {
        warnings.push('Nu există tarife active pentru această perioadă.');
      }
      const itemId = `apt:${apartment.id}`;
      const calculatedStatus = this.draftLineStatus(lines, warnings);
      const previousStatus = previousStatuses.get(itemId) || previousStatuses.get(apartment.id);
      const status = previousStatus === 'EXCLUDED' ? 'EXCLUDED' : calculatedStatus;
      return {
        id: itemId,
        apartmentId: apartment.id,
        apartmentNumber: apartment.number,
        staircase: apartment.staircase?.name || '',
        floor: apartment.floor === null || apartment.floor === undefined ? null : String(apartment.floor),
        areaM2,
        primaryContact: this.primaryContactFromApartment(apartment),
        lines,
        total: this.money(lines.reduce((sum, line) => sum + line.amount, 0)),
        status,
        warnings: Array.from(new Set(warnings)),
        internalNotes: '',
      };
    });
    const totals = this.draftTotals(items);
    const topWarnings = [
      ...(items.some((item) => item.warnings.some((warning) => warning.includes('suprafața'))) && tariffsUsed.some((tariff) => tariff.calculationType === 'PER_M2')
        ? ['Există apartamente fără suprafață. Tarifele per m² nu pot fi calculate complet.']
        : []),
      ...(manualServicesExcluded ? ['Unele servicii manuale nu au fost incluse automat în calcul.'] : []),
      ...(meterChargePreview?.warnings || []),
    ];
    const now = new Date().toISOString();
    const meterTariffsUsed = ((meterChargePreview?.tariffRows || []) as TariffRow[]).filter(
      (tariff) => !standardTariffsUsed.some((row) => row.id === tariff.id),
    );
    const tariffRowsUsedForMetadata = [...standardTariffsUsed, ...meterTariffsUsed];
    const draft: BillingDraftRecord = {
      id: existing?.id || randomUUID(),
      associationId: organizationId,
      organizationId,
      billingMonth: input.billingMonth,
      dueDate: input.dueDate,
      description: input.description || `Plata lunară pentru ${input.billingMonth}`,
      status: existing?.status && existing.status !== 'CANCELLED' ? existing.status : 'DRAFT',
      currency: 'MDL',
      totalAmount: totals.totalAmount,
      apartmentsCount: totals.apartmentsCount,
      warningsCount: totals.warningsCount,
      errorsCount: totals.errorsCount,
      createdById: existing?.createdById || user.id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lockedAt: existing?.lockedAt || null,
      lockedById: existing?.lockedById || null,
      cancelledAt: existing?.cancelledAt || null,
      cancelledById: existing?.cancelledById || null,
      cancellationReason: existing?.cancellationReason || null,
      summary: {
        billingMonth: input.billingMonth,
        currency: 'MDL',
        totalApartments: totals.apartmentsCount,
        calculatedApartments: totals.calculatedApartments,
        totalAmount: totals.totalAmount,
        warningsCount: totals.warningsCount,
        errorsCount: totals.errorsCount,
        activeTariffsUsed: tariffRowsUsedForMetadata.length,
        apartmentsWithoutArea: apartments.filter((apartment) => !apartment.areaM2 || Number(apartment.areaM2) <= 0).length,
        perM2Services: standardTariffsUsed.filter((tariff) => tariff.calculationType === 'PER_M2').length,
        fixedServices: standardTariffsUsed.filter((tariff) => tariff.calculationType === 'FIXED_PER_APARTMENT').length,
        meterConsumptionServices: (meterChargePreview?.tariffRows || []).length,
        meterConsumptionAmount: meterChargePreview?.summary?.estimatedAmount || 0,
        apartmentsWithoutApprovedMeterReadings: meterChargePreview?.summary?.apartmentsWithoutApprovedReadings || 0,
        includeMeterCharges: input.includeMeterCharges !== false,
        manualServicesExcluded,
      },
      tariffsUsed: tariffRowsUsedForMetadata.map((tariff) => ({
        id: tariff.id,
        name: tariff.name,
        calculationType: tariff.calculationType,
        pricePerM2: tariff.pricePerM2,
        fixedAmount: tariff.fixedAmount,
        defaultManualAmount: tariff.defaultManualAmount,
        meterType: tariff.meterType || null,
        unit: tariff.unit,
        pricePerUnit: tariff.pricePerUnit ?? null,
      })),
      items,
      warnings: topWarnings,
    };

    return {
      ...this.draftResponse(draft),
      organization: {
        id: organization.id,
        shortName: organization.name,
        legalName: organization.legalName || organization.name,
        associationCode: organization.fiscalCode || '',
        currency: 'MDL',
      },
    } as BillingDraftRecord;
  }

  private async readBillingDrafts(organizationId: string): Promise<BillingDraftRecord[]> {
    const note = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: BILLING_DRAFT_NOTE_TITLE },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return [];
    try {
      const parsed = JSON.parse(note.content);
      return Array.isArray(parsed?.items) ? parsed.items : [];
    } catch {
      return [];
    }
  }

  private async writeBillingDrafts(organizationId: string, actorUserId: string, drafts: BillingDraftRecord[], client: any = this.prisma) {
    const payload = { version: 1, items: drafts };
    const existing = await client.clientNote.findFirst({
      where: { organizationId, title: BILLING_DRAFT_NOTE_TITLE },
      select: { id: true },
    });
    const content = JSON.stringify(payload);
    if (existing) {
      await client.clientNote.update({ where: { id: existing.id }, data: { content } });
    } else {
      await client.clientNote.create({
        data: {
          organizationId,
          createdByUserId: actorUserId,
          title: BILLING_DRAFT_NOTE_TITLE,
          content,
        },
      });
    }
  }

  private normalizeBillingRun(raw: any, organizationId: string): BillingRunRecord {
    const now = new Date().toISOString();
    const status = this.parseBillingRunStatus(raw?.status, 'PRECHECK');
    const checks = Array.isArray(raw?.checks)
      ? raw.checks.map((check: any) => ({
          id: String(check?.id || randomUUID()),
          key: String(check?.key || 'UNKNOWN_CHECK'),
          label: String(check?.label || 'Verificare'),
          category: this.parseBillingRunCheckCategory(check?.category),
          status: this.parseBillingRunCheckStatus(check?.status),
          severity: this.parseBillingRunCheckSeverity(check?.severity),
          message: String(check?.message || ''),
          actionUrl: check?.actionUrl ? String(check.actionUrl) : null,
          metadata: check?.metadata && typeof check.metadata === 'object' ? check.metadata : null,
          createdAt: String(check?.createdAt || raw?.createdAt || now),
          updatedAt: String(check?.updatedAt || raw?.updatedAt || now),
        }))
      : [];
    return {
      id: String(raw?.id || randomUUID()),
      associationId: String(raw?.associationId || raw?.organizationId || organizationId),
      organizationId,
      billingMonth: this.parseBillingMonth(raw?.billingMonth || this.currentBillingMonth()),
      status,
      currency: 'MDL',
      draftId: raw?.draftId ? String(raw.draftId) : null,
      finalizedAt: raw?.finalizedAt ? String(raw.finalizedAt) : null,
      finalizedById: raw?.finalizedById ? String(raw.finalizedById) : null,
      invoicesCount: Math.max(0, Number(raw?.invoicesCount || 0) || 0),
      totalAmount: this.money(Number(raw?.totalAmount || 0) || 0),
      warningsCount: Math.max(0, Number(raw?.warningsCount || checks.filter((check: BillingRunCheck) => check.status === 'WARNING').length) || 0),
      errorsCount: Math.max(0, Number(raw?.errorsCount || checks.filter((check: BillingRunCheck) => check.status === 'FAILED').length) || 0),
      startedById: String(raw?.startedById || raw?.createdById || ''),
      cancelledAt: raw?.cancelledAt ? String(raw.cancelledAt) : null,
      cancelledById: raw?.cancelledById ? String(raw.cancelledById) : null,
      cancellationReason: raw?.cancellationReason ? String(raw.cancellationReason) : null,
      checks,
      createdAt: String(raw?.createdAt || now),
      updatedAt: String(raw?.updatedAt || now),
    };
  }

  private async readBillingRuns(organizationId: string, client: any = this.prisma): Promise<BillingRunRecord[]> {
    const note = await client.clientNote.findFirst({
      where: { organizationId, title: BILLING_RUN_NOTE_TITLE },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return [];
    try {
      const parsed = JSON.parse(note.content);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      return items.map((item: any) => this.normalizeBillingRun(item, organizationId));
    } catch {
      return [];
    }
  }

  private async writeBillingRuns(organizationId: string, actorUserId: string, runs: BillingRunRecord[], client: any = this.prisma) {
    const payload = { version: 1, items: runs };
    const existing = await client.clientNote.findFirst({
      where: { organizationId, title: BILLING_RUN_NOTE_TITLE },
      select: { id: true },
    });
    const content = JSON.stringify(payload);
    if (existing) {
      await client.clientNote.update({ where: { id: existing.id }, data: { content } });
    } else {
      await client.clientNote.create({
        data: {
          organizationId,
          createdByUserId: actorUserId,
          title: BILLING_RUN_NOTE_TITLE,
          content,
        },
      });
    }
  }

  private parseBillingRunStatus(value: unknown, fallback: BillingRunStatus = 'PRECHECK'): BillingRunStatus {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (
      normalized === 'NOT_STARTED' ||
      normalized === 'PRECHECK' ||
      normalized === 'READY_FOR_DRAFT' ||
      normalized === 'DRAFT_CALCULATED' ||
      normalized === 'IN_REVIEW' ||
      normalized === 'DRAFT_LOCKED' ||
      normalized === 'FINALIZED' ||
      normalized === 'CANCELLED'
    ) {
      return normalized as BillingRunStatus;
    }
    return fallback;
  }

  private parseBillingRunCheckStatus(value: unknown): BillingRunCheckStatus {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (normalized === 'PASSED' || normalized === 'WARNING' || normalized === 'FAILED' || normalized === 'NOT_APPLICABLE') {
      return normalized as BillingRunCheckStatus;
    }
    return 'NOT_APPLICABLE';
  }

  private parseBillingRunCheckSeverity(value: unknown): BillingRunCheckSeverity {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (normalized === 'INFO' || normalized === 'WARNING' || normalized === 'CRITICAL') return normalized as BillingRunCheckSeverity;
    return 'INFO';
  }

  private parseBillingRunCheckCategory(value: unknown): BillingRunCheckCategory {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (
      normalized === 'ASSOCIATION' ||
      normalized === 'APARTMENTS' ||
      normalized === 'RESIDENTS' ||
      normalized === 'TARIFFS' ||
      normalized === 'METERS' ||
      normalized === 'DRAFT' ||
      normalized === 'FINALIZATION'
    ) {
      return normalized as BillingRunCheckCategory;
    }
    return 'ASSOCIATION';
  }

  private makeBillingRunCheck(input: {
    key: string;
    label: string;
    category: BillingRunCheckCategory;
    status: BillingRunCheckStatus;
    severity?: BillingRunCheckSeverity;
    message: string;
    actionUrl?: string | null;
    metadata?: Record<string, unknown> | null;
  }): BillingRunCheck {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      key: input.key,
      label: input.label,
      category: input.category,
      status: input.status,
      severity: input.severity || (input.status === 'FAILED' ? 'CRITICAL' : input.status === 'WARNING' ? 'WARNING' : 'INFO'),
      message: input.message,
      actionUrl: input.actionUrl || null,
      metadata: input.metadata || null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private billingRunCounts(checks: BillingRunCheck[]) {
    return {
      warningsCount: checks.filter((check) => check.status === 'WARNING').length,
      errorsCount: checks.filter((check) => check.status === 'FAILED' && check.severity === 'CRITICAL').length,
    };
  }

  private findActiveBillingRun(runs: BillingRunRecord[], billingMonth: string) {
    return runs.find((run) => run.billingMonth === billingMonth && run.status !== 'CANCELLED') || null;
  }

  private draftForBillingRun(run: BillingRunRecord | null, drafts: BillingDraftRecord[], billingMonth?: string) {
    if (run?.draftId) {
      const byId = drafts.find((draft) => draft.id === run.draftId && draft.status !== 'CANCELLED');
      if (byId) return byId;
    }
    const month = run?.billingMonth || billingMonth;
    return month ? drafts.find((draft) => draft.billingMonth === month && draft.status !== 'CANCELLED') || null : null;
  }

  private billingRunStatusFromState(run: BillingRunRecord, draft: BillingDraftRecord | null, finalInvoices: InternalInvoiceMetadata[] = []) {
    if (run.status === 'CANCELLED') return 'CANCELLED' as BillingRunStatus;
    const invoiceCount = finalInvoices.filter((invoice) => invoice.billingMonth === run.billingMonth && (!draft || invoice.sourceDraftId === draft.id)).length;
    if (run.finalizedAt || invoiceCount > 0 || draft?.finalizedAt || draft?.invoicesGenerated) return 'FINALIZED' as BillingRunStatus;
    if (draft?.status === 'LOCKED') return 'DRAFT_LOCKED' as BillingRunStatus;
    if (draft) return run.status === 'IN_REVIEW' ? 'IN_REVIEW' : 'DRAFT_CALCULATED';
    if (run.status === 'NOT_STARTED') return 'NOT_STARTED';
    if (run.errorsCount > 0) return 'PRECHECK';
    return run.status === 'PRECHECK' ? 'READY_FOR_DRAFT' : run.status;
  }

  private async syncBillingRunForDraft(
    organizationId: string,
    actorUserId: string,
    draft: BillingDraftRecord,
    forcedStatus?: BillingRunStatus,
    client: any = this.prisma,
  ) {
    const runs = await this.readBillingRuns(organizationId, client);
    const now = new Date().toISOString();
    const response = this.draftResponse(draft) as BillingDraftRecord;
    const existing = runs.find((run) => run.draftId === response.id) || this.findActiveBillingRun(runs, response.billingMonth);
    const nextStatus =
      forcedStatus ||
      (response.finalizedAt || response.invoicesGenerated
        ? 'FINALIZED'
        : response.status === 'LOCKED'
          ? 'DRAFT_LOCKED'
          : 'DRAFT_CALCULATED');
    const record: BillingRunRecord = existing
      ? {
          ...existing,
          draftId: response.id,
          status: existing.status === 'CANCELLED' ? existing.status : nextStatus,
          totalAmount: Number(response.finalizedAmount || response.totalAmount || 0),
          warningsCount: Number(response.warningsCount || 0),
          errorsCount: Number(response.errorsCount || 0),
          finalizedAt: response.finalizedAt || existing.finalizedAt,
          finalizedById: response.finalizedById || existing.finalizedById,
          invoicesCount: Number(response.invoicesCount || existing.invoicesCount || 0),
          updatedAt: now,
        }
      : {
          id: randomUUID(),
          associationId: organizationId,
          organizationId,
          billingMonth: response.billingMonth,
          status: nextStatus,
          currency: 'MDL',
          draftId: response.id,
          finalizedAt: response.finalizedAt || null,
          finalizedById: response.finalizedById || null,
          invoicesCount: Number(response.invoicesCount || 0),
          totalAmount: Number(response.finalizedAmount || response.totalAmount || 0),
          warningsCount: Number(response.warningsCount || 0),
          errorsCount: Number(response.errorsCount || 0),
          startedById: actorUserId,
          cancelledAt: null,
          cancelledById: null,
          cancellationReason: null,
          checks: [],
          createdAt: now,
          updatedAt: now,
        };
    const nextRuns = existing ? runs.map((run) => (run.id === existing.id ? record : run)) : [...runs, record];
    await this.writeBillingRuns(organizationId, actorUserId, nextRuns, client);
    return record;
  }

  private async billingRunForDraftAudit(organizationId: string, draft: BillingDraftRecord, client: any = this.prisma) {
    const runs = await this.readBillingRuns(organizationId, client);
    return runs.find((run) => run.draftId === draft.id) || this.findActiveBillingRun(runs, draft.billingMonth);
  }

  private draftAuditMetadata(draft: BillingDraftRecord, includeMeterCharges?: boolean) {
    return {
      billingMonth: draft.billingMonth,
      totalApartments: Number(draft.apartmentsCount || draft.items?.length || 0),
      totalAmount: Number(draft.totalAmount || 0),
      warningsCount: Number(draft.warningsCount || 0),
      errorsCount: Number(draft.errorsCount || 0),
      activeTariffsUsed: Array.isArray(draft.tariffsUsed) ? draft.tariffsUsed.length : 0,
      includeMeterCharges,
    };
  }

  private async auditDraftCalculated(
    organizationId: string,
    user: MvpUser,
    draft: BillingDraftRecord,
    billingRun: BillingRunRecord | null,
    recalculated: boolean,
    before?: BillingDraftRecord | null,
    includeMeterCharges?: boolean,
  ) {
    await this.audit
      .logDraftCalculated(
        {
          associationId: organizationId,
          actorUserId: user.id,
          actorRole: user.role,
          entityId: draft.id,
          billingRunId: billingRun?.id || null,
          invoiceDraftId: draft.id,
          message: recalculated
            ? `Draftul pentru ${draft.billingMonth} a fost recalculat: ${Number(draft.totalAmount || 0).toLocaleString('ro-RO')} MDL.`
            : `Draftul pentru ${draft.billingMonth} a fost calculat: ${Number(draft.totalAmount || 0).toLocaleString('ro-RO')} MDL.`,
          actionUrl: '/admin/billing-drafts?tab=invoices',
          metadata: this.draftAuditMetadata(draft, includeMeterCharges),
          beforeSnapshot: before
            ? {
                oldTotalAmount: Number(before.totalAmount || 0),
                oldWarningsCount: Number(before.warningsCount || 0),
                oldErrorsCount: Number(before.errorsCount || 0),
              }
            : null,
          afterSnapshot: {
            newTotalAmount: Number(draft.totalAmount || 0),
            newWarningsCount: Number(draft.warningsCount || 0),
            newErrorsCount: Number(draft.errorsCount || 0),
          },
        },
        recalculated,
      )
      .catch(() => undefined);
  }

  private preflightAuditSeverity(warningsCount: number, errorsCount: number) {
    if (errorsCount > 0) return 'ERROR' as const;
    if (warningsCount > 0) return 'WARNING' as const;
    return 'SUCCESS' as const;
  }

  private async readInternalInvoiceMetadata(organizationId: string, client: any = this.prisma): Promise<InternalInvoiceMetadata[]> {
    const note = await client.clientNote.findFirst({
      where: { organizationId, title: INTERNAL_INVOICE_NOTE_TITLE },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return [];
    try {
      const parsed = JSON.parse(note.content);
      return Array.isArray(parsed?.items) ? parsed.items : [];
    } catch {
      return [];
    }
  }

  private async writeInternalInvoiceMetadata(
    organizationId: string,
    actorUserId: string,
    invoices: InternalInvoiceMetadata[],
    client: any = this.prisma,
  ) {
    const payload = { version: 1, items: invoices };
    const existing = await client.clientNote.findFirst({
      where: { organizationId, title: INTERNAL_INVOICE_NOTE_TITLE },
      select: { id: true },
    });
    const content = JSON.stringify(payload);
    if (existing) {
      await client.clientNote.update({ where: { id: existing.id }, data: { content } });
    } else {
      await client.clientNote.create({
        data: {
          organizationId,
          createdByUserId: actorUserId,
          title: INTERNAL_INVOICE_NOTE_TITLE,
          content,
        },
      });
    }
  }

  private assertDraftMutable(draft: BillingDraftRecord) {
    if (draft.status === 'LOCKED') {
      throw new BadRequestException('Draftul este blocat și nu mai poate fi modificat.');
    }
    if (draft.status === 'CANCELLED') {
      throw new BadRequestException('Draftul este anulat și nu mai poate fi modificat.');
    }
  }

  private parseDraftLineStatus(value: unknown) {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (normalized === 'READY' || normalized === 'EXCLUDED') return normalized as 'READY' | 'EXCLUDED';
    throw new BadRequestException('Statusul liniei nu este valid.');
  }

  private parseManualAdjustmentPayload(body: unknown, isUpdate = false) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const manualTypeRaw = typeof payload.type === 'string' ? payload.type.trim().toUpperCase() : typeof payload.manualType === 'string' ? payload.manualType.trim().toUpperCase() : 'MANUAL_ADJUSTMENT';
    if (!['MANUAL_ADJUSTMENT', 'DISCOUNT', 'CORRECTION'].includes(manualTypeRaw)) {
      throw new BadRequestException('Tipul ajustării nu este valid.');
    }
    const manualType = manualTypeRaw as 'MANUAL_ADJUSTMENT' | 'DISCOUNT' | 'CORRECTION';
    const name = isUpdate && payload.name === undefined ? null : this.requiredString(payload.name, 'Numele ajustării este obligatoriu.');
    const amount = payload.amount === undefined && isUpdate ? null : this.requiredNumber(payload.amount, 'Suma ajustării trebuie să fie un număr.');
    if (amount !== null) {
      if (manualType === 'MANUAL_ADJUSTMENT' && amount <= 0) throw new BadRequestException('Suma ajustării manuale trebuie să fie pozitivă.');
      if ((manualType === 'DISCOUNT' || manualType === 'CORRECTION') && amount === 0) throw new BadRequestException('Suma ajustării trebuie să fie diferită de 0.');
    }
    const status = payload.status === undefined ? (isUpdate ? null : 'READY') : this.parseDraftLineStatus(payload.status);
    return {
      name,
      description: typeof payload.description === 'string' ? payload.description.trim() : undefined,
      amount: amount === null ? null : this.money(amount),
      manualType,
      status,
    };
  }

  private async draftOrganization(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, legalName: true, fiscalCode: true },
    });
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return {
      id: organization.id,
      shortName: organization.name,
      legalName: organization.legalName || organization.name,
      associationCode: organization.fiscalCode || '',
    };
  }

  private buildDraftChecklist(draft: BillingDraftRecord) {
    const response = this.draftResponse(draft) as BillingDraftRecord;
    const summary = response.summary || {};
    const totalAmount = Number(response.totalAmount || summary.totalAmount || 0);
    const errorsCount = Number(response.errorsCount || summary.errorsCount || 0);
    const warningsCount = Number(response.warningsCount || summary.warningsCount || 0);
    const tariffLinesCount = Number(summary.tariffLinesCount || 0);
    const apartmentsWithoutArea = Number(summary.apartmentsWithoutArea || 0);
    const activeTariffsUsed = Number(summary.activeTariffsUsed || 0);
    const canLock = errorsCount === 0 && totalAmount > 0 && tariffLinesCount > 0 && response.status === 'DRAFT';
    return {
      canLock,
      requiresWarningConfirmation: warningsCount > 0,
      items: [
        {
          key: 'ALL_APARTMENTS_REVIEWED',
          label: 'Toate apartamentele au fost verificate',
          status: response.items?.length ? 'COMPLETE' : 'BLOCKED',
        },
        {
          key: 'NO_CRITICAL_ERRORS',
          label: 'Nu există erori critice',
          status: errorsCount === 0 ? 'COMPLETE' : 'BLOCKED',
        },
        {
          key: 'MISSING_AREA_REVIEWED',
          label: 'Apartamentele fără suprafață au fost analizate',
          status: apartmentsWithoutArea === 0 ? 'COMPLETE' : 'WARNING',
        },
        {
          key: 'ACTIVE_TARIFFS_CONFIRMED',
          label: 'Tarifele active sunt corecte',
          status: activeTariffsUsed > 0 ? 'COMPLETE' : 'BLOCKED',
        },
        {
          key: 'MONTHLY_TOTAL_CONFIRMED',
          label: 'Totalul lunar pare corect',
          status: totalAmount > 0 ? 'COMPLETE' : 'BLOCKED',
        },
        {
          key: 'READY_TO_LOCK',
          label: 'Draftul este pregătit pentru blocare',
          status: canLock ? (warningsCount > 0 ? 'WARNING' : 'COMPLETE') : 'BLOCKED',
        },
      ],
    };
  }

  private async reviewPayload(draft: BillingDraftRecord) {
    const response = this.draftResponse(draft) as BillingDraftRecord;
    const [association, runs] = await Promise.all([
      this.draftOrganization(response.organizationId),
      this.readBillingRuns(response.organizationId),
    ]);
    const checklist = this.buildDraftChecklist(response);
    const billingRun = runs.find((run) => run.draftId === response.id) || this.findActiveBillingRun(runs, response.billingMonth);
    return {
      draft: {
        id: response.id,
        billingMonth: response.billingMonth,
        status: response.status,
        currency: response.currency,
        totalAmount: response.totalAmount || 0,
        includedAmount: response.includedAmount || 0,
        excludedAmount: response.excludedAmount || 0,
        apartmentsCount: response.apartmentsCount || 0,
        includedApartments: response.includedApartments || 0,
        excludedApartments: response.excludedApartments || 0,
        warningsCount: response.warningsCount || 0,
        errorsCount: response.errorsCount || 0,
        tariffLinesCount: Number(response.summary?.tariffLinesCount || 0),
        dueDate: response.dueDate,
        description: response.description,
        createdAt: response.createdAt,
        createdById: response.createdById,
        lockedAt: response.lockedAt || null,
        lockedById: response.lockedById || null,
        cancelledAt: response.cancelledAt || null,
        cancelledById: response.cancelledById || null,
        finalizedAt: response.finalizedAt || null,
        finalizedById: response.finalizedById || null,
        invoicesGenerated: Boolean(response.invoicesGenerated),
        invoicesCount: Number(response.invoicesCount || 0),
        finalizedAmount: Number(response.finalizedAmount || 0),
      },
      association,
      billingRun: billingRun
        ? {
            id: billingRun.id,
            billingMonth: billingRun.billingMonth,
            status: billingRun.status,
            warningsCount: billingRun.warningsCount,
            errorsCount: billingRun.errorsCount,
            actionUrl: `/admin/billing/runs/${billingRun.id}`,
          }
        : null,
      checklist: checklist.items,
      canLock: checklist.canLock,
      requiresWarningConfirmation: checklist.requiresWarningConfirmation,
      items: response.items || [],
      warnings: response.warnings || [],
      tariffsUsed: response.tariffsUsed || [],
    };
  }

  private billingRunSummaryFromData(input: {
    apartments: any[];
    tariffs: TariffRow[];
    meterPreview: any | null;
    checks: BillingRunCheck[];
    draft: BillingDraftRecord | null;
    finalInvoices: InternalInvoiceMetadata[];
    billingMonth: string;
  }) {
    const activeTariffs = input.tariffs.filter((tariff) => this.isTariffActiveForBillingMonth(tariff, input.billingMonth));
    const activeMeterTariffs = activeTariffs.filter((tariff) => tariff.calculationType === 'PER_METER_CONSUMPTION');
    const hasPerM2Tariffs = activeTariffs.some((tariff) => tariff.calculationType === 'PER_M2');
    const primaryMissing = input.apartments.filter((apartment) => !this.primaryContactFromApartment(apartment)).length;
    const areaMissing = hasPerM2Tariffs ? input.apartments.filter((apartment) => !apartment.areaM2 || Number(apartment.areaM2) <= 0).length : 0;
    const { warningsCount, errorsCount } = this.billingRunCounts(input.checks);
    return {
      totalApartments: input.apartments.length,
      apartmentsWithoutPrimaryContact: primaryMissing,
      apartmentsWithoutArea: areaMissing,
      activeTariffs: activeTariffs.length,
      activeMeterTariffs: activeMeterTariffs.length,
      approvedMeterReadings: Number(input.meterPreview?.periodReadings?.filter?.((reading: any) => reading.status === 'APPROVED')?.length || 0),
      missingMeterReadings: Number(input.meterPreview?.summary?.apartmentsWithoutApprovedReadings || 0),
      warningsCount,
      errorsCount,
      draftTotal: Number(input.draft?.totalAmount || 0),
      invoicesGenerated: input.finalInvoices.filter((invoice) => invoice.billingMonth === input.billingMonth).length,
    };
  }

  private billingRunTimeline(run: BillingRunRecord | null, summary: any, draft: BillingDraftRecord | null, finalInvoices: InternalInvoiceMetadata[]) {
    const runUrl = run ? `/admin/billing/runs/${run.id}` : '/admin/billing';
    const statusFor = (category: BillingRunCheckCategory) => {
      const checks = run?.checks?.filter((check) => check.category === category) || [];
      if (checks.some((check) => check.status === 'FAILED')) return 'ERROR';
      if (checks.some((check) => check.status === 'WARNING')) return 'WARNING';
      if (checks.some((check) => check.status === 'PASSED')) return 'COMPLETE';
      return 'PENDING';
    };
    return [
      {
        key: 'PRECHECK',
        label: 'Verificări inițiale',
        status: run ? (summary.errorsCount > 0 ? 'ERROR' : summary.warningsCount > 0 ? 'WARNING' : 'COMPLETE') : 'PENDING',
        description: run ? `${summary.warningsCount} avertizări, ${summary.errorsCount} erori` : 'Procesul lunar nu este pornit.',
        actionUrl: runUrl,
      },
      {
        key: 'APARTMENTS',
        label: 'Date apartamente',
        status: statusFor('APARTMENTS') === 'PENDING' ? (summary.totalApartments > 0 ? 'COMPLETE' : 'PENDING') : statusFor('APARTMENTS'),
        description: `${summary.totalApartments || 0} apartamente, ${summary.apartmentsWithoutArea || 0} fără suprafață`,
        actionUrl: '/admin/apartments',
      },
      {
        key: 'RESIDENTS',
        label: 'Locatari și contacte',
        status: statusFor('RESIDENTS'),
        description: `${summary.apartmentsWithoutPrimaryContact || 0} apartamente fără contact principal`,
        actionUrl: '/admin/residents',
      },
      {
        key: 'TARIFFS',
        label: 'Tarife',
        status: statusFor('TARIFFS'),
        description: `${summary.activeTariffs || 0} tarife active, ${summary.activeMeterTariffs || 0} pe consum`,
        actionUrl: '/admin/tariffs',
      },
      {
        key: 'METERS',
        label: 'Contoare și consum',
        status: summary.activeMeterTariffs > 0 ? statusFor('METERS') : 'PENDING',
        description: summary.activeMeterTariffs > 0 ? `${summary.approvedMeterReadings || 0} indici aprobați, ${summary.missingMeterReadings || 0} lipsă` : 'Nu există tarife active pe consum.',
        actionUrl: '/admin/meter-readings/reports',
      },
      {
        key: 'DRAFT',
        label: 'Calcul draft',
        status: draft ? 'COMPLETE' : 'PENDING',
        description: draft ? `Draft ${draft.status}, total ${Number(draft.totalAmount || 0).toLocaleString('ro-RO')} MDL` : 'Draftul nu este calculat.',
        actionUrl: '/admin/billing-drafts?tab=invoices',
      },
      {
        key: 'LOCK',
        label: 'Blocare draft',
        status: draft?.status === 'LOCKED' ? 'COMPLETE' : draft ? 'PENDING' : 'PENDING',
        description: draft?.status === 'LOCKED' ? 'Draftul este blocat.' : 'Disponibil după revizuire.',
        actionUrl: draft ? '/admin/billing-drafts?tab=invoices' : runUrl,
      },
      {
        key: 'FINALIZATION',
        label: 'Generare facturi finale',
        status: finalInvoices.length > 0 || draft?.invoicesGenerated ? 'COMPLETE' : 'PENDING',
        description: finalInvoices.length > 0 || draft?.invoicesGenerated ? `${finalInvoices.length || draft?.invoicesCount || 0} facturi generate` : 'Disponibil după blocarea draftului.',
        actionUrl: draft?.status === 'LOCKED' ? '/admin/billing-drafts?tab=invoices' : '/admin/invoices',
      },
    ];
  }

  private billingRunNextAction(run: BillingRunRecord | null, summary: any, draft: BillingDraftRecord | null, finalInvoices: InternalInvoiceMetadata[]) {
    if (!run) {
      return {
        key: 'START_RUN',
        label: 'Pornește proces lunar',
        description: 'Nu există proces de facturare pentru luna selectată.',
        actionUrl: '/admin/billing',
      };
    }
    if (run.status === 'CANCELLED') {
      return {
        key: 'CANCELLED',
        label: 'Proces anulat',
        description: 'Procesul lunar a fost anulat logic.',
        actionUrl: `/admin/billing/runs/${run.id}`,
      };
    }
    if (run.status === 'FINALIZED' || finalInvoices.length > 0 || draft?.invoicesGenerated) {
      return {
        key: 'VIEW_INVOICES',
        label: 'Vezi facturile generate',
        description: 'Procesul lunar este finalizat.',
        actionUrl: `/admin/invoices?billingMonth=${run.billingMonth}`,
      };
    }
    if (summary.errorsCount > 0) {
      return {
        key: 'RESOLVE_CRITICAL_ERRORS',
        label: 'Rezolvă problemele critice',
        description: 'Există verificări critice eșuate înainte de calcul.',
        actionUrl: `/admin/billing/runs/${run.id}`,
      };
    }
    if (!draft) {
      return {
        key: 'CALCULATE_DRAFT',
        label: 'Calculează draft',
        description: 'Verificările permit calculul draftului pentru luna selectată.',
        actionUrl: `/admin/billing/runs/${run.id}`,
      };
    }
    if (draft.status === 'DRAFT') {
      return {
        key: 'REVIEW_DRAFT',
        label: 'Revizuiește draftul',
        description: 'Draftul a fost calculat și trebuie verificat înainte de blocare.',
        actionUrl: '/admin/billing-drafts?tab=invoices',
      };
    }
    if (draft.status === 'LOCKED') {
      return {
        key: 'FINALIZE_INVOICES',
        label: 'Generează facturi finale',
        description: 'Draftul este blocat și poate fi convertit în facturi finale.',
        actionUrl: '/admin/billing-drafts?tab=invoices',
      };
    }
    return {
      key: 'RUN_PREFLIGHT',
      label: 'Rulează verificări',
      description: 'Actualizează verificările procesului lunar.',
      actionUrl: `/admin/billing/runs/${run.id}`,
    };
  }

  private async buildBillingRunPreflight(user: MvpUser, billingMonth: string, run: BillingRunRecord | null = null) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const { organization, apartments } = await this.invoiceDraftContext(organizationId);
    const [tariffs, drafts, invoices] = await Promise.all([
      this.readTariffRows(organizationId, apartments),
      this.readBillingDrafts(organizationId),
      this.readInternalInvoiceMetadata(organizationId),
    ]);
    const draft = this.draftForBillingRun(run, drafts, billingMonth);
    const finalInvoices = invoices.filter((invoice) => invoice.billingMonth === billingMonth && (!draft || invoice.sourceDraftId === draft.id));
    const activeTariffs = tariffs.filter((tariff) => this.isTariffActiveForBillingMonth(tariff, billingMonth));
    const activeMeterTariffs = activeTariffs.filter((tariff) => tariff.calculationType === 'PER_METER_CONSUMPTION');
    const hasPerM2Tariffs = activeTariffs.some((tariff) => tariff.calculationType === 'PER_M2');
    let meterPreview: any | null = null;
    if (activeMeterTariffs.length) {
      meterPreview = await this.buildMeterChargesPreview(user, { billingMonth, includeDraftLines: true, limit: 10000 }).catch(() => null);
    }

    const apartmentNumbers = new Map<string, number>();
    apartments.forEach((apartment: any) => {
      const key = `${apartment.staircase?.name || ''}:${apartment.number || ''}`.toLowerCase();
      apartmentNumbers.set(key, (apartmentNumbers.get(key) || 0) + 1);
    });
    const duplicateApartments = Array.from(apartmentNumbers.values()).filter((count) => count > 1).length;
    const apartmentsWithoutArea = hasPerM2Tariffs ? apartments.filter((apartment: any) => !apartment.areaM2 || Number(apartment.areaM2) <= 0).length : 0;
    const apartmentsWithoutPrimary = apartments.filter((apartment: any) => !this.primaryContactFromApartment(apartment)).length;
    const contactsWithoutReach = apartments.filter((apartment: any) => {
      const contact = this.primaryContactFromApartment(apartment);
      return contact && !contact.phone;
    }).length;
    const residentIds = new Set<string>();
    apartments.forEach((apartment: any) => {
      if (apartment.ownerResident?.id) residentIds.add(apartment.ownerResident.id);
      (apartment.apartmentResidents || []).forEach((relation: any) => {
        if (relation.resident?.id) residentIds.add(relation.resident.id);
      });
    });
    const invalidTariffs = activeTariffs.filter((tariff) => {
      if (tariff.calculationType === 'PER_M2') return Number(tariff.pricePerM2 || 0) <= 0;
      if (tariff.calculationType === 'FIXED_PER_APARTMENT') return Number(tariff.fixedAmount || 0) <= 0;
      if (tariff.calculationType === 'PER_METER_CONSUMPTION') return Number(tariff.pricePerUnit || 0) <= 0;
      return false;
    }).length;
    const missingMeterReadings = Number(meterPreview?.summary?.apartmentsWithoutApprovedReadings || 0);
    const needsReviewReadings = Number(meterPreview?.summary?.needsReviewReadings || 0);
    const rejectedReadings = Number(meterPreview?.summary?.rejectedReadings || 0);

    const checks: BillingRunCheck[] = [
      this.makeBillingRunCheck({
        key: 'ASSOCIATION_PRESENT',
        category: 'ASSOCIATION',
        label: 'APC disponibilă',
        status: organization ? 'PASSED' : 'FAILED',
        message: organization ? 'APC este disponibilă pentru facturare.' : 'APC nu a fost găsită.',
        actionUrl: '/admin/settings/organization',
      }),
      this.makeBillingRunCheck({
        key: 'ASSOCIATION_CODE',
        category: 'ASSOCIATION',
        label: 'Cod APC',
        status: organization.fiscalCode ? 'PASSED' : 'WARNING',
        severity: organization.fiscalCode ? 'INFO' : 'WARNING',
        message: organization.fiscalCode ? 'Codul APC este completat.' : 'Codul APC lipsește din profilul asociației.',
        actionUrl: '/admin/settings/organization',
      }),
      this.makeBillingRunCheck({
        key: 'ASSOCIATION_ACTIVE_STATUS',
        category: 'ASSOCIATION',
        label: 'Status APC',
        status: 'NOT_APPLICABLE',
        message: 'Schema curentă nu expune un câmp de status operațional pentru APC.',
        actionUrl: '/admin/settings/organization',
      }),
      this.makeBillingRunCheck({
        key: 'APARTMENTS_EXIST',
        category: 'APARTMENTS',
        label: 'Apartamente existente',
        status: apartments.length > 0 ? 'PASSED' : 'FAILED',
        message: apartments.length > 0 ? `Există ${apartments.length} apartamente.` : 'Nu există apartamente pentru această asociație.',
        actionUrl: '/admin/apartments',
      }),
      this.makeBillingRunCheck({
        key: 'APARTMENT_UNIQUE_NUMBERS',
        category: 'APARTMENTS',
        label: 'Numere apartamente unice',
        status: duplicateApartments > 0 ? 'WARNING' : 'PASSED',
        message: duplicateApartments > 0 ? `Există ${duplicateApartments} numere de apartamente duplicate pe aceeași scară.` : 'Numerele apartamentelor nu au duplicate evidente.',
        actionUrl: '/admin/apartments',
      }),
      this.makeBillingRunCheck({
        key: 'APARTMENT_AREAS',
        category: 'APARTMENTS',
        label: 'Suprafețe apartamente',
        status: hasPerM2Tariffs ? (apartmentsWithoutArea > 0 ? 'WARNING' : 'PASSED') : 'NOT_APPLICABLE',
        severity: apartmentsWithoutArea > 0 ? 'WARNING' : 'INFO',
        message: hasPerM2Tariffs
          ? apartmentsWithoutArea > 0
            ? `Există ${apartmentsWithoutArea} apartamente fără suprafață pentru tarife per m².`
            : 'Apartamentele au suprafețe pentru tarifele per m².'
          : 'Nu există tarife active per m² pentru această lună.',
        actionUrl: '/admin/apartments',
      }),
      this.makeBillingRunCheck({
        key: 'RESIDENTS_EXIST',
        category: 'RESIDENTS',
        label: 'Locatari/proprietari',
        status: residentIds.size > 0 ? 'PASSED' : 'WARNING',
        message: residentIds.size > 0 ? `Există ${residentIds.size} locatari/proprietari legați de apartamente.` : 'Nu există locatari/proprietari legați de apartamente.',
        actionUrl: '/admin/residents',
      }),
      this.makeBillingRunCheck({
        key: 'APARTMENTS_WITH_PRIMARY_CONTACT',
        category: 'RESIDENTS',
        label: 'Contacte principale',
        status: apartmentsWithoutPrimary > 0 ? 'WARNING' : 'PASSED',
        message: apartmentsWithoutPrimary > 0 ? `Există ${apartmentsWithoutPrimary} apartamente fără contact principal.` : 'Apartamentele au contact principal.',
        actionUrl: '/admin/apartments?hasPrimaryContact=false',
      }),
      this.makeBillingRunCheck({
        key: 'CONTACT_REACHABILITY',
        category: 'RESIDENTS',
        label: 'Date contact',
        status: contactsWithoutReach > 0 ? 'WARNING' : 'PASSED',
        message: contactsWithoutReach > 0 ? `Există ${contactsWithoutReach} contacte principale fără telefon.` : 'Contactele principale au telefon completat.',
        actionUrl: '/admin/residents',
      }),
      this.makeBillingRunCheck({
        key: 'ACTIVE_TARIFFS',
        category: 'TARIFFS',
        label: 'Tarife active',
        status: activeTariffs.length > 0 ? 'PASSED' : 'FAILED',
        message: activeTariffs.length > 0 ? `Există ${activeTariffs.length} tarife active pentru luna selectată.` : 'Nu există tarife active. Nu poți calcula draftul.',
        actionUrl: '/admin/tariffs',
      }),
      this.makeBillingRunCheck({
        key: 'TARIFF_VALUES',
        category: 'TARIFFS',
        label: 'Valori tarife',
        status: invalidTariffs > 0 ? 'FAILED' : activeTariffs.length ? 'PASSED' : 'NOT_APPLICABLE',
        message: invalidTariffs > 0 ? `Există ${invalidTariffs} tarife active cu valori nevalide.` : activeTariffs.length ? 'Tarifele active au valori pozitive.' : 'Nu există tarife active de verificat.',
        actionUrl: '/admin/tariffs',
      }),
      this.makeBillingRunCheck({
        key: 'METER_TARIFFS',
        category: 'METERS',
        label: 'Tarife pe consum',
        status: activeMeterTariffs.length > 0 ? 'PASSED' : 'NOT_APPLICABLE',
        message: activeMeterTariffs.length > 0 ? `Există ${activeMeterTariffs.length} tarife active pe consum.` : 'Nu există tarife pe consum active pentru luna selectată.',
        actionUrl: '/admin/tariffs/meter-based',
      }),
      this.makeBillingRunCheck({
        key: 'APPROVED_METER_READINGS',
        category: 'METERS',
        label: 'Indici aprobați',
        status: activeMeterTariffs.length ? (missingMeterReadings > 0 ? 'WARNING' : 'PASSED') : 'NOT_APPLICABLE',
        message: activeMeterTariffs.length
          ? missingMeterReadings > 0
            ? `Există ${missingMeterReadings} apartamente fără indici aprobați pentru luna ${billingMonth}.`
            : 'Indicii contoarelor sunt aprobați pentru tarifele pe consum.'
          : 'Nu sunt necesari indici pentru această lună.',
        actionUrl: '/admin/meter-readings/reports',
      }),
      this.makeBillingRunCheck({
        key: 'METER_READING_ISSUES',
        category: 'METERS',
        label: 'Indici cu probleme',
        status: activeMeterTariffs.length ? (needsReviewReadings || rejectedReadings ? 'WARNING' : 'PASSED') : 'NOT_APPLICABLE',
        message: activeMeterTariffs.length
          ? needsReviewReadings || rejectedReadings
            ? `Există ${needsReviewReadings} indici needs review și ${rejectedReadings} respinși.`
            : 'Nu există indici cu probleme pentru luna selectată.'
          : 'Nu sunt necesare verificări pentru indici.',
        actionUrl: '/admin/meter-readings',
      }),
      this.makeBillingRunCheck({
        key: 'DRAFT_EXISTS',
        category: 'DRAFT',
        label: 'Draft calculat',
        status: draft ? 'PASSED' : 'WARNING',
        severity: draft ? 'INFO' : 'WARNING',
        message: draft ? `Există draft ${draft.status} pentru luna ${billingMonth}.` : 'Draftul nu este calculat încă.',
        actionUrl: '/admin/billing-drafts?tab=invoices',
      }),
      this.makeBillingRunCheck({
        key: 'FINAL_INVOICES',
        category: 'FINALIZATION',
        label: 'Facturi finale',
        status: finalInvoices.length > 0 || draft?.invoicesGenerated ? 'PASSED' : 'WARNING',
        severity: finalInvoices.length > 0 || draft?.invoicesGenerated ? 'INFO' : 'WARNING',
        message: finalInvoices.length > 0 || draft?.invoicesGenerated
          ? `Există ${finalInvoices.length || draft?.invoicesCount || 0} facturi finale generate.`
          : 'Facturile finale nu sunt generate încă.',
        actionUrl: `/admin/invoices?billingMonth=${billingMonth}`,
      }),
    ];
    const summary = this.billingRunSummaryFromData({ apartments, tariffs, meterPreview, checks, draft, finalInvoices, billingMonth });
    return {
      association: {
        id: organization.id,
        shortName: organization.name,
        legalName: organization.legalName || organization.name,
        associationCode: organization.fiscalCode || '',
      },
      checks,
      summary,
      draft: draft ? this.draftResponse(draft) as BillingDraftRecord : null,
      finalInvoices,
    };
  }

  private billingRunDetailPayload(run: BillingRunRecord | null, association: any, summary: any, draft: BillingDraftRecord | null, finalInvoices: InternalInvoiceMetadata[]) {
    const hydratedRun = run
      ? {
          ...run,
          status: this.billingRunStatusFromState(run, draft, finalInvoices),
          draftId: draft?.id || run.draftId || null,
          totalAmount: Number(draft?.finalizedAmount || draft?.totalAmount || run.totalAmount || 0),
          invoicesCount: Number(finalInvoices.length || draft?.invoicesCount || run.invoicesCount || 0),
        }
      : null;
    const timeline = this.billingRunTimeline(hydratedRun, summary, draft, finalInvoices);
    const nextAction = this.billingRunNextAction(hydratedRun, summary, draft, finalInvoices);
    return {
      billingMonth: hydratedRun?.billingMonth || draft?.billingMonth || null,
      association,
      billingRun: hydratedRun,
      summary,
      timeline,
      checks: hydratedRun?.checks || [],
      draft: draft
        ? {
            id: draft.id,
            billingMonth: draft.billingMonth,
            status: draft.status,
            totalAmount: Number(draft.totalAmount || 0),
            warningsCount: Number(draft.warningsCount || 0),
            errorsCount: Number(draft.errorsCount || 0),
            lockedAt: draft.lockedAt || null,
            finalizedAt: draft.finalizedAt || null,
            invoicesGenerated: Boolean(draft.invoicesGenerated),
            invoicesCount: Number(draft.invoicesCount || 0),
          }
        : null,
      finalInvoices: {
        count: finalInvoices.length,
        totalAmount: this.money(finalInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0)),
      },
      nextAction,
    };
  }

  async getBillingOverview(user: MvpUser, query: Record<string, unknown>) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const billingMonth = this.parseBillingMonth(query.billingMonth || this.currentBillingMonth());
    const runs = await this.readBillingRuns(organizationId);
    const run = this.findActiveBillingRun(runs, billingMonth);
    const preflight = await this.buildBillingRunPreflight(user, billingMonth, run);
    if (!run) {
      const timeline = this.billingRunTimeline(null, preflight.summary, preflight.draft, preflight.finalInvoices);
      return {
        billingMonth,
        association: preflight.association,
        billingRun: null,
        summary: preflight.summary,
        timeline,
        checks: preflight.checks,
        nextAction: this.billingRunNextAction(null, preflight.summary, preflight.draft, preflight.finalInvoices),
      };
    }
    const displayRun = {
      ...run,
      checks: preflight.checks,
      warningsCount: preflight.summary.warningsCount,
      errorsCount: preflight.summary.errorsCount,
      draftId: preflight.draft?.id || run.draftId,
      totalAmount: Number(preflight.draft?.totalAmount || run.totalAmount || 0),
      invoicesCount: Number(preflight.finalInvoices.length || preflight.draft?.invoicesCount || run.invoicesCount || 0),
    };
    return {
      ...this.billingRunDetailPayload(displayRun, preflight.association, preflight.summary, preflight.draft, preflight.finalInvoices),
      billingMonth,
    };
  }

  async listBillingRuns(user: MvpUser, query: Record<string, unknown>) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const page = Math.max(1, Number(query.page || 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20) || 20));
    const status = query.status ? this.parseBillingRunStatus(query.status, 'PRECHECK') : null;
    const billingMonth = query.billingMonth ? this.parseBillingMonth(query.billingMonth) : null;
    const drafts = await this.readBillingDrafts(organizationId);
    const invoices = await this.readInternalInvoiceMetadata(organizationId);
    let runs = await this.readBillingRuns(organizationId);
    runs = runs.map((run) => {
      const draft = this.draftForBillingRun(run, drafts, run.billingMonth);
      const finalInvoices = invoices.filter((invoice) => invoice.billingMonth === run.billingMonth && (!draft || invoice.sourceDraftId === draft.id));
      return {
        ...run,
        status: this.billingRunStatusFromState(run, draft, finalInvoices),
        draftId: draft?.id || run.draftId || null,
        totalAmount: Number(draft?.finalizedAmount || draft?.totalAmount || run.totalAmount || 0),
        invoicesCount: Number(finalInvoices.length || draft?.invoicesCount || run.invoicesCount || 0),
      };
    });
    if (status) runs = runs.filter((run) => run.status === status);
    if (billingMonth) runs = runs.filter((run) => run.billingMonth === billingMonth);
    if (query.dateFrom) runs = runs.filter((run) => new Date(run.createdAt).getTime() >= new Date(String(query.dateFrom)).getTime());
    if (query.dateTo) runs = runs.filter((run) => new Date(run.createdAt).getTime() <= new Date(String(query.dateTo)).getTime());
    const direction = String(query.sortDirection || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    const sortBy = String(query.sortBy || 'updatedAt');
    runs.sort((left: any, right: any) => {
      const a = sortBy === 'billingMonth' ? left.billingMonth : left.updatedAt;
      const b = sortBy === 'billingMonth' ? right.billingMonth : right.updatedAt;
      return String(a).localeCompare(String(b)) * direction;
    });
    const start = (page - 1) * limit;
    return {
      items: runs.slice(start, start + limit),
      meta: { page, limit, total: runs.length },
    };
  }

  async createBillingRun(user: MvpUser, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const billingMonth = this.parseBillingMonth(payload.billingMonth || this.currentBillingMonth());
    const runs = await this.readBillingRuns(organizationId);
    const existing = this.findActiveBillingRun(runs, billingMonth);
    if (existing) throw new ConflictException('Există deja un proces activ pentru această lună.');
    const now = new Date().toISOString();
    const run: BillingRunRecord = {
      id: randomUUID(),
      associationId: organizationId,
      organizationId,
      billingMonth,
      status: 'PRECHECK',
      currency: 'MDL',
      draftId: null,
      finalizedAt: null,
      finalizedById: null,
      invoicesCount: 0,
      totalAmount: 0,
      warningsCount: 0,
      errorsCount: 0,
      startedById: user.id,
      cancelledAt: null,
      cancelledById: null,
      cancellationReason: null,
      checks: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.writeBillingRuns(organizationId, user.id, [...runs, run]);
    await this.audit
      .logBillingRunCreated({
        associationId: organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        entityId: run.id,
        billingRunId: run.id,
        message: `Procesul de facturare pentru ${billingMonth} a fost pornit.`,
        actionUrl: `/admin/billing/runs/${run.id}`,
        metadata: { billingMonth, status: run.status },
      })
      .catch(() => undefined);
    return this.runBillingRunPreflight(user, run.id);
  }

  async getBillingRun(user: MvpUser, id: string) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const runs = await this.readBillingRuns(organizationId);
    const run = runs.find((item) => item.id === id);
    if (!run) throw new NotFoundException('Procesul de facturare nu a fost găsit.');
    const preflight = await this.buildBillingRunPreflight(user, run.billingMonth, run);
    const displayRun = {
      ...run,
      checks: preflight.checks,
      warningsCount: preflight.summary.warningsCount,
      errorsCount: preflight.summary.errorsCount,
      draftId: preflight.draft?.id || run.draftId,
      totalAmount: Number(preflight.draft?.totalAmount || run.totalAmount || 0),
      invoicesCount: Number(preflight.finalInvoices.length || preflight.draft?.invoicesCount || run.invoicesCount || 0),
    };
    return this.billingRunDetailPayload(displayRun, preflight.association, preflight.summary, preflight.draft, preflight.finalInvoices);
  }

  async updateBillingRun(user: MvpUser, id: string, body: unknown) {
    return this.updateBillingRunStatus(user, id, body);
  }

  async runBillingRunPreflight(user: MvpUser, id: string) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const runs = await this.readBillingRuns(organizationId);
    const run = runs.find((item) => item.id === id);
    if (!run) throw new NotFoundException('Procesul de facturare nu a fost găsit.');
    if (run.status === 'CANCELLED' || run.status === 'FINALIZED') throw new BadRequestException('Procesul nu mai poate rula verificări.');
    const preflight = await this.buildBillingRunPreflight(user, run.billingMonth, run);
    const { warningsCount, errorsCount } = this.billingRunCounts(preflight.checks);
    const status = preflight.draft
      ? this.billingRunStatusFromState(run, preflight.draft, preflight.finalInvoices)
      : errorsCount > 0
        ? 'PRECHECK'
        : 'READY_FOR_DRAFT';
    const updated: BillingRunRecord = {
      ...run,
      status,
      checks: preflight.checks,
      warningsCount,
      errorsCount,
      draftId: preflight.draft?.id || run.draftId || null,
      totalAmount: Number(preflight.draft?.totalAmount || run.totalAmount || 0),
      invoicesCount: Number(preflight.finalInvoices.length || preflight.draft?.invoicesCount || run.invoicesCount || 0),
      updatedAt: new Date().toISOString(),
    };
    await this.writeBillingRuns(organizationId, user.id, runs.map((item) => (item.id === id ? updated : item)));
    await this.audit
      .logBillingRunPrecheckRun({
        associationId: organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        entityId: updated.id,
        billingRunId: updated.id,
        severity: this.preflightAuditSeverity(warningsCount, errorsCount),
        message: `Verificările inițiale pentru ${updated.billingMonth} au fost rulate: ${warningsCount} warnings, ${errorsCount} errors.`,
        actionUrl: `/admin/billing/runs/${updated.id}`,
        metadata: {
          billingMonth: updated.billingMonth,
          warningsCount,
          errorsCount,
          checks: preflight.checks.map((check) => ({
            key: check.key,
            status: check.status,
            severity: check.severity,
          })),
        },
      })
      .catch(() => undefined);
    return this.billingRunDetailPayload(updated, preflight.association, preflight.summary, preflight.draft, preflight.finalInvoices);
  }

  async calculateBillingRunDraft(user: MvpUser, id: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const runs = await this.readBillingRuns(organizationId);
    const run = runs.find((item) => item.id === id);
    if (!run) throw new NotFoundException('Procesul de facturare nu a fost găsit.');
    if (run.status === 'CANCELLED' || run.status === 'FINALIZED') throw new BadRequestException('Procesul nu permite calculul draftului.');
    const preflight = await this.buildBillingRunPreflight(user, run.billingMonth, run);
    const { errorsCount } = this.billingRunCounts(preflight.checks);
    if (errorsCount > 0) throw new BadRequestException('Rezolvă problemele critice înainte de calcularea draftului.');
    const drafts = await this.readBillingDrafts(organizationId);
    const existing = this.draftForBillingRun(run, drafts, run.billingMonth);
    if (existing) this.assertDraftMutable(existing);
    const input = this.parseDraftPayload({
      billingMonth: run.billingMonth,
      dueDate: payload.dueDate || null,
      description: payload.description || `Facturare lunară ${run.billingMonth}`,
      includeMeterCharges: payload.includeMeterCharges === false ? false : true,
    });
    const calculated = await this.calculateDraftRecord(user, input, existing);
    const nextDrafts = existing ? drafts.map((draft) => (draft.id === existing.id ? calculated : draft)) : [...drafts, calculated];
    await this.writeBillingDrafts(organizationId, user.id, nextDrafts);
    const syncedRun = await this.syncBillingRunForDraft(organizationId, user.id, calculated, 'DRAFT_CALCULATED');
    await this.auditDraftCalculated(organizationId, user, calculated, syncedRun, Boolean(existing), existing, input.includeMeterCharges);
    const freshPreflight = await this.buildBillingRunPreflight(user, run.billingMonth, syncedRun);
    return this.billingRunDetailPayload(syncedRun, freshPreflight.association, freshPreflight.summary, freshPreflight.draft, freshPreflight.finalInvoices);
  }

  async linkBillingRunDraft(user: MvpUser, id: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const draftId = typeof payload.draftId === 'string' && payload.draftId.trim() ? payload.draftId.trim() : '';
    if (!draftId) throw new BadRequestException('draftId este obligatoriu.');
    const [runs, drafts] = await Promise.all([this.readBillingRuns(organizationId), this.readBillingDrafts(organizationId)]);
    const run = runs.find((item) => item.id === id);
    if (!run) throw new NotFoundException('Procesul de facturare nu a fost găsit.');
    const draft = drafts.find((item) => item.id === draftId && item.status !== 'CANCELLED');
    if (!draft || draft.billingMonth !== run.billingMonth) throw new NotFoundException('Draftul nu aparține lunii procesului.');
    const updated = { ...run, draftId: draft.id, status: this.billingRunStatusFromState(run, draft), totalAmount: Number(draft.totalAmount || 0), updatedAt: new Date().toISOString() };
    await this.writeBillingRuns(organizationId, user.id, runs.map((item) => (item.id === id ? updated : item)));
    return this.getBillingRun(user, id);
  }

  async updateBillingRunStatus(user: MvpUser, id: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const requestedStatus = this.parseBillingRunStatus(payload.status);
    if (!['PRECHECK', 'READY_FOR_DRAFT', 'DRAFT_CALCULATED', 'IN_REVIEW', 'DRAFT_LOCKED'].includes(requestedStatus)) {
      throw new BadRequestException('Statusul procesului nu poate fi setat manual.');
    }
    const runs = await this.readBillingRuns(organizationId);
    const run = runs.find((item) => item.id === id);
    if (!run) throw new NotFoundException('Procesul de facturare nu a fost găsit.');
    if (run.status === 'CANCELLED' || run.status === 'FINALIZED') throw new BadRequestException('Procesul nu mai poate fi modificat.');
    const updated = { ...run, status: requestedStatus, updatedAt: new Date().toISOString() };
    await this.writeBillingRuns(organizationId, user.id, runs.map((item) => (item.id === id ? updated : item)));
    await this.audit
      .logBillingRunStatusChanged({
        associationId: organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        entityId: updated.id,
        billingRunId: updated.id,
        severity: 'INFO',
        message: `Statusul procesului ${updated.billingMonth} a fost schimbat din ${run.status} în ${requestedStatus}.`,
        actionUrl: `/admin/billing/runs/${updated.id}`,
        metadata: { billingMonth: updated.billingMonth, oldStatus: run.status, newStatus: requestedStatus },
        beforeSnapshot: { status: run.status },
        afterSnapshot: { status: requestedStatus },
      })
      .catch(() => undefined);
    return this.getBillingRun(user, id);
  }

  async cancelBillingRun(user: MvpUser, id: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const reason = this.requiredString(payload.cancellationReason || payload.reason, 'Motivul anulării este obligatoriu.');
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const runs = await this.readBillingRuns(organizationId);
    const run = runs.find((item) => item.id === id);
    if (!run) throw new NotFoundException('Procesul de facturare nu a fost găsit.');
    if (run.status === 'FINALIZED' || run.finalizedAt || run.invoicesCount > 0) throw new BadRequestException('Procesul finalizat nu poate fi anulat.');
    const updated: BillingRunRecord = {
      ...run,
      status: 'CANCELLED',
      cancelledAt: new Date().toISOString(),
      cancelledById: user.id,
      cancellationReason: reason,
      updatedAt: new Date().toISOString(),
    };
    await this.writeBillingRuns(organizationId, user.id, runs.map((item) => (item.id === id ? updated : item)));
    await this.audit
      .createLog({
        associationId: organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        action: 'BILLING_RUN_CANCELLED',
        entityType: 'BILLING_RUN',
        entityId: updated.id,
        billingRunId: updated.id,
        severity: 'WARNING',
        title: 'Proces lunar anulat',
        message: `Procesul de facturare pentru ${updated.billingMonth} a fost anulat.`,
        actionUrl: `/admin/billing/runs/${updated.id}`,
        metadata: { billingMonth: updated.billingMonth, cancellationReason: reason },
        beforeSnapshot: { status: run.status },
        afterSnapshot: { status: updated.status, cancellationReason: reason },
      })
      .catch(() => undefined);
    return { success: true, billingRun: updated, message: 'Procesul lunar a fost anulat.' };
  }

  async getBillingRunChecks(user: MvpUser, id: string) {
    const detail = await this.getBillingRun(user, id);
    return { items: detail.checks || [] };
  }

  private async auditAssociationPayload(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, legalName: true, fiscalCode: true, address: true },
    });
    return organization
      ? {
          id: organization.id,
          shortName: organization.name,
          legalName: organization.legalName || organization.name,
          associationCode: organization.fiscalCode || '',
          address: organization.address || '',
        }
      : null;
  }

  async listAdminAuditLog(user: MvpUser, query: Record<string, unknown>) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const [result, association] = await Promise.all([this.audit.listAdminAuditLog(organizationId, query), this.auditAssociationPayload(organizationId)]);
    return { ...result, association };
  }

  async getAdminAuditLog(user: MvpUser, id: string) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    return this.audit.getAdminAuditLog(organizationId, id);
  }

  async getAdminAuditLogStats(user: MvpUser, query: Record<string, unknown>) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    return this.audit.getAdminAuditLogStats(organizationId, query);
  }

  async getBillingRunActivity(user: MvpUser, id: string, query: Record<string, unknown>, recentLimit?: number) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const runs = await this.readBillingRuns(organizationId);
    const run = runs.find((item) => item.id === id);
    if (!run) throw new NotFoundException('Procesul de facturare nu a fost găsit.');
    const [result, association] = await Promise.all([this.audit.listBillingRunActivity(organizationId, id, query, recentLimit), this.auditAssociationPayload(organizationId)]);
    return {
      ...result,
      association,
      billingRun: {
        id: run.id,
        billingMonth: run.billingMonth,
        status: run.status,
        warningsCount: run.warningsCount,
        errorsCount: run.errorsCount,
        updatedAt: run.updatedAt,
      },
    };
  }

  async getInvoiceDraft(user: MvpUser, query: Record<string, unknown>) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const billingMonth = this.parseBillingMonth(query.billingMonth);
    const drafts = await this.readBillingDrafts(organizationId);
    const draft = drafts.find((item) => item.billingMonth === billingMonth && item.status !== 'CANCELLED') || null;
    return { draft: draft ? this.draftResponse(draft) : null, billingMonth };
  }

  async getInvoiceDraftById(user: MvpUser, id: string) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const draft = drafts.find((item) => item.id === id);
    if (!draft) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return this.draftResponse(draft);
  }

  async getInvoiceDraftReview(user: MvpUser, id: string) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const draft = drafts.find((item) => item.id === id);
    if (!draft) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return this.reviewPayload(draft);
  }

  async calculateInvoiceDraft(user: MvpUser, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const input = this.parseDraftPayload(payload);
    return this.calculateDraftRecord(user, input);
  }

  async saveInvoiceDraft(user: MvpUser, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const input = this.parseDraftPayload(payload);
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const existing = drafts.find((draft) => draft.billingMonth === input.billingMonth && draft.status !== 'CANCELLED') || null;
    if (existing) this.assertDraftMutable(existing);
    const calculated = await this.calculateDraftRecord(user, input, existing);
    const nextDrafts = existing ? drafts.map((draft) => (draft.id === existing.id ? calculated : draft)) : [...drafts, calculated];
    await this.writeBillingDrafts(organizationId, user.id, nextDrafts);
    const syncedRun = await this.syncBillingRunForDraft(organizationId, user.id, calculated, 'DRAFT_CALCULATED');
    await this.auditDraftCalculated(organizationId, user, calculated, syncedRun, Boolean(existing), existing, input.includeMeterCharges);
    return this.draftResponse(calculated);
  }

  async recalculateInvoiceDraft(user: MvpUser, id: string, body: unknown) {
    const organizationId = this.resolveOrganizationId(user, body && typeof body === 'object' ? (body as Record<string, unknown>) : {});
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const existing = drafts.find((draft) => draft.id === id && draft.status !== 'CANCELLED');
    if (!existing) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertDraftMutable(existing);
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const input = this.parseDraftPayload({
      billingMonth: payload.billingMonth || existing.billingMonth,
      dueDate: payload.dueDate === undefined ? existing.dueDate : payload.dueDate,
      description: payload.description === undefined ? existing.description : payload.description,
    });
    const calculated = await this.calculateDraftRecord(user, input, existing);
    const nextDrafts = drafts.map((draft) => (draft.id === id ? calculated : draft));
    await this.writeBillingDrafts(organizationId, user.id, nextDrafts);
    const syncedRun = await this.syncBillingRunForDraft(organizationId, user.id, calculated, 'DRAFT_CALCULATED');
    await this.auditDraftCalculated(organizationId, user, calculated, syncedRun, true, existing, input.includeMeterCharges);
    return this.draftResponse(calculated);
  }

  async updateInvoiceDraftLineStatus(user: MvpUser, id: string, lineId: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const statusValue = this.parseDraftLineStatus(payload.status);
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const draft = drafts.find((item) => item.id === id);
    if (!draft) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertDraftMutable(draft);
    let changed = false;
    const updatedItems = draft.items.map((item) => {
      if (item.id === lineId || item.apartmentId === lineId) {
        changed = true;
        const lines = item.lines.map((line) => ({
          ...line,
          status: statusValue === 'EXCLUDED' ? 'EXCLUDED' as BillingDraftLineStatus : this.restoreDraftLineStatus(line),
          excludedAt: statusValue === 'EXCLUDED' ? new Date().toISOString() : null,
          excludedById: statusValue === 'EXCLUDED' ? user.id : null,
        }));
        return this.recomputeDraftItem({ ...item, lines, status: statusValue as BillingDraftLineStatus });
      }
      const updatedLines = item.lines.map((line) => {
        if (line.id !== lineId) return line;
        changed = true;
        return {
          ...line,
          status: statusValue === 'EXCLUDED' ? 'EXCLUDED' as BillingDraftLineStatus : this.restoreDraftLineStatus(line),
          excludedAt: statusValue === 'EXCLUDED' ? new Date().toISOString() : null,
          excludedById: statusValue === 'EXCLUDED' ? user.id : null,
        };
      });
      return this.recomputeDraftItem({ ...item, lines: updatedLines });
    });
    if (!changed) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const updatedDraft = this.draftResponse({ ...draft, items: updatedItems, updatedAt: new Date().toISOString() }) as BillingDraftRecord;
    const nextDrafts = drafts.map((item) => (item.id === id ? updatedDraft : item));
    await this.writeBillingDrafts(organizationId, user.id, nextDrafts);
    const billingRun = await this.billingRunForDraftAudit(organizationId, updatedDraft);
    await this.audit
      .createLog({
        associationId: organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        action: statusValue === 'EXCLUDED' ? 'DRAFT_LINE_EXCLUDED' : 'DRAFT_LINE_INCLUDED',
        entityType: 'INVOICE_DRAFT_LINE',
        entityId: lineId,
        billingRunId: billingRun?.id || null,
        invoiceDraftId: updatedDraft.id,
        title: statusValue === 'EXCLUDED' ? 'Linie draft exclusă' : 'Linie draft inclusă',
        message: statusValue === 'EXCLUDED' ? 'O linie din draft a fost exclusă din calcul.' : 'O linie din draft a fost inclusă în calcul.',
        severity: statusValue === 'EXCLUDED' ? 'WARNING' : 'INFO',
        actionUrl: '/admin/billing-drafts?tab=invoices',
        metadata: { billingMonth: updatedDraft.billingMonth, lineId, status: statusValue, scope: 'LINE_OR_ITEM' },
      })
      .catch(() => undefined);
    return this.draftResponse(updatedDraft);
  }

  async updateInvoiceDraftApartmentStatus(user: MvpUser, id: string, apartmentId: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const statusValue = this.parseDraftLineStatus(payload.status);
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const draft = drafts.find((item) => item.id === id);
    if (!draft) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertDraftMutable(draft);
    let changed = false;
    const updatedItems = draft.items.map((item) => {
      if (item.apartmentId !== apartmentId && item.id !== apartmentId) return item;
      changed = true;
      const lines = item.lines.map((line) => ({
        ...line,
        status: statusValue === 'EXCLUDED' ? 'EXCLUDED' as BillingDraftLineStatus : this.restoreDraftLineStatus(line),
        excludedAt: statusValue === 'EXCLUDED' ? new Date().toISOString() : null,
        excludedById: statusValue === 'EXCLUDED' ? user.id : null,
      }));
      return this.recomputeDraftItem({ ...item, lines, status: statusValue as BillingDraftLineStatus });
    });
    if (!changed) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const updatedDraft = this.draftResponse({ ...draft, items: updatedItems, updatedAt: new Date().toISOString() }) as BillingDraftRecord;
    const nextDrafts = drafts.map((item) => (item.id === id ? updatedDraft : item));
    await this.writeBillingDrafts(organizationId, user.id, nextDrafts);
    const billingRun = await this.billingRunForDraftAudit(organizationId, updatedDraft);
    await this.audit
      .createLog({
        associationId: organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        action: statusValue === 'EXCLUDED' ? 'DRAFT_LINE_EXCLUDED' : 'DRAFT_LINE_INCLUDED',
        entityType: 'INVOICE_DRAFT_LINE',
        entityId: apartmentId,
        billingRunId: billingRun?.id || null,
        invoiceDraftId: updatedDraft.id,
        apartmentId,
        title: statusValue === 'EXCLUDED' ? 'Apartament exclus din draft' : 'Apartament inclus în draft',
        message: statusValue === 'EXCLUDED' ? 'Liniile apartamentului au fost excluse din calcul.' : 'Liniile apartamentului au fost incluse în calcul.',
        severity: statusValue === 'EXCLUDED' ? 'WARNING' : 'INFO',
        actionUrl: '/admin/billing-drafts?tab=invoices',
        metadata: { billingMonth: updatedDraft.billingMonth, apartmentId, status: statusValue, scope: 'APARTMENT' },
      })
      .catch(() => undefined);
    return this.reviewPayload(updatedDraft);
  }

  async addInvoiceDraftAdjustment(user: MvpUser, id: string, apartmentId: string, body: unknown) {
    const input = this.parseManualAdjustmentPayload(body);
    const organizationId = this.resolveOrganizationId(user, body && typeof body === 'object' ? (body as Record<string, unknown>) : {});
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const draft = drafts.find((item) => item.id === id);
    if (!draft) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertDraftMutable(draft);
    let changed = false;
    const line: BillingDraftLine = {
      id: `manual:${randomUUID()}`,
      lineType: 'ADJUSTMENT',
      tariffId: null,
      isManual: true,
      manualType: input.manualType,
      name: input.name || 'Ajustare manuală',
      description: input.description || '',
      calculationType: 'MANUAL',
      quantity: 1,
      unitPrice: Number(input.amount || 0),
      amount: Number(input.amount || 0),
      currency: 'MDL',
      formulaLabel: `Ajustare manuală: ${Number(input.amount || 0).toLocaleString('ro-RO')} MDL`,
      status: input.status || 'READY',
      warnings: [],
      excludedAt: input.status === 'EXCLUDED' ? new Date().toISOString() : null,
      excludedById: input.status === 'EXCLUDED' ? user.id : null,
      exclusionReason: null,
    };
    const updatedItems = draft.items.map((item) => {
      if (item.apartmentId !== apartmentId && item.id !== apartmentId) return item;
      changed = true;
      return this.recomputeDraftItem({ ...item, lines: [...item.lines, line] });
    });
    if (!changed) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const updatedDraft = this.draftResponse({ ...draft, items: updatedItems, updatedAt: new Date().toISOString() }) as BillingDraftRecord;
    await this.writeBillingDrafts(organizationId, user.id, drafts.map((item) => (item.id === id ? updatedDraft : item)));
    const billingRun = await this.billingRunForDraftAudit(organizationId, updatedDraft);
    await this.audit
      .createLog({
        associationId: organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        action: 'DRAFT_MANUAL_ADJUSTMENT_ADDED',
        entityType: 'INVOICE_DRAFT_LINE',
        entityId: line.id,
        billingRunId: billingRun?.id || null,
        invoiceDraftId: updatedDraft.id,
        apartmentId,
        title: 'Ajustare manuală adăugată',
        message: `A fost adăugată ajustarea manuală "${line.name}" în valoare de ${this.money(line.amount).toLocaleString('ro-RO')} MDL.`,
        severity: 'INFO',
        actionUrl: '/admin/billing-drafts?tab=invoices',
        metadata: { billingMonth: updatedDraft.billingMonth, lineId: line.id, apartmentId, amount: line.amount, type: line.manualType, name: line.name },
      })
      .catch(() => undefined);
    return this.reviewPayload(updatedDraft);
  }

  async updateInvoiceDraftAdjustment(user: MvpUser, id: string, lineId: string, body: unknown) {
    const input = this.parseManualAdjustmentPayload(body, true);
    const organizationId = this.resolveOrganizationId(user, body && typeof body === 'object' ? (body as Record<string, unknown>) : {});
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const draft = drafts.find((item) => item.id === id);
    if (!draft) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertDraftMutable(draft);
    let changed = false;
    let beforeLine: BillingDraftLine | null = null;
    let afterLine: BillingDraftLine | null = null;
    const updatedItems = draft.items.map((item) => {
      const updatedLines = item.lines.map((line) => {
        if (line.id !== lineId) return line;
        if (!line.isManual) throw new BadRequestException('Doar ajustările manuale pot fi editate.');
        changed = true;
        beforeLine = { ...line };
        const amount = input.amount === null ? line.amount : input.amount;
        const status = input.status || line.status;
        afterLine = {
          ...line,
          name: input.name || line.name,
          description: input.description === undefined ? line.description : input.description,
          manualType: input.manualType || line.manualType,
          unitPrice: amount,
          amount,
          formulaLabel: `Ajustare manuală: ${amount.toLocaleString('ro-RO')} MDL`,
          status,
          excludedAt: status === 'EXCLUDED' ? (line.excludedAt || new Date().toISOString()) : null,
          excludedById: status === 'EXCLUDED' ? (line.excludedById || user.id) : null,
        };
        return afterLine;
      });
      return this.recomputeDraftItem({ ...item, lines: updatedLines });
    });
    if (!changed) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const updatedDraft = this.draftResponse({ ...draft, items: updatedItems, updatedAt: new Date().toISOString() }) as BillingDraftRecord;
    await this.writeBillingDrafts(organizationId, user.id, drafts.map((item) => (item.id === id ? updatedDraft : item)));
    const billingRun = await this.billingRunForDraftAudit(organizationId, updatedDraft);
    await this.audit
      .createLog({
        associationId: organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        action: 'DRAFT_MANUAL_ADJUSTMENT_UPDATED',
        entityType: 'INVOICE_DRAFT_LINE',
        entityId: lineId,
        billingRunId: billingRun?.id || null,
        invoiceDraftId: updatedDraft.id,
        title: 'Ajustare manuală actualizată',
        message: 'O ajustare manuală din draft a fost actualizată.',
        severity: 'INFO',
        actionUrl: '/admin/billing-drafts?tab=invoices',
        metadata: { billingMonth: updatedDraft.billingMonth, lineId, amount: afterLine?.amount },
        beforeSnapshot: beforeLine,
        afterSnapshot: afterLine,
      })
      .catch(() => undefined);
    return this.reviewPayload(updatedDraft);
  }

  async deleteInvoiceDraftAdjustment(user: MvpUser, id: string, lineId: string) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const draft = drafts.find((item) => item.id === id);
    if (!draft) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertDraftMutable(draft);
    let found = false;
    let removedLine: BillingDraftLine | null = null;
    let removedApartmentId: string | null = null;
    const updatedItems = draft.items.map((item) => {
      const line = item.lines.find((candidate) => candidate.id === lineId);
      if (!line) return item;
      if (!line.isManual) throw new BadRequestException('Liniile generate din tarife nu pot fi șterse.');
      found = true;
      removedLine = line;
      removedApartmentId = item.apartmentId;
      return this.recomputeDraftItem({ ...item, lines: item.lines.filter((candidate) => candidate.id !== lineId) });
    });
    if (!found) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const updatedDraft = this.draftResponse({ ...draft, items: updatedItems, updatedAt: new Date().toISOString() }) as BillingDraftRecord;
    await this.writeBillingDrafts(organizationId, user.id, drafts.map((item) => (item.id === id ? updatedDraft : item)));
    const billingRun = await this.billingRunForDraftAudit(organizationId, updatedDraft);
    await this.audit
      .createLog({
        associationId: organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        action: 'DRAFT_MANUAL_ADJUSTMENT_REMOVED',
        entityType: 'INVOICE_DRAFT_LINE',
        entityId: lineId,
        billingRunId: billingRun?.id || null,
        invoiceDraftId: updatedDraft.id,
        apartmentId: removedApartmentId,
        title: 'Ajustare manuală eliminată',
        message: 'O ajustare manuală din draft a fost eliminată.',
        severity: 'WARNING',
        actionUrl: '/admin/billing-drafts?tab=invoices',
        metadata: { billingMonth: updatedDraft.billingMonth, lineId, apartmentId: removedApartmentId, amount: removedLine?.amount, name: removedLine?.name },
        beforeSnapshot: removedLine,
      })
      .catch(() => undefined);
    return this.reviewPayload(updatedDraft);
  }

  async recalculateInvoiceDraftApartment(user: MvpUser, id: string, apartmentId: string) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const draft = drafts.find((item) => item.id === id);
    if (!draft) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertDraftMutable(draft);
    const recalculated = await this.calculateDraftRecord(
      user,
      { billingMonth: draft.billingMonth, dueDate: draft.dueDate || null, description: draft.description || '' },
      draft,
    );
    const freshItem = recalculated.items.find((item) => item.apartmentId === apartmentId || item.id === apartmentId);
    if (!freshItem) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const currentItem = draft.items.find((item) => item.apartmentId === apartmentId || item.id === apartmentId);
    const manualLines = (currentItem?.lines || []).filter((line) => line.isManual);
    const nextItem = this.recomputeDraftItem({ ...freshItem, lines: [...freshItem.lines, ...manualLines] });
    const updatedDraft = this.draftResponse({
      ...draft,
      items: draft.items.map((item) => (item.apartmentId === apartmentId || item.id === apartmentId ? nextItem : item)),
      updatedAt: new Date().toISOString(),
    }) as BillingDraftRecord;
    await this.writeBillingDrafts(organizationId, user.id, drafts.map((item) => (item.id === id ? updatedDraft : item)));
    return this.reviewPayload(updatedDraft);
  }

  async lockInvoiceDraft(user: MvpUser, id: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const draft = drafts.find((item) => item.id === id);
    if (!draft) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertDraftMutable(draft);
    const response = this.draftResponse(draft) as BillingDraftRecord;
    const totals = this.draftTotals(response.items || []);
    if (totals.errorsCount > 0) throw new BadRequestException('Draftul nu poate fi blocat cât timp există erori critice.');
    if (totals.totalAmount <= 0) throw new BadRequestException('Draftul nu poate fi blocat cu total 0.');
    if (!totals.tariffLinesCount) throw new BadRequestException('Draftul nu poate fi blocat fără linii calculate.');
    if (totals.warningsCount > 0 && payload.confirmWarnings !== true) {
      throw new BadRequestException('Confirmă blocarea draftului cu avertizări.');
    }
    if (payload.understood !== true) {
      throw new BadRequestException('Confirmarea explicită este obligatorie pentru blocare.');
    }
    const locked = this.draftResponse({
      ...response,
      status: 'LOCKED',
      lockedAt: new Date().toISOString(),
      lockedById: user.id,
      updatedAt: new Date().toISOString(),
    } as BillingDraftRecord) as BillingDraftRecord;
    await this.writeBillingDrafts(organizationId, user.id, drafts.map((item) => (item.id === id ? locked : item)));
    const syncedRun = await this.syncBillingRunForDraft(organizationId, user.id, locked, 'DRAFT_LOCKED');
    await this.audit
      .logDraftLocked({
        associationId: organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        entityId: locked.id,
        billingRunId: syncedRun?.id || null,
        invoiceDraftId: locked.id,
        message: `Draftul pentru ${locked.billingMonth} a fost blocat.`,
        actionUrl: '/admin/billing-drafts?tab=invoices',
        metadata: {
          billingMonth: locked.billingMonth,
          includedApartments: locked.includedApartments || totals.includedApartments,
          includedAmount: locked.includedAmount || totals.totalAmount,
          warningsCount: locked.warningsCount || totals.warningsCount,
          errorsCount: locked.errorsCount || totals.errorsCount,
        },
        beforeSnapshot: { status: response.status },
        afterSnapshot: { status: locked.status, lockedAt: locked.lockedAt },
      })
      .catch(() => undefined);
    return this.reviewPayload(locked);
  }

  async cancelInvoiceDraft(user: MvpUser, id: string) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const draft = drafts.find((item) => item.id === id);
    if (!draft) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (draft.status !== 'DRAFT') throw new BadRequestException('Doar drafturile în lucru pot fi anulate.');
    const cancelled = {
      ...draft,
      status: 'CANCELLED' as BillingDraftStatus,
      cancelledAt: new Date().toISOString(),
      cancelledById: user.id,
      updatedAt: new Date().toISOString(),
    };
    const nextDrafts = drafts.map((item) => (item.id === id ? cancelled : item));
    await this.writeBillingDrafts(organizationId, user.id, nextDrafts);
    const billingRun = await this.billingRunForDraftAudit(organizationId, cancelled);
    await this.audit
      .createLog({
        associationId: organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        action: 'DRAFT_CANCELLED',
        entityType: 'INVOICE_DRAFT',
        entityId: cancelled.id,
        billingRunId: billingRun?.id || null,
        invoiceDraftId: cancelled.id,
        title: 'Draft anulat',
        message: `Draftul pentru ${cancelled.billingMonth} a fost anulat.`,
        severity: 'WARNING',
        actionUrl: '/admin/billing-drafts?tab=invoices',
        metadata: { billingMonth: cancelled.billingMonth },
        beforeSnapshot: { status: draft.status },
        afterSnapshot: { status: cancelled.status },
      })
      .catch(() => undefined);
    return { id, status: 'CANCELLED', message: 'Draftul a fost anulat.' };
  }

  private internalInvoicePlan(draftId: string) {
    return `INTERNAL_FINAL:${draftId}`;
  }

  private normalizeInvoiceCode(value?: string | null) {
    const normalized = String(value || 'APC')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '-')
      .replace(/[^A-Z0-9-]/g, '');
    return normalized || 'APC';
  }

  private invoiceNumberFor(associationCode: string, billingMonth: string, sequence: number) {
    const compactMonth = billingMonth.replace('-', '');
    return `${this.normalizeInvoiceCode(associationCode)}-${compactMonth}-${String(sequence).padStart(4, '0')}`;
  }

  private internalInvoiceLineType(line: BillingDraftLine): InternalInvoiceLineMetadata['lineType'] {
    if (line.lineType === 'METER_CONSUMPTION') return 'METER_CONSUMPTION';
    if (line.isManual) return line.manualType || 'MANUAL_ADJUSTMENT';
    return 'TARIFF';
  }

  private includedDraftItems(draft: BillingDraftRecord) {
    const response = this.draftResponse(draft) as BillingDraftRecord;
    return (response.items || [])
      .filter((item) => item.status !== 'EXCLUDED')
      .map((item) => {
        const lines = (item.lines || []).filter((line) => line.status === 'READY' || line.status === 'WARNING');
        return this.recomputeDraftItem({ ...item, lines });
      })
      .filter((item) => item.lines.length > 0 && Number(item.total || 0) > 0);
  }

  private invoiceMetadataStats(items: InternalInvoiceMetadata[]) {
    return {
      issued: items.filter((item) => item.status === 'ISSUED').length,
      paid: items.filter((item) => item.status === 'PAID').length,
      partiallyPaid: items.filter((item) => item.status === 'PARTIALLY_PAID').length,
      cancelled: items.filter((item) => item.status === 'CANCELLED' || item.status === 'VOID').length,
      totalAmount: this.money(items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)),
      paidAmount: this.money(items.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0)),
      balanceAmount: this.money(items.reduce((sum, item) => sum + Number(item.balanceAmount || 0), 0)),
    };
  }

  private findInternalInvoice(metadata: InternalInvoiceMetadata[], id: string) {
    return metadata.find((item) => item.id === id || item.invoiceId === id);
  }

  private isInternalInvoicePayable(invoice: InternalInvoiceMetadata) {
    return invoice.status === 'ISSUED' || invoice.status === 'PARTIALLY_PAID';
  }

  private async internalPaymentRows(
    organizationId: string,
    invoiceIds?: string[],
    client: any = this.prisma,
  ) {
    const rows = await client.payment.findMany({
      where: {
        organizationId,
        note: { startsWith: INTERNAL_PAYMENT_NOTE_PREFIX },
      },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      select: this.paymentSelect(),
    });
    if (!invoiceIds?.length) return rows;
    const allowed = new Set(invoiceIds);
    return rows.filter((row) => {
      const note = this.parseInternalPaymentNote(row.note);
      return note?.invoiceId && allowed.has(note.invoiceId);
    });
  }

  private toAdminInternalPayment(row: any, invoice?: InternalInvoiceMetadata | null) {
    const note = this.parseInternalPaymentNote(row.note);
    const paymentDate = row.paidAt ?? row.confirmedAt ?? row.createdAt;
    const resolvedInvoice = invoice || null;
    return {
      id: row.id,
      invoiceId: note?.invoiceId ?? resolvedInvoice?.invoiceId ?? null,
      invoiceNumber: note?.invoiceNumber || resolvedInvoice?.invoiceNumber || row.invoice?.invoiceNumber || null,
      billingMonth: note?.billingMonth || resolvedInvoice?.billingMonth || row.month,
      apartment: resolvedInvoice?.apartment
        ? {
            id: resolvedInvoice.apartment.id,
            apartmentNumber: resolvedInvoice.apartment.apartmentNumber,
            staircase: resolvedInvoice.apartment.staircase,
            floor: resolvedInvoice.apartment.floor,
          }
        : row.apartment
          ? {
              id: row.apartment.id,
              apartmentNumber: row.apartment.number,
              staircase: row.apartment.staircase?.name ?? null,
              floor: row.apartment.floor === null || row.apartment.floor === undefined ? null : String(row.apartment.floor),
            }
          : null,
      resident: resolvedInvoice?.primaryContact
        ? {
            id: resolvedInvoice.primaryContact.id,
            fullName: resolvedInvoice.primaryContact.fullName,
            phone: resolvedInvoice.primaryContact.phone,
          }
        : null,
      amount: Number(row.amount || 0),
      currency: row.currency || 'MDL',
      paymentDate,
      method: note?.method ?? (row.method === PaymentMethod.BANK ? 'OTHER' : row.method),
      referenceNumber: note?.referenceNumber || '',
      payerName: note?.payerName || '',
      notes: note?.notes || '',
      cancellationReason: note?.cancellationReason || '',
      cancelledAt: note?.cancelledAt || null,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy
        ? {
            id: row.createdBy.id,
            fullName: this.userDisplayName(row.createdBy),
            email: row.createdBy.email,
          }
        : null,
    };
  }

  private internalPaymentStats(invoices: InternalInvoiceMetadata[], payments: any[]) {
    const confirmed = payments.filter((payment) => payment.status === PaymentStatus.CONFIRMED);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const paymentMonth = (payment: any) => {
      const date = payment.paidAt ?? payment.confirmedAt ?? payment.createdAt;
      return date ? new Date(date).toISOString().slice(0, 7) : '';
    };
    const lastPayment = [...confirmed].sort((a, b) => {
      const left = new Date(a.paidAt ?? a.confirmedAt ?? a.createdAt).getTime();
      const right = new Date(b.paidAt ?? b.confirmedAt ?? b.createdAt).getTime();
      return right - left;
    })[0];
    return {
      totalCollected: this.money(confirmed.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
      totalUnpaidBalance: this.money(
        invoices
          .filter((invoice) => invoice.status !== 'CANCELLED' && invoice.status !== 'VOID')
          .reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0),
      ),
      currentMonthPayments: this.money(
        confirmed
          .filter((payment) => paymentMonth(payment) === currentMonth)
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      ),
      unpaidInvoices: invoices.filter((invoice) => invoice.status === 'ISSUED' && Number(invoice.balanceAmount || 0) > 0).length,
      partiallyPaidInvoices: invoices.filter((invoice) => invoice.status === 'PARTIALLY_PAID').length,
      paidInvoices: invoices.filter((invoice) => invoice.status === 'PAID').length,
      lastPaymentDate: lastPayment?.paidAt ?? lastPayment?.confirmedAt ?? lastPayment?.createdAt ?? null,
      totalPayments: payments.length,
      confirmedPayments: confirmed.length,
      cancelledPayments: payments.filter((payment) => payment.status === PaymentStatus.CANCELLED).length,
    };
  }

  private async recalculateInternalInvoicePaymentState(
    organizationId: string,
    invoiceId: string,
    actorUserId: string,
    client: any = this.prisma,
  ) {
    const metadata = await this.readInternalInvoiceMetadata(organizationId, client);
    const index = metadata.findIndex((item) => item.id === invoiceId || item.invoiceId === invoiceId);
    if (index === -1) throw new NotFoundException('Factura selectată nu există.');
    const invoice = metadata[index];
    const payments = await this.internalPaymentRows(organizationId, [invoice.invoiceId], client);
    const confirmed = payments.filter((payment) => payment.status === PaymentStatus.CONFIRMED);
    const paidAmount = this.money(confirmed.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const balanceAmount = this.money(Math.max(Number(invoice.totalAmount || 0) - paidAmount, 0));
    let status: InternalInvoiceStatus = invoice.status;
    if (invoice.status !== 'CANCELLED' && invoice.status !== 'VOID') {
      status = paidAmount <= 0 ? 'ISSUED' : paidAmount >= Number(invoice.totalAmount || 0) ? 'PAID' : 'PARTIALLY_PAID';
    }
    const updated: InternalInvoiceMetadata = {
      ...invoice,
      paidAmount,
      balanceAmount,
      status,
      updatedAt: new Date().toISOString(),
    };
    const next = metadata.map((item, itemIndex) => (itemIndex === index ? updated : item));
    await this.writeInternalInvoiceMetadata(organizationId, actorUserId, next, client);
    await client.invoice.update({
      where: { id: invoice.invoiceId },
      data: {
        status: status === 'PAID' ? InvoiceStatus.PAID : invoice.dueDate && new Date(invoice.dueDate) < new Date() ? InvoiceStatus.OVERDUE : InvoiceStatus.UNPAID,
        paidAt: status === 'PAID' ? new Date() : null,
      },
    }).catch(() => undefined);
    return { invoice: updated, payments };
  }

  private async finalizationContext(user: MvpUser, draftId: string) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const [drafts, metadata, organization, existingDbInvoices] = await Promise.all([
      this.readBillingDrafts(organizationId),
      this.readInternalInvoiceMetadata(organizationId),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, legalName: true, fiscalCode: true, currency: true },
      }),
      this.prisma.invoice.count({
        where: { organizationId, plan: this.internalInvoicePlan(draftId) },
      }),
    ]);
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return { organizationId, drafts, draft, metadata, organization, existingDbInvoices };
  }

  private finalizeEligibility(draft: BillingDraftRecord, metadata: InternalInvoiceMetadata[], existingDbInvoices = 0) {
    const response = this.draftResponse(draft) as BillingDraftRecord;
    const includedItems = this.includedDraftItems(response);
    const includedLines = includedItems.flatMap((item) => item.lines);
    const reasons: string[] = [];
    if (response.status === 'DRAFT') reasons.push('Draftul trebuie blocat înainte de finalizare.');
    if (response.status === 'CANCELLED') reasons.push('Draftul este anulat și nu poate fi finalizat.');
    if (Boolean(response.invoicesGenerated || response.finalizedAt) || metadata.some((item) => item.sourceDraftId === response.id) || existingDbInvoices > 0) {
      reasons.push('Facturile au fost deja generate pentru acest draft.');
    }
    if (Number(response.totalAmount || 0) <= 0) reasons.push('Draftul nu are sumă pozitivă de finalizat.');
    if (!includedItems.length) reasons.push('Draftul nu are apartamente incluse.');
    if (!includedLines.length) reasons.push('Draftul nu are linii pregătite pentru facturare.');
    return {
      canFinalize: reasons.length === 0,
      reasons,
      includedItems,
      includedLinesCount: includedLines.length,
      totalAmount: this.money(includedItems.reduce((sum, item) => sum + Number(item.total || 0), 0)),
    };
  }

  async getInvoiceFinalizeSummary(user: MvpUser, draftId: string) {
    const { draft, metadata, organization, existingDbInvoices } = await this.finalizationContext(user, draftId);
    const response = this.draftResponse(draft) as BillingDraftRecord;
    const eligibility = this.finalizeEligibility(response, metadata, existingDbInvoices);
    const associationCode = this.normalizeInvoiceCode(organization.fiscalCode || organization.name);
    const existingMonthSequences = metadata
      .filter((item) => item.billingMonth === response.billingMonth && item.invoiceNumber.startsWith(`${associationCode}-${response.billingMonth.replace('-', '')}-`))
      .map((item) => Number(item.invoiceNumber.split('-').pop()))
      .filter((value) => Number.isFinite(value));
    const firstSequence = (existingMonthSequences.length ? Math.max(...existingMonthSequences) : 0) + 1;
    const lastSequence = Math.max(firstSequence, firstSequence + Math.max(eligibility.includedItems.length, 1) - 1);

    return {
      draft: {
        id: response.id,
        billingMonth: response.billingMonth,
        status: response.status,
        currency: response.currency,
        includedApartments: eligibility.includedItems.length,
        includedAmount: eligibility.totalAmount,
        totalAmount: response.totalAmount,
        lockedAt: response.lockedAt || null,
        lockedById: response.lockedById || null,
        finalizedAt: response.finalizedAt || null,
        invoicesGenerated: Boolean(response.invoicesGenerated),
        invoicesCount: Number(response.invoicesCount || 0),
      },
      association: {
        id: organization.id,
        shortName: organization.name,
        legalName: organization.legalName || organization.name,
        associationCode,
      },
      eligibility: {
        canFinalize: eligibility.canFinalize,
        reasons: eligibility.reasons,
      },
      preview: {
        invoicesToCreate: eligibility.includedItems.length,
        totalAmount: eligibility.totalAmount,
        firstInvoiceNumber: this.invoiceNumberFor(associationCode, response.billingMonth, firstSequence),
        lastInvoiceNumber: this.invoiceNumberFor(associationCode, response.billingMonth, lastSequence),
      },
    };
  }

  async finalizeInvoiceDraft(user: MvpUser, draftId: string) {
    const { organizationId, drafts, draft, metadata, organization, existingDbInvoices } = await this.finalizationContext(user, draftId);
    const response = this.draftResponse(draft) as BillingDraftRecord;
    const eligibility = this.finalizeEligibility(response, metadata, existingDbInvoices);
    if (!eligibility.canFinalize) {
      throw new BadRequestException(eligibility.reasons[0] || 'Draftul nu poate fi finalizat.');
    }

    const associationCode = this.normalizeInvoiceCode(organization.fiscalCode || organization.name);
    const { month, year } = this.billingMonthWindow(response.billingMonth);
    const dueDate = response.dueDate ? this.requiredDate(response.dueDate, 'Data scadentă nu este validă.') : new Date(year, month - 1, 25);
    const now = new Date().toISOString();
    const billingRun = await this.billingRunForDraftAudit(organizationId, response);
    const existingMonthSequences = metadata
      .filter((item) => item.billingMonth === response.billingMonth && item.invoiceNumber.startsWith(`${associationCode}-${response.billingMonth.replace('-', '')}-`))
      .map((item) => Number(item.invoiceNumber.split('-').pop()))
      .filter((value) => Number.isFinite(value));
    let sequence = (existingMonthSequences.length ? Math.max(...existingMonthSequences) : 0) + 1;

    const result = await this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.invoice.findFirst({
        where: { organizationId, plan: this.internalInvoicePlan(response.id) },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException('Facturile au fost deja generate pentru acest draft.');
      }

      const createdMetadata: InternalInvoiceMetadata[] = [];
      let totalAmount = 0;
      for (const item of eligibility.includedItems) {
        const lines = item.lines.filter((line) => line.status === 'READY' || line.status === 'WARNING');
        const invoiceTotal = this.money(lines.reduce((sum, line) => sum + Number(line.amount || 0), 0));
        if (invoiceTotal <= 0) continue;
        const invoiceNumber = this.invoiceNumberFor(associationCode, response.billingMonth, sequence);
        sequence += 1;
        const invoice = await tx.invoice.create({
          data: {
            organizationId,
            apartmentId: item.apartmentId,
            month,
            year,
            amount: invoiceTotal,
            finalAmount: invoiceTotal,
            discount: 0,
            plan: this.internalInvoicePlan(response.id),
            status: InvoiceStatus.UNPAID,
            dueDate,
          },
          select: { id: true, issuedAt: true, createdAt: true },
        });

        await tx.monthlyCharge.createMany({
          data: lines.map((line) => ({
            organizationId,
            apartmentId: item.apartmentId,
            month,
            year,
            tariffName: `${line.name} · ${line.id.replace(/[^a-zA-Z0-9]/g, '').slice(-10) || randomUUID().slice(0, 8)}`,
            amount: this.money(Number(line.amount || 0)),
            status: 'FINAL_INTERNAL',
            createdByUserId: user.id || null,
          })),
          skipDuplicates: true,
        });

        const invoiceMetadata: InternalInvoiceMetadata = {
          id: randomUUID(),
          invoiceId: invoice.id,
          associationId: organizationId,
          organizationId,
          apartmentId: item.apartmentId,
          primaryContactId: item.primaryContact?.id || null,
          sourceDraftId: response.id,
          invoiceNumber,
          billingMonth: response.billingMonth,
          issueDate: invoice.issuedAt?.toISOString?.() || now,
          dueDate: response.dueDate || dueDate.toISOString().slice(0, 10),
          status: 'ISSUED',
          currency: 'MDL',
          subtotalAmount: invoiceTotal,
          totalAmount: invoiceTotal,
          paidAmount: 0,
          balanceAmount: invoiceTotal,
          notes: response.description || '',
          apartment: {
            id: item.apartmentId,
            apartmentNumber: item.apartmentNumber,
            staircase: item.staircase || '',
            floor: item.floor || null,
          },
          primaryContact: item.primaryContact || null,
          lines: lines.map((line) => ({
            id: randomUUID(),
            sourceDraftLineId: line.id,
            tariffId: line.tariffId,
            lineType: this.internalInvoiceLineType(line),
            meterId: line.meterId || null,
            meterReadingId: line.meterReadingId || null,
            meterType: line.meterType || null,
            unit: line.unit || null,
            name: line.name,
            description: line.description || '',
            calculationType: line.calculationType,
            quantity: Number(line.quantity || 0),
            unitPrice: this.money(Number(line.unitPrice || 0)),
            amount: this.money(Number(line.amount || 0)),
            currency: 'MDL',
            formulaLabel: line.formulaLabel || '',
          })),
          createdById: user.id,
          createdAt: invoice.createdAt?.toISOString?.() || now,
          updatedAt: now,
        };
        createdMetadata.push(invoiceMetadata);
        totalAmount = this.money(totalAmount + invoiceTotal);
      }

      if (!createdMetadata.length) {
        throw new BadRequestException('Draftul nu are facturi valide de generat.');
      }

      await this.writeInternalInvoiceMetadata(organizationId, user.id, [...metadata, ...createdMetadata], tx);
      const finalizedDraft = this.draftResponse({
        ...response,
        finalizedAt: now,
        finalizedById: user.id,
        invoicesGenerated: true,
        invoicesCount: createdMetadata.length,
        finalizedAmount: totalAmount,
        updatedAt: now,
      } as BillingDraftRecord) as BillingDraftRecord;
      await this.writeBillingDrafts(organizationId, user.id, drafts.map((item) => (item.id === response.id ? finalizedDraft : item)), tx);
      await this.audit.logInvoicesFinalized(
        {
          associationId: organizationId,
          actorUserId: user.id,
          actorRole: user.role,
          entityId: response.id,
          billingRunId: billingRun?.id || null,
          invoiceDraftId: response.id,
          message: `Au fost generate ${createdMetadata.length} facturi pentru ${response.billingMonth}.`,
          actionUrl: `/admin/invoices?billingMonth=${response.billingMonth}`,
          metadata: {
            sourceDraftId: response.id,
            billingMonth: response.billingMonth,
            createdInvoices: createdMetadata.length,
            totalAmount,
            firstInvoiceNumber: createdMetadata[0]?.invoiceNumber || null,
            lastInvoiceNumber: createdMetadata[createdMetadata.length - 1]?.invoiceNumber || null,
          },
          beforeSnapshot: { draftStatus: response.status },
          afterSnapshot: { draftStatus: finalizedDraft.status, invoicesGenerated: true, invoicesCount: createdMetadata.length, finalizedAmount: totalAmount },
        },
        tx,
      );
      return { createdMetadata, totalAmount };
    });

    await this.activity.createActivity({
      organizationId,
      actorUserId: user.id,
      type: 'INVOICE_CREATED',
      title: `Facturi interne generate pentru ${response.billingMonth}`,
      message: `Au fost create ${result.createdMetadata.length} facturi interne finale în valoare de ${result.totalAmount.toLocaleString('ro-RO')} MDL.`,
      targetType: 'INVOICE',
      link: `/admin/invoices?billingMonth=${response.billingMonth}`,
    }).catch(() => undefined);
    await Promise.all(
      result.createdMetadata.map((invoice) =>
        this.activity
          .notifyApartmentResidents({
            organizationId,
            apartmentId: invoice.apartmentId,
            type: NotificationType.INVOICE,
            title: 'Factură internă emisă',
            message: `Factura ${invoice.invoiceNumber} pentru ${invoice.billingMonth} a fost emisă.`,
            link: `/resident/invoices/${invoice.invoiceId}`,
          })
          .catch(() => undefined),
      ),
    );
    await this.syncBillingRunForDraft(
      organizationId,
      user.id,
      {
        ...response,
        finalizedAt: now,
        finalizedById: user.id,
        invoicesGenerated: true,
        invoicesCount: result.createdMetadata.length,
        finalizedAmount: result.totalAmount,
        updatedAt: now,
      } as BillingDraftRecord,
      'FINALIZED',
    );

    return {
      success: true,
      sourceDraftId: response.id,
      billingMonth: response.billingMonth,
      createdInvoices: result.createdMetadata.length,
      totalAmount: result.totalAmount,
      redirectTo: `/ro/admin/invoices?billingMonth=${response.billingMonth}`,
    };
  }

  async listAdminInternalInvoices(user: MvpUser, query: Record<string, unknown>) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const [organization, metadata] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, legalName: true, fiscalCode: true },
      }),
      this.readInternalInvoiceMetadata(organizationId),
    ]);
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const billingMonth = typeof query.billingMonth === 'string' && query.billingMonth.trim() ? this.parseBillingMonth(query.billingMonth) : '';
    const status = typeof query.status === 'string' && query.status.trim() ? query.status.trim().toUpperCase() : '';
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
    const apartmentNumber = typeof query.apartmentNumber === 'string' ? query.apartmentNumber.trim().toLowerCase() : '';
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const sortBy = typeof query.sortBy === 'string' ? query.sortBy : 'createdAt';
    const sortDirection = String(query.sortDirection || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const filtered = metadata.filter((invoice) => {
      const matchesMonth = !billingMonth || invoice.billingMonth === billingMonth;
      const matchesStatus = !status || invoice.status === status;
      const matchesApartment = !apartmentNumber || invoice.apartment.apartmentNumber.toLowerCase().includes(apartmentNumber);
      const haystack = `${invoice.invoiceNumber} ${invoice.apartment.apartmentNumber} ${invoice.apartment.staircase} ${invoice.primaryContact?.fullName || ''} ${invoice.primaryContact?.phone || ''}`.toLowerCase();
      return matchesMonth && matchesStatus && matchesApartment && (!search || haystack.includes(search));
    });

    filtered.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      const numberValue = (value: unknown) => Number(value || 0);
      if (sortBy === 'totalAmount') return (numberValue(a.totalAmount) - numberValue(b.totalAmount)) * direction;
      if (sortBy === 'balanceAmount') return (numberValue(a.balanceAmount) - numberValue(b.balanceAmount)) * direction;
      if (sortBy === 'apartmentNumber') return a.apartment.apartmentNumber.localeCompare(b.apartment.apartmentNumber, 'ro', { numeric: true }) * direction;
      if (sortBy === 'invoiceNumber') return a.invoiceNumber.localeCompare(b.invoiceNumber, 'ro', { numeric: true }) * direction;
      if (sortBy === 'status') return a.status.localeCompare(b.status, 'ro') * direction;
      if (sortBy === 'dueDate') return (new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime()) * direction;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
    });

    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);
    return {
      items,
      meta: { page, limit, total: filtered.length },
      stats: this.invoiceMetadataStats(filtered),
      association: {
        id: organization.id,
        shortName: organization.name,
        legalName: organization.legalName || organization.name,
        associationCode: this.normalizeInvoiceCode(organization.fiscalCode || organization.name),
      },
    };
  }

  async getAdminInternalInvoice(user: MvpUser, id: string) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const metadata = await this.readInternalInvoiceMetadata(organizationId);
    const invoice = metadata.find((item) => item.id === id || item.invoiceId === id);
    if (!invoice) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, legalName: true, fiscalCode: true },
    });
    return {
      invoice,
      association: organization
        ? {
            id: organization.id,
            shortName: organization.name,
            legalName: organization.legalName || organization.name,
            associationCode: this.normalizeInvoiceCode(organization.fiscalCode || organization.name),
          }
        : null,
    };
  }

  async updateAdminInternalInvoiceStatus(user: MvpUser, id: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const nextStatus = typeof payload.status === 'string' ? payload.status.trim().toUpperCase() : '';
    if (nextStatus !== 'CANCELLED' && nextStatus !== 'VOID') {
      throw new BadRequestException('Statusul facturii nu este valid.');
    }
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const metadata = await this.readInternalInvoiceMetadata(organizationId);
    const index = metadata.findIndex((item) => item.id === id || item.invoiceId === id);
    if (index === -1) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const current = metadata[index];
    if (current.status === 'PAID' || current.status === 'PARTIALLY_PAID') {
      throw new BadRequestException('Factura cu plăți nu poate fi anulată în acest pas.');
    }
    const updated: InternalInvoiceMetadata = {
      ...current,
      status: nextStatus as 'CANCELLED' | 'VOID',
      balanceAmount: 0,
      updatedAt: new Date().toISOString(),
    };
    const nextItems = metadata.map((item, itemIndex) => (itemIndex === index ? updated : item));
    await this.writeInternalInvoiceMetadata(organizationId, user.id, nextItems);
    return { invoice: updated, message: nextStatus === 'VOID' ? 'Factura a fost marcată VOID.' : 'Factura a fost anulată.' };
  }

  async listAdminPayments(user: MvpUser, query: Record<string, unknown>) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const [metadata, paymentRows, organization] = await Promise.all([
      this.readInternalInvoiceMetadata(organizationId),
      this.internalPaymentRows(organizationId),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, legalName: true, fiscalCode: true },
      }),
    ]);
    const invoiceById = new Map(metadata.map((invoice) => [invoice.invoiceId, invoice]));
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
    const method = typeof query.method === 'string' ? query.method.trim().toUpperCase() : '';
    const status = typeof query.status === 'string' ? query.status.trim().toUpperCase() : '';
    const invoiceStatus = typeof query.invoiceStatus === 'string' ? query.invoiceStatus.trim().toUpperCase() : '';
    const billingMonth = typeof query.billingMonth === 'string' && query.billingMonth.trim() ? this.parseBillingMonth(query.billingMonth) : '';
    const dateFrom = typeof query.dateFrom === 'string' && query.dateFrom.trim() ? new Date(query.dateFrom) : null;
    const dateTo = typeof query.dateTo === 'string' && query.dateTo.trim() ? new Date(query.dateTo) : null;
    if (dateTo) dateTo.setHours(23, 59, 59, 999);
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const sortBy = typeof query.sortBy === 'string' ? query.sortBy : 'paymentDate';
    const sortDirection = String(query.sortDirection || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const payments = paymentRows
      .map((row) => this.toAdminInternalPayment(row, invoiceById.get(this.parseInternalPaymentNote(row.note)?.invoiceId || '') || null))
      .filter((payment) => {
        const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : null;
        const matchesDateFrom = !dateFrom || (paymentDate && paymentDate >= dateFrom);
        const matchesDateTo = !dateTo || (paymentDate && paymentDate <= dateTo);
        const matchesMethod = !method || payment.method === method;
        const matchesStatus = !status || payment.status === status;
        const linkedInvoice = payment.invoiceId ? invoiceById.get(payment.invoiceId) : null;
        const matchesInvoiceStatus = !invoiceStatus || linkedInvoice?.status === invoiceStatus;
        const matchesBillingMonth = !billingMonth || payment.billingMonth === billingMonth;
        const haystack = `${payment.invoiceNumber || ''} ${payment.apartment?.apartmentNumber || ''} ${payment.apartment?.staircase || ''} ${payment.resident?.fullName || ''} ${payment.resident?.phone || ''} ${payment.referenceNumber || ''} ${payment.payerName || ''}`.toLowerCase();
        return matchesDateFrom && matchesDateTo && matchesMethod && matchesStatus && matchesInvoiceStatus && matchesBillingMonth && (!search || haystack.includes(search));
      });

    payments.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      if (sortBy === 'amount') return (Number(a.amount || 0) - Number(b.amount || 0)) * direction;
      if (sortBy === 'invoiceNumber') return String(a.invoiceNumber || '').localeCompare(String(b.invoiceNumber || ''), 'ro', { numeric: true }) * direction;
      if (sortBy === 'apartmentNumber') return String(a.apartment?.apartmentNumber || '').localeCompare(String(b.apartment?.apartmentNumber || ''), 'ro', { numeric: true }) * direction;
      return (new Date(a.paymentDate || 0).getTime() - new Date(b.paymentDate || 0).getTime()) * direction;
    });

    const start = (page - 1) * limit;
    return {
      items: payments.slice(start, start + limit),
      meta: { page, limit, total: payments.length },
      stats: this.internalPaymentStats(metadata, paymentRows),
      association: organization
        ? {
            id: organization.id,
            shortName: organization.name,
            legalName: organization.legalName || organization.name,
            associationCode: this.normalizeInvoiceCode(organization.fiscalCode || organization.name),
            currency: 'MDL',
          }
        : null,
    };
  }

  async getAdminPaymentStats(user: MvpUser, query: Record<string, unknown> = {}) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const [metadata, paymentRows] = await Promise.all([
      this.readInternalInvoiceMetadata(organizationId),
      this.internalPaymentRows(organizationId),
    ]);
    return this.internalPaymentStats(metadata, paymentRows);
  }

  async searchAdminPaymentInvoices(user: MvpUser, query: Record<string, unknown>) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const metadata = await this.readInternalInvoiceMetadata(organizationId);
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
    const unpaidOnly = query.unpaidOnly === true || String(query.unpaidOnly ?? 'true').toLowerCase() === 'true';
    const items = metadata
      .filter((invoice) => {
        if (invoice.status === 'CANCELLED' || invoice.status === 'VOID') return false;
        if (unpaidOnly && (invoice.status === 'PAID' || Number(invoice.balanceAmount || 0) <= 0)) return false;
        const haystack = `${invoice.id} ${invoice.invoiceId} ${invoice.invoiceNumber} ${invoice.billingMonth} ${invoice.apartment.apartmentNumber} ${invoice.apartment.staircase} ${invoice.primaryContact?.fullName || ''} ${invoice.primaryContact?.phone || ''}`.toLowerCase();
        return !search || haystack.includes(search);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)
      .map((invoice) => ({
        id: invoice.invoiceId,
        metadataId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        billingMonth: invoice.billingMonth,
        apartment: invoice.apartment,
        resident: invoice.primaryContact,
        status: invoice.status,
        totalAmount: Number(invoice.totalAmount || 0),
        paidAmount: Number(invoice.paidAmount || 0),
        balanceAmount: Number(invoice.balanceAmount || 0),
        dueDate: invoice.dueDate,
      }));
    return { items };
  }

  async createAdminPayment(user: MvpUser, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const invoiceId = this.requiredString(payload.invoiceId, 'Factura este obligatorie.');
    const amount = this.requiredNumber(payload.amount, 'Suma plății trebuie să fie mai mare decât 0.');
    const paymentDate = this.requiredDate(payload.paymentDate || payload.paidAt, 'Data plății nu este validă.');
    const method = this.parseManualPaymentMethod(payload.method);
    if (amount <= 0) throw new BadRequestException('Suma plății trebuie să fie mai mare decât 0.');

    const metadata = await this.readInternalInvoiceMetadata(organizationId);
    const invoice = this.findInternalInvoice(metadata, invoiceId);
    if (!invoice) throw new NotFoundException('Factura selectată nu există.');
    if (!this.isInternalInvoicePayable(invoice)) {
      if (invoice.status === 'PAID') throw new BadRequestException('Factura este deja achitată.');
      throw new BadRequestException('Nu se poate înregistra plată pentru facturi anulate sau VOID.');
    }
    if (amount > Number(invoice.balanceAmount || 0) + 0.001) {
      throw new BadRequestException('Suma nu poate depăși soldul facturii.');
    }

    const referenceNumber = typeof payload.referenceNumber === 'string' ? payload.referenceNumber.trim() : '';
    const payerName = typeof payload.payerName === 'string' ? payload.payerName.trim() : '';
    const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          organizationId,
          apartmentId: invoice.apartmentId,
          amount: this.money(amount),
          currency: BillingCurrency.MDL,
          method: this.paymentMethodForDb(method),
          status: PaymentStatus.CONFIRMED,
          paidAt: paymentDate,
          confirmedAt: paymentDate,
          month: invoice.billingMonth,
          createdByUserId: user.id,
          note: this.buildInternalPaymentNote({
            version: 1,
            kind: 'INTERNAL_INVOICE_PAYMENT',
            invoiceId: invoice.invoiceId,
            invoiceMetadataId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            billingMonth: invoice.billingMonth,
            method,
            referenceNumber,
            payerName,
            notes,
          }),
        },
        select: this.paymentSelect(),
      });
      const recalculated = await this.recalculateInternalInvoicePaymentState(organizationId, invoice.invoiceId, user.id, tx);
      await this.audit.logPaymentRecorded(
        {
          associationId: organizationId,
          actorUserId: user.id,
          actorRole: user.role,
          entityId: created.id,
          invoiceId: invoice.invoiceId,
          apartmentId: invoice.apartmentId,
          message: `Plata de ${this.money(amount).toLocaleString('ro-RO')} MDL a fost înregistrată pentru factura ${invoice.invoiceNumber}.`,
          actionUrl: `/admin/payments/${created.id}`,
          metadata: {
            invoiceId: invoice.invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            amount: this.money(amount),
            method,
            paymentDate: paymentDate.toISOString(),
          },
        },
        tx,
      );
      return { created, updatedInvoice: recalculated.invoice };
    });

    await this.activity.createActivity({
      organizationId,
      actorUserId: user.id,
      type: 'PAYMENT_REGISTERED',
      title: 'Plată înregistrată',
      message: `Plata de ${this.money(amount).toLocaleString('ro-RO')} MDL a fost înregistrată pentru factura ${invoice.invoiceNumber}.`,
      targetType: 'PAYMENT',
      targetId: payment.created.id,
      link: '/admin/payments',
    }).catch(() => undefined);

    await this.activity.notifyApartmentResidents({
      organizationId,
      apartmentId: invoice.apartmentId,
      type: NotificationType.PAYMENT,
      title: 'Plată înregistrată',
      message: `A fost înregistrată o plată de ${this.money(amount).toLocaleString('ro-RO')} MDL pentru factura ${invoice.invoiceNumber}.`,
      link: `/resident/payments/${payment.created.id}`,
    }).catch(() => undefined);

    return {
      payment: this.toAdminInternalPayment(payment.created, payment.updatedInvoice),
      invoice: payment.updatedInvoice,
      message: 'Plata a fost înregistrată.',
    };
  }

  async getAdminPayment(user: MvpUser, id: string) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const row = await this.prisma.payment.findFirst({
      where: { id, organizationId, note: { startsWith: INTERNAL_PAYMENT_NOTE_PREFIX } },
      select: this.paymentSelect(),
    });
    if (!row) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const note = this.parseInternalPaymentNote(row.note);
    const invoice = note ? this.findInternalInvoice(await this.readInternalInvoiceMetadata(organizationId), note.invoiceId) : null;
    return this.toAdminInternalPayment(row, invoice);
  }

  async cancelAdminPayment(user: MvpUser, id: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const reason = this.requiredString(payload.reason || payload.cancellationReason, 'Motivul anulării este obligatoriu.');
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const row = await this.prisma.payment.findFirst({
      where: { id, organizationId, note: { startsWith: INTERNAL_PAYMENT_NOTE_PREFIX } },
      select: this.paymentSelect(),
    });
    if (!row) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (row.status === PaymentStatus.CANCELLED) throw new BadRequestException('Plata este deja anulată.');
    const note = this.parseInternalPaymentNote(row.note);
    if (!note) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: row.id },
        data: {
          status: PaymentStatus.CANCELLED,
          note: this.buildInternalPaymentNote({
            ...note,
            cancellationReason: reason,
            cancelledAt: new Date().toISOString(),
            cancelledById: user.id,
          }),
        },
        select: this.paymentSelect(),
      });
      const recalculated = await this.recalculateInternalInvoicePaymentState(organizationId, note.invoiceId, user.id, tx);
      await this.audit.logPaymentCancelled(
        {
          associationId: organizationId,
          actorUserId: user.id,
          actorRole: user.role,
          entityId: updated.id,
          invoiceId: note.invoiceId,
          message: `Plata pentru factura ${note.invoiceNumber} a fost anulată.`,
          actionUrl: `/admin/payments/${updated.id}`,
          metadata: {
            paymentId: updated.id,
            amount: Number(updated.amount || 0),
            invoiceId: note.invoiceId,
            invoiceNumber: note.invoiceNumber,
            cancellationReason: reason,
          },
        },
        tx,
      );
      return { updated, updatedInvoice: recalculated.invoice };
    });
    if (result.updatedInvoice?.apartmentId) {
      await this.activity
        .notifyApartmentResidents({
          organizationId,
          apartmentId: result.updatedInvoice.apartmentId,
          type: NotificationType.PAYMENT,
          title: 'Plată anulată',
          message: `Plata pentru factura ${note.invoiceNumber} a fost anulată de administrator.`,
          link: `/resident/payments/${row.id}`,
        })
        .catch(() => undefined);
    }

    return {
      payment: this.toAdminInternalPayment(result.updated, result.updatedInvoice),
      invoice: result.updatedInvoice,
      message: 'Plata a fost anulată.',
    };
  }

  async listAdminInvoicePayments(user: MvpUser, id: string) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const metadata = await this.readInternalInvoiceMetadata(organizationId);
    const invoice = this.findInternalInvoice(metadata, id);
    if (!invoice) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const rows = await this.internalPaymentRows(organizationId, [invoice.invoiceId]);
    const items = rows.map((row) => this.toAdminInternalPayment(row, invoice));
    return {
      items,
      stats: {
        totalPaid: this.money(items.filter((item) => item.status === PaymentStatus.CONFIRMED).reduce((sum, item) => sum + Number(item.amount || 0), 0)),
        confirmedCount: items.filter((item) => item.status === PaymentStatus.CONFIRMED).length,
        cancelledCount: items.filter((item) => item.status === PaymentStatus.CANCELLED).length,
      },
    };
  }

  private isCollectableInternalInvoice(invoice: InternalInvoiceMetadata) {
    return invoice.status !== 'CANCELLED' && invoice.status !== 'VOID';
  }

  private internalInvoiceOverdueDays(invoice: InternalInvoiceMetadata, today = new Date()) {
    if (!this.isCollectableInternalInvoice(invoice) || Number(invoice.balanceAmount || 0) <= 0 || !invoice.dueDate) return 0;
    const dueDate = new Date(invoice.dueDate);
    if (Number.isNaN(dueDate.getTime())) return 0;
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    if (dueDate >= startOfToday) return 0;
    return Math.max(1, Math.ceil((startOfToday.getTime() - dueDate.getTime()) / 86_400_000));
  }

  private internalInvoiceLastPaymentDate(invoiceId: string, paymentRows: any[]) {
    const dates = paymentRows
      .filter((payment) => payment.status === PaymentStatus.CONFIRMED && this.parseInternalPaymentNote(payment.note)?.invoiceId === invoiceId)
      .map((payment) => payment.paidAt ?? payment.confirmedAt ?? payment.createdAt)
      .filter(Boolean)
      .map((date) => new Date(date).getTime())
      .filter((time) => Number.isFinite(time));
    if (!dates.length) return null;
    return new Date(Math.max(...dates)).toISOString();
  }

  private reconciliationSummary(invoices: InternalInvoiceMetadata[], billingMonth = '') {
    const collectable = invoices.filter((invoice) => this.isCollectableInternalInvoice(invoice));
    const totalAmount = this.money(collectable.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0));
    const paidAmount = this.money(collectable.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0));
    const balanceAmount = this.money(collectable.reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0));
    return {
      billingMonth: billingMonth || null,
      currency: 'MDL',
      totalInvoices: invoices.length,
      totalAmount,
      paidAmount,
      balanceAmount,
      paidInvoices: collectable.filter((invoice) => invoice.status === 'PAID').length,
      partiallyPaidInvoices: collectable.filter((invoice) => invoice.status === 'PARTIALLY_PAID').length,
      unpaidInvoices: collectable.filter((invoice) => invoice.status === 'ISSUED' && Number(invoice.balanceAmount || 0) > 0).length,
      overdueInvoices: collectable.filter((invoice) => this.internalInvoiceOverdueDays(invoice) > 0).length,
      collectionRate: totalAmount > 0 ? this.money((paidAmount / totalAmount) * 100) : 0,
    };
  }

  private reconciliationStatusBreakdown(invoices: InternalInvoiceMetadata[]) {
    const statuses: InternalInvoiceStatus[] = ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'VOID'];
    return statuses.map((status) => {
      const rows = invoices.filter((invoice) => invoice.status === status);
      return {
        status,
        count: rows.length,
        totalAmount: this.money(rows.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0)),
        paidAmount: this.money(rows.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0)),
        balanceAmount: this.money(rows.reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0)),
      };
    });
  }

  private toReconciliationInvoiceItem(invoice: InternalInvoiceMetadata, paymentRows: any[]) {
    const overdueDays = this.internalInvoiceOverdueDays(invoice);
    return {
      invoiceId: invoice.invoiceId,
      metadataId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      billingMonth: invoice.billingMonth,
      apartment: invoice.apartment,
      primaryContact: invoice.primaryContact,
      totalAmount: Number(invoice.totalAmount || 0),
      paidAmount: Number(invoice.paidAmount || 0),
      balanceAmount: Number(invoice.balanceAmount || 0),
      status: invoice.status,
      dueDate: invoice.dueDate,
      isOverdue: overdueDays > 0,
      overdueDays,
      lastPaymentDate: this.internalInvoiceLastPaymentDate(invoice.invoiceId, paymentRows),
    };
  }

  private filterReconciliationInvoices(metadata: InternalInvoiceMetadata[], query: Record<string, unknown>) {
    const billingMonth = typeof query.billingMonth === 'string' && query.billingMonth.trim() ? this.parseBillingMonth(query.billingMonth) : '';
    const status = typeof query.status === 'string' && query.status.trim() ? query.status.trim().toUpperCase() : '';
    const staircase = typeof query.staircase === 'string' ? query.staircase.trim().toLowerCase() : '';
    const apartmentNumber = typeof query.apartmentNumber === 'string' ? query.apartmentNumber.trim().toLowerCase() : '';
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
    const minBalance = query.minBalance !== undefined && query.minBalance !== '' ? Number(query.minBalance) : null;
    const maxBalance = query.maxBalance !== undefined && query.maxBalance !== '' ? Number(query.maxBalance) : null;
    const unpaidOnly = String(query.unpaidOnly || '').toLowerCase() === 'true';
    const partiallyPaidOnly = String(query.partiallyPaidOnly || '').toLowerCase() === 'true';
    const overdueOnly = String(query.overdueOnly || '').toLowerCase() === 'true';

    return metadata.filter((invoice) => {
      const matchesMonth = !billingMonth || invoice.billingMonth === billingMonth;
      const matchesStatus = !status || invoice.status === status;
      const matchesStaircase = !staircase || String(invoice.apartment.staircase || '').toLowerCase().includes(staircase);
      const matchesApartment = !apartmentNumber || String(invoice.apartment.apartmentNumber || '').toLowerCase().includes(apartmentNumber);
      const matchesUnpaid = !unpaidOnly || (this.isCollectableInternalInvoice(invoice) && Number(invoice.balanceAmount || 0) > 0);
      const matchesPartiallyPaid = !partiallyPaidOnly || invoice.status === 'PARTIALLY_PAID';
      const matchesOverdue = !overdueOnly || this.internalInvoiceOverdueDays(invoice) > 0;
      const matchesMinBalance = minBalance === null || Number(invoice.balanceAmount || 0) >= minBalance;
      const matchesMaxBalance = maxBalance === null || Number(invoice.balanceAmount || 0) <= maxBalance;
      const haystack = `${invoice.invoiceNumber} ${invoice.billingMonth} ${invoice.apartment.apartmentNumber} ${invoice.apartment.staircase} ${invoice.primaryContact?.fullName || ''} ${invoice.primaryContact?.phone || ''}`.toLowerCase();
      return (
        matchesMonth &&
        matchesStatus &&
        matchesStaircase &&
        matchesApartment &&
        matchesUnpaid &&
        matchesPartiallyPaid &&
        matchesOverdue &&
        matchesMinBalance &&
        matchesMaxBalance &&
        (!search || haystack.includes(search))
      );
    });
  }

  private sortReconciliationItems(items: ReturnType<BillingReadService['toReconciliationInvoiceItem']>[], query: Record<string, unknown>) {
    const sortBy = typeof query.sortBy === 'string' ? query.sortBy : 'balanceAmount';
    const sortDirection = String(query.sortDirection || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const direction = sortDirection === 'asc' ? 1 : -1;
    return items.sort((a, b) => {
      const numberValue = (value: unknown) => Number(value || 0);
      if (sortBy === 'totalAmount') return (numberValue(a.totalAmount) - numberValue(b.totalAmount)) * direction;
      if (sortBy === 'paidAmount') return (numberValue(a.paidAmount) - numberValue(b.paidAmount)) * direction;
      if (sortBy === 'balanceAmount') return (numberValue(a.balanceAmount) - numberValue(b.balanceAmount)) * direction;
      if (sortBy === 'apartmentNumber') {
        return String(a.apartment.apartmentNumber || '').localeCompare(String(b.apartment.apartmentNumber || ''), 'ro', { numeric: true }) * direction;
      }
      if (sortBy === 'dueDate') return (new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime()) * direction;
      if (sortBy === 'lastPaymentDate') return (new Date(a.lastPaymentDate || 0).getTime() - new Date(b.lastPaymentDate || 0).getTime()) * direction;
      return String(a.invoiceNumber || '').localeCompare(String(b.invoiceNumber || ''), 'ro', { numeric: true }) * direction;
    });
  }

  private async reconciliationContext(user: MvpUser, query: Record<string, unknown> = {}) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const [metadata, paymentRows, organization] = await Promise.all([
      this.readInternalInvoiceMetadata(organizationId),
      this.internalPaymentRows(organizationId),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, legalName: true, fiscalCode: true },
      }),
    ]);
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return {
      organizationId,
      metadata,
      paymentRows,
      association: {
        id: organization.id,
        shortName: organization.name,
        legalName: organization.legalName || organization.name,
        associationCode: this.normalizeInvoiceCode(organization.fiscalCode || organization.name),
        currency: 'MDL',
      },
    };
  }

  async getAdminPaymentReconciliation(user: MvpUser, query: Record<string, unknown>) {
    const { metadata, paymentRows, association } = await this.reconciliationContext(user, query);
    const billingMonth = typeof query.billingMonth === 'string' && query.billingMonth.trim() ? this.parseBillingMonth(query.billingMonth) : '';
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const filtered = this.filterReconciliationInvoices(metadata, query);
    const sortedItems = this.sortReconciliationItems(
      filtered.map((invoice) => this.toReconciliationInvoiceItem(invoice, paymentRows)),
      query,
    );
    const start = (page - 1) * limit;
    return {
      summary: this.reconciliationSummary(filtered, billingMonth),
      statusBreakdown: this.reconciliationStatusBreakdown(filtered),
      items: sortedItems.slice(start, start + limit),
      meta: { page, limit, total: sortedItems.length },
      association,
    };
  }

  async getAdminPaymentReconciliationStats(user: MvpUser, query: Record<string, unknown>) {
    const { metadata, association } = await this.reconciliationContext(user, query);
    const billingMonth = typeof query.billingMonth === 'string' && query.billingMonth.trim() ? this.parseBillingMonth(query.billingMonth) : '';
    const filtered = this.filterReconciliationInvoices(metadata, query);
    return {
      summary: this.reconciliationSummary(filtered, billingMonth),
      statusBreakdown: this.reconciliationStatusBreakdown(filtered),
      association,
    };
  }

  async getAdminPaymentReconciliationDebtors(user: MvpUser, query: Record<string, unknown>) {
    const { metadata, paymentRows } = await this.reconciliationContext(user, query);
    const billingMonth = typeof query.billingMonth === 'string' && query.billingMonth.trim() ? this.parseBillingMonth(query.billingMonth) : '';
    const rows = metadata.filter(
      (invoice) =>
        this.isCollectableInternalInvoice(invoice) &&
        Number(invoice.balanceAmount || 0) > 0 &&
        (!billingMonth || invoice.billingMonth === billingMonth),
    );
    const grouped = new Map<
      string,
      {
        apartmentId: string;
        apartmentNumber: string;
        staircase: string;
        primaryContact: InternalInvoiceMetadata['primaryContact'];
        balanceAmount: number;
        unpaidInvoicesCount: number;
        oldestUnpaidBillingMonth: string;
        lastPaymentDate: string | null;
      }
    >();
    rows.forEach((invoice) => {
      const current = grouped.get(invoice.apartment.id);
      const lastPaymentDate = this.internalInvoiceLastPaymentDate(invoice.invoiceId, paymentRows);
      if (!current) {
        grouped.set(invoice.apartment.id, {
          apartmentId: invoice.apartment.id,
          apartmentNumber: invoice.apartment.apartmentNumber,
          staircase: invoice.apartment.staircase,
          primaryContact: invoice.primaryContact,
          balanceAmount: this.money(Number(invoice.balanceAmount || 0)),
          unpaidInvoicesCount: 1,
          oldestUnpaidBillingMonth: invoice.billingMonth,
          lastPaymentDate,
        });
        return;
      }
      current.balanceAmount = this.money(current.balanceAmount + Number(invoice.balanceAmount || 0));
      current.unpaidInvoicesCount += 1;
      if (invoice.billingMonth < current.oldestUnpaidBillingMonth) current.oldestUnpaidBillingMonth = invoice.billingMonth;
      if (lastPaymentDate && (!current.lastPaymentDate || new Date(lastPaymentDate) > new Date(current.lastPaymentDate))) {
        current.lastPaymentDate = lastPaymentDate;
      }
    });
    return {
      items: [...grouped.values()]
        .sort((a, b) => Number(b.balanceAmount || 0) - Number(a.balanceAmount || 0))
        .slice(0, Math.min(50, Math.max(1, Number(query.limit || 10)))),
    };
  }

  async getAdminPaymentReconciliationRecentPayments(user: MvpUser, query: Record<string, unknown>) {
    const { metadata, paymentRows } = await this.reconciliationContext(user, query);
    const invoiceById = new Map(metadata.map((invoice) => [invoice.invoiceId, invoice]));
    const limit = Math.min(50, Math.max(1, Number(query.limit || 10)));
    return {
      items: paymentRows
        .slice(0, limit)
        .map((row) => this.toAdminInternalPayment(row, invoiceById.get(this.parseInternalPaymentNote(row.note)?.invoiceId || '') || null)),
    };
  }

  async getAdminPaymentReconciliationApartment(user: MvpUser, apartmentId: string, query: Record<string, unknown>) {
    const { metadata, paymentRows } = await this.reconciliationContext(user, query);
    const billingMonth = typeof query.billingMonth === 'string' && query.billingMonth.trim() ? this.parseBillingMonth(query.billingMonth) : '';
    const invoices = metadata.filter((invoice) => invoice.apartment.id === apartmentId && (!billingMonth || invoice.billingMonth === billingMonth));
    if (!invoices.length) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const invoiceIds = new Set(invoices.map((invoice) => invoice.invoiceId));
    const payments = paymentRows
      .filter((row) => {
        const note = this.parseInternalPaymentNote(row.note);
        return note?.invoiceId && invoiceIds.has(note.invoiceId);
      })
      .map((row) => this.toAdminInternalPayment(row, this.findInternalInvoice(invoices, this.parseInternalPaymentNote(row.note)?.invoiceId || '')));
    const items = this.sortReconciliationItems(
      invoices.map((invoice) => this.toReconciliationInvoiceItem(invoice, paymentRows)),
      { sortBy: 'billingMonth', sortDirection: 'desc' },
    );
    return {
      apartment: invoices[0].apartment,
      primaryContact: invoices[0].primaryContact,
      summary: this.reconciliationSummary(invoices, billingMonth),
      invoices: items,
      payments,
    };
  }

  private parseFinancialPeriod(query: Record<string, unknown>) {
    const mode = String(query.periodMode || (query.dateFrom || query.dateTo ? 'RANGE' : 'MONTH')).toUpperCase() === 'RANGE' ? 'RANGE' : 'MONTH';
    if (mode === 'RANGE') {
      const dateFrom = typeof query.dateFrom === 'string' && query.dateFrom.trim() ? new Date(query.dateFrom) : null;
      const dateTo = typeof query.dateTo === 'string' && query.dateTo.trim() ? new Date(query.dateTo) : null;
      if (!dateFrom || Number.isNaN(dateFrom.getTime()) || !dateTo || Number.isNaN(dateTo.getTime())) {
        throw new BadRequestException('Intervalul raportului nu este valid.');
      }
      dateFrom.setHours(0, 0, 0, 0);
      dateTo.setHours(23, 59, 59, 999);
      if (dateFrom > dateTo) throw new BadRequestException('Data de început nu poate fi după data de sfârșit.');
      return { mode, billingMonth: null as string | null, dateFrom, dateTo };
    }
    return {
      mode,
      billingMonth: this.parseBillingMonth(query.billingMonth || this.currentBillingMonth()),
      dateFrom: null as Date | null,
      dateTo: null as Date | null,
    };
  }

  private invoiceInFinancialPeriod(invoice: InternalInvoiceMetadata, period: ReturnType<BillingReadService['parseFinancialPeriod']>) {
    if (period.mode === 'MONTH') return invoice.billingMonth === period.billingMonth;
    const issuedAt = new Date(invoice.issueDate || invoice.createdAt || 0);
    return issuedAt >= period.dateFrom! && issuedAt <= period.dateTo!;
  }

  private filterFinancialInvoices(metadata: InternalInvoiceMetadata[], query: Record<string, unknown>) {
    const period = this.parseFinancialPeriod(query);
    const invoiceStatus = typeof query.invoiceStatus === 'string' ? query.invoiceStatus.trim().toUpperCase() : 'ALL';
    const includeCancelled = String(query.includeCancelled || '').toLowerCase() === 'true';
    const includeVoid = String(query.includeVoid || '').toLowerCase() === 'true';
    const staircase = typeof query.staircase === 'string' ? query.staircase.trim().toLowerCase() : '';
    const apartmentNumber = typeof query.apartmentNumber === 'string' ? query.apartmentNumber.trim().toLowerCase() : '';
    const invoices = metadata.filter((invoice) => {
      if (!this.invoiceInFinancialPeriod(invoice, period)) return false;
      if (!includeCancelled && invoice.status === 'CANCELLED') return false;
      if (!includeVoid && invoice.status === 'VOID') return false;
      if (invoiceStatus && invoiceStatus !== 'ALL' && invoice.status !== invoiceStatus) return false;
      if (staircase && !String(invoice.apartment.staircase || '').toLowerCase().includes(staircase)) return false;
      if (apartmentNumber && !String(invoice.apartment.apartmentNumber || '').toLowerCase().includes(apartmentNumber)) return false;
      return true;
    });
    return { invoices, period };
  }

  private financialSummary(invoices: InternalInvoiceMetadata[], paymentRows: any[]) {
    const collectable = invoices.filter((invoice) => this.isCollectableInternalInvoice(invoice));
    const totalInvoiced = this.money(collectable.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0));
    const totalPaid = this.money(collectable.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0));
    const outstandingBalance = this.money(collectable.reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0));
    const invoiceIds = new Set(invoices.map((invoice) => invoice.invoiceId));
    const confirmedPayments = paymentRows.filter((payment) => {
      const note = this.parseInternalPaymentNote(payment.note);
      return payment.status === PaymentStatus.CONFIRMED && note?.invoiceId && invoiceIds.has(note.invoiceId);
    });
    const invoiceDate = (invoice: InternalInvoiceMetadata) => new Date(invoice.issueDate || invoice.createdAt || 0).getTime();
    const sortedInvoices = [...invoices].sort((a, b) => invoiceDate(b) - invoiceDate(a));
    return {
      currency: 'MDL',
      totalInvoiced,
      totalPaid,
      outstandingBalance,
      collectionRate: totalInvoiced > 0 ? this.money((totalPaid / totalInvoiced) * 100) : 0,
      totalInvoices: invoices.length,
      paidInvoices: collectable.filter((invoice) => invoice.status === 'PAID').length,
      partiallyPaidInvoices: collectable.filter((invoice) => invoice.status === 'PARTIALLY_PAID').length,
      unpaidInvoices: collectable.filter((invoice) => Number(invoice.balanceAmount || 0) > 0).length,
      overdueInvoices: collectable.filter((invoice) => this.internalInvoiceOverdueDays(invoice) > 0).length,
      confirmedPayments: confirmedPayments.length,
      lastPaymentAt: this.latestInternalPaymentDate(confirmedPayments),
      lastInvoiceAt: sortedInvoices[0]?.issueDate || sortedInvoices[0]?.createdAt || null,
    };
  }

  private latestInternalPaymentDate(paymentRows: any[]) {
    const timestamps = paymentRows
      .map((row) => row.paidAt || row.confirmedAt || row.createdAt)
      .filter(Boolean)
      .map((date) => new Date(date).getTime())
      .filter((time) => Number.isFinite(time));
    return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
  }

  private financialStatusBreakdown(invoices: InternalInvoiceMetadata[]) {
    const statuses: InternalInvoiceStatus[] = ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'VOID'];
    return statuses.map((status) => {
      const rows = invoices.filter((invoice) => invoice.status === status);
      return {
        status,
        count: rows.length,
        totalInvoiced: this.money(rows.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0)),
        totalPaid: this.money(rows.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0)),
        outstandingBalance: this.money(rows.reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0)),
      };
    });
  }

  private monthShift(month: string, offset: number) {
    const [year, value] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, value - 1 + offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private financialStatusForApartment(invoices: InternalInvoiceMetadata[]) {
    if (!invoices.length) return 'FARA_FACTURI';
    const outstanding = invoices.reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0);
    if (outstanding <= 0) return 'LA_ZI';
    if (invoices.some((invoice) => this.internalInvoiceOverdueDays(invoice) > 0)) return 'INTARZIAT';
    if (invoices.some((invoice) => Number(invoice.paidAmount || 0) > 0 && Number(invoice.balanceAmount || 0) > 0)) return 'PARTIAL';
    return 'SOLD_RESTANT';
  }

  private async financialApartments(organizationId: string) {
    return this.prisma.apartment.findMany({
      where: { organizationId },
      orderBy: [{ staircase: { name: 'asc' } }, { number: 'asc' }],
      include: {
        staircase: { select: { id: true, name: true } },
        apartmentResidents: {
          include: { resident: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } } },
        },
        ownerResident: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      },
    });
  }

  private financialPrimaryContact(apartment: any, invoice?: InternalInvoiceMetadata) {
    if (invoice?.primaryContact) return invoice.primaryContact;
    const relation =
      apartment.apartmentResidents?.find((item: any) => item.isPrimary) ||
      apartment.apartmentResidents?.find((item: any) => item.role === 'OWNER') ||
      apartment.apartmentResidents?.[0];
    const resident = relation?.resident || apartment.ownerResident || null;
    return resident
      ? {
          id: resident.id,
          fullName: this.residentFullName(resident),
          phone: resident.phone || null,
        }
      : null;
  }

  private async financialReportContext(user: MvpUser, query: Record<string, unknown> = {}) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const [metadata, paymentRows, organization, runs] = await Promise.all([
      this.readInternalInvoiceMetadata(organizationId),
      this.internalPaymentRows(organizationId),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, legalName: true, fiscalCode: true },
      }),
      this.readBillingRuns(organizationId),
    ]);
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return {
      organizationId,
      metadata,
      paymentRows,
      billingRuns: runs,
      association: {
        id: organization.id,
        shortName: organization.name,
        legalName: organization.legalName || organization.name,
        associationCode: this.normalizeInvoiceCode(organization.fiscalCode || organization.name),
        currency: 'MDL',
      },
    };
  }

  async getAdminReportsSummary(user: MvpUser, query: Record<string, unknown> = {}) {
    const { metadata, paymentRows, association } = await this.financialReportContext(user, query);
    const billingMonth = this.currentBillingMonth();
    const invoices = metadata.filter((invoice) => invoice.billingMonth === billingMonth && this.isCollectableInternalInvoice(invoice));
    const financial = this.financialSummary(invoices, paymentRows);
    return {
      association,
      billingMonth,
      financial,
      cards: [
        { key: 'financial', title: 'Rapoarte financiare', href: '/admin/reports/financial', description: 'Facturi, încasări, solduri și evoluții lunare.' },
        { key: 'reconciliation', title: 'Reconciliere plăți', href: '/admin/payments/reconciliation', description: 'Compară facturile emise cu plățile înregistrate.' },
        { key: 'meterReports', title: 'Rapoarte consum contoare', href: '/admin/meter-readings/reports', description: 'Analizează consumul aprobat pe contoare.' },
        { key: 'audit', title: 'Istoric activitate', href: '/admin/audit-log', description: 'Urmărește acțiunile importante din asociație.' },
        { key: 'billingRuns', title: 'Procese facturare lunară', href: '/admin/billing/runs', description: 'Vezi starea proceselor lunare de facturare.' },
        { key: 'exports', title: 'Exporturi CSV', href: '/admin/exports', description: 'Descarcă facturi, plăți, solduri și rapoarte în format CSV.' },
      ],
    };
  }

  async getAdminFinancialOverview(user: MvpUser, query: Record<string, unknown>) {
    const { metadata, paymentRows, association, billingRuns } = await this.financialReportContext(user, query);
    const { invoices, period } = this.filterFinancialInvoices(metadata, query);
    const billingRun = period.billingMonth ? this.findActiveBillingRun(billingRuns, period.billingMonth) : null;
    return {
      association,
      period: {
        mode: period.mode,
        billingMonth: period.billingMonth,
        dateFrom: period.dateFrom?.toISOString() || null,
        dateTo: period.dateTo?.toISOString() || null,
      },
      summary: this.financialSummary(invoices, paymentRows),
      statusBreakdown: this.financialStatusBreakdown(invoices),
      billingRun: billingRun
        ? {
            id: billingRun.id,
            status: billingRun.status,
            draftId: billingRun.draftId,
            finalizedAt: billingRun.finalizedAt,
            invoicesCount: billingRun.invoicesCount,
          }
        : null,
    };
  }

  async getAdminFinancialStatusBreakdown(user: MvpUser, query: Record<string, unknown>) {
    const { metadata } = await this.financialReportContext(user, query);
    return { items: this.financialStatusBreakdown(this.filterFinancialInvoices(metadata, query).invoices) };
  }

  async getAdminFinancialMonthlyTrend(user: MvpUser, query: Record<string, unknown>) {
    const { metadata, paymentRows } = await this.financialReportContext(user, query);
    const includeCancelled = String(query.includeCancelled || '').toLowerCase() === 'true';
    const includeVoid = String(query.includeVoid || '').toLowerCase() === 'true';
    const monthsCount = Math.min(12, Math.max(1, Number(query.months || 6)));
    const toMonth = typeof query.toMonth === 'string' && query.toMonth.trim() ? this.parseBillingMonth(query.toMonth) : this.currentBillingMonth();
    const fromMonth = typeof query.fromMonth === 'string' && query.fromMonth.trim() ? this.parseBillingMonth(query.fromMonth) : this.monthShift(toMonth, -(monthsCount - 1));
    const months: string[] = [];
    for (let month = fromMonth; month <= toMonth; month = this.monthShift(month, 1)) {
      months.push(month);
      if (months.length > 24) break;
    }
    return {
      items: months.map((billingMonth) => {
        const rows = metadata.filter((invoice) => {
          if (invoice.billingMonth !== billingMonth) return false;
          if (!includeCancelled && invoice.status === 'CANCELLED') return false;
          if (!includeVoid && invoice.status === 'VOID') return false;
          return true;
        });
        const summary = this.financialSummary(rows, paymentRows);
        return {
          billingMonth,
          totalInvoiced: summary.totalInvoiced,
          totalPaid: summary.totalPaid,
          outstandingBalance: summary.outstandingBalance,
          collectionRate: summary.collectionRate,
          totalInvoices: summary.totalInvoices,
          confirmedPayments: summary.confirmedPayments,
        };
      }),
    };
  }

  private async buildFinancialApartmentRows(user: MvpUser, query: Record<string, unknown>) {
    const { organizationId, metadata, paymentRows } = await this.financialReportContext(user, query);
    const { invoices } = this.filterFinancialInvoices(metadata, query);
    const apartments = await this.financialApartments(organizationId);
    const invoicesByApartment = this.groupBy(invoices, (invoice) => invoice.apartment.id);
    return apartments.map((apartment) => {
      const apartmentInvoices = invoicesByApartment.get(apartment.id) || [];
      const invoiceIds = new Set(apartmentInvoices.map((invoice) => invoice.invoiceId));
      const apartmentPayments = paymentRows.filter((payment) => payment.status === PaymentStatus.CONFIRMED && invoiceIds.has(this.parseInternalPaymentNote(payment.note)?.invoiceId || ''));
      const contact = this.financialPrimaryContact(apartment, apartmentInvoices[0]);
      const collectable = apartmentInvoices.filter((invoice) => this.isCollectableInternalInvoice(invoice));
      const totalInvoiced = this.money(collectable.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0));
      const totalPaid = this.money(collectable.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0));
      const outstandingBalance = this.money(collectable.reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0));
      const sortedInvoices = [...apartmentInvoices].sort((a, b) => String(b.billingMonth).localeCompare(String(a.billingMonth)));
      return {
        apartment: {
          id: apartment.id,
          apartmentNumber: apartment.number,
          staircase: apartment.staircase?.name || '',
          floor: apartment.floor === null || apartment.floor === undefined ? null : String(apartment.floor),
        },
        primaryContact: contact,
        summary: {
          currency: 'MDL',
          totalInvoices: apartmentInvoices.length,
          totalInvoiced,
          totalPaid,
          outstandingBalance,
          unpaidInvoices: collectable.filter((invoice) => Number(invoice.balanceAmount || 0) > 0).length,
          overdueInvoices: collectable.filter((invoice) => this.internalInvoiceOverdueDays(invoice) > 0).length,
          lastInvoiceBillingMonth: sortedInvoices[0]?.billingMonth || null,
          lastPaymentDate: this.latestInternalPaymentDate(apartmentPayments),
          financialStatus: this.financialStatusForApartment(collectable),
        },
      };
    });
  }

  private filterFinancialApartmentRows(rows: any[], query: Record<string, unknown>) {
    const financialStatus = typeof query.financialStatus === 'string' ? query.financialStatus.trim().toUpperCase() : '';
    const minBalance = query.minBalance !== undefined && query.minBalance !== '' ? Number(query.minBalance) : null;
    const maxBalance = query.maxBalance !== undefined && query.maxBalance !== '' ? Number(query.maxBalance) : null;
    const staircase = typeof query.staircase === 'string' ? query.staircase.trim().toLowerCase() : '';
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
    return rows.filter((row) => {
      if (financialStatus && row.summary.financialStatus !== financialStatus) return false;
      if (minBalance !== null && row.summary.outstandingBalance < minBalance) return false;
      if (maxBalance !== null && row.summary.outstandingBalance > maxBalance) return false;
      if (staircase && !String(row.apartment.staircase || '').toLowerCase().includes(staircase)) return false;
      const haystack = `${row.apartment.apartmentNumber} ${row.apartment.staircase} ${row.primaryContact?.fullName || ''} ${row.primaryContact?.phone || ''} ${row.summary.lastInvoiceBillingMonth || ''}`.toLowerCase();
      return !search || haystack.includes(search);
    });
  }

  private sortFinancialApartmentRows(rows: any[], query: Record<string, unknown>) {
    const sortBy = typeof query.sortBy === 'string' ? query.sortBy : 'outstandingBalance';
    const direction = String(query.sortDirection || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      if (sortBy === 'totalInvoiced') return (a.summary.totalInvoiced - b.summary.totalInvoiced) * direction;
      if (sortBy === 'totalPaid') return (a.summary.totalPaid - b.summary.totalPaid) * direction;
      if (sortBy === 'apartmentNumber') return String(a.apartment.apartmentNumber || '').localeCompare(String(b.apartment.apartmentNumber || ''), 'ro', { numeric: true }) * direction;
      if (sortBy === 'lastPaymentDate') return (new Date(a.summary.lastPaymentDate || 0).getTime() - new Date(b.summary.lastPaymentDate || 0).getTime()) * direction;
      return (a.summary.outstandingBalance - b.summary.outstandingBalance) * direction;
    });
  }

  async getAdminFinancialApartments(user: MvpUser, query: Record<string, unknown>) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const rows = this.sortFinancialApartmentRows(this.filterFinancialApartmentRows(await this.buildFinancialApartmentRows(user, query), query), query);
    const start = (page - 1) * limit;
    return {
      items: rows.slice(start, start + limit),
      meta: { page, limit, total: rows.length },
    };
  }

  private agingBucket(days: number) {
    if (days <= 30) return { key: '0_30', label: '0-30 zile' };
    if (days <= 60) return { key: '31_60', label: '31-60 zile' };
    if (days <= 90) return { key: '61_90', label: '61-90 zile' };
    return { key: '90_PLUS', label: '90+ zile' };
  }

  async getAdminFinancialAging(user: MvpUser, query: Record<string, unknown>) {
    const { metadata, association } = await this.financialReportContext(user, query);
    const { invoices } = this.filterFinancialInvoices(metadata, query);
    const minDaysOverdue = Math.max(0, Number(query.minDaysOverdue || 0));
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const items = invoices
      .filter((invoice) => this.isCollectableInternalInvoice(invoice) && Number(invoice.balanceAmount || 0) > 0)
      .map((invoice) => {
        const daysOverdue = this.internalInvoiceOverdueDays(invoice);
        const bucket = this.agingBucket(daysOverdue);
        return {
          invoiceId: invoice.invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          billingMonth: invoice.billingMonth,
          apartment: invoice.apartment,
          primaryContact: invoice.primaryContact,
          dueDate: invoice.dueDate,
          daysOverdue,
          balanceAmount: Number(invoice.balanceAmount || 0),
          bucket: bucket.key,
          bucketLabel: bucket.label,
        };
      })
      .filter((item) => item.daysOverdue >= minDaysOverdue)
      .sort((a, b) => b.daysOverdue - a.daysOverdue || b.balanceAmount - a.balanceAmount);
    const bucketMap = new Map<string, { key: string; label: string; invoicesCount: number; amount: number; apartments: Set<string> }>();
    ['0_30', '31_60', '61_90', '90_PLUS'].forEach((key) => {
      const label = key === '0_30' ? '0-30 zile' : key === '31_60' ? '31-60 zile' : key === '61_90' ? '61-90 zile' : '90+ zile';
      bucketMap.set(key, { key, label, invoicesCount: 0, amount: 0, apartments: new Set() });
    });
    items.forEach((item) => {
      const bucket = bucketMap.get(item.bucket)!;
      bucket.invoicesCount += 1;
      bucket.amount = this.money(bucket.amount + item.balanceAmount);
      bucket.apartments.add(item.apartment.id);
    });
    const totalOutstanding = this.money(items.reduce((sum, item) => sum + item.balanceAmount, 0));
    const start = (page - 1) * limit;
    return {
      association,
      summary: {
        currency: 'MDL',
        totalOutstanding,
        totalOverdueInvoices: items.length,
        affectedApartments: new Set(items.map((item) => item.apartment.id)).size,
      },
      buckets: [...bucketMap.values()].map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        invoicesCount: bucket.invoicesCount,
        amount: bucket.amount,
        apartmentsCount: bucket.apartments.size,
        percentage: totalOutstanding > 0 ? this.money((bucket.amount / totalOutstanding) * 100) : 0,
      })),
      items: items.slice(start, start + limit),
      meta: { page, limit, total: items.length },
    };
  }

  async getAdminFinancialRecentInvoices(user: MvpUser, query: Record<string, unknown>) {
    const { metadata } = await this.financialReportContext(user, query);
    const limit = Math.min(50, Math.max(1, Number(query.limit || 10)));
    return {
      items: [...metadata]
        .sort((a, b) => new Date(b.issueDate || b.createdAt || 0).getTime() - new Date(a.issueDate || a.createdAt || 0).getTime())
        .slice(0, limit),
    };
  }

  async getAdminFinancialRecentPayments(user: MvpUser, query: Record<string, unknown>) {
    const { metadata, paymentRows } = await this.financialReportContext(user, query);
    const invoiceById = new Map(metadata.map((invoice) => [invoice.invoiceId, invoice]));
    const limit = Math.min(50, Math.max(1, Number(query.limit || 10)));
    return {
      items: paymentRows
        .filter((row) => row.status === PaymentStatus.CONFIRMED)
        .slice(0, limit)
        .map((row) => this.toAdminInternalPayment(row, invoiceById.get(this.parseInternalPaymentNote(row.note)?.invoiceId || '') || null)),
    };
  }

  private exportQuery(query: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
    const result = { ...query, ...overrides };
    delete result.organizationId;
    delete result.associationId;
    return result;
  }

  private sanitizeExportFilters(query: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(query)
        .filter(([key, value]) => !['organizationId', 'associationId'].includes(key) && ['string', 'number', 'boolean'].includes(typeof value))
        .map(([key, value]) => [key, value]),
    );
  }

  private exportDateRange(query: Record<string, unknown>) {
    const dateFrom = typeof query.dateFrom === 'string' && query.dateFrom.trim() ? new Date(query.dateFrom) : null;
    const dateTo = typeof query.dateTo === 'string' && query.dateTo.trim() ? new Date(query.dateTo) : null;
    if (dateFrom && Number.isNaN(dateFrom.getTime())) throw new BadRequestException('Data de început nu este validă.');
    if (dateTo && Number.isNaN(dateTo.getTime())) throw new BadRequestException('Data de sfârșit nu este validă.');
    if (dateFrom) dateFrom.setHours(0, 0, 0, 0);
    if (dateTo) dateTo.setHours(23, 59, 59, 999);
    if (dateFrom && dateTo && dateFrom > dateTo) throw new BadRequestException('Data de început nu poate fi după data de sfârșit.');
    return { dateFrom, dateTo };
  }

  private csvValue(value: unknown) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'number') return Number.isFinite(value) ? String(this.money(value)) : '';
    return String(value);
  }

  private csvCell(value: unknown) {
    const text = this.csvValue(value).replace(/"/g, '""');
    return /[;\n\r"]/.test(text) ? `"${text}"` : text;
  }

  private buildCsv(columns: CsvColumn[], rows: any[]) {
    const header = columns.map((column) => this.csvCell(column.header)).join(';');
    const body = rows.map((row) => columns.map((column) => this.csvCell(column.value ? column.value(row) : row[column.key])).join(';'));
    return `\uFEFF${[header, ...body].join('\n')}`;
  }

  private formatExportDate(value: unknown, mode: 'date' | 'datetime' = 'date') {
    if (!value) return '';
    const date = new Date(value as any);
    if (Number.isNaN(date.getTime())) return '';
    return mode === 'datetime' ? date.toISOString() : date.toISOString().slice(0, 10);
  }

  private sanitizeFileName(value: string) {
    return value
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private exportFileName(slug: string, associationCode: string, query: Record<string, unknown>) {
    const suffix =
      (typeof query.billingMonth === 'string' && query.billingMonth) ||
      (typeof query.periodMonth === 'string' && query.periodMonth) ||
      (typeof query.toMonth === 'string' && query.toMonth) ||
      new Date().toISOString().slice(0, 10);
    return this.sanitizeFileName(`espace-${slug}-${associationCode}-${suffix}.csv`);
  }

  private async logAdminExport(
    user: MvpUser,
    organizationId: string,
    exportType: string,
    filters: Record<string, unknown>,
    rowsCount: number,
    fileName: string,
    status: 'GENERATED' | 'FAILED' = 'GENERATED',
    error?: string,
  ) {
    await this.audit
      .createLog({
        associationId: organizationId,
        actorUserId: user.id,
        actorRole: user.role,
        action: status === 'GENERATED' ? 'EXPORT_GENERATED' : 'EXPORT_FAILED',
        entityType: 'SYSTEM',
        title: status === 'GENERATED' ? 'Export CSV generat' : 'Export CSV eșuat',
        message:
          status === 'GENERATED'
            ? `Exportul ${exportType} a fost generat cu ${rowsCount} rânduri.`
            : `Exportul ${exportType} nu a putut fi generat.`,
        severity: status === 'GENERATED' ? 'SUCCESS' : 'ERROR',
        actionUrl: '/admin/exports/history',
        metadata: {
          exportType,
          format: 'CSV',
          filters,
          rowsCount,
          status,
          fileName,
          error: error || null,
        },
      })
      .catch(() => undefined);
  }

  private async csvExportResult(
    user: MvpUser,
    organizationId: string,
    associationCode: string,
    exportType: string,
    slug: string,
    query: Record<string, unknown>,
    rows: any[],
    columns: CsvColumn[],
  ): Promise<CsvExportResult> {
    const filters = this.sanitizeExportFilters(query);
    const fileName = this.exportFileName(slug, associationCode, query);
    if (rows.length > 10_000) {
      await this.logAdminExport(user, organizationId, exportType, filters, rows.length, fileName, 'FAILED', 'Exportul depășește limita MVP de 10.000 rânduri.');
      throw new BadRequestException('Exportul este prea mare. Rafinează filtrele.');
    }
    const csv = this.buildCsv(columns, rows);
    await this.logAdminExport(user, organizationId, exportType, filters, rows.length, fileName);
    return { csv, fileName, rowsCount: rows.length };
  }

  async exportAdminInvoicesCsv(user: MvpUser, query: Record<string, unknown>) {
    const effectiveQuery = this.exportQuery(query, { invoiceStatus: query.invoiceStatus || query.status });
    const { organizationId, metadata, association } = await this.financialReportContext(user, effectiveQuery);
    const { invoices } = this.filterFinancialInvoices(metadata, effectiveQuery);
    const rows = invoices.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      billingMonth: invoice.billingMonth,
      apartmentNumber: invoice.apartment.apartmentNumber,
      staircase: invoice.apartment.staircase,
      floor: invoice.apartment.floor,
      primaryContactName: invoice.primaryContact?.fullName || '',
      primaryContactPhone: invoice.primaryContact?.phone || '',
      status: invoice.status,
      currency: invoice.currency || 'MDL',
      totalAmount: Number(invoice.totalAmount || 0),
      paidAmount: Number(invoice.paidAmount || 0),
      balanceAmount: Number(invoice.balanceAmount || 0),
      issueDate: this.formatExportDate(invoice.issueDate),
      dueDate: this.formatExportDate(invoice.dueDate),
      createdAt: this.formatExportDate(invoice.createdAt, 'datetime'),
    }));
    return this.csvExportResult(user, organizationId, association.associationCode, 'INVOICES', 'invoices', effectiveQuery, rows, [
      { key: 'invoiceNumber', header: 'invoiceNumber' },
      { key: 'billingMonth', header: 'billingMonth' },
      { key: 'apartmentNumber', header: 'apartmentNumber' },
      { key: 'staircase', header: 'staircase' },
      { key: 'floor', header: 'floor' },
      { key: 'primaryContactName', header: 'primaryContactName' },
      { key: 'primaryContactPhone', header: 'primaryContactPhone' },
      { key: 'status', header: 'status' },
      { key: 'currency', header: 'currency' },
      { key: 'totalAmount', header: 'totalAmount' },
      { key: 'paidAmount', header: 'paidAmount' },
      { key: 'balanceAmount', header: 'balanceAmount' },
      { key: 'issueDate', header: 'issueDate' },
      { key: 'dueDate', header: 'dueDate' },
      { key: 'createdAt', header: 'createdAt' },
    ]);
  }

  private filterExportPayments(metadata: InternalInvoiceMetadata[], paymentRows: any[], query: Record<string, unknown>) {
    const invoiceById = new Map(metadata.map((invoice) => [invoice.invoiceId, invoice]));
    const { dateFrom, dateTo } = this.exportDateRange(query);
    const method = typeof query.method === 'string' ? query.method.trim().toUpperCase() : '';
    const rawStatus = typeof query.status === 'string' && query.status.trim() ? query.status.trim().toUpperCase() : 'CONFIRMED';
    const status = rawStatus === 'ALL' ? '' : rawStatus;
    const billingMonth = typeof query.billingMonth === 'string' && query.billingMonth.trim() ? this.parseBillingMonth(query.billingMonth) : '';
    const staircase = typeof query.staircase === 'string' ? query.staircase.trim().toLowerCase() : '';
    const apartmentNumber = typeof query.apartmentNumber === 'string' ? query.apartmentNumber.trim().toLowerCase() : '';
    return paymentRows
      .map((row) => this.toAdminInternalPayment(row, invoiceById.get(this.parseInternalPaymentNote(row.note)?.invoiceId || '') || null))
      .filter((payment) => {
        const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : null;
        if (dateFrom && (!paymentDate || paymentDate < dateFrom)) return false;
        if (dateTo && (!paymentDate || paymentDate > dateTo)) return false;
        if (method && payment.method !== method) return false;
        if (status && payment.status !== status) return false;
        if (billingMonth && payment.billingMonth !== billingMonth) return false;
        if (staircase && !String(payment.apartment?.staircase || '').toLowerCase().includes(staircase)) return false;
        if (apartmentNumber && !String(payment.apartment?.apartmentNumber || '').toLowerCase().includes(apartmentNumber)) return false;
        return true;
      });
  }

  async exportAdminPaymentsCsv(user: MvpUser, query: Record<string, unknown>) {
    const { organizationId, metadata, paymentRows, association } = await this.financialReportContext(user, query);
    const rows = this.filterExportPayments(metadata, paymentRows, query).map((payment) => ({
      paymentDate: this.formatExportDate(payment.paymentDate),
      invoiceNumber: payment.invoiceNumber || '',
      billingMonth: payment.billingMonth || '',
      apartmentNumber: payment.apartment?.apartmentNumber || '',
      staircase: payment.apartment?.staircase || '',
      residentName: payment.resident?.fullName || '',
      residentPhone: payment.resident?.phone || '',
      amount: Number(payment.amount || 0),
      currency: payment.currency || 'MDL',
      method: payment.method || '',
      referenceNumber: payment.referenceNumber || '',
      payerName: payment.payerName || '',
      status: payment.status,
      createdBy: payment.createdBy?.fullName || payment.createdBy?.email || '',
      createdAt: this.formatExportDate(payment.createdAt, 'datetime'),
      cancelledAt: this.formatExportDate(payment.cancelledAt),
      cancellationReason: payment.cancellationReason || '',
    }));
    return this.csvExportResult(user, organizationId, association.associationCode, 'PAYMENTS', 'payments', query, rows, [
      { key: 'paymentDate', header: 'paymentDate' },
      { key: 'invoiceNumber', header: 'invoiceNumber' },
      { key: 'billingMonth', header: 'billingMonth' },
      { key: 'apartmentNumber', header: 'apartmentNumber' },
      { key: 'staircase', header: 'staircase' },
      { key: 'residentName', header: 'residentName' },
      { key: 'residentPhone', header: 'residentPhone' },
      { key: 'amount', header: 'amount' },
      { key: 'currency', header: 'currency' },
      { key: 'method', header: 'method' },
      { key: 'referenceNumber', header: 'referenceNumber' },
      { key: 'payerName', header: 'payerName' },
      { key: 'status', header: 'status' },
      { key: 'createdBy', header: 'createdBy' },
      { key: 'createdAt', header: 'createdAt' },
      { key: 'cancelledAt', header: 'cancelledAt' },
      { key: 'cancellationReason', header: 'cancellationReason' },
    ]);
  }

  async exportAdminApartmentBalancesCsv(user: MvpUser, query: Record<string, unknown>) {
    let rows = this.sortFinancialApartmentRows(this.filterFinancialApartmentRows(await this.buildFinancialApartmentRows(user, query), query), query);
    if (query.overdueOnly === true || query.overdueOnly === 'true') rows = rows.filter((row) => Number(row.summary.overdueInvoices || 0) > 0);
    if (query.unpaidOnly === true || query.unpaidOnly === 'true') rows = rows.filter((row) => Number(row.summary.unpaidInvoices || 0) > 0);
    const { organizationId, association, metadata } = await this.financialReportContext(user, query);
    const invoicesByApartment = this.groupBy(this.filterFinancialInvoices(metadata, query).invoices, (invoice) => invoice.apartment.id);
    const exportRows = rows.map((row) => {
      const apartmentInvoices = invoicesByApartment.get(row.apartment.id) || [];
      const oldestUnpaid = apartmentInvoices
        .filter((invoice) => Number(invoice.balanceAmount || 0) > 0 && this.isCollectableInternalInvoice(invoice))
        .sort((a, b) => String(a.billingMonth).localeCompare(String(b.billingMonth)))[0];
      return {
        apartmentNumber: row.apartment.apartmentNumber,
        staircase: row.apartment.staircase,
        floor: row.apartment.floor,
        primaryContactName: row.primaryContact?.fullName || '',
        primaryContactPhone: row.primaryContact?.phone || '',
        totalInvoices: row.summary.totalInvoices,
        totalInvoiced: row.summary.totalInvoiced,
        totalPaid: row.summary.totalPaid,
        outstandingBalance: row.summary.outstandingBalance,
        unpaidInvoices: row.summary.unpaidInvoices,
        overdueInvoices: row.summary.overdueInvoices,
        oldestUnpaidBillingMonth: oldestUnpaid?.billingMonth || '',
        lastInvoiceBillingMonth: row.summary.lastInvoiceBillingMonth || '',
        lastPaymentDate: this.formatExportDate(row.summary.lastPaymentDate),
        financialStatus: row.summary.financialStatus,
      };
    });
    return this.csvExportResult(user, organizationId, association.associationCode, 'APARTMENT_BALANCES', 'apartment-balances', query, exportRows, [
      { key: 'apartmentNumber', header: 'apartmentNumber' },
      { key: 'staircase', header: 'staircase' },
      { key: 'floor', header: 'floor' },
      { key: 'primaryContactName', header: 'primaryContactName' },
      { key: 'primaryContactPhone', header: 'primaryContactPhone' },
      { key: 'totalInvoices', header: 'totalInvoices' },
      { key: 'totalInvoiced', header: 'totalInvoiced' },
      { key: 'totalPaid', header: 'totalPaid' },
      { key: 'outstandingBalance', header: 'outstandingBalance' },
      { key: 'unpaidInvoices', header: 'unpaidInvoices' },
      { key: 'overdueInvoices', header: 'overdueInvoices' },
      { key: 'oldestUnpaidBillingMonth', header: 'oldestUnpaidBillingMonth' },
      { key: 'lastInvoiceBillingMonth', header: 'lastInvoiceBillingMonth' },
      { key: 'lastPaymentDate', header: 'lastPaymentDate' },
      { key: 'financialStatus', header: 'financialStatus' },
    ]);
  }

  async exportAdminFinancialMonthlyCsv(user: MvpUser, query: Record<string, unknown>) {
    const { organizationId, metadata, paymentRows, association } = await this.financialReportContext(user, query);
    const includeCancelled = String(query.includeCancelled || '').toLowerCase() === 'true';
    const includeVoid = String(query.includeVoid || '').toLowerCase() === 'true';
    const toMonth = typeof query.toMonth === 'string' && query.toMonth.trim() ? this.parseBillingMonth(query.toMonth) : this.currentBillingMonth();
    const fromMonth = typeof query.fromMonth === 'string' && query.fromMonth.trim() ? this.parseBillingMonth(query.fromMonth) : this.monthShift(toMonth, -11);
    if (fromMonth > toMonth) throw new BadRequestException('Luna de început nu poate fi după luna de sfârșit.');
    const rows: any[] = [];
    for (let billingMonth = fromMonth; billingMonth <= toMonth; billingMonth = this.monthShift(billingMonth, 1)) {
      const invoices = metadata.filter((invoice) => {
        if (invoice.billingMonth !== billingMonth) return false;
        if (!includeCancelled && invoice.status === 'CANCELLED') return false;
        if (!includeVoid && invoice.status === 'VOID') return false;
        return true;
      });
      const summary = this.financialSummary(invoices, paymentRows);
      const statusCounts = this.financialStatusBreakdown(invoices).reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {});
      rows.push({
        billingMonth,
        totalInvoices: summary.totalInvoices,
        issuedInvoices: statusCounts.ISSUED || 0,
        partiallyPaidInvoices: statusCounts.PARTIALLY_PAID || 0,
        paidInvoices: statusCounts.PAID || 0,
        cancelledInvoices: statusCounts.CANCELLED || 0,
        voidInvoices: statusCounts.VOID || 0,
        totalInvoiced: summary.totalInvoiced,
        totalPaid: summary.totalPaid,
        outstandingBalance: summary.outstandingBalance,
        collectionRate: summary.collectionRate,
        confirmedPayments: summary.confirmedPayments,
        lastInvoiceAt: this.formatExportDate(summary.lastInvoiceAt),
        lastPaymentAt: this.formatExportDate(summary.lastPaymentAt),
      });
      if (rows.length > 24) break;
    }
    return this.csvExportResult(user, organizationId, association.associationCode, 'FINANCIAL_MONTHLY', 'financial-monthly', { ...query, toMonth }, rows, [
      { key: 'billingMonth', header: 'billingMonth' },
      { key: 'totalInvoices', header: 'totalInvoices' },
      { key: 'issuedInvoices', header: 'issuedInvoices' },
      { key: 'partiallyPaidInvoices', header: 'partiallyPaidInvoices' },
      { key: 'paidInvoices', header: 'paidInvoices' },
      { key: 'cancelledInvoices', header: 'cancelledInvoices' },
      { key: 'voidInvoices', header: 'voidInvoices' },
      { key: 'totalInvoiced', header: 'totalInvoiced' },
      { key: 'totalPaid', header: 'totalPaid' },
      { key: 'outstandingBalance', header: 'outstandingBalance' },
      { key: 'collectionRate', header: 'collectionRate' },
      { key: 'confirmedPayments', header: 'confirmedPayments' },
      { key: 'lastInvoiceAt', header: 'lastInvoiceAt' },
      { key: 'lastPaymentAt', header: 'lastPaymentAt' },
    ]);
  }

  async exportAdminAgingCsv(user: MvpUser, query: Record<string, unknown>) {
    const effectiveQuery = this.exportQuery(query);
    const { organizationId, metadata, association } = await this.financialReportContext(user, effectiveQuery);
    const { invoices } = this.filterFinancialInvoices(metadata, effectiveQuery);
    const minDaysOverdue = Math.max(0, Number(query.minDaysOverdue || 0));
    const bucketFilter = typeof query.bucket === 'string' && query.bucket.trim() ? query.bucket.trim().toUpperCase() : '';
    const rows = invoices
      .filter((invoice) => this.isCollectableInternalInvoice(invoice) && Number(invoice.balanceAmount || 0) > 0)
      .map((invoice) => {
        const daysOverdue = this.internalInvoiceOverdueDays(invoice);
        const bucket = this.agingBucket(daysOverdue);
        return {
          bucket: bucket.key,
          invoiceNumber: invoice.invoiceNumber,
          billingMonth: invoice.billingMonth,
          apartmentNumber: invoice.apartment.apartmentNumber,
          staircase: invoice.apartment.staircase,
          primaryContactName: invoice.primaryContact?.fullName || '',
          primaryContactPhone: invoice.primaryContact?.phone || '',
          dueDate: this.formatExportDate(invoice.dueDate),
          daysOverdue,
          totalAmount: Number(invoice.totalAmount || 0),
          paidAmount: Number(invoice.paidAmount || 0),
          balanceAmount: Number(invoice.balanceAmount || 0),
          status: invoice.status,
        };
      })
      .filter((row) => row.daysOverdue >= minDaysOverdue)
      .filter((row) => !bucketFilter || row.bucket === bucketFilter)
      .sort((a, b) => b.daysOverdue - a.daysOverdue || b.balanceAmount - a.balanceAmount);
    return this.csvExportResult(user, organizationId, association.associationCode, 'AGING', 'aging', effectiveQuery, rows, [
      { key: 'bucket', header: 'bucket' },
      { key: 'invoiceNumber', header: 'invoiceNumber' },
      { key: 'billingMonth', header: 'billingMonth' },
      { key: 'apartmentNumber', header: 'apartmentNumber' },
      { key: 'staircase', header: 'staircase' },
      { key: 'primaryContactName', header: 'primaryContactName' },
      { key: 'primaryContactPhone', header: 'primaryContactPhone' },
      { key: 'dueDate', header: 'dueDate' },
      { key: 'daysOverdue', header: 'daysOverdue' },
      { key: 'totalAmount', header: 'totalAmount' },
      { key: 'paidAmount', header: 'paidAmount' },
      { key: 'balanceAmount', header: 'balanceAmount' },
      { key: 'status', header: 'status' },
    ]);
  }

  async exportAdminMeterConsumptionCsv(user: MvpUser, query: Record<string, unknown>) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const periodMonth = this.parseBillingMonth(query.periodMonth || query.billingMonth || this.currentBillingMonth());
    const meterType = typeof query.meterType === 'string' && query.meterType.trim().toUpperCase() !== 'ALL' ? query.meterType.trim().toUpperCase() : '';
    const status = typeof query.status === 'string' && query.status.trim().toUpperCase() !== 'ALL' ? this.normalizeMeterReadingStatus(query.status) : null;
    const source = typeof query.source === 'string' && query.source.trim().toUpperCase() !== 'ALL' ? query.source.trim().toUpperCase() : '';
    const staircase = typeof query.staircase === 'string' ? query.staircase.trim().toLowerCase() : '';
    const apartmentNumber = typeof query.apartmentNumber === 'string' ? query.apartmentNumber.trim().toLowerCase() : '';
    const [organization, store, readings] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, legalName: true, fiscalCode: true } }),
      this.readMeterWorkflowMetadata(organizationId),
      this.prisma.meterReading.findMany({
        where: { organizationId },
        orderBy: [{ readingDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          meterId: true,
          apartmentId: true,
          value: true,
          readingDate: true,
          source: true,
          createdAt: true,
          meter: { select: { id: true, type: true, serialNumber: true } },
          apartment: {
            select: {
              id: true,
              number: true,
              floor: true,
              staircase: { select: { id: true, name: true } },
              ownerResident: { select: { id: true, firstName: true, lastName: true, phone: true } },
              apartmentResidents: {
                orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
                select: {
                  role: true,
                  isPrimary: true,
                  resident: { select: { id: true, firstName: true, lastName: true, phone: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const mapped = readings
      .map((reading: any) => {
        const meta = this.readingMetadataForCharge(store, reading);
        const type = this.meterTypeExternal(reading.meter?.type);
        const contact = this.primaryContactFromApartment(reading.apartment);
        return {
          id: reading.id,
          periodMonth: meta.periodMonth,
          apartmentNumber: reading.apartment?.number || '',
          staircase: reading.apartment?.staircase?.name || '',
          floor: reading.apartment?.floor === null || reading.apartment?.floor === undefined ? '' : String(reading.apartment.floor),
          primaryContactName: contact?.fullName || '',
          meterType: type,
          meterNumber: reading.meter?.serialNumber || '',
          unit: meta.unit || this.defaultMeterUnit(type),
          previousReadingValue: meta.previousReadingValue ?? '',
          readingValue: Number(reading.value || 0),
          consumptionValue: meta.consumptionValue ?? '',
          readingStatus: meta.status,
          source: meta.source || String(reading.source || ''),
          submittedAt: this.formatExportDate(meta.submittedAt || reading.createdAt, 'datetime'),
          reviewedAt: this.formatExportDate(meta.reviewedAt, 'datetime'),
          reviewedById: meta.reviewedByUserId || '',
        };
      })
      .filter((row) => row.periodMonth === periodMonth)
      .filter((row) => !meterType || row.meterType === meterType || (meterType === 'HEAT' && row.meterType === 'HEATING'))
      .filter((row) => !status || row.readingStatus === status)
      .filter((row) => !source || row.source === source)
      .filter((row) => !staircase || row.staircase.toLowerCase().includes(staircase))
      .filter((row) => !apartmentNumber || row.apartmentNumber.toLowerCase().includes(apartmentNumber));
    const reviewerIds = [...new Set(mapped.map((row) => row.reviewedById).filter(Boolean))];
    const reviewers = reviewerIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, firstName: true, lastName: true, fullName: true, email: true } })
      : [];
    const reviewerMap = new Map(reviewers.map((reviewer) => [reviewer.id, this.userDisplayName(reviewer)]));
    const rows = mapped.map((row) => ({ ...row, reviewedBy: reviewerMap.get(row.reviewedById) || row.reviewedById || '' }));
    const associationCode = this.normalizeInvoiceCode(organization.fiscalCode || organization.name);
    return this.csvExportResult(user, organizationId, associationCode, 'METER_CONSUMPTION', 'meter-consumption', { ...query, periodMonth }, rows, [
      { key: 'periodMonth', header: 'periodMonth' },
      { key: 'apartmentNumber', header: 'apartmentNumber' },
      { key: 'staircase', header: 'staircase' },
      { key: 'floor', header: 'floor' },
      { key: 'primaryContactName', header: 'primaryContactName' },
      { key: 'meterType', header: 'meterType' },
      { key: 'meterNumber', header: 'meterNumber' },
      { key: 'unit', header: 'unit' },
      { key: 'previousReadingValue', header: 'previousReadingValue' },
      { key: 'readingValue', header: 'readingValue' },
      { key: 'consumptionValue', header: 'consumptionValue' },
      { key: 'readingStatus', header: 'readingStatus' },
      { key: 'source', header: 'source' },
      { key: 'submittedAt', header: 'submittedAt' },
      { key: 'reviewedAt', header: 'reviewedAt' },
      { key: 'reviewedBy', header: 'reviewedBy' },
    ]);
  }

  async exportAdminApartmentsCsv(user: MvpUser, query: Record<string, unknown>) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const [organization, apartments] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, fiscalCode: true } }),
      this.prisma.apartment.findMany({
        where: { organizationId },
        orderBy: [{ staircase: { name: 'asc' } }, { number: 'asc' }],
        include: {
          building: { select: { id: true, name: true } },
          staircase: { select: { id: true, name: true } },
          ownerResident: { select: { id: true, firstName: true, lastName: true, phone: true } },
          apartmentResidents: {
            include: { resident: { select: { id: true, firstName: true, lastName: true, phone: true } } },
          },
        },
      }),
    ]);
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const staircase = typeof query.staircase === 'string' ? query.staircase.trim().toLowerCase() : '';
    const status = typeof query.status === 'string' && query.status.trim().toUpperCase() !== 'ALL' ? query.status.trim().toUpperCase() : '';
    const hasPrimaryContact = typeof query.hasPrimaryContact === 'string' ? query.hasPrimaryContact : '';
    const hasArea = typeof query.hasArea === 'string' ? query.hasArea : '';
    const rows = apartments
      .filter((apartment: any) => !staircase || String(apartment.staircase?.name || '').toLowerCase().includes(staircase))
      .filter((apartment: any) => !status || String(apartment.status || '').toUpperCase() === status)
      .filter((apartment: any) => {
        const contact = this.financialPrimaryContact(apartment);
        if (hasPrimaryContact === 'true') return Boolean(contact);
        if (hasPrimaryContact === 'false') return !contact;
        return true;
      })
      .filter((apartment: any) => {
        if (hasArea === 'true') return Number(apartment.areaM2 || 0) > 0;
        if (hasArea === 'false') return !apartment.areaM2;
        return true;
      })
      .map((apartment: any) => {
        const contact = this.financialPrimaryContact(apartment);
        return {
          apartmentNumber: apartment.number,
          building: apartment.building?.name || '',
          staircase: apartment.staircase?.name || '',
          floor: apartment.floor === null || apartment.floor === undefined ? '' : String(apartment.floor),
          areaM2: apartment.areaM2 ?? '',
          cadastralNumber: '',
          status: apartment.status,
          primaryContactName: contact?.fullName || '',
          primaryContactPhone: contact?.phone || '',
          residentsCount: apartment.apartmentResidents?.length || 0,
          createdAt: this.formatExportDate(apartment.createdAt, 'datetime'),
          updatedAt: this.formatExportDate(apartment.updatedAt, 'datetime'),
        };
      });
    const associationCode = this.normalizeInvoiceCode(organization.fiscalCode || organization.name);
    return this.csvExportResult(user, organizationId, associationCode, 'APARTMENTS', 'apartments', query, rows, [
      { key: 'apartmentNumber', header: 'apartmentNumber' },
      { key: 'building', header: 'building' },
      { key: 'staircase', header: 'staircase' },
      { key: 'floor', header: 'floor' },
      { key: 'areaM2', header: 'areaM2' },
      { key: 'cadastralNumber', header: 'cadastralNumber' },
      { key: 'status', header: 'status' },
      { key: 'primaryContactName', header: 'primaryContactName' },
      { key: 'primaryContactPhone', header: 'primaryContactPhone' },
      { key: 'residentsCount', header: 'residentsCount' },
      { key: 'createdAt', header: 'createdAt' },
      { key: 'updatedAt', header: 'updatedAt' },
    ]);
  }

  private async readResidentCrmMetadata(organizationId: string): Promise<Record<string, any>> {
    const note = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: 'Resident CRM metadata' },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return {};
    try {
      const parsed = JSON.parse(note.content);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private adminResidentStatus(row: any, metadata: Record<string, any>) {
    const status = typeof metadata.status === 'string' ? metadata.status.toUpperCase() : '';
    if (['ACTIVE', 'INVITED', 'NOT_INVITED', 'INACTIVE'].includes(status)) return status;
    if (row.accountStatus === 'CREATED') return 'ACTIVE';
    if (row.accountStatus === 'INVITED') return 'INVITED';
    return 'NOT_INVITED';
  }

  async exportAdminResidentsCsv(user: MvpUser, query: Record<string, unknown>) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const [organization, metadata, residents] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, fiscalCode: true } }),
      this.readResidentCrmMetadata(organizationId),
      this.prisma.residentProfile.findMany({
        where: { organizationId },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          apartmentResidents: {
            include: { apartment: { select: { id: true, number: true, staircase: { select: { id: true, name: true } } } } },
          },
        },
      }),
    ]);
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
    const role = typeof query.role === 'string' && query.role.trim().toUpperCase() !== 'ALL' ? query.role.trim().toUpperCase() : '';
    const status = typeof query.status === 'string' && query.status.trim().toUpperCase() !== 'ALL' ? query.status.trim().toUpperCase() : '';
    const preferredContactMethod =
      typeof query.preferredContactMethod === 'string' && query.preferredContactMethod.trim().toUpperCase() !== 'ALL'
        ? query.preferredContactMethod.trim().toUpperCase()
        : '';
    const hasApartment = typeof query.hasApartment === 'string' ? query.hasApartment : '';
    const isPrimaryContact = typeof query.isPrimaryContact === 'string' ? query.isPrimaryContact : '';
    const rows = residents
      .map((resident: any) => {
        const rowMetadata = metadata[resident.id] || {};
        const apartments = resident.apartmentResidents || [];
        const fullName = this.residentFullName(resident);
        return {
          fullName,
          phone: resident.phone || '',
          email: resident.email || '',
          status: this.adminResidentStatus(resident, rowMetadata),
          preferredContactMethod: rowMetadata.preferredContactMethod || 'PHONE',
          apartmentNumbers: apartments.map((item: any) => item.apartment?.number).filter(Boolean).join(', '),
          roles: apartments.map((item: any) => item.role).filter(Boolean).join(', '),
          isPrimaryContactSomewhere: apartments.some((item: any) => item.isPrimary) ? 'da' : 'nu',
          createdAt: this.formatExportDate(resident.createdAt, 'datetime'),
          updatedAt: this.formatExportDate(resident.updatedAt, 'datetime'),
        };
      })
      .filter((row) => !search || `${row.fullName} ${row.phone} ${row.email} ${row.apartmentNumbers}`.toLowerCase().includes(search))
      .filter((row) => !role || row.roles.split(', ').includes(role) || (role === 'TENANT' && row.roles.includes('RESIDENT')))
      .filter((row) => !status || row.status === status)
      .filter((row) => !preferredContactMethod || row.preferredContactMethod === preferredContactMethod)
      .filter((row) => {
        if (hasApartment === 'true') return Boolean(row.apartmentNumbers);
        if (hasApartment === 'false') return !row.apartmentNumbers;
        return true;
      })
      .filter((row) => {
        if (isPrimaryContact === 'true') return row.isPrimaryContactSomewhere === 'da';
        if (isPrimaryContact === 'false') return row.isPrimaryContactSomewhere === 'nu';
        return true;
      });
    const associationCode = this.normalizeInvoiceCode(organization.fiscalCode || organization.name);
    return this.csvExportResult(user, organizationId, associationCode, 'RESIDENTS', 'residents', query, rows, [
      { key: 'fullName', header: 'fullName' },
      { key: 'phone', header: 'phone' },
      { key: 'email', header: 'email' },
      { key: 'status', header: 'status' },
      { key: 'preferredContactMethod', header: 'preferredContactMethod' },
      { key: 'apartmentNumbers', header: 'apartmentNumbers' },
      { key: 'roles', header: 'roles' },
      { key: 'isPrimaryContactSomewhere', header: 'isPrimaryContactSomewhere' },
      { key: 'createdAt', header: 'createdAt' },
      { key: 'updatedAt', header: 'updatedAt' },
    ]);
  }

  async getAdminExportHistory(user: MvpUser, query: Record<string, unknown>) {
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const exportType = typeof query.exportType === 'string' && query.exportType.trim() ? query.exportType.trim().toUpperCase() : '';
    const { dateFrom, dateTo } = this.exportDateRange(query);
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      action: { in: ['EXPORT_GENERATED', 'EXPORT_FAILED'] },
      ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const items = rows
      .map((row: any) => {
        const payload = row.newValuesJson && typeof row.newValuesJson === 'object' ? row.newValuesJson : {};
        const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
        return {
          id: row.id,
          exportType: metadata.exportType || '',
          format: metadata.format || 'CSV',
          filters: metadata.filters || {},
          rowsCount: metadata.rowsCount || 0,
          status: metadata.status || (row.action === 'EXPORT_FAILED' ? 'FAILED' : 'GENERATED'),
          fileName: metadata.fileName || '',
          actor: row.user ? { id: row.user.id, fullName: this.userDisplayName(row.user), email: row.user.email } : null,
          createdAt: row.createdAt,
        };
      })
      .filter((item) => !exportType || item.exportType === exportType);
    return { items, meta: { page, limit, total: exportType ? items.length : total } };
  }

  async getAdminExportOptions(user: MvpUser, query: Record<string, unknown>) {
    const { organizationId, metadata } = await this.financialReportContext(user, query);
    const [staircases] = await Promise.all([
      this.prisma.staircase.findMany({ where: { organizationId }, orderBy: { name: 'asc' }, select: { name: true } }),
    ]);
    const months = [...new Set(metadata.map((invoice) => invoice.billingMonth).filter(Boolean))].sort().reverse();
    return {
      availableBillingMonths: months,
      staircases: staircases.map((item) => item.name).filter(Boolean),
      invoiceStatuses: ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'VOID'],
      paymentMethods: ['CASH', 'BANK_TRANSFER', 'CARD_TERMINAL', 'INFOCOM', 'OPLATA', 'OTHER'],
      meterTypes: ['COLD_WATER', 'HOT_WATER', 'ELECTRICITY', 'GAS', 'HEAT', 'HEATING', 'OTHER'],
      residentRoles: ['OWNER', 'TENANT', 'RESIDENT', 'REPRESENTATIVE', 'FAMILY_MEMBER'],
    };
  }

  async generateMonthlyInvoices(user: MvpUser, body: unknown) {
    const input = this.parseGenerateMonthlyBody(body);
    const organizationId = this.resolveOrganizationId(user, body && typeof body === 'object' ? (body as Record<string, unknown>) : {});
    this.assertOrganizationAccess(user, organizationId);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const apartments = await this.prisma.apartment.findMany({
      where: {
        organizationId,
        status: { in: [ApartmentStatus.ACTIVE, ApartmentStatus.DEBTOR, ApartmentStatus.PROBLEM, ApartmentStatus.OCCUPIED] },
      },
      select: {
        id: true,
        number: true,
        areaM2: true,
      },
      orderBy: [{ number: 'asc' }],
    });

    if (!apartments.length) {
      throw new BadRequestException('Pentru a genera facturi, adaugă apartamente.');
    }

    const activeTariffs = (await this.readTariffRows(organizationId, apartments)).filter(
      (tariff) => tariff.status === 'ACTIVE' && tariff.periodicity === 'MONTHLY',
    );
    if (!activeTariffs.length) {
      throw new BadRequestException('Pentru a genera facturi, configurează tarifele.');
    }

    let createdInvoicesCount = 0;
    let skippedDuplicatesCount = 0;
    let totalAmount = 0;

    for (const apartment of apartments) {
      const existing = await this.prisma.invoice.findFirst({
        where: {
          organizationId,
          apartmentId: apartment.id,
          month: input.month,
          year: input.year,
        },
        select: { id: true },
      });

      if (existing) {
        skippedDuplicatesCount += 1;
        continue;
      }

      const areaM2 = Number(apartment.areaM2 || 0);
      const lineItems = activeTariffs
        .map((tariff) => {
          const amount = tariff.calculationType === 'PER_M2' ? this.money(areaM2 * tariff.amount) : this.money(tariff.amount);
          return {
            organizationId,
            apartmentId: apartment.id,
            month: input.month,
            year: input.year,
            tariffName: tariff.name,
            amount,
            status: 'PENDING',
            createdByUserId: user.id || null,
          };
        })
        .filter((line) => line.amount > 0);

      const invoiceAmount = this.money(lineItems.reduce((sum, line) => sum + line.amount, 0));
      if (invoiceAmount <= 0) {
        skippedDuplicatesCount += 1;
        continue;
      }

      const createdInvoice = await this.prisma.$transaction(async (tx) => {
        await tx.monthlyCharge.createMany({
          data: lineItems,
          skipDuplicates: true,
        });
        return tx.invoice.create({
          data: {
            organizationId,
            apartmentId: apartment.id,
            month: input.month,
            year: input.year,
            amount: invoiceAmount,
            finalAmount: invoiceAmount,
            discount: 0,
            plan: 'APC_MONTHLY_TARIFFS',
            status: InvoiceStatus.UNPAID,
            dueDate: input.dueDate,
          },
          select: { id: true },
        });
      });

      await this.activity.notifyApartmentResidents({
        organizationId,
        apartmentId: apartment.id,
        type: NotificationType.INVOICE,
        title: 'Factură emisă',
        message: `Factura pentru ${this.monthLabel(input.month, input.year)} a fost emisă pentru apartamentul ${apartment.number}.`,
        link: `/resident/invoices/${createdInvoice.id}`,
      });

      createdInvoicesCount += 1;
      totalAmount = this.money(totalAmount + invoiceAmount);
    }

    if (createdInvoicesCount > 0) {
      await this.activity.createActivity({
        organizationId,
        actorUserId: user.id,
        type: 'INVOICE_CREATED',
        title: `Facturi generate pentru ${this.monthLabel(input.month, input.year)}`,
        message: `Facturile pentru ${this.monthLabel(input.month, input.year)} au fost generate: ${createdInvoicesCount} create, ${skippedDuplicatesCount} omise.`,
        targetType: 'INVOICE',
        link: '/admin/invoices',
      });
    }

    return {
      createdCount: createdInvoicesCount,
      skippedCount: skippedDuplicatesCount,
      createdInvoicesCount,
      skippedDuplicatesCount,
      totalAmount,
      currency: 'MDL',
      month: input.month,
      year: input.year,
      apartmentsProcessed: apartments.length,
      message:
        skippedDuplicatesCount > 0
          ? 'Facturile au fost generate. Unele facturi existau deja și au fost omise.'
          : 'Facturile au fost generate.',
    };
  }

  async getMonthlySummary(user: MvpUser, query: Record<string, unknown>) {
    const month = this.requiredInt(query.month, 'Luna este obligatorie.');
    const year = this.requiredInt(query.year, 'Anul este obligatoriu.');
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    if (month < 1 || month > 12) throw new BadRequestException('Luna nu este validă.');

    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { organizationId, month, year },
        select: { amount: true, finalAmount: true, status: true, dueDate: true },
      }),
      this.prisma.payment.findMany({
        where: { organizationId, month: monthKey, status: PaymentStatus.CONFIRMED },
        select: { amount: true },
      }),
    ]);

    const totalIssued = this.money(invoices.reduce((sum, invoice) => sum + Number(invoice.finalAmount || invoice.amount || 0), 0));
    const totalPaid = this.money(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const unpaidInvoices = invoices.filter((invoice) => this.calculateInvoiceStatus(invoice) !== InvoiceStatus.PAID);
    const now = new Date();

    return {
      month,
      year,
      totalIssued,
      totalPaid,
      totalUnpaid: this.money(unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.finalAmount || invoice.amount || 0), 0)),
      overdueCount: invoices.filter((invoice) => this.calculateInvoiceStatus(invoice) === InvoiceStatus.OVERDUE).length,
      invoicesCount: invoices.length,
      currency: 'MDL',
    };
  }

  async listInvoices(user: MvpUser) {
    const invoices = await this.prisma.invoice.findMany({
      where: this.organizationWhere(user),
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      select: this.invoiceSelect(),
    });

    const notes = invoices.map((invoice) => this.invoicePaymentNote(invoice.id));
    const payments = notes.length
      ? await this.prisma.payment.findMany({
          where: {
            ...this.organizationWhere(user),
            note: { in: notes },
            status: PaymentStatus.CONFIRMED,
          },
          orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
          select: this.paymentSelect(),
        })
      : [];

    const chargeFilters = invoices
      .filter((invoice) => invoice.apartmentId && invoice.month && invoice.year)
      .map((invoice) => ({
        apartmentId: invoice.apartmentId as string,
        month: invoice.month as number,
        year: invoice.year as number,
      }));
    const charges = chargeFilters.length
      ? await this.prisma.monthlyCharge.findMany({
          where: {
            ...this.organizationWhere(user),
            OR: chargeFilters,
          },
          orderBy: { tariffName: 'asc' },
        })
      : [];

    return invoices.map((invoice) =>
      this.toInvoice(
        invoice,
        payments.filter((payment) => payment.note === this.invoicePaymentNote(invoice.id)).map((payment) => this.toPayment(payment)),
        charges.filter((charge) => charge.apartmentId === invoice.apartmentId && charge.month === invoice.month && charge.year === invoice.year),
      ),
    );
  }

  async createInvoice(user: MvpUser, body: unknown) {
    const input = this.parseCreateInvoiceBody(body);
    if (!this.isSuperadmin(user)) {
      input.organizationId = user.organizationId;
    }
    this.assertOrganizationAccess(user, input.organizationId);
    const [organization, apartment] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } }),
      this.prisma.apartment.findFirst({
        where: {
          id: input.apartmentId,
          organizationId: input.organizationId,
        },
        select: { id: true },
      }),
    ]);

    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (!apartment) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const duplicate = await this.prisma.invoice.findFirst({
      where: {
        organizationId: input.organizationId,
        apartmentId: input.apartmentId,
        month: input.month,
        year: input.year,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Factura pentru această lună există deja.');
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId: input.organizationId,
        apartmentId: input.apartmentId,
        month: input.month,
        year: input.year,
        amount: input.amount,
        finalAmount: input.amount,
        plan: 'APARTMENT_MONTHLY',
        status: input.status,
        dueDate: input.dueDate,
      },
      select: this.invoiceSelect(),
    });

    return this.toInvoice(invoice);
  }

  async getInvoice(user: MvpUser, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, ...this.organizationWhere(user) },
      select: this.invoiceSelect(),
    });

    if (!invoice) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    const payments = invoice.apartmentId
      ? await this.prisma.payment.findMany({
          where: {
            ...this.organizationWhere(user),
            apartmentId: invoice.apartmentId,
            note: this.invoicePaymentNote(invoice.id),
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: this.paymentSelect(),
        })
      : [];
    const services =
      invoice.apartmentId && invoice.month && invoice.year
        ? await this.prisma.monthlyCharge.findMany({
            where: {
              ...this.organizationWhere(user),
              apartmentId: invoice.apartmentId,
              month: invoice.month,
              year: invoice.year,
            },
            orderBy: { tariffName: 'asc' },
          })
        : [];

    return this.toInvoice(invoice, payments.map((payment) => this.toPayment(payment)), services);
  }

  async listPayments(user: MvpUser) {
    const payments = await this.prisma.payment.findMany({
      where: this.organizationWhere(user),
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      select: this.paymentSelect(),
    });

    return payments.map((payment) => this.toPayment(payment));
  }

  async createPayment(user: MvpUser, body: unknown) {
    const input = this.parseCreatePaymentBody(body);
    if (!this.isSuperadmin(user)) {
      input.organizationId = user.organizationId;
    }
    this.assertOrganizationAccess(user, input.organizationId);
    const [organization, apartment, invoice] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } }),
      this.prisma.apartment.findFirst({
        where: {
          id: input.apartmentId,
          organizationId: input.organizationId,
        },
        select: { id: true },
      }),
      input.invoiceId
        ? this.prisma.invoice.findFirst({
            where: {
              id: input.invoiceId,
              organizationId: input.organizationId,
              apartmentId: input.apartmentId,
            },
            select: {
              id: true,
              amount: true,
              finalAmount: true,
              status: true,
              month: true,
              year: true,
              dueDate: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (!apartment) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (input.invoiceId && !invoice) throw new NotFoundException('Factura selectată nu există.');

    const payment = await this.prisma.payment.create({
      data: {
        organizationId: input.organizationId,
        apartmentId: input.apartmentId,
        amount: input.amount,
        method: input.method,
        status: PaymentStatus.CONFIRMED,
        paidAt: input.paidAt,
        confirmedAt: input.paidAt,
        month: invoice?.month && invoice.year ? `${invoice.year}-${String(invoice.month).padStart(2, '0')}` : input.month,
        note: invoice ? this.invoicePaymentNote(invoice.id) : undefined,
      },
      select: this.paymentSelect(),
    });

    let updatedInvoiceStatus: InvoiceStatus | null = null;
    let updatedInvoice: ReturnType<BillingReadService['toInvoice']> | null = null;
    if (invoice) {
      const linkedPayments = await this.prisma.payment.findMany({
        where: {
          organizationId: input.organizationId,
          apartmentId: input.apartmentId,
          note: this.invoicePaymentNote(invoice.id),
          status: PaymentStatus.CONFIRMED,
        },
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        select: this.paymentSelect(),
      });
      const nextStatus = this.calculateInvoiceStatus(invoice, linkedPayments);
      const updated = await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: nextStatus,
          paidAt: nextStatus === InvoiceStatus.PAID ? input.paidAt : null,
        },
        select: this.invoiceSelect(),
      });
      updatedInvoiceStatus = updated.status;
      updatedInvoice = this.toInvoice(updated, linkedPayments.map((item) => this.toPayment(item)));
    }

    await this.activity.createActivity({
      organizationId: input.organizationId,
      actorUserId: user.id,
      type: 'PAYMENT_REGISTERED',
      title: 'Plată înregistrată',
      message: `Plata de ${this.money(input.amount).toLocaleString('ro-RO')} MDL a fost înregistrată.`,
      targetType: 'PAYMENT',
      targetId: payment.id,
      link: '/admin/payments',
    });

    await this.activity.notifyApartmentResidents({
      organizationId: input.organizationId,
      apartmentId: input.apartmentId,
      type: NotificationType.PAYMENT,
      title: 'Plată înregistrată',
      message: `A fost înregistrată o plată de ${this.money(input.amount).toLocaleString('ro-RO')} MDL pentru apartamentul tău.`,
      link: `/resident/payments/${payment.id}`,
    });

    return {
      ...this.toPayment(payment),
      linkedInvoiceId: invoice?.id ?? null,
      invoiceStatus: updatedInvoiceStatus,
      updatedInvoiceStatus,
      updatedInvoice,
    };
  }

  async getPayment(user: MvpUser, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, ...this.organizationWhere(user) },
      select: this.paymentSelect(),
    });

    if (!payment) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    return this.toPayment(payment);
  }

  async updateInvoiceStatus(user: MvpUser, id: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const status = this.optionalEnum(payload.status, InvoiceStatus, InvoiceStatus.UNPAID, 'Statusul facturii nu este valid.');
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, ...this.organizationWhere(user) },
      select: { id: true, status: true },
    });
    if (!invoice) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status,
        paidAt: status === InvoiceStatus.PAID ? new Date() : null,
      },
      select: this.invoiceSelect(),
    });

    return this.toInvoice(updated);
  }

  async getSummary(user: MvpUser) {
    return this.getFinanceOverview(user);
  }

  async getFinanceOverview(user: MvpUser) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: this.organizationWhere(user),
        select: {
          id: true,
          apartmentId: true,
          month: true,
          year: true,
          amount: true,
          finalAmount: true,
          status: true,
          dueDate: true,
        },
      }),
      this.prisma.payment.findMany({
        where: {
          ...this.organizationWhere(user),
          status: PaymentStatus.CONFIRMED,
        },
        select: {
          amount: true,
          status: true,
          month: true,
          note: true,
        },
      }),
    ]);

    const totalIssued = this.money(invoices.reduce((sum, invoice) => sum + this.invoiceAmount(invoice), 0));
    const totalPaid = this.confirmedPaymentTotal(payments);
    const totalDebt = this.money(Math.max(totalIssued - totalPaid, 0));
    const overdueInvoices = invoices.filter((invoice) => {
      const linkedPayments = payments.filter((payment) => payment.note === this.invoicePaymentNote(invoice.id));
      return this.calculateInvoiceStatus(invoice, linkedPayments) === InvoiceStatus.OVERDUE;
    });
    const apartmentsWithDebt = new Set(
      invoices
        .filter((invoice) => {
          const linkedPayments = payments.filter((payment) => payment.note === this.invoicePaymentNote(invoice.id));
          return this.calculateInvoiceStatus(invoice, linkedPayments) !== InvoiceStatus.PAID;
        })
        .map((invoice) => invoice.apartmentId)
        .filter(Boolean),
    ).size;
    const currentMonthInvoices = invoices.filter((invoice) => invoice.month === currentMonth && invoice.year === currentYear);
    const currentMonthIssued = this.money(currentMonthInvoices.reduce((sum, invoice) => sum + this.invoiceAmount(invoice), 0));
    const currentMonthPaid = this.confirmedPaymentTotal(payments.filter((payment) => payment.month === currentMonthKey));
    const collectionRate = totalIssued > 0 ? this.money((totalPaid / totalIssued) * 100) : 0;

    return {
      totalIssued,
      totalPaid,
      totalDebt,
      overdueInvoices: overdueInvoices.length,
      apartmentsWithDebt,
      collectionRate,
      currentMonthIssued,
      currentMonthPaid,
      unpaidInvoices: invoices.filter((invoice) => {
        const linkedPayments = payments.filter((payment) => payment.note === this.invoicePaymentNote(invoice.id));
        return this.calculateInvoiceStatus(invoice, linkedPayments) !== InvoiceStatus.PAID;
      }).length,
      currency: 'MDL',
    };
  }

  private parseCreateInvoiceBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.requiredString(payload.organizationId, 'Organizația este obligatorie.');
    const apartmentId = this.requiredString(payload.apartmentId, 'Apartamentul este obligatoriu.');
    const month = this.requiredInt(payload.month, 'Luna este obligatorie.');
    const year = this.requiredInt(payload.year, 'Anul este obligatoriu.');
    const amount = this.requiredNumber(payload.amount, 'Suma facturii trebuie să fie pozitivă.');
    const status = this.optionalEnum(payload.status, InvoiceStatus, InvoiceStatus.UNPAID, 'Statusul facturii nu este valid.');
    const dueDate = this.requiredDate(payload.dueDate, 'Data scadentă este obligatorie.');

    if (month < 1 || month > 12) throw new BadRequestException('Luna nu este validă.');
    if (year < 2000 || year > 2100) throw new BadRequestException('Anul nu este valid.');
    if (amount <= 0) throw new BadRequestException('Suma facturii trebuie să fie pozitivă.');

    return { organizationId, apartmentId, month, year, amount, status, dueDate };
  }

  private parseCreatePaymentBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.requiredString(payload.organizationId, 'Organizația este obligatorie.');
    const apartmentId = this.requiredString(payload.apartmentId, 'Apartamentul este obligatoriu.');
    const invoiceId = typeof payload.invoiceId === 'string' && payload.invoiceId.trim() ? payload.invoiceId.trim() : null;
    const amount = this.requiredNumber(payload.amount, 'Suma plății trebuie să fie mai mare decât 0.');
    const method = this.parsePaymentMethod(payload.method);
    const paidAt =
      typeof payload.paidAt === 'string' && payload.paidAt.trim()
        ? this.requiredDate(payload.paidAt, 'Data plății nu este validă.')
        : new Date();
    const month = `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, '0')}`;

    if (amount <= 0) throw new BadRequestException('Suma plății trebuie să fie mai mare decât 0.');

    return { organizationId, apartmentId, invoiceId, amount, method, paidAt, month };
  }

  private parsePaymentMethod(value: unknown) {
    if (value === undefined || value === null || value === '') return PaymentMethod.CASH;
    if (typeof value !== 'string') throw new BadRequestException('Metoda de plată nu este validă.');
    const normalized = value.trim().toUpperCase();
    if (normalized === 'OTHER') return PaymentMethod.BANK;
    if (normalized === 'BANK_TRANSFER') return PaymentMethod.BANK_TRANSFER;
    if (normalized === 'CASH') return PaymentMethod.CASH;
    if (normalized === 'CARD') return PaymentMethod.CARD;
    throw new BadRequestException('Metoda de plată nu este validă.');
  }

  private async assertOrganizationExists(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }
  }

  private parseTariffCalculationType(value: unknown): TariffCalculationType {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (normalized === 'PER_M2') return 'PER_M2';
    if (normalized === 'FIXED' || normalized === 'FIXED_PER_APARTMENT') return 'FIXED_PER_APARTMENT';
    if (normalized === 'PER_METER_CONSUMPTION' || normalized === 'METER_CONSUMPTION') return 'PER_METER_CONSUMPTION';
    if (normalized === 'MANUAL' || !normalized) return 'MANUAL';
    throw new BadRequestException('Tipul calculului este obligatoriu.');
  }

  private parseTariffStatus(value: unknown): TariffStatus {
    const normalized = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : 'DRAFT';
    if (['DRAFT', 'ACTIVE', 'INACTIVE'].includes(normalized)) return normalized as TariffStatus;
    throw new BadRequestException('Statusul tarifului nu este valid.');
  }

  private parseTariffPeriodicity(value: unknown): TariffPeriodicity {
    const normalized = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : 'MONTHLY';
    if (normalized === 'MONTHLY' || normalized === 'ONE_TIME') return normalized;
    throw new BadRequestException('Periodicitatea nu este validă.');
  }

  private parseTariffAppliesTo(value: unknown): TariffAppliesTo {
    const normalized = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : 'ALL_APARTMENTS';
    if (['ALL_APARTMENTS', 'ONLY_OCCUPIED', 'CUSTOM_SELECTION'].includes(normalized)) return normalized as TariffAppliesTo;
    throw new BadRequestException('Aplicabilitatea nu este validă.');
  }

  private parseMissingReadingPolicy(value: unknown): MeterTariffMissingReadingPolicy {
    const normalized = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : 'SKIP_WITH_WARNING';
    if (['SKIP_WITH_WARNING', 'ZERO_WITH_WARNING', 'BLOCK_DRAFT'].includes(normalized)) {
      return normalized as MeterTariffMissingReadingPolicy;
    }
    throw new BadRequestException('Politica pentru indici lipsă nu este validă.');
  }

  private normalizeMeterTypeForTariff(value: unknown) {
    const normalized = this.requiredString(value, 'Tipul contorului este obligatoriu.').trim().toUpperCase();
    if (normalized === 'HEATING') return 'HEAT';
    if (['COLD_WATER', 'HOT_WATER', 'ELECTRICITY', 'GAS', 'HEAT', 'OTHER'].includes(normalized)) return normalized;
    throw new BadRequestException('Tipul contorului nu este valid.');
  }

  private meterTypeForPrisma(value: unknown) {
    const normalized = String(value || '').toUpperCase();
    return normalized === 'HEAT' ? 'HEATING' : normalized;
  }

  private meterTypeExternal(value: unknown) {
    const normalized = String(value || '').toUpperCase();
    return normalized === 'HEATING' ? 'HEAT' : normalized;
  }

  private defaultMeterUnit(value: unknown) {
    const normalized = String(value || '').toUpperCase();
    if (normalized === 'ELECTRICITY') return 'kWh';
    if (normalized === 'HEAT' || normalized === 'HEATING') return 'Gcal';
    if (normalized === 'OTHER') return 'unitate';
    return 'm³';
  }

  private async readMeterWorkflowMetadata(organizationId: string): Promise<{
    meters: Record<string, any>;
    readings: Record<string, any>;
  }> {
    const note = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: METER_WORKFLOW_METADATA_NOTE_TITLE },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return { meters: {}, readings: {} };
    try {
      const parsed = JSON.parse(note.content);
      return {
        meters: parsed && typeof parsed.meters === 'object' && !Array.isArray(parsed.meters) ? parsed.meters : {},
        readings: parsed && typeof parsed.readings === 'object' && !Array.isArray(parsed.readings) ? parsed.readings : {},
      };
    } catch {
      return { meters: {}, readings: {} };
    }
  }

  private readingMetadataForCharge(store: { readings: Record<string, any>; meters: Record<string, any> }, row: any) {
    const raw = store.readings?.[row.id] || {};
    const status = this.normalizeMeterReadingStatus(raw.status) || 'APPROVED';
    const periodMonth = raw.periodMonth || new Date(row.readingDate).toISOString().slice(0, 7);
    const unit = raw.unit || store.meters?.[row.meterId]?.unit || this.defaultMeterUnit(row.meter?.type);
    return {
      ...raw,
      status,
      periodMonth,
      unit,
      previousReadingValue: raw.previousReadingValue === undefined || raw.previousReadingValue === null ? null : Number(raw.previousReadingValue),
      consumptionValue: raw.consumptionValue === undefined || raw.consumptionValue === null ? null : Number(raw.consumptionValue),
    };
  }

  private normalizeMeterReadingStatus(value: unknown): MeterReadingWorkflowStatus | null {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW', 'CANCELLED'].includes(normalized)) {
      return normalized as MeterReadingWorkflowStatus;
    }
    return null;
  }

  private currentBillingMonth() {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private formatMeterFormula(quantity: number, unit: string, unitPrice: number) {
    return `${quantity.toLocaleString('ro-RO')} ${unit || 'unitate'} × ${unitPrice.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MDL`;
  }

  private meterTypeLabel(value: unknown) {
    const labels: Record<string, string> = {
      COLD_WATER: 'Apă rece',
      HOT_WATER: 'Apă caldă',
      ELECTRICITY: 'Electricitate',
      GAS: 'Gaz',
      HEAT: 'Căldură',
      HEATING: 'Căldură',
      OTHER: 'Altul',
    };
    return labels[String(value || '').toUpperCase()] || 'Contor';
  }

  private optionalDateString(value: unknown, message: string) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') throw new BadRequestException(message);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(message);
    return value.slice(0, 10);
  }

  private parseTariffPayload(payload: Record<string, unknown>, _isUpdate = false) {
    const name = this.requiredString(payload.name, 'Numele tarifului este obligatoriu.');
    const calculationType = this.parseTariffCalculationType(payload.calculationType || payload.type);
    const internalCode =
      typeof payload.internalCode === 'string' && payload.internalCode.trim()
        ? payload.internalCode.trim().toUpperCase()
        : typeof payload.code === 'string' && payload.code.trim()
          ? payload.code.trim().toUpperCase()
          : '';
    const description = typeof payload.description === 'string' ? payload.description.trim() : '';
    const status =
      payload.status === undefined && payload.isActive !== undefined
        ? payload.isActive
          ? 'ACTIVE'
          : 'INACTIVE'
        : this.parseTariffStatus(payload.status || 'DRAFT');
    const periodicity = this.parseTariffPeriodicity(payload.periodicity || 'MONTHLY');
    const appliesTo = this.parseTariffAppliesTo(payload.appliesTo || 'ALL_APARTMENTS');
    const startsAt = this.optionalDateString(payload.startsAt, 'Data activării nu este validă.');
    const endsAt = this.optionalDateString(payload.endsAt, 'Data finală nu este validă.');
    if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
      throw new BadRequestException('Data activării nu poate fi după data finală.');
    }

    const pricePerM2 =
      calculationType === 'PER_M2'
        ? this.requiredNumber(payload.pricePerM2 ?? payload.amount, 'Valoarea per m² trebuie să fie un număr pozitiv.')
        : null;
    const fixedAmount =
      calculationType === 'FIXED_PER_APARTMENT'
        ? this.requiredNumber(payload.fixedAmount ?? payload.amount, 'Suma fixă trebuie să fie un număr pozitiv.')
        : null;
    const defaultManualAmount =
      calculationType === 'MANUAL' && payload.defaultManualAmount !== undefined && payload.defaultManualAmount !== null && payload.defaultManualAmount !== ''
        ? this.requiredNumber(payload.defaultManualAmount, 'Suma manuală trebuie să fie un număr pozitiv.')
        : null;
    const meterType = calculationType === 'PER_METER_CONSUMPTION' ? this.normalizeMeterTypeForTariff(payload.meterType) : null;
    const pricePerUnit =
      calculationType === 'PER_METER_CONSUMPTION'
        ? this.requiredNumber(payload.pricePerUnit ?? payload.amount, 'Prețul per unitate trebuie să fie un număr pozitiv.')
        : null;
    const unit =
      calculationType === 'PER_METER_CONSUMPTION'
        ? String(payload.unit || this.defaultMeterUnit(meterType)).trim()
        : undefined;
    const missingReadingPolicy =
      calculationType === 'PER_METER_CONSUMPTION'
        ? this.parseMissingReadingPolicy(payload.missingReadingPolicy || 'SKIP_WITH_WARNING')
        : undefined;
    if (pricePerM2 !== null && pricePerM2 <= 0) throw new BadRequestException('Valoarea per m² trebuie să fie pozitivă.');
    if (fixedAmount !== null && fixedAmount <= 0) throw new BadRequestException('Suma fixă trebuie să fie pozitivă.');
    if (defaultManualAmount !== null && defaultManualAmount < 0) throw new BadRequestException('Suma manuală trebuie să fie pozitivă.');
    if (pricePerUnit !== null && pricePerUnit <= 0) throw new BadRequestException('Prețul per unitate trebuie să fie pozitiv.');
    if (calculationType === 'PER_METER_CONSUMPTION' && !unit) throw new BadRequestException('Unitatea este obligatorie.');

    return {
      name,
      internalCode,
      description,
      calculationType,
      pricePerM2,
      fixedAmount,
      defaultManualAmount,
      meterType,
      unit,
      pricePerUnit,
      currency: 'MDL',
      periodicity,
      status,
      appliesTo,
      includeInMonthlyEstimate: payload.includeInMonthlyEstimate !== false,
      includeInDraftInvoices: payload.includeInDraftInvoices !== false,
      visibleToResidents: payload.visibleToResidents !== false,
      requiresApprovedReading: payload.requiresApprovedReading !== false,
      missingReadingPolicy,
      startsAt,
      endsAt,
      internalNotes: typeof payload.internalNotes === 'string' ? payload.internalNotes.trim() : '',
    };
  }

  private assertNoActiveTariffCodeDuplicate(rows: TariffRow[], internalCode: string, status: TariffStatus, currentId?: string) {
    if (!internalCode || status !== 'ACTIVE') return;
    const duplicate = rows.find((row) => row.id !== currentId && row.status === 'ACTIVE' && row.internalCode === internalCode);
    if (duplicate) {
      throw new ConflictException('Există deja un tarif activ cu acest cod intern.');
    }
  }

  private resolveTariffId(payload: Record<string, unknown>, explicitId?: string): SupportedTariffId {
    const raw = String(explicitId || payload.id || payload.code || payload.tariffType || payload.name || '').trim();
    const normalized = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    if (normalized.includes('DESERVIRE') || normalized.includes('INTRETINERE') || normalized.includes('MAINTENANCE')) {
      return 'DESERVIRE_BLOC_PER_M2';
    }
    if (normalized.includes('REPAR')) {
      return 'FOND_REPARATIE_PER_M2';
    }
    if (normalized.includes('DEZVOLT') || normalized.includes('INVEST')) {
      return 'FOND_DEZVOLTARE_FIXED';
    }
    if (normalized in SUPPORTED_TARIFFS) {
      return normalized as SupportedTariffId;
    }

    throw new BadRequestException(
      'Schema curentă permite tarifele Deservire bloc, Fond reparație și Fond dezvoltare. Tarifele extra vor fi adăugate într-o etapă următoare.',
    );
  }

  private parseGenerateMonthlyBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const month = this.requiredInt(payload.month, 'Luna este obligatorie.');
    const year = this.requiredInt(payload.year, 'Anul este obligatoriu.');
    const dueDate =
      typeof payload.dueDate === 'string' && payload.dueDate.trim()
        ? this.requiredDate(payload.dueDate, 'Data scadentă nu este validă.')
        : new Date(year, month - 1, 25);

    if (month < 1 || month > 12) throw new BadRequestException('Luna nu este validă.');
    if (year < 2000 || year > 2100) throw new BadRequestException('Anul nu este valid.');

    return { month, year, dueDate };
  }

  private money(value: number) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  private groupBy<T>(items: T[], keyFn: (item: T) => string) {
    const grouped = new Map<string, T[]>();
    items.forEach((item) => {
      const key = keyFn(item);
      grouped.set(key, [...(grouped.get(key) || []), item]);
    });
    return grouped;
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(message);
    return value.trim();
  }

  private requiredNumber(value: unknown, message: string) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException(message);
    return parsed;
  }

  private requiredInt(value: unknown, message: string) {
    const parsed = this.requiredNumber(value, message);
    if (!Number.isInteger(parsed)) throw new BadRequestException(message);
    return parsed;
  }

  private requiredDate(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(message);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException(message);
    return parsed;
  }

  private optionalEnum<T extends Record<string, string>>(value: unknown, enumValues: T, fallback: T[keyof T], message: string) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') throw new BadRequestException(message);
    const normalized = value.trim().toUpperCase();
    const allowed = Object.values(enumValues) as string[];
    if (!allowed.includes(normalized)) throw new BadRequestException(message);
    return normalized as T[keyof T];
  }
}
