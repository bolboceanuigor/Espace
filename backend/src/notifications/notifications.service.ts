import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { NotificationJobStatus, NotificationType, SystemErrorLevel, SystemErrorSource } from '@prisma/client';
import { randomBytes } from 'crypto';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemMonitoringService } from '../system-monitoring/system-monitoring.service';
import {
  AdminNotificationFiltersDto,
  SubscribePushDto,
  UpdateEmailIntegrationDto,
  UpdateNotificationPreferencesDto,
  UpdateSmsIntegrationDto,
  UpdateTelegramIntegrationDto,
} from './dto/notifications.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };
type ChannelType = 'IN_APP' | 'EMAIL' | 'TELEGRAM' | 'SMS';

@Injectable()
export class NotificationsService {
  private static readonly DEDUPE_WINDOW_MS = 2 * 60 * 1000;
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly systemMonitoringService: SystemMonitoringService,
  ) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private assertAdmin(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'ADMIN') throw new ForbiddenException('Admin access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.userId(user) };
  }

  private assertResident(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (!['RESIDENT', 'TENANT'].includes(role)) throw new ForbiddenException('Resident access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.userId(user) };
  }

  private assertAuthenticated(user: AuthUser) {
    const userId = this.userId(user);
    if (!userId) throw new ForbiddenException('Authentication required');
    return { userId, organizationId: user.organizationId || null };
  }

  async createNotification(params: {
    organizationId: string;
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    link?: string | null;
    preferredChannels?: ChannelType[];
  }) {
    const dedupeSince = new Date(Date.now() - NotificationsService.DEDUPE_WINDOW_MS);
    const duplicate = await this.prisma.notification.findFirst({
      where: {
        organizationId: params.organizationId,
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link || null,
        createdAt: { gte: dedupeSince },
      },
      select: { id: true },
    });
    if (duplicate) {
      return this.prisma.notification.findUnique({ where: { id: duplicate.id } });
    }

    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_organizationId: { userId: params.userId, organizationId: params.organizationId } },
    });
    const channels = await this.resolveChannels(params.organizationId, params.userId, pref || undefined, params.preferredChannels);
    const notif = await this.prisma.notification.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type,
        channels,
        link: params.link || null,
      },
    });
    await this.prisma.notificationJob.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        type: params.type,
        payloadJson: {
          notificationId: notif.id,
          channels,
          title: params.title,
          message: params.message,
          link: params.link || null,
        },
        status: NotificationJobStatus.PENDING,
        scheduledAt: new Date(),
      },
    });
    await this.sendPushNotification({
      organizationId: params.organizationId,
      userId: params.userId,
      title: params.title,
      message: params.message,
      link: params.link || null,
    });
    return notif;
  }

  async sendPushNotification(params: {
    organizationId: string;
    userId: string;
    title: string;
    message: string;
    link?: string | null;
  }) {
    try {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      const privateKey = process.env.VAPID_PRIVATE_KEY;
      if (!publicKey || !privateKey) {
        this.logger.debug('Push skipped: VAPID keys missing, in-app remains active.');
        return { skipped: true, reason: 'missing_vapid' };
      }
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId: params.userId, isActive: true, organizationId: params.organizationId },
        select: { id: true, endpoint: true },
      });
      if (!subscriptions.length) {
        return { skipped: true, reason: 'no_active_subscription' };
      }
      this.logger.log(`Push placeholder queued for user ${params.userId} on ${subscriptions.length} device(s).`);
      return { ok: true, queued: subscriptions.length };
    } catch (error) {
      this.logger.warn(`sendPushNotification failed: ${String(error)}`);
      return { skipped: true, reason: 'send_failed' };
    }
  }

  async notifyUsers(params: {
    organizationId: string;
    userIds: string[];
    title: string;
    message: string;
    type: NotificationType;
    link?: string | null;
    preferredChannels?: ChannelType[];
  }) {
    for (const userId of Array.from(new Set(params.userIds))) {
      try {
        await this.createNotification({
          organizationId: params.organizationId,
          userId,
          title: params.title,
          message: params.message,
          type: params.type,
          link: params.link,
          preferredChannels: params.preferredChannels,
        });
      } catch (e) {
        this.logger.warn(`notifyUsers failed for user ${userId}: ${String(e)}`);
      }
    }
  }

  async resolveChannels(
    organizationId: string,
    userId: string,
    pref?: {
      emailEnabled: boolean;
      telegramEnabled: boolean;
      smsEnabled: boolean;
      inAppEnabled: boolean;
    },
    preferredChannels?: ChannelType[],
  ) {
    const [emailInt, telegramInt, smsInt] = await Promise.all([
      this.prisma.emailIntegration.findUnique({ where: { organizationId }, select: { isActive: true } }),
      this.prisma.telegramIntegration.findUnique({ where: { organizationId }, select: { isActive: true } }),
      this.prisma.sMSIntegration.findUnique({ where: { organizationId }, select: { isActive: true } }),
    ]);
    const p = pref || {
      emailEnabled: true,
      telegramEnabled: false,
      smsEnabled: false,
      inAppEnabled: true,
    };
    const base = new Set<ChannelType>();
    if (p.inAppEnabled) base.add('IN_APP');
    if (p.emailEnabled && emailInt?.isActive) base.add('EMAIL');
    if (p.telegramEnabled && telegramInt?.isActive) base.add('TELEGRAM');
    if (p.smsEnabled && smsInt?.isActive) base.add('SMS');
    if (preferredChannels?.length) {
      const filtered = preferredChannels.filter((ch) => base.has(ch));
      if (filtered.length) return filtered;
    }
    const result = Array.from(base);
    return result.length ? result : ['IN_APP'];
  }

  private async sendNotificationFromJob(job: {
    id: string;
    organizationId: string;
    userId: string | null;
    payloadJson: any;
  }) {
    if (!job.userId) return;
    const channels: ChannelType[] = Array.isArray(job.payloadJson?.channels) ? job.payloadJson.channels : ['IN_APP'];
    if (!channels.includes('IN_APP')) {
      channels.push('IN_APP');
    }
    const channelProfile = await this.prisma.userChannel.findUnique({
      where: { userId: job.userId },
    });
    for (const channel of channels) {
      try {
        if (channel === 'EMAIL' && channelProfile?.email) {
          await this.emailService.sendGenericEmail({
            to: channelProfile.email,
            subject: job.payloadJson?.title || 'Notification',
            text: job.payloadJson?.message || '',
          });
        } else if (channel === 'TELEGRAM') {
          // Placeholder integration: saved as sent without external hard dependency.
          this.logger.log(`TELEGRAM notification queued for user ${job.userId}`);
        } else if (channel === 'SMS') {
          this.logger.log(`SMS notification queued for user ${job.userId}`);
        }
      } catch (e) {
        this.logger.warn(`channel send failed (${channel}): ${String(e)}`);
      }
    }
  }

  async processPendingJobs() {
    const jobs = await this.prisma.notificationJob.findMany({
      where: {
        status: NotificationJobStatus.PENDING,
        scheduledAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    for (const job of jobs) {
      try {
        await this.prisma.notificationJob.update({
          where: { id: job.id },
          data: { status: NotificationJobStatus.PROCESSING, attempts: job.attempts + 1 },
        });
        await this.sendNotificationFromJob(job as any);
        await this.prisma.notificationJob.update({
          where: { id: job.id },
          data: { status: NotificationJobStatus.SENT, processedAt: new Date(), errorMessage: null },
        });
      } catch (e) {
        const attempts = job.attempts + 1;
        const maxAttempts = 5;
        await this.prisma.notificationJob.update({
          where: { id: job.id },
          data: {
            status: attempts >= maxAttempts ? NotificationJobStatus.FAILED : NotificationJobStatus.PENDING,
            errorMessage: String(e),
            scheduledAt: new Date(Date.now() + Math.min(60000, 2000 * attempts * attempts)),
          },
        });
      }
    }
  }

  async adminList(user: AuthUser, filters: AdminNotificationFiltersDto) {
    const { organizationId } = this.assertAdmin(user);
    return this.prisma.notification.findMany({
      where: { organizationId, ...(filters.type ? { type: filters.type as any } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  }

  async adminSendTest(user: AuthUser, dto: { title: string; message: string; type?: string }) {
    const { organizationId, userId } = this.assertAdmin(user);
    return this.createNotification({
      organizationId,
      userId,
      title: dto.title,
      message: dto.message,
      type: (dto.type as NotificationType) || NotificationType.SYSTEM,
      link: '/settings',
    });
  }

  async getIntegrations(user: AuthUser) {
    const { organizationId } = this.assertAdmin(user);
    const [email, telegram, sms] = await Promise.all([
      this.prisma.emailIntegration.findUnique({ where: { organizationId } }),
      this.prisma.telegramIntegration.findUnique({ where: { organizationId } }),
      this.prisma.sMSIntegration.findUnique({ where: { organizationId } }),
    ]);
    return { email, telegram, sms };
  }

  async updateEmailIntegration(user: AuthUser, dto: UpdateEmailIntegrationDto) {
    const { organizationId } = this.assertAdmin(user);
    return this.prisma.emailIntegration.upsert({
      where: { organizationId },
      create: { organizationId, provider: dto.provider, configJson: dto.configJson || {}, isActive: dto.isActive },
      update: { provider: dto.provider, configJson: dto.configJson || {}, isActive: dto.isActive },
    });
  }

  async updateTelegramIntegration(user: AuthUser, dto: UpdateTelegramIntegrationDto) {
    const { organizationId } = this.assertAdmin(user);
    return this.prisma.telegramIntegration.upsert({
      where: { organizationId },
      create: { organizationId, botToken: dto.botToken, isActive: dto.isActive },
      update: { botToken: dto.botToken, isActive: dto.isActive },
    });
  }

  async updateSmsIntegration(user: AuthUser, dto: UpdateSmsIntegrationDto) {
    const { organizationId } = this.assertAdmin(user);
    return this.prisma.sMSIntegration.upsert({
      where: { organizationId },
      create: { organizationId, provider: dto.provider, configJson: dto.configJson || {}, isActive: dto.isActive },
      update: { provider: dto.provider, configJson: dto.configJson || {}, isActive: dto.isActive },
    });
  }

  async residentList(user: AuthUser) {
    const { organizationId, userId } = this.assertResident(user);
    return this.prisma.notification.findMany({
      where: { organizationId, userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async residentMarkRead(user: AuthUser, id: string) {
    const { organizationId, userId } = this.assertResident(user);
    return this.prisma.notification.updateMany({
      where: { id, organizationId, userId },
      data: { isRead: true },
    });
  }

  async residentMarkAllRead(user: AuthUser) {
    const { organizationId, userId } = this.assertResident(user);
    return this.prisma.notification.updateMany({
      where: { organizationId, userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getResidentPreferences(user: AuthUser) {
    const { organizationId, userId } = this.assertResident(user);
    const pref = await this.prisma.notificationPreference.upsert({
      where: { userId_organizationId: { userId, organizationId } },
      create: { userId, organizationId },
      update: {},
    });
    const channel = await this.prisma.userChannel.upsert({
      where: { userId },
      create: { userId, email: (await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email || '' },
      update: {},
    });
    return { ...pref, channel };
  }

  async updateResidentPreferences(user: AuthUser, dto: UpdateNotificationPreferencesDto) {
    const { organizationId, userId } = this.assertResident(user);
    return this.prisma.notificationPreference.upsert({
      where: { userId_organizationId: { userId, organizationId } },
      create: {
        userId,
        organizationId,
        emailEnabled: dto.emailEnabled ?? true,
        telegramEnabled: dto.telegramEnabled ?? false,
        smsEnabled: dto.smsEnabled ?? false,
        inAppEnabled: dto.inAppEnabled ?? true,
      },
      update: {
        ...(dto.emailEnabled !== undefined ? { emailEnabled: dto.emailEnabled } : {}),
        ...(dto.telegramEnabled !== undefined ? { telegramEnabled: dto.telegramEnabled } : {}),
        ...(dto.smsEnabled !== undefined ? { smsEnabled: dto.smsEnabled } : {}),
        ...(dto.inAppEnabled !== undefined ? { inAppEnabled: dto.inAppEnabled } : {}),
      },
    });
  }

  async createTelegramLinkToken(user: AuthUser) {
    const { userId } = this.assertResident(user);
    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.userChannel.upsert({
      where: { userId },
      create: {
        userId,
        email: (await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email || '',
        telegramLinkToken: token,
        telegramLinkTokenExpiresAt: expiresAt,
      },
      update: { telegramLinkToken: token, telegramLinkTokenExpiresAt: expiresAt },
    });
    return { token, expiresAt };
  }

  async handleTelegramWebhook(body: any) {
    try {
      const text = String(body?.message?.text || '');
      const chatId = String(body?.message?.chat?.id || '');
      if (!text || !chatId) return { ok: true, ignored: true };
      const parts = text.trim().split(/\s+/);
      if (parts[0] !== '/link' || !parts[1]) return { ok: true, ignored: true };
      const token = parts[1];
      const channel = await this.prisma.userChannel.findFirst({
        where: { telegramLinkToken: token, telegramLinkTokenExpiresAt: { gt: new Date() } },
        select: { id: true, userId: true },
      });
      if (!channel) return { ok: true, linked: false };
      await this.prisma.userChannel.update({
        where: { id: channel.id },
        data: {
          telegramChatId: chatId,
          telegramLinkToken: null,
          telegramLinkTokenExpiresAt: null,
        },
      });
      return { ok: true, linked: true };
    } catch (error) {
      await this.systemMonitoringService.logError({
        source: SystemErrorSource.WEBHOOK,
        level: SystemErrorLevel.ERROR,
        message: 'Telegram webhook processing failed',
        stack: error instanceof Error ? error.stack : String(error),
        metadataJson: { keys: Object.keys(body || {}) },
      });
      throw error;
    }
  }

  async subscribePush(user: AuthUser, dto: SubscribePushDto, userAgent?: string) {
    const { userId, organizationId } = this.assertAuthenticated(user);
    return this.prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint: dto.endpoint } },
      create: {
        userId,
        organizationId,
        endpoint: dto.endpoint,
        p256dh: dto.p256dh,
        auth: dto.auth,
        userAgent: userAgent || null,
        isActive: true,
      },
      update: {
        organizationId,
        p256dh: dto.p256dh,
        auth: dto.auth,
        userAgent: userAgent || null,
        isActive: true,
      },
      select: { id: true, endpoint: true, isActive: true, createdAt: true, updatedAt: true },
    });
  }

  async disablePush(user: AuthUser, id: string) {
    const { userId } = this.assertAuthenticated(user);
    const updated = await this.prisma.pushSubscription.updateMany({
      where: { id, userId },
      data: { isActive: false },
    });
    if (!updated.count) throw new ForbiddenException('Push subscription not found');
    return { ok: true };
  }

  async pushStatus(user: AuthUser) {
    const { userId } = this.assertAuthenticated(user);
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, endpoint: true, isActive: true, organizationId: true, createdAt: true, updatedAt: true },
    });
    const active = subscriptions.filter((sub) => sub.isActive);
    return {
      enabled: active.length > 0,
      activeCount: active.length,
      subscriptions,
    };
  }
}

