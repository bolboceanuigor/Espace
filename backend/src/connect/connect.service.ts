import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingDraftInvoiceStatus,
  ConnectConversationStatus,
  ConnectConversationType,
  ConnectMessageStatus,
  ConnectMessageType,
  ConnectPriority,
  ConnectSenderRole,
  NotificationType,
  Prisma,
  Role,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolvePermissions } from '../team/team-permissions';
import {
  ConnectResolutionDto,
  CreateAdminConnectConversationDto,
  CreateConnectMessageDto,
  CreateResidentConnectConversationDto,
  ListConnectConversationsDto,
  ListConnectResidentsDto,
  UpdateAdminConnectConversationDto,
} from './dto/connect.dto';

type AuthUser = {
  id?: string;
  sub?: string;
  role?: string;
  organizationId?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
};

const CLOSED_STATUSES: ConnectConversationStatus[] = [ConnectConversationStatus.CLOSED, ConnectConversationStatus.ARCHIVED];
const OPEN_STATUSES: ConnectConversationStatus[] = [
  ConnectConversationStatus.OPEN,
  ConnectConversationStatus.PENDING_ADMIN,
  ConnectConversationStatus.PENDING_RESIDENT,
];
const REOPENABLE_STATUSES: ConnectConversationStatus[] = [ConnectConversationStatus.RESOLVED, ConnectConversationStatus.CLOSED];

@Injectable()
export class ConnectService {
  private static readonly MAX_MESSAGE_LENGTH = 4000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private assertOrg(user: AuthUser) {
    const userId = this.userId(user);
    if (!userId) throw new ForbiddenException('Authentication required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId };
  }

  private assertResident(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (role !== Role.RESIDENT) throw new ForbiddenException('Resident access required');
    return this.assertOrg(user);
  }

  private async assertAdmin(user: AuthUser) {
    const { organizationId, userId } = this.assertOrg(user);
    const role = String(user.role || '').toUpperCase();
    if (role === Role.ADMIN) return { organizationId, userId };

    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId, status: 'ACTIVE' },
      select: { role: true, permissionsJson: true },
    });
    if (!member) throw new ForbiddenException('Admin/team membership required');
    const permissions = resolvePermissions(member.role, member.permissionsJson);
    if (!permissions['chat.manage'] && !permissions['issues.manage'] && !permissions['maintenance.manage']) {
      throw new ForbiddenException('Missing connect permission');
    }
    return { organizationId, userId };
  }

  private clean(value?: string | null) {
    const next = String(value || '').trim();
    return next || null;
  }

  private requireContent(dto: CreateConnectMessageDto | CreateAdminConnectConversationDto | CreateResidentConnectConversationDto) {
    const body = this.clean(dto.body);
    const attachmentUrl = 'attachmentUrl' in dto ? this.clean(dto.attachmentUrl) : null;
    if (!body && !attachmentUrl) throw new BadRequestException('Message cannot be empty');
    if (body && body.length > ConnectService.MAX_MESSAGE_LENGTH) {
      throw new BadRequestException('Message exceeds allowed length');
    }
    return body;
  }

  private bool(value?: string | boolean | null) {
    return value === true || value === 'true';
  }

  private page(query: ListConnectConversationsDto) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    return { page, limit, skip: (page - 1) * limit };
  }

  private displayUser(user?: { firstName?: string | null; lastName?: string | null; fullName?: string | null; email?: string | null } | null) {
    return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.email || 'Utilizator';
  }

  private initials(label?: string | null) {
    const parts = String(label || '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || 'E') + (parts[1]?.[0] || parts[0]?.[1] || 'S')).toUpperCase();
  }

  private conversationInclude() {
    return {
      apartment: {
        select: {
          id: true,
          number: true,
          floor: true,
          building: { select: { id: true, name: true } },
          staircase: { select: { id: true, name: true } },
        },
      },
      residentUser: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true, phone: true } },
      adminUser: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true } },
      lastMessageBy: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true } },
      _count: { select: { messages: true } },
    } satisfies Prisma.ConnectConversationInclude;
  }

  private messageInclude() {
    return {
      sender: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true, role: true } },
    } satisfies Prisma.ConnectMessageInclude;
  }

  private mapConversation(row: any, audience: 'admin' | 'resident') {
    const residentName = this.displayUser(row.residentUser);
    return {
      id: row.id,
      subject: row.subject,
      type: row.type,
      status: row.status,
      priority: row.priority,
      apartment: row.apartment
        ? {
            id: row.apartment.id,
            number: row.apartment.number,
            building: row.apartment.building,
            staircase: row.apartment.staircase,
          }
        : null,
      resident: row.residentUser
        ? {
            id: row.residentUser.id,
            name: residentName,
            initials: this.initials(residentName),
            email: row.residentUser.email,
            phone: row.residentUser.phone,
          }
        : null,
      admin: row.adminUser
        ? {
            id: row.adminUser.id,
            name: this.displayUser(row.adminUser),
            email: row.adminUser.email,
          }
        : null,
      lastMessageAt: row.lastMessageAt,
      lastMessagePreview: row.lastMessagePreview,
      lastMessageBy: row.lastMessageBy ? { id: row.lastMessageBy.id, name: this.displayUser(row.lastMessageBy) } : null,
      unreadCount: audience === 'admin' ? row.adminUnreadCount : row.residentUnreadCount,
      adminUnreadCount: row.adminUnreadCount,
      residentUnreadCount: row.residentUnreadCount,
      related: this.relatedKeys(row),
      internalNote: audience === 'admin' ? row.internalNote : undefined,
      messageCount: row._count?.messages || 0,
      closedAt: row.closedAt,
      resolvedAt: row.resolvedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapMessage(row: any) {
    const senderName = row.senderRole === ConnectSenderRole.SYSTEM ? 'Espace Connect' : this.displayUser(row.sender);
    return {
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      senderRole: row.senderRole,
      senderName,
      senderInitials: this.initials(senderName),
      messageType: row.messageType,
      body: row.body,
      attachmentUrl: row.attachmentUrl,
      attachmentFileName: row.attachmentFileName,
      attachmentMimeType: row.attachmentMimeType,
      attachmentFileSize: row.attachmentFileSize,
      status: row.status,
      deliveredAt: row.deliveredAt,
      readAt: row.readAt,
      metadata: row.metadataJson,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private relatedKeys(row: any) {
    return {
      invoiceId: row.relatedInvoiceId,
      paymentProofId: row.relatedPaymentProofId,
      meterReadingId: row.relatedMeterReadingId,
      serviceTicketId: row.relatedServiceTicketId,
      documentId: row.relatedDocumentId,
      announcementId: row.relatedAnnouncementId,
    };
  }

  private async residentApartmentIds(organizationId: string, userId: string) {
    const rows = await this.prisma.residentProfile.findMany({
      where: { organizationId, userId, archivedAt: null, apartmentId: { not: null } },
      select: { apartmentId: true },
    });
    return rows.map((row) => row.apartmentId).filter(Boolean) as string[];
  }

  private async assertResidentApartment(organizationId: string, userId: string, apartmentId: string) {
    const profile = await this.prisma.residentProfile.findFirst({
      where: { organizationId, userId, apartmentId, archivedAt: null },
      include: { apartment: { include: { building: true, staircase: true } } },
    });
    if (!profile?.apartment) throw new ForbiddenException('Apartment is outside your scope');
    return profile.apartment;
  }

  private async resolveAdminRecipient(organizationId: string, residentUserId: string, apartmentId?: string | null) {
    const profile = await this.prisma.residentProfile.findFirst({
      where: {
        organizationId,
        userId: residentUserId,
        archivedAt: null,
        ...(apartmentId ? { apartmentId } : {}),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true, phone: true } },
        apartment: { include: { building: true, staircase: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    if (!profile?.user || !profile.apartmentId) throw new BadRequestException('Resident not found in organization');
    return {
      residentUser: profile.user,
      apartmentId: apartmentId || profile.apartmentId,
      apartment: profile.apartment,
    };
  }

  private async assertAdminUser(organizationId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (user?.role === Role.ADMIN) return user;
    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId, status: 'ACTIVE' },
      select: { userId: true },
    });
    if (!member) throw new BadRequestException('Admin user not found in organization');
    return { id: userId };
  }

  private async validateRelated(input: {
    organizationId: string;
    apartmentId?: string | null;
    residentUserId?: string | null;
    relatedInvoiceId?: string | null;
    relatedPaymentProofId?: string | null;
    relatedMeterReadingId?: string | null;
    relatedServiceTicketId?: string | null;
    relatedDocumentId?: string | null;
    relatedAnnouncementId?: string | null;
    residentScoped?: boolean;
  }) {
    const apartmentFilter = input.apartmentId ? { apartmentId: input.apartmentId } : {};
    if (input.relatedInvoiceId) {
      const invoice = await this.prisma.billingDraftInvoice.findFirst({
        where: {
          id: input.relatedInvoiceId,
          organizationId: input.organizationId,
          ...apartmentFilter,
          ...(input.residentScoped
            ? { status: { in: [BillingDraftInvoiceStatus.PUBLISHED, BillingDraftInvoiceStatus.PAID, BillingDraftInvoiceStatus.PARTIALLY_PAID] } }
            : {}),
        },
        select: { id: true },
      });
      if (!invoice) throw new BadRequestException('Related invoice is outside scope');
    }
    if (input.relatedPaymentProofId) {
      const proof = await this.prisma.paymentProof.findFirst({
        where: {
          id: input.relatedPaymentProofId,
          organizationId: input.organizationId,
          ...apartmentFilter,
          ...(input.residentScoped && input.residentUserId ? { residentUserId: input.residentUserId } : {}),
        },
        select: { id: true },
      });
      if (!proof) throw new BadRequestException('Related payment proof is outside scope');
    }
    if (input.relatedMeterReadingId) {
      const reading = await this.prisma.meterReading.findFirst({
        where: { id: input.relatedMeterReadingId, organizationId: input.organizationId, ...apartmentFilter },
        select: { id: true },
      });
      if (!reading) throw new BadRequestException('Related meter reading is outside scope');
    }
    if (input.relatedServiceTicketId) {
      const ticket = await this.prisma.issue.findFirst({
        where: {
          id: input.relatedServiceTicketId,
          organizationId: input.organizationId,
          ...(input.apartmentId ? { apartmentId: input.apartmentId } : {}),
          ...(input.residentScoped ? { createdByUserId: input.residentUserId || '__none__' } : {}),
        },
        select: { id: true },
      });
      if (!ticket) throw new BadRequestException('Related request is outside scope');
    }
    if (input.relatedDocumentId) {
      const document = await this.prisma.document.findFirst({
        where: { id: input.relatedDocumentId, organizationId: input.organizationId },
        select: { id: true },
      });
      if (!document) throw new BadRequestException('Related document is outside scope');
    }
    if (input.relatedAnnouncementId) {
      const announcement = await this.prisma.announcement.findFirst({
        where: { id: input.relatedAnnouncementId, organizationId: input.organizationId },
        select: { id: true },
      });
      if (!announcement) throw new BadRequestException('Related announcement is outside scope');
    }
  }

  private relatedData(dto: {
    relatedInvoiceId?: string | null;
    relatedPaymentProofId?: string | null;
    relatedMeterReadingId?: string | null;
    relatedServiceTicketId?: string | null;
    relatedDocumentId?: string | null;
    relatedAnnouncementId?: string | null;
  }) {
    return {
      relatedInvoiceId: this.clean(dto.relatedInvoiceId),
      relatedPaymentProofId: this.clean(dto.relatedPaymentProofId),
      relatedMeterReadingId: this.clean(dto.relatedMeterReadingId),
      relatedServiceTicketId: this.clean(dto.relatedServiceTicketId),
      relatedDocumentId: this.clean(dto.relatedDocumentId),
      relatedAnnouncementId: this.clean(dto.relatedAnnouncementId),
    };
  }

  private inferType(type?: string | null, related?: ReturnType<ConnectService['relatedData']>) {
    if (type) return type as ConnectConversationType;
    if (related?.relatedInvoiceId) return ConnectConversationType.INVOICE;
    if (related?.relatedPaymentProofId) return ConnectConversationType.PAYMENT_PROOF;
    if (related?.relatedMeterReadingId) return ConnectConversationType.METER_READING;
    if (related?.relatedServiceTicketId) return ConnectConversationType.SERVICE_TICKET;
    if (related?.relatedDocumentId) return ConnectConversationType.DOCUMENT;
    if (related?.relatedAnnouncementId) return ConnectConversationType.ANNOUNCEMENT;
    return ConnectConversationType.GENERAL;
  }

  private async audit(organizationId: string, userId: string, action: string, conversationId: string, description: string, metadata?: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action,
          entityType: 'ConnectConversation',
          entityId: conversationId,
          description,
          newValuesJson: (metadata || {}) as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Connect audit should not block messaging.
    }
  }

  async addSystemMessage(conversationId: string, body: string, metadata?: Record<string, unknown>) {
    const conversation = await this.prisma.connectConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, organizationId: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return this.prisma.connectMessage.create({
      data: {
        conversationId,
        organizationId: conversation.organizationId,
        senderRole: ConnectSenderRole.SYSTEM,
        messageType: ConnectMessageType.SYSTEM,
        body,
        status: ConnectMessageStatus.DELIVERED,
        deliveredAt: new Date(),
        metadataJson: (metadata || {}) as Prisma.InputJsonValue,
      },
    });
  }

  private async notifyAdmins(organizationId: string, conversationId: string, message: string) {
    const admins = await this.prisma.user.findMany({
      where: { organizationId, role: Role.ADMIN, isActive: true, deletedAt: null },
      select: { id: true },
    });
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: { userId: true, role: true, permissionsJson: true },
    });
    const memberIds = members
      .filter((member) => {
        const permissions = resolvePermissions(member.role, member.permissionsJson);
        return permissions['chat.manage'] || permissions['issues.manage'] || permissions['maintenance.manage'];
      })
      .map((member) => member.userId);
    const userIds = Array.from(new Set([...admins.map((admin) => admin.id), ...memberIds]));
    if (!userIds.length) return;
    await this.notificationsService.notifyUsers({
      organizationId,
      userIds,
      title: 'Mesaj nou în Espace Connect',
      message,
      type: NotificationType.SYSTEM,
      link: `/admin/connect/${conversationId}`,
      preferredChannels: ['IN_APP'],
    });
  }

  private async notifyResident(organizationId: string, residentUserId: string | null | undefined, conversationId: string, message: string) {
    if (!residentUserId) return;
    await this.notificationsService.createNotification({
      organizationId,
      userId: residentUserId,
      title: 'Răspuns nou în Espace Connect',
      message,
      type: NotificationType.SYSTEM,
      link: `/resident/connect/${conversationId}`,
      preferredChannels: ['IN_APP'],
    });
  }

  private async conversationsWhereForResident(organizationId: string, userId: string, query?: ListConnectConversationsDto) {
    const apartmentIds = await this.residentApartmentIds(organizationId, userId);
    const search = this.clean(query?.search);
    const where: Prisma.ConnectConversationWhereInput = {
      organizationId,
      OR: [{ residentUserId: userId }, { apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } }],
      ...(query?.status ? { status: query.status as ConnectConversationStatus } : {}),
      ...(query?.type ? { type: query.type as ConnectConversationType } : {}),
      ...(query?.apartmentId ? { apartmentId: query.apartmentId } : {}),
      ...(this.bool(query?.onlyUnread) ? { residentUnreadCount: { gt: 0 } } : {}),
    };
    if (search) {
      where.AND = [
        {
          OR: [
            { subject: { contains: search, mode: 'insensitive' } },
            { lastMessagePreview: { contains: search, mode: 'insensitive' } },
            { apartment: { number: { contains: search, mode: 'insensitive' } } },
          ],
        },
      ];
    }
    return where;
  }

  async adminOverview(user: AuthUser) {
    const { organizationId } = await this.assertAdmin(user);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const [
      totalConversations,
      openConversations,
      pendingAdminConversations,
      pendingResidentConversations,
      urgentConversations,
      unreadAggregate,
      closedThisMonth,
      latestRows,
    ] = await Promise.all([
      this.prisma.connectConversation.count({ where: { organizationId } }),
      this.prisma.connectConversation.count({ where: { organizationId, status: { in: OPEN_STATUSES } } }),
      this.prisma.connectConversation.count({ where: { organizationId, status: ConnectConversationStatus.PENDING_ADMIN } }),
      this.prisma.connectConversation.count({ where: { organizationId, status: ConnectConversationStatus.PENDING_RESIDENT } }),
      this.prisma.connectConversation.count({ where: { organizationId, priority: ConnectPriority.URGENT, status: { in: OPEN_STATUSES } } }),
      this.prisma.connectConversation.aggregate({ where: { organizationId }, _sum: { adminUnreadCount: true } }),
      this.prisma.connectConversation.count({
        where: { organizationId, status: ConnectConversationStatus.CLOSED, closedAt: { gte: startOfMonth } },
      }),
      this.prisma.connectConversation.findMany({
        where: { organizationId },
        include: this.conversationInclude(),
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        take: 6,
      }),
    ]);
    return {
      totalConversations,
      openConversations,
      pendingAdminConversations,
      pendingResidentConversations,
      urgentConversations,
      unreadCount: unreadAggregate._sum.adminUnreadCount || 0,
      closedThisMonth,
      latestConversations: latestRows.map((row) => this.mapConversation(row, 'admin')),
    };
  }

  async adminRecipients(user: AuthUser, query: ListConnectResidentsDto) {
    const { organizationId } = await this.assertAdmin(user);
    const search = this.clean(query.search);
    const rows = await this.prisma.residentProfile.findMany({
      where: {
        organizationId,
        archivedAt: null,
        userId: { not: null },
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { apartment: { number: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true, phone: true } },
        apartment: { include: { building: true, staircase: true } },
      },
      orderBy: [{ apartment: { number: 'asc' } }, { lastName: 'asc' }, { firstName: 'asc' }],
      take: 60,
    });
    return rows
      .filter((row) => row.user && row.apartment)
      .map((row) => ({
        residentUserId: row.userId,
        name: this.displayUser(row.user),
        email: row.user?.email || row.email,
        phone: row.user?.phone || row.phone,
        apartment: row.apartment
          ? {
              id: row.apartment.id,
              number: row.apartment.number,
              building: row.apartment.building ? { id: row.apartment.building.id, name: row.apartment.building.name } : null,
              staircase: row.apartment.staircase ? { id: row.apartment.staircase.id, name: row.apartment.staircase.name } : null,
            }
          : null,
      }));
  }

  async adminList(user: AuthUser, query: ListConnectConversationsDto) {
    const { organizationId } = await this.assertAdmin(user);
    const { page, limit, skip } = this.page(query);
    const search = this.clean(query.search);
    const where: Prisma.ConnectConversationWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status as ConnectConversationStatus } : {}),
      ...(query.type ? { type: query.type as ConnectConversationType } : {}),
      ...(query.priority ? { priority: query.priority as ConnectPriority } : {}),
      ...(query.apartmentId ? { apartmentId: query.apartmentId } : {}),
      ...(query.residentUserId ? { residentUserId: query.residentUserId } : {}),
      ...(this.bool(query.onlyUnread) ? { adminUnreadCount: { gt: 0 } } : {}),
    };
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { lastMessagePreview: { contains: search, mode: 'insensitive' } },
        { residentUser: { email: { contains: search, mode: 'insensitive' } } },
        { residentUser: { fullName: { contains: search, mode: 'insensitive' } } },
        { apartment: { number: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [total, rows] = await Promise.all([
      this.prisma.connectConversation.count({ where }),
      this.prisma.connectConversation.findMany({
        where,
        include: this.conversationInclude(),
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return { items: rows.map((row) => this.mapConversation(row, 'admin')), page, limit, total };
  }

  async adminCreate(user: AuthUser, dto: CreateAdminConnectConversationDto) {
    const { organizationId, userId } = await this.assertAdmin(user);
    const related = this.relatedData(dto);
    const recipient = await this.resolveAdminRecipient(organizationId, dto.residentUserId, this.clean(dto.apartmentId));
    const body = this.requireContent(dto);
    await this.validateRelated({
      organizationId,
      apartmentId: recipient.apartmentId,
      residentUserId: dto.residentUserId,
      ...related,
    });
    const now = new Date();
    const subject = this.clean(dto.subject) || 'Conversație cu administrația';
    const conversation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.connectConversation.create({
        data: {
          organizationId,
          apartmentId: recipient.apartmentId,
          residentUserId: dto.residentUserId,
          adminUserId: userId,
          createdById: userId,
          subject,
          type: this.inferType(dto.type, related),
          priority: (dto.priority as ConnectPriority) || ConnectPriority.NORMAL,
          status: ConnectConversationStatus.PENDING_RESIDENT,
          lastMessageAt: now,
          lastMessagePreview: body,
          lastMessageById: userId,
          residentUnreadCount: 1,
          ...related,
        },
      });
      await tx.connectMessage.create({
        data: {
          conversationId: created.id,
          organizationId,
          senderRole: ConnectSenderRole.SYSTEM,
          messageType: ConnectMessageType.SYSTEM,
          body: 'Conversația a fost creată.',
          status: ConnectMessageStatus.DELIVERED,
          deliveredAt: now,
          metadataJson: { action: 'CONNECT_CONVERSATION_CREATED' },
        },
      });
      await tx.connectMessage.create({
        data: {
          conversationId: created.id,
          organizationId,
          senderId: userId,
          senderRole: ConnectSenderRole.ADMIN,
          messageType: ConnectMessageType.TEXT,
          body,
          status: ConnectMessageStatus.DELIVERED,
          deliveredAt: now,
        },
      });
      return created;
    });
    await this.notifyResident(organizationId, dto.residentUserId, conversation.id, body || subject);
    await this.audit(organizationId, userId, 'CONNECT_CONVERSATION_CREATED', conversation.id, 'Admin created Connect conversation', {
      type: conversation.type,
      residentUserId: dto.residentUserId,
    });
    return this.adminDetail(user, conversation.id);
  }

  async adminDetail(user: AuthUser, conversationId: string) {
    const { organizationId } = await this.assertAdmin(user);
    const conversation = await this.prisma.connectConversation.findFirst({
      where: { id: conversationId, organizationId },
      include: this.conversationInclude(),
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const [messages, context, relatedSummary] = await Promise.all([
      this.prisma.connectMessage.findMany({
        where: { organizationId, conversationId },
        include: this.messageInclude(),
        orderBy: { createdAt: 'asc' },
      }),
      this.adminContext(conversation),
      this.relatedSummary(conversation),
    ]);
    return {
      conversation: this.mapConversation(conversation, 'admin'),
      messages: messages.map((message) => this.mapMessage(message)),
      context,
      relatedSummary,
    };
  }

  async adminSendMessage(user: AuthUser, conversationId: string, dto: CreateConnectMessageDto) {
    const { organizationId, userId } = await this.assertAdmin(user);
    const conversation = await this.prisma.connectConversation.findFirst({ where: { id: conversationId, organizationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (CLOSED_STATUSES.includes(conversation.status)) throw new BadRequestException('Conversation is closed');
    const body = this.requireContent(dto);
    const now = new Date();
    const message = await this.prisma.connectMessage.create({
      data: {
        conversationId,
        organizationId,
        senderId: userId,
        senderRole: ConnectSenderRole.ADMIN,
        messageType: (dto.messageType as ConnectMessageType) || (dto.attachmentUrl ? ConnectMessageType.ATTACHMENT : ConnectMessageType.TEXT),
        body,
        attachmentUrl: this.clean(dto.attachmentUrl),
        attachmentFileName: this.clean(dto.attachmentFileName),
        attachmentMimeType: this.clean(dto.attachmentMimeType),
        attachmentFileSize: dto.attachmentFileSize || null,
        status: ConnectMessageStatus.DELIVERED,
        deliveredAt: now,
      },
      include: this.messageInclude(),
    });
    await this.prisma.connectConversation.update({
      where: { id: conversationId },
      data: {
        status: ConnectConversationStatus.PENDING_RESIDENT,
        lastMessageAt: now,
        lastMessagePreview: body || dto.attachmentFileName || 'Atașament',
        lastMessageById: userId,
        adminUnreadCount: 0,
        residentUnreadCount: { increment: 1 },
        resolvedAt: null,
        closedAt: null,
      },
    });
    await this.notifyResident(organizationId, conversation.residentUserId, conversationId, body || dto.attachmentFileName || 'Atașament nou');
    await this.audit(organizationId, userId, 'CONNECT_MESSAGE_SENT', conversationId, 'Admin sent Connect message');
    return this.mapMessage(message);
  }

  async adminRead(user: AuthUser, conversationId: string) {
    const { organizationId, userId } = await this.assertAdmin(user);
    const conversation = await this.prisma.connectConversation.findFirst({ where: { id: conversationId, organizationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.connectMessage.updateMany({
        where: { organizationId, conversationId, senderRole: ConnectSenderRole.RESIDENT, status: { not: ConnectMessageStatus.READ } },
        data: { status: ConnectMessageStatus.READ, readAt: now },
      }),
      this.prisma.connectConversation.update({ where: { id: conversationId }, data: { adminUnreadCount: 0 } }),
    ]);
    await this.audit(organizationId, userId, 'CONNECT_CONVERSATION_READ', conversationId, 'Admin read Connect conversation');
    return { ok: true };
  }

  async adminUpdate(user: AuthUser, conversationId: string, dto: UpdateAdminConnectConversationDto) {
    const { organizationId, userId } = await this.assertAdmin(user);
    const conversation = await this.prisma.connectConversation.findFirst({ where: { id: conversationId, organizationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (dto.adminUserId) await this.assertAdminUser(organizationId, dto.adminUserId);
    const status = dto.status as ConnectConversationStatus | undefined;
    const now = new Date();
    const updated = await this.prisma.connectConversation.update({
      where: { id: conversationId },
      data: {
        ...(dto.priority ? { priority: dto.priority as ConnectPriority } : {}),
        ...(dto.subject !== undefined ? { subject: this.clean(dto.subject) } : {}),
        ...(dto.internalNote !== undefined ? { internalNote: this.clean(dto.internalNote) } : {}),
        ...(dto.adminUserId !== undefined ? { adminUserId: this.clean(dto.adminUserId) } : {}),
        ...(status ? { status } : {}),
        ...(status === ConnectConversationStatus.RESOLVED ? { resolvedAt: now } : {}),
        ...(status === ConnectConversationStatus.CLOSED ? { closedAt: now } : {}),
        ...(status === ConnectConversationStatus.OPEN || status === ConnectConversationStatus.PENDING_ADMIN || status === ConnectConversationStatus.PENDING_RESIDENT
          ? { closedAt: null, resolvedAt: null }
          : {}),
      },
      include: this.conversationInclude(),
    });
    await this.audit(organizationId, userId, 'CONNECT_CONVERSATION_UPDATED', conversationId, 'Admin updated Connect conversation', dto);
    return this.mapConversation(updated, 'admin');
  }

  async adminResolve(user: AuthUser, conversationId: string, dto: ConnectResolutionDto) {
    const { organizationId, userId } = await this.assertAdmin(user);
    const conversation = await this.prisma.connectConversation.findFirst({ where: { id: conversationId, organizationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const now = new Date();
    await this.prisma.connectConversation.update({
      where: { id: conversationId },
      data: { status: ConnectConversationStatus.RESOLVED, resolvedAt: now, closedAt: this.bool(dto.close) ? now : null },
    });
    await this.addSystemMessage(conversationId, this.clean(dto.message) || 'Conversația a fost marcată ca rezolvată.', {
      action: 'CONNECT_CONVERSATION_RESOLVED',
    });
    await this.audit(organizationId, userId, 'CONNECT_CONVERSATION_RESOLVED', conversationId, 'Admin resolved Connect conversation');
    return this.adminDetail(user, conversationId);
  }

  async adminClose(user: AuthUser, conversationId: string, dto: ConnectResolutionDto) {
    const { organizationId, userId } = await this.assertAdmin(user);
    const conversation = await this.prisma.connectConversation.findFirst({ where: { id: conversationId, organizationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.prisma.connectConversation.update({
      where: { id: conversationId },
      data: { status: ConnectConversationStatus.CLOSED, closedAt: new Date() },
    });
    await this.addSystemMessage(conversationId, this.clean(dto.message) || 'Conversația a fost închisă.', {
      action: 'CONNECT_CONVERSATION_CLOSED',
    });
    await this.audit(organizationId, userId, 'CONNECT_CONVERSATION_CLOSED', conversationId, 'Admin closed Connect conversation');
    return this.adminDetail(user, conversationId);
  }

  async adminReopen(user: AuthUser, conversationId: string) {
    const { organizationId, userId } = await this.assertAdmin(user);
    const conversation = await this.prisma.connectConversation.findFirst({ where: { id: conversationId, organizationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.prisma.connectConversation.update({
      where: { id: conversationId },
      data: { status: ConnectConversationStatus.OPEN, closedAt: null, resolvedAt: null },
    });
    await this.addSystemMessage(conversationId, 'Conversația a fost redeschisă.', {
      action: 'CONNECT_CONVERSATION_REOPENED',
    });
    await this.audit(organizationId, userId, 'CONNECT_CONVERSATION_REOPENED', conversationId, 'Admin reopened Connect conversation');
    return this.adminDetail(user, conversationId);
  }

  async residentOverview(user: AuthUser) {
    const { organizationId, userId } = this.assertResident(user);
    const where = await this.conversationsWhereForResident(organizationId, userId);
    const [totalConversations, openConversations, unreadAggregate, latest, pendingAdminCount, resolvedCount, apartments] = await Promise.all([
      this.prisma.connectConversation.count({ where }),
      this.prisma.connectConversation.count({ where: { ...where, status: { in: OPEN_STATUSES } } }),
      this.prisma.connectConversation.aggregate({ where, _sum: { residentUnreadCount: true } }),
      this.prisma.connectConversation.findFirst({
        where,
        include: this.conversationInclude(),
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.connectConversation.count({ where: { ...where, status: ConnectConversationStatus.PENDING_ADMIN } }),
      this.prisma.connectConversation.count({ where: { ...where, status: ConnectConversationStatus.RESOLVED } }),
      this.residentContext(user),
    ]);
    return {
      totalConversations,
      openConversations,
      unreadCount: unreadAggregate._sum.residentUnreadCount || 0,
      latestConversation: latest ? this.mapConversation(latest, 'resident') : null,
      pendingAdminCount,
      resolvedCount,
      apartments: apartments.apartments,
    };
  }

  async residentContext(user: AuthUser) {
    const { organizationId, userId } = this.assertResident(user);
    const profiles = await this.prisma.residentProfile.findMany({
      where: { organizationId, userId, archivedAt: null, apartmentId: { not: null } },
      include: { apartment: { include: { building: true, staircase: true } } },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    return {
      apartments: profiles
        .filter((profile) => profile.apartment)
        .map((profile) => ({
          id: profile.apartment!.id,
          number: profile.apartment!.number,
          building: profile.apartment!.building ? { id: profile.apartment!.building.id, name: profile.apartment!.building.name } : null,
          staircase: profile.apartment!.staircase ? { id: profile.apartment!.staircase.id, name: profile.apartment!.staircase.name } : null,
        })),
    };
  }

  async residentList(user: AuthUser, query: ListConnectConversationsDto) {
    const { organizationId, userId } = this.assertResident(user);
    const { page, limit, skip } = this.page(query);
    const where = await this.conversationsWhereForResident(organizationId, userId, query);
    const [total, rows] = await Promise.all([
      this.prisma.connectConversation.count({ where }),
      this.prisma.connectConversation.findMany({
        where,
        include: this.conversationInclude(),
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return { items: rows.map((row) => this.mapConversation(row, 'resident')), page, limit, total };
  }

  async residentCreate(user: AuthUser, dto: CreateResidentConnectConversationDto) {
    const { organizationId, userId } = this.assertResident(user);
    const apartment = await this.assertResidentApartment(organizationId, userId, dto.apartmentId);
    const related = this.relatedData(dto);
    const body = this.requireContent(dto);
    await this.validateRelated({
      organizationId,
      apartmentId: apartment.id,
      residentUserId: userId,
      residentScoped: true,
      ...related,
    });
    const now = new Date();
    const subject = this.clean(dto.subject) || 'Mesaj către administrație';
    const conversation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.connectConversation.create({
        data: {
          organizationId,
          apartmentId: apartment.id,
          residentUserId: userId,
          createdById: userId,
          subject,
          type: this.inferType(dto.type, related),
          priority: ConnectPriority.NORMAL,
          status: ConnectConversationStatus.PENDING_ADMIN,
          lastMessageAt: now,
          lastMessagePreview: body,
          lastMessageById: userId,
          adminUnreadCount: 1,
          ...related,
        },
      });
      await tx.connectMessage.create({
        data: {
          conversationId: created.id,
          organizationId,
          senderRole: ConnectSenderRole.SYSTEM,
          messageType: ConnectMessageType.SYSTEM,
          body: 'Conversația a fost creată.',
          status: ConnectMessageStatus.DELIVERED,
          deliveredAt: now,
          metadataJson: { action: 'CONNECT_CONVERSATION_CREATED' },
        },
      });
      await tx.connectMessage.create({
        data: {
          conversationId: created.id,
          organizationId,
          senderId: userId,
          senderRole: ConnectSenderRole.RESIDENT,
          messageType: ConnectMessageType.TEXT,
          body,
          status: ConnectMessageStatus.DELIVERED,
          deliveredAt: now,
        },
      });
      return created;
    });
    await this.notifyAdmins(organizationId, conversation.id, body || subject);
    await this.audit(organizationId, userId, 'CONNECT_CONVERSATION_CREATED', conversation.id, 'Resident created Connect conversation', {
      apartmentId: apartment.id,
      type: conversation.type,
    });
    return this.residentDetail(user, conversation.id);
  }

  async residentDetail(user: AuthUser, conversationId: string) {
    const { organizationId, userId } = this.assertResident(user);
    const where = await this.conversationsWhereForResident(organizationId, userId);
    const conversation = await this.prisma.connectConversation.findFirst({
      where: { ...where, id: conversationId },
      include: this.conversationInclude(),
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const [messages, relatedSummary] = await Promise.all([
      this.prisma.connectMessage.findMany({
        where: { organizationId, conversationId },
        include: this.messageInclude(),
        orderBy: { createdAt: 'asc' },
      }),
      this.relatedSummary(conversation),
    ]);
    return {
      conversation: this.mapConversation(conversation, 'resident'),
      messages: messages.map((message) => this.mapMessage(message)),
      context: {
        apartment: conversation.apartment,
        subject: conversation.subject,
        status: conversation.status,
        type: conversation.type,
      },
      relatedSummary,
    };
  }

  async residentSendMessage(user: AuthUser, conversationId: string, dto: CreateConnectMessageDto) {
    const { organizationId, userId } = this.assertResident(user);
    const where = await this.conversationsWhereForResident(organizationId, userId);
    const conversation = await this.prisma.connectConversation.findFirst({ where: { ...where, id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (CLOSED_STATUSES.includes(conversation.status)) throw new BadRequestException('Conversation is closed');
    const body = this.requireContent(dto);
    const now = new Date();
    const message = await this.prisma.connectMessage.create({
      data: {
        conversationId,
        organizationId,
        senderId: userId,
        senderRole: ConnectSenderRole.RESIDENT,
        messageType: (dto.messageType as ConnectMessageType) || (dto.attachmentUrl ? ConnectMessageType.ATTACHMENT : ConnectMessageType.TEXT),
        body,
        attachmentUrl: this.clean(dto.attachmentUrl),
        attachmentFileName: this.clean(dto.attachmentFileName),
        attachmentMimeType: this.clean(dto.attachmentMimeType),
        attachmentFileSize: dto.attachmentFileSize || null,
        status: ConnectMessageStatus.DELIVERED,
        deliveredAt: now,
      },
      include: this.messageInclude(),
    });
    await this.prisma.connectConversation.update({
      where: { id: conversationId },
      data: {
        status: ConnectConversationStatus.PENDING_ADMIN,
        lastMessageAt: now,
        lastMessagePreview: body || dto.attachmentFileName || 'Atașament',
        lastMessageById: userId,
        residentUnreadCount: 0,
        adminUnreadCount: { increment: 1 },
        resolvedAt: null,
      },
    });
    await this.notifyAdmins(organizationId, conversationId, body || dto.attachmentFileName || 'Atașament nou');
    await this.audit(organizationId, userId, 'CONNECT_MESSAGE_SENT', conversationId, 'Resident sent Connect message');
    return this.mapMessage(message);
  }

  async residentRead(user: AuthUser, conversationId: string) {
    const { organizationId, userId } = this.assertResident(user);
    const where = await this.conversationsWhereForResident(organizationId, userId);
    const conversation = await this.prisma.connectConversation.findFirst({ where: { ...where, id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.connectMessage.updateMany({
        where: {
          organizationId,
          conversationId,
          senderRole: { in: [ConnectSenderRole.ADMIN, ConnectSenderRole.SUPERADMIN] },
          status: { not: ConnectMessageStatus.READ },
        },
        data: { status: ConnectMessageStatus.READ, readAt: now },
      }),
      this.prisma.connectConversation.update({ where: { id: conversationId }, data: { residentUnreadCount: 0 } }),
    ]);
    await this.audit(organizationId, userId, 'CONNECT_CONVERSATION_READ', conversationId, 'Resident read Connect conversation');
    return { ok: true };
  }

  async residentReopen(user: AuthUser, conversationId: string, dto: ConnectResolutionDto) {
    const { organizationId, userId } = this.assertResident(user);
    const where = await this.conversationsWhereForResident(organizationId, userId);
    const conversation = await this.prisma.connectConversation.findFirst({ where: { ...where, id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (!REOPENABLE_STATUSES.includes(conversation.status)) {
      return this.residentDetail(user, conversationId);
    }
    const body = this.clean(dto.message);
    await this.prisma.connectConversation.update({
      where: { id: conversationId },
      data: {
        status: ConnectConversationStatus.PENDING_ADMIN,
        closedAt: null,
        resolvedAt: null,
        adminUnreadCount: { increment: 1 },
        lastMessageAt: new Date(),
        lastMessagePreview: body || 'Conversația a fost redeschisă.',
        lastMessageById: userId,
      },
    });
    if (body) {
      await this.prisma.connectMessage.create({
        data: {
          conversationId,
          organizationId,
          senderId: userId,
          senderRole: ConnectSenderRole.RESIDENT,
          messageType: ConnectMessageType.TEXT,
          body,
          status: ConnectMessageStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      });
    } else {
      await this.addSystemMessage(conversationId, 'Conversația a fost redeschisă.', {
        action: 'CONNECT_CONVERSATION_REOPENED',
      });
    }
    await this.notifyAdmins(organizationId, conversationId, body || 'Conversația a fost redeschisă.');
    await this.audit(organizationId, userId, 'CONNECT_CONVERSATION_REOPENED', conversationId, 'Resident reopened Connect conversation');
    return this.residentDetail(user, conversationId);
  }

  private async adminContext(conversation: any) {
    const apartmentId = conversation.apartmentId;
    if (!apartmentId) {
      return {
        resident: conversation.residentUser ? this.mapConversation(conversation, 'admin').resident : null,
        apartment: null,
        unpaidInvoices: [],
        openServiceTickets: [],
        latestMeterReadings: [],
        latestPaymentProofs: [],
        quickActions: [],
      };
    }
    const [unpaidInvoices, openServiceTickets, latestMeterReadings, latestPaymentProofs] = await Promise.all([
      this.prisma.billingDraftInvoice.findMany({
        where: {
          organizationId: conversation.organizationId,
          apartmentId,
          status: { in: [BillingDraftInvoiceStatus.PUBLISHED, BillingDraftInvoiceStatus.PARTIALLY_PAID] },
        },
        select: { id: true, invoiceNumber: true, status: true, total: true, dueDate: true },
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        take: 5,
      }),
      this.prisma.issue.findMany({
        where: { organizationId: conversation.organizationId, apartmentId, status: { in: ['NEW', 'IN_PROGRESS', 'WAITING'] } },
        select: { id: true, title: true, status: true, priority: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      this.prisma.meterReading.findMany({
        where: { organizationId: conversation.organizationId, apartmentId },
        select: { id: true, value: true, readingDate: true, source: true, meter: { select: { id: true, serialNumber: true, type: true } } },
        orderBy: { readingDate: 'desc' },
        take: 5,
      }),
      this.prisma.paymentProof.findMany({
        where: { organizationId: conversation.organizationId, apartmentId },
        select: { id: true, amount: true, currency: true, status: true, createdAt: true, invoiceId: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);
    return {
      resident: this.mapConversation(conversation, 'admin').resident,
      apartment: conversation.apartment,
      unpaidInvoices: unpaidInvoices.map((invoice) => ({
        ...invoice,
        total: Number(invoice.total || 0),
      })),
      openServiceTickets,
      latestMeterReadings,
      latestPaymentProofs: latestPaymentProofs.map((proof) => ({ ...proof, amount: Number(proof.amount || 0) })),
      quickActions: [
        { label: 'Deschide apartament', href: `/admin/apartments/${apartmentId}` },
        { label: 'Deschide facturi', href: `/admin/invoices?apartmentId=${apartmentId}` },
        { label: 'Deschide sold', href: `/admin/balances?apartmentId=${apartmentId}` },
        { label: 'Deschide plăți', href: `/admin/payments?apartmentId=${apartmentId}` },
      ],
    };
  }

  private async relatedSummary(conversation: any) {
    if (conversation.relatedInvoiceId) {
      const row = await this.prisma.billingDraftInvoice.findFirst({
        where: { id: conversation.relatedInvoiceId, organizationId: conversation.organizationId },
        select: { id: true, invoiceNumber: true, status: true, total: true, dueDate: true },
      });
      return row ? { type: 'INVOICE', label: row.invoiceNumber || 'Factură', status: row.status, amount: Number(row.total || 0), dueDate: row.dueDate, id: row.id } : null;
    }
    if (conversation.relatedServiceTicketId) {
      const row = await this.prisma.issue.findFirst({
        where: { id: conversation.relatedServiceTicketId, organizationId: conversation.organizationId },
        select: { id: true, title: true, status: true, priority: true },
      });
      return row ? { type: 'SERVICE_TICKET', label: row.title, status: row.status, priority: row.priority, id: row.id } : null;
    }
    if (conversation.relatedMeterReadingId) {
      const row = await this.prisma.meterReading.findFirst({
        where: { id: conversation.relatedMeterReadingId, organizationId: conversation.organizationId },
        select: { id: true, value: true, readingDate: true, source: true, meter: { select: { serialNumber: true, type: true } } },
      });
      return row ? { type: 'METER_READING', label: row.meter?.serialNumber || 'Citire contor', value: row.value, readingDate: row.readingDate, id: row.id } : null;
    }
    if (conversation.relatedPaymentProofId) {
      const row = await this.prisma.paymentProof.findFirst({
        where: { id: conversation.relatedPaymentProofId, organizationId: conversation.organizationId },
        select: { id: true, amount: true, currency: true, status: true, createdAt: true },
      });
      return row ? { type: 'PAYMENT_PROOF', label: 'Dovadă plată', amount: Number(row.amount || 0), currency: row.currency, status: row.status, id: row.id } : null;
    }
    return null;
  }
}
