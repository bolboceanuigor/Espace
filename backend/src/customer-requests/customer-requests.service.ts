import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuthProvider,
  ClientAccountStatus,
  ClientActivityType,
  ClientLifecycleStage,
  ClientPriority,
  ClientSource,
  CustomerOnboardingRequestPriority,
  CustomerOnboardingRequestSource,
  CustomerOnboardingRequestStatus,
  CustomerOnboardingRequestType,
  InvitationStatus,
  OnboardingStatus,
  OrganizationMemberRole,
  OrganizationMemberStatus,
  OrganizationStatus,
  PlanCode,
  PlatformRole,
  Prisma,
  Role,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerOnboardingRequestDto,
  CustomerRequestAssignDto,
  CustomerRequestConvertDto,
  CustomerRequestNoteDto,
  CustomerRequestPriorityDto,
  CustomerRequestStatusDto,
  CustomerRequestUpdateDto,
} from './dto/customer-request.dto';

type NormalizedConversionInput = {
  organizationName: string;
  legalName?: string;
  shortName?: string;
  apcCode?: string;
  city: string;
  address?: string;
  adminName: string;
  adminEmail?: string;
  adminPhone: string;
  sendInvite: boolean;
  note?: string;
};

@Injectable()
export class CustomerRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPublic(dto: CreateCustomerOnboardingRequestDto, meta?: { ip?: string; userAgent?: string; path?: string }) {
    if (!dto.consent) throw new BadRequestException('Consimtamantul este obligatoriu.');
    if (dto.website?.trim()) return { success: true, message: 'Cererea a fost trimisa. Te vom contacta pentru configurarea accesului.' };
    const contactName = (dto.contactName || dto.fullName || '').trim();
    const city = dto.city?.trim();
    if (!contactName) throw new BadRequestException('Numele persoanei de contact este obligatoriu.');
    if (!city) throw new BadRequestException('Orasul este obligatoriu.');
    const phone = dto.phone.trim();
    if (phone.length < 6 || !/^[+()\d\s.-]+$/.test(phone)) throw new BadRequestException('Telefonul nu este valid.');
    const email = dto.email?.trim().toLowerCase() || null;
    const address = dto.address?.trim() || null;
    const associationName = dto.associationName?.trim() || dto.legalName?.trim() || 'Nespecificat';
    const apcCode = dto.apcCode?.trim() || dto.associationCode?.trim() || null;
    const recentCount = await this.prisma.customerOnboardingRequest.count({
      where: {
        phone,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    if (recentCount >= 3) {
      return { success: true, message: 'Cererea a fost trimisa. Te vom contacta pentru configurarea accesului.' };
    }
    const duplicate = await this.findRecentDuplicate({ phone, email, city, address });
    const request = await this.prisma.customerOnboardingRequest.create({
      data: {
        type: dto.type || CustomerOnboardingRequestType.APC,
        fullName: contactName,
        phone,
        email,
        associationName,
        legalName: dto.legalName?.trim() || null,
        associationCode: apcCode,
        apcCode,
        city,
        address,
        blocksCount: dto.blocksCount ?? null,
        apartmentsCount: dto.apartmentsCount ?? null,
        role: dto.contactRole?.trim() || dto.role?.trim() || null,
        contactRole: dto.contactRole?.trim() || dto.role?.trim() || null,
        currentManagementMethod: dto.currentManagementMethod?.trim() || null,
        interestedModules: (dto.interestedModules || []) as unknown as Prisma.InputJsonValue,
        preferredContactMethod: dto.preferredContactMethod?.trim() || null,
        message: dto.message?.trim() || null,
        source: dto.source || CustomerOnboardingRequestSource.ACCESS_REQUEST,
        status: CustomerOnboardingRequestStatus.NEW,
        priority: dto.apartmentsCount && dto.apartmentsCount >= 200 ? CustomerOnboardingRequestPriority.HIGH : CustomerOnboardingRequestPriority.NORMAL,
        possibleDuplicate: !!duplicate,
        duplicateOfRequestId: duplicate?.id || null,
        metadata: {
          ip: meta?.ip,
          userAgent: meta?.userAgent?.slice(0, 300),
          path: meta?.path,
          consent: true,
          possibleDuplicate: !!duplicate,
          duplicateOfRequestId: duplicate?.id || null,
        } as Prisma.InputJsonValue,
      },
    });
    await this.prisma.clientAccount.create({
      data: {
        customerRequestId: request.id,
        displayName: request.associationName || request.legalName || request.fullName,
        lifecycleStage: ClientLifecycleStage.NEW_REQUEST,
        priority: request.priority === CustomerOnboardingRequestPriority.HIGH ? ClientPriority.HIGH : request.priority === CustomerOnboardingRequestPriority.LOW ? ClientPriority.LOW : ClientPriority.NORMAL,
        source: request.source === CustomerOnboardingRequestSource.ACCESS_REQUEST ? ClientSource.ACCESS_REQUEST : request.source === CustomerOnboardingRequestSource.REFERRAL ? ClientSource.REFERRAL : ClientSource.PUBLIC_WEBSITE,
        contactName: request.fullName,
        contactPhone: request.phone,
        contactEmail: request.email,
        associationName: request.associationName,
        associationCode: request.apcCode || request.associationCode,
        address: request.address,
        apartmentsCount: request.apartmentsCount,
        metadata: { sourceRequest: 'public_access_request', city: request.city, requestType: request.type } as Prisma.InputJsonValue,
      },
    }).catch(() => undefined);
    return { success: true, message: 'Cererea a fost trimisa. Te vom contacta pentru configurarea accesului.' };
  }

  async list(filters: Record<string, string | undefined>) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 30)));
    const search = filters.search?.trim();
    const statusFilter = this.statusWhere(filters.status);
    const where: Prisma.CustomerOnboardingRequestWhereInput = {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(filters.type ? { type: filters.type as CustomerOnboardingRequestType } : {}),
      ...(filters.priority ? { priority: filters.priority as CustomerOnboardingRequestPriority } : {}),
      ...(filters.source ? { source: filters.source as CustomerOnboardingRequestSource } : {}),
      ...(filters.city ? { city: { contains: filters.city.trim(), mode: 'insensitive' } } : {}),
      ...(filters.preferredContactMethod ? { preferredContactMethod: filters.preferredContactMethod } : {}),
      ...(filters.dateFrom ? { createdAt: { gte: new Date(filters.dateFrom) } } : {}),
      ...(filters.dateTo ? { createdAt: { lte: new Date(filters.dateTo) } } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { associationName: { contains: search, mode: 'insensitive' } },
              { legalName: { contains: search, mode: 'insensitive' } },
              { associationCode: { contains: search, mode: 'insensitive' } },
              { apcCode: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total, stats] = await Promise.all([
      this.prisma.customerOnboardingRequest.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, fullName: true, email: true } },
          convertedAssociation: { select: { id: true, name: true, legalName: true } },
          convertedOrganization: { select: { id: true, name: true, legalName: true, onboardingStatus: true, onboardingStep: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customerOnboardingRequest.count({ where }),
      this.stats(),
    ]);
    return { items, meta: { page, limit, total }, stats };
  }

  stats() {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const allStatuses = Object.values(CustomerOnboardingRequestStatus);
    return Promise.all([
      ...allStatuses.map((status) => this.prisma.customerOnboardingRequest.count({ where: { status } })),
      this.prisma.customerOnboardingRequest.count({ where: { createdAt: { gte: currentMonth } } }),
      this.prisma.customerOnboardingRequest.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]).then((values) => {
      const counts = Object.fromEntries(allStatuses.map((status, index) => [status, values[index] as number]));
      const last = values[allStatuses.length + 1] as { createdAt: Date } | null;
      return { ...counts, currentMonth: values[allStatuses.length] as number, lastRequestAt: last?.createdAt || null };
    });
  }

  async get(id: string) {
    const request = await this.prisma.customerOnboardingRequest.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, fullName: true, email: true } },
        convertedAssociation: { select: { id: true, name: true, legalName: true, createdAt: true } },
        convertedOrganization: { select: { id: true, name: true, legalName: true, createdAt: true, onboardingStatus: true, onboardingStep: true } },
        convertedBy: { select: { id: true, fullName: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!request) throw new NotFoundException('Customer request not found');
    const possibleDuplicates = await this.findPossibleDuplicatesForRequest(request);
    return { ...request, possibleDuplicates };
  }

  async updateStatus(id: string, dto: CustomerRequestStatusDto) {
    await this.ensureExists(id);
    const now = new Date();
    const status = this.normalizeStatus(dto.status);
    return this.prisma.customerOnboardingRequest.update({
      where: { id },
      data: {
        status,
        contactedAt: status === CustomerOnboardingRequestStatus.CONTACTED ? now : undefined,
        lastContactedAt: status === CustomerOnboardingRequestStatus.CONTACTED ? now : undefined,
        qualifiedAt: status === CustomerOnboardingRequestStatus.QUALIFIED ? now : undefined,
        closedAt:
          status === CustomerOnboardingRequestStatus.CLOSED || status === CustomerOnboardingRequestStatus.REJECTED || status === CustomerOnboardingRequestStatus.SPAM
            ? now
            : undefined,
        closeReason: dto.closeReason,
      },
    });
  }

  async update(id: string, dto: CustomerRequestUpdateDto) {
    await this.ensureExists(id);
    const status = dto.status ? this.normalizeStatus(dto.status) : undefined;
    const lastContactedAt = dto.lastContactedAt === null || dto.lastContactedAt === '' ? null : dto.lastContactedAt ? new Date(dto.lastContactedAt) : undefined;
    const now = new Date();
    return this.prisma.customerOnboardingRequest.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId || null } : {}),
        ...(dto.internalNote !== undefined ? { internalNotes: dto.internalNote?.trim() || null } : {}),
        ...(lastContactedAt !== undefined ? { lastContactedAt, contactedAt: lastContactedAt } : {}),
        ...(status === CustomerOnboardingRequestStatus.CONTACTED ? { contactedAt: now, lastContactedAt: now } : {}),
        ...(status === CustomerOnboardingRequestStatus.QUALIFIED ? { qualifiedAt: now } : {}),
        ...(status === CustomerOnboardingRequestStatus.CLOSED || status === CustomerOnboardingRequestStatus.REJECTED || status === CustomerOnboardingRequestStatus.SPAM ? { closedAt: now } : {}),
      },
      include: {
        assignedTo: { select: { id: true, fullName: true, email: true } },
        convertedAssociation: { select: { id: true, name: true, legalName: true, createdAt: true } },
        convertedOrganization: { select: { id: true, name: true, legalName: true, createdAt: true, onboardingStatus: true, onboardingStep: true } },
      },
    });
  }

  async updatePriority(id: string, dto: CustomerRequestPriorityDto) {
    await this.ensureExists(id);
    return this.prisma.customerOnboardingRequest.update({ where: { id }, data: { priority: dto.priority } });
  }

  async addNote(id: string, dto: CustomerRequestNoteDto) {
    const existing = await this.get(id);
    const stamped = `[${new Date().toISOString()}] ${dto.note.trim()}`;
    return this.prisma.customerOnboardingRequest.update({
      where: { id },
      data: { internalNotes: [existing.internalNotes, stamped].filter(Boolean).join('\n\n') },
    });
  }

  async assign(id: string, dto: CustomerRequestAssignDto) {
    await this.ensureExists(id);
    return this.prisma.customerOnboardingRequest.update({ where: { id }, data: { assignedToId: dto.assignedToId || null } });
  }

  async convertToOrganization(id: string, dto: CustomerRequestConvertDto, actor: any) {
    const actorId = this.currentUserId(actor);

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.customerOnboardingRequest.findUnique({
        where: { id },
        include: {
          convertedAssociation: { select: { id: true, name: true } },
          convertedOrganization: { select: { id: true, name: true } },
        },
      });
      if (!request) throw new NotFoundException('Customer request not found');
      if (request.convertedOrganizationId || request.convertedAssociationId) {
        throw new ConflictException('Cererea a fost deja convertita intr-o organizatie.');
      }

      const input = this.normalizeConversionInput(dto, request);
      if (input.apcCode) {
        const duplicate = await tx.organization.findFirst({
          where: { fiscalCode: input.apcCode },
          select: { id: true, name: true },
        });
        if (duplicate) {
          throw new ConflictException('Exista deja o organizatie cu acest cod APC.');
        }
      }

      const now = new Date();
      const organization = await tx.organization.create({
        data: {
          name: input.shortName || input.organizationName,
          legalName: input.legalName || input.organizationName,
          fiscalCode: input.apcCode || null,
          address: input.address || null,
          city: input.city,
          country: 'MD',
          phone: input.adminPhone,
          email: input.adminEmail || null,
          administratorName: input.adminName,
          status: OrganizationStatus.TRIAL,
          subscriptionStatus: 'TRIAL',
          subscriptionPlan: 'FREE',
          ownerAdminId: null,
          onboardingCompleted: false,
          onboardingStatus: OnboardingStatus.IN_PROGRESS,
          onboardingStep: 'BASIC_INFO',
          onboardingCompletedAt: null,
          defaultLocale: 'ro',
          weekStart: 'MONDAY',
          isDemo: false,
          isActive: true,
          createdByAgentId: actorId,
        },
      });

      await tx.organizationSetting.create({
        data: {
          organizationId: organization.id,
          weekStart: 'MONDAY',
          defaultLocale: 'ro',
        },
      });

      const trialPlan = await tx.plan.upsert({
        where: { code: PlanCode.TRIAL },
        update: { name: 'Trial', priceMonthly: 0, currency: 'EUR' },
        create: { code: PlanCode.TRIAL, name: 'Trial', priceMonthly: 0, currency: 'EUR' },
        select: { id: true },
      });
      const trialEndsAt = new Date(now);
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);
      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planId: trialPlan.id,
          plan: 'starter',
          status: 'TRIAL',
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
          price: 0,
          apartmentLimit: 5,
          trialEndsAt,
          subscriptionEndsAt: null,
          isActive: true,
        },
      });

      await tx.onboardingChecklist.create({
        data: { organizationId: organization.id },
      });

      const admin = input.adminEmail ? await this.createInitialAdmin(tx, organization.id, input, actorId) : null;
      if (admin) {
        await tx.organization.update({
          where: { id: organization.id },
          data: { ownerAdminId: admin.id },
        });
      }

      const invitation = input.sendInvite && input.adminEmail
        ? await this.createAdminInvitation(tx, organization.id, input, actorId)
        : null;

      const mergedMetadata = this.mergeJsonObject(request.metadata, {
        conversion: {
          organizationId: organization.id,
          convertedById: actorId,
          convertedAt: now.toISOString(),
          initialAdminUserId: admin?.id || null,
          invitationId: invitation?.id || null,
          sendInvite: !!input.sendInvite,
          missingIdentifier: !input.apcCode,
        },
      });
      const internalNotes = input.note
        ? [request.internalNotes, `[${now.toISOString()}] Conversie in organizatie: ${input.note}`].filter(Boolean).join('\n\n')
        : request.internalNotes;

      const updatedRequest = await tx.customerOnboardingRequest.update({
        where: { id: request.id },
        data: {
          status: CustomerOnboardingRequestStatus.CONVERTED,
          convertedAt: now,
          convertedById: actorId,
          convertedOrganizationId: organization.id,
          convertedAssociationId: organization.id,
          conversionNote: input.note || null,
          qualifiedAt: request.qualifiedAt || now,
          internalNotes,
          metadata: mergedMetadata as Prisma.InputJsonValue,
        },
        include: {
          assignedTo: { select: { id: true, fullName: true, email: true } },
          convertedAssociation: { select: { id: true, name: true, legalName: true, createdAt: true } },
          convertedOrganization: { select: { id: true, name: true, legalName: true, createdAt: true, onboardingStatus: true, onboardingStep: true } },
          convertedBy: { select: { id: true, fullName: true, firstName: true, lastName: true, email: true } },
        },
      });

      const clientAccount = await this.upsertClientAccountAfterConversion(tx, updatedRequest, organization.id, input, actorId);
      if (clientAccount) {
        await tx.clientActivity.createMany({
          data: [
            {
              clientAccountId: clientAccount.id,
              associationId: organization.id,
              actorUserId: actorId,
              type: ClientActivityType.ASSOCIATION_LINKED,
              title: 'Organizatie creata din cerere',
              message: `Cererea de acces a fost convertita in ${organization.name}.`,
              metadata: { requestId: request.id, organizationId: organization.id } as Prisma.InputJsonValue,
            },
            {
              clientAccountId: clientAccount.id,
              associationId: organization.id,
              actorUserId: actorId,
              type: ClientActivityType.ONBOARDING_STARTED,
              title: 'Onboarding initial creat',
              message: 'Organizatia a primit statusul initial de onboarding.',
              metadata: { onboardingStep: 'BASIC_INFO', missingIdentifier: !input.apcCode } as Prisma.InputJsonValue,
            },
          ],
        });
      }

      await tx.auditLog.createMany({
        data: [
          {
            organizationId: organization.id,
            userId: actorId,
            action: 'ACCESS_REQUEST_CONVERTED',
            entityType: 'CustomerOnboardingRequest',
            entityId: request.id,
            description: `Cererea de acces ${request.fullName} a fost convertita in organizatie.`,
            oldValuesJson: { status: request.status } as Prisma.InputJsonValue,
            newValuesJson: { status: CustomerOnboardingRequestStatus.CONVERTED, organizationId: organization.id } as Prisma.InputJsonValue,
          },
          {
            organizationId: organization.id,
            userId: actorId,
            action: 'ORGANIZATION_CREATED_FROM_REQUEST',
            entityType: 'Organization',
            entityId: organization.id,
            description: `Organizatia ${organization.name} a fost creata dintr-o cerere de acces.`,
            oldValuesJson: Prisma.JsonNull,
            newValuesJson: { requestId: request.id, organizationId: organization.id } as Prisma.InputJsonValue,
          },
        ],
      });

      return {
        success: true,
        message: 'Cererea a fost convertita in organizatie.',
        request: updatedRequest,
        organization: {
          id: organization.id,
          name: organization.name,
          legalName: organization.legalName,
          fiscalCode: organization.fiscalCode,
          city: organization.city,
          address: organization.address,
          onboardingStatus: organization.onboardingStatus,
          onboardingStep: organization.onboardingStep,
          createdAt: organization.createdAt,
        },
        admin,
        invitation: invitation
          ? {
              id: invitation.id,
              email: invitation.email,
              status: invitation.status,
              expiresAt: invitation.expiresAt,
              inviteLink: this.buildInviteLink(invitation.token),
            }
          : null,
        onboarding: {
          status: organization.onboardingStatus,
          step: organization.onboardingStep,
          initialChecklistCreated: true,
          missingIdentifier: !input.apcCode,
        },
      };
    });
  }

  async convertToAssociation(id: string, actor: any) {
    const request = await this.prisma.customerOnboardingRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Customer request not found');
    return this.convertToOrganization(
      id,
      {
        organizationName: request.associationName || request.legalName || `APC ${request.fullName}`,
        legalName: request.legalName || request.associationName || undefined,
        shortName: request.associationName || undefined,
        apcCode: request.apcCode || request.associationCode || undefined,
        city: request.city || '',
        address: request.address || undefined,
        adminName: request.fullName,
        adminPhone: request.phone,
        adminEmail: request.email || undefined,
        sendInvite: false,
      },
      actor,
    );
  }

  private async createInitialAdmin(
    tx: Prisma.TransactionClient,
    organizationId: string,
    input: NormalizedConversionInput,
    actorId: string,
  ) {
    if (!input.adminEmail) return null;
    const existing = await tx.user.findFirst({
      where: { email: input.adminEmail, deletedAt: null },
      select: { id: true, organizationId: true },
    });
    if (existing && existing.organizationId !== organizationId) {
      throw new ConflictException('Exista deja un utilizator cu acest email in alta organizatie.');
    }

    const nameParts = this.splitName(input.adminName);
    const admin = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            role: Role.ADMIN,
            platformRole: PlatformRole.ORGANIZATION_USER,
            organizationId,
            phone: input.adminPhone,
            fullName: input.adminName,
            firstName: nameParts.firstName,
            lastName: nameParts.lastName,
            isActive: true,
          },
          select: this.adminSelect(),
        })
      : await tx.user.create({
          data: {
            email: input.adminEmail,
            passwordHash: null,
            authProvider: AuthProvider.LOCAL,
            emailVerifiedAt: null,
            fullName: input.adminName,
            firstName: nameParts.firstName,
            lastName: nameParts.lastName,
            phone: input.adminPhone,
            role: Role.ADMIN,
            platformRole: PlatformRole.ORGANIZATION_USER,
            preferredLanguage: 'RO',
            organizationId,
            isActive: true,
            isDemoUser: false,
          },
          select: this.adminSelect(),
        });

    await tx.organizationMember.upsert({
      where: { userId: admin.id },
      update: {
        organizationId,
        role: OrganizationMemberRole.ORG_ADMIN,
        status: OrganizationMemberStatus.ACTIVE,
        activatedAt: new Date(),
      },
      create: {
        organizationId,
        userId: admin.id,
        role: OrganizationMemberRole.ORG_ADMIN,
        status: OrganizationMemberStatus.ACTIVE,
        activatedAt: new Date(),
        createdById: actorId,
      },
    });

    return admin;
  }

  private async createAdminInvitation(
    tx: Prisma.TransactionClient,
    organizationId: string,
    input: NormalizedConversionInput,
    actorId: string,
  ) {
    if (!input.adminEmail) return null;
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return tx.invitation.create({
      data: {
        organizationId,
        email: input.adminEmail,
        phone: input.adminPhone,
        role: Role.ADMIN,
        token,
        status: InvitationStatus.PENDING,
        expiresAt,
        invitedByUserId: actorId,
      },
    });
  }

  private async upsertClientAccountAfterConversion(
    tx: Prisma.TransactionClient,
    request: {
      id: string;
      fullName: string;
      phone: string;
      email: string | null;
      associationName: string;
      associationCode: string | null;
      apcCode: string | null;
      address: string | null;
      apartmentsCount: number | null;
      priority: CustomerOnboardingRequestPriority;
      internalNotes: string | null;
    },
    organizationId: string,
    input: NormalizedConversionInput,
    actorId: string,
  ) {
    const existing = await tx.clientAccount.findFirst({ where: { customerRequestId: request.id }, select: { id: true } });
    const data = {
      associationId: organizationId,
      lifecycleStage: ClientLifecycleStage.ONBOARDING,
      status: ClientAccountStatus.ACTIVE,
      displayName: input.organizationName,
      contactName: input.adminName,
      contactPhone: input.adminPhone,
      contactEmail: input.adminEmail || request.email,
      associationName: input.organizationName,
      associationCode: input.apcCode || request.apcCode || request.associationCode,
      apartmentsCount: request.apartmentsCount,
      address: input.address || request.address,
      onboardingStartedAt: new Date(),
      updatedById: actorId,
      metadata: {
        convertedFromAccessRequestId: request.id,
        missingIdentifier: !input.apcCode,
      } as Prisma.InputJsonValue,
    };
    if (existing) {
      return tx.clientAccount.update({ where: { id: existing.id }, data, select: { id: true } });
    }
    return tx.clientAccount.create({
      data: {
        ...data,
        customerRequestId: request.id,
        priority: request.priority === CustomerOnboardingRequestPriority.HIGH ? ClientPriority.HIGH : request.priority === CustomerOnboardingRequestPriority.LOW ? ClientPriority.LOW : ClientPriority.NORMAL,
        source: ClientSource.ACCESS_REQUEST,
        createdById: actorId,
      },
      select: { id: true },
    });
  }

  private normalizeConversionInput(dto: Partial<CustomerRequestConvertDto>, request: {
    associationName: string;
    legalName: string | null;
    associationCode: string | null;
    apcCode: string | null;
    city: string | null;
    address: string | null;
    fullName: string;
    phone: string;
    email: string | null;
  }): NormalizedConversionInput {
    const organizationName = this.requiredTrim(dto.organizationName || request.associationName || request.legalName || '', 'Numele organizatiei este obligatoriu.');
    const city = this.requiredTrim(dto.city || request.city || '', 'Orasul este obligatoriu.');
    const adminName = this.requiredTrim(dto.adminName || request.fullName || '', 'Numele administratorului este obligatoriu.');
    const adminPhone = this.requiredTrim(dto.adminPhone || request.phone || '', 'Telefonul administratorului este obligatoriu.');
    if (adminPhone.length < 6 || !/^[+()\d\s.-]+$/.test(adminPhone)) {
      throw new BadRequestException('Telefonul administratorului nu este valid.');
    }
    const adminEmail = this.optionalTrim(dto.adminEmail || request.email || '')?.toLowerCase();
    if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      throw new BadRequestException('Emailul administratorului nu este valid.');
    }
    return {
      organizationName,
      legalName: this.optionalTrim(dto.legalName || request.legalName || ''),
      shortName: this.optionalTrim(dto.shortName || organizationName),
      apcCode: this.optionalTrim(dto.apcCode || request.apcCode || request.associationCode || '')?.toUpperCase(),
      city,
      address: this.optionalTrim(dto.address || request.address || ''),
      adminName,
      adminEmail: adminEmail || undefined,
      adminPhone,
      sendInvite: dto.sendInvite === true,
      note: this.optionalTrim(dto.note || ''),
    };
  }

  private adminSelect() {
    return {
      id: true,
      email: true,
      fullName: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      organizationId: true,
      isActive: true,
      createdAt: true,
    } as const;
  }

  private currentUserId(actor: any) {
    const id = actor?.id || actor?.sub || actor?.userId;
    if (!id) throw new BadRequestException('Utilizatorul curent nu este disponibil.');
    return String(id);
  }

  private splitName(value: string) {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] || value.trim(),
      lastName: parts.slice(1).join(' ') || null,
    };
  }

  private requiredTrim(value: string | null | undefined, message: string) {
    const next = String(value || '').trim();
    if (!next) throw new BadRequestException(message);
    return next;
  }

  private optionalTrim(value: string | null | undefined) {
    return String(value || '').trim() || undefined;
  }

  private mergeJsonObject(base: Prisma.JsonValue | null | undefined, patch: Record<string, unknown>) {
    const source = base && typeof base === 'object' && !Array.isArray(base) ? base as Record<string, unknown> : {};
    return { ...source, ...patch };
  }

  private buildInviteLink(token: string) {
    const appUrl = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    return `${appUrl}/ro/accept-invitation/${token}`;
  }

  private async findRecentDuplicate(input: { phone: string; email?: string | null; city?: string | null; address?: string | null }) {
    const or: Prisma.CustomerOnboardingRequestWhereInput[] = [{ phone: input.phone }];
    if (input.email) or.push({ email: input.email });
    const where: Prisma.CustomerOnboardingRequestWhereInput = {
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      OR: or,
      ...(input.city ? { city: { equals: input.city, mode: 'insensitive' } } : {}),
      ...(input.address ? { address: { equals: input.address, mode: 'insensitive' } } : {}),
    };
    return this.prisma.customerOnboardingRequest.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
  }

  private async findPossibleDuplicatesForRequest(request: { id: string; phone: string; email?: string | null; city?: string | null; address?: string | null }) {
    const or: Prisma.CustomerOnboardingRequestWhereInput[] = [{ phone: request.phone }];
    if (request.email) or.push({ email: request.email });
    if (!or.length) return [];
    return this.prisma.customerOnboardingRequest.findMany({
      where: {
        id: { not: request.id },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        OR: or,
        ...(request.city ? { city: { equals: request.city, mode: 'insensitive' } } : {}),
        ...(request.address ? { address: { equals: request.address, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, fullName: true, phone: true, email: true, associationName: true, city: true, address: true, createdAt: true, status: true },
    });
  }

  private normalizeStatus(status: CustomerOnboardingRequestStatus) {
    if (String(status) === 'IN_ONBOARDING') return CustomerOnboardingRequestStatus.ONBOARDING;
    if (String(status) === 'CLOSED') return CustomerOnboardingRequestStatus.REJECTED;
    return status;
  }

  private statusWhere(status?: string) {
    if (!status) return undefined;
    if (status === 'ONBOARDING' || status === 'IN_ONBOARDING') {
      return { in: [CustomerOnboardingRequestStatus.ONBOARDING, CustomerOnboardingRequestStatus.IN_ONBOARDING] };
    }
    if (status === 'REJECTED' || status === 'CLOSED') {
      return { in: [CustomerOnboardingRequestStatus.REJECTED, CustomerOnboardingRequestStatus.CLOSED] };
    }
    return status as CustomerOnboardingRequestStatus;
  }

  private async ensureExists(id: string) {
    const existing = await this.prisma.customerOnboardingRequest.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Customer request not found');
  }
}
