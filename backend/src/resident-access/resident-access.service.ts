import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ApartmentResidentRole,
  AuthProvider,
  AuthSecurityEventSeverity,
  AuthSecurityEventType,
  PlatformRole,
  Prisma,
  ResidentAccountStatus,
  ResidentPortalAccessStatus,
  ResidentPortalInvitationDeliveryMethod,
  ResidentPortalInvitationStatus,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuthSecurityService } from '../auth/auth-security.service';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type AnyPayload = Record<string, any>;

const ACTIVE_INVITATION_STATUSES: ResidentPortalInvitationStatus[] = [
  ResidentPortalInvitationStatus.PENDING,
  ResidentPortalInvitationStatus.SENT,
];

const EXPIRABLE_INVITATION_STATUSES: ResidentPortalInvitationStatus[] = [
  ResidentPortalInvitationStatus.DRAFT,
  ResidentPortalInvitationStatus.PENDING,
  ResidentPortalInvitationStatus.SENT,
];

function isRecord(value: unknown): value is AnyPayload {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(value: unknown) {
  const text = stringValue(value);
  return text || null;
}

function boolValue(value: unknown) {
  return value === true || value === 'true' || value === '1' || value === 'yes' || value === 'da';
}

function normalizeEmail(value: unknown) {
  const email = stringValue(value).toLowerCase();
  return email || null;
}

function normalizePhone(value: unknown) {
  const phone = stringValue(value).replace(/\s+/g, ' ');
  return phone || null;
}

function fullName(resident: { firstName?: string | null; lastName?: string | null }) {
  return `${resident.firstName || ''} ${resident.lastName || ''}`.trim() || 'Locatar';
}

function statusLabel(status: ResidentPortalAccessStatus | string | null | undefined) {
  const labels: Record<string, string> = {
    NO_ACCESS: 'Fără acces',
    INVITED: 'Invitat',
    ACTIVE: 'Activ',
    SUSPENDED: 'Suspendat',
    REVOKED: 'Revocat',
  };
  return labels[String(status || 'NO_ACCESS')] || 'Fără acces';
}

@Injectable()
export class ResidentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
    private readonly authSecurity: AuthSecurityService,
  ) {}

  private isSuperadmin(user: MvpUser) {
    return String(user.role).toUpperCase() === Role.SUPERADMIN;
  }

  private assertAdmin(user: MvpUser) {
    const role = String(user.role).toUpperCase();
    if (role !== Role.ADMIN && role !== Role.SUPERADMIN) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Nu ai acces la această zonă.',
      });
    }
  }

  private associationId(user: MvpUser) {
    return user.organizationId;
  }

  private appUrl() {
    return (
      process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');
  }

  private inviteLink(token: string, locale = 'ro') {
    return `${this.appUrl()}/${locale}/invite/${token}`;
  }

  private token() {
    const raw = randomBytes(32).toString('base64url');
    return {
      raw,
      hash: this.hashToken(raw),
      preview: raw.slice(-6),
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseBody(body: unknown): AnyPayload {
    return isRecord(body) ? body : {};
  }

  private expiresAt(days: unknown) {
    const value = Number(days || 7);
    if (!Number.isFinite(value) || value < 1 || value > 30) {
      throw new BadRequestException({
        code: 'INVALID_EXPIRATION',
        message: 'Perioada de expirare trebuie să fie între 1 și 30 de zile.',
      });
    }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Math.floor(value));
    return expiresAt;
  }

  private validateEmailForDelivery(email: string | null, deliveryMethod: ResidentPortalInvitationDeliveryMethod) {
    if (deliveryMethod === ResidentPortalInvitationDeliveryMethod.EMAIL_PLACEHOLDER && !email) {
      throw new BadRequestException({
        code: 'EMAIL_REQUIRED',
        message: 'Emailul este obligatoriu pentru această metodă de livrare.',
      });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException({
        code: 'INVALID_EMAIL',
        message: 'Emailul nu este valid.',
      });
    }
  }

  private validatePhoneForDelivery(phone: string | null, deliveryMethod: ResidentPortalInvitationDeliveryMethod) {
    if (deliveryMethod === ResidentPortalInvitationDeliveryMethod.SMS_PLACEHOLDER && !phone) {
      throw new BadRequestException({
        code: 'PHONE_REQUIRED',
        message: 'Telefonul este obligatoriu pentru această metodă de livrare.',
      });
    }
  }

  private deliveryMethod(value: unknown) {
    const method = stringValue(value).toUpperCase() || ResidentPortalInvitationDeliveryMethod.COPY_LINK;
    if (!Object.values(ResidentPortalInvitationDeliveryMethod).includes(method as ResidentPortalInvitationDeliveryMethod)) {
      throw new BadRequestException({
        code: 'INVALID_DELIVERY_METHOD',
        message: 'Metoda de livrare nu este validă.',
      });
    }
    return method as ResidentPortalInvitationDeliveryMethod;
  }

  private invitationStatus(value: unknown) {
    const status = stringValue(value).toUpperCase();
    return Object.values(ResidentPortalInvitationStatus).includes(status as ResidentPortalInvitationStatus)
      ? (status as ResidentPortalInvitationStatus)
      : undefined;
  }

  private accessStatus(value: unknown) {
    const status = stringValue(value).toUpperCase();
    return Object.values(ResidentPortalAccessStatus).includes(status as ResidentPortalAccessStatus)
      ? (status as ResidentPortalAccessStatus)
      : undefined;
  }

  private async markExpiredInvitations(associationId?: string) {
    await this.prisma.residentPortalInvitation.updateMany({
      where: {
        ...(associationId ? { associationId } : {}),
        status: { in: EXPIRABLE_INVITATION_STATUSES },
        expiresAt: { lt: new Date() },
      },
      data: { status: ResidentPortalInvitationStatus.EXPIRED },
    });
  }

  private residentInclude() {
    return {
      user: { select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true } },
      organization: { select: { id: true, name: true, fiscalCode: true, defaultCurrency: true } },
      apartmentResidents: {
        include: {
          apartment: {
            select: {
              id: true,
              number: true,
              floor: true,
              building: { select: { id: true, name: true } },
              staircase: { select: { id: true, name: true } },
            },
          },
        },
      },
      portalInvitations: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        include: {
          apartment: { select: { id: true, number: true, staircase: { select: { id: true, name: true } } } },
        },
      },
    };
  }

  private invitationInclude() {
    return {
      association: { select: { id: true, name: true, fiscalCode: true, defaultCurrency: true } },
      resident: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          userId: true,
          accountStatus: true,
          portalAccessStatus: true,
          apartmentResidents: {
            include: {
              apartment: {
                select: {
                  id: true,
                  number: true,
                  staircase: { select: { id: true, name: true } },
                  building: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
      apartment: { select: { id: true, number: true, staircase: { select: { id: true, name: true } } } },
      createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      acceptedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      cancelledBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      revokedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
    };
  }

  private serializeAssociation(association?: any) {
    if (!association) return null;
    return {
      id: association.id,
      shortName: association.name,
      associationCode: association.fiscalCode || '',
      currency: association.defaultCurrency || 'MDL',
    };
  }

  private serializeUser(user?: any) {
    if (!user) return null;
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return {
      id: user.id,
      fullName: name || user.email || 'Utilizator',
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }

  private serializeApartmentLink(link: any) {
    const apartment = link.apartment || link;
    return {
      id: apartment.id,
      apartmentNumber: apartment.number,
      staircase: apartment.staircase?.name || '',
      building: apartment.building?.name || '',
      floor: apartment.floor ?? null,
      role: link.role,
      isPrimaryContact: Boolean(link.isPrimary),
    };
  }

  private latestInvitation(row: any) {
    return row.portalInvitations?.[0] || null;
  }

  private effectiveAccessStatus(row: any) {
    if (row.portalAccessStatus === ResidentPortalAccessStatus.SUSPENDED) return ResidentPortalAccessStatus.SUSPENDED;
    if (row.portalAccessStatus === ResidentPortalAccessStatus.REVOKED) return ResidentPortalAccessStatus.REVOKED;
    if (row.userId || row.accountStatus === ResidentAccountStatus.CREATED) return ResidentPortalAccessStatus.ACTIVE;
    const latest = this.latestInvitation(row);
    if (latest && ACTIVE_INVITATION_STATUSES.includes(latest.status) && new Date(latest.expiresAt).getTime() >= Date.now()) {
      return ResidentPortalAccessStatus.INVITED;
    }
    return ResidentPortalAccessStatus.NO_ACCESS;
  }

  private serializeResidentAccessRow(row: any) {
    const apartments = (row.apartmentResidents || []).map((link: any) => this.serializeApartmentLink(link));
    const latest = this.latestInvitation(row);
    const accessStatus = this.effectiveAccessStatus(row);
    return {
      resident: {
        id: row.id,
        fullName: fullName(row),
        firstName: row.firstName || '',
        lastName: row.lastName || '',
        phone: row.phone || '',
        email: row.email || '',
        status: row.accountStatus,
      },
      apartments,
      portalAccess: {
        status: accessStatus,
        statusLabel: statusLabel(accessStatus),
        userId: row.userId || null,
        user: this.serializeUser(row.user),
        activatedAt: row.portalAccessActivatedAt || null,
        revokedAt: row.portalAccessRevokedAt || null,
        latestInvitation: latest ? this.serializeInvitation(latest, false) : null,
      },
    };
  }

  private serializeInvitation(invitation: any, includeToken = false, token?: string) {
    const apartments = invitation.resident?.apartmentResidents?.map((link: any) => this.serializeApartmentLink(link)) || [];
    return {
      id: invitation.id,
      residentId: invitation.residentId,
      apartmentId: invitation.apartmentId,
      invitedEmail: invitation.invitedEmail || '',
      invitedPhone: invitation.invitedPhone || '',
      tokenPreview: invitation.tokenPreview || '',
      status: invitation.status,
      deliveryMethod: invitation.deliveryMethod,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      cancelledAt: invitation.cancelledAt,
      revokedAt: invitation.revokedAt,
      lastSentAt: invitation.lastSentAt,
      sendCount: invitation.sendCount,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
      resident: invitation.resident
        ? {
            id: invitation.resident.id,
            fullName: fullName(invitation.resident),
            phone: invitation.resident.phone || '',
            email: invitation.resident.email || '',
            accountStatus: invitation.resident.accountStatus,
            portalAccessStatus: invitation.resident.portalAccessStatus,
          }
        : null,
      apartment: invitation.apartment
        ? {
            id: invitation.apartment.id,
            apartmentNumber: invitation.apartment.number,
            staircase: invitation.apartment.staircase?.name || '',
          }
        : null,
      apartments,
      association: this.serializeAssociation(invitation.association),
      createdBy: this.serializeUser(invitation.createdBy),
      acceptedBy: this.serializeUser(invitation.acceptedBy),
      cancelledBy: this.serializeUser(invitation.cancelledBy),
      revokedBy: this.serializeUser(invitation.revokedBy),
      ...(includeToken && token
        ? {
            inviteLink: this.inviteLink(token),
            rawToken: token,
          }
        : {}),
    };
  }

  private residentWhere(user: MvpUser, query: Record<string, any> = {}): Prisma.ResidentProfileWhereInput {
    const associationId = this.isSuperadmin(user) && query.associationId ? stringValue(query.associationId) : this.associationId(user);
    const search = stringValue(query.search);
    const accessStatus = this.accessStatus(query.portalAccessStatus);
    const hasEmail = query.hasEmail === undefined ? undefined : boolValue(query.hasEmail);
    const hasPhone = query.hasPhone === undefined ? undefined : boolValue(query.hasPhone);
    const hasApartment = query.hasApartment === undefined ? undefined : boolValue(query.hasApartment);
    const isPrimaryContact = query.isPrimaryContact === undefined ? undefined : boolValue(query.isPrimaryContact);
    const role = stringValue(query.role).toUpperCase();
    const invitationStatus = this.invitationStatus(query.invitationStatus);
    const apartmentNumber = stringValue(query.apartmentNumber);
    const staircase = stringValue(query.staircase);

    return {
      organizationId: associationId,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              {
                apartmentResidents: {
                  some: { apartment: { number: { contains: search, mode: 'insensitive' } } },
                },
              },
            ],
          }
        : {}),
      ...(hasEmail === true ? { email: { not: null } } : {}),
      ...(hasEmail === false ? { OR: [{ email: null }, { email: '' }] } : {}),
      ...(hasPhone === true ? { phone: { not: null } } : {}),
      ...(hasPhone === false ? { OR: [{ phone: null }, { phone: '' }] } : {}),
      ...(hasApartment === true ? { apartmentResidents: { some: {} } } : {}),
      ...(hasApartment === false ? { apartmentResidents: { none: {} } } : {}),
      ...(isPrimaryContact === true ? { apartmentResidents: { some: { isPrimary: true } } } : {}),
      ...(isPrimaryContact === false ? { apartmentResidents: { none: { isPrimary: true } } } : {}),
      ...(role ? { apartmentResidents: { some: { role: role as ApartmentResidentRole } } } : {}),
      ...(apartmentNumber
        ? { apartmentResidents: { some: { apartment: { number: { contains: apartmentNumber, mode: 'insensitive' } } } } }
        : {}),
      ...(staircase
        ? { apartmentResidents: { some: { apartment: { staircase: { name: { contains: staircase, mode: 'insensitive' } } } } } }
        : {}),
      ...(invitationStatus ? { portalInvitations: { some: { status: invitationStatus } } } : {}),
      ...(accessStatus === ResidentPortalAccessStatus.SUSPENDED || accessStatus === ResidentPortalAccessStatus.REVOKED
        ? { portalAccessStatus: accessStatus }
        : {}),
      ...(accessStatus === ResidentPortalAccessStatus.ACTIVE
        ? { OR: [{ portalAccessStatus: ResidentPortalAccessStatus.ACTIVE }, { userId: { not: null } }] }
        : {}),
      ...(accessStatus === ResidentPortalAccessStatus.INVITED
        ? {
            portalInvitations: {
              some: { status: { in: ACTIVE_INVITATION_STATUSES }, expiresAt: { gte: new Date() } },
            },
          }
        : {}),
      ...(accessStatus === ResidentPortalAccessStatus.NO_ACCESS
        ? {
            userId: null,
            OR: [{ portalAccessStatus: null }, { portalAccessStatus: ResidentPortalAccessStatus.NO_ACCESS }],
            portalInvitations: {
              none: { status: { in: ACTIVE_INVITATION_STATUSES }, expiresAt: { gte: new Date() } },
            },
          }
        : {}),
    };
  }

  async listResidentAccess(user: MvpUser, query: Record<string, any>) {
    this.assertAdmin(user);
    await this.markExpiredInvitations(this.associationId(user));
    const { page, limit, skip } = resolvePagination(query as any, 20, 100);
    const where = this.residentWhere(user, query);
    const orderBy = this.residentOrderBy(query.sortBy, query.sortDirection);
    const [total, rows] = await Promise.all([
      this.prisma.residentProfile.count({ where }),
      this.prisma.residentProfile.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: this.residentInclude(),
      }),
    ]);
    return {
      items: rows.map((row) => this.serializeResidentAccessRow(row)),
      meta: buildPaginationMeta(page, limit, total),
      stats: await this.stats(user),
    };
  }

  private residentOrderBy(sortBy?: unknown, sortDirection?: unknown): Prisma.ResidentProfileOrderByWithRelationInput[] {
    const direction = String(sortDirection || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
    const key = stringValue(sortBy);
    if (key === 'activatedAt') return [{ portalAccessActivatedAt: direction }, { lastName: 'asc' }, { firstName: 'asc' }];
    if (key === 'status') return [{ portalAccessStatus: direction }, { lastName: 'asc' }];
    if (key === 'createdAt') return [{ createdAt: direction }];
    return [{ lastName: direction }, { firstName: direction }, { createdAt: 'desc' }];
  }

  async stats(user: MvpUser) {
    this.assertAdmin(user);
    await this.markExpiredInvitations(this.associationId(user));
    const rows = await this.prisma.residentProfile.findMany({
      where: { organizationId: this.associationId(user) },
      select: {
        id: true,
        userId: true,
        accountStatus: true,
        portalAccessStatus: true,
        phone: true,
        email: true,
        portalAccessActivatedAt: true,
        portalInvitations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, expiresAt: true },
        },
      },
    });
    const counters = {
      totalResidents: rows.length,
      activeAccess: 0,
      noAccess: 0,
      invited: 0,
      expiredInvitations: 0,
      cancelledInvitations: 0,
      suspended: 0,
      revoked: 0,
      withoutEmailOrPhone: 0,
    };
    for (const row of rows) {
      const status = this.effectiveAccessStatus(row);
      if (status === ResidentPortalAccessStatus.ACTIVE) counters.activeAccess += 1;
      if (status === ResidentPortalAccessStatus.NO_ACCESS) counters.noAccess += 1;
      if (status === ResidentPortalAccessStatus.INVITED) counters.invited += 1;
      if (status === ResidentPortalAccessStatus.SUSPENDED) counters.suspended += 1;
      if (status === ResidentPortalAccessStatus.REVOKED) counters.revoked += 1;
      if (!row.email && !row.phone) counters.withoutEmailOrPhone += 1;
      const latest = row.portalInvitations[0];
      if (latest?.status === ResidentPortalInvitationStatus.EXPIRED) counters.expiredInvitations += 1;
      if (latest?.status === ResidentPortalInvitationStatus.CANCELLED) counters.cancelledInvitations += 1;
    }
    return counters;
  }

  async getResidentAccess(user: MvpUser, residentId: string) {
    this.assertAdmin(user);
    await this.markExpiredInvitations(this.associationId(user));
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id: residentId, organizationId: this.associationId(user) },
      include: {
        ...this.residentInclude(),
        portalInvitations: {
          orderBy: { createdAt: 'desc' },
          include: this.invitationInclude(),
        },
      },
    });
    if (!resident) throw new NotFoundException('Locatarul nu a fost găsit.');
    const [lastLogin, lastResetRequest] = await Promise.all([
      resident.userId
        ? this.prisma.authSecurityEvent.findFirst({
            where: { userId: resident.userId, eventType: AuthSecurityEventType.LOGIN_SUCCESS },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          })
        : null,
      resident.userId
        ? this.prisma.passwordResetRequest.findFirst({
            where: { userId: resident.userId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, status: true, expiresAt: true, createdAt: true },
          })
        : null,
    ]);
    return {
      association: this.serializeAssociation(resident.organization),
      ...this.serializeResidentAccessRow({ ...resident, portalInvitations: resident.portalInvitations.slice(0, 1) }),
      invitations: resident.portalInvitations.map((invitation) => this.serializeInvitation(invitation)),
      auth: {
        lastLoginAt: lastLogin?.createdAt || null,
        lastPasswordResetRequest: lastResetRequest || null,
      },
    };
  }

  async createInvitation(user: MvpUser, residentId: string, body: unknown) {
    this.assertAdmin(user);
    const payload = this.parseBody(body);
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id: residentId, organizationId: this.associationId(user) },
      include: {
        organization: { select: { id: true, name: true, fiscalCode: true, defaultCurrency: true } },
        apartmentResidents: { include: { apartment: true } },
        portalInvitations: {
          where: { status: { in: ACTIVE_INVITATION_STATUSES }, expiresAt: { gte: new Date() } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!resident) throw new NotFoundException('Locatarul nu a fost găsit.');
    if (resident.userId && resident.portalAccessStatus !== ResidentPortalAccessStatus.REVOKED) {
      throw new ConflictException({
        code: 'RESIDENT_ALREADY_ACTIVE',
        message: 'Acest locatar are deja acces activ în portal.',
      });
    }
    if (resident.portalInvitations.length && !boolValue(payload.replaceActiveInvitation)) {
      throw new ConflictException({
        code: 'ACTIVE_INVITATION_EXISTS',
        message: 'Există deja o invitație activă. Anuleaz-o sau confirmă regenerarea.',
      });
    }

    const deliveryMethod = this.deliveryMethod(payload.deliveryMethod);
    const invitedEmail = normalizeEmail(payload.invitedEmail) || normalizeEmail(resident.email);
    const invitedPhone = normalizePhone(payload.invitedPhone) || normalizePhone(resident.phone);
    this.validateEmailForDelivery(invitedEmail, deliveryMethod);
    this.validatePhoneForDelivery(invitedPhone, deliveryMethod);

    const apartmentId = await this.resolveInvitationApartment(resident, payload.apartmentId);
    const token = this.token();
    const expiresAt = this.expiresAt(payload.expiresInDays);
    const created = await this.prisma.$transaction(async (tx) => {
      if (resident.portalInvitations.length) {
        await tx.residentPortalInvitation.updateMany({
          where: { residentId: resident.id, status: { in: ACTIVE_INVITATION_STATUSES } },
          data: {
            status: ResidentPortalInvitationStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelledById: user.id,
            cancellationReason: 'Înlocuită prin invitație nouă.',
          },
        });
      }
      const invitation = await tx.residentPortalInvitation.create({
        data: {
          associationId: resident.organizationId,
          residentId: resident.id,
          apartmentId,
          invitedEmail,
          invitedPhone,
          tokenHash: token.hash,
          tokenPreview: token.preview,
          status:
            deliveryMethod === ResidentPortalInvitationDeliveryMethod.COPY_LINK
              ? ResidentPortalInvitationStatus.PENDING
              : ResidentPortalInvitationStatus.PENDING,
          expiresAt,
          createdById: user.id,
          deliveryMethod,
          metadata: {
            message: nullableString(payload.message),
            rawTokenShownOnce: true,
          },
        },
        include: this.invitationInclude(),
      });
      await tx.residentProfile.update({
        where: { id: resident.id },
        data: {
          email: invitedEmail || resident.email,
          phone: invitedPhone || resident.phone,
          accountStatus: ResidentAccountStatus.INVITED,
          portalAccessStatus: ResidentPortalAccessStatus.INVITED,
        },
      });
      await this.audit.createLog(
        {
          associationId: resident.organizationId,
          actorUserId: user.id,
          actorRole: user.role,
          action: 'RESIDENT_INVITATION_CREATED',
          entityType: 'RESIDENT',
          entityId: resident.id,
          residentId: resident.id,
          title: 'Invitație portal creată',
          message: `A fost creată o invitație de portal pentru ${fullName(resident)}.`,
          severity: 'SUCCESS',
          metadata: {
            residentId: resident.id,
            invitationId: invitation.id,
            deliveryMethod,
            expiresAt,
          },
        },
        tx,
      );
      return invitation;
    });

    return {
      invitation: this.serializeInvitation(created, true, token.raw),
    };
  }

  private async resolveInvitationApartment(resident: any, apartmentId?: unknown) {
    const requested = stringValue(apartmentId);
    if (!requested) return resident.apartmentResidents?.[0]?.apartmentId || resident.apartmentId || null;
    const linked = resident.apartmentResidents?.some((link: any) => link.apartmentId === requested);
    if (!linked && resident.apartmentId !== requested) {
      throw new BadRequestException({
        code: 'APARTMENT_NOT_LINKED',
        message: 'Apartamentul selectat nu este legat de acest locatar.',
      });
    }
    return requested;
  }

  async listInvitations(user: MvpUser, query: Record<string, any>) {
    this.assertAdmin(user);
    await this.markExpiredInvitations(this.associationId(user));
    const { page, limit, skip } = resolvePagination(query as any, 20, 100);
    const status = this.invitationStatus(query.status);
    const deliveryMethod = this.deliveryMethodOrUndefined(query.deliveryMethod);
    const expiredOnly = boolValue(query.expiredOnly);
    const search = stringValue(query.resident || query.search);
    const where: Prisma.ResidentPortalInvitationWhereInput = {
      associationId: this.associationId(user),
      ...(status ? { status } : {}),
      ...(deliveryMethod ? { deliveryMethod } : {}),
      ...(expiredOnly ? { expiresAt: { lt: new Date() }, status: { in: EXPIRABLE_INVITATION_STATUSES } } : {}),
      ...(search
        ? {
            OR: [
              { invitedEmail: { contains: search, mode: 'insensitive' } },
              { invitedPhone: { contains: search, mode: 'insensitive' } },
              { resident: { firstName: { contains: search, mode: 'insensitive' } } },
              { resident: { lastName: { contains: search, mode: 'insensitive' } } },
              { apartment: { number: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.residentPortalInvitation.count({ where }),
      this.prisma.residentPortalInvitation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: this.invitationInclude(),
      }),
    ]);
    return {
      items: rows.map((row) => this.serializeInvitation(row)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  private deliveryMethodOrUndefined(value: unknown) {
    const method = stringValue(value).toUpperCase();
    return Object.values(ResidentPortalInvitationDeliveryMethod).includes(method as ResidentPortalInvitationDeliveryMethod)
      ? (method as ResidentPortalInvitationDeliveryMethod)
      : undefined;
  }

  async getInvitation(user: MvpUser, invitationId: string) {
    this.assertAdmin(user);
    await this.markExpiredInvitations(this.associationId(user));
    const invitation = await this.prisma.residentPortalInvitation.findFirst({
      where: { id: invitationId, associationId: this.associationId(user) },
      include: this.invitationInclude(),
    });
    if (!invitation) throw new NotFoundException('Invitația nu a fost găsită.');
    return { invitation: this.serializeInvitation(invitation) };
  }

  async regenerateInvitation(user: MvpUser, invitationId: string, body: unknown) {
    this.assertAdmin(user);
    const payload = this.parseBody(body);
    const invitation = await this.prisma.residentPortalInvitation.findFirst({
      where: { id: invitationId, associationId: this.associationId(user) },
      include: this.invitationInclude(),
    });
    if (!invitation) throw new NotFoundException('Invitația nu a fost găsită.');
    if (
      invitation.status === ResidentPortalInvitationStatus.ACCEPTED ||
      invitation.status === ResidentPortalInvitationStatus.CANCELLED ||
      invitation.status === ResidentPortalInvitationStatus.REVOKED
    ) {
      throw new BadRequestException({
        code: 'INVITATION_CANNOT_BE_REGENERATED',
        message: 'Această invitație nu poate fi regenerată.',
      });
    }
    const token = this.token();
    const expiresAt = this.expiresAt(payload.expiresInDays || 7);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.residentPortalInvitation.update({
        where: { id: invitation.id },
        data: {
          tokenHash: token.hash,
          tokenPreview: token.preview,
          expiresAt,
          status: ResidentPortalInvitationStatus.PENDING,
          metadata: {
            ...(isRecord(invitation.metadata) ? invitation.metadata : {}),
            regeneratedAt: new Date().toISOString(),
          },
        },
        include: this.invitationInclude(),
      });
      await this.audit.createLog(
        {
          associationId: invitation.associationId,
          actorUserId: user.id,
          actorRole: user.role,
          action: 'RESIDENT_INVITATION_REGENERATED',
          entityType: 'RESIDENT',
          entityId: invitation.residentId,
          residentId: invitation.residentId,
          title: 'Invitație portal regenerată',
          message: `Linkul invitației pentru ${fullName(invitation.resident)} a fost regenerat.`,
          severity: 'SUCCESS',
          metadata: { invitationId: invitation.id, expiresAt },
        },
        tx,
      );
      return row;
    });
    return { invitation: this.serializeInvitation(updated, true, token.raw) };
  }

  async markSent(user: MvpUser, invitationId: string) {
    this.assertAdmin(user);
    const invitation = await this.findAdminInvitation(user, invitationId);
    if (![ResidentPortalInvitationStatus.PENDING, ResidentPortalInvitationStatus.SENT].includes(invitation.status)) {
      throw new BadRequestException('Invitația nu poate fi marcată ca trimisă.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.residentPortalInvitation.update({
        where: { id: invitation.id },
        data: {
          status: ResidentPortalInvitationStatus.SENT,
          lastSentAt: new Date(),
          sendCount: { increment: 1 },
        },
        include: this.invitationInclude(),
      });
      await this.audit.createLog(
        {
          associationId: invitation.associationId,
          actorUserId: user.id,
          actorRole: user.role,
          action: 'RESIDENT_INVITATION_MARKED_SENT',
          entityType: 'RESIDENT',
          entityId: invitation.residentId,
          residentId: invitation.residentId,
          title: 'Invitație marcată ca trimisă',
          message: `Invitația pentru ${fullName(invitation.resident)} a fost marcată ca trimisă manual.`,
          metadata: { invitationId: invitation.id },
        },
        tx,
      );
      return row;
    });
    return { invitation: this.serializeInvitation(updated) };
  }

  async cancelInvitation(user: MvpUser, invitationId: string, body: unknown) {
    this.assertAdmin(user);
    const payload = this.parseBody(body);
    const invitation = await this.findAdminInvitation(user, invitationId);
    if (invitation.status === ResidentPortalInvitationStatus.ACCEPTED) {
      throw new BadRequestException('Invitațiile acceptate nu pot fi anulate.');
    }
    const reason = nullableString(payload.reason) || 'Anulată de administrator.';
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.residentPortalInvitation.update({
        where: { id: invitation.id },
        data: {
          status: ResidentPortalInvitationStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledById: user.id,
          cancellationReason: reason,
        },
        include: this.invitationInclude(),
      });
      const activeCount = await tx.residentPortalInvitation.count({
        where: {
          residentId: invitation.residentId,
          status: { in: ACTIVE_INVITATION_STATUSES },
          expiresAt: { gte: new Date() },
        },
      });
      if (!activeCount) {
        await tx.residentProfile.update({
          where: { id: invitation.residentId },
          data: {
            portalAccessStatus: invitation.resident?.userId ? ResidentPortalAccessStatus.ACTIVE : ResidentPortalAccessStatus.NO_ACCESS,
            accountStatus: invitation.resident?.userId ? ResidentAccountStatus.CREATED : ResidentAccountStatus.NO_ACCOUNT,
          },
        });
      }
      await this.audit.createLog(
        {
          associationId: invitation.associationId,
          actorUserId: user.id,
          actorRole: user.role,
          action: 'RESIDENT_INVITATION_CANCELLED',
          entityType: 'RESIDENT',
          entityId: invitation.residentId,
          residentId: invitation.residentId,
          title: 'Invitație portal anulată',
          message: `Invitația pentru ${fullName(invitation.resident)} a fost anulată.`,
          severity: 'WARNING',
          metadata: { invitationId: invitation.id, reason },
        },
        tx,
      );
      return row;
    });
    return { invitation: this.serializeInvitation(updated) };
  }

  private async findAdminInvitation(user: MvpUser, invitationId: string) {
    const invitation = await this.prisma.residentPortalInvitation.findFirst({
      where: { id: invitationId, associationId: this.associationId(user) },
      include: this.invitationInclude(),
    });
    if (!invitation) throw new NotFoundException('Invitația nu a fost găsită.');
    return invitation as any;
  }

  async linkUser(user: MvpUser, residentId: string, body: unknown) {
    this.assertAdmin(user);
    const payload = this.parseBody(body);
    if (!boolValue(payload.confirm)) {
      throw new BadRequestException('Confirmarea este obligatorie.');
    }
    const userId = stringValue(payload.userId);
    const userEmail = normalizeEmail(payload.userEmail);
    if (!userId && !userEmail) {
      throw new BadRequestException('Indică userId sau emailul utilizatorului.');
    }
    const resident = await this.findResidentForAdmin(user, residentId);
    const targetUser = await this.prisma.user.findFirst({
      where: {
        ...(userId ? { id: userId } : { email: userEmail || '' }),
        organizationId: this.associationId(user),
        deletedAt: null,
      },
      select: { id: true, email: true, role: true, organizationId: true },
    });
    if (!targetUser) throw new NotFoundException('Utilizatorul nu a fost găsit.');
    const linkedResident = await this.prisma.residentProfile.findFirst({
      where: { userId: targetUser.id, organizationId: this.associationId(user), id: { not: resident.id } },
      select: { id: true },
    });
    if (linkedResident) {
      throw new ConflictException('Acest user este deja legat de alt locatar.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUser.id },
        data: { role: Role.RESIDENT, platformRole: PlatformRole.RESIDENT, isActive: true },
      });
      const row = await tx.residentProfile.update({
        where: { id: resident.id },
        data: {
          userId: targetUser.id,
          email: resident.email || targetUser.email,
          accountStatus: ResidentAccountStatus.CREATED,
          portalAccessStatus: ResidentPortalAccessStatus.ACTIVE,
          portalAccessActivatedAt: new Date(),
        },
        include: this.residentInclude(),
      });
      await this.audit.createLog(
        {
          associationId: resident.organizationId,
          actorUserId: user.id,
          actorRole: user.role,
          action: 'RESIDENT_PORTAL_ACCESS_LINKED',
          entityType: 'RESIDENT',
          entityId: resident.id,
          residentId: resident.id,
          title: 'User legat de locatar',
          message: `${fullName(resident)} a fost legat de un cont de portal.`,
          severity: 'SUCCESS',
          metadata: { residentId: resident.id, userId: targetUser.id },
        },
        tx,
      );
      return row;
    });
    return this.serializeResidentAccessRow(updated);
  }

  async preparePasswordReset(user: MvpUser, residentId: string, body: unknown) {
    this.assertAdmin(user);
    const payload = this.parseBody(body);
    const resident = await this.findResidentForAdmin(user, residentId);
    if (!resident.userId) {
      throw new BadRequestException('Locatarul nu are user legat.');
    }
    const portalUser = await this.prisma.user.findFirst({
      where: {
        id: resident.userId,
        organizationId: this.associationId(user),
        deletedAt: null,
      },
      select: { id: true, email: true, role: true },
    });
    if (!portalUser || String(portalUser.role).toUpperCase() !== Role.RESIDENT) {
      throw new BadRequestException('Userul legat nu este un cont de locatar valid.');
    }

    const reset = await this.authSecurity.createPasswordResetRequest({
      email: portalUser.email,
      locale: stringValue(payload.locale) || 'ro',
      expiresInMinutes: 60,
    });
    await this.audit.createLog({
      associationId: resident.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      action: 'RESIDENT_PASSWORD_RESET_PREPARED',
      entityType: 'RESIDENT',
      entityId: resident.id,
      residentId: resident.id,
      title: 'Resetare parolă pregătită',
      message: `Resetarea parolei pentru ${fullName(resident)} a fost pregătită.`,
      severity: 'INFO',
      metadata: {
        residentId: resident.id,
        userId: portalUser.id,
        resetRequestId: reset.resetRequest?.id || null,
        expiresAt: reset.resetRequest?.expiresAt || null,
      },
    });
    return {
      success: true,
      message: 'Resetarea parolei a fost pregătită.',
      resetRequest: reset.resetRequest || null,
      ...(reset.devResetLink ? { devResetLink: reset.devResetLink } : {}),
    };
  }

  async suspendAccess(user: MvpUser, residentId: string, body: unknown) {
    return this.changeAccessStatus(user, residentId, body, ResidentPortalAccessStatus.SUSPENDED);
  }

  async reactivateAccess(user: MvpUser, residentId: string, body: unknown) {
    return this.changeAccessStatus(user, residentId, body, ResidentPortalAccessStatus.ACTIVE);
  }

  async revokeAccess(user: MvpUser, residentId: string, body: unknown) {
    return this.changeAccessStatus(user, residentId, body, ResidentPortalAccessStatus.REVOKED);
  }

  private async changeAccessStatus(user: MvpUser, residentId: string, body: unknown, status: ResidentPortalAccessStatus) {
    this.assertAdmin(user);
    const payload = this.parseBody(body);
    const resident = await this.findResidentForAdmin(user, residentId);
    const reason = nullableString(payload.reason || payload.note);
    if ((status === ResidentPortalAccessStatus.SUSPENDED || status === ResidentPortalAccessStatus.REVOKED) && !reason) {
      throw new BadRequestException('Motivul este obligatoriu.');
    }
    if (status === ResidentPortalAccessStatus.ACTIVE && !resident.userId) {
      throw new BadRequestException('Nu poți reactiva accesul fără user legat.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.residentProfile.update({
        where: { id: resident.id },
        data: {
          portalAccessStatus: status,
          ...(status === ResidentPortalAccessStatus.ACTIVE
            ? { portalAccessActivatedAt: new Date(), portalAccessRevokedAt: null, portalAccessRevokedById: null }
            : {}),
          ...(status === ResidentPortalAccessStatus.REVOKED
            ? { portalAccessRevokedAt: new Date(), portalAccessRevokedById: user.id }
            : {}),
        },
        include: this.residentInclude(),
      });
      if (status === ResidentPortalAccessStatus.REVOKED) {
        await tx.residentPortalInvitation.updateMany({
          where: { residentId: resident.id, status: { in: ACTIVE_INVITATION_STATUSES } },
          data: {
            status: ResidentPortalInvitationStatus.REVOKED,
            revokedAt: new Date(),
            revokedById: user.id,
            revokeReason: reason,
          },
        });
      }
      const action =
        status === ResidentPortalAccessStatus.SUSPENDED
          ? 'RESIDENT_PORTAL_ACCESS_SUSPENDED'
          : status === ResidentPortalAccessStatus.REVOKED
            ? 'RESIDENT_PORTAL_ACCESS_REVOKED'
            : 'RESIDENT_PORTAL_ACCESS_REACTIVATED';
      await this.audit.createLog(
        {
          associationId: resident.organizationId,
          actorUserId: user.id,
          actorRole: user.role,
          action,
          entityType: 'RESIDENT',
          entityId: resident.id,
          residentId: resident.id,
          title: status === ResidentPortalAccessStatus.ACTIVE ? 'Acces portal reactivat' : 'Acces portal actualizat',
          message: `Accesul portal pentru ${fullName(resident)} este acum ${statusLabel(status).toLowerCase()}.`,
          severity: status === ResidentPortalAccessStatus.ACTIVE ? 'SUCCESS' : 'WARNING',
          metadata: { residentId: resident.id, reason, status },
        },
        tx,
      );
      return row;
    });
    return this.serializeResidentAccessRow(updated);
  }

  private async findResidentForAdmin(user: MvpUser, residentId: string) {
    const resident = await this.prisma.residentProfile.findFirst({
      where: { id: residentId, organizationId: this.associationId(user) },
      include: this.residentInclude(),
    });
    if (!resident) throw new NotFoundException('Locatarul nu a fost găsit.');
    return resident as any;
  }

  async publicInvitation(token: string) {
    const invitation = await this.findInvitationByToken(token);
    const status = await this.publicStatus(invitation);
    const valid = status === ResidentPortalInvitationStatus.PENDING || status === ResidentPortalInvitationStatus.SENT;
    return {
      valid,
      invitation: {
        status,
        expiresAt: invitation?.expiresAt || null,
      },
      association: this.serializeAssociation(invitation?.association),
      resident: invitation?.resident
        ? {
            fullName: fullName(invitation.resident),
            email: invitation.invitedEmail || invitation.resident.email || '',
            phone: invitation.invitedPhone || invitation.resident.phone || '',
          }
        : null,
      apartments:
        invitation?.resident?.apartmentResidents?.map((link: any) => ({
          apartmentNumber: link.apartment.number,
          staircase: link.apartment.staircase?.name || '',
          role: link.role,
        })) || [],
    };
  }

  private async publicStatus(invitation: any) {
    if (!invitation) return 'INVALID';
    if (EXPIRABLE_INVITATION_STATUSES.includes(invitation.status) && new Date(invitation.expiresAt).getTime() < Date.now()) {
      await this.prisma.residentPortalInvitation.update({
        where: { id: invitation.id },
        data: { status: ResidentPortalInvitationStatus.EXPIRED },
      });
      return ResidentPortalInvitationStatus.EXPIRED;
    }
    return invitation.status;
  }

  private async findInvitationByToken(token: string) {
    const raw = stringValue(token);
    if (!raw || raw.length < 16) {
      throw new BadRequestException({
        code: 'INVALID_INVITATION',
        message: 'Invitația nu este validă.',
      });
    }
    const invitation = await this.prisma.residentPortalInvitation.findUnique({
      where: { tokenHash: this.hashToken(raw) },
      include: this.invitationInclude(),
    });
    if (!invitation) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: 'Invitația nu este validă.',
      });
    }
    return invitation as any;
  }

  async acceptInvitation(token: string, body: unknown) {
    const payload = this.parseBody(body);
    const invitation = await this.findInvitationByToken(token);
    const status = await this.publicStatus(invitation);
    if (status === ResidentPortalInvitationStatus.EXPIRED) {
      throw new GoneException({
        code: 'INVITATION_EXPIRED',
        message: 'Invitația a expirat. Contactează administratorul pentru o invitație nouă.',
      });
    }
    if (status === ResidentPortalInvitationStatus.ACCEPTED) {
      throw new ConflictException({
        code: 'INVITATION_ACCEPTED',
        message: 'Această invitație a fost deja folosită.',
      });
    }
    if (status !== ResidentPortalInvitationStatus.PENDING && status !== ResidentPortalInvitationStatus.SENT) {
      throw new BadRequestException({
        code: 'INVITATION_NOT_VALID',
        message: 'Această invitație nu mai este validă.',
      });
    }

    const email = normalizeEmail(payload.email) || invitation.invitedEmail || invitation.resident.email;
    const phone = normalizePhone(payload.phone) || invitation.invitedPhone || invitation.resident.phone || null;
    const name = stringValue(payload.fullName) || fullName(invitation.resident);
    const password = stringValue(payload.password);
    const confirmPassword = stringValue(payload.confirmPassword);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Emailul este obligatoriu și trebuie să fie valid.');
    }
    if (password.length < 8) {
      throw new BadRequestException('Parola trebuie să aibă cel puțin 8 caractere.');
    }
    if (password !== confirmPassword) {
      throw new BadRequestException('Parolele nu coincid.');
    }
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, organizationId: true, deletedAt: true },
    });
    if (existingUser && existingUser.id !== invitation.resident.userId) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Există deja un cont cu acest email. Autentifică-te pentru a lega invitația.',
      });
    }

    const [firstName, ...rest] = name.split(/\s+/).filter(Boolean);
    const lastName = rest.join(' ');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const userRecord = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              passwordHash,
              firstName: firstName || invitation.resident.firstName || '',
              lastName: lastName || invitation.resident.lastName || '',
              fullName: name,
              phone,
              role: Role.RESIDENT,
              platformRole: PlatformRole.RESIDENT,
              organizationId: invitation.associationId,
              authProvider: AuthProvider.LOCAL,
              emailVerifiedAt: new Date(),
              isActive: true,
            },
            select: this.safeUserSelect(),
          })
        : await tx.user.create({
            data: {
              email,
              passwordHash,
              firstName: firstName || invitation.resident.firstName || '',
              lastName: lastName || invitation.resident.lastName || '',
              fullName: name,
              phone,
              role: Role.RESIDENT,
              platformRole: PlatformRole.RESIDENT,
              organizationId: invitation.associationId,
              authProvider: AuthProvider.LOCAL,
              emailVerifiedAt: new Date(),
              isActive: true,
            },
            select: this.safeUserSelect(),
          });
      await tx.residentProfile.update({
        where: { id: invitation.residentId },
        data: {
          userId: userRecord.id,
          firstName: firstName || invitation.resident.firstName || '',
          lastName: lastName || invitation.resident.lastName || '',
          email,
          phone,
          accountStatus: ResidentAccountStatus.CREATED,
          portalAccessStatus: ResidentPortalAccessStatus.ACTIVE,
          portalAccessActivatedAt: new Date(),
        },
      });
      await tx.residentPortalInvitation.update({
        where: { id: invitation.id },
        data: {
          status: ResidentPortalInvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedByUserId: userRecord.id,
        },
      });
      await this.audit.createLog(
        {
          associationId: invitation.associationId,
          actorUserId: userRecord.id,
          actorRole: Role.RESIDENT,
          action: 'RESIDENT_INVITATION_ACCEPTED',
          entityType: 'RESIDENT',
          entityId: invitation.residentId,
          residentId: invitation.residentId,
          title: 'Invitație portal acceptată',
          message: `${name} a activat contul de portal.`,
          severity: 'SUCCESS',
          metadata: { invitationId: invitation.id, residentId: invitation.residentId },
        },
        tx,
      );
      return userRecord;
    });

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });
    await this.authSecurity.recordEvent({
      userId: user.id,
      email: user.email,
      eventType: AuthSecurityEventType.INVITATION_ACCEPTED_LOGIN_READY,
      severity: AuthSecurityEventSeverity.INFO,
      metadata: { invitationId: invitation.id, residentId: invitation.residentId },
    });

    return {
      success: true,
      accessToken,
      user,
      redirectPath: '/ro/resident',
    };
  }

  private safeUserSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      organizationId: true,
      organization: { select: { id: true, name: true } },
    };
  }

  async linkExistingAuthenticatedUser(user: MvpUser, token: string) {
    if (String(user.role).toUpperCase() !== Role.RESIDENT) {
      throw new ForbiddenException('Doar locatarii pot lega o invitație.');
    }
    const invitation = await this.findInvitationByToken(token);
    const status = await this.publicStatus(invitation);
    if (status !== ResidentPortalInvitationStatus.PENDING && status !== ResidentPortalInvitationStatus.SENT) {
      throw new BadRequestException('Această invitație nu mai este validă.');
    }
    if (user.organizationId !== invitation.associationId) {
      throw new ForbiddenException('Invitația aparține altei asociații.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.residentProfile.update({
        where: { id: invitation.residentId },
        data: {
          userId: user.id,
          accountStatus: ResidentAccountStatus.CREATED,
          portalAccessStatus: ResidentPortalAccessStatus.ACTIVE,
          portalAccessActivatedAt: new Date(),
        },
      });
      await tx.residentPortalInvitation.update({
        where: { id: invitation.id },
        data: {
          status: ResidentPortalInvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedByUserId: user.id,
        },
      });
    });
    return { success: true, redirectPath: '/ro/resident' };
  }
}
