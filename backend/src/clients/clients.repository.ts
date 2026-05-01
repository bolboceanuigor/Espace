import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

/** Client with _count and reservations including property (findOne). */
export type ClientWithCountAndReservations = Prisma.ClientGetPayload<{
  include: {
    _count: { select: { reservations: true } };
    reservations: { include: { property: true } };
  };
}>;

/** Client list item (findAll). */
export type ClientWithCount = Prisma.ClientGetPayload<{
  include: { _count: { select: { reservations: true } } };
}>;

/** Reservation with property (findReservationsByClientId). */
export type ReservationWithProperty = Prisma.ReservationGetPayload<{
  include: { property: true };
}>;

@Injectable()
export class ClientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createClient(organizationId: string, data: Prisma.ClientUncheckedCreateInput): Promise<Prisma.ClientGetPayload<Record<string, never>>> {
    return this.prisma.client.create({
      data: { ...data, organizationId } as any,
    });
  }

  /** findMany always excludes soft-deleted clients (deletedAt: null). */
  findManyClients(
    organizationId: string,
    where: Prisma.ClientWhereInput,
    args: {
      orderBy: Prisma.ClientOrderByWithRelationInput[];
      include: { _count: { select: { reservations: true } } };
      skip?: number;
      take?: number;
    },
  ): Promise<ClientWithCount[]> {
    const hasArchivedFilter = Object.prototype.hasOwnProperty.call(where ?? {}, 'isArchived');
    return this.prisma.client.findMany({
      where: {
        ...where,
        organizationId,
        deletedAt: null,
        ...(hasArchivedFilter ? {} : { isArchived: false }),
      } as any,
      orderBy: args.orderBy,
      include: args.include,
      skip: args.skip,
      take: args.take,
    });
  }

  countClients(
    organizationId: string,
    where: Prisma.ClientWhereInput,
  ): Promise<number> {
    return this.prisma.client.count({
      where: { ...where, organizationId, deletedAt: null } as any,
    });
  }

  /** findUnique-style lookup: only returns client if not soft-deleted (deletedAt: null). */
  findClientById(
    organizationId: string,
    id: string,
    include: {
      _count: { select: { reservations: true } };
      reservations: { where: Prisma.ReservationWhereInput; include: { property: true }; orderBy: Prisma.ReservationOrderByWithRelationInput };
    },
  ): Promise<ClientWithCountAndReservations | null> {
    return this.prisma.client.findFirst({
      where: { id, organizationId, deletedAt: null, isArchived: false } as any,
      include,
    }) as Promise<ClientWithCountAndReservations | null>;
  }

  /** Minimal lookup for existence check; ignores soft-deleted clients. */
  findClientByIdMinimal(
    organizationId: string,
    id: string,
  ): Promise<{ id: string; organizationId: string } | null> {
    return this.prisma.client.findFirst({
      where: { id, organizationId, deletedAt: null, isArchived: false } as any,
      select: { id: true, organizationId: true },
    });
  }

  /** Reservations for a client (only non-deleted reservations). Call only after verifying client exists and is not deleted. */
  findReservationsByClientId(organizationId: string, clientId: string): Promise<ReservationWithProperty[]> {
    return this.prisma.reservation.findMany({
      where: { clientId, organizationId, deletedAt: null } as any,
      include: { property: true },
      orderBy: { checkIn: 'desc' },
    });
  }

  updateClient(
    organizationId: string,
    id: string,
    data: Prisma.ClientUpdateInput | Prisma.ClientUncheckedUpdateInput | Record<string, unknown>,
  ): Promise<Prisma.ClientGetPayload<Record<string, never>>> {
    return this.prisma.client.update({
      where: { id, organizationId },
      data: data as any,
    });
  }

  /** Soft delete: set deletedAt = now(). Use instead of hard delete so reservations still reference client. */
  softDeleteClient(organizationId: string, id: string): Promise<Prisma.ClientGetPayload<Record<string, never>>> {
    return this.prisma.client.update({
      where: { id, organizationId },
      data: { isArchived: true } as any,
    });
  }
}
