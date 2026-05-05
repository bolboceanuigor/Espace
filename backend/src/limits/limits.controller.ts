import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UpdateOrganizationLimitsDto } from './dto/update-organization-limits.dto';
import { LimitsService } from './limits.service';

@Controller('api')
export class LimitsController {
  constructor(private readonly limitsService: LimitsService) {}

  @Get('superadmin/organizations/:id/limits')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPERADMIN)
  superadminGet(@CurrentUser() user: any, @Param('id') id: string) {
    return this.limitsService.superadminGet(user, id);
  }

  @Patch('superadmin/organizations/:id/limits')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPERADMIN)
  superadminUpdate(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateOrganizationLimitsDto) {
    return this.limitsService.superadminUpdate(user, id, dto);
  }

  @Get('admin/limits')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminGet(@CurrentUser() user: any) {
    return this.limitsService.adminGet(user);
  }
}

