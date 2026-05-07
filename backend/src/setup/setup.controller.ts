import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { SetupService } from './setup.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get(['admin/buildings', 'api/admin/buildings'])
  listBuildings(@CurrentUser() user: MvpUser, @Headers('x-org-id') activeOrganizationId?: string) {
    return this.setupService.listBuildings(user, activeOrganizationId);
  }

  @Post(['admin/buildings', 'api/admin/buildings'])
  createBuilding(
    @CurrentUser() user: MvpUser,
    @Body() body: unknown,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.setupService.createBuilding(user, body, activeOrganizationId);
  }

  @Get(['admin/buildings/:id', 'api/admin/buildings/:id'])
  getBuilding(@CurrentUser() user: MvpUser, @Param('id') id: string, @Headers('x-org-id') activeOrganizationId?: string) {
    return this.setupService.getBuilding(user, id, activeOrganizationId);
  }

  @Patch(['admin/buildings/:id', 'api/admin/buildings/:id'])
  updateBuilding(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.setupService.updateBuilding(user, id, body, activeOrganizationId);
  }

  @Get(['admin/staircases', 'api/admin/staircases'])
  listAllStaircases(@CurrentUser() user: MvpUser, @Headers('x-org-id') activeOrganizationId?: string) {
    return this.setupService.listAllStaircases(user, activeOrganizationId);
  }

  @Get(['admin/buildings/:buildingId/staircases', 'api/admin/buildings/:buildingId/staircases'])
  listStaircases(
    @CurrentUser() user: MvpUser,
    @Param('buildingId') buildingId: string,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.setupService.listStaircases(user, buildingId, activeOrganizationId);
  }

  @Post(['admin/buildings/:buildingId/staircases', 'api/admin/buildings/:buildingId/staircases'])
  createStaircase(
    @CurrentUser() user: MvpUser,
    @Param('buildingId') buildingId: string,
    @Body() body: unknown,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.setupService.createStaircase(user, buildingId, body, activeOrganizationId);
  }

  @Patch(['admin/staircases/:id', 'api/admin/staircases/:id'])
  updateStaircase(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.setupService.updateStaircase(user, id, body, activeOrganizationId);
  }

  @Get(['admin/onboarding', 'api/admin/onboarding'])
  getAdminOnboarding(@CurrentUser() user: MvpUser, @Headers('x-org-id') activeOrganizationId?: string) {
    return this.setupService.getAdminOnboarding(user, activeOrganizationId);
  }

  @Patch(['admin/onboarding/step', 'api/admin/onboarding/step'])
  updateAdminOnboarding(@CurrentUser() user: MvpUser, @Body() body: unknown, @Headers('x-org-id') activeOrganizationId?: string) {
    return this.setupService.updateAdminOnboarding(user, body, activeOrganizationId);
  }

  @Post(['admin/onboarding/complete', 'api/admin/onboarding/complete'])
  completeAdminOnboarding(@CurrentUser() user: MvpUser, @Headers('x-org-id') activeOrganizationId?: string) {
    return this.setupService.completeAdminOnboarding(user, activeOrganizationId);
  }
}
