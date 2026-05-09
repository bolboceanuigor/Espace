import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard } from '../security/mvp-auth.guard';
import { SaasManagementService } from './saas-management.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.SUPERADMIN)
export class SaasManagementController {
  constructor(private readonly saasManagementService: SaasManagementService) {}

  @Get(['superadmin/overview', 'api/superadmin/overview'])
  getOverview() {
    return this.saasManagementService.getOverview();
  }

  @Get(['superadmin/workbench', 'api/superadmin/workbench'])
  getWorkbench() {
    return this.saasManagementService.getWorkbench();
  }

  @Get(['plans', 'api/plans'])
  listPlans() {
    return this.saasManagementService.listPlans();
  }

  @Post(['plans', 'api/plans'])
  createPlan(@Body() body: unknown) {
    return this.saasManagementService.createPlan(body);
  }

  @Patch(['plans/:id', 'api/plans/:id'])
  updatePlan(@Param('id') id: string, @Body() body: unknown) {
    return this.saasManagementService.updatePlan(id, body);
  }

  @Get(['organizations/:id/usage', 'api/organizations/:id/usage'])
  getOrganizationUsage(@Param('id') id: string) {
    return this.saasManagementService.getOrganizationUsage(id);
  }

  @Get(['organizations/:id/subscription', 'api/organizations/:id/subscription'])
  getOrganizationSubscription(@Param('id') id: string) {
    return this.saasManagementService.getOrganizationSubscription(id);
  }

  @Post(['organizations/:id/subscription', 'api/organizations/:id/subscription'])
  upsertOrganizationSubscription(@Param('id') id: string, @Body() body: unknown) {
    return this.saasManagementService.upsertOrganizationSubscription(id, body);
  }

  @Patch(['organizations/:id/subscription', 'api/organizations/:id/subscription'])
  updateOrganizationSubscription(@Param('id') id: string, @Body() body: unknown) {
    return this.saasManagementService.upsertOrganizationSubscription(id, body);
  }
}
