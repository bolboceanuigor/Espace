import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, type MvpUser } from '../security/mvp-auth.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { UpdateApartmentReminderSettingsDto, UpsertReminderRuleDto } from './dto/reminders.dto';
import { RemindersService } from './reminders.service';

@Controller('api')
@UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('admin/reminder-rules')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('NOTIFICATIONS', 'VIEW')
  @AllowsPastDue()
  adminListRules(@CurrentUser() user: MvpUser) {
    return this.remindersService.adminListRules(user);
  }

  @Post('admin/reminder-rules')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('NOTIFICATIONS', 'MANAGE')
  @RequiresActiveSubscription()
  adminCreateRule(@CurrentUser() user: MvpUser, @Body() dto: UpsertReminderRuleDto) {
    return this.remindersService.adminCreateRule(user, dto);
  }

  @Patch('admin/reminder-rules/:id')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('NOTIFICATIONS', 'MANAGE')
  @RequiresActiveSubscription()
  adminUpdateRule(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() dto: Partial<UpsertReminderRuleDto>) {
    return this.remindersService.adminUpdateRule(user, id, dto);
  }

  @Delete('admin/reminder-rules/:id')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('NOTIFICATIONS', 'MANAGE')
  @RequiresActiveSubscription()
  adminDeleteRule(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.remindersService.adminDeleteRule(user, id);
  }

  @Get('admin/reminder-logs')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('NOTIFICATIONS', 'VIEW')
  @AllowsPastDue()
  adminListLogs(@CurrentUser() user: MvpUser) {
    return this.remindersService.adminListLogs(user);
  }

  @Patch('admin/apartments/:id/reminder-settings')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('NOTIFICATIONS', 'MANAGE')
  @RequiresActiveSubscription()
  adminUpdateApartmentSettings(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() dto: UpdateApartmentReminderSettingsDto,
  ) {
    return this.remindersService.adminUpdateApartmentSettings(user, id, dto);
  }

  @Get('superadmin/reminder-overview')
  @Roles(Role.SUPERADMIN)
  superadminOverview(@CurrentUser() user: MvpUser) {
    return this.remindersService.superadminOverview(user);
  }
}
