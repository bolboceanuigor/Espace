import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { UpdateApartmentReminderSettingsDto, UpsertReminderRuleDto } from './dto/reminders.dto';
import { RemindersService } from './reminders.service';

@Controller('api')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('admin/reminder-rules')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminListRules(@CurrentUser() user: any) {
    return this.remindersService.adminListRules(user);
  }

  @Post('admin/reminder-rules')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminCreateRule(@CurrentUser() user: any, @Body() dto: UpsertReminderRuleDto) {
    return this.remindersService.adminCreateRule(user, dto);
  }

  @Patch('admin/reminder-rules/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminUpdateRule(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: Partial<UpsertReminderRuleDto>) {
    return this.remindersService.adminUpdateRule(user, id, dto);
  }

  @Delete('admin/reminder-rules/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminDeleteRule(@CurrentUser() user: any, @Param('id') id: string) {
    return this.remindersService.adminDeleteRule(user, id);
  }

  @Get('admin/reminder-logs')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminListLogs(@CurrentUser() user: any) {
    return this.remindersService.adminListLogs(user);
  }

  @Patch('admin/apartments/:id/reminder-settings')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminUpdateApartmentSettings(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateApartmentReminderSettingsDto,
  ) {
    return this.remindersService.adminUpdateApartmentSettings(user, id, dto);
  }

  @Get('superadmin/reminder-overview')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  superadminOverview(@CurrentUser() user: any) {
    return this.remindersService.superadminOverview(user);
  }
}

