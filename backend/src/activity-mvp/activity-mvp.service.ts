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
  | 'RESIDENT_UPDATED'
  | 'RESIDENT_LINKED'
  | 'METER_CREATED'
  | 'METER_READING_ADDED'
  | 'METER_READING_SAVED'
  | 'METER_READING_BULK_SAVED'
  | 'METER_READING_PERIOD_CREATED'
  | 'METER_READING_PERIOD_RECALCULATED'
  | 'METER_READING_PERIOD_LOCKED'
  | 'METER_READING_PERIOD_UNLOCKED'
  | 'INVOICE_CREATED'
  | 'PAYMENT_REGISTERED'
  | 'ISSUE_CREATED'
  | 'ISSUE_STATUS_UPDATED'
  | 'ANNOUNCEMENT_CREATED'
  | 'DOCUMENT_CREATED'
  | 'DOCUMENT_UPDATED';

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

type NotificationListQuery = Record<string, string | undefined>;

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

  async listResidentNotifications(user: MvpUser, query: NotificationListQuery = {}) {
    return this.listNotificationsForUser(user, query);
  }

  async listAdminNotifications(user: MvpUser, query: NotificationListQuery = {}) {
    return this.listNotificationsForUser(user, query);
  }

  private async listNotificationsForUser(user: MvpUser, query: NotificationListQuery = {}) {
    const rows = await this.prisma.notification.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const allItems = rows.map((row) => this.toNotification(row));
    const filtered = this.filterNotifications(allItems, query);
    const sorted = this.sortNotifications(filtered, query.sortBy, query.sortDirection);
    const page = this.positiveInt(query.page, 1);
    const limit = Math.min(this.positiveInt(query.limit, 20), 100);
    const start = (page - 1) * limit;
    return {
      items: sorted.slice(start, start + limit),
      meta: { page, limit, total: filtered.length },
      stats: this.notificationStats(allItems),
    };
  }

  async getResidentUnreadCount(user: MvpUser) {
    return this.getUnreadCountForUser(user);
  }

  async getAdminUnreadCount(user: MvpUser) {
    return this.getUnreadCountForUser(user);
  }

  private async getUnreadCountForUser(user: MvpUser) {
    const rows = await this.prisma.notification.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        isRead: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const items = rows.map((row) => this.toNotification(row));
    const byType = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});
    return {
      unread: items.length,
      urgentUnread: items.filter((item) => item.severity === 'URGENT').length,
      byType,
    };
  }

  async markResidentNotificationRead(user: MvpUser, id: string) {
    return this.markNotificationRead(user, id);
  }

  async markAdminNotificationRead(user: MvpUser, id: string) {
    return this.markNotificationRead(user, id);
  }

  private async markNotificationRead(user: MvpUser, id: string) {
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

  async markResidentNotificationsReadAll(user: MvpUser, body: unknown = {}) {
    return this.markNotificationsReadAll(user, body);
  }

  async markAdminNotificationsReadAll(user: MvpUser, body: unknown = {}) {
    return this.markNotificationsReadAll(user, body);
  }

  private async markNotificationsReadAll(user: MvpUser, body: unknown = {}) {
    const payload = this.objectPayload(body);
    const type = this.stringValue(payload.type).toUpperCase();
    if (type) {
      const rows = await this.prisma.notification.findMany({
        where: {
          organizationId: user.organizationId,
          userId: user.id,
          isRead: false,
        },
        select: { id: true, title: true, message: true, type: true, isRead: true, link: true, createdAt: true },
      });
      const ids = rows
        .map((row) => this.toNotification(row))
        .filter((row) => row.type === type)
        .map((row) => row.id);
      if (!ids.length) return { updatedCount: 0 };
      const result = await this.prisma.notification.updateMany({
        where: { id: { in: ids }, organizationId: user.organizationId, userId: user.id },
        data: { isRead: true },
      });
      return { updatedCount: result.count };
    }

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

  async markNotificationsReadByLink(params: {
    organizationId: string;
    userId: string;
    link: string;
    type?: NotificationType;
  }) {
    if (!params.link) return { updatedCount: 0 };
    const result = await this.prisma.notification.updateMany({
      where: {
        organizationId: params.organizationId,
        userId: params.userId,
        link: params.link,
        ...(params.type ? { type: params.type } : {}),
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

  async notifyOrganizationAdmins(params: {
    organizationId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string | null;
    assignedUserId?: string | null;
  }) {
    try {
      const assignedUserId = typeof params.assignedUserId === 'string' && params.assignedUserId.trim() ? params.assignedUserId.trim() : null;
      const assigned = assignedUserId
        ? await this.prisma.user.findFirst({
            where: {
              id: assignedUserId,
              organizationId: params.organizationId,
              role: Role.ADMIN,
              isActive: true,
              deletedAt: null,
            },
            select: { id: true },
          })
        : null;
      const users = assigned
        ? [assigned]
        : await this.prisma.user.findMany({
            where: {
              organizationId: params.organizationId,
              role: Role.ADMIN,
              isActive: true,
              deletedAt: null,
            },
            select: { id: true },
          });
      await this.notifyUsers({
        organizationId: params.organizationId,
        userIds: users.map((user) => user.id),
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
      });
    } catch {
      return;
    }
  }

  async notifyUsers(params: {
    organizationId: string;
    userIds: string[];
    type: NotificationType;
    title: string;
    message: string;
    link?: string | null;
  }) {
    const userIds = Array.from(new Set(params.userIds.filter(Boolean)));
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
  }

  async createNotification(input: NotificationInput) {
    try {
      const existing = await this.prisma.notification.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          link: input.link || null,
        },
        select: { id: true },
      });
      if (existing) return existing;
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
      for (const input of inputs) {
        await this.createNotification(input);
      }
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
    const type = this.presentationNotificationType(row);
    const entity = this.notificationEntity(row.link, type);
    const severity = this.presentationNotificationSeverity(row, type);
    return {
      id: row.id,
      title: row.title,
      message: row.message,
      type,
      rawType: row.type,
      severity,
      entityType: entity.entityType,
      entityId: entity.entityId,
      isRead: row.isRead,
      readAt: row.isRead ? row.createdAt : null,
      createdAt: row.createdAt,
      link: row.link,
      actionUrl: row.link,
    };
  }

  private filterNotifications(items: any[], query: NotificationListQuery) {
    const type = this.stringValue(query.type).toUpperCase();
    const severity = this.stringValue(query.severity).toUpperCase();
    const unreadOnly = query.unreadOnly === 'true';
    const readStatus = this.stringValue(query.status).toUpperCase();
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
    const dateTo = query.dateTo ? new Date(query.dateTo) : null;
    return items.filter((item) => {
      if (type && item.type !== type) return false;
      if (severity && item.severity !== severity) return false;
      if (unreadOnly && item.isRead) return false;
      if (readStatus === 'UNREAD' && item.isRead) return false;
      if (readStatus === 'READ' && !item.isRead) return false;
      if (dateFrom && new Date(item.createdAt) < dateFrom) return false;
      if (dateTo && new Date(item.createdAt) > dateTo) return false;
      return true;
    });
  }

  private sortNotifications(items: any[], sortBy?: string, sortDirection?: string) {
    const direction = sortDirection === 'asc' || sortBy === 'oldest' ? 1 : -1;
    const severityWeight: Record<string, number> = { URGENT: 4, WARNING: 3, SUCCESS: 2, INFO: 1 };
    return [...items].sort((a, b) => {
      if (sortBy === 'unread') {
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      }
      if (sortBy === 'urgent' || sortBy === 'severity') {
        const diff = (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
        if (diff !== 0) return diff;
      }
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
    });
  }

  private notificationStats(items: any[]) {
    return {
      total: items.length,
      unread: items.filter((item) => !item.isRead).length,
      urgent: items.filter((item) => item.severity === 'URGENT').length,
      byType: items.reduce<Record<string, number>>((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {}),
    };
  }

  private presentationNotificationType(row: any) {
    const raw = String(row.type || '').toUpperCase();
    const link = String(row.link || '').toLowerCase();
    const text = `${row.title || ''} ${row.message || ''}`.toLowerCase();
    if (raw === NotificationType.ANNOUNCEMENT) return 'ANNOUNCEMENT';
    if (raw === NotificationType.INVOICE) return 'INVOICE';
    if (raw === NotificationType.PAYMENT) return 'PAYMENT';
    if (link.includes('/meter-readings/') || link.includes('/meters/') || text.includes('indice') || text.includes('contor')) {
      return 'METER_READING';
    }
    if (link.includes('resident-update-requests') || link.includes('/resident/profile') || text.includes('actualizare date')) {
      return 'PROFILE_UPDATE_REQUEST';
    }
    if (raw === NotificationType.ISSUE || link.includes('/requests/')) {
      if (text.includes('comentariu') || text.includes('răspuns') || text.includes('raspuns')) return 'REQUEST_MESSAGE';
      if (text.includes('status') || text.includes('rezolvat') || text.includes('închis') || text.includes('inchis') || text.includes('anulat')) {
        return 'REQUEST_STATUS';
      }
      return 'REQUEST';
    }
    return 'SYSTEM';
  }

  private presentationNotificationSeverity(row: any, type: string) {
    const text = `${row.title || ''} ${row.message || ''}`.toLowerCase();
    if (text.includes('urgent') || text.includes('critică') || text.includes('critica')) return 'URGENT';
    if (text.includes('respins') || text.includes('avertizare') || text.includes('restant')) return 'WARNING';
    if (type === 'PAYMENT' || text.includes('aprobat') || text.includes('achitat')) return 'SUCCESS';
    if (type === 'ANNOUNCEMENT' && (text.includes('important') || text.includes('mentenanță') || text.includes('mentenanta'))) return 'WARNING';
    return 'INFO';
  }

  private notificationEntity(link: string | null | undefined, type: string) {
    const value = String(link || '');
    const match = value.match(/\/(announcements|requests|invoices|payments|meter-readings|meters|resident-update-requests|apartments|residents)\/([^/?#]+)/);
    const id = match?.[2] || null;
    if (match?.[1] === 'announcements') return { entityType: 'ANNOUNCEMENT', entityId: id };
    if (match?.[1] === 'requests') return { entityType: 'RESIDENT_REQUEST', entityId: id };
    if (match?.[1] === 'invoices') return { entityType: 'INVOICE', entityId: id };
    if (match?.[1] === 'payments') return { entityType: 'PAYMENT', entityId: id };
    if (match?.[1] === 'meter-readings') return { entityType: 'METER_READING', entityId: id };
    if (match?.[1] === 'meters') return { entityType: 'METER', entityId: id };
    if (match?.[1] === 'resident-update-requests' || type === 'PROFILE_UPDATE_REQUEST') {
      return { entityType: 'RESIDENT_PROFILE_UPDATE_REQUEST', entityId: id };
    }
    if (match?.[1] === 'apartments') return { entityType: 'APARTMENT', entityId: id };
    if (match?.[1] === 'residents') return { entityType: 'RESIDENT', entityId: id };
    return { entityType: type === 'SYSTEM' ? 'SYSTEM' : type, entityId: id };
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

  private positiveInt(value: unknown, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.floor(parsed);
  }

  private limit(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 20;
    return Math.min(50, Math.max(1, Math.trunc(parsed)));
  }
}
