import { BadRequestException, ConflictException, ForbiddenException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthProvider, InvitationStatus, PlatformRole, ResidentType, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { EmailTemplateService } from '../email/email-template.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class InvitationsService {
  private readonly passwordSaltRounds = 12;
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {}

  private assertAdmin(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    if (!user.organizationId) {
      throw new ForbiddenException('Organization context missing');
    }
    return user.organizationId;
  }

  private buildInviteLink(token: string) {
    const appUrl = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    return `${appUrl}/ro/accept-invitation/${token}`;
  }

  async adminList(user: AuthUser) {
    const organizationId = this.assertAdmin(user);
    return this.prisma.invitation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } },
      },
    });
  }

  async adminCreate(user: AuthUser, dto: CreateInvitationDto) {
    const organizationId = this.assertAdmin(user);
    if (dto.role === Role.SUPERADMIN || dto.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('ADMIN cannot invite SUPER_ADMIN');
    }
    const normalizedRole = dto.role === Role.MANAGER || dto.role === Role.TENANT ? Role.RESIDENT : dto.role;

    if (dto.apartmentId) {
      const apartment = await this.prisma.apartment.findFirst({
        where: { id: dto.apartmentId, organizationId },
        select: { id: true },
      });
      if (!apartment) throw new BadRequestException('Cannot link invitation to apartment from another organization');
    }

    const email = dto.email.toLowerCase().trim();
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        email,
        phone: dto.phone || null,
        role: normalizedRole,
        apartmentId: dto.apartmentId || null,
        residentType: dto.residentType ? (dto.residentType as ResidentType) : null,
        token,
        status: InvitationStatus.PENDING,
        expiresAt,
        invitedByUserId: user.id || user.sub!,
      },
      include: {
        apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } },
      },
    });
    const inviteLink = this.buildInviteLink(token);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    await this.emailTemplateService.sendTemplateEmail({
      to: invitation.email,
      key: normalizedRole === Role.RESIDENT ? 'resident_invitation' : 'admin_invitation',
      targetRole: normalizedRole === Role.RESIDENT ? 'RESIDENT' : 'ADMIN',
      variables: {
        userName: invitation.email,
        organizationName: organization?.name || 'Espace',
        inviteLink,
        apartmentNumber: invitation.apartment?.number || '-',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@espace.md',
      },
    });
    return { ...invitation, inviteLink };
  }

  async adminCancel(user: AuthUser, id: string) {
    const organizationId = this.assertAdmin(user);
    const invitation = await this.prisma.invitation.findFirst({ where: { id, organizationId } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException({ code: 'INVITE_ALREADY_USED', message: 'Invitation already accepted' });
    }
    return this.prisma.invitation.update({
      where: { id },
      data: { status: InvitationStatus.CANCELLED },
    });
  }

  async adminResend(user: AuthUser, id: string) {
    const organizationId = this.assertAdmin(user);
    const invitation = await this.prisma.invitation.findFirst({ where: { id, organizationId } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException({ code: 'INVITE_ALREADY_USED', message: 'Invitation already accepted' });
    }
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const updated = await this.prisma.invitation.update({
      where: { id },
      data: { token, expiresAt, status: InvitationStatus.PENDING, invitedByUserId: user.id || user.sub! },
      include: {
        apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } },
      },
    });
    const inviteLink = this.buildInviteLink(token);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    await this.emailTemplateService.sendTemplateEmail({
      to: updated.email,
      key: updated.role === Role.RESIDENT ? 'resident_invitation' : 'admin_invitation',
      targetRole: updated.role === Role.RESIDENT ? 'RESIDENT' : 'ADMIN',
      variables: {
        userName: updated.email,
        organizationName: organization?.name || 'Espace',
        inviteLink,
        apartmentNumber: updated.apartment?.number || '-',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@espace.md',
      },
    });
    return { ...updated, inviteLink };
  }

  async getByToken(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: { select: { id: true, name: true } },
        apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } },
      },
    });
    if (!invitation) throw new BadRequestException({ code: 'INVITE_INVALID', message: 'Invitation is invalid' });
    if (invitation.status === InvitationStatus.CANCELLED) {
      throw new BadRequestException({ code: 'INVITE_INVALID', message: 'Invitation is cancelled' });
    }
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException({ code: 'INVITE_ALREADY_USED', message: 'Invitation already used' });
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.prisma.invitation.update({ where: { id: invitation.id }, data: { status: InvitationStatus.EXPIRED } });
      throw new GoneException({ code: 'INVITE_EXPIRED', message: 'Invitation expired' });
    }
    return invitation;
  }

  async acceptByToken(token: string, password: string) {
    this.assertPasswordStrength(password);
    const invitation = await this.getByToken(token);
    const passwordHash = await bcrypt.hash(password, this.passwordSaltRounds);

    const result = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findFirst({
        where: { email: invitation.email, deletedAt: null },
        select: { id: true, organizationId: true, role: true, passwordHash: true },
      });

      let userId: string;
      if (existingUser) {
        if (existingUser.organizationId !== invitation.organizationId) {
          throw new ConflictException('User belongs to another organization');
        }
        const updates: Record<string, unknown> = {};
        if (!existingUser.passwordHash) updates.passwordHash = passwordHash;
        if (invitation.role === Role.ADMIN && existingUser.role !== Role.ADMIN) updates.role = Role.ADMIN;
        if (Object.keys(updates).length) {
          await tx.user.update({ where: { id: existingUser.id }, data: updates });
        }
        userId = existingUser.id;
      } else {
        const user = await tx.user.create({
          data: {
            email: invitation.email,
            passwordHash,
            authProvider: AuthProvider.LOCAL,
            emailVerifiedAt: new Date(),
            role: invitation.role,
            platformRole: invitation.role === Role.RESIDENT ? PlatformRole.RESIDENT : PlatformRole.ORGANIZATION_USER,
            organizationId: invitation.organizationId,
            isActive: true,
          },
          select: { id: true },
        });
        userId = user.id;
      }

      if (invitation.role === Role.RESIDENT && invitation.apartmentId && invitation.residentType) {
        const exists = await tx.residentProfile.findFirst({
          where: { userId, apartmentId: invitation.apartmentId, organizationId: invitation.organizationId },
          select: { id: true },
        });
        if (!exists) {
          await tx.residentProfile.create({
            data: {
              organizationId: invitation.organizationId,
              userId,
              apartmentId: invitation.apartmentId,
              type: invitation.residentType,
              phone: invitation.phone || null,
              isPrimary: invitation.residentType !== ResidentType.CONTACT,
            },
          });
        }
      }

      if (invitation.role === Role.ADMIN) {
        await tx.organizationMember.upsert({
          where: { userId },
          update: { organizationId: invitation.organizationId, role: 'ORG_ADMIN', status: 'ACTIVE' },
          create: { organizationId: invitation.organizationId, userId, role: 'ORG_ADMIN', status: 'ACTIVE' },
        });
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });

      return { email: invitation.email };
    });

    return result;
  }

  private assertPasswordStrength(password: string) {
    const hasLetter = /[A-Za-z]/.test(password);
    const hasDigit = /\d/.test(password);
    if (password.length < 10 || !hasLetter || !hasDigit) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 10 characters and include letters and numbers',
      });
    }
  }
}
