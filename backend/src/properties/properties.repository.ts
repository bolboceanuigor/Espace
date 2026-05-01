import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus, type Prisma } from '@prisma/client';

/** Property with reservations included (findAll, findOne, create, update). */
export type PropertyWithReservations = Prisma.PropertyGetPayload<{
  include: { reservations: true };
}>;

/** Property without relations (e.g. soft delete return). */
export type PropertyBasic = Prisma.PropertyGetPayload<Record<string, never>>;

/** Property as returned by findFirst (with optional include). */
export type PropertyWithReservationsOrNull = PropertyWithReservations | null;

@Injectable()
export class PropertiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  createProperty(
    organizationId: string,
    data: Prisma.PropertyUncheckedCreateInput,
    include: { reservations: true },
  ): Promise<PropertyWithReservations> {
    return this.prisma.property.create({
      data: { ...data, organizationId } as any,
      include,
    });
  }

  findManyProperties(
    organizationId: string,
    where: Prisma.PropertyWhereInput,
    include: { reservations: Prisma.ReservationFindManyArgs },
  ): Promise<PropertyWithReservations[]> {
    return this.prisma.property.findMany({
      where: { ...where, organizationId } as any,
      include,
    });
  }

  findPropertyById(
    organizationId: string,
    id: string,
    include: { reservations: Prisma.ReservationFindManyArgs },
  ): Promise<PropertyWithReservationsOrNull> {
    return this.prisma.property.findFirst({
      where: { id, organizationId, deletedAt: null } as any,
      include,
    });
  }

  updateProperty(
    organizationId: string,
    id: string,
    data: Prisma.PropertyUpdateInput | Prisma.PropertyUncheckedUpdateInput | Record<string, unknown>,
    include: { reservations: true },
  ): Promise<PropertyWithReservations> {
    return this.prisma.property.update({
      where: { id, organizationId },
      data: data as any,
      include,
    });
  }

  softDeleteProperty(organizationId: string, id: string): Promise<PropertyBasic> {
    return this.prisma.property.update({
      where: { id, organizationId },
      data: { isActive: false, status: 'inactive' } as any,
    });
  }

  findReservationsForActiveCheck(
    organizationId: string,
    propertyId: string,
  ): Promise<{ status: string; checkOut: Date }[]> {
    return this.prisma.reservation.findMany({
      where: { propertyId, organizationId, deletedAt: null } as any,
      select: { status: true, checkOut: true },
    });
  }

  findConfirmedReservationsForStats(
    organizationId: string,
    propertyId: string,
  ): Promise<{ totalPrice: number; checkIn: Date; checkOut: Date }[]> {
    return this.prisma.reservation.findMany({
      where: {
        propertyId,
        organizationId,
        deletedAt: null,
        status: ReservationStatus.CONFIRMED,
      } as any,
      select: { totalPrice: true, checkIn: true, checkOut: true },
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
}
