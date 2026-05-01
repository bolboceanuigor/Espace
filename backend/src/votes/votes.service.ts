import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma, ResidentType, Role, VoteSessionStatus, VoteTargetType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddVoteOptionDto,
  CastVoteDto,
  CreateVoteSessionDto,
  ListVoteSessionsDto,
  UpdateVoteSessionDto,
} from './dto/votes.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class VotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private getUserId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private assertAdmin(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'ADMIN') throw new ForbiddenException('Admin access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.getUserId(user) };
  }

  private assertResidentOrTenant(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (!['RESIDENT', 'TENANT'].includes(role)) throw new ForbiddenException('Resident access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.getUserId(user), role };
  }

  private assertSuperadmin(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (!['SUPERADMIN', 'SUPER_ADMIN'].includes(role)) throw new ForbiddenException('Super admin access required');
  }

  private async autoCloseExpiredSessions(organizationId?: string) {
    const now = new Date();
    await this.prisma.voteSession.updateMany({
      where: {
        status: 'ACTIVE',
        endsAt: { lt: now },
        ...(organizationId ? { organizationId } : {}),
      },
      data: { status: 'CLOSED' },
    });
  }

  private async validateTarget(organizationId: string, targetType: VoteTargetType, buildingId?: string | null, staircaseId?: string | null) {
    if (targetType === 'ORGANIZATION') return;
    if (targetType === 'BUILDING') {
      if (!buildingId) throw new BadRequestException('buildingId is required');
      const exists = await this.prisma.building.findFirst({ where: { id: buildingId, organizationId }, select: { id: true } });
      if (!exists) throw new BadRequestException('Building not found in organization');
      return;
    }
    if (!staircaseId) throw new BadRequestException('staircaseId is required');
    const exists = await this.prisma.staircase.findFirst({ where: { id: staircaseId, organizationId }, select: { id: true } });
    if (!exists) throw new BadRequestException('Staircase not found in organization');
  }

  private apartmentWhereForTarget(session: { targetType: VoteTargetType; buildingId: string | null; staircaseId: string | null }) {
    if (session.targetType === 'ORGANIZATION') return {};
    if (session.targetType === 'BUILDING') return { buildingId: session.buildingId || '__none__' };
    return { staircaseId: session.staircaseId || '__none__' };
  }

  private async getEligibleOwnerApartments(session: { id: string; organizationId: string; targetType: VoteTargetType; buildingId: string | null; staircaseId: string | null }) {
    return this.prisma.residentProfile.findMany({
      where: {
        organizationId: session.organizationId,
        type: ResidentType.OWNER,
        apartment: this.apartmentWhereForTarget(session),
      },
      include: {
        apartment: { select: { id: true, number: true, areaM2: true, buildingId: true, staircaseId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async notifyEligibleOwners(sessionId: string, title: string, message: string, link: string) {
    const session = await this.prisma.voteSession.findUnique({
      where: { id: sessionId },
      select: { id: true, organizationId: true, targetType: true, buildingId: true, staircaseId: true },
    });
    if (!session) return;
    const owners = await this.getEligibleOwnerApartments({
      id: session.id,
      organizationId: session.organizationId,
      targetType: session.targetType,
      buildingId: session.buildingId,
      staircaseId: session.staircaseId,
    });
    const userIds = Array.from(new Set(owners.map((owner) => owner.userId)));
    if (!userIds.length) return;
    await this.notificationsService.notifyUsers({
      organizationId: session.organizationId,
      userIds,
      title,
      message,
      type: NotificationType.VOTE,
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
        showVoteParticipants: false,
      }
    );
  }

  async adminList(user: AuthUser, query: ListVoteSessionsDto) {
    const { organizationId } = this.assertAdmin(user);
    await this.autoCloseExpiredSessions(organizationId);
    return this.prisma.voteSession.findMany({
      where: { organizationId, ...(query.status ? { status: query.status } : {}) },
      include: { options: true, building: { select: { id: true, name: true } }, staircase: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminCreate(user: AuthUser, dto: CreateVoteSessionDto, optionLabels?: string[]) {
    const { organizationId, userId } = this.assertAdmin(user);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (!(startsAt < endsAt)) throw new BadRequestException('startsAt must be before endsAt');
    await this.validateTarget(organizationId, dto.targetType, dto.buildingId, dto.staircaseId);
    const created = await this.prisma.voteSession.create({
      data: {
        organizationId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        targetType: dto.targetType,
        buildingId: dto.buildingId || null,
        staircaseId: dto.staircaseId || null,
        votingMethod: dto.votingMethod,
        startsAt,
        endsAt,
        createdByUserId: userId,
      },
    });
    if (optionLabels?.length) {
      await this.prisma.voteOption.createMany({
        data: optionLabels
          .map((label) => label.trim())
          .filter(Boolean)
          .map((label) => ({ voteSessionId: created.id, label })),
      });
    }
    return this.adminGetOne(user, created.id);
  }

  async adminGetOne(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    await this.autoCloseExpiredSessions(organizationId);
    const session = await this.prisma.voteSession.findFirst({
      where: { id, organizationId },
      include: {
        options: true,
        votes: {
          orderBy: { createdAt: 'desc' },
          include: {
            voteOption: true,
            apartment: { select: { id: true, number: true, areaM2: true, building: { select: { name: true } }, staircase: { select: { name: true } } } },
          },
        },
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
      },
    });
    if (!session) throw new NotFoundException('Vote session not found');
    const results = await this.computeResults(session.id, organizationId, true);
    return { ...session, eligibleSummary: results.eligibleSummary, results };
  }

  async adminUpdate(user: AuthUser, id: string, dto: UpdateVoteSessionDto) {
    const { organizationId } = this.assertAdmin(user);
    const existing = await this.prisma.voteSession.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Vote session not found');
    if (existing.status !== VoteSessionStatus.DRAFT) throw new BadRequestException('Only DRAFT session can be edited');
    const nextTargetType = (dto.targetType || existing.targetType) as VoteTargetType;
    await this.validateTarget(organizationId, nextTargetType, dto.buildingId ?? existing.buildingId, dto.staircaseId ?? existing.staircaseId);
    if (dto.startsAt || dto.endsAt) {
      const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
      const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
      if (!(startsAt < endsAt)) throw new BadRequestException('startsAt must be before endsAt');
    }
    return this.prisma.voteSession.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.targetType !== undefined ? { targetType: dto.targetType } : {}),
        ...(dto.buildingId !== undefined ? { buildingId: dto.buildingId || null } : {}),
        ...(dto.staircaseId !== undefined ? { staircaseId: dto.staircaseId || null } : {}),
        ...(dto.votingMethod !== undefined ? { votingMethod: dto.votingMethod } : {}),
        ...(dto.startsAt !== undefined ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: new Date(dto.endsAt) } : {}),
      },
    });
  }

  async adminAddOption(user: AuthUser, id: string, dto: AddVoteOptionDto) {
    const { organizationId } = this.assertAdmin(user);
    const session = await this.prisma.voteSession.findFirst({ where: { id, organizationId }, select: { id: true, status: true } });
    if (!session) throw new NotFoundException('Vote session not found');
    if (session.status !== 'DRAFT') throw new BadRequestException('Options can be added only in DRAFT status');
    return this.prisma.voteOption.create({ data: { voteSessionId: id, label: dto.label.trim() } });
  }

  async adminActivate(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const session = await this.prisma.voteSession.findFirst({
      where: { id, organizationId },
      include: { options: { select: { id: true } } },
    });
    if (!session) throw new NotFoundException('Vote session not found');
    if (session.options.length < 2) throw new BadRequestException('At least 2 options are required');
    if (!['DRAFT', 'CLOSED'].includes(session.status)) throw new BadRequestException('Session cannot be activated');
    const updated = await this.prisma.voteSession.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.notifyEligibleOwners(id, `Vot activ: ${updated.title}`, 'Un nou vot este disponibil.', `/resident/votes/${id}`);
    return updated;
  }

  async adminClose(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const session = await this.prisma.voteSession.findFirst({ where: { id, organizationId }, select: { id: true, status: true } });
    if (!session) throw new NotFoundException('Vote session not found');
    if (session.status !== 'ACTIVE') throw new BadRequestException('Only ACTIVE session can be closed');
    return this.prisma.voteSession.update({ where: { id }, data: { status: 'CLOSED' } });
  }

  async adminPublish(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const session = await this.prisma.voteSession.findFirst({ where: { id, organizationId }, select: { id: true, status: true, title: true } });
    if (!session) throw new NotFoundException('Vote session not found');
    if (!['CLOSED', 'ACTIVE'].includes(session.status)) throw new BadRequestException('Only CLOSED/ACTIVE session can be published');
    const updated = await this.prisma.voteSession.update({ where: { id }, data: { status: 'PUBLISHED' } });
    await this.notifyEligibleOwners(id, `Rezultat publicat: ${session.title}`, 'Rezultatul votului este acum disponibil.', `/resident/votes/${id}`);
    return updated;
  }

  async adminResults(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    return this.computeResults(id, organizationId, true);
  }

  async residentList(user: AuthUser) {
    const { organizationId, userId } = this.assertResidentOrTenant(user);
    await this.autoCloseExpiredSessions(organizationId);
    const profiles = await this.prisma.residentProfile.findMany({
      where: { organizationId, userId },
      include: { apartment: { select: { id: true, buildingId: true, staircaseId: true, areaM2: true } } },
    });
    const apartmentIds = profiles.map((profile) => profile.apartmentId);
    const buildingIds = profiles.map((profile) => profile.apartment.buildingId);
    const staircaseIds = profiles.map((profile) => profile.apartment.staircaseId);
    const ownerApartmentIds = profiles.filter((profile) => profile.type === ResidentType.OWNER).map((profile) => profile.apartmentId);

    const rows = await this.prisma.voteSession.findMany({
      where: {
        organizationId,
        OR: [
          { targetType: 'ORGANIZATION' },
          { targetType: 'BUILDING', buildingId: { in: buildingIds.length ? buildingIds : ['__none__'] } },
          { targetType: 'STAIRCASE', staircaseId: { in: staircaseIds.length ? staircaseIds : ['__none__'] } },
        ],
      },
      include: { options: true },
      orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
    });

    const now = new Date();
    return rows.map((row) => {
      const isInWindow = now >= row.startsAt && now <= row.endsAt;
      const canVote = row.status === 'ACTIVE' && isInWindow && ownerApartmentIds.some((id) => apartmentIds.includes(id));
      return {
        ...row,
        canVote,
        ownerApartmentCount: ownerApartmentIds.length,
      };
    });
  }

  async residentGetOne(user: AuthUser, id: string) {
    const { organizationId, userId } = this.assertResidentOrTenant(user);
    const settings = await this.privacySettings(organizationId);
    await this.autoCloseExpiredSessions(organizationId);
    const session = await this.prisma.voteSession.findFirst({
      where: { id, organizationId },
      include: { options: true, building: { select: { id: true, name: true } }, staircase: { select: { id: true, name: true } } },
    });
    if (!session) throw new NotFoundException('Vote session not found');
    const profiles = await this.prisma.residentProfile.findMany({
      where: { organizationId, userId },
      include: { apartment: { select: { id: true, number: true, areaM2: true, buildingId: true, staircaseId: true } } },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    const relevantProfiles = profiles.filter((profile) => {
      if (session.targetType === 'ORGANIZATION') return true;
      if (session.targetType === 'BUILDING') return profile.apartment.buildingId === session.buildingId;
      return profile.apartment.staircaseId === session.staircaseId;
    });
    const ownerProfiles = relevantProfiles.filter((profile) => profile.type === ResidentType.OWNER);
    const existingVotes = await this.prisma.vote.findMany({
      where: {
        voteSessionId: id,
        apartmentId: { in: ownerProfiles.length ? ownerProfiles.map((profile) => profile.apartmentId) : ['__none__'] },
      },
      select: { apartmentId: true, voteOptionId: true, weight: true, createdAt: true },
    });
    const now = new Date();
    const canVoteNow = session.status === 'ACTIVE' && now >= session.startsAt && now <= session.endsAt;
    const response: any = {
      ...session,
      canVoteNow,
      relevantApartments: relevantProfiles.map((profile) => ({
        apartmentId: profile.apartmentId,
        number: settings.showApartmentNumbersInCommunity ? profile.apartment.number : null,
        areaM2: profile.apartment.areaM2,
        residentType: profile.type,
      })),
      existingVotes,
    };
    if (session.status === 'PUBLISHED') {
      response.results = await this.computeResults(id, organizationId, false);
      if (!settings.showVoteParticipants && response.results?.votes) {
        response.results.votes = [];
      }
    }
    return response;
  }

  async residentCast(user: AuthUser, id: string, dto: CastVoteDto) {
    const { organizationId, userId } = this.assertResidentOrTenant(user);
    await this.autoCloseExpiredSessions(organizationId);
    const session = await this.prisma.voteSession.findFirst({
      where: { id, organizationId },
      include: { options: { select: { id: true } } },
    });
    if (!session) throw new NotFoundException('Vote session not found');
    if (session.status !== 'ACTIVE') throw new BadRequestException('Vote session is not active');
    const now = new Date();
    if (now < session.startsAt || now > session.endsAt) throw new BadRequestException('Vote session is outside active period');
    if (!session.options.some((option) => option.id === dto.voteOptionId)) throw new BadRequestException('Invalid vote option');

    const ownerProfile = await this.prisma.residentProfile.findFirst({
      where: { organizationId, userId, apartmentId: dto.apartmentId, type: ResidentType.OWNER },
      include: { apartment: { select: { id: true, areaM2: true, buildingId: true, staircaseId: true } } },
    });
    if (!ownerProfile) throw new ForbiddenException('Only OWNER can vote for this apartment');
    if (session.targetType === 'BUILDING' && ownerProfile.apartment.buildingId !== session.buildingId) {
      throw new ForbiddenException('Apartment is not eligible for this vote');
    }
    if (session.targetType === 'STAIRCASE' && ownerProfile.apartment.staircaseId !== session.staircaseId) {
      throw new ForbiddenException('Apartment is not eligible for this vote');
    }

    const existing = await this.prisma.vote.findFirst({
      where: { voteSessionId: id, apartmentId: dto.apartmentId },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('Apartment has already voted in this session');

    const weight = session.votingMethod === 'BY_APARTMENT' ? 1 : Number(ownerProfile.apartment.areaM2 || 0);
    if (session.votingMethod === 'BY_AREA_M2' && weight <= 0) {
      throw new BadRequestException('Apartment areaM2 must be > 0 for BY_AREA_M2 voting');
    }

    return this.prisma.vote.create({
      data: {
        voteSessionId: id,
        voteOptionId: dto.voteOptionId,
        organizationId,
        apartmentId: dto.apartmentId,
        userId,
        weight,
      },
    });
  }

  async superadminOverview(user: AuthUser) {
    this.assertSuperadmin(user);
    await this.autoCloseExpiredSessions();
    const [totalSessions, activeSessions, publishedSessions, votesCast, grouped] = await Promise.all([
      this.prisma.voteSession.count(),
      this.prisma.voteSession.count({ where: { status: 'ACTIVE' } }),
      this.prisma.voteSession.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.vote.count(),
      this.prisma.voteSession.groupBy({ by: ['organizationId'], _count: { _all: true }, orderBy: { _count: { organizationId: 'desc' } } }),
    ]);
    const organizationIds = grouped.map((item) => item.organizationId);
    const organizations = organizationIds.length
      ? await this.prisma.organization.findMany({ where: { id: { in: organizationIds } }, select: { id: true, name: true } })
      : [];
    const orgMap = new Map(organizations.map((org) => [org.id, org.name]));
    return {
      totalSessions,
      activeSessions,
      publishedSessions,
      totalVotesCast: votesCast,
      sessionsByOrganization: grouped.map((row) => ({
        organizationId: row.organizationId,
        organizationName: orgMap.get(row.organizationId) || 'Unknown',
        sessions: row._count._all,
      })),
    };
  }

  private async computeResults(voteSessionId: string, organizationId: string, includeVotesList: boolean) {
    const session = await this.prisma.voteSession.findFirst({
      where: { id: voteSessionId, organizationId },
      include: { options: true, votes: true },
    });
    if (!session) throw new NotFoundException('Vote session not found');
    const eligibleProfiles = await this.getEligibleOwnerApartments({
      id: session.id,
      organizationId: session.organizationId,
      targetType: session.targetType,
      buildingId: session.buildingId,
      staircaseId: session.staircaseId,
    });
    const eligibleApartmentsMap = new Map<string, { areaM2: number }>();
    for (const profile of eligibleProfiles) {
      if (!eligibleApartmentsMap.has(profile.apartmentId)) {
        eligibleApartmentsMap.set(profile.apartmentId, { areaM2: Number(profile.apartment.areaM2 || 0) });
      }
    }
    const totalEligibleApartments = eligibleApartmentsMap.size;
    const totalEligibleAreaM2 = Array.from(eligibleApartmentsMap.values()).reduce((sum, item) => sum + item.areaM2, 0);
    const totalVotesCast = session.votes.length;

    const resultsByOption = session.options.map((option) => {
      const votesForOption = session.votes.filter((vote) => vote.voteOptionId === option.id);
      const weightSum = votesForOption.reduce((sum, vote) => sum + Number(vote.weight || 0), 0);
      return {
        voteOptionId: option.id,
        label: option.label,
        votesCount: votesForOption.length,
        weightTotal: weightSum,
      };
    });
    const winnerOption = [...resultsByOption].sort((a, b) => b.weightTotal - a.weightTotal)[0] || null;
    const turnoutPercentage =
      (session.votingMethod === 'BY_APARTMENT'
        ? (totalEligibleApartments ? (totalVotesCast / totalEligibleApartments) * 100 : 0)
        : (totalEligibleAreaM2 ? (session.votes.reduce((sum, vote) => sum + Number(vote.weight || 0), 0) / totalEligibleAreaM2) * 100 : 0));

    const response: any = {
      voteSessionId,
      status: session.status,
      votingMethod: session.votingMethod,
      eligibleSummary: {
        totalEligibleApartments,
        totalEligibleAreaM2,
      },
      totalVotesCast,
      turnoutPercentage: Number(turnoutPercentage.toFixed(2)),
      resultsByOption,
      winnerOption,
    };

    if (includeVotesList) {
      response.votes = await this.prisma.vote.findMany({
        where: { voteSessionId },
        include: {
          voteOption: { select: { id: true, label: true } },
          apartment: { select: { id: true, number: true, areaM2: true, building: { select: { name: true } }, staircase: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });
      response.votes = response.votes.map((vote: any) => ({ ...vote, option: vote.voteOption }));
    }
    return response;
  }
}
