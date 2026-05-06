import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard } from '../security/mvp-auth.guard';
import { OrganizationsService } from './organizations.service';

@Controller(['admins', 'api/admins'])
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.SUPERADMIN)
export class AdminsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  listPublicAdmins() {
    return this.organizationsService.listPublicAdmins();
  }
}
