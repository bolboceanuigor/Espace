import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingCurrency, OrganizationStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import type { MvpUser } from '../security/mvp-auth.guard';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityMvpService,
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
