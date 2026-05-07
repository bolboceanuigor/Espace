import { Body, Controller, Get, Headers, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Get(['admin/buildings', 'api/admin/buildings', 'buildings', 'api/buildings'])
  listBuildings(@CurrentUser() user: MvpUser, @Headers('x-org-id') activeOrganizationId?: string) {
    return this.setupService.listBuildings(user, activeOrganizationId);
  }

  @Post(['admin/buildings', 'api/admin/buildings', 'buildings', 'api/buildings'])
  createBuilding(
    @CurrentUser() user: MvpUser,
    @Body() body: unknown,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.setupService.createBuilding(user, body, activeOrganizationId);
  }

  @Get(['admin/buildings/:id', 'api/admin/buildings/:id', 'buildings/:id', 'api/buildings/:id'])
  getBuilding(@CurrentUser() user: MvpUser, @Param('id') id: string, @Headers('x-org-id') activeOrganizationId?: string) {
    return this.setupService.getBuilding(user, id, activeOrganizationId);
  }

  @Patch(['admin/buildings/:id', 'api/admin/buildings/:id', 'buildings/:id', 'api/buildings/:id'])
  updateBuilding(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.setupService.updateBuilding(user, id, body, activeOrganizationId);
  }

  @Get(['admin/staircases', 'api/admin/staircases', 'staircases', 'api/staircases'])
  listAllStaircases(@CurrentUser() user: MvpUser, @Headers('x-org-id') activeOrganizationId?: string) {
    return this.setupService.listAllStaircases(user, activeOrganizationId);
  }

  @Post(['staircases', 'api/staircases'])
  createStaircaseFlat(
    @CurrentUser() user: MvpUser,
    @Body() body: unknown,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    const buildingId =
      body && typeof body === 'object' && 'buildingId' in body
        ? String((body as { buildingId?: unknown }).buildingId || '')
        : '';
    return this.setupService.createStaircase(user, buildingId, body, activeOrganizationId);
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

  @Post(['admin/imports/apartments', 'api/admin/imports/apartments'])
  @UseInterceptors(FileInterceptor('file'))
  importApartments(
    @CurrentUser() user: MvpUser,
    @Body() body: unknown,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.setupService.importApartments(user, body, file, activeOrganizationId);
  }

  @Patch(['admin/staircases/:id', 'api/admin/staircases/:id', 'staircases/:id', 'api/staircases/:id'])
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
