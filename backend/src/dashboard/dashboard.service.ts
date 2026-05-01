import { Injectable } from '@nestjs/common';
import { ReservationStatus, Role } from '@prisma/client';
import { endOfMonth, startOfMonth } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';

type DashboardMetrics = {
  totalProperties: number;
  totalReservations: number;
  monthlyRevenue: number;
  occupancyRate: number;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(user: { id: string; role: Role; organizationId?: string | null }): Promise<DashboardMetrics> {
    const organizationId = user.organizationId ?? null;
    const propertyWhere: Record<string, unknown> = {
      deletedAt: null,
      ...(organizationId ? { organizationId } : {}),
    };

    if (user.role === Role.MANAGER) {
      propertyWhere.ownerId = user.id;
    }

    const [totalProperties, properties] = await Promise.all([
      this.prisma.property.count({ where: propertyWhere as any }),
      this.prisma.property.findMany({
        where: propertyWhere as any,
        select: { id: true },
      }),
    ]);

    const propertyIds = properties.map((property) => property.id);
    if (propertyIds.length === 0) {
      return {
        totalProperties: 0,
        totalReservations: 0,
        monthlyRevenue: 0,
        occupancyRate: 0,
      };
    }

    const reservationWhereBase: Record<string, unknown> = {
      deletedAt: null,
      propertyId: { in: propertyIds },
      ...(organizationId ? { organizationId } : {}),
    };

    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    const daysInMonth = monthEnd.getDate();

    const [totalReservations, monthlyRevenueAgg, occupancyReservations] = await Promise.all([
      this.prisma.reservation.count({
        where: reservationWhereBase as any,
      }),
      this.prisma.reservation.aggregate({
        where: {
          ...(reservationWhereBase as any),
          status: ReservationStatus.CONFIRMED,
          checkIn: { gte: monthStart, lte: monthEnd },
        },
        _sum: { totalPrice: true },
      }),
      this.prisma.reservation.findMany({
        where: {
          ...(reservationWhereBase as any),
          status: ReservationStatus.CONFIRMED,
          checkOut: { gt: monthStart },
          checkIn: { lt: monthEnd },
        },
        select: { checkIn: true, checkOut: true },
      }),
    ]);

    let occupiedNights = 0;
    for (const reservation of occupancyReservations) {
      const overlapStart = reservation.checkIn > monthStart ? reservation.checkIn : monthStart;
      const overlapEnd = reservation.checkOut < monthEnd ? reservation.checkOut : monthEnd;
      if (overlapStart < overlapEnd) {
        occupiedNights += Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / 86400000);
      }
    }

    const availableNights = totalProperties * daysInMonth;
    const occupancyRate =
      availableNights > 0
        ? Math.min(100, Math.round((occupiedNights / availableNights) * 10000) / 100)
        : 0;

    return {
      totalProperties,
      totalReservations,
      monthlyRevenue: Math.round((monthlyRevenueAgg._sum.totalPrice ?? 0) * 100) / 100,
      occupancyRate,
    };
  }
}
