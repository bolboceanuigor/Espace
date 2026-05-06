import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ApartmentResidentRole, ApartmentStatus, InvoiceStatus, MeterStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private apartmentSelect(): Prisma.ApartmentSelect {
    return {
      id: true,
      organizationId: true,
      buildingId: true,
      staircaseId: true,
      number: true,
      floor: true,
      areaM2: true,
      rooms: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      building: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
      staircase: {
        select: {
          id: true,
          name: true,
        },
      },
      ownerResident: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
      apartmentResidents: {
        select: {
          role: true,
          isPrimary: true,
          resident: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              accountStatus: true,
              type: true,
            },
          },
        },
      },
      meters: {
        select: {
          id: true,
          type: true,
          serialNumber: true,
          status: true,
          readings: {
            orderBy: { readingDate: 'desc' },
            take: 1,
            select: {
              value: true,
              readingDate: true,
            },
          },
        },
      },
      invoices: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          month: true,
          year: true,
          amount: true,
          finalAmount: true,
          status: true,
          dueDate: true,
          paidAt: true,
        },
      },
      payments: {
        orderBy: { paidAt: 'desc' },
        take: 5,
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          paidAt: true,
          month: true,
        },
      },
      issues: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          category: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          apartmentResidents: true,
          meters: true,
          issues: true,
        },
      },
    };
  }

  private formatResidentName(resident?: { firstName?: string | null; lastName?: string | null } | null) {
    const name = `${resident?.firstName || ''} ${resident?.lastName || ''}`.trim();
    return name || null;
  }

  private summarizeInvoices(invoices: Array<{ amount: number; finalAmount: number; status: InvoiceStatus }>) {
    const unpaid = invoices.filter((invoice) => invoice.status === InvoiceStatus.UNPAID || invoice.status === InvoiceStatus.OVERDUE);
    return {
      debt: unpaid.reduce((sum, invoice) => sum + Number(invoice.finalAmount || invoice.amount || 0), 0),
      unpaidInvoices: unpaid.length,
    };
  }

  private toListApartment(apartment: any) {
    const invoiceSummary = this.summarizeInvoices(apartment.invoices || []);
    const meters = apartment.meters || [];
    const owner = apartment.ownerResident ?? apartment.apartmentResidents?.find((item) => item.isPrimary)?.resident ?? apartment.apartmentResidents?.[0]?.resident;

    return {
      id: apartment.id,
      organizationId: apartment.organizationId,
      buildingId: apartment.buildingId,
      staircaseId: apartment.staircaseId,
      number: apartment.number,
      floor: apartment.floor,
      areaM2: apartment.areaM2,
      rooms: apartment.rooms,
      status: apartment.status,
      createdAt: apartment.createdAt,
      updatedAt: apartment.updatedAt,
      building: apartment.building,
      staircase: apartment.staircase,
      owner: owner
        ? {
            id: owner.id,
            name: this.formatResidentName(owner),
            phone: owner.phone,
            email: owner.email,
          }
        : null,
      residentsCount: apartment._count?.apartmentResidents ?? 0,
      metersCount: apartment._count?.meters ?? 0,
      metersUpdated: meters.filter((meter) => meter.status === MeterStatus.ACTIVE).length,
      metersMissing: meters.filter((meter) => meter.status === MeterStatus.MISSING_READING).length,
      debt: invoiceSummary.debt,
      unpaidInvoices: invoiceSummary.unpaidInvoices,
      lastPayment: apartment.payments?.[0]?.paidAt ?? null,
    };
  }

  private toDetailApartment(apartment: any) {
    return {
      ...this.toListApartment(apartment),
      residents: (apartment.apartmentResidents || []).map((item) => ({
        id: item.resident.id,
        name: this.formatResidentName(item.resident),
        phone: item.resident.phone,
        email: item.resident.email,
        role: item.role,
        type: item.resident.type,
        accountStatus: item.resident.accountStatus,
        isPrimary: item.isPrimary,
      })),
      meters: (apartment.meters || []).map((meter) => ({
        id: meter.id,
        type: meter.type,
        serialNumber: meter.serialNumber,
        status: meter.status,
        lastReading: meter.readings?.[0]?.value ?? null,
        lastReadingDate: meter.readings?.[0]?.readingDate ?? null,
      })),
      invoices: apartment.invoices || [],
      payments: apartment.payments || [],
      issues: apartment.issues || [],
    };
  }

  async listApartments() {
    const apartments = await this.prisma.apartment.findMany({
      orderBy: [{ staircase: { name: 'asc' } }, { floor: 'asc' }, { number: 'asc' }],
      select: this.apartmentSelect(),
    });

    return apartments.map((apartment) => this.toListApartment(apartment));
  }

  async createApartment(body: unknown) {
    const input = this.parseCreateApartmentBody(body);

    const [organization, building, staircase] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } }),
      this.prisma.building.findFirst({
        where: {
          id: input.buildingId,
          organizationId: input.organizationId,
        },
        select: { id: true },
      }),
      this.prisma.staircase.findFirst({
        where: {
          id: input.staircaseId,
          buildingId: input.buildingId,
          organizationId: input.organizationId,
        },
        select: { id: true },
      }),
    ]);

    if (!organization) throw new NotFoundException('Organization not found');
    if (!building) throw new NotFoundException('Building not found');
    if (!staircase) throw new NotFoundException('Staircase not found');

    const duplicate = await this.prisma.apartment.findUnique({
      where: {
        staircaseId_number: {
          staircaseId: input.staircaseId,
          number: input.number,
        },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Acest apartament există deja.');
    }

    const apartment = await this.prisma.apartment.create({
      data: input,
      select: this.apartmentSelect(),
    });

    return this.toDetailApartment(apartment);
  }

  async linkResident(apartmentId: string, body: unknown) {
    const input = this.parseLinkResidentBody(body);

    const apartment = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      select: {
        id: true,
        organizationId: true,
      },
    });
    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    const resident = await this.prisma.residentProfile.findFirst({
      where: {
        id: input.residentId,
        organizationId: apartment.organizationId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        accountStatus: true,
      },
    });
    if (!resident) {
      throw new NotFoundException('Resident not found');
    }

    const duplicate = await this.prisma.apartmentResident.findFirst({
      where: {
        apartmentId,
        residentId: input.residentId,
      },
      select: { apartmentId: true },
    });
    if (duplicate) {
      throw new ConflictException('Această persoană este deja conectată la apartament.');
    }

    if (input.isPrimary) {
      await this.prisma.apartmentResident.updateMany({
        where: { apartmentId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const relation = await this.prisma.apartmentResident.create({
      data: {
        apartmentId,
        residentId: input.residentId,
        role: input.role,
        isPrimary: input.isPrimary,
      },
      include: {
        resident: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            accountStatus: true,
          },
        },
        apartment: {
          select: {
            id: true,
            number: true,
            organizationId: true,
          },
        },
      },
    });

    if (input.isPrimary && input.role === ApartmentResidentRole.OWNER) {
      await this.prisma.apartment.update({
        where: { id: apartmentId },
        data: { ownerResidentId: input.residentId },
      });
    }

    return {
      apartmentId: relation.apartmentId,
      residentId: relation.residentId,
      role: relation.role,
      isPrimary: relation.isPrimary,
      createdAt: relation.createdAt,
      apartment: relation.apartment,
      resident: {
        id: relation.resident.id,
        firstName: relation.resident.firstName,
        lastName: relation.resident.lastName,
        name: this.formatResidentName(relation.resident),
        phone: relation.resident.phone,
        email: relation.resident.email,
        accountStatus: relation.resident.accountStatus,
      },
    };
  }

  async getApartment(id: string) {
    const apartment = await this.prisma.apartment.findFirst({
      where: {
        OR: [{ id }, { number: id.replace(/^apt-/, '') }],
      },
      select: this.apartmentSelect(),
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    return this.toDetailApartment(apartment);
  }

  private parseCreateApartmentBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.requiredString(payload.organizationId, 'Organizația este obligatorie.');
    const buildingId = this.requiredString(payload.buildingId, 'Clădirea este obligatorie.');
    const staircaseId = this.requiredString(payload.staircaseId, 'Scara este obligatorie.');
    const number = this.requiredString(payload.number, 'Numărul apartamentului este obligatoriu.');
    const floor = this.requiredNumber(payload.floor, 'Etajul este obligatoriu.');
    const areaM2 = this.requiredNumber(payload.areaM2, 'Suprafața este obligatorie.');
    const rooms = this.optionalNumber(payload.rooms);
    const status = this.optionalEnum(payload.status, ApartmentStatus, ApartmentStatus.ACTIVE, 'Statusul nu este valid.');

    return {
      organizationId,
      buildingId,
      staircaseId,
      number,
      floor,
      areaM2,
      rooms: rooms ?? 1,
      status,
    };
  }

  private parseLinkResidentBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const residentId = this.requiredString(payload.residentId, 'Locatarul este obligatoriu.');
    const role = this.optionalEnum(payload.role, ApartmentResidentRole, ApartmentResidentRole.RESIDENT, 'Rolul nu este valid.');
    const isPrimary = Boolean(payload.isPrimary);

    return {
      residentId,
      role,
      isPrimary,
    };
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(message);
    }
    return value.trim();
  }

  private requiredNumber(value: unknown, message: string) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(message);
    }
    return parsed;
  }

  private optionalNumber(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }

  private optionalEnum<T extends Record<string, string>>(value: unknown, enumValues: T, fallback: T[keyof T], message: string) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') throw new BadRequestException(message);
    const normalized = value.trim().toUpperCase();
    const allowed = Object.values(enumValues) as string[];
    if (!allowed.includes(normalized)) throw new BadRequestException(message);
    return normalized as T[keyof T];
  }
}
