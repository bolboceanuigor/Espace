import { Controller, Get, Headers, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { AdminWorkbenchService } from './admin-workbench.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class AdminWorkbenchController {
  constructor(private readonly adminWorkbenchService: AdminWorkbenchService) {}

  @Get(['admin/workbench', 'api/admin/workbench'])
  getWorkbench(@CurrentUser() user: MvpUser, @Headers('x-org-id') scopedOrganizationId?: string) {
    return this.adminWorkbenchService.getWorkbench(user, scopedOrganizationId);
  }
}
