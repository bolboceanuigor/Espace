import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FeatureRequestStatus,
  FeatureRequestVisibility,
  FeedbackStatus,
  ProductReleaseStatus,
  ProductUpdatePriority,
  ProductUpdateStatus,
  ProductUpdateType,
  ProductUpdateVisibility,
  ReleaseNoteTargetRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductReleaseDto,
  CreateProductUpdateDto,
  CreateReleaseNoteDto,
  ProductReleaseFiltersDto,
  ProductUpdateFiltersDto,
  ReleaseNotesFiltersDto,
  UpdateProductReleaseDto,
  UpdateProductUpdateDto,
  UpdateReleaseNoteDto,
} from './dto/release-notes.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class ReleaseNotesService {
  constructor(private readonly prisma: PrismaService) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private normalizedRole(user: AuthUser): ReleaseNoteTargetRole {
    const role = String(user.role || '').toUpperCase();
    if (role === 'SUPERADMIN' || role === 'SUPER_ADMIN') return ReleaseNoteTargetRole.SUPER_ADMIN;
    if (role === 'RESIDENT' || role === 'TENANT') return ReleaseNoteTargetRole.RESIDENT;
    return ReleaseNoteTargetRole.ADMIN;
  }

  private assertAuthenticated(user: AuthUser) {
    const userId = this.userId(user);
    if (!userId) throw new ForbiddenException('Authentication required');
    return userId;
  }

  private assertSuperAdmin(user: AuthUser) {
    if (this.normalizedRole(user) !== ReleaseNoteTargetRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin access required');
    }
  }

  private visibleAudiencesForUser(user: AuthUser): ReleaseNoteTargetRole[] {
    return [ReleaseNoteTargetRole.ALL, this.normalizedRole(user)];
  }

  private releaseInclude(): any {
    return {
      updates: {
        orderBy: [{ publishedAt: 'desc' as const }, { createdAt: 'desc' as const }],
        include: {
          _count: { select: { acknowledgements: true } },
        },
      },
      createdBy: { select: { id: true, email: true, fullName: true } },
      publishedBy: { select: { id: true, email: true, fullName: true } },
    };
  }

  private updateInclude(userId?: string): any {
    return {
      release: { select: { id: true, version: true, title: true, status: true, publishedAt: true, releaseDate: true } },
      linkedFeatureRequest: { select: { id: true, title: true, status: true, visibility: true } },
      linkedFeedback: { select: { id: true, title: true, status: true, priority: true, type: true } },
      acknowledgements: userId
        ? { where: { userId }, select: { id: true, acknowledgedAt: true }, take: 1 }
        : false,
      _count: { select: { acknowledgements: true } },
    };
  }

  private sanitizeForAudience(item: any, role: ReleaseNoteTargetRole) {
    if (role !== ReleaseNoteTargetRole.SUPER_ADMIN) {
      if (item.linkedFeatureRequest?.visibility !== FeatureRequestVisibility.PUBLIC) {
        item.linkedFeatureRequest = null;
      }
      item.linkedFeedback = null;
    }
    return item;
  }

  async listProductUpdatesForUser(user: AuthUser, query: ReleaseNotesFiltersDto | ProductUpdateFiltersDto = {}) {
    const userId = this.assertAuthenticated(user);
    const role = this.normalizedRole(user);
    const audiences = this.visibleAudiencesForUser(user);
    const items = await this.prisma.productUpdate.findMany({
      where: {
        status: ProductUpdateStatus.PUBLISHED,
        audience: { in: audiences },
        visibility: { in: [ProductUpdateVisibility.PUBLIC_CHANGELOG, ProductUpdateVisibility.IN_APP_ONLY] },
        ...(query.audience ? { audience: query.audience as ReleaseNoteTargetRole } : {}),
        ...(query.updateType ? { updateType: query.updateType as ProductUpdateType } : {}),
        ...(query.releaseId ? { productReleaseId: query.releaseId } : {}),
      },
      include: this.updateInclude(userId),
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return items.map((item) => this.sanitizeForAudience(item, role));
  }

  async listUnreadProductUpdatesForUser(user: AuthUser) {
    const userId = this.assertAuthenticated(user);
    const role = this.normalizedRole(user);
    const audiences = this.visibleAudiencesForUser(user);
    const items = await this.prisma.productUpdate.findMany({
      where: {
        status: ProductUpdateStatus.PUBLISHED,
        audience: { in: audiences },
        visibility: { in: [ProductUpdateVisibility.PUBLIC_CHANGELOG, ProductUpdateVisibility.IN_APP_ONLY] },
        acknowledgements: { none: { userId } },
      },
      include: this.updateInclude(userId),
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 30,
    });
    return items.map((item) => this.sanitizeForAudience(item, role));
  }

  async acknowledgeProductUpdate(user: AuthUser, id: string) {
    const userId = this.assertAuthenticated(user);
    const audiences = this.visibleAudiencesForUser(user);
    const update = await this.prisma.productUpdate.findFirst({
      where: {
        id,
        status: ProductUpdateStatus.PUBLISHED,
        audience: { in: audiences },
        visibility: { in: [ProductUpdateVisibility.PUBLIC_CHANGELOG, ProductUpdateVisibility.IN_APP_ONLY] },
      },
      select: { id: true },
    });
    if (!update) throw new ForbiddenException('Product update not visible');
    await this.prisma.productUpdateAcknowledgement.upsert({
      where: { productUpdateId_userId: { productUpdateId: id, userId } },
      create: {
        productUpdateId: id,
        userId,
        organizationId: user.organizationId || null,
        userRole: this.normalizedRole(user),
      },
      update: { acknowledgedAt: new Date(), organizationId: user.organizationId || null, userRole: this.normalizedRole(user) },
    });
    return { ok: true };
  }

  async publicChangelog() {
    const items = await this.prisma.productUpdate.findMany({
      where: {
        status: ProductUpdateStatus.PUBLISHED,
        audience: ReleaseNoteTargetRole.ALL,
        visibility: ProductUpdateVisibility.PUBLIC_CHANGELOG,
      },
      include: {
        release: { select: { id: true, version: true, title: true, publishedAt: true, releaseDate: true } },
        linkedFeatureRequest: { select: { id: true, title: true, status: true, visibility: true } },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return items.map((item) => {
      if (item.linkedFeatureRequest?.visibility !== FeatureRequestVisibility.PUBLIC) {
        return { ...item, linkedFeatureRequest: null };
      }
      return item;
    });
  }

  async superadminDashboard(user: AuthUser) {
    this.assertSuperAdmin(user);
    const [drafts, published, publicChangelog, pendingAcknowledgement, releases, linkedRoadmap] = await Promise.all([
      this.prisma.productUpdate.count({ where: { status: ProductUpdateStatus.DRAFT } }),
      this.prisma.productUpdate.count({ where: { status: ProductUpdateStatus.PUBLISHED } }),
      this.prisma.productUpdate.count({ where: { status: ProductUpdateStatus.PUBLISHED, visibility: ProductUpdateVisibility.PUBLIC_CHANGELOG } }),
      this.prisma.productUpdate.count({ where: { status: ProductUpdateStatus.PUBLISHED, requiresAcknowledgement: true } }),
      this.prisma.productRelease.count({ where: { status: ProductReleaseStatus.PUBLISHED } }),
      this.prisma.productUpdate.count({ where: { linkedFeatureRequestId: { not: null } } }),
    ]);
    return { drafts, published, publicChangelog, pendingAcknowledgement, releases, linkedRoadmap };
  }

  async superadminListReleases(user: AuthUser, filters: ProductReleaseFiltersDto = {}) {
    this.assertSuperAdmin(user);
    return this.prisma.productRelease.findMany({
      where: {
        ...(filters.status ? { status: filters.status as ProductReleaseStatus } : {}),
      },
      include: this.releaseInclude(),
      orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    });
  }

  async superadminGetRelease(user: AuthUser, id: string) {
    this.assertSuperAdmin(user);
    const item = await this.prisma.productRelease.findUnique({ where: { id }, include: this.releaseInclude() });
    if (!item) throw new NotFoundException('Product release not found');
    return item;
  }

  async superadminCreateRelease(user: AuthUser, dto: CreateProductReleaseDto) {
    this.assertSuperAdmin(user);
    const status = (dto.status as ProductReleaseStatus | undefined) || ProductReleaseStatus.DRAFT;
    return this.prisma.productRelease.create({
      data: {
        version: dto.version.trim(),
        title: dto.title.trim(),
        summary: dto.summary?.trim() || null,
        status,
        releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        publicSlug: dto.publicSlug?.trim() || dto.version.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        internalNotes: dto.internalNotes?.trim() || null,
        createdById: this.userId(user) || null,
        ...(status === ProductReleaseStatus.PUBLISHED ? { publishedAt: new Date(), publishedById: this.userId(user) || null } : {}),
      },
      include: this.releaseInclude(),
    });
  }

  async superadminUpdateRelease(user: AuthUser, id: string, dto: UpdateProductReleaseDto) {
    this.assertSuperAdmin(user);
    return this.prisma.productRelease.update({
      where: { id },
      data: {
        ...(dto.version !== undefined ? { version: dto.version.trim() } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary?.trim() || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status as ProductReleaseStatus } : {}),
        ...(dto.releaseDate !== undefined ? { releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : null } : {}),
        ...(dto.scheduledAt !== undefined ? { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null } : {}),
        ...(dto.publicSlug !== undefined ? { publicSlug: dto.publicSlug?.trim() || null } : {}),
        ...(dto.internalNotes !== undefined ? { internalNotes: dto.internalNotes?.trim() || null } : {}),
      },
      include: this.releaseInclude(),
    });
  }

  async superadminPublishRelease(user: AuthUser, id: string) {
    this.assertSuperAdmin(user);
    return this.prisma.productRelease.update({
      where: { id },
      data: {
        status: ProductReleaseStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedById: this.userId(user) || null,
      },
      include: this.releaseInclude(),
    });
  }

  async superadminArchiveRelease(user: AuthUser, id: string) {
    this.assertSuperAdmin(user);
    return this.prisma.productRelease.update({
      where: { id },
      data: { status: ProductReleaseStatus.ARCHIVED },
      include: this.releaseInclude(),
    });
  }

  async superadminDeleteRelease(user: AuthUser, id: string) {
    this.assertSuperAdmin(user);
    await this.prisma.productRelease.delete({ where: { id } });
    return { ok: true };
  }

  async superadminListUpdates(user: AuthUser, filters: ProductUpdateFiltersDto = {}) {
    this.assertSuperAdmin(user);
    return this.prisma.productUpdate.findMany({
      where: {
        ...(filters.status ? { status: filters.status as ProductUpdateStatus } : {}),
        ...(filters.audience ? { audience: filters.audience as ReleaseNoteTargetRole } : {}),
        ...(filters.visibility ? { visibility: filters.visibility as ProductUpdateVisibility } : {}),
        ...(filters.updateType ? { updateType: filters.updateType as ProductUpdateType } : {}),
        ...(filters.releaseId ? { productReleaseId: filters.releaseId } : {}),
      },
      include: this.updateInclude(),
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  async superadminGetUpdate(user: AuthUser, id: string) {
    this.assertSuperAdmin(user);
    const item = await this.prisma.productUpdate.findUnique({ where: { id }, include: this.updateInclude() });
    if (!item) throw new NotFoundException('Product update not found');
    return item;
  }

  async superadminCreateUpdate(user: AuthUser, dto: CreateProductUpdateDto) {
    this.assertSuperAdmin(user);
    const status = (dto.status as ProductUpdateStatus | undefined) || ProductUpdateStatus.DRAFT;
    return this.prisma.productUpdate.create({
      data: {
        productReleaseId: dto.productReleaseId || null,
        title: dto.title.trim(),
        summary: dto.summary.trim(),
        body: dto.body.trim(),
        updateType: (dto.updateType as ProductUpdateType | undefined) || ProductUpdateType.IMPROVEMENT,
        status,
        audience: (dto.audience as ReleaseNoteTargetRole | undefined) || ReleaseNoteTargetRole.ALL,
        visibility: (dto.visibility as ProductUpdateVisibility | undefined) || ProductUpdateVisibility.IN_APP_ONLY,
        priority: (dto.priority as ProductUpdatePriority | undefined) || ProductUpdatePriority.NORMAL,
        moduleKey: dto.moduleKey?.trim() || null,
        version: dto.version?.trim() || null,
        requiresAcknowledgement: dto.requiresAcknowledgement ?? false,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        publishedAt: status === ProductUpdateStatus.PUBLISHED ? new Date() : null,
        publishedById: status === ProductUpdateStatus.PUBLISHED ? this.userId(user) || null : null,
        createdById: this.userId(user) || null,
        linkedFeatureRequestId: dto.linkedFeatureRequestId || null,
        linkedFeedbackId: dto.linkedFeedbackId || null,
      },
      include: this.updateInclude(),
    });
  }

  async superadminUpdateProductUpdate(user: AuthUser, id: string, dto: UpdateProductUpdateDto) {
    this.assertSuperAdmin(user);
    return this.prisma.productUpdate.update({
      where: { id },
      data: {
        ...(dto.productReleaseId !== undefined ? { productReleaseId: dto.productReleaseId || null } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary.trim() } : {}),
        ...(dto.body !== undefined ? { body: dto.body.trim() } : {}),
        ...(dto.updateType !== undefined ? { updateType: dto.updateType as ProductUpdateType } : {}),
        ...(dto.status !== undefined ? { status: dto.status as ProductUpdateStatus } : {}),
        ...(dto.audience !== undefined ? { audience: dto.audience as ReleaseNoteTargetRole } : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility as ProductUpdateVisibility } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority as ProductUpdatePriority } : {}),
        ...(dto.moduleKey !== undefined ? { moduleKey: dto.moduleKey?.trim() || null } : {}),
        ...(dto.version !== undefined ? { version: dto.version?.trim() || null } : {}),
        ...(dto.requiresAcknowledgement !== undefined ? { requiresAcknowledgement: dto.requiresAcknowledgement } : {}),
        ...(dto.scheduledAt !== undefined ? { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null } : {}),
        ...(dto.linkedFeatureRequestId !== undefined ? { linkedFeatureRequestId: dto.linkedFeatureRequestId || null } : {}),
        ...(dto.linkedFeedbackId !== undefined ? { linkedFeedbackId: dto.linkedFeedbackId || null } : {}),
      },
      include: this.updateInclude(),
    });
  }

  async superadminPublishUpdate(user: AuthUser, id: string) {
    this.assertSuperAdmin(user);
    const update = await this.prisma.productUpdate.update({
      where: { id },
      data: {
        status: ProductUpdateStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedById: this.userId(user) || null,
      },
      include: this.updateInclude(),
    });
    if (update.linkedFeatureRequestId) {
      await this.prisma.featureRequest.update({
        where: { id: update.linkedFeatureRequestId },
        data: { status: FeatureRequestStatus.RELEASED },
      }).catch(() => undefined);
    }
    if (update.linkedFeedbackId) {
      await this.prisma.feedback.update({
        where: { id: update.linkedFeedbackId },
        data: { status: FeedbackStatus.RESOLVED },
      }).catch(() => undefined);
    }
    return update;
  }

  async superadminArchiveUpdate(user: AuthUser, id: string) {
    this.assertSuperAdmin(user);
    return this.prisma.productUpdate.update({
      where: { id },
      data: { status: ProductUpdateStatus.ARCHIVED },
      include: this.updateInclude(),
    });
  }

  async superadminDeleteUpdate(user: AuthUser, id: string) {
    this.assertSuperAdmin(user);
    await this.prisma.productUpdate.delete({ where: { id } });
    return { ok: true };
  }

  async superadminUpdateAcknowledgements(user: AuthUser, id: string) {
    this.assertSuperAdmin(user);
    return this.prisma.productUpdateAcknowledgement.findMany({
      where: { productUpdateId: id },
      include: { user: { select: { id: true, email: true, fullName: true, role: true, organizationId: true } } },
      orderBy: { acknowledgedAt: 'desc' },
      take: 500,
    });
  }

  async listForUser(user: AuthUser) {
    return this.listProductUpdatesForUser(user);
  }

  async listUnreadForUser(user: AuthUser) {
    return this.listUnreadProductUpdatesForUser(user);
  }

  async markRead(user: AuthUser, id: string) {
    return this.acknowledgeProductUpdate(user, id);
  }

  async superadminList(user: AuthUser, filters: ReleaseNotesFiltersDto) {
    return this.superadminListUpdates(user, {
      audience: filters.targetRole || filters.audience,
      status: filters.isPublished === true ? ProductUpdateStatus.PUBLISHED : filters.status,
      visibility: filters.visibility,
    });
  }

  async superadminCreate(user: AuthUser, dto: CreateReleaseNoteDto) {
    return this.superadminCreateUpdate(user, {
      title: dto.title,
      summary: dto.title,
      body: dto.content,
      version: dto.version,
      audience: dto.targetRole,
      visibility: ProductUpdateVisibility.IN_APP_ONLY,
      updateType: ProductUpdateType.IMPROVEMENT,
    });
  }

  async superadminUpdate(user: AuthUser, id: string, dto: UpdateReleaseNoteDto) {
    return this.superadminUpdateProductUpdate(user, id, {
      title: dto.title,
      summary: dto.title,
      body: dto.content,
      version: dto.version,
      audience: dto.targetRole,
      ...(dto.isPublished === true ? { status: ProductUpdateStatus.PUBLISHED } : {}),
      ...(dto.isPublished === false ? { status: ProductUpdateStatus.DRAFT } : {}),
    });
  }

  async superadminDelete(user: AuthUser, id: string) {
    return this.superadminDeleteUpdate(user, id);
  }

  async superadminPublish(user: AuthUser, id: string) {
    return this.superadminPublishUpdate(user, id);
  }
}
