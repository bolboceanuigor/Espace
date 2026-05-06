import { Controller, Get, Param } from '@nestjs/common';
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

  @Public()
  @Get(':id')
  getPublicOrganization(@Param('id') id: string) {
    return this.organizationsService.findPublicOrganization(id);
  }
}
