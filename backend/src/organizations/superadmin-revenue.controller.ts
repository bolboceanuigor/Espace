import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard } from '../security/mvp-auth.guard';
import { SuperadminRevenueService } from './superadmin-revenue.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminRevenueController {
  constructor(private readonly revenueService: SuperadminRevenueService) {}

  @Get(['superadmin/revenue/overview', 'api/superadmin/revenue/overview'])
  overview() {
    return this.revenueService.overview();
  }

  @Get(['superadmin/revenue/organizations', 'api/superadmin/revenue/organizations'])
  organizations(@Query() query: Record<string, string | undefined>) {
    return this.revenueService.organizations(query);
  }

  @Get(['superadmin/revenue/pipeline', 'api/superadmin/revenue/pipeline'])
  pipeline() {
    return this.revenueService.pipeline();
  }

  @Get(['superadmin/revenue/warnings', 'api/superadmin/revenue/warnings'])
  warnings() {
    return this.revenueService.warnings();
  }
}
