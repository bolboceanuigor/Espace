import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { hasPermission, Permission } from '../auth/permissions';
import { PropertiesRepository } from './properties.repository';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';

/** Active = confirmed/pending and check-out is in the future. */
const isActiveReservation = (status: string, checkOut: Date) => {
  const s = (status || '').toLowerCase();
  if (s === 'cancelled') return false;
  return new Date(checkOut) >= new Date();
};

@Injectable()
export class PropertiesService {
  constructor(
    private readonly repository: PropertiesRepository,
    private readonly prisma: PrismaService,
    private subscriptionService: SubscriptionService,
    private readonly activityService: ActivityService,
  ) {}

  async create(userId: string, organizationId: string, role: Role, createPropertyDto: CreatePropertyDto) {
    if (!hasPermission(role, Permission.PROPERTY_CREATE)) {
      throw new ForbiddenException('You do not have permission to create properties');
    }
    await this.subscriptionService.assertCanCreateProperty(organizationId);
    if (createPropertyDto.groupId) {
      await this.assertGroupExists(organizationId, createPropertyDto.groupId);
    }
    const data: Record<string, unknown> = {
      name: createPropertyDto.name.trim(),
      address: createPropertyDto.address?.trim(),
      basePrice: Number(createPropertyDto.basePrice),
      cleaningFee: Number(createPropertyDto.cleaningFee),
      rooms: Number(createPropertyDto.rooms),
      status: createPropertyDto.status ?? 'active',
      color: createPropertyDto.color ?? 'gray',
      groupId: createPropertyDto.groupId ?? null,
      ownerId: userId,
      organizationId,
      createdById: userId,
    };
    (data as any).numberOfRooms =
      createPropertyDto.numberOfRooms != null
        ? Number(createPropertyDto.numberOfRooms)
        : Number(createPropertyDto.rooms);
    (data as any).cleaningPrice =
      createPropertyDto.cleaningPrice != null
        ? Number(createPropertyDto.cleaningPrice)
        : Number(createPropertyDto.cleaningFee);
    const created = await this.repository.createProperty(organizationId, data as any, { reservations: true });
    await this.activityService.log({
      organizationId,
      performedById: userId,
      performedByRole: role,
      action: 'property.create',
      entityType: 'property',
      entityId: created.id,
      payload: { name: created.name, code: created.code },
    });
    return created;
  }

  async findAll(organizationId: string, userId: string, role: Role, showArchived?: string) {
    const includeArchived = showArchived === 'true';
    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
      ...(includeArchived ? {} : { isActive: true }),
    };
    if (role === Role.MANAGER) {
      const scopedIds = await this.repository.findPropertyIdsByAccess(organizationId, userId);
      if (scopedIds.length === 0) return [];
      where.id = { in: scopedIds };
    }

    return this.repository.findManyProperties(
      organizationId,
      where as any,
      { reservations: { where: { deletedAt: null } as any } },
    );
  }

  async findOne(id: string, organizationId: string, userId: string, role: Role) {
    const property = await this.repository.findPropertyById(
      organizationId,
      id,
      { reservations: { where: { deletedAt: null } as any } },
    );
    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }
    await this.assertPropertyAccess(property.id, property.ownerId, organizationId, userId, role);

    return property;
  }

  async update(id: string, organizationId: string, userId: string, role: Role, updatePropertyDto: UpdatePropertyDto) {
    if (updatePropertyDto.groupId) {
      await this.assertGroupExists(organizationId, updatePropertyDto.groupId);
    }
    if (!hasPermission(role, Permission.PROPERTY_UPDATE)) {
      throw new ForbiddenException('You do not have permission to update properties');
    }
    await this.findOne(id, organizationId, userId, role);
    const data: Record<string, unknown> = { ...updatePropertyDto };
    if (data.rooms != null) (data as any).numberOfRooms = data.rooms;
    if (data.cleaningFee != null) (data as any).cleaningPrice = data.cleaningFee;
    if ((data as any).groupId === '') (data as any).groupId = null;
    (data as any).updatedById = userId;
    const updated = await this.repository.updateProperty(organizationId, id, data, { reservations: true });
    await this.activityService.log({
      organizationId,
      performedById: userId,
      performedByRole: role,
      action: 'property.update',
      entityType: 'property',
      entityId: updated.id,
      payload: { name: updated.name, code: updated.code },
    });
    return updated;
  }

  async remove(id: string, organizationId: string, userId: string, role: Role) {
    if (!hasPermission(role, Permission.PROPERTY_DELETE)) {
      throw new ForbiddenException('You do not have permission to delete properties');
    }
    await this.findOne(id, organizationId, userId, role);
    const reservations = await this.repository.findReservationsForActiveCheck(organizationId, id);
    const activeCount = reservations.filter((r) =>
      isActiveReservation(r.status, r.checkOut),
    ).length;
    if (activeCount > 0) {
      throw new ConflictException(
        'Cannot delete property with active reservations. Cancel or complete them first.',
      );
    }
    const deleted = await this.repository.softDeleteProperty(organizationId, id);
    await this.activityService.log({
      organizationId,
      performedById: userId,
      performedByRole: role,
      action: 'property.delete',
      entityType: 'property',
      entityId: id,
    });
    return deleted;
  }

  /**
   * Stats for a property: total revenue and bookings from confirmed reservations,
   * and occupancy rate over the last 365 days.
   */
  async getStats(id: string, organizationId: string, userId: string, role: Role) {
    await this.findOne(id, organizationId, userId, role);

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 365);
    periodStart.setHours(0, 0, 0, 0);

    const confirmed = await this.repository.findConfirmedReservationsForStats(organizationId, id);

    const totalRevenue = confirmed.reduce((sum, r) => sum + Number(r.totalPrice), 0);
    const totalBookings = confirmed.length;

    let occupiedNights = 0;
    for (const r of confirmed) {
      const checkIn = new Date(r.checkIn);
      const checkOut = new Date(r.checkOut);
      const start = checkIn < periodStart ? periodStart : checkIn;
      const end = checkOut > now ? now : checkOut;
      if (start < end) {
        occupiedNights += Math.ceil((end.getTime() - start.getTime()) / 86400000);
      }
    }
    const daysInPeriod = 365;
    const occupancyRate =
      daysInPeriod > 0
        ? Math.min(100, Math.round((occupiedNights / daysInPeriod) * 10000) / 100)
        : 0;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalBookings,
      occupancyRate,
    };
  }

  async listGroups(organizationId: string) {
    return this.prisma.propertyGroup.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async createGroup(organizationId: string, role: Role, name: string) {
    if (role !== Role.ADMIN && role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only admins can create groups');
    }
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Group name is required');
    }
    return this.prisma.propertyGroup.create({
      data: { organizationId, name: trimmed },
      select: { id: true, name: true },
    });
  }

  private async assertPropertyAccess(
    propertyId: string,
    ownerId: string,
    organizationId: string,
    userId: string,
    role: Role,
  ) {
    if (role === Role.ADMIN || role === Role.SUPERADMIN) {
      return;
    }
    const scopedIds = await this.repository.findPropertyIdsByAccess(organizationId, userId);
    if (!scopedIds.includes(propertyId)) {
      // Backward compatibility for older seeds where only owner relation exists.
      if (ownerId === userId) return;
      throw new ForbiddenException('You can only access assigned properties');
    }
  }

  private async assertGroupExists(organizationId: string, groupId: string) {
    const group = await this.prisma.propertyGroup.findFirst({
      where: { id: groupId, organizationId },
      select: { id: true },
    });
    if (!group) {
      throw new NotFoundException('Property group not found');
    }
  }
}
