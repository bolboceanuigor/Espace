import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { SaasManagementService } from './saas-management.service';

@Controller()
export class SaasManagementController {
  constructor(private readonly saasManagementService: SaasManagementService) {}

  // Temporary MVP endpoints until the full backend guard stack is re-enabled.
  @Public()
  @Get(['superadmin/overview', 'api/superadmin/overview'])
  getOverview() {
    return this.saasManagementService.getOverview();
  }

  @Public()
  @Get(['plans', 'api/plans'])
  listPlans() {
    return this.saasManagementService.listPlans();
  }

  @Public()
  @Post(['plans', 'api/plans'])
  createPlan(@Body() body: unknown) {
    return this.saasManagementService.createPlan(body);
  }

  @Public()
  @Patch(['plans/:id', 'api/plans/:id'])
  updatePlan(@Param('id') id: string, @Body() body: unknown) {
    return this.saasManagementService.updatePlan(id, body);
  }

  @Public()
  @Get(['organizations/:id/usage', 'api/organizations/:id/usage'])
  getOrganizationUsage(@Param('id') id: string) {
    return this.saasManagementService.getOrganizationUsage(id);
  }

  @Public()
  @Get(['organizations/:id/subscription', 'api/organizations/:id/subscription'])
  getOrganizationSubscription(@Param('id') id: string) {
    return this.saasManagementService.getOrganizationSubscription(id);
  }

  @Public()
  @Post(['organizations/:id/subscription', 'api/organizations/:id/subscription'])
  upsertOrganizationSubscription(@Param('id') id: string, @Body() body: unknown) {
    return this.saasManagementService.upsertOrganizationSubscription(id, body);
  }

  @Public()
  @Patch(['organizations/:id/subscription', 'api/organizations/:id/subscription'])
  updateOrganizationSubscription(@Param('id') id: string, @Body() body: unknown) {
    return this.saasManagementService.upsertOrganizationSubscription(id, body);
  }
}
