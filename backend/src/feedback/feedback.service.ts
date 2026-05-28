import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FeatureRequestCategory,
  FeatureRequestStatus,
  FeatureRequestVisibility,
  FeedbackPriority,
  FeedbackSource,
  FeedbackStatus,
  FeedbackType,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ConvertFeedbackToFeatureDto, UpdateFeedbackDto } from './dto/update-feedback.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private isSuperadmin(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    return role === 'SUPERADMIN' || role === 'SUPER_ADMIN';
  }

  private featureScore(item: { impactScore?: number | null; reachScore?: number | null; confidenceScore?: number | null; effortScore?: number | null }) {
    const effort = Math.max(1, item.effortScore || 1);
    return Math.round(((item.impactScore || 0) + (item.reachScore || 0) + (item.confidenceScore || 0)) / effort);
  }

  async create(
    organizationId: string | undefined,
    userId: string,
    userRole: string,
    dto: CreateFeedbackDto,
  ) {
    return this.prisma.feedback.create({
      data: {
        organizationId: organizationId || null,
        userId,
        userRole: userRole.toUpperCase(),
        pageUrl: dto.pageUrl || null,
        type: dto.type as FeedbackType,
        source: (dto.source as FeedbackSource | undefined) || FeedbackSource.IN_APP,
        title: dto.title.trim(),
        message: dto.message.trim(),
        moduleKey: dto.moduleKey?.trim() || null,
        customerImpact: dto.customerImpact?.trim() || null,
        reproductionSteps: dto.reproductionSteps?.trim() || null,
        environment: dto.environment?.trim() || null,
        browserInfo: dto.browserInfo?.trim() || null,
        deviceInfo: dto.deviceInfo?.trim() || null,
        status: FeedbackStatus.NEW,
        priority: FeedbackPriority.MEDIUM,
        screenshotUrl: dto.screenshotUrl || null,
      },
      select: {
        id: true,
        type: true,
        source: true,
        title: true,
        message: true,
        moduleKey: true,
        pageUrl: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    });
  }

  async list(organizationId: string, role: Role) {
    if (role !== Role.ADMIN && role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only admins can view feedback');
    }
    return this.prisma.feedback.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: this.feedbackInclude(false),
    });
  }

  async dashboardForSuperadmin(user: AuthUser) {
    if (!this.isSuperadmin(user)) throw new ForbiddenException('Super admin access required');
    const [byStatus, byType, byPriority, recent, roadmapCandidates] = await Promise.all([
      this.prisma.feedback.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.feedback.groupBy({ by: ['type'], _count: { _all: true } }),
      this.prisma.feedback.groupBy({ by: ['priority'], _count: { _all: true } }),
      this.prisma.feedback.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: this.feedbackInclude(false) }),
      this.prisma.feedback.count({ where: { type: FeedbackType.IDEA, linkedFeatureRequestId: null, status: { in: [FeedbackStatus.NEW, FeedbackStatus.REVIEWED] } } }),
    ]);
    return {
      byStatus: Object.fromEntries(byStatus.map((item) => [item.status, item._count._all])),
      byType: Object.fromEntries(byType.map((item) => [item.type, item._count._all])),
      byPriority: Object.fromEntries(byPriority.map((item) => [item.priority, item._count._all])),
      recent,
      roadmapCandidates,
    };
  }

  async listForSuperadmin(filters: {
    organizationId?: string;
    type?: 'BUG' | 'IDEA' | 'QUESTION' | 'COMPLAINT';
    status?: 'NEW' | 'REVIEWED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    linked?: 'true' | 'false';
  }) {
    return this.prisma.feedback.findMany({
      where: {
        organizationId: filters.organizationId || undefined,
        type: filters.type as FeedbackType | undefined,
        status: filters.status as FeedbackStatus | undefined,
        priority: filters.priority as FeedbackPriority | undefined,
        ...(filters.linked === 'true' ? { linkedFeatureRequestId: { not: null } } : {}),
        ...(filters.linked === 'false' ? { linkedFeatureRequestId: null } : {}),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 500,
      include: this.feedbackInclude(true),
    });
  }

  async getForSuperadmin(id: string) {
    const item = await this.prisma.feedback.findUnique({ where: { id }, include: this.feedbackInclude(true) });
    if (!item) throw new NotFoundException('Feedback not found');
    return item;
  }

  async updateBySuperadmin(id: string, dto: UpdateFeedbackDto, user?: AuthUser) {
    const reviewed = dto.status && dto.status !== FeedbackStatus.NEW;
    return this.prisma.feedback.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status as FeedbackStatus } : {}),
        ...(dto.priority ? { priority: dto.priority as FeedbackPriority } : {}),
        ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId || null } : {}),
        ...(dto.linkedFeatureRequestId !== undefined ? { linkedFeatureRequestId: dto.linkedFeatureRequestId || null } : {}),
        ...(dto.moduleKey !== undefined ? { moduleKey: dto.moduleKey?.trim() || null } : {}),
        ...(dto.internalNotes !== undefined ? { internalNotes: dto.internalNotes?.trim() || null } : {}),
        ...(reviewed ? { reviewedAt: new Date(), reviewedById: user ? this.userId(user) || null : undefined } : {}),
      },
      include: this.feedbackInclude(true),
    });
  }

  async convertToFeatureRequest(id: string, dto: ConvertFeedbackToFeatureDto, user: AuthUser) {
    if (!this.isSuperadmin(user)) throw new ForbiddenException('Super admin access required');
    const feedback = await this.prisma.feedback.findUnique({ where: { id } });
    if (!feedback) throw new NotFoundException('Feedback not found');
    const category = (dto.category || this.categoryFromFeedback(feedback.moduleKey, feedback.type)) as FeatureRequestCategory;
    const feature = await this.prisma.featureRequest.create({
      data: {
        organizationId: feedback.organizationId,
        createdByUserId: this.userId(user) || feedback.userId,
        sourceFeedbackId: feedback.id,
        title: dto.title?.trim() || feedback.title,
        description: dto.description?.trim() || feedback.message,
        publicSummary: dto.publicSummary?.trim() || (feedback.type === FeedbackType.IDEA ? feedback.title : null),
        customerProblem: feedback.customerImpact || feedback.message,
        expectedOutcome: dto.expectedOutcome?.trim() || null,
        moduleKey: feedback.moduleKey,
        category,
        status: FeatureRequestStatus.UNDER_REVIEW,
        visibility: FeatureRequestVisibility.INTERNAL,
        impactScore: feedback.priority === FeedbackPriority.HIGH ? 8 : feedback.priority === FeedbackPriority.MEDIUM ? 5 : 3,
        reachScore: feedback.organizationId ? 3 : 1,
        confidenceScore: 5,
        effortScore: 3,
        internalNotes: `Creat din feedback ${feedback.id}`,
      },
      include: this.featureInclude(),
    });
    await this.prisma.feedback.update({
      where: { id },
      data: {
        linkedFeatureRequestId: feature.id,
        status: FeedbackStatus.IN_PROGRESS,
        reviewedAt: new Date(),
        reviewedById: this.userId(user) || null,
      },
    });
    await this.prisma.featureRequestEvent.create({
      data: {
        featureRequestId: feature.id,
        actorId: this.userId(user) || null,
        type: 'CREATED_FROM_FEEDBACK',
        message: `Feature request creat din feedback: ${feedback.title}`,
        metadataJson: { feedbackId: feedback.id },
      },
    });
    return { ...feature, score: this.featureScore(feature) };
  }

  private categoryFromFeedback(moduleKey?: string | null, type?: FeedbackType): FeatureRequestCategory {
    const key = String(moduleKey || '').toUpperCase();
    if (key.includes('PAY')) return FeatureRequestCategory.PAYMENTS;
    if (key.includes('REPORT')) return FeatureRequestCategory.REPORTS;
    if (key.includes('MOBILE') || key.includes('RESIDENT')) return FeatureRequestCategory.MOBILE;
    if (type === FeedbackType.BUG) return FeatureRequestCategory.UX;
    return FeatureRequestCategory.OTHER;
  }

  private feedbackInclude(detailed: boolean) {
    return {
      organization: { select: { id: true, name: true } },
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
      assignedTo: { select: { id: true, email: true, fullName: true } },
      reviewedBy: { select: { id: true, email: true, fullName: true } },
      linkedFeatureRequest: detailed
        ? { select: { id: true, title: true, status: true, visibility: true, category: true } }
        : { select: { id: true, title: true, status: true } },
    };
  }

  private featureInclude() {
    return {
      organization: { select: { id: true, name: true } },
      createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      owner: { select: { id: true, email: true, fullName: true } },
      sourceFeedback: { select: { id: true, title: true, type: true, priority: true } },
      _count: { select: { votes: true, feedbackItems: true, comments: true } },
    };
  }
}
