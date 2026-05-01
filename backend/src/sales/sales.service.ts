import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_MONTHLY_PRICES } from '../subscription/subscription.constants';
import { SubscriptionService } from '../subscription/subscription.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private subscriptionService: SubscriptionService,
  ) {}

  async getMyOrganizations(agentId: string) {
    const orgs = await this.prisma.organization.findMany({
      where: { createdByAgentId: agentId },
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: true,
        _count: { select: { properties: true, users: true } },
      },
    });

    return orgs.map((org) => ({
      id: org.id,
      name: org.name,
      isActive: org.isActive,
      createdAt: org.createdAt,
      plan: org.subscription?.plan ?? null,
      status: org.subscription?.status ?? null,
      propertyCount: org._count.properties,
      userCount: org._count.users,
    }));
  }

  private readonly defaultCommissionRate = 0.1;

  async getCommission(agentId: string) {
    const agent = await this.prisma.user.findFirst({
      where: { id: agentId, deletedAt: null },
      select: { role: true },
    });
    if (!agent) {
      throw new ForbiddenException('User not found');
    }
    const rate = agent.role === Role.MANAGER ? this.defaultCommissionRate : 0;

    const orgs = await this.prisma.organization.findMany({
      where: { createdByAgentId: agentId },
      include: { subscription: true },
    });

    let totalSubscriptionValue = 0;
    const byOrg: { organizationId: string; organizationName: string; plan: string; monthlyPrice: number; commission: number }[] = [];

    for (const org of orgs) {
      const plan = org.subscription?.plan ?? 'starter';
      const monthlyPrice = PLAN_MONTHLY_PRICES[plan] ?? PLAN_MONTHLY_PRICES.starter;
      const commission = monthlyPrice * rate;
      totalSubscriptionValue += monthlyPrice;
      byOrg.push({
        organizationId: org.id,
        organizationName: org.name,
        plan,
        monthlyPrice,
        commission,
      });
    }

    const totalCommission = totalSubscriptionValue * rate;

    return {
      totalClients: orgs.length,
      totalMonthlyRevenue: totalSubscriptionValue,
      totalCommission,
      commissionRate: rate,
      byOrganization: byOrg,
    };
  }

  async createOrganization(
    agentId: string,
    data: {
      organizationName: string;
      ownerEmail: string;
      ownerFirstName: string;
      ownerLastName: string;
      ownerPassword: string;
    },
  ) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: data.ownerEmail, deletedAt: null },
    });
    if (existingUser) {
      throw new BadRequestException('A user with this email already exists');
    }

    const org = await this.prisma.organization.create({
      data: {
        name: data.organizationName,
        createdByAgentId: agentId,
      },
    });

    await this.subscriptionService.createTrialForOrganization(org.id);

    const hashedPassword = await bcrypt.hash(data.ownerPassword, 10);
    await this.prisma.user.create({
      data: {
        email: data.ownerEmail,
        passwordHash: hashedPassword,
        firstName: data.ownerFirstName,
        lastName: data.ownerLastName,
        role: Role.ADMIN,
        authProvider: 'LOCAL',
        emailVerifiedAt: null,
        organization: { connect: { id: org.id } },
      },
    });

    return {
      id: org.id,
      name: org.name,
      createdAt: org.createdAt,
      message: 'Organization and owner created. Trial subscription started.',
    };
  }
}
