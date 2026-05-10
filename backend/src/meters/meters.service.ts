import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientNoteType,
  MeterReadingSource,
  MeterStatus,
  MeterType,
  NotificationType,
  Prisma,
  Role,
} from '@prisma/client';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type ReadingStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW' | 'CANCELLED';
type ReadingSource = 'RESIDENT' | 'ADMIN' | 'SYSTEM';

type MeterMetadata = {
  label?: string | null;
  unit?: string | null;
  location?: string | null;
  notes?: string | null;
  installedAt?: string | null;
  replacedAt?: string | null;
  statusAlias?: 'ACTIVE' | 'INACTIVE' | 'REPLACED' | 'ARCHIVED' | null;
};

type ReadingMetadata = {
  status?: ReadingStatus;
  periodMonth?: string;
  previousReadingValue?: number | null;
  consumptionValue?: number | null;
  unit?: string | null;
  residentId?: string | null;
  submittedByUserId?: string | null;
  reviewedByUserId?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  adminComment?: string | null;
  residentComment?: string | null;
  source?: ReadingSource;
  photoUrl?: string | null;
};

type MeterWorkflowMetadata = {
  meters: Record<string, MeterMetadata>;
  readings: Record<string, ReadingMetadata>;
};

const METER_METADATA_TITLE = 'ESPACE_METER_WORKFLOW_METADATA_V1';

@Injectable()
export class MetersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityMvpService,
  ) {}

  private meterSelect(): Prisma.MeterSelect {
    return {
      id: true,
      organizationId: true,
      apartmentId: true,
      type: true,
      serialNumber: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      apartment: {
        select: {
          id: true,
          number: true,
          floor: true,
          areaM2: true,
          rooms: true,
          status: true,
          building: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          staircase: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      readings: {
        orderBy: [{ readingDate: 'desc' }, { createdAt: 'desc' }],
        take: 60,
        select: this.readingSelect(),
      },
    };
  }

  private readingSelect(): Prisma.MeterReadingSelect {
    return {
      id: true,
      meterId: true,
      apartmentId: true,
      organizationId: true,
      value: true,
      readingDate: true,
      source: true,
      createdAt: true,
      meter: {
        select: {
          id: true,
          type: true,
          serialNumber: true,
          status: true,
        },
      },
      apartment: {
        select: {
          id: true,
          number: true,
          floor: true,
          areaM2: true,
          staircase: {
            select: {
              id: true,
              name: true,
            },
          },
          building: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
      },
    };
  }

  private isSuperadmin(user: MvpUser) {
    const role = String(user.role || '').toUpperCase();
    return role === Role.SUPERADMIN || role === 'SUPER_ADMIN';
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

  private async loadWorkflowMetadata(organizationId: string): Promise<MeterWorkflowMetadata> {
    const note = await this.prisma.clientNote.findFirst({
      where: {
        organizationId,
        title: METER_METADATA_TITLE,
      },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });

    if (!note?.content) return { meters: {}, readings: {} };
    try {
      const parsed = JSON.parse(note.content) as Partial<MeterWorkflowMetadata>;
      return {
        meters: parsed && typeof parsed.meters === 'object' && !Array.isArray(parsed.meters) ? parsed.meters : {},
        readings: parsed && typeof parsed.readings === 'object' && !Array.isArray(parsed.readings) ? parsed.readings : {},
      };
    } catch {
      return { meters: {}, readings: {} };
    }
  }

  private async saveWorkflowMetadata(organizationId: string, actorUserId: string, metadata: MeterWorkflowMetadata) {
    const content = JSON.stringify({
      version: 1,
      meters: metadata.meters || {},
      readings: metadata.readings || {},
    });
    const existing = await this.prisma.clientNote.findFirst({
      where: {
        organizationId,
        title: METER_METADATA_TITLE,
      },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.clientNote.update({
        where: { id: existing.id },
        data: { content },
      });
      return;
    }

    await this.prisma.clientNote.create({
      data: {
        organizationId,
        createdByUserId: actorUserId,
        type: ClientNoteType.OTHER,
        title: METER_METADATA_TITLE,
        content,
      },
    });
  }

  private meterMetadata(store: MeterWorkflowMetadata, meterId: string): MeterMetadata {
    return store.meters?.[meterId] || {};
  }

  private readingMetadata(store: MeterWorkflowMetadata, reading: any): Required<Pick<ReadingMetadata, 'status' | 'periodMonth'>> &
    ReadingMetadata {
    const raw = store.readings?.[reading.id] || {};
    const status = this.normalizeReadingStatusValue(raw.status) || 'APPROVED';
    return {
      ...raw,
      status,
      periodMonth: raw.periodMonth || this.periodMonth(reading.readingDate),
      source: raw.source || String(reading.source || MeterReadingSource.ADMIN) as ReadingSource,
    };
  }

  private normalizeReadingStatusValue(value: unknown): ReadingStatus | null {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (
      normalized === 'DRAFT' ||
      normalized === 'SUBMITTED' ||
      normalized === 'APPROVED' ||
      normalized === 'REJECTED' ||
      normalized === 'NEEDS_REVIEW' ||
      normalized === 'CANCELLED'
    ) {
      return normalized;
    }
    return null;
  }

  private toExternalMeterType(type: MeterType | string | null | undefined) {
    return String(type || '') === 'HEATING' ? 'HEAT' : String(type || '');
  }

  private typeLabel(type: MeterType | string | null | undefined) {
    const normalized = String(type || '').toUpperCase();
    const labels: Record<string, string> = {
      COLD_WATER: 'Apă rece',
      HOT_WATER: 'Apă caldă',
      ELECTRICITY: 'Electricitate',
      GAS: 'Gaz',
      HEATING: 'Căldură',
      HEAT: 'Căldură',
      OTHER: 'Altul',
    };
    return labels[normalized] || 'Contor';
  }

  private defaultUnit(type: MeterType | string | null | undefined) {
    const normalized = String(type || '').toUpperCase();
    if (normalized === 'ELECTRICITY') return 'kWh';
    if (normalized === 'HEATING' || normalized === 'HEAT') return 'Gcal';
    return 'm³';
  }

  private meterStatus(row: any, meta: MeterMetadata) {
    if (meta.statusAlias) return meta.statusAlias;
    return String(row.status || MeterStatus.ACTIVE);
  }

  private isMeterUsableForResident(row: any, meta: MeterMetadata) {
    const status = this.meterStatus(row, meta);
    return status === 'ACTIVE' && String(row.status) === MeterStatus.ACTIVE;
  }

  private apartmentDto(apartment: any) {
    if (!apartment) return null;
    return {
      id: apartment.id,
      apartmentNumber: apartment.number,
      number: apartment.number,
      staircase: apartment.staircase?.name ?? null,
      staircaseId: apartment.staircase?.id ?? null,
      floor: apartment.floor ?? null,
      areaM2: apartment.areaM2 ?? null,
      building: apartment.building?.name ?? null,
      buildingAddress: apartment.building?.address ?? null,
      status: apartment.status ?? null,
    };
  }

  private toLegacyMeter(row: any) {
    const lastReading = row.readings?.[0] ?? null;
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      type: row.type,
      serialNumber: row.serialNumber,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      apartment: row.apartment
        ? {
            id: row.apartment.id,
            number: row.apartment.number,
            floor: row.apartment.floor,
            areaM2: row.apartment.areaM2,
            rooms: row.apartment.rooms,
            status: row.apartment.status,
          }
        : null,
      building: row.apartment?.building ?? null,
      staircase: row.apartment?.staircase ?? null,
      lastReading: lastReading
        ? {
            id: lastReading.id,
            value: lastReading.value,
            readingDate: lastReading.readingDate,
            source: lastReading.source,
            createdAt: lastReading.createdAt,
          }
        : null,
      readings: row.readings || [],
    };
  }

  private toMeter(row: any, store: MeterWorkflowMetadata) {
    const meta = this.meterMetadata(store, row.id);
    const readings = (row.readings || []).map((reading: any) => this.toReading(reading, store));
    const approvedReadings = readings.filter((reading: any) => reading.status === 'APPROVED');
    const currentPeriod = this.currentPeriodMonth();
    const currentMonthReading =
      readings.find((reading: any) => reading.periodMonth === currentPeriod && reading.status !== 'CANCELLED') || null;
    const lastApprovedReading = approvedReadings[0] || null;

    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      type: this.toExternalMeterType(row.type),
      rawType: row.type,
      typeLabel: this.typeLabel(row.type),
      meterNumber: row.serialNumber,
      serialNumber: row.serialNumber,
      label: meta.label || this.typeLabel(row.type),
      unit: meta.unit || this.defaultUnit(row.type),
      location: meta.location || null,
      status: this.meterStatus(row, meta),
      rawStatus: row.status,
      installedAt: meta.installedAt || null,
      replacedAt: meta.replacedAt || null,
      notes: meta.notes || null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      apartment: this.apartmentDto(row.apartment),
      building: row.apartment?.building ?? null,
      staircase: row.apartment?.staircase ?? null,
      lastApprovedReading,
      lastReading: readings[0] || null,
      currentMonthReading,
      readings,
    };
  }

  private toReading(reading: any, store: MeterWorkflowMetadata, residentMap?: Map<string, any>) {
    const meta = this.readingMetadata(store, reading);
    const unit = meta.unit || this.meterMetadata(store, reading.meterId).unit || this.defaultUnit(reading.meter?.type);
    const resident = meta.residentId ? residentMap?.get(meta.residentId) : null;
    return {
      id: reading.id,
      meterId: reading.meterId,
      apartmentId: reading.apartmentId,
      organizationId: reading.organizationId,
      periodMonth: meta.periodMonth,
      readingValue: Number(reading.value || 0),
      value: Number(reading.value || 0),
      previousReadingValue: meta.previousReadingValue ?? null,
      consumptionValue: meta.consumptionValue ?? null,
      unit,
      status: meta.status,
      source: meta.source || String(reading.source || MeterReadingSource.ADMIN),
      submittedAt: meta.submittedAt || reading.createdAt,
      reviewedAt: meta.reviewedAt || null,
      rejectedAt: meta.rejectedAt || null,
      rejectionReason: meta.rejectionReason || null,
      adminComment: meta.adminComment || null,
      residentComment: meta.residentComment || null,
      photoUrl: meta.photoUrl || null,
      createdAt: reading.createdAt,
      readingDate: reading.readingDate,
      meter: reading.meter
        ? {
            id: reading.meter.id,
            type: this.toExternalMeterType(reading.meter.type),
            rawType: reading.meter.type,
            typeLabel: this.typeLabel(reading.meter.type),
            meterNumber: reading.meter.serialNumber,
            serialNumber: reading.meter.serialNumber,
            unit,
            status: reading.meter.status,
          }
        : null,
      apartment: this.apartmentDto(reading.apartment),
      resident: resident
        ? {
            id: resident.id,
            fullName: this.fullName(resident),
            phone: resident.phone ?? null,
            email: resident.email ?? null,
          }
        : null,
    };
  }

  async listMeters(user: MvpUser) {
    const meters = await this.prisma.meter.findMany({
      where: this.organizationWhere(user),
      orderBy: [
        { apartment: { staircase: { name: 'asc' } } },
        { apartment: { number: 'asc' } },
        { type: 'asc' },
      ],
      select: this.meterSelect(),
    });

    return meters.map((meter) => this.toLegacyMeter(meter));
  }

  async listAdminMeters(user: MvpUser, query: Record<string, unknown> = {}) {
    const store = await this.loadWorkflowMetadata(user.organizationId);
    const meters = await this.prisma.meter.findMany({
      where: this.organizationWhere(user),
      orderBy: [
        { apartment: { staircase: { name: 'asc' } } },
        { apartment: { number: 'asc' } },
        { type: 'asc' },
      ],
      select: this.meterSelect(),
    });

    const apartmentIdsWithMeters = new Set(meters.map((meter) => meter.apartmentId));
    const apartmentsCount = await this.prisma.apartment.count({
      where: { organizationId: user.organizationId },
    });

    const filtered = meters
      .map((meter) => this.toMeter(meter, store))
      .filter((meter) => this.matchesMeterFilters(meter, query));

    const paged = this.paginate(filtered, query);
    return {
      items: paged.items,
      meta: paged.meta,
      stats: {
        totalMeters: filtered.length,
        activeMeters: filtered.filter((meter) => meter.status === 'ACTIVE').length,
        coldWater: filtered.filter((meter) => meter.rawType === MeterType.COLD_WATER || meter.type === 'COLD_WATER').length,
        hotWater: filtered.filter((meter) => meter.rawType === MeterType.HOT_WATER || meter.type === 'HOT_WATER').length,
        electricity: filtered.filter((meter) => meter.rawType === MeterType.ELECTRICITY || meter.type === 'ELECTRICITY').length,
        gas: filtered.filter((meter) => meter.rawType === MeterType.GAS || meter.type === 'GAS').length,
        inactiveOrReplaced: filtered.filter((meter) => meter.status !== 'ACTIVE').length,
        apartmentsWithoutMeters: Math.max(0, apartmentsCount - apartmentIdsWithMeters.size),
      },
    };
  }

  async createMeter(user: MvpUser, body: unknown) {
    const input = this.parseCreateMeterBody(body, user);
    this.assertOrganizationAccess(user, input.organizationId);

    const apartment = await this.prisma.apartment.findFirst({
      where: {
        id: input.apartmentId,
        organizationId: input.organizationId,
      },
      select: { id: true },
    });
    if (!apartment) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    if (input.serialNumber) {
      const duplicate = await this.prisma.meter.findFirst({
        where: {
          organizationId: input.organizationId,
          serialNumber: input.serialNumber,
        },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Acest contor există deja.');
    }

    const meter = await this.prisma.meter.create({
      data: {
        organizationId: input.organizationId,
        apartmentId: input.apartmentId,
        type: input.type,
        serialNumber: input.serialNumber,
        status: input.status,
      },
      select: this.meterSelect(),
    });

    const store = await this.loadWorkflowMetadata(meter.organizationId);
    store.meters[meter.id] = {
      label: input.label,
      unit: input.unit || this.defaultUnit(input.type),
      location: input.location,
      notes: input.notes,
      installedAt: input.installedAt,
      statusAlias: input.statusAlias,
    };
    await this.saveWorkflowMetadata(meter.organizationId, user.id, store);

    await this.activity.createActivity({
      organizationId: meter.organizationId,
      actorUserId: user.id,
      type: 'METER_CREATED',
      title: 'Contor creat',
      message: `Contorul ${meter.serialNumber || this.typeLabel(meter.type)} a fost creat pentru apartamentul ${meter.apartment?.number || ''}.`,
      targetType: 'METER',
      targetId: meter.id,
      link: `/admin/meters/${meter.id}`,
    });

    return this.toMeter(meter, store);
  }

  async updateMeter(user: MvpUser, id: string, body: unknown) {
    const existing = await this.requireAdminMeter(user, id);
    const input = this.parseUpdateMeterBody(body, existing.organizationId);

    if (input.apartmentId) {
      const apartment = await this.prisma.apartment.findFirst({
        where: {
          id: input.apartmentId,
          organizationId: existing.organizationId,
        },
        select: { id: true },
      });
      if (!apartment) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    if (input.serialNumber && input.serialNumber !== existing.serialNumber) {
      const duplicate = await this.prisma.meter.findFirst({
        where: {
          organizationId: existing.organizationId,
          serialNumber: input.serialNumber,
          id: { not: existing.id },
        },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Acest contor există deja.');
    }

    const updated = await this.prisma.meter.update({
      where: { id: existing.id },
      data: {
        ...(input.apartmentId ? { apartmentId: input.apartmentId } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.serialNumber !== undefined ? { serialNumber: input.serialNumber } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      select: this.meterSelect(),
    });

    const store = await this.loadWorkflowMetadata(existing.organizationId);
    store.meters[existing.id] = {
      ...this.meterMetadata(store, existing.id),
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.installedAt !== undefined ? { installedAt: input.installedAt } : {}),
      ...(input.replacedAt !== undefined ? { replacedAt: input.replacedAt } : {}),
      ...(input.statusAlias !== undefined ? { statusAlias: input.statusAlias } : {}),
    };
    await this.saveWorkflowMetadata(existing.organizationId, user.id, store);

    return this.toMeter(updated, store);
  }

  async changeMeterStatus(user: MvpUser, id: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const status = this.requiredString(payload.status, 'Statusul contorului este obligatoriu.').toUpperCase();
    const mapped = this.normalizeMeterStatus(status);
    const updated = await this.updateMeter(user, id, {
      status: mapped.status,
      statusAlias: mapped.statusAlias,
      replacedAt: status === 'REPLACED' ? new Date().toISOString() : undefined,
    });
    return updated;
  }

  async addReading(user: MvpUser, meterId: string, body: unknown) {
    const input = this.parseReadingBody(body, { defaultSource: 'ADMIN', allowStatus: true });
    return this.createAdminReadingForMeter(user, meterId, input);
  }

  async createAdminReading(user: MvpUser, body: unknown) {
    const input = this.parseReadingBody(body, { defaultSource: 'ADMIN', allowStatus: true });
    const meterId = this.requiredString((body as Record<string, unknown>)?.meterId, 'Contorul este obligatoriu.');
    return this.createAdminReadingForMeter(user, meterId, input);
  }

  private async createAdminReadingForMeter(
    user: MvpUser,
    meterId: string,
    input: ReturnType<MetersService['parseReadingBody']>,
  ) {
    const meter = await this.requireAdminMeter(user, meterId);
    const store = await this.loadWorkflowMetadata(meter.organizationId);
    const previous = await this.findPreviousApprovedReading(meter.id, meter.organizationId, input.periodMonth, store);
    const status = input.status || 'APPROVED';

    if (status === 'APPROVED') {
      await this.assertNoApprovedReadingForPeriod(meter.id, meter.organizationId, input.periodMonth, store);
      if (previous && input.readingValue < previous.readingValue) {
        throw new BadRequestException('Citirea nouă este mai mică decât citirea aprobată anterioară.');
      }
    }

    if (status !== 'CANCELLED') {
      await this.assertNoOpenReadingForPeriod(meter.id, meter.organizationId, input.periodMonth, store, ['SUBMITTED', 'NEEDS_REVIEW']);
    }

    const reading = await this.prisma.meterReading.create({
      data: {
        meterId: meter.id,
        apartmentId: meter.apartmentId,
        organizationId: meter.organizationId,
        value: input.readingValue,
        readingDate: this.dateFromPeriodMonth(input.periodMonth),
        source: MeterReadingSource.ADMIN,
      },
      select: this.readingSelect(),
    });

    store.readings[reading.id] = {
      periodMonth: input.periodMonth,
      status,
      source: 'ADMIN',
      unit: input.unit || this.meterMetadata(store, meter.id).unit || this.defaultUnit(meter.type),
      previousReadingValue: previous?.readingValue ?? null,
      consumptionValue: previous ? this.roundMoney(input.readingValue - previous.readingValue) : null,
      submittedByUserId: user.id,
      reviewedByUserId: status === 'APPROVED' ? user.id : null,
      submittedAt: new Date().toISOString(),
      reviewedAt: status === 'APPROVED' ? new Date().toISOString() : null,
      adminComment: input.adminComment,
    };
    await this.saveWorkflowMetadata(meter.organizationId, user.id, store);

    await this.prisma.meter.update({
      where: { id: meter.id },
      data: { status: status === 'NEEDS_REVIEW' ? MeterStatus.SUSPICIOUS : MeterStatus.ACTIVE },
    });

    await this.activity.createActivity({
      organizationId: meter.organizationId,
      actorUserId: user.id,
      type: 'METER_READING_ADDED',
      title: 'Indice contor adăugat',
      message: `A fost adăugat indicele ${input.readingValue} pentru ${this.typeLabel(meter.type)}.`,
      targetType: 'METER_READING',
      targetId: reading.id,
      link: `/admin/meter-readings/${reading.id}`,
    });

    return this.toReading(reading, store);
  }

  async getMeter(user: MvpUser, id: string) {
    const store = await this.loadWorkflowMetadata(user.organizationId);
    const meter = await this.prisma.meter.findFirst({
      where: {
        ...this.organizationWhere(user),
        OR: [{ id }, { serialNumber: id }],
      },
      select: this.meterSelect(),
    });

    if (!meter) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return this.toMeter(meter, store);
  }

  async listAdminReadings(user: MvpUser, query: Record<string, unknown> = {}) {
    const store = await this.loadWorkflowMetadata(user.organizationId);
    const rows = await this.prisma.meterReading.findMany({
      where: this.organizationWhere(user),
      orderBy: [{ readingDate: 'desc' }, { createdAt: 'desc' }],
      select: this.readingSelect(),
    });

    const residentMap = await this.residentMapFromReadingMetadata(user.organizationId, store, rows);
    const items = rows
      .map((row) => this.toReading(row, store, residentMap))
      .filter((item) => this.matchesReadingFilters(item, query));
    const sorted = this.sortReadings(items, query);
    const paged = this.paginate(sorted, query);

    return {
      items: paged.items,
      meta: paged.meta,
      stats: this.readingStats(items),
    };
  }

  async getReadingStats(user: MvpUser, query: Record<string, unknown> = {}) {
    const data = await this.listAdminReadings(user, { ...query, page: 1, limit: 100000 });
    return data.stats;
  }

  async getAdminReading(user: MvpUser, id: string) {
    const row = await this.prisma.meterReading.findFirst({
      where: {
        id,
        ...this.organizationWhere(user),
      },
      select: this.readingSelect(),
    });
    if (!row) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const store = await this.loadWorkflowMetadata(row.organizationId);
    const residentMap = await this.residentMapFromReadingMetadata(row.organizationId, store, [row]);
    const reading = this.toReading(row, store, residentMap);
    const history = await this.listMeterHistory(row.meterId, row.organizationId, store);
    return { reading, history };
  }

  async approveReading(user: MvpUser, id: string, body: unknown) {
    const row = await this.requireAdminReading(user, id);
    const store = await this.loadWorkflowMetadata(row.organizationId);
    const meta = this.readingMetadata(store, row);
    if (meta.status === 'APPROVED') return this.toReading(row, store);
    if (meta.status === 'CANCELLED') throw new BadRequestException('Indicele anulat nu poate fi aprobat.');

    await this.assertNoApprovedReadingForPeriod(row.meterId, row.organizationId, meta.periodMonth, store, row.id);
    const previous = await this.findPreviousApprovedReading(row.meterId, row.organizationId, meta.periodMonth, store, row.id);
    if (previous && Number(row.value) < previous.readingValue) {
      throw new BadRequestException('Indicele este mai mic decât indicele aprobat anterior.');
    }

    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    store.readings[row.id] = {
      ...meta,
      status: 'APPROVED',
      previousReadingValue: previous?.readingValue ?? null,
      consumptionValue: previous ? this.roundMoney(Number(row.value) - previous.readingValue) : null,
      reviewedByUserId: user.id,
      reviewedAt: new Date().toISOString(),
      adminComment: this.optionalString(payload.adminComment) ?? meta.adminComment ?? null,
    };
    await this.saveWorkflowMetadata(row.organizationId, user.id, store);
    await this.prisma.meter.update({ where: { id: row.meterId }, data: { status: MeterStatus.ACTIVE } });
    await this.notifyResidentForReading(row, store, {
      title: 'Indice aprobat',
      message: `Indicele pentru contorul ${this.typeLabel(row.meter?.type)} a fost aprobat.`,
      link: `/resident/meter-readings/${row.id}`,
    });

    return this.toReading(row, store);
  }

  async rejectReading(user: MvpUser, id: string, body: unknown) {
    const row = await this.requireAdminReading(user, id);
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const rejectionReason = this.requiredString(payload.rejectionReason, 'Motivul respingerii este obligatoriu.');
    const store = await this.loadWorkflowMetadata(row.organizationId);
    const meta = this.readingMetadata(store, row);
    if (meta.status === 'APPROVED') throw new BadRequestException('Indicele aprobat nu poate fi respins direct.');
    if (meta.status === 'CANCELLED') throw new BadRequestException('Indicele anulat nu poate fi respins.');

    store.readings[row.id] = {
      ...meta,
      status: 'REJECTED',
      rejectedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      reviewedByUserId: user.id,
      rejectionReason,
      adminComment: this.optionalString(payload.adminComment) ?? null,
    };
    await this.saveWorkflowMetadata(row.organizationId, user.id, store);
    await this.notifyResidentForReading(row, store, {
      title: 'Indice respins',
      message: 'Indicele transmis a fost respins. Verifică motivul în detalii.',
      link: `/resident/meter-readings/${row.id}`,
    });

    return this.toReading(row, store);
  }

  async markReadingNeedsReview(user: MvpUser, id: string, body: unknown) {
    const row = await this.requireAdminReading(user, id);
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const store = await this.loadWorkflowMetadata(row.organizationId);
    const meta = this.readingMetadata(store, row);
    if (meta.status === 'APPROVED') throw new BadRequestException('Indicele aprobat nu poate fi marcat pentru revizuire.');
    if (meta.status === 'CANCELLED') throw new BadRequestException('Indicele anulat nu poate fi modificat.');

    store.readings[row.id] = {
      ...meta,
      status: 'NEEDS_REVIEW',
      reviewedByUserId: user.id,
      reviewedAt: new Date().toISOString(),
      adminComment: this.optionalString(payload.adminComment) ?? meta.adminComment ?? null,
    };
    await this.saveWorkflowMetadata(row.organizationId, user.id, store);
    await this.prisma.meter.update({ where: { id: row.meterId }, data: { status: MeterStatus.SUSPICIOUS } });
    return this.toReading(row, store);
  }

  async listApartmentMeters(user: MvpUser, apartmentId: string) {
    await this.requireAdminApartment(user, apartmentId);
    return this.listAdminMeters(user, { apartmentId, page: 1, limit: 1000 });
  }

  async listApartmentReadings(user: MvpUser, apartmentId: string, query: Record<string, unknown> = {}) {
    await this.requireAdminApartment(user, apartmentId);
    return this.listAdminReadings(user, { ...query, apartmentId });
  }

  async listResidentMeters(user: MvpUser, query: Record<string, unknown> = {}) {
    const scope = await this.getResidentScope(user);
    if (!scope.apartmentIds.length) {
      return { items: [], meta: { total: 0 }, stats: { activeMeters: 0, submittedCurrentMonth: 0 } };
    }
    const apartmentIds = this.residentApartmentFilter(scope.apartmentIds, query.apartmentId);
    const store = await this.loadWorkflowMetadata(user.organizationId);
    const rows = await this.prisma.meter.findMany({
      where: {
        organizationId: user.organizationId,
        apartmentId: { in: apartmentIds },
      },
      orderBy: [{ apartment: { number: 'asc' } }, { type: 'asc' }],
      select: this.meterSelect(),
    });

    const items = rows
      .map((row) => this.toMeter(row, store))
      .filter((meter) => {
        const requestedStatus = this.optionalString(query.status)?.toUpperCase();
        if (requestedStatus) return meter.status === requestedStatus;
        return meter.status === 'ACTIVE';
      })
      .filter((meter) => {
        const type = this.optionalString(query.type)?.toUpperCase();
        return !type || meter.type === type || meter.rawType === type;
      });

    return {
      items,
      meta: { total: items.length },
      stats: {
        activeMeters: items.filter((meter) => meter.status === 'ACTIVE').length,
        submittedCurrentMonth: items.filter((meter) => meter.currentMonthReading?.status === 'SUBMITTED').length,
        needsReviewCurrentMonth: items.filter((meter) => meter.currentMonthReading?.status === 'NEEDS_REVIEW').length,
      },
    };
  }

  async getResidentMeter(user: MvpUser, id: string) {
    const scope = await this.getResidentScope(user);
    if (!scope.apartmentIds.length) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const store = await this.loadWorkflowMetadata(user.organizationId);
    const meter = await this.prisma.meter.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        apartmentId: { in: scope.apartmentIds },
      },
      select: this.meterSelect(),
    });
    if (!meter) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return {
      meter: this.toMeter(meter, store),
      readings: await this.listMeterHistory(meter.id, meter.organizationId, store),
    };
  }

  async listResidentReadings(user: MvpUser, query: Record<string, unknown> = {}) {
    const scope = await this.getResidentScope(user);
    if (!scope.apartmentIds.length) return { items: [], meta: { page: 1, limit: 20, total: 0 } };
    const apartmentIds = this.residentApartmentFilter(scope.apartmentIds, query.apartmentId);
    const store = await this.loadWorkflowMetadata(user.organizationId);
    const rows = await this.prisma.meterReading.findMany({
      where: {
        organizationId: user.organizationId,
        apartmentId: { in: apartmentIds },
        ...(this.optionalString(query.meterId) ? { meterId: this.optionalString(query.meterId) } : {}),
      },
      orderBy: [{ readingDate: 'desc' }, { createdAt: 'desc' }],
      select: this.readingSelect(),
    });
    const items = rows
      .map((row) => this.toReading(row, store))
      .filter((item) => this.matchesReadingFilters(item, query));
    return this.paginate(items, query);
  }

  async createResidentReading(user: MvpUser, body: unknown, meterIdFromPath?: string) {
    const scope = await this.requireResidentScope(user);
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const input = this.parseReadingBody(
      {
        ...payload,
        source: 'RESIDENT',
        meterId: meterIdFromPath || payload.meterId,
      },
      { defaultSource: 'RESIDENT', allowStatus: false },
    );
    const meterId = this.requiredString(meterIdFromPath || payload.meterId, 'Contorul este obligatoriu.');
    const store = await this.loadWorkflowMetadata(user.organizationId);
    const meter = await this.prisma.meter.findFirst({
      where: {
        id: meterId,
        organizationId: user.organizationId,
        apartmentId: { in: scope.apartmentIds },
      },
      select: this.meterSelect(),
    });
    if (!meter) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (!this.isMeterUsableForResident(meter, this.meterMetadata(store, meter.id))) {
      throw new BadRequestException('Acest contor nu este disponibil pentru transmiterea indicilor.');
    }

    await this.assertNoApprovedReadingForPeriod(meter.id, meter.organizationId, input.periodMonth, store);
    await this.assertNoOpenReadingForPeriod(meter.id, meter.organizationId, input.periodMonth, store, ['SUBMITTED', 'NEEDS_REVIEW']);

    const previous = await this.findPreviousApprovedReading(meter.id, meter.organizationId, input.periodMonth, store);
    const status: ReadingStatus = previous && input.readingValue < previous.readingValue ? 'NEEDS_REVIEW' : 'SUBMITTED';
    const residentId = scope.residentByApartmentId.get(meter.apartmentId)?.id || scope.residentProfiles[0]?.id || null;

    const reading = await this.prisma.meterReading.create({
      data: {
        meterId: meter.id,
        apartmentId: meter.apartmentId,
        organizationId: meter.organizationId,
        value: input.readingValue,
        readingDate: this.dateFromPeriodMonth(input.periodMonth),
        source: MeterReadingSource.RESIDENT,
      },
      select: this.readingSelect(),
    });

    store.readings[reading.id] = {
      periodMonth: input.periodMonth,
      status,
      source: 'RESIDENT',
      unit: input.unit || this.meterMetadata(store, meter.id).unit || this.defaultUnit(meter.type),
      previousReadingValue: previous?.readingValue ?? null,
      consumptionValue: previous ? this.roundMoney(input.readingValue - previous.readingValue) : null,
      residentId,
      submittedByUserId: user.id,
      submittedAt: new Date().toISOString(),
      residentComment: input.residentComment,
      photoUrl: input.photoUrl,
    };
    await this.saveWorkflowMetadata(meter.organizationId, user.id, store);
    await this.prisma.meter.update({
      where: { id: meter.id },
      data: { status: status === 'NEEDS_REVIEW' ? MeterStatus.SUSPICIOUS : MeterStatus.ACTIVE },
    });

    await this.activity.createActivity({
      organizationId: meter.organizationId,
      actorUserId: user.id,
      type: 'METER_READING_ADDED',
      title: 'Indice transmis de locatar',
      message: `Locatarul a transmis indicele ${input.readingValue} pentru ${this.typeLabel(meter.type)}.`,
      targetType: 'METER_READING',
      targetId: reading.id,
      link: `/admin/meter-readings/${reading.id}`,
    });
    await this.activity.notifyOrganizationAdmins({
      organizationId: meter.organizationId,
      type: NotificationType.SYSTEM,
      title: status === 'NEEDS_REVIEW' ? 'Indice contor necesită verificare' : 'Indice contor transmis',
      message: `A fost transmis un indice pentru apartamentul ${meter.apartment?.number || ''}.`,
      link: `/admin/meter-readings/${reading.id}`,
    });

    return this.toReading(reading, store);
  }

  async getResidentReading(user: MvpUser, id: string) {
    const scope = await this.getResidentScope(user);
    const row = await this.prisma.meterReading.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        apartmentId: { in: scope.apartmentIds },
      },
      select: this.readingSelect(),
    });
    if (!row) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const store = await this.loadWorkflowMetadata(row.organizationId);
    const reading = this.toReading(row, store);
    const history = await this.listMeterHistory(row.meterId, row.organizationId, store);
    return { reading, history };
  }

  async cancelResidentReading(user: MvpUser, id: string) {
    const scope = await this.requireResidentScope(user);
    const row = await this.prisma.meterReading.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        apartmentId: { in: scope.apartmentIds },
      },
      select: this.readingSelect(),
    });
    if (!row) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const store = await this.loadWorkflowMetadata(row.organizationId);
    const meta = this.readingMetadata(store, row);
    if (meta.status !== 'SUBMITTED') {
      throw new BadRequestException('Poți anula doar un indice transmis și neverificat.');
    }
    store.readings[row.id] = {
      ...meta,
      status: 'CANCELLED',
    };
    await this.saveWorkflowMetadata(row.organizationId, user.id, store);
    await this.activity.notifyOrganizationAdmins({
      organizationId: row.organizationId,
      type: NotificationType.SYSTEM,
      title: 'Indice contor anulat',
      message: `Locatarul a anulat indicele pentru ${this.typeLabel(row.meter?.type)}.`,
      link: `/admin/meter-readings/${row.id}`,
    });
    return this.toReading(row, store);
  }

  async getConsumptionReport(user: MvpUser, query: Record<string, unknown>) {
    return this.buildConsumptionReport(user, query);
  }

  async getConsumptionSummary(user: MvpUser, query: Record<string, unknown>) {
    const report = await this.buildConsumptionReport(user, query);
    return {
      periodMonth: report.periodMonth,
      association: report.association,
      summary: report.summary,
      statusBreakdown: report.statusBreakdown,
    };
  }

  async getConsumptionByMeterType(user: MvpUser, query: Record<string, unknown>) {
    const report = await this.buildConsumptionReport(user, query);
    return { periodMonth: report.periodMonth, items: report.byMeterType };
  }

  async getConsumptionByStaircase(user: MvpUser, query: Record<string, unknown>) {
    const report = await this.buildConsumptionReport(user, query);
    return { periodMonth: report.periodMonth, items: report.byStaircase };
  }

  async getConsumptionByApartment(user: MvpUser, query: Record<string, unknown>) {
    const report = await this.buildConsumptionReport(user, query);
    return {
      periodMonth: report.periodMonth,
      items: report.items,
      meta: report.meta,
    };
  }

  async getMissingReadingsReport(user: MvpUser, query: Record<string, unknown>) {
    const report = await this.buildConsumptionReport(user, query);
    return {
      periodMonth: report.periodMonth,
      items: report.missing.items,
      meta: report.missing.meta,
    };
  }

  async getReadingIssuesReport(user: MvpUser, query: Record<string, unknown>) {
    const report = await this.buildConsumptionReport(user, query);
    return {
      periodMonth: report.periodMonth,
      items: report.issues.items,
      meta: report.issues.meta,
    };
  }

  async getConsumptionTrends(user: MvpUser, query: Record<string, unknown>) {
    const report = await this.buildConsumptionReport(user, query);
    return report.trends;
  }

  async getTopConsumption(user: MvpUser, query: Record<string, unknown>) {
    const report = await this.buildConsumptionReport(user, query);
    return {
      periodMonth: report.periodMonth,
      items: report.topConsumption.items,
    };
  }

  private async buildConsumptionReport(user: MvpUser, query: Record<string, unknown>) {
    if (!user.organizationId) {
      throw new ForbiddenException('Nu ai acces la rapoartele de consum.');
    }

    const organizationId = user.organizationId;
    const periodMonth = this.normalizePeriodMonth(query.periodMonth);
    const meterTypeFilter = this.reportMeterTypeFilter(query.meterType || query.type);
    const statusFilter = this.reportValueFilter(query.status);
    const sourceFilter = this.reportValueFilter(query.source);
    const staircaseFilter = this.optionalString(query.staircase)?.toLowerCase() || null;
    const apartmentIdFilter = this.optionalString(query.apartmentId);
    const apartmentNumberFilter = this.optionalString(query.apartmentNumber)?.toLowerCase() || null;
    const includeInactiveMeters = this.booleanQuery(query.includeInactiveMeters);
    const missingOnly = this.booleanQuery(query.missingOnly);
    const issuesOnly = this.booleanQuery(query.issuesOnly);
    const minConsumption = query.minConsumption !== undefined && query.minConsumption !== null && query.minConsumption !== ''
      ? this.requiredNumber(query.minConsumption, 'Consumul minim trebuie să fie numeric.')
      : null;
    const maxConsumption = query.maxConsumption !== undefined && query.maxConsumption !== null && query.maxConsumption !== ''
      ? this.requiredNumber(query.maxConsumption, 'Consumul maxim trebuie să fie numeric.')
      : null;

    if (apartmentIdFilter) {
      await this.requireAdminApartment(user, apartmentIdFilter);
    }

    const [organization, apartments, meterRows, readingRows, store] = await Promise.all([
      this.prisma.organization.findFirst({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          legalName: true,
          fiscalCode: true,
          address: true,
          currency: true,
          defaultCurrency: true,
        },
      }),
      this.prisma.apartment.findMany({
        where: { organizationId },
        orderBy: [{ staircase: { name: 'asc' } }, { number: 'asc' }],
        select: {
          id: true,
          number: true,
          floor: true,
          areaM2: true,
          status: true,
          building: { select: { id: true, name: true, address: true } },
          staircase: { select: { id: true, name: true } },
        },
      }),
      this.prisma.meter.findMany({
        where: { organizationId },
        orderBy: [{ apartment: { staircase: { name: 'asc' } } }, { apartment: { number: 'asc' } }, { type: 'asc' }],
        select: this.meterSelect(),
      }),
      this.prisma.meterReading.findMany({
        where: { organizationId },
        orderBy: [{ readingDate: 'asc' }, { createdAt: 'asc' }],
        select: this.readingSelect(),
      }),
      this.loadWorkflowMetadata(organizationId),
    ]);

    if (!organization) {
      throw new NotFoundException('Asociația nu a fost găsită.');
    }

    const contacts = await this.primaryContactsForApartments(organizationId, apartments.map((apartment) => apartment.id));
    const apartmentMap = new Map(apartments.map((apartment) => [apartment.id, this.apartmentDto(apartment)]));
    const meterDtos = (meterRows as any[]).map((meter) => this.toMeter(meter, store));
    const meterById = new Map(meterDtos.map((meter) => [meter.id, meter]));
    const rawReadingDtos = (readingRows as any[]).map((row) => this.toReading(row, store));
    const readingDtos = this.withReportConsumption(rawReadingDtos);
    const readingsByMeter = this.groupBy(readingDtos, (reading) => reading.meterId);
    const previousPeriodMonth = this.addMonthsToPeriod(periodMonth, -1);

    const matchesApartmentScope = (apartment: any) => {
      if (!apartment) return false;
      if (apartmentIdFilter && apartment.id !== apartmentIdFilter) return false;
      if (apartmentNumberFilter && !String(apartment.apartmentNumber || apartment.number || '').toLowerCase().includes(apartmentNumberFilter)) {
        return false;
      }
      if (staircaseFilter && !String(apartment.staircase || '').toLowerCase().includes(staircaseFilter)) return false;
      return true;
    };
    const matchesMeterScope = (meter: any) => {
      if (!matchesApartmentScope(meter.apartment)) return false;
      if (!includeInactiveMeters && meter.status !== 'ACTIVE') return false;
      if (meterTypeFilter && meter.rawType !== meterTypeFilter && meter.type !== meterTypeFilter) return false;
      return true;
    };
    const matchesReadingScope = (reading: any, options: { applyStatus?: boolean; approvedOnly?: boolean } = {}) => {
      const meter = meterById.get(reading.meterId);
      if (!meter || !matchesMeterScope(meter)) return false;
      if (sourceFilter && reading.source !== sourceFilter) return false;
      if (options.approvedOnly && reading.status !== 'APPROVED') return false;
      if (options.applyStatus && statusFilter && reading.status !== statusFilter) return false;
      return true;
    };
    const periodReadings = readingDtos.filter((reading) => reading.periodMonth === periodMonth && matchesReadingScope(reading, { applyStatus: true }));
    const approvedPeriodReadings = readingDtos.filter((reading) => reading.periodMonth === periodMonth && matchesReadingScope(reading, { approvedOnly: true }));
    const relevantMeters = meterDtos.filter(matchesMeterScope);
    const relevantApartments = Array.from(apartmentMap.values()).filter(matchesApartmentScope);

    const readingsForMeterInPeriod = (meterId: string) => periodReadings.filter((reading) => reading.meterId === meterId);
    const approvedForMeterInPeriod = (meterId: string) => approvedPeriodReadings.filter((reading) => reading.meterId === meterId);
    const meterHasAcceptedReading = (meterId: string) =>
      readingsForMeterInPeriod(meterId).some((reading) => reading.status === 'APPROVED' || reading.status === 'SUBMITTED');

    const totalsByType = this.blankConsumptionByType();
    const approvedConsumptionReadings = approvedPeriodReadings.filter((reading) => this.validConsumption(reading.consumptionValue));
    for (const reading of approvedConsumptionReadings) {
      const type = this.externalType(reading.meter?.rawType || reading.meter?.type);
      totalsByType[type] = this.addConsumption(totalsByType[type], Number(reading.consumptionValue), reading.unit || this.defaultUnit(type));
    }

    const apartmentsWithMeters = new Set(relevantMeters.map((meter) => meter.apartmentId));
    const apartmentsWithApprovedReadings = new Set(approvedPeriodReadings.map((reading) => reading.apartmentId));
    const apartmentsWithRequiredReadings = new Set(
      Array.from(apartmentsWithMeters).filter((apartmentId) => {
        const apartmentMeters = relevantMeters.filter((meter) => meter.apartmentId === apartmentId);
        return apartmentMeters.length > 0 && apartmentMeters.every((meter) => meterHasAcceptedReading(meter.id));
      }),
    );
    const rejectedReadings = periodReadings.filter((reading) => reading.status === 'REJECTED').length;
    const submittedReadings = periodReadings.filter((reading) => reading.status === 'SUBMITTED').length;
    const needsReviewReadings = periodReadings.filter((reading) => reading.status === 'NEEDS_REVIEW').length;

    const missingItems = Array.from(apartmentsWithMeters)
      .map((apartmentId) => {
        const apartment = apartmentMap.get(apartmentId);
        const missingMeters = relevantMeters
          .filter((meter) => meter.apartmentId === apartmentId)
          .filter((meter) => !meterHasAcceptedReading(meter.id))
          .map((meter) => {
            const lastApproved = (readingsByMeter.get(meter.id) || [])
              .filter((reading) => reading.status === 'APPROVED' && reading.periodMonth < periodMonth)
              .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth))[0];
            return {
              meterId: meter.id,
              meterType: meter.type,
              meterTypeLabel: meter.typeLabel,
              meterNumber: meter.meterNumber,
              unit: meter.unit,
              lastApprovedPeriodMonth: lastApproved?.periodMonth || null,
              lastApprovedReadingValue: lastApproved?.readingValue ?? null,
            };
          });
        if (!missingMeters.length || !apartment) return null;
        return {
          apartment,
          primaryContact: contacts.get(apartmentId) || null,
          missingMeters,
          missingMetersCount: missingMeters.length,
          lastSubmittedAt: this.latestDate(
            (readingsByMeter.get(missingMeters[0]?.meterId || '') || []).map((reading) => reading.submittedAt || reading.createdAt),
          ),
          actions: {
            apartmentUrl: `/admin/apartments/${apartmentId}`,
            readingsUrl: `/admin/meter-readings?apartmentId=${apartmentId}`,
            metersUrl: `/admin/meters?apartmentId=${apartmentId}`,
          },
        };
      })
      .filter(Boolean) as any[];

    const issueReadings = this.issueReadings(periodReadings, readingDtos, previousPeriodMonth)
      .filter((item) => matchesReadingScope(item.reading, { applyStatus: false }))
      .map(({ reading, warnings }) => {
        const meter = meterById.get(reading.meterId);
        return {
          id: reading.id,
          periodMonth: reading.periodMonth,
          apartment: reading.apartment,
          primaryContact: contacts.get(reading.apartmentId) || null,
          meter: {
            id: reading.meterId,
            type: reading.meter?.type,
            typeLabel: reading.meter?.typeLabel || meter?.typeLabel,
            meterNumber: reading.meter?.meterNumber || meter?.meterNumber,
            unit: reading.unit || meter?.unit,
          },
          readingValue: reading.readingValue,
          previousReadingValue: reading.previousReadingValue,
          consumptionValue: reading.consumptionValue,
          unit: reading.unit,
          status: reading.status,
          source: reading.source,
          reason: reading.rejectionReason || reading.adminComment || warnings[0] || null,
          warnings,
          createdAt: reading.createdAt,
          submittedAt: reading.submittedAt,
          actionUrl: `/admin/meter-readings/${reading.id}`,
        };
      });

    const apartmentRows = relevantApartments.map((apartment) => {
      const apartmentMeters = relevantMeters.filter((meter) => meter.apartmentId === apartment.id);
      const apartmentReadings = periodReadings.filter((reading) => reading.apartmentId === apartment.id);
      const apartmentApprovedReadings = approvedPeriodReadings.filter((reading) => reading.apartmentId === apartment.id);
      const consumption = this.blankConsumptionByType();
      for (const reading of apartmentApprovedReadings) {
        if (!this.validConsumption(reading.consumptionValue)) continue;
        const type = this.externalType(reading.meter?.rawType || reading.meter?.type);
        consumption[type] = this.addConsumption(consumption[type], Number(reading.consumptionValue), reading.unit || this.defaultUnit(type));
      }
      const missingReadingsCount = apartmentMeters.filter((meter) => !meterHasAcceptedReading(meter.id)).length;
      const issuesCount = issueReadings.filter((issue) => issue.apartment?.id === apartment.id).length;
      const totalConsumption = Object.values(consumption).reduce((sum, item: any) => sum + Number(item?.value || 0), 0);
      const approvedCount = apartmentMeters.filter((meter) => approvedForMeterInPeriod(meter.id).length > 0).length;
      const anyPeriodReading = apartmentReadings.length > 0;
      let reportStatus = 'NO_METERS';
      if (apartmentMeters.length) {
        if (issuesCount > 0 || apartmentReadings.some((reading) => reading.status === 'NEEDS_REVIEW')) reportStatus = 'NEEDS_REVIEW';
        else if (approvedCount === apartmentMeters.length) reportStatus = 'COMPLETE';
        else if (!anyPeriodReading) reportStatus = 'MISSING_READINGS';
        else reportStatus = 'PARTIAL';
      }
      return {
        apartment,
        primaryContact: contacts.get(apartment.id) || null,
        consumption,
        totalConsumption: this.roundMoney(totalConsumption),
        readingsCount: apartmentReadings.length,
        approvedReadingsCount: apartmentApprovedReadings.length,
        missingReadingsCount,
        issuesCount,
        reportStatus,
        actions: {
          apartmentUrl: `/admin/apartments/${apartment.id}`,
          metersUrl: `/admin/meters?apartmentId=${apartment.id}`,
          readingsUrl: `/admin/meter-readings?apartmentId=${apartment.id}&periodMonth=${periodMonth}`,
        },
      };
    });

    const filteredApartmentRows = apartmentRows.filter((row) => {
      if (missingOnly && row.missingReadingsCount === 0) return false;
      if (issuesOnly && row.issuesCount === 0) return false;
      if (minConsumption !== null && row.totalConsumption < minConsumption) return false;
      if (maxConsumption !== null && row.totalConsumption > maxConsumption) return false;
      return true;
    });

    const sortedApartmentRows = this.sortConsumptionRows(filteredApartmentRows, query);
    const paginated = this.paginate(sortedApartmentRows, query);
    const byMeterType = this.buildByMeterType(relevantMeters, approvedPeriodReadings, meterHasAcceptedReading);
    const byStaircase = this.buildByStaircase(relevantMeters, approvedPeriodReadings, apartmentMap, meterHasAcceptedReading);
    const trends = this.buildConsumptionTrends(query, readingDtos, meterDtos, meterById, matchesApartmentScope, includeInactiveMeters, meterTypeFilter, sourceFilter);
    const topConsumption = this.buildTopConsumption(
      periodMonth,
      approvedPeriodReadings,
      readingDtos.filter((reading) => reading.periodMonth === previousPeriodMonth && matchesReadingScope(reading, { approvedOnly: true })),
      contacts,
      query,
    );

    const statusBreakdown = ['APPROVED', 'SUBMITTED', 'REJECTED', 'NEEDS_REVIEW', 'CANCELLED'].map((status) => {
      const readings = periodReadings.filter((reading) => reading.status === status);
      const amount = readings
        .filter((reading) => this.validConsumption(reading.consumptionValue))
        .reduce((sum, reading) => sum + Number(reading.consumptionValue || 0), 0);
      return {
        status,
        count: readings.length,
        totalConsumption: this.roundMoney(amount),
      };
    });

    const summary = {
      apartmentsWithMeters: apartmentsWithMeters.size,
      apartmentsWithApprovedReadings: apartmentsWithApprovedReadings.size,
      apartmentsWithMissingReadings: Math.max(0, apartmentsWithMeters.size - apartmentsWithRequiredReadings.size),
      readingCoverageRate: apartmentsWithMeters.size ? this.roundMoney((apartmentsWithRequiredReadings.size / apartmentsWithMeters.size) * 100) : 0,
      approvedReadings: approvedPeriodReadings.length,
      submittedReadings,
      rejectedReadings,
      needsReviewReadings,
      totalConsumptionByType: totalsByType,
      coldWaterConsumption: totalsByType.COLD_WATER.value,
      hotWaterConsumption: totalsByType.HOT_WATER.value,
      electricityConsumption: totalsByType.ELECTRICITY.value,
      gasConsumption: totalsByType.GAS.value,
      heatConsumption: totalsByType.HEAT.value,
    };

    return {
      periodMonth,
      association: {
        id: organization.id,
        shortName: organization.name,
        legalName: organization.legalName,
        associationCode: organization.fiscalCode,
        address: organization.address,
        currency: organization.currency || organization.defaultCurrency || 'MDL',
      },
      summary,
      statusBreakdown,
      byMeterType,
      byStaircase,
      items: paginated.items,
      meta: paginated.meta,
      missing: this.paginate(missingItems, { page: query.page, limit: query.limit }),
      issues: this.paginate(issueReadings, { page: query.page, limit: query.limit }),
      trends,
      topConsumption,
    };
  }

  private async primaryContactsForApartments(organizationId: string, apartmentIds: string[]) {
    if (!apartmentIds.length) return new Map<string, any>();
    const contacts = new Map<string, any>();
    const relations = await this.prisma.apartmentResident.findMany({
      where: {
        apartmentId: { in: apartmentIds },
        apartment: { organizationId },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: {
        apartmentId: true,
        role: true,
        isPrimary: true,
        resident: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
    });
    for (const relation of relations as any[]) {
      if (contacts.has(relation.apartmentId)) continue;
      contacts.set(relation.apartmentId, {
        id: relation.resident?.id,
        fullName: this.fullName(relation.resident),
        phone: relation.resident?.phone ?? null,
        email: relation.resident?.email ?? null,
        role: relation.role,
        isPrimaryContact: relation.isPrimary,
      });
    }

    const directProfiles = await this.prisma.residentProfile.findMany({
      where: {
        organizationId,
        apartmentId: { in: apartmentIds },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        apartmentId: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        type: true,
        isPrimary: true,
      },
    });
    for (const profile of directProfiles as any[]) {
      if (!profile.apartmentId || contacts.has(profile.apartmentId)) continue;
      contacts.set(profile.apartmentId, {
        id: profile.id,
        fullName: this.fullName(profile),
        phone: profile.phone ?? null,
        email: profile.email ?? null,
        role: profile.type,
        isPrimaryContact: profile.isPrimary,
      });
    }
    return contacts;
  }

  private reportValueFilter(value: unknown) {
    const raw = this.optionalString(value)?.toUpperCase();
    if (!raw || raw === 'ALL') return null;
    return raw;
  }

  private reportMeterTypeFilter(value: unknown) {
    const raw = this.optionalString(value)?.toUpperCase();
    if (!raw || raw === 'ALL') return null;
    const mapped = raw === 'HEAT' ? 'HEATING' : raw;
    const allowed = ['COLD_WATER', 'HOT_WATER', 'ELECTRICITY', 'GAS', 'HEATING', 'OTHER'];
    if (!allowed.includes(mapped)) throw new BadRequestException('Tipul contorului nu este valid.');
    return mapped;
  }

  private booleanQuery(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value !== 'string') return false;
    return ['true', '1', 'yes', 'da'].includes(value.trim().toLowerCase());
  }

  private withReportConsumption(readings: any[]) {
    const byMeter = this.groupBy(readings, (reading) => reading.meterId);
    const enriched = new Map<string, any>();
    for (const group of byMeter.values()) {
      const sorted = [...group].sort((a, b) => {
        const byMonth = String(a.periodMonth).localeCompare(String(b.periodMonth));
        if (byMonth !== 0) return byMonth;
        return new Date(a.createdAt || a.submittedAt).getTime() - new Date(b.createdAt || b.submittedAt).getTime();
      });
      const approved: any[] = [];
      for (const reading of sorted) {
        const previous = [...approved].reverse().find((item) => item.periodMonth < reading.periodMonth) || null;
        const next = { ...reading };
        if ((next.previousReadingValue === null || next.previousReadingValue === undefined) && previous) {
          next.previousReadingValue = Number(previous.readingValue || 0);
        }
        if ((next.consumptionValue === null || next.consumptionValue === undefined) && previous) {
          next.consumptionValue = this.roundMoney(Number(next.readingValue || 0) - Number(previous.readingValue || 0));
        }
        enriched.set(next.id, next);
        if (next.status === 'APPROVED') approved.push(next);
      }
    }
    return readings.map((reading) => enriched.get(reading.id) || reading);
  }

  private groupBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const key = getKey(item);
      if (!key) continue;
      map.set(key, [...(map.get(key) || []), item]);
    }
    return map;
  }

  private blankConsumptionByType() {
    return {
      COLD_WATER: { value: 0, unit: 'm³' },
      HOT_WATER: { value: 0, unit: 'm³' },
      ELECTRICITY: { value: 0, unit: 'kWh' },
      GAS: { value: 0, unit: 'm³' },
      HEAT: { value: 0, unit: 'Gcal' },
      OTHER: { value: 0, unit: '' },
    };
  }

  private addConsumption(current: { value: number; unit: string }, value: number, unit: string) {
    return {
      value: this.roundMoney(Number(current?.value || 0) + Number(value || 0)),
      unit: current?.unit || unit,
    };
  }

  private validConsumption(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0;
  }

  private externalType(type: unknown) {
    const external = this.toExternalMeterType(String(type || ''));
    return external || 'OTHER';
  }

  private latestDate(values: unknown[]) {
    const timestamps = values
      .map((value) => (value ? new Date(String(value)).getTime() : NaN))
      .filter((value) => Number.isFinite(value));
    if (!timestamps.length) return null;
    return new Date(Math.max(...timestamps)).toISOString();
  }

  private issueReadings(periodReadings: any[], allReadings: any[], previousPeriodMonth: string) {
    const previousConsumptionByMeter = new Map<string, number>();
    for (const reading of allReadings) {
      if (reading.status !== 'APPROVED' || reading.periodMonth !== previousPeriodMonth || !this.validConsumption(reading.consumptionValue)) continue;
      previousConsumptionByMeter.set(reading.meterId, Number(reading.consumptionValue));
    }
    const now = Date.now();
    return periodReadings
      .map((reading) => {
        const warnings: string[] = [];
        const consumption = Number(reading.consumptionValue);
        const previousConsumption = previousConsumptionByMeter.get(reading.meterId);
        if (reading.status === 'NEEDS_REVIEW') warnings.push('Indicele necesită verificare.');
        if (reading.status === 'REJECTED') warnings.push('Indicele a fost respins.');
        if (reading.status === 'SUBMITTED') {
          const submittedAt = new Date(reading.submittedAt || reading.createdAt).getTime();
          if (Number.isFinite(submittedAt) && now - submittedAt > 3 * 24 * 60 * 60 * 1000) {
            warnings.push('Indicele este în așteptare de peste 3 zile.');
          }
        }
        if (Number.isFinite(consumption) && consumption < 0) warnings.push('Consum negativ sau suspect.');
        if (
          Number.isFinite(consumption) &&
          consumption > 0 &&
          previousConsumption !== undefined &&
          previousConsumption > 0 &&
          consumption > previousConsumption * 3
        ) {
          warnings.push('Consum neobișnuit de mare față de luna precedentă.');
        }
        return warnings.length ? { reading, warnings } : null;
      })
      .filter(Boolean) as { reading: any; warnings: string[] }[];
  }

  private sortConsumptionRows(items: any[], query: Record<string, unknown>) {
    const sortBy = this.optionalString(query.sortBy) || 'apartment';
    const direction = this.optionalString(query.sortDirection)?.toLowerCase() === 'desc' ? -1 : 1;
    return [...items].sort((a, b) => {
      if (sortBy === 'consumption' || sortBy === 'totalConsumption') {
        return (Number(a.totalConsumption || 0) - Number(b.totalConsumption || 0)) * direction;
      }
      if (sortBy === 'missing') return (Number(a.missingReadingsCount || 0) - Number(b.missingReadingsCount || 0)) * direction;
      if (sortBy === 'issues') return (Number(a.issuesCount || 0) - Number(b.issuesCount || 0)) * direction;
      if (sortBy === 'staircase') return String(a.apartment?.staircase || '').localeCompare(String(b.apartment?.staircase || ''), 'ro', { numeric: true }) * direction;
      return String(a.apartment?.apartmentNumber || '').localeCompare(String(b.apartment?.apartmentNumber || ''), 'ro', { numeric: true }) * direction;
    });
  }

  private buildByMeterType(relevantMeters: any[], approvedReadings: any[], meterHasAcceptedReading: (meterId: string) => boolean) {
    const types = ['COLD_WATER', 'HOT_WATER', 'ELECTRICITY', 'GAS', 'HEAT', 'OTHER'];
    return types.map((type) => {
      const rawType = type === 'HEAT' ? 'HEATING' : type;
      const meters = relevantMeters.filter((meter) => meter.type === type || meter.rawType === rawType);
      const readings = approvedReadings.filter((reading) => reading.meter?.type === type || reading.meter?.rawType === rawType);
      const values = readings
        .map((reading) => Number(reading.consumptionValue))
        .filter((value) => Number.isFinite(value) && value >= 0);
      const total = values.reduce((sum, value) => sum + value, 0);
      const apartmentsWithReadings = new Set(readings.map((reading) => reading.apartmentId));
      return {
        meterType: type,
        label: this.typeLabel(type),
        unit: this.defaultUnit(type),
        activeMeters: meters.length,
        approvedReadings: readings.length,
        missingReadings: meters.filter((meter) => !meterHasAcceptedReading(meter.id)).length,
        totalConsumption: this.roundMoney(total),
        averageConsumption: apartmentsWithReadings.size ? this.roundMoney(total / apartmentsWithReadings.size) : 0,
        minConsumption: values.length ? this.roundMoney(Math.min(...values)) : 0,
        maxConsumption: values.length ? this.roundMoney(Math.max(...values)) : 0,
      };
    });
  }

  private buildByStaircase(
    relevantMeters: any[],
    approvedReadings: any[],
    apartmentMap: Map<string, any>,
    meterHasAcceptedReading: (meterId: string) => boolean,
  ) {
    const staircaseLabels = Array.from(new Set(relevantMeters.map((meter) => meter.apartment?.staircase || 'Fără scară'))).sort((a, b) =>
      String(a).localeCompare(String(b), 'ro', { numeric: true }),
    );
    return staircaseLabels.map((staircase) => {
      const meters = relevantMeters.filter((meter) => (meter.apartment?.staircase || 'Fără scară') === staircase);
      const apartmentIds = new Set(meters.map((meter) => meter.apartmentId));
      const coveredApartmentIds = new Set(
        Array.from(apartmentIds).filter((apartmentId) => {
          const apartmentMeters = meters.filter((meter) => meter.apartmentId === apartmentId);
          return apartmentMeters.length > 0 && apartmentMeters.every((meter) => meterHasAcceptedReading(meter.id));
        }),
      );
      const consumptionByType = this.blankConsumptionByType();
      const readings = approvedReadings.filter((reading) => {
        const apartment = apartmentMap.get(reading.apartmentId);
        return (apartment?.staircase || 'Fără scară') === staircase && this.validConsumption(reading.consumptionValue);
      });
      for (const reading of readings) {
        const type = this.externalType(reading.meter?.rawType || reading.meter?.type);
        consumptionByType[type] = this.addConsumption(consumptionByType[type], Number(reading.consumptionValue), reading.unit || this.defaultUnit(type));
      }
      return {
        staircase,
        apartmentsWithMeters: apartmentIds.size,
        apartmentsWithApprovedReadings: coveredApartmentIds.size,
        apartmentsWithMissingReadings: Math.max(0, apartmentIds.size - coveredApartmentIds.size),
        readingCoverageRate: apartmentIds.size ? this.roundMoney((coveredApartmentIds.size / apartmentIds.size) * 100) : 0,
        consumptionByType,
      };
    });
  }

  private buildConsumptionTrends(
    query: Record<string, unknown>,
    allReadings: any[],
    meterDtos: any[],
    meterById: Map<string, any>,
    matchesApartmentScope: (apartment: any) => boolean,
    includeInactiveMeters: boolean,
    meterTypeFilter: string | null,
    sourceFilter: string | null,
  ) {
    const toMonth = this.normalizePeriodMonth(query.toMonth || query.periodMonth);
    const interval = Math.max(1, Math.min(12, Math.trunc(Number(query.interval || 6)) || 6));
    const fromMonth = query.fromMonth ? this.normalizePeriodMonth(query.fromMonth) : this.addMonthsToPeriod(toMonth, -(interval - 1));
    const months = this.monthRange(fromMonth, toMonth);
    const activeMeterIds = new Set(
      meterDtos
        .filter((meter) => matchesApartmentScope(meter.apartment))
        .filter((meter) => includeInactiveMeters || meter.status === 'ACTIVE')
        .filter((meter) => !meterTypeFilter || meter.rawType === meterTypeFilter || meter.type === meterTypeFilter)
        .map((meter) => meter.id),
    );

    const items = months.map((month) => {
      const consumptionByType = this.blankConsumptionByType();
      const approved = allReadings.filter((reading) => {
        if (reading.periodMonth !== month || reading.status !== 'APPROVED') return false;
        if (!activeMeterIds.has(reading.meterId)) return false;
        if (sourceFilter && reading.source !== sourceFilter) return false;
        return this.validConsumption(reading.consumptionValue);
      });
      for (const reading of approved) {
        const meter = meterById.get(reading.meterId);
        const type = this.externalType(reading.meter?.rawType || reading.meter?.type || meter?.rawType || meter?.type);
        consumptionByType[type] = this.addConsumption(consumptionByType[type], Number(reading.consumptionValue), reading.unit || this.defaultUnit(type));
      }
      return {
        periodMonth: month,
        consumptionByType,
        approvedReadings: approved.length,
      };
    });
    return { fromMonth, toMonth, items };
  }

  private buildTopConsumption(
    periodMonth: string,
    currentReadings: any[],
    previousReadings: any[],
    contacts: Map<string, any>,
    query: Record<string, unknown>,
  ) {
    const meterTypeFilter = this.reportMeterTypeFilter(query.meterType || query.type);
    const grouped = new Map<string, any>();
    const previousGrouped = new Map<string, number>();
    const readingMatchesType = (reading: any) => {
      if (!meterTypeFilter) return true;
      return reading.meter?.rawType === meterTypeFilter || reading.meter?.type === meterTypeFilter;
    };
    for (const reading of previousReadings.filter(readingMatchesType)) {
      if (!this.validConsumption(reading.consumptionValue)) continue;
      previousGrouped.set(reading.apartmentId, this.roundMoney(Number(previousGrouped.get(reading.apartmentId) || 0) + Number(reading.consumptionValue)));
    }
    for (const reading of currentReadings.filter(readingMatchesType)) {
      if (!this.validConsumption(reading.consumptionValue)) continue;
      const existing = grouped.get(reading.apartmentId) || {
        apartment: reading.apartment,
        primaryContact: contacts.get(reading.apartmentId) || null,
        consumption: 0,
        consumptionByType: this.blankConsumptionByType(),
        unit: meterTypeFilter ? reading.unit || this.defaultUnit(meterTypeFilter) : 'unități',
        readingsCount: 0,
      };
      const type = this.externalType(reading.meter?.rawType || reading.meter?.type);
      existing.consumption = this.roundMoney(existing.consumption + Number(reading.consumptionValue));
      existing.consumptionByType[type] = this.addConsumption(existing.consumptionByType[type], Number(reading.consumptionValue), reading.unit || this.defaultUnit(type));
      existing.readingsCount += 1;
      grouped.set(reading.apartmentId, existing);
    }
    const limit = Math.max(1, Math.min(50, Math.trunc(Number(query.topLimit || query.limit || 10)) || 10));
    const items = Array.from(grouped.entries())
      .map(([apartmentId, item]) => ({
        apartmentId,
        apartment: item.apartment,
        primaryContact: item.primaryContact,
        meterType: meterTypeFilter ? this.externalType(meterTypeFilter) : 'ALL',
        consumption: item.consumption,
        consumptionByType: item.consumptionByType,
        unit: item.unit,
        previousConsumption: previousGrouped.get(apartmentId) ?? null,
        differenceFromPreviousMonth:
          previousGrouped.get(apartmentId) !== undefined ? this.roundMoney(item.consumption - Number(previousGrouped.get(apartmentId))) : null,
        periodMonth,
        readingsCount: item.readingsCount,
        actionUrl: `/admin/meter-readings?apartmentId=${apartmentId}&periodMonth=${periodMonth}`,
      }))
      .sort((a, b) => b.consumption - a.consumption)
      .slice(0, limit);
    return { items };
  }

  private addMonthsToPeriod(periodMonth: string, delta: number) {
    const date = this.dateFromPeriodMonth(periodMonth);
    date.setUTCMonth(date.getUTCMonth() + delta);
    return this.periodMonth(date);
  }

  private monthRange(fromMonth: string, toMonth: string) {
    const months: string[] = [];
    let cursor = fromMonth;
    while (cursor <= toMonth && months.length <= 24) {
      months.push(cursor);
      cursor = this.addMonthsToPeriod(cursor, 1);
    }
    return months;
  }

  private async requireAdminMeter(user: MvpUser, id: string) {
    const meter = await this.prisma.meter.findFirst({
      where: {
        ...this.organizationWhere(user),
        OR: [{ id }, { serialNumber: id }],
      },
      select: this.meterSelect(),
    });
    if (!meter) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return meter;
  }

  private async requireAdminReading(user: MvpUser, id: string) {
    const reading = await this.prisma.meterReading.findFirst({
      where: {
        id,
        ...this.organizationWhere(user),
      },
      select: this.readingSelect(),
    });
    if (!reading) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return reading;
  }

  private async requireAdminApartment(user: MvpUser, apartmentId: string) {
    const apartment = await this.prisma.apartment.findFirst({
      where: {
        id: apartmentId,
        ...this.organizationWhere(user),
      },
      select: { id: true },
    });
    if (!apartment) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return apartment;
  }

  private async getResidentScope(user: MvpUser) {
    const profiles = await this.prisma.residentProfile.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        apartment: {
          select: {
            id: true,
            organizationId: true,
            number: true,
            floor: true,
            areaM2: true,
            staircase: { select: { id: true, name: true } },
            building: { select: { id: true, name: true, address: true } },
          },
        },
        apartmentResidents: {
          select: {
            apartment: {
              select: {
                id: true,
                organizationId: true,
                number: true,
                floor: true,
                areaM2: true,
                staircase: { select: { id: true, name: true } },
                building: { select: { id: true, name: true, address: true } },
              },
            },
          },
        },
      },
    });

    const apartmentIds = new Set<string>();
    const residentByApartmentId = new Map<string, any>();
    for (const profile of profiles as any[]) {
      if (profile.apartment?.id) {
        apartmentIds.add(profile.apartment.id);
        residentByApartmentId.set(profile.apartment.id, profile);
      }
      for (const relation of profile.apartmentResidents || []) {
        if (relation.apartment?.id) {
          apartmentIds.add(relation.apartment.id);
          residentByApartmentId.set(relation.apartment.id, profile);
        }
      }
    }

    return {
      residentProfiles: profiles as any[],
      apartmentIds: Array.from(apartmentIds),
      residentByApartmentId,
    };
  }

  private async requireResidentScope(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    if (!scope.apartmentIds.length) {
      throw new ForbiddenException('Nu ai un apartament asociat contului.');
    }
    return scope;
  }

  private residentApartmentFilter(apartmentIds: string[], apartmentId: unknown) {
    const selected = this.optionalString(apartmentId);
    if (!selected) return apartmentIds;
    if (!apartmentIds.includes(selected)) {
      throw new ForbiddenException('Nu ai acces la acest apartament.');
    }
    return [selected];
  }

  private async residentMapFromReadingMetadata(organizationId: string, store: MeterWorkflowMetadata, rows: any[]) {
    const residentIds = Array.from(
      new Set(
        rows
          .map((row) => this.readingMetadata(store, row).residentId)
          .filter((value): value is string => typeof value === 'string' && Boolean(value)),
      ),
    );
    if (!residentIds.length) return new Map<string, any>();
    const residents = await this.prisma.residentProfile.findMany({
      where: {
        id: { in: residentIds },
        organizationId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
      },
    });
    return new Map(residents.map((resident) => [resident.id, resident]));
  }

  private async listMeterHistory(meterId: string, organizationId: string, store: MeterWorkflowMetadata) {
    const rows = await this.prisma.meterReading.findMany({
      where: { meterId, organizationId },
      orderBy: [{ readingDate: 'desc' }, { createdAt: 'desc' }],
      select: this.readingSelect(),
    });
    return rows.map((row) => this.toReading(row, store));
  }

  private async assertNoApprovedReadingForPeriod(
    meterId: string,
    organizationId: string,
    periodMonth: string,
    store: MeterWorkflowMetadata,
    excludeReadingId?: string,
  ) {
    const rows = await this.periodReadings(meterId, organizationId, periodMonth);
    const approved = rows.find((row) => {
      if (excludeReadingId && row.id === excludeReadingId) return false;
      return this.readingMetadata(store, row).status === 'APPROVED';
    });
    if (approved) throw new ConflictException('Există deja un indice aprobat pentru această perioadă.');
  }

  private async assertNoOpenReadingForPeriod(
    meterId: string,
    organizationId: string,
    periodMonth: string,
    store: MeterWorkflowMetadata,
    statuses: ReadingStatus[],
  ) {
    const rows = await this.periodReadings(meterId, organizationId, periodMonth);
    const open = rows.find((row) => statuses.includes(this.readingMetadata(store, row).status));
    if (open) throw new ConflictException('Există deja un indice în lucru pentru această perioadă.');
  }

  private async periodReadings(meterId: string, organizationId: string, periodMonth: string) {
    const start = this.dateFromPeriodMonth(periodMonth);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return this.prisma.meterReading.findMany({
      where: {
        meterId,
        organizationId,
        readingDate: {
          gte: start,
          lt: end,
        },
      },
      select: this.readingSelect(),
    });
  }

  private async findPreviousApprovedReading(
    meterId: string,
    organizationId: string,
    periodMonth: string,
    store: MeterWorkflowMetadata,
    excludeReadingId?: string,
  ) {
    const start = this.dateFromPeriodMonth(periodMonth);
    const rows = await this.prisma.meterReading.findMany({
      where: {
        meterId,
        organizationId,
        readingDate: { lt: start },
      },
      orderBy: [{ readingDate: 'desc' }, { createdAt: 'desc' }],
      select: this.readingSelect(),
    });
    const row = rows.find((reading) => reading.id !== excludeReadingId && this.readingMetadata(store, reading).status === 'APPROVED');
    if (!row) return null;
    return {
      id: row.id,
      readingValue: Number(row.value || 0),
      periodMonth: this.readingMetadata(store, row).periodMonth,
    };
  }

  private async notifyResidentForReading(row: any, store: MeterWorkflowMetadata, input: { title: string; message: string; link: string }) {
    const meta = this.readingMetadata(store, row);
    if (meta.residentId) {
      await this.activity.notifyResidentProfile({
        organizationId: row.organizationId,
        residentId: meta.residentId,
        type: NotificationType.SYSTEM,
        title: input.title,
        message: input.message,
        link: input.link,
      });
      return;
    }
    if (meta.submittedByUserId) {
      await this.activity.createNotification({
        organizationId: row.organizationId,
        userId: meta.submittedByUserId,
        type: NotificationType.SYSTEM,
        title: input.title,
        message: input.message,
        link: input.link,
      });
    }
  }

  private matchesMeterFilters(meter: any, query: Record<string, unknown>) {
    const apartmentId = this.optionalString(query.apartmentId);
    const apartmentNumber = this.optionalString(query.apartmentNumber)?.toLowerCase();
    const staircase = this.optionalString(query.staircase)?.toLowerCase();
    const type = this.optionalString(query.type || query.meterType)?.toUpperCase();
    const status = this.optionalString(query.status)?.toUpperCase();
    const search = this.optionalString(query.search)?.toLowerCase();
    if (apartmentId && meter.apartmentId !== apartmentId) return false;
    if (apartmentNumber && !String(meter.apartment?.apartmentNumber || '').toLowerCase().includes(apartmentNumber)) return false;
    if (staircase && !String(meter.apartment?.staircase || '').toLowerCase().includes(staircase)) return false;
    if (type && meter.type !== type && meter.rawType !== type) return false;
    if (status && meter.status !== status) return false;
    if (search) {
      const haystack = [
        meter.meterNumber,
        meter.label,
        meter.apartment?.apartmentNumber,
        meter.apartment?.staircase,
        meter.typeLabel,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  }

  private matchesReadingFilters(item: any, query: Record<string, unknown>) {
    const periodMonth = this.optionalString(query.periodMonth);
    const status = this.optionalString(query.status)?.toUpperCase();
    const meterId = this.optionalString(query.meterId);
    const meterType = this.optionalString(query.meterType || query.type)?.toUpperCase();
    const apartmentId = this.optionalString(query.apartmentId);
    const apartmentNumber = this.optionalString(query.apartmentNumber)?.toLowerCase();
    const staircase = this.optionalString(query.staircase)?.toLowerCase();
    const source = this.optionalString(query.source)?.toUpperCase();
    const search = this.optionalString(query.search)?.toLowerCase();
    if (periodMonth && item.periodMonth !== periodMonth) return false;
    if (status && item.status !== status) return false;
    if (meterId && item.meterId !== meterId) return false;
    if (meterType && item.meter?.type !== meterType && item.meter?.rawType !== meterType) return false;
    if (apartmentId && item.apartmentId !== apartmentId) return false;
    if (apartmentNumber && !String(item.apartment?.apartmentNumber || '').toLowerCase().includes(apartmentNumber)) return false;
    if (staircase && !String(item.apartment?.staircase || '').toLowerCase().includes(staircase)) return false;
    if (source && item.source !== source) return false;
    if (search) {
      const haystack = [
        item.meter?.meterNumber,
        item.apartment?.apartmentNumber,
        item.apartment?.staircase,
        item.resident?.fullName,
        item.resident?.phone,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  }

  private sortReadings(items: any[], query: Record<string, unknown>) {
    const sortBy = this.optionalString(query.sortBy) || 'newest';
    const direction = this.optionalString(query.sortDirection) === 'asc' ? 1 : -1;
    const statusWeight: Record<string, number> = { NEEDS_REVIEW: 5, SUBMITTED: 4, REJECTED: 3, APPROVED: 2, CANCELLED: 1 };
    return [...items].sort((a, b) => {
      if (sortBy === 'apartment') {
        return String(a.apartment?.apartmentNumber || '').localeCompare(String(b.apartment?.apartmentNumber || ''), 'ro', {
          numeric: true,
        }) * (direction === -1 ? -1 : 1);
      }
      if (sortBy === 'meterType') return String(a.meter?.type || '').localeCompare(String(b.meter?.type || '')) * direction;
      if (sortBy === 'status') return ((statusWeight[b.status] || 0) - (statusWeight[a.status] || 0)) * (direction === -1 ? 1 : -1);
      if (sortBy === 'consumption') return (Number(a.consumptionValue || 0) - Number(b.consumptionValue || 0)) * direction;
      return (new Date(a.submittedAt || a.createdAt).getTime() - new Date(b.submittedAt || b.createdAt).getTime()) * direction;
    });
  }

  private readingStats(items: any[]) {
    const currentMonth = this.currentPeriodMonth();
    const sumConsumption = (type: string) =>
      this.roundMoney(
        items
          .filter((item) => (item.meter?.type === type || item.meter?.rawType === type) && item.status === 'APPROVED')
          .reduce((sum, item) => sum + Number(item.consumptionValue || 0), 0),
      );
    return {
      submitted: items.filter((item) => item.status === 'SUBMITTED').length,
      approved: items.filter((item) => item.status === 'APPROVED').length,
      rejected: items.filter((item) => item.status === 'REJECTED').length,
      needsReview: items.filter((item) => item.status === 'NEEDS_REVIEW').length,
      currentMonth: items.filter((item) => item.periodMonth === currentMonth).length,
      coldWaterConsumption: sumConsumption('COLD_WATER'),
      hotWaterConsumption: sumConsumption('HOT_WATER'),
    };
  }

  private paginate<T>(items: T[], query: Record<string, unknown> = {}) {
    const page = Math.max(1, Math.trunc(Number(query.page || 1)) || 1);
    const limit = Math.min(100, Math.max(1, Math.trunc(Number(query.limit || 20)) || 20));
    const start = (page - 1) * limit;
    return {
      items: items.slice(start, start + limit),
      meta: {
        page,
        limit,
        total: items.length,
      },
    };
  }

  private parseCreateMeterBody(body: unknown, user: MvpUser) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.isSuperadmin(user)
      ? this.optionalString(payload.organizationId) || user.organizationId
      : user.organizationId;
    const apartmentId = this.requiredString(payload.apartmentId, 'Apartamentul este obligatoriu.');
    const type = this.normalizeMeterType(payload.type);
    const serialNumber = this.optionalString(payload.meterNumber) ?? this.optionalString(payload.serialNumber) ?? null;
    const mapped = this.normalizeMeterStatus(this.optionalString(payload.status) || 'ACTIVE');
    if (!organizationId) throw new BadRequestException('Organizația este obligatorie.');
    return {
      organizationId,
      apartmentId,
      type,
      serialNumber,
      status: mapped.status,
      statusAlias: mapped.statusAlias,
      label: this.optionalString(payload.label) ?? null,
      unit: this.optionalString(payload.unit) ?? this.defaultUnit(type),
      location: this.optionalString(payload.location) ?? null,
      notes: this.optionalString(payload.notes) ?? null,
      installedAt: this.optionalDateString(payload.installedAt),
    };
  }

  private parseUpdateMeterBody(body: unknown, organizationId: string) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const mapped = payload.status !== undefined ? this.normalizeMeterStatus(this.optionalString(payload.status) || 'ACTIVE') : null;
    return {
      organizationId,
      apartmentId: this.optionalString(payload.apartmentId),
      type: payload.type !== undefined ? this.normalizeMeterType(payload.type) : undefined,
      serialNumber:
        payload.meterNumber !== undefined || payload.serialNumber !== undefined
          ? this.optionalString(payload.meterNumber) ?? this.optionalString(payload.serialNumber) ?? null
          : undefined,
      status: mapped?.status,
      statusAlias: mapped?.statusAlias,
      label: payload.label !== undefined ? this.optionalString(payload.label) ?? null : undefined,
      unit: payload.unit !== undefined ? this.optionalString(payload.unit) ?? null : undefined,
      location: payload.location !== undefined ? this.optionalString(payload.location) ?? null : undefined,
      notes: payload.notes !== undefined ? this.optionalString(payload.notes) ?? null : undefined,
      installedAt: payload.installedAt !== undefined ? this.optionalDateString(payload.installedAt) : undefined,
      replacedAt: payload.replacedAt !== undefined ? this.optionalDateString(payload.replacedAt) : undefined,
    };
  }

  private parseReadingBody(body: unknown, options: { defaultSource: ReadingSource; allowStatus: boolean }) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const rawValue = payload.readingValue ?? payload.value;
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      throw new BadRequestException('Valoarea indicelui este obligatorie.');
    }
    const readingValue = this.requiredNumber(rawValue, 'Valoarea indicelui trebuie să fie numerică.');
    if (readingValue < 0) throw new BadRequestException('Valoarea indicelui trebuie să fie pozitivă sau zero.');
    const periodMonth = this.normalizePeriodMonth(payload.periodMonth);
    const status = options.allowStatus ? this.normalizeReadingStatusValue(payload.status) : null;
    return {
      readingValue,
      periodMonth,
      status,
      source: this.optionalString(payload.source)?.toUpperCase() as ReadingSource | undefined ?? options.defaultSource,
      unit: this.optionalString(payload.unit) ?? null,
      adminComment: this.optionalString(payload.adminComment) ?? null,
      residentComment: this.optionalString(payload.residentComment) ?? this.optionalString(payload.comment) ?? null,
      photoUrl: this.optionalString(payload.photoUrl) ?? null,
    };
  }

  private normalizeMeterType(value: unknown): MeterType {
    const normalized = this.requiredString(value, 'Tipul contorului este obligatoriu.').toUpperCase();
    const mapped = normalized === 'HEAT' ? 'HEATING' : normalized;
    if (mapped === 'OTHER') {
      throw new BadRequestException('Tipul OTHER va fi disponibil după extinderea schemei de contoare.');
    }
    const allowed = Object.values(MeterType) as string[];
    if (!allowed.includes(mapped)) throw new BadRequestException('Tipul contorului nu este valid.');
    return mapped as MeterType;
  }

  private normalizeMeterStatus(value: unknown): { status: MeterStatus; statusAlias: MeterMetadata['statusAlias'] } {
    const normalized = this.requiredString(value, 'Statusul contorului este obligatoriu.').toUpperCase();
    if (normalized === 'REPLACED' || normalized === 'ARCHIVED') {
      return { status: MeterStatus.INACTIVE, statusAlias: normalized };
    }
    if (normalized === 'ACTIVE') return { status: MeterStatus.ACTIVE, statusAlias: 'ACTIVE' };
    if (normalized === 'INACTIVE') return { status: MeterStatus.INACTIVE, statusAlias: 'INACTIVE' };
    if (normalized === 'MISSING_READING') return { status: MeterStatus.MISSING_READING, statusAlias: null };
    if (normalized === 'SUSPICIOUS') return { status: MeterStatus.SUSPICIOUS, statusAlias: null };
    throw new BadRequestException('Statusul contorului nu este valid.');
  }

  private normalizePeriodMonth(value: unknown) {
    const raw = this.optionalString(value) || this.currentPeriodMonth();
    if (!/^\d{4}-\d{2}$/.test(raw)) {
      throw new BadRequestException('Perioada trebuie să fie în format YYYY-MM.');
    }
    const month = Number(raw.slice(5, 7));
    if (month < 1 || month > 12) {
      throw new BadRequestException('Perioada trebuie să fie în format YYYY-MM.');
    }
    return raw;
  }

  private currentPeriodMonth() {
    return this.periodMonth(new Date());
  }

  private periodMonth(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private dateFromPeriodMonth(periodMonth: string) {
    return new Date(`${periodMonth}-01T12:00:00.000Z`);
  }

  private optionalDateString(value: unknown) {
    const raw = this.optionalString(value);
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Data nu este validă.');
    return date.toISOString();
  }

  private requiredNumber(value: unknown, message: string) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException(message);
    return parsed;
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(message);
    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private roundMoney(value: number) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  private fullName(profile: any) {
    return [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() || profile?.email || 'Locatar';
  }
}
