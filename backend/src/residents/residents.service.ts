import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApartmentResidentRole, InvoiceStatus, PlatformRole, Prisma, ResidentAccountStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import type { MvpUser } from '../security/mvp-auth.guard';

@Injectable()
export class ResidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityMvpService,
  ) {}

  private residentSelect(): Prisma.ResidentProfileSelect {
    return {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      accountStatus: true,
      userId: true,
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
      userId: row.userId,
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

  async listAdminResidents(user: MvpUser, query: Record<string, string | undefined> = {}) {
    const organizationId = this.adminOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);

    const [organization, residents, metadata, apartmentOptions] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, legalName: true, fiscalCode: true },
      }),
      this.prisma.residentProfile.findMany({
        where: { organizationId },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { createdAt: 'asc' }],
        select: this.residentSelect(),
      }),
      this.readResidentMetadata(organizationId),
      this.listApartmentOptions(organizationId),
    ]);
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    let items = residents.map((resident) => this.toAdminResidentRow(resident, metadata));
    const allItems = items;
    items = this.filterAdminResidentRows(items, query);
    items = this.sortAdminResidentRows(items, query.sortBy, query.sortDirection);

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
      stats: this.adminResidentStats(allItems),
      filters: {
        apartmentOptions,
      },
    };
  }

  async getAdminResident(user: MvpUser, id: string) {
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id, ...this.organizationWhere(user) },
      select: this.residentSelect(),
    });
    if (!resident) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const [metadata, apartmentOptions] = await Promise.all([
      this.readResidentMetadata(resident.organizationId),
      this.listApartmentOptions(resident.organizationId),
    ]);
    return this.toAdminResidentDetail(resident, metadata, apartmentOptions);
  }

  async createAdminResident(user: MvpUser, body: unknown) {
    const payload = this.payload(body);
    const organizationId = this.adminOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    await this.assertOrganizationExists(organizationId);
    const input = this.parseAdminResidentBody(payload);

    if (input.email) {
      const existing = await this.prisma.residentProfile.findFirst({
        where: { organizationId, email: input.email },
        select: { id: true },
      });
      if (existing) throw new ConflictException('Există deja o persoană cu acest email.');
    }

    const resident = await this.prisma.residentProfile.create({
      data: {
        organizationId,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email,
        accountStatus: input.accountStatus,
      },
      select: this.residentSelect(),
    });
    await this.updateResidentMetadata(organizationId, user.id, {
      [resident.id]: {
        preferredContactMethod: input.preferredContactMethod,
        status: input.status,
        internalNotes: input.internalNotes,
      },
    });

    await this.activity.createActivity({
      organizationId,
      actorUserId: user.id,
      type: 'RESIDENT_CREATED',
      title: 'Persoană creată',
      message: `${this.fullName(resident)} a fost creat(ă).`,
      targetType: 'RESIDENT',
      targetId: resident.id,
      link: `/admin/residents/${resident.id}`,
    });

    return this.getAdminResident(user, resident.id);
  }

  async updateAdminResident(user: MvpUser, id: string, body: unknown) {
    const payload = this.payload(body);
    const existing = await this.prisma.residentProfile.findFirst({
      where: { id, ...this.organizationWhere(user) },
      select: { id: true, organizationId: true, accountStatus: true },
    });
    if (!existing) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertOrganizationAccess(user, existing.organizationId);
    const input = this.parseAdminResidentBody(payload, true);

    if (input.email) {
      const duplicate = await this.prisma.residentProfile.findFirst({
        where: { id: { not: id }, organizationId: existing.organizationId, email: input.email },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Există deja o persoană cu acest email.');
    }

    await this.prisma.residentProfile.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email,
        accountStatus: this.accountStatusFromAdminStatus(input.status, existing.accountStatus),
      },
    });
    await this.updateResidentMetadata(existing.organizationId, user.id, {
      [id]: {
        preferredContactMethod: input.preferredContactMethod,
        status: input.status,
        internalNotes: input.internalNotes,
      },
    });

    return this.getAdminResident(user, id);
  }

  async linkApartmentToAdminResident(user: MvpUser, residentId: string, body: unknown) {
    const payload = this.payload(body);
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id: residentId, ...this.organizationWhere(user) },
      select: { id: true, organizationId: true, firstName: true, lastName: true },
    });
    if (!resident) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertOrganizationAccess(user, resident.organizationId);

    const input = this.parseResidentApartmentRelationBody(payload, true);
    const apartment = await this.prisma.apartment.findFirst({
      where: { id: input.apartmentId, organizationId: resident.organizationId },
      select: { id: true, number: true },
    });
    if (!apartment) throw new NotFoundException('Apartamentul nu a fost găsit.');

    const existing = await this.prisma.apartmentResident.findUnique({
      where: {
        apartmentId_residentId_role: {
          apartmentId: apartment.id,
          residentId,
          role: input.role,
        },
      },
      select: { apartmentId: true, residentId: true, role: true },
    });
    if (input.isPrimaryContact) {
      await this.prisma.apartmentResident.updateMany({
        where: { apartmentId: apartment.id, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    if (existing) {
      await this.prisma.apartmentResident.update({
        where: {
          apartmentId_residentId_role: {
            apartmentId: apartment.id,
            residentId,
            role: input.role,
          },
        },
        data: { isPrimary: input.isPrimaryContact },
      });
    } else {
      await this.prisma.apartmentResident.create({
        data: {
          apartmentId: apartment.id,
          residentId,
          role: input.role,
          isPrimary: input.isPrimaryContact,
        },
      });
    }
    if (input.isPrimaryContact) {
      await this.prisma.apartment.update({
        where: { id: apartment.id },
        data: { ownerResidentId: residentId },
      });
    }
    await this.updateResidentRelationMetadata(resident.organizationId, user.id, residentId, apartment.id, input.role, input);

    await this.activity.createActivity({
      organizationId: resident.organizationId,
      actorUserId: user.id,
      type: 'RESIDENT_LINKED',
      title: 'Persoană conectată',
      message: `${this.fullName(resident)} a fost conectat(ă) la apartamentul ${apartment.number}.`,
      targetType: 'RESIDENT',
      targetId: residentId,
      link: `/admin/residents/${residentId}`,
    });

    return this.getAdminResident(user, residentId);
  }

  async updateAdminResidentApartmentRelation(user: MvpUser, residentId: string, apartmentId: string, body: unknown) {
    const payload = this.payload(body);
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id: residentId, ...this.organizationWhere(user) },
      select: { id: true, organizationId: true },
    });
    if (!resident) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const relation = await this.prisma.apartmentResident.findFirst({
      where: { residentId, apartmentId, apartment: { organizationId: resident.organizationId } },
      select: { apartmentId: true, residentId: true, role: true },
    });
    if (!relation) throw new NotFoundException('Legătura cu apartamentul nu a fost găsită.');
    const input = this.parseResidentApartmentRelationBody({ ...payload, apartmentId }, false);

    if (input.isPrimaryContact) {
      await this.prisma.apartmentResident.updateMany({
        where: { apartmentId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    if (input.role !== relation.role) {
      const duplicate = await this.prisma.apartmentResident.findUnique({
        where: {
          apartmentId_residentId_role: {
            apartmentId,
            residentId,
            role: input.role,
          },
        },
        select: { apartmentId: true },
      });
      if (duplicate) throw new ConflictException('Această legătură există deja.');
    }

    await this.prisma.apartmentResident.update({
      where: {
        apartmentId_residentId_role: {
          apartmentId,
          residentId,
          role: relation.role,
        },
      },
      data: {
        role: input.role,
        isPrimary: input.isPrimaryContact,
      },
    });
    if (input.isPrimaryContact) {
      await this.prisma.apartment.update({
        where: { id: apartmentId },
        data: { ownerResidentId: residentId },
      });
    }
    await this.updateResidentRelationMetadata(resident.organizationId, user.id, residentId, apartmentId, input.role, input);
    return this.getAdminResident(user, residentId);
  }

  async unlinkApartmentFromAdminResident(user: MvpUser, residentId: string, apartmentId: string) {
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id: residentId, ...this.organizationWhere(user) },
      select: { id: true, organizationId: true },
    });
    if (!resident) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const apartment = await this.prisma.apartment.findFirst({
      where: { id: apartmentId, organizationId: resident.organizationId },
      select: { id: true, ownerResidentId: true },
    });
    if (!apartment) throw new NotFoundException('Apartamentul nu a fost găsit.');

    await this.prisma.apartmentResident.deleteMany({
      where: { residentId, apartmentId },
    });
    if (apartment.ownerResidentId === residentId) {
      await this.prisma.apartment.update({
        where: { id: apartmentId },
        data: { ownerResidentId: null },
      });
    }
    return this.getAdminResident(user, residentId);
  }

  async updateAdminResidentStatus(user: MvpUser, residentId: string, body: unknown) {
    const payload = this.payload(body);
    const status = this.parseAdminResidentStatus(payload.status);
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id: residentId, ...this.organizationWhere(user) },
      select: { id: true, organizationId: true, accountStatus: true },
    });
    if (!resident) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const accountStatus = this.accountStatusFromAdminStatus(status, resident.accountStatus);
    await this.prisma.residentProfile.update({
      where: { id: residentId },
      data: { accountStatus },
    });
    await this.updateResidentMetadata(resident.organizationId, user.id, {
      [residentId]: { status },
    });
    return this.getAdminResident(user, residentId);
  }

  async listResidents(user: MvpUser) {
    const residents = await this.prisma.residentProfile.findMany({
      where: this.organizationWhere(user),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { createdAt: 'asc' }],
      select: this.residentSelect(),
    });

    return residents.map((resident) => this.toResident(resident));
  }

  async createResident(user: MvpUser, body: unknown) {
    const input = await this.parseCreateResidentBody(body);
    if (!this.isSuperadmin(user)) {
      input.organizationId = user.organizationId;
    }
    this.assertOrganizationAccess(user, input.organizationId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
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

    await this.activity.createActivity({
      organizationId: resident.organizationId,
      actorUserId: user.id,
      type: 'RESIDENT_CREATED',
      title: 'Locatar creat',
      message: `Locatarul ${this.fullName(resident)} a fost creat.`,
      targetType: 'RESIDENT',
      targetId: resident.id,
      link: `/admin/residents/${resident.id}`,
    });

    return this.toResident(resident);
  }

  async getResident(user: MvpUser, id: string) {
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id, ...this.organizationWhere(user) },
      select: this.residentSelect(),
    });

    if (!resident) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    return this.toResident(resident);
  }

  async createResidentAccount(user: MvpUser, residentId: string, body: unknown) {
    const input = this.parseCreateAccountBody(body);
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id: residentId, ...this.organizationWhere(user) },
      select: {
        id: true,
        organizationId: true,
        userId: true,
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
    this.assertOrganizationAccess(user, resident.organizationId);
    if (resident.userId) {
      throw new ConflictException('Acest locatar are deja cont.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('Există deja un utilizator cu acest email.');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const phone = input.phone || resident.phone || null;

    const result = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          firstName: resident.firstName || null,
          lastName: resident.lastName || null,
          fullName: `${resident.firstName || ''} ${resident.lastName || ''}`.trim() || null,
          phone,
          role: Role.RESIDENT,
          platformRole: PlatformRole.RESIDENT,
          organizationId: resident.organizationId,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          organizationId: true,
          createdAt: true,
        },
      });

      const updatedResident = await tx.residentProfile.update({
        where: { id: resident.id },
        data: {
          userId: createdUser.id,
          email: input.email,
          phone,
          accountStatus: ResidentAccountStatus.CREATED,
        },
        select: {
          id: true,
          accountStatus: true,
          userId: true,
        },
      });

      return { createdUser, updatedResident };
    });

    await this.activity.createActivity({
      organizationId: resident.organizationId,
      actorUserId: user.id,
      type: 'RESIDENT_CREATED',
      title: 'Cont locatar creat',
      message: `Contul locatarului ${this.fullName(resident)} a fost creat.`,
      targetType: 'RESIDENT',
      targetId: resident.id,
      link: `/admin/residents/${resident.id}`,
    });

    return {
      user: result.createdUser,
      resident: {
        id: result.updatedResident.id,
        userId: result.updatedResident.userId,
        accountStatus: result.updatedResident.accountStatus,
      },
    };
  }

  private payload(body: unknown) {
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  }

  private async assertOrganizationExists(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
  }

  private async listApartmentOptions(organizationId: string) {
    const apartments = await this.prisma.apartment.findMany({
      where: { organizationId },
      orderBy: [{ staircase: { name: 'asc' } }, { floor: 'asc' }, { number: 'asc' }],
      select: {
        id: true,
        number: true,
        floor: true,
        staircase: { select: { id: true, name: true } },
        building: { select: { id: true, name: true } },
      },
    });
    return apartments.map((apartment) => ({
      id: apartment.id,
      apartmentNumber: apartment.number,
      staircase: apartment.staircase?.name || '',
      floor: apartment.floor === null || apartment.floor === undefined ? '' : String(apartment.floor),
      buildingName: apartment.building?.name || '',
    }));
  }

  private toAdminResidentStatus(row: any, rowMetadata: Record<string, any>) {
    const metadataStatus = typeof rowMetadata.status === 'string' ? rowMetadata.status.toUpperCase() : '';
    if (['ACTIVE', 'INVITED', 'NOT_INVITED', 'INACTIVE'].includes(metadataStatus)) return metadataStatus;
    if (row.accountStatus === ResidentAccountStatus.CREATED) return 'ACTIVE';
    if (row.accountStatus === ResidentAccountStatus.INVITED) return 'INVITED';
    return 'NOT_INVITED';
  }

  private accountStatusFromAdminStatus(status: string, fallback: ResidentAccountStatus = ResidentAccountStatus.NO_ACCOUNT) {
    if (status === 'INVITED') return ResidentAccountStatus.INVITED;
    if (status === 'NOT_INVITED' || status === 'INACTIVE') return ResidentAccountStatus.NO_ACCOUNT;
    if (status === 'ACTIVE' && fallback === ResidentAccountStatus.CREATED) return ResidentAccountStatus.CREATED;
    return fallback;
  }

  private toAdminApartmentLink(item: any, rowMetadata: Record<string, any>) {
    const apartment = item.apartment;
    const relationKey = this.relationMetadataKey(apartment.id, item.role);
    const relationMetadata = rowMetadata.relations?.[relationKey] || {};
    return {
      id: apartment.id,
      apartmentId: apartment.id,
      apartmentNumber: apartment.number,
      staircase: apartment.staircase?.name || '',
      floor: apartment.floor === null || apartment.floor === undefined ? '' : String(apartment.floor),
      role: item.role,
      isPrimaryContact: Boolean(item.isPrimary),
      relationStartDate: relationMetadata.relationStartDate || '',
      relationEndDate: relationMetadata.relationEndDate || '',
      notes: relationMetadata.notes || '',
    };
  }

  private toAdminResidentRow(row: any, metadata: Record<string, any>) {
    const rowMetadata = metadata[row.id] || {};
    const apartments = (row.apartmentResidents || []).map((item) => this.toAdminApartmentLink(item, rowMetadata));
    const primaryRelation = apartments.find((item) => item.isPrimaryContact) || apartments[0];
    const status = this.toAdminResidentStatus(row, rowMetadata);
    const preferredContactMethod = rowMetadata.preferredContactMethod || 'PHONE';
    const resident = {
      id: row.id,
      organizationId: row.organizationId,
      fullName: this.fullName(row),
      firstName: row.firstName || '',
      lastName: row.lastName || '',
      phone: row.phone || '',
      email: row.email || '',
      preferredContactMethod,
      status,
      accountStatus: row.accountStatus,
      role: primaryRelation?.role || row.type || 'OWNER',
      apartments,
      apartmentsCount: apartments.length,
      isPrimaryContactSomewhere: apartments.some((item) => item.isPrimaryContact),
      completenessStatus: '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return {
      ...resident,
      completenessStatus: this.adminResidentCompleteness(resident),
    };
  }

  private toAdminResidentDetail(row: any, metadata: Record<string, any>, apartmentOptions: any[]) {
    const base = this.toAdminResidentRow(row, metadata);
    const rowMetadata = metadata[row.id] || {};
    return {
      ...base,
      internalNotes: rowMetadata.internalNotes || '',
      issues: row.issues || [],
      messages: row.messageThreads || [],
      activity: [
        { label: 'Creat', date: row.createdAt },
        { label: 'Actualizat', date: row.updatedAt },
      ],
      apartmentOptions,
    };
  }

  private adminResidentCompleteness(row: { apartmentsCount: number; phone?: string; email?: string; status?: string }) {
    if (!row.apartmentsCount) return 'NO_APARTMENT';
    if (!row.phone) return 'NO_PHONE';
    if (!row.email) return 'NO_EMAIL';
    if (row.status === 'INACTIVE') return 'INACTIVE';
    return 'COMPLETE';
  }

  private filterAdminResidentRows(rows: any[], query: Record<string, string | undefined>) {
    const search = String(query.search || '').trim().toLowerCase();
    const role = String(query.role || '').trim().toUpperCase();
    const status = String(query.status || '').trim().toUpperCase();
    const hasApartment = String(query.hasApartment || '').trim();
    const isPrimaryContact = String(query.isPrimaryContact || '').trim();
    const preferredContactMethod = String(query.preferredContactMethod || '').trim().toUpperCase();

    return rows.filter((row) => {
      const matchesSearch =
        !search ||
        [
          row.fullName,
          row.phone,
          row.email,
          ...(row.apartments || []).map((apartment) => apartment.apartmentNumber),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      const matchesRole = !role || role === 'ALL' || (row.apartments || []).some((apartment) => {
        if (role === 'TENANT') return ['TENANT', 'RESIDENT'].includes(apartment.role);
        return apartment.role === role;
      }) || row.role === role;
      const matchesStatus = !status || status === 'ALL' || row.status === status;
      const matchesHasApartment =
        !hasApartment ||
        hasApartment === 'ALL' ||
        (hasApartment === 'true' ? row.apartmentsCount > 0 : row.apartmentsCount === 0);
      const matchesPrimary =
        !isPrimaryContact ||
        isPrimaryContact === 'ALL' ||
        (isPrimaryContact === 'true' ? row.isPrimaryContactSomewhere : !row.isPrimaryContactSomewhere);
      const matchesMethod = !preferredContactMethod || preferredContactMethod === 'ALL' || row.preferredContactMethod === preferredContactMethod;
      return matchesSearch && matchesRole && matchesStatus && matchesHasApartment && matchesPrimary && matchesMethod;
    });
  }

  private sortAdminResidentRows(rows: any[], sortBy?: string, sortDirection?: string) {
    const direction = String(sortDirection || 'asc').toLowerCase() === 'desc' ? -1 : 1;
    const key = String(sortBy || 'name');
    return [...rows].sort((a, b) => {
      if (key === 'createdAt' || key === 'updatedAt') {
        return (new Date(a[key]).getTime() - new Date(b[key]).getTime()) * direction;
      }
      const left = key === 'role' || key === 'status' ? a[key] : a.fullName;
      const right = key === 'role' || key === 'status' ? b[key] : b.fullName;
      return String(left || '').localeCompare(String(right || ''), 'ro') * direction;
    });
  }

  private adminResidentStats(rows: any[]) {
    return {
      totalResidents: rows.length,
      owners: rows.filter((row) => row.apartments.some((apartment) => apartment.role === 'OWNER') || row.role === 'OWNER').length,
      tenants: rows.filter((row) => row.apartments.some((apartment) => ['TENANT', 'RESIDENT'].includes(apartment.role)) || ['TENANT', 'RESIDENT'].includes(row.role)).length,
      representatives: rows.filter((row) => row.apartments.some((apartment) => apartment.role === 'REPRESENTATIVE') || row.role === 'REPRESENTATIVE').length,
      withoutPhone: rows.filter((row) => !row.phone).length,
      withoutEmail: rows.filter((row) => !row.email).length,
      withoutApartment: rows.filter((row) => row.apartmentsCount === 0).length,
      primaryContacts: rows.filter((row) => row.isPrimaryContactSomewhere).length,
    };
  }

  private parseAdminResidentBody(payload: Record<string, unknown>, isUpdate = false) {
    const fullName = this.requiredString(payload.fullName, 'Numele este obligatoriu.');
    const { firstName, lastName } = this.splitFullName(fullName);
    const phone = typeof payload.phone === 'string' && payload.phone.trim() ? payload.phone.trim() : null;
    const email = typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim().toLowerCase() : null;
    const preferredContactMethod = this.parsePreferredContactMethod(payload.preferredContactMethod);
    const status = this.parseAdminResidentStatus(payload.status);
    const internalNotes = typeof payload.internalNotes === 'string' ? payload.internalNotes.trim() : '';

    if (email && !this.isValidEmail(email)) throw new BadRequestException('Emailul nu este valid.');
    const accountStatus = this.accountStatusFromAdminStatus(status, isUpdate ? ResidentAccountStatus.NO_ACCOUNT : ResidentAccountStatus.NO_ACCOUNT);
    return {
      firstName,
      lastName,
      phone,
      email,
      preferredContactMethod,
      status,
      internalNotes,
      accountStatus,
    };
  }

  private parseResidentApartmentRelationBody(payload: Record<string, unknown>, requireApartment: boolean) {
    const apartmentId = requireApartment ? this.requiredString(payload.apartmentId, 'Apartamentul este obligatoriu.') : String(payload.apartmentId || '');
    const role = this.parseApartmentResidentRole(payload.role);
    const isPrimaryContact = payload.isPrimaryContact === true || payload.isPrimary === true || payload.isPrimaryContact === 'true';
    const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
    const relationStartDate = this.optionalDate(payload.relationStartDate, 'Data de început nu este validă.');
    const relationEndDate = this.optionalDate(payload.relationEndDate, 'Data de final nu este validă.');
    return {
      apartmentId,
      role,
      isPrimaryContact,
      notes,
      relationStartDate,
      relationEndDate,
    };
  }

  private parseApartmentResidentRole(value: unknown) {
    const role = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (role === 'OWNER') return ApartmentResidentRole.OWNER;
    if (role === 'TENANT') return ApartmentResidentRole.TENANT;
    if (role === 'REPRESENTATIVE') return ApartmentResidentRole.REPRESENTATIVE;
    if (role === 'RESIDENT') return ApartmentResidentRole.RESIDENT;
    throw new BadRequestException('Rolul nu este valid.');
  }

  private parsePreferredContactMethod(value: unknown) {
    const method = typeof value === 'string' ? value.trim().toUpperCase() : 'PHONE';
    if (['PHONE', 'EMAIL', 'APP', 'WHATSAPP', 'TELEGRAM'].includes(method)) return method;
    throw new BadRequestException('Metoda de contact nu este validă.');
  }

  private parseAdminResidentStatus(value: unknown) {
    const status = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : 'NOT_INVITED';
    if (['ACTIVE', 'INVITED', 'NOT_INVITED', 'INACTIVE'].includes(status)) return status;
    throw new BadRequestException('Statusul persoanei nu este valid.');
  }

  private optionalDate(value: unknown, message: string) {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value !== 'string') throw new BadRequestException(message);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(message);
    return value.slice(0, 10);
  }

  private splitFullName(fullName: string) {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts.shift() || fullName.trim();
    const lastName = parts.join(' ');
    return { firstName, lastName };
  }

  private relationMetadataKey(apartmentId: string, role: string) {
    return `${apartmentId}:${role}`;
  }

  private async readResidentMetadata(organizationId: string): Promise<Record<string, any>> {
    const note = await this.prisma.clientNote.findFirst({
      where: {
        organizationId,
        title: 'Resident CRM metadata',
      },
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

  private async updateResidentMetadata(organizationId: string, userId: string, patch: Record<string, any>) {
    const current = await this.readResidentMetadata(organizationId);
    const next = { ...current };
    Object.entries(patch).forEach(([residentId, value]) => {
      next[residentId] = {
        ...(next[residentId] || {}),
        ...(value || {}),
        relations: {
          ...(next[residentId]?.relations || {}),
          ...(value?.relations || {}),
        },
      };
    });
    const existing = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: 'Resident CRM metadata' },
      select: { id: true },
    });
    const content = JSON.stringify(next);
    if (existing) {
      await this.prisma.clientNote.update({
        where: { id: existing.id },
        data: { content },
      });
      return;
    }
    await this.prisma.clientNote.create({
      data: {
        organizationId,
        createdByUserId: userId,
        title: 'Resident CRM metadata',
        content,
      },
    });
  }

  private async updateResidentRelationMetadata(
    organizationId: string,
    userId: string,
    residentId: string,
    apartmentId: string,
    role: ApartmentResidentRole,
    input: { notes?: string; relationStartDate?: string; relationEndDate?: string },
  ) {
    await this.updateResidentMetadata(organizationId, userId, {
      [residentId]: {
        relations: {
          [this.relationMetadataKey(apartmentId, role)]: {
            notes: input.notes || '',
            relationStartDate: input.relationStartDate || '',
            relationEndDate: input.relationEndDate || '',
          },
        },
      },
    });
  }

  private async parseCreateResidentBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.requiredString(payload.organizationId, 'Organizația este obligatorie.');
    const firstName = this.requiredString(payload.firstName, 'Prenumele este obligatoriu.');
    const lastName = this.requiredString(payload.lastName, 'Numele este obligatoriu.');
    const phone = typeof payload.phone === 'string' ? payload.phone.trim() : null;
    const email = typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim().toLowerCase() : null;
    const accountStatus = this.optionalEnum(payload.accountStatus, ResidentAccountStatus, ResidentAccountStatus.NO_ACCOUNT, 'Statusul contului nu este valid.');

    if (email && !this.isValidEmail(email)) {
      throw new BadRequestException('Emailul nu este valid.');
    }
    if (phone && !this.isValidMoldovaPhone(phone)) {
      throw new BadRequestException('Telefonul nu este valid.');
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

  private parseCreateAccountBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const email = this.requiredString(payload.email, 'Emailul este obligatoriu.').toLowerCase();
    const password = this.requiredString(payload.password, 'Parola temporară este obligatorie.');
    const phone = typeof payload.phone === 'string' && payload.phone.trim() ? payload.phone.trim() : null;

    if (!this.isValidEmail(email)) {
      throw new BadRequestException('Emailul nu este valid.');
    }
    if (password.length < 8) {
      throw new BadRequestException('Parola temporară trebuie să aibă cel puțin 8 caractere.');
    }

    return { email, password, phone };
  }

  private optionalEnum<T extends Record<string, string>>(value: unknown, enumValues: T, fallback: T[keyof T], message: string) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') throw new BadRequestException(message);
    const normalized = value.trim().toUpperCase();
    const allowed = Object.values(enumValues) as string[];
    if (!allowed.includes(normalized)) throw new BadRequestException(message);
    return normalized as T[keyof T];
  }

  private isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private isValidMoldovaPhone(value: string) {
    const normalized = value.replace(/[\s().-]/g, '');
    return /^\+373\d{8}$/.test(normalized) || /^0\d{8}$/.test(normalized);
  }
}
