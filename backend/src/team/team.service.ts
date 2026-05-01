import { BadRequestException, ConflictException, ForbiddenException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthProvider, OrganizationMemberRole, OrganizationMemberStatus, PlatformRole, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { CreateTeamUserDto } from './dto/create-team-user.dto';
import { UpdateTeamUserDto } from './dto/update-team-user.dto';
import { normalizePermissionOverrides, resolvePermissions } from './team-permissions';
import { LimitsService } from '../limits/limits.service';
import { EmailTemplateService } from '../email/email-template.service';

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limitsService: LimitsService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {}

  private userId(user: { id?: string; sub?: string }) {
    return user.id || user.sub || null;
  }

  private assertOrgContext(user: { organizationId?: string | null }) {
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return user.organizationId;
  }

  private buildInviteLink(token: string) {
    const appUrl = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3001').replace(/\/+$/, '');
    return `${appUrl}/ro/accept-team-invitation/${token}`;
  }

  private async ensureCanManageTeam(user: { id?: string; sub?: string; role?: string; organizationId?: string | null }) {
    const organizationId = this.assertOrgContext(user);
    const actorId = this.userId(user);
    if (!actorId) throw new ForbiddenException('Missing actor');

    if (String(user.role || '').toUpperCase() === Role.ADMIN) return { organizationId, actorId };
    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId: actorId, status: OrganizationMemberStatus.ACTIVE },
      select: { role: true, permissionsJson: true },
    });
    if (!member) throw new ForbiddenException('Active organization membership required');
    if (member.role === OrganizationMemberRole.ORG_ADMIN) return { organizationId, actorId };
    const permissions = resolvePermissions(member.role, member.permissionsJson);
    if (!permissions['team.manage']) throw new ForbiddenException('Missing team.manage permission');
    return { organizationId, actorId };
  }

  async adminList(user: { id?: string; sub?: string; role?: string; organizationId?: string | null }) {
    const { organizationId } = await this.ensureCanManageTeam(user);
    return this.listByOrganization(organizationId);
  }

  async superadminList(organizationId: string) {
    return this.listByOrganization(organizationId);
  }

  private async listByOrganization(organizationId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        role: true,
        status: true,
        permissionsJson: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            platformRole: true,
          },
        },
      },
    });
    return {
      items: members.map((member) => ({
        id: member.id,
        userId: member.user.id,
        email: member.user.email,
        fullName: [member.user.firstName, member.user.lastName].filter(Boolean).join(' ') || null,
        role: member.role,
        status: member.status,
        permissions: resolvePermissions(member.role, member.permissionsJson),
        createdAt: member.createdAt,
      })),
      invitations: await this.prisma.teamInvitation.findMany({
        where: { organizationId, status: OrganizationMemberStatus.INVITED },
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true },
      }),
    };
  }

  async adminInvite(user: { id?: string; sub?: string; role?: string; organizationId?: string | null }, dto: CreateTeamUserDto) {
    const { organizationId, actorId } = await this.ensureCanManageTeam(user);
    return this.inviteByOrganization(organizationId, actorId, String(user.role || 'ADMIN').toUpperCase(), dto);
  }

  async superadminInvite(organizationId: string, actorId: string, actorRole: string, dto: CreateTeamUserDto) {
    return this.inviteByOrganization(organizationId, actorId, actorRole, dto);
  }

  private async inviteByOrganization(organizationId: string, actorId: string, actorRole: string, dto: CreateTeamUserDto) {
    const teamMembersCount = await this.prisma.organizationMember.count({
      where: {
        organizationId,
        status: { in: [OrganizationMemberStatus.ACTIVE, OrganizationMemberStatus.INVITED] },
      },
    });
    await this.limitsService.assertWithinCountLimit(
      { id: actorId, organizationId, role: actorRole },
      organizationId,
      'maxTeamMembers',
      teamMembersCount,
    );

    const normalizedEmail = dto.email.toLowerCase().trim();
    const existingMember = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (existingMember) throw new ConflictException('User already exists in this organization');

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await this.prisma.teamInvitation.create({
      data: {
        organizationId,
        invitedByUserId: actorId,
        email: normalizedEmail,
        role: dto.role,
        permissionsJson: normalizePermissionOverrides(dto.permissions),
        token,
        expiresAt,
      },
      select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true, token: true },
    });
    const inviteLink = this.buildInviteLink(token);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    await this.emailTemplateService.sendTemplateEmail({
      to: invitation.email,
      key: 'team_invitation',
      targetRole: 'TEAM',
      variables: {
        userName: invitation.email,
        organizationName: organization?.name || 'Espace',
        inviteLink,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@espace.local',
      },
    });
    return { ...invitation, inviteLink };
  }

  async adminUpdateMember(
    user: { id?: string; sub?: string; role?: string; organizationId?: string | null },
    memberId: string,
    dto: UpdateTeamUserDto,
  ) {
    const { organizationId } = await this.ensureCanManageTeam(user);
    return this.updateMemberByOrganization(organizationId, memberId, dto);
  }

  async superadminUpdateMember(organizationId: string, memberId: string, dto: UpdateTeamUserDto) {
    return this.updateMemberByOrganization(organizationId, memberId, dto);
  }

  private async updateMemberByOrganization(organizationId: string, memberId: string, dto: UpdateTeamUserDto) {
    const member = await this.prisma.organizationMember.findFirst({ where: { id: memberId, organizationId }, select: { id: true } });
    if (!member) throw new NotFoundException('Member not found');
    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data: {
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.permissions ? { permissionsJson: normalizePermissionOverrides(dto.permissions) } : {}),
      },
      select: { id: true, role: true, status: true, permissionsJson: true, updatedAt: true },
    });
  }

  async adminDisableMember(user: { id?: string; sub?: string; role?: string; organizationId?: string | null }, memberId: string) {
    const { organizationId } = await this.ensureCanManageTeam(user);
    return this.disableMemberByOrganization(organizationId, memberId);
  }

  async superadminDisableMember(organizationId: string, memberId: string) {
    return this.disableMemberByOrganization(organizationId, memberId);
  }

  private async disableMemberByOrganization(organizationId: string, memberId: string) {
    const member = await this.prisma.organizationMember.findFirst({ where: { id: memberId, organizationId }, select: { id: true } });
    if (!member) throw new NotFoundException('Member not found');
    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { status: OrganizationMemberStatus.DISABLED },
      select: { id: true, role: true, status: true, updatedAt: true },
    });
  }

  async adminUpdatePermissions(
    user: { id?: string; sub?: string; role?: string; organizationId?: string | null },
    memberId: string,
    permissions?: Record<string, boolean>,
  ) {
    const { organizationId } = await this.ensureCanManageTeam(user);
    return this.updatePermissionsByOrganization(organizationId, memberId, permissions);
  }

  async superadminUpdatePermissions(
    organizationId: string,
    memberId: string,
    permissions?: Record<string, boolean>,
  ) {
    return this.updatePermissionsByOrganization(organizationId, memberId, permissions);
  }

  private async updatePermissionsByOrganization(
    organizationId: string,
    memberId: string,
    permissions?: Record<string, boolean>,
  ) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
      select: { id: true, role: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { permissionsJson: normalizePermissionOverrides(permissions) },
      select: { id: true, role: true, status: true, permissionsJson: true, updatedAt: true },
    });
  }

  async acceptInvitation(token: string, password: string) {
    if (!password || password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new BadRequestException('Password must be at least 10 characters and include letters and digits');
    }
    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        organizationId: true,
        email: true,
        role: true,
        permissionsJson: true,
        status: true,
        expiresAt: true,
      },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== OrganizationMemberStatus.INVITED) {
      throw new ConflictException('Invitation is no longer active');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: OrganizationMemberStatus.DISABLED },
      });
      throw new GoneException('Invitation expired');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findFirst({
        where: { email: invitation.email, deletedAt: null },
        select: { id: true, organizationId: true },
      });

      if (user && user.organizationId !== invitation.organizationId) {
        throw new ConflictException('User already belongs to another organization');
      }

      if (!user) {
        user = await tx.user.create({
          data: {
            email: invitation.email,
            passwordHash,
            authProvider: AuthProvider.LOCAL,
            emailVerifiedAt: new Date(),
            role: Role.MANAGER,
            platformRole: PlatformRole.ORGANIZATION_USER,
            organizationId: invitation.organizationId,
          },
          select: { id: true, email: true, organizationId: true },
        });
      }

      await tx.organizationMember.upsert({
        where: { userId: user.id },
        update: {
          organizationId: invitation.organizationId,
          role: invitation.role,
          status: OrganizationMemberStatus.ACTIVE,
          permissionsJson: invitation.permissionsJson ?? undefined,
        },
        create: {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role,
          status: OrganizationMemberStatus.ACTIVE,
          permissionsJson: invitation.permissionsJson ?? undefined,
        },
      });

      await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: OrganizationMemberStatus.ACTIVE },
      });
      return { email: invitation.email };
    });
    return result;
  }
}
