import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApartmentStatus, InvoiceStatus, NotificationType, PaymentMethod, PaymentStatus, Prisma, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type SupportedTariffId = 'DESERVIRE_BLOC_PER_M2' | 'FOND_REPARATIE_PER_M2' | 'FOND_DEZVOLTARE_FIXED';
type TariffCalculationType = 'PER_M2' | 'FIXED_PER_APARTMENT' | 'MANUAL';
type TariffStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
type TariffPeriodicity = 'MONTHLY' | 'ONE_TIME';
type TariffAppliesTo = 'ALL_APARTMENTS' | 'ONLY_OCCUPIED' | 'CUSTOM_SELECTION';
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
  amount: number;
  currency: 'MDL';
  periodicity: TariffPeriodicity;
  status: TariffStatus;
  isActive: boolean;
  appliesTo: TariffAppliesTo;
  includeInMonthlyEstimate: boolean;
  visibleToResidents: boolean;
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
  lineType: 'TARIFF' | 'MANUAL' | 'ADJUSTMENT';
  tariffId: string | null;
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
  summary: Record<string, unknown>;
  tariffsUsed: Array<Record<string, unknown>>;
  items: BillingDraftItem[];
  warnings: string[];
};

const TARIFF_METADATA_NOTE_TITLE = 'Tariff settings metadata';
const BILLING_DRAFT_NOTE_TITLE = 'Internal invoice draft metadata';

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
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      invoiceId: row.invoiceId,
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
      method,
      status: row.status,
      paidAt: row.paidAt ?? row.confirmedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      month: row.month,
      note: row.note,
    };
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
    return Number(row.defaultManualAmount || 0);
  }

  private tariffUnit(row: Pick<TariffRow, 'calculationType'>) {
    if (row.calculationType === 'PER_M2') return 'MDL/m²';
    if (row.calculationType === 'FIXED_PER_APARTMENT') return 'MDL/apartament';
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
    return this.money(affectedApartments * Number(row.defaultManualAmount || 0));
  }

  private normalizeTariffRow(raw: any, organizationId: string, apartments: Array<{ areaM2?: number | null; status?: ApartmentStatus | string | null }>): TariffRow {
    const now = new Date().toISOString();
    const calculationType = this.parseTariffCalculationType(raw.calculationType || raw.type || (raw.pricePerM2 ? 'PER_M2' : raw.fixedAmount ? 'FIXED_PER_APARTMENT' : 'MANUAL'));
    const status = this.parseTariffStatus(raw.status || (raw.isActive ? 'ACTIVE' : 'DRAFT'));
    const periodicity = this.parseTariffPeriodicity(raw.periodicity || 'MONTHLY');
    const appliesTo = this.parseTariffAppliesTo(raw.appliesTo || 'ALL_APARTMENTS');
    const pricePerM2 = calculationType === 'PER_M2' ? this.money(Number(raw.pricePerM2 ?? raw.amount ?? 0)) : null;
    const fixedAmount = calculationType === 'FIXED_PER_APARTMENT' ? this.money(Number(raw.fixedAmount ?? raw.amount ?? 0)) : null;
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
      amount: 0,
      currency: 'MDL',
      periodicity,
      status,
      isActive: status === 'ACTIVE',
      appliesTo,
      includeInMonthlyEstimate: raw.includeInMonthlyEstimate !== false,
      visibleToResidents: raw.visibleToResidents !== false,
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
        currency: row.currency,
        periodicity: row.periodicity,
        status: row.status,
        appliesTo: row.appliesTo,
        includeInMonthlyEstimate: row.includeInMonthlyEstimate,
        visibleToResidents: row.visibleToResidents,
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
    return { billingMonth, dueDate, description };
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
    if (lines.some((line) => line.status === 'ERROR')) return 'ERROR';
    if (warnings.length || lines.some((line) => line.status === 'WARNING')) return 'WARNING';
    return 'READY';
  }

  private draftTotals(items: BillingDraftItem[]) {
    const includedItems = items.filter((item) => item.status !== 'EXCLUDED');
    return {
      totalAmount: this.money(includedItems.reduce((sum, item) => sum + item.total, 0)),
      apartmentsCount: items.length,
      calculatedApartments: includedItems.filter((item) => item.status === 'READY' || item.status === 'WARNING').length,
      warningsCount: items.filter((item) => item.status === 'WARNING').length,
      errorsCount: items.filter((item) => item.status === 'ERROR').length,
    };
  }

  private draftResponse(draft: BillingDraftRecord) {
    const totals = this.draftTotals(draft.items);
    const manualExcluded = Number(draft.summary?.manualServicesExcluded || 0);
    return {
      ...draft,
      associationId: draft.organizationId,
      totalAmount: totals.totalAmount,
      apartmentsCount: totals.apartmentsCount,
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

  private async calculateDraftRecord(
    user: MvpUser,
    input: { billingMonth: string; dueDate: string | null; description: string },
    existing?: BillingDraftRecord | null,
  ): Promise<BillingDraftRecord> {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const { organization, apartments } = await this.invoiceDraftContext(organizationId);
    const tariffRows = await this.readTariffRows(organizationId, apartments);
    const tariffsActiveInPeriod = tariffRows.filter((tariff) => this.isTariffActiveForBillingMonth(tariff, input.billingMonth));
    const tariffsUsed = tariffsActiveInPeriod.filter((tariff) => {
      if (!tariff.includeInMonthlyEstimate) return false;
      if (tariff.calculationType === 'MANUAL') return Number(tariff.defaultManualAmount || 0) > 0;
      return true;
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
      const lines: BillingDraftLine[] = tariffsUsed
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
          };
        });
      if (!lines.length && tariffsUsed.length === 0) {
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
    ];
    const now = new Date().toISOString();
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
      summary: {
        billingMonth: input.billingMonth,
        currency: 'MDL',
        totalApartments: totals.apartmentsCount,
        calculatedApartments: totals.calculatedApartments,
        totalAmount: totals.totalAmount,
        warningsCount: totals.warningsCount,
        errorsCount: totals.errorsCount,
        activeTariffsUsed: tariffsUsed.length,
        apartmentsWithoutArea: apartments.filter((apartment) => !apartment.areaM2 || Number(apartment.areaM2) <= 0).length,
        perM2Services: tariffsUsed.filter((tariff) => tariff.calculationType === 'PER_M2').length,
        fixedServices: tariffsUsed.filter((tariff) => tariff.calculationType === 'FIXED_PER_APARTMENT').length,
        manualServicesExcluded,
      },
      tariffsUsed: tariffsUsed.map((tariff) => ({
        id: tariff.id,
        name: tariff.name,
        calculationType: tariff.calculationType,
        pricePerM2: tariff.pricePerM2,
        fixedAmount: tariff.fixedAmount,
        defaultManualAmount: tariff.defaultManualAmount,
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

  private async writeBillingDrafts(organizationId: string, actorUserId: string, drafts: BillingDraftRecord[]) {
    const payload = { version: 1, items: drafts };
    const existing = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: BILLING_DRAFT_NOTE_TITLE },
      select: { id: true },
    });
    const content = JSON.stringify(payload);
    if (existing) {
      await this.prisma.clientNote.update({ where: { id: existing.id }, data: { content } });
    } else {
      await this.prisma.clientNote.create({
        data: {
          organizationId,
          createdByUserId: actorUserId,
          title: BILLING_DRAFT_NOTE_TITLE,
          content,
        },
      });
    }
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
    const draft = drafts.find((item) => item.id === id && item.status !== 'CANCELLED');
    if (!draft) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return this.draftResponse(draft);
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
    const calculated = await this.calculateDraftRecord(user, input, existing);
    const nextDrafts = existing ? drafts.map((draft) => (draft.id === existing.id ? calculated : draft)) : [...drafts, calculated];
    await this.writeBillingDrafts(organizationId, user.id, nextDrafts);
    return this.draftResponse(calculated);
  }

  async recalculateInvoiceDraft(user: MvpUser, id: string, body: unknown) {
    const organizationId = this.resolveOrganizationId(user, body && typeof body === 'object' ? (body as Record<string, unknown>) : {});
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const existing = drafts.find((draft) => draft.id === id && draft.status !== 'CANCELLED');
    if (!existing) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const input = this.parseDraftPayload({
      billingMonth: payload.billingMonth || existing.billingMonth,
      dueDate: payload.dueDate === undefined ? existing.dueDate : payload.dueDate,
      description: payload.description === undefined ? existing.description : payload.description,
    });
    const calculated = await this.calculateDraftRecord(user, input, existing);
    const nextDrafts = drafts.map((draft) => (draft.id === id ? calculated : draft));
    await this.writeBillingDrafts(organizationId, user.id, nextDrafts);
    return this.draftResponse(calculated);
  }

  async updateInvoiceDraftLineStatus(user: MvpUser, id: string, lineId: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const statusValue = typeof payload.status === 'string' ? payload.status.trim().toUpperCase() : '';
    if (statusValue !== 'READY' && statusValue !== 'EXCLUDED') {
      throw new BadRequestException('Statusul liniei nu este valid.');
    }
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const draft = drafts.find((item) => item.id === id && item.status !== 'CANCELLED');
    if (!draft) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    let changed = false;
    const updatedItems = draft.items.map((item) => {
      if (item.id === lineId || item.apartmentId === lineId) {
        changed = true;
        return { ...item, status: statusValue as BillingDraftLineStatus, updatedAt: new Date().toISOString() };
      }
      const updatedLines = item.lines.map((line) => {
        if (line.id !== lineId) return line;
        changed = true;
        return { ...line, status: statusValue as BillingDraftLineStatus };
      });
      return { ...item, lines: updatedLines };
    });
    if (!changed) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const updatedDraft = this.draftResponse({ ...draft, items: updatedItems, updatedAt: new Date().toISOString() }) as BillingDraftRecord;
    const nextDrafts = drafts.map((item) => (item.id === id ? updatedDraft : item));
    await this.writeBillingDrafts(organizationId, user.id, nextDrafts);
    return this.draftResponse(updatedDraft);
  }

  async cancelInvoiceDraft(user: MvpUser, id: string) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const drafts = await this.readBillingDrafts(organizationId);
    const draft = drafts.find((item) => item.id === id && item.status !== 'CANCELLED');
    if (!draft) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const cancelled = { ...draft, status: 'CANCELLED' as BillingDraftStatus, updatedAt: new Date().toISOString() };
    const nextDrafts = drafts.map((item) => (item.id === id ? cancelled : item));
    await this.writeBillingDrafts(organizationId, user.id, nextDrafts);
    return { id, status: 'CANCELLED', message: 'Draftul a fost anulat.' };
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
      link: '/resident/payments',
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
    if (pricePerM2 !== null && pricePerM2 <= 0) throw new BadRequestException('Valoarea per m² trebuie să fie pozitivă.');
    if (fixedAmount !== null && fixedAmount <= 0) throw new BadRequestException('Suma fixă trebuie să fie pozitivă.');
    if (defaultManualAmount !== null && defaultManualAmount < 0) throw new BadRequestException('Suma manuală trebuie să fie pozitivă.');

    return {
      name,
      internalCode,
      description,
      calculationType,
      pricePerM2,
      fixedAmount,
      defaultManualAmount,
      currency: 'MDL',
      periodicity,
      status,
      appliesTo,
      includeInMonthlyEstimate: payload.includeInMonthlyEstimate !== false,
      visibleToResidents: payload.visibleToResidents !== false,
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
