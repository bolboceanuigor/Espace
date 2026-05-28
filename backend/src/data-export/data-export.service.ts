import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DataExportEventType,
  DataExportFormat,
  DataExportStatus,
  DataExportType,
  DataRequestStatus,
  DataRequestType,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CancelDataExportDto, CreateDataExportDto, CreateDataRequestDto, UpdateDataRequestStatusDto } from './dto/data-export.dto';

type Actor = { id?: string; sub?: string; role?: string; organizationId?: string | null; email?: string; phone?: string };
type DownloadPayload = { content: string; contentType: string; fileName: string; fileSize: number };

const SECRET_KEYS = ['password', 'passwordHash', 'token', 'tokenHash', 'jwt', 'secret', 'apiKey', 'authorization', 'cookie', 'resetToken', 'invitationToken', 'accessToken', 'refreshToken', 'cardNumber', 'cvv'];
const RESIDENT_REQUEST_TYPES: DataRequestType[] = [DataRequestType.ACCESS, DataRequestType.PORTABILITY, DataRequestType.CORRECTION, DataRequestType.EXPORT, DataRequestType.OTHER];
const ASSOCIATION_EXPORTS = [
  DataExportType.ASSOCIATION_FULL_EXPORT,
  DataExportType.ASSOCIATION_FINANCIAL_EXPORT,
  DataExportType.ASSOCIATION_RESIDENTS_EXPORT,
  DataExportType.ASSOCIATION_APARTMENTS_EXPORT,
  DataExportType.ASSOCIATION_METERS_EXPORT,
  DataExportType.AUDIT_EXPORT,
  DataExportType.CUSTOM_EXPORT,
];
const ASSOCIATION_EXPORT_SET = new Set<DataExportType>(ASSOCIATION_EXPORTS);
const RESIDENT_EXPORTS: DataExportType[] = [DataExportType.RESIDENT_PERSONAL_EXPORT, DataExportType.RESIDENT_FINANCIAL_EXPORT, DataExportType.RESIDENT_METER_EXPORT];
const RESIDENT_EXPORT_SET = new Set<DataExportType>(RESIDENT_EXPORTS);

@Injectable()
export class DataExportService {
  constructor(private readonly prisma: PrismaService) {}

  private actorId(actor?: Actor | null) {
    return actor?.id || actor?.sub || null;
  }

  async listRequests(scope: 'SUPERADMIN' | 'ADMIN' | 'RESIDENT', actor: Actor, filters: Record<string, string | undefined>) {
    const residentScope = scope === 'RESIDENT' ? await this.getResidentScope(actor) : null;
    const where: Prisma.DataRequestWhereInput = {
      ...(scope === 'ADMIN' ? { associationId: this.requireOrg(actor) } : {}),
      ...(scope === 'RESIDENT' ? { requesterUserId: this.actorId(actor), requesterResidentId: residentScope?.residentIds.length ? { in: residentScope.residentIds } : undefined } : {}),
      ...(filters.status ? { status: filters.status as DataRequestStatus } : {}),
      ...(filters.type ? { type: filters.type as DataRequestType } : {}),
      ...(filters.associationId && scope === 'SUPERADMIN' ? { associationId: filters.associationId } : {}),
      ...(filters.search ? { OR: [{ title: { contains: filters.search, mode: 'insensitive' } }, { message: { contains: filters.search, mode: 'insensitive' } }] } : {}),
    };
    const items = await this.prisma.dataRequest.findMany({
      where,
      include: this.requestInclude(),
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items };
  }

  async requestStats() {
    const [newCount, review, approved, completed, rejected, deletionLike, month] = await Promise.all([
      this.prisma.dataRequest.count({ where: { status: DataRequestStatus.NEW } }),
      this.prisma.dataRequest.count({ where: { status: DataRequestStatus.IN_REVIEW } }),
      this.prisma.dataRequest.count({ where: { status: DataRequestStatus.APPROVED } }),
      this.prisma.dataRequest.count({ where: { status: DataRequestStatus.COMPLETED } }),
      this.prisma.dataRequest.count({ where: { status: DataRequestStatus.REJECTED } }),
      this.prisma.dataRequest.count({ where: { type: { in: [DataRequestType.DELETION, DataRequestType.ANONYMIZATION] } } }),
      this.prisma.dataRequest.count({ where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
    ]);
    return { newCount, inReview: review, approved, completed, rejected, deletionLike, month };
  }

  async getRequest(id: string, scope: 'SUPERADMIN' | 'ADMIN' | 'RESIDENT', actor: Actor) {
    const residentScope = scope === 'RESIDENT' ? await this.getResidentScope(actor) : null;
    const item = await this.prisma.dataRequest.findFirst({
      where: {
        id,
        ...(scope === 'ADMIN' ? { associationId: this.requireOrg(actor) } : {}),
        ...(scope === 'RESIDENT' ? { requesterUserId: this.actorId(actor), requesterResidentId: residentScope?.residentIds.length ? { in: residentScope.residentIds } : undefined } : {}),
      },
      include: { ...this.requestInclude(), relatedExport: true, exportJobs: { include: { events: { orderBy: { createdAt: 'desc' } } } } },
    });
    if (!item) throw new NotFoundException('Cererea de date nu a fost găsită.');
    const legalHolds = item.associationId
      ? await this.prisma.legalHold.findMany({ where: { associationId: item.associationId, status: 'ACTIVE' }, take: 10, orderBy: { appliedAt: 'desc' } })
      : [];
    return { ...item, legalHolds, retentionWarning: this.retentionWarning(item.type) };
  }

  async createRequest(scope: 'ADMIN' | 'RESIDENT', actor: Actor, dto: CreateDataRequestDto) {
    if (!dto.title?.trim() || !dto.message?.trim()) throw new BadRequestException('Titlul și mesajul sunt obligatorii.');
    if (scope === 'RESIDENT' && !RESIDENT_REQUEST_TYPES.includes(dto.type)) {
      throw new BadRequestException('Acest tip de cerere necesită procesare legală manuală. Contactează administratorul sau Espace.');
    }
    const residentScope = scope === 'RESIDENT' ? await this.getResidentScope(actor) : null;
    const requesterResidentId = scope === 'RESIDENT' ? residentScope?.residentIds[0] || null : null;
    const associationId = this.requireOrg(actor);
    const item = await this.prisma.dataRequest.create({
      data: {
        associationId,
        requesterUserId: this.actorId(actor),
        requesterResidentId,
        requesterEmail: actor.email || null,
        requesterPhone: actor.phone || null,
        type: dto.type,
        scope: dto.scope,
        title: dto.title.trim(),
        message: dto.message.trim(),
        reason: dto.reason?.trim() || null,
      },
      include: this.requestInclude(),
    });
    await this.audit('DATA_REQUEST_CREATED', 'DataRequest', item.id, `Cerere de date creată: ${item.title}`, actor, { type: item.type, scope: item.scope });
    return item;
  }

  async updateRequestStatus(id: string, dto: UpdateDataRequestStatusDto, actor: Actor, adminScope?: boolean) {
    const item = await this.prisma.dataRequest.findFirst({ where: { id, ...(adminScope ? { associationId: this.requireOrg(actor) } : {}) } });
    if (!item) throw new NotFoundException('Cererea de date nu a fost găsită.');
    if (dto.status === DataRequestStatus.REJECTED && !dto.decisionNote?.trim()) throw new BadRequestException('Motivul respingerii este obligatoriu.');
    const reviewStatuses: DataRequestStatus[] = [DataRequestStatus.IN_REVIEW, DataRequestStatus.APPROVED, DataRequestStatus.REJECTED, DataRequestStatus.WAITING_FOR_INFO];
    const shouldReview = reviewStatuses.includes(dto.status);
    const updated = await this.prisma.dataRequest.update({
      where: { id },
      data: {
        status: dto.status,
        decisionNote: dto.decisionNote,
        reviewedById: shouldReview ? this.actorId(actor) : item.reviewedById,
        reviewedAt: shouldReview ? new Date() : item.reviewedAt,
        completedById: dto.status === DataRequestStatus.COMPLETED ? this.actorId(actor) : item.completedById,
        completedAt: dto.status === DataRequestStatus.COMPLETED ? new Date() : item.completedAt,
      },
      include: this.requestInclude(),
    });
    await this.audit('DATA_REQUEST_STATUS_CHANGED', 'DataRequest', updated.id, `Status cerere date: ${updated.status}`, actor, { status: updated.status, decisionNote: dto.decisionNote });
    return updated;
  }

  async cancelRequest(id: string, actor: Actor, reason = 'Anulată de solicitant.') {
    const item = await this.prisma.dataRequest.findFirst({
      where: { id, requesterUserId: this.actorId(actor), status: DataRequestStatus.NEW },
    });
    if (!item) throw new NotFoundException('Cererea nu poate fi anulată sau nu există.');
    const updated = await this.prisma.dataRequest.update({
      where: { id },
      data: { status: DataRequestStatus.CANCELLED, cancelledById: this.actorId(actor), cancelledAt: new Date(), cancellationReason: reason },
    });
    await this.audit('DATA_REQUEST_CANCELLED', 'DataRequest', id, 'Cerere de date anulată.', actor, { reason });
    return updated;
  }

  async listExports(scope: 'SUPERADMIN' | 'ADMIN' | 'RESIDENT', actor: Actor, filters: Record<string, string | undefined>) {
    const residentScope = scope === 'RESIDENT' ? await this.getResidentScope(actor) : null;
    const items = await this.prisma.dataExportJob.findMany({
      where: {
        ...(scope === 'ADMIN' ? { associationId: this.requireOrg(actor) } : {}),
        ...(scope === 'RESIDENT' ? { associationId: this.requireOrg(actor), residentId: residentScope?.residentIds.length ? { in: residentScope.residentIds } : '__none__' } : {}),
        ...(filters.associationId && scope === 'SUPERADMIN' ? { associationId: filters.associationId } : {}),
        ...(filters.status ? { status: filters.status as DataExportStatus } : {}),
        ...(filters.exportType ? { exportType: filters.exportType as DataExportType } : {}),
      },
      include: this.exportInclude(),
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items };
  }

  async getExport(id: string, scope: 'SUPERADMIN' | 'ADMIN' | 'RESIDENT', actor: Actor) {
    const where = await this.exportAccessWhere(id, scope, actor);
    const item = await this.prisma.dataExportJob.findFirst({ where, include: { ...this.exportInclude(), events: { orderBy: { createdAt: 'desc' } } } });
    if (!item) throw new NotFoundException('Exportul nu a fost găsit.');
    return item;
  }

  async createExport(scope: 'SUPERADMIN' | 'ADMIN' | 'RESIDENT', actor: Actor, dto: CreateDataExportDto) {
    if (dto.format === DataExportFormat.ZIP) throw new BadRequestException('ZIP va fi disponibil ulterior. Folosește CSV sau JSON.');
    this.assertExportTypeAllowed(scope, dto.exportType);
    const actorId = this.actorId(actor);
    if (!actorId) throw new ForbiddenException('Actor invalid.');
    const associationId = scope === 'SUPERADMIN' ? dto.associationId || actor.organizationId || null : this.requireOrg(actor);
    if (ASSOCIATION_EXPORT_SET.has(dto.exportType) && !associationId) throw new BadRequestException('associationId este obligatoriu pentru exportul asociației.');
    const residentId = await this.resolveResidentId(scope, actor, dto);
    const fileName = this.fileName(dto.exportType, dto.format, associationId || residentId || 'export');
    const job = await this.prisma.dataExportJob.create({
      data: {
        associationId,
        requestedById: actorId,
        residentId,
        dataRequestId: dto.dataRequestId,
        exportType: dto.exportType,
        format: dto.format,
        status: DataExportStatus.READY,
        fileName,
        filters: (dto.filters || {}) as Prisma.InputJsonValue,
        includedEntities: this.includedEntities(dto.exportType) as Prisma.InputJsonValue,
        startedAt: new Date(),
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await this.addExportEvent(job.id, actorId, DataExportEventType.EXPORT_REQUESTED, 'Export solicitat', fileName, { exportType: dto.exportType, format: dto.format });
    await this.addExportEvent(job.id, actorId, DataExportEventType.EXPORT_READY, 'Export pregătit', 'Exportul se generează la download autentificat.', {});
    if (dto.dataRequestId) {
      await this.prisma.dataRequest.update({ where: { id: dto.dataRequestId }, data: { relatedExportId: job.id } }).catch(() => null);
    }
    await this.audit('DATA_EXPORT_REQUESTED', 'DataExportJob', job.id, `Export pregătit: ${fileName}`, actor, { exportType: job.exportType, format: job.format, associationId, residentId });
    return this.getExport(job.id, scope, actor);
  }

  async createExportForRequest(id: string, actor: Actor) {
    const request = await this.prisma.dataRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Cererea de date nu a fost găsită.');
    const exportType = request.scope === 'FULL_RESIDENT_EXPORT' || request.requesterResidentId ? DataExportType.RESIDENT_PERSONAL_EXPORT : DataExportType.ASSOCIATION_FULL_EXPORT;
    return this.createExport('SUPERADMIN', actor, {
      exportType,
      format: DataExportFormat.JSON,
      associationId: request.associationId || undefined,
      residentId: request.requesterResidentId || undefined,
      dataRequestId: request.id,
    });
  }

  async cancelExport(id: string, dto: CancelDataExportDto, scope: 'SUPERADMIN' | 'ADMIN', actor: Actor) {
    await this.getExport(id, scope, actor);
    const item = await this.prisma.dataExportJob.update({ where: { id }, data: { status: DataExportStatus.CANCELLED, cancelledAt: new Date(), metadata: { cancelReason: dto.reason || 'Anulat.' } } });
    await this.addExportEvent(id, this.actorId(actor), DataExportEventType.EXPORT_CANCELLED, 'Export anulat', dto.reason || 'Anulat.', {});
    await this.audit('DATA_EXPORT_CANCELLED', 'DataExportJob', id, 'Export anulat.', actor, dto);
    return item;
  }

  async downloadExport(id: string, scope: 'SUPERADMIN' | 'ADMIN' | 'RESIDENT', actor: Actor): Promise<DownloadPayload> {
    const job = await this.getExport(id, scope, actor);
    if (job.status !== DataExportStatus.READY) throw new BadRequestException('Exportul nu este pregătit pentru download.');
    const payload = await this.generateExport(job as any, scope, actor);
    await this.prisma.dataExportJob.update({ where: { id }, data: { fileSize: payload.fileSize, rowCounts: (payload as any).rowCounts || undefined } });
    await this.addExportEvent(id, this.actorId(actor), DataExportEventType.EXPORT_DOWNLOADED, 'Export descărcat', payload.fileName, { fileSize: payload.fileSize });
    await this.audit('DATA_EXPORT_DOWNLOADED', 'DataExportJob', id, `Export descărcat: ${payload.fileName}`, actor, { exportType: job.exportType, format: job.format, fileSize: payload.fileSize });
    return payload;
  }

  private async generateExport(job: any, scope: string, actor: Actor): Promise<DownloadPayload> {
    if (RESIDENT_EXPORTS.includes(job.exportType)) return this.generateResidentExport(job, actor);
    if (!job.associationId) throw new BadRequestException('Exportul nu are associationId.');
    if (job.exportType === DataExportType.ASSOCIATION_FULL_EXPORT || job.format === DataExportFormat.JSON) {
      const data = await this.associationJson(job.associationId, scope === 'SUPERADMIN');
      const content = this.toJson({ metadata: this.exportMetadata(job), data });
      return { content, contentType: 'application/json; charset=utf-8', fileName: job.fileName, fileSize: Buffer.byteLength(content) };
    }
    const csv = await this.associationCsv(job.associationId, job.exportType);
    return { content: csv.content, contentType: 'text/csv; charset=utf-8', fileName: job.fileName, fileSize: Buffer.byteLength(csv.content), ...(csv.rowCounts ? { rowCounts: csv.rowCounts } : {}) } as DownloadPayload;
  }

  private async associationCsv(associationId: string, exportType: DataExportType) {
    if (exportType === DataExportType.ASSOCIATION_APARTMENTS_EXPORT) {
      const rows = await this.prisma.apartment.findMany({ where: { organizationId: associationId }, include: { building: true, staircase: true }, orderBy: { number: 'asc' } });
      return { content: this.buildCsv(['id', 'number', 'building', 'staircase', 'floor', 'areaM2', 'rooms', 'status', 'archivedAt'], rows.map((r) => ({ id: r.id, number: r.number, building: r.building?.name, staircase: r.staircase?.name, floor: r.floor, areaM2: r.areaM2, rooms: r.rooms, status: r.status, archivedAt: r.archivedAt?.toISOString() }))), rowCounts: { apartments: rows.length } };
    }
    if (exportType === DataExportType.ASSOCIATION_RESIDENTS_EXPORT) {
      const rows = await this.prisma.residentProfile.findMany({ where: { organizationId: associationId }, include: { apartment: true, apartmentResidents: true }, orderBy: { createdAt: 'asc' } });
      return { content: this.buildCsv(['id', 'firstName', 'lastName', 'email', 'phone', 'apartment', 'type', 'isPrimary', 'accountStatus', 'archivedAt'], rows.map((r) => ({ id: r.id, firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone, apartment: r.apartment?.number, type: r.type, isPrimary: r.isPrimary, accountStatus: r.accountStatus, archivedAt: r.archivedAt?.toISOString() }))), rowCounts: { residents: rows.length } };
    }
    if (exportType === DataExportType.ASSOCIATION_METERS_EXPORT) {
      const rows = await this.prisma.meter.findMany({ where: { organizationId: associationId }, include: { apartment: true, readings: true }, orderBy: { createdAt: 'asc' } });
      const flat: Record<string, unknown>[] = [];
      rows.forEach((m) => {
        if (m.readings.length) {
          m.readings.forEach((r) => flat.push({ meterId: m.id, apartment: m.apartment.number, type: m.type, serialNumber: m.serialNumber, status: m.status, readingValue: r.value, readingDate: r.readingDate.toISOString(), source: r.source }));
        } else {
          flat.push({ meterId: m.id, apartment: m.apartment.number, type: m.type, serialNumber: m.serialNumber, status: m.status, readingValue: '', readingDate: '', source: '' });
        }
      });
      return { content: this.buildCsv(['meterId', 'apartment', 'type', 'serialNumber', 'status', 'readingValue', 'readingDate', 'source'], flat), rowCounts: { meters: rows.length, meterReadings: flat.length } };
    }
    const [invoices, payments] = await Promise.all([
      this.prisma.residentInvoice.findMany({ where: { organizationId: associationId }, include: { apartment: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.payment.findMany({ where: { organizationId: associationId }, include: { apartment: true, invoice: true }, orderBy: { createdAt: 'desc' } }),
    ]);
    const rows = [
      ...invoices.map((i) => ({ kind: 'INVOICE', id: i.id, number: i.invoiceNumber, apartment: i.apartment.number, amount: i.totalDue, paid: i.paymentsAmount, status: i.status, date: i.issuedAt?.toISOString() || i.createdAt.toISOString() })),
      ...payments.map((p) => ({ kind: 'PAYMENT', id: p.id, number: p.invoice?.invoiceNumber || '', apartment: p.apartment.number, amount: p.amount, paid: p.amount, status: p.status, date: p.paidAt?.toISOString() || p.createdAt.toISOString() })),
    ];
    return { content: this.buildCsv(['kind', 'id', 'number', 'apartment', 'amount', 'paid', 'status', 'date'], rows), rowCounts: { invoices: invoices.length, payments: payments.length } };
  }

  private async associationJson(associationId: string, includeSuperadmin = false) {
    const [association, buildings, staircases, apartments, residents, relations, meters, meterReadings, invoices, payments, announcements, requests] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: associationId } }),
      this.prisma.building.findMany({ where: { organizationId: associationId } }),
      this.prisma.staircase.findMany({ where: { organizationId: associationId } }),
      this.prisma.apartment.findMany({ where: { organizationId: associationId } }),
      this.prisma.residentProfile.findMany({ where: { organizationId: associationId } }),
      this.prisma.apartmentResident.findMany({ where: { apartment: { organizationId: associationId } } }),
      this.prisma.meter.findMany({ where: { organizationId: associationId } }),
      this.prisma.meterReading.findMany({ where: { organizationId: associationId } }),
      this.prisma.residentInvoice.findMany({ where: { organizationId: associationId } }),
      this.prisma.payment.findMany({ where: { organizationId: associationId } }),
      this.prisma.announcement.findMany({ where: { organizationId: associationId } }),
      this.prisma.issue.findMany({ where: { organizationId: associationId }, include: { comments: true } }),
    ]);
    const data: Record<string, unknown> = { association, buildings, staircases, apartments, residents, apartmentResidentRelations: relations, meters, meterReadings, invoices, payments, announcements, requests };
    if (includeSuperadmin) data.subscriptionSummary = await this.prisma.saasSubscription.findMany({ where: { associationId } });
    return this.sanitizeExportData(data);
  }

  private async generateResidentExport(job: any, actor: Actor): Promise<DownloadPayload> {
    const residentId = job.residentId || (await this.getResidentScope(actor)).residentIds[0];
    if (!residentId) throw new BadRequestException('Nu există resident asociat.');
    const data = (await this.residentJson(residentId, job.associationId || this.requireOrg(actor))) as any;
    if (job.format === DataExportFormat.CSV) {
      const rows = [
        ...(data.invoices || []).map((i: any) => ({ kind: 'INVOICE', id: i.id, number: i.invoiceNumber, amount: i.totalDue, status: i.status, date: i.issuedAt || i.createdAt })),
        ...(data.payments || []).map((p: any) => ({ kind: 'PAYMENT', id: p.id, number: p.invoice?.invoiceNumber || '', amount: p.amount, status: p.status, date: p.paidAt || p.createdAt })),
      ];
      const content = this.buildCsv(['kind', 'id', 'number', 'amount', 'status', 'date'], rows);
      return { content, contentType: 'text/csv; charset=utf-8', fileName: job.fileName, fileSize: Buffer.byteLength(content) };
    }
    const content = this.toJson({ metadata: this.exportMetadata(job), data });
    return { content, contentType: 'application/json; charset=utf-8', fileName: job.fileName, fileSize: Buffer.byteLength(content) };
  }

  private async residentJson(residentId: string, associationId: string) {
    const resident = await this.prisma.residentProfile.findFirst({ where: { id: residentId, organizationId: associationId }, include: { apartment: true, apartmentResidents: { include: { apartment: true } } } });
    if (!resident) throw new NotFoundException('Residentul nu a fost găsit.');
    const apartmentIds = Array.from(new Set([resident.apartmentId, ...resident.apartmentResidents.map((r) => r.apartmentId)].filter(Boolean))) as string[];
    const [invoices, payments, meters, meterReadings, requests, notifications] = await Promise.all([
      this.prisma.residentInvoice.findMany({ where: { organizationId: associationId, apartmentId: { in: apartmentIds } } }),
      this.prisma.payment.findMany({ where: { organizationId: associationId, apartmentId: { in: apartmentIds } }, include: { invoice: true } }),
      this.prisma.meter.findMany({ where: { organizationId: associationId, apartmentId: { in: apartmentIds } } }),
      this.prisma.meterReading.findMany({ where: { organizationId: associationId, apartmentId: { in: apartmentIds } } }),
      this.prisma.issue.findMany({ where: { organizationId: associationId, OR: [{ residentId }, { apartmentId: { in: apartmentIds } }] } }),
      this.prisma.notification.findMany({ where: { organizationId: associationId, userId: resident.userId || '__none__' }, take: 500, orderBy: { createdAt: 'desc' } }),
    ]);
    return this.sanitizeExportData({ resident, apartments: apartmentIds, invoices, payments, meters, meterReadings, requests, notifications });
  }

  private async resolveResidentId(scope: string, actor: Actor, dto: CreateDataExportDto) {
    if (!RESIDENT_EXPORT_SET.has(dto.exportType)) return dto.residentId || null;
    if (scope === 'RESIDENT') return (await this.getResidentScope(actor)).residentIds[0] || null;
    if (!dto.residentId) throw new BadRequestException('residentId este obligatoriu pentru export resident.');
    const resident = await this.prisma.residentProfile.findFirst({ where: { id: dto.residentId, ...(scope === 'ADMIN' ? { organizationId: this.requireOrg(actor) } : {}) } });
    if (!resident) throw new NotFoundException('Residentul nu a fost găsit.');
    return resident.id;
  }

  private async getResidentScope(actor: Actor) {
    const userId = this.actorId(actor);
    if (!userId) throw new ForbiddenException('Resident invalid.');
    const profiles = await this.prisma.residentProfile.findMany({ where: { userId, organizationId: this.requireOrg(actor) }, include: { apartmentResidents: true } });
    const apartmentIds = new Set<string>();
    profiles.forEach((profile) => {
      if (profile.apartmentId) apartmentIds.add(profile.apartmentId);
      profile.apartmentResidents.forEach((item) => apartmentIds.add(item.apartmentId));
    });
    return { residentIds: profiles.map((p) => p.id), apartmentIds: [...apartmentIds] };
  }

  private async exportAccessWhere(id: string, scope: 'SUPERADMIN' | 'ADMIN' | 'RESIDENT', actor: Actor) {
    if (scope === 'SUPERADMIN') return { id };
    if (scope === 'ADMIN') return { id, associationId: this.requireOrg(actor) };
    const residentScope = await this.getResidentScope(actor);
    return { id, associationId: this.requireOrg(actor), residentId: residentScope.residentIds.length ? { in: residentScope.residentIds } : '__none__' } as any;
  }

  private assertExportTypeAllowed(scope: string, exportType: DataExportType) {
    if (scope === 'RESIDENT' && !RESIDENT_EXPORT_SET.has(exportType)) throw new ForbiddenException('Resident poate exporta doar datele proprii.');
    if (scope === 'ADMIN' && exportType === DataExportType.AUDIT_EXPORT) throw new ForbiddenException('Audit export este disponibil doar Superadmin în MVP.');
  }

  private requireOrg(actor: Actor) {
    if (!actor.organizationId) throw new ForbiddenException('Organization context missing');
    return actor.organizationId;
  }

  private requestInclude() {
    return {
      association: { select: { id: true, name: true, legalName: true } },
      requesterUser: { select: { id: true, email: true, fullName: true, phone: true } },
      requesterResident: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      reviewedBy: { select: { id: true, email: true, fullName: true } },
      completedBy: { select: { id: true, email: true, fullName: true } },
      cancelledBy: { select: { id: true, email: true, fullName: true } },
    };
  }

  private exportInclude() {
    return {
      association: { select: { id: true, name: true, legalName: true } },
      requestedBy: { select: { id: true, email: true, fullName: true } },
      resident: { select: { id: true, firstName: true, lastName: true, email: true } },
      dataRequest: { select: { id: true, title: true, type: true, status: true } },
    };
  }

  private retentionWarning(type: DataRequestType) {
    if (type !== DataRequestType.DELETION && type !== DataRequestType.ANONYMIZATION) return null;
    return 'Execuția nu este automată. Facturile, plățile și auditul pot avea obligații de păstrare conform politicilor de retenție.';
  }

  private includedEntities(type: DataExportType) {
    const map: Record<string, string[]> = {
      ASSOCIATION_APARTMENTS_EXPORT: ['apartments', 'buildings', 'staircases'],
      ASSOCIATION_RESIDENTS_EXPORT: ['residents', 'apartmentResidentRelations'],
      ASSOCIATION_FINANCIAL_EXPORT: ['residentInvoices', 'payments'],
      ASSOCIATION_METERS_EXPORT: ['meters', 'meterReadings'],
      ASSOCIATION_FULL_EXPORT: ['association', 'apartments', 'residents', 'meters', 'meterReadings', 'invoices', 'payments', 'announcements', 'requests'],
      RESIDENT_PERSONAL_EXPORT: ['resident', 'apartments', 'invoices', 'payments', 'meters', 'requests', 'notifications'],
      RESIDENT_FINANCIAL_EXPORT: ['invoices', 'payments'],
      RESIDENT_METER_EXPORT: ['meters', 'meterReadings'],
      AUDIT_EXPORT: ['auditLogs'],
      CUSTOM_EXPORT: ['custom'],
    };
    return map[type] || [];
  }

  private exportMetadata(job: any) {
    return { exportedAt: new Date().toISOString(), exportType: job.exportType, format: job.format, associationId: job.associationId, residentId: job.residentId, includedEntities: this.includedEntities(job.exportType) };
  }

  private fileName(type: DataExportType, format: DataExportFormat, id: string) {
    const ext = format === DataExportFormat.JSON ? 'json' : 'csv';
    return `${String(type).toLowerCase()}-${id}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  }

  private buildCsv(headers: string[], rows: Record<string, unknown>[]) {
    const lines = [`\uFEFF${headers.join(';')}`];
    rows.forEach((row) => lines.push(headers.map((header) => this.escapeCsvValue((row as any)[header])).join(';')));
    return `${lines.join('\n')}\n`;
  }

  private escapeCsvValue(value: unknown) {
    if (value === null || value === undefined) return '';
    let text = String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  private toJson(value: unknown) {
    return JSON.stringify(this.sanitizeExportData(value), null, 2);
  }

  sanitizeExportData(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sanitizeExportData(item));
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
          if (SECRET_KEYS.some((secret) => key.toLowerCase().includes(secret.toLowerCase()))) return [key, '[REDACTED]'];
          if (['internalNotes', 'rawHeaders', 'authorizationHeader'].includes(key)) return [key, '[REDACTED]'];
          return [key, this.sanitizeExportData(nested)];
        }),
      );
    }
    return value;
  }

  private async addExportEvent(exportJobId: string, actorUserId: string | null, eventType: DataExportEventType, title: string, message: string, metadata: Record<string, unknown>) {
    await this.prisma.dataExportEvent.create({ data: { exportJobId, actorUserId, eventType, title, message, metadata: metadata as Prisma.InputJsonValue } });
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
          newValuesJson: (this.sanitizeExportData(metadata || {}) || {}) as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Export audit must not break the user flow.
    }
  }
}
