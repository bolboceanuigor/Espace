import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma, ResidentAccountStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResidentsService {
  constructor(private readonly prisma: PrismaService) {}

  private residentSelect(): Prisma.ResidentProfileSelect {
    return {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      accountStatus: true,
      type: true,
      isPrimary: true,
      createdAt: true,
      updatedAt: true,
      apartmentResidents: {
        select: {
          role: true,
          isPrimary: true,
          apartment: {
            select: {
              id: true,
              number: true,
              floor: true,
              areaM2: true,
              rooms: true,
              status: true,
              building: { select: { id: true, name: true } },
              staircase: { select: { id: true, name: true } },
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
                  status: true,
                  method: true,
                  paidAt: true,
                  month: true,
                },
              },
            },
          },
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
          apartment: { select: { id: true, number: true } },
        },
      },
      messageThreads: {
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          subject: true,
          updatedAt: true,
          apartment: { select: { id: true, number: true } },
        },
      },
    };
  }

  private fullName(resident: { firstName?: string | null; lastName?: string | null }) {
    return `${resident.firstName || ''} ${resident.lastName || ''}`.trim() || 'Locatar';
  }

  private debtForApartment(apartment: { invoices?: Array<{ amount: number; finalAmount: number; status: InvoiceStatus }> }) {
    return (apartment.invoices || [])
      .filter((invoice) => invoice.status === InvoiceStatus.UNPAID || invoice.status === InvoiceStatus.OVERDUE)
      .reduce((sum, invoice) => sum + Number(invoice.finalAmount || invoice.amount || 0), 0);
  }

  private apartmentSummary(item: any) {
    const apartment = item.apartment;
    return {
      id: apartment.id,
      number: apartment.number,
      floor: apartment.floor,
      areaM2: apartment.areaM2,
      rooms: apartment.rooms,
      status: apartment.status,
      building: apartment.building,
      staircase: apartment.staircase,
      role: item.role,
      isPrimary: item.isPrimary,
      debt: this.debtForApartment(apartment),
      invoices: apartment.invoices || [],
      payments: apartment.payments || [],
    };
  }

  private toResident(row: any) {
    const apartments = (row.apartmentResidents || []).map((item) => this.apartmentSummary(item));
    const debt = apartments.reduce((sum, apartment) => sum + apartment.debt, 0);
    const primaryRelation = row.apartmentResidents?.find((item) => item.isPrimary) ?? row.apartmentResidents?.[0];

    return {
      id: row.id,
      organizationId: row.organizationId,
      firstName: row.firstName,
      lastName: row.lastName,
      name: this.fullName(row),
      phone: row.phone,
      email: row.email,
      accountStatus: row.accountStatus,
      type: row.type,
      role: primaryRelation?.role ?? row.type,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      apartments,
      debt,
      issues: row.issues || [],
      messages: row.messageThreads || [],
    };
  }

  async listResidents() {
    const residents = await this.prisma.residentProfile.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { createdAt: 'asc' }],
      select: this.residentSelect(),
    });

    return residents.map((resident) => this.toResident(resident));
  }

  async createResident(body: unknown) {
    const input = await this.parseCreateResidentBody(body);

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (input.email) {
      const existing = await this.prisma.residentProfile.findFirst({
        where: {
          organizationId: input.organizationId,
          email: input.email,
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('Există deja o persoană cu acest email.');
      }
    }

    const resident = await this.prisma.residentProfile.create({
      data: input,
      select: this.residentSelect(),
    });

    return this.toResident(resident);
  }

  async getResident(id: string) {
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id },
      select: this.residentSelect(),
    });

    if (!resident) {
      throw new NotFoundException('Resident not found');
    }

    return this.toResident(resident);
  }

  private async parseCreateResidentBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.requiredString(payload.organizationId, 'Organizația este obligatorie.');
    const firstName = this.requiredString(payload.firstName, 'Prenumele este obligatoriu.');
    const lastName = this.requiredString(payload.lastName, 'Numele este obligatoriu.');
    const phone = typeof payload.phone === 'string' ? payload.phone.trim() : null;
    const email = typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim().toLowerCase() : null;
    const accountStatus = this.optionalEnum(payload.accountStatus, ResidentAccountStatus, ResidentAccountStatus.NO_ACCOUNT, 'Statusul contului nu este valid.');

    if (email && !email.includes('@')) {
      throw new BadRequestException('Emailul nu este valid.');
    }

    return {
      organizationId,
      firstName,
      lastName,
      phone: phone || null,
      email,
      accountStatus,
    };
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(message);
    }
    return value.trim();
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
