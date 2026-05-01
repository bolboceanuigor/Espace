import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SubscriptionService } from './subscription.service';
import { ChangePlanDto } from './dto/change-plan.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Request } from 'express';
import { getOrgScope, getRequestedOrgId } from '../common/org-scope';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  async getSubscription(@CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    await this.subscriptionService.refreshStatus(organizationId);
    return this.subscriptionService.getSummary(organizationId);
  }

  @Post('change-plan')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async changePlan(@Body() dto: ChangePlanDto, @CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.subscriptionService.changePlan(organizationId, dto.plan, user.role);
  }
}
