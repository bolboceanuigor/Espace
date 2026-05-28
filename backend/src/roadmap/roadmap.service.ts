import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FeatureRequestCategory, FeatureRequestStatus, FeatureRequestVisibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeatureRequestCommentDto, CreateRoadmapFeatureDto, RoadmapFeatureFiltersDto, UpdateRoadmapFeatureDto } from './dto/roadmap.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class RoadmapService {
  constructor(private readonly prisma: PrismaService) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private normalizedRole(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (role === 'SUPERADMIN') return 'SUPER_ADMIN';
    if (role === 'TENANT') return 'RESIDENT';
    if (role === 'MANAGER') return 'ADMIN';
    return role;
  }

  private assertAuthenticated(user: AuthUser) {
    const userId = this.userId(user);
    if (!userId) throw new ForbiddenException('Authentication required');
    return { userId, organizationId: user.organizationId || null };
  }

  private assertSuperAdmin(user: AuthUser) {
    if (this.normalizedRole(user) !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }
  }

  private score(item: { impactScore?: number | null; reachScore?: number | null; confidenceScore?: number | null; effortScore?: number | null }) {
    const effort = Math.max(1, item.effortScore || 1);
    return Math.round(((item.impactScore || 0) + (item.reachScore || 0) + (item.confidenceScore || 0)) / effort);
  }

  private includeForUser(userId?: string) {
    return {
      organization: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
      owner: { select: { id: true, email: true, fullName: true } },
      sourceFeedback: { select: { id: true, title: true, type: true, priority: true, status: true } },
      _count: { select: { votes: true, feedbackItems: true, comments: true, productUpdates: true } },
      votes: userId ? { where: { userId }, select: { id: true }, take: 1 } : false,
    };
  }

  async listFeaturesForUser(user: AuthUser, query: RoadmapFeatureFiltersDto) {
    const { userId, organizationId } = this.assertAuthenticated(user);
    const rows = await this.prisma.featureRequest.findMany({
      where: {
        ...(query.status ? { status: query.status as FeatureRequestStatus } : {}),
        ...(query.category ? { category: query.category as FeatureRequestCategory } : {}),
        OR: [
          { visibility: FeatureRequestVisibility.PUBLIC },
          ...(organizationId ? [{ organizationId }] : []),
        ],
      },
      include: this.includeForUser(userId),
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 300,
    });
    return rows.map((row) => ({ ...row, score: this.score(row) }));
  }

  async createFeature(user: AuthUser, dto: CreateRoadmapFeatureDto) {
    const { userId, organizationId } = this.assertAuthenticated(user);
    const role = this.normalizedRole(user);
    const visibility =
      role === 'SUPER_ADMIN'
        ? ((dto.visibility as FeatureRequestVisibility | undefined) || FeatureRequestVisibility.PUBLIC)
        : FeatureRequestVisibility.INTERNAL;

    const item = await this.prisma.featureRequest.create({
      data: {
        organizationId,
        createdByUserId: userId,
        sourceFeedbackId: dto.sourceFeedbackId || null,
        title: dto.title.trim(),
        description: dto.description.trim(),
        publicSummary: dto.publicSummary?.trim() || null,
        customerProblem: dto.customerProblem?.trim() || null,
        expectedOutcome: dto.expectedOutcome?.trim() || null,
        moduleKey: dto.moduleKey?.trim() || null,
        category: dto.category as FeatureRequestCategory,
        visibility,
        status: FeatureRequestStatus.NEW,
        impactScore: 3,
        reachScore: 2,
        confidenceScore: 3,
        effortScore: 3,
      },
      include: this.includeForUser(userId),
    });
    await this.addEvent(item.id, userId, 'CREATED', 'Feature request creat.');
    return { ...item, score: this.score(item) };
  }

  async voteFeature(user: AuthUser, id: string) {
    const { userId, organizationId } = this.assertAuthenticated(user);
    const feature = await this.prisma.featureRequest.findFirst({
      where: {
        id,
        OR: [{ visibility: FeatureRequestVisibility.PUBLIC }, ...(organizationId ? [{ organizationId }] : [])],
      },
      select: { id: true },
    });
    if (!feature) throw new ForbiddenException('Feature request not visible');
    await this.prisma.featureVote.upsert({
      where: { featureRequestId_userId: { featureRequestId: id, userId } },
      create: { featureRequestId: id, userId },
      update: {},
    });
    return { ok: true };
  }

  async unvoteFeature(user: AuthUser, id: string) {
    const { userId } = this.assertAuthenticated(user);
    await this.prisma.featureVote.deleteMany({
      where: { featureRequestId: id, userId },
    });
    return { ok: true };
  }

  async dashboardForSuperadmin(user: AuthUser) {
    this.assertSuperAdmin(user);
    const [byStatus, byCategory, publicItems, internalItems, totalVotes, linkedFeedback] = await Promise.all([
      this.prisma.featureRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.featureRequest.groupBy({ by: ['category'], _count: { _all: true } }),
      this.prisma.featureRequest.count({ where: { visibility: FeatureRequestVisibility.PUBLIC } }),
      this.prisma.featureRequest.count({ where: { visibility: FeatureRequestVisibility.INTERNAL } }),
      this.prisma.featureVote.count(),
      this.prisma.feedback.count({ where: { linkedFeatureRequestId: { not: null } } }),
    ]);
    return {
      byStatus: Object.fromEntries(byStatus.map((item) => [item.status, item._count._all])),
      byCategory: Object.fromEntries(byCategory.map((item) => [item.category, item._count._all])),
      publicItems,
      internalItems,
      totalVotes,
      linkedFeedback,
    };
  }

  async listFeaturesForSuperadmin(user: AuthUser, query: RoadmapFeatureFiltersDto) {
    this.assertSuperAdmin(user);
    const rows = await this.prisma.featureRequest.findMany({
      where: {
        ...(query.status ? { status: query.status as FeatureRequestStatus } : {}),
        ...(query.category ? { category: query.category as FeatureRequestCategory } : {}),
        ...(query.visibility ? { visibility: query.visibility as FeatureRequestVisibility } : {}),
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      },
      include: {
        ...this.includeForUser(),
        comments: { orderBy: { createdAt: 'desc' }, take: 3, include: { author: { select: { id: true, email: true, fullName: true } } } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });
    return rows.map((row) => ({ ...row, score: this.score(row) }));
  }

  async getFeatureForSuperadmin(user: AuthUser, id: string) {
    this.assertSuperAdmin(user);
    const item = await this.prisma.featureRequest.findUnique({
      where: { id },
      include: {
        ...this.includeForUser(),
        comments: { orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, email: true, fullName: true } } } },
        events: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, email: true, fullName: true } } } },
        feedbackItems: { orderBy: { createdAt: 'desc' }, take: 50 },
        productUpdates: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!item) throw new NotFoundException('Feature request not found');
    return { ...item, score: this.score(item) };
  }

  async updateFeatureBySuperadmin(user: AuthUser, id: string, dto: UpdateRoadmapFeatureDto) {
    this.assertSuperAdmin(user);
    const item = await this.prisma.featureRequest.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status as FeatureRequestStatus } : {}),
        ...(dto.visibility ? { visibility: dto.visibility as FeatureRequestVisibility } : {}),
        ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId || null } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.publicSummary !== undefined ? { publicSummary: dto.publicSummary?.trim() || null } : {}),
        ...(dto.customerProblem !== undefined ? { customerProblem: dto.customerProblem?.trim() || null } : {}),
        ...(dto.expectedOutcome !== undefined ? { expectedOutcome: dto.expectedOutcome?.trim() || null } : {}),
        ...(dto.moduleKey !== undefined ? { moduleKey: dto.moduleKey?.trim() || null } : {}),
        ...(dto.roadmapQuarter !== undefined ? { roadmapQuarter: dto.roadmapQuarter?.trim() || null } : {}),
        ...(dto.internalNotes !== undefined ? { internalNotes: dto.internalNotes?.trim() || null } : {}),
        ...(dto.impactScore !== undefined ? { impactScore: Number(dto.impactScore) || 0 } : {}),
        ...(dto.effortScore !== undefined ? { effortScore: Number(dto.effortScore) || 0 } : {}),
        ...(dto.reachScore !== undefined ? { reachScore: Number(dto.reachScore) || 0 } : {}),
        ...(dto.confidenceScore !== undefined ? { confidenceScore: Number(dto.confidenceScore) || 0 } : {}),
      },
      include: this.includeForUser(),
    });
    await this.addEvent(id, this.userId(user), 'UPDATED', 'Feature request actualizat.', dto);
    return { ...item, score: this.score(item) };
  }

  async addComment(user: AuthUser, id: string, dto: CreateFeatureRequestCommentDto) {
    this.assertSuperAdmin(user);
    const comment = await this.prisma.featureRequestComment.create({
      data: {
        featureRequestId: id,
        authorId: this.userId(user),
        body: dto.body.trim(),
        internalOnly: dto.internalOnly ?? true,
      },
      include: { author: { select: { id: true, email: true, fullName: true } } },
    });
    await this.addEvent(id, this.userId(user), 'COMMENT_ADDED', 'Comentariu adăugat.');
    return comment;
  }

  private async addEvent(featureRequestId: string, actorId: string | null, type: string, message: string, metadata?: unknown) {
    await this.prisma.featureRequestEvent.create({
      data: {
        featureRequestId,
        actorId: actorId || null,
        type,
        message,
        metadataJson: metadata === undefined ? undefined : metadata as any,
      },
    }).catch(() => undefined);
  }
}
