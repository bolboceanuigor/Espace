import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { addDays } from 'date-fns';
import { formatDateOnly, parseDateOnly } from '../common/date-only';

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getCalendarRange(params: {
    organizationId?: string | null;
    userId: string;
    role: Role;
    start: string;
    end: string;
    status?: string;
    source?: string;
    propertyId?: string;
    groupId?: string;
  }) {
    const { organizationId, userId, role } = params;
    if (!organizationId) {
      throw new BadRequestException('Organization context missing');
    }

    const rangeStart = parseDateOnly(params.start);
    const rangeEnd = parseDateOnly(params.end);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      throw new BadRequestException('Invalid start or end date');
    }
    if (rangeEnd <= rangeStart) {
      throw new BadRequestException('end must be greater than start');
    }

    const scopedPropertyIds = await this.getScopedPropertyIds({ organizationId, userId, role });
    if (scopedPropertyIds.length === 0) {
      return {
        range: { start: formatDateOnly(rangeStart), end: formatDateOnly(rangeEnd) },
        properties: [],
        reservations: [],
      };
    }

    const properties = await this.prisma.property.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
        id: { in: scopedPropertyIds },
        ...(params.propertyId && params.propertyId !== 'all' ? { id: params.propertyId } : {}),
        ...(params.groupId && params.groupId !== 'all' ? { groupId: params.groupId } : {}),
      },
      select: { id: true, name: true, code: true, color: true, groupId: true },
      orderBy: { name: 'asc' },
    });

    const reservations = await this.prisma.reservation.findMany({
      where: {
        organizationId,
        deletedAt: null,
        propertyId: { in: scopedPropertyIds },
        checkIn: { lt: rangeEnd },
        checkOut: { gt: rangeStart },
        ...(params.status && params.status !== 'all' ? { status: params.status.toUpperCase() as any } : {}),
        ...(params.source && params.source !== 'all' ? { source: params.source.toUpperCase() } : {}),
        ...(params.propertyId && params.propertyId !== 'all' ? { propertyId: params.propertyId } : {}),
        ...(params.groupId && params.groupId !== 'all' ? { property: { groupId: params.groupId } } : {}),
      },
      select: {
        id: true,
        propertyId: true,
        guestName: true,
        checkIn: true,
        checkOut: true,
        status: true,
        channel: true,
        externalId: true,
        lastSyncAt: true,
        rawPayload: true,
        source: true,
        notes: true,
      },
      orderBy: { checkIn: 'asc' },
    });

    const conflictKeys = reservations
      .filter((reservation) => !!reservation.channel && !!reservation.externalId)
      .map((reservation) => ({
        propertyId: reservation.propertyId,
        channel: reservation.channel!,
        externalId: reservation.externalId!,
      }));

    const conflicts = conflictKeys.length
      ? await this.prisma.syncConflict.findMany({
          where: {
            organizationId,
            OR: conflictKeys.map((key) => ({
              propertyId: key.propertyId,
              channel: key.channel,
              externalId: key.externalId,
            })),
          },
          select: {
            propertyId: true,
            channel: true,
            externalId: true,
          },
        })
      : [];
    const conflictSet = new Set(
      conflicts.map((item) => `${item.propertyId}|${item.channel}|${item.externalId ?? ''}`),
    );

    return {
      range: {
        start: formatDateOnly(rangeStart),
        end: formatDateOnly(rangeEnd),
      },
      properties: properties.map((property) => ({
        id: property.id,
        name: property.name,
        code: property.code,
        color: property.color,
        groupId: property.groupId,
      })),
      reservations: reservations.map((reservation) => ({
        // iCal mapping contract (for later sync implementation):
        // UID -> externalId, DTSTART/DTEND -> start/end (exclusive), default status CONFIRMED.
        id: reservation.id,
        propertyId: reservation.propertyId,
        guestName: reservation.guestName,
        startDate: formatDateOnly(reservation.checkIn),
        endDate: formatDateOnly(reservation.checkOut),
        status: reservation.status,
        channel: reservation.channel,
        externalId: reservation.externalId,
        lastSyncAt: reservation.lastSyncAt ? reservation.lastSyncAt.toISOString() : null,
        syncConflict:
          !!reservation.channel &&
          !!reservation.externalId &&
          conflictSet.has(`${reservation.propertyId}|${reservation.channel}|${reservation.externalId}`),
        rawPayload: reservation.rawPayload,
        source: reservation.source,
        notes: reservation.notes,
      })),
    };
  }

  async getCalendarLegacy(params: {
    organizationId?: string | null;
    userId: string;
    role: Role;
    startDate?: string;
    days?: string;
  }) {
    const start = params.startDate ? new Date(`${params.startDate}T00:00:00.000Z`) : new Date();
    start.setUTCHours(0, 0, 0, 0);
    const daysNum = Math.min(365, Math.max(1, Number(params.days) || 30));
    const endExclusive = addDays(start, daysNum);
    return this.getCalendarRange({
      organizationId: params.organizationId,
      userId: params.userId,
      role: params.role,
      start: formatDateOnly(start),
      end: formatDateOnly(endExclusive),
    });
  }

  private async getScopedPropertyIds(params: { organizationId: string; userId: string; role: Role }) {
    if (params.role === Role.ADMIN || params.role === Role.SUPERADMIN) {
      const all = await this.prisma.property.findMany({
        where: {
          organizationId: params.organizationId,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      });
      return all.map((property) => property.id);
    }

    const accesses = await this.prisma.propertyAccess.findMany({
      where: { userId: params.userId, organizationId: params.organizationId },
      select: {
        propertyId: true,
        property: {
          select: {
            organizationId: true,
            deletedAt: true,
            isActive: true,
          },
        },
      },
    });

    return accesses
      .filter((access) => access.property.organizationId === params.organizationId)
      .filter((access) => access.property.deletedAt === null && access.property.isActive)
      .map((access) => access.propertyId);
  }
}
