import { Controller, Get, Req } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import type { Request } from 'express';
import { getOrgScope, getRequestedOrgId } from '../common/org-scope';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  getMetrics(@CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.dashboardService.getMetrics({
      id: user.id,
      role: user.role,
      organizationId,
    });
  }
}
