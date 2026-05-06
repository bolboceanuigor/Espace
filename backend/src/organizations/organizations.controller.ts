import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard } from '../security/mvp-auth.guard';

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
  createPublicOrganization(@Body() body: unknown) {
    return this.organizationsService.createPublicOrganization(body);
  }

  @Get(':organizationId/admins')
  listPublicOrganizationAdmins(@Param('organizationId') organizationId: string) {
    return this.organizationsService.listPublicOrganizationAdmins(organizationId);
  }

  @Post(':organizationId/admins')
  createPublicOrganizationAdmin(@Param('organizationId') organizationId: string, @Body() body: unknown) {
    return this.organizationsService.createPublicOrganizationAdmin(organizationId, body);
  }

  @Patch(':id/status')
  updatePublicOrganizationStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.organizationsService.updatePublicOrganizationStatus(id, body);
  }

  @Get(':id')
  getPublicOrganization(@Param('id') id: string) {
    return this.organizationsService.findPublicOrganization(id);
  }
}
