import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { OrganizationOnboardingWorkspaceService } from './organization-onboarding-workspace.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.SUPERADMIN)
export class OrganizationOnboardingWorkspaceController {
  constructor(private readonly onboardingService: OrganizationOnboardingWorkspaceService) {}

  @Get(['superadmin/organizations/:id/onboarding', 'api/superadmin/organizations/:id/onboarding'])
  get(@Param('id') id: string) {
    return this.onboardingService.getWorkspace(id);
  }

  @Patch(['superadmin/organizations/:id/onboarding', 'api/superadmin/organizations/:id/onboarding'])
  update(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.onboardingService.updateWorkspace(user, id, body);
  }

  @Post(['superadmin/organizations/:id/onboarding/recalculate', 'api/superadmin/organizations/:id/onboarding/recalculate'])
  recalculate(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.onboardingService.recalculateWorkspace(user, id);
  }
}
