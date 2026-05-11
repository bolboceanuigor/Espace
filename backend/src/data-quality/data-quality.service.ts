import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApartmentResidentRole,
  ApartmentStatus,
  DataQualityBillingImpact,
  DataQualityCategory,
  DataQualityEntityType,
  DataQualityIssueStatus,
  DataQualityRunStatus,
  DataQualitySeverity,
  MeterReadingSource,
  MeterStatus,
  MeterType,
  PaymentStatus,
  Prisma,
  ResidentAccountStatus,
  ResidentInvoiceStatus,
  Role,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type QualityIssueDraft = {
  key: string;
  category: DataQualityCategory;
  severity: DataQualitySeverity;
  entityType: DataQualityEntityType;
  entityId?: string | null;
  title: string;
  description: string;
  recommendation: string;
  actionUrl?: string | null;
  billingImpact: DataQualityBillingImpact;
  metadata?: Record<string, unknown>;
};

type TariffRow = {
  id: string;
  name: string;
  internalCode: string;
  calculationType: string;
  status: string;
  pricePerM2?: number | null;
  fixedAmount?: number | null;
  pricePerUnit?: number | null;
  meterType?: string | null;
  unit?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

type ReadingMetadata = {
  status?: string | null;
  periodMonth?: string | null;
  previousReadingValue?: number | null;
  consumptionValue?: number | null;
  unit?: string | null;
  adminComment?: string | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  rejectedAt?: string | null;
  reviewedByUserId?: string | null;
};

type MeterMetadataStore = {
  meters: Record<string, Record<string, unknown>>;
  readings: Record<string, ReadingMetadata>;
};

type DataQualityFixType =
  | 'SET_APARTMENT_AREA'
  | 'SET_APARTMENT_STATUS'
  | 'SET_APARTMENT_STAIRCASE'
  | 'SET_APARTMENT_FLOOR'
  | 'SET_PRIMARY_CONTACT'
  | 'LINK_RESIDENT_TO_APARTMENT'
  | 'RESOLVE_MULTIPLE_PRIMARY_CONTACTS'
  | 'SET_RESIDENT_STATUS'
  | 'SET_TARIFF_PRICE'
  | 'SET_METER_UNIT'
  | 'SET_METER_NUMBER'
  | 'SET_METER_STATUS'
  | 'MARK_READING_NEEDS_REVIEW'
  | 'REJECT_METER_READING'
  | 'START_BILLING_RUN'
  | 'RUN_DATA_QUALITY'
  | 'MARK_ISSUE_RESOLVED'
  | 'MARK_ISSUE_IGNORED'
  | 'REOPEN_ISSUE';

type FixOption = {
  type: DataQualityFixType;
  key: DataQualityFixType;
  label: string;
  description?: string;
  requiresInput?: boolean;
  actionUrl?: string | null;
  available?: boolean;
};

type FixChange = {
  field: string;
  currentValue: unknown;
  newValue: unknown;
};

type FixPreview = {
  issue: Record<string, unknown>;
  fix: {
    type: DataQualityFixType;
    label: string;
    canApply: boolean;
    requiresConfirmation: boolean;
  };
  entity: {
    type: string;
    id?: string | null;
    label?: string | null;
    actionUrl?: string | null;
  };
  changes: FixChange[];
  warnings: string[];
  impact: {
    billingImpact: DataQualityBillingImpact;
    message: string;
  };
  options?: Record<string, unknown>;
};

const TARIFF_METADATA_NOTE_TITLE = 'Tariff settings metadata';
const BILLING_DRAFT_NOTE_TITLE = 'Internal invoice draft metadata';
const BILLING_RUN_NOTE_TITLE = 'Monthly billing run metadata';
const INTERNAL_INVOICE_NOTE_TITLE = 'Internal invoices metadata';
const METER_WORKFLOW_METADATA_NOTE_TITLE = 'ESPACE_METER_WORKFLOW_METADATA_V1';

const CATEGORY_LABELS: Record<DataQualityCategory, string> = {
  ASSOCIATION: 'Asociație',
  APARTMENTS: 'Apartamente',
  RESIDENTS: 'Locatari',
  TARIFFS: 'Tarife',
  METERS: 'Contoare',
  METER_READINGS: 'Indici contoare',
  BILLING: 'Facturare',
  INVOICES_PAYMENTS: 'Facturi și plăți',
  IMPORTS: 'Importuri',
  SYSTEM: 'Sistem',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function currentBillingMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function parseBillingMonth(value: unknown) {
  const raw = optionalString(value) || currentBillingMonth();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    throw new BadRequestException('Luna trebuie să fie în format YYYY-MM.');
  }
  return raw;
}

function monthFromDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return currentBillingMonth();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function fullName(resident?: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null } | null) {
  const name = [resident?.firstName, resident?.lastName].filter(Boolean).join(' ').trim();
  return name || resident?.email || resident?.phone || 'Locatar';
}

function scoreFromCounts(critical: number, warning: number, info: number) {
  return Math.max(0, 100 - critical * 10 - warning * 3 - info);
}

function statusLabelFromScore(score: number, criticalCount = 0) {
  if (criticalCount > 0 || score < 70) return 'Probleme critice';
  if (score < 90) return 'Necesită atenție';
  return 'Bun';
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<T, number>>((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parsePositiveNumber(value: unknown, message: string) {
  const number = optionalNumber(value);
  if (number === null || number <= 0) throw new BadRequestException(message);
  return number;
}

function parseNonEmpty(value: unknown, message: string) {
  const text = optionalString(value);
  if (!text) throw new BadRequestException(message);
  return text;
}

function nowIso() {
  return new Date().toISOString();
}

@Injectable()
export class DataQualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private isSuperadmin(user: MvpUser) {
    const role = String(user.role || '').toUpperCase();
    return role === Role.SUPERADMIN || role === 'SUPER_ADMIN';
  }

  private resolveAssociationId(user: MvpUser, activeOrganizationId?: string) {
    if (!this.isSuperadmin(user)) {
      if (!user.organizationId) throw new ForbiddenException('Organization context missing');
      return user.organizationId;
    }
    const requested = optionalString(activeOrganizationId) || optionalString(user.organizationId);
    if (!requested) throw new BadRequestException('Asociația este obligatorie.');
    return requested;
  }

  private assertAdmin(user: MvpUser, activeOrganizationId?: string) {
    const role = String(user.role || '').toUpperCase();
    if (!['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(role)) throw new ForbiddenException('Admin access required');
    return { associationId: this.resolveAssociationId(user, activeOrganizationId), actorUserId: user.id || user.sub };
  }

  private async organizationHeader(associationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: associationId },
      select: { id: true, name: true, legalName: true, fiscalCode: true, address: true, status: true, isActive: true },
    });
    if (!organization) throw new NotFoundException('Asociația nu a fost găsită.');
    return {
      id: organization.id,
      shortName: organization.name || organization.legalName || 'A.P.C.',
      legalName: organization.legalName || organization.name || 'Asociație',
      associationCode: organization.fiscalCode || '',
      address: organization.address || '',
      status: organization.status,
      isActive: organization.isActive,
    };
  }

  private async readJsonNote<T>(associationId: string, title: string, fallback: T): Promise<T> {
    const note = await this.prisma.clientNote.findFirst({
      where: { organizationId: associationId, title },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return fallback;
    try {
      return JSON.parse(note.content) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJsonNote(associationId: string, actorUserId: string, title: string, payload: unknown, client: any = this.prisma) {
    const existing = await client.clientNote.findFirst({
      where: { organizationId: associationId, title },
      select: { id: true },
    });
    const content = JSON.stringify(payload);
    if (existing) {
      await client.clientNote.update({ where: { id: existing.id }, data: { content } });
      return;
    }
    await client.clientNote.create({
      data: {
        organizationId: associationId,
        createdByUserId: actorUserId,
        title,
        content,
      },
    });
  }

  private async readMeterWorkflow(associationId: string, client: any = this.prisma): Promise<MeterMetadataStore> {
    const note = await client.clientNote.findFirst({
      where: { organizationId: associationId, title: METER_WORKFLOW_METADATA_NOTE_TITLE },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return { meters: {}, readings: {} };
    try {
      const parsed = JSON.parse(note.content);
      return {
        meters: isRecord(parsed?.meters) ? parsed.meters : {},
        readings: isRecord(parsed?.readings) ? parsed.readings : {},
      };
    } catch {
      return { meters: {}, readings: {} };
    }
  }

  private async writeMeterWorkflow(associationId: string, actorUserId: string, store: MeterMetadataStore, client: any = this.prisma) {
    await this.writeJsonNote(
      associationId,
      actorUserId,
      METER_WORKFLOW_METADATA_NOTE_TITLE,
      { version: 1, meters: store.meters || {}, readings: store.readings || {} },
      client,
    );
  }

  private async readRawTariffPayload(associationId: string, client: any = this.prisma): Promise<{ noteExists: boolean; items: any[] }> {
    const note = await client.clientNote.findFirst({
      where: { organizationId: associationId, title: TARIFF_METADATA_NOTE_TITLE },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return { noteExists: false, items: [] };
    try {
      const parsed = JSON.parse(note.content);
      const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
      return { noteExists: true, items };
    } catch {
      return { noteExists: true, items: [] };
    }
  }

  private async writeRawTariffPayload(associationId: string, actorUserId: string, items: any[], client: any = this.prisma) {
    await this.writeJsonNote(associationId, actorUserId, TARIFF_METADATA_NOTE_TITLE, { version: 1, items }, client);
    const activeByCode = new Map(
      items
        .filter((row) => String(row?.status || '').toUpperCase() === 'ACTIVE')
        .map((row) => [String(row?.internalCode || '').toUpperCase(), row]),
    );
    const maintenance = activeByCode.get('BUILDING_SERVICE') || activeByCode.get('DESERVIRE_BLOC_PER_M2');
    const repair = activeByCode.get('REPAIR_FUND') || activeByCode.get('FOND_REPARATIE_PER_M2');
    const investment = activeByCode.get('INVESTMENT_FUND') || activeByCode.get('FOND_DEZVOLTARE_FIXED');
    await client.organizationSetting.upsert({
      where: { organizationId: associationId },
      update: {
        maintenanceFeePerM2: String(maintenance?.calculationType || '').toUpperCase() === 'PER_M2' ? Number(maintenance?.pricePerM2 || 0) : 0,
        repairFundPerM2: String(repair?.calculationType || '').toUpperCase() === 'PER_M2' ? Number(repair?.pricePerM2 || 0) : 0,
        developmentFundFixed: String(investment?.calculationType || '').toUpperCase() === 'FIXED_PER_APARTMENT' ? Number(investment?.fixedAmount || 0) : 0,
      },
      create: {
        organizationId: associationId,
        maintenanceFeePerM2: String(maintenance?.calculationType || '').toUpperCase() === 'PER_M2' ? Number(maintenance?.pricePerM2 || 0) : 0,
        repairFundPerM2: String(repair?.calculationType || '').toUpperCase() === 'PER_M2' ? Number(repair?.pricePerM2 || 0) : 0,
        developmentFundFixed: String(investment?.calculationType || '').toUpperCase() === 'FIXED_PER_APARTMENT' ? Number(investment?.fixedAmount || 0) : 0,
      },
    });
  }

  private async readBillingRuns(associationId: string, client: any = this.prisma): Promise<any[]> {
    const note = await client.clientNote.findFirst({
      where: { organizationId: associationId, title: BILLING_RUN_NOTE_TITLE },
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

  private async writeBillingRuns(associationId: string, actorUserId: string, runs: any[], client: any = this.prisma) {
    await this.writeJsonNote(associationId, actorUserId, BILLING_RUN_NOTE_TITLE, { version: 1, items: runs }, client);
  }

  private defaultMeterUnit(type: string | null | undefined) {
    const normalized = String(type || '').toUpperCase();
    if (normalized === 'ELECTRICITY') return 'kWh';
    if (normalized === 'HEATING' || normalized === 'HEAT') return 'Gcal';
    if (normalized === 'OTHER') return 'unit';
    return 'm³';
  }

  private parseApartmentStatus(value: unknown) {
    const normalized = optionalString(value).toUpperCase();
    if (normalized === 'OCCUPIED' || normalized === 'ACTIVE') return ApartmentStatus.OCCUPIED;
    if (normalized === 'VACANT' || normalized === 'EMPTY') return ApartmentStatus.EMPTY;
    if (normalized === 'UNKNOWN') return ApartmentStatus.EMPTY;
    if (normalized === 'DEBTOR') return ApartmentStatus.DEBTOR;
    if (normalized === 'PROBLEM') return ApartmentStatus.PROBLEM;
    throw new BadRequestException('Statusul apartamentului trebuie să fie OCCUPIED, VACANT sau UNKNOWN.');
  }

  private parseResidentStatus(value: unknown) {
    const normalized = optionalString(value).toUpperCase();
    if (normalized === 'ACTIVE' || normalized === 'CREATED') return ResidentAccountStatus.CREATED;
    if (normalized === 'INVITED') return ResidentAccountStatus.INVITED;
    if (normalized === 'NOT_INVITED' || normalized === 'INACTIVE' || normalized === 'NO_ACCOUNT') return ResidentAccountStatus.NO_ACCOUNT;
    throw new BadRequestException('Statusul locatarului trebuie să fie ACTIVE, INVITED, NOT_INVITED sau INACTIVE.');
  }

  private parseApartmentResidentRole(value: unknown) {
    const normalized = optionalString(value).toUpperCase();
    if (!normalized || normalized === 'OWNER') return ApartmentResidentRole.OWNER;
    if (normalized === 'TENANT') return ApartmentResidentRole.TENANT;
    if (normalized === 'REPRESENTATIVE') return ApartmentResidentRole.REPRESENTATIVE;
    if (normalized === 'RESIDENT') return ApartmentResidentRole.RESIDENT;
    if (normalized === 'FAMILY_MEMBER') return ApartmentResidentRole.FAMILY_MEMBER;
    throw new BadRequestException('Rolul relației trebuie să fie OWNER, TENANT sau REPRESENTATIVE.');
  }

  private parseMeterStatus(value: unknown) {
    const normalized = optionalString(value).toUpperCase();
    if (normalized === 'ACTIVE') return { status: MeterStatus.ACTIVE, statusAlias: 'ACTIVE' };
    if (normalized === 'INACTIVE') return { status: MeterStatus.INACTIVE, statusAlias: 'INACTIVE' };
    if (normalized === 'REPLACED' || normalized === 'ARCHIVED') return { status: MeterStatus.INACTIVE, statusAlias: normalized };
    throw new BadRequestException('Statusul contorului trebuie să fie ACTIVE, INACTIVE, REPLACED sau ARCHIVED.');
  }

  private parseMeterType(value: unknown) {
    const normalized = optionalString(value).toUpperCase();
    if (normalized === 'HEAT') return MeterType.HEATING;
    if (normalized in MeterType) return normalized as MeterType;
    throw new BadRequestException('Tipul contorului nu este valid.');
  }

  private fixOption(type: DataQualityFixType, label: string, description?: string, requiresInput = true, actionUrl?: string | null): FixOption {
    return { type, key: type, label, description, requiresInput, actionUrl, available: true };
  }

  private async readTariffs(associationId: string, apartments: Array<{ areaM2?: number | null }>): Promise<TariffRow[]> {
    const note = await this.readJsonNote<any>(associationId, TARIFF_METADATA_NOTE_TITLE, null);
    if (note) {
      const rows = Array.isArray(note?.items) ? note.items : Array.isArray(note) ? note : [];
      return rows.map((row: any) => ({
        id: String(row.id || row.internalCode || row.name || randomUUID()),
        name: String(row.name || 'Tarif'),
        internalCode: String(row.internalCode || row.code || '').trim().toUpperCase(),
        calculationType: String(row.calculationType || row.type || 'MANUAL').toUpperCase(),
        status: String(row.status || (row.isActive ? 'ACTIVE' : 'DRAFT')).toUpperCase(),
        pricePerM2: row.pricePerM2 === null || row.pricePerM2 === undefined ? null : Number(row.pricePerM2),
        fixedAmount: row.fixedAmount === null || row.fixedAmount === undefined ? null : Number(row.fixedAmount),
        pricePerUnit: row.pricePerUnit === null || row.pricePerUnit === undefined ? null : Number(row.pricePerUnit),
        meterType: row.meterType ? String(row.meterType).toUpperCase() : null,
        unit: row.unit ? String(row.unit) : null,
        startsAt: row.startsAt || null,
        endsAt: row.endsAt || null,
      }));
    }

    const settings = await this.prisma.organizationSetting.findUnique({
      where: { organizationId: associationId },
      select: { maintenanceFeePerM2: true, repairFundPerM2: true, developmentFundFixed: true },
    });
    if (!settings) return [];
    const legacy: TariffRow[] = [
      {
        id: 'BUILDING_SERVICE',
        name: 'Deservire bloc',
        internalCode: 'BUILDING_SERVICE',
        calculationType: 'PER_M2',
        status: Number(settings.maintenanceFeePerM2 || 0) > 0 ? 'ACTIVE' : 'INACTIVE',
        pricePerM2: Number(settings.maintenanceFeePerM2 || 0),
      },
      {
        id: 'REPAIR_FUND',
        name: 'Fond reparație',
        internalCode: 'REPAIR_FUND',
        calculationType: 'PER_M2',
        status: Number(settings.repairFundPerM2 || 0) > 0 ? 'ACTIVE' : 'INACTIVE',
        pricePerM2: Number(settings.repairFundPerM2 || 0),
      },
      {
        id: 'INVESTMENT_FUND',
        name: 'Fond investiții',
        internalCode: 'INVESTMENT_FUND',
        calculationType: 'FIXED_PER_APARTMENT',
        status: Number(settings.developmentFundFixed || 0) > 0 ? 'ACTIVE' : 'INACTIVE',
        fixedAmount: Number(settings.developmentFundFixed || 0),
      },
    ];
    return legacy.filter((row) => row.status === 'ACTIVE' || apartments.length);
  }

  private async dataContext(associationId: string) {
    const [
      organization,
      apartments,
      residents,
      meters,
      readings,
      payments,
      residentInvoices,
      tariffs,
      meterMetadata,
      billingRunNote,
      draftNote,
      internalInvoiceNote,
      runsCount,
    ] = await Promise.all([
      this.organizationHeader(associationId),
      this.prisma.apartment.findMany({
        where: { organizationId: associationId },
        orderBy: [{ staircase: { name: 'asc' } }, { number: 'asc' }],
        select: {
          id: true,
          number: true,
          areaM2: true,
          floor: true,
          status: true,
          building: { select: { id: true, name: true } },
          staircase: { select: { id: true, name: true } },
          ownerResident: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, accountStatus: true } },
          apartmentResidents: {
            select: {
              role: true,
              isPrimary: true,
              resident: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                  email: true,
                  accountStatus: true,
                  user: { select: { isActive: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.residentProfile.findMany({
        where: { organizationId: associationId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          accountStatus: true,
          apartmentId: true,
          isPrimary: true,
          user: { select: { isActive: true } },
          apartmentResidents: { select: { apartmentId: true, role: true, isPrimary: true } },
        },
      }),
      this.prisma.meter.findMany({
        where: { organizationId: associationId },
        select: {
          id: true,
          apartmentId: true,
          type: true,
          serialNumber: true,
          status: true,
          apartment: { select: { id: true, number: true, staircase: { select: { name: true } } } },
        },
      }),
      this.prisma.meterReading.findMany({
        where: { organizationId: associationId },
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
          apartment: { select: { id: true, number: true, staircase: { select: { name: true } } } },
        },
      }),
      this.prisma.payment.findMany({
        where: { organizationId: associationId },
        select: {
          id: true,
          invoiceId: true,
          amount: true,
          status: true,
          month: true,
          paidAt: true,
          createdAt: true,
          invoice: { select: { id: true, invoiceNumber: true, totalDue: true, paymentsAmount: true, status: true } },
        },
      }),
      this.prisma.residentInvoice.findMany({
        where: { organizationId: associationId },
        select: {
          id: true,
          invoiceNumber: true,
          month: true,
          year: true,
          totalDue: true,
          paymentsAmount: true,
          status: true,
          apartmentId: true,
          dueDate: true,
          issuedAt: true,
        },
      }),
      this.readTariffs(associationId, []),
      this.readJsonNote<MeterMetadataStore>(associationId, METER_WORKFLOW_METADATA_NOTE_TITLE, { meters: {}, readings: {} }),
      this.readJsonNote<any>(associationId, BILLING_RUN_NOTE_TITLE, { items: [] }),
      this.readJsonNote<any>(associationId, BILLING_DRAFT_NOTE_TITLE, { items: [] }),
      this.readJsonNote<any>(associationId, INTERNAL_INVOICE_NOTE_TITLE, { items: [] }),
      this.prisma.dataQualityRun.count({ where: { associationId } }).catch(() => 0),
    ]);
    return {
      organization,
      apartments,
      residents,
      meters,
      readings,
      payments,
      residentInvoices,
      tariffs,
      meterMetadata: {
        meters: isRecord(meterMetadata?.meters) ? meterMetadata.meters : {},
        readings: isRecord(meterMetadata?.readings) ? meterMetadata.readings : {},
      } satisfies MeterMetadataStore,
      billingRuns: Array.isArray(billingRunNote?.items) ? billingRunNote.items : [],
      drafts: Array.isArray(draftNote?.items) ? draftNote.items : [],
      internalInvoices: Array.isArray(internalInvoiceNote?.items) ? internalInvoiceNote.items : [],
      runsCount,
    };
  }

  private issue(
    issues: QualityIssueDraft[],
    input: Omit<QualityIssueDraft, 'billingImpact'> & { billingImpact?: DataQualityBillingImpact },
  ) {
    issues.push({ billingImpact: DataQualityBillingImpact.NO_BILLING_IMPACT, ...input });
  }

  private readingMeta(store: MeterMetadataStore, reading: { id: string; readingDate: Date }) {
    const raw = store.readings?.[reading.id] || {};
    return {
      status: String(raw.status || 'APPROVED').toUpperCase(),
      periodMonth: raw.periodMonth || monthFromDate(reading.readingDate),
      previousReadingValue: raw.previousReadingValue === undefined || raw.previousReadingValue === null ? null : Number(raw.previousReadingValue),
      consumptionValue: raw.consumptionValue === undefined || raw.consumptionValue === null ? null : Number(raw.consumptionValue),
      unit: raw.unit || null,
    };
  }

  private isMeterActive(store: MeterMetadataStore, meter: { id: string; status: MeterStatus | string }) {
    const alias = String(store.meters?.[meter.id]?.statusAlias || '').toUpperCase();
    if (alias === 'ARCHIVED' || alias === 'INACTIVE' || alias === 'REPLACED') return false;
    return alias === 'ACTIVE' || String(meter.status || '').toUpperCase() === 'ACTIVE';
  }

  private async detectIssues(associationId: string, billingMonth: string): Promise<QualityIssueDraft[]> {
    const ctx = await this.dataContext(associationId);
    const issues: QualityIssueDraft[] = [];

    if (!ctx.organization.isActive || String(ctx.organization.status) !== 'ACTIVE') {
      this.issue(issues, {
        key: `ASSOCIATION_NOT_ACTIVE:${associationId}`,
        category: DataQualityCategory.ASSOCIATION,
        severity: DataQualitySeverity.CRITICAL,
        entityType: DataQualityEntityType.ASSOCIATION,
        entityId: associationId,
        title: 'APC nu este activă',
        description: 'Asociația nu este în status ACTIVE sau este dezactivată.',
        recommendation: 'Activează asociația înainte de facturare.',
        actionUrl: '/admin/settings/organization',
        billingImpact: DataQualityBillingImpact.BLOCKS_BILLING,
        metadata: { status: ctx.organization.status, isActive: ctx.organization.isActive },
      });
    }
    if (!ctx.organization.associationCode) {
      this.issue(issues, {
        key: `ASSOCIATION_MISSING_CODE:${associationId}`,
        category: DataQualityCategory.ASSOCIATION,
        severity: DataQualitySeverity.WARNING,
        entityType: DataQualityEntityType.ASSOCIATION,
        entityId: associationId,
        title: 'Cod APC lipsă',
        description: 'Codul APC este folosit în facturi, exporturi și rapoarte.',
        recommendation: 'Completează codul APC în setările asociației.',
        actionUrl: '/admin/settings/organization',
        billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
      });
    }
    if (!ctx.organization.address) {
      this.issue(issues, {
        key: `ASSOCIATION_MISSING_ADDRESS:${associationId}`,
        category: DataQualityCategory.ASSOCIATION,
        severity: DataQualitySeverity.INFO,
        entityType: DataQualityEntityType.ASSOCIATION,
        entityId: associationId,
        title: 'Adresa asociației lipsește',
        description: 'Adresa completă ajută la documente și comunicare.',
        recommendation: 'Completează adresa în profilul asociației.',
        actionUrl: '/admin/settings/organization',
      });
    }

    if (!ctx.apartments.length) {
      this.issue(issues, {
        key: 'NO_APARTMENTS',
        category: DataQualityCategory.APARTMENTS,
        severity: DataQualitySeverity.CRITICAL,
        entityType: DataQualityEntityType.SYSTEM,
        title: 'Nu există apartamente',
        description: 'Nu poți calcula facturarea fără apartamente.',
        recommendation: 'Adaugă sau importă apartamentele asociației.',
        actionUrl: '/admin/imports/apartments',
        billingImpact: DataQualityBillingImpact.BLOCKS_BILLING,
      });
    }

    const apartmentNumbers = new Map<string, typeof ctx.apartments>();
    ctx.apartments.forEach((apartment) => {
      const key = String(apartment.number || '').trim().toLowerCase();
      apartmentNumbers.set(key, [...(apartmentNumbers.get(key) || []), apartment]);
      if (!String(apartment.number || '').trim()) {
        this.issue(issues, {
          key: `APARTMENT_MISSING_NUMBER:${apartment.id}`,
          category: DataQualityCategory.APARTMENTS,
          severity: DataQualitySeverity.CRITICAL,
          entityType: DataQualityEntityType.APARTMENT,
          entityId: apartment.id,
          title: 'Apartament fără număr',
          description: 'Un apartament nu are număr completat.',
          recommendation: 'Completează numărul apartamentului.',
          actionUrl: `/admin/apartments/${apartment.id}`,
          billingImpact: DataQualityBillingImpact.BLOCKS_BILLING,
        });
      }
      if (!apartment.areaM2 || Number(apartment.areaM2) <= 0) {
        this.issue(issues, {
          key: `APARTMENT_MISSING_AREA:${apartment.id}`,
          category: DataQualityCategory.APARTMENTS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.APARTMENT,
          entityId: apartment.id,
          title: 'Apartament fără suprafață',
          description: `Apartamentul ${apartment.number || '-'} nu are suprafața completată.`,
          recommendation: 'Completează suprafața pentru tarifele per m².',
          actionUrl: `/admin/apartments/${apartment.id}`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
        });
      }
      if (!apartment.staircase?.name) {
        this.issue(issues, {
          key: `APARTMENT_WITHOUT_STAIRCASE:${apartment.id}`,
          category: DataQualityCategory.APARTMENTS,
          severity: DataQualitySeverity.INFO,
          entityType: DataQualityEntityType.APARTMENT,
          entityId: apartment.id,
          title: 'Apartament fără scară',
          description: `Apartamentul ${apartment.number || '-'} nu are scara completată.`,
          recommendation: 'Completează scara pentru filtre și rapoarte mai clare.',
          actionUrl: `/admin/apartments/${apartment.id}`,
        });
      }
      if (apartment.status === ApartmentStatus.EMPTY) {
        this.issue(issues, {
          key: `APARTMENT_UNKNOWN_STATUS:${apartment.id}`,
          category: DataQualityCategory.APARTMENTS,
          severity: DataQualitySeverity.INFO,
          entityType: DataQualityEntityType.APARTMENT,
          entityId: apartment.id,
          title: 'Status apartament neclar',
          description: `Apartamentul ${apartment.number || '-'} are status EMPTY/UNKNOWN.`,
          recommendation: 'Confirmă dacă apartamentul este ocupat sau vacant.',
          actionUrl: `/admin/apartments/${apartment.id}`,
        });
      }
      const primaryContacts = apartment.apartmentResidents.filter((item) => item.isPrimary);
      if (!primaryContacts.length && !apartment.ownerResident) {
        this.issue(issues, {
          key: `APARTMENT_WITHOUT_PRIMARY_CONTACT:${apartment.id}`,
          category: DataQualityCategory.RESIDENTS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.APARTMENT,
          entityId: apartment.id,
          title: 'Apartament fără contact principal',
          description: `Apartamentul ${apartment.number || '-'} nu are contact principal setat.`,
          recommendation: 'Setează un locatar ca primary contact.',
          actionUrl: `/admin/apartments/${apartment.id}`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
        });
      }
      if (!apartment.apartmentResidents.length && !apartment.ownerResident) {
        this.issue(issues, {
          key: `APARTMENT_WITHOUT_RESIDENTS:${apartment.id}`,
          category: DataQualityCategory.RESIDENTS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.APARTMENT,
          entityId: apartment.id,
          title: 'Apartament fără locatari',
          description: `Apartamentul ${apartment.number || '-'} nu are niciun locatar legat.`,
          recommendation: 'Leagă proprietarul sau reprezentantul de apartament.',
          actionUrl: `/admin/apartments/${apartment.id}`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
        });
      }
      if (primaryContacts.length > 1) {
        this.issue(issues, {
          key: `APARTMENT_MULTIPLE_PRIMARY_CONTACTS:${apartment.id}`,
          category: DataQualityCategory.RESIDENTS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.APARTMENT,
          entityId: apartment.id,
          title: 'Mai mulți primary contacts',
          description: `Apartamentul ${apartment.number || '-'} are ${primaryContacts.length} contacte principale.`,
          recommendation: 'Păstrează un singur contact principal.',
          actionUrl: `/admin/apartments/${apartment.id}`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
        });
      }
      primaryContacts.forEach((relation) => {
        if (relation.resident?.user && relation.resident.user.isActive === false) {
          this.issue(issues, {
            key: `INACTIVE_PRIMARY_CONTACT:${apartment.id}:${relation.resident.id}`,
            category: DataQualityCategory.RESIDENTS,
            severity: DataQualitySeverity.WARNING,
            entityType: DataQualityEntityType.RESIDENT,
            entityId: relation.resident.id,
            title: 'Contact principal inactiv',
            description: `${fullName(relation.resident)} este contact principal, dar contul este inactiv.`,
            recommendation: 'Setează un contact principal activ.',
            actionUrl: `/admin/residents/${relation.resident.id}`,
            billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
          });
        }
      });
    });
    for (const [number, rows] of apartmentNumbers.entries()) {
      if (number && rows.length > 1) {
        this.issue(issues, {
          key: `APARTMENT_DUPLICATE_NUMBER:${number}`,
          category: DataQualityCategory.APARTMENTS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.SYSTEM,
          title: 'Număr de apartament duplicat',
          description: `Numărul ${rows[0]?.number} apare la ${rows.length} apartamente.`,
          recommendation: 'Verifică scările și numerotarea apartamentelor.',
          actionUrl: '/admin/apartments',
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
          metadata: { apartmentIds: rows.map((row) => row.id) },
        });
      }
    }

    if (!ctx.residents.length) {
      this.issue(issues, {
        key: 'NO_RESIDENTS',
        category: DataQualityCategory.RESIDENTS,
        severity: DataQualitySeverity.WARNING,
        entityType: DataQualityEntityType.SYSTEM,
        title: 'Nu există locatari',
        description: 'Nu există profiluri de locatari/proprietari în asociație.',
        recommendation: 'Adaugă sau importă locatari.',
        actionUrl: '/admin/imports/residents',
        billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
      });
    }
    ctx.residents.forEach((resident) => {
      if (!resident.phone && !resident.email) {
        this.issue(issues, {
          key: `RESIDENT_WITHOUT_CONTACT:${resident.id}`,
          category: DataQualityCategory.RESIDENTS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.RESIDENT,
          entityId: resident.id,
          title: 'Locatar fără date de contact',
          description: `${fullName(resident)} nu are telefon sau email.`,
          recommendation: 'Completează cel puțin o metodă de contact.',
          actionUrl: `/admin/residents/${resident.id}`,
        });
      }
      if (!resident.apartmentId && !resident.apartmentResidents.length) {
        this.issue(issues, {
          key: `RESIDENT_WITHOUT_APARTMENT:${resident.id}`,
          category: DataQualityCategory.RESIDENTS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.RESIDENT,
          entityId: resident.id,
          title: 'Locatar fără apartament',
          description: `${fullName(resident)} nu este legat de niciun apartament.`,
          recommendation: 'Leagă locatarul de apartamentul corect.',
          actionUrl: `/admin/residents/${resident.id}`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
        });
      }
    });

    const activeTariffs = ctx.tariffs.filter((tariff) => tariff.status === 'ACTIVE');
    if (!activeTariffs.length) {
      this.issue(issues, {
        key: 'NO_ACTIVE_TARIFFS',
        category: DataQualityCategory.TARIFFS,
        severity: DataQualitySeverity.CRITICAL,
        entityType: DataQualityEntityType.SYSTEM,
        title: 'Nu există tarife active',
        description: 'Nu poți calcula draftul fără cel puțin un tarif activ.',
        recommendation: 'Configurează cel puțin un tarif activ.',
        actionUrl: '/admin/tariffs',
        billingImpact: DataQualityBillingImpact.BLOCKS_BILLING,
      });
    }
    const tariffCodes = new Map<string, TariffRow[]>();
    activeTariffs.forEach((tariff) => {
      if (tariff.internalCode) tariffCodes.set(tariff.internalCode, [...(tariffCodes.get(tariff.internalCode) || []), tariff]);
      const missingPrice =
        (tariff.calculationType === 'PER_M2' && Number(tariff.pricePerM2 || 0) <= 0) ||
        (tariff.calculationType === 'FIXED_PER_APARTMENT' && Number(tariff.fixedAmount || 0) <= 0) ||
        (tariff.calculationType === 'PER_METER_CONSUMPTION' && Number(tariff.pricePerUnit || 0) <= 0);
      if (missingPrice) {
        this.issue(issues, {
          key: `TARIFF_MISSING_PRICE:${tariff.id}`,
          category: DataQualityCategory.TARIFFS,
          severity: DataQualitySeverity.CRITICAL,
          entityType: DataQualityEntityType.TARIFF,
          entityId: tariff.id,
          title: 'Tarif fără preț valid',
          description: `Tariful ${tariff.name} nu are preț pozitiv.`,
          recommendation: 'Completează prețul tarifului.',
          actionUrl: tariff.calculationType === 'PER_METER_CONSUMPTION' ? `/admin/tariffs/meter-based/${tariff.id}/edit` : `/admin/tariffs/${tariff.id}`,
          billingImpact: DataQualityBillingImpact.BLOCKS_BILLING,
        });
      }
      if (tariff.startsAt && tariff.endsAt && new Date(tariff.startsAt) > new Date(tariff.endsAt)) {
        this.issue(issues, {
          key: `TARIFF_INVALID_DATE_RANGE:${tariff.id}`,
          category: DataQualityCategory.TARIFFS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.TARIFF,
          entityId: tariff.id,
          title: 'Interval tarif invalid',
          description: `Tariful ${tariff.name} are startsAt după endsAt.`,
          recommendation: 'Corectează perioada de valabilitate.',
          actionUrl: `/admin/tariffs/${tariff.id}/edit`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
        });
      }
      if (tariff.calculationType === 'PER_METER_CONSUMPTION' && !tariff.meterType) {
        this.issue(issues, {
          key: `METER_TARIFF_WITHOUT_METER_TYPE:${tariff.id}`,
          category: DataQualityCategory.TARIFFS,
          severity: DataQualitySeverity.CRITICAL,
          entityType: DataQualityEntityType.TARIFF,
          entityId: tariff.id,
          title: 'Tarif pe consum fără tip contor',
          description: `Tariful ${tariff.name} nu este legat de un tip de contor.`,
          recommendation: 'Selectează tipul de contor pentru tarif.',
          actionUrl: `/admin/tariffs/meter-based/${tariff.id}/edit`,
          billingImpact: DataQualityBillingImpact.BLOCKS_BILLING,
        });
      }
    });
    for (const [code, rows] of tariffCodes.entries()) {
      if (rows.length > 1) {
        this.issue(issues, {
          key: `TARIFF_DUPLICATE_INTERNAL_CODE:${code}`,
          category: DataQualityCategory.TARIFFS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.TARIFF,
          title: 'Cod intern tarif duplicat',
          description: `Codul ${code} este folosit de ${rows.length} tarife active.`,
          recommendation: 'Păstrează coduri interne unice pentru tarife active.',
          actionUrl: '/admin/tariffs',
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
          metadata: { tariffIds: rows.map((row) => row.id) },
        });
      }
    }

    const activeMeters = ctx.meters.filter((meter) => this.isMeterActive(ctx.meterMetadata, meter));
    const activeMetersByApartment = new Map<string, number>();
    activeMeters.forEach((meter) => activeMetersByApartment.set(meter.apartmentId, (activeMetersByApartment.get(meter.apartmentId) || 0) + 1));
    ctx.apartments.forEach((apartment) => {
      if (!activeMetersByApartment.get(apartment.id)) {
        this.issue(issues, {
          key: `APARTMENT_WITHOUT_ACTIVE_METERS:${apartment.id}`,
          category: DataQualityCategory.METERS,
          severity: DataQualitySeverity.INFO,
          entityType: DataQualityEntityType.APARTMENT,
          entityId: apartment.id,
          title: 'Apartament fără contoare active',
          description: `Apartamentul ${apartment.number || '-'} nu are contoare active.`,
          recommendation: 'Adaugă contoare dacă apartamentul trebuie facturat pe consum.',
          actionUrl: `/admin/apartments/${apartment.id}`,
          billingImpact: activeTariffs.some((tariff) => tariff.calculationType === 'PER_METER_CONSUMPTION')
            ? DataQualityBillingImpact.AFFECTS_BILLING
            : DataQualityBillingImpact.NO_BILLING_IMPACT,
        });
      }
    });
    const meterNumberMap = new Map<string, typeof ctx.meters>();
    const readingsByMeter = new Map<string, typeof ctx.readings>();
    ctx.readings.forEach((reading) => readingsByMeter.set(reading.meterId, [...(readingsByMeter.get(reading.meterId) || []), reading]));
    activeMeters.forEach((meter) => {
      const meta = ctx.meterMetadata.meters?.[meter.id] || {};
      const unit = optionalString(meta.unit) || '';
      if (!unit) {
        this.issue(issues, {
          key: `METER_MISSING_UNIT:${meter.id}`,
          category: DataQualityCategory.METERS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.METER,
          entityId: meter.id,
          title: 'Contor fără unitate',
          description: `Contorul ${meter.serialNumber || meter.id} nu are unitate explicită.`,
          recommendation: `Completează unitatea ${this.defaultMeterUnit(String(meter.type))}.`,
          actionUrl: `/admin/meters/${meter.id}`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
          metadata: { suggestedUnit: this.defaultMeterUnit(String(meter.type)) },
        });
      }
      if (!meter.serialNumber) {
        this.issue(issues, {
          key: `METER_MISSING_NUMBER:${meter.id}`,
          category: DataQualityCategory.METERS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.METER,
          entityId: meter.id,
          title: 'Contor fără număr',
          description: `Contorul pentru apartamentul ${meter.apartment?.number || '-'} nu are număr/serie.`,
          recommendation: 'Completează numărul contorului pentru importuri și verificări.',
          actionUrl: `/admin/meters/${meter.id}`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
        });
      } else {
        const key = meter.serialNumber.trim().toLowerCase();
        meterNumberMap.set(key, [...(meterNumberMap.get(key) || []), meter]);
      }
      const approved = (readingsByMeter.get(meter.id) || []).some((reading) => this.readingMeta(ctx.meterMetadata, reading).status === 'APPROVED');
      if (!approved) {
        this.issue(issues, {
          key: `ACTIVE_METER_WITHOUT_APPROVED_READINGS:${meter.id}`,
          category: DataQualityCategory.METERS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.METER,
          entityId: meter.id,
          title: 'Contor activ fără indici aprobați',
          description: `Contorul ${meter.serialNumber || meter.id} nu are niciun indice aprobat.`,
          recommendation: 'Importă sau aprobă primul indice.',
          actionUrl: `/admin/meters/${meter.id}`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
        });
      }
    });
    for (const [serial, rows] of meterNumberMap.entries()) {
      if (serial && rows.length > 1) {
        this.issue(issues, {
          key: `METER_DUPLICATE_NUMBER:${serial}`,
          category: DataQualityCategory.METERS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.METER,
          title: 'Număr contor duplicat',
          description: `Numărul de contor ${rows[0]?.serialNumber} apare de ${rows.length} ori.`,
          recommendation: 'Verifică seriile contoarelor duplicate.',
          actionUrl: '/admin/meters',
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
          metadata: { meterIds: rows.map((row) => row.id) },
        });
      }
    }

    const approvedByMeterMonth = new Map<string, typeof ctx.readings>();
    const currentReadingsByMeter = new Map<string, string[]>();
    ctx.readings.forEach((reading) => {
      const meta = this.readingMeta(ctx.meterMetadata, reading);
      const key = `${reading.meterId}:${meta.periodMonth}`;
      if (meta.status === 'APPROVED') approvedByMeterMonth.set(key, [...(approvedByMeterMonth.get(key) || []), reading]);
      if (meta.periodMonth === billingMonth && ['APPROVED', 'SUBMITTED'].includes(meta.status)) {
        currentReadingsByMeter.set(reading.meterId, [...(currentReadingsByMeter.get(reading.meterId) || []), meta.status]);
      }
      if (meta.status === 'SUBMITTED') {
        this.issue(issues, {
          key: `READING_SUBMITTED_PENDING:${reading.id}`,
          category: DataQualityCategory.METER_READINGS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.METER_READING,
          entityId: reading.id,
          title: 'Indice în așteptare',
          description: `Indicele pentru contorul ${reading.meter?.serialNumber || reading.meterId} așteaptă aprobare.`,
          recommendation: 'Aprobă, respinge sau marchează needs review.',
          actionUrl: `/admin/meter-readings/${reading.id}`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
        });
      }
      if (meta.status === 'NEEDS_REVIEW' || meta.status === 'REJECTED') {
        this.issue(issues, {
          key: `${meta.status === 'NEEDS_REVIEW' ? 'READING_NEEDS_REVIEW' : 'READING_REJECTED'}:${reading.id}`,
          category: DataQualityCategory.METER_READINGS,
          severity: meta.status === 'NEEDS_REVIEW' ? DataQualitySeverity.WARNING : DataQualitySeverity.INFO,
          entityType: DataQualityEntityType.METER_READING,
          entityId: reading.id,
          title: meta.status === 'NEEDS_REVIEW' ? 'Indice needs review' : 'Indice respins',
          description: `Indicele pentru contorul ${reading.meter?.serialNumber || reading.meterId} are status ${meta.status}.`,
          recommendation: 'Verifică istoricul indicilor și corectează dacă este necesar.',
          actionUrl: `/admin/meter-readings/${reading.id}`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
        });
      }
      if (meta.consumptionValue !== null && meta.consumptionValue < 0) {
        this.issue(issues, {
          key: `READING_NEGATIVE_CONSUMPTION:${reading.id}`,
          category: DataQualityCategory.METER_READINGS,
          severity: DataQualitySeverity.CRITICAL,
          entityType: DataQualityEntityType.METER_READING,
          entityId: reading.id,
          title: 'Consum negativ',
          description: `Indicele are consum calculat negativ (${meta.consumptionValue}).`,
          recommendation: 'Verifică valoarea curentă și indicele precedent.',
          actionUrl: `/admin/meter-readings/${reading.id}`,
          billingImpact: DataQualityBillingImpact.BLOCKS_BILLING,
        });
      }
      if (meta.previousReadingValue !== null && Number(reading.value) < Number(meta.previousReadingValue)) {
        this.issue(issues, {
          key: `READING_LOWER_THAN_PREVIOUS:${reading.id}`,
          category: DataQualityCategory.METER_READINGS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.METER_READING,
          entityId: reading.id,
          title: 'Indice mai mic decât precedentul',
          description: `Valoarea ${reading.value} este mai mică decât precedentul indice ${meta.previousReadingValue}.`,
          recommendation: 'Marchează pentru verificare sau corectează indicele.',
          actionUrl: `/admin/meter-readings/${reading.id}`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
        });
      }
    });
    activeMeters.forEach((meter) => {
      if (!currentReadingsByMeter.has(meter.id)) {
        this.issue(issues, {
          key: `MISSING_READING_FOR_CURRENT_MONTH:${meter.id}:${billingMonth}`,
          category: DataQualityCategory.METER_READINGS,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.METER,
          entityId: meter.id,
          title: 'Indice lipsă pentru luna curentă',
          description: `Contorul ${meter.serialNumber || meter.id} nu are indice aprobat sau transmis pentru ${billingMonth}.`,
          recommendation: 'Solicită transmiterea indicelui sau adaugă indice manual.',
          actionUrl: `/admin/meter-readings?meterId=${meter.id}&periodMonth=${billingMonth}`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
        });
      }
    });
    for (const [key, rows] of approvedByMeterMonth.entries()) {
      if (rows.length > 1) {
        this.issue(issues, {
          key: `DUPLICATE_APPROVED_READING:${key}`,
          category: DataQualityCategory.METER_READINGS,
          severity: DataQualitySeverity.CRITICAL,
          entityType: DataQualityEntityType.METER_READING,
          title: 'Indici aprobați dublați',
          description: 'Există mai mulți indici APPROVED pentru același contor și aceeași lună.',
          recommendation: 'Anulează sau corectează duplicatele înainte de calcul.',
          actionUrl: '/admin/meter-readings',
          billingImpact: DataQualityBillingImpact.BLOCKS_BILLING,
          metadata: { readingIds: rows.map((row) => row.id), key },
        });
      }
    }

    const runs = ctx.billingRuns.filter((run: any) => run?.status !== 'CANCELLED');
    const currentRun = runs.find((run: any) => run?.billingMonth === billingMonth) || null;
    const drafts = ctx.drafts.filter((draft: any) => draft?.status !== 'CANCELLED');
    const currentDraft = currentRun?.draftId
      ? drafts.find((draft: any) => draft.id === currentRun.draftId) || null
      : drafts.find((draft: any) => draft.billingMonth === billingMonth) || null;
    if (!currentRun) {
      this.issue(issues, {
        key: `NO_BILLING_RUN_CURRENT_MONTH:${billingMonth}`,
        category: DataQualityCategory.BILLING,
        severity: DataQualitySeverity.WARNING,
        entityType: DataQualityEntityType.BILLING_RUN,
        title: 'Nu există proces lunar',
        description: `Nu există BillingRun pentru luna ${billingMonth}.`,
        recommendation: 'Pornește procesul lunar de facturare.',
        actionUrl: `/admin/billing?billingMonth=${billingMonth}`,
        billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
      });
    } else {
      const failedChecks = Array.isArray(currentRun.checks)
        ? currentRun.checks.filter((check: any) => check?.status === 'FAILED' || check?.severity === 'CRITICAL')
        : [];
      if (failedChecks.length) {
        this.issue(issues, {
          key: `BILLING_RUN_HAS_CRITICAL_CHECKS:${currentRun.id}`,
          category: DataQualityCategory.BILLING,
          severity: DataQualitySeverity.CRITICAL,
          entityType: DataQualityEntityType.BILLING_RUN,
          entityId: currentRun.id,
          title: 'BillingRun are verificări critice',
          description: `Procesul lunar are ${failedChecks.length} verificări critice.`,
          recommendation: 'Rezolvă verificările critice din procesul lunar.',
          actionUrl: `/admin/billing/runs/${currentRun.id}`,
          billingImpact: DataQualityBillingImpact.BLOCKS_BILLING,
          metadata: { failedChecks: failedChecks.map((check: any) => check.key || check.label) },
        });
      }
    }
    if (!currentDraft) {
      this.issue(issues, {
        key: `DRAFT_MISSING:${billingMonth}`,
        category: DataQualityCategory.BILLING,
        severity: DataQualitySeverity.WARNING,
        entityType: DataQualityEntityType.INVOICE_DRAFT,
        title: 'Draft lipsă',
        description: `Nu există draft de facturi pentru ${billingMonth}.`,
        recommendation: 'Calculează draftul după rezolvarea problemelor critice.',
        actionUrl: '/admin/invoices/draft',
        billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
      });
    } else {
      if (Number(currentDraft.errorsCount || 0) > 0) {
        this.issue(issues, {
          key: `DRAFT_HAS_ERRORS:${currentDraft.id}`,
          category: DataQualityCategory.BILLING,
          severity: DataQualitySeverity.CRITICAL,
          entityType: DataQualityEntityType.INVOICE_DRAFT,
          entityId: currentDraft.id,
          title: 'Draft cu erori',
          description: `Draftul are ${currentDraft.errorsCount} erori.`,
          recommendation: 'Revizuiește draftul înainte de blocare.',
          actionUrl: `/admin/invoices/draft/${currentDraft.id}/review`,
          billingImpact: DataQualityBillingImpact.BLOCKS_BILLING,
        });
      }
      if (currentDraft.status !== 'LOCKED' && currentDraft.status !== 'CANCELLED') {
        this.issue(issues, {
          key: `DRAFT_NOT_LOCKED:${currentDraft.id}`,
          category: DataQualityCategory.BILLING,
          severity: DataQualitySeverity.INFO,
          entityType: DataQualityEntityType.INVOICE_DRAFT,
          entityId: currentDraft.id,
          title: 'Draft neblocat',
          description: 'Draftul este calculat, dar nu este blocat.',
          recommendation: 'Revizuiește și blochează draftul când datele sunt corecte.',
          actionUrl: `/admin/invoices/draft/${currentDraft.id}/review`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
        });
      }
      if (currentDraft.status === 'LOCKED' && !currentDraft.invoicesGenerated) {
        this.issue(issues, {
          key: `LOCKED_DRAFT_NOT_FINALIZED:${currentDraft.id}`,
          category: DataQualityCategory.BILLING,
          severity: DataQualitySeverity.WARNING,
          entityType: DataQualityEntityType.INVOICE_DRAFT,
          entityId: currentDraft.id,
          title: 'Draft blocat fără facturi generate',
          description: 'Draftul este blocat, dar facturile finale nu au fost generate.',
          recommendation: 'Finalizează facturile din draftul blocat.',
          actionUrl: `/admin/invoices/finalize/${currentDraft.id}`,
          billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
        });
      }
    }

    ctx.internalInvoices.forEach((invoice: any) => {
      const balance = Number(invoice.balanceAmount || 0);
      const paid = Number(invoice.paidAmount || 0);
      const total = Number(invoice.totalAmount || 0);
      const status = String(invoice.status || '').toUpperCase();
      if (balance < 0) this.invoiceIssue(issues, invoice, 'INVOICE_NEGATIVE_BALANCE', 'Factură cu sold negativ', 'Soldul facturii este negativ.', DataQualitySeverity.WARNING);
      if (status === 'PAID' && balance > 0) this.invoiceIssue(issues, invoice, 'PAID_INVOICE_WITH_BALANCE', 'Factură PAID cu sold', 'Factura este PAID, dar are sold restant.', DataQualitySeverity.CRITICAL);
      if (status === 'ISSUED' && paid > 0) this.invoiceIssue(issues, invoice, 'ISSUED_INVOICE_WITH_PAID_AMOUNT', 'Factură ISSUED cu plăți', 'Factura este ISSUED, dar are paidAmount pozitiv.', DataQualitySeverity.WARNING);
      if (paid > total) this.invoiceIssue(issues, invoice, 'INVOICE_OVERPAID', 'Factură supraachitată', 'paidAmount este mai mare decât totalAmount.', DataQualitySeverity.WARNING);
    });
    ctx.residentInvoices.forEach((invoice) => {
      const balance = Number(invoice.totalDue || 0) - Number(invoice.paymentsAmount || 0);
      if (balance < 0) this.legacyInvoiceIssue(issues, invoice, 'INVOICE_NEGATIVE_BALANCE', 'Factură cu sold negativ', 'Soldul calculat este negativ.', DataQualitySeverity.WARNING);
      if (invoice.status === ResidentInvoiceStatus.PAID && balance > 0) this.legacyInvoiceIssue(issues, invoice, 'PAID_INVOICE_WITH_BALANCE', 'Factură PAID cu sold', 'Factura este PAID, dar are sold restant.', DataQualitySeverity.CRITICAL);
      if (invoice.status === ResidentInvoiceStatus.ISSUED && Number(invoice.paymentsAmount || 0) > 0) this.legacyInvoiceIssue(issues, invoice, 'ISSUED_INVOICE_WITH_PAID_AMOUNT', 'Factură ISSUED cu plăți', 'Factura este ISSUED, dar are plăți înregistrate.', DataQualitySeverity.WARNING);
      if (Number(invoice.paymentsAmount || 0) > Number(invoice.totalDue || 0)) this.legacyInvoiceIssue(issues, invoice, 'INVOICE_OVERPAID', 'Factură supraachitată', 'paymentsAmount este mai mare decât totalDue.', DataQualitySeverity.WARNING);
    });
    const paymentSums = new Map<string, number>();
    ctx.payments.forEach((payment) => {
      if (payment.status === PaymentStatus.CONFIRMED) {
        if (!payment.invoiceId || !payment.invoice) {
          this.issue(issues, {
            key: `PAYMENT_WITHOUT_VALID_INVOICE:${payment.id}`,
            category: DataQualityCategory.INVOICES_PAYMENTS,
            severity: DataQualitySeverity.WARNING,
            entityType: DataQualityEntityType.PAYMENT,
            entityId: payment.id,
            title: 'Plată fără factură validă',
            description: 'O plată confirmată nu este legată de o factură validă.',
            recommendation: 'Verifică reconcilierea plății.',
            actionUrl: `/admin/payments?paymentId=${payment.id}`,
            billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
          });
        } else {
          paymentSums.set(payment.invoiceId, (paymentSums.get(payment.invoiceId) || 0) + Number(payment.amount || 0));
        }
      }
    });
    ctx.residentInvoices.forEach((invoice) => {
      const sum = Number((paymentSums.get(invoice.id) || 0).toFixed(2));
      const stored = Number(Number(invoice.paymentsAmount || 0).toFixed(2));
      if (Math.abs(sum - stored) > 0.01) {
        this.legacyInvoiceIssue(
          issues,
          invoice,
          'INVOICE_PAYMENT_SUM_MISMATCH',
          'Diferență între plăți și factură',
          `paymentsAmount (${stored}) diferă de suma plăților CONFIRMED (${sum}).`,
          DataQualitySeverity.WARNING,
          { confirmedPaymentsSum: sum, storedPaymentsAmount: stored },
        );
      }
    });

    return issues;
  }

  private invoiceIssue(
    issues: QualityIssueDraft[],
    invoice: any,
    prefix: string,
    title: string,
    description: string,
    severity: DataQualitySeverity,
  ) {
    this.issue(issues, {
      key: `${prefix}:${invoice.id || invoice.invoiceId || invoice.invoiceNumber}`,
      category: DataQualityCategory.INVOICES_PAYMENTS,
      severity,
      entityType: DataQualityEntityType.INTERNAL_INVOICE,
      entityId: invoice.id || invoice.invoiceId || null,
      title,
      description: `${description} Factura ${invoice.invoiceNumber || invoice.id || ''}.`,
      recommendation: 'Verifică factura și plățile asociate.',
      actionUrl: `/admin/invoices/${invoice.id || invoice.invoiceId || ''}`,
      billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        balanceAmount: invoice.balanceAmount,
        status: invoice.status,
      },
    });
  }

  private legacyInvoiceIssue(
    issues: QualityIssueDraft[],
    invoice: { id: string; invoiceNumber: string; totalDue: number; paymentsAmount: number; status: ResidentInvoiceStatus; month: number; year: number },
    prefix: string,
    title: string,
    description: string,
    severity: DataQualitySeverity,
    metadata: Record<string, unknown> = {},
  ) {
    this.issue(issues, {
      key: `${prefix}:${invoice.id}`,
      category: DataQualityCategory.INVOICES_PAYMENTS,
      severity,
      entityType: DataQualityEntityType.INTERNAL_INVOICE,
      entityId: invoice.id,
      title,
      description: `${description} Factura ${invoice.invoiceNumber}.`,
      recommendation: 'Verifică factura și plățile asociate.',
      actionUrl: `/admin/invoices/${invoice.id}`,
      billingImpact: DataQualityBillingImpact.AFFECTS_BILLING,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        totalDue: invoice.totalDue,
        paymentsAmount: invoice.paymentsAmount,
        status: invoice.status,
        billingMonth: `${invoice.year}-${String(invoice.month).padStart(2, '0')}`,
        ...metadata,
      },
    });
  }

  private async persistRunIssues(associationId: string, actorUserId: string, runId: string, billingMonth: string, drafts: QualityIssueDraft[]) {
    const now = new Date();
    const incomingKeys = new Set(drafts.map((issue) => issue.key));
    const existing = await this.prisma.dataQualityIssue.findMany({
      where: { associationId },
      select: { id: true, key: true, status: true },
    });
    const existingByKey = new Map(existing.map((issue) => [issue.key, issue]));

    await this.prisma.$transaction(async (tx) => {
      for (const issue of drafts) {
        const current = existingByKey.get(issue.key);
        const data = {
          runId,
          category: issue.category,
          severity: issue.severity,
          entityType: issue.entityType,
          entityId: issue.entityId || null,
          title: issue.title,
          description: issue.description,
          recommendation: issue.recommendation,
          actionUrl: issue.actionUrl || null,
          billingImpact: issue.billingImpact,
          metadata: (issue.metadata || {}) as Prisma.InputJsonValue,
          detectedAt: now,
        };
        if (current) {
          await tx.dataQualityIssue.update({
            where: { id: current.id },
            data: {
              ...data,
              status: current.status === DataQualityIssueStatus.IGNORED ? DataQualityIssueStatus.IGNORED : DataQualityIssueStatus.OPEN,
              resolvedAt: current.status === DataQualityIssueStatus.IGNORED ? undefined : null,
              resolvedById: current.status === DataQualityIssueStatus.IGNORED ? undefined : null,
            },
          });
        } else {
          await tx.dataQualityIssue.create({
            data: {
              associationId,
              key: issue.key,
              status: DataQualityIssueStatus.OPEN,
              ...data,
            },
          });
        }
      }

      const stale = existing.filter((issue) => issue.status === DataQualityIssueStatus.OPEN && !incomingKeys.has(issue.key));
      if (stale.length) {
        await tx.dataQualityIssue.updateMany({
          where: { id: { in: stale.map((issue) => issue.id) } },
          data: {
            status: DataQualityIssueStatus.RESOLVED,
            resolvedAt: now,
            resolvedById: null,
            metadata: { resolvedAutomatically: true, billingMonth } as Prisma.InputJsonValue,
          },
        });
      }
    });

    const [openStats, resolvedCount, ignoredCount] = await Promise.all([
      this.prisma.dataQualityIssue.groupBy({
        by: ['severity'],
        where: { associationId, status: DataQualityIssueStatus.OPEN },
        _count: { _all: true },
      }),
      this.prisma.dataQualityIssue.count({ where: { associationId, status: DataQualityIssueStatus.RESOLVED } }),
      this.prisma.dataQualityIssue.count({ where: { associationId, status: DataQualityIssueStatus.IGNORED } }),
    ]);
    const counts = {
      critical: openStats.find((row) => row.severity === DataQualitySeverity.CRITICAL)?._count._all || 0,
      warning: openStats.find((row) => row.severity === DataQualitySeverity.WARNING)?._count._all || 0,
      info: openStats.find((row) => row.severity === DataQualitySeverity.INFO)?._count._all || 0,
    };
    const score = scoreFromCounts(counts.critical, counts.warning, counts.info);
    await this.prisma.dataQualityRun.update({
      where: { id: runId },
      data: {
        status: DataQualityRunStatus.COMPLETED,
        score,
        criticalCount: counts.critical,
        warningCount: counts.warning,
        infoCount: counts.info,
        resolvedCount,
        ignoredCount,
        completedAt: new Date(),
      },
    });

    await this.audit.createLog({
      associationId,
      actorUserId,
      actorRole: 'ADMIN',
      action: 'DATA_QUALITY_RUN',
      entityType: 'SYSTEM',
      entityId: runId,
      title: 'Verificări calitate date rulate',
      message: `Verificările Data Quality pentru ${billingMonth} au fost rulate: scor ${score}, ${counts.critical} critice, ${counts.warning} warnings.`,
      severity: counts.critical ? 'ERROR' : counts.warning ? 'WARNING' : 'SUCCESS',
      metadata: { billingMonth, score, criticalCount: counts.critical, warningCount: counts.warning, infoCount: counts.info },
      actionUrl: `/admin/data-quality/runs/${runId}`,
    }).catch(() => null);

    return { score, ...counts, resolvedCount, ignoredCount };
  }

  private async summary(associationId: string) {
    const [lastRun, openStats, statusStats, issueCounts, affectedApartments, affectedResidents, affectedMeters, blocksBilling, affectsBilling] = await Promise.all([
      this.prisma.dataQualityRun.findFirst({ where: { associationId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.dataQualityIssue.groupBy({
        by: ['severity'],
        where: { associationId, status: DataQualityIssueStatus.OPEN },
        _count: { _all: true },
      }),
      this.prisma.dataQualityIssue.groupBy({
        by: ['status'],
        where: { associationId },
        _count: { _all: true },
      }),
      this.prisma.dataQualityIssue.count({ where: { associationId } }),
      this.prisma.dataQualityIssue.count({ where: { associationId, status: DataQualityIssueStatus.OPEN, entityType: DataQualityEntityType.APARTMENT } }),
      this.prisma.dataQualityIssue.count({ where: { associationId, status: DataQualityIssueStatus.OPEN, entityType: DataQualityEntityType.RESIDENT } }),
      this.prisma.dataQualityIssue.count({ where: { associationId, status: DataQualityIssueStatus.OPEN, entityType: DataQualityEntityType.METER } }),
      this.prisma.dataQualityIssue.count({ where: { associationId, status: DataQualityIssueStatus.OPEN, billingImpact: DataQualityBillingImpact.BLOCKS_BILLING } }),
      this.prisma.dataQualityIssue.count({ where: { associationId, status: DataQualityIssueStatus.OPEN, billingImpact: DataQualityBillingImpact.AFFECTS_BILLING } }),
    ]);
    const criticalCount = openStats.find((row) => row.severity === DataQualitySeverity.CRITICAL)?._count._all || 0;
    const warningCount = openStats.find((row) => row.severity === DataQualitySeverity.WARNING)?._count._all || 0;
    const infoCount = openStats.find((row) => row.severity === DataQualitySeverity.INFO)?._count._all || 0;
    const openIssues = criticalCount + warningCount + infoCount;
    const resolvedIssues = statusStats.find((row) => row.status === DataQualityIssueStatus.RESOLVED)?._count._all || 0;
    const ignoredIssues = statusStats.find((row) => row.status === DataQualityIssueStatus.IGNORED)?._count._all || 0;
    const score = lastRun?.score ?? scoreFromCounts(criticalCount, warningCount, infoCount);
    return {
      score,
      statusLabel: statusLabelFromScore(score, criticalCount),
      criticalCount,
      warningCount,
      infoCount,
      openIssues,
      resolvedIssues,
      ignoredIssues,
      issuesCount: issueCounts,
      affectedApartments,
      affectedResidents,
      affectedMeters,
      blocksBillingCount: blocksBilling,
      affectsBillingCount: affectsBilling,
      lastRunAt: lastRun?.completedAt?.toISOString() || lastRun?.createdAt?.toISOString() || null,
      lastRunId: lastRun?.id || null,
    };
  }

  private serializeIssue(issue: any) {
    return {
      id: issue.id,
      key: issue.key,
      category: issue.category,
      categoryLabel: CATEGORY_LABELS[issue.category as DataQualityCategory] || issue.category,
      severity: issue.severity,
      status: issue.status,
      entityType: issue.entityType,
      entityId: issue.entityId,
      title: issue.title,
      description: issue.description,
      recommendation: issue.recommendation,
      actionUrl: issue.actionUrl,
      billingImpact: issue.billingImpact,
      metadata: issue.metadata || {},
      detectedAt: issue.detectedAt?.toISOString?.() || issue.detectedAt,
      resolvedAt: issue.resolvedAt?.toISOString?.() || issue.resolvedAt || null,
      ignoredAt: issue.ignoredAt?.toISOString?.() || issue.ignoredAt || null,
      ignoreReason: issue.ignoreReason || null,
      runId: issue.runId || null,
      quickFixes: this.quickFixes(issue),
    };
  }

  private quickFixes(issue: any) {
    const key = String(issue.key || '');
    const status = String(issue.status || 'OPEN');
    if (status !== DataQualityIssueStatus.OPEN) {
      return [this.fixOption('REOPEN_ISSUE', 'Redeschide problema', 'Readuce problema în lista activă.', false)];
    }
    const options: FixOption[] = [];
    if (key.startsWith('APARTMENT_MISSING_AREA')) options.push(this.fixOption('SET_APARTMENT_AREA', 'Completează suprafața', 'Setează areaM2 pentru apartament.'));
    if (key.startsWith('APARTMENT_UNKNOWN_STATUS')) options.push(this.fixOption('SET_APARTMENT_STATUS', 'Setează status apartament', 'Confirmă dacă apartamentul este ocupat, vacant sau necunoscut.'));
    if (key.startsWith('APARTMENT_WITHOUT_STAIRCASE')) options.push(this.fixOption('SET_APARTMENT_STAIRCASE', 'Completează scara', 'Leagă apartamentul la o scară existentă sau nouă.'));
    if (key.startsWith('APARTMENT_WITHOUT_PRIMARY_CONTACT') || key.startsWith('INACTIVE_PRIMARY_CONTACT')) {
      options.push(this.fixOption('SET_PRIMARY_CONTACT', 'Alege contact principal', 'Setează un locatar existent ca primary contact.'));
    }
    if (key.startsWith('APARTMENT_MULTIPLE_PRIMARY_CONTACTS')) {
      options.push(this.fixOption('RESOLVE_MULTIPLE_PRIMARY_CONTACTS', 'Păstrează un singur contact principal', 'Alege contactul principal corect.'));
    }
    if (key.startsWith('RESIDENT_WITHOUT_APARTMENT') || key.startsWith('APARTMENT_WITHOUT_RESIDENTS')) {
      options.push(this.fixOption('LINK_RESIDENT_TO_APARTMENT', 'Leagă locatar de apartament', 'Creează o relație apartment-resident fără a șterge relații existente.'));
    }
    if (key.startsWith('RESIDENT_WITHOUT_CONTACT')) {
      options.push(this.fixOption('SET_RESIDENT_STATUS', 'Setează status locatar', 'Ajustează statusul contului fără a crea date de contact fictive.'));
    }
    if (key.startsWith('TARIFF_MISSING_PRICE') || key.startsWith('METER_TARIFF_WITHOUT_PRICE_PER_UNIT') || key.startsWith('METER_TARIFF_WITHOUT_METER_TYPE')) {
      options.push(this.fixOption('SET_TARIFF_PRICE', 'Completează tariful', 'Setează prețul și câmpurile obligatorii pentru tarif.'));
    }
    if (key.startsWith('METER_MISSING_UNIT')) options.push(this.fixOption('SET_METER_UNIT', 'Completează unitatea contorului', 'Setează unitatea pe baza tipului de contor.'));
    if (key.startsWith('METER_MISSING_NUMBER')) options.push(this.fixOption('SET_METER_NUMBER', 'Completează numărul contorului', 'Setează numărul/seria contorului.'));
    if (key.startsWith('ACTIVE_METER_WITHOUT_APPROVED_READINGS') || key.startsWith('MISSING_READING_FOR_CURRENT_MONTH')) {
      options.push(this.fixOption('SET_METER_STATUS', 'Actualizează status contor', 'Marchează contorul inactiv, înlocuit sau arhivat dacă nu mai este folosit.'));
    }
    if (key.startsWith('READING_SUBMITTED_PENDING') || key.startsWith('READING_NEEDS_REVIEW') || key.startsWith('READING_NEGATIVE_CONSUMPTION') || key.startsWith('READING_LOWER_THAN_PREVIOUS')) {
      options.push(this.fixOption('MARK_READING_NEEDS_REVIEW', 'Marchează indice needs review', 'Semnalează indicele pentru verificare manuală.'));
      options.push(this.fixOption('REJECT_METER_READING', 'Respinge indicele cu motiv', 'Respinge indicele fără a modifica facturi.'));
    }
    if (key.startsWith('NO_BILLING_RUN_CURRENT_MONTH')) options.push(this.fixOption('START_BILLING_RUN', 'Pornește BillingRun', 'Creează procesul lunar fără a calcula draftul.'));
    if (key.startsWith('BILLING_RUN_HAS_CRITICAL_CHECKS') || key.startsWith('DRAFT_HAS_ERRORS')) {
      options.push(this.fixOption('RUN_DATA_QUALITY', 'Rulează verificările din nou', 'Actualizează lista de probleme după corecții.', false));
    }
    options.push(this.fixOption('MARK_ISSUE_RESOLVED', 'Marchează rezolvată manual', 'Folosește doar dacă problema a fost rezolvată în afara quick fix-ului.'));
    options.push(this.fixOption('MARK_ISSUE_IGNORED', 'Ignoră cu motiv', 'Ignorarea ascunde problema din lista activă, dar nu o rezolvă.'));
    return options;
  }

  private async categories(associationId: string) {
    const rows = await this.prisma.dataQualityIssue.groupBy({
      by: ['category', 'severity'],
      where: { associationId, status: DataQualityIssueStatus.OPEN },
      _count: { _all: true },
    });
    return Object.values(DataQualityCategory).map((category) => {
      const subset = rows.filter((row) => row.category === category);
      const criticalCount = subset.find((row) => row.severity === DataQualitySeverity.CRITICAL)?._count._all || 0;
      const warningCount = subset.find((row) => row.severity === DataQualitySeverity.WARNING)?._count._all || 0;
      const infoCount = subset.find((row) => row.severity === DataQualitySeverity.INFO)?._count._all || 0;
      return {
        category,
        label: CATEGORY_LABELS[category],
        criticalCount,
        warningCount,
        infoCount,
        openIssues: criticalCount + warningCount + infoCount,
      };
    }).filter((category) => category.openIssues > 0);
  }

  private nextAction(summary: Awaited<ReturnType<DataQualityService['summary']>>) {
    if (!summary.lastRunAt) {
      return { key: 'RUN_CHECKS', label: 'Rulează verificările', actionUrl: '/admin/data-quality', description: 'Nu există încă o verificare Data Quality.' };
    }
    if (summary.criticalCount > 0) {
      return { key: 'RESOLVE_CRITICAL', label: 'Rezolvă problemele critice', actionUrl: '/admin/data-quality/issues?severity=CRITICAL&status=OPEN', description: 'Problemele critice pot bloca facturarea.' };
    }
    if (summary.warningCount > 0) {
      return { key: 'REVIEW_WARNINGS', label: 'Revizuiește warnings', actionUrl: '/admin/data-quality/issues?severity=WARNING&status=OPEN', description: 'Warnings pot afecta comunicarea sau rapoartele.' };
    }
    return { key: 'GO_BILLING', label: 'Mergi la facturare', actionUrl: '/admin/billing', description: 'Datele arată bine pentru pașii următori.' };
  }

  private isActionableFix(option: FixOption) {
    return !['MARK_ISSUE_RESOLVED', 'MARK_ISSUE_IGNORED', 'REOPEN_ISSUE', 'RUN_DATA_QUALITY'].includes(option.type);
  }

  private async requireIssue(associationId: string, id: string) {
    const issue = await this.prisma.dataQualityIssue.findFirst({ where: { id, associationId } });
    if (!issue) throw new NotFoundException('Problema nu a fost găsită.');
    return issue;
  }

  private resolveRequestedFix(issue: any, requested?: unknown): DataQualityFixType {
    const options = this.quickFixes(issue);
    const fallback = options.find((option) => this.isActionableFix(option)) || options[0];
    const raw = optionalString(requested) || fallback?.type;
    const selected = options.find((option) => option.type === raw || option.key === raw);
    if (!selected) throw new BadRequestException('Remedierea selectată nu este disponibilă pentru această problemă.');
    return selected.type;
  }

  private async quickFixContext(associationId: string, issue: any) {
    const apartmentId = this.issueApartmentId(issue);
    const [apartments, residents, apartmentRelations, buildings, staircases] = await Promise.all([
      this.prisma.apartment.findMany({
        where: { organizationId: associationId },
        orderBy: [{ number: 'asc' }],
        take: 200,
        select: { id: true, number: true, floor: true, status: true, areaM2: true, building: { select: { id: true, name: true } }, staircase: { select: { id: true, name: true } } },
      }),
      this.prisma.residentProfile.findMany({
        where: { organizationId: associationId },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: 200,
        select: { id: true, firstName: true, lastName: true, phone: true, email: true, accountStatus: true },
      }),
      apartmentId
        ? this.prisma.apartmentResident.findMany({
            where: { apartmentId },
            include: { resident: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, accountStatus: true } } },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          })
        : Promise.resolve([]),
      this.prisma.building.findMany({
        where: { organizationId: associationId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.staircase.findMany({
        where: { organizationId: associationId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, buildingId: true, building: { select: { name: true } } },
      }),
    ]);
    return {
      apartments: apartments.map((apartment) => ({
        id: apartment.id,
        label: `Ap. ${apartment.number || '-'}${apartment.staircase?.name ? `, sc. ${apartment.staircase.name}` : ''}`,
        number: apartment.number,
        areaM2: apartment.areaM2,
        floor: apartment.floor,
        status: apartment.status,
        buildingId: apartment.building?.id || null,
        staircaseId: apartment.staircase?.id || null,
      })),
      buildings: buildings.map((building) => ({ id: building.id, label: building.name || 'Bloc', name: building.name })),
      staircases: staircases.map((staircase) => ({
        id: staircase.id,
        label: `${staircase.name || 'Fără nume'}${staircase.building?.name ? ` · ${staircase.building.name}` : ''}`,
        name: staircase.name,
        buildingId: staircase.buildingId,
      })),
      residents: residents.map((resident) => ({
        id: resident.id,
        label: `${fullName(resident)}${resident.phone ? ` · ${resident.phone}` : ''}`,
        fullName: fullName(resident),
        phone: resident.phone,
        email: resident.email,
        status: resident.accountStatus,
      })),
      apartmentResidents: apartmentRelations.map((relation) => ({
        residentId: relation.residentId,
        role: relation.role,
        isPrimary: relation.isPrimary,
        label: `${fullName(relation.resident)} · ${relation.role}${relation.isPrimary ? ' · primary' : ''}`,
        resident: {
          id: relation.resident.id,
          fullName: fullName(relation.resident),
          phone: relation.resident.phone,
          email: relation.resident.email,
          status: relation.resident.accountStatus,
        },
      })),
    };
  }

  private issueApartmentId(issue: any) {
    if (issue.entityType === DataQualityEntityType.APARTMENT && issue.entityId) return String(issue.entityId);
    const key = String(issue.key || '');
    if (key.startsWith('INACTIVE_PRIMARY_CONTACT:')) return key.split(':')[1] || null;
    return null;
  }

  private issueResidentId(issue: any) {
    if (issue.entityType === DataQualityEntityType.RESIDENT && issue.entityId) return String(issue.entityId);
    const key = String(issue.key || '');
    if (key.startsWith('INACTIVE_PRIMARY_CONTACT:')) return key.split(':')[2] || null;
    return null;
  }

  async listFixes(user: MvpUser, query: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    const { page, limit, skip } = resolvePagination(query);
    const where: Prisma.DataQualityIssueWhereInput = {
      associationId,
      status: DataQualityIssueStatus.OPEN,
      ...(optionalString(query.category) ? { category: optionalString(query.category) as DataQualityCategory } : {}),
      ...(optionalString(query.severity) ? { severity: optionalString(query.severity) as DataQualitySeverity } : {}),
    };
    const fixType = optionalString(query.fixType);
    const [allOpen, todaysFixes] = await Promise.all([
      this.prisma.dataQualityIssue.findMany({ where, orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }], take: 1000 }),
      this.prisma.auditLog.count({
        where: {
          organizationId: associationId,
          action: { in: ['DATA_QUALITY_FIX_APPLIED', 'DATA_QUALITY_BULK_FIX_APPLIED'] },
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }).catch(() => 0),
    ]);
    const withOptions = allOpen
      .map((issue) => ({ issue, options: this.quickFixes(issue) }))
      .filter((row) => row.options.some((option) => this.isActionableFix(option)))
      .filter((row) => !fixType || row.options.some((option) => option.type === fixType));
    const total = withOptions.length;
    const items = withOptions.slice(skip, skip + limit).map((row) => ({
      ...this.serializeIssue(row.issue),
      availableFixes: row.options.filter((option) => this.isActionableFix(option)),
    }));
    return {
      items,
      meta: buildPaginationMeta(page, limit, total),
      stats: {
        withQuickFix: total,
        withoutQuickFix: Math.max(0, allOpen.length - total),
        criticalFixable: withOptions.filter((row) => row.issue.severity === DataQualitySeverity.CRITICAL).length,
        warningFixable: withOptions.filter((row) => row.issue.severity === DataQualitySeverity.WARNING).length,
        ignoredIssues: await this.prisma.dataQualityIssue.count({ where: { associationId, status: DataQualityIssueStatus.IGNORED } }),
        fixesAppliedToday: todaysFixes,
        lastFixAt:
          (await this.prisma.auditLog.findFirst({
            where: { organizationId: associationId, action: { in: ['DATA_QUALITY_FIX_APPLIED', 'DATA_QUALITY_BULK_FIX_APPLIED'] } },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }).catch(() => null))?.createdAt?.toISOString?.() || null,
      },
    };
  }

  async fixOptions(user: MvpUser, id: string, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    const issue = await this.requireIssue(associationId, id);
    return {
      issue: this.serializeIssue(issue),
      options: this.quickFixes(issue),
      context: await this.quickFixContext(associationId, issue),
    };
  }

  async previewFix(user: MvpUser, id: string, body: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    const issue = await this.requireIssue(associationId, id);
    const fixType = this.resolveRequestedFix(issue, body.fixType);
    const payload = isRecord(body.payload) ? body.payload : {};
    return this.buildFixPreview(associationId, issue, fixType, payload);
  }

  private async buildFixPreview(associationId: string, issue: any, fixType: DataQualityFixType, payload: Record<string, unknown>): Promise<FixPreview> {
    const serializedIssue = this.serializeIssue(issue) as Record<string, unknown>;
    const option = this.quickFixes(issue).find((item) => item.type === fixType);
    const base = {
      issue: serializedIssue,
      fix: {
        type: fixType,
        label: option?.label || fixType,
        canApply: true,
        requiresConfirmation: true,
      },
      entity: {
        type: issue.entityType,
        id: issue.entityId || null,
        label: issue.title,
        actionUrl: issue.actionUrl || null,
      },
      changes: [] as FixChange[],
      warnings: [] as string[],
      impact: {
        billingImpact: issue.billingImpact as DataQualityBillingImpact,
        message: this.fixImpactMessage(issue.billingImpact),
      },
      options: await this.quickFixContext(associationId, issue),
    };

    if (fixType === 'MARK_ISSUE_RESOLVED') {
      const note = optionalString(payload.note) || optionalString(payload.reason);
      return { ...base, changes: [{ field: 'status', currentValue: issue.status, newValue: DataQualityIssueStatus.RESOLVED }], warnings: note ? [] : ['Adaugă o notă dacă problema a fost rezolvată manual.'] };
    }
    if (fixType === 'MARK_ISSUE_IGNORED') {
      const reason = optionalString(payload.reason);
      return { ...base, changes: [{ field: 'status', currentValue: issue.status, newValue: DataQualityIssueStatus.IGNORED }], warnings: reason ? ['Ignorarea nu modifică datele sursă.'] : ['Motivul ignorării este obligatoriu.'] };
    }
    if (fixType === 'REOPEN_ISSUE') {
      return { ...base, changes: [{ field: 'status', currentValue: issue.status, newValue: DataQualityIssueStatus.OPEN }] };
    }
    if (fixType === 'RUN_DATA_QUALITY') {
      const billingMonth = parseBillingMonth(payload.billingMonth || currentBillingMonth());
      return { ...base, entity: { type: 'SYSTEM', id: issue.id, label: 'Data Quality' }, changes: [{ field: 'billingMonth', currentValue: null, newValue: billingMonth }] };
    }
    if (fixType === 'START_BILLING_RUN') {
      const billingMonth = parseBillingMonth(payload.billingMonth || String(issue.key || '').split(':')[1] || currentBillingMonth());
      return { ...base, entity: { type: 'BILLING_RUN', id: null, label: `BillingRun ${billingMonth}` }, changes: [{ field: 'billingMonth', currentValue: null, newValue: billingMonth }, { field: 'status', currentValue: null, newValue: 'PRECHECK' }] };
    }

    if (fixType.startsWith('SET_APARTMENT') || ['SET_PRIMARY_CONTACT', 'LINK_RESIDENT_TO_APARTMENT', 'RESOLVE_MULTIPLE_PRIMARY_CONTACTS'].includes(fixType)) {
      return this.previewApartmentResidentFix(associationId, issue, fixType, payload, base);
    }
    if (fixType === 'SET_RESIDENT_STATUS') return this.previewResidentFix(associationId, issue, payload, base);
    if (fixType === 'SET_TARIFF_PRICE') return this.previewTariffFix(associationId, issue, payload, base);
    if (fixType.startsWith('SET_METER')) return this.previewMeterFix(associationId, issue, fixType, payload, base);
    if (fixType === 'MARK_READING_NEEDS_REVIEW' || fixType === 'REJECT_METER_READING') {
      return this.previewReadingFix(associationId, issue, fixType, payload, base);
    }
    throw new BadRequestException('Remedierea selectată nu este disponibilă.');
  }

  private fixImpactMessage(impact: DataQualityBillingImpact | string) {
    if (impact === DataQualityBillingImpact.BLOCKS_BILLING) return 'Această remediere poate debloca pașii de facturare după rerularea verificărilor.';
    if (impact === DataQualityBillingImpact.AFFECTS_BILLING) return 'Modificarea poate influența drafturi, rapoarte sau comunicarea cu locatarii.';
    return 'Modificarea nu are impact direct asupra facturării.';
  }

  private async previewApartmentResidentFix(
    associationId: string,
    issue: any,
    fixType: DataQualityFixType,
    payload: Record<string, unknown>,
    base: FixPreview,
  ): Promise<FixPreview> {
    const apartmentId = optionalString(payload.apartmentId) || this.issueApartmentId(issue);
    const residentId = optionalString(payload.residentId) || this.issueResidentId(issue);
    const apartment = apartmentId
      ? await this.prisma.apartment.findFirst({
          where: { id: apartmentId, organizationId: associationId },
          include: {
            building: { select: { id: true, name: true } },
            staircase: { select: { id: true, name: true } },
            apartmentResidents: { include: { resident: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, accountStatus: true } } } },
          },
        })
      : null;
    if (['SET_APARTMENT_AREA', 'SET_APARTMENT_STATUS', 'SET_APARTMENT_STAIRCASE', 'SET_APARTMENT_FLOOR', 'SET_PRIMARY_CONTACT', 'RESOLVE_MULTIPLE_PRIMARY_CONTACTS'].includes(fixType) && !apartment) {
      throw new NotFoundException('Apartamentul nu a fost găsit în asociația curentă.');
    }

    if (fixType === 'SET_APARTMENT_AREA') {
      const areaM2 = parsePositiveNumber(payload.areaM2, 'Suprafața trebuie să fie un număr pozitiv.');
      return { ...base, entity: { type: 'APARTMENT', id: apartment!.id, label: `Ap. ${apartment!.number || '-'}`, actionUrl: issue.actionUrl }, changes: [{ field: 'areaM2', currentValue: apartment!.areaM2, newValue: areaM2 }] };
    }
    if (fixType === 'SET_APARTMENT_STATUS') {
      const status = this.parseApartmentStatus(payload.status || 'OCCUPIED');
      return { ...base, entity: { type: 'APARTMENT', id: apartment!.id, label: `Ap. ${apartment!.number || '-'}`, actionUrl: issue.actionUrl }, changes: [{ field: 'status', currentValue: apartment!.status, newValue: status }] };
    }
    if (fixType === 'SET_APARTMENT_STAIRCASE') {
      const staircaseId = optionalString(payload.staircaseId);
      const staircaseName = optionalString(payload.staircaseName);
      const buildingName = optionalString(payload.buildingName);
      if (!staircaseId && !staircaseName) throw new BadRequestException('Alege o scară existentă sau completează numele scării.');
      const target = staircaseId
        ? await this.prisma.staircase.findFirst({ where: { id: staircaseId, organizationId: associationId }, include: { building: { select: { name: true } } } })
        : null;
      if (staircaseId && !target) throw new NotFoundException('Scara nu a fost găsită.');
      return {
        ...base,
        entity: { type: 'APARTMENT', id: apartment!.id, label: `Ap. ${apartment!.number || '-'}`, actionUrl: issue.actionUrl },
        changes: [
          { field: 'staircaseId', currentValue: apartment!.staircaseId, newValue: target?.id || 'new' },
          { field: 'staircaseName', currentValue: apartment!.staircase?.name || null, newValue: target?.name || staircaseName },
          { field: 'buildingName', currentValue: apartment!.building?.name || null, newValue: target?.building?.name || buildingName || apartment!.building?.name || 'Bloc' },
        ],
        warnings: target ? [] : ['Dacă scara nu există, va fi creată fără a șterge sau muta alte apartamente.'],
      };
    }
    if (fixType === 'SET_APARTMENT_FLOOR') {
      const floor = optionalNumber(payload.floor);
      if (floor === null || !Number.isInteger(floor)) throw new BadRequestException('Etajul trebuie să fie număr întreg.');
      return { ...base, entity: { type: 'APARTMENT', id: apartment!.id, label: `Ap. ${apartment!.number || '-'}`, actionUrl: issue.actionUrl }, changes: [{ field: 'floor', currentValue: apartment!.floor, newValue: floor }] };
    }

    if (fixType === 'LINK_RESIDENT_TO_APARTMENT') {
      const targetApartmentId = apartmentId || parseNonEmpty(payload.apartmentId, 'Apartamentul este obligatoriu.');
      const targetResidentId = residentId || parseNonEmpty(payload.residentId, 'Locatarul este obligatoriu.');
      const [targetApartment, resident] = await Promise.all([
        this.prisma.apartment.findFirst({ where: { id: targetApartmentId, organizationId: associationId }, select: { id: true, number: true } }),
        this.prisma.residentProfile.findFirst({ where: { id: targetResidentId, organizationId: associationId }, select: { id: true, firstName: true, lastName: true, phone: true, email: true } }),
      ]);
      if (!targetApartment) throw new NotFoundException('Apartamentul nu a fost găsit.');
      if (!resident) throw new NotFoundException('Locatarul nu a fost găsit.');
      const isPrimary = payload.isPrimaryContact === true || payload.isPrimaryContact === 'true';
      const role = this.parseApartmentResidentRole(payload.role || 'OWNER');
      return {
        ...base,
        entity: { type: 'APARTMENT_RESIDENT', id: `${targetApartment.id}:${resident.id}`, label: `${fullName(resident)} · Ap. ${targetApartment.number}` },
        changes: [
          { field: 'apartmentId', currentValue: null, newValue: targetApartment.id },
          { field: 'residentId', currentValue: null, newValue: resident.id },
          { field: 'role', currentValue: null, newValue: role },
          { field: 'isPrimaryContact', currentValue: null, newValue: isPrimary },
        ],
        warnings: isPrimary ? ['Dacă alegi primary contact, ceilalți primary contacts ai apartamentului vor fi debifați.'] : [],
      };
    }

    const targetResidentId = residentId || parseNonEmpty(payload.residentId, 'Alege locatarul care trebuie să rămână contact principal.');
    const relation = apartment!.apartmentResidents.find((item) => item.residentId === targetResidentId);
    const resident =
      relation?.resident ||
      (await this.prisma.residentProfile.findFirst({
        where: { id: targetResidentId, organizationId: associationId },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true, accountStatus: true },
      }));
    if (!resident) throw new NotFoundException('Locatarul nu a fost găsit.');
    const warnings = [];
    if (resident.accountStatus === ResidentAccountStatus.NO_ACCOUNT) warnings.push('Locatarul nu are cont activ; verifică dacă este contactul potrivit.');
    return {
      ...base,
      entity: { type: 'APARTMENT_RESIDENT', id: `${apartment!.id}:${resident.id}`, label: `${fullName(resident)} · Ap. ${apartment!.number || '-'}` },
      changes: [
        { field: 'isPrimaryContact', currentValue: relation?.isPrimary || false, newValue: true },
        { field: 'otherPrimaryContacts', currentValue: apartment!.apartmentResidents.filter((item) => item.isPrimary && item.residentId !== resident.id).length, newValue: 0 },
      ],
      warnings,
    };
  }

  private async previewResidentFix(associationId: string, issue: any, payload: Record<string, unknown>, base: FixPreview): Promise<FixPreview> {
    const residentId = this.issueResidentId(issue) || parseNonEmpty(payload.residentId, 'Locatarul este obligatoriu.');
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id: residentId, organizationId: associationId },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, accountStatus: true },
    });
    if (!resident) throw new NotFoundException('Locatarul nu a fost găsit.');
    const status = this.parseResidentStatus(payload.status || 'ACTIVE');
    return {
      ...base,
      entity: { type: 'RESIDENT', id: resident.id, label: fullName(resident), actionUrl: issue.actionUrl },
      changes: [{ field: 'accountStatus', currentValue: resident.accountStatus, newValue: status }],
    };
  }

  private async previewTariffFix(associationId: string, issue: any, payload: Record<string, unknown>, base: FixPreview): Promise<FixPreview> {
    const tariffId = parseNonEmpty(issue.entityId || payload.tariffId, 'Tariful este obligatoriu.');
    const tariffs = await this.readTariffs(associationId, []);
    const tariff = tariffs.find((item) => item.id === tariffId);
    if (!tariff) throw new NotFoundException('Tariful nu a fost găsit.');
    const changes: FixChange[] = [];
    if (tariff.calculationType === 'PER_M2') {
      const pricePerM2 = parsePositiveNumber(payload.pricePerM2 ?? payload.amount, 'Valoarea per m² trebuie să fie pozitivă.');
      changes.push({ field: 'pricePerM2', currentValue: tariff.pricePerM2 ?? null, newValue: pricePerM2 });
    } else if (tariff.calculationType === 'FIXED_PER_APARTMENT') {
      const fixedAmount = parsePositiveNumber(payload.fixedAmount ?? payload.amount, 'Suma fixă trebuie să fie pozitivă.');
      changes.push({ field: 'fixedAmount', currentValue: tariff.fixedAmount ?? null, newValue: fixedAmount });
    } else if (tariff.calculationType === 'PER_METER_CONSUMPTION') {
      const pricePerUnit = parsePositiveNumber(payload.pricePerUnit ?? payload.amount, 'Prețul per unitate trebuie să fie pozitiv.');
      const meterType = payload.meterType ? this.parseMeterType(payload.meterType) : tariff.meterType ? this.parseMeterType(tariff.meterType) : null;
      const unit = optionalString(payload.unit) || tariff.unit || this.defaultMeterUnit(meterType);
      if (!meterType) throw new BadRequestException('Tipul de contor este obligatoriu pentru tarife pe consum.');
      changes.push({ field: 'pricePerUnit', currentValue: tariff.pricePerUnit ?? null, newValue: pricePerUnit });
      changes.push({ field: 'meterType', currentValue: tariff.meterType ?? null, newValue: meterType });
      changes.push({ field: 'unit', currentValue: tariff.unit ?? null, newValue: unit });
    } else {
      throw new BadRequestException('Acest tip de tarif necesită editare manuală.');
    }
    if (payload.status) changes.push({ field: 'status', currentValue: tariff.status, newValue: optionalString(payload.status).toUpperCase() });
    return { ...base, entity: { type: 'TARIFF', id: tariff.id, label: tariff.name, actionUrl: issue.actionUrl }, changes };
  }

  private async previewMeterFix(
    associationId: string,
    issue: any,
    fixType: DataQualityFixType,
    payload: Record<string, unknown>,
    base: FixPreview,
  ): Promise<FixPreview> {
    const meterId = parseNonEmpty(issue.entityId || payload.meterId, 'Contorul este obligatoriu.');
    const [meter, store] = await Promise.all([
      this.prisma.meter.findFirst({
        where: { id: meterId, organizationId: associationId },
        include: { apartment: { select: { number: true } } },
      }),
      this.readMeterWorkflow(associationId),
    ]);
    if (!meter) throw new NotFoundException('Contorul nu a fost găsit.');
    const meta = store.meters[meter.id] || {};
    if (fixType === 'SET_METER_UNIT') {
      const unit = optionalString(payload.unit) || optionalString(issue.metadata?.suggestedUnit) || this.defaultMeterUnit(String(meter.type));
      if (!unit) throw new BadRequestException('Unitatea este obligatorie.');
      return { ...base, entity: { type: 'METER', id: meter.id, label: meter.serialNumber || `Contor ap. ${meter.apartment?.number || '-'}`, actionUrl: issue.actionUrl }, changes: [{ field: 'unit', currentValue: meta.unit || null, newValue: unit }] };
    }
    if (fixType === 'SET_METER_NUMBER') {
      const meterNumber = parseNonEmpty(payload.meterNumber, 'Numărul contorului este obligatoriu.');
      const duplicate = await this.prisma.meter.findFirst({
        where: { organizationId: associationId, id: { not: meter.id }, serialNumber: meterNumber },
        select: { id: true },
      });
      if (duplicate) throw new BadRequestException('Există deja un contor cu acest număr în asociație.');
      return { ...base, entity: { type: 'METER', id: meter.id, label: meter.serialNumber || meter.id, actionUrl: issue.actionUrl }, changes: [{ field: 'serialNumber', currentValue: meter.serialNumber, newValue: meterNumber }] };
    }
    const mapped = this.parseMeterStatus(payload.status || 'INACTIVE');
    return {
      ...base,
      entity: { type: 'METER', id: meter.id, label: meter.serialNumber || meter.id, actionUrl: issue.actionUrl },
      changes: [
        { field: 'status', currentValue: meter.status, newValue: mapped.status },
        { field: 'statusAlias', currentValue: meta.statusAlias || null, newValue: mapped.statusAlias },
      ],
      warnings: mapped.status !== MeterStatus.ACTIVE ? ['Contorul nu va mai fi tratat ca activ în verificările Data Quality.'] : [],
    };
  }

  private async previewReadingFix(
    associationId: string,
    issue: any,
    fixType: DataQualityFixType,
    payload: Record<string, unknown>,
    base: FixPreview,
  ): Promise<FixPreview> {
    const readingId = parseNonEmpty(issue.entityId || payload.readingId, 'Indicele este obligatoriu.');
    const [reading, store] = await Promise.all([
      this.prisma.meterReading.findFirst({
        where: { id: readingId, organizationId: associationId },
        include: { meter: { select: { serialNumber: true, type: true } }, apartment: { select: { number: true } } },
      }),
      this.readMeterWorkflow(associationId),
    ]);
    if (!reading) throw new NotFoundException('Indicele nu a fost găsit.');
    const meta = this.readingMeta(store, reading);
    if (fixType === 'REJECT_METER_READING') {
      const reason = parseNonEmpty(payload.rejectionReason || payload.reason, 'Motivul respingerii este obligatoriu.');
      return {
        ...base,
        entity: { type: 'METER_READING', id: reading.id, label: `${reading.meter?.serialNumber || reading.id} · ${meta.periodMonth}`, actionUrl: issue.actionUrl },
        changes: [
          { field: 'status', currentValue: meta.status, newValue: 'REJECTED' },
          { field: 'rejectionReason', currentValue: null, newValue: reason },
        ],
      };
    }
    const adminComment = optionalString(payload.adminComment) || 'Marcat needs review din Data Quality.';
    return {
      ...base,
      entity: { type: 'METER_READING', id: reading.id, label: `${reading.meter?.serialNumber || reading.id} · ${meta.periodMonth}`, actionUrl: issue.actionUrl },
      changes: [
        { field: 'status', currentValue: meta.status, newValue: 'NEEDS_REVIEW' },
        { field: 'adminComment', currentValue: null, newValue: adminComment },
      ],
    };
  }

  async applyFix(user: MvpUser, id: string, body: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId, actorUserId } = this.assertAdmin(user, activeOrganizationId);
    if (body.confirm !== true) throw new BadRequestException('Confirmarea este obligatorie pentru aplicarea remedierii.');
    const issue = await this.requireIssue(associationId, id);
    const fixType = this.resolveRequestedFix(issue, body.fixType);
    const payload = isRecord(body.payload) ? body.payload : {};
    const preview = await this.buildFixPreview(associationId, issue, fixType, payload);
    const beforeSnapshot = {
      issue: this.serializeIssue(issue),
      changes: preview.changes.map((change) => ({ field: change.field, oldValue: change.currentValue })),
    };

    if (fixType === 'RUN_DATA_QUALITY') {
      const result = await this.run(user, { billingMonth: payload.billingMonth || currentBillingMonth() }, activeOrganizationId);
      await this.auditFix(associationId, actorUserId, issue, fixType, beforeSnapshot, { rerun: true }, payload, 'SUCCESS');
      return {
        success: true,
        issue: this.serializeIssue(issue),
        fix: { type: fixType, message: 'Verificările Data Quality au fost rulate din nou.' },
        changes: preview.changes,
        nextAction: { label: 'Vezi rezultatul verificărilor', actionUrl: '/admin/data-quality' },
        result,
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (fixType === 'MARK_ISSUE_RESOLVED') {
        return this.updateIssueResolved(tx, issue, actorUserId, optionalString(payload.note || payload.reason), fixType);
      }
      if (fixType === 'MARK_ISSUE_IGNORED') {
        const reason = parseNonEmpty(payload.reason, 'Motivul ignorării este obligatoriu.');
        return tx.dataQualityIssue.update({
          where: { id: issue.id },
          data: {
            status: DataQualityIssueStatus.IGNORED,
            ignoredAt: new Date(),
            ignoredById: actorUserId,
            ignoreReason: reason,
            metadata: { ...(isRecord(issue.metadata) ? issue.metadata : {}), quickFix: { type: fixType, at: nowIso() } } as Prisma.InputJsonValue,
          },
        });
      }
      if (fixType === 'REOPEN_ISSUE') {
        return tx.dataQualityIssue.update({
          where: { id: issue.id },
          data: {
            status: DataQualityIssueStatus.OPEN,
            resolvedAt: null,
            resolvedById: null,
            ignoredAt: null,
            ignoredById: null,
            ignoreReason: null,
            detectedAt: new Date(),
          },
        });
      }

      await this.applyEntityFix(tx, associationId, actorUserId, issue, fixType, payload);
      return this.updateIssueResolved(tx, issue, actorUserId, 'Remediere rapidă aplicată.', fixType);
    });

    await this.auditFix(associationId, actorUserId, issue, fixType, beforeSnapshot, { issue: this.serializeIssue(result), changes: preview.changes }, payload, 'SUCCESS');
    return {
      success: true,
      issue: this.serializeIssue(result),
      fix: { type: fixType, message: this.fixAppliedMessage(fixType) },
      changes: preview.changes.map((change) => ({ field: change.field, oldValue: change.currentValue, newValue: change.newValue })),
      nextAction: { label: 'Rulează verificările din nou', actionUrl: '/admin/data-quality' },
    };
  }

  private async updateIssueResolved(tx: any, issue: any, actorUserId: string, note: string, fixType: DataQualityFixType) {
    return tx.dataQualityIssue.update({
      where: { id: issue.id },
      data: {
        status: DataQualityIssueStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedById: actorUserId,
        ignoredAt: null,
        ignoredById: null,
        ignoreReason: null,
        metadata: {
          ...(isRecord(issue.metadata) ? issue.metadata : {}),
          resolutionNote: note,
          quickFix: { type: fixType, at: nowIso() },
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async applyEntityFix(tx: any, associationId: string, actorUserId: string, issue: any, fixType: DataQualityFixType, payload: Record<string, unknown>) {
    if (fixType === 'SET_APARTMENT_AREA') {
      const apartmentId = parseNonEmpty(this.issueApartmentId(issue), 'Apartamentul este obligatoriu.');
      const areaM2 = parsePositiveNumber(payload.areaM2, 'Suprafața trebuie să fie un număr pozitiv.');
      await tx.apartment.update({ where: { id: apartmentId }, data: { areaM2 } });
      return;
    }
    if (fixType === 'SET_APARTMENT_STATUS') {
      const apartmentId = parseNonEmpty(this.issueApartmentId(issue), 'Apartamentul este obligatoriu.');
      await tx.apartment.update({ where: { id: apartmentId }, data: { status: this.parseApartmentStatus(payload.status || 'OCCUPIED') } });
      return;
    }
    if (fixType === 'SET_APARTMENT_STAIRCASE') {
      const apartmentId = parseNonEmpty(this.issueApartmentId(issue), 'Apartamentul este obligatoriu.');
      const apartment = await tx.apartment.findFirst({
        where: { id: apartmentId, organizationId: associationId },
        include: { building: { select: { id: true, name: true } } },
      });
      if (!apartment) throw new NotFoundException('Apartamentul nu a fost găsit.');
      let staircaseId = optionalString(payload.staircaseId);
      if (staircaseId) {
        const staircase = await tx.staircase.findFirst({ where: { id: staircaseId, organizationId: associationId }, select: { id: true, buildingId: true } });
        if (!staircase) throw new NotFoundException('Scara nu a fost găsită.');
        await tx.apartment.update({ where: { id: apartmentId }, data: { staircaseId, buildingId: staircase.buildingId } });
        return;
      }
      const staircaseName = parseNonEmpty(payload.staircaseName, 'Numele scării este obligatoriu.');
      const buildingName = optionalString(payload.buildingName) || apartment.building?.name || 'Bloc';
      const building =
        (await tx.building.findFirst({ where: { organizationId: associationId, name: buildingName }, select: { id: true } })) ||
        (await tx.building.create({ data: { organizationId: associationId, name: buildingName }, select: { id: true } }));
      const staircase =
        (await tx.staircase.findFirst({ where: { organizationId: associationId, buildingId: building.id, name: staircaseName }, select: { id: true } })) ||
        (await tx.staircase.create({ data: { organizationId: associationId, buildingId: building.id, name: staircaseName }, select: { id: true } }));
      await tx.apartment.update({ where: { id: apartmentId }, data: { buildingId: building.id, staircaseId: staircase.id } });
      return;
    }
    if (fixType === 'SET_APARTMENT_FLOOR') {
      const apartmentId = parseNonEmpty(this.issueApartmentId(issue), 'Apartamentul este obligatoriu.');
      const floor = optionalNumber(payload.floor);
      if (floor === null || !Number.isInteger(floor)) throw new BadRequestException('Etajul trebuie să fie număr întreg.');
      await tx.apartment.update({ where: { id: apartmentId }, data: { floor } });
      return;
    }
    if (fixType === 'SET_PRIMARY_CONTACT' || fixType === 'RESOLVE_MULTIPLE_PRIMARY_CONTACTS') {
      const apartmentId = parseNonEmpty(this.issueApartmentId(issue), 'Apartamentul este obligatoriu.');
      const residentId = optionalString(payload.residentId) || this.issueResidentId(issue);
      await this.setPrimaryContact(tx, associationId, apartmentId, parseNonEmpty(residentId, 'Locatarul este obligatoriu.'), payload.role);
      return;
    }
    if (fixType === 'LINK_RESIDENT_TO_APARTMENT') {
      const apartmentId = optionalString(payload.apartmentId) || this.issueApartmentId(issue);
      const residentId = optionalString(payload.residentId) || this.issueResidentId(issue);
      await this.linkResidentToApartment(
        tx,
        associationId,
        parseNonEmpty(apartmentId, 'Apartamentul este obligatoriu.'),
        parseNonEmpty(residentId, 'Locatarul este obligatoriu.'),
        payload.role,
        payload.isPrimaryContact === true || payload.isPrimaryContact === 'true',
      );
      return;
    }
    if (fixType === 'SET_RESIDENT_STATUS') {
      const residentId = parseNonEmpty(this.issueResidentId(issue) || payload.residentId, 'Locatarul este obligatoriu.');
      await tx.residentProfile.update({ where: { id: residentId }, data: { accountStatus: this.parseResidentStatus(payload.status || 'ACTIVE') } });
      return;
    }
    if (fixType === 'SET_TARIFF_PRICE') {
      await this.applyTariffFix(tx, associationId, actorUserId, issue, payload);
      return;
    }
    if (fixType === 'SET_METER_UNIT' || fixType === 'SET_METER_NUMBER' || fixType === 'SET_METER_STATUS') {
      await this.applyMeterFix(tx, associationId, actorUserId, issue, fixType, payload);
      return;
    }
    if (fixType === 'MARK_READING_NEEDS_REVIEW' || fixType === 'REJECT_METER_READING') {
      await this.applyReadingFix(tx, associationId, actorUserId, issue, fixType, payload);
      return;
    }
    if (fixType === 'START_BILLING_RUN') {
      await this.applyStartBillingRun(tx, associationId, actorUserId, issue, payload);
      return;
    }
    throw new BadRequestException('Remedierea selectată nu poate fi aplicată automat.');
  }

  private async linkResidentToApartment(tx: any, associationId: string, apartmentId: string, residentId: string, rawRole: unknown, isPrimary: boolean) {
    const [apartment, resident] = await Promise.all([
      tx.apartment.findFirst({ where: { id: apartmentId, organizationId: associationId }, select: { id: true } }),
      tx.residentProfile.findFirst({ where: { id: residentId, organizationId: associationId }, select: { id: true } }),
    ]);
    if (!apartment) throw new NotFoundException('Apartamentul nu a fost găsit.');
    if (!resident) throw new NotFoundException('Locatarul nu a fost găsit.');
    const role = this.parseApartmentResidentRole(rawRole || 'OWNER');
    if (isPrimary) await tx.apartmentResident.updateMany({ where: { apartmentId, isPrimary: true }, data: { isPrimary: false } });
    await tx.apartmentResident.upsert({
      where: { apartmentId_residentId_role: { apartmentId, residentId, role } },
      update: { isPrimary },
      create: { apartmentId, residentId, role, isPrimary },
    });
    await tx.residentProfile.update({ where: { id: residentId }, data: { apartmentId, isPrimary } });
  }

  private async setPrimaryContact(tx: any, associationId: string, apartmentId: string, residentId: string, rawRole: unknown) {
    await this.linkResidentToApartment(tx, associationId, apartmentId, residentId, rawRole || 'OWNER', true);
  }

  private async applyTariffFix(tx: any, associationId: string, actorUserId: string, issue: any, payload: Record<string, unknown>) {
    const tariffId = parseNonEmpty(issue.entityId || payload.tariffId, 'Tariful este obligatoriu.');
    const raw = await this.readRawTariffPayload(associationId, tx);
    if (raw.noteExists && raw.items.length) {
      const index = raw.items.findIndex((item) => String(item?.id || item?.internalCode) === tariffId);
      if (index < 0) throw new NotFoundException('Tariful nu a fost găsit.');
      const row = { ...raw.items[index] };
      const calculationType = String(row.calculationType || '').toUpperCase();
      if (calculationType === 'PER_M2') row.pricePerM2 = parsePositiveNumber(payload.pricePerM2 ?? payload.amount, 'Valoarea per m² trebuie să fie pozitivă.');
      else if (calculationType === 'FIXED_PER_APARTMENT') row.fixedAmount = parsePositiveNumber(payload.fixedAmount ?? payload.amount, 'Suma fixă trebuie să fie pozitivă.');
      else if (calculationType === 'PER_METER_CONSUMPTION') {
        row.pricePerUnit = parsePositiveNumber(payload.pricePerUnit ?? payload.amount, 'Prețul per unitate trebuie să fie pozitiv.');
        row.meterType = payload.meterType ? this.parseMeterType(payload.meterType) : row.meterType || null;
        if (!row.meterType) throw new BadRequestException('Tipul de contor este obligatoriu.');
        row.unit = optionalString(payload.unit) || row.unit || this.defaultMeterUnit(row.meterType);
      } else {
        throw new BadRequestException('Acest tip de tarif necesită editare manuală.');
      }
      if (payload.status) row.status = optionalString(payload.status).toUpperCase();
      row.updatedAt = nowIso();
      row.updatedById = actorUserId;
      raw.items[index] = row;
      await this.writeRawTariffPayload(associationId, actorUserId, raw.items, tx);
      return;
    }
    const settings = await tx.organizationSetting.upsert({
      where: { organizationId: associationId },
      update: {},
      create: { organizationId: associationId },
    });
    if (tariffId === 'BUILDING_SERVICE') await tx.organizationSetting.update({ where: { id: settings.id }, data: { maintenanceFeePerM2: parsePositiveNumber(payload.pricePerM2 ?? payload.amount, 'Valoarea per m² trebuie să fie pozitivă.') } });
    else if (tariffId === 'REPAIR_FUND') await tx.organizationSetting.update({ where: { id: settings.id }, data: { repairFundPerM2: parsePositiveNumber(payload.pricePerM2 ?? payload.amount, 'Valoarea per m² trebuie să fie pozitivă.') } });
    else if (tariffId === 'INVESTMENT_FUND') await tx.organizationSetting.update({ where: { id: settings.id }, data: { developmentFundFixed: parsePositiveNumber(payload.fixedAmount ?? payload.amount, 'Suma fixă trebuie să fie pozitivă.') } });
    else throw new NotFoundException('Tariful nu a fost găsit.');
  }

  private async applyMeterFix(tx: any, associationId: string, actorUserId: string, issue: any, fixType: DataQualityFixType, payload: Record<string, unknown>) {
    const meterId = parseNonEmpty(issue.entityId || payload.meterId, 'Contorul este obligatoriu.');
    const meter = await tx.meter.findFirst({ where: { id: meterId, organizationId: associationId } });
    if (!meter) throw new NotFoundException('Contorul nu a fost găsit.');
    if (fixType === 'SET_METER_NUMBER') {
      const meterNumber = parseNonEmpty(payload.meterNumber, 'Numărul contorului este obligatoriu.');
      const duplicate = await tx.meter.findFirst({ where: { organizationId: associationId, id: { not: meter.id }, serialNumber: meterNumber }, select: { id: true } });
      if (duplicate) throw new BadRequestException('Există deja un contor cu acest număr în asociație.');
      await tx.meter.update({ where: { id: meter.id }, data: { serialNumber: meterNumber } });
      return;
    }
    const store = await this.readMeterWorkflow(associationId, tx);
    store.meters[meter.id] = { ...(store.meters[meter.id] || {}) };
    if (fixType === 'SET_METER_UNIT') {
      store.meters[meter.id].unit = optionalString(payload.unit) || optionalString(issue.metadata?.suggestedUnit) || this.defaultMeterUnit(String(meter.type));
      await this.writeMeterWorkflow(associationId, actorUserId, store, tx);
      return;
    }
    const mapped = this.parseMeterStatus(payload.status || 'INACTIVE');
    store.meters[meter.id].statusAlias = mapped.statusAlias;
    await tx.meter.update({ where: { id: meter.id }, data: { status: mapped.status } });
    await this.writeMeterWorkflow(associationId, actorUserId, store, tx);
  }

  private async applyReadingFix(tx: any, associationId: string, actorUserId: string, issue: any, fixType: DataQualityFixType, payload: Record<string, unknown>) {
    const readingId = parseNonEmpty(issue.entityId || payload.readingId, 'Indicele este obligatoriu.');
    const reading = await tx.meterReading.findFirst({ where: { id: readingId, organizationId: associationId }, include: { meter: { select: { type: true } } } });
    if (!reading) throw new NotFoundException('Indicele nu a fost găsit.');
    const store = await this.readMeterWorkflow(associationId, tx);
    const current = store.readings[reading.id] || {};
    if (fixType === 'REJECT_METER_READING') {
      const reason = parseNonEmpty(payload.rejectionReason || payload.reason, 'Motivul respingerii este obligatoriu.');
      store.readings[reading.id] = {
        ...current,
        status: 'REJECTED',
        rejectionReason: reason,
        adminComment: optionalString(payload.adminComment) || reason,
        reviewedAt: nowIso(),
        rejectedAt: nowIso(),
        reviewedByUserId: actorUserId,
        unit: current.unit || this.defaultMeterUnit(String(reading.meter?.type)),
        periodMonth: current.periodMonth || monthFromDate(reading.readingDate),
      };
    } else {
      store.readings[reading.id] = {
        ...current,
        status: 'NEEDS_REVIEW',
        adminComment: optionalString(payload.adminComment) || 'Marcat needs review din Data Quality.',
        reviewedAt: nowIso(),
        reviewedByUserId: actorUserId,
        unit: current.unit || this.defaultMeterUnit(String(reading.meter?.type)),
        periodMonth: current.periodMonth || monthFromDate(reading.readingDate),
      };
    }
    await this.writeMeterWorkflow(associationId, actorUserId, store, tx);
  }

  private async applyStartBillingRun(tx: any, associationId: string, actorUserId: string, issue: any, payload: Record<string, unknown>) {
    const billingMonth = parseBillingMonth(payload.billingMonth || String(issue.key || '').split(':')[1] || currentBillingMonth());
    const runs = await this.readBillingRuns(associationId, tx);
    const active = runs.find((run) => run?.billingMonth === billingMonth && run?.status !== 'CANCELLED');
    if (active) throw new BadRequestException('Există deja un proces lunar pentru această lună.');
    const now = nowIso();
    const run = {
      id: randomUUID(),
      associationId,
      organizationId: associationId,
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
      startedById: actorUserId,
      cancelledAt: null,
      cancelledById: null,
      cancellationReason: null,
      checks: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.writeBillingRuns(associationId, actorUserId, [run, ...runs], tx);
  }

  private fixAppliedMessage(fixType: DataQualityFixType) {
    const messages: Record<DataQualityFixType, string> = {
      SET_APARTMENT_AREA: 'Suprafața apartamentului a fost completată.',
      SET_APARTMENT_STATUS: 'Statusul apartamentului a fost actualizat.',
      SET_APARTMENT_STAIRCASE: 'Scara apartamentului a fost completată.',
      SET_APARTMENT_FLOOR: 'Etajul apartamentului a fost completat.',
      SET_PRIMARY_CONTACT: 'Contactul principal a fost setat.',
      LINK_RESIDENT_TO_APARTMENT: 'Locatarul a fost legat de apartament.',
      RESOLVE_MULTIPLE_PRIMARY_CONTACTS: 'A fost păstrat un singur contact principal.',
      SET_RESIDENT_STATUS: 'Statusul locatarului a fost actualizat.',
      SET_TARIFF_PRICE: 'Tariful a fost completat.',
      SET_METER_UNIT: 'Unitatea contorului a fost completată.',
      SET_METER_NUMBER: 'Numărul contorului a fost completat.',
      SET_METER_STATUS: 'Statusul contorului a fost actualizat.',
      MARK_READING_NEEDS_REVIEW: 'Indicele a fost marcat needs review.',
      REJECT_METER_READING: 'Indicele a fost respins.',
      START_BILLING_RUN: 'Procesul lunar a fost pornit.',
      RUN_DATA_QUALITY: 'Verificările au fost rulate.',
      MARK_ISSUE_RESOLVED: 'Problema a fost marcată rezolvată.',
      MARK_ISSUE_IGNORED: 'Problema a fost ignorată.',
      REOPEN_ISSUE: 'Problema a fost redeschisă.',
    };
    return messages[fixType];
  }

  private async auditFix(
    associationId: string,
    actorUserId: string,
    issue: any,
    fixType: DataQualityFixType,
    beforeSnapshot: unknown,
    afterSnapshot: unknown,
    payload: Record<string, unknown>,
    severity: 'SUCCESS' | 'ERROR' = 'SUCCESS',
  ) {
    await this.audit.createLog({
      associationId,
      actorUserId,
      actorRole: 'ADMIN',
      action: severity === 'SUCCESS' ? 'DATA_QUALITY_FIX_APPLIED' : 'DATA_QUALITY_FIX_FAILED',
      entityType: 'SYSTEM',
      entityId: issue.id,
      title: severity === 'SUCCESS' ? 'Remediere Data Quality aplicată' : 'Remediere Data Quality eșuată',
      message: `${this.fixAppliedMessage(fixType)} ${issue.title}`,
      severity,
      metadata: {
        issueId: issue.id,
        issueKey: issue.key,
        fixType,
        entityType: issue.entityType,
        entityId: issue.entityId,
        payload,
      },
      beforeSnapshot,
      afterSnapshot,
      actionUrl: `/admin/data-quality/issues/${issue.id}`,
    }).catch(() => null);
  }

  async previewBulkFix(user: MvpUser, body: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    const fixType = optionalString(body.fixType) as DataQualityFixType;
    const issueIds = Array.isArray(body.issueIds) ? body.issueIds.map((item) => String(item)).filter(Boolean) : [];
    const payload = isRecord(body.payload) ? body.payload : {};
    if (!issueIds.length) throw new BadRequestException('Selectează cel puțin o problemă.');
    if (!['SET_METER_UNIT', 'MARK_ISSUE_RESOLVED', 'MARK_ISSUE_IGNORED', 'RUN_DATA_QUALITY'].includes(fixType)) {
      throw new BadRequestException('Această remediere nu este disponibilă bulk.');
    }
    const issues = await this.prisma.dataQualityIssue.findMany({
      where: { associationId, id: { in: issueIds } },
      orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
    });
    const previews = [];
    const errors = [];
    for (const issue of issues) {
      try {
        const selectedFix = fixType === 'SET_METER_UNIT' ? this.resolveRequestedFix(issue, fixType) : fixType;
        previews.push(await this.buildFixPreview(associationId, issue, selectedFix, payload));
      } catch (error) {
        errors.push({ issueId: issue.id, message: error instanceof Error ? error.message : String(error) });
      }
    }
    return {
      fixType,
      totalSelected: issueIds.length,
      previewed: previews.length,
      errorsCount: errors.length,
      previews,
      errors,
      canApply: previews.length > 0 && errors.length === 0,
    };
  }

  async applyBulkFix(user: MvpUser, body: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId, actorUserId } = this.assertAdmin(user, activeOrganizationId);
    if (body.confirm !== true) throw new BadRequestException('Confirmarea este obligatorie pentru remedieri bulk.');
    const preview = await this.previewBulkFix(user, body, activeOrganizationId);
    if (!preview.canApply) throw new BadRequestException('Remedierea bulk are erori în preview.');
    const fixType = preview.fixType as DataQualityFixType;
    const issueIds = Array.isArray(body.issueIds) ? body.issueIds.map((item) => String(item)).filter(Boolean) : [];
    const payload = isRecord(body.payload) ? body.payload : {};
    if (fixType === 'RUN_DATA_QUALITY') {
      const result = await this.run(user, { billingMonth: payload.billingMonth || currentBillingMonth() }, activeOrganizationId);
      return { success: true, fixType, appliedCount: 1, result };
    }
    const results = [];
    for (const issueId of issueIds) {
      const result = await this.applyFix(user, issueId, { fixType, payload, confirm: true }, activeOrganizationId);
      results.push(result);
    }
    await this.audit.createLog({
      associationId,
      actorUserId,
      actorRole: 'ADMIN',
      action: 'DATA_QUALITY_BULK_FIX_APPLIED',
      entityType: 'SYSTEM',
      title: 'Remediere Data Quality bulk aplicată',
      message: `Au fost aplicate ${results.length} remedieri bulk.`,
      severity: 'SUCCESS',
      metadata: { fixType, issueIds, appliedCount: results.length },
      actionUrl: '/admin/data-quality/fixes',
    }).catch(() => null);
    return {
      success: true,
      fixType,
      appliedCount: results.length,
      results,
      nextAction: { label: 'Rulează verificările din nou', actionUrl: '/admin/data-quality' },
    };
  }

  async overview(user: MvpUser, query: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    const billingMonth = parseBillingMonth(query.billingMonth);
    const association = await this.organizationHeader(associationId);
    const summary = await this.summary(associationId);
    const [categories, topIssues] = await Promise.all([
      this.categories(associationId),
      this.prisma.dataQualityIssue.findMany({
        where: {
          associationId,
          ...(query.includeResolved === 'true' || query.includeResolved === true ? {} : { status: DataQualityIssueStatus.OPEN }),
        },
        orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
        take: 8,
      }),
    ]);
    return {
      association,
      billingMonth,
      summary,
      categories,
      topIssues: topIssues.map((issue) => this.serializeIssue(issue)),
      nextAction: this.nextAction(summary),
    };
  }

  async run(user: MvpUser, body: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId, actorUserId } = this.assertAdmin(user, activeOrganizationId);
    const billingMonth = parseBillingMonth(body?.billingMonth);
    const run = await this.prisma.dataQualityRun.create({
      data: {
        associationId,
        actorUserId,
        billingMonth,
        status: DataQualityRunStatus.RUNNING,
        startedAt: new Date(),
      },
    });
    try {
      const detected = await this.detectIssues(associationId, billingMonth);
      await this.persistRunIssues(associationId, actorUserId, run.id, billingMonth, detected);
      return this.overview(user, { billingMonth }, activeOrganizationId);
    } catch (error) {
      await this.prisma.dataQualityRun.update({
        where: { id: run.id },
        data: {
          status: DataQualityRunStatus.FAILED,
          completedAt: new Date(),
        },
      }).catch(() => null);
      await this.audit.createLog({
        associationId,
        actorUserId,
        actorRole: 'ADMIN',
        action: 'DATA_QUALITY_RUN_FAILED',
        entityType: 'SYSTEM',
        entityId: run.id,
        title: 'Verificări calitate date eșuate',
        message: 'Rularea verificărilor Data Quality a eșuat.',
        severity: 'ERROR',
        metadata: { billingMonth, error: error instanceof Error ? error.message : String(error) },
      }).catch(() => null);
      throw error;
    }
  }

  async listIssues(user: MvpUser, query: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    const { page, limit, skip } = resolvePagination(query);
    const where: Prisma.DataQualityIssueWhereInput = {
      associationId,
      ...(optionalString(query.category) ? { category: optionalString(query.category) as DataQualityCategory } : {}),
      ...(optionalString(query.severity) ? { severity: optionalString(query.severity) as DataQualitySeverity } : {}),
      ...(optionalString(query.status) ? { status: optionalString(query.status) as DataQualityIssueStatus } : {}),
      ...(optionalString(query.entityType) ? { entityType: optionalString(query.entityType) as DataQualityEntityType } : {}),
      ...(optionalString(query.billingImpact) ? { billingImpact: optionalString(query.billingImpact) as DataQualityBillingImpact } : {}),
      ...(optionalString(query.dateFrom) || optionalString(query.dateTo)
        ? {
            detectedAt: {
              ...(optionalString(query.dateFrom) ? { gte: new Date(optionalString(query.dateFrom)) } : {}),
              ...(optionalString(query.dateTo) ? { lte: new Date(optionalString(query.dateTo)) } : {}),
            },
          }
        : {}),
    };
    const search = optionalString(query.search);
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { recommendation: { contains: search, mode: 'insensitive' } },
        { key: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
      ];
    }
    const orderBy = this.issueOrderBy(query);
    const [items, total, stats] = await Promise.all([
      this.prisma.dataQualityIssue.findMany({ where, orderBy, skip, take: limit }),
      this.prisma.dataQualityIssue.count({ where }),
      this.summary(associationId),
    ]);
    return {
      items: items.map((issue) => this.serializeIssue(issue)),
      meta: buildPaginationMeta(page, limit, total),
      stats: {
        critical: stats.criticalCount,
        warning: stats.warningCount,
        info: stats.infoCount,
        open: stats.openIssues,
        resolved: stats.resolvedIssues,
        ignored: stats.ignoredIssues,
      },
    };
  }

  private issueOrderBy(query: Record<string, unknown>): Prisma.DataQualityIssueOrderByWithRelationInput[] {
    const sortBy = optionalString(query.sortBy);
    const direction = optionalString(query.sortDirection).toLowerCase() === 'asc' ? 'asc' : 'desc';
    if (sortBy === 'oldest') return [{ detectedAt: 'asc' }];
    if (sortBy === 'category') return [{ category: 'asc' }, { detectedAt: 'desc' }];
    if (sortBy === 'status') return [{ status: 'asc' }, { detectedAt: 'desc' }];
    return [{ severity: 'asc' }, { detectedAt: direction }];
  }

  async getIssue(user: MvpUser, id: string, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    const issue = await this.prisma.dataQualityIssue.findFirst({ where: { id, associationId } });
    if (!issue) throw new NotFoundException('Problema nu a fost găsită.');
    return { issue: this.serializeIssue(issue), history: this.issueHistory(issue) };
  }

  private issueHistory(issue: any) {
    const events = [
      { status: 'OPEN', label: 'Detectată', at: issue.detectedAt },
      issue.resolvedAt ? { status: 'RESOLVED', label: 'Rezolvată', at: issue.resolvedAt } : null,
      issue.ignoredAt ? { status: 'IGNORED', label: 'Ignorată', at: issue.ignoredAt, reason: issue.ignoreReason } : null,
    ].filter(Boolean);
    return events;
  }

  async resolveIssue(user: MvpUser, id: string, body: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId, actorUserId } = this.assertAdmin(user, activeOrganizationId);
    const issue = await this.prisma.dataQualityIssue.findFirst({ where: { id, associationId } });
    if (!issue) throw new NotFoundException('Problema nu a fost găsită.');
    const resolved = await this.prisma.dataQualityIssue.update({
      where: { id },
      data: {
        status: DataQualityIssueStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedById: actorUserId,
        ignoreReason: null,
        metadata: { ...(isRecord(issue.metadata) ? issue.metadata : {}), resolutionNote: optionalString(body.note) } as Prisma.InputJsonValue,
      },
    });
    await this.audit.createLog({
      associationId,
      actorUserId,
      actorRole: 'ADMIN',
      action: 'DATA_QUALITY_ISSUE_RESOLVED',
      entityType: 'SYSTEM',
      entityId: id,
      title: 'Problemă Data Quality rezolvată',
      message: resolved.title,
      severity: 'SUCCESS',
      metadata: { key: resolved.key, note: optionalString(body.note) },
      actionUrl: `/admin/data-quality/issues/${id}`,
    }).catch(() => null);
    return { issue: this.serializeIssue(resolved) };
  }

  async ignoreIssue(user: MvpUser, id: string, body: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId, actorUserId } = this.assertAdmin(user, activeOrganizationId);
    const issue = await this.prisma.dataQualityIssue.findFirst({ where: { id, associationId } });
    if (!issue) throw new NotFoundException('Problema nu a fost găsită.');
    const reason = optionalString(body.reason);
    if (!reason) throw new BadRequestException('Motivul ignorării este obligatoriu.');
    const ignored = await this.prisma.dataQualityIssue.update({
      where: { id },
      data: {
        status: DataQualityIssueStatus.IGNORED,
        ignoredAt: new Date(),
        ignoredById: actorUserId,
        ignoreReason: reason,
      },
    });
    await this.audit.createLog({
      associationId,
      actorUserId,
      actorRole: 'ADMIN',
      action: 'DATA_QUALITY_ISSUE_IGNORED',
      entityType: 'SYSTEM',
      entityId: id,
      title: 'Problemă Data Quality ignorată',
      message: ignored.title,
      severity: 'WARNING',
      metadata: { key: ignored.key, reason },
      actionUrl: `/admin/data-quality/issues/${id}`,
    }).catch(() => null);
    return { issue: this.serializeIssue(ignored) };
  }

  async reopenIssue(user: MvpUser, id: string, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    const issue = await this.prisma.dataQualityIssue.findFirst({ where: { id, associationId } });
    if (!issue) throw new NotFoundException('Problema nu a fost găsită.');
    const reopened = await this.prisma.dataQualityIssue.update({
      where: { id },
      data: {
        status: DataQualityIssueStatus.OPEN,
        resolvedAt: null,
        resolvedById: null,
        ignoredAt: null,
        ignoredById: null,
        ignoreReason: null,
        detectedAt: new Date(),
      },
    });
    return { issue: this.serializeIssue(reopened) };
  }

  async listRuns(user: MvpUser, query: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    const { page, limit, skip } = resolvePagination(query);
    const where: Prisma.DataQualityRunWhereInput = {
      associationId,
      ...(optionalString(query.status) ? { status: optionalString(query.status) as DataQualityRunStatus } : {}),
      ...(optionalString(query.billingMonth) ? { billingMonth: optionalString(query.billingMonth) } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.dataQualityRun.findMany({
        where,
        orderBy: { createdAt: optionalString(query.sortDirection).toLowerCase() === 'asc' ? 'asc' : 'desc' },
        skip,
        take: limit,
        include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.dataQualityRun.count({ where }),
    ]);
    return {
      items: items.map((run) => this.serializeRun(run)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getRun(user: MvpUser, id: string, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    const run = await this.prisma.dataQualityRun.findFirst({
      where: { id, associationId },
      include: {
        actor: { select: { id: true, email: true, firstName: true, lastName: true } },
        issues: { orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }], take: 100 },
      },
    });
    if (!run) throw new NotFoundException('Verificarea nu a fost găsită.');
    return {
      run: this.serializeRun(run),
      issues: run.issues.map((issue) => this.serializeIssue(issue)),
    };
  }

  private serializeRun(run: any) {
    return {
      id: run.id,
      billingMonth: run.billingMonth,
      status: run.status,
      score: run.score,
      criticalCount: run.criticalCount,
      warningCount: run.warningCount,
      infoCount: run.infoCount,
      resolvedCount: run.resolvedCount,
      ignoredCount: run.ignoredCount,
      startedAt: run.startedAt?.toISOString?.() || run.startedAt,
      completedAt: run.completedAt?.toISOString?.() || run.completedAt || null,
      createdAt: run.createdAt?.toISOString?.() || run.createdAt,
      updatedAt: run.updatedAt?.toISOString?.() || run.updatedAt,
      actor: run.actor
        ? {
            id: run.actor.id,
            fullName: [run.actor.firstName, run.actor.lastName].filter(Boolean).join(' ').trim() || run.actor.email,
            email: run.actor.email,
          }
        : null,
    };
  }

  async stats(user: MvpUser, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    return this.summary(associationId);
  }
}
