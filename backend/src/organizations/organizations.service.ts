import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingCurrency, OrganizationStatus } from '@prisma/client';
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
