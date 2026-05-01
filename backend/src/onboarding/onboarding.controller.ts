import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OnboardingService } from './onboarding.service';
import { UpdateOnboardingStepDto } from './dto/onboarding.dto';

@Controller('api')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('admin/onboarding')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminGet(@CurrentUser() user: any) {
    return this.onboardingService.adminGetOnboarding(user);
  }

  @Patch('admin/onboarding/step')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminUpdateStep(@CurrentUser() user: any, @Body() dto: UpdateOnboardingStepDto) {
    return this.onboardingService.adminUpdateStep(user, dto);
  }

  @Post('admin/onboarding/complete')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminComplete(@CurrentUser() user: any) {
    return this.onboardingService.adminComplete(user);
  }

  @Get('superadmin/onboarding-overview')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  superadminOverview(@CurrentUser() user: any) {
    return this.onboardingService.superadminOverview(user);
  }
}

