import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, ReservationStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { startOfMonth, endOfMonth, addDays } from 'date-fns';
import { PLAN_PROPERTY_LIMITS, PLAN_MONTHLY_PRICES } from '../subscription/subscription.constants';

function effectiveMonthlyPrice(sub: { price: number; customPrice: number | null; discountPercent: number | null }): number {
  const base = sub.customPrice ?? sub.price;
  const pct = sub.discountPercent ?? 0;
  return base * (1 - pct / 100);
}

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private async audit(organizationId: string, action: string, payload?: Record<string, unknown>, performedById?: string, performedByRole?: string, entityType?: string, entityId?: string) {
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: performedById || 'system',
        action,
        entityType: entityType || 'SYSTEM',
        entityId: entityId || null,
        description: action,
        newValuesJson: payload as Prisma.JsonObject | undefined,
        userAgent: performedByRole || null,
      },
    });
  }

  async getCrmStats() {
    const [
      totalOrganizations,
      subscriptions,
      trialCount,
      expiredCount,
      unpaidInvoices,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.subscription.findMany({
        where: { status: { in: ['trial', 'active'] }, isActive: true },
      }),
      this.prisma.subscription.count({ where: { status: 'trial', isActive: true } }),
      this.prisma.subscription.count({ where: { status: 'expired' } }),
      this.prisma.invoice.aggregate({
        where: { status: 'pending' },
        _sum: { finalAmount: true },
      }),
    ]);
    const activeSubscriptions = subscriptions.length;
    const totalMRR = subscriptions.reduce((sum, s) => sum + effectiveMonthlyPrice(s), 0);
    const totalUnpaidInvoices = unpaidInvoices._sum.finalAmount ?? 0;
    return {
      totalOrganizations,
      activeSubscriptions,
      trialUsers: trialCount,
      expiredUsers: expiredCount,
      totalMRR,
      totalUnpaidInvoices,
    };
  }

  async getOrganizations(query?: { search?: string }) {
    const orgs = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      where: query?.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { users: { some: { email: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : undefined,
      include: {
        subscription: true,
        createdByAgent: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        users: { where: { role: Role.ADMIN }, take: 1, select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { properties: true } },
        invoices: { where: { status: 'paid' }, orderBy: { paidAt: 'desc' }, take: 1, select: { paidAt: true } },
      },
    });

    return orgs.map((org) => {
      const sub = org.subscription;
      const owner = org.users[0];
      const lastPayment = org.invoices[0]?.paidAt ?? null;
      const nextBilling = sub ? (sub.subscriptionEndsAt ?? sub.trialEndsAt) : null;
      const monthlyPrice = sub ? effectiveMonthlyPrice(sub) : null;
      return {
        id: org.id,
        name: org.name,
        ownerName: owner ? `${owner.firstName} ${owner.lastName}` : null,
        email: owner?.email ?? null,
        plan: sub?.plan ?? null,
        subscriptionStatus: sub?.status ?? null,
        propertyCount: org._count.properties,
        propertyLimit: sub?.propertyLimit ?? null,
        monthlyPrice,
        lastPaymentDate: lastPayment,
        nextBillingDate: nextBilling,
        salesAgent: org.createdByAgent,
        isActive: org.isActive,
        createdAt: org.createdAt,
      };
    });
  }

  async getPlatformStats() {
    const [orgCount, activeOrgCount, totalRevenueResult, userCount, activeSubsCount] =
      await Promise.all([
        this.prisma.organization.count(),
        this.prisma.organization.count({ where: { isActive: true } }),
        this.prisma.reservation.aggregate({
          where: { status: ReservationStatus.CONFIRMED, deletedAt: null },
          _sum: { totalPrice: true },
        }),
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.subscription.count({
          where: { status: { in: ['trial', 'active'] }, isActive: true },
        }),
      ]);

    return {
      totalOrganizations: orgCount,
      activeOrganizations: activeOrgCount,
      totalRevenue: totalRevenueResult._sum.totalPrice ?? 0,
      totalUsers: userCount,
      totalSubscriptionsActive: activeSubsCount,
    };
  }

  async updateOrganizationStatus(id: string, isActive: boolean, performedById?: string, performedByRole?: string) {
    const updated = await this.prisma.organization.update({
      where: { id },
      data: { isActive },
      select: { id: true, name: true, isActive: true },
    });
    await this.audit(id, isActive ? 'REACTIVATE_ORGANIZATION' : 'SUSPEND_ORGANIZATION', { isActive }, performedById, performedByRole);
    return updated;
  }

  async updateOrganizationPlan(id: string, plan: string) {
    const limit = PLAN_PROPERTY_LIMITS[plan] ?? PLAN_PROPERTY_LIMITS.starter;
    const price = PLAN_MONTHLY_PRICES[plan] ?? PLAN_MONTHLY_PRICES.starter;
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId: id },
    });
    if (!sub) {
      const created = await this.prisma.subscription.create({
        data: {
          organizationId: id,
          plan,
          status: 'active',
          price,
          propertyLimit: limit,
          trialEndsAt: new Date(),
          isActive: true,
        },
      });
      const dueDate = addDays(new Date(), 14);
      await this.prisma.invoice.create({
        data: {
          organizationId: id,
          amount: price,
          discount: 0,
          finalAmount: price,
          plan,
          status: 'pending',
          dueDate,
        },
      });
      return created;
    }
    const updated = await this.prisma.subscription.update({
      where: { organizationId: id },
      data: { plan, propertyLimit: limit, status: 'active', price, isActive: true }, // keep customPrice/discountPercent if set
    });
    const dueDate = addDays(new Date(), 14);
    await this.prisma.invoice.create({
      data: {
        organizationId: id,
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

  async getOrganizationDetail(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        subscription: true,
        createdByAgent: { select: { id: true, firstName: true, lastName: true, email: true } },
        users: { select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, createdAt: true } },
        _count: { select: { properties: true, reservations: true } },
        invoices: { orderBy: { issuedAt: 'desc' } },
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    const revenueResult = await this.prisma.reservation.aggregate({
      where: { organizationId: id, status: ReservationStatus.CONFIRMED, checkIn: { gte: monthStart, lte: monthEnd } },
      _sum: { totalPrice: true },
    });
    const monthlyPrice = org.subscription ? effectiveMonthlyPrice(org.subscription) : null;
    return {
      ...org,
      monthlyRevenue: revenueResult._sum.totalPrice ?? 0,
      effectiveMonthlyPrice: monthlyPrice,
    };
  }

  async setCustomPrice(organizationId: string, customPrice: number, performedById?: string, performedByRole?: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    await this.prisma.subscription.update({
      where: { organizationId },
      data: { customPrice },
    });
    await this.audit(organizationId, 'SET_CUSTOM_PRICE', { customPrice }, performedById, performedByRole);
    return this.getOrganizationDetail(organizationId);
  }

  async setDiscountPercent(organizationId: string, discountPercent: number, performedById?: string, performedByRole?: string) {
    if (discountPercent < 0 || discountPercent > 100) throw new BadRequestException('Discount must be between 0 and 100');
    const sub = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    await this.prisma.subscription.update({
      where: { organizationId },
      data: { discountPercent },
    });
    await this.audit(organizationId, 'SET_DISCOUNT_PERCENT', { discountPercent }, performedById, performedByRole);
    return this.getOrganizationDetail(organizationId);
  }

  async extendTrial(organizationId: string, trialEndsAt: Date, performedById?: string, performedByRole?: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    await this.prisma.subscription.update({
      where: { organizationId },
      data: { trialEndsAt, status: 'trial', isActive: true },
    });
    await this.audit(organizationId, 'EXTEND_TRIAL', { trialEndsAt: trialEndsAt.toISOString() }, performedById, performedByRole);
    return this.getOrganizationDetail(organizationId);
  }

  async markInvoicePaid(invoiceId: string, performedById?: string, performedByRole?: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { organization: true } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'paid') throw new BadRequestException('Invoice already paid');
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'paid', paidAt: new Date() },
    });
    const sub = await this.prisma.subscription.findUnique({ where: { organizationId: invoice.organizationId } });
    if (sub) {
      const nextEnd = addDays(new Date(), 30);
      await this.prisma.subscription.update({
        where: { organizationId: invoice.organizationId },
        data: { subscriptionEndsAt: nextEnd, status: 'active', isActive: true },
      });
    }
    await this.audit(invoice.organizationId, 'MARK_INVOICE_PAID', { invoiceId, amount: invoice.finalAmount }, performedById, performedByRole, 'Invoice', invoiceId);
    return this.getOrganizationDetail(invoice.organizationId);
  }

  async setPropertyLimit(organizationId: string, propertyLimit: number, performedById?: string, performedByRole?: string) {
    if (propertyLimit < 0) throw new BadRequestException('Property limit must be >= 0');
    const sub = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    const currentCount = await this.prisma.property.count({ where: { organizationId, deletedAt: null } });
    if (propertyLimit >= 0 && currentCount > propertyLimit) throw new BadRequestException(`Organization has ${currentCount} properties. Set limit >= ${currentCount} or remove properties first.`);
    await this.prisma.subscription.update({
      where: { organizationId },
      data: { propertyLimit },
    });
    await this.audit(organizationId, 'SET_PROPERTY_LIMIT', { propertyLimit }, performedById, performedByRole);
    return this.getOrganizationDetail(organizationId);
  }
}
