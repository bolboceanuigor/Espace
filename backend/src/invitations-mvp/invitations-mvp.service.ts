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
  AuthProvider,
  InvitationStatus,
  PlatformRole,
  ResidentAccountStatus,
  ResidentType,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

@Injectable()
export class InvitationsMvpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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

  private expiresAt() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return expiresAt;
  }

  private token() {
    return randomBytes(32).toString('hex');
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

  private safeInvitation(invitation: any, includeLink = true) {
    const link = includeLink ? this.activationLink(invitation.token) : undefined;
    return {
      id: invitation.id,
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
      createdAt: invitation.createdAt,
      activationLink: link,
      inviteLink: link,
      emailSending: 'MANUAL_LINK',
      emailSent: false,
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
    const firstName = this.string(payload.firstName);
    const lastName = this.string(payload.lastName);
    const phone = this.string(payload.phone) || null;
    if (!firstName || !lastName) {
      throw new BadRequestException({
        code: 'FIELDS_REQUIRED',
        message: 'Prenumele și numele sunt obligatorii.',
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true },
      });
      if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');

      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true, organizationId: true, isActive: true, passwordHash: true },
      });
      if (existingUser?.isActive && existingUser.passwordHash) {
        throw new ConflictException('Există deja un utilizator cu acest email.');
      }
      if (existingUser && existingUser.organizationId !== organizationId) {
        throw new ConflictException('Există deja un utilizator cu acest email.');
      }

      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`.trim(),
            phone,
            role: Role.ADMIN,
            platformRole: PlatformRole.ORGANIZATION_USER,
            organizationId,
            isActive: false,
          },
        });
      } else {
        await tx.user.create({
          data: {
            email,
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`.trim(),
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
          role: Role.ADMIN,
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
      return invitation;
    });

    return this.safeInvitation(result);
  }

  async createResidentInvitation(user: MvpUser, residentId: string, body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const email = this.email(payload.email);
    const requestedPhone = this.string(payload.phone);

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

    return this.safeInvitation(invitation);
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
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });

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
      redirectPath: this.redirectPath(user.role),
    };
  }

  private safeUserSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
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

  private apartmentResidentRole(type?: ResidentType | null) {
    if (type === ResidentType.TENANT) return ApartmentResidentRole.TENANT;
    if (type === ResidentType.OWNER) return ApartmentResidentRole.OWNER;
    return ApartmentResidentRole.RESIDENT;
  }

  private async findPendingInvitation(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: { select: { id: true, name: true } },
        apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } },
      },
    });
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

  private assertPassword(password: string) {
    if (password.length < 8) {
      throw new BadRequestException({
        code: 'PASSWORD_TOO_SHORT',
        message: 'Parola trebuie să aibă cel puțin 8 caractere.',
      });
    }
  }

  private redirectPath(role: Role) {
    if (role === Role.SUPERADMIN) return '/ro/superadmin';
    if (role === Role.RESIDENT) return '/ro/resident';
    return '/ro/admin';
  }
}
