import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApartmentResidentRole,
  ApartmentStatus,
  InvoiceStatus,
  MeterStatus,
  NotificationType,
  PaymentStatus,
  Prisma,
  ResidentAccountStatus,
  ResidentType,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import type { MvpUser } from '../security/mvp-auth.guard';

@Injectable()
export class ApartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityMvpService,
  ) {}

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
    const totalDebt = this.money(Math.max(totalInvoiced - totalPaid, 0));
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
      debt: totalDebt,
      totalDebt,
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

  private adminOrganizationId(user: MvpUser, payload?: Record<string, unknown>) {
    if (!this.isSuperadmin(user)) return user.organizationId;
    const requested = typeof payload?.organizationId === 'string' && payload.organizationId.trim() ? payload.organizationId.trim() : user.organizationId;
    if (!requested) throw new BadRequestException('Asociația este obligatorie.');
    return requested;
  }

  async listAdminApartments(user: MvpUser, query: Record<string, string | undefined> = {}) {
    const organizationId = this.adminOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        legalName: true,
        fiscalCode: true,
      },
    });
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const apartments = await this.prisma.apartment.findMany({
      where: { organizationId },
      orderBy: [{ staircase: { name: 'asc' } }, { floor: 'asc' }, { number: 'asc' }],
      select: this.apartmentSelect(),
    });
    const metadata = await this.readApartmentMetadata(organizationId);
    let items = apartments.map((apartment) => this.toAdminApartmentRow(apartment, metadata));

    items = this.filterAdminApartmentRows(items, query);
    items = this.sortAdminApartmentRows(items, query.sortBy, query.sortDirection);

    const page = Math.max(1, Math.trunc(Number(query.page || 1)));
    const limit = Math.min(100, Math.max(1, Math.trunc(Number(query.limit || 20))));
    const total = items.length;
    const start = (page - 1) * limit;

    return {
      organization: {
        id: organization.id,
        shortName: organization.name,
        legalName: organization.legalName || organization.name,
        associationCode: organization.fiscalCode || '',
      },
      items: items.slice(start, start + limit),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: this.adminApartmentStats(apartments.map((apartment) => this.toAdminApartmentRow(apartment, metadata))),
      filters: {
        staircases: Array.from(new Set(apartments.map((apartment) => String(apartment.staircase?.name || '')).filter(Boolean))).sort(),
        floors: Array.from(new Set(apartments.map((apartment) => apartment.floor).filter((floor) => floor !== null && floor !== undefined).map(String))).sort((a, b) => Number(a) - Number(b)),
      },
    };
  }

  async getAdminApartment(user: MvpUser, id: string) {
    const apartment = await this.prisma.apartment.findFirst({
      where: {
        ...this.organizationWhere(user),
        id,
      },
      select: this.apartmentSelect(),
    });
    if (!apartment) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const metadata = await this.readApartmentMetadata(apartment.organizationId);
    return this.toAdminApartmentDetail(apartment, metadata);
  }

  async createAdminApartment(user: MvpUser, body: unknown) {
    const payload = this.payload(body);
    const organizationId = this.adminOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    await this.assertOrganizationExists(organizationId);
    const input = await this.parseAdminApartmentBody(organizationId, payload);

    const duplicate = await this.prisma.apartment.findUnique({
      where: {
        staircaseId_number: {
          staircaseId: input.staircaseId,
          number: input.number,
        },
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Acest apartament există deja.');

    const apartment = await this.prisma.apartment.create({
      data: {
        organizationId,
        buildingId: input.buildingId,
        staircaseId: input.staircaseId,
        number: input.number,
        floor: input.floor,
        areaM2: input.areaM2,
        rooms: input.rooms,
        status: input.status,
      },
      select: this.apartmentSelect(),
    });
    await this.updateApartmentMetadata(organizationId, user.id, {
      [apartment.id]: {
        cadastralNumber: input.cadastralNumber,
        internalNotes: input.internalNotes,
      },
    });
    await this.syncBuildingCounters(input.buildingId);

    await this.activity.createActivity({
      organizationId,
      actorUserId: user.id,
      type: 'APARTMENT_CREATED',
      title: 'Apartament creat',
      message: `Apartamentul ${apartment.number} a fost creat.`,
      targetType: 'APARTMENT',
      targetId: apartment.id,
      link: `/admin/apartments/${apartment.id}`,
    });

    const metadata = await this.readApartmentMetadata(organizationId);
    return this.toAdminApartmentDetail(apartment, metadata);
  }

  async updateAdminApartment(user: MvpUser, id: string, body: unknown) {
    const payload = this.payload(body);
    const existing = await this.prisma.apartment.findFirst({
      where: {
        ...this.organizationWhere(user),
        id,
      },
      select: {
        id: true,
        organizationId: true,
        buildingId: true,
      },
    });
    if (!existing) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertOrganizationAccess(user, existing.organizationId);

    const input = await this.parseAdminApartmentBody(existing.organizationId, payload, true);
    const duplicate = await this.prisma.apartment.findFirst({
      where: {
        id: { not: id },
        staircaseId: input.staircaseId,
        number: input.number,
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Acest apartament există deja.');

    const apartment = await this.prisma.apartment.update({
      where: { id },
      data: {
        buildingId: input.buildingId,
        staircaseId: input.staircaseId,
        number: input.number,
        floor: input.floor,
        areaM2: input.areaM2,
        rooms: input.rooms,
        status: input.status,
      },
      select: this.apartmentSelect(),
    });
    await this.updateApartmentMetadata(existing.organizationId, user.id, {
      [id]: {
        cadastralNumber: input.cadastralNumber,
        internalNotes: input.internalNotes,
      },
    });
    await Promise.all(Array.from(new Set([existing.buildingId, input.buildingId])).map((buildingId) => this.syncBuildingCounters(buildingId)));

    await this.activity.createActivity({
      organizationId: apartment.organizationId,
      actorUserId: user.id,
      type: 'APARTMENT_CREATED',
      title: 'Apartament actualizat',
      message: `Apartamentul ${apartment.number} a fost actualizat.`,
      targetType: 'APARTMENT',
      targetId: apartment.id,
      link: `/admin/apartments/${apartment.id}`,
    });

    const metadata = await this.readApartmentMetadata(existing.organizationId);
    return this.toAdminApartmentDetail(apartment, metadata);
  }

  async linkOrCreateAdminResident(user: MvpUser, apartmentId: string, body: unknown) {
    const payload = this.payload(body);
    const apartment = await this.prisma.apartment.findFirst({
      where: {
        ...this.organizationWhere(user),
        id: apartmentId,
      },
      select: { id: true, organizationId: true, number: true },
    });
    if (!apartment) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertOrganizationAccess(user, apartment.organizationId);

    const input = this.parseAdminResidentLinkBody(payload);
    const resident = await this.findOrCreateApartmentResident(apartment.organizationId, apartmentId, input);

    const existingRelation = await this.prisma.apartmentResident.findFirst({
      where: {
        apartmentId,
        residentId: resident.id,
        role: input.role,
      },
      select: { apartmentId: true, residentId: true, role: true },
    });

    if (input.isPrimaryContact) {
      await this.prisma.apartmentResident.updateMany({
        where: { apartmentId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    if (existingRelation) {
      await this.prisma.apartmentResident.update({
        where: {
          apartmentId_residentId_role: {
            apartmentId,
            residentId: resident.id,
            role: input.role,
          },
        },
        data: { isPrimary: input.isPrimaryContact },
      });
    } else {
      await this.prisma.apartmentResident.create({
        data: {
          apartmentId,
          residentId: resident.id,
          role: input.role,
          isPrimary: input.isPrimaryContact,
        },
      });
    }

    if (input.isPrimaryContact) {
      await this.prisma.apartment.update({
        where: { id: apartmentId },
        data: { ownerResidentId: resident.id, status: ApartmentStatus.OCCUPIED },
      });
    }

    await this.updateApartmentMetadata(apartment.organizationId, user.id, {
      [apartmentId]: {
        residentContactMethods: {
          [`${resident.id}:${input.role}`]: input.preferredContactMethod,
        },
      },
    });

    await this.activity.createActivity({
      organizationId: apartment.organizationId,
      actorUserId: user.id,
      type: 'RESIDENT_LINKED',
      title: 'Locatar conectat',
      message: `${this.formatResidentName(resident)} a fost conectat la apartamentul ${apartment.number}.`,
      targetType: 'APARTMENT',
      targetId: apartmentId,
      link: `/admin/apartments/${apartmentId}`,
    });

    return this.getAdminApartment(user, apartmentId);
  }

  async setPrimaryContact(user: MvpUser, apartmentId: string, body: unknown) {
    const payload = this.payload(body);
    const residentId = this.requiredString(payload.residentId, 'Locatarul este obligatoriu.');
    const apartment = await this.prisma.apartment.findFirst({
      where: {
        ...this.organizationWhere(user),
        id: apartmentId,
      },
      select: { id: true, organizationId: true },
    });
    if (!apartment) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertOrganizationAccess(user, apartment.organizationId);

    const relation = await this.prisma.apartmentResident.findFirst({
      where: {
        apartmentId,
        residentId,
      },
      select: { apartmentId: true, residentId: true, role: true },
    });
    if (!relation) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    await this.prisma.apartmentResident.updateMany({
      where: { apartmentId, isPrimary: true },
      data: { isPrimary: false },
    });
    await this.prisma.apartmentResident.update({
      where: {
        apartmentId_residentId_role: {
          apartmentId,
          residentId,
          role: relation.role,
        },
      },
      data: { isPrimary: true },
    });
    await this.prisma.apartment.update({
      where: { id: apartmentId },
      data: { ownerResidentId: residentId, status: ApartmentStatus.OCCUPIED },
    });

    return this.getAdminApartment(user, apartmentId);
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

    await this.activity.createActivity({
      organizationId: apartment.organizationId,
      actorUserId: user.id,
      type: 'APARTMENT_CREATED',
      title: 'Apartament creat',
      message: `Apartamentul ${apartment.number} a fost creat.`,
      targetType: 'APARTMENT',
      targetId: apartment.id,
      link: `/admin/apartments/${apartment.id}`,
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
      await this.activity.createActivity({
        organizationId: building.organizationId,
        actorUserId: user.id,
        type: 'APARTMENT_CREATED',
        title: 'Apartamente create în masă',
        message: `${summary.createdCount} apartamente au fost create în masă. ${summary.skippedCount} au fost omise.`,
        targetType: 'APARTMENT',
        link: '/admin/apartments',
      });
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
      throw new ConflictException('Acest locatar este deja conectat la apartament.');
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
            userId: true,
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

    await this.activity.createActivity({
      organizationId: relation.apartment.organizationId,
      actorUserId: user.id,
      type: 'RESIDENT_LINKED',
      title: 'Locatar conectat',
      message: `${this.formatResidentName(relation.resident)} a fost conectat la apartamentul ${relation.apartment.number}.`,
      targetType: 'APARTMENT',
      targetId: apartmentId,
      link: `/admin/apartments/${apartmentId}`,
    });

    if (relation.resident.userId) {
      await this.activity.createNotification({
        organizationId: relation.apartment.organizationId,
        userId: relation.resident.userId,
        type: NotificationType.SYSTEM,
        title: 'Apartament conectat',
        message: `Contul tău a fost conectat la apartamentul ${relation.apartment.number}.`,
        link: '/resident/account',
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
    const buildingId = this.requiredString(payload.buildingId, 'Blocul este obligatoriu.');
    const staircaseId = this.requiredString(payload.staircaseId, 'Scara este obligatorie.');
    const number = this.requiredString(payload.number, 'Numărul apartamentului este obligatoriu.');
    const floor = this.requiredNumber(payload.floor, 'Etajul trebuie să fie un număr.');
    const areaM2 = this.requiredNumber(payload.areaM2, 'Suprafața trebuie să fie mai mare decât 0.');
    const rooms = this.optionalNumber(payload.rooms);
    const status = this.optionalEnum(payload.status, ApartmentStatus, ApartmentStatus.ACTIVE, 'Statusul nu este valid.');

    if (areaM2 <= 0) throw new BadRequestException('Suprafața trebuie să fie mai mare decât 0.');
    if (rooms !== null && rooms !== undefined && rooms <= 0) throw new BadRequestException('Numărul de camere trebuie să fie pozitiv.');

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
      throw new BadRequestException('Suprafața trebuie să fie mai mare decât 0.');
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

  private payload(body: unknown): Record<string, any> {
    return body && typeof body === 'object' ? (body as Record<string, any>) : {};
  }

  private async assertOrganizationExists(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
  }

  private toAdminStatus(status: ApartmentStatus) {
    if (status === ApartmentStatus.EMPTY) return 'VACANT';
    if (status === ApartmentStatus.OCCUPIED) return 'OCCUPIED';
    return 'UNKNOWN';
  }

  private fromAdminStatus(value: unknown) {
    const status = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!status || status === 'UNKNOWN' || status === 'ACTIVE') return ApartmentStatus.ACTIVE;
    if (status === 'VACANT' || status === 'EMPTY') return ApartmentStatus.EMPTY;
    if (status === 'OCCUPIED') return ApartmentStatus.OCCUPIED;
    if (Object.values(ApartmentStatus).includes(status as ApartmentStatus)) return status as ApartmentStatus;
    throw new BadRequestException('Statusul apartamentului nu este valid.');
  }

  private completenessStatus(row: { primaryContact: unknown; areaM2: number | null | undefined }) {
    const noContact = !row.primaryContact;
    const noArea = !row.areaM2 || Number(row.areaM2) <= 0;
    if (noContact && noArea) return 'INCOMPLETE';
    if (noContact) return 'NO_CONTACT';
    if (noArea) return 'NO_AREA';
    return 'COMPLETE';
  }

  private toAdminApartmentRow(apartment: any, metadata: Record<string, any>) {
    const primaryRelation = apartment.apartmentResidents?.find((item) => item.isPrimary);
    const primaryResident = apartment.ownerResident || primaryRelation?.resident || null;
    const rowMetadata = metadata[apartment.id] || {};
    const primaryContact = primaryResident
      ? {
          id: primaryResident.id,
          fullName: this.formatResidentName(primaryResident) || 'Contact principal',
          phone: primaryResident.phone || '',
          email: primaryResident.email || '',
        }
      : null;
    const row = {
      id: apartment.id,
      apartmentNumber: apartment.number,
      number: apartment.number,
      organizationId: apartment.organizationId,
      buildingId: apartment.buildingId,
      buildingName: apartment.building?.name || '',
      staircaseId: apartment.staircaseId,
      staircase: apartment.staircase?.name || '',
      floor: apartment.floor === null || apartment.floor === undefined ? '' : String(apartment.floor),
      areaM2: apartment.areaM2 === null || apartment.areaM2 === undefined ? null : Number(apartment.areaM2),
      rooms: apartment.rooms === null || apartment.rooms === undefined ? null : Number(apartment.rooms),
      cadastralNumber: rowMetadata.cadastralNumber || '',
      status: this.toAdminStatus(apartment.status),
      primaryContact,
      residentsCount: apartment._count?.apartmentResidents ?? apartment.apartmentResidents?.length ?? 0,
      completenessStatus: '',
      updatedAt: apartment.updatedAt,
    };
    return {
      ...row,
      completenessStatus: this.completenessStatus(row),
    };
  }

  private toAdminApartmentDetail(apartment: any, metadata: Record<string, any>) {
    const base = this.toAdminApartmentRow(apartment, metadata);
    const rowMetadata = metadata[apartment.id] || {};
    return {
      ...base,
      internalNotes: rowMetadata.internalNotes || '',
      residents: (apartment.apartmentResidents || []).map((item) => ({
        id: item.resident.id,
        residentId: item.resident.id,
        fullName: this.formatResidentName(item.resident) || 'Locatar',
        phone: item.resident.phone || '',
        email: item.resident.email || '',
        role: item.role,
        isPrimaryContact: Boolean(item.isPrimary),
        accountStatus: item.resident.accountStatus,
        preferredContactMethod: rowMetadata.residentContactMethods?.[`${item.resident.id}:${item.role}`] || 'PHONE',
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
      activity: [
        { label: 'Creat', date: apartment.createdAt },
        { label: 'Actualizat', date: apartment.updatedAt },
      ],
    };
  }

  private filterAdminApartmentRows(rows: any[], query: Record<string, string | undefined>) {
    const search = String(query.search || '').trim().toLowerCase();
    const staircase = String(query.staircase || '').trim();
    const floor = String(query.floor || '').trim();
    const status = String(query.status || '').trim().toUpperCase();
    const hasPrimaryContact = String(query.hasPrimaryContact || '').trim();
    const hasArea = String(query.hasArea || '').trim();

    return rows.filter((row) => {
      const matchesSearch =
        !search ||
        [
          row.apartmentNumber,
          row.cadastralNumber,
          row.primaryContact?.fullName,
          row.primaryContact?.phone,
          row.primaryContact?.email,
        ]
          .join(' ')
          .toLowerCase()
          .includes(search);
      const matchesStaircase = !staircase || staircase === 'ALL' || row.staircase === staircase;
      const matchesFloor = !floor || floor === 'ALL' || String(row.floor) === floor;
      const matchesStatus = !status || status === 'ALL' || row.status === status;
      const matchesContact =
        !hasPrimaryContact ||
        hasPrimaryContact === 'ALL' ||
        (hasPrimaryContact === 'true' ? Boolean(row.primaryContact) : !row.primaryContact);
      const matchesArea =
        !hasArea ||
        hasArea === 'ALL' ||
        (hasArea === 'true' ? Boolean(row.areaM2 && row.areaM2 > 0) : !row.areaM2 || row.areaM2 <= 0);
      return matchesSearch && matchesStaircase && matchesFloor && matchesStatus && matchesContact && matchesArea;
    });
  }

  private sortAdminApartmentRows(rows: any[], sortBy?: string, sortDirection?: string) {
    const direction = String(sortDirection || 'asc').toLowerCase() === 'desc' ? -1 : 1;
    const key = String(sortBy || 'apartmentNumber');
    return [...rows].sort((a, b) => {
      if (key === 'areaM2') return ((Number(a.areaM2 || 0) - Number(b.areaM2 || 0)) * direction);
      if (key === 'floor') return ((Number(a.floor || 0) - Number(b.floor || 0)) * direction);
      if (key === 'staircase') return String(a.staircase || '').localeCompare(String(b.staircase || ''), 'ro') * direction;
      const aNumber = Number(a.apartmentNumber);
      const bNumber = Number(b.apartmentNumber);
      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return (aNumber - bNumber) * direction;
      return String(a.apartmentNumber || '').localeCompare(String(b.apartmentNumber || ''), 'ro', { numeric: true }) * direction;
    });
  }

  private adminApartmentStats(rows: any[]) {
    return {
      totalApartments: rows.length,
      totalAreaM2: this.money(rows.reduce((sum, row) => sum + Number(row.areaM2 || 0), 0)),
      withPrimaryContact: rows.filter((row) => Boolean(row.primaryContact)).length,
      withoutPrimaryContact: rows.filter((row) => !row.primaryContact).length,
      withoutArea: rows.filter((row) => !row.areaM2 || Number(row.areaM2) <= 0).length,
      occupied: rows.filter((row) => row.status === 'OCCUPIED').length,
      vacant: rows.filter((row) => row.status === 'VACANT').length,
      unknown: rows.filter((row) => row.status === 'UNKNOWN').length,
    };
  }

  private async parseAdminApartmentBody(organizationId: string, payload: Record<string, unknown>, isUpdate = false) {
    const number = this.requiredString(payload.apartmentNumber ?? payload.number, 'Numărul apartamentului este obligatoriu.');
    const structure = await this.resolveApartmentStructure(organizationId, payload);
    const rawFloor = payload.floor;
    const floor = rawFloor === undefined || rawFloor === null || rawFloor === '' ? null : Math.trunc(this.requiredNumber(rawFloor, 'Etajul trebuie să fie un număr.'));
    const rawArea = payload.areaM2;
    const areaM2 = rawArea === undefined || rawArea === null || rawArea === '' ? null : this.requiredNumber(rawArea, 'Suprafața trebuie să fie un număr pozitiv.');
    if (areaM2 !== null && areaM2 <= 0) throw new BadRequestException('Suprafața trebuie să fie mai mare decât 0.');
    const roomsRaw = payload.rooms;
    const rooms = roomsRaw === undefined || roomsRaw === null || roomsRaw === '' ? null : Math.trunc(this.requiredNumber(roomsRaw, 'Numărul de camere trebuie să fie pozitiv.'));
    if (rooms !== null && rooms <= 0) throw new BadRequestException('Numărul de camere trebuie să fie pozitiv.');

    if (!structure.buildingId || !structure.staircaseId) {
      throw new BadRequestException(isUpdate ? 'Blocul și scara sunt obligatorii.' : 'Nu permite crearea apartamentului fără asociație și structură.');
    }

    return {
      number,
      buildingId: structure.buildingId,
      staircaseId: structure.staircaseId,
      floor,
      areaM2,
      rooms,
      status: this.fromAdminStatus(payload.status),
      cadastralNumber: typeof payload.cadastralNumber === 'string' ? payload.cadastralNumber.trim() : '',
      internalNotes: typeof payload.internalNotes === 'string' ? payload.internalNotes.trim() : '',
    };
  }

  private async resolveApartmentStructure(organizationId: string, payload: Record<string, unknown>) {
    const buildingId = typeof payload.buildingId === 'string' ? payload.buildingId.trim() : '';
    const staircaseId = typeof payload.staircaseId === 'string' ? payload.staircaseId.trim() : '';
    if (buildingId && staircaseId) {
      const [building, staircase] = await Promise.all([
        this.prisma.building.findFirst({ where: { id: buildingId, organizationId }, select: { id: true } }),
        this.prisma.staircase.findFirst({ where: { id: staircaseId, buildingId, organizationId }, select: { id: true } }),
      ]);
      if (!building) throw new NotFoundException('Blocul nu a fost găsit.');
      if (!staircase) throw new NotFoundException('Scara nu a fost găsită.');
      return { buildingId, staircaseId };
    }

    const buildingName = typeof payload.building === 'string' && payload.building.trim() ? payload.building.trim() : 'Bloc principal';
    const staircaseName = typeof payload.entrance === 'string' && payload.entrance.trim() ? payload.entrance.trim() : typeof payload.staircase === 'string' && payload.staircase.trim() ? payload.staircase.trim() : '1';
    const building = await this.findOrCreateBuilding(organizationId, buildingName);
    const staircase = await this.findOrCreateStaircase(organizationId, building.id, staircaseName);
    return { buildingId: building.id, staircaseId: staircase.id };
  }

  private async findOrCreateBuilding(organizationId: string, name: string) {
    const existing = await this.prisma.building.findFirst({
      where: { organizationId, name },
      select: { id: true },
    });
    if (existing) return existing;
    return this.prisma.building.create({
      data: { organizationId, name, address: null },
      select: { id: true },
    });
  }

  private async findOrCreateStaircase(organizationId: string, buildingId: string, name: string) {
    const existing = await this.prisma.staircase.findFirst({
      where: { organizationId, buildingId, name },
      select: { id: true },
    });
    if (existing) return existing;
    return this.prisma.staircase.create({
      data: { organizationId, buildingId, name, floorsCount: 0 },
      select: { id: true },
    });
  }

  private parseAdminResidentLinkBody(payload: Record<string, unknown>) {
    const fullName = this.requiredString(payload.fullName, 'Numele locatarului este obligatoriu.');
    const phone = typeof payload.phone === 'string' ? payload.phone.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Emailul nu este valid.');
    if (phone && !this.isValidMoldovaPhone(phone)) throw new BadRequestException('Telefonul nu este valid.');
    return {
      residentId: typeof payload.residentId === 'string' ? payload.residentId.trim() : '',
      fullName,
      phone: phone ? this.normalizeMoldovaPhone(phone) : '',
      email,
      role: this.parseAdminResidentRole(payload.role),
      isPrimaryContact: Boolean(payload.isPrimaryContact ?? payload.isPrimary),
      preferredContactMethod: this.parsePreferredContactMethod(payload.preferredContactMethod),
      accountStatus: this.parseAdminResidentStatus(payload.status),
    };
  }

  private parseAdminResidentRole(value: unknown) {
    const role = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : 'OWNER';
    if (role === 'OWNER') return ApartmentResidentRole.OWNER;
    if (role === 'TENANT') return ApartmentResidentRole.TENANT;
    if (role === 'REPRESENTATIVE') return ApartmentResidentRole.REPRESENTATIVE;
    throw new BadRequestException('Rolul nu este valid.');
  }

  private parseAdminResidentStatus(value: unknown) {
    const status = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : 'NOT_INVITED';
    if (status === 'ACTIVE') return ResidentAccountStatus.CREATED;
    if (status === 'INVITED') return ResidentAccountStatus.INVITED;
    if (status === 'NOT_INVITED') return ResidentAccountStatus.NO_ACCOUNT;
    throw new BadRequestException('Statusul locatarului nu este valid.');
  }

  private parsePreferredContactMethod(value: unknown) {
    const method = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : 'PHONE';
    const allowed = ['PHONE', 'EMAIL', 'APP', 'WHATSAPP', 'TELEGRAM'];
    if (!allowed.includes(method)) throw new BadRequestException('Metoda de contact nu este validă.');
    return method;
  }

  private async findOrCreateApartmentResident(
    organizationId: string,
    apartmentId: string,
    input: {
      residentId: string;
      fullName: string;
      phone: string;
      email: string;
      role: ApartmentResidentRole;
      accountStatus: ResidentAccountStatus;
      isPrimaryContact: boolean;
    },
  ) {
    const name = this.splitFullName(input.fullName);
    let existing: { id: string } | null = null;
    if (input.residentId) {
      existing = await this.prisma.residentProfile.findFirst({
        where: { id: input.residentId, organizationId },
        select: { id: true },
      });
    }
    if (!existing && input.email) {
      existing = await this.prisma.residentProfile.findFirst({ where: { organizationId, email: input.email }, select: { id: true } });
    }
    if (!existing && input.phone) {
      existing = await this.prisma.residentProfile.findFirst({ where: { organizationId, phone: input.phone }, select: { id: true } });
    }
    if (!existing) {
      existing = await this.prisma.residentProfile.findFirst({
        where: { organizationId, firstName: name.firstName, lastName: name.lastName },
        select: { id: true },
      });
    }

    const residentData = {
      apartmentId,
      firstName: name.firstName,
      lastName: name.lastName,
      phone: input.phone || null,
      email: input.email || null,
      accountStatus: input.accountStatus,
      type: input.role === ApartmentResidentRole.TENANT ? ResidentType.TENANT : input.role === ApartmentResidentRole.OWNER ? ResidentType.OWNER : ResidentType.RESIDENT,
      isPrimary: input.isPrimaryContact,
    };

    if (existing) {
      return this.prisma.residentProfile.update({
        where: { id: existing.id },
        data: residentData,
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      });
    }
    return this.prisma.residentProfile.create({
      data: { organizationId, ...residentData },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    });
  }

  private splitFullName(fullName: string) {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts.shift() || '';
    return {
      firstName,
      lastName: parts.join(' '),
    };
  }

  private async readApartmentMetadata(organizationId: string): Promise<Record<string, any>> {
    const note = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: 'Apartment CRM metadata' },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return {};
    try {
      const parsed = JSON.parse(note.content);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private async updateApartmentMetadata(organizationId: string, userId: string, patch: Record<string, any>) {
    const current = await this.readApartmentMetadata(organizationId);
    const next = { ...current };
    Object.entries(patch).forEach(([apartmentId, value]) => {
      next[apartmentId] = {
        ...(current[apartmentId] || {}),
        ...value,
        residentContactMethods: {
          ...(current[apartmentId]?.residentContactMethods || {}),
          ...(value?.residentContactMethods || {}),
        },
      };
    });
    const existing = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: 'Apartment CRM metadata' },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.clientNote.update({
        where: { id: existing.id },
        data: { content: JSON.stringify(next) },
      });
      return;
    }
    await this.prisma.clientNote.create({
      data: {
        organizationId,
        createdByUserId: userId,
        title: 'Apartment CRM metadata',
        content: JSON.stringify(next),
      },
    });
  }

  private isValidMoldovaPhone(value: string) {
    const normalized = String(value || '').replace(/[\s().-]/g, '');
    return /^\+373\d{8}$/.test(normalized) || /^0\d{8}$/.test(normalized);
  }

  private normalizeMoldovaPhone(value: string) {
    const normalized = String(value || '').trim().replace(/[\s().-]/g, '');
    if (/^0\d{8}$/.test(normalized)) return `+373${normalized.slice(1)}`;
    return normalized;
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
