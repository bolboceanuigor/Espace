import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CleaningStatus, ReservationStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseDateOnly, formatDateOnly } from '../common/date-only';
import { UpdateCleaningDto } from './dto/update-cleaning.dto';

type ReservationCleaningSyncInput = {
  reservationId: string;
  organizationId: string;
  propertyId: string;
  checkOut: Date;
  status: ReservationStatus;
  notes?: string | null;
};

@Injectable()
export class CleaningsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    organizationId: string;
    userId: string;
    role: Role;
    start?: string;
    end?: string;
    status?: string;
  }) {
    const scopedPropertyIds = await this.getScopedPropertyIds(
      params.organizationId,
      params.userId,
      params.role,
    );

    if (scopedPropertyIds.length === 0) {
      return [];
    }

    const rangeStart = params.start ? parseDateOnly(params.start) : undefined;
    const rangeEnd = params.end ? parseDateOnly(params.end) : undefined;
    const status =
      params.status && params.status !== 'all'
        ? (params.status.toUpperCase() as CleaningStatus)
        : undefined;

    const cleanings = await this.prisma.cleaning.findMany({
      where: {
        organizationId: params.organizationId,
        propertyId: { in: scopedPropertyIds },
        ...(rangeStart ? { date: { gte: rangeStart } } : {}),
        ...(rangeEnd ? { date: { lt: rangeEnd } } : {}),
        ...(status ? { status } : {}),
      },
      select: {
        id: true,
        propertyId: true,
        reservationId: true,
        date: true,
        status: true,
        assignedToId: true,
        notes: true,
        property: { select: { name: true } },
        reservation: { select: { guestName: true } },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    return cleanings.map((cleaning) => ({
      id: cleaning.id,
      propertyId: cleaning.propertyId,
      propertyName: cleaning.property.name,
      reservationId: cleaning.reservationId,
      guestName: cleaning.reservation?.guestName || '',
      date: formatDateOnly(cleaning.date),
      status: cleaning.status,
      assignedToId: cleaning.assignedToId,
      notes: cleaning.notes,
    }));
  }

  async update(
    id: string,
    params: {
      organizationId: string;
      userId: string;
      role: Role;
      payload: UpdateCleaningDto;
    },
  ) {
    const cleaning = await this.prisma.cleaning.findFirst({
      where: { id, organizationId: params.organizationId },
      select: { id: true, propertyId: true },
    });
    if (!cleaning) {
      throw new NotFoundException('Cleaning not found');
    }

    if (params.role === Role.MANAGER) {
      const allowed = await this.prisma.propertyAccess.findFirst({
        where: {
          organizationId: params.organizationId,
          userId: params.userId,
          propertyId: cleaning.propertyId,
        },
        select: { id: true },
      });
      if (!allowed) {
        throw new ForbiddenException('Access denied');
      }
    }

    return this.prisma.cleaning.update({
      where: { id: cleaning.id },
      data: {
        ...(params.payload.status ? { status: params.payload.status } : {}),
        ...(params.payload.assignedToId !== undefined
          ? { assignedToId: params.payload.assignedToId || null }
          : {}),
        ...(params.payload.notes !== undefined ? { notes: params.payload.notes || null } : {}),
      },
      select: {
        id: true,
        propertyId: true,
        reservationId: true,
        date: true,
        status: true,
        assignedToId: true,
        notes: true,
      },
    });
  }

  async syncFromReservation(input: ReservationCleaningSyncInput): Promise<void> {
    const nextStatus =
      input.status === ReservationStatus.CANCELLED ? CleaningStatus.CANCELLED : CleaningStatus.TODO;

    await this.prisma.cleaning.upsert({
      where: { reservationId: input.reservationId },
      create: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        reservationId: input.reservationId,
        date: input.checkOut,
        status: nextStatus,
        notes: input.notes || null,
      },
      update: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        date: input.checkOut,
        status: nextStatus,
        notes: input.notes || null,
      },
    });
  }

  private async getScopedPropertyIds(
    organizationId: string,
    userId: string,
    role: Role,
  ): Promise<string[]> {
    if (role === Role.ADMIN || role === Role.SUPERADMIN) {
      const properties = await this.prisma.property.findMany({
        where: { organizationId, deletedAt: null, isActive: true },
        select: { id: true },
      });
      return properties.map((property) => property.id);
    }

    const accesses = await this.prisma.propertyAccess.findMany({
      where: {
        organizationId,
        userId,
        property: { deletedAt: null, isActive: true },
      },
      select: { propertyId: true },
    });
    return accesses.map((access) => access.propertyId);
  }
}
