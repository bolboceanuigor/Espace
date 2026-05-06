import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InvoiceStatus,
  IssueCategory,
  IssueLocationType,
  IssuePriority,
  IssueStatus,
  MeterReadingSource,
  MeterStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

@Injectable()
export class ResidentDemoService {
  constructor(private readonly prisma: PrismaService) {}

  private async getResidentApartment(user: MvpUser) {
    return this.prisma.apartment.findFirst({
      where: {
        organizationId: user.organizationId,
        apartmentResidents: {
          some: {
            resident: {
              userId: user.id,
            },
          },
        },
      },
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
                userId: true,
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

  private async requireResidentApartment(user: MvpUser) {
    const apartment = await this.getResidentApartment(user);
    if (!apartment) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_RESIDENT_SCOPE',
        message: 'Nu ai acces la aceste date.',
      });
    }
    return apartment;
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

  async listInvoices(user: MvpUser) {
    const apartment = await this.requireResidentApartment(user);

    const invoices = await this.prisma.invoice.findMany({
      where: { apartmentId: apartment.id },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      select: this.invoiceSelect(),
    });

    return invoices.map((invoice) => this.toInvoice(invoice));
  }

  async listPayments(user: MvpUser) {
    const apartment = await this.requireResidentApartment(user);

    const payments = await this.prisma.payment.findMany({
      where: { apartmentId: apartment.id },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      select: this.paymentSelect(),
    });

    return payments.map((payment) => this.toPayment(payment));
  }

  async listMeters(user: MvpUser) {
    const apartment = await this.requireResidentApartment(user);

    const meters = await this.prisma.meter.findMany({
      where: { apartmentId: apartment.id },
      orderBy: { type: 'asc' },
      select: this.meterSelect(),
    });

    return meters.map((meter) => this.toMeter(meter));
  }

  async addMeterReading(user: MvpUser, meterId: string, body: unknown) {
    const apartment = await this.requireResidentApartment(user);

    const input = this.parseMeterReadingBody(body);
    const meter = await this.prisma.meter.findFirst({
      where: {
        id: meterId,
        apartmentId: apartment.id,
      },
      select: {
        id: true,
        apartmentId: true,
        organizationId: true,
      },
    });

    if (!meter) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const reading = await this.prisma.meterReading.create({
      data: {
        meterId: meter.id,
        apartmentId: meter.apartmentId,
        organizationId: meter.organizationId,
        value: input.value,
        readingDate: input.readingDate,
        source: MeterReadingSource.RESIDENT,
      },
      select: {
        id: true,
        meterId: true,
        apartmentId: true,
        organizationId: true,
        value: true,
        readingDate: true,
        source: true,
        createdAt: true,
      },
    });

    await this.prisma.meter.update({
      where: { id: meter.id },
      data: { status: MeterStatus.ACTIVE },
    });

    return reading;
  }

  async listIssues(user: MvpUser) {
    const apartment = await this.requireResidentApartment(user);

    const issues = await this.prisma.issue.findMany({
      where: { apartmentId: apartment.id },
      orderBy: { createdAt: 'desc' },
      select: this.issueSelect(),
    });

    return issues.map((issue) => this.toIssue(issue));
  }

  async createIssue(user: MvpUser, body: unknown) {
    const apartment = await this.requireResidentApartment(user);

    const input = this.parseCreateIssueBody(body);
    const residentRelation = apartment.apartmentResidents?.[0] ?? null;
    const createdByUserId = await this.resolveDemoCreatedByUserId(apartment.organizationId, residentRelation?.resident?.userId);

    const issue = await this.prisma.issue.create({
      data: {
        organizationId: apartment.organizationId,
        apartmentId: apartment.id,
        residentId: residentRelation?.resident?.id ?? null,
        buildingId: apartment.building?.id,
        staircaseId: apartment.staircase?.id,
        createdByUserId,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        status: IssueStatus.NEW,
        locationType: IssueLocationType.APARTMENT,
      },
      select: this.issueSelect(),
    });

    return this.toIssue(issue);
  }

  async listAnnouncements(user: MvpUser) {
    const apartment = await this.requireResidentApartment(user);

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

  async getDemoContext(user: MvpUser) {
    const apartment = await this.requireResidentApartment(user);

    const [invoices, meters, issues, announcements] = await Promise.all([
      this.listInvoices(user),
      this.listMeters(user),
      this.listIssues(user),
      this.listAnnouncements(user),
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

  private async resolveDemoCreatedByUserId(organizationId: string, residentUserId?: string | null) {
    if (residentUserId) return residentUserId;
    const user = await this.prisma.user.findFirst({
      where: { organizationId },
      orderBy: [
        { role: 'desc' },
        { createdAt: 'asc' },
      ],
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user.id;
  }

  private parseMeterReadingBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const value = this.requiredNumber(payload.value, 'Valoarea citirii este obligatorie.');
    const readingDate =
      typeof payload.readingDate === 'string' && payload.readingDate.trim()
        ? this.requiredDate(payload.readingDate, 'Data citirii nu este validă.')
        : new Date();
    if (payload.source && String(payload.source).toUpperCase() !== MeterReadingSource.RESIDENT) {
      throw new BadRequestException('Sursa citirii trebuie să fie RESIDENT.');
    }
    return { value, readingDate };
  }

  private parseCreateIssueBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    return {
      title: this.requiredString(payload.title, 'Titlul este obligatoriu.'),
      description: this.requiredString(payload.description, 'Descrierea este obligatorie.'),
      category: this.optionalEnum(payload.category, IssueCategory, IssueCategory.OTHER, 'Categoria cererii nu este validă.'),
      priority: this.optionalEnum(payload.priority, IssuePriority, IssuePriority.NORMAL, 'Prioritatea cererii nu este validă.'),
    };
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(message);
    return value.trim();
  }

  private requiredNumber(value: unknown, message: string) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException(message);
    return parsed;
  }

  private requiredDate(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(message);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException(message);
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
