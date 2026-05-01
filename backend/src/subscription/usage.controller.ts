import { Controller, Get, Req } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionService } from './subscription.service';
import type { Request } from 'express';
import { getOrgScope, getRequestedOrgId } from '../common/org-scope';

@Controller('usage')
export class UsageController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('today')
  async getToday(@CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.subscriptionService.getTodayUsage(organizationId);
  }
}
