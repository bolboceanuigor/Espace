import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementCommentStatus, ContentTargetType, NotificationType, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { LimitsService } from '../limits/limits.service';
import {
  CreateAnnouncementCommentDto,
  CreateAnnouncementDto,
  CreateDocumentDto,
  ListAdminAnnouncementsDto,
  UpdateAnnouncementCommentDto,
  UpdateAnnouncementDto,
  UpdateDocumentDto,
} from './dto/communications.dto';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly limitsService: LimitsService,
  ) {}

  private assertAdmin(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: user.id || user.sub || '' };
  }

  private assertResident(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (role !== 'RESIDENT' && role !== 'RESIDENT') {
      throw new ForbiddenException('Resident access required');
    }
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: user.id || user.sub || '', role };
  }

  private async residentScope(organizationId: string, userId: string) {
    const profiles = await this.prisma.residentProfile.findMany({
      where: { organizationId, userId },
      include: { apartment: { select: { id: true, buildingId: true, staircaseId: true } } },
    });
    return {
      apartmentIds: profiles.map((profile) => profile.apartmentId),
      buildingIds: profiles.map((profile) => profile.apartment.buildingId),
      staircaseIds: profiles.map((profile) => profile.apartment.staircaseId),
    };
  }

  private async residentVisibleAnnouncement(organizationId: string, userId: string, announcementId: string) {
    const scope = await this.residentScope(organizationId, userId);
    return this.prisma.announcement.findFirst({
      where: {
        id: announcementId,
        ...this.residentVisibilityWhere(organizationId, scope.buildingIds, scope.staircaseIds, scope.apartmentIds),
      },
      select: { id: true, title: true, organizationId: true },
    });
  }

  private async getPrivacySettings(organizationId: string) {
    return (
      (await this.prisma.privacySettings.findUnique({ where: { organizationId } })) || {
        showResidentNamesInCommunity: false,
        showApartmentNumbersInCommunity: false,
      }
    );
  }

  private residentAuthorView(comment: any, showNames: boolean, showApartments: boolean) {
    const apartmentNumber = showApartments ? (comment.user?.residentProfiles?.[0]?.apartment?.number ?? null) : null;
    if (!showNames) {
      return {
        id: comment.user?.id || null,
        displayName: 'Locatar',
        apartmentNumber,
      };
    }
    const firstName = (comment.user?.firstName || '').trim();
    const lastName = (comment.user?.lastName || '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    return {
      id: comment.user?.id || null,
      displayName: fullName || comment.user?.email || 'Locatar',
      apartmentNumber,
    };
  }

  private async assertTargetInOrg(
    organizationId: string,
    targetType: ContentTargetType,
    buildingId?: string | null,
    staircaseId?: string | null,
    apartmentId?: string | null,
  ) {
    if (targetType === 'ORGANIZATION') return;
    if (targetType === 'BUILDING') {
      if (!buildingId) throw new BadRequestException('buildingId is required');
      const building = await this.prisma.building.findFirst({ where: { id: buildingId, organizationId }, select: { id: true } });
      if (!building) throw new BadRequestException('Building not found in organization');
      return;
    }
    if (targetType === 'STAIRCASE') {
      if (!staircaseId) throw new BadRequestException('staircaseId is required');
      const staircase = await this.prisma.staircase.findFirst({ where: { id: staircaseId, organizationId }, select: { id: true } });
      if (!staircase) throw new BadRequestException('Staircase not found in organization');
      return;
    }
    if (!apartmentId) throw new BadRequestException('apartmentId is required');
    const apartment = await this.prisma.apartment.findFirst({ where: { id: apartmentId, organizationId }, select: { id: true } });
    if (!apartment) throw new BadRequestException('Apartment not found in organization');
  }

  private async targetResidentUserIds(organizationId: string, targetType: ContentTargetType, buildingId?: string | null, staircaseId?: string | null, apartmentId?: string | null) {
    const where: Prisma.ResidentProfileWhereInput = { organizationId };
    if (targetType === 'BUILDING') where.apartment = { buildingId: buildingId || undefined };
    if (targetType === 'STAIRCASE') where.apartment = { staircaseId: staircaseId || undefined };
    if (targetType === 'APARTMENT') where.apartmentId = apartmentId || undefined;
    const profiles = await this.prisma.residentProfile.findMany({
      where,
      select: { userId: true },
      distinct: ['userId'],
    });
    return profiles.map((profile) => profile.userId);
  }

  private residentVisibilityWhere(organizationId: string, buildingIds: string[], staircaseIds: string[], apartmentIds: string[]) {
    return {
      organizationId,
      OR: [
        { targetType: ContentTargetType.ORGANIZATION },
        { targetType: ContentTargetType.BUILDING, buildingId: { in: buildingIds.length ? buildingIds : ['__none__'] } },
        { targetType: ContentTargetType.STAIRCASE, staircaseId: { in: staircaseIds.length ? staircaseIds : ['__none__'] } },
        { targetType: ContentTargetType.APARTMENT, apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } },
      ],
    };
  }

  async listAdminAnnouncements(user: AuthUser, query?: ListAdminAnnouncementsDto) {
    const { organizationId } = this.assertAdmin(user);
    return (this.prisma as any).announcement.findMany({
      where: {
        organizationId,
        ...(query?.contentType ? { contentType: query.contentType } : {}),
        ...(query?.importance ? { importance: query.importance } : {}),
        ...(query?.targetType ? { targetType: query.targetType } : {}),
        ...(query?.pinned !== undefined ? { isPinned: query.pinned === 'true' } : {}),
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        apartment: { select: { id: true, number: true } },
        _count: { select: { comments: true } },
      },
    });
  }

  async createAdminAnnouncement(user: AuthUser, dto: CreateAnnouncementDto) {
    const { organizationId, userId } = this.assertAdmin(user);
    await this.assertTargetInOrg(organizationId, dto.targetType as ContentTargetType, dto.buildingId, dto.staircaseId, dto.apartmentId);
    const announcement = await (this.prisma as any).announcement.create({
      data: {
        organizationId,
        title: dto.title.trim(),
        content: dto.content.trim(),
        contentType: dto.contentType || 'ANNOUNCEMENT',
        importance: dto.importance,
        isPinned: dto.isPinned === 'true',
        commentsEnabled: dto.commentsEnabled !== 'false',
        targetType: dto.targetType,
        buildingId: dto.buildingId || null,
        staircaseId: dto.staircaseId || null,
        apartmentId: dto.apartmentId || null,
        createdByUserId: userId,
      },
    });
    const residentUserIds = await this.targetResidentUserIds(organizationId, dto.targetType as ContentTargetType, dto.buildingId, dto.staircaseId, dto.apartmentId);
    if (residentUserIds.length) {
      await this.notificationsService.notifyUsers({
        organizationId,
        userIds: residentUserIds,
        title: dto.title.trim(),
        message: dto.content.trim().slice(0, 240),
        type: NotificationType.ANNOUNCEMENT,
        link: '/resident/announcements',
      });
    }
    await this.auditService.logCreate(
      { userId, organizationId },
      'ANNOUNCEMENT',
      announcement.id,
      announcement,
      'Created announcement',
    );
    return announcement;
  }

  async updateAdminAnnouncement(user: AuthUser, id: string, dto: UpdateAnnouncementDto) {
    const { organizationId } = this.assertAdmin(user);
    const existing = await this.prisma.announcement.findFirst({ where: { id, organizationId }, select: { id: true, targetType: true } });
    if (!existing) throw new NotFoundException('Announcement not found');
    const targetType = (dto.targetType || existing.targetType) as ContentTargetType;
    await this.assertTargetInOrg(organizationId, targetType, dto.buildingId, dto.staircaseId, dto.apartmentId);
    const previous = await this.prisma.announcement.findUnique({ where: { id } });
    const updated = await (this.prisma as any).announcement.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
        ...(dto.contentType !== undefined ? { contentType: dto.contentType } : {}),
        ...(dto.importance !== undefined ? { importance: dto.importance } : {}),
        ...(dto.isPinned !== undefined ? { isPinned: dto.isPinned === 'true' } : {}),
        ...(dto.commentsEnabled !== undefined ? { commentsEnabled: dto.commentsEnabled === 'true' } : {}),
        ...(dto.targetType !== undefined ? { targetType: dto.targetType } : {}),
        ...(dto.buildingId !== undefined ? { buildingId: dto.buildingId || null } : {}),
        ...(dto.staircaseId !== undefined ? { staircaseId: dto.staircaseId || null } : {}),
        ...(dto.apartmentId !== undefined ? { apartmentId: dto.apartmentId || null } : {}),
      },
    });
    await this.auditService.logUpdate(
      { userId: this.assertAdmin(user).userId, organizationId },
      'ANNOUNCEMENT',
      updated.id,
      previous,
      updated,
      'Updated announcement',
    );
    return updated;
  }

  async deleteAdminAnnouncement(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const existing = await this.prisma.announcement.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { id } });
    await this.auditService.logDelete(
      { userId: this.assertAdmin(user).userId, organizationId },
      'ANNOUNCEMENT',
      id,
      existing,
      'Deleted announcement',
    );
    return { ok: true };
  }

  async pinAdminAnnouncement(user: AuthUser, id: string, isPinned?: boolean) {
    const { organizationId } = this.assertAdmin(user);
    const existing = await this.prisma.announcement.findFirst({ where: { id, organizationId }, select: { id: true, isPinned: true } as any });
    if (!existing) throw new NotFoundException('Announcement not found');
    return (this.prisma as any).announcement.update({
      where: { id },
      data: { isPinned: isPinned ?? !existing.isPinned },
    });
  }

  async toggleAdminAnnouncementComments(user: AuthUser, id: string, commentsEnabled?: boolean) {
    const { organizationId } = this.assertAdmin(user);
    const existing = await this.prisma.announcement.findFirst({ where: { id, organizationId }, select: { id: true, commentsEnabled: true } as any });
    if (!existing) throw new NotFoundException('Announcement not found');
    return (this.prisma as any).announcement.update({
      where: { id },
      data: { commentsEnabled: commentsEnabled ?? !existing.commentsEnabled },
    });
  }

  async listAdminDocuments(user: AuthUser, query: { page?: number; limit?: number }) {
    const { organizationId } = this.assertAdmin(user);
    const where = { organizationId };
    const usePagination = query.page !== undefined || query.limit !== undefined;
    const { page, limit, skip } = resolvePagination(query, 20, 100);
    const [docs, total, assets] = await Promise.all([
      this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(usePagination ? { skip, take: limit } : {}),
      include: {
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        apartment: { select: { id: true, number: true } },
      },
    }),
      this.prisma.document.count({ where }),
      this.prisma.fileAsset.findMany({
      where: { organizationId, entityType: 'DOCUMENT' },
      select: { id: true, fileUrl: true, entityId: true },
    }),
    ]);
    const byEntityId = new Map(assets.filter((a) => a.entityId).map((a) => [a.entityId as string, a.id]));
    const byUrl = new Map(assets.map((a) => [a.fileUrl, a.id]));
    const mapped = docs.map((doc) => ({ ...doc, fileAssetId: byEntityId.get(doc.id) || byUrl.get(doc.fileUrl) || null }));
    if (!usePagination) return mapped;
    return { data: mapped, ...buildPaginationMeta(page, limit, total) };
  }

  async createAdminDocument(user: AuthUser, dto: CreateDocumentDto) {
    const { organizationId, userId } = this.assertAdmin(user);
    await this.limitsService.assertModuleEnabled(user, organizationId, 'documents');
    await this.limitsService.assertStorageAllowance(user, organizationId, 1);
    await this.assertTargetInOrg(organizationId, dto.targetType as ContentTargetType, dto.buildingId, dto.staircaseId, dto.apartmentId);
    const document = await this.prisma.document.create({
      data: {
        organizationId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        fileType: dto.fileType,
        targetType: dto.targetType,
        buildingId: dto.buildingId || null,
        staircaseId: dto.staircaseId || null,
        apartmentId: dto.apartmentId || null,
        uploadedByUserId: userId,
      },
    });
    await this.prisma.fileAsset.updateMany({
      where: { organizationId, entityType: 'DOCUMENT', fileUrl: dto.fileUrl, entityId: null },
      data: { entityId: document.id },
    });
    const residentUserIds = await this.targetResidentUserIds(organizationId, dto.targetType as ContentTargetType, dto.buildingId, dto.staircaseId, dto.apartmentId);
    if (residentUserIds.length) {
      await this.notificationsService.notifyUsers({
        organizationId,
        userIds: residentUserIds,
        title: dto.title.trim(),
        message: dto.description?.trim() || 'Document nou disponibil',
        type: NotificationType.DOCUMENT,
        link: '/resident/documents',
      });
    }
    await this.auditService.logCreate(
      { userId, organizationId },
      'DOCUMENT',
      document.id,
      document,
      'Created document',
    );
    return document;
  }

  async updateAdminDocument(user: AuthUser, id: string, dto: UpdateDocumentDto) {
    const { organizationId } = this.assertAdmin(user);
    const existing = await this.prisma.document.findFirst({ where: { id, organizationId }, select: { id: true, targetType: true } });
    if (!existing) throw new NotFoundException('Document not found');
    const targetType = (dto.targetType || existing.targetType) as ContentTargetType;
    await this.assertTargetInOrg(organizationId, targetType, dto.buildingId, dto.staircaseId, dto.apartmentId);
    const previous = await this.prisma.document.findUnique({ where: { id } });
    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.fileUrl !== undefined ? { fileUrl: dto.fileUrl } : {}),
        ...(dto.fileName !== undefined ? { fileName: dto.fileName } : {}),
        ...(dto.fileType !== undefined ? { fileType: dto.fileType } : {}),
        ...(dto.targetType !== undefined ? { targetType: dto.targetType } : {}),
        ...(dto.buildingId !== undefined ? { buildingId: dto.buildingId || null } : {}),
        ...(dto.staircaseId !== undefined ? { staircaseId: dto.staircaseId || null } : {}),
        ...(dto.apartmentId !== undefined ? { apartmentId: dto.apartmentId || null } : {}),
      },
    });
    await this.auditService.logUpdate(
      { userId: this.assertAdmin(user).userId, organizationId },
      'DOCUMENT',
      updated.id,
      previous,
      updated,
      'Updated document',
    );
    return updated;
  }

  async deleteAdminDocument(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const existing = await this.prisma.document.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Document not found');
    await this.prisma.document.delete({ where: { id } });
    await this.auditService.logDelete(
      { userId: this.assertAdmin(user).userId, organizationId },
      'DOCUMENT',
      id,
      existing,
      'Deleted document',
    );
    return { ok: true };
  }

  async listResidentAnnouncements(user: AuthUser) {
    const { organizationId, userId } = this.assertResident(user);
    const { apartmentIds, buildingIds, staircaseIds } = await this.residentScope(organizationId, userId);
    return (this.prisma as any).announcement.findMany({
      where: this.residentVisibilityWhere(organizationId, buildingIds, staircaseIds, apartmentIds),
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        apartment: { select: { id: true, number: true } },
        _count: { select: { comments: true } },
      },
    });
  }

  async getResidentAnnouncement(user: AuthUser, announcementId: string) {
    const { organizationId, userId } = this.assertResident(user);
    const scope = await this.residentScope(organizationId, userId);
    const row = await (this.prisma as any).announcement.findFirst({
      where: {
        id: announcementId,
        ...this.residentVisibilityWhere(organizationId, scope.buildingIds, scope.staircaseIds, scope.apartmentIds),
      },
      include: {
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        apartment: { select: { id: true, number: true } },
        _count: { select: { comments: true } },
      },
    });
    if (!row) throw new NotFoundException('Announcement not found');
    return row;
  }

  async listResidentAnnouncementComments(user: AuthUser, announcementId: string) {
    const { organizationId, userId } = this.assertResident(user);
    const visibleAnnouncement = await this.residentVisibleAnnouncement(organizationId, userId, announcementId);
    if (!visibleAnnouncement) throw new NotFoundException('Announcement not found');
    const announcement = await (this.prisma as any).announcement.findUnique({ where: { id: announcementId }, select: { commentsEnabled: true } });
    if (!announcement?.commentsEnabled) throw new ForbiddenException('Comments are disabled for this post');
    const settings = await this.getPrivacySettings(organizationId);
    const comments = await this.prisma.announcementComment.findMany({
      where: {
        organizationId,
        announcementId,
        status: { notIn: [AnnouncementCommentStatus.DELETED, AnnouncementCommentStatus.HIDDEN] },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            residentProfiles: {
              where: { organizationId },
              take: 1,
              select: { apartment: { select: { number: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return comments.map((comment) => ({
      id: comment.id,
      announcementId: comment.announcementId,
      organizationId: comment.organizationId,
      content: comment.content,
      status: comment.status,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      userId: comment.userId,
      author: this.residentAuthorView(
        comment,
        settings.showResidentNamesInCommunity,
        settings.showApartmentNumbersInCommunity,
      ),
      isOwn: comment.userId === userId,
    }));
  }

  async createResidentAnnouncementComment(user: AuthUser, announcementId: string, dto: CreateAnnouncementCommentDto) {
    const { organizationId, userId } = this.assertResident(user);
    const visibleAnnouncement = await this.residentVisibleAnnouncement(organizationId, userId, announcementId);
    if (!visibleAnnouncement) throw new NotFoundException('Announcement not found');
    const comment = await this.prisma.announcementComment.create({
      data: {
        organizationId,
        announcementId,
        userId,
        content: dto.content.trim(),
        status: AnnouncementCommentStatus.VISIBLE,
      },
    });
    return comment;
  }

  async updateResidentAnnouncementComment(user: AuthUser, commentId: string, dto: UpdateAnnouncementCommentDto) {
    const { organizationId, userId } = this.assertResident(user);
    const existing = await this.prisma.announcementComment.findFirst({
      where: { id: commentId, organizationId },
      select: { id: true, userId: true, status: true },
    });
    if (!existing) throw new NotFoundException('Comment not found');
    if (existing.userId !== userId) throw new ForbiddenException('You can edit only your own comments');
    if (existing.status === AnnouncementCommentStatus.DELETED) throw new BadRequestException('Comment is deleted');
    return this.prisma.announcementComment.update({
      where: { id: commentId },
      data: { content: dto.content.trim() },
    });
  }

  async deleteResidentAnnouncementComment(user: AuthUser, commentId: string) {
    const { organizationId, userId } = this.assertResident(user);
    const existing = await this.prisma.announcementComment.findFirst({
      where: { id: commentId, organizationId },
      select: { id: true, userId: true },
    });
    if (!existing) throw new NotFoundException('Comment not found');
    if (existing.userId !== userId) throw new ForbiddenException('You can delete only your own comments');
    return this.prisma.announcementComment.update({
      where: { id: commentId },
      data: { status: AnnouncementCommentStatus.DELETED },
    });
  }

  async listResidentDocuments(user: AuthUser) {
    const organizationId = user.organizationId || '';
    const userId = user.id || user.sub || '';
    const profiles = await this.prisma.residentProfile.findMany({
      where: { organizationId, userId },
      include: { apartment: { select: { id: true, buildingId: true, staircaseId: true } } },
    });
    const apartmentIds = profiles.map((profile) => profile.apartmentId);
    const buildingIds = profiles.map((profile) => profile.apartment.buildingId);
    const staircaseIds = profiles.map((profile) => profile.apartment.staircaseId);
    const docs = await this.prisma.document.findMany({
      where: this.residentVisibilityWhere(organizationId, buildingIds, staircaseIds, apartmentIds),
      orderBy: { createdAt: 'desc' },
    });
    const assets = await this.prisma.fileAsset.findMany({
      where: { organizationId, entityType: 'DOCUMENT' },
      select: { id: true, fileUrl: true, entityId: true },
    });
    const byEntityId = new Map(assets.filter((a) => a.entityId).map((a) => [a.entityId as string, a.id]));
    const byUrl = new Map(assets.map((a) => [a.fileUrl, a.id]));
    return docs.map((doc) => ({ ...doc, fileAssetId: byEntityId.get(doc.id) || byUrl.get(doc.fileUrl) || null }));
  }

  async listAdminAnnouncementComments(user: AuthUser, announcementId: string) {
    const { organizationId } = this.assertAdmin(user);
    const announcement = await this.prisma.announcement.findFirst({
      where: { id: announcementId, organizationId },
      select: { id: true },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');
    return this.prisma.announcementComment.findMany({
      where: { organizationId, announcementId, status: { not: AnnouncementCommentStatus.DELETED } },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            residentProfiles: {
              where: { organizationId },
              take: 1,
              select: { apartment: { select: { number: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async adminSetAnnouncementCommentStatus(user: AuthUser, commentId: string, status: AnnouncementCommentStatus) {
    const { organizationId } = this.assertAdmin(user);
    const comment = await this.prisma.announcementComment.findFirst({
      where: { id: commentId, organizationId },
      select: { id: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return this.prisma.announcementComment.update({ where: { id: commentId }, data: { status } });
  }

  hideAdminAnnouncementComment(user: AuthUser, commentId: string) {
    return this.adminSetAnnouncementCommentStatus(user, commentId, AnnouncementCommentStatus.HIDDEN);
  }

  showAdminAnnouncementComment(user: AuthUser, commentId: string) {
    return this.adminSetAnnouncementCommentStatus(user, commentId, AnnouncementCommentStatus.VISIBLE);
  }

  deleteAdminAnnouncementComment(user: AuthUser, commentId: string) {
    return this.adminSetAnnouncementCommentStatus(user, commentId, AnnouncementCommentStatus.DELETED);
  }

  async listResidentNotifications(user: AuthUser) {
    const organizationId = user.organizationId || '';
    const userId = user.id || user.sub || '';
    return this.prisma.notification.findMany({
      where: { organizationId, userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async markResidentNotificationRead(user: AuthUser, id: string) {
    const organizationId = user.organizationId || '';
    const userId = user.id || user.sub || '';
    const notification = await this.prisma.notification.findFirst({ where: { id, organizationId, userId }, select: { id: true } });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markResidentNotificationsReadAll(user: AuthUser) {
    const organizationId = user.organizationId || '';
    const userId = user.id || user.sub || '';
    const result = await this.prisma.notification.updateMany({ where: { organizationId, userId, isRead: false }, data: { isRead: true } });
    return { ok: true, count: result.count };
  }

  async superadminActivity(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (role !== 'SUPERADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }
    const [announcements, documents, issues] = await Promise.all([
      this.prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { organization: { select: { id: true, name: true } } },
      }),
      this.prisma.document.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { organization: { select: { id: true, name: true } } },
      }),
      this.prisma.issue.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { organization: { select: { id: true, name: true } } },
      }),
    ]);

    return [...announcements.map((item) => ({
      id: item.id,
      kind: 'ANNOUNCEMENT',
      title: item.title,
      organizationId: item.organizationId,
      organizationName: item.organization.name,
      createdAt: item.createdAt,
    })), ...documents.map((item) => ({
      id: item.id,
      kind: 'DOCUMENT',
      title: item.title,
      organizationId: item.organizationId,
      organizationName: item.organization.name,
      createdAt: item.createdAt,
    })), ...issues.map((item) => ({
      id: item.id,
      kind: 'ISSUE',
      title: item.title,
      organizationId: item.organizationId,
      organizationName: item.organization.name,
      createdAt: item.createdAt,
    }))].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 80);
  }
}
