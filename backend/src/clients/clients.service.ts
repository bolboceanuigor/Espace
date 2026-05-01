import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { hasPermission, Permission } from '../auth/permissions';
import { ClientsRepository } from './clients.repository';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly repository: ClientsRepository,
    private subscriptionService: SubscriptionService,
  ) {}

  async create(organizationId: string, createdById: string | undefined, role: Role, createClientDto: CreateClientDto) {
    if (!hasPermission(role, Permission.CLIENT_CREATE)) {
      throw new ForbiddenException('You do not have permission to create clients');
    }
    await this.subscriptionService.assertCanCreateClient(organizationId);
    return this.repository.createClient(organizationId, {
      firstName: createClientDto.firstName,
      lastName: createClientDto.lastName ?? '',
      phone: createClientDto.phone,
      email: createClientDto.email ?? null,
      notes: createClientDto.notes ?? null,
      organizationId,
      ...(createdById && { createdById }),
    });
  }

  async findAll(
    organizationId: string,
    page?: string,
    pageSize?: string,
    showArchived?: string,
  ) {
    const usePagination = page !== undefined || pageSize !== undefined;
    const pageNumber = Math.max(1, Number.parseInt(page || '1', 10) || 1);
    const pageSizeNumber = Math.min(100, Math.max(1, Number.parseInt(pageSize || '20', 10) || 20));
    const includeArchived = showArchived === 'true';

    const [items, total] = await Promise.all([
      this.repository.findManyClients(
      organizationId,
      { organizationId, deletedAt: null, ...(includeArchived ? {} : { isArchived: false }) } as any,
      {
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: { _count: { select: { reservations: true } } },
        skip: usePagination ? (pageNumber - 1) * pageSizeNumber : undefined,
        take: usePagination ? pageSizeNumber : undefined,
      },
    ),
      this.repository.countClients(
        organizationId,
        { organizationId, deletedAt: null, ...(includeArchived ? {} : { isArchived: false }) } as any,
      ),
    ]);

    const effectivePageSize = usePagination ? pageSizeNumber : Math.max(1, total);
    return {
      items,
      meta: {
        page: pageNumber,
        pageSize: effectivePageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / effectivePageSize)),
      },
    };
  }

  async findOne(id: string, organizationId: string) {
    const client = await this.repository.findClientById(organizationId, id, {
      _count: { select: { reservations: true } },
      reservations: {
        where: { deletedAt: null } as any,
        include: { property: true },
        orderBy: { checkIn: 'desc' },
      },
    });
    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
    return client;
  }

  async findReservations(id: string, organizationId: string) {
    const client = await this.repository.findClientByIdMinimal(organizationId, id);
    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
    return this.repository.findReservationsByClientId(organizationId, id);
  }

  async update(id: string, organizationId: string, role: Role, updatedById: string | undefined, updateClientDto: UpdateClientDto) {
    if (!hasPermission(role, Permission.CLIENT_UPDATE)) {
      throw new ForbiddenException('You do not have permission to update clients');
    }
    await this.findOne(id, organizationId);
    return this.repository.updateClient(organizationId, id, {
      ...(updateClientDto.firstName !== undefined && { firstName: updateClientDto.firstName }),
      ...(updateClientDto.lastName !== undefined && { lastName: updateClientDto.lastName }),
      ...(updateClientDto.phone !== undefined && { phone: updateClientDto.phone }),
      ...(updateClientDto.email !== undefined && { email: updateClientDto.email ?? null }),
      ...(updateClientDto.notes !== undefined && { notes: updateClientDto.notes ?? null }),
      ...(updatedById && { updatedById }),
    });
  }

  async remove(id: string, organizationId: string, role: Role) {
    if (!hasPermission(role, Permission.CLIENT_DELETE)) {
      throw new ForbiddenException('You do not have permission to delete clients');
    }
    await this.findOne(id, organizationId);
    return this.repository.softDeleteClient(organizationId, id);
  }
}
