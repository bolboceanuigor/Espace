import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

/** Thrown when overlap check fails inside createReservationInTransaction. Service maps to BadRequestException. */
export class ReservationOverlapError extends Error {
  constructor() {
    super('Reservation overlaps with an existing reservation for this property. Choose different dates.');
    this.name = 'ReservationOverlapError';
  }
}

/** Reservation with property included (same shape as service create/find/update). */
export type ReservationWithProperty = Prisma.ReservationGetPayload<{
  include: { property: true };
}>;

/** Property as returned by findFirst (no relations). */
export type PropertyBasic = Prisma.PropertyGetPayload<Record<string, never>> | null;

@Injectable()
export class ReservationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPropertyById(organizationId: string, propertyId: string): Promise<PropertyBasic> {
    return this.prisma.property.findFirst({
      where: { id: propertyId, organizationId, deletedAt: null } as any,
    });
  }

  async findPropertyIdsByAccess(organizationId: string, userId: string): Promise<string[]> {
    const accesses = await this.prisma.propertyAccess.findMany({
      where: {
        organizationId,
        userId,
        property: {
          deletedAt: null,
          isActive: true,
        },
      },
      select: { propertyId: true },
    });

    return accesses.map((access) => access.propertyId);
  }

  createReservation(
    organizationId: string,
    data: Prisma.ReservationUncheckedCreateInput,
    include: { property: true },
  ): Promise<ReservationWithProperty> {
    return this.prisma.reservation.create({
      data: { ...data, organizationId } as any,
      include,
    });
  }

  /**
   * Runs overlap check and create in a single transaction so parallel creates cannot bypass validation.
   * Uses the transaction client for both operations. Throws ReservationOverlapError if overlap found.
   */
  createReservationInTransaction(
    organizationId: string,
    overlapWhere: Prisma.ReservationWhereInput,
    createData: Prisma.ReservationUncheckedCreateInput,
  ): Promise<ReservationWithProperty> {
    return this.prisma.$transaction(async (tx) => {
      const where = { ...overlapWhere, organizationId } as any;
      const existing = await tx.reservation.findFirst({ where });
      if (existing) {
        throw new ReservationOverlapError();
      }
      return tx.reservation.create({
        data: { ...createData, organizationId } as any,
        include: { property: true },
      });
    });
  }

  findReservations(
    organizationId: string,
    where: Prisma.ReservationWhereInput,
    args: {
      include: { property: true };
      orderBy: Prisma.ReservationOrderByWithRelationInput;
      skip?: number;
      take?: number;
    },
  ): Promise<ReservationWithProperty[]> {
    return this.prisma.reservation.findMany({
      where: { ...where, organizationId } as any,
      include: args.include,
      orderBy: args.orderBy,
      skip: args.skip,
      take: args.take,
    });
  }

  countReservations(
    organizationId: string,
    where: Prisma.ReservationWhereInput,
  ): Promise<number> {
    return this.prisma.reservation.count({
      where: { ...where, organizationId } as any,
    });
  }

  findReservationsByWeek(
    organizationId: string,
    where: Prisma.ReservationWhereInput,
    args: { include: { property: true }; orderBy: Prisma.ReservationOrderByWithRelationInput },
  ): Promise<ReservationWithProperty[]> {
    return this.prisma.reservation.findMany({
      where: { ...where, organizationId } as any,
      include: args.include,
      orderBy: args.orderBy,
    });
  }

  findReservationById(
    organizationId: string,
    id: string,
    include: { property: true },
  ): Promise<ReservationWithProperty | null> {
    return this.prisma.reservation.findFirst({
      where: { id, organizationId, deletedAt: null } as any,
      include,
    }) as Promise<ReservationWithProperty | null>;
  }

  updateReservation(
    organizationId: string,
    id: string,
    data: Prisma.ReservationUpdateInput | Prisma.ReservationUncheckedUpdateInput | Record<string, unknown>,
    include: { property: true },
  ): Promise<ReservationWithProperty> {
    return this.prisma.reservation.update({
      where: { id, organizationId },
      data: data as any,
      include,
    });
  }

  findFirstOverlapping(
    organizationId: string,
    where: Prisma.ReservationWhereInput,
  ): Promise<Prisma.ReservationGetPayload<Record<string, never>> | null> {
    return this.prisma.reservation.findFirst({
      where: { ...where, organizationId } as any,
    });
  }
}
