import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PlanCode, Role } from '@prisma/client';
import { hasPermission, Permission } from '../auth/permissions';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_PROPERTY_LIMITS, PLAN_MONTHLY_PRICES } from './subscription.constants';
import { addDays } from 'date-fns';
import { parseDateOnly, formatDateOnly } from '../common/date-only';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}
  private readonly monthlyPricePerApartmentMdl = 1;

  private hasStatus(subscription: { status: string }, values: string[]) {
    const status = (subscription.status || '').toLowerCase();
    return values.some((value) => value.toLowerCase() === status);
  }

  async createTrialForOrganization(organizationId: string) {
    const trialPlan = await this.prisma.plan.upsert({
      where: { code: PlanCode.TRIAL },
      update: { name: 'Trial', priceMonthly: 0, currency: 'EUR' },
      create: { code: PlanCode.TRIAL, name: 'Trial', priceMonthly: 0, currency: 'EUR' },
      select: { id: true },
    });
    const trialEndsAt = addDays(new Date(), 14);
    return this.prisma.subscription.create({
      data: {
        organizationId,
        planId: trialPlan.id,
        plan: 'starter',
        status: 'TRIAL',
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndsAt,
        price: PLAN_MONTHLY_PRICES.starter,
        propertyLimit: PLAN_PROPERTY_LIMITS.starter,
        trialEndsAt,
        subscriptionEndsAt: null,
        isActive: true,
      },
    });
  }

  async getForOrganization(organizationId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    return subscription;
  }

  async getOrNull(organizationId: string) {
    return this.prisma.subscription.findUnique({
      where: { organizationId },
    });
  }

  async getSummary(organizationId: string) {
    const subscription = await this.getForOrganization(organizationId);
    const currentPropertyCount = await this.prisma.property.count({
      where: { organizationId, deletedAt: null, isActive: true },
    });
    const now = new Date();
    const endDate = subscription.subscriptionEndsAt ?? subscription.trialEndsAt;
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const isExpired =
      this.hasStatus(subscription, ['expired', 'suspended', 'past_due', 'cancelled']) ||
      (daysRemaining === 0 && !this.hasStatus(subscription, ['trial']));
    return {
      plan: subscription.plan,
      status: isExpired ? 'expired' : subscription.status,
      daysRemaining: isExpired ? 0 : daysRemaining,
      propertyLimit: subscription.propertyLimit,
      currentPropertyCount,
      monthlyCostMdl: currentPropertyCount * this.monthlyPricePerApartmentMdl,
    };
  }

  async assertCanCreateProperty(organizationId: string) {
    const subscription = await this.getForOrganization(organizationId);
    if (this.hasStatus(subscription, ['expired', 'suspended', 'past_due', 'cancelled'])) {
      throw new BadRequestException('Subscription expired. Renew to create properties.');
    }
    const count = await this.prisma.property.count({
      where: { organizationId, deletedAt: null },
    });
    const limit = subscription.propertyLimit;
    if (limit >= 0 && count >= limit) {
      throw new BadRequestException('Upgrade your plan to add more properties.');
    }
  }

  async assertCanCreateReservation(organizationId: string) {
    const subscription = await this.getForOrganization(organizationId);
    if (this.hasStatus(subscription, ['expired', 'suspended', 'past_due', 'cancelled'])) {
      throw new BadRequestException('Subscription expired. Renew to create reservations.');
    }
  }

  async assertCanCreateClient(organizationId: string) {
    const subscription = await this.getForOrganization(organizationId);
    if (this.hasStatus(subscription, ['expired', 'suspended', 'past_due', 'cancelled'])) {
      throw new BadRequestException('Subscription expired. Renew to create clients.');
    }
  }

  async changePlan(organizationId: string, plan: string, role: Role) {
    if (!hasPermission(role, Permission.SUBSCRIPTION_MANAGE)) {
      throw new ForbiddenException('You do not have permission to manage subscription');
    }
    const allowed = ['starter', 'pro', 'enterprise'];
    if (!allowed.includes(plan)) {
      throw new BadRequestException(`Plan must be one of: ${allowed.join(', ')}`);
    }
    const subscription = await this.getForOrganization(organizationId);
    const propertyLimit = PLAN_PROPERTY_LIMITS[plan] ?? PLAN_PROPERTY_LIMITS.starter;
    const price = PLAN_MONTHLY_PRICES[plan] ?? PLAN_MONTHLY_PRICES.starter;
    const currentCount = await this.prisma.property.count({
      where: { organizationId, deletedAt: null },
    });
    if (propertyLimit >= 0 && currentCount > propertyLimit) {
      throw new BadRequestException(
        `You have ${currentCount} properties. ${plan} plan allows ${propertyLimit}. Remove some properties first or choose a higher plan.`,
      );
    }
    const status = this.hasStatus(subscription, ['trial']) ? 'TRIAL' : 'ACTIVE';
    const updated = await this.prisma.subscription.update({
      where: { organizationId },
      data: {
        plan,
        propertyLimit,
        price,
        status,
        isActive: true,
      },
    });
    const dueDate = addDays(new Date(), 14);
    await this.prisma.invoice.create({
      data: {
        organizationId,
        amount: price,
        discount: 0,
        finalAmount: price,
        plan,
        status: 'pending',
        dueDate,
      },
    });
    return updated;
  }

  /** Call periodically or on access to mark expired subscriptions */
  async refreshStatus(organizationId: string) {
    const sub = await this.getOrNull(organizationId);
    if (!sub) return null;
    const now = new Date();
    const endDate = sub.subscriptionEndsAt ?? sub.trialEndsAt;
    if (endDate < now && !this.hasStatus(sub, ['expired', 'past_due', 'cancelled', 'suspended'])) {
      return this.prisma.subscription.update({
        where: { organizationId },
        data: { status: 'PAST_DUE' },
      });
    }
    return sub;
  }

  async getTodayUsage(organizationId: string) {
    const today = formatDateOnly(new Date());
    const start = parseDateOnly(today);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const [activePropertiesCount, reservationsCount] = await Promise.all([
      this.prisma.property.count({
        where: {
          organizationId,
          deletedAt: null,
          isActive: true,
        },
      }),
      this.prisma.reservation.count({
        where: {
          organizationId,
          deletedAt: null,
          checkIn: { lt: end },
          checkOut: { gt: start },
        },
      }),
    ]);
    await this.prisma.usageMeter.upsert({
      where: {
        organizationId_date: {
          organizationId,
          date: start,
        },
      },
      update: {
        activePropertiesCount,
        reservationsCount,
      },
      create: {
        organizationId,
        date: start,
        activePropertiesCount,
        reservationsCount,
      },
    });
    return { activePropertiesCount, reservationsCount };
  }
}
