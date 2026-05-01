import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UpdatePrivacySettingsDto } from './dto/update-privacy-settings.dto';
import { PrivacyService } from './privacy.service';

@Controller('api')
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Get('admin/settings/privacy')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminGet(@CurrentUser() user: any) {
    return this.privacyService.adminGet(user);
  }

  @Patch('admin/settings/privacy')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminUpdate(@CurrentUser() user: any, @Body() dto: UpdatePrivacySettingsDto) {
    return this.privacyService.adminUpdate(user, dto);
  }

  @Get('resident/privacy-settings')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentGet(@CurrentUser() user: any) {
    return this.privacyService.residentGet(user);
  }
}

