import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingCurrency, OrganizationStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly publicSelect = {
    id: true,
    name: true,
    address: true,
    city: true,
    country: true,
    currency: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    _count: {
      select: {
        apartments: true,
        users: true,
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
      },
    },
  } as const;

  private toPublicOrganization(organization: {
    id: string;
    name: string;
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
  }) {
    return {
      id: organization.id,
      name: organization.name,
      address: organization.address,
      city: organization.city,
      country: organization.country,
      currency: organization.currency,
      status: organization.status,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      apartmentsCount: organization._count?.apartments ?? 0,
      usersCount: organization._count?.users ?? 0,
    };
  }

  async listPublicOrganizations() {
    const organizations = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: this.publicSelect,
    });

    return organizations.map((organization) => this.toPublicOrganization(organization));
  }

  async createPublicOrganization(body: unknown) {
    const input = this.parseCreateOrganizationBody(body);

    const organization = await this.prisma.organization.create({
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

  async createPublicOrganizationAdmin(organizationId: string, body: unknown) {
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

    return this.toPublicAdmin(admin);
  }

  async findPublicOrganization(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: this.publicSelect,
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return this.toPublicOrganization(organization);
  }

  private parseCreateOrganizationBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const name = this.requiredString(payload.name, 'Numele asociației este obligatoriu.');
    const address = this.requiredString(payload.address, 'Adresa este obligatorie.');
    const city = this.requiredString(payload.city, 'Orașul este obligatoriu.');
    const country = this.requiredString(payload.country, 'Țara este obligatorie.');
    const currency = this.optionalEnum(payload.currency, BillingCurrency, BillingCurrency.MDL, 'Moneda nu este validă.');
    const status = this.optionalEnum(payload.status, OrganizationStatus, OrganizationStatus.ACTIVE, 'Statusul nu este valid.');

    return {
      name,
      address,
      city,
      country,
      currency,
      defaultCurrency: currency,
      status,
    };
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
      throw new BadRequestException('Parola temporară trebuie să aibă cel puțin 8 caractere.');
    }

    return {
      firstName,
      lastName,
      email,
      phone: phone || null,
      password,
    };
  }

  private async ensureOrganizationExists(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
  }

  private toPublicAdmin(admin: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    role: string;
    organizationId: string;
    createdAt: Date;
    organization?: {
      id: string;
      name: string;
    } | null;
  }) {
    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      phone: admin.phone,
      role: admin.role,
      organizationId: admin.organizationId,
      organization: admin.organization
        ? {
            id: admin.organization.id,
            name: admin.organization.name,
          }
        : null,
      createdAt: admin.createdAt,
    };
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(message);
    }
    return value.trim();
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
