import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MeterReadingSource, MeterStatus, MeterType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

@Injectable()
export class MetersService {
  constructor(private readonly prisma: PrismaService) {}

  private meterSelect(): Prisma.MeterSelect {
    return {
      id: true,
      organizationId: true,
      apartmentId: true,
      type: true,
      serialNumber: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      apartment: {
        select: {
          id: true,
          number: true,
          floor: true,
          areaM2: true,
          rooms: true,
          status: true,
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
        },
      },
      readings: {
        orderBy: { readingDate: 'desc' },
        take: 12,
        select: {
          id: true,
          value: true,
          readingDate: true,
          source: true,
          createdAt: true,
        },
      },
    };
  }

  private toMeter(row: any) {
    const lastReading = row.readings?.[0] ?? null;

    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      type: row.type,
      serialNumber: row.serialNumber,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      apartment: row.apartment
        ? {
            id: row.apartment.id,
            number: row.apartment.number,
            floor: row.apartment.floor,
            areaM2: row.apartment.areaM2,
            rooms: row.apartment.rooms,
            status: row.apartment.status,
          }
        : null,
      building: row.apartment?.building ?? null,
      staircase: row.apartment?.staircase ?? null,
      lastReading: lastReading
        ? {
            id: lastReading.id,
            value: lastReading.value,
            readingDate: lastReading.readingDate,
            source: lastReading.source,
            createdAt: lastReading.createdAt,
          }
        : null,
      readings: row.readings || [],
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

  async listMeters(user: MvpUser) {
    const meters = await this.prisma.meter.findMany({
      where: this.organizationWhere(user),
      orderBy: [
        { apartment: { staircase: { name: 'asc' } } },
        { apartment: { number: 'asc' } },
        { type: 'asc' },
      ],
      select: this.meterSelect(),
    });

    return meters.map((meter) => this.toMeter(meter));
  }

  async createMeter(user: MvpUser, body: unknown) {
    const input = this.parseCreateMeterBody(body);
    if (!this.isSuperadmin(user)) {
      input.organizationId = user.organizationId;
    }
    this.assertOrganizationAccess(user, input.organizationId);

    const [organization, apartment] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { id: true },
      }),
      this.prisma.apartment.findFirst({
        where: {
          id: input.apartmentId,
          organizationId: input.organizationId,
        },
        select: { id: true },
      }),
    ]);

    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (!apartment) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const duplicate = await this.prisma.meter.findFirst({
      where: {
        organizationId: input.organizationId,
        serialNumber: input.serialNumber,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Acest contor există deja.');
    }

    const meter = await this.prisma.meter.create({
      data: input,
      select: this.meterSelect(),
    });

    return this.toMeter(meter);
  }

  async addReading(user: MvpUser, meterId: string, body: unknown) {
    const input = this.parseAddReadingBody(body);
    const meter = await this.prisma.meter.findUnique({
      where: { id: meterId },
      select: {
        id: true,
        apartmentId: true,
        organizationId: true,
      },
    });

    if (!meter) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }
    this.assertOrganizationAccess(user, meter.organizationId);

    const reading = await this.prisma.meterReading.create({
      data: {
        meterId: meter.id,
        apartmentId: meter.apartmentId,
        organizationId: meter.organizationId,
        value: input.value,
        readingDate: input.readingDate,
        source: input.source,
      },
      select: {
        id: true,
        meterId: true,
        apartmentId: true,
        organizationId: true,
        value: true,
        readingDate: true,
        source: true,
        createdAt: true,
      },
    });

    await this.prisma.meter.update({
      where: { id: meter.id },
      data: { status: MeterStatus.ACTIVE },
    });

    return reading;
  }

  async getMeter(user: MvpUser, id: string) {
    const meter = await this.prisma.meter.findFirst({
      where: {
        ...this.organizationWhere(user),
        OR: [{ id }, { serialNumber: id }],
      },
      select: this.meterSelect(),
    });

    if (!meter) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    return this.toMeter(meter);
  }

  private parseCreateMeterBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.requiredString(payload.organizationId, 'Organizația este obligatorie.');
    const apartmentId = this.requiredString(payload.apartmentId, 'Apartamentul este obligatoriu.');
    const type = this.optionalEnum(payload.type, MeterType, null, 'Tipul contorului nu este valid.');
    const serialNumber = this.requiredString(payload.serialNumber, 'Seria contorului este obligatorie.');
    const status = this.optionalEnum(payload.status, MeterStatus, MeterStatus.ACTIVE, 'Statusul contorului nu este valid.');

    if (!type) {
      throw new BadRequestException('Tipul contorului este obligatoriu.');
    }

    return {
      organizationId,
      apartmentId,
      type,
      serialNumber,
      status,
    };
  }

  private parseAddReadingBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const value = this.requiredNumber(payload.value, 'Valoarea citirii este obligatorie.');
    const readingDate =
      typeof payload.readingDate === 'string' && payload.readingDate.trim()
        ? new Date(payload.readingDate)
        : new Date();
    const source = this.optionalEnum(payload.source, MeterReadingSource, MeterReadingSource.ADMIN, 'Sursa citirii nu este validă.');

    if (Number.isNaN(readingDate.getTime())) {
      throw new BadRequestException('Data citirii nu este validă.');
    }

    return {
      value,
      readingDate,
      source,
    };
  }

  private requiredNumber(value: unknown, message: string) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(message);
    }
    return parsed;
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(message);
    }
    return value.trim();
  }

  private optionalEnum<T extends Record<string, string>, F extends T[keyof T] | null>(
    value: unknown,
    enumValues: T,
    fallback: F,
    message: string,
  ) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') throw new BadRequestException(message);
    const normalized = value.trim().toUpperCase();
    const allowed = Object.values(enumValues) as string[];
    if (!allowed.includes(normalized)) throw new BadRequestException(message);
    return normalized as T[keyof T];
  }
}
