import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingCurrency, ContractPricingModel, OnboardingStatus, OrganizationLaunchStatus, OrganizationStatus, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import { AuditService } from '../audit/audit.service';
import type { MvpUser } from '../security/mvp-auth.guard';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityMvpService,
    private readonly audit: AuditService,
  ) {}

  private readonly publicSelect = {
    id: true,
    name: true,
    legalName: true,
    fiscalCode: true,
    address: true,
    city: true,
    country: true,
    currency: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    users: {
      where: {
        role: Role.ADMIN,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    },
    _count: {
      select: {
        apartments: true,
        users: true,
      },
    },
    accessRequestsConverted: {
      orderBy: { convertedAt: 'desc' as const },
      take: 1,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        associationName: true,
        createdAt: true,
        convertedAt: true,
      },
    },
    customerOnboardingRequests: {
      orderBy: { convertedAt: 'desc' as const },
      take: 1,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        associationName: true,
        createdAt: true,
        convertedAt: true,
      },
    },
  } as const;

  private readonly adminSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    role: true,
    organizationId: true,
    createdAt: true,
    organization: {
      select: {
        id: true,
        name: true,
        legalName: true,
        fiscalCode: true,
      },
    },
    isActive: true,
    updatedAt: true,
  } as const;

  private toPublicOrganization(organization: {
    id: string;
    name: string;
    legalName: string | null;
    fiscalCode: string | null;
    address: string | null;
    city: string | null;
    country: string;
    currency: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    _count?: {
      apartments?: number;
      users?: number;
    };
    users?: Array<{
      firstName: string | null;
      lastName: string | null;
      email: string;
      phone: string | null;
    }>;
    accessRequestsConverted?: Array<{
      id: string;
      fullName: string;
      phone: string;
      email: string | null;
      associationName: string;
      createdAt: Date;
      convertedAt: Date | null;
    }>;
    customerOnboardingRequests?: Array<{
      id: string;
      fullName: string;
      phone: string;
      email: string | null;
      associationName: string;
      createdAt: Date;
      convertedAt: Date | null;
    }>;
  }) {
    const associationCode = organization.fiscalCode || this.extractAssociationCode(organization.name, organization.legalName);
    const primaryAdmin = organization.users?.[0] ?? null;
    const createdFromAccessRequest = organization.accessRequestsConverted?.[0] ?? organization.customerOnboardingRequests?.[0] ?? null;
    return {
      id: organization.id,
      name: organization.name,
      shortName: organization.name,
      legalName: organization.legalName || this.legalNameForCode(associationCode) || organization.name,
      associationCode,
      associationNumber: this.associationNumberFromCode(associationCode),
      address: organization.address,
      city: organization.city,
      country: this.normalizeCountryLabel(organization.country),
      currency: organization.currency,
      status: organization.status,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      apartmentsCount: organization._count?.apartments ?? 0,
      usersCount: organization._count?.users ?? 0,
      adminsCount: organization.users?.length ?? 0,
      administratorName: this.fullName(primaryAdmin) || 'Administrator neatribuit',
      administratorEmail: primaryAdmin?.email ?? '',
      administratorPhone: primaryAdmin?.phone ?? '',
      createdFromAccessRequest: createdFromAccessRequest
        ? {
            id: createdFromAccessRequest.id,
            contactName: createdFromAccessRequest.fullName,
            phone: createdFromAccessRequest.phone,
            email: createdFromAccessRequest.email,
            associationName: createdFromAccessRequest.associationName,
            requestedAt: createdFromAccessRequest.createdAt,
            convertedAt: createdFromAccessRequest.convertedAt,
          }
      : null,
    };
  }

  async getSuperadminOrganizationDetail(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        legalName: true,
        fiscalCode: true,
        address: true,
        city: true,
        country: true,
        phone: true,
        email: true,
        currency: true,
        defaultCurrency: true,
        status: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        onboardingCompleted: true,
        onboardingStatus: true,
        onboardingStep: true,
        launchStatus: true,
        onboardingStartedAt: true,
        onboardingCompletedAt: true,
        launchedAt: true,
        onboardingNote: true,
        internalNote: true,
        launchChecklistJson: true,
        adminHandoverStatus: true,
        adminInvitedAt: true,
        adminAcceptedAt: true,
        adminFirstLoginAt: true,
        adminHandoverNote: true,
        adminFirstLoginChecklistJson: true,
        createdAt: true,
        updatedAt: true,
        settings: {
          select: {
            id: true,
            maintenanceFeePerM2: true,
            repairFundPerM2: true,
            developmentFundFixed: true,
            contactPhone: true,
            contactEmail: true,
            workingHours: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        subscription: {
          include: {
            planDefinition: true,
          },
        },
        subscriptionContracts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            plan: true,
          },
        },
        commercialContracts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            createdBy: { select: { id: true, email: true, fullName: true, firstName: true, lastName: true } },
            updatedBy: { select: { id: true, email: true, fullName: true, firstName: true, lastName: true } },
          },
        },
        billingInvoices: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            dueDate: true,
            paidAt: true,
            createdAt: true,
          },
        },
        billingPayments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organizația nu a fost găsită.');
    }

    const [
      users,
      buildings,
      apartments,
      documents,
      latestInvoices,
      latestPayments,
      latestAnnouncements,
      adminInvitations,
      sourceRequest,
      lastActivity,
      stats,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { organizationId: id, deletedAt: null },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        take: 100,
        select: {
          id: true,
          email: true,
          fullName: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          platformRole: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          organizationMember: {
            select: {
              role: true,
              status: true,
              invitedAt: true,
              activatedAt: true,
              suspendedAt: true,
              revokedAt: true,
            },
          },
        },
      }),
      this.prisma.building.findMany({
        where: { organizationId: id },
        orderBy: [{ name: 'asc' }],
        select: {
          id: true,
          name: true,
          address: true,
          totalFloors: true,
          staircasesCount: true,
          apartmentsCount: true,
          createdAt: true,
          staircases: {
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              floorsCount: true,
              _count: { select: { apartments: true } },
            },
          },
          _count: { select: { staircases: true, apartments: true } },
        },
      }),
      this.prisma.apartment.findMany({
        where: { organizationId: id, archivedAt: null },
        orderBy: [{ building: { name: 'asc' } }, { staircase: { name: 'asc' } }, { number: 'asc' }],
        take: 50,
        select: {
          id: true,
          number: true,
          floor: true,
          areaM2: true,
          status: true,
          createdAt: true,
          building: { select: { id: true, name: true } },
          staircase: { select: { id: true, name: true } },
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
            take: 3,
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
                  type: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.document.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          title: true,
          description: true,
          fileName: true,
          fileType: true,
          targetType: true,
          createdAt: true,
          updatedAt: true,
          uploadedBy: {
            select: {
              id: true,
              email: true,
              fullName: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.invoice.findMany({
        where: { organizationId: id },
        orderBy: { issuedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          amount: true,
          finalAmount: true,
          status: true,
          month: true,
          year: true,
          issuedAt: true,
          dueDate: true,
          paidAt: true,
        },
      }),
      this.prisma.payment.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          amount: true,
          currency: true,
          method: true,
          status: true,
          paidAt: true,
          createdAt: true,
        },
      }),
      this.prisma.announcement.findMany({
        where: { organizationId: id, archivedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          importance: true,
          createdAt: true,
        },
      }),
      this.prisma.invitation.findMany({
        where: { organizationId: id, role: Role.ADMIN },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          expiresAt: true,
          acceptedAt: true,
          createdAt: true,
          acceptedBy: {
            select: {
              id: true,
              fullName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.customerOnboardingRequest.findFirst({
        where: {
          OR: [{ convertedOrganizationId: id }, { convertedAssociationId: id }],
        },
        orderBy: [{ convertedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          associationName: true,
          legalName: true,
          apcCode: true,
          associationCode: true,
          city: true,
          address: true,
          status: true,
          priority: true,
          createdAt: true,
          convertedAt: true,
        },
      }),
      this.prisma.auditLog.findFirst({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          description: true,
          createdAt: true,
          user: { select: { id: true, email: true, fullName: true, firstName: true, lastName: true } },
        },
      }),
      this.organizationStats(id),
    ]);

    const loginRows = users.length
      ? await this.prisma.auditLog.findMany({
          where: { organizationId: id, userId: { in: users.map((user) => user.id) }, action: 'LOGIN_SUCCESS' },
          orderBy: { createdAt: 'desc' },
          select: { userId: true, createdAt: true },
        })
      : [];
    const lastLoginByUser = new Map<string, Date>();
    for (const row of loginRows) {
      if (!lastLoginByUser.has(row.userId)) lastLoginByUser.set(row.userId, row.createdAt);
    }

    const mappedUsers = users.map((user) => ({
      id: user.id,
      name: this.fullName(user),
      email: user.email,
      phone: user.phone,
      role: user.role,
      platformRole: user.platformRole,
      status: user.isActive ? 'ACTIVE' : 'INACTIVE',
      isActive: user.isActive,
      membershipRole: user.organizationMember?.role || null,
      membershipStatus: user.organizationMember?.status || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: lastLoginByUser.get(user.id) || null,
    }));
    const mainAdmin = mappedUsers.find((user) => user.role === Role.ADMIN && user.isActive) ?? mappedUsers.find((user) => user.role === Role.ADMIN) ?? null;
    const warnings = this.organizationDetailWarnings(organization, stats, mainAdmin);
    const onboarding = this.organizationDetailOnboarding(organization, stats);
    const commercialContract = organization.commercialContracts[0] || null;
    const platformSubscription = organization.subscriptionContracts[0] || null;
    const estimatedMonthlyAmount = this.detailEstimatedMonthlyAmount(commercialContract, platformSubscription, stats.apartmentsCount);
    const contract = commercialContract ? this.toCommercialContract(commercialContract) : null;
    const commercialSubscription = platformSubscription ? this.toCommercialSubscription(platformSubscription) : null;
    const contractSummary = {
      contractStatus: contract?.status || 'NOT_STARTED',
      subscriptionStatus: commercialSubscription?.status || null,
      planName: commercialSubscription?.planName || null,
      estimatedMonthlyAmount,
      calculatedMonthlyAmount: estimatedMonthlyAmount,
      billingCycle: contract?.billingCycle || null,
      pricingModel: contract?.pricingModel || null,
      warnings: this.commercialWarnings(contract, commercialSubscription, stats.apartmentsCount),
    };

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        shortName: organization.name,
        legalName: organization.legalName,
        apcCode: organization.fiscalCode,
        associationCode: organization.fiscalCode,
        city: organization.city,
        address: organization.address,
        country: organization.country,
        contactPhone: organization.phone || organization.settings?.contactPhone || null,
        contactEmail: organization.email || organization.settings?.contactEmail || null,
        currency: organization.currency,
        defaultCurrency: organization.defaultCurrency,
        status: organization.status,
        onboardingStatus: organization.onboardingStatus,
        onboardingStep: organization.onboardingStep,
        launchStatus: organization.launchStatus,
        onboardingStartedAt: organization.onboardingStartedAt,
        onboardingCompletedAt: organization.onboardingCompletedAt,
        launchedAt: organization.launchedAt,
        onboardingNote: organization.onboardingNote,
        internalNote: organization.internalNote,
        adminHandoverStatus: organization.adminHandoverStatus,
        adminInvitedAt: organization.adminInvitedAt,
        adminAcceptedAt: organization.adminAcceptedAt,
        adminFirstLoginAt: organization.adminFirstLoginAt,
        adminHandoverNote: organization.adminHandoverNote,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
      sourceAccessRequest: sourceRequest
        ? {
            id: sourceRequest.id,
            contactName: sourceRequest.fullName,
            phone: sourceRequest.phone,
            email: sourceRequest.email,
            associationName: sourceRequest.associationName,
            legalName: sourceRequest.legalName,
            apcCode: sourceRequest.apcCode || sourceRequest.associationCode,
            city: sourceRequest.city,
            address: sourceRequest.address,
            status: sourceRequest.status,
            priority: sourceRequest.priority,
            createdAt: sourceRequest.createdAt,
            convertedAt: sourceRequest.convertedAt,
          }
        : null,
      mainAdmin,
      adminHandover: {
        status: organization.adminHandoverStatus,
        invitedAt: organization.adminInvitedAt,
        acceptedAt: organization.adminAcceptedAt,
        firstLoginAt: organization.adminFirstLoginAt,
        note: organization.adminHandoverNote,
        checklist: organization.adminFirstLoginChecklistJson,
        mainAdmin,
        invitations: adminInvitations.map((invitation) => ({
          id: invitation.id,
          name: invitation.name,
          email: invitation.email,
          phone: invitation.phone,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          acceptedAt: invitation.acceptedAt,
          createdAt: invitation.createdAt,
          acceptedBy: invitation.acceptedBy
            ? {
                id: invitation.acceptedBy.id,
                name: this.fullName(invitation.acceptedBy),
                email: invitation.acceptedBy.email,
              }
            : null,
        })),
      },
      users: mappedUsers,
      usersMeta: { returned: mappedUsers.length, total: stats.usersCount },
      stats,
      onboarding,
      warnings,
      structure: {
        buildings: buildings.map((building) => ({
          id: building.id,
          name: building.name,
          address: building.address,
          totalFloors: building.totalFloors,
          staircasesCount: building._count.staircases || building.staircasesCount,
          apartmentsCount: building._count.apartments || building.apartmentsCount,
          createdAt: building.createdAt,
          staircases: building.staircases.map((staircase) => ({
            id: staircase.id,
            name: staircase.name,
            floorsCount: staircase.floorsCount,
            apartmentsCount: staircase._count.apartments,
          })),
        })),
      },
      apartments: {
        items: apartments.map((apartment) => ({
          id: apartment.id,
          number: apartment.number,
          floor: apartment.floor,
          areaM2: apartment.areaM2,
          status: apartment.status,
          createdAt: apartment.createdAt,
          building: apartment.building,
          staircase: apartment.staircase,
          ownerResident: apartment.ownerResident ? this.toResidentSummary(apartment.ownerResident) : null,
          residents: apartment.apartmentResidents.map((link) => ({
            role: link.role,
            isPrimary: link.isPrimary,
            resident: this.toResidentSummary(link.resident),
          })),
        })),
        meta: { returned: apartments.length, total: stats.apartmentsCount, limit: 50 },
      },
      billing: {
        configured: Boolean(organization.settings || organization.subscription || organization.subscriptionContracts.length),
        settings: organization.settings,
        legacySubscription: organization.subscription
          ? {
              id: organization.subscription.id,
              plan: organization.subscription.plan,
              status: organization.subscription.status,
              price: organization.subscription.customPrice ?? organization.subscription.price,
              apartmentLimit: organization.subscription.apartmentLimit,
              trialEndsAt: organization.subscription.trialEndsAt,
              currentPeriodStart: organization.subscription.currentPeriodStart,
              currentPeriodEnd: organization.subscription.currentPeriodEnd,
              planDefinition: organization.subscription.planDefinition,
            }
          : null,
        platformSubscription: organization.subscriptionContracts[0]
          ? {
              id: organization.subscriptionContracts[0].id,
              planName: organization.subscriptionContracts[0].planName || organization.subscriptionContracts[0].plan?.name || null,
              plan: organization.subscriptionContracts[0].plan,
              billingType: organization.subscriptionContracts[0].billingType,
              price: organization.subscriptionContracts[0].price,
              currentMonthlyAmount: organization.subscriptionContracts[0].price,
              currency: organization.subscriptionContracts[0].currency,
              status: organization.subscriptionContracts[0].status,
              nextBillingDate: organization.subscriptionContracts[0].nextBillingDate,
              startedAt: organization.subscriptionContracts[0].subscriptionStartDate,
              trialEndsAt: organization.subscriptionContracts[0].trialEndDate,
              outstandingAmount: organization.subscriptionContracts[0].outstandingAmount,
              internalNote: organization.subscriptionContracts[0].notes,
              notes: organization.subscriptionContracts[0].notes,
            }
          : null,
        invoicesCount: stats.invoicesCount,
        paymentsCount: stats.paymentsCount,
        platformInvoicesCount: stats.platformInvoicesCount,
        platformPaymentsCount: stats.platformPaymentsCount,
        latestInvoices,
        latestPayments,
        latestPlatformInvoice: organization.billingInvoices[0] || null,
        latestPlatformPayment: organization.billingPayments[0] || null,
      },
      documents: {
        items: documents.map((document) => ({
          ...document,
          uploadedBy: document.uploadedBy
            ? {
                id: document.uploadedBy.id,
                name: this.fullName(document.uploadedBy),
                email: document.uploadedBy.email,
              }
            : null,
        })),
        meta: { returned: documents.length, total: stats.documentsCount, limit: 25 },
      },
      announcements: latestAnnouncements,
      contract,
      subscription: commercialSubscription,
      contractSummary,
      lastActivity: lastActivity ? this.toOrganizationActivityItem(lastActivity, 'audit') : null,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      launchedAt: organization.launchedAt,
    };
  }

  async updateSuperadminOrganization(id: string, body: unknown, actor?: MvpUser) {
    const existing = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        legalName: true,
        fiscalCode: true,
        address: true,
        city: true,
        phone: true,
        email: true,
        status: true,
        internalNote: true,
        onboardingStatus: true,
        launchStatus: true,
      },
    });
    if (!existing) throw new NotFoundException('Organizația nu a fost găsită.');

    const input = this.parseSuperadminOrganizationUpdate(body);
    if (input.data.fiscalCode) {
      const duplicate = await this.prisma.organization.findFirst({
        where: {
          id: { not: id },
          fiscalCode: { equals: String(input.data.fiscalCode), mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Există deja o organizație cu acest cod APC.');
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: input.data,
      select: {
        id: true,
        name: true,
        legalName: true,
        fiscalCode: true,
        address: true,
        city: true,
        phone: true,
        email: true,
        status: true,
        internalNote: true,
        onboardingStatus: true,
        launchStatus: true,
      },
    });

    await this.audit.record({
      actorId: actor?.id,
      actorRole: actor?.role,
      organizationId: id,
      action: 'ORGANIZATION_UPDATED',
      entityType: 'ORGANIZATION',
      entityId: id,
      title: 'Fișă organizație actualizată',
      description: `Fișa organizației ${updated.name} a fost actualizată.`,
      severity: 'INFO',
      before: existing,
      after: updated,
      metadata: { changedFields: Object.keys(input.audit) },
      actionUrl: `/ro/superadmin/organizations/${id}`,
    }).catch(() => null);

    return this.getSuperadminOrganizationDetail(id);
  }

  async getSuperadminOrganizationActivity(id: string, query: Record<string, string | undefined> = {}) {
    return this.audit.listOrganizationActivity(id, query);
  }

  async listPublicOrganizations() {
    const organizations = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: this.publicSelect,
    });

    return organizations.map((organization) => this.toPublicOrganization(organization));
  }

  async createPublicOrganization(body: unknown, actor?: MvpUser) {
    const input = this.parseCreateOrganizationBody(body);

    const duplicate = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { fiscalCode: input.fiscalCode },
          { legalName: { equals: input.legalName, mode: 'insensitive' as const } },
        ],
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Există deja o asociație cu acest cod A.P.C.');
    }

    const organization = await this.prisma.organization.create({
      data: input,
      select: this.publicSelect,
    });

    await this.activity.createActivity({
      organizationId: organization.id,
      actorUserId: actor?.id,
      type: 'ORGANIZATION_CREATED',
      title: 'A.P.C. creată',
      message: `Asociația ${organization.name} a fost creată.`,
      targetType: 'ORGANIZATION',
      targetId: organization.id,
      link: `/superadmin/organizations/${organization.id}`,
    });

    return this.toPublicOrganization(organization);
  }

  async updatePublicOrganization(id: string, body: unknown) {
    await this.ensureOrganizationExists(id);
    const input = this.parseUpdateOrganizationBody(body);
    if (input.fiscalCode || input.legalName) {
      const duplicate = await this.prisma.organization.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(input.fiscalCode ? [{ fiscalCode: input.fiscalCode }] : []),
            ...(input.legalName ? [{ legalName: { equals: input.legalName, mode: 'insensitive' as const } }] : []),
          ],
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException('Există deja o asociație cu acest cod A.P.C.');
      }
    }

    const organization = await this.prisma.organization.update({
      where: { id },
      data: input,
      select: this.publicSelect,
    });

    return this.toPublicOrganization(organization);
  }

  async listPublicAdmins() {
    const admins = await this.prisma.user.findMany({
      where: {
        role: Role.ADMIN,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: this.adminSelect,
    });

    return admins.map((admin) => this.toPublicAdmin(admin));
  }

  async listPublicOrganizationAdmins(organizationId: string) {
    await this.ensureOrganizationExists(organizationId);

    const admins = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: Role.ADMIN,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: this.adminSelect,
    });

    return admins.map((admin) => this.toPublicAdmin(admin));
  }

  async createPublicOrganizationAdmin(organizationId: string, body: unknown, actor?: MvpUser) {
    await this.ensureOrganizationExists(organizationId);
    const input = this.parseCreateAdminBody(body);

    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Există deja un utilizator cu acest email.');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const admin = await this.prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        fullName: `${input.firstName} ${input.lastName}`.trim(),
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: Role.ADMIN,
        organizationId,
      },
      select: this.adminSelect,
    });

    await this.activity.createActivity({
      organizationId,
      actorUserId: actor?.id,
      type: 'ADMIN_CREATED',
      title: 'Administrator creat',
      message: `Administratorul ${this.fullName(admin)} a fost creat.`,
      targetType: 'USER',
      targetId: admin.id,
      link: '/superadmin/admins',
    });

    return this.toPublicAdmin(admin);
  }

  async updatePublicAdmin(id: string, body: unknown) {
    const input = this.parseUpdateAdminBody(body);

    const existing = await this.prisma.user.findFirst({
      where: {
        id,
        role: Role.ADMIN,
        deletedAt: null,
      },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!existing) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    if (input.email) {
      const duplicate = await this.prisma.user.findFirst({
        where: {
          email: input.email,
          id: { not: id },
        },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Există deja un utilizator cu acest email.');
    }

    const admin = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.firstName !== undefined || input.lastName !== undefined
          ? {
              fullName: `${input.firstName ?? existing.firstName ?? ''} ${input.lastName ?? existing.lastName ?? ''}`.trim() || undefined,
            }
          : {}),
        ...(input.email ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: this.adminSelect,
    });

    return this.toPublicAdmin(admin);
  }

  async findPublicOrganization(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: this.publicSelect,
    });

    if (!organization) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    return this.toPublicOrganization(organization);
  }

  async updatePublicOrganizationStatus(id: string, body: unknown, actor?: MvpUser) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const status = this.optionalEnum(payload.status, OrganizationStatus, OrganizationStatus.ACTIVE, 'Statusul nu este valid.');

    const organization = await this.prisma.organization.update({
      where: { id },
      data: { status },
      select: this.publicSelect,
    }).catch(() => {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    });

    await this.activity.createActivity({
      organizationId: organization.id,
      actorUserId: actor?.id,
      type: 'ORGANIZATION_STATUS_UPDATED',
      title: 'Status A.P.C. actualizat',
      message: `Statusul asociației ${organization.name} a fost schimbat la ${organization.status}.`,
      targetType: 'ORGANIZATION',
      targetId: organization.id,
      link: `/superadmin/organizations/${organization.id}`,
    });

    return this.toPublicOrganization(organization);
  }

  private toCommercialContract(contract: any) {
    return {
      id: contract.id,
      organizationId: contract.organizationId,
      status: contract.status,
      contractNumber: contract.contractNumber,
      startDate: contract.startDate,
      endDate: contract.endDate,
      signedAt: contract.signedAt,
      cancelledAt: contract.cancelledAt,
      currency: contract.currency,
      billingCycle: contract.billingCycle,
      pricingModel: contract.pricingModel,
      pricePerApartment: this.decimalToNullableNumber(contract.pricePerApartment),
      fixedMonthlyPrice: this.decimalToNullableNumber(contract.fixedMonthlyPrice),
      apartmentsIncluded: contract.apartmentsIncluded,
      minimumMonthlyFee: this.decimalToNullableNumber(contract.minimumMonthlyFee),
      paymentDueDay: contract.paymentDueDay,
      documentUrl: contract.documentUrl,
      internalNote: contract.internalNote,
      createdBy: contract.createdBy ? { id: contract.createdBy.id, name: this.fullName(contract.createdBy), email: contract.createdBy.email } : null,
      updatedBy: contract.updatedBy ? { id: contract.updatedBy.id, name: this.fullName(contract.updatedBy), email: contract.updatedBy.email } : null,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    };
  }

  private toCommercialSubscription(subscription: any) {
    return {
      id: subscription.id,
      organizationId: subscription.organizationId,
      status: subscription.status,
      planName: subscription.planName || subscription.plan?.name || null,
      plan: subscription.plan || null,
      startedAt: subscription.subscriptionStartDate,
      subscriptionStartDate: subscription.subscriptionStartDate,
      trialEndsAt: subscription.trialEndDate,
      trialEndDate: subscription.trialEndDate,
      nextBillingDate: subscription.nextBillingDate,
      cancelledAt: subscription.status === 'CANCELLED' ? subscription.updatedAt : null,
      currentMonthlyAmount: subscription.price,
      price: subscription.price,
      currency: subscription.currency,
      internalNote: subscription.notes,
      notes: subscription.notes,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  private detailEstimatedMonthlyAmount(contract: any, subscription: any, apartmentsCount: number) {
    if (!contract) return subscription?.price ?? null;
    if (contract.pricingModel === ContractPricingModel.PER_APARTMENT) {
      const base = apartmentsCount * this.decimalToNumber(contract.pricePerApartment);
      const minimum = contract.minimumMonthlyFee ? this.decimalToNumber(contract.minimumMonthlyFee) : null;
      return minimum !== null && base < minimum ? minimum : base;
    }
    if (contract.pricingModel === ContractPricingModel.FIXED_MONTHLY) {
      return this.decimalToNumber(contract.fixedMonthlyPrice);
    }
    return subscription?.price ?? null;
  }

  private commercialWarnings(contract: any, subscription: any, apartmentsCount: number) {
    const warnings: string[] = [];
    if (!contract) {
      warnings.push('Contractul nu este creat');
    } else {
      if (!['SIGNED', 'ACTIVE'].includes(contract.status)) warnings.push('Contractul nu este semnat');
      if (!contract.startDate) warnings.push('Nu există dată de început');
      if (contract.pricingModel === ContractPricingModel.PER_APARTMENT && !contract.pricePerApartment) warnings.push('Nu este setat tariful');
      if (contract.pricingModel === ContractPricingModel.FIXED_MONTHLY && !contract.fixedMonthlyPrice) warnings.push('Nu este setat tariful');
      if (contract.pricingModel === ContractPricingModel.PER_APARTMENT && apartmentsCount <= 0) {
        warnings.push('Organizația nu are apartamente, calculul per apartament nu poate fi estimat corect');
      }
    }
    if (!subscription || subscription.status !== 'ACTIVE') warnings.push('Nu există abonament activ');
    return warnings;
  }

  private decimalToNumber(value: Prisma.Decimal | null | undefined) {
    return value ? Number(value.toString()) : 0;
  }

  private decimalToNullableNumber(value: Prisma.Decimal | null | undefined) {
    return value ? Number(value.toString()) : null;
  }

  private async organizationStats(id: string) {
    const [
      buildingsCount,
      entrancesCount,
      apartmentsCount,
      residentsCount,
      usersCount,
      activeUsersCount,
      adminsCount,
      metersCount,
      invoicesCount,
      residentInvoicesCount,
      paymentsCount,
      documentsCount,
      announcementsCount,
      platformInvoicesCount,
      platformPaymentsCount,
    ] = await Promise.all([
      this.prisma.building.count({ where: { organizationId: id } }),
      this.prisma.staircase.count({ where: { organizationId: id } }),
      this.prisma.apartment.count({ where: { organizationId: id, archivedAt: null } }),
      this.prisma.residentProfile.count({ where: { organizationId: id, archivedAt: null } }),
      this.prisma.user.count({ where: { organizationId: id, deletedAt: null } }),
      this.prisma.user.count({ where: { organizationId: id, deletedAt: null, isActive: true } }),
      this.prisma.user.count({ where: { organizationId: id, deletedAt: null, role: Role.ADMIN } }),
      this.prisma.meter.count({ where: { organizationId: id, archivedAt: null } }),
      this.prisma.invoice.count({ where: { organizationId: id } }),
      this.prisma.residentInvoice.count({ where: { organizationId: id } }),
      this.prisma.payment.count({ where: { organizationId: id } }),
      this.prisma.document.count({ where: { organizationId: id } }),
      this.prisma.announcement.count({ where: { organizationId: id, archivedAt: null } }),
      this.prisma.organizationInvoice.count({ where: { organizationId: id } }),
      this.prisma.organizationPayment.count({ where: { organizationId: id } }),
    ]);

    return {
      buildingsCount,
      entrancesCount,
      apartmentsCount,
      residentsCount,
      usersCount,
      activeUsersCount,
      adminsCount,
      metersCount,
      invoicesCount: invoicesCount + residentInvoicesCount,
      platformInvoicesCount,
      paymentsCount,
      platformPaymentsCount,
      documentsCount,
      announcementsCount,
    };
  }

  private organizationDetailWarnings(
    organization: {
      fiscalCode: string | null;
      address: string | null;
      onboardingStatus: OnboardingStatus;
      launchStatus: OrganizationLaunchStatus;
      settings?: unknown;
      subscription?: unknown;
      subscriptionContracts?: unknown[];
      commercialContracts?: unknown[];
    },
    stats: Awaited<ReturnType<OrganizationsService['organizationStats']>>,
    mainAdmin: { id: string } | null,
  ) {
    const warnings: Array<{ key: string; message: string; severity: 'warning' | 'blocking' }> = [];
    if (!mainAdmin) warnings.push({ key: 'NO_ADMIN', message: 'Nu există admin activ pentru organizație.', severity: 'blocking' });
    if (!stats.apartmentsCount) warnings.push({ key: 'NO_APARTMENTS', message: 'Nu există apartamente adăugate.', severity: 'blocking' });
    if (!organization.fiscalCode) warnings.push({ key: 'MISSING_APC_CODE', message: 'Lipsește codul APC.', severity: 'warning' });
    if (!organization.address) warnings.push({ key: 'MISSING_ADDRESS', message: 'Lipsește adresa organizației.', severity: 'warning' });
    if (organization.onboardingStatus === OnboardingStatus.BLOCKED) warnings.push({ key: 'ONBOARDING_BLOCKED', message: 'Onboardingul este marcat ca blocat.', severity: 'blocking' });
    if (organization.launchStatus !== OrganizationLaunchStatus.LIVE) warnings.push({ key: 'NOT_LIVE', message: 'Organizația nu este lansată live.', severity: 'warning' });
    if (!organization.settings && !organization.subscription && !organization.subscriptionContracts?.length) {
      warnings.push({ key: 'BILLING_NOT_CONFIGURED', message: 'Facturarea nu este configurată încă.', severity: 'warning' });
    }
    if (!organization.commercialContracts?.length) {
      warnings.push({ key: 'CONTRACT_MISSING', message: 'Contractul clientului nu este configurat încă.', severity: 'warning' });
    }
    return warnings;
  }

  private organizationDetailOnboarding(
    organization: {
      name: string;
      city: string | null;
      address: string | null;
      fiscalCode: string | null;
      onboardingStatus: OnboardingStatus;
      onboardingStep: string | null;
      launchStatus: OrganizationLaunchStatus;
      launchChecklistJson: Prisma.JsonValue | null;
    },
    stats: Awaited<ReturnType<OrganizationsService['organizationStats']>>,
  ) {
    const snapshot = this.jsonObject(organization.launchChecklistJson);
    const snapshotProgress = this.jsonObject(snapshot.progress);
    const steps = [
      { key: 'BASIC_INFO', label: 'Date generale', complete: Boolean(organization.name && organization.city && organization.address) },
      { key: 'ADMIN', label: 'Administrator', complete: stats.adminsCount > 0 },
      { key: 'STRUCTURE', label: 'Structură', complete: stats.buildingsCount > 0 && stats.entrancesCount > 0 },
      { key: 'APARTMENTS', label: 'Apartamente', complete: stats.apartmentsCount > 0 },
      { key: 'RESIDENTS', label: 'Locatari', complete: stats.residentsCount > 0 },
      { key: 'METERS', label: 'Contoare', complete: stats.metersCount > 0 },
      { key: 'BILLING', label: 'Facturare', complete: stats.invoicesCount > 0 || stats.platformInvoicesCount > 0 },
      { key: 'DOCUMENTS', label: 'Documente', complete: stats.documentsCount > 0 },
      { key: 'FINAL_REVIEW', label: 'Revizuire finală', complete: organization.launchStatus === OrganizationLaunchStatus.LIVE },
    ];
    const completedSteps = typeof snapshotProgress.completedSteps === 'number'
      ? snapshotProgress.completedSteps
      : steps.filter((step) => step.complete).length;
    const totalSteps = typeof snapshotProgress.totalSteps === 'number' ? snapshotProgress.totalSteps : steps.length;
    const percent = typeof snapshotProgress.percent === 'number'
      ? snapshotProgress.percent
      : Math.round((completedSteps / Math.max(totalSteps, 1)) * 100);
    const next = steps.find((step) => !step.complete);

    return {
      status: organization.onboardingStatus,
      launchStatus: organization.launchStatus,
      currentStep: organization.onboardingStep || next?.key || 'FINAL_REVIEW',
      progress: {
        percent,
        completedSteps,
        totalSteps,
      },
      nextRecommendedStep: next ? { key: next.key, label: next.label } : { key: 'FINAL_REVIEW', label: 'Revizuire finală' },
      checklistSnapshot: snapshot.checklist || null,
    };
  }

  private toResidentSummary(resident: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    type?: string;
  }) {
    return {
      id: resident.id,
      name: `${resident.firstName || ''} ${resident.lastName || ''}`.trim() || resident.email || resident.phone || 'Locatar fără nume',
      firstName: resident.firstName,
      lastName: resident.lastName,
      phone: resident.phone,
      email: resident.email,
      type: resident.type || null,
    };
  }

  private toOrganizationActivityItem(
    row: {
      id: string;
      action: string;
      entityType: string;
      entityId: string | null;
      description: string;
      createdAt: Date;
      user?: { id: string; email: string; fullName: string | null; firstName: string | null; lastName: string | null } | null;
    },
    source: 'audit' | 'system',
  ) {
    return {
      id: row.id,
      type: row.action,
      title: this.activityTitle(row.action),
      description: row.description,
      entityType: row.entityType,
      entityId: row.entityId,
      createdAt: row.createdAt,
      source,
      actor: row.user
        ? {
            id: row.user.id,
            name: this.fullName(row.user),
            email: row.user.email,
          }
        : null,
    };
  }

  private activityTitle(action: string) {
    const labels: Record<string, string> = {
      ORGANIZATION_CREATED: 'Organizație creată',
      ORGANIZATION_STATUS_UPDATED: 'Status client actualizat',
      ADMIN_CREATED: 'Administrator creat',
      ACCESS_REQUEST_CONVERTED: 'Cerere convertită',
      ORGANIZATION_CREATED_FROM_REQUEST: 'Client creat din cerere',
      ORGANIZATION_ONBOARDING_UPDATED: 'Onboarding actualizat',
      ORGANIZATION_ONBOARDING_RECALCULATED: 'Checklist recalculat',
      ORGANIZATION_LAUNCHED: 'Organizație lansată',
      SUPERADMIN_ORGANIZATION_UPDATED: 'Fișă organizație actualizată',
      DOCUMENT_CREATED: 'Document încărcat',
      INVOICE_CREATED: 'Factură creată',
      PAYMENT_REGISTERED: 'Plată înregistrată',
      CONTRACT_CREATED: 'Contract comercial creat',
      CONTRACT_UPDATED: 'Contract comercial actualizat',
      CONTRACT_SIGNED: 'Contract comercial semnat',
      SUBSCRIPTION_CREATED: 'Abonament creat',
      SUBSCRIPTION_UPDATED: 'Abonament actualizat',
      SUBSCRIPTION_CANCELLED: 'Abonament anulat',
      SUPPORT_SESSION_START: 'Sesiune support începută',
      SUPPORT_SESSION_END: 'Sesiune support închisă',
      LOGIN_SUCCESS: 'Autentificare reușită',
    };
    return labels[action] || action.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
  }

  private parseSuperadminOrganizationUpdate(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const data: Prisma.OrganizationUpdateInput = {};
    const audit: Record<string, unknown> = {};

    const readNullableString = (key: string) => {
      if (!(key in payload)) return undefined;
      if (payload[key] === null) return null;
      if (typeof payload[key] !== 'string') throw new BadRequestException(`Câmpul ${key} nu este valid.`);
      const value = payload[key].trim();
      return value || null;
    };
    const readFirstNullableString = (...keys: string[]) => {
      for (const key of keys) {
        if (key in payload) return readNullableString(key);
      }
      return undefined;
    };

    const name = readFirstNullableString('name', 'shortName');
    if (name !== undefined) {
      if (!name) throw new BadRequestException('Numele organizației este obligatoriu.');
      data.name = name;
      audit.name = name;
    }

    const legalName = readNullableString('legalName');
    if (legalName !== undefined) {
      data.legalName = legalName;
      audit.legalName = legalName;
    }

    const apcCode = readFirstNullableString('apcCode', 'associationCode', 'fiscalCode');
    if (apcCode !== undefined) {
      data.fiscalCode = apcCode ? apcCode.toUpperCase() : null;
      audit.apcCode = data.fiscalCode;
    }

    const city = readNullableString('city');
    if (city !== undefined) {
      data.city = city;
      audit.city = city;
    }

    const address = readNullableString('address');
    if (address !== undefined) {
      data.address = address;
      audit.address = address;
    }

    const contactPhone = readFirstNullableString('contactPhone', 'phone');
    if (contactPhone !== undefined) {
      data.phone = contactPhone;
      audit.contactPhone = contactPhone;
    }

    const contactEmail = readFirstNullableString('contactEmail', 'email');
    if (contactEmail !== undefined) {
      if (contactEmail && !contactEmail.includes('@')) throw new BadRequestException('Emailul de contact nu este valid.');
      data.email = contactEmail ? contactEmail.toLowerCase() : null;
      audit.contactEmail = data.email;
    }

    const internalNote = readNullableString('internalNote');
    if (internalNote !== undefined) {
      data.internalNote = internalNote;
      audit.internalNote = internalNote;
    }

    const status = this.optionalEnumValue(payload.status, OrganizationStatus, 'Statusul clientului nu este valid.');
    if (status) {
      data.status = status;
      audit.status = status;
    }

    const onboardingStatus = this.optionalEnumValue(payload.onboardingStatus, OnboardingStatus, 'Statusul de onboarding nu este valid.');
    if (onboardingStatus) {
      data.onboardingStatus = onboardingStatus;
      audit.onboardingStatus = onboardingStatus;
      if (onboardingStatus === OnboardingStatus.IN_PROGRESS) data.onboardingStartedAt = new Date();
      if (onboardingStatus === OnboardingStatus.LAUNCHED || onboardingStatus === OnboardingStatus.COMPLETED) {
        data.onboardingCompleted = true;
        data.onboardingCompletedAt = new Date();
      }
    }

    const launchStatus = this.optionalEnumValue(payload.launchStatus, OrganizationLaunchStatus, 'Statusul de lansare nu este valid.');
    if (launchStatus) {
      data.launchStatus = launchStatus;
      audit.launchStatus = launchStatus;
      if (launchStatus === OrganizationLaunchStatus.LIVE) {
        data.launchedAt = new Date();
        data.status = OrganizationStatus.ACTIVE;
        data.isActive = true;
      }
    }

    if (!Object.keys(data).length) throw new BadRequestException('Nu există date de actualizat.');
    return { data, audit };
  }

  private jsonObject(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private optionalEnumValue<T extends Record<string, string>>(value: unknown, enumValues: T, message: string) {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') throw new BadRequestException(message);
    const normalized = value.trim().toUpperCase();
    const allowed = Object.values(enumValues) as string[];
    if (!allowed.includes(normalized)) throw new BadRequestException(message);
    return normalized as T[keyof T];
  }

  private parseCreateOrganizationBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const associationCode = this.requiredString(payload.associationCode ?? payload.code ?? payload.fiscalCode, 'Codul A.P.C. este obligatoriu.').toUpperCase();
    if (!/^A\d{4}-\d{4}$/.test(associationCode)) {
      throw new BadRequestException('Format recomandat: A0123-0940.');
    }
    const shortName = this.optionalString(payload.shortName) || this.optionalString(payload.name) || `A.P.C. ${associationCode}`;
    const legalName =
      this.optionalString(payload.legalName) ||
      `Asociația de Proprietari din Condominiu ${associationCode}`;
    const address = this.requiredString(payload.address, 'Adresa este obligatorie.');
    const city = this.requiredString(payload.city, 'Orașul este obligatoriu.');
    const country = this.normalizeCountryLabel(this.optionalString(payload.country) || 'Republica Moldova');
    const currency = this.optionalEnum(payload.currency, BillingCurrency, BillingCurrency.MDL, 'Moneda nu este validă.');
    const status = this.optionalEnum(payload.status, OrganizationStatus, OrganizationStatus.ACTIVE, 'Statusul nu este valid.');

    return {
      name: shortName,
      legalName,
      fiscalCode: associationCode,
      address,
      city,
      country,
      currency,
      defaultCurrency: currency,
      status,
    };
  }

  private parseUpdateOrganizationBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const data: {
      name?: string;
      legalName?: string;
      fiscalCode?: string;
      address?: string;
      city?: string;
      country?: string;
      currency?: BillingCurrency;
      defaultCurrency?: BillingCurrency;
      status?: OrganizationStatus;
    } = {};

    const associationCodeSource = payload.associationCode ?? payload.code ?? payload.fiscalCode;
    if (associationCodeSource !== undefined && associationCodeSource !== null && associationCodeSource !== '') {
      const associationCode = this.requiredString(associationCodeSource, 'Codul A.P.C. este obligatoriu.').toUpperCase();
      if (!/^A\d{4}-\d{4}$/.test(associationCode)) {
        throw new BadRequestException('Format recomandat: A0123-0940.');
      }
      data.fiscalCode = associationCode;
      data.legalName = this.optionalString(payload.legalName) || this.legalNameForCode(associationCode);
      data.name = this.optionalString(payload.shortName) || this.optionalString(payload.name) || `A.P.C. ${associationCode}`;
    } else {
      const legalName = this.optionalString(payload.legalName);
      const shortName = this.optionalString(payload.shortName) || this.optionalString(payload.name);
      if (legalName) data.legalName = legalName;
      if (shortName) data.name = shortName;
    }

    const address = this.optionalString(payload.address);
    const city = this.optionalString(payload.city);
    const country = this.optionalString(payload.country);
    if (address) data.address = address;
    if (city) data.city = city;
    if (country) data.country = this.normalizeCountryLabel(country);
    if (payload.currency !== undefined && payload.currency !== null && payload.currency !== '') {
      const currency = this.optionalEnum(payload.currency, BillingCurrency, BillingCurrency.MDL, 'Moneda nu este validă.');
      data.currency = currency;
      data.defaultCurrency = currency;
    }
    if (payload.status !== undefined && payload.status !== null && payload.status !== '') {
      data.status = this.optionalEnum(payload.status, OrganizationStatus, OrganizationStatus.ACTIVE, 'Statusul nu este valid.');
    }

    if (!Object.keys(data).length) throw new BadRequestException('Nu există date de actualizat.');
    return data;
  }

  private parseCreateAdminBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const firstName = this.requiredString(payload.firstName, 'Prenumele este obligatoriu.');
    const lastName = this.requiredString(payload.lastName, 'Numele este obligatoriu.');
    const email = this.requiredString(payload.email, 'Emailul este obligatoriu.').toLowerCase();
    const password = this.requiredString(payload.password, 'Parola temporară este obligatorie.');
    const phone = typeof payload.phone === 'string' ? payload.phone.trim() : null;

    if (!email.includes('@')) {
      throw new BadRequestException('Emailul nu este valid.');
    }
    if (password.length < 8) {
      throw new BadRequestException('Parola trebuie să aibă cel puțin 8 caractere.');
    }
    if (phone && !this.isValidMoldovaPhone(phone)) {
      throw new BadRequestException('Telefonul nu este valid.');
    }

    return {
      firstName,
      lastName,
      email,
      phone: phone || null,
      password,
    };
  }

  private parseUpdateAdminBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const input: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string | null;
      organizationId?: string;
      isActive?: boolean;
    } = {};

    if (payload.firstName !== undefined) input.firstName = this.requiredString(payload.firstName, 'Prenumele este obligatoriu.');
    if (payload.lastName !== undefined) input.lastName = this.requiredString(payload.lastName, 'Numele este obligatoriu.');
    if (payload.email !== undefined) {
      const email = this.requiredString(payload.email, 'Emailul este obligatoriu.').toLowerCase();
      if (!email.includes('@')) throw new BadRequestException('Emailul nu este valid.');
      input.email = email;
    }
    if (payload.phone !== undefined) {
      const phone = typeof payload.phone === 'string' && payload.phone.trim() ? payload.phone.trim() : null;
      if (phone && !this.isValidMoldovaPhone(phone)) throw new BadRequestException('Telefonul nu este valid.');
      input.phone = phone;
    }
    if (payload.organizationId !== undefined) {
      input.organizationId = this.requiredString(payload.organizationId, 'Asociația este obligatorie.');
    }
    if (payload.isActive !== undefined) input.isActive = Boolean(payload.isActive);

    if (!Object.keys(input).length) throw new BadRequestException('Nu există date de actualizat.');
    return input;
  }

  private async ensureOrganizationExists(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }
  }

  private toPublicAdmin(admin: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    role: string;
    organizationId: string | null;
    createdAt: Date;
    updatedAt?: Date;
    isActive?: boolean;
    organization?: {
      id: string;
      name: string;
      legalName?: string | null;
      fiscalCode?: string | null;
    } | null;
  }) {
    const associationCode = admin.organization?.fiscalCode || this.extractAssociationCode(admin.organization?.name, admin.organization?.legalName);
    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      phone: admin.phone,
      role: admin.role,
      organizationId: admin.organizationId || '',
      isActive: admin.isActive ?? true,
      status: admin.isActive === false ? 'INACTIVE' : 'ACTIVE',
      organization: admin.organization
        ? {
            id: admin.organization.id,
            name: admin.organization.name,
            shortName: admin.organization.name,
            legalName: admin.organization.legalName,
            associationCode,
          }
        : null,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }

  private fullName(person?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
    return `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || person?.email || '';
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(message);
    }
    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  private extractAssociationCode(...values: Array<string | null | undefined>) {
    for (const value of values) {
      const match = String(value || '').match(/A\d{4}-\d{4}/i);
      if (match) return match[0].toUpperCase();
    }
    return '';
  }

  private legalNameForCode(code: string) {
    return code ? `Asociația de Proprietari din Condominiu ${code}` : '';
  }

  private associationNumberFromCode(code: string) {
    const match = code.match(/-(\d{4})$/);
    return match?.[1] || '';
  }

  private normalizeCountryLabel(value: string) {
    const normalized = value.trim();
    return normalized === 'MD' || normalized.toLowerCase() === 'moldova' ? 'Republica Moldova' : normalized;
  }

  private isValidMoldovaPhone(value: string) {
    const normalized = value.replace(/[\s().-]/g, '');
    return /^\+373\d{8}$/.test(normalized) || /^0\d{8}$/.test(normalized);
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
