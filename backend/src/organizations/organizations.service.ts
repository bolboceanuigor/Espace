import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ReservationStatus, Role } from '@prisma/client';
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
    const [propertiesCount, organization] = await Promise.all([
      this.prisma.property.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { onboardingCompleted: true, onboardingStatus: true },
      }),
    ]);

    return {
      showWizard:
        propertiesCount === 0 &&
        organization?.onboardingStatus !== 'COMPLETED' &&
        (userRole === Role.ADMIN || userRole === Role.SUPERADMIN),
      propertiesCount,
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

    const existing = await this.prisma.property.count({ where: { organizationId, deletedAt: null } });
    if (existing > 0) {
      return { created: false, reason: 'Properties already exist' };
    }

    const createdProperties = await this.prisma.$transaction(async (tx) => {
      const props = [];
      for (let i = 1; i <= 5; i += 1) {
        const property = await tx.property.create({
          data: {
            organizationId,
            ownerId: userId,
            createdById: userId,
            name: `Demo Property ${i}`,
            code: `D${i}`,
            address: `Demo address ${i}`,
            basePrice: 50 + i * 10,
            cleaningFee: 15,
            rooms: 1,
            numberOfRooms: 1,
            cleaningPrice: 15,
          },
          select: { id: true, name: true },
        });
        props.push(property);
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      for (let i = 0; i < 8; i += 1) {
        const start = new Date(today);
        start.setUTCDate(today.getUTCDate() + i * 3);
        const end = new Date(start);
        end.setUTCDate(start.getUTCDate() + 2);
        const property = props[i % props.length];
        await tx.reservation.create({
          data: {
            organizationId,
            propertyId: property.id,
            guestName: `Demo Guest ${i + 1}`,
            phoneNumber: `07000000${i}`,
            checkIn: start,
            checkOut: end,
            status: ReservationStatus.CONFIRMED,
            source: i % 2 === 0 ? 'DIRECT' : 'BOOKING',
            totalPrice: 100 + i * 20,
            cleaningStatus: i % 3 === 0 ? 'DONE' : 'TODO',
            createdById: userId,
          },
        });
      }

      await tx.organization.update({
        where: { id: organizationId },
        data: { onboardingCompleted: true, onboardingStatus: 'COMPLETED', onboardingCompletedAt: new Date() },
      });

      return props;
    });

    return {
      created: true,
      properties: createdProperties.length,
      reservations: 8,
      cleanings: 5,
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
