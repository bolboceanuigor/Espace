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

  @Public()
  @Get(':id')
  getPublicOrganization(@Param('id') id: string) {
    return this.organizationsService.findPublicOrganization(id);
  }
}
