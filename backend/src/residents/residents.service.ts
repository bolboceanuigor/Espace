import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApartmentResidentRole,
  InvoiceStatus,
  NotificationType,
  PlatformRole,
  Prisma,
  ResidentAccountStatus,
  ResidentPortalAccessStatus,
  ResidentPortalInvitationStatus,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import type { MvpUser } from '../security/mvp-auth.guard';

const RESIDENT_PROFILE_UPDATE_REQUESTS_TITLE = 'Resident profile update requests';
const RESIDENT_UPDATE_REQUEST_TYPES = [
  'FULL_NAME_CHANGE',
  'PHONE_CHANGE',
  'EMAIL_CHANGE',
  'CONTACT_METHOD_CHANGE',
  'APARTMENT_RELATION_CHANGE',
  'OTHER',
] as const;
const RESIDENT_UPDATE_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

type ResidentUpdateRequestStatus = (typeof RESIDENT_UPDATE_REQUEST_STATUSES)[number];
type ResidentUpdateRequestType = (typeof RESIDENT_UPDATE_REQUEST_TYPES)[number];
type StoredResidentUpdateRequest = {
  id: string;
  associationId: string;
  residentId: string;
  apartmentId?: string | null;
  requestType: ResidentUpdateRequestType;
  status: ResidentUpdateRequestStatus;
  currentFullName?: string | null;
  requestedFullName?: string | null;
  currentPhone?: string | null;
  requestedPhone?: string | null;
  currentEmail?: string | null;
  requestedEmail?: string | null;
  currentPreferredContactMethod?: string | null;
  requestedPreferredContactMethod?: string | null;
  message?: string | null;
  attachmentPlaceholder?: boolean;
  adminResponse?: string | null;
  internalNotes?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  cancelledAt?: string | null;
  appliedAt?: string | null;
  appliedById?: string | null;
  applyChangeNow?: boolean;
  oldSnapshot?: Record<string, unknown> | null;
  newSnapshot?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

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
      portalAccessStatus: true,
      portalAccessActivatedAt: true,
      portalAccessRevokedAt: true,
      userId: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
        },
      },
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
      portalInvitations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          expiresAt: true,
          lastSentAt: true,
          acceptedAt: true,
          createdAt: true,
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
    const [metadata, apartmentOptions, updateRequests] = await Promise.all([
      this.readResidentMetadata(resident.organizationId),
      this.listApartmentOptions(resident.organizationId),
      this.readProfileUpdateRequests(resident.organizationId),
    ]);
    return this.toAdminResidentDetail(
      resident,
      metadata,
      apartmentOptions,
      updateRequests.filter((request) => request.residentId === resident.id),
    );
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

  async listAdminResidentUpdateRequests(user: MvpUser, query: Record<string, string | undefined> = {}) {
    const organizationId = this.adminOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const [organization, rawRequests, residents, apartments] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, legalName: true, fiscalCode: true },
      }),
      this.readProfileUpdateRequests(organizationId),
      this.prisma.residentProfile.findMany({
        where: { organizationId },
        select: this.residentSelect(),
      }),
      this.prisma.apartment.findMany({
        where: { organizationId },
        select: {
          id: true,
          number: true,
          floor: true,
          staircase: { select: { id: true, name: true } },
          building: { select: { id: true, name: true } },
        },
      }),
    ]);
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const residentsById = new Map((residents as any[]).map((resident) => [resident.id, resident]));
    const apartmentsById = new Map((apartments as any[]).map((apartment) => [apartment.id, apartment]));
    let items = rawRequests
      .filter((request) => request.associationId === organizationId)
      .map((request) => this.toAdminUpdateRequestRow(request, residentsById.get(request.residentId), request.apartmentId ? apartmentsById.get(request.apartmentId) : null));
    const allItems = items;
    items = this.filterAdminUpdateRequestRows(items, query);
    items = this.sortAdminUpdateRequestRows(items, query.sortBy, query.sortDirection);

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
      stats: this.adminUpdateRequestStats(allItems),
    };
  }

  async getAdminResidentUpdateRequestStats(user: MvpUser) {
    const organizationId = this.adminOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const requests = await this.readProfileUpdateRequests(organizationId);
    return this.adminUpdateRequestStats(requests.filter((request) => request.associationId === organizationId));
  }

  async getAdminResidentUpdateRequest(user: MvpUser, id: string) {
    const organizationId = this.adminOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const request = await this.requireAdminUpdateRequest(organizationId, id);
    return this.adminUpdateRequestDetail(organizationId, request);
  }

  async approveAdminResidentUpdateRequest(user: MvpUser, id: string, body: unknown) {
    const organizationId = this.adminOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const payload = this.payload(body);
    const adminResponse = typeof payload.adminResponse === 'string' ? payload.adminResponse.trim() : '';
    const internalNotes = typeof payload.internalNotes === 'string' ? payload.internalNotes.trim() : '';
    const applyChangeNow = payload.applyChangeNow !== false;
    const items = await this.readProfileUpdateRequests(organizationId);
    const index = items.findIndex((request) => request.id === id && request.associationId === organizationId);
    if (index === -1) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (items[index].status !== 'PENDING') throw new BadRequestException('Doar solicitările pending pot fi procesate.');

    const request = items[index];
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id: request.residentId, organizationId },
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
    if (!resident) throw new NotFoundException('Locatarul nu a fost găsit.');

    const now = new Date().toISOString();
    const applyResult = applyChangeNow
      ? await this.applyResidentUpdateRequest(user, organizationId, request, resident, payload)
      : { applied: false, oldSnapshot: null, newSnapshot: null, note: null };
    const responseSuffix = applyResult.note ? ` ${applyResult.note}` : '';

    items[index] = {
      ...request,
      status: 'APPROVED',
      adminResponse: adminResponse || `Solicitarea a fost aprobată.${responseSuffix}`.trim(),
      internalNotes,
      applyChangeNow,
      reviewedById: user.id,
      reviewedAt: now,
      appliedAt: applyResult.applied ? now : null,
      appliedById: applyResult.applied ? user.id : null,
      oldSnapshot: applyResult.oldSnapshot,
      newSnapshot: applyResult.newSnapshot,
      updatedAt: now,
    };
    await this.writeProfileUpdateRequests(organizationId, user.id, items);
    await this.activity.createActivity({
      organizationId,
      actorUserId: user.id,
      type: 'RESIDENT_UPDATED',
      title: 'Solicitare date aprobată',
      message: `${this.fullName(resident)}: ${this.requestTypeLabel(request.requestType)}.`,
      targetType: 'RESIDENT',
      targetId: resident.id,
      link: `/admin/resident-update-requests/${id}`,
    });
    await this.activity.notifyResidentProfile({
      organizationId,
      residentId: resident.id,
      type: NotificationType.SYSTEM,
      title: 'Solicitare date aprobată',
      message: 'Administratorul a aprobat solicitarea ta de actualizare date.',
      link: '/resident/profile',
    });
    return this.adminUpdateRequestDetail(organizationId, items[index]);
  }

  async rejectAdminResidentUpdateRequest(user: MvpUser, id: string, body: unknown) {
    const organizationId = this.adminOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const payload = this.payload(body);
    const adminResponse = this.requiredString(payload.adminResponse, 'Răspunsul adminului este obligatoriu.');
    const internalNotes = typeof payload.internalNotes === 'string' ? payload.internalNotes.trim() : '';
    const items = await this.readProfileUpdateRequests(organizationId);
    const index = items.findIndex((request) => request.id === id && request.associationId === organizationId);
    if (index === -1) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (items[index].status !== 'PENDING') throw new BadRequestException('Doar solicitările pending pot fi procesate.');
    const now = new Date().toISOString();
    items[index] = {
      ...items[index],
      status: 'REJECTED',
      adminResponse,
      internalNotes,
      reviewedById: user.id,
      reviewedAt: now,
      updatedAt: now,
    };
    await this.writeProfileUpdateRequests(organizationId, user.id, items);
    await this.activity.createActivity({
      organizationId,
      actorUserId: user.id,
      type: 'RESIDENT_UPDATED',
      title: 'Solicitare date respinsă',
      message: `${this.requestTypeLabel(items[index].requestType)} a fost respinsă.`,
      targetType: 'RESIDENT',
      targetId: items[index].residentId,
      link: `/admin/resident-update-requests/${id}`,
    });
    await this.activity.notifyResidentProfile({
      organizationId,
      residentId: items[index].residentId,
      type: NotificationType.SYSTEM,
      title: 'Solicitare date respinsă',
      message: 'Administratorul a respins solicitarea ta de actualizare date.',
      link: '/resident/profile',
    });
    return this.adminUpdateRequestDetail(organizationId, items[index]);
  }

  async listAdminResidentUpdateRequestsForResident(user: MvpUser, residentId: string) {
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id: residentId, ...this.organizationWhere(user) },
      select: { id: true, organizationId: true },
    });
    if (!resident) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertOrganizationAccess(user, resident.organizationId);
    const requests = (await this.readProfileUpdateRequests(resident.organizationId))
      .filter((request) => request.residentId === resident.id)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return {
      items: requests.map((request) => this.toAdminResidentRequestPreview(request)),
      meta: { total: requests.length },
    };
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
    const latestInvitation = row.portalInvitations?.[0] || null;
    const portalAccessStatus =
      row.portalAccessStatus === ResidentPortalAccessStatus.SUSPENDED ||
      row.portalAccessStatus === ResidentPortalAccessStatus.REVOKED
        ? row.portalAccessStatus
        : row.userId || row.accountStatus === ResidentAccountStatus.CREATED
          ? ResidentPortalAccessStatus.ACTIVE
          : latestInvitation &&
              [ResidentPortalInvitationStatus.PENDING, ResidentPortalInvitationStatus.SENT].includes(latestInvitation.status) &&
              new Date(latestInvitation.expiresAt).getTime() >= Date.now()
            ? ResidentPortalAccessStatus.INVITED
            : ResidentPortalAccessStatus.NO_ACCESS;
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
      portalAccess: {
        status: portalAccessStatus,
        activatedAt: row.portalAccessActivatedAt || null,
        revokedAt: row.portalAccessRevokedAt || null,
        user: row.user
          ? {
              id: row.user.id,
              email: row.user.email,
              fullName: `${row.user.firstName || ''} ${row.user.lastName || ''}`.trim() || row.user.email,
              role: row.user.role,
              isActive: row.user.isActive,
            }
          : null,
        latestInvitation,
      },
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

  private toAdminResidentDetail(row: any, metadata: Record<string, any>, apartmentOptions: any[], updateRequests: StoredResidentUpdateRequest[] = []) {
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
      updateRequests: updateRequests
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 5)
        .map((request) => this.toAdminResidentRequestPreview(request)),
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

  private requestTypeLabel(type?: string | null) {
    const labels: Record<string, string> = {
      FULL_NAME_CHANGE: 'Schimbare nume',
      PHONE_CHANGE: 'Schimbare telefon',
      EMAIL_CHANGE: 'Schimbare email',
      CONTACT_METHOD_CHANGE: 'Schimbare metodă contact',
      APARTMENT_RELATION_CHANGE: 'Schimbare relație apartament',
      OTHER: 'Altă solicitare',
    };
    return labels[String(type || '').toUpperCase()] || 'Solicitare';
  }

  private requestValueLabels(request: StoredResidentUpdateRequest) {
    if (request.requestType === 'FULL_NAME_CHANGE') {
      return {
        currentValueLabel: request.currentFullName || 'Necompletat',
        requestedValueLabel: request.requestedFullName || 'Necompletat',
      };
    }
    if (request.requestType === 'PHONE_CHANGE') {
      return {
        currentValueLabel: request.currentPhone || 'Necompletat',
        requestedValueLabel: request.requestedPhone || 'Necompletat',
      };
    }
    if (request.requestType === 'EMAIL_CHANGE') {
      return {
        currentValueLabel: request.currentEmail || 'Necompletat',
        requestedValueLabel: request.requestedEmail || 'Necompletat',
      };
    }
    if (request.requestType === 'CONTACT_METHOD_CHANGE') {
      return {
        currentValueLabel: request.currentPreferredContactMethod || 'Necompletat',
        requestedValueLabel: request.requestedPreferredContactMethod || 'Necompletat',
      };
    }
    return {
      currentValueLabel: request.message || 'Verificare manuală',
      requestedValueLabel: request.message || 'Verificare manuală',
    };
  }

  private updateRequestComparison(request: StoredResidentUpdateRequest) {
    if (request.requestType === 'FULL_NAME_CHANGE') {
      return [
        {
          field: 'fullName',
          label: 'Nume complet',
          currentValue: request.currentFullName || 'Necompletat',
          requestedValue: request.requestedFullName || 'Necompletat',
          resultValue: request.requestedFullName || 'Necompletat',
        },
      ];
    }
    if (request.requestType === 'PHONE_CHANGE') {
      return [
        {
          field: 'phone',
          label: 'Telefon',
          currentValue: request.currentPhone || 'Necompletat',
          requestedValue: request.requestedPhone || 'Necompletat',
          resultValue: request.requestedPhone || 'Necompletat',
        },
      ];
    }
    if (request.requestType === 'EMAIL_CHANGE') {
      return [
        {
          field: 'email',
          label: 'Email locatar',
          currentValue: request.currentEmail || 'Necompletat',
          requestedValue: request.requestedEmail || 'Necompletat',
          resultValue: request.requestedEmail || 'Necompletat',
        },
      ];
    }
    if (request.requestType === 'CONTACT_METHOD_CHANGE') {
      return [
        {
          field: 'preferredContactMethod',
          label: 'Metodă contact',
          currentValue: request.currentPreferredContactMethod || 'Necompletat',
          requestedValue: request.requestedPreferredContactMethod || 'Necompletat',
          resultValue: request.requestedPreferredContactMethod || 'Necompletat',
        },
      ];
    }
    return [
      {
        field: 'message',
        label: this.requestTypeLabel(request.requestType),
        currentValue: 'Verificare manuală',
        requestedValue: request.message || 'Necompletat',
        resultValue: 'Decizie admin',
      },
    ];
  }

  private toAdminUpdateRequestRow(request: StoredResidentUpdateRequest, resident: any, apartment: any) {
    const apartments = (resident?.apartmentResidents || []).map((item) => this.apartmentSummary(item));
    const apartmentFallback = apartment || apartments[0] || null;
    const labels = this.requestValueLabels(request);
    return {
      id: request.id,
      requestType: request.requestType,
      requestTypeLabel: this.requestTypeLabel(request.requestType),
      status: request.status,
      resident: resident
        ? {
            id: resident.id,
            fullName: this.fullName(resident),
            phone: resident.phone || '',
            email: resident.email || '',
          }
        : {
            id: request.residentId,
            fullName: request.currentFullName || 'Locatar',
            phone: request.currentPhone || '',
            email: request.currentEmail || '',
          },
      apartment: apartmentFallback
        ? {
            id: apartmentFallback.id,
            apartmentNumber: apartmentFallback.number,
            staircase: apartmentFallback.staircase?.name || '',
            floor: apartmentFallback.floor === null || apartmentFallback.floor === undefined ? '' : String(apartmentFallback.floor),
          }
        : null,
      apartments: apartments.map((item) => ({
        id: item.id,
        apartmentNumber: item.number,
        staircase: item.staircase?.name || '',
        role: item.role,
        isPrimaryContact: item.isPrimary,
      })),
      currentValueLabel: labels.currentValueLabel,
      requestedValueLabel: labels.requestedValueLabel,
      message: request.message || '',
      adminResponse: request.adminResponse || '',
      internalNotes: request.internalNotes || '',
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt || null,
      cancelledAt: request.cancelledAt || null,
      appliedAt: request.appliedAt || null,
    };
  }

  private toAdminResidentRequestPreview(request: StoredResidentUpdateRequest) {
    const labels = this.requestValueLabels(request);
    return {
      id: request.id,
      requestType: request.requestType,
      requestTypeLabel: this.requestTypeLabel(request.requestType),
      status: request.status,
      currentValueLabel: labels.currentValueLabel,
      requestedValueLabel: labels.requestedValueLabel,
      message: request.message || '',
      adminResponse: request.adminResponse || '',
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt || null,
      cancelledAt: request.cancelledAt || null,
      appliedAt: request.appliedAt || null,
    };
  }

  private filterAdminUpdateRequestRows(rows: any[], query: Record<string, string | undefined>) {
    const status = String(query.status || '').trim().toUpperCase();
    const requestType = String(query.requestType || '').trim().toUpperCase();
    const apartmentId = String(query.apartmentId || '').trim();
    const staircase = String(query.staircase || '').trim().toLowerCase();
    const search = String(query.search || '').trim().toLowerCase();
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
    const dateTo = query.dateTo ? new Date(query.dateTo) : null;
    return rows.filter((row) => {
      const createdAt = new Date(row.createdAt || 0);
      const matchesStatus = !status || status === 'ALL' || row.status === status;
      const matchesType = !requestType || requestType === 'ALL' || row.requestType === requestType;
      const matchesApartment = !apartmentId || row.apartment?.id === apartmentId || row.apartments?.some((item) => item.id === apartmentId);
      const matchesStaircase = !staircase || String(row.apartment?.staircase || '').toLowerCase().includes(staircase);
      const matchesDateFrom = !dateFrom || createdAt >= dateFrom;
      const matchesDateTo = !dateTo || createdAt <= dateTo;
      const matchesSearch =
        !search ||
        [
          row.resident?.fullName,
          row.resident?.phone,
          row.resident?.email,
          row.currentValueLabel,
          row.requestedValueLabel,
          row.message,
          row.apartment?.apartmentNumber,
          ...(row.apartments || []).map((item) => item.apartmentNumber),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      return matchesStatus && matchesType && matchesApartment && matchesStaircase && matchesDateFrom && matchesDateTo && matchesSearch;
    });
  }

  private sortAdminUpdateRequestRows(rows: any[], sortBy?: string, sortDirection?: string) {
    const key = String(sortBy || 'newest');
    const direction = String(sortDirection || '').toLowerCase() === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (key === 'oldest') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      if (key === 'pending') {
        const aRank = a.status === 'PENDING' ? 0 : 1;
        const bRank = b.status === 'PENDING' ? 0 : 1;
        if (aRank !== bRank) return aRank - bRank;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (key === 'requestType') return String(a.requestType).localeCompare(String(b.requestType), 'ro') * (direction || 1);
      if (key === 'residentName') {
        return String(a.resident?.fullName || '').localeCompare(String(b.resident?.fullName || ''), 'ro') * (direction || 1);
      }
      return (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()) * direction;
    });
  }

  private adminUpdateRequestStats(rows: any[]) {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const sorted = [...rows].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return {
      pending: rows.filter((row) => row.status === 'PENDING').length,
      approved: rows.filter((row) => row.status === 'APPROVED').length,
      rejected: rows.filter((row) => row.status === 'REJECTED').length,
      cancelled: rows.filter((row) => row.status === 'CANCELLED').length,
      currentMonth: rows.filter((row) => {
        const createdAt = new Date(row.createdAt || 0);
        return createdAt.getMonth() === month && createdAt.getFullYear() === year;
      }).length,
      lastRequestAt: sorted[0]?.createdAt || null,
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

  private async readProfileUpdateRequests(organizationId: string): Promise<StoredResidentUpdateRequest[]> {
    const note = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: RESIDENT_PROFILE_UPDATE_REQUESTS_TITLE },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return [];
    try {
      const parsed = JSON.parse(note.content);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      return items.filter((item) => {
        const type = String(item?.requestType || '').toUpperCase();
        const status = String(item?.status || '').toUpperCase();
        return item?.id && item?.residentId && RESIDENT_UPDATE_REQUEST_TYPES.includes(type as any) && RESIDENT_UPDATE_REQUEST_STATUSES.includes(status as any);
      }) as StoredResidentUpdateRequest[];
    } catch {
      return [];
    }
  }

  private async writeProfileUpdateRequests(organizationId: string, userId: string, items: StoredResidentUpdateRequest[]) {
    const existing = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: RESIDENT_PROFILE_UPDATE_REQUESTS_TITLE },
      select: { id: true },
    });
    const content = JSON.stringify({ items });
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
        title: RESIDENT_PROFILE_UPDATE_REQUESTS_TITLE,
        content,
      },
    });
  }

  private async requireAdminUpdateRequest(organizationId: string, id: string) {
    const request = (await this.readProfileUpdateRequests(organizationId)).find((item) => item.id === id && item.associationId === organizationId);
    if (!request) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return request;
  }

  private async adminUpdateRequestDetail(organizationId: string, request: StoredResidentUpdateRequest) {
    const [organization, resident, metadata] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, legalName: true, fiscalCode: true },
      }),
      this.prisma.residentProfile.findFirst({
        where: { id: request.residentId, organizationId },
        select: this.residentSelect(),
      }),
      this.readResidentMetadata(organizationId),
    ]);
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (!resident) throw new NotFoundException('Locatarul nu a fost găsit.');
    const residentMetadata = metadata[resident.id] || {};
    const apartments = (resident.apartmentResidents || []).map((item) => this.toAdminApartmentLink(item, residentMetadata));
    const selectedApartment = request.apartmentId ? apartments.find((item) => item.apartmentId === request.apartmentId) : null;
    const status = this.toAdminResidentStatus(resident, residentMetadata);
    return {
      request: {
        ...request,
        requestTypeLabel: this.requestTypeLabel(request.requestType),
        internalNotes: request.internalNotes || null,
      },
      resident: {
        id: resident.id,
        fullName: this.fullName(resident),
        phone: resident.phone || '',
        email: resident.email || '',
        preferredContactMethod: residentMetadata.preferredContactMethod || 'PHONE',
        status,
      },
      association: {
        id: organization.id,
        shortName: organization.name,
        legalName: organization.legalName || organization.name,
        associationCode: organization.fiscalCode || '',
      },
      apartment: selectedApartment
        ? {
            id: selectedApartment.apartmentId,
            apartmentNumber: selectedApartment.apartmentNumber,
            staircase: selectedApartment.staircase,
            role: selectedApartment.role,
            isPrimaryContact: selectedApartment.isPrimaryContact,
          }
        : null,
      apartments,
      comparison: this.updateRequestComparison(request),
      availableActions: {
        canApprove: request.status === 'PENDING',
        canReject: request.status === 'PENDING',
        canCancel: false,
      },
    };
  }

  private async applyResidentUpdateRequest(
    user: MvpUser,
    organizationId: string,
    request: StoredResidentUpdateRequest,
    resident: { id: string; userId?: string | null; firstName?: string | null; lastName?: string | null; phone?: string | null; email?: string | null },
    payload: Record<string, unknown>,
  ) {
    const oldSnapshot = {
      fullName: this.fullName(resident),
      phone: resident.phone || null,
      email: resident.email || null,
    };
    if (request.requestType === 'FULL_NAME_CHANGE') {
      const requestedFullName = this.requiredString(request.requestedFullName, 'Numele solicitat este obligatoriu.');
      const { firstName, lastName } = this.splitFullName(requestedFullName);
      await this.prisma.residentProfile.update({
        where: { id: resident.id },
        data: { firstName, lastName },
      });
      if (resident.userId) {
        await this.prisma.user.update({
          where: { id: resident.userId },
          data: { firstName, lastName, fullName: requestedFullName },
        });
      }
      return {
        applied: true,
        oldSnapshot,
        newSnapshot: { ...oldSnapshot, fullName: requestedFullName },
        note: null,
      };
    }
    if (request.requestType === 'PHONE_CHANGE') {
      const requestedPhone = this.requiredString(request.requestedPhone, 'Telefonul solicitat este obligatoriu.');
      await this.prisma.residentProfile.update({
        where: { id: resident.id },
        data: { phone: requestedPhone.trim() },
      });
      return {
        applied: true,
        oldSnapshot,
        newSnapshot: { ...oldSnapshot, phone: requestedPhone.trim() },
        note: null,
      };
    }
    if (request.requestType === 'EMAIL_CHANGE') {
      const requestedEmail = this.requiredString(request.requestedEmail, 'Emailul solicitat este obligatoriu.').toLowerCase();
      if (!this.isValidEmail(requestedEmail)) throw new BadRequestException('Emailul nu este valid.');
      const duplicate = await this.prisma.residentProfile.findFirst({
        where: { organizationId, email: requestedEmail, id: { not: resident.id } },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Există deja o persoană cu acest email.');
      await this.prisma.residentProfile.update({
        where: { id: resident.id },
        data: { email: requestedEmail },
      });
      return {
        applied: true,
        oldSnapshot,
        newSnapshot: { ...oldSnapshot, email: requestedEmail },
        note: 'Emailul de autentificare rămâne neschimbat până la un flow separat de validare.',
      };
    }
    if (request.requestType === 'CONTACT_METHOD_CHANGE') {
      const requestedPreferredContactMethod = this.parsePreferredContactMethod(request.requestedPreferredContactMethod);
      await this.updateResidentMetadata(organizationId, user.id, {
        [resident.id]: { preferredContactMethod: requestedPreferredContactMethod },
      });
      return {
        applied: true,
        oldSnapshot,
        newSnapshot: { ...oldSnapshot, preferredContactMethod: requestedPreferredContactMethod },
        note: null,
      };
    }
    if (request.requestType === 'APARTMENT_RELATION_CHANGE') {
      const patch = payload.apartmentRelationPatch && typeof payload.apartmentRelationPatch === 'object'
        ? (payload.apartmentRelationPatch as Record<string, unknown>)
        : null;
      if (!patch) {
        return {
          applied: false,
          oldSnapshot,
          newSnapshot: null,
          note: 'Schimbarea relației cu apartamentul trebuie aplicată manual.',
        };
      }
      const input = this.parseResidentApartmentRelationBody(patch, true);
      const apartment = await this.prisma.apartment.findFirst({
        where: { id: input.apartmentId, organizationId },
        select: { id: true, number: true },
      });
      if (!apartment) throw new NotFoundException('Apartamentul nu a fost găsit.');
      const existing = await this.prisma.apartmentResident.findUnique({
        where: {
          apartmentId_residentId_role: {
            apartmentId: apartment.id,
            residentId: resident.id,
            role: input.role,
          },
        },
        select: { apartmentId: true },
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
              residentId: resident.id,
              role: input.role,
            },
          },
          data: { isPrimary: input.isPrimaryContact },
        });
      } else {
        await this.prisma.apartmentResident.create({
          data: {
            apartmentId: apartment.id,
            residentId: resident.id,
            role: input.role,
            isPrimary: input.isPrimaryContact,
          },
        });
      }
      if (input.isPrimaryContact) {
        await this.prisma.apartment.update({
          where: { id: apartment.id },
          data: { ownerResidentId: resident.id },
        });
      }
      await this.updateResidentRelationMetadata(organizationId, user.id, resident.id, apartment.id, input.role, input);
      return {
        applied: true,
        oldSnapshot,
        newSnapshot: {
          ...oldSnapshot,
          apartmentId: apartment.id,
          apartmentNumber: apartment.number,
          role: input.role,
          isPrimaryContact: input.isPrimaryContact,
        },
        note: null,
      };
    }
    return {
      applied: false,
      oldSnapshot,
      newSnapshot: null,
      note: 'Solicitarea a fost marcată ca rezolvată fără modificare automată.',
    };
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
