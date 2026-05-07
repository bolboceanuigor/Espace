import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApartmentResidentRole, ApartmentStatus, InvoiceStatus, MeterStatus, PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

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
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          paidAt: true,
          month: true,
          note: true,
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

  private invoicePaymentNote(invoiceId: string) {
    return `Invoice ${invoiceId}`;
  }

  private money(value: number) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  private invoiceAmount(invoice: { amount?: number | null; finalAmount?: number | null }) {
    return Number(invoice.finalAmount || invoice.amount || 0);
  }

  private summarizeInvoices(
    invoices: Array<{ id: string; amount: number; finalAmount: number; status: InvoiceStatus; month?: number | null; year?: number | null; dueDate?: Date | null }>,
    payments: Array<{ amount: number; status: PaymentStatus; paidAt?: Date | null; note?: string | null }>,
  ) {
    const confirmedPayments = (payments || []).filter((payment) => payment.status === PaymentStatus.CONFIRMED);
    const totalInvoiced = this.money((invoices || []).reduce((sum, invoice) => sum + this.invoiceAmount(invoice), 0));
    const totalPaid = this.money(confirmedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const now = new Date();
    const invoiceSummaries = (invoices || []).map((invoice) => {
      const paidForInvoice = confirmedPayments
        .filter((payment) => payment.note === this.invoicePaymentNote(invoice.id))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const remainingDebt = invoice.status === InvoiceStatus.PAID ? 0 : this.money(Math.max(this.invoiceAmount(invoice) - paidForInvoice, 0));
      return { ...invoice, paidForInvoice, remainingDebt };
    });
    const openInvoices = invoiceSummaries.filter((invoice) => invoice.remainingDebt > 0);
    const latestInvoice = [...(invoices || [])].sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || Number(b.month || 0) - Number(a.month || 0))[0];
    const latestPayment = [...confirmedPayments].sort((a, b) => Number(b.paidAt ? new Date(b.paidAt).getTime() : 0) - Number(a.paidAt ? new Date(a.paidAt).getTime() : 0))[0];

    return {
      totalInvoiced,
      totalPaid,
      debt: this.money(openInvoices.reduce((sum, invoice) => sum + invoice.remainingDebt, 0)),
      totalDebt: this.money(openInvoices.reduce((sum, invoice) => sum + invoice.remainingDebt, 0)),
      unpaidInvoices: openInvoices.length,
      unpaidInvoicesCount: openInvoices.length,
      overdueInvoicesCount: openInvoices.filter((invoice) => invoice.status === InvoiceStatus.OVERDUE || (invoice.dueDate ? invoice.dueDate < now : false)).length,
      lastPaymentDate: latestPayment?.paidAt ?? null,
      lastInvoiceMonth: latestInvoice?.month && latestInvoice?.year ? `${latestInvoice.month}/${latestInvoice.year}` : null,
    };
  }

  private toListApartment(apartment: any) {
    const invoiceSummary = this.summarizeInvoices(apartment.invoices || [], apartment.payments || []);
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
      financialSummary: {
        apartmentId: apartment.id,
        totalInvoiced: invoiceSummary.totalInvoiced,
        totalPaid: invoiceSummary.totalPaid,
        totalDebt: invoiceSummary.totalDebt,
        unpaidInvoicesCount: invoiceSummary.unpaidInvoicesCount,
        overdueInvoicesCount: invoiceSummary.overdueInvoicesCount,
        lastPaymentDate: invoiceSummary.lastPaymentDate,
        lastInvoiceMonth: invoiceSummary.lastInvoiceMonth,
      },
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

  private isSuperadmin(user: MvpUser) {
    return String(user.role).toUpperCase() === Role.SUPERADMIN;
  }

  private organizationWhere(user: MvpUser) {
    return this.isSuperadmin(user) ? {} : { organizationId: user.organizationId };
  }

  private assertOrganizationAccess(user: MvpUser, organizationId: string) {
    if (!this.isSuperadmin(user) && organizationId !== user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ORGANIZATION',
        message: 'Nu ai acces la aceste date.',
      });
    }
  }

  async listApartments(user: MvpUser) {
    const apartments = await this.prisma.apartment.findMany({
      where: this.organizationWhere(user),
      orderBy: [{ staircase: { name: 'asc' } }, { floor: 'asc' }, { number: 'asc' }],
      select: this.apartmentSelect(),
    });

    return apartments.map((apartment) => this.toListApartment(apartment));
  }

  async createApartment(user: MvpUser, body: unknown) {
    const input = this.parseCreateApartmentBody(body);
    if (!this.isSuperadmin(user)) {
      input.organizationId = user.organizationId;
    }
    this.assertOrganizationAccess(user, input.organizationId);

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

    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (!building) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (!staircase) throw new NotFoundException('Înregistrarea nu a fost găsită.');

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

  async bulkCreateApartments(user: MvpUser, body: unknown) {
    const input = this.parseBulkCreateApartmentBody(body);

    const building = await this.prisma.building.findFirst({
      where: {
        id: input.buildingId,
        ...(this.isSuperadmin(user) ? {} : { organizationId: user.organizationId }),
      },
      select: { id: true, organizationId: true },
    });
    if (!building) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    this.assertOrganizationAccess(user, building.organizationId);

    const staircase = await this.prisma.staircase.findFirst({
      where: {
        id: input.staircaseId,
        buildingId: building.id,
        organizationId: building.organizationId,
      },
      select: { id: true },
    });
    if (!staircase) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    const summary = {
      createdCount: 0,
      skippedCount: 0,
      errors: [] as Array<{ number: string; message: string }>,
      message: 'Apartamentele au fost create.',
    };

    for (let current = input.fromNumber; current <= input.toNumber; current += 1) {
      const apartmentNumber = String(current);
      const floor = input.floorStart + Math.floor((current - input.fromNumber) / input.apartmentsPerFloor);

      try {
        const duplicate = await this.prisma.apartment.findUnique({
          where: {
            staircaseId_number: {
              staircaseId: input.staircaseId,
              number: apartmentNumber,
            },
          },
          select: { id: true },
        });

        if (duplicate) {
          summary.skippedCount += 1;
          continue;
        }

        await this.prisma.apartment.create({
          data: {
            organizationId: building.organizationId,
            buildingId: input.buildingId,
            staircaseId: input.staircaseId,
            number: apartmentNumber,
            floor,
            areaM2: input.defaultAreaM2,
            rooms: input.defaultRooms,
            status: input.status,
          },
          select: { id: true },
        });
        summary.createdCount += 1;
      } catch (error) {
        summary.errors.push({
          number: apartmentNumber,
          message: error instanceof Error ? error.message : 'Nu am putut crea apartamentul.',
        });
      }
    }

    if (summary.createdCount > 0) {
      await this.syncBuildingCounters(input.buildingId);
    }

    return summary;
  }

  async linkResident(user: MvpUser, apartmentId: string, body: unknown) {
    const input = this.parseLinkResidentBody(body);

    const apartment = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      select: {
        id: true,
        organizationId: true,
      },
    });
    if (!apartment) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }
    this.assertOrganizationAccess(user, apartment.organizationId);

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
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
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

  async getApartment(user: MvpUser, id: string) {
    const apartment = await this.prisma.apartment.findFirst({
      where: {
        ...this.organizationWhere(user),
        OR: [{ id }, { number: id.replace(/^apt-/, '') }],
      },
      select: this.apartmentSelect(),
    });

    if (!apartment) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    return this.toDetailApartment(apartment);
  }

  async getFinancialSummary(user: MvpUser, id: string) {
    const apartment = await this.prisma.apartment.findFirst({
      where: {
        ...this.organizationWhere(user),
        OR: [{ id }, { number: id.replace(/^apt-/, '') }],
      },
      select: {
        id: true,
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
          select: {
            amount: true,
            status: true,
            paidAt: true,
            note: true,
          },
        },
      },
    });

    if (!apartment) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    const summary = this.summarizeInvoices(apartment.invoices || [], apartment.payments || []);
    return {
      apartmentId: apartment.id,
      totalInvoiced: summary.totalInvoiced,
      totalPaid: summary.totalPaid,
      totalDebt: summary.totalDebt,
      unpaidInvoicesCount: summary.unpaidInvoicesCount,
      overdueInvoicesCount: summary.overdueInvoicesCount,
      lastPaymentDate: summary.lastPaymentDate,
      lastInvoiceMonth: summary.lastInvoiceMonth,
    };
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

  private parseBulkCreateApartmentBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const buildingId = this.requiredString(payload.buildingId, 'Blocul este obligatoriu.');
    const staircaseId = this.requiredString(payload.staircaseId, 'Scara este obligatorie.');
    const fromNumber = Math.trunc(this.requiredNumber(payload.fromNumber, 'Numărul de început este obligatoriu.'));
    const toNumber = Math.trunc(this.requiredNumber(payload.toNumber, 'Numărul de final este obligatoriu.'));
    const floorStart = Math.trunc(this.requiredNumber(payload.floorStart, 'Etajul de start este obligatoriu.'));
    const apartmentsPerFloor = Math.trunc(this.requiredNumber(payload.apartmentsPerFloor, 'Numărul de apartamente pe etaj este obligatoriu.'));
    const defaultAreaM2 = this.requiredNumber(payload.defaultAreaM2, 'Suprafața implicită este obligatorie.');
    const defaultRooms = Math.trunc(this.optionalNumber(payload.defaultRooms) ?? 1);
    const status = this.optionalEnum(payload.status, ApartmentStatus, ApartmentStatus.ACTIVE, 'Statusul nu este valid.');

    if (fromNumber < 1 || toNumber < 1) {
      throw new BadRequestException('Numerele apartamentelor nu sunt valide.');
    }
    if (fromNumber > toNumber) {
      throw new BadRequestException('Numărul de început trebuie să fie mai mic sau egal cu numărul de final.');
    }
    if (toNumber - fromNumber + 1 > 300) {
      throw new BadRequestException('Poți crea maximum 300 de apartamente într-o operațiune.');
    }
    if (apartmentsPerFloor < 1) {
      throw new BadRequestException('Numărul de apartamente pe etaj trebuie să fie cel puțin 1.');
    }
    if (defaultAreaM2 <= 0) {
      throw new BadRequestException('Suprafața trebuie să fie un număr pozitiv.');
    }
    if (defaultRooms < 1) {
      throw new BadRequestException('Numărul de camere trebuie să fie cel puțin 1.');
    }

    return {
      buildingId,
      staircaseId,
      fromNumber,
      toNumber,
      floorStart,
      apartmentsPerFloor,
      defaultAreaM2,
      defaultRooms,
      status,
    };
  }

  private async syncBuildingCounters(buildingId: string) {
    const [staircasesCount, apartmentsCount] = await Promise.all([
      this.prisma.staircase.count({ where: { buildingId } }),
      this.prisma.apartment.count({ where: { buildingId } }),
    ]);
    await this.prisma.building.update({
      where: { id: buildingId },
      data: { staircasesCount, apartmentsCount },
    });
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
