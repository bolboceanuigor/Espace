import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

@Injectable()
export class MessagesMvpService {
  constructor(private readonly prisma: PrismaService) {}

  private isSuperadmin(user: MvpUser) {
    return String(user.role).toUpperCase() === Role.SUPERADMIN;
  }

  private organizationWhere(user: MvpUser) {
    return this.isSuperadmin(user) ? {} : { organizationId: user.organizationId };
  }

  private threadSelect(): Prisma.MessageThreadSelect {
    return {
      id: true,
      organizationId: true,
      apartmentId: true,
      residentId: true,
      subject: true,
      createdAt: true,
      updatedAt: true,
      apartment: {
        select: {
          id: true,
          number: true,
          staircase: { select: { id: true, name: true } },
        },
      },
      resident: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          senderId: true,
          content: true,
          createdAt: true,
          readAt: true,
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
      },
    };
  }

  private fullName(person?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
    const name = `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
    return name || person?.email || null;
  }

  private toThread(row: any) {
    const messages = row.messages || [];
    const lastMessage = messages[messages.length - 1] ?? null;
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      residentId: row.residentId,
      subject: row.subject,
      apartmentNumber: row.apartment?.number ?? null,
      apartment: row.apartment ?? null,
      residentName: this.fullName(row.resident),
      resident: row.resident
        ? {
            id: row.resident.id,
            name: this.fullName(row.resident),
            phone: row.resident.phone,
            email: row.resident.email,
          }
        : null,
      preview: lastMessage?.content ?? '',
      lastMessageAt: lastMessage?.createdAt ?? row.updatedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      messages: messages.map((message: any) => ({
        id: message.id,
        senderId: message.senderId,
        senderName: this.fullName(message.sender),
        senderRole: message.sender?.role ?? null,
        content: message.content,
        createdAt: message.createdAt,
        readAt: message.readAt,
      })),
    };
  }

  private async residentScope(user: MvpUser) {
    const profiles = await this.prisma.residentProfile.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        apartmentId: true,
        apartmentResidents: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: { apartmentId: true, isPrimary: true },
        },
      },
    });

    const apartmentIds = new Set<string>();
    for (const profile of profiles) {
      if (profile.apartmentId) apartmentIds.add(profile.apartmentId);
      for (const relation of profile.apartmentResidents || []) {
        apartmentIds.add(relation.apartmentId);
      }
    }

    return {
      residentIds: profiles.map((profile) => profile.id),
      apartmentIds: Array.from(apartmentIds),
      primaryResidentId: profiles[0]?.id ?? null,
      primaryApartmentId: Array.from(apartmentIds)[0] ?? null,
    };
  }

  async listResidentThreads(user: MvpUser) {
    const scope = await this.residentScope(user);
    if (!scope.residentIds.length && !scope.apartmentIds.length) return [];

    const threads = await this.prisma.messageThread.findMany({
      where: {
        organizationId: user.organizationId,
        OR: [
          { residentId: { in: scope.residentIds.length ? scope.residentIds : ['__none__'] } },
          { apartmentId: { in: scope.apartmentIds.length ? scope.apartmentIds : ['__none__'] } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: this.threadSelect(),
    });

    return threads.map((thread) => this.toThread(thread));
  }

  async sendResidentMessage(user: MvpUser, body: unknown) {
    const scope = await this.residentScope(user);
    if (!scope.primaryResidentId && !scope.primaryApartmentId) {
      throw new ForbiddenException({
        code: 'RESIDENT_APARTMENT_NOT_LINKED',
        message: 'Contul tău nu este conectat încă la un apartament.',
      });
    }

    const content = this.requiredString((body as any)?.content, 'Mesajul este obligatoriu.');
    const subject =
      typeof (body as any)?.subject === 'string' && (body as any).subject.trim()
        ? (body as any).subject.trim()
        : 'Mesaj către administrație';

    let thread = await this.prisma.messageThread.findFirst({
      where: {
        organizationId: user.organizationId,
        residentId: scope.primaryResidentId,
        apartmentId: scope.primaryApartmentId,
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    if (!thread) {
      thread = await this.prisma.messageThread.create({
        data: {
          organizationId: user.organizationId,
          residentId: scope.primaryResidentId,
          apartmentId: scope.primaryApartmentId,
          subject,
        },
        select: { id: true },
      });
    }

    await this.prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: user.id,
        content,
      },
    });
    await this.prisma.messageThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    return this.getThreadForResident(user, thread.id);
  }

  async listAdminThreads(user: MvpUser) {
    const threads = await this.prisma.messageThread.findMany({
      where: this.organizationWhere(user),
      orderBy: { updatedAt: 'desc' },
      select: this.threadSelect(),
    });
    return threads.map((thread) => this.toThread(thread));
  }

  async sendAdminMessage(user: MvpUser, body: unknown) {
    const threadId = this.requiredString((body as any)?.threadId, 'Conversația este obligatorie.');
    const content = this.requiredString((body as any)?.content, 'Mesajul este obligatoriu.');
    const thread = await this.prisma.messageThread.findFirst({
      where: { id: threadId, ...this.organizationWhere(user) },
      select: { id: true, organizationId: true },
    });
    if (!thread) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    await this.prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: user.id,
        content,
      },
    });
    await this.prisma.messageThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    return this.getThreadForAdmin(user, thread.id);
  }

  private async getThreadForResident(user: MvpUser, threadId: string) {
    const scope = await this.residentScope(user);
    const thread = await this.prisma.messageThread.findFirst({
      where: {
        id: threadId,
        organizationId: user.organizationId,
        OR: [
          { residentId: { in: scope.residentIds.length ? scope.residentIds : ['__none__'] } },
          { apartmentId: { in: scope.apartmentIds.length ? scope.apartmentIds : ['__none__'] } },
        ],
      },
      select: this.threadSelect(),
    });
    if (!thread) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return this.toThread(thread);
  }

  private async getThreadForAdmin(user: MvpUser, threadId: string) {
    const thread = await this.prisma.messageThread.findFirst({
      where: { id: threadId, ...this.organizationWhere(user) },
      select: this.threadSelect(),
    });
    if (!thread) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return this.toThread(thread);
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(message);
    return value.trim();
  }
}
