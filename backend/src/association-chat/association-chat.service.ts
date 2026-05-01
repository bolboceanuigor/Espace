import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { ListAssociationChatMessagesDto } from './dto/list-association-chat-messages.dto';

@Injectable()
export class AssociationChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async listMessages(organizationId: string, dto: ListAssociationChatMessagesDto) {
    const limit = dto.limit ?? 60;
    let cursorDate: Date | undefined;

    if (dto.beforeId) {
      const cursor = await this.prisma.associationChatMessage.findFirst({
        where: { id: dto.beforeId, organizationId },
        select: { createdAt: true },
      });
      cursorDate = cursor?.createdAt;
    }

    const items = await this.prisma.associationChatMessage.findMany({
      where: {
        organizationId,
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const ordered = [...items].reverse();
    return {
      items: ordered.map((item) => ({
        id: item.id,
        text: item.text,
        createdAt: item.createdAt,
        sender: {
          id: item.sender.id,
          firstName: item.sender.firstName,
          lastName: item.sender.lastName,
          email: item.sender.email,
          role: item.sender.role,
        },
      })),
      hasMore: items.length === limit,
      nextBeforeId: ordered.length ? ordered[0].id : null,
    };
  }

  async sendMessage(organizationId: string, senderId: string, text: string) {
    const created = await this.prisma.associationChatMessage.create({
      data: {
        organizationId,
        senderId,
        text: text.trim(),
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const payload = {
      id: created.id,
      text: created.text,
      createdAt: created.createdAt,
      sender: {
        id: created.sender.id,
        firstName: created.sender.firstName,
        lastName: created.sender.lastName,
        email: created.sender.email,
        role: created.sender.role,
      },
    };

    this.eventsGateway.emitToOrganization(organizationId, 'association-chat:new-message', payload);
    return payload;
  }
}
