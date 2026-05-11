import { Injectable } from '@nestjs/common';
import {
  AuthSecurityEventSeverity,
  AuthSecurityEventType,
  PasswordResetRequestStatus,
  Prisma,
  ResidentAccountStatus,
  ResidentPortalAccessStatus,
  Role,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

type SecurityEventInput = {
  userId?: string | null;
  email?: string | null;
  eventType: AuthSecurityEventType;
  severity?: AuthSecurityEventSeverity;
  ipAddress?: string | null;
  userAgent?: string | string[] | null;
  metadata?: Record<string, unknown> | null;
};

type UserLike = {
  id: string;
  email: string;
  role: Role | string;
  organizationId: string;
};

const GENERIC_RESET_MESSAGE =
  'Dacă există un cont cu acest email, instrucțiunile de resetare vor fi pregătite.';

@Injectable()
export class AuthSecurityService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeEmail(value: unknown) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  generateToken(bytes = 32) {
    return randomBytes(bytes).toString('hex');
  }

  hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  tokenPreview(token: string) {
    return token.slice(-6);
  }

  isDevelopment() {
    return process.env.NODE_ENV !== 'production';
  }

  appUrl() {
    return (
      process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');
  }

  resetLink(token: string, locale = 'ro') {
    const safeLocale = ['ro', 'ru', 'en'].includes(locale) ? locale : 'ro';
    return `${this.appUrl()}/${safeLocale}/reset-password/${encodeURIComponent(token)}`;
  }

  futureDateMinutes(minutes: number) {
    const date = new Date();
    date.setMinutes(date.getMinutes() + minutes);
    return date;
  }

  private firstUserAgent(value?: string | string[] | null) {
    return Array.isArray(value) ? value[0] || null : value || null;
  }

  async recordEvent(input: SecurityEventInput) {
    try {
      return await this.prisma.authSecurityEvent.create({
        data: {
          userId: input.userId || null,
          email: input.email ? this.normalizeEmail(input.email) : null,
          eventType: input.eventType,
          severity: input.severity || AuthSecurityEventSeverity.INFO,
          ipAddress: input.ipAddress || null,
          userAgent: this.firstUserAgent(input.userAgent),
          metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
        },
      });
    } catch {
      return null;
    }
  }

  async createPasswordResetRequest(input: {
    email: string;
    locale?: string;
    requestedIp?: string | null;
    requestedUserAgent?: string | string[] | null;
    expiresInMinutes?: number;
  }) {
    const email = this.normalizeEmail(input.email);
    const user = email
      ? await this.prisma.user.findFirst({
          where: { email, deletedAt: null },
          select: { id: true, email: true },
        })
      : null;

    await this.recordEvent({
      userId: user?.id || null,
      email,
      eventType: AuthSecurityEventType.PASSWORD_RESET_REQUESTED,
      severity: AuthSecurityEventSeverity.INFO,
      ipAddress: input.requestedIp || null,
      userAgent: input.requestedUserAgent || null,
      metadata: { hasMatchingUser: Boolean(user) },
    });

    if (!user) {
      return { success: true, message: GENERIC_RESET_MESSAGE };
    }

    const rawToken = this.generateToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = this.futureDateMinutes(input.expiresInMinutes || 60);

    const request = await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetRequest.updateMany({
        where: { userId: user.id, status: PasswordResetRequestStatus.PENDING },
        data: { status: PasswordResetRequestStatus.CANCELLED, cancelledAt: new Date() },
      });
      return tx.passwordResetRequest.create({
        data: {
          userId: user.id,
          email: user.email,
          tokenHash,
          tokenPreview: this.tokenPreview(rawToken),
          status: PasswordResetRequestStatus.PENDING,
          expiresAt,
          requestedIp: input.requestedIp || null,
          requestedUserAgent: this.firstUserAgent(input.requestedUserAgent),
        },
        select: { id: true, status: true, expiresAt: true, tokenPreview: true },
      });
    });

    return {
      success: true,
      message: GENERIC_RESET_MESSAGE,
      resetRequest: request,
      devResetLink: this.isDevelopment() ? this.resetLink(rawToken, input.locale || 'ro') : undefined,
    };
  }

  async findPasswordResetRequest(token: string) {
    const raw = typeof token === 'string' ? token.trim() : '';
    if (raw.length < 20) return null;
    const request = await this.prisma.passwordResetRequest.findUnique({
      where: { tokenHash: this.hashToken(raw) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            passwordHash: true,
            deletedAt: true,
            isActive: true,
          },
        },
      },
    });
    if (!request) return null;
    if (
      request.status === PasswordResetRequestStatus.PENDING &&
      request.expiresAt.getTime() < Date.now()
    ) {
      await this.prisma.passwordResetRequest
        .update({
          where: { id: request.id },
          data: { status: PasswordResetRequestStatus.EXPIRED },
        })
        .catch(() => null);
      return { ...request, status: PasswordResetRequestStatus.EXPIRED };
    }
    return request;
  }

  async buildResidentContext(user: UserLike) {
    if (String(user.role).toUpperCase() !== Role.RESIDENT) return null;
    const resident = await this.prisma.residentProfile.findFirst({
      where: { userId: user.id, organizationId: user.organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        apartmentId: true,
        accountStatus: true,
        portalAccessStatus: true,
        organization: {
          select: {
            id: true,
            name: true,
            fiscalCode: true,
          },
        },
        _count: { select: { apartmentResidents: true } },
      },
    });

    if (!resident) {
      return {
        residentId: null,
        portalAccessStatus: 'NO_RESIDENT_LINK',
        apartmentsCount: 0,
        association: null,
        accessReady: false,
      };
    }

    const explicit = resident.portalAccessStatus;
    const portalAccessStatus =
      explicit === ResidentPortalAccessStatus.SUSPENDED ||
      explicit === ResidentPortalAccessStatus.REVOKED ||
      explicit === ResidentPortalAccessStatus.NO_ACCESS ||
      explicit === ResidentPortalAccessStatus.INVITED ||
      explicit === ResidentPortalAccessStatus.ACTIVE
        ? explicit
        : resident.accountStatus === ResidentAccountStatus.CREATED
          ? ResidentPortalAccessStatus.ACTIVE
          : resident.accountStatus === ResidentAccountStatus.INVITED
            ? ResidentPortalAccessStatus.INVITED
            : ResidentPortalAccessStatus.NO_ACCESS;
    const relationCount = Number(resident._count?.apartmentResidents || 0);
    const apartmentsCount = relationCount || (resident.apartmentId ? 1 : 0);

    return {
      residentId: resident.id,
      portalAccessStatus,
      apartmentsCount,
      association: resident.organization
        ? {
            id: resident.organization.id,
            shortName: resident.organization.name,
            associationCode: resident.organization.fiscalCode || '',
          }
        : null,
      accessReady: portalAccessStatus === ResidentPortalAccessStatus.ACTIVE && apartmentsCount > 0,
    };
  }

  redirectTarget(role: string | null | undefined, residentContext: any, locale = 'ro') {
    const safeLocale = ['ro', 'ru', 'en'].includes(locale) ? locale : 'ro';
    const normalizedRole = String(role || '').toUpperCase();
    if (normalizedRole === 'SUPERADMIN' || normalizedRole === 'SUPER_ADMIN') return `/${safeLocale}/superadmin`;
    if (normalizedRole === 'ADMIN' || normalizedRole === 'MANAGER') return `/${safeLocale}/admin`;
    if (normalizedRole === 'RESIDENT') {
      return residentContext?.accessReady ? `/${safeLocale}/resident` : `/${safeLocale}/account-status`;
    }
    return `/${safeLocale}/account-status`;
  }

  warningForResidentContext(residentContext: any) {
    if (!residentContext || residentContext.accessReady) return null;
    const status = residentContext.portalAccessStatus;
    if (status === 'NO_RESIDENT_LINK') {
      return {
        code: 'NO_RESIDENT_LINK',
        message: 'Contul tău nu este încă legat de un locatar din asociație.',
      };
    }
    if (status === ResidentPortalAccessStatus.SUSPENDED) {
      return {
        code: 'PORTAL_ACCESS_SUSPENDED',
        message: 'Accesul la portal este suspendat.',
      };
    }
    if (status === ResidentPortalAccessStatus.REVOKED) {
      return {
        code: 'PORTAL_ACCESS_REVOKED',
        message: 'Accesul la portal a fost revocat.',
      };
    }
    if (status === ResidentPortalAccessStatus.ACTIVE && Number(residentContext.apartmentsCount || 0) < 1) {
      return {
        code: 'RESIDENT_APARTMENT_LINK_MISSING',
        message: 'Contul tău nu este legat de niciun apartament.',
      };
    }
    return {
      code: 'PORTAL_ACCESS_NOT_ACTIVE',
      message: 'Accesul la portal nu este activ.',
    };
  }

  blockedEventType(residentContext: any) {
    const status = residentContext?.portalAccessStatus;
    if (status === ResidentPortalAccessStatus.SUSPENDED) return AuthSecurityEventType.LOGIN_BLOCKED_SUSPENDED;
    if (status === ResidentPortalAccessStatus.REVOKED) return AuthSecurityEventType.LOGIN_BLOCKED_REVOKED;
    return AuthSecurityEventType.LOGIN_BLOCKED_NO_PORTAL_ACCESS;
  }
}
