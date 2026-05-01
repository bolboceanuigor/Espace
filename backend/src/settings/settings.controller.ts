import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsOrgDto } from './dto/update-settings-org.dto';
import { UpdateSettingsProfileDto } from './dto/update-settings-profile.dto';

@Controller('api/settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings(@CurrentUser() user: any) {
    return this.settingsService.getSettings(user.id ?? user.sub);
  }

  @Patch('org')
  updateOrg(@CurrentUser() user: any, @Body() dto: UpdateSettingsOrgDto) {
    return this.settingsService.updateOrg(user.id ?? user.sub, user.role, dto);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateSettingsProfileDto) {
    return this.settingsService.updateProfile(user.id ?? user.sub, dto);
  }
}
