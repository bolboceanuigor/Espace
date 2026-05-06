import { Injectable } from '@nestjs/common';
import { InvoiceStatus, IssueStatus, MeterStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEMO_APARTMENT_NUMBER = '45';

@Injectable()
export class ResidentDemoService {
  constructor(private readonly prisma: PrismaService) {}

  private async getDemoApartment() {
    return this.prisma.apartment.findFirst({
      where: { number: DEMO_APARTMENT_NUMBER },
      select: {
        id: true,
        organizationId: true,
        number: true,
        floor: true,
        areaM2: true,
        rooms: true,
        status: true,
        building: { select: { id: true, name: true, address: true } },
        staircase: { select: { id: true, name: true } },
        apartmentResidents: {
          orderBy: [{ isPrimary: 'desc' }],
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
              },
            },
          },
        },
      },
    });
  }

  private invoiceSelect(): Prisma.InvoiceSelect {
    return {
      id: true,
      organizationId: true,
      apartmentId: true,
      month: true,
      year: true,
      amount: true,
      finalAmount: true,
      status: true,
      dueDate: true,
      paidAt: true,
      createdAt: true,
      updatedAt: true,
      apartment: {
        select: {
          id: true,
          number: true,
          staircase: { select: { id: true, name: true } },
          building: { select: { id: true, name: true } },
        },
      },
    };
  }

  private paymentSelect(): Prisma.PaymentSelect {
    return {
      id: true,
      organizationId: true,
      apartmentId: true,
      invoiceId: true,
      amount: true,
      currency: true,
      method: true,
      status: true,
      paidAt: true,
      confirmedAt: true,
      month: true,
      createdAt: true,
      updatedAt: true,
      apartment: {
        select: {
          id: true,
          number: true,
        },
      },
    };
  }

  private meterSelect(): Prisma.MeterSelect {
    return {
      id: true,
      type: true,
      serialNumber: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      readings: {
        orderBy: { readingDate: 'desc' },
        take: 3,
        select: {
          id: true,
          value: true,
          readingDate: true,
          source: true,
          createdAt: true,
        },
      },
      apartment: {
        select: {
          id: true,
          number: true,
        },
      },
    };
  }

  private issueSelect(): Prisma.IssueSelect {
    return {
      id: true,
      organizationId: true,
      apartmentId: true,
      residentId: true,
      title: true,
      description: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      apartment: { select: { id: true, number: true } },
      resident: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
    };
  }

  private announcementSelect(): Prisma.AnnouncementSelect {
    return {
      id: true,
      organizationId: true,
      title: true,
      content: true,
      category: true,
      status: true,
      targetType: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  private fullName(person?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
    return `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || person?.email || null;
  }

  private toInvoice(row: any) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      apartmentNumber: row.apartment?.number ?? null,
      apartment: row.apartment ?? null,
      month: row.month,
      year: row.year,
      amount: Number(row.finalAmount || row.amount || 0),
      status: row.status,
      dueDate: row.dueDate,
      paidAt: row.paidAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      services: ['întreținere', 'fond reparații', 'apă', 'încălzire', 'curățenie', 'lift'],
    };
  }

  private toPayment(row: any) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      invoiceId: row.invoiceId,
      apartmentNumber: row.apartment?.number ?? null,
      amount: Number(row.amount || 0),
      currency: row.currency,
      method: row.method,
      status: row.status,
      paidAt: row.paidAt ?? row.confirmedAt,
      month: row.month,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toMeter(row: any) {
    const lastReading = row.readings?.[0] ?? null;
    return {
      id: row.id,
      apartmentId: row.apartment?.id ?? null,
      apartmentNumber: row.apartment?.number ?? null,
      type: row.type,
      serialNumber: row.serialNumber,
      status: row.status,
      lastReading,
      readings: row.readings || [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toIssue(row: any) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      apartmentNumber: row.apartment?.number ?? null,
      residentId: row.residentId,
      residentName: this.fullName(row.resident),
      title: row.title,
      description: row.description,
      preview: row.description?.length > 140 ? `${row.description.slice(0, 140).trim()}...` : row.description,
      category: row.category,
      priority: row.priority,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toAnnouncement(row: any) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      title: row.title,
      content: row.content,
      preview: row.content?.length > 140 ? `${row.content.slice(0, 140).trim()}...` : row.content,
      category: row.category,
      status: row.status,
      audience: row.targetType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listInvoices() {
    const apartment = await this.getDemoApartment();
    if (!apartment) return [];

    const invoices = await this.prisma.invoice.findMany({
      where: { apartmentId: apartment.id },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      select: this.invoiceSelect(),
    });

    return invoices.map((invoice) => this.toInvoice(invoice));
  }

  async listPayments() {
    const apartment = await this.getDemoApartment();
    if (!apartment) return [];

    const payments = await this.prisma.payment.findMany({
      where: { apartmentId: apartment.id },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      select: this.paymentSelect(),
    });

    return payments.map((payment) => this.toPayment(payment));
  }

  async listMeters() {
    const apartment = await this.getDemoApartment();
    if (!apartment) return [];

    const meters = await this.prisma.meter.findMany({
      where: { apartmentId: apartment.id },
      orderBy: { type: 'asc' },
      select: this.meterSelect(),
    });

    return meters.map((meter) => this.toMeter(meter));
  }

  async listIssues() {
    const apartment = await this.getDemoApartment();
    if (!apartment) return [];

    const issues = await this.prisma.issue.findMany({
      where: { apartmentId: apartment.id },
      orderBy: { createdAt: 'desc' },
      select: this.issueSelect(),
    });

    return issues.map((issue) => this.toIssue(issue));
  }

  async listAnnouncements() {
    const apartment = await this.getDemoApartment();
    if (!apartment) return [];

    const announcements = await this.prisma.announcement.findMany({
      where: {
        organizationId: apartment.organizationId,
        status: 'ACTIVE',
      },
      orderBy: [{ createdAt: 'desc' }],
      select: this.announcementSelect(),
    });

    return announcements.map((announcement) => this.toAnnouncement(announcement));
  }

  async getDemoContext() {
    const apartment = await this.getDemoApartment();
    if (!apartment) {
      return {
        resident: null,
        apartment: null,
        balance: { current: 0, status: 'UNPAID', nextDueDate: null },
        latestAnnouncement: null,
        meterReminder: { missingCount: 0 },
        activeIssueSummary: { count: 0, latest: null },
      };
    }

    const [invoices, meters, issues, announcements] = await Promise.all([
      this.listInvoices(),
      this.listMeters(),
      this.listIssues(),
      this.listAnnouncements(),
    ]);
    const residentRelation = apartment.apartmentResidents?.[0];
    const openInvoices = invoices.filter((invoice) => invoice.status === InvoiceStatus.UNPAID || invoice.status === InvoiceStatus.OVERDUE);
    const activeIssues = issues.filter((issue) => issue.status !== IssueStatus.RESOLVED);
    const missingMeters = meters.filter((meter) => meter.status === MeterStatus.MISSING_READING || !meter.lastReading);

    return {
      resident: residentRelation?.resident
        ? {
            id: residentRelation.resident.id,
            name: this.fullName(residentRelation.resident),
            phone: residentRelation.resident.phone,
            email: residentRelation.resident.email,
            role: residentRelation.role,
            accountStatus: residentRelation.resident.accountStatus,
          }
        : null,
      apartment: {
        id: apartment.id,
        number: apartment.number,
        floor: apartment.floor,
        areaM2: apartment.areaM2,
        rooms: apartment.rooms,
        status: apartment.status,
        building: apartment.building,
        staircase: apartment.staircase,
      },
      balance: {
        current: openInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
        status: openInvoices.some((invoice) => invoice.status === InvoiceStatus.OVERDUE) ? 'OVERDUE' : openInvoices.length ? 'UNPAID' : 'PAID',
        nextDueDate: openInvoices[0]?.dueDate ?? invoices[0]?.dueDate ?? null,
      },
      latestAnnouncement: announcements[0] ?? null,
      meterReminder: {
        missingCount: missingMeters.length,
        latestMissing: missingMeters[0] ?? null,
      },
      activeIssueSummary: {
        count: activeIssues.length,
        latest: activeIssues[0] ?? null,
      },
    };
  }
}
