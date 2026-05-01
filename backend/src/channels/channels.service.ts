import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Channel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePropertyChannelDto } from './dto/update-property-channel.dto';
import { SyncIcalDto } from './dto/sync-ical.dto';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertChannelsEnabled() {
    if (process.env.ENABLE_CHANNELS_UI !== 'true') {
      throw new NotFoundException('Channels feature is disabled');
    }
  }

  async listSettings(organizationId: string) {
    this.assertChannelsEnabled();
    const [properties, channels] = await Promise.all([
      this.prisma.property.findMany({
        where: { organizationId, deletedAt: null, isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.propertyChannel.findMany({
        where: { organizationId },
        select: {
          id: true,
          propertyId: true,
          channel: true,
          isEnabled: true,
          icsUrl: true,
          externalListingId: true,
          updatedAt: true,
        },
      }),
    ]);

    const byProperty = new Map<string, typeof channels>();
    channels.forEach((item) => {
      const list = byProperty.get(item.propertyId) || [];
      list.push(item);
      byProperty.set(item.propertyId, list);
    });

    return {
      properties: properties.map((property) => ({
        ...property,
        channels: byProperty.get(property.id) || [],
      })),
    };
  }

  async updatePropertyChannel(
    organizationId: string,
    role: string,
    propertyId: string,
    dto: UpdatePropertyChannelDto,
  ) {
    this.assertChannelsEnabled();
    if ((role || '').toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Only admins can update channel settings');
    }

    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return this.prisma.propertyChannel.upsert({
      where: { propertyId_channel: { propertyId, channel: dto.channel } },
      update: {
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        ...(dto.icsUrl !== undefined ? { icsUrl: dto.icsUrl } : {}),
        ...(dto.externalListingId !== undefined ? { externalListingId: dto.externalListingId } : {}),
      },
      create: {
        organizationId,
        propertyId,
        channel: dto.channel,
        isEnabled: dto.isEnabled ?? false,
        icsUrl: dto.icsUrl,
        externalListingId: dto.externalListingId,
      },
    });
  }

  async syncIcalPlaceholder(organizationId: string, role: string, dto: SyncIcalDto) {
    this.assertChannelsEnabled();
    if ((role || '').toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Only admins can run iCal sync');
    }

    const where: any = {
      organizationId,
      isEnabled: true,
      ...(dto.propertyId ? { propertyId: dto.propertyId } : {}),
      ...(dto.channel ? { channel: dto.channel } : { channel: { in: [Channel.AIRBNB, Channel.BOOKING] } }),
    };

    const configured = await this.prisma.propertyChannel.count({ where });
    return {
      imported: 0,
      updated: 0,
      skipped: configured,
    };
  }
}

