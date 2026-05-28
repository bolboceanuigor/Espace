import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  AnnouncementStatus,
  ArchiveStatus,
  DataDeletionRequestStatus,
  DataRetentionEntityType,
  IssueStatus,
  LegalHoldStatus,
  MeterStatus,
  Prisma,
  RetentionEventAction,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RETENTION_POLICY_SEEDS } from './data-retention.seed';
import {
  ArchiveEntityDto,
  CreateDeletionRequestDto,
  CreateLegalHoldDto,
  ReleaseLegalHoldDto,
  RestoreArchiveDto,
  UpdateDeletionRequestStatusDto,
  UpdateRetentionPolicyDto,
} from './dto/data-retention.dto';

type Actor = { id?: string; sub?: string; role?: string; organizationId?: string | null };

const ADMIN_ARCHIVE_TYPES = new Set<DataRetentionEntityType>([
  DataRetentionEntityType.APARTMENT,
  DataRetentionEntityType.RESIDENT,
  DataRetentionEntityType.METER,
  DataRetentionEntityType.ANNOUNCEMENT,
  DataRetentionEntityType.REQUEST,
]);

const SECRET_KEYS = [
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'jwt',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'resetToken',
  'invitationToken',
  'accessToken',
  'refreshToken',
];

@Injectable()
export class DataRetentionService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedPolicies();
  }

  private actorId(actor?: Actor | null) {
    return actor?.id || actor?.sub || null;
  }

  async seedPolicies() {
    for (const seed of RETENTION_POLICY_SEEDS) {
      await this.prisma.dataRetentionPolicy.upsert({
        where: { entityType: seed.entityType },
        update: {
          title: seed.title,
          description: seed.description,
          retentionAction: seed.retentionAction,
          defaultRetentionDays: seed.defaultRetentionDays,
          archiveAllowed: seed.archiveAllowed,
          restoreAllowed: seed.restoreAllowed,
          hardDeleteAllowed: seed.hardDeleteAllowed,
          anonymizationAllowed: seed.anonymizationAllowed ?? false,
          requiresSuperadminApproval: seed.requiresSuperadminApproval ?? false,
          legalHoldSupported: seed.legalHoldSupported ?? false,
          isSystem: true,
          isActive: true,
        },
        create: {
          ...seed,
          anonymizationAllowed: seed.anonymizationAllowed ?? false,
          requiresSuperadminApproval: seed.requiresSuperadminApproval ?? false,
          legalHoldSupported: seed.legalHoldSupported ?? false,
          isSystem: true,
          isActive: true,
        },
      });
    }
  }

  async overview() {
    await this.seedPolicies();
    const [policies, archiveRecords, recentEvents, legalHolds, deletionRequests] = await Promise.all([
      this.prisma.dataRetentionPolicy.findMany({ orderBy: { entityType: 'asc' } }),
      this.prisma.archiveRecord.findMany({
        include: this.archiveInclude(),
        orderBy: { archivedAt: 'desc' },
        take: 8,
      }),
      this.prisma.retentionEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.legalHold.findMany({ where: { status: LegalHoldStatus.ACTIVE }, orderBy: { appliedAt: 'desc' }, take: 8 }),
      this.prisma.dataDeletionRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);
    return {
      summary: {
        activePolicies: policies.filter((item) => item.isActive).length,
        protectedEntities: policies.filter((item) => !item.hardDeleteAllowed).length,
        archiveAllowed: policies.filter((item) => item.archiveAllowed).length,
        recentArchives: archiveRecords.filter((item) => item.status === ArchiveStatus.ARCHIVED).length,
        recentRestores: archiveRecords.filter((item) => item.status === ArchiveStatus.RESTORED).length,
        hardDeleteBlocked: policies.filter((item) => !item.hardDeleteAllowed).length,
        legalHoldsActive: legalHolds.length,
        deletionRequestsOpen: deletionRequests.filter((item) => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(item.status)).length,
      },
      protectedPolicies: policies.filter((item) => !item.hardDeleteAllowed).slice(0, 10),
      archiveRecords: archiveRecords.map((item) => this.mapArchiveRecord(item)),
      legalHolds,
      deletionRequests,
      recentEvents,
      warnings: [
        'Hard delete este blocat pentru facturi, plăți, audit log, indici aprobați și evenimente operaționale critice.',
        'Ștergerea/anonymizarea nu se execută automat în ES-147. Se înregistrează doar cereri controlate.',
        'Pentru operațiuni speciale, verifică backup-ul recent înainte de intervenții manuale.',
      ],
    };
  }

  async policies(filters: Record<string, string | undefined>) {
    await this.seedPolicies();
    const search = filters.search?.trim();
    const items = await this.prisma.dataRetentionPolicy.findMany({
      where: {
        ...(filters.entityType ? { entityType: filters.entityType as DataRetentionEntityType } : {}),
        ...(filters.archiveAllowed ? { archiveAllowed: filters.archiveAllowed === 'true' } : {}),
        ...(filters.hardDeleteAllowed ? { hardDeleteAllowed: filters.hardDeleteAllowed === 'true' } : {}),
        ...(filters.legalHoldSupported ? { legalHoldSupported: filters.legalHoldSupported === 'true' } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { notes: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ hardDeleteAllowed: 'asc' }, { entityType: 'asc' }],
    });
    return { items };
  }

  async policy(id: string) {
    const item = await this.prisma.dataRetentionPolicy.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        updatedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!item) throw new NotFoundException('Politica de retenție nu a fost găsită.');
    const [archiveRecords, deletionRequests] = await Promise.all([
      this.prisma.archiveRecord.findMany({
        where: { entityType: item.entityType },
        include: this.archiveInclude(),
        orderBy: { archivedAt: 'desc' },
        take: 20,
      }),
      this.prisma.dataDeletionRequest.findMany({
        where: { entityType: item.entityType },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { policy: item, archiveRecords: archiveRecords.map((record) => this.mapArchiveRecord(record)), deletionRequests };
  }

  async updatePolicy(id: string, dto: UpdateRetentionPolicyDto, actor?: Actor) {
    const existing = await this.prisma.dataRetentionPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Politica de retenție nu a fost găsită.');
    const item = await this.prisma.dataRetentionPolicy.update({
      where: { id },
      data: {
        defaultRetentionDays: dto.defaultRetentionDays,
        notes: dto.notes,
        isActive: existing.isSystem ? existing.isActive : dto.isActive ?? existing.isActive,
        retentionAction: dto.retentionAction ?? existing.retentionAction,
        updatedById: this.actorId(actor),
      },
    });
    await this.addEvent(item.entityType, item.id, RetentionEventAction.POLICY_UPDATED, 'Politică actualizată', item.title, actor, dto);
    await this.audit('DATA_RETENTION_POLICY_UPDATED', 'DataRetentionPolicy', item.id, `Politică retention actualizată: ${item.title}`, actor, dto);
    return item;
  }

  async archiveList(filters: Record<string, string | undefined>, associationId?: string | null) {
    const search = filters.search?.trim();
    const items = await this.prisma.archiveRecord.findMany({
      where: {
        ...(associationId ? { associationId } : {}),
        ...(filters.associationId && !associationId ? { associationId: filters.associationId } : {}),
        ...(filters.entityType ? { entityType: filters.entityType as DataRetentionEntityType } : {}),
        ...(filters.status ? { status: filters.status as ArchiveStatus } : {}),
        ...(search
          ? {
              OR: [
                { entityDisplayName: { contains: search, mode: 'insensitive' } },
                { archiveReason: { contains: search, mode: 'insensitive' } },
                { restoreReason: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: this.archiveInclude(),
      orderBy: { archivedAt: 'desc' },
      take: 100,
    });
    return { items: items.map((item) => this.mapArchiveRecord(item)), meta: { page: 1, limit: 100, total: items.length } };
  }

  async archiveRecord(id: string, associationId?: string | null) {
    const item = await this.prisma.archiveRecord.findFirst({
      where: { id, ...(associationId ? { associationId } : {}) },
      include: this.archiveInclude(),
    });
    if (!item) throw new NotFoundException('Înregistrarea de arhivă nu a fost găsită.');
    const events = await this.prisma.retentionEvent.findMany({
      where: { entityType: item.entityType, entityId: item.entityId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return { ...this.mapArchiveRecord(item), events };
  }

  async adminSettings(associationId: string) {
    const policies = await this.prisma.dataRetentionPolicy.findMany({
      where: {
        entityType: { in: Array.from(ADMIN_ARCHIVE_TYPES) },
        isActive: true,
      },
      orderBy: { entityType: 'asc' },
    });
    const archiveCount = await this.prisma.archiveRecord.count({ where: { associationId } });
    return {
      associationId,
      policies,
      archiveCount,
      message: 'Admin poate arhiva doar date operaționale sigure. Facturile, plățile și audit log-ul nu pot fi șterse definitiv.',
      legalLinks: ['/ro/confidentialitate', '/ro/prelucrarea-datelor'],
    };
  }

  async archiveEntity(entityTypeRaw: string, entityId: string, dto: ArchiveEntityDto, actor: Actor, associationId?: string | null) {
    const entityType = this.parseEntityType(entityTypeRaw);
    if (!dto.reason?.trim()) throw new BadRequestException('Motivul arhivării este obligatoriu.');
    if (associationId && !ADMIN_ARCHIVE_TYPES.has(entityType)) {
      throw new ForbiddenException('Această entitate nu poate fi arhivată din Admin Archive Center.');
    }
    const policy = await this.getActivePolicy(entityType);
    if (!policy.archiveAllowed) {
      await this.addEvent(entityType, entityId, RetentionEventAction.ARCHIVE_BLOCKED, 'Arhivare blocată', 'Politica de retenție nu permite arhivarea.', actor, { policyId: policy.id });
      throw new ForbiddenException('Această resursă nu poate fi arhivată conform politicii de retenție.');
    }
    const entity = await this.getEntity(entityType, entityId, associationId);
    if (!entity) throw new NotFoundException('Resursa nu a fost găsită.');
    await this.assertNoLegalHold(entityType, entityId, entity.organizationId || associationId || null);
    this.assertArchiveAllowedForEntity(entityType, entity);
    const displayName = this.displayName(entityType, entity);
    const actorId = this.actorId(actor);
    if (!actorId) throw new ForbiddenException('Actor invalid.');
    const now = new Date();
    const beforeSnapshot = this.sanitize(entity) as Prisma.InputJsonValue;
    const record = await this.prisma.$transaction(async (tx) => {
      await this.updateArchivedEntity(tx, entityType, entityId, actorId, dto.reason.trim(), now, associationId || entity.organizationId || null);
      const archiveRecord = await tx.archiveRecord.create({
        data: {
          associationId: entity.organizationId || associationId || null,
          entityType,
          entityId,
          entityDisplayName: displayName,
          archiveReason: dto.reason.trim(),
          archivedById: actorId,
          archivedAt: now,
          beforeSnapshot,
          metadata: { source: associationId ? 'ADMIN_ARCHIVE_CENTER' : 'SUPERADMIN_ARCHIVE_CENTER' },
        },
        include: this.archiveInclude(),
      });
      await tx.retentionEvent.create({
        data: {
          associationId: entity.organizationId || associationId || null,
          entityType,
          entityId,
          action: RetentionEventAction.ENTITY_ARCHIVED,
          title: 'Entitate arhivată',
          message: displayName,
          actorUserId: actorId,
          reason: dto.reason.trim(),
          metadata: { archiveRecordId: archiveRecord.id },
        },
      });
      return archiveRecord;
    });
    await this.audit('ENTITY_ARCHIVED', String(entityType), entityId, `Resursă arhivată: ${displayName}`, actor, { archiveRecordId: record.id, reason: dto.reason });
    return this.mapArchiveRecord(record);
  }

  async restoreArchive(recordId: string, dto: RestoreArchiveDto, actor: Actor, associationId?: string | null) {
    if (!dto.reason?.trim()) throw new BadRequestException('Motivul restaurării este obligatoriu.');
    const record = await this.prisma.archiveRecord.findFirst({
      where: { id: recordId, ...(associationId ? { associationId } : {}) },
      include: this.archiveInclude(),
    });
    if (!record) throw new NotFoundException('Înregistrarea de arhivă nu a fost găsită.');
    if (record.status === ArchiveStatus.RESTORED) throw new BadRequestException('Resursa este deja restaurată.');
    const policy = await this.getActivePolicy(record.entityType);
    if (!policy.restoreAllowed) throw new ForbiddenException('Politica de retenție nu permite restaurarea acestei resurse.');
    const entity = await this.getEntity(record.entityType, record.entityId, associationId || record.associationId);
    if (!entity) throw new NotFoundException('Resursa arhivată nu mai există.');
    const actorId = this.actorId(actor);
    if (!actorId) throw new ForbiddenException('Actor invalid.');
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.updateRestoredEntity(tx, record.entityType, record.entityId, actorId, dto.reason.trim(), now, associationId || record.associationId || null);
      const after = await this.getEntity(record.entityType, record.entityId, associationId || record.associationId);
      const archiveRecord = await tx.archiveRecord.update({
        where: { id: record.id },
        data: {
          status: ArchiveStatus.RESTORED,
          restoredById: actorId,
          restoredAt: now,
          restoreReason: dto.reason.trim(),
          afterSnapshot: this.sanitize(after || {}) as Prisma.InputJsonValue,
        },
        include: this.archiveInclude(),
      });
      await tx.retentionEvent.create({
        data: {
          associationId: record.associationId,
          entityType: record.entityType,
          entityId: record.entityId,
          action: RetentionEventAction.ENTITY_RESTORED,
          title: 'Entitate restaurată',
          message: record.entityDisplayName || record.entityId,
          actorUserId: actorId,
          reason: dto.reason.trim(),
          metadata: { archiveRecordId: record.id },
        },
      });
      return archiveRecord;
    });
    await this.audit('ENTITY_RESTORED', String(record.entityType), record.entityId, `Resursă restaurată: ${record.entityDisplayName || record.entityId}`, actor, { archiveRecordId: record.id, reason: dto.reason });
    return this.mapArchiveRecord(updated);
  }

  async legalHolds(filters: Record<string, string | undefined>) {
    const items = await this.prisma.legalHold.findMany({
      where: {
        ...(filters.status ? { status: filters.status as LegalHoldStatus } : {}),
        ...(filters.associationId ? { associationId: filters.associationId } : {}),
        ...(filters.entityType ? { entityType: filters.entityType as DataRetentionEntityType } : {}),
      },
      include: {
        association: { select: { id: true, name: true, legalName: true } },
        appliedBy: { select: { id: true, email: true, fullName: true } },
        releasedBy: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { appliedAt: 'desc' },
    });
    return { items };
  }

  async createLegalHold(dto: CreateLegalHoldDto, actor: Actor) {
    if (!dto.title?.trim() || !dto.reason?.trim()) throw new BadRequestException('Titlul și motivul sunt obligatorii.');
    const actorId = this.actorId(actor);
    if (!actorId) throw new ForbiddenException('Actor invalid.');
    const item = await this.prisma.legalHold.create({
      data: {
        associationId: dto.associationId || null,
        entityType: dto.entityType,
        entityId: dto.entityId,
        title: dto.title.trim(),
        reason: dto.reason.trim(),
        appliedById: actorId,
      },
    });
    await this.addEvent(dto.entityType || DataRetentionEntityType.ASSOCIATION, dto.entityId || dto.associationId || item.id, RetentionEventAction.LEGAL_HOLD_APPLIED, 'Legal hold aplicat', item.title, actor, { legalHoldId: item.id });
    await this.audit('LEGAL_HOLD_APPLIED', 'LegalHold', item.id, `Legal hold aplicat: ${item.title}`, actor, dto);
    return item;
  }

  async releaseLegalHold(id: string, dto: ReleaseLegalHoldDto, actor: Actor) {
    if (!dto.reason?.trim()) throw new BadRequestException('Motivul eliberării este obligatoriu.');
    const existing = await this.prisma.legalHold.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Legal hold nu a fost găsit.');
    const item = await this.prisma.legalHold.update({
      where: { id },
      data: {
        status: LegalHoldStatus.RELEASED,
        releasedById: this.actorId(actor),
        releasedAt: new Date(),
        releaseReason: dto.reason.trim(),
      },
    });
    await this.addEvent(item.entityType || DataRetentionEntityType.ASSOCIATION, item.entityId || item.associationId || item.id, RetentionEventAction.LEGAL_HOLD_REMOVED, 'Legal hold eliberat', item.title, actor, { legalHoldId: item.id });
    await this.audit('LEGAL_HOLD_RELEASED', 'LegalHold', item.id, `Legal hold eliberat: ${item.title}`, actor, dto);
    return item;
  }

  async deletionRequests(filters: Record<string, string | undefined>) {
    const search = filters.search?.trim();
    const items = await this.prisma.dataDeletionRequest.findMany({
      where: {
        ...(filters.status ? { status: filters.status as DataDeletionRequestStatus } : {}),
        ...(filters.associationId ? { associationId: filters.associationId } : {}),
        ...(filters.requestType ? { requestType: filters.requestType as any } : {}),
        ...(search ? { reason: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: {
        association: { select: { id: true, name: true, legalName: true } },
        requestedByUser: { select: { id: true, email: true, fullName: true } },
        targetUser: { select: { id: true, email: true, fullName: true } },
        targetResident: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        reviewedBy: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { items, message: 'Execuția ștergerii/anonymizării nu este automată în acest task.' };
  }

  async createDeletionRequest(dto: CreateDeletionRequestDto, actor: Actor) {
    if (!dto.reason?.trim()) throw new BadRequestException('Motivul cererii este obligatoriu.');
    const action = dto.requestType === 'ANONYMIZE' ? RetentionEventAction.ANONYMIZATION_REQUESTED : RetentionEventAction.DELETION_REQUESTED;
    const item = await this.prisma.dataDeletionRequest.create({
      data: {
        associationId: dto.associationId || actor.organizationId || null,
        requestedByUserId: dto.requestedByUserId || this.actorId(actor),
        targetUserId: dto.targetUserId,
        targetResidentId: dto.targetResidentId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        requestType: dto.requestType,
        reason: dto.reason.trim(),
      },
    });
    await this.addEvent(dto.entityType || DataRetentionEntityType.ASSOCIATION, dto.entityId || item.id, action, 'Cerere retention creată', dto.reason.trim(), actor, { requestId: item.id, requestType: item.requestType });
    await this.audit('DATA_DELETION_REQUEST_CREATED', 'DataDeletionRequest', item.id, `Cerere ${item.requestType} creată`, actor, dto);
    return item;
  }

  async deletionRequest(id: string) {
    const item = await this.prisma.dataDeletionRequest.findUnique({
      where: { id },
      include: {
        association: { select: { id: true, name: true, legalName: true } },
        requestedByUser: { select: { id: true, email: true, fullName: true } },
        targetUser: { select: { id: true, email: true, fullName: true } },
        targetResident: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        reviewedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!item) throw new NotFoundException('Cererea nu a fost găsită.');
    return item;
  }

  async updateDeletionRequestStatus(id: string, dto: UpdateDeletionRequestStatusDto, actor: Actor) {
    await this.deletionRequest(id);
    const item = await this.prisma.dataDeletionRequest.update({
      where: { id },
      data: {
        status: dto.status,
        decisionNote: dto.decisionNote,
        reviewedById: this.actorId(actor),
        reviewedAt: new Date(),
        completedAt: dto.status === DataDeletionRequestStatus.COMPLETED ? (dto.completedAt ? new Date(dto.completedAt) : new Date()) : undefined,
      },
    });
    const eventAction = dto.status === DataDeletionRequestStatus.REJECTED ? RetentionEventAction.DELETION_REQUEST_REJECTED : RetentionEventAction.POLICY_UPDATED;
    await this.addEvent(item.entityType || DataRetentionEntityType.ASSOCIATION, item.entityId || item.id, eventAction, 'Status cerere retention actualizat', item.status, actor, { requestId: item.id, status: item.status });
    await this.audit('DATA_DELETION_REQUEST_STATUS_CHANGED', 'DataDeletionRequest', item.id, `Status cerere retention: ${item.status}`, actor, dto);
    return item;
  }

  hardDeleteForbidden(entityType: string, entityId?: string) {
    throw new ForbiddenException({
      statusCode: 403,
      code: 'DATA_RETENTION_HARD_DELETE_FORBIDDEN',
      message: 'Această resursă nu poate fi ștearsă definitiv. Folosește arhivarea.',
      details: { entityType, entityId },
    });
  }

  private parseEntityType(value: string) {
    const normalized = value.toUpperCase().replace(/-/g, '_') as DataRetentionEntityType;
    if (!Object.values(DataRetentionEntityType).includes(normalized)) {
      throw new BadRequestException('Tipul de entitate nu este suportat pentru retention.');
    }
    return normalized;
  }

  private async getActivePolicy(entityType: DataRetentionEntityType) {
    await this.seedPolicies();
    const policy = await this.prisma.dataRetentionPolicy.findUnique({ where: { entityType } });
    if (!policy || !policy.isActive) throw new ForbiddenException('Nu există politică activă pentru această entitate.');
    return policy;
  }

  private async getEntity(entityType: DataRetentionEntityType, entityId: string, associationId?: string | null): Promise<any | null> {
    const where = { id: entityId, ...(associationId ? { organizationId: associationId } : {}) };
    if (entityType === DataRetentionEntityType.APARTMENT) return this.prisma.apartment.findFirst({ where, include: { building: true, staircase: true } });
    if (entityType === DataRetentionEntityType.RESIDENT) return this.prisma.residentProfile.findFirst({ where, include: { apartment: true, user: true } });
    if (entityType === DataRetentionEntityType.METER) return this.prisma.meter.findFirst({ where, include: { apartment: true } });
    if (entityType === DataRetentionEntityType.ANNOUNCEMENT) return this.prisma.announcement.findFirst({ where });
    if (entityType === DataRetentionEntityType.REQUEST) return this.prisma.issue.findFirst({ where, include: { apartment: true, resident: true } });
    return null;
  }

  private assertArchiveAllowedForEntity(entityType: DataRetentionEntityType, entity: any) {
    if (entity.archivedAt) throw new BadRequestException('Resursa este deja arhivată.');
    if (entityType === DataRetentionEntityType.REQUEST && ![IssueStatus.RESOLVED, IssueStatus.CLOSED].includes(entity.status)) {
      throw new BadRequestException('Solicitările pot fi arhivate doar după rezolvare sau închidere.');
    }
  }

  private async assertNoLegalHold(entityType: DataRetentionEntityType, entityId: string, associationId?: string | null) {
    const legalHold = await this.prisma.legalHold.findFirst({
      where: {
        status: LegalHoldStatus.ACTIVE,
        OR: [
          { entityType, entityId },
          ...(associationId ? [{ associationId, entityType, entityId: null }, { associationId, entityType: null, entityId: null }] : []),
        ],
      },
    });
    if (legalHold) {
      throw new ForbiddenException('Această resursă are legal hold activ și nu poate fi arhivată.');
    }
  }

  private async updateArchivedEntity(tx: Prisma.TransactionClient, entityType: DataRetentionEntityType, entityId: string, actorId: string, reason: string, now: Date, associationId?: string | null) {
    const data = { archivedAt: now, archivedById: actorId, archiveReason: reason, restoredAt: null, restoredById: null, restoreReason: null };
    if (entityType === DataRetentionEntityType.APARTMENT) await tx.apartment.update({ where: { id: entityId }, data });
    if (entityType === DataRetentionEntityType.RESIDENT) await tx.residentProfile.update({ where: { id: entityId }, data });
    if (entityType === DataRetentionEntityType.METER) await tx.meter.update({ where: { id: entityId }, data: { ...data, status: MeterStatus.INACTIVE } });
    if (entityType === DataRetentionEntityType.ANNOUNCEMENT) await tx.announcement.update({ where: { id: entityId }, data: { ...data, status: AnnouncementStatus.ARCHIVED } });
    if (entityType === DataRetentionEntityType.REQUEST) await tx.issue.update({ where: { id: entityId }, data });
    if (associationId) {
      await tx.archiveRecord.updateMany({ where: { associationId, entityType, entityId, status: ArchiveStatus.ARCHIVED }, data: { status: ArchiveStatus.LOCKED } });
    }
  }

  private async updateRestoredEntity(tx: Prisma.TransactionClient, entityType: DataRetentionEntityType, entityId: string, actorId: string, reason: string, now: Date, _associationId?: string | null) {
    const data = { archivedAt: null, archivedById: null, archiveReason: null, restoredAt: now, restoredById: actorId, restoreReason: reason };
    if (entityType === DataRetentionEntityType.APARTMENT) await tx.apartment.update({ where: { id: entityId }, data });
    if (entityType === DataRetentionEntityType.RESIDENT) await tx.residentProfile.update({ where: { id: entityId }, data });
    if (entityType === DataRetentionEntityType.METER) await tx.meter.update({ where: { id: entityId }, data: { ...data, status: MeterStatus.ACTIVE } });
    if (entityType === DataRetentionEntityType.ANNOUNCEMENT) await tx.announcement.update({ where: { id: entityId }, data: { ...data, status: AnnouncementStatus.ACTIVE } });
    if (entityType === DataRetentionEntityType.REQUEST) await tx.issue.update({ where: { id: entityId }, data });
  }

  private displayName(entityType: DataRetentionEntityType, entity: any) {
    if (entityType === DataRetentionEntityType.APARTMENT) return `Apartament ${entity.number || entity.id}`;
    if (entityType === DataRetentionEntityType.RESIDENT) return `${entity.firstName || ''} ${entity.lastName || ''}`.trim() || entity.email || entity.phone || entity.id;
    if (entityType === DataRetentionEntityType.METER) return entity.serialNumber ? `Contor ${entity.serialNumber}` : `Contor ${entity.id}`;
    if (entityType === DataRetentionEntityType.ANNOUNCEMENT) return entity.title || entity.id;
    if (entityType === DataRetentionEntityType.REQUEST) return entity.title || entity.id;
    return entity.id;
  }

  private archiveInclude() {
    return {
      association: { select: { id: true, name: true, legalName: true } },
      archivedBy: { select: { id: true, email: true, fullName: true } },
      restoredBy: { select: { id: true, email: true, fullName: true } },
    };
  }

  private mapArchiveRecord(record: any) {
    return {
      ...record,
      canRestore: record.status === ArchiveStatus.ARCHIVED && ADMIN_ARCHIVE_TYPES.has(record.entityType),
    };
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sanitize(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
          if (SECRET_KEYS.some((secret) => key.toLowerCase().includes(secret.toLowerCase()))) return [key, '[REDACTED]'];
          return [key, this.sanitize(nested)];
        }),
      );
    }
    return value;
  }

  private async addEvent(entityType: DataRetentionEntityType, entityId: string, action: RetentionEventAction, title: string, message: string, actor?: Actor, metadata?: unknown) {
    await this.prisma.retentionEvent.create({
      data: {
        associationId: actor?.organizationId || null,
        entityType,
        entityId,
        action,
        title,
        message,
        actorUserId: this.actorId(actor),
        metadata: (this.sanitize(metadata || {}) || {}) as Prisma.InputJsonValue,
      },
    });
  }

  private async audit(action: string, entityType: string, entityId: string, description: string, actor?: Actor, metadata?: unknown) {
    const userId = this.actorId(actor);
    if (!userId) return;
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          organizationId: actor?.organizationId || null,
          action,
          entityType,
          entityId,
          description,
          newValuesJson: (this.sanitize(metadata || {}) || {}) as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Retention audit should not block the operational action.
    }
  }
}
