import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingType, NotificationType, OrganizationInvoiceStatus, OrganizationSubscriptionStatus, ScheduledJobStatus, SystemErrorLevel, SystemErrorSource } from '@prisma/client';
import { EmailTemplateService } from '../email/email-template.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemMonitoringService } from '../system-monitoring/system-monitoring.service';
import { ALL_SCHEDULED_JOB_NAMES, SCHEDULED_JOB_NAMES, ScheduledJobName } from './scheduler.constants';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly runningJobs = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly systemMonitoringService: SystemMonitoringService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {}

  async onModuleInit() {
    await this.ensureJobsRegistered();
  }

  async ensureJobsRegistered() {
    for (const name of ALL_SCHEDULED_JOB_NAMES) {
      await this.prisma.scheduledJob.upsert({
        where: { name },
        create: { name, status: ScheduledJobStatus.ACTIVE },
        update: {},
      });
    }
  }

  async listJobs() {
    await this.ensureJobsRegistered();
    return this.prisma.scheduledJob.findMany({ orderBy: { name: 'asc' } });
  }

  async enableJob(name: ScheduledJobName) {
    await this.ensureJobsRegistered();
    return this.prisma.scheduledJob.update({
      where: { name },
      data: { status: ScheduledJobStatus.ACTIVE },
    });
  }

  async disableJob(name: ScheduledJobName) {
    await this.ensureJobsRegistered();
    return this.prisma.scheduledJob.update({
      where: { name },
      data: { status: ScheduledJobStatus.DISABLED },
    });
  }

  async runJobManually(name: ScheduledJobName) {
    return this.runJob(name, true);
  }

  private async isJobActive(name: ScheduledJobName) {
    await this.ensureJobsRegistered();
    const row = await this.prisma.scheduledJob.findUnique({ where: { name }, select: { status: true } });
    return row?.status === ScheduledJobStatus.ACTIVE;
  }

  private async runJob(name: ScheduledJobName, forced = false) {
    if (this.runningJobs.has(name)) {
      this.logger.warn(`[${name}] skipped because previous execution is still running`);
      return { job: name, skipped: true, reason: 'already_running' };
    }
    if (!forced && !(await this.isJobActive(name))) {
      this.logger.log(`[${name}] skipped because job is disabled`);
      return { job: name, skipped: true, reason: 'disabled' };
    }
    this.runningJobs.add(name);
    const startedAt = new Date();
    this.logger.log(`[${name}] start at ${startedAt.toISOString()}`);
    try {
      let result: any = null;
      if (name === SCHEDULED_JOB_NAMES.MONTHLY_CHARGES_GENERATOR) result = await this.monthlyChargesGenerator();
      if (name === SCHEDULED_JOB_NAMES.MONTHLY_INVOICE_GENERATOR) result = await this.monthlyInvoiceGenerator();
      if (name === SCHEDULED_JOB_NAMES.PAYMENT_REMINDER_JOB) result = await this.paymentReminderJob();
      if (name === SCHEDULED_JOB_NAMES.TRIAL_EXPIRATION_JOB) result = await this.trialExpirationJob();
      if (name === SCHEDULED_JOB_NAMES.SUBSCRIPTION_BILLING_JOB) result = await this.subscriptionBillingJob();
      if (name === SCHEDULED_JOB_NAMES.OVERDUE_SUBSCRIPTION_JOB) result = await this.overdueSubscriptionJob();
      if (name === SCHEDULED_JOB_NAMES.NOTIFICATION_DISPATCHER_JOB) result = await this.notificationDispatcherJob();
      if (name === SCHEDULED_JOB_NAMES.DEBT_REMINDER_JOB) result = await this.debtReminderJob();
      if (name === SCHEDULED_JOB_NAMES.CLIENT_FOLLOW_UP_REMINDER_JOB) result = await this.clientFollowUpReminderJob();
      await this.prisma.scheduledJob.update({
        where: { name },
        data: { lastRunAt: new Date() },
      });
      this.logger.log(`[${name}] completed`);
      return { job: name, startedAt, result };
    } catch (error) {
      this.logger.error(`[${name}] failed: ${String(error)}`);
      await this.systemMonitoringService.logError({
        source: SystemErrorSource.JOB,
        level: SystemErrorLevel.ERROR,
        message: `Scheduled job failed: ${name}`,
        stack: error instanceof Error ? error.stack : String(error),
        metadataJson: { jobName: name, forced, startedAt: startedAt.toISOString() },
      });
      return { job: name, startedAt, error: String(error) };
    } finally {
      this.runningJobs.delete(name);
    }
  }

  private targetMonthYear(now = new Date()) {
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }

  private previousMonthRange(now = new Date()) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }

  private async monthlyChargesGenerator() {
    const { month, year } = this.targetMonthYear();
    const organizations = await this.prisma.organization.findMany({ select: { id: true } });
    let created = 0;
    for (const org of organizations) {
      const apartments = await this.prisma.apartment.findMany({
        where: { organizationId: org.id },
        select: { id: true, areaM2: true },
      });
      for (const apartment of apartments) {
        const existingCurrent = await this.prisma.monthlyCharge.findMany({
          where: { organizationId: org.id, apartmentId: apartment.id, month, year },
          select: { tariffName: true },
        });
        const existingTariffs = new Set(existingCurrent.map((c) => c.tariffName));
        const latestCharges = await this.prisma.monthlyCharge.findMany({
          where: {
            organizationId: org.id,
            apartmentId: apartment.id,
            OR: [{ year: { lt: year } }, { year, month: { lt: month } }],
          },
          orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
        });
        const uniqueLatestByTariff = new Map<string, { amount: number }>();
        for (const row of latestCharges) {
          if (!uniqueLatestByTariff.has(row.tariffName)) {
            uniqueLatestByTariff.set(row.tariffName, { amount: row.amount });
          }
        }
        const payload: Array<{ organizationId: string; apartmentId: string; month: number; year: number; tariffName: string; amount: number; status: string }> = [];
        if (uniqueLatestByTariff.size > 0) {
          for (const [tariffName, row] of uniqueLatestByTariff.entries()) {
            if (existingTariffs.has(tariffName)) continue;
            payload.push({
              organizationId: org.id,
              apartmentId: apartment.id,
              month,
              year,
              tariffName,
              amount: row.amount,
              status: 'PENDING',
            });
          }
        } else if (!existingTariffs.has('MONTHLY_ASSOCIATION_FEE')) {
          payload.push({
            organizationId: org.id,
            apartmentId: apartment.id,
            month,
            year,
            tariffName: 'MONTHLY_ASSOCIATION_FEE',
            amount: Number(apartment.areaM2 || 0),
            status: 'PENDING',
          });
        }
        if (payload.length) {
          const result = await this.prisma.monthlyCharge.createMany({
            data: payload,
            skipDuplicates: true,
          });
          created += result.count;
        }
      }
    }
    return { month, year, created };
  }

  private async monthlyInvoiceGenerator() {
    const { month, year } = this.targetMonthYear();
    const dueDate = new Date(year, month - 1, 16);
    const organizations = await this.prisma.organization.findMany({
      select: { id: true, invoicePrefix: true },
    });
    let createdOrUpdated = 0;
    for (const org of organizations) {
      const apartments = await this.prisma.apartment.findMany({
        where: { organizationId: org.id },
        select: { id: true, number: true },
      });
      for (const apartment of apartments) {
        const charges = await this.prisma.monthlyCharge.findMany({
          where: { organizationId: org.id, apartmentId: apartment.id, month, year },
          select: { amount: true },
        });
        const currentCharges = charges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const confirmedPayments = await this.prisma.payment.findMany({
          where: { organizationId: org.id, apartmentId: apartment.id, month: monthKey, status: 'CONFIRMED' },
          select: { amount: true },
        });
        const paymentsAmount = confirmedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const totalDue = Math.max(currentCharges - paymentsAmount, 0);
        const safePrefix = (org.invoicePrefix || 'INV').trim().toUpperCase();
        const invoiceNumber = `${safePrefix}-${year}${String(month).padStart(2, '0')}-${org.id.slice(0, 4).toUpperCase()}-${apartment.number}`;
        await this.prisma.residentInvoice.upsert({
          where: {
            organizationId_apartmentId_month_year: {
              organizationId: org.id,
              apartmentId: apartment.id,
              month,
              year,
            },
          },
          create: {
            organizationId: org.id,
            apartmentId: apartment.id,
            month,
            year,
            invoiceNumber,
            previousDebt: 0,
            currentCharges,
            paymentsAmount,
            totalDue,
            dueDate,
            status: totalDue <= 0 ? 'PAID' : 'DRAFT',
          },
          update: {
            currentCharges,
            paymentsAmount,
            totalDue,
            dueDate,
            status: totalDue <= 0 ? 'PAID' : 'DRAFT',
          },
        });
        createdOrUpdated += 1;
      }
    }
    return { month, year, dueDate, createdOrUpdated };
  }

  private async paymentReminderJob() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const invoices = await this.prisma.residentInvoice.findMany({
      where: {
        totalDue: { gt: 0 },
        status: { in: ['DRAFT', 'ISSUED'] },
        dueDate: { lte: now },
      },
      select: { id: true, organizationId: true, apartmentId: true, invoiceNumber: true },
    });
    let sent = 0;
    for (const invoice of invoices) {
      const alreadySentToday = await this.prisma.paymentReminder.findFirst({
        where: {
          organizationId: invoice.organizationId,
          invoiceId: invoice.id,
          type: 'IN_APP',
          createdAt: { gte: startOfDay },
        },
        select: { id: true },
      });
      if (alreadySentToday) continue;
      const message = `Reminder: factura ${invoice.invoiceNumber} este neachitata.`;
      await this.prisma.paymentReminder.create({
        data: {
          organizationId: invoice.organizationId,
          apartmentId: invoice.apartmentId,
          invoiceId: invoice.id,
          type: 'IN_APP',
          message,
          status: 'SENT',
          sentAt: new Date(),
        },
      });
      const residents = await this.prisma.residentProfile.findMany({
        where: { organizationId: invoice.organizationId, apartmentId: invoice.apartmentId },
        select: { userId: true },
        distinct: ['userId'],
      });
      if (residents.length) {
        await this.notificationsService.notifyUsers({
          organizationId: invoice.organizationId,
          userIds: residents.map((r) => r.userId),
          type: NotificationType.PAYMENT,
          title: 'Reminder plata',
          message,
          link: `/resident/invoices/${invoice.id}`,
          preferredChannels: ['IN_APP'],
        });
      }
      sent += 1;
    }
    return { sent };
  }

  private async trialExpirationJob() {
    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const endingSoon = await this.prisma.organizationSubscription.findMany({
      where: {
        status: OrganizationSubscriptionStatus.TRIAL,
        trialEndDate: { gte: now, lte: soonThreshold },
      },
      select: { organizationId: true, trialEndDate: true, organization: { select: { name: true } } },
    });
    for (const trial of endingSoon) {
      const admins = await this.prisma.user.findMany({
        where: { organizationId: trial.organizationId, role: 'ADMIN', deletedAt: null, isActive: true },
        select: { id: true, email: true, firstName: true },
      });
      for (const admin of admins) {
        await this.emailTemplateService.sendTemplateEmail({
          to: admin.email,
          key: 'trial_ending_soon',
          targetRole: 'ADMIN',
          variables: {
            userName: admin.firstName || admin.email,
            organizationName: trial.organization?.name || 'Espace',
            trialEndDate: trial.trialEndDate ? trial.trialEndDate.toISOString().slice(0, 10) : '-',
            supportEmail: process.env.SUPPORT_EMAIL || 'support@espace.local',
          },
          inAppFallback: async () => {
            await this.notificationsService.createNotification({
              organizationId: trial.organizationId,
              userId: admin.id,
              title: 'Trial se apropie de final',
              message: `Trial-ul expira pe ${trial.trialEndDate?.toISOString().slice(0, 10) || '-'}.`,
              type: NotificationType.SYSTEM,
              link: '/admin/subscription',
            });
          },
        });
      }
    }

    const subscriptions = await this.prisma.organizationSubscription.findMany({
      where: {
        status: OrganizationSubscriptionStatus.TRIAL,
        trialEndDate: { lt: now },
      },
      select: { id: true, organizationId: true },
    });
    let updated = 0;
    for (const subscription of subscriptions) {
      const hasUnpaid = await this.prisma.organizationInvoice.findFirst({
        where: { subscriptionId: subscription.id, status: OrganizationInvoiceStatus.UNPAID },
        select: { id: true },
      });
      await this.prisma.organizationSubscription.update({
        where: { id: subscription.id },
        data: {
          status: hasUnpaid ? OrganizationSubscriptionStatus.PAST_DUE : OrganizationSubscriptionStatus.ACTIVE,
        },
      });
      updated += 1;
    }
    return { updated };
  }

  private async subscriptionBillingJob() {
    const now = new Date();
    const { start, end } = this.previousMonthRange(now);
    const subscriptions = await this.prisma.organizationSubscription.findMany({
      where: {
        status: { in: [OrganizationSubscriptionStatus.ACTIVE, OrganizationSubscriptionStatus.TRIAL, OrganizationSubscriptionStatus.PAST_DUE] },
        OR: [{ nextBillingDate: null }, { nextBillingDate: { lte: now } }],
      },
    });
    let generated = 0;
    for (const subscription of subscriptions) {
      const existing = await this.prisma.organizationInvoice.findUnique({
        where: { subscriptionId_periodStart_periodEnd: { subscriptionId: subscription.id, periodStart: start, periodEnd: end } },
      });
      if (existing) continue;
      const [apartmentsCount, areaAggregate] = await Promise.all([
        this.prisma.apartment.count({ where: { organizationId: subscription.organizationId } }),
        this.prisma.apartment.aggregate({ where: { organizationId: subscription.organizationId }, _sum: { areaM2: true } }),
      ]);
      const totalM2 = Number(areaAggregate._sum.areaM2 || 0);
      const inTrial =
        subscription.status === OrganizationSubscriptionStatus.TRIAL &&
        subscription.trialEndDate &&
        end.getTime() <= subscription.trialEndDate.getTime();
      let amount = 0;
      if (!inTrial) {
        if (subscription.billingType === BillingType.PER_APARTMENT) amount = apartmentsCount * subscription.price;
        if (subscription.billingType === BillingType.PER_M2) amount = totalM2 * subscription.price;
        if (subscription.billingType === BillingType.FIXED) amount = subscription.price;
      }
      await this.prisma.organizationInvoice.create({
        data: {
          organizationId: subscription.organizationId,
          subscriptionId: subscription.id,
          periodStart: start,
          periodEnd: end,
          amount,
          currency: subscription.currency,
          dueDate: new Date(now.getFullYear(), now.getMonth(), 15),
          status: OrganizationInvoiceStatus.UNPAID,
        },
      });
      const nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      await this.prisma.organizationSubscription.update({
        where: { id: subscription.id },
        data: {
          nextBillingDate,
          lastBilledAt: new Date(),
          outstandingAmount: { increment: amount },
        },
      });
      generated += 1;
    }
    return { generated, periodStart: start, periodEnd: end };
  }

  private async overdueSubscriptionJob() {
    const now = new Date();
    const subscriptions = await this.prisma.organizationSubscription.findMany({
      where: {
        status: { in: [OrganizationSubscriptionStatus.ACTIVE, OrganizationSubscriptionStatus.TRIAL, OrganizationSubscriptionStatus.PAST_DUE] },
      },
      select: { id: true, organizationId: true, status: true },
    });
    let pastDue = 0;
    let suspended = 0;
    for (const subscription of subscriptions) {
      const oldestUnpaid = await this.prisma.organizationInvoice.findFirst({
        where: { subscriptionId: subscription.id, status: { in: [OrganizationInvoiceStatus.UNPAID, OrganizationInvoiceStatus.OVERDUE] } },
        orderBy: { dueDate: 'asc' },
        select: { id: true, dueDate: true },
      });
      if (!oldestUnpaid) continue;
      const days = Math.floor((now.getTime() - oldestUnpaid.dueDate.getTime()) / (24 * 60 * 60 * 1000));
      if (days >= 0) {
        await this.prisma.organizationInvoice.updateMany({
          where: { subscriptionId: subscription.id, status: OrganizationInvoiceStatus.UNPAID, dueDate: { lt: now } },
          data: { status: OrganizationInvoiceStatus.OVERDUE },
        });
      }
      if (days >= 45 && subscription.status !== OrganizationSubscriptionStatus.SUSPENDED) {
        await this.prisma.organizationSubscription.update({
          where: { id: subscription.id },
          data: { status: OrganizationSubscriptionStatus.SUSPENDED },
        });
        suspended += 1;
        continue;
      }
      if (days >= 15 && subscription.status !== OrganizationSubscriptionStatus.PAST_DUE) {
        await this.prisma.organizationSubscription.update({
          where: { id: subscription.id },
          data: { status: OrganizationSubscriptionStatus.PAST_DUE },
        });
        pastDue += 1;
      }
    }
    return { pastDue, suspended };
  }

  private async notificationDispatcherJob() {
    await this.notificationsService.processPendingJobs();
    return { ok: true };
  }

  private renderReminderMessage(template: string, data: Record<string, string | number>) {
    let message = template;
    for (const [key, value] of Object.entries(data)) {
      message = message.replaceAll(`{{${key}}}`, String(value));
    }
    return message;
  }

  private async debtReminderJob() {
    const now = new Date();
    const organizations = await this.prisma.organization.findMany({
      select: { id: true, name: true },
    });
    let sent = 0;
    let skipped = 0;
    for (const organization of organizations) {
      const rules = await this.prisma.reminderRule.findMany({
        where: { organizationId: organization.id, isActive: true },
      });
      if (!rules.length) continue;

      const apartmentPauseRows = await this.prisma.apartmentReminderSettings.findMany({
        where: { organizationId: organization.id },
      });
      const pauseMap = new Map(apartmentPauseRows.map((row) => [row.apartmentId, row]));

      for (const rule of rules) {
        const invoices = await this.prisma.residentInvoice.findMany({
          where: {
            organizationId: organization.id,
            totalDue: { gt: 0 },
            status: { in: ['DRAFT', 'ISSUED', 'PARTIAL'] },
          },
          include: {
            apartment: {
              include: {
                residents: { include: { user: true } },
              },
            },
          },
        });

        for (const invoice of invoices) {
          const paused = pauseMap.get(invoice.apartmentId);
          if (
            paused?.remindersPaused &&
            (!paused.pausedUntil || paused.pausedUntil.getTime() >= now.getTime())
          ) {
            skipped += 1;
            await this.prisma.reminderLog.create({
              data: {
                organizationId: organization.id,
                apartmentId: invoice.apartmentId,
                invoiceId: invoice.id,
                reminderRuleId: rule.id,
                channelsJson: ['IN_APP'],
                message: 'Skipped due to apartment pause settings',
                status: 'SKIPPED',
                reason: paused.pauseReason || 'Paused',
                sentAt: now,
              },
            });
            continue;
          }

          let match = false;
          const dueDate = invoice.dueDate;
          const daysDiff = dueDate
            ? Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000))
            : 0;
          if (rule.triggerType === 'BEFORE_DUE_DATE' && dueDate) {
            const offset = Math.max(0, Number(rule.daysOffset || 0));
            match = daysDiff === -offset;
          }
          if (rule.triggerType === 'AFTER_DUE_DATE' && dueDate) {
            const offset = Math.max(0, Number(rule.daysOffset || 0));
            match = daysDiff >= offset;
          }
          if (rule.triggerType === 'DEBT_OVER_AMOUNT') {
            match = invoice.totalDue >= Number(rule.debtThreshold || 0);
          }
          if (rule.triggerType === 'MONTHLY_UNPAID') {
            match = now.getDate() === 1;
          }
          if (!match) continue;

          const recentlySent = await this.prisma.reminderLog.findFirst({
            where: {
              organizationId: organization.id,
              apartmentId: invoice.apartmentId,
              invoiceId: invoice.id,
              reminderRuleId: rule.id,
              status: 'SENT',
              createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
            },
            select: { id: true },
          });
          if (recentlySent) {
            skipped += 1;
            continue;
          }

          const residents = invoice.apartment.residents || [];
          const userIds = Array.from(new Set(residents.map((resident) => resident.userId)));
          if (!userIds.length) {
            skipped += 1;
            await this.prisma.reminderLog.create({
              data: {
                organizationId: organization.id,
                apartmentId: invoice.apartmentId,
                invoiceId: invoice.id,
                reminderRuleId: rule.id,
                channelsJson: ['IN_APP'],
                message: 'Skipped because apartment has no linked residents',
                status: 'SKIPPED',
                reason: 'No recipients',
                sentAt: now,
              },
            });
            continue;
          }

          const residentName =
            residents[0]?.user?.fullName ||
            `${residents[0]?.user?.firstName || ''} ${residents[0]?.user?.lastName || ''}`.trim() ||
            'Locatar';
          const message = this.renderReminderMessage(rule.messageTemplate, {
            residentName,
            apartmentNumber: invoice.apartment.number,
            amount: invoice.totalDue.toFixed(2),
            dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : '-',
            organizationName: organization.name,
          });
          try {
            await this.notificationsService.notifyUsers({
              organizationId: organization.id,
              userIds,
              type: NotificationType.PAYMENT,
              title: rule.name,
              message,
              link: `/resident/invoices/${invoice.id}`,
              preferredChannels: ['IN_APP'],
            });
            await this.prisma.reminderLog.create({
              data: {
                organizationId: organization.id,
                apartmentId: invoice.apartmentId,
                invoiceId: invoice.id,
                reminderRuleId: rule.id,
                channelsJson: ['IN_APP'],
                message,
                status: 'SENT',
                sentAt: now,
              },
            });
            sent += 1;
          } catch (error) {
            await this.prisma.reminderLog.create({
              data: {
                organizationId: organization.id,
                apartmentId: invoice.apartmentId,
                invoiceId: invoice.id,
                reminderRuleId: rule.id,
                channelsJson: ['IN_APP'],
                message,
                status: 'FAILED',
                reason: String(error),
                sentAt: now,
              },
            });
          }
        }
      }
    }
    return { sent, skipped };
  }

  private async clientFollowUpReminderJob() {
    const now = new Date();
    const limit = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const notes = await (this.prisma as any).clientNote.findMany({
      where: {
        followUpAt: { lte: now },
        followUpDone: false,
        OR: [{ followUpReminderSentAt: null }, { followUpReminderSentAt: { lte: limit } }],
      },
      include: {
        organization: { select: { id: true, name: true } },
      },
      take: 500,
    });
    if (!notes.length) return { reminded: 0 };

    const superadmins = await this.prisma.user.findMany({
      where: {
        role: { in: ['SUPERADMIN', 'SUPER_ADMIN'] as any },
        isActive: true,
        deletedAt: null,
        organizationId: { not: null },
      },
      select: { id: true, organizationId: true },
      take: 200,
    });

    let reminded = 0;
    for (const note of notes) {
      for (const superadmin of superadmins) {
        if (!superadmin.organizationId) continue;
        await this.notificationsService.createNotification({
          organizationId: superadmin.organizationId,
          userId: superadmin.id,
          title: 'Follow-up client pending',
          message: `[${note.organization?.name || 'Organizatie'}] ${note.title}`,
          type: NotificationType.SYSTEM,
          link: `/superadmin/follow-ups`,
          preferredChannels: ['IN_APP'],
        });
      }
      await (this.prisma as any).clientNote.update({
        where: { id: note.id },
        data: { followUpReminderSentAt: now },
      });
      reminded += 1;
    }
    return { reminded };
  }

  // Cron schedules
  @Cron('5 0 1 * *')
  async runMonthlyChargesCron() {
    await this.runJob(SCHEDULED_JOB_NAMES.MONTHLY_CHARGES_GENERATOR);
  }

  @Cron('20 0 1 * *')
  async runMonthlyInvoicesCron() {
    await this.runJob(SCHEDULED_JOB_NAMES.MONTHLY_INVOICE_GENERATOR);
  }

  @Cron('0 8 * * *')
  async runPaymentReminderCron() {
    await this.runJob(SCHEDULED_JOB_NAMES.PAYMENT_REMINDER_JOB);
  }

  @Cron('0 1 * * *')
  async runTrialExpirationCron() {
    await this.runJob(SCHEDULED_JOB_NAMES.TRIAL_EXPIRATION_JOB);
  }

  @Cron('0 2 1 * *')
  async runSubscriptionBillingCron() {
    await this.runJob(SCHEDULED_JOB_NAMES.SUBSCRIPTION_BILLING_JOB);
  }

  @Cron('30 2 * * *')
  async runOverdueSubscriptionCron() {
    await this.runJob(SCHEDULED_JOB_NAMES.OVERDUE_SUBSCRIPTION_JOB);
  }

  @Cron('*/1 * * * *')
  async runNotificationDispatcherCron() {
    await this.runJob(SCHEDULED_JOB_NAMES.NOTIFICATION_DISPATCHER_JOB);
  }

  @Cron('15 8 * * *')
  async runDebtReminderCron() {
    await this.runJob(SCHEDULED_JOB_NAMES.DEBT_REMINDER_JOB);
  }

  @Cron('30 8 * * *')
  async runClientFollowUpReminderCron() {
    await this.runJob(SCHEDULED_JOB_NAMES.CLIENT_FOLLOW_UP_REMINDER_JOB);
  }
}

