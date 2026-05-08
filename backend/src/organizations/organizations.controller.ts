import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';

@Controller(['organizations', 'api/organizations'])
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.SUPERADMIN)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  listPublicOrganizations() {
    return this.organizationsService.listPublicOrganizations();
  }

  @Post()
  createPublicOrganization(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.organizationsService.createPublicOrganization(body, user);
  }

  @Patch(':id/status')
  updatePublicOrganizationStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.organizationsService.updatePublicOrganizationStatus(id, body, user);
  }

  @Patch(':id')
  updatePublicOrganization(@Param('id') id: string, @Body() body: unknown) {
    return this.organizationsService.updatePublicOrganization(id, body);
  }

  @Get(':organizationId/admins')
  listPublicOrganizationAdmins(@Param('organizationId') organizationId: string) {
    return this.organizationsService.listPublicOrganizationAdmins(organizationId);
  }

  @Post(':organizationId/admins')
  createPublicOrganizationAdmin(@CurrentUser() user: MvpUser, @Param('organizationId') organizationId: string, @Body() body: unknown) {
    return this.organizationsService.createPublicOrganizationAdmin(organizationId, body, user);
  }

  @Get(':id')
  getPublicOrganization(@Param('id') id: string) {
    return this.organizationsService.findPublicOrganization(id);
  }
}
