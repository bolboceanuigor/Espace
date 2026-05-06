import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, MeterStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private apartmentSelect(): Prisma.ApartmentSelect {
    return {
      id: true,
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
}
