import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BetaCohortMemberStatus,
  BetaCohortMemberType,
  BetaCohortStatus,
  BetaFeedbackSeverity,
  BetaFeedbackStatus,
  BetaProgramEventType,
  BetaProgramStatus,
  FeatureFlagEventType,
  FeatureFlagRuleEffect,
  FeatureFlagRuleScope,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddBetaCohortMemberDto,
  CreateBetaCohortDto,
  CreateBetaProgramDto,
  ListBetaFeedbackDto,
  ListBetaProgramsDto,
  SubmitBetaFeedbackDto,
  UpdateBetaCohortDto,
  UpdateBetaCohortMemberDto,
  UpdateBetaFeedbackDto,
  UpdateBetaProgramDto,
} from './dto/beta-programs.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class BetaProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [programs, activePrograms, cohorts, activeCohorts, activeMembers, newFeedback, recentPrograms, recentFeedback] = await Promise.all([
      this.prisma.betaProgram.count(),
      this.prisma.betaProgram.count({ where: { status: BetaProgramStatus.ACTIVE } }),
      this.prisma.betaCohort.count(),
      this.prisma.betaCohort.count({ where: { status: BetaCohortStatus.ACTIVE } }),
      this.prisma.betaCohortMember.count({ where: { status: BetaCohortMemberStatus.ACTIVE } }),
      this.prisma.betaFeedback.count({ where: { status: BetaFeedbackStatus.NEW } }),
      this.prisma.betaProgram.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: { id: true, key: true, name: true, status: true, moduleKey: true, targetRelease: true, updatedAt: true },
      }),
      this.prisma.betaFeedback.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          betaProgram: { select: { id: true, name: true, key: true } },
          betaCohort: { select: { id: true, name: true, key: true } },
          organization: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, fullName: true } },
        },
      }),
    ]);
    return { programs, activePrograms, cohorts, activeCohorts, activeMembers, newFeedback, recentPrograms, recentFeedback };
  }

  async listPrograms(query: ListBetaProgramsDto = {}) {
    return this.prisma.betaProgram.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.moduleKey ? { moduleKey: query.moduleKey } : {}),
        ...(query.q
          ? {
              OR: [
                { key: { contains: query.q, mode: 'insensitive' as const } },
                { name: { contains: query.q, mode: 'insensitive' as const } },
                { description: { contains: query.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: {
        featureFlag: { select: { id: true, key: true, name: true, status: true, moduleKey: true } },
        owner: { select: { id: true, email: true, fullName: true } },
        _count: { select: { cohorts: true, feedback: true, events: true } },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 300,
    });
  }

  async getProgram(idOrKey: string) {
    const program = await this.prisma.betaProgram.findFirst({
      where: { OR: [{ id: idOrKey }, { key: idOrKey }] },
      include: {
        featureFlag: { select: { id: true, key: true, name: true, status: true, moduleKey: true } },
        owner: { select: { id: true, email: true, fullName: true } },
        cohorts: {
          include: {
            featureFlag: { select: { id: true, key: true, name: true, status: true, moduleKey: true } },
            members: {
              include: {
                organization: { select: { id: true, name: true, status: true, betaAccessEnabled: true } },
                user: { select: { id: true, email: true, fullName: true, role: true, organizationId: true } },
              },
              orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
            },
            _count: { select: { members: true, feedback: true, featureFlagRules: true } },
          },
          orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        },
        feedback: {
          include: {
            betaCohort: { select: { id: true, key: true, name: true } },
            organization: { select: { id: true, name: true } },
            user: { select: { id: true, email: true, fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
        events: {
          include: { actorUser: { select: { id: true, email: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 40,
        },
      },
    });
    if (!program) throw new NotFoundException('Beta program not found');
    return program;
  }

  async createProgram(actor: AuthUser, dto: CreateBetaProgramDto) {
    this.assertSuperAdmin(actor);
    const actorId = this.userId(actor);
    const program = await this.prisma.betaProgram.create({
      data: {
        key: this.normalizeKey(dto.key),
        name: dto.name.trim(),
        description: this.optionalText(dto.description),
        status: dto.status || BetaProgramStatus.DRAFT,
        moduleKey: this.optionalText(dto.moduleKey),
        featureFlagId: this.optionalText(dto.featureFlagId),
        targetRelease: this.optionalText(dto.targetRelease),
        successCriteria: dto.successCriteria as Prisma.InputJsonValue | undefined,
        riskNotes: this.optionalText(dto.riskNotes),
        startsAt: this.optionalDate(dto.startsAt),
        endsAt: this.optionalDate(dto.endsAt),
        ownerId: this.optionalText(dto.ownerId),
        createdById: actorId || undefined,
        updatedById: actorId || undefined,
      },
    });
    await this.recordEvent({ betaProgramId: program.id }, actor, BetaProgramEventType.CREATED, 'Beta program created', program.name);
    return this.getProgram(program.id);
  }

  async updateProgram(actor: AuthUser, id: string, dto: UpdateBetaProgramDto) {
    this.assertSuperAdmin(actor);
    const current = await this.getProgram(id);
    const data: Record<string, unknown> = { updatedById: this.userId(actor) || undefined };
    if (dto.key !== undefined) data.key = this.normalizeKey(dto.key);
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = this.optionalText(dto.description);
    if (dto.moduleKey !== undefined) data.moduleKey = this.optionalText(dto.moduleKey);
    if (dto.featureFlagId !== undefined) data.featureFlagId = this.optionalText(dto.featureFlagId);
    if (dto.targetRelease !== undefined) data.targetRelease = this.optionalText(dto.targetRelease);
    if (dto.successCriteria !== undefined) data.successCriteria = dto.successCriteria as Prisma.InputJsonValue | null;
    if (dto.riskNotes !== undefined) data.riskNotes = this.optionalText(dto.riskNotes);
    if (dto.ownerId !== undefined) data.ownerId = this.optionalText(dto.ownerId);
    if (dto.startsAt !== undefined) data.startsAt = this.optionalDate(dto.startsAt);
    if (dto.endsAt !== undefined) data.endsAt = this.optionalDate(dto.endsAt);
    const updated = await this.prisma.betaProgram.update({ where: { id: current.id }, data });
    await this.recordEvent({ betaProgramId: updated.id }, actor, BetaProgramEventType.UPDATED, 'Beta program updated', updated.name);
    return this.getProgram(updated.id);
  }

  async updateProgramStatus(actor: AuthUser, id: string, status: BetaProgramStatus) {
    this.assertSuperAdmin(actor);
    const current = await this.getProgram(id);
    const updated = await this.prisma.betaProgram.update({ where: { id: current.id }, data: { status, updatedById: this.userId(actor) || undefined } });
    await this.recordEvent({ betaProgramId: updated.id }, actor, BetaProgramEventType.STATUS_CHANGED, 'Beta program status changed', `${current.status} -> ${status}`);
    return this.getProgram(updated.id);
  }

  async createCohort(actor: AuthUser, betaProgramId: string, dto: CreateBetaCohortDto) {
    this.assertSuperAdmin(actor);
    const program = await this.getProgram(betaProgramId);
    const cohort = await this.prisma.betaCohort.create({
      data: {
        betaProgramId: program.id,
        key: this.normalizeKey(dto.key),
        name: dto.name.trim(),
        description: this.optionalText(dto.description),
        status: dto.status || BetaCohortStatus.DRAFT,
        moduleKey: this.optionalText(dto.moduleKey) || program.moduleKey,
        featureFlagId: this.optionalText(dto.featureFlagId) || program.featureFlagId,
        rolloutPercentage: dto.rolloutPercentage ?? 100,
        entryCriteria: dto.entryCriteria as Prisma.InputJsonValue | undefined,
        exitCriteria: dto.exitCriteria as Prisma.InputJsonValue | undefined,
        startsAt: this.optionalDate(dto.startsAt),
        endsAt: this.optionalDate(dto.endsAt),
        createdById: this.userId(actor) || undefined,
        updatedById: this.userId(actor) || undefined,
      },
    });
    await this.ensureCohortFlagRule(cohort.id, actor);
    await this.recordEvent({ betaProgramId: program.id, betaCohortId: cohort.id }, actor, BetaProgramEventType.COHORT_CREATED, 'Beta cohort created', cohort.name);
    return this.getProgram(program.id);
  }

  async updateCohort(actor: AuthUser, cohortId: string, dto: UpdateBetaCohortDto) {
    this.assertSuperAdmin(actor);
    const current = await this.getCohort(cohortId);
    const data: Record<string, unknown> = { updatedById: this.userId(actor) || undefined };
    if (dto.key !== undefined) data.key = this.normalizeKey(dto.key);
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = this.optionalText(dto.description);
    if (dto.moduleKey !== undefined) data.moduleKey = this.optionalText(dto.moduleKey);
    if (dto.featureFlagId !== undefined) data.featureFlagId = this.optionalText(dto.featureFlagId);
    if (dto.rolloutPercentage !== undefined) data.rolloutPercentage = dto.rolloutPercentage;
    if (dto.entryCriteria !== undefined) data.entryCriteria = dto.entryCriteria as Prisma.InputJsonValue | null;
    if (dto.exitCriteria !== undefined) data.exitCriteria = dto.exitCriteria as Prisma.InputJsonValue | null;
    if (dto.startsAt !== undefined) data.startsAt = this.optionalDate(dto.startsAt);
    if (dto.endsAt !== undefined) data.endsAt = this.optionalDate(dto.endsAt);
    const updated = await this.prisma.betaCohort.update({ where: { id: current.id }, data });
    await this.ensureCohortFlagRule(updated.id, actor);
    await this.recordEvent({ betaProgramId: updated.betaProgramId, betaCohortId: updated.id }, actor, BetaProgramEventType.COHORT_UPDATED, 'Beta cohort updated', updated.name);
    return this.getProgram(updated.betaProgramId);
  }

  async updateCohortStatus(actor: AuthUser, cohortId: string, status: BetaCohortStatus) {
    this.assertSuperAdmin(actor);
    const current = await this.getCohort(cohortId);
    const updated = await this.prisma.betaCohort.update({ where: { id: current.id }, data: { status, updatedById: this.userId(actor) || undefined } });
    await this.ensureCohortFlagRule(updated.id, actor);
    await this.recordEvent({ betaProgramId: updated.betaProgramId, betaCohortId: updated.id }, actor, BetaProgramEventType.COHORT_STATUS_CHANGED, 'Beta cohort status changed', `${current.status} -> ${status}`);
    return this.getProgram(updated.betaProgramId);
  }

  async addMember(actor: AuthUser, cohortId: string, dto: AddBetaCohortMemberDto) {
    this.assertSuperAdmin(actor);
    this.assertMemberTarget(dto);
    const cohort = await this.getCohort(cohortId);
    const status = dto.status || BetaCohortMemberStatus.ACTIVE;
    const existing = await this.prisma.betaCohortMember.findFirst({
      where: {
        betaCohortId: cohort.id,
        ...(dto.memberType === BetaCohortMemberType.ORGANIZATION ? { organizationId: dto.organizationId } : { userId: dto.userId }),
      },
    });
    const data = {
      memberType: dto.memberType,
      organizationId: dto.memberType === BetaCohortMemberType.ORGANIZATION ? dto.organizationId : null,
      userId: dto.memberType === BetaCohortMemberType.USER ? dto.userId : null,
      status,
      role: dto.role || null,
      notes: this.optionalText(dto.notes),
      activatedAt: status === BetaCohortMemberStatus.ACTIVE ? new Date() : undefined,
      invitedAt: status === BetaCohortMemberStatus.INVITED ? new Date() : undefined,
      removedAt: status === BetaCohortMemberStatus.REMOVED ? new Date() : null,
      updatedById: this.userId(actor) || undefined,
    };
    const member = existing
      ? await this.prisma.betaCohortMember.update({ where: { id: existing.id }, data })
      : await this.prisma.betaCohortMember.create({ data: { betaCohortId: cohort.id, ...data, createdById: this.userId(actor) || undefined } });
    if (member.organizationId && member.status === BetaCohortMemberStatus.ACTIVE) {
      await this.prisma.organization.update({ where: { id: member.organizationId }, data: { betaAccessEnabled: true } }).catch(() => undefined);
    }
    await this.recordEvent({ betaProgramId: cohort.betaProgramId, betaCohortId: cohort.id }, actor, BetaProgramEventType.MEMBER_ADDED, 'Beta member added', member.organizationId || member.userId || member.id);
    return this.getProgram(cohort.betaProgramId);
  }

  async updateMember(actor: AuthUser, cohortId: string, memberId: string, dto: UpdateBetaCohortMemberDto) {
    this.assertSuperAdmin(actor);
    const cohort = await this.getCohort(cohortId);
    const existing = await this.prisma.betaCohortMember.findFirst({ where: { id: memberId, betaCohortId: cohort.id } });
    if (!existing) throw new NotFoundException('Beta cohort member not found');
    const status = dto.status || existing.status;
    await this.prisma.betaCohortMember.update({
      where: { id: existing.id },
      data: {
        ...(dto.status ? { status } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.notes !== undefined ? { notes: this.optionalText(dto.notes) } : {}),
        activatedAt: status === BetaCohortMemberStatus.ACTIVE && !existing.activatedAt ? new Date() : existing.activatedAt,
        removedAt: status === BetaCohortMemberStatus.REMOVED ? new Date() : existing.removedAt,
        updatedById: this.userId(actor) || undefined,
      },
    });
    await this.recordEvent({ betaProgramId: cohort.betaProgramId, betaCohortId: cohort.id }, actor, BetaProgramEventType.MEMBER_UPDATED, 'Beta member updated', memberId);
    return this.getProgram(cohort.betaProgramId);
  }

  async removeMember(actor: AuthUser, cohortId: string, memberId: string) {
    return this.updateMember(actor, cohortId, memberId, { status: BetaCohortMemberStatus.REMOVED });
  }

  async myAccess(user: AuthUser) {
    const userId = this.userId(user);
    const organizationId = user.organizationId || null;
    if (!userId) throw new ForbiddenException('Authentication required');
    const members = await this.prisma.betaCohortMember.findMany({
      where: {
        status: BetaCohortMemberStatus.ACTIVE,
        OR: [{ userId }, ...(organizationId ? [{ organizationId }] : [])],
        betaCohort: { status: BetaCohortStatus.ACTIVE, betaProgram: { status: BetaProgramStatus.ACTIVE } },
      },
      include: {
        betaCohort: {
          include: {
            betaProgram: { select: { id: true, key: true, name: true, moduleKey: true, targetRelease: true } },
            featureFlag: { select: { id: true, key: true, name: true, moduleKey: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return members.map((member) => ({ member, cohort: member.betaCohort, program: member.betaCohort.betaProgram }));
  }

  async submitFeedback(user: AuthUser, dto: SubmitBetaFeedbackDto) {
    const userId = this.userId(user);
    if (!userId) throw new ForbiddenException('Authentication required');
    if (dto.betaCohortId) await this.assertCanSubmitForCohort(user, dto.betaCohortId);
    const feedback = await this.prisma.betaFeedback.create({
      data: {
        betaProgramId: this.optionalText(dto.betaProgramId),
        betaCohortId: this.optionalText(dto.betaCohortId),
        organizationId: user.organizationId || null,
        userId,
        featureFlagId: this.optionalText(dto.featureFlagId),
        moduleKey: this.optionalText(dto.moduleKey),
        title: dto.title.trim(),
        message: dto.message.trim(),
        sentiment: dto.sentiment || 'NEUTRAL',
        severity: dto.severity || BetaFeedbackSeverity.MEDIUM,
        pageUrl: this.optionalText(dto.pageUrl),
        screenshotUrl: this.optionalText(dto.screenshotUrl),
        contextJson: dto.contextJson as Prisma.InputJsonValue | undefined,
      },
    });
    await this.recordEvent({ betaProgramId: feedback.betaProgramId || undefined, betaCohortId: feedback.betaCohortId || undefined }, user, BetaProgramEventType.FEEDBACK_SUBMITTED, 'Beta feedback submitted', feedback.title);
    return feedback;
  }

  async listFeedback(query: ListBetaFeedbackDto = {}) {
    return this.prisma.betaFeedback.findMany({
      where: {
        ...(query.betaProgramId ? { betaProgramId: query.betaProgramId } : {}),
        ...(query.betaCohortId ? { betaCohortId: query.betaCohortId } : {}),
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.severity ? { severity: query.severity } : {}),
      },
      include: {
        betaProgram: { select: { id: true, key: true, name: true } },
        betaCohort: { select: { id: true, key: true, name: true } },
        organization: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, fullName: true, role: true } },
        featureFlag: { select: { id: true, key: true, name: true, moduleKey: true } },
        reviewedBy: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  async updateFeedback(actor: AuthUser, id: string, dto: UpdateBetaFeedbackDto) {
    this.assertSuperAdmin(actor);
    const current = await this.prisma.betaFeedback.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Beta feedback not found');
    const updated = await this.prisma.betaFeedback.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.severity ? { severity: dto.severity } : {}),
        ...(dto.internalNotes !== undefined ? { internalNotes: this.optionalText(dto.internalNotes) } : {}),
        reviewedById: this.userId(actor) || undefined,
        reviewedAt: new Date(),
      },
    });
    await this.recordEvent({ betaProgramId: updated.betaProgramId || undefined, betaCohortId: updated.betaCohortId || undefined }, actor, BetaProgramEventType.FEEDBACK_REVIEWED, 'Beta feedback reviewed', updated.title);
    return updated;
  }

  private async getCohort(cohortId: string) {
    const cohort = await this.prisma.betaCohort.findUnique({ where: { id: cohortId } });
    if (!cohort) throw new NotFoundException('Beta cohort not found');
    return cohort;
  }

  private async ensureCohortFlagRule(cohortId: string, actor: AuthUser) {
    const cohort = await this.prisma.betaCohort.findUnique({ where: { id: cohortId }, include: { betaProgram: true } });
    if (!cohort?.featureFlagId) return;
    const existing = await this.prisma.featureFlagRule.findFirst({
      where: { featureFlagId: cohort.featureFlagId, betaCohortId: cohort.id, scope: FeatureFlagRuleScope.COHORT },
    });
    const data = {
      effect: FeatureFlagRuleEffect.ENABLE,
      rolloutPercentage: cohort.rolloutPercentage,
      priority: 650,
      startsAt: cohort.startsAt,
      endsAt: cohort.endsAt,
      updatedById: this.userId(actor) || undefined,
    };
    const rule = existing
      ? await this.prisma.featureFlagRule.update({ where: { id: existing.id }, data })
      : await this.prisma.featureFlagRule.create({
          data: {
            featureFlagId: cohort.featureFlagId,
            scope: FeatureFlagRuleScope.COHORT,
            betaCohortId: cohort.id,
            createdById: this.userId(actor) || undefined,
            ...data,
          },
        });
    await this.prisma.featureFlagEvent.create({
      data: {
        featureFlagId: cohort.featureFlagId,
        actorUserId: this.userId(actor) || undefined,
        eventType: FeatureFlagEventType.RULE_UPDATED,
        title: 'Beta cohort linked',
        message: `${cohort.name} enables this flag for active beta members.`,
        metadata: { betaCohortId: cohort.id, betaProgramId: cohort.betaProgramId, ruleId: rule.id },
      },
    });
    await this.recordEvent({ betaProgramId: cohort.betaProgramId, betaCohortId: cohort.id }, actor, BetaProgramEventType.FEATURE_FLAG_LINKED, 'Feature flag linked', cohort.featureFlagId);
  }

  private async assertCanSubmitForCohort(user: AuthUser, betaCohortId: string) {
    const userId = this.userId(user);
    const organizationId = user.organizationId || null;
    const member = await this.prisma.betaCohortMember.findFirst({
      where: {
        betaCohortId,
        status: BetaCohortMemberStatus.ACTIVE,
        OR: [{ userId }, ...(organizationId ? [{ organizationId }] : [])],
      },
    });
    if (!member && this.normalizeRole(user.role) !== Role.SUPERADMIN) {
      throw new ForbiddenException('Beta cohort access required');
    }
  }

  private assertMemberTarget(dto: AddBetaCohortMemberDto) {
    if (dto.memberType === BetaCohortMemberType.ORGANIZATION && !dto.organizationId) throw new BadRequestException('ORGANIZATION member requires organizationId');
    if (dto.memberType === BetaCohortMemberType.USER && !dto.userId) throw new BadRequestException('USER member requires userId');
  }

  private async recordEvent(scope: { betaProgramId?: string; betaCohortId?: string }, actor: AuthUser, eventType: BetaProgramEventType, title: string, message?: string, metadata?: Record<string, unknown>) {
    await this.prisma.betaProgramEvent.create({
      data: {
        betaProgramId: scope.betaProgramId,
        betaCohortId: scope.betaCohortId,
        actorUserId: this.userId(actor) || undefined,
        eventType,
        title,
        message,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private assertSuperAdmin(user: AuthUser) {
    if (this.normalizeRole(user.role) !== Role.SUPERADMIN) throw new ForbiddenException('Super admin access required');
  }

  private normalizeRole(role?: string | Role | null): Role {
    const value = String(role || '').toUpperCase();
    if (value === 'SUPERADMIN' || value === 'SUPER_ADMIN') return Role.SUPERADMIN;
    if (value === 'RESIDENT' || value === 'TENANT') return Role.RESIDENT;
    return Role.ADMIN;
  }

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private normalizeKey(value: string) {
    const key = value.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!key) throw new BadRequestException('Key is required');
    return key;
  }

  private optionalText(value?: string | null) {
    if (value === null) return null;
    if (value === undefined) return undefined;
    return value.trim() || null;
  }

  private optionalDate(value?: string | null) {
    if (value === null || value === '') return null;
    if (value === undefined) return undefined;
    return new Date(value);
  }
}
