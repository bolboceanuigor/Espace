import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller(['organizations', 'api/organizations'])
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Public()
  @Get()
  listPublicOrganizations() {
    return this.organizationsService.listPublicOrganizations();
  }

  // Temporary MVP endpoint until the full backend guard stack is re-enabled.
  @Public()
  @Post()
  createPublicOrganization(@Body() body: unknown) {
    return this.organizationsService.createPublicOrganization(body);
  }

  // Temporary MVP endpoint until the full backend guard stack is re-enabled.
  @Public()
  @Get(':organizationId/admins')
  listPublicOrganizationAdmins(@Param('organizationId') organizationId: string) {
    return this.organizationsService.listPublicOrganizationAdmins(organizationId);
  }

  // Temporary MVP endpoint until the full backend guard stack is re-enabled.
  @Public()
  @Post(':organizationId/admins')
  createPublicOrganizationAdmin(@Param('organizationId') organizationId: string, @Body() body: unknown) {
    return this.organizationsService.createPublicOrganizationAdmin(organizationId, body);
  }

  @Public()
  @Get(':id')
  getPublicOrganization(@Param('id') id: string) {
    return this.organizationsService.findPublicOrganization(id);
  }
}
