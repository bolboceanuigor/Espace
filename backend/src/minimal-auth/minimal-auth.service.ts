import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuthProvider,
  AuthSecurityEventSeverity,
  AuthSecurityEventType,
  PasswordResetRequestStatus,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthSecurityService } from '../auth/auth-security.service';
import { PrismaService } from '../prisma/prisma.service';

type LoginBody = {
  email?: string;
  password?: string;
};

type MinimalJwtPayload = {
  sub: string;
  email: string;
  role: string;
  organizationId: string;
};

@Injectable()
export class MinimalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authSecurity: AuthSecurityService,
  ) {}

  private userSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      fullName: true,
      role: true,
      platformRole: true,
      preferredLanguage: true,
      organizationId: true,
      passwordHash: true,
      isActive: true,
      deletedAt: true,
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    };
  }

  private safeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      role: user.role,
      roles: [user.role],
      platformRole: user.platformRole,
      organizationId: user.organizationId,
      preferredLanguage: user.preferredLanguage || 'RO',
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
          }
        : null,
    };
  }

  private async buildAuthResponse(user: any, locale = 'ro') {
    const residentContext = await this.authSecurity.buildResidentContext(user);
    const warning = this.authSecurity.warningForResidentContext(residentContext);
    const redirectTarget = this.authSecurity.redirectTarget(user.role, residentContext, locale);
    const payload: MinimalJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    return {
      accessToken,
      user: this.safeUser(user),
      residentContext,
      redirectTarget,
      ...(warning ? { warning } : {}),
    };
  }

  async login(
    body: LoginBody & { locale?: string },
    context?: { ip?: string; userAgent?: string | string[] | undefined },
  ) {
    const email = this.authSecurity.normalizeEmail(body.email);
    const password = body.password;

    if (!email || !password) {
      throw new BadRequestException({
        code: 'AUTH_FIELDS_REQUIRED',
        message: 'Emailul și parola sunt obligatorii.',
      });
    }

    try {
      const user = await this.prisma.user.findFirst({
        where: {
          email,
          deletedAt: null,
        },
        select: this.userSelect(),
      });

      if (!user) {
        await this.authSecurity.recordEvent({
          email,
          eventType: AuthSecurityEventType.LOGIN_FAILED,
          severity: AuthSecurityEventSeverity.WARNING,
          ipAddress: context?.ip || null,
          userAgent: context?.userAgent || null,
          metadata: { reason: 'invalid_credentials' },
        });
        throw new UnauthorizedException({
          code: 'INVALID_CREDENTIALS',
          message: 'Emailul sau parola nu sunt corecte.',
        });
      }

      if (!user.isActive || !user.passwordHash) {
        await this.authSecurity.recordEvent({
          userId: user.id,
          email,
          eventType: AuthSecurityEventType.LOGIN_FAILED,
          severity: AuthSecurityEventSeverity.WARNING,
          ipAddress: context?.ip || null,
          userAgent: context?.userAgent || null,
          metadata: { reason: user.isActive ? 'password_login_unavailable' : 'inactive_user' },
        });
        throw new UnauthorizedException({
          code: 'INVALID_CREDENTIALS',
          message: 'Emailul sau parola nu sunt corecte.',
        });
      }

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatches) {
        await this.authSecurity.recordEvent({
          userId: user.id,
          email,
          eventType: AuthSecurityEventType.LOGIN_FAILED,
          severity: AuthSecurityEventSeverity.WARNING,
          ipAddress: context?.ip || null,
          userAgent: context?.userAgent || null,
          metadata: { reason: 'invalid_credentials' },
        });
        throw new UnauthorizedException({
          code: 'INVALID_CREDENTIALS',
          message: 'Emailul sau parola nu sunt corecte.',
        });
      }

      const payload = await this.buildAuthResponse(user, body.locale || 'ro');
      await this.authSecurity.recordEvent({
        userId: user.id,
        email,
        eventType: AuthSecurityEventType.LOGIN_SUCCESS,
        severity: AuthSecurityEventSeverity.INFO,
        ipAddress: context?.ip || null,
        userAgent: context?.userAgent || null,
        metadata: {
          role: user.role,
          redirectTarget: payload.redirectTarget,
          residentPortalAccessStatus: payload.residentContext?.portalAccessStatus,
        },
      });
      if (String(user.role).toUpperCase() === Role.RESIDENT && !payload.residentContext?.accessReady) {
        await this.authSecurity.recordEvent({
          userId: user.id,
          email,
          eventType: this.authSecurity.blockedEventType(payload.residentContext),
          severity: AuthSecurityEventSeverity.WARNING,
          ipAddress: context?.ip || null,
          userAgent: context?.userAgent || null,
          metadata: {
            residentPortalAccessStatus: payload.residentContext?.portalAccessStatus || null,
            apartmentsCount: payload.residentContext?.apartmentsCount || 0,
            warningCode: payload.warning?.code || null,
          },
        });
      }
      return payload;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException({
        code: 'AUTH_LOGIN_FAILED',
        message: 'A apărut o eroare. Încearcă din nou.',
      });
    }
  }

  async me(authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
    if (!token) {
      throw new UnauthorizedException({
        code: 'TOKEN_REQUIRED',
        message: 'Sesiunea a expirat. Te rugăm să te autentifici din nou.',
      });
    }

    try {
      const payload = await this.jwtService.verifyAsync<MinimalJwtPayload>(token);
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          deletedAt: null,
          isActive: true,
        },
        select: this.userSelect(),
      });

      if (!user) {
        throw new UnauthorizedException({
          code: 'INVALID_TOKEN',
          message: 'Sesiunea a expirat. Te rugăm să te autentifici din nou.',
        });
      }

      const residentContext = await this.authSecurity.buildResidentContext(user);
      return {
        user: this.safeUser(user),
        residentContext,
        redirectTarget: this.authSecurity.redirectTarget(user.role, residentContext, 'ro'),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Sesiunea a expirat. Te rugăm să te autentifici din nou.',
      });
    }
  }

  async forgotPassword(
    body: { email?: string; locale?: string },
    context?: { ip?: string; userAgent?: string | string[] | undefined },
  ) {
    const email = this.authSecurity.normalizeEmail(body.email);
    if (!email) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Emailul este obligatoriu.',
      });
    }
    return this.authSecurity.createPasswordResetRequest({
      email,
      locale: body.locale || 'ro',
      requestedIp: context?.ip || null,
      requestedUserAgent: context?.userAgent || null,
      expiresInMinutes: 60,
    });
  }

  async validateResetToken(token: string) {
    const request = await this.authSecurity.findPasswordResetRequest(token);
    const valid =
      !!request &&
      request.status === PasswordResetRequestStatus.PENDING &&
      !!request.user &&
      request.expiresAt.getTime() >= Date.now();
    return {
      valid,
      status: request?.status || 'INVALID',
      expiresAt: request?.expiresAt || null,
    };
  }

  private assertResetPassword(password: string, confirmPassword?: string) {
    if (!password || password.length < 8) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: 'Parola trebuie să aibă cel puțin 8 caractere.',
      });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_MISMATCH',
        message: 'Parolele nu coincid.',
      });
    }
  }

  async resetPassword(
    token: string,
    body: { password?: string; newPassword?: string; confirmPassword?: string },
    context?: { ip?: string; userAgent?: string | string[] | undefined },
  ) {
    const password = body.newPassword || body.password || '';
    this.assertResetPassword(password, body.confirmPassword);
    const request = await this.authSecurity.findPasswordResetRequest(token);
    if (
      !request ||
      request.status !== PasswordResetRequestStatus.PENDING ||
      !request.user ||
      request.user.deletedAt ||
      !request.user.isActive
    ) {
      await this.authSecurity.recordEvent({
        eventType: AuthSecurityEventType.PASSWORD_RESET_FAILED,
        severity: AuthSecurityEventSeverity.WARNING,
        ipAddress: context?.ip || null,
        userAgent: context?.userAgent || null,
        metadata: { reason: request ? 'request_not_usable' : 'request_not_found' },
      });
      throw new BadRequestException({
        code: 'INVALID_TOKEN',
        message: 'Linkul de resetare nu este valid sau a expirat.',
      });
    }
    if (request.expiresAt.getTime() < Date.now()) {
      await this.prisma.passwordResetRequest.update({
        where: { id: request.id },
        data: { status: PasswordResetRequestStatus.EXPIRED },
      });
      await this.authSecurity.recordEvent({
        userId: request.userId,
        email: request.email,
        eventType: AuthSecurityEventType.PASSWORD_RESET_FAILED,
        severity: AuthSecurityEventSeverity.WARNING,
        ipAddress: context?.ip || null,
        userAgent: context?.userAgent || null,
        metadata: { reason: 'expired' },
      });
      throw new BadRequestException({
        code: 'INVALID_TOKEN',
        message: 'Linkul de resetare nu este valid sau a expirat.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: request.userId! },
        data: { passwordHash: hashedPassword, authProvider: AuthProvider.LOCAL },
      });
      await tx.passwordResetRequest.update({
        where: { id: request.id },
        data: { status: PasswordResetRequestStatus.USED, usedAt: new Date() },
      });
    });
    await this.authSecurity.recordEvent({
      userId: request.userId,
      email: request.email,
      eventType: AuthSecurityEventType.PASSWORD_RESET_USED,
      severity: AuthSecurityEventSeverity.INFO,
      ipAddress: context?.ip || null,
      userAgent: context?.userAgent || null,
    });
    return { success: true, message: 'Parola a fost schimbată. Te poți autentifica.' };
  }

  async accountStatus(authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
    if (!token) {
      throw new UnauthorizedException({
        code: 'TOKEN_REQUIRED',
        message: 'Trebuie să te autentifici.',
      });
    }
    const payload = await this.me(authorization);
    const residentContext = payload.residentContext || null;
    return {
      user: payload.user,
      residentContext,
      redirectTarget: payload.redirectTarget,
      warning: this.authSecurity.warningForResidentContext(residentContext),
    };
  }

  async logout(authorization?: string, context?: { ip?: string; userAgent?: string | string[] | undefined }) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
    if (!token) return { success: true };
    try {
      const payload = await this.jwtService.verifyAsync<MinimalJwtPayload>(token);
      await this.authSecurity.recordEvent({
        userId: payload.sub,
        email: payload.email,
        eventType: AuthSecurityEventType.LOGOUT,
        severity: AuthSecurityEventSeverity.INFO,
        ipAddress: context?.ip || null,
        userAgent: context?.userAgent || null,
      });
    } catch {
      // Stateless JWT logout is best-effort; the frontend clears local auth state.
    }
    return { success: true };
  }
}
