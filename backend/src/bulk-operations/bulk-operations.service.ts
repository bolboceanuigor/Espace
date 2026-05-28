import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AnnouncementStatus,
  ApartmentStatus,
  ArchiveStatus,
  BulkEntityType,
  BulkOperationItemStatus,
  BulkOperationStatus,
  BulkOperationType,
  DataQualityIssueStatus,
  DataRetentionEntityType,
  IssueStatus,
  MeterStatus,
  Prisma,
  ResidentAccountStatus,
  ResidentPortalAccessStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MvpUser } from '../security/mvp-auth.guard';
import { BulkOperationCancelDto, BulkOperationPreviewDto } from './dto/bulk-operation.dto';

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
  'cardNumber',
  'cvv',
];

const FORBIDDEN_ACTIONS = new Set<string>([
  'BULK_DELETE',
  'BULK_HARD_DELETE',
  'INVOICES_MARK_PAID',
  'INVOICES_CANCEL_SELECTED',
  'INVOICES_VOID_SELECTED',
  'PAYMENTS_CANCEL_SELECTED',
  'PAYMENTS_EDIT_SELECTED',
  'METER_READINGS_APPROVE_SELECTED',
  'BILLING_DRAFT_LOCK_SELECTED',
]);

const OPERATION_ENTITY: Record<BulkOperationType, BulkEntityType> = {
  APARTMENTS_SET_STATUS: BulkEntityType.APARTMENT,
  APARTMENTS_SET_STAIRCASE: BulkEntityType.APARTMENT,
  APARTMENTS_SET_BUILDING: BulkEntityType.APARTMENT,
  APARTMENTS_ARCHIVE: BulkEntityType.APARTMENT,
  RESIDENTS_SET_STATUS: BulkEntityType.RESIDENT,
  RESIDENTS_SET_PREFERRED_CONTACT_METHOD: BulkEntityType.RESIDENT,
  RESIDENTS_ARCHIVE: BulkEntityType.RESIDENT,
  RESIDENTS_SEND_PORTAL_INVITATIONS: BulkEntityType.RESIDENT,
  METERS_SET_STATUS: BulkEntityType.METER,
  METERS_SET_UNIT_FROM_TYPE: BulkEntityType.METER,
  METERS_ARCHIVE: BulkEntityType.METER,
  METER_READINGS_MARK_NEEDS_REVIEW: BulkEntityType.METER_READING,
  REQUESTS_SET_STATUS: BulkEntityType.REQUEST,
  REQUESTS_ASSIGN_TO_STAFF: BulkEntityType.REQUEST,
  REQUESTS_ARCHIVE_CLOSED: BulkEntityType.REQUEST,
  ANNOUNCEMENTS_ARCHIVE: BulkEntityType.ANNOUNCEMENT,
  ANNOUNCEMENTS_MARK_PINNED: BulkEntityType.ANNOUNCEMENT,
  ANNOUNCEMENTS_MARK_UNPINNED: BulkEntityType.ANNOUNCEMENT,
  INVOICES_EXPORT_SELECTED: BulkEntityType.INTERNAL_INVOICE,
  INVOICES_PRINT_SELECTED: BulkEntityType.INTERNAL_INVOICE,
  INVOICES_MARK_AS_SENT_INTERNAL: BulkEntityType.INTERNAL_INVOICE,
  PAYMENTS_EXPORT_SELECTED: BulkEntityType.PAYMENT,
  DATA_QUALITY_MARK_RESOLVED: BulkEntityType.DATA_QUALITY_ISSUE,
  DATA_QUALITY_MARK_IGNORED: BulkEntityType.DATA_QUALITY_ISSUE,
  IMPORTS_ARCHIVE_COMPLETED: BulkEntityType.IMPORT_JOB,
  EXPORTS_ARCHIVE_OLD: BulkEntityType.EXPORT_LOG,
};

const LIMITS: Partial<Record<BulkOperationType, number>> = {
  INVOICES_EXPORT_SELECTED: 5000,
  PAYMENTS_EXPORT_SELECTED: 5000,
  INVOICES_PRINT_SELECTED: 200,
  RESIDENTS_SEND_PORTAL_INVITATIONS: 200,
};

type PreviewEntity = { id: string; displayName: string; raw: Record<string, unknown>; valid: boolean; warnings: string[]; errors: string[] };

@Injectable()
export class BulkOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: MvpUser, filters: Record<string, string | undefined>) {
    const where: Prisma.BulkOperationWhereInput = {
      associationId: user.organizationId,
      ...(filters.entityType ? { entityType: filters.entityType as BulkEntityType } : {}),
      ...(filters.operationType ? { operationType: filters.operationType as BulkOperationType } : {}),
      ...(filters.status ? { status: filters.status as BulkOperationStatus } : {}),
    };
    const items = await this.prisma.bulkOperation.findMany({
      where,
      include: { createdBy: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items };
  }

  async availableActions(user: MvpUser, entityType: BulkEntityType) {
    const actions = Object.entries(OPERATION_ENTITY)
      .filter(([, expected]) => expected === entityType)
      .map(([operationType]) => ({
        operationType,
        label: this.operationLabel(operationType as BulkOperationType),
        safe: !FORBIDDEN_ACTIONS.has(operationType),
      }));
    return { entityType, associationId: user.organizationId, actions };
  }

  async createPreview(user: MvpUser, dto: BulkOperationPreviewDto) {
    this.assertSafeAction(dto);
    this.assertBatchSize(dto.operationType, dto.selectedIds);
    this.validatePayload(dto.operationType, dto.payload || {});

    const entities = await this.loadEntities(user.organizationId, dto.entityType, dto.selectedIds, dto.operationType, dto.payload || {});
    const counts = this.countPreview(entities);
    const operation = await this.prisma.bulkOperation.create({
      data: {
        associationId: user.organizationId,
        entityType: dto.entityType,
        operationType: dto.operationType,
        status: BulkOperationStatus.PREVIEWED,
        title: this.operationLabel(dto.operationType),
        description: 'Preview bulk generat înainte de aplicare.',
        payload: this.sanitizeSnapshot(dto.payload || {}) as Prisma.InputJsonValue,
        filters: this.sanitizeSnapshot(dto.filters || {}) as Prisma.InputJsonValue,
        selectedIds: dto.selectedIds as Prisma.InputJsonValue,
        totalItems: entities.length,
        validItems: counts.validItems,
        warningItems: counts.warningItems,
        skippedItems: counts.skippedItems,
        createdById: user.id,
        items: {
          create: entities.map((entity) => ({
            entityType: dto.entityType,
            entityId: entity.id,
            entityDisplayName: entity.displayName,
            status: entity.errors.length ? BulkOperationItemStatus.SKIPPED : entity.warnings.length ? BulkOperationItemStatus.WARNING : BulkOperationItemStatus.VALID,
            warnings: entity.warnings as Prisma.InputJsonValue,
            errors: entity.errors as Prisma.InputJsonValue,
            beforeSnapshot: this.sanitizeSnapshot(entity.raw) as Prisma.InputJsonValue,
          })),
        },
      },
      include: this.operationInclude(),
    });
    await this.audit(user, 'BULK_OPERATION_PREVIEWED', operation, { totalItems: operation.totalItems, validItems: operation.validItems, skippedItems: operation.skippedItems });
    return this.previewResponse(operation);
  }

  async getOperation(user: MvpUser, id: string) {
    const operation = await this.prisma.bulkOperation.findFirst({ where: { id, associationId: user.organizationId }, include: this.operationInclude() });
    if (!operation) throw new NotFoundException('Operațiunea bulk nu a fost găsită.');
    return this.previewResponse(operation);
  }

  async items(user: MvpUser, id: string) {
    await this.assertOperation(user, id);
    const items = await this.prisma.bulkOperationItem.findMany({ where: { bulkOperationId: id }, orderBy: { createdAt: 'asc' }, take: 1000 });
    return { items };
  }

  async confirm(user: MvpUser, id: string, confirm: boolean) {
    if (!confirm) throw new BadRequestException('Confirmarea este obligatorie.');
    const operation = await this.assertOperation(user, id);
    if (operation.status !== BulkOperationStatus.PREVIEWED) throw new BadRequestException('Operațiunea poate fi confirmată doar după preview.');
    await this.prisma.bulkOperation.update({
      where: { id },
      data: { status: BulkOperationStatus.CONFIRMED, confirmedById: user.id, confirmedAt: new Date() },
    });
    await this.audit(user, 'BULK_OPERATION_CONFIRMED', operation, { bulkOperationId: id });
    return this.applyOperation(user, id);
  }

  async cancel(user: MvpUser, id: string, dto: BulkOperationCancelDto) {
    const operation = await this.assertOperation(user, id);
    const cancellableStatuses: BulkOperationStatus[] = [BulkOperationStatus.DRAFT, BulkOperationStatus.PREVIEWED];
    if (!cancellableStatuses.includes(operation.status)) {
      throw new BadRequestException('Operațiunea nu mai poate fi anulată după aplicare.');
    }
    const updated = await this.prisma.bulkOperation.update({
      where: { id },
      data: { status: BulkOperationStatus.CANCELLED, cancelledAt: new Date(), cancelledById: user.id, cancellationReason: dto.reason },
      include: this.operationInclude(),
    });
    await this.audit(user, 'BULK_OPERATION_CANCELLED', updated, { reason: dto.reason });
    return this.previewResponse(updated);
  }

  async result(user: MvpUser, id: string) {
    const operation = await this.assertOperation(user, id);
    const items = await this.prisma.bulkOperationItem.findMany({ where: { bulkOperationId: id }, orderBy: { updatedAt: 'desc' }, take: 500 });
    return {
      bulkOperation: operation,
      summary: operation.resultSummary || {
        message: `${operation.appliedItems} iteme aplicate, ${operation.skippedItems} sărite, ${operation.failedItems} eșuate.`,
      },
      items,
    };
  }

  private async applyOperation(user: MvpUser, id: string) {
    let operation = await this.assertOperation(user, id);
    await this.prisma.bulkOperation.update({ where: { id }, data: { status: BulkOperationStatus.PROCESSING, startedAt: new Date() } });
    const items = await this.prisma.bulkOperationItem.findMany({
      where: { bulkOperationId: id, status: { in: [BulkOperationItemStatus.VALID, BulkOperationItemStatus.WARNING] } },
      orderBy: { createdAt: 'asc' },
    });
    let applied = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const after = await this.applyItem(user, operation, item);
        applied += 1;
        await this.prisma.bulkOperationItem.update({
          where: { id: item.id },
          data: { status: BulkOperationItemStatus.APPLIED, appliedAt: new Date(), afterSnapshot: this.sanitizeSnapshot(after || {}) as Prisma.InputJsonValue },
        });
      } catch (error: any) {
        failed += 1;
        await this.prisma.bulkOperationItem.update({
          where: { id: item.id },
          data: { status: BulkOperationItemStatus.FAILED, failedAt: new Date(), errorMessage: String(error?.message || 'Aplicarea a eșuat.') },
        });
      }
    }
    const skipped = operation.skippedItems;
    const finalStatus = failed > 0 || skipped > 0 ? (applied > 0 ? BulkOperationStatus.PARTIAL : BulkOperationStatus.FAILED) : BulkOperationStatus.COMPLETED;
    const resultSummary = { message: `${applied} iteme au fost aplicate. ${skipped} au fost sărite. ${failed} au eșuat.` };
    operation = await this.prisma.bulkOperation.update({
      where: { id },
      data: { status: finalStatus, appliedItems: applied, failedItems: failed, completedAt: new Date(), resultSummary },
      include: this.operationInclude(),
    });
    await this.audit(user, finalStatus === BulkOperationStatus.PARTIAL ? 'BULK_OPERATION_PARTIAL' : finalStatus === BulkOperationStatus.FAILED ? 'BULK_OPERATION_FAILED' : 'BULK_OPERATION_COMPLETED', operation, resultSummary);
    return this.previewResponse(operation);
  }

  private async applyItem(user: MvpUser, operation: any, item: any) {
    const payload = (operation.payload || {}) as Record<string, any>;
    const now = new Date();
    switch (operation.operationType as BulkOperationType) {
      case BulkOperationType.APARTMENTS_SET_STATUS:
        return this.prisma.apartment.update({ where: { id: item.entityId }, data: { status: payload.status as ApartmentStatus } });
      case BulkOperationType.APARTMENTS_ARCHIVE:
        return this.archiveEntity(user, operation, item, DataRetentionEntityType.APARTMENT, 'apartment');
      case BulkOperationType.RESIDENTS_SET_STATUS:
        if (Object.values(ResidentAccountStatus).includes(payload.status)) {
          return this.prisma.residentProfile.update({ where: { id: item.entityId }, data: { accountStatus: payload.status as ResidentAccountStatus } });
        }
        return this.prisma.residentProfile.update({ where: { id: item.entityId }, data: { portalAccessStatus: payload.status as ResidentPortalAccessStatus } });
      case BulkOperationType.RESIDENTS_ARCHIVE:
        return this.archiveEntity(user, operation, item, DataRetentionEntityType.RESIDENT, 'residentProfile');
      case BulkOperationType.METERS_SET_STATUS:
        return this.prisma.meter.update({ where: { id: item.entityId }, data: { status: payload.status as MeterStatus } });
      case BulkOperationType.METERS_ARCHIVE:
        return this.archiveEntity(user, operation, item, DataRetentionEntityType.METER, 'meter');
      case BulkOperationType.REQUESTS_SET_STATUS:
        return this.prisma.issue.update({ where: { id: item.entityId }, data: { status: payload.status as IssueStatus, resolvedAt: payload.status === IssueStatus.RESOLVED ? now : undefined } });
      case BulkOperationType.REQUESTS_ASSIGN_TO_STAFF:
        return this.prisma.issue.update({ where: { id: item.entityId }, data: { assignedToUserId: payload.assignedToUserId } });
      case BulkOperationType.REQUESTS_ARCHIVE_CLOSED:
        return this.archiveEntity(user, operation, item, DataRetentionEntityType.REQUEST, 'issue');
      case BulkOperationType.ANNOUNCEMENTS_ARCHIVE:
        return this.archiveEntity(user, operation, item, DataRetentionEntityType.ANNOUNCEMENT, 'announcement');
      case BulkOperationType.ANNOUNCEMENTS_MARK_PINNED:
        return this.prisma.announcement.update({ where: { id: item.entityId }, data: { isPinned: true } });
      case BulkOperationType.ANNOUNCEMENTS_MARK_UNPINNED:
        return this.prisma.announcement.update({ where: { id: item.entityId }, data: { isPinned: false } });
      case BulkOperationType.DATA_QUALITY_MARK_RESOLVED:
        return this.prisma.dataQualityIssue.update({ where: { id: item.entityId }, data: { status: DataQualityIssueStatus.RESOLVED, resolvedAt: now, resolvedById: user.id } });
      case BulkOperationType.DATA_QUALITY_MARK_IGNORED:
        return this.prisma.dataQualityIssue.update({ where: { id: item.entityId }, data: { status: DataQualityIssueStatus.IGNORED, ignoredAt: now, ignoredById: user.id, ignoreReason: String(payload.reason || payload.note || 'Ignorat bulk.') } });
      case BulkOperationType.INVOICES_EXPORT_SELECTED:
      case BulkOperationType.INVOICES_PRINT_SELECTED:
      case BulkOperationType.PAYMENTS_EXPORT_SELECTED:
        return item.beforeSnapshot || {};
      default:
        throw new ForbiddenException('Această operațiune bulk este pregătită ca placeholder, dar nu se aplică automat în ES-149.');
    }
  }

  private async archiveEntity(user: MvpUser, operation: any, item: any, entityType: DataRetentionEntityType, modelName: 'apartment' | 'residentProfile' | 'meter' | 'issue' | 'announcement') {
    const payload = (operation.payload || {}) as Record<string, unknown>;
    const reason = String(payload.reason || 'Arhivare bulk.');
    await this.assertNoLegalHold(operation.associationId, entityType, item.entityId);
    const data = { archivedAt: new Date(), archivedById: user.id, archiveReason: reason } as any;
    if (modelName === 'apartment') {
      const updated = await this.prisma.apartment.update({ where: { id: item.entityId }, data });
      await this.createArchiveRecord(user, operation.associationId, entityType, item, reason, updated);
      return updated;
    }
    if (modelName === 'residentProfile') {
      const updated = await this.prisma.residentProfile.update({ where: { id: item.entityId }, data });
      await this.createArchiveRecord(user, operation.associationId, entityType, item, reason, updated);
      return updated;
    }
    if (modelName === 'meter') {
      const updated = await this.prisma.meter.update({ where: { id: item.entityId }, data: { ...data, status: MeterStatus.INACTIVE } });
      await this.createArchiveRecord(user, operation.associationId, entityType, item, reason, updated);
      return updated;
    }
    if (modelName === 'issue') {
      const updated = await this.prisma.issue.update({ where: { id: item.entityId }, data });
      await this.createArchiveRecord(user, operation.associationId, entityType, item, reason, updated);
      return updated;
    }
    const updated = await this.prisma.announcement.update({ where: { id: item.entityId }, data: { ...data, status: AnnouncementStatus.ARCHIVED } });
    await this.createArchiveRecord(user, operation.associationId, entityType, item, reason, updated);
    return updated;
  }

  private async createArchiveRecord(user: MvpUser, associationId: string, entityType: DataRetentionEntityType, item: any, reason: string, after: unknown) {
    const existing = await this.prisma.archiveRecord.findFirst({ where: { associationId, entityType, entityId: item.entityId, status: ArchiveStatus.ARCHIVED } });
    if (existing) return existing;
    return this.prisma.archiveRecord.create({
      data: {
        associationId,
        entityType,
        entityId: item.entityId,
        entityDisplayName: item.entityDisplayName,
        status: ArchiveStatus.ARCHIVED,
        archiveReason: reason,
        archivedById: user.id,
        archivedAt: new Date(),
        beforeSnapshot: item.beforeSnapshot || undefined,
        afterSnapshot: this.sanitizeSnapshot(after) as Prisma.InputJsonValue,
        metadata: { source: 'BULK_OPERATION' },
      },
    });
  }

  private async loadEntities(associationId: string, entityType: BulkEntityType, selectedIds: string[], operationType: BulkOperationType, payload: Record<string, unknown>): Promise<PreviewEntity[]> {
    const uniqueIds = [...new Set(selectedIds.filter(Boolean))];
    const found = await this.findEntities(associationId, entityType, uniqueIds);
    const byId = new Map(found.map((item) => [item.id, item]));
    return uniqueIds.map((id) => {
      const raw = byId.get(id) as Record<string, unknown> | undefined;
      if (!raw) return { id, displayName: 'Resursă indisponibilă', raw: { id }, valid: false, warnings: [], errors: ['Resursa nu aparține asociației curente sau nu există.'] };
      const warnings: string[] = [];
      const errors: string[] = [];
      this.validateEntityForOperation(raw, operationType, payload, warnings, errors);
      return { id, displayName: this.displayName(entityType, raw), raw, valid: errors.length === 0, warnings, errors };
    });
  }

  private async findEntities(associationId: string, entityType: BulkEntityType, ids: string[]) {
    switch (entityType) {
      case BulkEntityType.APARTMENT:
        return this.prisma.apartment.findMany({ where: { organizationId: associationId, id: { in: ids } }, include: { invoices: { select: { id: true, status: true }, take: 5 } } }) as any;
      case BulkEntityType.RESIDENT:
        return this.prisma.residentProfile.findMany({ where: { organizationId: associationId, id: { in: ids } }, include: { apartment: { select: { number: true } } } }) as any;
      case BulkEntityType.METER:
        return this.prisma.meter.findMany({ where: { organizationId: associationId, id: { in: ids } }, include: { apartment: { select: { number: true } }, readings: { select: { id: true }, take: 1 } } }) as any;
      case BulkEntityType.REQUEST:
        return this.prisma.issue.findMany({ where: { organizationId: associationId, id: { in: ids } }, include: { apartment: { select: { number: true } }, resident: { select: { firstName: true, lastName: true } } } }) as any;
      case BulkEntityType.ANNOUNCEMENT:
        return this.prisma.announcement.findMany({ where: { organizationId: associationId, id: { in: ids } } }) as any;
      case BulkEntityType.DATA_QUALITY_ISSUE:
        return this.prisma.dataQualityIssue.findMany({ where: { associationId, id: { in: ids } } }) as any;
      case BulkEntityType.PAYMENT:
        return this.prisma.payment.findMany({ where: { organizationId: associationId, id: { in: ids } } }) as any;
      case BulkEntityType.INTERNAL_INVOICE:
        return this.prisma.residentInvoice.findMany({ where: { organizationId: associationId, id: { in: ids } } }) as any;
      default:
        return [];
    }
  }

  private validateEntityForOperation(raw: any, operationType: BulkOperationType, payload: Record<string, unknown>, warnings: string[], errors: string[]) {
    const archiveAllowedExportTypes: BulkOperationType[] = [BulkOperationType.INVOICES_EXPORT_SELECTED, BulkOperationType.PAYMENTS_EXPORT_SELECTED];
    const archiveOperations: BulkOperationType[] = [BulkOperationType.APARTMENTS_ARCHIVE, BulkOperationType.RESIDENTS_ARCHIVE, BulkOperationType.METERS_ARCHIVE, BulkOperationType.ANNOUNCEMENTS_ARCHIVE];
    if (raw.archivedAt && !archiveAllowedExportTypes.includes(operationType)) warnings.push('Resursa este deja arhivată.');
    if (archiveOperations.includes(operationType) && !String(payload.reason || '').trim()) {
      errors.push('Motivul arhivării este obligatoriu.');
    }
    if (operationType === BulkOperationType.REQUESTS_ARCHIVE_CLOSED && ![IssueStatus.RESOLVED, IssueStatus.CLOSED].includes(raw.status)) {
      errors.push('Doar solicitările rezolvate sau închise pot fi arhivate bulk.');
    }
    if (operationType === BulkOperationType.DATA_QUALITY_MARK_IGNORED && !String(payload.reason || payload.note || '').trim()) {
      errors.push('Motivul ignorării este obligatoriu.');
    }
    if (operationType === BulkOperationType.RESIDENTS_SEND_PORTAL_INVITATIONS) {
      if (!raw.email && !raw.phone) errors.push('Locatarul nu are email sau telefon pentru invitație.');
      if (raw.portalAccessStatus === ResidentPortalAccessStatus.ACTIVE) errors.push('Locatarul are deja acces activ.');
    }
    if (operationType === BulkOperationType.APARTMENTS_ARCHIVE && raw.invoices?.length) warnings.push('Apartamentul are istoric de facturi; istoricul rămâne păstrat.');
  }

  private validatePayload(operationType: BulkOperationType, payload: Record<string, unknown>) {
    if (operationType === BulkOperationType.APARTMENTS_SET_STATUS && !Object.values(ApartmentStatus).includes(payload.status as ApartmentStatus)) throw new BadRequestException('Status apartament invalid.');
    if (operationType === BulkOperationType.RESIDENTS_SET_STATUS && !Object.values(ResidentAccountStatus).includes(payload.status as ResidentAccountStatus) && !Object.values(ResidentPortalAccessStatus).includes(payload.status as ResidentPortalAccessStatus)) throw new BadRequestException('Status locatar invalid.');
    if (operationType === BulkOperationType.METERS_SET_STATUS && !Object.values(MeterStatus).includes(payload.status as MeterStatus)) throw new BadRequestException('Status contor invalid.');
    if (operationType === BulkOperationType.REQUESTS_SET_STATUS && !Object.values(IssueStatus).includes(payload.status as IssueStatus)) throw new BadRequestException('Status solicitare invalid.');
    if (operationType === BulkOperationType.REQUESTS_ASSIGN_TO_STAFF && !String(payload.assignedToUserId || '').trim()) throw new BadRequestException('Utilizatorul asignat este obligatoriu.');
  }

  private assertSafeAction(dto: BulkOperationPreviewDto) {
    if (!dto.selectedIds?.length) throw new BadRequestException('Selectează cel puțin un item.');
    if (FORBIDDEN_ACTIONS.has(String(dto.operationType))) throw new ForbiddenException('Această operațiune bulk este interzisă.');
    if (OPERATION_ENTITY[dto.operationType] !== dto.entityType) throw new BadRequestException('Operațiunea nu este permisă pentru acest tip de entitate.');
  }

  private assertBatchSize(operationType: BulkOperationType, selectedIds: string[]) {
    const limit = LIMITS[operationType] || 500;
    if (selectedIds.length > limit) throw new BadRequestException('Selecția este prea mare pentru această acțiune. Redu numărul de iteme selectate.');
  }

  private async assertOperation(user: MvpUser, id: string) {
    const operation = await this.prisma.bulkOperation.findFirst({ where: { id, associationId: user.organizationId }, include: this.operationInclude() });
    if (!operation) throw new NotFoundException('Operațiunea bulk nu a fost găsită.');
    return operation;
  }

  private async assertNoLegalHold(associationId: string, entityType: DataRetentionEntityType, entityId: string) {
    const hold = await this.prisma.legalHold.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [
          { associationId, entityType, entityId },
          { associationId, entityType, entityId: null },
          { associationId, entityType: null, entityId: null },
        ],
      },
    });
    if (hold) throw new ForbiddenException('Această resursă are legal hold activ.');
  }

  private countPreview(items: PreviewEntity[]) {
    return {
      validItems: items.filter((item) => !item.errors.length && !item.warnings.length).length,
      warningItems: items.filter((item) => !item.errors.length && item.warnings.length).length,
      skippedItems: items.filter((item) => item.errors.length).length,
    };
  }

  private previewResponse(operation: any) {
    return {
      bulkOperation: operation,
      items: operation.items || [],
      requiresConfirmation: operation.status === BulkOperationStatus.PREVIEWED,
      confirmationText: 'Confirm că am verificat preview-ul și aplic modificarea pentru itemele valide.',
    };
  }

  private operationInclude() {
    return {
      createdBy: { select: { id: true, email: true, fullName: true } },
      confirmedBy: { select: { id: true, email: true, fullName: true } },
      cancelledBy: { select: { id: true, email: true, fullName: true } },
      items: { orderBy: { createdAt: 'asc' as const }, take: 500 },
    };
  }

  private displayName(entityType: BulkEntityType, raw: any) {
    if (entityType === BulkEntityType.APARTMENT) return `Apartament ${raw.number}`;
    if (entityType === BulkEntityType.RESIDENT) return `${raw.firstName || ''} ${raw.lastName || ''}`.trim() || raw.email || raw.phone || raw.id;
    if (entityType === BulkEntityType.METER) return `${raw.type} ${raw.serialNumber || raw.apartment?.number || ''}`.trim();
    if (entityType === BulkEntityType.REQUEST) return raw.title || raw.id;
    if (entityType === BulkEntityType.ANNOUNCEMENT) return raw.title || raw.id;
    if (entityType === BulkEntityType.DATA_QUALITY_ISSUE) return raw.title || raw.key || raw.id;
    return raw.invoiceNumber || raw.id;
  }

  private operationLabel(operationType: BulkOperationType) {
    return operationType.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
  }

  private sanitizeSnapshot(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sanitizeSnapshot(item));
    if (!value || typeof value !== 'object') return value;
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.some((secret) => key.toLowerCase().includes(secret.toLowerCase()))) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = this.sanitizeSnapshot(item);
      }
    }
    return output;
  }

  private async audit(user: MvpUser, action: string, operation: any, metadata?: unknown) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action,
        entityType: 'BulkOperation',
        entityId: operation.id,
        description: `${action}: ${operation.operationType}`,
        newValuesJson: this.sanitizeSnapshot(metadata || {}) as Prisma.InputJsonValue,
      },
    }).catch(() => undefined);
  }
}
