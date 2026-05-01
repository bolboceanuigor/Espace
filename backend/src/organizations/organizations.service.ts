import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findMyOrganization(organizationId: string) {
    const [org, settings] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
      }),
      this.prisma.organizationSetting.findUnique({
        where: { organizationId },
      }),
    ]);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return {
      ...org,
      weekStart: settings?.weekStart ?? org.weekStart ?? 'MONDAY',
      defaultLocale: settings?.defaultLocale ?? org.defaultLocale ?? 'ro',
    };
  }

  async getOnboardingState(organizationId: string, userId: string, userRole: Role) {
    const [apartmentsCount, organization] = await Promise.all([
      this.prisma.apartment.count({ where: { organizationId } }),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { onboardingCompleted: true, onboardingStatus: true },
      }),
    ]);

    return {
      showWizard:
        apartmentsCount === 0 &&
        organization?.onboardingStatus !== 'COMPLETED' &&
        (userRole === Role.ADMIN || userRole === Role.SUPERADMIN),
      propertiesCount: apartmentsCount,
      onboardingDone: organization?.onboardingStatus === 'COMPLETED',
      onboardingStatus: organization?.onboardingStatus || 'NOT_STARTED',
    };
  }

  async dismissOnboarding(organizationId: string, userId: string) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { onboardingCompleted: true, onboardingStatus: 'COMPLETED', onboardingCompletedAt: new Date() },
      select: { id: true, onboardingCompleted: true, onboardingStatus: true },
    });
  }

  async updateMyOrganization(
    organizationId: string,
    userRole: Role,
    updateOrganizationDto: UpdateOrganizationDto,
  ) {
    if (userRole !== Role.ADMIN && userRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only admins can update organization');
    }
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(updateOrganizationDto.name !== undefined ? { name: updateOrganizationDto.name } : {}),
        ...(updateOrganizationDto.onboardingCompleted !== undefined
          ? {
              onboardingCompleted: updateOrganizationDto.onboardingCompleted,
              onboardingStatus: updateOrganizationDto.onboardingCompleted ? 'COMPLETED' : 'IN_PROGRESS',
              onboardingCompletedAt: updateOrganizationDto.onboardingCompleted ? new Date() : null,
            }
          : {}),
        ...(updateOrganizationDto.weekStart !== undefined ? { weekStart: updateOrganizationDto.weekStart } : {}),
        ...(updateOrganizationDto.defaultLocale !== undefined
          ? { defaultLocale: updateOrganizationDto.defaultLocale }
          : {}),
      },
    });
    if (
      updateOrganizationDto.weekStart !== undefined ||
      updateOrganizationDto.defaultLocale !== undefined
    ) {
      await this.prisma.organizationSetting.upsert({
        where: { organizationId },
        create: {
          organizationId,
          weekStart: updateOrganizationDto.weekStart ?? updated.weekStart ?? 'MONDAY',
          defaultLocale: updateOrganizationDto.defaultLocale ?? updated.defaultLocale ?? 'ro',
        },
        update: {
          ...(updateOrganizationDto.weekStart !== undefined
            ? { weekStart: updateOrganizationDto.weekStart }
            : {}),
          ...(updateOrganizationDto.defaultLocale !== undefined
            ? { defaultLocale: updateOrganizationDto.defaultLocale }
            : {}),
        },
      });
    }
    return this.findMyOrganization(organizationId);
  }

  async inviteUser(organizationId: string, userRole: Role, inviteUserDto: InviteUserDto) {
    if (userRole !== Role.ADMIN && userRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only admins can invite users');
    }
    const existing = await this.prisma.user.findFirst({
      where: { email: inviteUserDto.email, deletedAt: null },
    });
    if (existing) {
      throw new ForbiddenException('A user with this email already exists');
    }
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const user = await this.prisma.user.create({
      data: {
        email: inviteUserDto.email,
        passwordHash: hashedPassword,
        firstName: inviteUserDto.firstName ?? '',
        lastName: inviteUserDto.lastName ?? '',
        role: inviteUserDto.role,
        authProvider: 'LOCAL',
        emailVerifiedAt: null,
        organization: { connect: { id: organizationId } },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
    return { user, temporaryPassword: tempPassword };
  }

  async loadDemoData(organizationId: string, userId: string, userRole: Role) {
    if (userRole !== Role.ADMIN && userRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only admins can load demo data');
    }

    const existing = await this.prisma.apartment.count({ where: { organizationId } });
    if (existing > 0) {
      return { created: false, reason: 'Apartments already exist' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { onboardingCompleted: true, onboardingStatus: 'COMPLETED', onboardingCompletedAt: new Date() },
      });
    });

    return {
      created: true,
      properties: 0,
      reservations: 0,
      cleanings: 0,
    };
  }

  async getActivity(
    organizationId: string,
    userRole: Role,
    options?: { limit?: number; entityType?: string; userId?: string },
  ) {
    if (userRole !== Role.ADMIN && userRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only admins can view activity');
    }
    return this.prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(options?.entityType ? { entityType: options.entityType } : {}),
        ...(options?.userId ? { userId: options.userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, Math.max(1, options?.limit ?? 200)),
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        oldValuesJson: true,
        newValuesJson: true,
        userId: true,
        createdAt: true,
      },
    });
  }
}
