import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResidentType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { LimitsService } from '../limits/limits.service';
import {
  CreateApartmentDto,
  CreateBuildingDto,
  CreateResidentDto,
  CreateStaircaseDto,
  ListApartmentsQueryDto,
  ListResidentsQueryDto,
  UpdateApartmentDto,
  UpdateBuildingDto,
  UpdateResidentDto,
  UpdateStaircaseDto,
} from './dto/admin-structure.dto';
import * as bcrypt from 'bcrypt';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';

@Injectable()
export class AdminStructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly limitsService: LimitsService,
  ) {}

  private userId(user: any) {
    return user.id || user.sub || '';
  }

  private assertAdmin(user: { role?: string; organizationId?: string | null }) {
    if ((user.role || '').toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    if (!user.organizationId) {
      throw new ForbiddenException('Organization context missing');
    }
    return user.organizationId;
  }

  async listBuildings(user: { role?: string; organizationId?: string | null }) {
    const organizationId = this.assertAdmin(user);
    return this.prisma.building.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { staircases: true, apartments: true } },
      },
    });
  }

  async createBuilding(user: { role?: string; organizationId?: string | null }, dto: CreateBuildingDto) {
    const organizationId = this.assertAdmin(user);
    const buildingCount = await this.prisma.building.count({ where: { organizationId } });
    await this.limitsService.assertWithinCountLimit(user, organizationId, 'maxBuildings', buildingCount);
    const created = await this.prisma.building.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        address: dto.address.trim(),
        cadastralNumber: dto.cadastralNumber?.trim() || null,
        totalFloors: dto.totalFloors,
      },
    });
    await this.auditService.logCreate(
      { userId: this.userId(user), organizationId },
      'BUILDING',
      created.id,
      created,
      `Created building ${created.name}`,
    );
    return created;
  }

  async getBuilding(user: { role?: string; organizationId?: string | null }, id: string) {
    const organizationId = this.assertAdmin(user);
    const building = await this.prisma.building.findFirst({
      where: { id, organizationId },
      include: {
        staircases: { orderBy: { name: 'asc' } },
        apartments: {
          orderBy: [{ floor: 'asc' }, { number: 'asc' }],
          include: {
            residents: {
              include: { user: { select: { firstName: true, lastName: true, email: true } } },
            },
          },
        },
      },
    });
    if (!building) throw new NotFoundException('Building not found');
    return building;
  }

  async updateBuilding(user: { role?: string; organizationId?: string | null }, id: string, dto: UpdateBuildingDto) {
    const organizationId = this.assertAdmin(user);
    const exists = await this.prisma.building.findFirst({ where: { id, organizationId } });
    if (!exists) throw new NotFoundException('Building not found');
    const updated = await this.prisma.building.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
        ...(dto.cadastralNumber !== undefined ? { cadastralNumber: dto.cadastralNumber.trim() || null } : {}),
        ...(dto.totalFloors !== undefined ? { totalFloors: dto.totalFloors } : {}),
      },
    });
    await this.auditService.logUpdate(
      { userId: this.userId(user), organizationId },
      'BUILDING',
      updated.id,
      exists,
      updated,
      `Updated building ${updated.name}`,
    );
    return updated;
  }

  async deleteBuilding(user: { role?: string; organizationId?: string | null }, id: string) {
    const organizationId = this.assertAdmin(user);
    const exists = await this.prisma.building.findFirst({ where: { id, organizationId } });
    if (!exists) throw new NotFoundException('Building not found');
    await this.prisma.building.delete({ where: { id } });
    await this.auditService.logDelete(
      { userId: this.userId(user), organizationId },
      'BUILDING',
      id,
      exists,
      `Deleted building ${exists.name}`,
    );
    return { ok: true };
  }

  async listStaircases(user: { role?: string; organizationId?: string | null }, buildingId: string) {
    const organizationId = this.assertAdmin(user);
    const building = await this.prisma.building.findFirst({ where: { id: buildingId, organizationId }, select: { id: true } });
    if (!building) throw new NotFoundException('Building not found');
    return this.prisma.staircase.findMany({
      where: { organizationId, buildingId },
      orderBy: { name: 'asc' },
    });
  }

  async createStaircase(
    user: { role?: string; organizationId?: string | null },
    buildingId: string,
    dto: CreateStaircaseDto,
  ) {
    const organizationId = this.assertAdmin(user);
    const building = await this.prisma.building.findFirst({ where: { id: buildingId, organizationId }, select: { id: true } });
    if (!building) throw new BadRequestException('Cannot create staircase outside admin organization');
    const created = await this.prisma.staircase.create({
      data: {
        organizationId,
        buildingId,
        name: dto.name.trim(),
        floorsCount: dto.floorsCount,
      },
    });
    await this.auditService.logCreate(
      { userId: this.userId(user), organizationId },
      'STAIRCASE',
      created.id,
      created,
      `Created staircase ${created.name}`,
    );
    return created;
  }

  async updateStaircase(user: { role?: string; organizationId?: string | null }, id: string, dto: UpdateStaircaseDto) {
    const organizationId = this.assertAdmin(user);
    const staircase = await this.prisma.staircase.findFirst({ where: { id, organizationId } });
    if (!staircase) throw new NotFoundException('Staircase not found');
    const updated = await this.prisma.staircase.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.floorsCount !== undefined ? { floorsCount: dto.floorsCount } : {}),
      },
    });
    await this.auditService.logUpdate(
      { userId: this.userId(user), organizationId },
      'STAIRCASE',
      updated.id,
      staircase,
      updated,
      `Updated staircase ${updated.name}`,
    );
    return updated;
  }

  async deleteStaircase(user: { role?: string; organizationId?: string | null }, id: string) {
    const organizationId = this.assertAdmin(user);
    const staircase = await this.prisma.staircase.findFirst({ where: { id, organizationId } });
    if (!staircase) throw new NotFoundException('Staircase not found');
    await this.prisma.staircase.delete({ where: { id } });
    await this.auditService.logDelete(
      { userId: this.userId(user), organizationId },
      'STAIRCASE',
      id,
      staircase,
      `Deleted staircase ${staircase.name}`,
    );
    return { ok: true };
  }

  async listApartments(user: { role?: string; organizationId?: string | null }, query: ListApartmentsQueryDto) {
    const organizationId = this.assertAdmin(user);
    const search = query.search?.trim();
    const where = {
        organizationId,
        ...(query.buildingId ? { buildingId: query.buildingId } : {}),
        ...(query.staircaseId ? { staircaseId: query.staircaseId } : {}),
        ...(query.floor !== undefined ? { floor: query.floor } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(search
          ? {
              OR: [
                { number: { contains: search, mode: 'insensitive' as const } },
                {
                  residents: {
                    some: {
                      user: {
                        OR: [
                          { firstName: { contains: search, mode: 'insensitive' as const } },
                          { lastName: { contains: search, mode: 'insensitive' as const } },
                        ],
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      };
    const usePagination = query.page !== undefined || query.limit !== undefined;
    const { page, limit, skip } = resolvePagination(query, 20, 100);
    const [rows, total] = await Promise.all([
      this.prisma.apartment.findMany({
      where,
      orderBy: [{ building: { name: 'asc' } }, { staircase: { name: 'asc' } }, { floor: 'asc' }, { number: 'asc' }],
      ...(usePagination ? { skip, take: limit } : {}),
      include: {
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        residents: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    }),
      this.prisma.apartment.count({ where }),
    ]);
    if (!usePagination) return rows;
    return { data: rows, ...buildPaginationMeta(page, limit, total) };
  }

  async createApartment(user: { role?: string; organizationId?: string | null }, dto: CreateApartmentDto) {
    const organizationId = this.assertAdmin(user);
    const apartmentsCount = await this.prisma.apartment.count({ where: { organizationId } });
    await this.limitsService.assertWithinCountLimit(user, organizationId, 'maxApartments', apartmentsCount);
    const [building, staircase] = await Promise.all([
      this.prisma.building.findFirst({ where: { id: dto.buildingId, organizationId }, select: { id: true } }),
      this.prisma.staircase.findFirst({
        where: { id: dto.staircaseId, organizationId, buildingId: dto.buildingId },
        select: { id: true },
      }),
    ]);
    if (!building || !staircase) throw new BadRequestException('Cannot create apartment outside admin organization');

    const normalizedNumber = dto.number.trim().toUpperCase();
    const duplicateApartment = await this.prisma.apartment.findFirst({
      where: {
        organizationId,
        staircaseId: dto.staircaseId,
        number: { equals: normalizedNumber, mode: 'insensitive' },
      } as any,
      select: { id: true },
    });
    if (duplicateApartment) {
      throw new BadRequestException('Apartment number already exists on this staircase');
    }

    const created = await this.prisma.apartment.create({
      data: {
        organizationId,
        buildingId: dto.buildingId,
        staircaseId: dto.staircaseId,
        number: normalizedNumber,
        floor: dto.floor,
        areaM2: dto.areaM2,
        rooms: dto.rooms ?? null,
        status: dto.status,
      },
    });
    await this.auditService.logCreate(
      { userId: this.userId(user), organizationId },
      'APARTMENT',
      created.id,
      created,
      `Created apartment ${created.number}`,
    );
    return created;
  }

  async updateApartment(user: { role?: string; organizationId?: string | null }, id: string, dto: UpdateApartmentDto) {
    const organizationId = this.assertAdmin(user);
    const apartment = await this.prisma.apartment.findFirst({ where: { id, organizationId } });
    if (!apartment) throw new NotFoundException('Apartment not found');

    const buildingId = dto.buildingId ?? apartment.buildingId;
    const staircaseId = dto.staircaseId ?? apartment.staircaseId;
    const [building, staircase] = await Promise.all([
      this.prisma.building.findFirst({ where: { id: buildingId, organizationId }, select: { id: true } }),
      this.prisma.staircase.findFirst({
        where: { id: staircaseId, organizationId, buildingId },
        select: { id: true },
      }),
    ]);
    if (!building || !staircase) throw new BadRequestException('Cannot update apartment outside admin organization');

    const nextNumber = dto.number !== undefined ? dto.number.trim().toUpperCase() : apartment.number;
    const duplicateApartment = await this.prisma.apartment.findFirst({
      where: {
        organizationId,
        id: { not: id },
        staircaseId,
        number: { equals: nextNumber, mode: 'insensitive' },
      } as any,
      select: { id: true },
    });
    if (duplicateApartment) {
      throw new BadRequestException('Apartment number already exists on this staircase');
    }

    const updated = await this.prisma.apartment.update({
      where: { id },
      data: {
        ...(dto.buildingId !== undefined ? { buildingId: dto.buildingId } : {}),
        ...(dto.staircaseId !== undefined ? { staircaseId: dto.staircaseId } : {}),
        ...(dto.number !== undefined ? { number: nextNumber } : {}),
        ...(dto.floor !== undefined ? { floor: dto.floor } : {}),
        ...(dto.areaM2 !== undefined ? { areaM2: dto.areaM2 } : {}),
        ...(dto.rooms !== undefined ? { rooms: dto.rooms } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    await this.auditService.logUpdate(
      { userId: this.userId(user), organizationId },
      'APARTMENT',
      updated.id,
      apartment,
      updated,
      `Updated apartment ${updated.number}`,
    );
    return updated;
  }

  async deleteApartment(user: { role?: string; organizationId?: string | null }, id: string) {
    const organizationId = this.assertAdmin(user);
    const apartment = await this.prisma.apartment.findFirst({ where: { id, organizationId } });
    if (!apartment) throw new NotFoundException('Apartment not found');
    const [linkedResidents, linkedInvoices, linkedPayments] = await Promise.all([
      this.prisma.residentProfile.count({ where: { organizationId, apartmentId: id } }),
      this.prisma.residentInvoice.count({ where: { organizationId, apartmentId: id } }),
      this.prisma.payment.count({ where: { organizationId, apartmentId: id } }),
    ]);
    if (linkedResidents || linkedInvoices || linkedPayments) {
      throw new BadRequestException('Cannot delete apartment with linked residents or financial history');
    }

    await this.prisma.apartment.delete({ where: { id } });
    await this.auditService.logDelete(
      { userId: this.userId(user), organizationId },
      'APARTMENT',
      id,
      apartment,
      `Deleted apartment ${apartment.number}`,
    );
    return { ok: true };
  }

  async listResidents(user: { role?: string; organizationId?: string | null }, query: ListResidentsQueryDto) {
    const organizationId = this.assertAdmin(user);
    const where = { organizationId };
    const usePagination = query.page !== undefined || query.limit !== undefined;
    const { page, limit, skip } = resolvePagination(query, 20, 100);
    const [rows, total] = await Promise.all([
      this.prisma.residentProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(usePagination ? { skip, take: limit } : {}),
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        apartment: {
          select: {
            id: true,
            number: true,
            floor: true,
            building: { select: { id: true, name: true } },
            staircase: { select: { id: true, name: true } },
          },
        },
      },
    }),
      this.prisma.residentProfile.count({ where }),
    ]);
    if (!usePagination) return rows;
    return { data: rows, ...buildPaginationMeta(page, limit, total) };
  }

  async createResident(user: { role?: string; organizationId?: string | null }, dto: CreateResidentDto) {
    const organizationId = this.assertAdmin(user);
    const residentsCount = await this.prisma.residentProfile.count({ where: { organizationId } });
    await this.limitsService.assertWithinCountLimit(user, organizationId, 'maxResidents', residentsCount);
    const apartment = await this.prisma.apartment.findFirst({ where: { id: dto.apartmentId, organizationId }, select: { id: true } });
    if (!apartment) throw new BadRequestException('Cannot link resident to apartment from another organization');

    if (dto.phone?.trim()) {
      const phoneDuplicate = await this.prisma.residentProfile.findFirst({
        where: { organizationId, phone: dto.phone.trim() },
        select: { id: true },
      });
      if (phoneDuplicate) {
        throw new BadRequestException('Resident phone already exists in this organization');
      }
    }

    let userId = dto.userId;
    if (userId) {
      const existingUser = await this.prisma.user.findFirst({ where: { id: userId, organizationId, deletedAt: null }, select: { id: true } });
      if (!existingUser) throw new BadRequestException('User not found in this organization');
    } else {
      if (!dto.email) throw new BadRequestException('email is required when userId is not provided');
      const normalizedEmail = dto.email.trim().toLowerCase();
      const existingEmailUser = await this.prisma.user.findFirst({ where: { email: normalizedEmail, deletedAt: null } });
      if (existingEmailUser && existingEmailUser.organizationId !== organizationId) {
        throw new BadRequestException('User belongs to another organization');
      }
      if (existingEmailUser) {
        userId = existingEmailUser.id;
      } else {
        const password = dto.password || 'Resident123!';
        const passwordHash = await bcrypt.hash(password, 10);
        const createdUser = await this.prisma.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            firstName: dto.firstName || null,
            lastName: dto.lastName || null,
            role: 'RESIDENT',
            organizationId,
            emailVerifiedAt: new Date(),
            authProvider: 'LOCAL',
            isActive: true,
          },
          select: { id: true },
        });
        userId = createdUser.id;
      }
    }

    const created = await this.prisma.residentProfile.create({
      data: {
        organizationId,
        userId: userId!,
        apartmentId: dto.apartmentId,
        type: dto.type as ResidentType,
        phone: dto.phone?.trim() || null,
        isPrimary: !!dto.isPrimary,
      },
    });
    if (created.isPrimary) {
      await this.prisma.residentProfile.updateMany({
        where: {
          organizationId,
          apartmentId: created.apartmentId,
          type: created.type as ResidentType,
          id: { not: created.id },
        },
        data: { isPrimary: false },
      });
    }
    await this.auditService.logCreate(
      { userId: this.userId(user), organizationId },
      'RESIDENT_PROFILE',
      created.id,
      created,
      'Created resident profile',
    );
    return created;
  }

  async updateResident(user: { role?: string; organizationId?: string | null }, id: string, dto: UpdateResidentDto) {
    const organizationId = this.assertAdmin(user);
    const resident = await this.prisma.residentProfile.findFirst({ where: { id, organizationId } });
    if (!resident) throw new NotFoundException('Resident profile not found');
    if (dto.apartmentId) {
      const apartment = await this.prisma.apartment.findFirst({ where: { id: dto.apartmentId, organizationId }, select: { id: true } });
      if (!apartment) throw new BadRequestException('Cannot link resident to apartment from another organization');
    }
    if (dto.phone !== undefined) {
      const normalizedPhone = dto.phone.trim();
      if (normalizedPhone) {
        const duplicatePhone = await this.prisma.residentProfile.findFirst({
          where: {
            organizationId,
            id: { not: id },
            phone: normalizedPhone,
          },
          select: { id: true },
        });
        if (duplicatePhone) {
          throw new BadRequestException('Resident phone already exists in this organization');
        }
      }
    }

    const updated = await this.prisma.residentProfile.update({
      where: { id },
      data: {
        ...(dto.apartmentId !== undefined ? { apartmentId: dto.apartmentId } : {}),
        ...(dto.type !== undefined ? { type: dto.type as ResidentType } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
      },
    });
    if (updated.isPrimary) {
      await this.prisma.residentProfile.updateMany({
        where: {
          organizationId,
          apartmentId: updated.apartmentId,
          type: updated.type as ResidentType,
          id: { not: updated.id },
        },
        data: { isPrimary: false },
      });
    }
    await this.auditService.logUpdate(
      { userId: this.userId(user), organizationId },
      'RESIDENT_PROFILE',
      updated.id,
      resident,
      updated,
      'Updated resident profile',
    );
    return updated;
  }

  async deleteResident(user: { role?: string; organizationId?: string | null }, id: string) {
    const organizationId = this.assertAdmin(user);
    const resident = await this.prisma.residentProfile.findFirst({ where: { id, organizationId } });
    if (!resident) throw new NotFoundException('Resident profile not found');
    await this.prisma.residentProfile.delete({ where: { id } });
    await this.auditService.logDelete(
      { userId: this.userId(user), organizationId },
      'RESIDENT_PROFILE',
      id,
      resident,
      'Deleted resident profile',
    );
    return { ok: true };
  }
}
