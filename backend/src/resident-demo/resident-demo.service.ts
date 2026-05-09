import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InvoiceStatus,
  IssueCategory,
  IssueLocationType,
  IssuePriority,
  IssueStatus,
  MeterReadingSource,
  MeterStatus,
  NotificationType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import type { MvpUser } from '../security/mvp-auth.guard';

@Injectable()
export class ResidentDemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityMvpService,
  ) {}

  private apartmentSelect(): Prisma.ApartmentSelect {
    return {
      id: true,
      organizationId: true,
      number: true,
      floor: true,
      areaM2: true,
      rooms: true,
      status: true,
      building: { select: { id: true, name: true, address: true } },
      staircase: { select: { id: true, name: true } },
    };
  }

  private residentProfileSelect(): Prisma.ResidentProfileSelect {
    return {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      accountStatus: true,
      type: true,
      isPrimary: true,
      apartment: {
        select: this.apartmentSelect(),
      },
      apartmentResidents: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        select: {
          role: true,
          isPrimary: true,
          apartment: {
            select: this.apartmentSelect(),
          },
        },
      },
    };
  }

  private safeUser(user: MvpUser) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  private toResident(profile: any) {
    if (!profile) return null;
    return {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      name: this.fullName(profile),
      phone: profile.phone,
      email: profile.email,
      accountStatus: profile.accountStatus,
    };
  }

  private roleFromResidentType(type?: string | null) {
    if (type === 'OWNER' || type === 'TENANT' || type === 'RESIDENT') return type;
    return 'REPRESENTATIVE';
  }

  private addScopedApartment(
    map: Map<string, any>,
    apartment: any,
    profile: any,
    relationRole: string,
    isPrimary: boolean,
  ) {
    if (!apartment?.id) return;
    const existing = map.get(apartment.id);
    if (existing?.isPrimary && !isPrimary) return;
    map.set(apartment.id, {
      ...apartment,
      relationRole,
      isPrimary,
      resident: this.toResident(profile),
    });
  }

  private async getResidentScope(user: MvpUser) {
    const profiles = await this.prisma.residentProfile.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: this.residentProfileSelect(),
    });

    const apartmentsById = new Map<string, any>();
    for (const profile of profiles as any[]) {
      for (const relation of profile.apartmentResidents || []) {
        this.addScopedApartment(apartmentsById, relation.apartment, profile, String(relation.role), Boolean(relation.isPrimary));
      }
      if (profile.apartment) {
        this.addScopedApartment(
          apartmentsById,
          profile.apartment,
          profile,
          this.roleFromResidentType(profile.type),
          Boolean(profile.isPrimary),
        );
      }
    }

    const apartments = Array.from(apartmentsById.values()).sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return String(a.number).localeCompare(String(b.number), 'ro', { numeric: true });
    });
    const primaryApartment = apartments.find((apartment) => apartment.isPrimary) ?? apartments[0] ?? null;
    const primaryResident =
      primaryApartment?.resident ??
      this.toResident(profiles.find((profile) => profile.isPrimary) ?? profiles[0]) ??
      null;

    return {
      user: this.safeUser(user),
      resident: primaryResident,
      residentProfiles: profiles.map((profile) => this.toResident(profile)).filter(Boolean),
      apartments,
      apartmentIds: apartments.map((apartment) => apartment.id),
      primaryApartment,
    };
  }

  private async requireResidentScope(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    if (!scope.primaryApartment) {
      throw new ForbiddenException({
        code: 'RESIDENT_APARTMENT_NOT_LINKED',
        message: 'Contul tău nu este conectat încă la un apartament.',
      });
    }
    return scope;
  }

  private requireApartmentFromScope(scope: Awaited<ReturnType<ResidentDemoService['requireResidentScope']>>, apartmentId?: unknown) {
    if (typeof apartmentId === 'string' && apartmentId.trim()) {
      const requested = scope.apartments.find((apartment) => apartment.id === apartmentId.trim());
      if (!requested) {
        throw new ForbiddenException({
          code: 'FORBIDDEN_RESIDENT_SCOPE',
          message: 'Nu ai acces la aceste date.',
        });
      }
      return requested;
    }
    return scope.primaryApartment;
  }

  private async getResidentApartment(user: MvpUser) {
    const scope = await this.requireResidentScope(user);
    const apartment = this.requireApartmentFromScope(scope);
    return {
      ...apartment,
      apartmentResidents: [
        {
          role: apartment.relationRole,
          isPrimary: apartment.isPrimary,
          resident: apartment.resident,
        },
      ],
    };
  }

  private async requireResidentApartment(user: MvpUser) {
    return this.getResidentApartment(user);
  }

  private emptyResidentMessage() {
    return 'Contul tău nu este conectat încă la un apartament.';
  }

  private async organizationFromUser(user: MvpUser) {
    return this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
        name: true,
        legalName: true,
        fiscalCode: true,
        bankName: true,
        bankAccountIban: true,
        bankSwift: true,
        paymentInstructions: true,
        administratorName: true,
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
      note: true,
      createdAt: true,
      updatedAt: true,
      apartment: {
        select: {
          id: true,
          number: true,
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          month: true,
          year: true,
          totalDue: true,
          status: true,
          dueDate: true,
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

  private invoicePaymentNote(invoiceId: string) {
    return `Invoice ${invoiceId}`;
  }

  private money(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private invoiceAmount(row: { finalAmount?: number | null; amount?: number | null }) {
    return Number(row.finalAmount || row.amount || 0);
  }

  private confirmedPaymentTotal(payments: any[]) {
    return this.money(
      (payments || [])
        .filter((payment) => payment.status === PaymentStatus.CONFIRMED || String(payment.status).toUpperCase() === 'CONFIRMED')
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    );
  }

  private remainingDebtForInvoice(row: { status?: InvoiceStatus; finalAmount?: number | null; amount?: number | null }, payments: any[] = []) {
    if (row.status === InvoiceStatus.PAID) return 0;
    return this.money(Math.max(this.invoiceAmount(row) - this.confirmedPaymentTotal(payments), 0));
  }

  private toInvoice(row: any, relatedPayments: any[] = [], services: any[] = []) {
    const paidAmount = this.confirmedPaymentTotal(relatedPayments);
    const remainingAmount = this.remainingDebtForInvoice(row, relatedPayments);
    const status =
      row.status !== InvoiceStatus.PAID && remainingAmount > 0 && row.dueDate && new Date(row.dueDate) < new Date()
        ? InvoiceStatus.OVERDUE
        : row.status;
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      apartmentNumber: row.apartment?.number ?? null,
      apartment: row.apartment ?? null,
      month: row.month,
      year: row.year,
      amount: Number(row.finalAmount || row.amount || 0),
      originalAmount: Number(row.amount || 0),
      status,
      dueDate: row.dueDate,
      paidAt: row.paidAt,
      paidAmount,
      remainingAmount,
      remainingDebt: remainingAmount,
      payments: relatedPayments,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      services: services.map((service) => ({
        id: service.id,
        name: service.tariffName ?? service.name ?? 'Serviciu',
        tariffName: service.tariffName ?? service.name ?? 'Serviciu',
        amount: Number(service.amount || 0),
      })),
    };
  }

  private toPayment(row: any) {
    const noteInvoiceId =
      typeof row.note === 'string' && row.note.startsWith('Invoice ')
        ? row.note.replace('Invoice ', '').trim()
        : null;
    const linkedInvoice = row.invoice
      ? {
          id: row.invoice.id,
          invoiceNumber: row.invoice.invoiceNumber,
          month: row.invoice.month,
          year: row.invoice.year,
          totalDue: Number(row.invoice.totalDue || 0),
          status: row.invoice.status,
          dueDate: row.invoice.dueDate,
        }
      : null;
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      invoiceId: row.invoiceId ?? noteInvoiceId,
      invoiceNumber: linkedInvoice?.invoiceNumber ?? null,
      invoiceMonth: linkedInvoice?.month ?? null,
      invoiceYear: linkedInvoice?.year ?? null,
      invoice: linkedInvoice,
      apartmentNumber: row.apartment?.number ?? null,
      amount: Number(row.amount || 0),
      currency: row.currency,
      method: row.method,
      status: row.status,
      paidAt: row.paidAt ?? row.confirmedAt,
      month: row.month,
      note: row.note,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toPaymentInstructions(organization: any) {
    const bankName = organization?.bankName ?? null;
    const bankAccountIban = organization?.bankAccountIban ?? null;
    const bankSwift = organization?.bankSwift ?? null;
    const paymentInstructions = organization?.paymentInstructions ?? null;
    const administratorName = organization?.administratorName ?? null;
    return {
      bankName,
      bankAccountIban,
      bankSwift,
      paymentInstructions,
      administratorName,
      configured: Boolean(bankName || bankAccountIban || bankSwift || paymentInstructions),
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

  private toOrganizationIdentity(organization: any) {
    const associationCode = typeof organization?.fiscalCode === 'string' ? organization.fiscalCode : '';
    return {
      id: organization?.id ?? null,
      shortName: organization?.name || (associationCode ? `A.P.C. ${associationCode}` : 'A.P.C.'),
      legalName:
        organization?.legalName ||
        (associationCode ? `Asociația de Proprietari din Condominiu ${associationCode}` : 'Asociația de Proprietari din Condominiu'),
      associationCode: associationCode || null,
      associationNumber: associationCode.match(/-(\d{4})$/)?.[1] || null,
    };
  }

  private toPrimaryApartment(apartment: any) {
    if (!apartment) return null;
    return {
      id: apartment.id,
      number: apartment.number,
      staircase: apartment.staircase?.name ?? null,
      building: apartment.building?.name ?? null,
      floor: apartment.floor,
      areaM2: apartment.areaM2,
      rooms: apartment.rooms,
      relationRole: apartment.relationRole,
    };
  }

  private unpackDocumentMetadata(fileType?: string | null) {
    const parts = String(fileType || '').split(':');
    return {
      category: parts[1] || 'ALTUL',
      visibility: parts[2] || 'RESIDENT_VISIBLE',
    };
  }

  private toDocument(row: any) {
    const metadata = this.unpackDocumentMetadata(row.fileType);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: metadata.category,
      visibility: metadata.visibility,
      fileUrl: row.fileUrl,
      fileName: row.fileName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listInvoices(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    if (!scope.apartmentIds.length) return [];

    const invoices = await this.prisma.invoice.findMany({
      where: { apartmentId: { in: scope.apartmentIds } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      select: this.invoiceSelect(),
    });

    const notes = invoices.map((invoice) => this.invoicePaymentNote(invoice.id));
    const payments = notes.length
      ? await this.prisma.payment.findMany({
          where: {
            organizationId: user.organizationId,
            apartmentId: { in: scope.apartmentIds },
            note: { in: notes },
            status: PaymentStatus.CONFIRMED,
          },
          orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
          select: this.paymentSelect(),
        })
      : [];

    const chargeFilters = invoices
      .filter((invoice) => invoice.apartmentId && invoice.month && invoice.year)
      .map((invoice) => ({
        apartmentId: invoice.apartmentId as string,
        month: invoice.month as number,
        year: invoice.year as number,
      }));
    const charges = chargeFilters.length
      ? await this.prisma.monthlyCharge.findMany({
          where: {
            organizationId: user.organizationId,
            OR: chargeFilters,
          },
          orderBy: { tariffName: 'asc' },
        })
      : [];

    return invoices.map((invoice) => {
      const linkedPayments = payments.filter((payment) => payment.note === this.invoicePaymentNote(invoice.id)).map((payment) => this.toPayment(payment));
      const services = charges.filter((charge) => charge.apartmentId === invoice.apartmentId && charge.month === invoice.month && charge.year === invoice.year);
      return this.toInvoice(invoice, linkedPayments, services);
    });
  }

  async listPayments(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    if (!scope.apartmentIds.length) return [];

    const payments = await this.prisma.payment.findMany({
      where: { apartmentId: { in: scope.apartmentIds } },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      select: this.paymentSelect(),
    });

    return payments.map((payment) => this.toPayment(payment));
  }

  async getInvoice(user: MvpUser, id: string) {
    const scope = await this.requireResidentScope(user);
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        apartmentId: { in: scope.apartmentIds },
      },
      select: this.invoiceSelect(),
    });

    if (!invoice) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const [payments, services, organization] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          organizationId: user.organizationId,
          apartmentId: { in: scope.apartmentIds },
          status: PaymentStatus.CONFIRMED,
          OR: [{ note: this.invoicePaymentNote(invoice.id) }, { invoiceId: invoice.id }],
        },
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        select: this.paymentSelect(),
      }),
      invoice.apartmentId && invoice.month && invoice.year
        ? this.prisma.monthlyCharge.findMany({
            where: {
              organizationId: user.organizationId,
              apartmentId: invoice.apartmentId,
              month: invoice.month,
              year: invoice.year,
            },
            orderBy: { tariffName: 'asc' },
          })
        : Promise.resolve([]),
      this.organizationFromUser(user),
    ]);

    const mappedPayments = payments.map((payment) => this.toPayment(payment));
    const mappedInvoice = this.toInvoice(invoice, mappedPayments, services);
    return {
      ...mappedInvoice,
      lineItemsAvailable: mappedInvoice.services.length > 0,
      paymentInstructions: this.toPaymentInstructions(organization),
      organization,
    };
  }

  async listMeters(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    if (!scope.apartmentIds.length) return [];

    const meters = await this.prisma.meter.findMany({
      where: { apartmentId: { in: scope.apartmentIds } },
      orderBy: [{ apartment: { number: 'asc' } }, { type: 'asc' }],
      select: this.meterSelect(),
    });

    return meters.map((meter) => this.toMeter(meter));
  }

  async addMeterReading(user: MvpUser, meterId: string, body: unknown) {
    const scope = await this.requireResidentScope(user);

    const input = this.parseMeterReadingBody(body);
    const meter = await this.prisma.meter.findFirst({
      where: {
        id: meterId,
        apartmentId: { in: scope.apartmentIds },
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

    await this.activity.createActivity({
      organizationId: meter.organizationId,
      actorUserId: user.id,
      type: 'METER_READING_ADDED',
      title: 'Citire transmisă de locatar',
      message: `Locatarul a transmis o citire de ${input.value}.`,
      targetType: 'METER_READING',
      targetId: reading.id,
      link: '/admin/meters',
    });

    return reading;
  }

  async listIssues(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    if (!scope.apartmentIds.length) return [];

    const issues = await this.prisma.issue.findMany({
      where: { apartmentId: { in: scope.apartmentIds } },
      orderBy: { createdAt: 'desc' },
      select: this.issueSelect(),
    });

    return issues.map((issue) => this.toIssue(issue));
  }

  async createIssue(user: MvpUser, body: unknown) {
    const scope = await this.requireResidentScope(user);
    const input = this.parseCreateIssueBody(body);
    const apartment = this.requireApartmentFromScope(scope, input.apartmentId);

    const issue = await this.prisma.issue.create({
      data: {
        organizationId: apartment.organizationId,
        apartmentId: apartment.id,
        residentId: apartment.resident?.id ?? null,
        buildingId: apartment.building?.id,
        staircaseId: apartment.staircase?.id,
        createdByUserId: user.id,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        status: IssueStatus.NEW,
        locationType: IssueLocationType.APARTMENT,
      },
      select: this.issueSelect(),
    });

    await this.activity.createActivity({
      organizationId: issue.organizationId,
      actorUserId: user.id,
      type: 'ISSUE_CREATED',
      title: 'Cerere nouă',
      message: `Locatarul a trimis cererea „${issue.title}”.`,
      targetType: 'ISSUE',
      targetId: issue.id,
      link: `/admin/issues/${issue.id}`,
    });

    await this.activity.createNotification({
      organizationId: issue.organizationId,
      userId: user.id,
      type: NotificationType.ISSUE,
      title: 'Cererea a fost trimisă',
      message: `Cererea „${issue.title}” a fost înregistrată.`,
      link: `/resident/issues/${issue.id}`,
    });

    return this.toIssue(issue);
  }

  async listAnnouncements(user: MvpUser) {
    const announcements = await this.prisma.announcement.findMany({
      where: {
        organizationId: user.organizationId,
        status: 'ACTIVE',
      },
      orderBy: [{ createdAt: 'desc' }],
      select: this.announcementSelect(),
    });

    return announcements.map((announcement) => this.toAnnouncement(announcement));
  }

  async listResidentDocuments(user: MvpUser, take = 5) {
    const documents = await this.prisma.document.findMany({
      where: {
        organizationId: user.organizationId,
        fileType: { contains: ':RESIDENT_VISIBLE:' },
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        title: true,
        description: true,
        fileUrl: true,
        fileName: true,
        fileType: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return documents.map((document) => this.toDocument(document));
  }

  async getResidentHome(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    const organization = await this.organizationFromUser(user);

    if (!scope.apartmentIds.length) {
      return {
        resident: scope.resident,
        organization: this.toOrganizationIdentity(organization),
        apartments: [],
        primaryApartment: null,
        finance: {
          totalDebt: 0,
          unpaidInvoicesCount: 0,
          overdueInvoicesCount: 0,
          nextDueDate: null,
          lastPaymentDate: null,
          status: 'NO_APARTMENT',
        },
        meters: { total: 0, missingReadings: 0, latest: [] },
        issues: { activeCount: 0, latest: [] },
        announcements: { latest: [] },
        documents: { latest: [] },
        emptyStateMessage: this.emptyResidentMessage(),
      };
    }

    const [invoices, payments, meters, issues, announcements, documents] = await Promise.all([
      this.listInvoices(user),
      this.listPayments(user),
      this.listMeters(user),
      this.listIssues(user),
      this.listAnnouncements(user),
      this.listResidentDocuments(user, 5),
    ]);
    const openInvoices = invoices.filter((invoice) => Number(invoice.remainingAmount ?? invoice.amount ?? 0) > 0);
    const overdueInvoices = openInvoices.filter(
      (invoice) => invoice.status === InvoiceStatus.OVERDUE || (invoice.dueDate && new Date(invoice.dueDate) < new Date()),
    );
    const activeIssues = issues.filter((issue) => ![IssueStatus.RESOLVED, IssueStatus.CLOSED].includes(issue.status));
    const missingMeters = meters.filter((meter) => meter.status === MeterStatus.MISSING_READING || !meter.lastReading);
    const nextDueInvoice = [...openInvoices].sort((a, b) => {
      const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    })[0];
    const confirmedPayments = payments.filter(
      (payment) => payment.status === PaymentStatus.CONFIRMED || String(payment.status).toUpperCase() === 'CONFIRMED',
    );
    const lastPayment = [...confirmedPayments].sort((a, b) => {
      const left = a.paidAt ? new Date(a.paidAt).getTime() : 0;
      const right = b.paidAt ? new Date(b.paidAt).getTime() : 0;
      return right - left;
    })[0];
    const totalInvoiced = this.money(invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0));
    const totalPaid = this.confirmedPaymentTotal(payments);
    const totalDebt = this.money(Math.max(totalInvoiced - totalPaid, 0));

    return {
      resident: scope.resident
        ? {
            ...scope.resident,
            role: scope.primaryApartment?.relationRole ?? null,
          }
        : null,
      organization: this.toOrganizationIdentity(organization),
      apartments: scope.apartments.map((apartment) => this.toPrimaryApartment(apartment)),
      primaryApartment: this.toPrimaryApartment(scope.primaryApartment),
      finance: {
        totalDebt,
        unpaidInvoicesCount: openInvoices.length,
        overdueInvoicesCount: overdueInvoices.length,
        nextDueDate: nextDueInvoice?.dueDate ?? null,
        lastPaymentDate: lastPayment?.paidAt ?? lastPayment?.createdAt ?? null,
        status: overdueInvoices.length ? 'OVERDUE' : openInvoices.length ? 'UNPAID' : 'PAID',
      },
      meters: {
        total: meters.length,
        missingReadings: missingMeters.length,
        latest: meters.slice(0, 5),
      },
      issues: {
        activeCount: activeIssues.length,
        latest: activeIssues.slice(0, 5),
      },
      announcements: {
        latest: announcements.slice(0, 5),
      },
      documents: {
        latest: documents.slice(0, 5),
      },
      emptyStateMessage: null,
    };
  }

  async getResidentContext(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    const organization = await this.organizationFromUser(user);

    const [invoices, meters, issues, announcements] = await Promise.all([
      this.listInvoices(user),
      this.listMeters(user),
      this.listIssues(user),
      this.listAnnouncements(user),
    ]);
    const payments = await this.listPayments(user);
    const openInvoices = invoices.filter((invoice) => Number(invoice.remainingAmount ?? invoice.amount ?? 0) > 0);
    const overdueInvoices = openInvoices.filter((invoice) => invoice.status === InvoiceStatus.OVERDUE || (invoice.dueDate && new Date(invoice.dueDate) < new Date()));
    const activeIssues = issues.filter((issue) => issue.status !== IssueStatus.RESOLVED);
    const missingMeters = meters.filter((meter) => meter.status === MeterStatus.MISSING_READING || !meter.lastReading);
    const nextDueInvoice = [...openInvoices].sort((a, b) => {
      const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    })[0];
    const totalInvoiced = this.money(invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0));
    const totalPaid = this.confirmedPaymentTotal(payments);
    const totalDebt = this.money(Math.max(totalInvoiced - totalPaid, 0));

    return {
      user: scope.user,
      organization,
      resident: scope.resident,
      apartments: scope.apartments,
      primaryApartment: scope.primaryApartment,
      apartment: scope.primaryApartment,
      emptyStateMessage: scope.primaryApartment ? null : this.emptyResidentMessage(),
      balance: {
        current: totalDebt,
        totalInvoiced,
        totalPaid,
        unpaidInvoicesCount: openInvoices.length,
        overdueInvoicesCount: overdueInvoices.length,
        status: overdueInvoices.length ? 'OVERDUE' : openInvoices.length ? 'UNPAID' : 'PAID',
        nextDueDate: nextDueInvoice?.dueDate ?? invoices[0]?.dueDate ?? null,
      },
      latestAnnouncement: announcements[0] ?? null,
      meterReminder: {
        missingCount: missingMeters.length,
        totalCount: meters.length,
        updatedCount: meters.length - missingMeters.length,
        latestMissing: missingMeters[0] ?? null,
      },
      activeIssueSummary: {
        count: activeIssues.length,
        latest: activeIssues[0] ?? null,
      },
    };
  }

  async getFinanceSummary(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    const organization = await this.organizationFromUser(user);

    if (!scope.apartmentIds.length) {
      return {
        totalDebt: 0,
        totalUnpaid: 0,
        totalPaidThisYear: 0,
        unpaidInvoicesCount: 0,
        overdueInvoicesCount: 0,
        nextDueDate: null,
        lastPaymentDate: null,
        status: 'NO_APARTMENT',
        primaryApartment: null,
        organization,
        paymentInstructions: this.toPaymentInstructions(organization),
        emptyStateMessage: this.emptyResidentMessage(),
      };
    }

    const [invoices, payments] = await Promise.all([
      this.listInvoices(user),
      this.listPayments(user),
    ]);
    const openInvoices = invoices.filter((invoice) => Number(invoice.remainingAmount ?? invoice.amount ?? 0) > 0);
    const overdueInvoices = openInvoices.filter(
      (invoice) => invoice.status === InvoiceStatus.OVERDUE || (invoice.dueDate && new Date(invoice.dueDate) < new Date()),
    );
    const nextDueInvoice = [...openInvoices].sort((a, b) => {
      const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    })[0];
    const currentYear = new Date().getFullYear();
    const confirmedPayments = payments.filter(
      (payment) => payment.status === PaymentStatus.CONFIRMED || String(payment.status).toUpperCase() === 'CONFIRMED',
    );
    const totalPaidThisYear = this.money(
      confirmedPayments.reduce((sum, payment) => {
        const paidAt = payment.paidAt ?? payment.createdAt;
        if (!paidAt || new Date(paidAt).getFullYear() !== currentYear) return sum;
        return sum + Number(payment.amount || 0);
      }, 0),
    );
    const totalInvoiced = this.money(invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0));
    const totalPaid = this.confirmedPaymentTotal(payments);
    const lastPayment = [...confirmedPayments].sort((a, b) => {
      const left = a.paidAt ? new Date(a.paidAt).getTime() : 0;
      const right = b.paidAt ? new Date(b.paidAt).getTime() : 0;
      return right - left;
    })[0];
    const totalDebt = this.money(Math.max(totalInvoiced - totalPaid, 0));
    const primaryApartment = scope.primaryApartment
      ? {
          id: scope.primaryApartment.id,
          number: scope.primaryApartment.number,
          staircase: scope.primaryApartment.staircase?.name ?? null,
          building: scope.primaryApartment.building?.name ?? null,
        }
      : null;

    return {
      totalDebt,
      totalUnpaid: totalDebt,
      totalPaidThisYear,
      unpaidInvoicesCount: openInvoices.length,
      overdueInvoicesCount: overdueInvoices.length,
      nextDueDate: nextDueInvoice?.dueDate ?? null,
      lastPaymentDate: lastPayment?.paidAt ?? lastPayment?.createdAt ?? null,
      status: overdueInvoices.length ? 'OVERDUE' : openInvoices.length ? 'UNPAID' : 'PAID',
      primaryApartment,
      organization,
      paymentInstructions: this.toPaymentInstructions(organization),
    };
  }

  async getDemoContext(user: MvpUser) {
    return this.getResidentContext(user);
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
      apartmentId: typeof payload.apartmentId === 'string' ? payload.apartmentId : undefined,
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
