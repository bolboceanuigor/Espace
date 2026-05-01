import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingCurrency,
  BillingType,
  OrganizationPaymentMethod,
  OrganizationPaymentStatus,
  OrganizationInvoiceStatus,
  OrganizationSubscriptionStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class OrganizationBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private isSuperAdmin(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    return role === 'SUPERADMIN' || role === 'SUPER_ADMIN';
  }

  private assertSuperAdmin(user: AuthUser) {
    if (!this.isSuperAdmin(user)) throw new ForbiddenException('Super admin access required');
  }

  private assertAdmin(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (role !== 'ADMIN') throw new ForbiddenException('Admin access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return user.organizationId;
  }

  private async usageMetrics(organizationId: string) {
    const [apartmentsCount, areaAggregate] = await Promise.all([
      this.prisma.apartment.count({ where: { organizationId } }),
      this.prisma.apartment.aggregate({ where: { organizationId }, _sum: { areaM2: true } }),
    ]);
    return { apartmentsCount, totalM2: Number(areaAggregate._sum.areaM2 || 0) };
  }

  private calculateAmount(
    billingType: BillingType,
    price: number,
    usage: { apartmentsCount: number; totalM2: number },
    subscription: { status: OrganizationSubscriptionStatus; trialEndDate: Date | null },
    periodEnd: Date,
  ) {
    const inTrial =
      subscription.status === OrganizationSubscriptionStatus.TRIAL &&
      subscription.trialEndDate &&
      periodEnd.getTime() <= subscription.trialEndDate.getTime();
    if (inTrial) return 0;
    if (billingType === BillingType.PER_APARTMENT) return usage.apartmentsCount * price;
    if (billingType === BillingType.PER_M2) return usage.totalM2 * price;
    return price;
  }

  private async notifyOrganizationAdmins(organizationId: string, title: string, message: string) {
    const admins = await this.prisma.user.findMany({
      where: { organizationId, role: 'ADMIN', isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!admins.length) return;
    await this.notificationsService.notifyUsers({
      organizationId,
      userIds: admins.map((a) => a.id),
      title,
      message,
      type: 'SYSTEM' as any,
      link: '/admin/subscription',
    });
  }

  async listSubscriptions(user: AuthUser, status?: OrganizationSubscriptionStatus) {
    this.assertSuperAdmin(user);
    const subscriptions = await this.prisma.organizationSubscription.findMany({
      where: status ? { status } : undefined,
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const rows = await Promise.all(
      subscriptions.map(async (subscription) => {
        const [usage, latestUnpaidInvoice] = await Promise.all([
          this.usageMetrics(subscription.organizationId),
          this.prisma.organizationInvoice.findFirst({
            where: { subscriptionId: subscription.id, status: OrganizationInvoiceStatus.UNPAID },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          }),
        ]);
        const monthlyAmount = this.calculateAmount(subscription.billingType, subscription.price, usage, subscription, new Date());
        return {
          id: subscription.id,
          organizationId: subscription.organizationId,
          organizationName: subscription.organization.name,
          apartments: usage.apartmentsCount,
          totalM2: usage.totalM2,
          billingType: subscription.billingType,
          price: subscription.price,
          currency: subscription.currency,
          status: subscription.status,
          trialEndDate: subscription.trialEndDate,
          nextBillingDate: subscription.nextBillingDate,
          monthlyAmount,
          latestUnpaidInvoiceId: latestUnpaidInvoice?.id || null,
        };
      }),
    );

    return rows;
  }

  async listTrials(user: AuthUser) {
    this.assertSuperAdmin(user);
    const trials = await this.prisma.organizationSubscription.findMany({
      where: { status: OrganizationSubscriptionStatus.TRIAL },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: [{ trialEndDate: 'asc' }, { createdAt: 'desc' }],
      take: 1000,
    });

    const rows = await Promise.all(
      trials.map(async (trial) => {
        const now = new Date();
        const trialEndDate = trial.trialEndDate;
        const daysLeft = trialEndDate
          ? Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        const [
          buildingsCreated,
          apartmentsAdded,
          residentsInvited,
          invoicesGenerated,
          paymentsRecorded,
          issuesCreated,
          lastAdminLoginAudit,
        ] = await Promise.all([
          this.prisma.building.count({ where: { organizationId: trial.organizationId } }),
          this.prisma.apartment.count({ where: { organizationId: trial.organizationId } }),
          this.prisma.invitation.count({
            where: { organizationId: trial.organizationId, role: 'RESIDENT' as any },
          }),
          this.prisma.residentInvoice.count({ where: { organizationId: trial.organizationId } }),
          this.prisma.payment.count({ where: { organizationId: trial.organizationId } }),
          this.prisma.issue.count({ where: { organizationId: trial.organizationId } }),
          this.prisma.auditLog.findFirst({
            where: {
              organizationId: trial.organizationId,
              action: 'LOGIN_SUCCESS',
              user: { role: 'ADMIN', deletedAt: null },
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }),
        ]);

        const scorePoints =
          (buildingsCreated > 0 ? 1 : 0) +
          (apartmentsAdded >= 5 ? 1 : 0) +
          (residentsInvited >= 3 ? 1 : 0) +
          (invoicesGenerated > 0 ? 1 : 0) +
          (paymentsRecorded > 0 ? 1 : 0) +
          (issuesCreated > 0 ? 1 : 0) +
          (lastAdminLoginAudit ? 1 : 0);
        const usageScore = scorePoints >= 5 ? 'HIGH' : scorePoints >= 3 ? 'MEDIUM' : 'LOW';

        return {
          subscriptionId: trial.id,
          organizationId: trial.organizationId,
          organizationName: trial.organization.name,
          status: trial.status,
          trialEndDate,
          daysLeft,
          metrics: {
            buildingsCreated,
            apartmentsAdded,
            residentsInvited,
            invoicesGenerated,
            paymentsRecorded,
            issuesCreated,
            lastAdminLogin: lastAdminLoginAudit?.createdAt || null,
          },
          usageScore,
          endingSoon: daysLeft !== null && daysLeft <= 3,
        };
      }),
    );

    return rows;
  }

  async convertTrial(user: AuthUser, organizationId: string) {
    this.assertSuperAdmin(user);
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    const updated = await this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        status: OrganizationSubscriptionStatus.ACTIVE,
        subscriptionStartDate: new Date(),
      },
    });
    await this.notifyOrganizationAdmins(organizationId, 'Trial convertit', 'Abonamentul a fost activat.');
    return updated;
  }

  async extendTrial(user: AuthUser, organizationId: string, days: number) {
    this.assertSuperAdmin(user);
    if (!Number.isFinite(days) || days <= 0 || days > 365) {
      throw new BadRequestException('Days must be between 1 and 365');
    }
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    const base = subscription.trialEndDate && subscription.trialEndDate > new Date() ? subscription.trialEndDate : new Date();
    const nextTrialEndDate = new Date(base);
    nextTrialEndDate.setDate(nextTrialEndDate.getDate() + Math.floor(days));
    const updated = await this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        status: OrganizationSubscriptionStatus.TRIAL,
        trialEndDate: nextTrialEndDate,
        nextBillingDate: nextTrialEndDate,
      },
    });
    await this.notifyOrganizationAdmins(
      organizationId,
      'Trial extins',
      `Perioada de trial a fost extinsa cu ${Math.floor(days)} zile.`,
    );
    return updated;
  }

  async markTrialLost(user: AuthUser, organizationId: string) {
    this.assertSuperAdmin(user);
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        status: OrganizationSubscriptionStatus.CANCELLED,
        notes: subscription.notes
          ? `${subscription.notes}\n[${new Date().toISOString()}] Trial marked lost by SUPER_ADMIN`
          : `[${new Date().toISOString()}] Trial marked lost by SUPER_ADMIN`,
      },
    });
  }

  async listInvoices(user: AuthUser) {
    this.assertSuperAdmin(user);
    return this.prisma.organizationInvoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        organization: { select: { id: true, name: true } },
        subscription: { select: { id: true, status: true, billingType: true, price: true, currency: true } },
      },
    });
  }

  async getInvoiceById(user: AuthUser, id: string) {
    this.assertSuperAdmin(user);
    const invoice = await this.prisma.organizationInvoice.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        subscription: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async generateMonthlyInvoices(user: AuthUser) {
    this.assertSuperAdmin(user);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 15);
    const subscriptions = await this.prisma.organizationSubscription.findMany({
      where: {
        status: {
          in: [OrganizationSubscriptionStatus.ACTIVE, OrganizationSubscriptionStatus.TRIAL, OrganizationSubscriptionStatus.PAST_DUE],
        },
      },
    });
    let generated = 0;
    for (const subscription of subscriptions) {
      const existing = await this.prisma.organizationInvoice.findUnique({
        where: { subscriptionId_periodStart_periodEnd: { subscriptionId: subscription.id, periodStart: start, periodEnd: end } },
      });
      if (existing) continue;
      const usage = await this.usageMetrics(subscription.organizationId);
      const amount = this.calculateAmount(subscription.billingType, subscription.price, usage, subscription, end);
      await this.prisma.organizationInvoice.create({
        data: {
          organizationId: subscription.organizationId,
          subscriptionId: subscription.id,
          periodStart: start,
          periodEnd: end,
          amount,
          currency: subscription.currency,
          dueDate,
          status: OrganizationInvoiceStatus.UNPAID,
        },
      });
      await this.prisma.organizationSubscription.update({
        where: { id: subscription.id },
        data: {
          lastBilledAt: new Date(),
          outstandingAmount: { increment: amount },
          status:
            amount > 0 && subscription.status === OrganizationSubscriptionStatus.ACTIVE
              ? OrganizationSubscriptionStatus.PAST_DUE
              : subscription.status,
        },
      });
      generated += 1;
    }
    return { generated, periodStart: start, periodEnd: end, dueDate };
  }

  async listPayments(user: AuthUser) {
    this.assertSuperAdmin(user);
    return this.prisma.organizationPayment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        organization: { select: { id: true, name: true } },
        invoice: { select: { id: true, status: true, amount: true, dueDate: true } },
      },
    });
  }

  async createPayment(
    user: AuthUser,
    payload: {
      organizationId: string;
      invoiceId?: string;
      amount: number;
      currency: BillingCurrency;
      method: OrganizationPaymentMethod;
      status?: OrganizationPaymentStatus;
      note?: string;
    },
  ) {
    this.assertSuperAdmin(user);
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId: payload.organizationId },
      select: { id: true, organizationId: true, status: true },
    });
    if (!subscription) throw new NotFoundException('Subscription not found for organization');
    const payment = await this.prisma.organizationPayment.create({
      data: {
        organizationId: payload.organizationId,
        subscriptionId: subscription.id,
        invoiceId: payload.invoiceId || null,
        amount: payload.amount,
        currency: payload.currency,
        method: payload.method,
        status: payload.status || OrganizationPaymentStatus.CONFIRMED,
        note: payload.note || null,
      },
    });

    if (payment.status === OrganizationPaymentStatus.CONFIRMED) {
      await this.prisma.organizationSubscription.update({
        where: { id: subscription.id },
        data: {
          lastPaymentAt: new Date(),
          outstandingAmount: { decrement: payload.amount },
          status: OrganizationSubscriptionStatus.ACTIVE,
        },
      });
      if (payload.invoiceId) {
        const invoice = await this.prisma.organizationInvoice.findUnique({
          where: { id: payload.invoiceId },
          select: { id: true, amount: true },
        });
        if (invoice && payload.amount >= invoice.amount) {
          await this.prisma.organizationInvoice.update({
            where: { id: payload.invoiceId },
            data: { status: OrganizationInvoiceStatus.PAID, paidAt: new Date() },
          });
        }
      }
    }
    return payment;
  }

  async upsertOrganizationSubscription(
    user: AuthUser,
    organizationId: string,
    payload: {
      planId?: string | null;
      billingType: BillingType;
      price: number;
      currency: BillingCurrency;
      trialStartDate?: string | null;
      trialEndDate?: string | null;
      subscriptionStartDate?: string | null;
      nextBillingDate?: string | null;
      status: OrganizationSubscriptionStatus;
      notes?: string | null;
    },
  ) {
    this.assertSuperAdmin(user);
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!org) throw new NotFoundException('Organization not found');

    const updated = await this.prisma.organizationSubscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        planId: payload.planId || null,
        billingType: payload.billingType,
        price: payload.price,
        currency: payload.currency,
        trialStartDate: payload.trialStartDate ? new Date(payload.trialStartDate) : null,
        trialEndDate: payload.trialEndDate ? new Date(payload.trialEndDate) : null,
        subscriptionStartDate: payload.subscriptionStartDate ? new Date(payload.subscriptionStartDate) : null,
        nextBillingDate: payload.nextBillingDate ? new Date(payload.nextBillingDate) : null,
        status: payload.status,
        notes: payload.notes || null,
      },
      update: {
        planId: payload.planId || null,
        billingType: payload.billingType,
        price: payload.price,
        currency: payload.currency,
        trialStartDate: payload.trialStartDate ? new Date(payload.trialStartDate) : null,
        trialEndDate: payload.trialEndDate ? new Date(payload.trialEndDate) : null,
        subscriptionStartDate: payload.subscriptionStartDate ? new Date(payload.subscriptionStartDate) : null,
        nextBillingDate: payload.nextBillingDate ? new Date(payload.nextBillingDate) : null,
        status: payload.status,
        notes: payload.notes || null,
      },
      include: { plan: true },
    });
    await this.auditService.logAction({
      userId: this.userId(user),
      organizationId,
      action: 'SUBSCRIPTION_CHANGE',
      entityType: 'SUBSCRIPTION',
      entityId: updated.id,
      description: 'Created or updated organization subscription',
      newValuesJson: updated,
    });
    return updated;
  }

  async getOrganizationSubscription(user: AuthUser, organizationId: string) {
    this.assertSuperAdmin(user);
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });
    if (!org) throw new NotFoundException('Organization not found');
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: {
        invoices: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    return { organization: org, subscription };
  }

  async updateSubscription(
    user: AuthUser,
    id: string,
    payload: Partial<{
      billingType: BillingType;
      price: number;
      currency: BillingCurrency;
      trialStartDate: string | null;
      trialEndDate: string | null;
      status: OrganizationSubscriptionStatus;
      notes: string | null;
      nextBillingDate: string | null;
    }>,
  ) {
    this.assertSuperAdmin(user);
    const subscription = await this.prisma.organizationSubscription.findUnique({ where: { id } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    const oldSubscription = subscription;
    const updated = await this.prisma.organizationSubscription.update({
      where: { id },
      data: {
        ...(payload.billingType !== undefined ? { billingType: payload.billingType } : {}),
        ...(payload.price !== undefined ? { price: payload.price } : {}),
        ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
        ...(payload.trialStartDate !== undefined ? { trialStartDate: payload.trialStartDate ? new Date(payload.trialStartDate) : null } : {}),
        ...(payload.trialEndDate !== undefined ? { trialEndDate: payload.trialEndDate ? new Date(payload.trialEndDate) : null } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes || null } : {}),
        ...(payload.nextBillingDate !== undefined ? { nextBillingDate: payload.nextBillingDate ? new Date(payload.nextBillingDate) : null } : {}),
      },
    });
    if (payload.status !== undefined && payload.status !== oldSubscription.status) {
      await this.notifyOrganizationAdmins(
        updated.organizationId,
        'Schimbare status abonament',
        `Statusul abonamentului a fost actualizat la ${updated.status}.`,
      );
    }
    await this.auditService.logUpdate(
      { userId: this.userId(user), organizationId: updated.organizationId },
      'SUBSCRIPTION',
      updated.id,
      oldSubscription,
      updated,
      'Updated subscription contract',
    );
    return updated;
  }

  async generateInvoice(
    user: AuthUser,
    subscriptionId: string,
    periodStart?: string,
    periodEnd?: string,
  ) {
    this.assertSuperAdmin(user);
    const subscription = await this.prisma.organizationSubscription.findUnique({ where: { id: subscriptionId } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    const start = periodStart ? new Date(periodStart) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = periodEnd ? new Date(periodEnd) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    if (end < start) throw new BadRequestException('Invalid period');

    const usage = await this.usageMetrics(subscription.organizationId);
    const amount = this.calculateAmount(subscription.billingType, subscription.price, usage, subscription, end);
    const invoice = await this.prisma.organizationInvoice.create({
      data: {
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        periodStart: start,
        periodEnd: end,
        amount,
        currency: subscription.currency,
        dueDate: new Date(end.getFullYear(), end.getMonth(), 15),
        status: OrganizationInvoiceStatus.UNPAID,
      },
    });
    await this.prisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: {
        lastBilledAt: new Date(),
        outstandingAmount: { increment: amount },
      },
    });
    await this.auditService.logCreate(
      { userId: this.userId(user), organizationId: subscription.organizationId },
      'SUBSCRIPTION_INVOICE',
      invoice.id,
      invoice,
      'Generated subscription invoice',
    );
    return invoice;
  }

  async markInvoicePaid(user: AuthUser, invoiceId: string) {
    this.assertSuperAdmin(user);
    const invoice = await this.prisma.organizationInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const updated = await this.prisma.organizationInvoice.update({
      where: { id: invoiceId },
      data: { status: OrganizationInvoiceStatus.PAID, paidAt: new Date() },
    });
    await this.prisma.organizationSubscription.update({
      where: { id: updated.subscriptionId },
      data: {
        lastPaymentAt: new Date(),
        outstandingAmount: { decrement: updated.amount },
        status: OrganizationSubscriptionStatus.ACTIVE,
      },
    });
    await this.auditService.logUpdate(
      { userId: this.userId(user), organizationId: updated.organizationId },
      'SUBSCRIPTION_INVOICE',
      updated.id,
      invoice,
      updated,
      'Marked subscription invoice paid',
    );
    return updated;
  }

  async applyQuickAction(
    user: AuthUser,
    subscriptionId: string,
    action: 'START_TRIAL' | 'EXTEND_TRIAL_30' | 'MARK_ACTIVE' | 'MARK_PAST_DUE' | 'SUSPEND' | 'CANCEL',
  ) {
    this.assertSuperAdmin(user);
    const subscription = await this.prisma.organizationSubscription.findUnique({ where: { id: subscriptionId } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    const now = new Date();
    const plus30 = new Date(now);
    plus30.setDate(plus30.getDate() + 30);

    if (action === 'START_TRIAL') {
      const updated = await this.prisma.organizationSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: OrganizationSubscriptionStatus.TRIAL,
          trialStartDate: now,
          trialEndDate: plus30,
          nextBillingDate: plus30,
        },
      });
      await this.notifyOrganizationAdmins(updated.organizationId, 'Abonament in trial', 'Perioada de trial a fost pornita.');
      await this.auditService.logAction({
        userId: this.userId(user),
        organizationId: updated.organizationId,
        action: 'SUBSCRIPTION_CHANGE',
        entityType: 'SUBSCRIPTION',
        entityId: updated.id,
        description: `Applied quick action ${action}`,
        newValuesJson: updated,
      });
      return updated;
    }
    if (action === 'EXTEND_TRIAL_30') {
      const base = subscription.trialEndDate && subscription.trialEndDate > now ? subscription.trialEndDate : now;
      const nextTrialEnd = new Date(base);
      nextTrialEnd.setDate(nextTrialEnd.getDate() + 30);
      const updated = await this.prisma.organizationSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: OrganizationSubscriptionStatus.TRIAL,
          trialEndDate: nextTrialEnd,
          nextBillingDate: nextTrialEnd,
        },
      });
      await this.notifyOrganizationAdmins(updated.organizationId, 'Trial extins', 'Perioada de trial a fost extinsa cu 30 zile.');
      await this.auditService.logAction({
        userId: this.userId(user),
        organizationId: updated.organizationId,
        action: 'SUBSCRIPTION_CHANGE',
        entityType: 'SUBSCRIPTION',
        entityId: updated.id,
        description: `Applied quick action ${action}`,
        newValuesJson: updated,
      });
      return updated;
    }
    if (action === 'MARK_ACTIVE') {
      const updated = await this.prisma.organizationSubscription.update({
        where: { id: subscriptionId },
        data: { status: OrganizationSubscriptionStatus.ACTIVE },
      });
      await this.notifyOrganizationAdmins(updated.organizationId, 'Abonament activ', 'Abonamentul este activ.');
      await this.auditService.logAction({
        userId: this.userId(user),
        organizationId: updated.organizationId,
        action: 'SUBSCRIPTION_CHANGE',
        entityType: 'SUBSCRIPTION',
        entityId: updated.id,
        description: `Applied quick action ${action}`,
        newValuesJson: updated,
      });
      return updated;
    }
    if (action === 'MARK_PAST_DUE') {
      const updated = await this.prisma.organizationSubscription.update({
        where: { id: subscriptionId },
        data: { status: OrganizationSubscriptionStatus.PAST_DUE },
      });
      await this.notifyOrganizationAdmins(updated.organizationId, 'Abonament past due', 'Exista plati restante pentru abonament.');
      await this.auditService.logAction({
        userId: this.userId(user),
        organizationId: updated.organizationId,
        action: 'SUBSCRIPTION_CHANGE',
        entityType: 'SUBSCRIPTION',
        entityId: updated.id,
        description: `Applied quick action ${action}`,
        newValuesJson: updated,
      });
      return updated;
    }
    if (action === 'SUSPEND') {
      const updated = await this.prisma.organizationSubscription.update({
        where: { id: subscriptionId },
        data: { status: OrganizationSubscriptionStatus.SUSPENDED },
      });
      await this.notifyOrganizationAdmins(updated.organizationId, 'Abonament suspendat', 'Abonamentul a fost suspendat.');
      await this.auditService.logAction({
        userId: this.userId(user),
        organizationId: updated.organizationId,
        action: 'SUBSCRIPTION_CHANGE',
        entityType: 'SUBSCRIPTION',
        entityId: updated.id,
        description: `Applied quick action ${action}`,
        newValuesJson: updated,
      });
      return updated;
    }
    const updated = await this.prisma.organizationSubscription.update({
      where: { id: subscriptionId },
      data: { status: OrganizationSubscriptionStatus.CANCELLED },
    });
    await this.notifyOrganizationAdmins(updated.organizationId, 'Abonament anulat', 'Abonamentul organizatiei a fost anulat.');
    await this.auditService.logAction({
      userId: this.userId(user),
      organizationId: updated.organizationId,
      action: 'SUBSCRIPTION_CHANGE',
      entityType: 'SUBSCRIPTION',
      entityId: updated.id,
      description: `Applied quick action ${action}`,
      newValuesJson: updated,
    });
    return updated;
  }

  async adminSubscription(user: AuthUser) {
    const organizationId = this.assertAdmin(user);
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: {
        invoices: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    const usage = await this.usageMetrics(organizationId);
    const currentMonthlyAmount = this.calculateAmount(subscription.billingType, subscription.price, usage, subscription, new Date());
    return {
      id: subscription.id,
      status: subscription.status,
      billingType: subscription.billingType,
      price: subscription.price,
      currency: subscription.currency,
      trialEndDate: subscription.trialEndDate,
      nextBillingDate: subscription.nextBillingDate,
      currentMonthlyAmount,
      invoices: subscription.invoices,
    };
  }

  async adminSubscriptionStatus(user: AuthUser) {
    const organizationId = this.assertAdmin(user);
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      select: {
        id: true,
        status: true,
        billingType: true,
        price: true,
        currency: true,
        trialEndDate: true,
        nextBillingDate: true,
        outstandingAmount: true,
        lastBilledAt: true,
        lastPaymentAt: true,
      },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return subscription;
  }

  async adminSubscriptionInvoices(user: AuthUser) {
    const organizationId = this.assertAdmin(user);
    return this.prisma.organizationInvoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
