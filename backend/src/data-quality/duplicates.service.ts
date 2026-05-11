import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApartmentResidentRole,
  DataQualityBillingImpact,
  DataQualityCategory,
  DataQualityEntityType,
  DataQualityIssueStatus,
  DataQualitySeverity,
  DuplicateConfidence,
  DuplicateEntityType,
  DuplicateGroupStatus,
  DuplicateMergePlanStatus,
  DuplicateScanRunStatus,
  MeterStatus,
  Prisma,
  ResidentAccountStatus,
  Role,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type CandidateDraft = {
  entityId: string;
  entityType: DuplicateEntityType;
  displayName: string;
  matchReason: string;
  matchScore: number;
  snapshot: Record<string, unknown>;
};

type GroupDraft = {
  entityType: DuplicateEntityType;
  dedupeKey: string;
  confidence: DuplicateConfidence;
  reason: string;
  score: number;
  candidates: CandidateDraft[];
  metadata?: Record<string, unknown>;
};

const METER_WORKFLOW_METADATA_NOTE_TITLE = 'ESPACE_METER_WORKFLOW_METADATA_V1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function fullName(row?: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null } | null) {
  const name = [row?.firstName, row?.lastName].filter(Boolean).join(' ').trim();
  return name || row?.email || row?.phone || 'Fără nume';
}

function normalizeText(value: unknown) {
  return optionalString(value).toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(value: unknown) {
  return optionalString(value).replace(/[\s().-]/g, '');
}

function normalizeEmail(value: unknown) {
  return optionalString(value).toLowerCase();
}

function normalizeApartmentNumber(value: unknown) {
  return normalizeText(value).replace(/^ap\.?\s*/i, '').replace(/^apartament\s*/i, '').trim();
}

function monthFromDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function confidenceLabel(confidence: DuplicateConfidence) {
  if (confidence === DuplicateConfidence.HIGH) return 'Încredere mare';
  if (confidence === DuplicateConfidence.MEDIUM) return 'Încredere medie';
  return 'Încredere mică';
}

function parseEntityType(value: unknown): DuplicateEntityType | null {
  const raw = optionalString(value).toUpperCase();
  if (raw === 'RESIDENT') return DuplicateEntityType.RESIDENT;
  if (raw === 'APARTMENT') return DuplicateEntityType.APARTMENT;
  if (raw === 'METER') return DuplicateEntityType.METER;
  if (raw === 'TARIFF') return DuplicateEntityType.TARIFF;
  return null;
}

function sortedKey(entityType: DuplicateEntityType, ids: string[]) {
  return `${entityType}:${[...ids].sort().join('|')}`;
}

@Injectable()
export class DuplicateDetectionService {
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
      select: { id: true, name: true, legalName: true, fiscalCode: true },
    });
    if (!organization) throw new NotFoundException('Asociația nu a fost găsită.');
    return {
      id: organization.id,
      shortName: organization.name || organization.legalName || 'A.P.C.',
      legalName: organization.legalName || organization.name || 'Asociație',
      associationCode: organization.fiscalCode || '',
    };
  }

  private async readMeterMetadata(associationId: string) {
    const note = await this.prisma.clientNote.findFirst({
      where: { organizationId: associationId, title: METER_WORKFLOW_METADATA_NOTE_TITLE },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return { meters: {}, readings: {} } as { meters: Record<string, any>; readings: Record<string, any> };
    try {
      const parsed = JSON.parse(note.content);
      return {
        meters: isRecord(parsed?.meters) ? parsed.meters as Record<string, any> : {},
        readings: isRecord(parsed?.readings) ? parsed.readings as Record<string, any> : {},
      };
    } catch {
      return { meters: {}, readings: {} } as { meters: Record<string, any>; readings: Record<string, any> };
    }
  }

  private async writeMeterMetadata(associationId: string, actorUserId: string, store: { meters: Record<string, any>; readings: Record<string, any> }, client: any) {
    const existing = await client.clientNote.findFirst({
      where: { organizationId: associationId, title: METER_WORKFLOW_METADATA_NOTE_TITLE },
      select: { id: true },
    });
    const content = JSON.stringify({ version: 1, meters: store.meters || {}, readings: store.readings || {} });
    if (existing) {
      await client.clientNote.update({ where: { id: existing.id }, data: { content } });
    } else {
      await client.clientNote.create({
        data: { organizationId: associationId, createdByUserId: actorUserId, title: METER_WORKFLOW_METADATA_NOTE_TITLE, content },
      });
    }
  }

  async overview(user: MvpUser, query: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    const association = await this.organizationHeader(associationId);
    const [summary, topGroups] = await Promise.all([
      this.stats(user, activeOrganizationId),
      this.prisma.duplicateGroup.findMany({
        where: { associationId, ...(optionalString(query.entityType) ? { entityType: optionalString(query.entityType) as DuplicateEntityType } : {}) },
        orderBy: [{ status: 'asc' }, { confidence: 'asc' }, { score: 'desc' }, { createdAt: 'desc' }],
        include: { candidates: true },
        take: 10,
      }),
    ]);
    return {
      association,
      summary,
      topGroups: topGroups.map((group) => this.serializeGroup(group)),
    };
  }

  async stats(user: MvpUser, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    const [statusRows, entityRows, confidenceRows, lastScan, mergeCount] = await Promise.all([
      this.prisma.duplicateGroup.groupBy({ by: ['status'], where: { associationId }, _count: { _all: true } }),
      this.prisma.duplicateGroup.groupBy({ by: ['entityType'], where: { associationId, status: DuplicateGroupStatus.OPEN }, _count: { _all: true } }),
      this.prisma.duplicateGroup.groupBy({ by: ['confidence'], where: { associationId, status: DuplicateGroupStatus.OPEN }, _count: { _all: true } }),
      this.prisma.duplicateScanRun.findFirst({ where: { associationId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.duplicateMergePlan.count({ where: { associationId, status: DuplicateMergePlanStatus.APPLIED } }),
    ]);
    const countStatus = (status: DuplicateGroupStatus) => statusRows.find((row) => row.status === status)?._count._all || 0;
    const countEntity = (entityType: DuplicateEntityType) => entityRows.find((row) => row.entityType === entityType)?._count._all || 0;
    const countConfidence = (confidence: DuplicateConfidence) => confidenceRows.find((row) => row.confidence === confidence)?._count._all || 0;
    return {
      openGroups: countStatus(DuplicateGroupStatus.OPEN),
      residentGroups: countEntity(DuplicateEntityType.RESIDENT),
      apartmentGroups: countEntity(DuplicateEntityType.APARTMENT),
      meterGroups: countEntity(DuplicateEntityType.METER),
      highConfidence: countConfidence(DuplicateConfidence.HIGH),
      mediumConfidence: countConfidence(DuplicateConfidence.MEDIUM),
      lowConfidence: countConfidence(DuplicateConfidence.LOW),
      reviewedGroups: countStatus(DuplicateGroupStatus.REVIEWED),
      ignoredGroups: countStatus(DuplicateGroupStatus.IGNORED),
      notDuplicateGroups: countStatus(DuplicateGroupStatus.NOT_DUPLICATE),
      mergedGroups: countStatus(DuplicateGroupStatus.MERGED),
      mergePlansApplied: mergeCount,
      lastScanAt: lastScan?.completedAt?.toISOString?.() || lastScan?.createdAt?.toISOString?.() || null,
    };
  }

  async listGroups(user: MvpUser, query: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    const { page, limit, skip } = resolvePagination(query);
    const where: Prisma.DuplicateGroupWhereInput = {
      associationId,
      ...(parseEntityType(query.entityType) ? { entityType: parseEntityType(query.entityType)! } : {}),
      ...(optionalString(query.confidence) ? { confidence: optionalString(query.confidence) as DuplicateConfidence } : {}),
      ...(optionalString(query.status) ? { status: optionalString(query.status) as DuplicateGroupStatus } : {}),
      ...(optionalString(query.reason) ? { reason: { contains: optionalString(query.reason), mode: 'insensitive' } } : {}),
      ...(optionalString(query.scanRunId) ? { scanRunId: optionalString(query.scanRunId) } : {}),
    };
    const search = optionalString(query.search);
    if (search) {
      where.OR = [
        { reason: { contains: search, mode: 'insensitive' } },
        { dedupeKey: { contains: search, mode: 'insensitive' } },
        { candidates: { some: { displayName: { contains: search, mode: 'insensitive' } } } },
        { candidates: { some: { entityId: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.duplicateGroup.findMany({
        where,
        include: { candidates: true },
        orderBy: this.groupOrderBy(query),
        skip,
        take: limit,
      }),
      this.prisma.duplicateGroup.count({ where }),
    ]);
    return { items: items.map((group) => this.serializeGroup(group)), meta: buildPaginationMeta(page, limit, total), stats: await this.stats(user, activeOrganizationId) };
  }

  private groupOrderBy(query: Record<string, unknown>): Prisma.DuplicateGroupOrderByWithRelationInput[] {
    const sortBy = optionalString(query.sortBy);
    const direction = optionalString(query.sortDirection).toLowerCase() === 'asc' ? 'asc' : 'desc';
    if (sortBy === 'oldest') return [{ createdAt: 'asc' }];
    if (sortBy === 'score') return [{ score: 'desc' }, { createdAt: 'desc' }];
    if (sortBy === 'entityType') return [{ entityType: 'asc' }, { createdAt: 'desc' }];
    return [{ confidence: 'asc' }, { score: 'desc' }, { createdAt: direction }];
  }

  async scan(user: MvpUser, body: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId, actorUserId } = this.assertAdmin(user, activeOrganizationId);
    const requested = Array.isArray(body.entityTypes) ? body.entityTypes.map(parseEntityType).filter(Boolean) as DuplicateEntityType[] : [];
    const entityTypes = requested.length ? requested : [DuplicateEntityType.RESIDENT, DuplicateEntityType.APARTMENT, DuplicateEntityType.METER];
    const run = await this.prisma.duplicateScanRun.create({
      data: { associationId, actorUserId, status: DuplicateScanRunStatus.RUNNING },
    });
    try {
      const drafts: GroupDraft[] = [];
      if (entityTypes.includes(DuplicateEntityType.RESIDENT)) drafts.push(...await this.detectResidentDuplicates(associationId));
      if (entityTypes.includes(DuplicateEntityType.APARTMENT)) drafts.push(...await this.detectApartmentDuplicates(associationId));
      if (entityTypes.includes(DuplicateEntityType.METER)) drafts.push(...await this.detectMeterDuplicates(associationId));

      const seen = new Set<string>();
      const uniqueDrafts = drafts.filter((draft) => {
        const key = `${draft.entityType}:${draft.dedupeKey}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return draft.candidates.length > 1;
      });
      const groups = [];
      for (const draft of uniqueDrafts) groups.push(await this.persistGroup(associationId, actorUserId, run.id, draft));

      const residentsGroupsFound = groups.filter((group) => group.entityType === DuplicateEntityType.RESIDENT).length;
      const apartmentsGroupsFound = groups.filter((group) => group.entityType === DuplicateEntityType.APARTMENT).length;
      const metersGroupsFound = groups.filter((group) => group.entityType === DuplicateEntityType.METER).length;
      await this.prisma.duplicateScanRun.update({
        where: { id: run.id },
        data: {
          status: DuplicateScanRunStatus.COMPLETED,
          residentsGroupsFound,
          apartmentsGroupsFound,
          metersGroupsFound,
          totalGroupsFound: groups.length,
          completedAt: new Date(),
        },
      });
      await this.audit.createLog({
        associationId,
        actorUserId,
        actorRole: 'ADMIN',
        action: 'DUPLICATE_SCAN_RUN',
        entityType: 'SYSTEM',
        entityId: run.id,
        title: 'Detectare duplicate rulată',
        message: `Detectarea duplicatelor a găsit ${groups.length} grupuri.`,
        severity: groups.length ? 'WARNING' : 'SUCCESS',
        metadata: { entityTypes, residentsGroupsFound, apartmentsGroupsFound, metersGroupsFound, totalGroupsFound: groups.length },
        actionUrl: '/admin/data-quality/duplicates',
      }).catch(() => null);
      return { run: { id: run.id, status: DuplicateScanRunStatus.COMPLETED }, summary: await this.stats(user, activeOrganizationId), groups: groups.map((group) => this.serializeGroup(group)) };
    } catch (error) {
      await this.prisma.duplicateScanRun.update({ where: { id: run.id }, data: { status: DuplicateScanRunStatus.FAILED, completedAt: new Date() } }).catch(() => null);
      throw error;
    }
  }

  private async detectResidentDuplicates(associationId: string): Promise<GroupDraft[]> {
    const residents = await this.prisma.residentProfile.findMany({
      where: { organizationId: associationId },
      include: {
        apartment: { select: { id: true, number: true } },
        apartmentResidents: {
          include: { apartment: { select: { id: true, number: true, staircase: { select: { name: true } } } } },
        },
        _count: { select: { issues: true, messageThreads: true, ownedApartments: true } },
      },
    });
    const by = new Map<string, { reason: string; confidence: DuplicateConfidence; score: number; rows: typeof residents }>();
    const add = (key: string, reason: string, confidence: DuplicateConfidence, score: number, row: typeof residents[number]) => {
      if (!key) return;
      const current = by.get(key) || { reason, confidence, score, rows: [] as typeof residents };
      current.rows.push(row);
      by.set(key, current);
    };
    residents.forEach((row) => {
      const name = normalizeText(fullName(row));
      const email = normalizeEmail(row.email);
      const phone = normalizePhone(row.phone);
      const apartmentIds = new Set<string>([row.apartmentId || '', ...row.apartmentResidents.map((item) => item.apartmentId)].filter(Boolean));
      add(email ? `email:${email}` : '', 'Același email', DuplicateConfidence.HIGH, 98, row);
      add(phone ? `phone:${phone}` : '', 'Același telefon', DuplicateConfidence.HIGH, 95, row);
      add(name && phone ? `name_phone:${name}:${phone}` : '', 'Nume identic și același telefon', DuplicateConfidence.MEDIUM, 88, row);
      apartmentIds.forEach((apartmentId) => add(name && apartmentId ? `name_apartment:${name}:${apartmentId}` : '', 'Nume identic și același apartament', DuplicateConfidence.MEDIUM, 84, row));
    });
    return [...by.values()]
      .filter((group) => new Set(group.rows.map((row) => row.id)).size > 1)
      .map((group) => {
        const rows = this.uniqueById(group.rows);
        return {
          entityType: DuplicateEntityType.RESIDENT,
          dedupeKey: sortedKey(DuplicateEntityType.RESIDENT, rows.map((row) => row.id)),
          confidence: group.confidence,
          reason: group.reason,
          score: group.score,
          candidates: rows.map((row) => ({
            entityId: row.id,
            entityType: DuplicateEntityType.RESIDENT,
            displayName: fullName(row),
            matchReason: group.reason,
            matchScore: group.score,
            snapshot: {
              fullName: fullName(row),
              phone: row.phone || '',
              email: row.email || '',
              status: row.accountStatus,
              apartments: [
                row.apartment?.number,
                ...row.apartmentResidents.map((item) => item.apartment?.number),
              ].filter(Boolean),
              roles: row.apartmentResidents.map((item) => item.role),
              isPrimaryContactSomewhere: row.apartmentResidents.some((item) => item.isPrimary) || row.isPrimary,
              issuesCount: row._count.issues,
              requestsCount: row._count.issues,
              messageThreadsCount: row._count.messageThreads,
            },
          })),
          metadata: { rule: group.reason },
        };
      });
  }

  private async detectApartmentDuplicates(associationId: string): Promise<GroupDraft[]> {
    const apartments = await this.prisma.apartment.findMany({
      where: { organizationId: associationId },
      include: {
        building: { select: { id: true, name: true, cadastralNumber: true } },
        staircase: { select: { id: true, name: true } },
        _count: { select: { apartmentResidents: true, meters: true, residentInvoices: true, payments: true, issues: true } },
      },
    });
    const by = new Map<string, { reason: string; confidence: DuplicateConfidence; score: number; rows: typeof apartments }>();
    const add = (key: string, reason: string, confidence: DuplicateConfidence, score: number, row: typeof apartments[number]) => {
      if (!key) return;
      const current = by.get(key) || { reason, confidence, score, rows: [] as typeof apartments };
      current.rows.push(row);
      by.set(key, current);
    };
    apartments.forEach((row) => {
      const normalized = normalizeApartmentNumber(row.number);
      add(normalized ? `number:${normalized}` : '', 'Același număr de apartament în asociație', DuplicateConfidence.MEDIUM, 82, row);
      add(normalized && row.staircaseId ? `number_staircase:${normalized}:${row.staircaseId}` : '', 'Același număr și aceeași scară', DuplicateConfidence.HIGH, 96, row);
      add(row.building?.cadastralNumber ? `building_cadastral:${normalizeText(row.building.cadastralNumber)}:${normalized}` : '', 'Cadastru bloc și număr apartament similare', DuplicateConfidence.MEDIUM, 80, row);
    });
    return [...by.values()]
      .filter((group) => new Set(group.rows.map((row) => row.id)).size > 1)
      .map((group) => {
        const rows = this.uniqueById(group.rows);
        return {
          entityType: DuplicateEntityType.APARTMENT,
          dedupeKey: sortedKey(DuplicateEntityType.APARTMENT, rows.map((row) => row.id)),
          confidence: group.confidence,
          reason: group.reason,
          score: group.score,
          candidates: rows.map((row) => ({
            entityId: row.id,
            entityType: DuplicateEntityType.APARTMENT,
            displayName: `Ap. ${row.number || '-'}`,
            matchReason: group.reason,
            matchScore: group.score,
            snapshot: {
              apartmentNumber: row.number,
              normalizedApartmentNumber: normalizeApartmentNumber(row.number),
              building: row.building?.name || '',
              staircase: row.staircase?.name || '',
              floor: row.floor,
              areaM2: row.areaM2,
              cadastralNumber: row.building?.cadastralNumber || '',
              residentsCount: row._count.apartmentResidents,
              metersCount: row._count.meters,
              invoicesCount: row._count.residentInvoices,
              paymentsCount: row._count.payments,
              requestsCount: row._count.issues,
            },
          })),
          metadata: { rule: group.reason, mergeStrategy: 'MANUAL_REVIEW_ONLY' },
        };
      });
  }

  private async detectMeterDuplicates(associationId: string): Promise<GroupDraft[]> {
    const [meters, store] = await Promise.all([
      this.prisma.meter.findMany({
        where: { organizationId: associationId },
        include: {
          apartment: { select: { id: true, number: true, staircase: { select: { name: true } } } },
          readings: { orderBy: { readingDate: 'desc' }, take: 1 },
          _count: { select: { readings: true } },
        },
      }),
      this.readMeterMetadata(associationId),
    ]);
    const by = new Map<string, { reason: string; confidence: DuplicateConfidence; score: number; rows: typeof meters }>();
    const add = (key: string, reason: string, confidence: DuplicateConfidence, score: number, row: typeof meters[number]) => {
      if (!key) return;
      const current = by.get(key) || { reason, confidence, score, rows: [] as typeof meters };
      current.rows.push(row);
      by.set(key, current);
    };
    meters.forEach((row) => {
      const meta = store.meters[row.id] || {};
      const serial = normalizeText(row.serialNumber);
      const label = normalizeText(meta.label);
      const location = normalizeText(meta.location);
      add(serial ? `serial:${serial}` : '', 'Același număr de contor', DuplicateConfidence.HIGH, 98, row);
      add(serial && row.apartmentId ? `serial_apartment:${serial}:${row.apartmentId}` : '', 'Același număr de contor în același apartament', DuplicateConfidence.HIGH, 99, row);
      add(row.apartmentId && row.type && (label || location) ? `apt_type_label:${row.apartmentId}:${row.type}:${label || location}` : '', 'Același apartament, tip și etichetă/locație similară', DuplicateConfidence.MEDIUM, 82, row);
      add(!serial && row.apartmentId && row.type && location ? `apt_type_location_no_serial:${row.apartmentId}:${row.type}:${location}` : '', 'Contor fără număr, similar după tip și locație', DuplicateConfidence.LOW, 68, row);
    });
    return [...by.values()]
      .filter((group) => new Set(group.rows.map((row) => row.id)).size > 1)
      .map((group) => {
        const rows = this.uniqueById(group.rows);
        return {
          entityType: DuplicateEntityType.METER,
          dedupeKey: sortedKey(DuplicateEntityType.METER, rows.map((row) => row.id)),
          confidence: group.confidence,
          reason: group.reason,
          score: group.score,
          candidates: rows.map((row) => {
            const meta = store.meters[row.id] || {};
            const lastReading = row.readings?.[0] || null;
            return {
              entityId: row.id,
              entityType: DuplicateEntityType.METER,
              displayName: row.serialNumber || `${row.type} · Ap. ${row.apartment?.number || '-'}`,
              matchReason: group.reason,
              matchScore: group.score,
              snapshot: {
                meterNumber: row.serialNumber || '',
                type: row.type,
                apartmentNumber: row.apartment?.number || '',
                staircase: row.apartment?.staircase?.name || '',
                unit: meta.unit || '',
                label: meta.label || '',
                location: meta.location || '',
                status: meta.statusAlias || row.status,
                readingsCount: row._count.readings,
                lastReading: lastReading?.value ?? null,
                lastReadingDate: lastReading?.readingDate?.toISOString?.() || null,
              },
            };
          }),
          metadata: { rule: group.reason },
        };
      });
  }

  private uniqueById<T extends { id: string }>(rows: T[]) {
    return [...new Map(rows.map((row) => [row.id, row])).values()];
  }

  private async persistGroup(associationId: string, actorUserId: string, scanRunId: string, draft: GroupDraft) {
    const closedStatuses: DuplicateGroupStatus[] = [DuplicateGroupStatus.MERGED, DuplicateGroupStatus.IGNORED, DuplicateGroupStatus.NOT_DUPLICATE];
    const group = await this.prisma.duplicateGroup.upsert({
      where: { associationId_entityType_dedupeKey: { associationId, entityType: draft.entityType, dedupeKey: draft.dedupeKey } },
      update: {
        scanRunId,
        confidence: draft.confidence,
        reason: draft.reason,
        score: draft.score,
        metadata: draft.metadata as Prisma.InputJsonValue,
      },
      create: {
        associationId,
        scanRunId,
        dedupeKey: draft.dedupeKey,
        entityType: draft.entityType,
        status: DuplicateGroupStatus.OPEN,
        confidence: draft.confidence,
        reason: draft.reason,
        score: draft.score,
        metadata: draft.metadata as Prisma.InputJsonValue,
      },
      include: { candidates: true },
    });
    if (!closedStatuses.includes(group.status)) {
      for (const candidate of draft.candidates) {
        await this.prisma.duplicateCandidate.upsert({
          where: { groupId_entityId: { groupId: group.id, entityId: candidate.entityId } },
          update: {
            displayName: candidate.displayName,
            matchReason: candidate.matchReason,
            matchScore: candidate.matchScore,
            snapshot: candidate.snapshot as Prisma.InputJsonValue,
          },
          create: {
            groupId: group.id,
            entityId: candidate.entityId,
            entityType: candidate.entityType,
            displayName: candidate.displayName,
            matchReason: candidate.matchReason,
            matchScore: candidate.matchScore,
            snapshot: candidate.snapshot as Prisma.InputJsonValue,
          },
        });
      }
      await this.upsertDataQualityIssueForGroup(associationId, actorUserId, group.id, draft);
    }
    return this.prisma.duplicateGroup.findUniqueOrThrow({ where: { id: group.id }, include: { candidates: true } });
  }

  private async upsertDataQualityIssueForGroup(associationId: string, actorUserId: string, groupId: string, draft: GroupDraft) {
    const category =
      draft.entityType === DuplicateEntityType.RESIDENT
        ? DataQualityCategory.RESIDENTS
        : draft.entityType === DuplicateEntityType.APARTMENT
          ? DataQualityCategory.APARTMENTS
          : DataQualityCategory.METERS;
    await this.prisma.dataQualityIssue.upsert({
      where: { associationId_key: { associationId, key: `DUPLICATE_GROUP:${groupId}` } },
      update: {
        category,
        severity: draft.confidence === DuplicateConfidence.HIGH ? DataQualitySeverity.WARNING : DataQualitySeverity.INFO,
        status: DataQualityIssueStatus.OPEN,
        entityType: DataQualityEntityType.SYSTEM,
        entityId: groupId,
        title: `Duplicate ${draft.entityType.toLowerCase()} detectate`,
        description: `${draft.reason}: ${draft.candidates.length} candidați.`,
        recommendation: 'Deschide grupul și marchează merge, ignore sau not duplicate.',
        actionUrl: `/admin/data-quality/duplicates/groups/${groupId}`,
        billingImpact: draft.entityType === DuplicateEntityType.APARTMENT ? DataQualityBillingImpact.AFFECTS_BILLING : DataQualityBillingImpact.NO_BILLING_IMPACT,
        metadata: { groupId, entityType: draft.entityType, candidateIds: draft.candidates.map((item) => item.entityId) } as Prisma.InputJsonValue,
        detectedAt: new Date(),
      },
      create: {
        associationId,
        key: `DUPLICATE_GROUP:${groupId}`,
        category,
        severity: draft.confidence === DuplicateConfidence.HIGH ? DataQualitySeverity.WARNING : DataQualitySeverity.INFO,
        status: DataQualityIssueStatus.OPEN,
        entityType: DataQualityEntityType.SYSTEM,
        entityId: groupId,
        title: `Duplicate ${draft.entityType.toLowerCase()} detectate`,
        description: `${draft.reason}: ${draft.candidates.length} candidați.`,
        recommendation: 'Deschide grupul și marchează merge, ignore sau not duplicate.',
        actionUrl: `/admin/data-quality/duplicates/groups/${groupId}`,
        billingImpact: draft.entityType === DuplicateEntityType.APARTMENT ? DataQualityBillingImpact.AFFECTS_BILLING : DataQualityBillingImpact.NO_BILLING_IMPACT,
        metadata: { groupId, entityType: draft.entityType, candidateIds: draft.candidates.map((item) => item.entityId), createdBy: actorUserId } as Prisma.InputJsonValue,
      },
    });
  }

  async getGroup(user: MvpUser, id: string, activeOrganizationId?: string) {
    const { associationId } = this.assertAdmin(user, activeOrganizationId);
    const group = await this.prisma.duplicateGroup.findFirst({
      where: { id, associationId },
      include: { candidates: { orderBy: [{ isCanonical: 'desc' }, { matchScore: 'desc' }] }, mergePlans: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    if (!group) throw new NotFoundException('Grupul de duplicate nu a fost găsit.');
    return {
      group: this.serializeGroup(group),
      candidates: group.candidates.map((candidate) => this.serializeCandidate(candidate)),
      mergePlans: group.mergePlans.map((plan) => this.serializePlan(plan)),
      availableActions: {
        canMerge: group.entityType === DuplicateEntityType.RESIDENT || group.entityType === DuplicateEntityType.METER,
        canMarkNotDuplicate: group.status === DuplicateGroupStatus.OPEN || group.status === DuplicateGroupStatus.REVIEWED,
        canIgnore: group.status === DuplicateGroupStatus.OPEN || group.status === DuplicateGroupStatus.REVIEWED,
      },
      warnings: this.groupWarnings(group),
    };
  }

  private groupWarnings(group: any) {
    if (group.entityType === DuplicateEntityType.APARTMENT) {
      return ['Apartamentele nu sunt unite automat în MVP. Folosește comparația și editează manual dacă este necesar.'];
    }
    if (group.confidence === DuplicateConfidence.LOW) return ['Încredere mică: tratează grupul ca sugestie, nu ca duplicat sigur.'];
    return [];
  }

  async mergePreview(user: MvpUser, id: string, body: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId, actorUserId } = this.assertAdmin(user, activeOrganizationId);
    const group = await this.prisma.duplicateGroup.findFirst({ where: { id, associationId }, include: { candidates: true } });
    if (!group) throw new NotFoundException('Grupul de duplicate nu a fost găsit.');
    const mergeableStatuses: DuplicateGroupStatus[] = [DuplicateGroupStatus.OPEN, DuplicateGroupStatus.REVIEWED];
    if (!mergeableStatuses.includes(group.status)) throw new BadRequestException('Grupul nu mai poate fi modificat.');
    if (group.entityType === DuplicateEntityType.APARTMENT) {
      return {
        canApply: false,
        warnings: ['Merge automat indisponibil pentru apartamente în MVP.'],
        conflicts: ['Apartamentele pot avea facturi, plăți, contoare și solduri. Deschide entitățile și rezolvă manual.'],
        changes: [],
        affectedRecords: {},
      };
    }
    const canonicalEntityId = optionalString(body.canonicalEntityId);
    if (!canonicalEntityId || !group.candidates.some((candidate) => candidate.entityId === canonicalEntityId)) {
      throw new BadRequestException('Alege entitatea canonică din candidații grupului.');
    }
    const preview =
      group.entityType === DuplicateEntityType.RESIDENT
        ? await this.buildResidentMergePreview(associationId, group, canonicalEntityId, body)
        : await this.buildMeterMergePreview(associationId, group, canonicalEntityId, body);
    await this.prisma.duplicateMergePlan.updateMany({
      where: { groupId: group.id, status: DuplicateMergePlanStatus.DRAFT },
      data: { status: DuplicateMergePlanStatus.CANCELLED },
    });
    const plan = await this.prisma.duplicateMergePlan.create({
      data: {
        groupId: group.id,
        associationId,
        entityType: group.entityType,
        canonicalEntityId,
        mergeStrategy: group.entityType === DuplicateEntityType.RESIDENT ? 'RESIDENT_SAFE_MERGE' : 'METER_SAFE_MERGE',
        plan: preview as Prisma.InputJsonValue,
        warnings: preview.warnings as Prisma.InputJsonValue,
        status: DuplicateMergePlanStatus.DRAFT,
        createdById: actorUserId,
      },
    });
    await this.audit.createLog({
      associationId,
      actorUserId,
      actorRole: 'ADMIN',
      action: 'DUPLICATE_MERGE_PREVIEW_CREATED',
      entityType: 'SYSTEM',
      entityId: group.id,
      title: 'Preview merge duplicate creat',
      message: `Preview merge pentru ${group.entityType}.`,
      severity: preview.canApply ? 'INFO' : 'WARNING',
      metadata: { groupId: group.id, entityType: group.entityType, canonicalEntityId, conflicts: preview.conflicts },
      actionUrl: `/admin/data-quality/duplicates/groups/${group.id}/merge`,
    }).catch(() => null);
    return { ...preview, mergePlanId: plan.id };
  }

  private async buildResidentMergePreview(associationId: string, group: any, canonicalEntityId: string, body: Record<string, unknown>) {
    const candidateIds = group.candidates.map((candidate: any) => candidate.entityId);
    const residents = await this.prisma.residentProfile.findMany({
      where: { organizationId: associationId, id: { in: candidateIds } },
      include: { apartmentResidents: true },
    });
    const canonical = residents.find((resident) => resident.id === canonicalEntityId);
    if (!canonical) throw new NotFoundException('Locatarul canonic nu a fost găsit.');
    const byId = new Map(residents.map((resident) => [resident.id, resident]));
    const fieldSelections = isRecord(body.fieldSelections) ? body.fieldSelections : {};
    const pickResident = (field: string) => byId.get(optionalString(fieldSelections[field])) || canonical;
    const selectedName = pickResident('fullName');
    const selectedPhone = pickResident('phone');
    const selectedEmail = pickResident('email');
    const selectedStatus = pickResident('status');
    const finalName = fullName(selectedName);
    const [firstName, ...lastParts] = finalName.split(' ');
    const finalFields = {
      firstName: firstName || canonical.firstName || '',
      lastName: lastParts.join(' ') || canonical.lastName || '',
      phone: selectedPhone.phone || canonical.phone || null,
      email: selectedEmail.email || canonical.email || null,
      accountStatus: selectedStatus.accountStatus || canonical.accountStatus,
    };
    const changes = [
      ...(['firstName', 'lastName', 'phone', 'email', 'accountStatus'] as const)
        .filter((field) => (canonical as any)[field] !== (finalFields as any)[field])
        .map((field) => ({ type: 'FIELD_UPDATE', field, oldValue: (canonical as any)[field] ?? null, newValue: (finalFields as any)[field] ?? null })),
    ];
    const duplicateIds = candidateIds.filter((id: string) => id !== canonicalEntityId);
    const duplicateRelations = await this.prisma.apartmentResident.findMany({ where: { residentId: { in: duplicateIds } } });
    const canonicalRelations = await this.prisma.apartmentResident.findMany({ where: { residentId: canonicalEntityId } });
    const canonicalRelationKeys = new Set(canonicalRelations.map((relation) => `${relation.apartmentId}:${relation.role}`));
    const relationMoves = duplicateRelations.map((relation) => ({
      type: canonicalRelationKeys.has(`${relation.apartmentId}:${relation.role}`) ? 'RELATION_ALREADY_EXISTS' : 'RELATION_COPY',
      relation: 'ApartmentResident',
      apartmentId: relation.apartmentId,
      role: relation.role,
      isPrimary: relation.isPrimary,
      fromEntityId: relation.residentId,
      toEntityId: canonicalEntityId,
    }));
    const [issues, threads, ownedApartments] = await Promise.all([
      this.prisma.issue.count({ where: { organizationId: associationId, residentId: { in: duplicateIds } } }),
      this.prisma.messageThread.count({ where: { organizationId: associationId, residentId: { in: duplicateIds } } }),
      this.prisma.apartment.count({ where: { organizationId: associationId, ownerResidentId: { in: duplicateIds } } }),
    ]);
    const warnings = [];
    if (duplicateRelations.some((relation) => relation.isPrimary)) warnings.push('Există primary contacts pe duplicate; canonical va prelua relațiile fără a șterge rândurile vechi.');
    return {
      canApply: true,
      warnings,
      conflicts: [],
      canonicalEntityId,
      duplicateEntityIds: duplicateIds,
      changes: [...changes, ...relationMoves],
      affectedRecords: { apartmentResidents: duplicateRelations.length, requests: issues, messageThreads: threads, ownedApartments },
      finalFields,
      relationMoves,
    };
  }

  private async buildMeterMergePreview(associationId: string, group: any, canonicalEntityId: string, body: Record<string, unknown>) {
    const candidateIds = group.candidates.map((candidate: any) => candidate.entityId);
    const [meters, store] = await Promise.all([
      this.prisma.meter.findMany({ where: { organizationId: associationId, id: { in: candidateIds } }, include: { readings: true } }),
      this.readMeterMetadata(associationId),
    ]);
    const canonical = meters.find((meter) => meter.id === canonicalEntityId);
    if (!canonical) throw new NotFoundException('Contorul canonic nu a fost găsit.');
    const duplicateIds = candidateIds.filter((id: string) => id !== canonicalEntityId);
    const sameApartment = meters.every((meter) => meter.apartmentId === canonical.apartmentId);
    const canonicalPeriods = new Set(
      canonical.readings.map((reading) => store.readings[reading.id]?.periodMonth || monthFromDate(reading.readingDate)),
    );
    const duplicateReadings = meters.filter((meter) => meter.id !== canonicalEntityId).flatMap((meter) => meter.readings.map((reading) => ({ ...reading, sourceMeterId: meter.id })));
    const conflicts: Array<Record<string, unknown>> = duplicateReadings
      .filter((reading) => canonicalPeriods.has(store.readings[reading.id]?.periodMonth || monthFromDate(reading.readingDate)))
      .map((reading) => ({ type: 'READING_PERIOD_CONFLICT', readingId: reading.id, periodMonth: store.readings[reading.id]?.periodMonth || monthFromDate(reading.readingDate), sourceMeterId: reading.sourceMeterId }));
    if (!sameApartment) conflicts.push({ type: 'DIFFERENT_APARTMENTS', message: 'Candidații sunt legați de apartamente diferite.' });
    const fieldSelections = isRecord(body.fieldSelections) ? body.fieldSelections : {};
    const meterNumber = optionalString(fieldSelections.meterNumber) || canonical.serialNumber || '';
    const unit = optionalString(fieldSelections.unit) || store.meters[canonical.id]?.unit || '';
    const status = optionalString(fieldSelections.status) || 'ACTIVE';
    const changes = [
      { type: 'FIELD_UPDATE', field: 'serialNumber', oldValue: canonical.serialNumber || null, newValue: meterNumber || null },
      { type: 'FIELD_UPDATE', field: 'unit', oldValue: store.meters[canonical.id]?.unit || null, newValue: unit || null },
      { type: 'FIELD_UPDATE', field: 'statusAlias', oldValue: store.meters[canonical.id]?.statusAlias || canonical.status, newValue: status },
      ...duplicateReadings.map((reading) => ({ type: 'RELATION_MOVE', relation: 'MeterReading', readingId: reading.id, fromEntityId: reading.sourceMeterId, toEntityId: canonicalEntityId })),
    ];
    return {
      canApply: conflicts.length === 0,
      warnings: conflicts.length ? ['Există conflicte de perioadă sau apartament; merge-ul este blocat până la verificare manuală.'] : [],
      conflicts,
      canonicalEntityId,
      duplicateEntityIds: duplicateIds,
      changes,
      affectedRecords: { meterReadings: duplicateReadings.length },
      finalFields: { serialNumber: meterNumber || canonical.serialNumber, unit, statusAlias: status },
    };
  }

  async mergeApply(user: MvpUser, id: string, body: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId, actorUserId } = this.assertAdmin(user, activeOrganizationId);
    if (body.confirm !== true) throw new BadRequestException('Confirmarea este obligatorie pentru merge.');
    const mergePlanId = optionalString(body.mergePlanId);
    const group = await this.prisma.duplicateGroup.findFirst({ where: { id, associationId }, include: { candidates: true } });
    if (!group) throw new NotFoundException('Grupul de duplicate nu a fost găsit.');
    if (group.entityType === DuplicateEntityType.APARTMENT) throw new BadRequestException('Merge automat indisponibil pentru apartamente în MVP.');
    const plan = mergePlanId
      ? await this.prisma.duplicateMergePlan.findFirst({ where: { id: mergePlanId, groupId: group.id, associationId } })
      : await this.prisma.duplicateMergePlan.findFirst({ where: { groupId: group.id, associationId, status: DuplicateMergePlanStatus.DRAFT }, orderBy: { createdAt: 'desc' } });
    if (!plan) throw new NotFoundException('Planul de merge nu a fost găsit.');
    if (plan.status !== DuplicateMergePlanStatus.DRAFT) throw new BadRequestException('Planul de merge nu mai este activ.');
    const planData = isRecord(plan.plan) ? plan.plan as any : {};
    if (planData.canApply === false || (Array.isArray(planData.conflicts) && planData.conflicts.length)) throw new BadRequestException('Planul are conflicte și nu poate fi aplicat.');

    await this.prisma.$transaction(async (tx) => {
      if (group.entityType === DuplicateEntityType.RESIDENT) await this.applyResidentMerge(tx, associationId, actorUserId, planData);
      if (group.entityType === DuplicateEntityType.METER) await this.applyMeterMerge(tx, associationId, actorUserId, planData);
      await tx.duplicateMergePlan.update({ where: { id: plan.id }, data: { status: DuplicateMergePlanStatus.APPLIED, appliedAt: new Date(), appliedById: actorUserId } });
      await tx.duplicateGroup.update({
        where: { id: group.id },
        data: { status: DuplicateGroupStatus.MERGED, canonicalEntityId: plan.canonicalEntityId, mergedAt: new Date(), mergedById: actorUserId },
      });
      await tx.dataQualityIssue.updateMany({
        where: { associationId, key: `DUPLICATE_GROUP:${group.id}` },
        data: { status: DataQualityIssueStatus.RESOLVED, resolvedAt: new Date(), resolvedById: actorUserId },
      });
    });
    await this.audit.createLog({
      associationId,
      actorUserId,
      actorRole: 'ADMIN',
      action: 'DUPLICATE_MERGE_APPLIED',
      entityType: 'SYSTEM',
      entityId: group.id,
      title: 'Merge duplicate aplicat',
      message: `Merge aplicat pentru ${group.entityType}.`,
      severity: 'SUCCESS',
      metadata: { groupId: group.id, entityType: group.entityType, canonicalEntityId: plan.canonicalEntityId, changes: planData.changes },
      actionUrl: `/admin/data-quality/duplicates/groups/${group.id}`,
    }).catch(() => null);
    return this.getGroup(user, id, activeOrganizationId);
  }

  private async applyResidentMerge(tx: any, associationId: string, actorUserId: string, plan: any) {
    const canonicalEntityId = String(plan.canonicalEntityId);
    const duplicateIds = Array.isArray(plan.duplicateEntityIds) ? plan.duplicateEntityIds.map(String) : [];
    const finalFields = isRecord(plan.finalFields) ? plan.finalFields : {};
    await tx.residentProfile.update({
      where: { id: canonicalEntityId },
      data: {
        firstName: optionalString(finalFields.firstName),
        lastName: optionalString(finalFields.lastName),
        phone: finalFields.phone ? String(finalFields.phone) : null,
        email: finalFields.email ? String(finalFields.email) : null,
        accountStatus: String(finalFields.accountStatus || ResidentAccountStatus.CREATED) as ResidentAccountStatus,
      },
    });
    const moves = Array.isArray(plan.relationMoves) ? plan.relationMoves : [];
    for (const move of moves) {
      if (move.type !== 'RELATION_COPY') continue;
      await tx.apartmentResident.upsert({
        where: {
          apartmentId_residentId_role: {
            apartmentId: String(move.apartmentId),
            residentId: canonicalEntityId,
            role: String(move.role || ApartmentResidentRole.OWNER) as ApartmentResidentRole,
          },
        },
        update: { isPrimary: Boolean(move.isPrimary) },
        create: {
          apartmentId: String(move.apartmentId),
          residentId: canonicalEntityId,
          role: String(move.role || ApartmentResidentRole.OWNER) as ApartmentResidentRole,
          isPrimary: Boolean(move.isPrimary),
        },
      });
    }
    await tx.apartmentResident.updateMany({ where: { residentId: { in: duplicateIds }, isPrimary: true }, data: { isPrimary: false } });
    await tx.residentProfile.updateMany({ where: { organizationId: associationId, id: { in: duplicateIds } }, data: { accountStatus: ResidentAccountStatus.NO_ACCOUNT, isPrimary: false } });
    await tx.issue.updateMany({ where: { organizationId: associationId, residentId: { in: duplicateIds } }, data: { residentId: canonicalEntityId } });
    await tx.messageThread.updateMany({ where: { organizationId: associationId, residentId: { in: duplicateIds } }, data: { residentId: canonicalEntityId } });
    await tx.apartment.updateMany({ where: { organizationId: associationId, ownerResidentId: { in: duplicateIds } }, data: { ownerResidentId: canonicalEntityId } });
    await tx.clientNote.create({
      data: {
        organizationId: associationId,
        createdByUserId: actorUserId,
        title: 'Resident merge metadata',
        content: JSON.stringify({ canonicalEntityId, duplicateIds, mergedAt: new Date().toISOString() }),
      },
    });
  }

  private async applyMeterMerge(tx: any, associationId: string, actorUserId: string, plan: any) {
    const canonicalEntityId = String(plan.canonicalEntityId);
    const duplicateIds = Array.isArray(plan.duplicateEntityIds) ? plan.duplicateEntityIds.map(String) : [];
    const finalFields = isRecord(plan.finalFields) ? plan.finalFields : {};
    const store = await this.readMeterMetadata(associationId);
    await tx.meter.update({
      where: { id: canonicalEntityId },
      data: {
        serialNumber: finalFields.serialNumber ? String(finalFields.serialNumber) : undefined,
        status: String(finalFields.statusAlias || '').toUpperCase() === 'ACTIVE' ? MeterStatus.ACTIVE : MeterStatus.INACTIVE,
      },
    });
    store.meters[canonicalEntityId] = {
      ...(store.meters[canonicalEntityId] || {}),
      unit: finalFields.unit || store.meters[canonicalEntityId]?.unit || '',
      statusAlias: finalFields.statusAlias || 'ACTIVE',
    };
    await tx.meterReading.updateMany({ where: { organizationId: associationId, meterId: { in: duplicateIds } }, data: { meterId: canonicalEntityId } });
    await tx.meter.updateMany({ where: { organizationId: associationId, id: { in: duplicateIds } }, data: { status: MeterStatus.INACTIVE } });
    duplicateIds.forEach((meterId) => {
      store.meters[meterId] = { ...(store.meters[meterId] || {}), statusAlias: 'ARCHIVED', mergedIntoMeterId: canonicalEntityId, mergedAt: new Date().toISOString() };
    });
    await this.writeMeterMetadata(associationId, actorUserId, store, tx);
  }

  async markNotDuplicate(user: MvpUser, id: string, body: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId, actorUserId } = this.assertAdmin(user, activeOrganizationId);
    const reason = optionalString(body.reason) || 'Marcat manual ca nu sunt duplicate.';
    const group = await this.prisma.duplicateGroup.findFirst({ where: { id, associationId } });
    if (!group) throw new NotFoundException('Grupul de duplicate nu a fost găsit.');
    const updated = await this.prisma.duplicateGroup.update({
      where: { id },
      data: {
        status: DuplicateGroupStatus.NOT_DUPLICATE,
        reviewedAt: new Date(),
        reviewedById: actorUserId,
        metadata: { ...(isRecord(group.metadata) ? group.metadata : {}), notDuplicateReason: reason } as Prisma.InputJsonValue,
      },
      include: { candidates: true },
    });
    await this.closeDataQualityIssue(associationId, actorUserId, id);
    await this.auditGroupStatus(associationId, actorUserId, updated, 'DUPLICATE_GROUP_MARKED_NOT_DUPLICATE', reason);
    return { group: this.serializeGroup(updated) };
  }

  async markReviewed(user: MvpUser, id: string, body: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId, actorUserId } = this.assertAdmin(user, activeOrganizationId);
    const reason = optionalString(body.reason) || 'Grup revizuit manual.';
    const group = await this.prisma.duplicateGroup.findFirst({ where: { id, associationId } });
    if (!group) throw new NotFoundException('Grupul de duplicate nu a fost găsit.');
    const updated = await this.prisma.duplicateGroup.update({
      where: { id },
      data: {
        status: DuplicateGroupStatus.REVIEWED,
        reviewedAt: new Date(),
        reviewedById: actorUserId,
        metadata: { ...(isRecord(group.metadata) ? group.metadata : {}), reviewReason: reason } as Prisma.InputJsonValue,
      },
      include: { candidates: true },
    });
    await this.auditGroupStatus(associationId, actorUserId, updated, 'DUPLICATE_GROUP_REVIEWED', reason);
    return { group: this.serializeGroup(updated) };
  }

  async ignoreGroup(user: MvpUser, id: string, body: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { associationId, actorUserId } = this.assertAdmin(user, activeOrganizationId);
    const reason = optionalString(body.reason);
    if (!reason) throw new BadRequestException('Motivul ignorării este obligatoriu.');
    const group = await this.prisma.duplicateGroup.findFirst({ where: { id, associationId } });
    if (!group) throw new NotFoundException('Grupul de duplicate nu a fost găsit.');
    const updated = await this.prisma.duplicateGroup.update({
      where: { id },
      data: { status: DuplicateGroupStatus.IGNORED, ignoredAt: new Date(), ignoredById: actorUserId, ignoreReason: reason },
      include: { candidates: true },
    });
    await this.closeDataQualityIssue(associationId, actorUserId, id);
    await this.auditGroupStatus(associationId, actorUserId, updated, 'DUPLICATE_GROUP_IGNORED', reason);
    return { group: this.serializeGroup(updated) };
  }

  async reopenGroup(user: MvpUser, id: string, activeOrganizationId?: string) {
    const { associationId, actorUserId } = this.assertAdmin(user, activeOrganizationId);
    const group = await this.prisma.duplicateGroup.findFirst({ where: { id, associationId } });
    if (!group) throw new NotFoundException('Grupul de duplicate nu a fost găsit.');
    const updated = await this.prisma.duplicateGroup.update({
      where: { id },
      data: { status: DuplicateGroupStatus.OPEN, ignoredAt: null, ignoredById: null, ignoreReason: null, reviewedAt: null, reviewedById: null },
      include: { candidates: true },
    });
    await this.auditGroupStatus(associationId, actorUserId, updated, 'DUPLICATE_GROUP_REOPENED', 'Grup redeschis.');
    return { group: this.serializeGroup(updated) };
  }

  private async closeDataQualityIssue(associationId: string, actorUserId: string, groupId: string) {
    await this.prisma.dataQualityIssue.updateMany({
      where: { associationId, key: `DUPLICATE_GROUP:${groupId}` },
      data: { status: DataQualityIssueStatus.RESOLVED, resolvedAt: new Date(), resolvedById: actorUserId },
    });
  }

  private async auditGroupStatus(associationId: string, actorUserId: string, group: any, action: string, reason: string) {
    await this.audit.createLog({
      associationId,
      actorUserId,
      actorRole: 'ADMIN',
      action,
      entityType: 'SYSTEM',
      entityId: group.id,
      title: 'Status grup duplicate actualizat',
      message: `${group.reason}: ${reason}`,
      severity: action.includes('IGNORED') ? 'WARNING' : 'INFO',
      metadata: { groupId: group.id, entityType: group.entityType, reason },
      actionUrl: `/admin/data-quality/duplicates/groups/${group.id}`,
    }).catch(() => null);
  }

  private serializeGroup(group: any) {
    return {
      id: group.id,
      entityType: group.entityType,
      status: group.status,
      confidence: group.confidence,
      confidenceLabel: confidenceLabel(group.confidence),
      reason: group.reason,
      score: group.score,
      canonicalEntityId: group.canonicalEntityId || null,
      candidatesCount: group.candidates?.length || 0,
      candidatesPreview: (group.candidates || []).slice(0, 3).map((candidate: any) => this.serializeCandidate(candidate)),
      createdAt: group.createdAt?.toISOString?.() || group.createdAt,
      updatedAt: group.updatedAt?.toISOString?.() || group.updatedAt,
      reviewedAt: group.reviewedAt?.toISOString?.() || group.reviewedAt || null,
      mergedAt: group.mergedAt?.toISOString?.() || group.mergedAt || null,
      ignoredAt: group.ignoredAt?.toISOString?.() || group.ignoredAt || null,
      ignoreReason: group.ignoreReason || null,
      metadata: group.metadata || {},
    };
  }

  private serializeCandidate(candidate: any) {
    return {
      id: candidate.id,
      entityId: candidate.entityId,
      entityType: candidate.entityType,
      displayName: candidate.displayName,
      matchReason: candidate.matchReason,
      matchScore: candidate.matchScore,
      snapshot: candidate.snapshot || {},
      isCanonical: candidate.isCanonical,
      createdAt: candidate.createdAt?.toISOString?.() || candidate.createdAt,
    };
  }

  private serializePlan(plan: any) {
    return {
      id: plan.id,
      groupId: plan.groupId,
      entityType: plan.entityType,
      canonicalEntityId: plan.canonicalEntityId,
      mergeStrategy: plan.mergeStrategy,
      status: plan.status,
      warnings: plan.warnings || [],
      createdAt: plan.createdAt?.toISOString?.() || plan.createdAt,
      appliedAt: plan.appliedAt?.toISOString?.() || plan.appliedAt || null,
    };
  }
}
