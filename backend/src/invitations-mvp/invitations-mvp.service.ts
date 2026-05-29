import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ApartmentResidentRole,
  AdminHandoverStatus,
  AuthProvider,
  InvitationStatus,
  OrganizationMemberRole,
  OrganizationMemberStatus,
  PlatformRole,
  Prisma,
  ResidentAccountStatus,
  ResidentType,
  Role,
  SuperadminNotificationSeverity,
  SuperadminNotificationStatus,
  SuperadminNotificationType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

@Injectable()
export class InvitationsMvpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly audit: AuditService,
  ) {}

  private isSuperadmin(user: MvpUser) {
    return String(user.role).toUpperCase() === Role.SUPERADMIN;
  }

  private assertOrganizationAccess(user: MvpUser, organizationId: string) {
    if (!this.isSuperadmin(user) && user.organizationId !== organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ORGANIZATION',
        message: 'Nu ai acces la aceste date.',
      });
    }
  }

  private appUrl() {
    return (
      process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');
  }

  private activationLink(token: string) {
    return `${this.appUrl()}/ro/accept-invitation/${token}`;
  }

  private adminInvitationLink(token: string) {
    return `${this.appUrl()}/ro/invitatie-admin/${encodeURIComponent(token)}`;
  }

  private expiresAt(days = 7) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    return expiresAt;
  }

  private token() {
    return randomBytes(32).toString('hex');
  }

  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private email(value: unknown) {
    const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException({
        code: 'INVALID_EMAIL',
        message: 'Emailul nu este valid.',
      });
    }
    return email;
  }

  private string(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private safeInvitation(invitation: any, includeLink = true, rawToken?: string) {
    const link =
      includeLink && rawToken
        ? invitation.role === Role.ADMIN
          ? this.adminInvitationLink(rawToken)
          : this.activationLink(rawToken)
        : includeLink && !invitation.tokenHash
          ? this.activationLink(invitation.token)
          : undefined;
    return {
      id: invitation.id,
      name: invitation.name,
      email: invitation.email,
      phone: invitation.phone,
      role: invitation.role,
      organizationId: invitation.organizationId,
      organization: invitation.organization
        ? {
            id: invitation.organization.id,
            name: invitation.organization.name,
          }
        : undefined,
      apartment: invitation.apartment
        ? {
            id: invitation.apartment.id,
            number: invitation.apartment.number,
            building: invitation.apartment.building,
            staircase: invitation.apartment.staircase,
          }
        : null,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      createdAt: invitation.createdAt,
      activationLink: link,
      inviteLink: link,
      inviteUrl: link,
      emailSending: 'MANUAL_LINK',
      emailSent: false,
    };
  }

  private invitationResponse(invitation: any, delivery?: { sent: boolean; warning?: string }, rawToken?: string) {
    const safe = this.safeInvitation(invitation, true, rawToken);
    return {
      ...safe,
      invitation: safe,
      emailSent: delivery?.sent ?? false,
      emailSending: delivery?.sent ? 'SENT' : 'MANUAL_LINK',
      ...(delivery?.warning ? { warning: delivery.warning } : {}),
    };
  }

  private shouldSendEmail(value: unknown) {
    return value === true || value === 'true' || value === '1';
  }

  private positiveDays(value: unknown, fallback = 7) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.trunc(parsed), 1), 30);
  }

  private splitName(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const firstName = parts.shift() || name.trim();
    const lastName = parts.join(' ');
    return { firstName, lastName, fullName: [firstName, lastName].filter(Boolean).join(' ') };
  }

  private async maybeSendInvitationEmail(
    invitation: any,
    sendEmail: boolean,
    invitedName?: string | null,
    rawToken?: string,
  ): Promise<{ sent: boolean; warning?: string }> {
    if (!sendEmail) return { sent: false };
    const result = await this.emailService.sendInvitationEmail({
      to: invitation.email,
      role: invitation.role,
      activationLink: rawToken
        ? invitation.role === Role.ADMIN
          ? this.adminInvitationLink(rawToken)
          : this.activationLink(rawToken)
        : this.activationLink(invitation.token),
      organizationName: invitation.organization?.name || 'A.P.C.',
      invitedName,
      expiresAt: invitation.expiresAt,
      apartmentNumber: invitation.apartment?.number || null,
    });
    return {
      sent: result.sent,
      ...(result.warning ? { warning: result.warning } : {}),
    };
  }

  private async cancelPendingInvitations(tx: any, organizationId: string, email: string, role: Role) {
    await tx.invitation.updateMany({
      where: {
        organizationId,
        email,
        role,
        status: InvitationStatus.PENDING,
      },
      data: { status: InvitationStatus.CANCELLED },
    });
  }

  async createAdminInvitation(user: MvpUser, organizationId: string, body: unknown) {
    if (!this.isSuperadmin(user)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Nu ai acces la această zonă.',
      });
    }
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const email = this.email(payload.email);
    const name =
      this.string(payload.name) ||
      `${this.string(payload.firstName)} ${this.string(payload.lastName)}`.trim();
    const phone = this.string(payload.phone) || null;
    const sendEmail = this.shouldSendEmail(payload.sendEmail);
    const expiresInDays = this.positiveDays(payload.expiresInDays, 7);
    if (!name) {
      throw new BadRequestException({
        code: 'FIELDS_REQUIRED',
        message: 'Numele administratorului este obligatoriu.',
      });
    }
    if (!phone) {
      throw new BadRequestException({
        code: 'FIELDS_REQUIRED',
        message: 'Telefonul administratorului este obligatoriu.',
      });
    }
    const { firstName, lastName, fullName } = this.splitName(name);
    const rawToken = this.token();
    const tokenHash = this.tokenHash(rawToken);
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          adminHandoverStatus: true,
          adminInvitedAt: true,
        },
      });
      if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');

      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true, organizationId: true, isActive: true, passwordHash: true },
      });
      if (existingUser && existingUser.organizationId !== organizationId) {
        throw new ConflictException('Există deja un utilizator cu acest email.');
      }

      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            firstName,
            lastName,
            fullName,
            phone,
            role: Role.ADMIN,
            platformRole: PlatformRole.ORGANIZATION_USER,
            organizationId,
          },
        });
      } else {
        await tx.user.create({
          data: {
            email,
            firstName,
            lastName,
            fullName,
            phone,
            role: Role.ADMIN,
            platformRole: PlatformRole.ORGANIZATION_USER,
            organizationId,
            authProvider: AuthProvider.LOCAL,
            isActive: false,
          },
        });
      }

      await this.cancelPendingInvitations(tx, organizationId, email, Role.ADMIN);
      const invitation = await tx.invitation.create({
        data: {
          organizationId,
          email,
          phone,
          name,
          role: Role.ADMIN,
          token: `admin_handover_${tokenHash}`,
          tokenHash,
          status: InvitationStatus.PENDING,
          expiresAt: this.expiresAt(expiresInDays),
          invitedByUserId: user.id,
        },
        include: {
          organization: { select: { id: true, name: true } },
          apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } },
        },
      });

      await tx.organization.update({
        where: { id: organizationId },
        data: {
          adminHandoverStatus: AdminHandoverStatus.INVITED,
          adminInvitedAt: now,
        },
      });

      await this.audit.record(
        {
          actorId: user.id,
          actorRole: user.role,
          organizationId,
          action: 'ADMIN_INVITATION_CREATED',
          entityType: 'USER',
          entityId: invitation.id,
          title: 'Invitație Admin creată',
          description: `Invitația pentru ${name} a fost creată.`,
          severity: 'INFO',
          metadata: {
            invitationId: invitation.id,
            email,
            expiresAt: invitation.expiresAt,
            emailSending: sendEmail ? 'REQUESTED' : 'MANUAL_LINK',
          },
        },
        tx,
      );
      await this.audit.record(
        {
          actorId: user.id,
          actorRole: user.role,
          organizationId,
          action: 'ADMIN_HANDOVER_STATUS_CHANGED',
          entityType: 'ORGANIZATION',
          entityId: organizationId,
          title: 'Predare Admin inițiată',
          description: 'Statusul predării către Admin a fost schimbat în INVITED.',
          severity: 'INFO',
          before: { adminHandoverStatus: organization.adminHandoverStatus, adminInvitedAt: organization.adminInvitedAt },
          after: { adminHandoverStatus: AdminHandoverStatus.INVITED, adminInvitedAt: now },
        },
        tx,
      );
      return invitation;
    });

    const delivery = await this.maybeSendInvitationEmail(result, sendEmail, fullName, rawToken);
    return this.invitationResponse(result, delivery, rawToken);
  }

  async createResidentInvitation(user: MvpUser, residentId: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const email = this.email(payload.email);
    const requestedPhone = this.string(payload.phone);
    const sendEmail = this.shouldSendEmail(payload.sendEmail);

    const resident = await this.prisma.residentProfile.findFirst({
      where: {
        id: residentId,
        ...(this.isSuperadmin(user) ? {} : { organizationId: user.organizationId }),
      },
      select: {
        id: true,
        organizationId: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        userId: true,
        type: true,
        apartmentId: true,
        apartmentResidents: {
          take: 1,
          select: {
            apartmentId: true,
            role: true,
          },
        },
      },
    });
    if (!resident) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertOrganizationAccess(user, resident.organizationId);
    if (resident.userId) {
      throw new ConflictException('Acest locatar are deja cont.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, isActive: true, passwordHash: true },
    });
    if (existingUser?.isActive && existingUser.passwordHash) {
      throw new ConflictException('Există deja un utilizator cu acest email.');
    }

    const apartmentId = resident.apartmentResidents[0]?.apartmentId || resident.apartmentId || null;
    const phone = requestedPhone || resident.phone || null;
    const invitation = await this.prisma.$transaction(async (tx) => {
      await this.cancelPendingInvitations(tx, resident.organizationId, email, Role.RESIDENT);
      const created = await tx.invitation.create({
        data: {
          organizationId: resident.organizationId,
          email,
          phone,
          role: Role.RESIDENT,
          apartmentId,
          residentType: resident.type || ResidentType.OWNER,
          token: this.token(),
          status: InvitationStatus.PENDING,
          expiresAt: this.expiresAt(),
          invitedByUserId: user.id,
        },
        include: {
          organization: { select: { id: true, name: true } },
          apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } },
        },
      });
      await tx.residentProfile.update({
        where: { id: resident.id },
        data: {
          email,
          phone,
          accountStatus: ResidentAccountStatus.INVITED,
        },
      });
      return created;
    });

    const delivery = await this.maybeSendInvitationEmail(
      invitation,
      sendEmail,
      `${resident.firstName || ''} ${resident.lastName || ''}`.trim() || null,
    );
    return this.invitationResponse(invitation, delivery);
  }

  async getInvitationByToken(token: string) {
    const invitation = await this.findPendingInvitation(token);
    return this.safeInvitation(invitation, false);
  }

  async acceptInvitation(pathToken: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const token = this.string(pathToken) || this.string(payload.token);
    if (!token) {
      throw new BadRequestException({
        code: 'INVITATION_TOKEN_REQUIRED',
        message: 'Invitația nu este validă.',
      });
    }
    const password = this.string(payload.password);
    const confirmPassword = this.string(payload.confirmPassword);
    if (confirmPassword && password !== confirmPassword) {
      throw new BadRequestException({
        code: 'PASSWORDS_DO_NOT_MATCH',
        message: 'Parolele nu coincid.',
      });
    }
    this.assertPassword(password);

    const invitation = await this.findPendingInvitation(token);
    const passwordHash = await bcrypt.hash(password, 10);
    const acceptedAt = new Date();
    const adminName = this.splitName(invitation.name || invitation.email.split('@')[0]);

    const user = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: invitation.email },
        select: {
          id: true,
          organizationId: true,
        },
      });
      if (existingUser && existingUser.organizationId !== invitation.organizationId) {
        throw new ConflictException('Există deja un utilizator cu acest email.');
      }

      const userRecord = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              passwordHash,
              firstName: adminName.firstName,
              lastName: adminName.lastName || undefined,
              fullName: adminName.fullName,
              role: invitation.role,
              platformRole: invitation.role === Role.RESIDENT ? PlatformRole.RESIDENT : PlatformRole.ORGANIZATION_USER,
              organizationId: invitation.organizationId,
              phone: invitation.phone || undefined,
              authProvider: AuthProvider.LOCAL,
              emailVerifiedAt: new Date(),
              isActive: true,
            },
            select: this.safeUserSelect(),
          })
        : await tx.user.create({
            data: {
              email: invitation.email,
              passwordHash,
              firstName: adminName.firstName,
              lastName: adminName.lastName || null,
              fullName: adminName.fullName,
              role: invitation.role,
              platformRole: invitation.role === Role.RESIDENT ? PlatformRole.RESIDENT : PlatformRole.ORGANIZATION_USER,
              organizationId: invitation.organizationId,
              phone: invitation.phone || null,
              authProvider: AuthProvider.LOCAL,
              emailVerifiedAt: new Date(),
              isActive: true,
            },
            select: this.safeUserSelect(),
          });

      if (invitation.role === Role.RESIDENT) {
        await this.linkResidentProfile(tx, invitation, userRecord.id);
      } else if (invitation.role === Role.ADMIN) {
        await this.linkOrganizationAdmin(tx, invitation.organizationId, userRecord.id, invitation.id);
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt,
          acceptedUserId: userRecord.id,
        },
      });

      if (invitation.role === Role.ADMIN) {
        const beforeOrg = await tx.organization.findUnique({
          where: { id: invitation.organizationId },
          select: { adminHandoverStatus: true, adminAcceptedAt: true, ownerAdminId: true },
        });
        await tx.organization.update({
          where: { id: invitation.organizationId },
          data: {
            ownerAdminId: beforeOrg?.ownerAdminId || userRecord.id,
            adminHandoverStatus: AdminHandoverStatus.ACCEPTED,
            adminAcceptedAt: acceptedAt,
          },
        });
        await this.createSuperadminNotification(
          tx,
          {
            title: 'Adminul a acceptat invitația',
            message: `${adminName.fullName} a acceptat invitația pentru ${invitation.organization?.name || 'organizație'}.`,
            type: SuperadminNotificationType.ADMIN_INVITATION_ACCEPTED,
            severity: SuperadminNotificationSeverity.SUCCESS,
            organizationId: invitation.organizationId,
            actionUrl: `/ro/superadmin/organizations/${invitation.organizationId}?tab=handover`,
            metadata: { invitationId: invitation.id, acceptedUserId: userRecord.id },
          },
          {
            type: SuperadminNotificationType.ADMIN_INVITATION_ACCEPTED,
            organizationId: invitation.organizationId,
            metadataId: invitation.id,
          },
        );
        await this.audit.record(
          {
            actorId: userRecord.id,
            actorRole: Role.ADMIN,
            organizationId: invitation.organizationId,
            targetUserId: userRecord.id,
            action: 'ADMIN_INVITATION_ACCEPTED',
            entityType: 'USER',
            entityId: invitation.id,
            title: 'Invitație Admin acceptată',
            description: `${adminName.fullName} a acceptat invitația de Admin.`,
            severity: 'SUCCESS',
            metadata: { invitationId: invitation.id },
          },
          tx,
        );
        await this.audit.record(
          {
            actorId: userRecord.id,
            actorRole: Role.ADMIN,
            organizationId: invitation.organizationId,
            action: 'ADMIN_HANDOVER_STATUS_CHANGED',
            entityType: 'ORGANIZATION',
            entityId: invitation.organizationId,
            title: 'Predare Admin acceptată',
            description: 'Statusul predării către Admin a fost schimbat în ACCEPTED.',
            severity: 'SUCCESS',
            before: beforeOrg,
            after: {
              adminHandoverStatus: AdminHandoverStatus.ACCEPTED,
              adminAcceptedAt: acceptedAt,
              ownerAdminId: beforeOrg?.ownerAdminId || userRecord.id,
            },
          },
          tx,
        );
      }

      return userRecord;
    });

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    return {
      success: true,
      accessToken,
      user,
      redirectPath: this.redirectPath(user.role, invitation.role === Role.ADMIN),
    };
  }

  async resendAdminInvitation(user: MvpUser, invitationId: string, body?: unknown) {
    if (!this.isSuperadmin(user)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Nu ai acces la această zonă.',
      });
    }
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const expiresInDays = this.positiveDays(payload.expiresInDays, 7);
    const rawToken = this.token();
    const tokenHash = this.tokenHash(rawToken);

    const invitation = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.invitation.findFirst({
        where: { id: invitationId, role: Role.ADMIN },
        include: { organization: { select: { id: true, name: true } } },
      });
      if (!existing) throw new NotFoundException('Invitația nu a fost găsită.');
      if (existing.status === InvitationStatus.ACCEPTED) {
        throw new ConflictException({
          code: 'INVITATION_ACCEPTED',
          message: 'Invitația a fost deja acceptată.',
        });
      }

      const updated = await tx.invitation.update({
        where: { id: invitationId },
        data: {
          status: InvitationStatus.PENDING,
          token: `admin_handover_${tokenHash}`,
          tokenHash,
          expiresAt: this.expiresAt(expiresInDays),
        },
        include: { organization: { select: { id: true, name: true } }, apartment: true },
      });
      await tx.organization.update({
        where: { id: updated.organizationId },
        data: {
          adminHandoverStatus: AdminHandoverStatus.INVITED,
          adminInvitedAt: new Date(),
        },
      });
      await this.audit.record(
        {
          actorId: user.id,
          actorRole: user.role,
          organizationId: updated.organizationId,
          action: 'ADMIN_INVITATION_RESENT',
          entityType: 'USER',
          entityId: updated.id,
          title: 'Invitație Admin retrimisă',
          description: `Invitația pentru ${updated.name || updated.email} a fost retrimisă.`,
          severity: 'INFO',
          metadata: { invitationId: updated.id, expiresAt: updated.expiresAt },
        },
        tx,
      );
      return updated;
    });

    return this.invitationResponse(invitation, { sent: false }, rawToken);
  }

  async cancelAdminInvitation(user: MvpUser, invitationId: string) {
    if (!this.isSuperadmin(user)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Nu ai acces la această zonă.',
      });
    }
    const invitation = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.invitation.findFirst({
        where: { id: invitationId, role: Role.ADMIN },
        include: { organization: { select: { id: true, name: true } } },
      });
      if (!existing) throw new NotFoundException('Invitația nu a fost găsită.');
      if (existing.status === InvitationStatus.ACCEPTED) {
        throw new ConflictException({
          code: 'INVITATION_ACCEPTED',
          message: 'Invitația a fost deja acceptată.',
        });
      }
      const updated = await tx.invitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.CANCELLED },
        include: { organization: { select: { id: true, name: true } }, apartment: true },
      });
      await this.audit.record(
        {
          actorId: user.id,
          actorRole: user.role,
          organizationId: updated.organizationId,
          action: 'ADMIN_INVITATION_CANCELLED',
          entityType: 'USER',
          entityId: updated.id,
          title: 'Invitație Admin anulată',
          description: `Invitația pentru ${updated.name || updated.email} a fost anulată.`,
          severity: 'WARNING',
          metadata: { invitationId: updated.id },
        },
        tx,
      );
      return updated;
    });
    return this.safeInvitation(invitation, false);
  }

  async getPublicAdminInvitation(token: string) {
    const invitation = await this.findInvitationByToken(token);
    if (invitation.role !== Role.ADMIN) {
      throw new BadRequestException({
        code: 'INVITATION_INVALID',
        message: 'Invitația nu este validă.',
      });
    }

    const now = Date.now();
    const expired = invitation.expiresAt.getTime() < now;
    if (expired && invitation.status === InvitationStatus.PENDING) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
    }

    return {
      id: invitation.id,
      status: expired ? InvitationStatus.EXPIRED : invitation.status,
      organization: invitation.organization
        ? { id: invitation.organization.id, name: invitation.organization.name }
        : null,
      adminName: invitation.name || invitation.email,
      emailMasked: this.maskEmail(invitation.email),
      phoneMasked: this.maskPhone(invitation.phone),
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      message:
        expired || invitation.status === InvitationStatus.EXPIRED
          ? 'Invitația a expirat.'
          : invitation.status === InvitationStatus.CANCELLED
            ? 'Invitația a fost anulată.'
            : invitation.status === InvitationStatus.ACCEPTED
              ? 'Invitația a fost deja acceptată.'
              : 'Invitația este validă.',
    };
  }

  acceptPublicAdminInvitation(token: string, body: unknown) {
    return this.acceptInvitation(token, body);
  }

  async getAdminFirstLogin(user: MvpUser) {
    const organizationId = this.assertAdminUser(user);
    return this.buildAdminFirstLogin(organizationId, user.id);
  }

  async updateAdminFirstLogin(user: MvpUser, body: unknown) {
    const organizationId = this.assertAdminUser(user);
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const allowed = [
      'confirmOrganizationInfo',
      'confirmStructure',
      'confirmApartments',
      'confirmResidents',
      'reviewDataQuality',
      'createFirstMeterReadingPeriod',
      'createFirstBillingDraft',
      'confirmDocuments',
      'welcomeAnnouncementCreated',
    ];
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { adminFirstLoginChecklistJson: true, adminHandoverNote: true },
    });
    if (!organization) throw new NotFoundException('Organizația nu a fost găsită.');
    const current = this.checklistJson(organization.adminFirstLoginChecklistJson);
    const patch = allowed.reduce<Record<string, unknown>>((acc, key) => {
      if (key in payload) acc[key] = payload[key] === true;
      return acc;
    }, {});
    const note = this.string(payload.note);
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        adminFirstLoginChecklistJson: {
          ...current,
          ...patch,
          ...(note ? { note } : {}),
          updatedAt: new Date().toISOString(),
        } as Prisma.InputJsonObject,
        ...(note ? { adminHandoverNote: note } : {}),
      },
    });
    return this.buildAdminFirstLogin(organizationId, user.id);
  }

  async completeAdminFirstLogin(user: MvpUser) {
    const organizationId = this.assertAdminUser(user);
    const now = new Date();
    const before = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        name: true,
        adminHandoverStatus: true,
        adminFirstLoginAt: true,
      },
    });
    if (!before) throw new NotFoundException('Organizația nu a fost găsită.');
    const workspace = await this.buildAdminFirstLogin(organizationId, user.id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.organization.update({
        where: { id: organizationId },
        data: {
          adminFirstLoginAt: before.adminFirstLoginAt || now,
          adminHandoverStatus: AdminHandoverStatus.ACTIVE,
        },
        select: {
          id: true,
          name: true,
          adminHandoverStatus: true,
          adminFirstLoginAt: true,
        },
      });
      if (!before.adminFirstLoginAt) {
        await this.createSuperadminNotification(tx, {
          title: 'Admin first login finalizat',
          message: `${user.email || 'Adminul'} a finalizat verificarea inițială pentru ${before.name}.`,
          type: SuperadminNotificationType.ADMIN_FIRST_LOGIN_COMPLETED,
          severity: SuperadminNotificationSeverity.SUCCESS,
          organizationId,
          actionUrl: `/ro/superadmin/organizations/${organizationId}?tab=handover`,
          metadata: { adminUserId: user.id },
        });
        await this.audit.record(
          {
            actorId: user.id,
            actorRole: user.role,
            organizationId,
            action: 'ADMIN_FIRST_LOGIN_COMPLETED',
            entityType: 'ORGANIZATION',
            entityId: organizationId,
            title: 'First login Admin finalizat',
            description: 'Adminul a finalizat verificarea inițială.',
            severity: 'SUCCESS',
            metadata: { warnings: workspace.warnings },
          },
          tx,
        );
        await this.audit.record(
          {
            actorId: user.id,
            actorRole: user.role,
            organizationId,
            action: 'ADMIN_HANDOVER_STATUS_CHANGED',
            entityType: 'ORGANIZATION',
            entityId: organizationId,
            title: 'Predare Admin activă',
            description: 'Statusul predării către Admin a fost schimbat în ACTIVE.',
            severity: 'SUCCESS',
            before,
            after: result,
          },
          tx,
        );
      }
      return result;
    });
    return {
      success: true,
      organization: updated,
      warnings: workspace.warnings,
      nextRecommendedAction: workspace.warnings.length
        ? 'Continuă completarea punctelor rămase din checklist.'
        : 'Poți continua în dashboardul Admin.',
    };
  }

  private safeUserSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      fullName: true,
      phone: true,
      role: true,
      organizationId: true,
      organization: { select: { id: true, name: true } },
    };
  }

  private async linkResidentProfile(tx: any, invitation: any, userId: string) {
    const resident = await tx.residentProfile.findFirst({
      where: {
        organizationId: invitation.organizationId,
        OR: [
          { email: invitation.email },
          ...(invitation.phone ? [{ phone: invitation.phone }] : []),
          ...(invitation.apartmentId
            ? [
                {
                  apartmentResidents: {
                    some: { apartmentId: invitation.apartmentId },
                  },
                  accountStatus: ResidentAccountStatus.INVITED,
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        type: true,
        firstName: true,
        lastName: true,
      },
    });

    const residentProfile = resident
      ? await tx.residentProfile.update({
          where: { id: resident.id },
          data: {
            userId,
            email: invitation.email,
            phone: invitation.phone || undefined,
            accountStatus: ResidentAccountStatus.CREATED,
          },
          select: { id: true, type: true },
        })
      : await tx.residentProfile.create({
          data: {
            organizationId: invitation.organizationId,
            userId,
            email: invitation.email,
            phone: invitation.phone || null,
            accountStatus: ResidentAccountStatus.CREATED,
            type: invitation.residentType || ResidentType.OWNER,
          },
          select: { id: true, type: true },
        });

    if (resident?.firstName || resident?.lastName) {
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName: resident.firstName || undefined,
          lastName: resident.lastName || undefined,
          fullName: `${resident.firstName || ''} ${resident.lastName || ''}`.trim() || undefined,
        },
      });
    }

    if (invitation.apartmentId) {
      const role = this.apartmentResidentRole(residentProfile.type);
      await tx.apartmentResident.upsert({
        where: {
          apartmentId_residentId_role: {
            apartmentId: invitation.apartmentId,
            residentId: residentProfile.id,
            role,
          },
        },
        update: { isPrimary: true },
        create: {
          apartmentId: invitation.apartmentId,
          residentId: residentProfile.id,
          role,
          isPrimary: true,
        },
      });
    }
  }

  private async linkOrganizationAdmin(
    tx: Prisma.TransactionClient | PrismaService,
    organizationId: string,
    userId: string,
    invitationId?: string | null,
  ) {
    await tx.organizationMember.upsert({
      where: { userId },
      update: {
        organizationId,
        role: OrganizationMemberRole.ORG_ADMIN,
        status: OrganizationMemberStatus.ACTIVE,
        activatedAt: new Date(),
      },
      create: {
        organizationId,
        userId,
        role: OrganizationMemberRole.ORG_ADMIN,
        status: OrganizationMemberStatus.ACTIVE,
        invitedAt: new Date(),
        activatedAt: new Date(),
      },
    });
    await this.audit.record(
      {
        actorId: userId,
        actorRole: Role.ADMIN,
        organizationId,
        targetUserId: userId,
        action: 'USER_INVITED',
        entityType: 'USER',
        entityId: userId,
        title: 'Admin legat de organizație',
        description: 'Adminul invitat a fost legat de organizație.',
        severity: 'SUCCESS',
        metadata: { invitationId },
      },
      tx,
    );
  }

  private assertAdminUser(user: MvpUser) {
    if (String(user.role).toUpperCase() !== Role.ADMIN || !user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Nu ai acces la această zonă.',
      });
    }
    return user.organizationId;
  }

  private checklistJson(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
  }

  private checklistStatus(complete: boolean, warning: boolean) {
    if (complete) return 'complete';
    return warning ? 'warning' : 'missing';
  }

  private async buildAdminFirstLogin(organizationId: string, userId: string) {
    const [
      organization,
      adminUser,
      buildingsCount,
      staircasesCount,
      apartmentsCount,
      residentsCount,
      documentsCount,
      announcementsCount,
      dataQualityRun,
      dataQualityCriticalCount,
      dataQualityWarningCount,
      meterReadingPeriodsCount,
      billingPeriodsCount,
    ] =
      await Promise.all([
        this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: {
            id: true,
            name: true,
            legalName: true,
            fiscalCode: true,
            city: true,
            address: true,
            phone: true,
            email: true,
            adminHandoverStatus: true,
            adminInvitedAt: true,
            adminAcceptedAt: true,
            adminFirstLoginAt: true,
            adminHandoverNote: true,
            adminFirstLoginChecklistJson: true,
          },
        }),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, firstName: true, lastName: true, fullName: true, email: true, phone: true, role: true },
        }),
        this.prisma.building.count({ where: { organizationId } }),
        this.prisma.staircase.count({ where: { organizationId } }),
        this.prisma.apartment.count({ where: { organizationId } }),
        this.prisma.residentProfile.count({ where: { organizationId } }),
        this.prisma.document.count({ where: { organizationId } }),
        this.prisma.announcement.count({ where: { organizationId, archivedAt: null } }).catch(() => 0),
        this.prisma.dataQualityRun.findFirst({ where: { associationId: organizationId }, orderBy: { createdAt: 'desc' }, select: { id: true, completedAt: true } }).catch(() => null),
        this.prisma.dataQualityIssue.count({ where: { associationId: organizationId, status: 'OPEN', severity: 'CRITICAL' } }).catch(() => 0),
        this.prisma.dataQualityIssue.count({ where: { associationId: organizationId, status: 'OPEN', severity: 'WARNING' } }).catch(() => 0),
        this.prisma.meterReadingPeriod.count({ where: { organizationId } }).catch(() => 0),
        this.prisma.billingPeriod.count({ where: { organizationId } }).catch(() => 0),
      ]);
    if (!organization) throw new NotFoundException('Organizația nu a fost găsită.');

    const saved = this.checklistJson(organization.adminFirstLoginChecklistJson);
    const hasBasicInfo = Boolean(organization.name && organization.city && organization.address);
    const hasStructure = buildingsCount > 0 && staircasesCount > 0;
    const hasApartments = apartmentsCount > 0;
    const hasResidents = residentsCount > 0;
    const hasDocuments = documentsCount > 0;
    const hasWelcomeAnnouncement = announcementsCount > 0 || saved.welcomeAnnouncementCreated === true;
    const hasDataQualityReview = Boolean(dataQualityRun?.completedAt);

    const items = [
      {
        key: 'confirmOrganizationInfo',
        title: 'Date APC',
        description: 'Verifică denumirea, orașul, adresa și datele de contact.',
        confirmed: saved.confirmOrganizationInfo === true,
        status: this.checklistStatus(saved.confirmOrganizationInfo === true, !hasBasicInfo),
        actionLabel: 'Verifică date',
        actionUrl: '/ro/admin/settings/organization',
        missing: [
          ...(!organization.city ? ['Oraș lipsă'] : []),
          ...(!organization.address ? ['Adresă lipsă'] : []),
        ],
      },
      {
        key: 'confirmStructure',
        title: 'Blocuri/scări',
        description: 'Verifică structura blocurilor și scărilor.',
        confirmed: saved.confirmStructure === true,
        status: this.checklistStatus(saved.confirmStructure === true, !hasStructure),
        actionLabel: 'Adaugă blocuri',
        actionUrl: '/ro/admin/buildings',
        missing: [
          ...(buildingsCount === 0 ? ['Nu există blocuri'] : []),
          ...(staircasesCount === 0 ? ['Nu există scări'] : []),
        ],
      },
      {
        key: 'confirmApartments',
        title: 'Apartamente',
        description: 'Verifică lista apartamentelor înainte de lansare.',
        confirmed: saved.confirmApartments === true,
        status: this.checklistStatus(saved.confirmApartments === true, !hasApartments),
        actionLabel: 'Adaugă apartamente',
        actionUrl: '/ro/admin/apartments',
        missing: apartmentsCount === 0 ? ['Nu există apartamente'] : [],
      },
      {
        key: 'confirmResidents',
        title: 'Locatari',
        description: 'Verifică locatarii sau proprietarii asociați apartamentelor.',
        confirmed: saved.confirmResidents === true,
        status: this.checklistStatus(saved.confirmResidents === true, !hasResidents),
        actionLabel: 'Importă locatari',
        actionUrl: '/ro/admin/residents',
        missing: residentsCount === 0 ? ['Nu există locatari importați'] : [],
      },
      {
        key: 'reviewDataQuality',
        title: 'Verifică calitatea datelor',
        description: 'Verifică duplicatele, contactele și datele lipsă după import.',
        confirmed: saved.reviewDataQuality === true,
        status: this.checklistStatus(saved.reviewDataQuality === true, !hasDataQualityReview || dataQualityCriticalCount > 0 || dataQualityWarningCount > 0),
        actionLabel: 'Verifică datele',
        actionUrl: '/ro/admin/data-quality',
        missing: [
          ...(!hasDataQualityReview ? ['Nu există verificare Data Quality rulată'] : []),
          ...(dataQualityCriticalCount > 0 ? [`${dataQualityCriticalCount} probleme critice deschise`] : []),
          ...(dataQualityWarningCount > 0 ? [`${dataQualityWarningCount} avertizări deschise`] : []),
        ],
      },
      {
        key: 'createFirstMeterReadingPeriod',
        title: 'Citiri contoare',
        description: 'Creează prima perioadă de citiri când începi facturarea lunară.',
        confirmed: saved.createFirstMeterReadingPeriod === true,
        status: this.checklistStatus(saved.createFirstMeterReadingPeriod === true || meterReadingPeriodsCount > 0, meterReadingPeriodsCount === 0),
        actionLabel: 'Deschide citiri',
        actionUrl: '/ro/admin/meter-readings',
        missing: meterReadingPeriodsCount === 0 ? ['Nu există perioade de citiri încă'] : [],
      },
      {
        key: 'createFirstBillingDraft',
        title: 'Drafturi de facturare',
        description: 'După configurarea contoarelor și citirilor, vei putea genera drafturi de facturare.',
        confirmed: saved.createFirstBillingDraft === true,
        status: this.checklistStatus(saved.createFirstBillingDraft === true || billingPeriodsCount > 0, billingPeriodsCount === 0),
        actionLabel: 'Deschide drafturi',
        actionUrl: '/ro/admin/billing-drafts',
        missing: billingPeriodsCount === 0 ? ['Nu există perioade de facturare create încă'] : [],
      },
      {
        key: 'confirmDocuments',
        title: 'Documente',
        description: 'Verifică documentele de bază ale APC-ului.',
        confirmed: saved.confirmDocuments === true,
        status: this.checklistStatus(saved.confirmDocuments === true, !hasDocuments),
        actionLabel: 'Încarcă documente',
        actionUrl: '/ro/admin/documents',
        missing: documentsCount === 0 ? ['Nu există documente încărcate'] : [],
      },
      {
        key: 'welcomeAnnouncementCreated',
        title: 'Anunț de bun venit',
        description: 'Pregătește primul anunț pentru locatari.',
        confirmed: saved.welcomeAnnouncementCreated === true,
        status: this.checklistStatus(hasWelcomeAnnouncement, announcementsCount === 0),
        actionLabel: 'Creează anunț',
        actionUrl: '/ro/admin/announcements',
        missing: announcementsCount === 0 ? ['Nu există anunț de bun venit'] : [],
      },
    ];

    const warnings = items.flatMap((item) => item.missing.map((message) => ({ key: item.key, message })));
    return {
      organization,
      adminUser,
      stats: {
        buildingsCount,
        staircasesCount,
        apartmentsCount,
        residentsCount,
        documentsCount,
        announcementsCount,
        meterReadingPeriodsCount,
        billingPeriodsCount,
      },
      checklist: items,
      note: saved.note || organization.adminHandoverNote || null,
      warnings,
      canComplete: true,
      completedAt: organization.adminFirstLoginAt,
      nextRecommendedAction: warnings.length
        ? 'Poți continua, dar aceste puncte rămân de completat.'
        : 'Finalizează verificarea inițială și continuă în dashboard.',
    };
  }

  private apartmentResidentRole(type?: ResidentType | null) {
    if (type === ResidentType.TENANT) return ApartmentResidentRole.TENANT;
    if (type === ResidentType.OWNER) return ApartmentResidentRole.OWNER;
    return ApartmentResidentRole.RESIDENT;
  }

  private async createSuperadminNotification(
    db: Prisma.TransactionClient | PrismaService,
    data: {
      title: string;
      message?: string | null;
      type: SuperadminNotificationType;
      severity: SuperadminNotificationSeverity;
      organizationId?: string | null;
      actionUrl?: string | null;
      metadata?: unknown;
    },
    dedupe?: { type: SuperadminNotificationType; organizationId?: string | null; metadataId?: string | null },
  ) {
    if (dedupe) {
      const existing = await db.superadminNotification.findFirst({
        where: {
          type: dedupe.type,
          organizationId: dedupe.organizationId || null,
          status: { not: SuperadminNotificationStatus.ARCHIVED },
        },
        select: { id: true },
      });
      if (existing) return existing;
    }
    const created = await db.superadminNotification.create({
      data: {
        title: data.title,
        message: data.message || null,
        type: data.type,
        severity: data.severity,
        status: SuperadminNotificationStatus.UNREAD,
        organizationId: data.organizationId || null,
        actionUrl: data.actionUrl || null,
        metadataJson: (data.metadata || {}) as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await this.audit.record(
      {
        organizationId: data.organizationId || null,
        notificationId: created.id,
        action: 'NOTIFICATION_CREATED',
        entityType: 'NOTIFICATION',
        entityId: created.id,
        title: 'Notificare creată',
        description: data.title,
        severity: data.severity,
        metadata: { type: data.type, actionUrl: data.actionUrl },
      },
      db,
    );
    return created;
  }

  private async findInvitationByToken(token: string) {
    const cleanToken = this.string(token);
    const hashed = cleanToken ? this.tokenHash(cleanToken) : '';
    const invitation = await this.prisma.invitation.findFirst({
      where: {
        OR: [{ token: cleanToken }, { tokenHash: hashed }],
      },
      include: {
        organization: { select: { id: true, name: true } },
        apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } },
      },
    });
    if (!invitation) {
      throw new BadRequestException({
        code: 'INVITATION_INVALID',
        message: 'Invitația nu este validă.',
      });
    }
    return invitation;
  }

  private async findPendingInvitation(token: string) {
    const invitation = await this.findInvitationByToken(token);
    if (!invitation || invitation.status === InvitationStatus.CANCELLED) {
      throw new BadRequestException({
        code: 'INVITATION_INVALID',
        message: 'Invitația nu este validă.',
      });
    }
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException({
        code: 'INVITATION_ACCEPTED',
        message: 'Invitația a fost deja folosită.',
      });
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new GoneException({
        code: 'INVITATION_EXPIRED',
        message: 'Invitația a expirat.',
      });
    }
    return invitation;
  }

  private maskEmail(email?: string | null) {
    if (!email) return null;
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local.slice(0, 2)}***@${domain}`;
  }

  private maskPhone(phone?: string | null) {
    if (!phone) return null;
    const clean = phone.replace(/\s+/g, '');
    if (clean.length <= 4) return '***';
    return `${clean.slice(0, 3)}***${clean.slice(-2)}`;
  }

  private assertPassword(password: string) {
    if (password.length < 8) {
      throw new BadRequestException({
        code: 'PASSWORD_TOO_SHORT',
        message: 'Parola trebuie să aibă cel puțin 8 caractere.',
      });
    }
  }

  private redirectPath(role: Role, firstLogin = false) {
    if (role === Role.SUPERADMIN) return '/ro/superadmin';
    if (role === Role.RESIDENT) return '/ro/resident';
    if (role === Role.ADMIN && firstLogin) return '/ro/admin/first-login';
    return '/ro/admin';
  }
}
