import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApartmentStatus,
  DataQualityBillingImpact,
  DataQualityCategory,
  DataQualityEntityType,
  DataQualityIssueStatus,
  DataQualityRunStatus,
  DataQualitySeverity,
  MeterStatus,
  PaymentStatus,
  Prisma,
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
  startsAt?: string | null;
  endsAt?: string | null;
};

type ReadingMetadata = {
  status?: string | null;
  periodMonth?: string | null;
  previousReadingValue?: number | null;
  consumptionValue?: number | null;
  unit?: string | null;
};

type MeterMetadataStore = {
  meters: Record<string, Record<string, unknown>>;
  readings: Record<string, ReadingMetadata>;
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

  private defaultMeterUnit(type: string | null | undefined) {
    const normalized = String(type || '').toUpperCase();
    if (normalized === 'ELECTRICITY') return 'kWh';
    if (normalized === 'HEATING' || normalized === 'HEAT') return 'Gcal';
    if (normalized === 'OTHER') return 'unit';
    return 'm³';
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
    if (issue.key?.startsWith('METER_MISSING_UNIT')) {
      return [{ key: 'OPEN_METER', label: 'Completează unitatea contorului', actionUrl: issue.actionUrl }];
    }
    return [
      { key: 'RESOLVE_MANUAL', label: 'Marchează ca rezolvată' },
      { key: 'IGNORE', label: 'Ignoră temporar' },
    ];
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
