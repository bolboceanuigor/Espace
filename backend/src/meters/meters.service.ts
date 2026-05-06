import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MetersService {
  constructor(private readonly prisma: PrismaService) {}

  private meterSelect(): Prisma.MeterSelect {
    return {
      id: true,
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

  async listMeters() {
    const meters = await this.prisma.meter.findMany({
      orderBy: [
        { apartment: { staircase: { name: 'asc' } } },
        { apartment: { number: 'asc' } },
        { type: 'asc' },
      ],
      select: this.meterSelect(),
    });

    return meters.map((meter) => this.toMeter(meter));
  }

  async getMeter(id: string) {
    const meter = await this.prisma.meter.findFirst({
      where: {
        OR: [{ id }, { serialNumber: id }],
      },
      select: this.meterSelect(),
    });

    if (!meter) {
      throw new NotFoundException('Meter not found');
    }

    return this.toMeter(meter);
  }
}
