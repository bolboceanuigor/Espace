import { Controller, Get, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { Request } from 'express';
import { getOrgScope, getRequestedOrgId } from '../common/org-scope';

@Controller('billing')
export class BillingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('plans')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async listPlans() {
    return this.prisma.plan.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  @Get('subscription')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async getCurrentSubscription(@CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.prisma.subscription.findUnique({
      where: { organizationId },
    });
  }
}
