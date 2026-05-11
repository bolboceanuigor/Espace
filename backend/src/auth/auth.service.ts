import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthProvider,
  AuthSecurityEventSeverity,
  AuthSecurityEventType,
  PasswordResetRequestStatus,
  PlanCode,
  PlatformRole,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { AuthSecurityService } from './auth-security.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { EmailService } from '../email/email.service';
import { EmailTemplateService } from '../email/email-template.service';

@Injectable()
export class AuthService {
  private readonly passwordSaltRounds = 12;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private emailTemplateService: EmailTemplateService,
    private authSecurity: AuthSecurityService,
  ) {}

  private requiresEmailVerification() {
    return (process.env.AUTH_REQUIRE_EMAIL_VERIFICATION ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')).toLowerCase() === 'true';
  }

  private requiresOrganizationApproval() {
    return (process.env.AUTH_REQUIRE_ORG_APPROVAL ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')).toLowerCase() === 'true';
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: registerDto.email, deletedAt: null },
      select: { id: true },
    });
    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    this.assertPasswordStrength(registerDto.password);
    const hashedPassword = await bcrypt.hash(registerDto.password, this.passwordSaltRounds);
    const requireEmailVerification = this.requiresEmailVerification();
    const requireOrgApproval = this.requiresOrganizationApproval();
    const verificationTokenRaw = requireEmailVerification ? this.generateToken() : null;
    const verificationTokenHash = verificationTokenRaw ? this.hashToken(verificationTokenRaw) : null;
    const verificationExpiry = requireEmailVerification ? this.futureDateMinutes(60) : null;
    const locale = this.normalizeLocale(registerDto.locale);

    const user = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: registerDto.orgName.trim(),
          isActive: !requireOrgApproval,
        },
        select: { id: true },
      });
      await tx.organizationSetting.create({
        data: {
          organizationId: organization.id,
          weekStart: 'MONDAY',
          defaultLocale: 'ro',
        },
      });
      const trialPlan = await tx.plan.upsert({
        where: { code: PlanCode.TRIAL },
        update: { name: 'Trial', priceMonthly: 0, currency: 'EUR' },
        create: { code: PlanCode.TRIAL, name: 'Trial', priceMonthly: 0, currency: 'EUR' },
        select: { id: true },
      });
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);
      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planId: trialPlan.id,
          plan: 'starter',
          status: 'TRIAL',
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndsAt,
          price: 0,
          apartmentLimit: 5,
          trialEndsAt,
          subscriptionEndsAt: null,
          isActive: true,
        },
      });

      return tx.user.create({
        data: {
          email: registerDto.email,
          passwordHash: hashedPassword,
          authProvider: AuthProvider.LOCAL,
          emailVerifiedAt: requireEmailVerification ? null : new Date(),
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          role: Role.ADMIN,
          platformRole: PlatformRole.ORGANIZATION_USER,
          preferredLanguage: locale === 'ru' ? 'RU' : locale === 'en' ? 'EN' : 'RO',
          organizationId: organization.id,
        },
        select: this.userSelect(),
      });
    });
    await this.prisma.organizationMember.upsert({
      where: { userId: user.id },
      update: { organizationId: user.organizationId, role: 'ORG_ADMIN', status: 'ACTIVE' },
      create: { organizationId: user.organizationId, userId: user.id, role: 'ORG_ADMIN', status: 'ACTIVE' },
    });

    if (requireEmailVerification && verificationTokenRaw && verificationTokenHash && verificationExpiry) {
      await this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: verificationTokenHash,
          expiresAt: verificationExpiry,
        },
      });

      await this.emailService.sendVerificationEmail({
        email: user.email,
        locale,
        token: verificationTokenRaw,
      });
      await this.emailTemplateService.sendTemplateEmail({
        to: user.email,
        key: 'trial_started',
        targetRole: 'ADMIN',
        variables: {
          userName: user.firstName || user.email,
          organizationName: registerDto.orgName,
          trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          supportEmail: process.env.SUPPORT_EMAIL || 'support@espace.local',
        },
      });

      return { ok: true, message: 'VERIFY_EMAIL_SENT' as const };
    }

    return this.buildAuthResponse(user as any);
  }

  async login(
    loginDto: LoginDto,
    context?: { ip?: string; userAgent?: string | string[] | undefined },
  ) {
    const normalizedEmail = this.authSecurity.normalizeEmail(loginDto.email);
    const userByEmail = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
      select: { id: true, organizationId: true, isActive: true, passwordHash: true },
    });

    if (!userByEmail) {
      await this.authSecurity.recordEvent({
        email: normalizedEmail,
        eventType: AuthSecurityEventType.LOGIN_FAILED,
        severity: AuthSecurityEventSeverity.WARNING,
        ipAddress: context?.ip || null,
        userAgent: context?.userAgent || null,
        metadata: { reason: 'invalid_credentials' },
      });
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    if (!userByEmail.isActive || !userByEmail.passwordHash) {
      await this.authSecurity.recordEvent({
        userId: userByEmail.id,
        email: normalizedEmail,
        eventType: AuthSecurityEventType.LOGIN_FAILED,
        severity: AuthSecurityEventSeverity.WARNING,
        ipAddress: context?.ip || null,
        userAgent: context?.userAgent || null,
        metadata: { reason: userByEmail.isActive ? 'password_login_unavailable' : 'inactive_user' },
      });
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    let user: Awaited<ReturnType<AuthService['validateUser']>> = null;
    try {
      user = await this.validateUser(normalizedEmail, loginDto.password);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[auth:login] validateUser failed', {
          email: normalizedEmail,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await this.prisma.auditLog.create({
        data: {
          organizationId: userByEmail.organizationId,
          userId: userByEmail.id,
          action: 'LOGIN_FAILED',
          entityType: 'AUTH',
          entityId: userByEmail.id,
          description: 'User login failed',
          newValuesJson: {
            reason: 'wrong_password',
            ip: context?.ip || null,
          },
          ipAddress: context?.ip || null,
          userAgent: Array.isArray(context?.userAgent) ? context?.userAgent[0] : context?.userAgent || null,
        },
      });
      await this.authSecurity.recordEvent({
        userId: userByEmail.id,
        email: normalizedEmail,
        eventType: AuthSecurityEventType.LOGIN_FAILED,
        severity: AuthSecurityEventSeverity.WARNING,
        ipAddress: context?.ip || null,
        userAgent: context?.userAgent || null,
        metadata: { reason: 'invalid_credentials' },
      });
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    if (!user) {
      await this.prisma.auditLog.create({
        data: {
          organizationId: userByEmail.organizationId,
          userId: userByEmail.id,
          action: 'LOGIN_FAILED',
          entityType: 'AUTH',
          entityId: userByEmail.id,
          description: 'User login failed',
          newValuesJson: {
            reason: 'wrong_password',
            ip: context?.ip || null,
          },
          ipAddress: context?.ip || null,
          userAgent: Array.isArray(context?.userAgent) ? context?.userAgent[0] : context?.userAgent || null,
        },
      });
      await this.authSecurity.recordEvent({
        userId: userByEmail.id,
        email: normalizedEmail,
        eventType: AuthSecurityEventType.LOGIN_FAILED,
        severity: AuthSecurityEventSeverity.WARNING,
        ipAddress: context?.ip || null,
        userAgent: context?.userAgent || null,
        metadata: { reason: 'invalid_credentials' },
      });
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    if (this.requiresEmailVerification() && !user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email not verified. Please verify your email first.',
      });
    }
    await this.ensureOrganizationIsApproved(user.organizationId, user.role);

    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        entityType: 'AUTH',
        entityId: user.id,
        description: 'User login success',
        newValuesJson: {
          provider: 'LOCAL',
          ip: context?.ip || null,
          userAgent: Array.isArray(context?.userAgent)
            ? context?.userAgent[0]
            : context?.userAgent || null,
        },
        ipAddress: context?.ip || null,
        userAgent: Array.isArray(context?.userAgent) ? context?.userAgent[0] : context?.userAgent || null,
      },
    });

    const payload = await this.buildAuthResponse(user as any);
    await this.authSecurity.recordEvent({
      userId: user.id,
      email: user.email,
      eventType: AuthSecurityEventType.LOGIN_SUCCESS,
      severity: AuthSecurityEventSeverity.INFO,
      ipAddress: context?.ip || null,
      userAgent: context?.userAgent || null,
      metadata: {
        role: user.role,
        redirectTarget: payload.redirectTarget,
        residentPortalAccessStatus: payload.residentContext?.portalAccessStatus || null,
      },
    });
    if (user.role === Role.RESIDENT && !payload.residentContext?.accessReady) {
      await this.authSecurity.recordEvent({
        userId: user.id,
        email: user.email,
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
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (!user || !user.isActive || !user.passwordHash) {
      return null;
    }

    let passwordMatches = false;
    try {
      passwordMatches = await bcrypt.compare(password, user.passwordHash);
    } catch {
      return null;
    }
    if (!passwordMatches) {
      return null;
    }

    return user;
  }

  async verifyEmail(token: string) {
    const tokenHash = this.hashToken(token);
    const verification = await this.prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!verification) {
      throw new BadRequestException({
        code: 'INVALID_TOKEN',
        message: 'Invalid token',
      });
    }
    if (verification.expiresAt.getTime() < Date.now()) {
      throw new GoneException({
        code: 'TOKEN_EXPIRED',
        message: 'Token expired',
      });
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verification.userId },
        data: {
          emailVerifiedAt: new Date(),
        },
      }),
      this.prisma.emailVerificationToken.deleteMany({
        where: { userId: verification.userId },
      }),
    ]);

    await this.emailService.sendWelcomeEmail(verification.user.email);
    return { ok: true, message: 'EMAIL_VERIFIED' as const };
  }

  async resendVerification(email: string, locale?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      return { ok: true, message: 'VERIFY_EMAIL_SENT' as const };
    }
    if (user.emailVerifiedAt) {
      return { ok: true, message: 'VERIFY_EMAIL_SENT' as const };
    }

    const verificationTokenRaw = this.generateToken();
    const verificationTokenHash = this.hashToken(verificationTokenRaw);
    const verificationExpiry = this.futureDateMinutes(60);

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.deleteMany({
        where: { userId: user.id },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: verificationTokenHash,
          expiresAt: verificationExpiry,
        },
      }),
    ]);

    await this.emailService.sendVerificationEmail({
      email: user.email,
      locale: this.normalizeLocale(locale),
      token: verificationTokenRaw,
    });

    return { ok: true, message: 'VERIFY_EMAIL_SENT' as const };
  }

  async requestPasswordReset(
    email: string,
    locale?: string,
    context?: { ip?: string; userAgent?: string | string[] | undefined },
  ) {
    return this.authSecurity.createPasswordResetRequest({
      email: this.authSecurity.normalizeEmail(email),
      locale: this.normalizeLocale(locale),
      requestedIp: context?.ip || null,
      requestedUserAgent: context?.userAgent || null,
      expiresInMinutes: 60,
    });
  }

  async validatePasswordResetToken(token: string) {
    const resetRequest = await this.authSecurity.findPasswordResetRequest(token);
    const valid =
      !!resetRequest &&
      resetRequest.status === PasswordResetRequestStatus.PENDING &&
      !!resetRequest.user &&
      resetRequest.expiresAt.getTime() >= Date.now();
    return {
      valid,
      status: resetRequest?.status || 'INVALID',
      expiresAt: resetRequest?.expiresAt || null,
    };
  }

  async resetPassword(
    token: string,
    password: string,
    context?: { ip?: string; userAgent?: string | string[] | undefined },
  ) {
    this.assertPasswordStrength(password);
    const resetRequest = await this.authSecurity.findPasswordResetRequest(token);
    if (resetRequest) {
      if (
        resetRequest.status !== PasswordResetRequestStatus.PENDING ||
        !resetRequest.user ||
        resetRequest.user.deletedAt ||
        !resetRequest.user.isActive ||
        resetRequest.expiresAt.getTime() < Date.now()
      ) {
        await this.authSecurity.recordEvent({
          userId: resetRequest.userId,
          email: resetRequest.email,
          eventType: AuthSecurityEventType.PASSWORD_RESET_FAILED,
          severity: AuthSecurityEventSeverity.WARNING,
          ipAddress: context?.ip || null,
          userAgent: context?.userAgent || null,
          metadata: { reason: 'request_not_usable' },
        });
        throw new BadRequestException({
          code: 'INVALID_TOKEN',
          message: 'Invalid token',
        });
      }

      const hashedPassword = await bcrypt.hash(password, this.passwordSaltRounds);
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: resetRequest.userId! },
          data: {
            passwordHash: hashedPassword,
            authProvider: AuthProvider.LOCAL,
          },
        }),
        this.prisma.passwordResetRequest.update({
          where: { id: resetRequest.id },
          data: { status: PasswordResetRequestStatus.USED, usedAt: new Date() },
        }),
      ]);
      await this.authSecurity.recordEvent({
        userId: resetRequest.userId,
        email: resetRequest.email,
        eventType: AuthSecurityEventType.PASSWORD_RESET_USED,
        severity: AuthSecurityEventSeverity.INFO,
        ipAddress: context?.ip || null,
        userAgent: context?.userAgent || null,
      });
      return { ok: true, message: 'PASSWORD_UPDATED' as const };
    }

    const tokenHash = this.hashToken(token);
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
      },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!resetToken) {
      await this.authSecurity.recordEvent({
        eventType: AuthSecurityEventType.PASSWORD_RESET_FAILED,
        severity: AuthSecurityEventSeverity.WARNING,
        ipAddress: context?.ip || null,
        userAgent: context?.userAgent || null,
        metadata: { reason: 'request_not_found' },
      });
      throw new BadRequestException({
        code: 'INVALID_TOKEN',
        message: 'Invalid token',
      });
    }

    if (resetToken.expiresAt.getTime() < Date.now()) {
      throw new GoneException({
        code: 'TOKEN_EXPIRED',
        message: 'Token expired',
      });
    }

    const freshToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        id: resetToken.id,
        usedAt: null,
      },
      select: { id: true },
    });

    if (!freshToken) {
      throw new BadRequestException({
        code: 'INVALID_TOKEN',
        message: 'Invalid token',
      });
    }

    const hashedPassword = await bcrypt.hash(password, this.passwordSaltRounds);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash: hashedPassword,
          authProvider: AuthProvider.LOCAL,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true, message: 'PASSWORD_UPDATED' as const };
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    context?: { ip?: string; userAgent?: string | string[] | undefined },
  ) {
    this.assertPasswordStrength(newPassword);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, organizationId: true, passwordHash: true },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid account',
      });
    }
    const oldMatches = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!oldMatches) {
      throw new BadRequestException({
        code: 'INVALID_OLD_PASSWORD',
        message: 'Old password is incorrect',
      });
    }
    if (oldPassword === newPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_UNCHANGED',
        message: 'New password must be different from old password',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, this.passwordSaltRounds);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword, authProvider: AuthProvider.LOCAL },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'PASSWORD_CHANGED',
        entityType: 'AUTH',
        entityId: user.id,
        description: 'User changed password',
        ipAddress: context?.ip || null,
        userAgent: Array.isArray(context?.userAgent) ? context?.userAgent[0] : context?.userAgent || null,
      },
    });
    return { ok: true, message: 'PASSWORD_UPDATED' as const };
  }

  async loginWithGoogle(googleUser: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    googleSub: string;
  }) {
    if (!googleUser.email) {
      throw new BadRequestException('Google account email is required');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ googleSub: googleUser.googleSub }, { email: googleUser.email }],
      },
      select: this.userSelect(),
    });

    if (existing) {
      const nextProvider =
        existing.authProvider === AuthProvider.LOCAL
          ? AuthProvider.BOTH
          : existing.authProvider === AuthProvider.BOTH
            ? AuthProvider.BOTH
            : AuthProvider.GOOGLE;
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          googleSub: googleUser.googleSub,
          authProvider: nextProvider,
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          fullName: existing.fullName ?? ([googleUser.firstName, googleUser.lastName].filter(Boolean).join(' ').trim() || null),
          firstName: existing.firstName ?? googleUser.firstName ?? null,
          lastName: existing.lastName ?? googleUser.lastName ?? null,
        },
        select: this.userSelect(),
      });
      await this.ensureOrganizationIsApproved(updated.organizationId, updated.role);
      return this.buildAuthResponse(updated as any);
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: `${googleUser.firstName || 'My'} Organization`,
        },
        select: { id: true },
      });

      await tx.organizationSetting.create({
        data: {
          organizationId: organization.id,
          weekStart: 'MONDAY',
          defaultLocale: 'ro',
        },
      });

      const trialPlan = await tx.plan.upsert({
        where: { code: PlanCode.TRIAL },
        update: { name: 'Trial', priceMonthly: 0, currency: 'EUR' },
        create: { code: PlanCode.TRIAL, name: 'Trial', priceMonthly: 0, currency: 'EUR' },
        select: { id: true },
      });

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planId: trialPlan.id,
          plan: 'starter',
          status: 'TRIAL',
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndsAt,
          price: 0,
          apartmentLimit: 5,
          trialEndsAt,
          subscriptionEndsAt: null,
          isActive: true,
        },
      });

      return tx.user.create({
        data: {
          email: googleUser.email,
          passwordHash: null,
          authProvider: AuthProvider.GOOGLE,
          googleSub: googleUser.googleSub,
          emailVerifiedAt: new Date(),
          fullName: [googleUser.firstName, googleUser.lastName].filter(Boolean).join(' ').trim() || null,
          firstName: googleUser.firstName ?? null,
          lastName: googleUser.lastName ?? null,
          role: Role.ADMIN,
          platformRole: PlatformRole.ORGANIZATION_USER,
          preferredLanguage: 'RO',
          organizationId: organization.id,
        },
        select: this.userSelect(),
      });
    });
    await this.prisma.organizationMember.upsert({
      where: { userId: user.id },
      update: { organizationId: user.organizationId, role: 'ORG_ADMIN', status: 'ACTIVE' },
      create: { organizationId: user.organizationId, userId: user.id, role: 'ORG_ADMIN', status: 'ACTIVE' },
    });

    await this.ensureOrganizationIsApproved(user.organizationId, user.role);
    await this.emailTemplateService.sendTemplateEmail({
      to: user.email,
      key: 'trial_started',
      targetRole: 'ADMIN',
      variables: {
        userName: user.firstName || user.email,
        organizationName: `${googleUser.firstName || 'My'} Organization`,
        trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        supportEmail: process.env.SUPPORT_EMAIL || 'support@espace.local',
      },
    });
    return this.buildAuthResponse(user as any);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: this.userSelect(),
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }
    return user;
  }

  async getMePayload(userId: string) {
    const user = await this.getMe(userId);
    if (!user.organizationId) {
      throw new UnauthorizedException('Organization not found for user');
    }
    const [organization, settings, preference, limits, launchConfig] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { id: true, name: true, weekStart: true, defaultLocale: true, betaAccessEnabled: true, isDemo: true },
      }),
      this.prisma.organizationSetting.findUnique({
        where: { organizationId: user.organizationId },
        select: { weekStart: true, defaultLocale: true },
      }),
      this.prisma.userPreference.findUnique({
        where: { userId: user.id },
        select: {
          locale: true,
          sidebarLabels: true,
          dashboardDensity: true,
          dashboardStatusFilter: true,
          dashboardGroupId: true,
          welcomeDismissed: true,
        },
      }),
      this.prisma.organizationLimits.findUnique({
        where: { organizationId: user.organizationId },
        select: { modulesJson: true },
      }),
      (this.prisma as any).betaLaunchConfig
        ? (this.prisma as any).betaLaunchConfig.findUnique({
            where: { id: 'default' },
            select: { maintenanceMode: true },
          })
        : null,
    ]);

    if (!organization) {
      throw new UnauthorizedException('Organization not found');
    }
    const residentContext = await this.authSecurity.buildResidentContext(user as any);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        platformRole: user.platformRole,
        emailVerifiedAt: user.emailVerifiedAt,
        authProvider: user.authProvider,
        orgId: user.organizationId,
        organizationId: user.organizationId,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        isDemoUser: (user as any).isDemoUser ?? false,
        preferredLanguage: (user as any).preferredLanguage ?? 'RO',
      },
      id: user.id,
      email: user.email,
      role: user.role,
      platformRole: user.platformRole,
      organizationId: user.organizationId,
      org: {
        id: organization.id,
        name: organization.name,
        weekStart: settings?.weekStart ?? organization.weekStart ?? 'MONDAY',
        defaultLocale: settings?.defaultLocale ?? organization.defaultLocale ?? 'ro',
        betaAccessEnabled: organization.betaAccessEnabled,
        isDemo: organization.isDemo,
        modulesJson: (limits?.modulesJson as Record<string, boolean> | undefined) || undefined,
      },
      prefs: {
        locale: preference?.locale ?? settings?.defaultLocale ?? organization.defaultLocale ?? 'ro',
        sidebarLabels: preference?.sidebarLabels ?? false,
        dashboardDensity: preference?.dashboardDensity ?? 'md',
        dashboardStatusFilter: preference?.dashboardStatusFilter ?? 'all',
        dashboardGroupId: preference?.dashboardGroupId ?? null,
        welcomeDismissed: preference?.welcomeDismissed ?? false,
      },
      system: {
        maintenanceMode: !!launchConfig?.maintenanceMode,
      },
      residentContext,
      redirectTarget: this.authSecurity.redirectTarget(user.role, residentContext, 'ro'),
      warning: this.authSecurity.warningForResidentContext(residentContext),
    };
  }

  async updateMyPreferences(userId: string, dto: UpdatePreferencesDto) {
    if (dto.locale) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          preferredLanguage: dto.locale === 'ru' ? 'RU' : dto.locale === 'en' ? 'EN' : 'RO',
        },
      });
    }
    return this.prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        locale: dto.locale,
        sidebarLabels: dto.sidebarLabels ?? false,
        dashboardDensity: dto.dashboardDensity ?? 'md',
        dashboardStatusFilter: dto.dashboardStatusFilter ?? 'all',
        dashboardGroupId: dto.dashboardGroupId ?? null,
        welcomeDismissed: dto.welcomeDismissed ?? false,
      },
      update: {
        ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
        ...(dto.sidebarLabels !== undefined ? { sidebarLabels: dto.sidebarLabels } : {}),
        ...(dto.dashboardDensity !== undefined ? { dashboardDensity: dto.dashboardDensity } : {}),
        ...(dto.dashboardStatusFilter !== undefined
          ? { dashboardStatusFilter: dto.dashboardStatusFilter }
          : {}),
        ...(dto.dashboardGroupId !== undefined ? { dashboardGroupId: dto.dashboardGroupId || null } : {}),
        ...(dto.welcomeDismissed !== undefined ? { welcomeDismissed: dto.welcomeDismissed } : {}),
      },
      select: {
        locale: true,
        sidebarLabels: true,
        dashboardDensity: true,
        dashboardStatusFilter: true,
        dashboardGroupId: true,
        welcomeDismissed: true,
      },
    });
  }

  private userSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      platformRole: true,
      authProvider: true,
      googleSub: true,
      avatarUrl: true,
      fullName: true,
      emailVerifiedAt: true,
      organizationId: true,
      isActive: true,
      isDemoUser: true,
      preferredLanguage: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  private userResponse(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: Role;
    platformRole?: PlatformRole;
    organizationId: string;
    emailVerifiedAt?: Date | null;
    authProvider?: AuthProvider;
    isDemoUser?: boolean;
    preferredLanguage?: 'RO' | 'RU' | 'EN';
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      platformRole: user.platformRole ?? PlatformRole.ORGANIZATION_USER,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
      authProvider: user.authProvider ?? AuthProvider.LOCAL,
      organizationId: user.organizationId,
      isDemoUser: user.isDemoUser ?? false,
      preferredLanguage: user.preferredLanguage ?? 'RO',
    };
  }

  private async buildAuthResponse(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: Role;
    platformRole?: PlatformRole;
    organizationId: string;
    emailVerifiedAt?: Date | null;
    isDemoUser?: boolean;
    preferredLanguage?: 'RO' | 'RU' | 'EN';
  }) {
    const payload = {
      sub: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      platformRole: user.platformRole ?? PlatformRole.ORGANIZATION_USER,
      organizationId: user.organizationId,
    };
    const residentContext = await this.authSecurity.buildResidentContext(user as any);
    const warning = this.authSecurity.warningForResidentContext(residentContext);
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: this.userResponse(user),
      residentContext,
      redirectTarget: this.authSecurity.redirectTarget(user.role, residentContext, 'ro'),
      ...(warning ? { warning } : {}),
    };
  }

  async loginAsDemo() {
    const demoUser = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        isDemoUser: true,
        organization: { isDemo: true, isActive: true },
      },
      orderBy: { createdAt: 'asc' },
      select: this.userSelect(),
    });
    if (!demoUser) {
      throw new UnauthorizedException('Demo user is not configured');
    }
    return this.buildAuthResponse(demoUser as any);
  }

  private generateToken(length = 32) {
    return randomBytes(length).toString('hex');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private futureDateMinutes(minutes: number) {
    const date = new Date();
    date.setMinutes(date.getMinutes() + minutes);
    return date;
  }

  private normalizeLocale(locale?: string) {
    return ['ro', 'ru', 'en'].includes(locale || '') ? (locale as 'ro' | 'ru' | 'en') : 'ro';
  }

  private async ensureOrganizationIsApproved(organizationId: string, role: Role) {
    if (role === Role.SUPERADMIN) return;
    if (!this.requiresOrganizationApproval()) return;
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, isActive: true },
    });
    if (!organization || !organization.isActive) {
      throw new ForbiddenException({
        code: 'ORG_PENDING_APPROVAL',
        message: 'Organization is pending approval',
      });
    }
  }

  private assertPasswordStrength(password: string) {
    if (password.length < 8) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters',
      });
    }
  }
}
