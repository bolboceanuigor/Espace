import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ChatConversationStatus, ChatConversationType, ChatMessageType, ContentTargetType, NotificationType, Role } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolvePermissions } from '../team/team-permissions';
import {
  AdminConversationFiltersDto,
  AssignConversationDto,
  CreateChatMessageDto,
  CreateCommunityConversationDto,
  CreateSupportConversationDto,
  UpdateConversationStatusDto,
} from './dto/chat.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class ChatService {
  private static readonly MAX_MESSAGE_LENGTH = 2000;
  private static readonly SPAM_WINDOW_MS = 60_000;
  private static readonly MAX_MESSAGES_PER_WINDOW = 8;
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private assertOrg(user: AuthUser) {
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.userId(user) };
  }

  private assertResident(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (role !== 'RESIDENT' && role !== 'RESIDENT') throw new ForbiddenException('Resident access required');
    return this.assertOrg(user);
  }

  private async assertAdmin(user: AuthUser) {
    const { organizationId, userId } = this.assertOrg(user);
    const role = String(user.role || '').toUpperCase();
    if (role === 'ADMIN') return { organizationId, userId };
    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId, status: 'ACTIVE' },
      select: { role: true, permissionsJson: true },
    });
    if (!member) throw new ForbiddenException('Admin/team membership required');
    const permissions = resolvePermissions(member.role, member.permissionsJson);
    if (!permissions['issues.manage'] && !permissions['chat.manage'] && !permissions['maintenance.manage']) {
      throw new ForbiddenException('Missing chat permission');
    }
    return { organizationId, userId };
  }

  private async residentApartmentIds(organizationId: string, userId: string) {
    const rows = await this.prisma.residentProfile.findMany({
      where: { organizationId, userId },
      select: { apartmentId: true },
    });
    return rows.map((row) => row.apartmentId);
  }

  private async residentScope(organizationId: string, userId: string) {
    const rows = await this.prisma.residentProfile.findMany({
      where: { organizationId, userId },
      select: { apartmentId: true, apartment: { select: { buildingId: true, staircaseId: true, number: true } } },
    });
    const apartmentIds = rows.map((row) => row.apartmentId);
    const buildingIds = rows.map((row) => row.apartment.buildingId);
    const staircaseIds = rows.map((row) => row.apartment.staircaseId);
    const apartmentById = rows.reduce<Record<string, { number: string | null }>>((acc, row) => {
      acc[row.apartmentId] = { number: row.apartment.number };
      return acc;
    }, {});
    return { apartmentIds, buildingIds, staircaseIds, apartmentById };
  }

  private communityVisibilityWhere(organizationId: string, buildingIds: string[], staircaseIds: string[]) {
    return {
      organizationId,
      type: 'COMMUNITY_CHAT',
      OR: [
        { targetType: ContentTargetType.ORGANIZATION },
        { targetType: ContentTargetType.BUILDING, buildingId: { in: buildingIds.length ? buildingIds : ['__none__'] } },
        { targetType: ContentTargetType.STAIRCASE, staircaseId: { in: staircaseIds.length ? staircaseIds : ['__none__'] } },
      ],
    };
  }

  private async getPrivacySettings(organizationId: string) {
    return (
      (await this.prisma.privacySettings.findUnique({ where: { organizationId } })) || {
        showResidentNamesInCommunity: false,
        showApartmentNumbersInCommunity: false,
      }
    );
  }

  private mapCommunityMessageForResident(message: any, showNames: boolean, showApartment: boolean, apartmentById: Record<string, { number: string | null }>) {
    const role = String(message.sender?.role || '').toUpperCase();
    const isResidentLike = role === 'RESIDENT' || role === 'RESIDENT';
    const residentApartment = message.sender?.residentProfiles?.[0]?.apartmentId
      ? apartmentById[message.sender.residentProfiles[0].apartmentId]
      : null;
    const apartmentNumber = showApartment && isResidentLike ? residentApartment?.number || null : null;
    if (!showNames && isResidentLike) {
      return {
        ...message,
        sender: {
          id: message.sender?.id,
          role: message.sender?.role,
          displayName: 'Locatar',
          apartmentNumber,
        },
      };
    }
    const firstName = (message.sender?.firstName || '').trim();
    const lastName = (message.sender?.lastName || '').trim();
    const displayName = `${firstName} ${lastName}`.trim() || message.sender?.email || 'Utilizator';
    return {
      ...message,
      sender: {
        id: message.sender?.id,
        role: message.sender?.role,
        displayName,
        apartmentNumber,
      },
    };
  }

  private async assertResidentConversationAccess(organizationId: string, userId: string, conversationId: string) {
    const apartmentIds = await this.residentApartmentIds(organizationId, userId);
    const convo = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
        type: ChatConversationType.SUPPORT_CHAT,
        OR: [{ residentUserId: userId }, { apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } }],
      },
    });
    if (!convo) throw new NotFoundException('Conversation not found');
    return convo;
  }

  private async assertAdminConversationAccess(organizationId: string, conversationId: string) {
    const convo = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, organizationId, type: ChatConversationType.SUPPORT_CHAT },
    });
    if (!convo) throw new NotFoundException('Conversation not found');
    return convo;
  }

  private async notifyAdminsForConversation(organizationId: string, conversationId: string, title: string, message: string) {
    const admins = await this.prisma.user.findMany({
      where: { organizationId, role: Role.ADMIN, isActive: true, deletedAt: null },
      select: { id: true },
    });
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: { userId: true, role: true, permissionsJson: true },
    });
    const teamUserIds = members
      .filter((member) => {
        const permissions = resolvePermissions(member.role, member.permissionsJson);
        return permissions['issues.manage'] || permissions['chat.manage'] || permissions['maintenance.manage'];
      })
      .map((member) => member.userId);
    const userIds = Array.from(new Set([...admins.map((admin) => admin.id), ...teamUserIds]));
    if (!userIds.length) return;
    await this.notificationsService.notifyUsers({
      organizationId,
      userIds,
      title,
      message,
      type: NotificationType.SYSTEM,
      link: `/admin/chat?conversationId=${conversationId}`,
    });
  }

  async residentListConversations(user: AuthUser) {
    const { organizationId, userId } = this.assertResident(user);
    const apartmentIds = await this.residentApartmentIds(organizationId, userId);
    return (this.prisma as any).chatConversation.findMany({
      where: {
        organizationId,
        type: ChatConversationType.SUPPORT_CHAT,
        OR: [{ residentUserId: userId }, { apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } }],
      },
      include: {
        apartment: { select: { id: true, number: true, building: { select: { id: true, name: true } } } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async residentCreateConversation(user: AuthUser, dto: CreateSupportConversationDto) {
    const { organizationId, userId } = this.assertResident(user);
    const apartmentIds = await this.residentApartmentIds(organizationId, userId);
    if (!apartmentIds.length) throw new ForbiddenException('Resident apartment scope missing');
    const apartmentId = dto.apartmentId || apartmentIds[0];
    if (!apartmentIds.includes(apartmentId)) throw new ForbiddenException('Apartment is outside your scope');
    const existingOpen = await this.prisma.chatConversation.findFirst({
      where: {
        organizationId,
        type: ChatConversationType.SUPPORT_CHAT,
        residentUserId: userId,
        apartmentId,
        status: { in: [ChatConversationStatus.OPEN, ChatConversationStatus.PENDING] },
      },
    });
    if (existingOpen) return existingOpen;
    const created = await this.prisma.chatConversation.create({
      data: {
        organizationId,
        type: ChatConversationType.SUPPORT_CHAT,
        apartmentId,
        residentUserId: userId,
        status: ChatConversationStatus.OPEN,
      },
    });
    await this.notifyAdminsForConversation(
      organizationId,
      created.id,
      'New support chat',
      'A resident opened a new support conversation.',
    );
    return created;
  }

  async residentGetMessages(user: AuthUser, conversationId: string) {
    const { organizationId, userId } = this.assertResident(user);
    await this.assertResidentConversationAccess(organizationId, userId, conversationId);
    return this.prisma.chatMessage.findMany({
      where: { organizationId, conversationId },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        fileAsset: { select: { id: true, fileName: true, fileUrl: true, mimeType: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async residentSendMessage(user: AuthUser, conversationId: string, dto: CreateChatMessageDto) {
    const { organizationId, userId } = this.assertResident(user);
    const conversation = await this.assertResidentConversationAccess(organizationId, userId, conversationId);
    if (conversation.status === ChatConversationStatus.CLOSED) {
      throw new BadRequestException('Conversation is closed');
    }
    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Message cannot be empty');
    }
    if (content.length > ChatService.MAX_MESSAGE_LENGTH) {
      throw new BadRequestException('Message exceeds allowed length');
    }
    const residentRecentMessages = await this.prisma.chatMessage.count({
      where: {
        organizationId,
        conversationId,
        senderUserId: userId,
        createdAt: { gte: new Date(Date.now() - ChatService.SPAM_WINDOW_MS) },
      },
    });
    if (residentRecentMessages >= ChatService.MAX_MESSAGES_PER_WINDOW) {
      throw new BadRequestException('Too many messages sent in a short time');
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        organizationId,
        conversationId,
        senderUserId: userId,
        content,
        messageType: (dto.messageType as ChatMessageType) || ChatMessageType.TEXT,
        fileAssetId: dto.fileAssetId || null,
        isRead: false,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        fileAsset: { select: { id: true, fileName: true, fileUrl: true, mimeType: true } },
      },
    });
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), status: ChatConversationStatus.PENDING },
    });
    await this.notifyAdminsForConversation(
      organizationId,
      conversationId,
      'Resident message',
      content.slice(0, 180),
    );
    return message;
  }

  async residentMarkRead(user: AuthUser, conversationId: string) {
    const { organizationId, userId } = this.assertResident(user);
    await this.assertResidentConversationAccess(organizationId, userId, conversationId);
    await this.prisma.chatMessage.updateMany({
      where: { organizationId, conversationId, senderUserId: { not: userId } },
      data: { isRead: true },
    });
    return { ok: true };
  }

  async residentListCommunityConversations(user: AuthUser) {
    const { organizationId, userId } = this.assertResident(user);
    const scope = await this.residentScope(organizationId, userId);
    return (this.prisma as any).chatConversation.findMany({
      where: this.communityVisibilityWhere(organizationId, scope.buildingIds, scope.staircaseIds) as any,
      include: {
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { lastMessageAt: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async residentGetCommunityMessages(user: AuthUser, conversationId: string) {
    const { organizationId, userId } = this.assertResident(user);
    const scope = await this.residentScope(organizationId, userId);
    const conversation = await (this.prisma as any).chatConversation.findFirst({
      where: { id: conversationId, ...this.communityVisibilityWhere(organizationId, scope.buildingIds, scope.staircaseIds) } as any,
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException('Community chat not found');
    const privacy = await this.getPrivacySettings(organizationId);
    const rows = await (this.prisma as any).chatMessage.findMany({
      where: { organizationId, conversationId, status: 'VISIBLE' },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            residentProfiles: { where: { organizationId }, select: { apartmentId: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) =>
      this.mapCommunityMessageForResident(
        row,
        privacy.showResidentNamesInCommunity,
        privacy.showApartmentNumbersInCommunity,
        scope.apartmentById,
      ),
    );
  }

  async residentSendCommunityMessage(user: AuthUser, conversationId: string, dto: CreateChatMessageDto) {
    const { organizationId, userId } = this.assertResident(user);
    const scope = await this.residentScope(organizationId, userId);
    const conversation = await (this.prisma as any).chatConversation.findFirst({
      where: { id: conversationId, ...this.communityVisibilityWhere(organizationId, scope.buildingIds, scope.staircaseIds) } as any,
      select: { id: true, title: true },
    });
    if (!conversation) throw new NotFoundException('Community chat not found');
    const content = dto.content.trim();
    if (!content) throw new BadRequestException('Message cannot be empty');
    if (content.length > ChatService.MAX_MESSAGE_LENGTH) throw new BadRequestException('Message exceeds allowed length');
    const created = await (this.prisma as any).chatMessage.create({
      data: {
        organizationId,
        conversationId,
        senderUserId: userId,
        content,
        messageType: (dto.messageType as ChatMessageType) || ChatMessageType.TEXT,
        fileAssetId: dto.fileAssetId || null,
        isRead: false,
        status: 'VISIBLE',
      },
    });
    await (this.prisma as any).chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
    return created;
  }

  async adminListConversations(user: AuthUser, filters: AdminConversationFiltersDto) {
    const { organizationId, userId } = await this.assertAdmin(user);
    return (this.prisma as any).chatConversation.findMany({
      where: {
        organizationId,
        type: ChatConversationType.SUPPORT_CHAT,
        ...(filters.status ? { status: filters.status as ChatConversationStatus } : {}),
        ...(filters.assignedToMe === 'true' ? { assignedToUserId: userId } : {}),
      },
      include: {
        residentUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        apartment: {
          select: {
            id: true,
            number: true,
            building: { select: { id: true, name: true } },
            staircase: { select: { id: true, name: true } },
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async adminGetMessages(user: AuthUser, conversationId: string) {
    const { organizationId } = await this.assertAdmin(user);
    await this.assertAdminConversationAccess(organizationId, conversationId);
    return this.prisma.chatMessage.findMany({
      where: { organizationId, conversationId },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        fileAsset: { select: { id: true, fileName: true, fileUrl: true, mimeType: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async adminSendMessage(user: AuthUser, conversationId: string, dto: CreateChatMessageDto) {
    const { organizationId, userId } = await this.assertAdmin(user);
    const conversation = await this.assertAdminConversationAccess(organizationId, conversationId);
    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Message cannot be empty');
    }
    if (content.length > ChatService.MAX_MESSAGE_LENGTH) {
      throw new BadRequestException('Message exceeds allowed length');
    }
    const adminRecentMessages = await this.prisma.chatMessage.count({
      where: {
        organizationId,
        conversationId,
        senderUserId: userId,
        createdAt: { gte: new Date(Date.now() - ChatService.SPAM_WINDOW_MS) },
      },
    });
    if (adminRecentMessages >= ChatService.MAX_MESSAGES_PER_WINDOW) {
      throw new BadRequestException('Too many messages sent in a short time');
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        organizationId,
        conversationId,
        senderUserId: userId,
        content,
        messageType: (dto.messageType as ChatMessageType) || ChatMessageType.TEXT,
        fileAssetId: dto.fileAssetId || null,
        isRead: false,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        fileAsset: { select: { id: true, fileName: true, fileUrl: true, mimeType: true } },
      },
    });
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), status: ChatConversationStatus.PENDING },
    });
    if (conversation.residentUserId) {
      await this.notificationsService.createNotification({
        organizationId,
        userId: conversation.residentUserId,
        title: 'Support reply',
        message: content.slice(0, 180),
        type: NotificationType.SYSTEM,
        link: `/resident/chat?conversationId=${conversationId}`,
      });
    }
    return message;
  }

  async adminAssignConversation(user: AuthUser, conversationId: string, dto: AssignConversationDto) {
    const { organizationId } = await this.assertAdmin(user);
    await this.assertAdminConversationAccess(organizationId, conversationId);
    if (dto.assignedToUserId) {
      const target = await this.prisma.user.findFirst({
        where: { id: dto.assignedToUserId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!target) throw new BadRequestException('Assigned user not found in organization');
    }
    return this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { assignedToUserId: dto.assignedToUserId || null },
    });
  }

  async adminUpdateConversationStatus(user: AuthUser, conversationId: string, dto: UpdateConversationStatusDto) {
    const { organizationId } = await this.assertAdmin(user);
    await this.assertAdminConversationAccess(organizationId, conversationId);
    return this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { status: dto.status as ChatConversationStatus },
    });
  }

  async adminListCommunityConversations(user: AuthUser) {
    const { organizationId } = await this.assertAdmin(user);
    return (this.prisma as any).chatConversation.findMany({
      where: { organizationId, type: 'COMMUNITY_CHAT' as any },
      include: {
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { lastMessageAt: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async adminCreateCommunityConversation(user: AuthUser, dto: CreateCommunityConversationDto) {
    const { organizationId } = await this.assertAdmin(user);
    if (dto.targetType === 'BUILDING' && !dto.buildingId) throw new BadRequestException('buildingId is required');
    if (dto.targetType === 'STAIRCASE' && !dto.staircaseId) throw new BadRequestException('staircaseId is required');
    if (dto.buildingId) {
      const building = await this.prisma.building.findFirst({
        where: { id: dto.buildingId, organizationId },
        select: { id: true },
      });
      if (!building) throw new BadRequestException('Building not found in organization');
    }
    if (dto.staircaseId) {
      const staircase = await this.prisma.staircase.findFirst({
        where: { id: dto.staircaseId, organizationId },
        select: { id: true, buildingId: true },
      });
      if (!staircase) throw new BadRequestException('Staircase not found in organization');
      if (dto.buildingId && staircase.buildingId !== dto.buildingId) {
        throw new BadRequestException('Staircase does not belong to building');
      }
    }
    const created = await (this.prisma as any).chatConversation.create({
      data: {
        organizationId,
        type: 'COMMUNITY_CHAT' as any,
        targetType: dto.targetType as any,
        buildingId: dto.targetType === 'BUILDING' || dto.targetType === 'STAIRCASE' ? dto.buildingId || null : null,
        staircaseId: dto.targetType === 'STAIRCASE' ? dto.staircaseId || null : null,
        title: dto.title?.trim() || null,
        isDefault: dto.isDefault === 'true',
        status: ChatConversationStatus.OPEN,
      },
    });
    return created;
  }

  async adminGetCommunityMessages(user: AuthUser, conversationId: string) {
    const { organizationId } = await this.assertAdmin(user);
    const convo = await (this.prisma as any).chatConversation.findFirst({
      where: { id: conversationId, organizationId, type: 'COMMUNITY_CHAT' as any },
      select: { id: true },
    });
    if (!convo) throw new NotFoundException('Community chat not found');
    return (this.prisma as any).chatMessage.findMany({
      where: { organizationId, conversationId, status: { not: 'DELETED' as any } },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async adminSendCommunityMessage(user: AuthUser, conversationId: string, dto: CreateChatMessageDto) {
    const { organizationId, userId } = await this.assertAdmin(user);
    const convo = await (this.prisma as any).chatConversation.findFirst({
      where: { id: conversationId, organizationId, type: 'COMMUNITY_CHAT' as any },
      select: { id: true },
    });
    if (!convo) throw new NotFoundException('Community chat not found');
    const content = dto.content.trim();
    if (!content) throw new BadRequestException('Message cannot be empty');
    if (content.length > ChatService.MAX_MESSAGE_LENGTH) throw new BadRequestException('Message exceeds allowed length');
    const created = await (this.prisma as any).chatMessage.create({
      data: {
        organizationId,
        conversationId,
        senderUserId: userId,
        content,
        messageType: (dto.messageType as ChatMessageType) || ChatMessageType.TEXT,
        fileAssetId: dto.fileAssetId || null,
        isRead: false,
        status: 'VISIBLE',
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    });
    await (this.prisma as any).chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
    return created;
  }

  async adminHideMessage(user: AuthUser, messageId: string) {
    const { organizationId } = await this.assertAdmin(user);
    const row = await (this.prisma as any).chatMessage.findFirst({
      where: {
        id: messageId,
        organizationId,
        conversation: { organizationId, type: 'COMMUNITY_CHAT' as any },
      },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Message not found');
    return (this.prisma as any).chatMessage.update({ where: { id: messageId }, data: { status: 'HIDDEN' } });
  }

  async adminDeleteMessage(user: AuthUser, messageId: string) {
    const { organizationId } = await this.assertAdmin(user);
    const row = await (this.prisma as any).chatMessage.findFirst({
      where: {
        id: messageId,
        organizationId,
        conversation: { organizationId, type: 'COMMUNITY_CHAT' as any },
      },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Message not found');
    return (this.prisma as any).chatMessage.update({
      where: { id: messageId },
      data: { status: 'DELETED', content: '[deleted by admin]' },
    });
  }

  async adminMarkRead(user: AuthUser, conversationId: string) {
    const { organizationId, userId } = await this.assertAdmin(user);
    await this.assertAdminConversationAccess(organizationId, conversationId);
    await this.prisma.chatMessage.updateMany({
      where: { organizationId, conversationId, senderUserId: { not: userId } },
      data: { isRead: true },
    });
    return { ok: true };
  }
}
