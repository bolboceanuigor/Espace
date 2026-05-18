import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  AssociationRoleType,
  OrganizationMemberStatus,
  PlatformRole,
  ResidentAccountStatus,
  ResidentPortalAccessStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PERMISSION_DEFINITIONS,
  permissionKey,
  resolvePermissions,
  type PermissionActionKey,
  type PermissionModuleKey,
} from '../team/team-permissions';
import type {
  AdminAssociationContext,
  AssociationContextUser,
  AssociationSummary,
  RequestWithTenantContext,
  ResidentAssociationContext,
} from './association-context.types';

function userIdOf(user: AssociationContextUser | null | undefined) {
  return user?.id || user?.sub || '';
}

function normalizeRole(value?: string | null) {
  return String(value || '').toUpperCase();
}

function isSuperAdmin(user: AssociationContextUser) {
  return normalizeRole(user.role) === Role.SUPERADMIN || normalizeRole(user.platformRole) === PlatformRole.SUPER_ADMIN;
}

function headerValue(value: unknown): string | null {
  if (Array.isArray(value)) return String(value[0] || '').trim() || null;
  if (typeof value === 'string') return value.trim() || null;
  return null;
}

function labelForPermission(key: string) {
  return key
    .split('.')
    .map((part) => part.toUpperCase())
    .join('.');
}

@Injectable()
export class AssociationContextService {
  constructor(private readonly prisma: PrismaService) {}

  getRequestedAssociationId(request?: RequestWithTenantContext): string | null {
    const headers = request?.headers || {};
    return (
      headerValue(headers['x-association-id']) ||
      headerValue(headers['x-org-id']) ||
      headerValue((request as any)?.orgScopeId)
    );
  }

  async getAdminAssociationContext(
    user: AssociationContextUser,
    request?: RequestWithTenantContext,
  ): Promise<AdminAssociationContext> {
    const userId = userIdOf(user);
    if (!userId) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Autentificare necesară.',
      });
    }
    if (normalizeRole(user.role) === Role.RESIDENT) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Nu ai acces la această resursă.',
      });
    }

    const requestedAssociationId = this.getRequestedAssociationId(request);
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true,
        associationRole: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const available = memberships
      .filter((member) => member.status === OrganizationMemberStatus.ACTIVE)
      .map((member) => this.organizationSummary(member.organization, member.status));

    const requestedMember = requestedAssociationId
      ? memberships.find((member) => member.organizationId === requestedAssociationId)
      : null;
    if (requestedAssociationId) {
      if (!requestedMember) {
        throw new ForbiddenException({
          code: 'ASSOCIATION_ACCESS_DENIED',
          statusCode: 403,
          message: 'Nu ai acces la această resursă.',
        });
      }
      this.assertActiveMembership(requestedMember.status);
    }

    const activeMember =
      requestedMember ||
      memberships.find((member) => member.status === OrganizationMemberStatus.ACTIVE && member.organizationId === user.organizationId) ||
      memberships.find((member) => member.status === OrganizationMemberStatus.ACTIVE);

    if (!activeMember) {
      const latestMember = memberships[0];
      if (latestMember) this.assertActiveMembership(latestMember.status);

      if (!isSuperAdmin(user) && normalizeRole(user.role) === Role.ADMIN && user.organizationId) {
        return this.legacyAdminContext(user.organizationId);
      }

      throw new ForbiddenException({
        code: 'ACTIVE_ASSOCIATION_MEMBERSHIP_REQUIRED',
        statusCode: 403,
        message: 'Nu ai acces la această resursă.',
      });
    }

    const permissions = this.permissionsForMember(activeMember);
    const roleType = activeMember.associationRole?.type || activeMember.role;
    const roleName = activeMember.associationRole?.name || roleType;

    return {
      associationId: activeMember.organizationId,
      membershipId: activeMember.id,
      roleId: activeMember.associationRoleId,
      roleType,
      roleName,
      permissions,
      permissionLabels: permissions.map(labelForPermission),
      activeAssociation: this.organizationSummary(activeMember.organization, activeMember.status),
      availableAssociations: available.length ? available : [this.organizationSummary(activeMember.organization, activeMember.status)],
    };
  }

  async getActiveAssociationId(user: AssociationContextUser, request?: RequestWithTenantContext) {
    return (await this.getAdminAssociationContext(user, request)).associationId;
  }

  async switchAdminAssociation(
    user: AssociationContextUser,
    request: RequestWithTenantContext | undefined,
    associationId: string,
  ) {
    const syntheticRequest = {
      ...(request || {}),
      headers: {
        ...(request?.headers || {}),
        'x-association-id': associationId,
      },
    } as unknown as RequestWithTenantContext;
    return this.getAdminAssociationContext(user, syntheticRequest);
  }

  async getResidentAssociationContext(user: AssociationContextUser): Promise<ResidentAssociationContext> {
    const userId = userIdOf(user);
    if (!userId) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Autentificare necesară.',
      });
    }
    if (normalizeRole(user.role) !== Role.RESIDENT) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Nu ai acces la această resursă.',
      });
    }

    const residents = await this.prisma.residentProfile.findMany({
      where: { userId },
      include: {
        organization: true,
        apartment: { include: { staircase: true, organization: true } },
        apartmentResidents: {
          include: {
            apartment: { include: { staircase: true, organization: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!residents.length) {
      throw new ForbiddenException({
        code: 'RESIDENT_PORTAL_NOT_LINKED',
        statusCode: 403,
        message: 'Contul tău nu este încă legat de un locatar din asociație.',
      });
    }

    const activeResidents = residents.filter((resident) => this.isResidentPortalActive(resident));
    if (!activeResidents.length) {
      this.throwResidentStatus(residents[0]);
    }

    const residentIds = activeResidents.map((resident) => resident.id);
    const apartmentMap = new Map<string, ResidentAssociationContext['apartments'][number]>();
    const associationMap = new Map<string, AssociationSummary>();

    for (const resident of activeResidents) {
      if (resident.apartment) {
        const summary = this.organizationSummary(resident.apartment.organization);
        associationMap.set(summary.id, summary);
        apartmentMap.set(resident.apartment.id, {
          id: resident.apartment.id,
          apartmentNumber: resident.apartment.number,
          staircase: resident.apartment.staircase?.name || null,
          association: summary,
        });
      } else {
        associationMap.set(resident.organizationId, this.organizationSummary(resident.organization));
      }

      for (const relation of resident.apartmentResidents) {
        const apartment = relation.apartment;
        const summary = this.organizationSummary(apartment.organization);
        associationMap.set(summary.id, summary);
        apartmentMap.set(apartment.id, {
          id: apartment.id,
          apartmentNumber: apartment.number,
          staircase: apartment.staircase?.name || null,
          association: summary,
        });
      }
    }

    const apartments = Array.from(apartmentMap.values());
    if (!apartments.length) {
      throw new ForbiddenException({
        code: 'RESIDENT_APARTMENT_LINK_MISSING',
        statusCode: 403,
        message: 'Contul tău nu este legat de niciun apartament.',
      });
    }

    const associations = Array.from(associationMap.values());
    const firstResident = activeResidents[0];
    return {
      residentId: residentIds[0],
      userId,
      portalAccessStatus: firstResident.portalAccessStatus || ResidentPortalAccessStatus.ACTIVE,
      apartmentIds: apartments.map((apartment) => apartment.id),
      associationIds: associations.map((association) => association.id),
      apartments,
      associations,
      activeAssociation: associations[0] || null,
    };
  }

  async assertAdminCanAccessAssociation(user: AssociationContextUser, associationId: string, request?: RequestWithTenantContext) {
    const context = await this.getAdminAssociationContext(user, request);
    if (context.associationId !== associationId) this.throwTenantNotFound();
    return context;
  }

  async assertAdminCanAccessApartment(user: AssociationContextUser, apartmentId: string, request?: RequestWithTenantContext) {
    const context = await this.getAdminAssociationContext(user, request);
    const apartment = await this.prisma.apartment.findFirst({
      where: { id: apartmentId, organizationId: context.associationId },
    });
    if (!apartment) this.throwTenantNotFound();
    return apartment;
  }

  async assertAdminCanAccessResident(user: AssociationContextUser, residentId: string, request?: RequestWithTenantContext) {
    const context = await this.getAdminAssociationContext(user, request);
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id: residentId, organizationId: context.associationId },
    });
    if (!resident) this.throwTenantNotFound();
    return resident;
  }

  async assertAdminCanAccessInvoice(user: AssociationContextUser, invoiceId: string, request?: RequestWithTenantContext) {
    const context = await this.getAdminAssociationContext(user, request);
    const residentInvoice = await this.prisma.residentInvoice.findFirst({
      where: { id: invoiceId, organizationId: context.associationId },
    });
    if (residentInvoice) return residentInvoice;
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, organizationId: context.associationId } });
    if (!invoice) this.throwTenantNotFound();
    return invoice;
  }

  async assertAdminCanAccessPayment(user: AssociationContextUser, paymentId: string, request?: RequestWithTenantContext) {
    const context = await this.getAdminAssociationContext(user, request);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId: context.associationId },
    });
    if (!payment) this.throwTenantNotFound();
    return payment;
  }

  async assertAdminCanAccessMeter(user: AssociationContextUser, meterId: string, request?: RequestWithTenantContext) {
    const context = await this.getAdminAssociationContext(user, request);
    const meter = await this.prisma.meter.findFirst({ where: { id: meterId, organizationId: context.associationId } });
    if (!meter) this.throwTenantNotFound();
    return meter;
  }

  async assertAdminCanAccessRequest(user: AssociationContextUser, requestId: string, request?: RequestWithTenantContext) {
    const context = await this.getAdminAssociationContext(user, request);
    const issue = await this.prisma.issue.findFirst({ where: { id: requestId, organizationId: context.associationId } });
    if (!issue) this.throwTenantNotFound();
    return issue;
  }

  async assertResidentCanAccessApartment(user: AssociationContextUser, apartmentId: string) {
    const context = await this.getResidentAssociationContext(user);
    if (!context.apartmentIds.includes(apartmentId)) this.throwTenantNotFound();
    return apartmentId;
  }

  async assertResidentCanAccessInvoice(user: AssociationContextUser, invoiceId: string) {
    const context = await this.getResidentAssociationContext(user);
    const residentInvoice = await this.prisma.residentInvoice.findFirst({
      where: { id: invoiceId, apartmentId: { in: context.apartmentIds } },
    });
    if (residentInvoice) return residentInvoice;
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, apartmentId: { in: context.apartmentIds } },
    });
    if (!invoice) this.throwTenantNotFound();
    return invoice;
  }

  async assertResidentCanAccessPayment(user: AssociationContextUser, paymentId: string) {
    const context = await this.getResidentAssociationContext(user);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, apartmentId: { in: context.apartmentIds } },
    });
    if (!payment) this.throwTenantNotFound();
    return payment;
  }

  async assertResidentCanAccessMeter(user: AssociationContextUser, meterId: string) {
    const context = await this.getResidentAssociationContext(user);
    const meter = await this.prisma.meter.findFirst({
      where: { id: meterId, apartmentId: { in: context.apartmentIds } },
    });
    if (!meter) this.throwTenantNotFound();
    return meter;
  }

  async assertResidentCanAccessMeterReading(user: AssociationContextUser, readingId: string) {
    const context = await this.getResidentAssociationContext(user);
    const reading = await this.prisma.meterReading.findFirst({
      where: { id: readingId, apartmentId: { in: context.apartmentIds } },
    });
    if (!reading) this.throwTenantNotFound();
    return reading;
  }

  private async legacyAdminContext(organizationId: string): Promise<AdminAssociationContext> {
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) this.throwTenantNotFound();
    const permissions = PERMISSION_DEFINITIONS.map((permission) => permission.key);
    return {
      associationId: organization.id,
      membershipId: null,
      roleId: null,
      roleType: AssociationRoleType.ASSOCIATION_OWNER,
      roleName: 'Administrator principal',
      permissions,
      permissionLabels: permissions.map(labelForPermission),
      activeAssociation: this.organizationSummary(organization, OrganizationMemberStatus.ACTIVE),
      availableAssociations: [this.organizationSummary(organization, OrganizationMemberStatus.ACTIVE)],
    };
  }

  private permissionsForMember(member: any) {
    if (
      member.associationRole?.type === AssociationRoleType.ASSOCIATION_OWNER &&
      member.associationRole.rolePermissions.length === 0
    ) {
      return PERMISSION_DEFINITIONS.map((permission) => permission.key);
    }
    if (member.associationRole?.rolePermissions.length) {
      return member.associationRole.rolePermissions
        .filter((item) => item.allowed)
        .map((item) =>
          permissionKey(item.permission.module as PermissionModuleKey, item.permission.action as PermissionActionKey),
        );
    }
    return Object.entries(resolvePermissions(member.role, member.permissionsJson))
      .filter(([, allowed]) => allowed)
      .map(([key]) => key);
  }

  private organizationSummary(organization: { id: string; name: string; fiscalCode?: string | null; status?: string | null }, status?: string | null): AssociationSummary {
    return {
      id: organization.id,
      shortName: organization.name,
      associationCode: organization.fiscalCode || null,
      status: organization.status || null,
      membershipStatus: status || null,
    };
  }

  private assertActiveMembership(status: OrganizationMemberStatus) {
    if (status === OrganizationMemberStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: 'STAFF_ACCESS_DENIED_SUSPENDED',
        statusCode: 403,
        message: 'Accesul tău este suspendat.',
      });
    }
    if (status === OrganizationMemberStatus.REVOKED || status === OrganizationMemberStatus.DISABLED) {
      throw new ForbiddenException({
        code: 'STAFF_ACCESS_DENIED_REVOKED',
        statusCode: 403,
        message: 'Accesul tău a fost revocat.',
      });
    }
    if (status !== OrganizationMemberStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'ACTIVE_ASSOCIATION_MEMBERSHIP_REQUIRED',
        statusCode: 403,
        message: 'Nu ai acces la această resursă.',
      });
    }
  }

  private isResidentPortalActive(resident: { accountStatus: ResidentAccountStatus; portalAccessStatus: ResidentPortalAccessStatus | null }) {
    if (resident.portalAccessStatus === ResidentPortalAccessStatus.ACTIVE) return true;
    return !resident.portalAccessStatus && resident.accountStatus === ResidentAccountStatus.CREATED;
  }

  private throwResidentStatus(resident: { accountStatus: ResidentAccountStatus; portalAccessStatus: ResidentPortalAccessStatus | null }) {
    if (resident.portalAccessStatus === ResidentPortalAccessStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: 'RESIDENT_ACCESS_DENIED_SUSPENDED',
        statusCode: 403,
        message: 'Accesul la portal este suspendat. Contactează administratorul asociației.',
      });
    }
    if (resident.portalAccessStatus === ResidentPortalAccessStatus.REVOKED) {
      throw new ForbiddenException({
        code: 'RESIDENT_ACCESS_DENIED_REVOKED',
        statusCode: 403,
        message: 'Accesul la portal a fost revocat. Contactează administratorul asociației.',
      });
    }
    throw new ForbiddenException({
      code: 'RESIDENT_PORTAL_ACCESS_NOT_ACTIVE',
      statusCode: 403,
      message: 'Accesul la portal nu este activ. Contactează administratorul asociației.',
    });
  }

  private throwTenantNotFound(): never {
    throw new NotFoundException({
      statusCode: 404,
      message: 'Resursa nu a fost găsită.',
    });
  }
}
