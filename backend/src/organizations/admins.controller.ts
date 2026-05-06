import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { OrganizationsService } from './organizations.service';

@Controller(['admins', 'api/admins'])
export class AdminsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // Temporary MVP endpoint until the full backend guard stack is re-enabled.
  @Public()
  @Get()
  listPublicAdmins() {
    return this.organizationsService.listPublicAdmins();
  }
}
