import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

export type MvpActivityType =
  | 'ORGANIZATION_CREATED'
  | 'ORGANIZATION_STATUS_UPDATED'
  | 'ADMIN_CREATED'
  | 'APARTMENT_CREATED'
  | 'RESIDENT_CREATED'
  | 'RESIDENT_LINKED'
  | 'METER_CREATED'
  | 'METER_READING_ADDED'
  | 'INVOICE_CREATED'
  | 'PAYMENT_REGISTERED'
  | 'ISSUE_CREATED'
  | 'ISSUE_STATUS_UPDATED'
  | 'ANNOUNCEMENT_CREATED';

type ActivityInput = {
  organizationId?: string | null;
  actorUserId?: string | null;
  type: MvpActivityType;
  title: string;
  message: string;
  targetType?: string;
  targetId?: string | null;
  link?: string | null;
};

type NotificationInput = {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
};

@Injectable()
export class ActivityMvpService {
  constructor(private readonly prisma: PrismaService) {}

  async createActivity(input: ActivityInput) {
    if (!input.actorUserId) return null;

    const payload: Record<string, string> = {
      type: input.type,
      title: input.title,
      message: input.message,
    };
    if (input.link) payload.link = input.link;
    if (input.targetType) payload.targetType = input.targetType;
    if (input.targetId) payload.targetId = input.targetId;

    try {
      return await this.prisma.auditLog.create({
        data: {
          organizationId: input.organizationId || null,
          userId: input.actorUserId,
          action: input.type,
          entityType: input.targetType || 'SYSTEM',
          entityId: input.targetId || null,
          description: input.message || input.title,
          newValuesJson: payload as Prisma.InputJsonObject,
        },
      });
    } catch {
      return null;
    }
  }

  async listAdminActivity(user: MvpUser, limit?: unknown) {
    const take = this.limit(limit);
    const where = this.isSuperadmin(user) ? {} : { organizationId: user.organizationId };
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        organization: { select: { id: true, name: true, legalName: true, fiscalCode: true } },
      },
    });

    return rows.map((row) => this.toActivity(row));
  }

  async listSuperadminActivity(limit?: unknown) {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: this.limit(limit),
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        organization: { select: { id: true, name: true, legalName: true, fiscalCode: true } },
      },
    });

    return rows.map((row) => this.toActivity(row));
  }

  async listResidentNotifications(user: MvpUser) {
    const rows = await this.prisma.notification.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return rows.map((row) => this.toNotification(row));
  }

  async markResidentNotificationRead(user: MvpUser, id: string) {
    const row = await this.prisma.notification.updateMany({
      where: {
        id,
        organizationId: user.organizationId,
        userId: user.id,
      },
      data: { isRead: true },
    });

    return { id, isRead: row.count > 0 };
  }

  async markResidentNotificationsReadAll(user: MvpUser) {
    const result = await this.prisma.notification.updateMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { updatedCount: result.count };
  }

  async notifyApartmentResidents(params: {
    organizationId: string;
    apartmentId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string | null;
  }) {
    try {
      const relations = await this.prisma.apartmentResident.findMany({
        where: {
          apartmentId: params.apartmentId,
          apartment: { organizationId: params.organizationId },
          resident: { userId: { not: null } },
        },
        select: {
          resident: { select: { userId: true } },
        },
      });
      const userIds = Array.from(new Set(relations.map((item) => item.resident.userId).filter(Boolean))) as string[];
      await this.createNotifications(
        userIds.map((userId) => ({
          organizationId: params.organizationId,
          userId,
          type: params.type,
          title: params.title,
          message: params.message,
          link: params.link,
        })),
      );
    } catch {
      return;
    }
  }

  async notifyResidentProfile(params: {
    organizationId: string;
    residentId?: string | null;
    type: NotificationType;
    title: string;
    message: string;
    link?: string | null;
  }) {
    if (!params.residentId) return;
    try {
      const resident = await this.prisma.residentProfile.findFirst({
        where: {
          id: params.residentId,
          organizationId: params.organizationId,
          userId: { not: null },
        },
        select: { userId: true },
      });
      if (!resident?.userId) return;
      await this.createNotification({
        organizationId: params.organizationId,
        userId: resident.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
      });
    } catch {
      return;
    }
  }

  async notifyOrganizationResidents(params: {
    organizationId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string | null;
  }) {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          organizationId: params.organizationId,
          role: Role.RESIDENT,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      await this.createNotifications(
        users.map((user) => ({
          organizationId: params.organizationId,
          userId: user.id,
          type: params.type,
          title: params.title,
          message: params.message,
          link: params.link,
        })),
      );
    } catch {
      return;
    }
  }

  async createNotification(input: NotificationInput) {
    try {
      return await this.prisma.notification.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          link: input.link || null,
        },
      });
    } catch {
      return null;
    }
  }

  private async createNotifications(inputs: NotificationInput[]) {
    if (!inputs.length) return;
    try {
      await this.prisma.notification.createMany({
        data: inputs.map((input) => ({
          organizationId: input.organizationId,
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          link: input.link || null,
        })),
      });
    } catch {
      return;
    }
  }

  private toActivity(row: any) {
    const payload = this.objectPayload(row.newValuesJson);
    const title = this.stringValue(payload.title) || row.description || row.action;
    const message = this.stringValue(payload.message) || row.description || title;

    return {
      id: row.id,
      type: row.action,
      title,
      message,
      actor: row.user
        ? {
            id: row.user.id,
            name: this.fullName(row.user),
            email: row.user.email,
          }
        : null,
      organization: row.organization
        ? {
            id: row.organization.id,
            name: row.organization.name,
            legalName: row.organization.legalName,
            associationCode: row.organization.fiscalCode,
          }
        : null,
      targetType: row.entityType,
      targetId: row.entityId,
      link: this.stringValue(payload.link) || null,
      createdAt: row.createdAt,
    };
  }

  private toNotification(row: any) {
    return {
      id: row.id,
      title: row.title,
      message: row.message,
      type: row.type,
      isRead: row.isRead,
      readAt: row.isRead ? row.createdAt : null,
      createdAt: row.createdAt,
      link: row.link,
    };
  }

  private objectPayload(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  private fullName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Utilizator';
  }

  private isSuperadmin(user: MvpUser) {
    return String(user.role).toUpperCase() === Role.SUPERADMIN;
  }

  private limit(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 20;
    return Math.min(50, Math.max(1, Math.trunc(parsed)));
  }
}
