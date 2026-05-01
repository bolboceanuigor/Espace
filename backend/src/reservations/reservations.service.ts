import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, ReservationStatus, Role } from '@prisma/client';
import { hasPermission, Permission } from '../auth/permissions';
import { SubscriptionService } from '../subscription/subscription.service';
import { ReservationsRepository, ReservationOverlapError } from './reservations.repository';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { EventsGateway } from '../events/events.gateway';
import { formatDateOnly, parseDateOnly } from '../common/date-only';
import { ActivityService } from '../activity/activity.service';
import { CleaningsService } from '../cleanings/cleanings.service';

const MS_PER_DAY = 86400000;

function daysBetween(start: Date, end: Date): number {
  const n = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / MS_PER_DAY);
  return Math.max(1, n);
}

/** Statuses that block overlapping (no double-booking). */
const BLOCKING_STATUSES = [ReservationStatus.CONFIRMED, ReservationStatus.PENDING, ReservationStatus.BLOCKED];

@Injectable()
export class ReservationsService {
  constructor(
    private readonly repository: ReservationsRepository,
    private subscriptionService: SubscriptionService,
    private eventsGateway: EventsGateway,
    private readonly activityService: ActivityService,
    private readonly cleaningsService: CleaningsService,
  ) {}

  /** Compute nights between check-in and check-out (minimum 1). */
  static nights(checkIn: Date, checkOut: Date): number {
    return daysBetween(checkIn, checkOut);
  }

  /** Add computed nights to a reservation object for API response. */
  private withNights<T extends { checkIn: Date; checkOut: Date }>(
    r: T,
  ): T & { nights: number; startDate: string; endDate: string } {
    return {
      ...r,
      nights: ReservationsService.nights(r.checkIn, r.checkOut),
      startDate: formatDateOnly(r.checkIn),
      endDate: formatDateOnly(r.checkOut),
    };
  }

  async create(organizationId: string, createdById: string | undefined, role: Role, createReservationDto: CreateReservationDto) {
    if (!hasPermission(role, Permission.RESERVATION_CREATE)) {
      throw new ForbiddenException('You do not have permission to create reservations');
    }
    await this.subscriptionService.assertCanCreateReservation(organizationId);
    const property = await this.repository.findPropertyById(organizationId, createReservationDto.propertyId);

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    if (role === Role.MANAGER && createdById) {
      await this.assertManagerPropertyAccess(organizationId, createdById, createReservationDto.propertyId);
    }

    const checkInDate = parseDateOnly(
      createReservationDto.checkIn ?? createReservationDto.startDate ?? '',
    );
    const checkOutDate = parseDateOnly(
      createReservationDto.checkOut ?? createReservationDto.endDate ?? '',
    );

    this.validateReservationDates(checkInDate, checkOutDate);

    const nights = ReservationsService.nights(checkInDate, checkOutDate);
    const totalPrice =
      createReservationDto.totalPrice != null && createReservationDto.totalPrice >= 0
        ? Number(createReservationDto.totalPrice)
        : Number(property.basePrice) * nights + Number(property.cleaningFee ?? 0);

    const overlapWhere = {
      propertyId: createReservationDto.propertyId,
      organizationId,
      status: { in: BLOCKING_STATUSES },
      checkIn: { lt: checkOutDate },
      checkOut: { gt: checkInDate },
      deletedAt: null,
    };

    const createData = {
      propertyId: createReservationDto.propertyId,
      organizationId,
      guestName: createReservationDto.guestName,
      phoneNumber: createReservationDto.phoneNumber,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      totalPrice: Math.round(totalPrice * 100) / 100,
      status: (createReservationDto.status?.toUpperCase() as ReservationStatus) ?? ReservationStatus.CONFIRMED,
      source: createReservationDto.source?.toUpperCase() ?? 'DIRECT',
      notes: createReservationDto.notes?.trim() || null,
      cleaningStatus:
        (createReservationDto.status?.toUpperCase() as ReservationStatus) === ReservationStatus.CANCELLED
          ? 'CANCELLED'
          : ((createReservationDto.cleaningStatus as any) ?? 'TODO'),
      ...(createdById && { createdById }),
    };

    let reservation;
    try {
      reservation = await this.repository.createReservationInTransaction(organizationId, overlapWhere, createData);
    } catch (err) {
      if (err instanceof ReservationOverlapError) {
        throw new ConflictException(err.message);
      }
      throw err;
    }

    this.eventsGateway.emitToOrganization(organizationId, 'reservation:created', reservation);
    await this.cleaningsService.syncFromReservation({
      reservationId: reservation.id,
      organizationId,
      propertyId: reservation.propertyId,
      checkOut: reservation.checkOut,
      status: reservation.status as ReservationStatus,
      notes: reservation.notes,
    });
    await this.activityService.log({
      organizationId,
      performedById: createdById,
      performedByRole: role,
      action: 'reservation.create',
      entityType: 'reservation',
      entityId: reservation.id,
      payload: {
        propertyId: reservation.propertyId,
        guestName: reservation.guestName,
        checkIn: reservation.checkIn.toISOString(),
        checkOut: reservation.checkOut.toISOString(),
      },
    });

    return this.withNights(reservation);
  }

  async findAll(
    organizationId: string,
    userId: string,
    role: Role,
    start?: string,
    end?: string,
    status?: string,
    source?: string,
    propertyId?: string,
    q?: string,
    page?: string,
    pageSize?: string,
  ) {
    const where: Prisma.ReservationWhereInput = {
      organizationId,
      deletedAt: null,
    };

    if (start && end) {
      const rangeStart = parseDateOnly(start);
      const rangeEnd = parseDateOnly(end);
      if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
        throw new BadRequestException('Invalid reservation range');
      }
      if (rangeStart >= rangeEnd) {
        throw new BadRequestException('start must be before end');
      }
      where.checkIn = { lt: rangeEnd };
      where.checkOut = { gt: rangeStart };
    }

    if (status && status !== 'all') {
      where.status = status.toUpperCase() as ReservationStatus;
    }

    if (source && source !== 'all') {
      where.source = source.toUpperCase();
    }

    const search = (q || '').trim();
    if (search) {
      where.OR = [
        { guestName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const scopedPropertyIds = await this.getScopedPropertyIds(organizationId, userId, role);
    if (role === Role.MANAGER && scopedPropertyIds.length === 0) {
      return {
        items: [],
        meta: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 1,
        },
      };
    }

    if (propertyId) {
      const property = await this.repository.findPropertyById(organizationId, propertyId);
      if (!property) {
        throw new NotFoundException('Property not found');
      }
      if (property.organizationId !== organizationId) {
        throw new ForbiddenException('Access denied');
      }
      if (role === Role.MANAGER) {
        await this.assertManagerPropertyAccess(organizationId, userId, propertyId);
      }
      where.propertyId = propertyId;
    } else if (role === Role.MANAGER) {
      where.propertyId = { in: scopedPropertyIds };
    }

    const usePagination = page !== undefined || pageSize !== undefined;
    const pageNumber = Math.max(1, Number.parseInt(page || '1', 10) || 1);
    const pageSizeNumber = Math.min(100, Math.max(1, Number.parseInt(pageSize || '20', 10) || 20));
    const list = await this.repository.findReservations(organizationId, where, {
      include: { property: true },
      orderBy: { checkIn: 'asc' },
      skip: usePagination ? (pageNumber - 1) * pageSizeNumber : undefined,
      take: usePagination ? pageSizeNumber : undefined,
    });
    const total = await this.repository.countReservations(organizationId, where);
    const effectivePageSize = usePagination ? pageSizeNumber : Math.max(1, total);
    return {
      items: list.map((r) => this.withNights(r)),
      meta: {
        page: pageNumber,
        pageSize: effectivePageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / effectivePageSize)),
      },
    };
  }

  async findByWeek(organizationId: string, userId: string, role: Role, startDate: string) {
    if (!startDate) {
      throw new BadRequestException('startDate query parameter is required');
    }

    const weekStart = new Date(startDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const where: any = {
      organizationId,
      deletedAt: null,
      OR: [
        {
          AND: [
            { checkIn: { gte: weekStart } },
            { checkIn: { lte: weekEnd } },
          ],
        },
        {
          AND: [
            { checkOut: { gte: weekStart } },
            { checkOut: { lte: weekEnd } },
          ],
        },
        {
          AND: [
            { checkIn: { lte: weekStart } },
            { checkOut: { gte: weekEnd } },
          ],
        },
      ],
    };

    const scopedPropertyIds = await this.getScopedPropertyIds(organizationId, userId, role);
    if (role === Role.MANAGER && scopedPropertyIds.length === 0) {
      return [];
    }
    if (role === Role.MANAGER) {
      where.propertyId = { in: scopedPropertyIds };
    }

    const weekList = await this.repository.findReservationsByWeek(organizationId, where, {
      include: { property: true },
      orderBy: { checkIn: 'asc' },
    });
    return weekList.map((r) => this.withNights(r));
  }

  async findOne(id: string, organizationId: string, userId: string, role: Role) {
    const reservation = await this.repository.findReservationById(
      organizationId,
      id,
      { property: true },
    );

    if (!reservation) {
      throw new NotFoundException(`Reservation with ID ${id} not found`);
    }

    if (role === Role.MANAGER) {
      await this.assertManagerPropertyAccess(organizationId, userId, reservation.propertyId);
    }

    return this.withNights(reservation);
  }

  async update(
    id: string,
    organizationId: string,
    userRole: Role,
    updatedById: string | undefined,
    updateReservationDto: UpdateReservationDto,
  ) {
    if (!hasPermission(userRole, Permission.RESERVATION_UPDATE)) {
      throw new ForbiddenException('You do not have permission to update reservations');
    }
    const reservation = await this.findOne(id, organizationId, updatedById ?? '', userRole);
    const requestedStatus = updateReservationDto.status?.toUpperCase() as ReservationStatus | undefined;
    if (requestedStatus && requestedStatus !== reservation.status) {
      if (!this.isAllowedStatusTransition(reservation.status as ReservationStatus, requestedStatus)) {
        throw new BadRequestException(
          `Invalid status transition: ${reservation.status} -> ${requestedStatus}`,
        );
      }
    }

    const nextPropertyId = updateReservationDto.propertyId ?? reservation.propertyId;
    if (
      updateReservationDto.propertyId ||
      updateReservationDto.checkIn ||
      updateReservationDto.checkOut
    ) {
      const checkIn = updateReservationDto.checkIn
        ? parseDateOnly(updateReservationDto.checkIn)
        : updateReservationDto.startDate
          ? parseDateOnly(updateReservationDto.startDate)
        : reservation.checkIn;
      const checkOut = updateReservationDto.checkOut
        ? parseDateOnly(updateReservationDto.checkOut)
        : updateReservationDto.endDate
          ? parseDateOnly(updateReservationDto.endDate)
        : reservation.checkOut;

      this.validateReservationDates(checkIn, checkOut);
      const targetProperty = await this.repository.findPropertyById(
        organizationId,
        nextPropertyId,
      );
      if (!targetProperty || targetProperty.organizationId !== organizationId) {
        throw new NotFoundException('Property not found');
      }
      if (userRole === Role.MANAGER && updatedById) {
        await this.assertManagerPropertyAccess(organizationId, updatedById, nextPropertyId);
      }

      await this.assertNoOverlap(
        nextPropertyId,
        checkIn,
        checkOut,
        id,
        organizationId,
      );
    }

    const updateData: any = { ...updateReservationDto };
    if (requestedStatus === ReservationStatus.CANCELLED) {
      updateData.cleaningStatus = 'CANCELLED';
    } else if (requestedStatus && !updateReservationDto.cleaningStatus) {
      updateData.cleaningStatus = 'TODO';
    }
    if (updateReservationDto.checkIn) {
      updateData.checkIn = parseDateOnly(updateReservationDto.checkIn);
    } else if (updateReservationDto.startDate) {
      updateData.checkIn = parseDateOnly(updateReservationDto.startDate);
    }
    if (updateReservationDto.checkOut) {
      updateData.checkOut = parseDateOnly(updateReservationDto.checkOut);
    } else if (updateReservationDto.endDate) {
      updateData.checkOut = parseDateOnly(updateReservationDto.endDate);
    }

    if (updatedById) updateData.updatedById = updatedById;
    const updated = await this.repository.updateReservation(
      organizationId,
      id,
      updateData,
      { property: true },
    );

    this.eventsGateway.emitToOrganization(organizationId, 'reservation:updated', updated);
    await this.cleaningsService.syncFromReservation({
      reservationId: updated.id,
      organizationId,
      propertyId: updated.propertyId,
      checkOut: updated.checkOut,
      status: updated.status as ReservationStatus,
      notes: updated.notes,
    });
    const nextStatus = (updateData.status ?? reservation.status) as ReservationStatus;
    const moved =
      (updateData.propertyId && updateData.propertyId !== reservation.propertyId) ||
      !!updateData.checkIn ||
      !!updateData.checkOut;
    const action = nextStatus === ReservationStatus.CANCELLED
      ? 'reservation.cancel'
      : moved
        ? 'reservation.moved'
        : 'reservation.update';
    await this.activityService.log({
      organizationId,
      performedById: updatedById,
      performedByRole: userRole,
      action,
      entityType: 'reservation',
      entityId: updated.id,
      payload: {
        status: nextStatus,
        cleaningStatus: updateData.cleaningStatus,
        old: {
          propertyId: reservation.propertyId,
          checkIn: reservation.checkIn.toISOString(),
          checkOut: reservation.checkOut.toISOString(),
        },
        next: {
          propertyId: updated.propertyId,
          checkIn: updated.checkIn.toISOString(),
          checkOut: updated.checkOut.toISOString(),
        },
      },
    });

    return this.withNights(updated);
  }

  async remove(id: string, organizationId: string, role: Role, updatedById?: string) {
    if (!hasPermission(role, Permission.RESERVATION_DELETE)) {
      throw new ForbiddenException('You do not have permission to delete reservations');
    }
    const reservation = await this.findOne(id, organizationId, updatedById ?? '', role);
    const deleted = await this.repository.updateReservation(
      organizationId,
      id,
      {
        status: ReservationStatus.CANCELLED,
        cleaningStatus: 'CANCELLED',
        ...(updatedById && { updatedById }),
      },
      { property: true },
    );

    this.eventsGateway.emitToOrganization(organizationId, 'reservation:deleted', { id });
    await this.cleaningsService.syncFromReservation({
      reservationId: deleted.id,
      organizationId,
      propertyId: deleted.propertyId,
      checkOut: deleted.checkOut,
      status: deleted.status as ReservationStatus,
      notes: deleted.notes,
    });
    await this.activityService.log({
      organizationId,
      performedById: updatedById,
      performedByRole: role,
      action: 'reservation.delete',
      entityType: 'reservation',
      entityId: id,
      payload: {
        previousStatus: reservation.status,
        nextStatus: ReservationStatus.CANCELLED,
      },
    });

    return this.withNights(deleted);
  }

  async cancel(id: string, organizationId: string, role: Role, updatedById?: string) {
    return this.update(id, organizationId, role, updatedById, { status: ReservationStatus.CANCELLED });
  }

  async move(
    id: string,
    organizationId: string,
    role: Role,
    newCheckIn: string,
    newCheckOut: string,
    updatedById?: string,
  ) {
    if (!hasPermission(role, Permission.RESERVATION_UPDATE)) {
      throw new ForbiddenException('You do not have permission to move reservations');
    }
    const reservation = await this.findOne(id, organizationId, updatedById ?? '', role);

    const checkInDate = parseDateOnly(newCheckIn);
    const checkOutDate = parseDateOnly(newCheckOut);

    this.validateReservationDates(checkInDate, checkOutDate);

    await this.assertNoOverlap(
      reservation.propertyId,
      checkInDate,
      checkOutDate,
      id,
      organizationId,
    );

    const updated = await this.repository.updateReservation(
      organizationId,
      id,
      {
        checkIn: checkInDate,
        checkOut: checkOutDate,
        ...(updatedById && { updatedById }),
      },
      { property: true },
    );

    this.eventsGateway.emitToOrganization(organizationId, 'reservation:updated', updated);
    await this.activityService.log({
      organizationId,
      performedById: updatedById,
      performedByRole: role,
      action: 'reservation.moved',
      entityType: 'reservation',
      entityId: updated.id,
      payload: {
        old: {
          propertyId: reservation.propertyId,
          checkIn: reservation.checkIn.toISOString(),
          checkOut: reservation.checkOut.toISOString(),
        },
        next: {
          propertyId: updated.propertyId,
          checkIn: updated.checkIn.toISOString(),
          checkOut: updated.checkOut.toISOString(),
        },
      },
    });

    return this.withNights(updated);
  }

  private validateReservationDates(checkIn: Date, checkOut: Date) {
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      throw new BadRequestException('Invalid reservation dates');
    }
    if (checkIn >= checkOut) {
      throw new BadRequestException('Check-in date must be before check-out date');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (checkIn < today) {
      throw new BadRequestException('Check-in date cannot be in the past');
    }
  }

  /**
   * Strong conflict detection: no overlapping reservations for confirmed/pending.
   * Overlap: (existing.checkIn < newCheckOut) AND (existing.checkOut > newCheckIn).
   */
  private async assertNoOverlap(
    propertyId: string,
    checkIn: Date,
    checkOut: Date,
    excludeId: string | undefined,
    organizationId: string,
  ): Promise<void> {
    const overlapping = await this.repository.findFirstOverlapping(organizationId, {
      propertyId,
      ...(excludeId && { id: { not: excludeId } }),
      status: { in: BLOCKING_STATUSES },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      deletedAt: null,
    });

    if (overlapping) {
      throw new ConflictException(
        'Reservation overlaps with an existing reservation for this property. Choose different dates.',
      );
    }
  }

  private async getScopedPropertyIds(organizationId: string, userId: string, role: Role): Promise<string[]> {
    if (role === Role.ADMIN || role === Role.SUPERADMIN) {
      return [];
    }

    return this.repository.findPropertyIdsByAccess(organizationId, userId);
  }

  private isAllowedStatusTransition(current: ReservationStatus, next: ReservationStatus): boolean {
    if (current === next) return true;
    const transitions: Record<ReservationStatus, ReservationStatus[]> = {
      [ReservationStatus.PENDING]: [ReservationStatus.CONFIRMED, ReservationStatus.CANCELLED],
      [ReservationStatus.CONFIRMED]: [ReservationStatus.CANCELLED],
      [ReservationStatus.CANCELLED]: [ReservationStatus.CONFIRMED],
      [ReservationStatus.BLOCKED]: [ReservationStatus.CANCELLED],
    };
    return transitions[current]?.includes(next) ?? false;
  }

  private async assertManagerPropertyAccess(
    organizationId: string,
    userId: string,
    propertyId: string,
  ): Promise<void> {
    const scopedPropertyIds = await this.repository.findPropertyIdsByAccess(organizationId, userId);
    if (!scopedPropertyIds.includes(propertyId)) {
      throw new ForbiddenException('Access denied');
    }
  }

}
