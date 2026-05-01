import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { parseDateOnly, formatDateOnly } from '../common/date-only';
import { PrismaService } from '../prisma/prisma.service';

type OverviewParams = {
  organizationId: string;
  userId: string;
  role: Role;
  date: string;
  days: number;
};

@Injectable()
export class ManagerService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(params: OverviewParams) {
    if (params.role !== Role.MANAGER) {
      throw new ForbiddenException('Access denied');
    }

    const startDate = parseDateOnly(params.date);
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    const todayEnd = this.addDays(startDate, 1);
    const rangeEnd = this.addDays(startDate, params.days);

    const propertyIds = await this.getScopedPropertyIds(
      params.organizationId,
      params.userId,
    );

    if (propertyIds.length === 0) {
      return {
        date: params.date,
        range: {
          start: formatDateOnly(startDate),
          end: formatDateOnly(rangeEnd),
        },
        assignedPropertiesCount: 0,
        today: {
          checkIns: [],
          checkOuts: [],
          cleanings: [],
        },
        upcoming: {
          reservations: [],
        },
      };
    }

    const [checkInsToday, checkOutsToday, cleaningsToday, upcomingReservations] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          organizationId: params.organizationId,
          deletedAt: null,
          propertyId: { in: propertyIds },
          checkIn: { gte: startDate, lt: todayEnd },
        },
        select: {
          id: true,
          propertyId: true,
          guestName: true,
          phoneNumber: true,
          checkIn: true,
          checkOut: true,
          status: true,
          property: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ checkIn: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.reservation.findMany({
        where: {
          organizationId: params.organizationId,
          deletedAt: null,
          propertyId: { in: propertyIds },
          checkOut: { gte: startDate, lt: todayEnd },
        },
        select: {
          id: true,
          propertyId: true,
          guestName: true,
          phoneNumber: true,
          checkIn: true,
          checkOut: true,
          status: true,
          property: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ checkOut: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.cleaning.findMany({
        where: {
          organizationId: params.organizationId,
          propertyId: { in: propertyIds },
          date: { gte: startDate, lt: todayEnd },
        },
        select: {
          id: true,
          propertyId: true,
          date: true,
          status: true,
          notes: true,
          property: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.reservation.findMany({
        where: {
          organizationId: params.organizationId,
          deletedAt: null,
          propertyId: { in: propertyIds },
          checkIn: { lt: rangeEnd },
          checkOut: { gt: startDate },
        },
        select: {
          id: true,
          propertyId: true,
          guestName: true,
          checkIn: true,
          checkOut: true,
          status: true,
          property: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ checkIn: 'asc' }, { createdAt: 'asc' }],
        take: 20,
      }),
    ]);

    return {
      date: params.date,
      range: {
        start: formatDateOnly(startDate),
        end: formatDateOnly(rangeEnd),
      },
      assignedPropertiesCount: propertyIds.length,
      today: {
        checkIns: checkInsToday.map((item) => ({
          reservationId: item.id,
          propertyId: item.propertyId,
          propertyName: item.property.name,
          propertyCode: item.property.code ?? null,
          guestName: item.guestName,
          checkIn: formatDateOnly(item.checkIn),
          checkOut: formatDateOnly(item.checkOut),
          status: item.status,
          phone: item.phoneNumber ?? null,
        })),
        checkOuts: checkOutsToday.map((item) => ({
          reservationId: item.id,
          propertyId: item.propertyId,
          propertyName: item.property.name,
          propertyCode: item.property.code ?? null,
          guestName: item.guestName,
          checkIn: formatDateOnly(item.checkIn),
          checkOut: formatDateOnly(item.checkOut),
          status: item.status,
          phone: item.phoneNumber ?? null,
        })),
        cleanings: cleaningsToday.map((item) => ({
          cleaningId: item.id,
          propertyId: item.propertyId,
          propertyName: item.property.name,
          propertyCode: item.property.code ?? null,
          date: formatDateOnly(item.date),
          status: item.status,
          notes: item.notes ?? null,
        })),
      },
      upcoming: {
        reservations: upcomingReservations.map((item) => ({
          reservationId: item.id,
          propertyId: item.propertyId,
          propertyName: item.property.name,
          propertyCode: item.property.code ?? null,
          guestName: item.guestName,
          checkIn: formatDateOnly(item.checkIn),
          checkOut: formatDateOnly(item.checkOut),
          status: item.status,
        })),
      },
    };
  }

  private async getScopedPropertyIds(organizationId: string, userId: string) {
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

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }
}
