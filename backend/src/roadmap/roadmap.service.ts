import { ForbiddenException, Injectable } from '@nestjs/common';
import { FeatureRequestCategory, FeatureRequestStatus, FeatureRequestVisibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoadmapFeatureDto, RoadmapFeatureFiltersDto, UpdateRoadmapFeatureDto } from './dto/roadmap.dto';

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

  async listFeaturesForUser(user: AuthUser, query: RoadmapFeatureFiltersDto) {
    const { userId, organizationId } = this.assertAuthenticated(user);
    return this.prisma.featureRequest.findMany({
      where: {
        ...(query.status ? { status: query.status as FeatureRequestStatus } : {}),
        ...(query.category ? { category: query.category as FeatureRequestCategory } : {}),
        OR: [
          { visibility: FeatureRequestVisibility.PUBLIC },
          ...(organizationId ? [{ organizationId }] : []),
        ],
      },
      include: {
        organization: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        _count: { select: { votes: true } },
        votes: { where: { userId }, select: { id: true }, take: 1 },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 300,
    });
  }

  async createFeature(user: AuthUser, dto: CreateRoadmapFeatureDto) {
    const { userId, organizationId } = this.assertAuthenticated(user);
    const role = this.normalizedRole(user);
    const visibility =
      role === 'SUPER_ADMIN'
        ? ((dto.visibility as FeatureRequestVisibility | undefined) || FeatureRequestVisibility.PUBLIC)
        : FeatureRequestVisibility.INTERNAL;

    return this.prisma.featureRequest.create({
      data: {
        organizationId,
        createdByUserId: userId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        category: dto.category as FeatureRequestCategory,
        visibility,
        status: FeatureRequestStatus.NEW,
      },
      include: {
        _count: { select: { votes: true } },
      },
    });
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

  async listFeaturesForSuperadmin(user: AuthUser, query: RoadmapFeatureFiltersDto) {
    this.assertSuperAdmin(user);
    return this.prisma.featureRequest.findMany({
      where: {
        ...(query.status ? { status: query.status as FeatureRequestStatus } : {}),
        ...(query.category ? { category: query.category as FeatureRequestCategory } : {}),
      },
      include: {
        organization: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true, email: true } },
        _count: { select: { votes: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    });
  }

  async updateFeatureBySuperadmin(user: AuthUser, id: string, dto: UpdateRoadmapFeatureDto) {
    this.assertSuperAdmin(user);
    return this.prisma.featureRequest.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status as FeatureRequestStatus } : {}),
        ...(dto.visibility ? { visibility: dto.visibility as FeatureRequestVisibility } : {}),
      },
      include: { _count: { select: { votes: true } } },
    });
  }
}
