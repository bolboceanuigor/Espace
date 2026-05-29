import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingDraftInvoiceStatus,
  BillingPeriodStatus,
  MeterReadingPeriodStatus,
  MeterStatus,
  MeterType,
  Prisma,
  UtilityTariffType,
  UtilityTariffUnit,
} from '@prisma/client';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type BillingIssueSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
type BillingIssueType =
  | 'MISSING_TARIFF'
  | 'MISSING_READING'
  | 'NEGATIVE_CONSUMPTION'
  | 'ZERO_CONSUMPTION'
  | 'HIGH_CONSUMPTION'
  | 'APARTMENT_WITHOUT_OWNER'
  | 'APARTMENT_WITHOUT_RESIDENT'
  | 'APARTMENT_WITHOUT_SURFACE'
  | 'INVOICE_WITHOUT_LINES'
  | 'DUPLICATE_INVOICE'
  | 'PERIOD_ALREADY_PUBLISHED';

type BillingDraftIssue = {
  id: string;
  type: BillingIssueType;
  severity: BillingIssueSeverity;
  blocking: boolean;
  title: string;
  recommendation: string;
  apartment?: { id: string; number: string; building?: string | null; entrance?: string | null } | null;
  meter?: { id: string; type: string; serialNumber?: string | null } | null;
  invoice?: { id: string; status: string; total: number } | null;
  currentValue?: number | null;
  previousValue?: number | null;
};

type PeriodWithReading = Prisma.BillingPeriodGetPayload<{
  include: {
    meterReadingPeriod: true;
  };
}>;

type ApartmentForBilling = Prisma.ApartmentGetPayload<{
  include: {
    building: { select: { id: true; name: true } };
    staircase: { select: { id: true; name: true } };
    ownerResident: true;
    apartmentResidents: { include: { resident: true } };
  };
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requiredString(value: unknown, label: string) {
  const trimmed = optionalString(value);
  if (!trimmed) throw new BadRequestException(`${label} este obligatoriu.`);
  return trimmed;
}

function optionalBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function parsePositiveInt(value: unknown, label: string, fallback?: number) {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw new BadRequestException(`${label} este obligatoriu.`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new BadRequestException(`${label} trebuie să fie un număr pozitiv.`);
  return parsed;
}

function parseMonth(value: unknown) {
  const month = parsePositiveInt(value, 'Luna');
  if (month < 1 || month > 12) throw new BadRequestException('Luna trebuie să fie între 1 și 12.');
  return month;
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Data trimisă nu este validă.');
  return date;
}

function numberFromDecimal(value: unknown) {
  if (value && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function quantity(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function fullName(resident?: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null } | null) {
  const name = [resident?.firstName, resident?.lastName].filter(Boolean).join(' ').trim();
  return name || resident?.email || resident?.phone || null;
}

function periodStart(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

function meterTypeToTariffType(type: MeterType) {
  const map: Record<MeterType, UtilityTariffType> = {
    COLD_WATER: UtilityTariffType.COLD_WATER,
    HOT_WATER: UtilityTariffType.HOT_WATER,
    ELECTRICITY: UtilityTariffType.ELECTRICITY,
    GAS: UtilityTariffType.GAS,
    HEATING: UtilityTariffType.HEATING,
    OTHER: UtilityTariffType.OTHER,
  };
  return map[type] || UtilityTariffType.OTHER;
}

function tariffTypeLabel(type: UtilityTariffType) {
  const labels: Record<UtilityTariffType, string> = {
    COLD_WATER: 'Apă rece',
    HOT_WATER: 'Apă caldă',
    ELECTRICITY: 'Electricitate',
    GAS: 'Gaz',
    HEATING: 'Încălzire',
    MAINTENANCE: 'Întreținere',
    ELEVATOR: 'Lift',
    REPAIR_FUND: 'Fond reparații',
    INVESTMENT_FUND: 'Fond investiții',
    OTHER: 'Alt serviciu',
  };
  return labels[type] || type;
}

const CLOSED_PERIOD_STATUSES: BillingPeriodStatus[] = [BillingPeriodStatus.PUBLISHED, BillingPeriodStatus.CANCELLED];
const APPROVABLE_PERIOD_STATUSES: BillingPeriodStatus[] = [BillingPeriodStatus.CALCULATED, BillingPeriodStatus.IN_REVIEW];
const EDITABLE_INVOICE_STATUSES: BillingDraftInvoiceStatus[] = [
  BillingDraftInvoiceStatus.DRAFT,
  BillingDraftInvoiceStatus.IN_REVIEW,
  BillingDraftInvoiceStatus.APPROVED,
];
const INVOICE_MANUAL_EDIT_STATUSES: BillingDraftInvoiceStatus[] = [BillingDraftInvoiceStatus.DRAFT, BillingDraftInvoiceStatus.IN_REVIEW];
const NEXT_INVOICE_STATUSES: BillingDraftInvoiceStatus[] = [BillingDraftInvoiceStatus.IN_REVIEW, BillingDraftInvoiceStatus.APPROVED];
const FIXED_TARIFF_TYPES: UtilityTariffType[] = [
  UtilityTariffType.MAINTENANCE,
  UtilityTariffType.ELEVATOR,
  UtilityTariffType.REPAIR_FUND,
  UtilityTariffType.INVESTMENT_FUND,
  UtilityTariffType.OTHER,
];
const FLAT_TARIFF_UNITS: UtilityTariffUnit[] = [UtilityTariffUnit.APARTMENT, UtilityTariffUnit.FIXED, UtilityTariffUnit.OTHER];

function apartmentLabel(apartment: { building?: { name?: string | null } | null; staircase?: { name?: string | null } | null; number: string }) {
  return [apartment.building?.name, apartment.staircase?.name, `ap. ${apartment.number}`].filter(Boolean).join(' / ');
}

@Injectable()
export class BillingDraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityMvpService,
  ) {}

  async listPeriods(user: MvpUser) {
    const organizationId = this.requireOrganization(user);
    const periods = await this.prisma.billingPeriod.findMany({
      where: { organizationId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        meterReadingPeriod: { select: { id: true, year: true, month: true, status: true, lockedAt: true } },
        invoices: { select: { total: true } },
        _count: { select: { invoices: true, tariffs: true } },
      },
    });

    const rows = await Promise.all(
      periods.map(async (period) => {
        const issues = await this.buildIssues(organizationId, period.id);
        return {
          id: period.id,
          year: period.year,
          month: period.month,
          status: period.status,
          title: period.title,
          meterReadingPeriodId: period.meterReadingPeriodId,
          meterReadingPeriod: period.meterReadingPeriod,
          invoicesCount: period._count.invoices,
          tariffsCount: period._count.tariffs,
          totalAmount: money(period.invoices.reduce((sum, invoice) => sum + numberFromDecimal(invoice.total), 0)),
          issuesCount: issues.length,
          createdAt: period.createdAt,
          updatedAt: period.updatedAt,
        };
      }),
    );

    return { periods: rows };
  }

  async createPeriod(user: MvpUser, body: unknown) {
    const organizationId = this.requireOrganization(user);
    const payload = isRecord(body) ? body : {};
    const year = parsePositiveInt(payload.year, 'Anul');
    const month = parseMonth(payload.month);
    const meterReadingPeriodId = optionalString(payload.meterReadingPeriodId);
    const title = optionalString(payload.title) || `Facturare ${String(month).padStart(2, '0')}/${year}`;
    const note = optionalString(payload.note);
    const warnings: string[] = [];

    const existing = await this.prisma.billingPeriod.findUnique({
      where: { organizationId_year_month: { organizationId, year, month } },
      include: { meterReadingPeriod: true },
    });
    if (existing) {
      return { period: this.serializePeriod(existing), alreadyExists: true, warnings: ['Perioada de facturare există deja.'] };
    }

    let readingPeriod: { id: string; status: MeterReadingPeriodStatus; organizationId: string } | null = null;
    if (meterReadingPeriodId) {
      readingPeriod = await this.prisma.meterReadingPeriod.findFirst({
        where: { id: meterReadingPeriodId, organizationId },
        select: { id: true, status: true, organizationId: true },
      });
      if (!readingPeriod) throw new NotFoundException('Perioada de citiri nu există pentru această organizație.');
      if (readingPeriod.status !== MeterReadingPeriodStatus.LOCKED) {
        warnings.push('Pentru calcule corecte, blochează mai întâi perioada de citiri.');
      }
    }

    const period = await this.prisma.billingPeriod.create({
      data: {
        organizationId,
        year,
        month,
        title,
        note,
        meterReadingPeriodId: readingPeriod?.id || null,
        createdById: user.id,
      },
      include: { meterReadingPeriod: true },
    });

    await this.log(user, 'BILLING_PERIOD_CREATED', 'Perioadă de facturare creată', `A fost creată perioada ${month}/${year}.`, period.id);
    return { period: this.serializePeriod(period), alreadyExists: false, warnings };
  }

  async getOverview(user: MvpUser, periodId: string) {
    const organizationId = this.requireOrganization(user);
    const period = await this.requirePeriod(organizationId, periodId);
    const [apartmentsCount, invoices, tariffsCount, issues] = await Promise.all([
      this.prisma.apartment.count({ where: { organizationId, archivedAt: null } }),
      this.prisma.billingDraftInvoice.findMany({ where: { organizationId, billingPeriodId: period.id }, select: { id: true, status: true, total: true } }),
      this.prisma.utilityTariff.count({ where: { organizationId, billingPeriodId: period.id, isActive: true } }),
      this.buildIssues(organizationId, period.id),
    ]);

    const countByStatus = (status: BillingDraftInvoiceStatus) => invoices.filter((invoice) => invoice.status === status).length;
    const blockingIssues = issues.filter((issue) => issue.blocking);
    const warnings = issues.filter((issue) => !issue.blocking);
    const editablePeriod = !CLOSED_PERIOD_STATUSES.includes(period.status);

    return {
      period: this.serializePeriod(period),
      linkedMeterReadingPeriod: period.meterReadingPeriod,
      apartmentsCount,
      invoicesDraftCount: countByStatus(BillingDraftInvoiceStatus.DRAFT),
      invoicesInReviewCount: countByStatus(BillingDraftInvoiceStatus.IN_REVIEW),
      invoicesPublishedCount: countByStatus(BillingDraftInvoiceStatus.PUBLISHED),
      totalDraftAmount: money(invoices.reduce((sum, invoice) => sum + numberFromDecimal(invoice.total), 0)),
      tariffsCount,
      missingTariffsCount: issues.filter((issue) => issue.type === 'MISSING_TARIFF').length,
      apartmentsWithoutInvoice: Math.max(0, apartmentsCount - invoices.length),
      invoicesWithIssues: new Set(issues.map((issue) => issue.invoice?.id).filter(Boolean)).size,
      readingsMissingCount: issues.filter((issue) => issue.type === 'MISSING_READING').length,
      canGenerate: editablePeriod && apartmentsCount > 0,
      canRecalculate: editablePeriod && invoices.some((invoice) => EDITABLE_INVOICE_STATUSES.includes(invoice.status)),
      canApprove: APPROVABLE_PERIOD_STATUSES.includes(period.status) && blockingIssues.length === 0,
      canPublish: false,
      blockingIssues,
      warnings,
    };
  }

  async getTariffs(user: MvpUser, periodId: string) {
    const organizationId = this.requireOrganization(user);
    await this.requirePeriod(organizationId, periodId);
    const tariffs = await this.prisma.utilityTariff.findMany({
      where: { organizationId, billingPeriodId: periodId },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
    return { tariffs: tariffs.map((tariff) => this.serializeTariff(tariff)) };
  }

  async updateTariffs(user: MvpUser, periodId: string, body: unknown) {
    const organizationId = this.requireOrganization(user);
    const period = await this.requirePeriod(organizationId, periodId);
    this.assertPeriodEditable(period);
    const payload = isRecord(body) ? body : {};
    const rows = Array.isArray(payload.tariffs) ? payload.tariffs : [];
    if (!rows.length) throw new BadRequestException('Trimite cel puțin un tarif.');

    const saved = await this.prisma.$transaction(
      rows.map((raw) => {
        const row = isRecord(raw) ? raw : {};
        const type = this.parseEnum(UtilityTariffType, row.type, 'Tipul tarifului');
        const unit = this.parseEnum(UtilityTariffUnit, row.unit, 'Unitatea tarifului');
        const price = Number(row.price);
        if (!Number.isFinite(price) || price < 0) throw new BadRequestException('Prețul trebuie să fie un număr pozitiv sau zero.');
        const name = requiredString(row.name || tariffTypeLabel(type), 'Denumirea tarifului');
        return this.prisma.utilityTariff.upsert({
          where: { billingPeriodId_type: { billingPeriodId: period.id, type } },
          create: {
            organizationId,
            billingPeriodId: period.id,
            type,
            name,
            unit,
            price,
            currency: 'MDL',
            isActive: row.isActive !== false,
            note: optionalString(row.note),
          },
          update: {
            name,
            unit,
            price,
            isActive: row.isActive !== false,
            note: optionalString(row.note) || null,
          },
        });
      }),
    );

    await this.log(user, 'BILLING_TARIFFS_UPDATED', 'Tarife actualizate', `Au fost actualizate ${saved.length} tarife pentru perioada ${period.month}/${period.year}.`, period.id);
    return { tariffs: saved.map((tariff) => this.serializeTariff(tariff)) };
  }

  async generateDrafts(user: MvpUser, periodId: string, body: unknown) {
    return this.generateDraftsInternal(user, periodId, body, 'BILLING_DRAFTS_GENERATED');
  }

  async recalculateDrafts(user: MvpUser, periodId: string, body: unknown) {
    const payload = isRecord(body) ? { ...body, overwriteExistingDrafts: true } : { overwriteExistingDrafts: true };
    return this.generateDraftsInternal(user, periodId, payload, 'BILLING_DRAFTS_RECALCULATED');
  }

  async listInvoices(user: MvpUser, periodId: string, query: Record<string, unknown>) {
    const organizationId = this.requireOrganization(user);
    await this.requirePeriod(organizationId, periodId);
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const search = optionalString(query.search);
    const status = optionalString(query.status) as BillingDraftInvoiceStatus | undefined;
    const where: Prisma.BillingDraftInvoiceWhereInput = {
      organizationId,
      billingPeriodId: periodId,
    };
    if (status && Object.values(BillingDraftInvoiceStatus).includes(status)) where.status = status;
    if (optionalString(query.apartmentId)) where.apartmentId = optionalString(query.apartmentId);
    const apartmentWhere: Prisma.ApartmentWhereInput = {};
    if (optionalString(query.buildingId)) apartmentWhere.buildingId = optionalString(query.buildingId);
    if (optionalString(query.entranceId)) apartmentWhere.staircaseId = optionalString(query.entranceId);
    if (Object.keys(apartmentWhere).length) where.apartment = apartmentWhere;
    if (search) {
      where.OR = [
        { apartment: { number: { contains: search, mode: 'insensitive' } } },
        { apartment: { building: { name: { contains: search, mode: 'insensitive' } } } },
        { apartment: { staircase: { name: { contains: search, mode: 'insensitive' } } } },
        { resident: { firstName: { contains: search, mode: 'insensitive' } } },
        { resident: { lastName: { contains: search, mode: 'insensitive' } } },
        { owner: { firstName: { contains: search, mode: 'insensitive' } } },
        { owner: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, invoices, issues] = await Promise.all([
      this.prisma.billingDraftInvoice.count({ where }),
      this.prisma.billingDraftInvoice.findMany({
        where,
        orderBy: [{ apartmentId: 'asc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          apartment: { include: { building: { select: { id: true, name: true } }, staircase: { select: { id: true, name: true } } } },
          owner: true,
          resident: true,
          _count: { select: { lines: true } },
        },
      }),
      this.buildIssues(organizationId, periodId),
    ]);
    const issueByInvoice = new Map<string, BillingDraftIssue[]>();
    issues.forEach((issue) => {
      if (issue.invoice?.id) issueByInvoice.set(issue.invoice.id, [...(issueByInvoice.get(issue.invoice.id) || []), issue]);
    });
    const rows = invoices
      .map((invoice) => this.serializeInvoiceSummary(invoice, issueByInvoice.get(invoice.id) || []))
      .filter((invoice) => !optionalBoolean(query.onlyIssues) || invoice.issues.length > 0);

    return { invoices: rows, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getInvoice(user: MvpUser, invoiceId: string) {
    const organizationId = this.requireOrganization(user);
    const invoice = await this.prisma.billingDraftInvoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: {
        billingPeriod: true,
        apartment: { include: { building: { select: { id: true, name: true } }, staircase: { select: { id: true, name: true } } } },
        owner: true,
        resident: true,
        lines: {
          orderBy: { createdAt: 'asc' },
          include: {
            meter: true,
            meterReading: true,
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Factura draft nu există.');
    const issues = (await this.buildIssues(organizationId, invoice.billingPeriodId)).filter((issue) => issue.invoice?.id === invoice.id || issue.apartment?.id === invoice.apartmentId);
    return { invoice: this.serializeInvoiceDetail(invoice), issues };
  }

  async updateInvoice(user: MvpUser, invoiceId: string, body: unknown) {
    const organizationId = this.requireOrganization(user);
    const invoice = await this.prisma.billingDraftInvoice.findFirst({ where: { id: invoiceId, organizationId } });
    if (!invoice) throw new NotFoundException('Factura draft nu există.');
    if (!INVOICE_MANUAL_EDIT_STATUSES.includes(invoice.status)) {
      throw new BadRequestException('Poți edita doar facturi DRAFT sau IN_REVIEW.');
    }
    const payload = isRecord(body) ? body : {};
    const nextStatus = optionalString(payload.status) as BillingDraftInvoiceStatus | undefined;
    if (nextStatus && !NEXT_INVOICE_STATUSES.includes(nextStatus)) {
      throw new BadRequestException('Statusul poate fi schimbat doar în IN_REVIEW sau APPROVED.');
    }
    if (nextStatus === BillingDraftInvoiceStatus.APPROVED) {
      const issues = (await this.buildIssues(organizationId, invoice.billingPeriodId)).filter((issue) => issue.blocking && issue.invoice?.id === invoice.id);
      if (issues.length) throw new BadRequestException('Factura are probleme critice și nu poate fi aprobată.');
    }
    const updated = await this.prisma.billingDraftInvoice.update({
      where: { id: invoice.id },
      data: {
        note: payload.note === undefined ? undefined : optionalString(payload.note) || null,
        dueDate: payload.dueDate === undefined ? undefined : parseDate(payload.dueDate),
        status: nextStatus || undefined,
      },
    });
    await this.log(user, 'INVOICE_DRAFT_UPDATED', 'Factură draft actualizată', 'A fost actualizată o factură draft.', invoice.billingPeriodId, invoice.id);
    return { invoice: this.serializeInvoiceBase(updated) };
  }

  async getIssues(user: MvpUser, periodId: string, query: Record<string, unknown>) {
    const organizationId = this.requireOrganization(user);
    await this.requirePeriod(organizationId, periodId);
    let issues = await this.buildIssues(organizationId, periodId);
    const type = optionalString(query.type) as BillingIssueType | undefined;
    const severity = optionalString(query.severity) as BillingIssueSeverity | undefined;
    const search = optionalString(query.search)?.toLowerCase();
    if (type) issues = issues.filter((issue) => issue.type === type);
    if (severity) issues = issues.filter((issue) => issue.severity === severity);
    if (search) {
      issues = issues.filter((issue) => `${issue.title} ${issue.recommendation} ${issue.apartment?.number || ''} ${issue.meter?.serialNumber || ''}`.toLowerCase().includes(search));
    }
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 50)));
    return {
      issues: issues.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: issues.length, pages: Math.ceil(issues.length / limit) },
    };
  }

  async approvePeriod(user: MvpUser, periodId: string, body: unknown) {
    const organizationId = this.requireOrganization(user);
    const period = await this.requirePeriod(organizationId, periodId);
    this.assertPeriodEditable(period);
    const payload = isRecord(body) ? body : {};
    const issues = await this.buildIssues(organizationId, period.id);
    const blocking = issues.filter((issue) => issue.blocking);
    const warnings = issues.filter((issue) => !issue.blocking);
    if (blocking.length) throw new BadRequestException('Perioada are probleme critice și nu poate fi aprobată.');
    if (warnings.length && !optionalBoolean(payload.confirmWarnings)) {
      throw new BadRequestException('Confirmă warning-urile înainte de aprobare.');
    }
    await this.prisma.$transaction([
      this.prisma.billingDraftInvoice.updateMany({
        where: { organizationId, billingPeriodId: period.id, status: { in: [BillingDraftInvoiceStatus.DRAFT, BillingDraftInvoiceStatus.IN_REVIEW] }, lines: { some: {} } },
        data: { status: BillingDraftInvoiceStatus.APPROVED },
      }),
      this.prisma.billingPeriod.update({
        where: { id: period.id },
        data: { status: BillingPeriodStatus.APPROVED, approvedAt: new Date(), approvedById: user.id },
      }),
    ]);
    await this.log(user, 'BILLING_PERIOD_APPROVED', 'Perioadă de facturare aprobată', `Perioada ${period.month}/${period.year} a fost aprobată ca draft intern.`, period.id);
    // TODO(ES-181): notify Superadmin when billing approval/publication routing is introduced.
    return this.getOverview(user, period.id);
  }

  async deleteDrafts(user: MvpUser, periodId: string, body: unknown) {
    const organizationId = this.requireOrganization(user);
    const period = await this.requirePeriod(organizationId, periodId);
    if (period.status === BillingPeriodStatus.PUBLISHED) throw new BadRequestException('Nu poți șterge drafturi dintr-o perioadă publicată.');
    const payload = isRecord(body) ? body : {};
    if (!payload.confirm) throw new BadRequestException('Confirmarea este obligatorie pentru ștergerea drafturilor.');
    const editableStatuses = EDITABLE_INVOICE_STATUSES;
    const invoices = await this.prisma.billingDraftInvoice.findMany({
      where: { organizationId, billingPeriodId: period.id, status: { in: editableStatuses } },
      select: { id: true },
    });
    const ids = invoices.map((invoice) => invoice.id);
    if (ids.length) {
      await this.prisma.$transaction([
        this.prisma.billingDraftInvoiceLine.deleteMany({ where: { invoiceId: { in: ids } } }),
        this.prisma.billingDraftInvoice.deleteMany({ where: { id: { in: ids } } }),
        this.prisma.billingPeriod.update({ where: { id: period.id }, data: { status: BillingPeriodStatus.DRAFT } }),
      ]);
    }
    await this.log(user, 'BILLING_DRAFTS_DELETED', 'Drafturi de facturi șterse', `Au fost șterse ${ids.length} drafturi nepublicate.`, period.id);
    return { deletedCount: ids.length };
  }

  private async generateDraftsInternal(user: MvpUser, periodId: string, body: unknown, activityType: 'BILLING_DRAFTS_GENERATED' | 'BILLING_DRAFTS_RECALCULATED') {
    const organizationId = this.requireOrganization(user);
    const period = await this.requirePeriod(organizationId, periodId);
    this.assertPeriodEditable(period);
    const payload = isRecord(body) ? body : {};
    const includeMaintenanceFee = payload.includeMaintenanceFee !== false;
    const includeMeterUtilities = payload.includeMeterUtilities !== false;
    const overwriteExistingDrafts = optionalBoolean(payload.overwriteExistingDrafts);
    const confirmWarnings = optionalBoolean(payload.confirmWarnings);

    if (includeMeterUtilities && !period.meterReadingPeriodId) {
      throw new BadRequestException('Leagă o perioadă de citiri înainte de generarea utilităților pe contoare.');
    }
    if (includeMeterUtilities && period.meterReadingPeriod?.status !== MeterReadingPeriodStatus.LOCKED && !confirmWarnings) {
      throw new BadRequestException('Perioada de citiri trebuie blocată înainte de generarea drafturilor.');
    }

    const existingEditable = await this.prisma.billingDraftInvoice.count({
      where: {
        organizationId,
        billingPeriodId: period.id,
        status: { in: [BillingDraftInvoiceStatus.DRAFT, BillingDraftInvoiceStatus.IN_REVIEW, BillingDraftInvoiceStatus.APPROVED] },
      },
    });
    if (existingEditable > 0 && !overwriteExistingDrafts) {
      throw new ConflictException('Există deja drafturi. Activează suprascrierea pentru recalculare.');
    }

    const preIssues = await this.buildIssues(organizationId, period.id);
    const criticalNegative = preIssues.filter((issue) => issue.type === 'NEGATIVE_CONSUMPTION');
    if (criticalNegative.length && !confirmWarnings) {
      throw new BadRequestException('Există consumuri negative. Confirmă explicit după verificare pentru a genera parțial fără acele linii.');
    }

    const [apartments, tariffs, meters] = await Promise.all([
      this.prisma.apartment.findMany({
        where: { organizationId, archivedAt: null },
        orderBy: [{ buildingId: 'asc' }, { staircaseId: 'asc' }, { number: 'asc' }],
        include: {
          building: { select: { id: true, name: true } },
          staircase: { select: { id: true, name: true } },
          ownerResident: true,
          apartmentResidents: { include: { resident: true } },
        },
      }),
      this.prisma.utilityTariff.findMany({ where: { organizationId, billingPeriodId: period.id, isActive: true } }),
      includeMeterUtilities
        ? this.prisma.meter.findMany({
            where: { organizationId, status: MeterStatus.ACTIVE, archivedAt: null },
            include: {
              readings: {
                where: { periodId: period.meterReadingPeriodId || undefined },
                orderBy: { readingDate: 'desc' },
                take: 1,
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const meterIds = meters.map((meter) => meter.id);
    const previousReadings = meterIds.length
      ? await this.prisma.meterReading.findMany({
          where: { organizationId, meterId: { in: meterIds }, readingDate: { lt: periodStart(period.year, period.month) } },
          orderBy: [{ meterId: 'asc' }, { readingDate: 'desc' }],
        })
      : [];
    const previousByMeter = new Map<string, (typeof previousReadings)[number]>();
    previousReadings.forEach((reading) => {
      if (!previousByMeter.has(reading.meterId)) previousByMeter.set(reading.meterId, reading);
    });

    const tariffByType = new Map(tariffs.map((tariff) => [tariff.type, tariff]));
    const metersByApartment = new Map<string, typeof meters>();
    meters.forEach((meter) => metersByApartment.set(meter.apartmentId, [...(metersByApartment.get(meter.apartmentId) || []), meter]));

    const editableInvoices = await this.prisma.billingDraftInvoice.findMany({
      where: {
        organizationId,
        billingPeriodId: period.id,
        status: { in: [BillingDraftInvoiceStatus.DRAFT, BillingDraftInvoiceStatus.IN_REVIEW, BillingDraftInvoiceStatus.APPROVED] },
      },
      select: { id: true },
    });
    const invoiceIds = editableInvoices.map((invoice) => invoice.id);

    const fixedTariffs = tariffs.filter((tariff) =>
      FIXED_TARIFF_TYPES.includes(tariff.type),
    );

    const created = await this.prisma.$transaction(async (tx) => {
      if (overwriteExistingDrafts && invoiceIds.length) {
        await tx.billingDraftInvoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
        await tx.billingDraftInvoice.deleteMany({ where: { id: { in: invoiceIds } } });
      }

      const invoices = [];
      for (const apartment of apartments) {
        const owner = apartment.ownerResident || apartment.apartmentResidents.find((link) => link.role === 'OWNER')?.resident || null;
        const resident = apartment.apartmentResidents.find((link) => link.isPrimary)?.resident || apartment.apartmentResidents.find((link) => link.role !== 'OWNER')?.resident || null;
        const lines = this.buildInvoiceLinesForApartment(apartment, metersByApartment.get(apartment.id) || [], previousByMeter, tariffByType, fixedTariffs, {
          includeMeterUtilities,
          includeMaintenanceFee,
        });
        const total = money(lines.reduce((sum, line) => sum + Number(line.amount), 0));
        const invoice = await tx.billingDraftInvoice.create({
          data: {
            organizationId,
            billingPeriodId: period.id,
            apartmentId: apartment.id,
            ownerId: owner?.id || null,
            residentId: resident?.id || null,
            status: lines.length ? BillingDraftInvoiceStatus.DRAFT : BillingDraftInvoiceStatus.IN_REVIEW,
            subtotal: total,
            total,
            currency: 'MDL',
            createdById: user.id,
            lines: { create: lines },
          },
          include: { lines: true },
        });
        invoices.push(invoice);
      }

      await tx.billingPeriod.update({
        where: { id: period.id },
        data: { status: invoices.some((invoice) => invoice.lines.length === 0) ? BillingPeriodStatus.IN_REVIEW : BillingPeriodStatus.CALCULATED },
      });
      return invoices;
    });

    await this.log(
      user,
      activityType,
      activityType === 'BILLING_DRAFTS_RECALCULATED' ? 'Drafturi de facturi recalculate' : 'Drafturi de facturi generate',
      `Au fost ${activityType === 'BILLING_DRAFTS_RECALCULATED' ? 'recalculate' : 'generate'} ${created.length} drafturi.`,
      period.id,
    );
    return { createdCount: created.length, overview: await this.getOverview(user, period.id) };
  }

  private buildInvoiceLinesForApartment(
    apartment: ApartmentForBilling,
    meters: Array<Prisma.MeterGetPayload<{ include: { readings: true } }>>,
    previousByMeter: Map<string, Prisma.MeterReadingGetPayload<object>>,
    tariffByType: Map<UtilityTariffType, Prisma.UtilityTariffGetPayload<object>>,
    fixedTariffs: Prisma.UtilityTariffGetPayload<object>[],
    options: { includeMeterUtilities: boolean; includeMaintenanceFee: boolean },
  ): Prisma.BillingDraftInvoiceLineCreateWithoutInvoiceInput[] {
    const lines: Prisma.BillingDraftInvoiceLineCreateWithoutInvoiceInput[] = [];
    if (options.includeMeterUtilities) {
      meters.forEach((meter) => {
        const reading = meter.readings[0];
        if (!reading) return;
        const previous = previousByMeter.get(meter.id);
        const consumption = quantity(reading.value - (previous?.value || 0));
        if (consumption < 0) return;
        const tariffType = meterTypeToTariffType(meter.type);
        const tariff = tariffByType.get(tariffType);
        if (!tariff) return;
        const unitPrice = numberFromDecimal(tariff.price);
        const amount = money(consumption * unitPrice);
        lines.push({
          organization: { connect: { id: apartment.organizationId } },
          apartment: { connect: { id: apartment.id } },
          meter: { connect: { id: meter.id } },
          meterReading: { connect: { id: reading.id } },
          type: tariffType,
          description: `${tariff.name} / Contor ${meter.serialNumber || 'fără serie'} / Consum ${consumption} ${tariff.unit}`,
          quantity: consumption,
          unit: tariff.unit,
          unitPrice,
          amount,
          currency: tariff.currency,
          metadataJson: {
            previousReadingId: previous?.id || null,
            previousValue: previous?.value ?? null,
            currentValue: reading.value,
          },
        });
      });
    }

    if (options.includeMaintenanceFee) {
      fixedTariffs.forEach((tariff) => {
        const unitPrice = numberFromDecimal(tariff.price);
        let qty = 0;
        if (tariff.unit === UtilityTariffUnit.M2) qty = apartment.areaM2 || 0;
        if (FLAT_TARIFF_UNITS.includes(tariff.unit)) qty = 1;
        if (tariff.unit === UtilityTariffUnit.PERSON) qty = apartment.apartmentResidents.filter((link) => link.role !== 'OWNER').length;
        qty = quantity(qty);
        if (qty <= 0) return;
        const amount = money(qty * unitPrice);
        lines.push({
          organization: { connect: { id: apartment.organizationId } },
          apartment: { connect: { id: apartment.id } },
          type: tariff.type,
          description: `${tariff.name} / ${apartmentLabel(apartment)}`,
          quantity: qty,
          unit: tariff.unit,
          unitPrice,
          amount,
          currency: tariff.currency,
        });
      });
    }
    return lines;
  }

  private async buildIssues(organizationId: string, periodId: string): Promise<BillingDraftIssue[]> {
    const period = await this.requirePeriod(organizationId, periodId);
    const issues: BillingDraftIssue[] = [];
    const [apartments, tariffs, invoices, meters] = await Promise.all([
      this.prisma.apartment.findMany({
        where: { organizationId, archivedAt: null },
        include: {
          building: { select: { id: true, name: true } },
          staircase: { select: { id: true, name: true } },
          ownerResident: true,
          apartmentResidents: { include: { resident: true } },
        },
      }),
      this.prisma.utilityTariff.findMany({ where: { organizationId, billingPeriodId: period.id, isActive: true } }),
      this.prisma.billingDraftInvoice.findMany({
        where: { organizationId, billingPeriodId: period.id },
        include: { _count: { select: { lines: true } }, apartment: { include: { building: true, staircase: true } } },
      }),
      period.meterReadingPeriodId
        ? this.prisma.meter.findMany({
            where: { organizationId, status: MeterStatus.ACTIVE, archivedAt: null },
            include: {
              apartment: { include: { building: true, staircase: true } },
              readings: { where: { periodId: period.meterReadingPeriodId }, take: 1, orderBy: { readingDate: 'desc' } },
            },
          })
        : Promise.resolve([]),
    ]);

    if (period.status === BillingPeriodStatus.PUBLISHED) {
      issues.push(this.issue('PERIOD_ALREADY_PUBLISHED', 'WARNING', false, 'Perioada este publicată.', 'Nu mai recalcula drafturi într-o perioadă publicată.'));
    }

    const tariffByType = new Map(tariffs.map((tariff) => [tariff.type, tariff]));
    const requiredMeterTypes = new Set<UtilityTariffType>();
    meters.forEach((meter) => requiredMeterTypes.add(meterTypeToTariffType(meter.type)));
    requiredMeterTypes.forEach((type) => {
      if (!tariffByType.has(type)) {
        issues.push(this.issue('MISSING_TARIFF', 'CRITICAL', true, `Lipsește tariful pentru ${tariffTypeLabel(type)}.`, 'Setează tariful în tabul Tarife înainte de aprobare.'));
      }
    });

    const previousReadings = meters.length
      ? await this.prisma.meterReading.findMany({
          where: { organizationId, meterId: { in: meters.map((meter) => meter.id) }, readingDate: { lt: periodStart(period.year, period.month) } },
          orderBy: [{ meterId: 'asc' }, { readingDate: 'desc' }],
        })
      : [];
    const previousByMeter = new Map<string, (typeof previousReadings)[number]>();
    previousReadings.forEach((reading) => {
      if (!previousByMeter.has(reading.meterId)) previousByMeter.set(reading.meterId, reading);
    });

    meters.forEach((meter) => {
      const current = meter.readings[0];
      if (!current) {
        issues.push(
          this.issue('MISSING_READING', 'CRITICAL', true, `Lipsește citirea pentru contorul ${meter.serialNumber || meter.type}.`, 'Completează citirea în workspace-ul Citiri contoare.', {
            apartment: this.issueApartment(meter.apartment),
            meter: this.issueMeter(meter),
          }),
        );
        return;
      }
      const previous = previousByMeter.get(meter.id);
      const consumption = quantity(current.value - (previous?.value || 0));
      if (consumption < 0) {
        issues.push(
          this.issue('NEGATIVE_CONSUMPTION', 'CRITICAL', true, `Consum negativ pentru contorul ${meter.serialNumber || meter.type}.`, 'Verifică citirea curentă și citirea precedentă.', {
            apartment: this.issueApartment(meter.apartment),
            meter: this.issueMeter(meter),
            currentValue: current.value,
            previousValue: previous?.value ?? null,
          }),
        );
      } else if (consumption === 0) {
        issues.push(
          this.issue('ZERO_CONSUMPTION', 'WARNING', false, `Consum zero pentru contorul ${meter.serialNumber || meter.type}.`, 'Verifică dacă citirea este corectă sau contorul nu a avut consum.', {
            apartment: this.issueApartment(meter.apartment),
            meter: this.issueMeter(meter),
            currentValue: current.value,
            previousValue: previous?.value ?? null,
          }),
        );
      } else if (previous && consumption > Math.max(previous.value * 1.5, 1000)) {
        issues.push(
          this.issue('HIGH_CONSUMPTION', 'WARNING', false, `Consum neobișnuit de mare pentru contorul ${meter.serialNumber || meter.type}.`, 'Confirmă valoarea înainte de aprobare.', {
            apartment: this.issueApartment(meter.apartment),
            meter: this.issueMeter(meter),
            currentValue: current.value,
            previousValue: previous.value,
          }),
        );
      }
    });

    const hasM2Tariff = tariffs.some((tariff) => tariff.unit === UtilityTariffUnit.M2);
    apartments.forEach((apartment) => {
      const hasOwner = Boolean(apartment.ownerResident || apartment.apartmentResidents.some((link) => link.role === 'OWNER'));
      const hasResident = apartment.apartmentResidents.some((link) => link.role !== 'OWNER');
      if (!hasOwner) issues.push(this.issue('APARTMENT_WITHOUT_OWNER', 'WARNING', false, `Apartamentul ${apartment.number} nu are proprietar.`, 'Completează proprietarul în CRM-ul locatarilor.', { apartment: this.issueApartment(apartment) }));
      if (!hasResident) issues.push(this.issue('APARTMENT_WITHOUT_RESIDENT', 'WARNING', false, `Apartamentul ${apartment.number} nu are locatar.`, 'Completează locatarul sau confirmă că apartamentul este gol.', { apartment: this.issueApartment(apartment) }));
      if (hasM2Tariff && !apartment.areaM2) {
        issues.push(this.issue('APARTMENT_WITHOUT_SURFACE', 'CRITICAL', true, `Apartamentul ${apartment.number} nu are suprafață.`, 'Suprafața este necesară pentru tarifele per m2.', { apartment: this.issueApartment(apartment) }));
      }
    });

    invoices.forEach((invoice) => {
      if (invoice._count.lines === 0) {
        issues.push(this.issue('INVOICE_WITHOUT_LINES', 'CRITICAL', true, `Factura pentru ${invoice.apartment.number} nu are linii.`, 'Verifică tarifele, citirile și datele apartamentului.', { apartment: this.issueApartment(invoice.apartment), invoice: { id: invoice.id, status: invoice.status, total: numberFromDecimal(invoice.total) } }));
      }
    });
    const invoiceCounts = new Map<string, number>();
    invoices.forEach((invoice) => invoiceCounts.set(invoice.apartmentId, (invoiceCounts.get(invoice.apartmentId) || 0) + 1));
    invoices.forEach((invoice) => {
      if ((invoiceCounts.get(invoice.apartmentId) || 0) > 1) {
        issues.push(this.issue('DUPLICATE_INVOICE', 'CRITICAL', true, `Există facturi duplicate pentru ${invoice.apartment.number}.`, 'Șterge drafturile duplicate și recalculează perioada.', { apartment: this.issueApartment(invoice.apartment), invoice: { id: invoice.id, status: invoice.status, total: numberFromDecimal(invoice.total) } }));
      }
    });

    return issues;
  }

  private issue(type: BillingIssueType, severity: BillingIssueSeverity, blocking: boolean, title: string, recommendation: string, extra: Partial<BillingDraftIssue> = {}): BillingDraftIssue {
    return {
      id: `${type}:${extra.apartment?.id || ''}:${extra.meter?.id || ''}:${extra.invoice?.id || ''}:${title}`,
      type,
      severity,
      blocking,
      title,
      recommendation,
      apartment: extra.apartment || null,
      meter: extra.meter || null,
      invoice: extra.invoice || null,
      currentValue: extra.currentValue ?? null,
      previousValue: extra.previousValue ?? null,
    };
  }

  private issueApartment(apartment: { id: string; number: string; building?: { name?: string | null } | null; staircase?: { name?: string | null } | null }) {
    return { id: apartment.id, number: apartment.number, building: apartment.building?.name || null, entrance: apartment.staircase?.name || null };
  }

  private issueMeter(meter: { id: string; type: MeterType; serialNumber?: string | null }) {
    return { id: meter.id, type: meter.type, serialNumber: meter.serialNumber || null };
  }

  private requireOrganization(user: MvpUser) {
    if (!user.organizationId) throw new ForbiddenException('Utilizatorul nu are organizație activă.');
    return user.organizationId;
  }

  private async requirePeriod(organizationId: string, periodId: string): Promise<PeriodWithReading> {
    const period = await this.prisma.billingPeriod.findFirst({
      where: { id: periodId, organizationId },
      include: { meterReadingPeriod: true },
    });
    if (!period) throw new NotFoundException('Perioada de facturare nu există.');
    return period;
  }

  private assertPeriodEditable(period: { status: BillingPeriodStatus }) {
    if (CLOSED_PERIOD_STATUSES.includes(period.status)) {
      throw new BadRequestException('Perioada nu mai poate fi modificată.');
    }
  }

  private parseEnum<T extends Record<string, string>>(enumObject: T, value: unknown, label: string): T[keyof T] {
    const raw = optionalString(value);
    if (!raw || !Object.values(enumObject).includes(raw)) throw new BadRequestException(`${label} nu este valid.`);
    return raw as T[keyof T];
  }

  private serializePeriod(period: PeriodWithReading) {
    return {
      id: period.id,
      organizationId: period.organizationId,
      year: period.year,
      month: period.month,
      status: period.status,
      meterReadingPeriodId: period.meterReadingPeriodId,
      meterReadingPeriod: period.meterReadingPeriod,
      title: period.title,
      note: period.note,
      approvedAt: period.approvedAt,
      publishedAt: period.publishedAt,
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
    };
  }

  private serializeTariff(tariff: Prisma.UtilityTariffGetPayload<object>) {
    return {
      id: tariff.id,
      organizationId: tariff.organizationId,
      billingPeriodId: tariff.billingPeriodId,
      type: tariff.type,
      name: tariff.name,
      unit: tariff.unit,
      price: numberFromDecimal(tariff.price),
      currency: tariff.currency,
      isActive: tariff.isActive,
      note: tariff.note,
      createdAt: tariff.createdAt,
      updatedAt: tariff.updatedAt,
    };
  }

  private serializeInvoiceBase(invoice: Prisma.BillingDraftInvoiceGetPayload<object>) {
    return {
      id: invoice.id,
      billingPeriodId: invoice.billingPeriodId,
      apartmentId: invoice.apartmentId,
      residentId: invoice.residentId,
      ownerId: invoice.ownerId,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      subtotal: numberFromDecimal(invoice.subtotal),
      total: numberFromDecimal(invoice.total),
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      issuedAt: invoice.issuedAt,
      publishedAt: invoice.publishedAt,
      paidAt: invoice.paidAt,
      note: invoice.note,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }

  private serializeInvoiceSummary(
    invoice: Prisma.BillingDraftInvoiceGetPayload<{
      include: {
        apartment: { include: { building: { select: { id: true; name: true } }; staircase: { select: { id: true; name: true } } } };
        owner: true;
        resident: true;
        _count: { select: { lines: true } };
      };
    }>,
    issues: BillingDraftIssue[],
  ) {
    return {
      ...this.serializeInvoiceBase(invoice),
      apartment: {
        id: invoice.apartment.id,
        number: invoice.apartment.number,
        building: invoice.apartment.building,
        staircase: invoice.apartment.staircase,
      },
      owner: invoice.owner ? { id: invoice.owner.id, name: fullName(invoice.owner), phone: invoice.owner.phone, email: invoice.owner.email } : null,
      resident: invoice.resident ? { id: invoice.resident.id, name: fullName(invoice.resident), phone: invoice.resident.phone, email: invoice.resident.email } : null,
      linesCount: invoice._count.lines,
      issues,
    };
  }

  private serializeInvoiceDetail(
    invoice: Prisma.BillingDraftInvoiceGetPayload<{
      include: {
        billingPeriod: true;
        apartment: { include: { building: { select: { id: true; name: true } }; staircase: { select: { id: true; name: true } } } };
        owner: true;
        resident: true;
        lines: { include: { meter: true; meterReading: true } };
      };
    }>,
  ) {
    return {
      ...this.serializeInvoiceBase(invoice),
      billingPeriod: invoice.billingPeriod,
      apartment: {
        id: invoice.apartment.id,
        number: invoice.apartment.number,
        building: invoice.apartment.building,
        staircase: invoice.apartment.staircase,
      },
      owner: invoice.owner ? { id: invoice.owner.id, name: fullName(invoice.owner), phone: invoice.owner.phone, email: invoice.owner.email } : null,
      resident: invoice.resident ? { id: invoice.resident.id, name: fullName(invoice.resident), phone: invoice.resident.phone, email: invoice.resident.email } : null,
      lines: invoice.lines.map((line) => ({
        id: line.id,
        type: line.type,
        description: line.description,
        quantity: numberFromDecimal(line.quantity),
        unit: line.unit,
        unitPrice: numberFromDecimal(line.unitPrice),
        amount: numberFromDecimal(line.amount),
        currency: line.currency,
        meter: line.meter ? { id: line.meter.id, type: line.meter.type, serialNumber: line.meter.serialNumber } : null,
        meterReading: line.meterReading ? { id: line.meterReading.id, value: line.meterReading.value, readingDate: line.meterReading.readingDate } : null,
        metadataJson: line.metadataJson,
      })),
    };
  }

  private async log(user: MvpUser, type: Parameters<ActivityMvpService['createActivity']>[0]['type'], title: string, message: string, periodId?: string, invoiceId?: string) {
    await this.activity.createActivity({
      organizationId: user.organizationId,
      actorUserId: user.id,
      type,
      title,
      message,
      targetType: invoiceId ? 'BILLING_DRAFT_INVOICE' : 'BILLING_PERIOD',
      targetId: invoiceId || periodId || null,
      link: periodId ? `/admin/billing-drafts?periodId=${periodId}` : '/admin/billing-drafts',
    });
  }
}
