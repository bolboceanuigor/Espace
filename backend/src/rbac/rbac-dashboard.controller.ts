import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RbacDashboardService } from './rbac-dashboard.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { AllowsPastDue } from '../subscription/subscription-access.decorator';

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RbacDashboardController {
  constructor(private readonly service: RbacDashboardService) {}

  @Get('superadmin/overview')
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  superadminOverview(@CurrentUser() user: any, @Req() req: Request) {
    const requestedOrgId = req.headers['x-org-id'];
    const orgId = Array.isArray(requestedOrgId) ? requestedOrgId[0] : requestedOrgId;
    return this.service.getSuperadminOverview(user, orgId);
  }

  @Get('superadmin/command-center')
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  superadminCommandCenter(@CurrentUser() user: any, @Req() req: Request) {
    const requestedOrgId = req.headers['x-org-id'];
    const orgId = Array.isArray(requestedOrgId) ? requestedOrgId[0] : requestedOrgId;
    return this.service.getSuperadminCommandCenter(user, orgId);
  }

  @Get('admin/overview')
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.SUPER_ADMIN)
  @UseGuards(SubscriptionAccessGuard)
  @AllowsPastDue()
  adminOverview(@CurrentUser() user: any) {
    return this.service.getAdminOverview(user);
  }

  @Get('resident/overview')
  @Roles(Role.RESIDENT, Role.TENANT)
  residentOverview(@CurrentUser() user: any, @Query('apartmentId') apartmentId?: string) {
    return this.service.getResidentOverview(user, apartmentId);
  }

  @Get('resident/my-apartments')
  @Roles(Role.RESIDENT, Role.TENANT)
  residentApartments(@CurrentUser() user: any) {
    return this.service.getResidentApartments(user);
  }
}
