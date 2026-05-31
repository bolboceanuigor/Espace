import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { OrganizationsService } from './organizations.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminOrganizationDetailController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get(['superadmin/organizations/:id/detail', 'api/superadmin/organizations/:id/detail'])
  detail(@Param('id') id: string) {
    return this.organizationsService.getSuperadminOrganizationDetail(id);
  }

  @Patch(['superadmin/organizations/:id', 'api/superadmin/organizations/:id'])
  update(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.organizationsService.updateSuperadminOrganization(id, body, user);
  }

  @Get(['superadmin/organizations/:id/activity', 'api/superadmin/organizations/:id/activity'])
  activity(@Param('id') id: string, @Query() query: Record<string, string | undefined>) {
    return this.organizationsService.getSuperadminOrganizationActivity(id, query);
  }
}
