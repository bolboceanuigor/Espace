import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { AssociationOnboardingService } from './association-onboarding.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.SUPERADMIN)
export class AssociationOnboardingController {
  constructor(private readonly onboardingService: AssociationOnboardingService) {}

  @Post(['superadmin/associations/onboarding/start', 'api/superadmin/associations/onboarding/start'])
  start(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.onboardingService.start(user, body);
  }

  @Get(['superadmin/associations/onboarding/:id', 'api/superadmin/associations/onboarding/:id'])
  getState(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.onboardingService.getState(user, id);
  }

  @Patch(['superadmin/associations/onboarding/:id/step-1', 'api/superadmin/associations/onboarding/:id/step-1'])
  updateStepOne(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.onboardingService.updateStepOne(user, id, body);
  }

  @Patch(['superadmin/associations/onboarding/:id/step-2', 'api/superadmin/associations/onboarding/:id/step-2'])
  updateStepTwo(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.onboardingService.updateStepTwo(user, id, body);
  }

  @Patch(['superadmin/associations/onboarding/:id/apartments', 'api/superadmin/associations/onboarding/:id/apartments'])
  updateApartments(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.onboardingService.updateApartments(user, id, body);
  }

  @Patch(['superadmin/associations/onboarding/:id/residents', 'api/superadmin/associations/onboarding/:id/residents'])
  updateResidents(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.onboardingService.updateResidents(user, id, body);
  }

  @Patch(['superadmin/associations/onboarding/:id/tariffs', 'api/superadmin/associations/onboarding/:id/tariffs'])
  updateTariffs(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.onboardingService.updateTariffs(user, id, body);
  }

  @Post(['superadmin/associations/onboarding/:id/activate', 'api/superadmin/associations/onboarding/:id/activate'])
  activate(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.onboardingService.activate(user, id);
  }
}
