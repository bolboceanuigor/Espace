import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { SettingsService } from './settings.service';

@Controller('api')
export class OrganizationSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('admin/organization/settings')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.SUPERADMIN)
  adminGet(@CurrentUser() user: any) {
    return this.settingsService.getOrganizationSettingsForAdmin(user.id ?? user.sub);
  }

  @Patch('admin/organization/settings')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.SUPERADMIN)
  adminPatch(@CurrentUser() user: any, @Body() dto: UpdateOrganizationSettingsDto) {
    return this.settingsService.updateOrganizationSettingsForAdmin(user.id ?? user.sub, dto);
  }

  @Get('resident/organization/public-info')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentPublicInfo(@CurrentUser() user: any) {
    return this.settingsService.getOrganizationPublicInfo(user.id ?? user.sub);
  }

  @Get('superadmin/organizations/:id/settings')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPERADMIN)
  superadminGet(@Param('id') id: string) {
    return this.settingsService.getOrganizationSettingsForSuperadmin(id);
  }

  @Patch('superadmin/organizations/:id/settings')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPERADMIN)
  superadminPatch(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateOrganizationSettingsDto) {
    return this.settingsService.updateOrganizationSettingsForSuperadmin(user.id ?? user.sub, id, dto);
  }
}
