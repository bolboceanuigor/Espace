import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminIssueFiltersDto,
  AdminUpdateIssueDto,
  CreateIssueAttachmentDto,
  CreateIssueCommentDto,
  CreateResidentIssueDto,
  ResidentIssueFiltersDto,
} from './dto/issues.dto';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private isSuperAdmin(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    return role === 'SUPERADMIN' || role === 'SUPER_ADMIN';
  }

  private assertAdmin(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'ADMIN') throw new ForbiddenException('Admin access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.userId(user) };
  }

  private assertResident(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'RESIDENT') throw new ForbiddenException('Resident access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.userId(user) };
  }

  private async residentApartmentScope(organizationId: string, userId: string) {
    const profiles = await this.prisma.residentProfile.findMany({
      where: { organizationId, userId },
      select: { apartmentId: true },
    });
    return profiles.map((profile) => profile.apartmentId);
  }

  private async notifyAdminUsers(organizationId: string, title: string, message: string, link: string) {
    const adminUsers = await this.prisma.user.findMany({
      where: { organizationId, role: Role.ADMIN, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!adminUsers.length) return;
    await this.notificationsService.notifyUsers({
      organizationId,
      userIds: adminUsers.map((admin) => admin.id),
      title,
      message,
      type: NotificationType.ISSUE,
      link,
    });
  }

  private async notifyIssueResident(issueId: string, title: string, message: string, link: string) {
    const issue = await this.prisma.issue.findUnique({ where: { id: issueId }, select: { organizationId: true, createdByUserId: true } });
    if (!issue?.createdByUserId) return;
    await this.notificationsService.createNotification({
      organizationId: issue.organizationId,
      userId: issue.createdByUserId,
      title,
      message,
      type: NotificationType.ISSUE,
      link,
    });
  }

  private async privacySettings(organizationId: string) {
    return (
      (await this.prisma.privacySettings.findUnique({ where: { organizationId } })) || {
        showResidentNamesInCommunity: false,
        showApartmentNumbersInCommunity: false,
        allowResidentsToContactEachOther: false,
        showIssueReporterName: false,
      }
    );
  }

  async residentList(user: AuthUser, filters: ResidentIssueFiltersDto) {
    const { organizationId, userId } = this.assertResident(user);
    const apartmentIds = await this.residentApartmentScope(organizationId, userId);
    const settings = await this.privacySettings(organizationId);
    const rows = await this.prisma.issue.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status } : {}),
        OR: [{ createdByUserId: userId }, { apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } }],
      },
      include: {
        apartment: { select: { id: true, number: true } },
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (settings.showApartmentNumbersInCommunity) return rows;
    return rows.map((row) => ({ ...row, apartment: row.apartment ? { ...row.apartment, number: null } : null }));
  }

  async residentCreate(user: AuthUser, dto: CreateResidentIssueDto) {
    const { organizationId, userId } = this.assertResident(user);
    const apartmentIds = await this.residentApartmentScope(organizationId, userId);

    if (dto.locationType === 'APARTMENT') {
      if (!dto.apartmentId) throw new BadRequestException('apartmentId is required for APARTMENT location');
      if (!apartmentIds.includes(dto.apartmentId)) throw new ForbiddenException('You can report only for your apartments');
    }

    if (dto.apartmentId) {
      const apartment = await this.prisma.apartment.findFirst({ where: { id: dto.apartmentId, organizationId }, select: { id: true } });
      if (!apartment) throw new BadRequestException('Apartment not found in organization');
    }
    if (dto.buildingId) {
      const building = await this.prisma.building.findFirst({ where: { id: dto.buildingId, organizationId }, select: { id: true } });
      if (!building) throw new BadRequestException('Building not found in organization');
    }
    if (dto.staircaseId) {
      const staircase = await this.prisma.staircase.findFirst({ where: { id: dto.staircaseId, organizationId }, select: { id: true } });
      if (!staircase) throw new BadRequestException('Staircase not found in organization');
    }

    const issue = await this.prisma.issue.create({
      data: {
        organizationId,
        apartmentId: dto.apartmentId || null,
        buildingId: dto.buildingId || null,
        staircaseId: dto.staircaseId || null,
        createdByUserId: userId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        category: dto.category,
        locationType: dto.locationType,
        status: 'NEW',
        priority: dto.priority,
      },
    });
    await this.notifyAdminUsers(
      organizationId,
      `Sesizare noua: ${issue.title}`,
      `A fost raportata o sesizare noua de un resident.`,
      `/admin/issues/${issue.id}`,
    );
    await this.auditService.logCreate(
      { userId, organizationId },
      'ISSUE',
      issue.id,
      issue,
      'Created issue',
    );
    return issue;
  }

  async residentGetOne(user: AuthUser, id: string) {
    const { organizationId, userId } = this.assertResident(user);
    const apartmentIds = await this.residentApartmentScope(organizationId, userId);
    const settings = await this.privacySettings(organizationId);
    const issue = await this.prisma.issue.findFirst({
      where: {
        id,
        organizationId,
        OR: [{ createdByUserId: userId }, { apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } }],
      },
      include: {
        apartment: { select: { id: true, number: true } },
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        comments: { where: { isInternal: false }, include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } }, orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    const assets = await this.prisma.fileAsset.findMany({
      where: { organizationId, entityType: 'ISSUE_ATTACHMENT' },
      select: { id: true, fileUrl: true, entityId: true },
    });
    const byEntityId = new Map(assets.filter((a) => a.entityId).map((a) => [a.entityId as string, a.id]));
    const byUrl = new Map(assets.map((a) => [a.fileUrl, a.id]));
    const sanitizedComments = (issue.comments || []).map((comment: any) => ({
      ...comment,
      user: settings.showIssueReporterName || settings.showResidentNamesInCommunity
        ? comment.user
        : { id: comment.user?.id, firstName: null, lastName: null, role: comment.user?.role },
    }));
    return {
      ...issue,
      apartment: settings.showApartmentNumbersInCommunity ? issue.apartment : issue.apartment ? { ...issue.apartment, number: null } : null,
      comments: sanitizedComments,
      attachments: (issue.attachments || []).map((att: any) => ({
        ...att,
        fileAssetId: byEntityId.get(issue.id) || byUrl.get(att.fileUrl) || null,
      })),
    };
  }

  async residentAddComment(user: AuthUser, id: string, dto: CreateIssueCommentDto) {
    const { organizationId, userId } = this.assertResident(user);
    const apartmentIds = await this.residentApartmentScope(organizationId, userId);
    const issue = await this.prisma.issue.findFirst({
      where: { id, organizationId, OR: [{ createdByUserId: userId }, { apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } }] },
      select: { id: true, title: true },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    const comment = await this.prisma.issueComment.create({
      data: { issueId: id, userId, message: dto.message.trim(), isInternal: false },
    });
    await this.notifyAdminUsers(organizationId, `Comentariu nou: ${issue.title}`, 'Un resident a adaugat un comentariu.', `/admin/issues/${id}`);
    return comment;
  }

  async residentAddAttachment(user: AuthUser, id: string, dto: CreateIssueAttachmentDto) {
    const { organizationId, userId } = this.assertResident(user);
    const apartmentIds = await this.residentApartmentScope(organizationId, userId);
    const issue = await this.prisma.issue.findFirst({
      where: { id, organizationId, OR: [{ createdByUserId: userId }, { apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } }] },
      select: { id: true },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    const created = await this.prisma.issueAttachment.create({
      data: {
        issueId: id,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        fileType: dto.fileType,
        uploadedByUserId: userId,
      },
    });
    await this.prisma.fileAsset.updateMany({
      where: { organizationId, entityType: 'ISSUE_ATTACHMENT', fileUrl: dto.fileUrl, entityId: null },
      data: { entityId: id },
    });
    return created;
  }

  async adminList(user: AuthUser, filters: AdminIssueFiltersDto) {
    const { organizationId } = this.assertAdmin(user);
    const where: Prisma.IssueWhereInput = {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.buildingId ? { buildingId: filters.buildingId } : {}),
      ...(filters.staircaseId ? { staircaseId: filters.staircaseId } : {}),
      ...(filters.apartmentId ? { apartmentId: filters.apartmentId } : {}),
    };
    const usePagination = filters.page !== undefined || filters.limit !== undefined;
    const { page, limit, skip } = resolvePagination(filters, 20, 100);
    const [rows, total] = await Promise.all([
      this.prisma.issue.findMany({
      where,
      include: {
        apartment: { select: { id: true, number: true } },
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...(usePagination ? { skip, take: limit } : {}),
    }),
      this.prisma.issue.count({ where }),
    ]);
    if (!usePagination) return rows;
    return { data: rows, ...buildPaginationMeta(page, limit, total) };
  }

  async adminGetOne(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const issue = await this.prisma.issue.findFirst({
      where: { id, organizationId },
      include: {
        apartment: { select: { id: true, number: true } },
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        comments: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } }, orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    const assets = await this.prisma.fileAsset.findMany({
      where: { organizationId, entityType: 'ISSUE_ATTACHMENT' },
      select: { id: true, fileUrl: true, entityId: true },
    });
    const byEntityId = new Map(assets.filter((a) => a.entityId).map((a) => [a.entityId as string, a.id]));
    const byUrl = new Map(assets.map((a) => [a.fileUrl, a.id]));
    return {
      ...issue,
      attachments: (issue.attachments || []).map((att: any) => ({
        ...att,
        fileAssetId: byEntityId.get(issue.id) || byUrl.get(att.fileUrl) || null,
      })),
    };
  }

  async adminUpdate(user: AuthUser, id: string, dto: AdminUpdateIssueDto) {
    const { organizationId } = this.assertAdmin(user);
    const issue = await this.prisma.issue.findFirst({ where: { id, organizationId }, select: { id: true, title: true } });
    if (!issue) throw new NotFoundException('Issue not found');

    if (dto.assignedToUserId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: dto.assignedToUserId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!assignee) throw new BadRequestException('Assigned user not found in organization');
    }

    const previous = await this.prisma.issue.findUnique({ where: { id } });
    const updated = await this.prisma.issue.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.assignedToUserId !== undefined ? { assignedToUserId: dto.assignedToUserId || null } : {}),
        ...(dto.status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
      },
    });

    if (dto.status || dto.priority || dto.assignedToUserId !== undefined) {
      await this.notifyIssueResident(
        id,
        `Actualizare sesizare: ${issue.title}`,
        `Status: ${updated.status}, prioritate: ${updated.priority}.`,
        `/resident/issues/${id}`,
      );
    }
    await this.auditService.logUpdate(
      { userId: this.userId(user), organizationId },
      'ISSUE',
      updated.id,
      previous,
      updated,
      'Updated issue',
    );

    return updated;
  }

  async adminAddComment(user: AuthUser, id: string, dto: CreateIssueCommentDto) {
    const { organizationId, userId } = this.assertAdmin(user);
    const issue = await this.prisma.issue.findFirst({ where: { id, organizationId }, select: { id: true, title: true } });
    if (!issue) throw new NotFoundException('Issue not found');
    const comment = await this.prisma.issueComment.create({
      data: {
        issueId: id,
        userId,
        message: dto.message.trim(),
        isInternal: Boolean(dto.isInternal),
      },
    });
    if (!comment.isInternal) {
      await this.notifyIssueResident(id, `Comentariu la sesizare: ${issue.title}`, 'Administratorul a adaugat un comentariu.', `/resident/issues/${id}`);
    }
    return comment;
  }

  async adminDelete(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const issue = await this.prisma.issue.findFirst({ where: { id, organizationId } });
    if (!issue) throw new NotFoundException('Issue not found');
    await this.prisma.issue.delete({ where: { id } });
    await this.auditService.logDelete(
      { userId: this.userId(user), organizationId },
      'ISSUE',
      id,
      issue,
      'Deleted issue',
    );
    return { ok: true };
  }

  async superadminOverview(user: AuthUser) {
    if (!this.isSuperAdmin(user)) throw new ForbiddenException('Super admin access required');
    const [totalIssues, openIssues, urgentIssues, resolvedThisMonth, byOrg] = await Promise.all([
      this.prisma.issue.count(),
      this.prisma.issue.count({ where: { status: { in: ['NEW', 'IN_PROGRESS', 'WAITING'] } } }),
      this.prisma.issue.count({ where: { priority: 'URGENT' } }),
      this.prisma.issue.count({
        where: {
          status: 'RESOLVED',
          resolvedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      this.prisma.issue.groupBy({ by: ['organizationId'], _count: { _all: true }, orderBy: { _count: { organizationId: 'desc' } } }),
    ]);

    const orgIds = byOrg.map((row) => row.organizationId);
    const organizations = orgIds.length
      ? await this.prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } })
      : [];
    const orgNameMap = new Map(organizations.map((org) => [org.id, org.name]));

    return {
      totalIssues,
      openIssues,
      urgentIssues,
      resolvedThisMonth,
      issuesByOrganization: byOrg.map((row) => ({
        organizationId: row.organizationId,
        organizationName: orgNameMap.get(row.organizationId) || 'Unknown',
        count: row._count._all,
      })),
    };
  }
}
