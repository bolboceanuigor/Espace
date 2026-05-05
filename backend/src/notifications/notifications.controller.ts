import { Body, Controller, Get, Patch, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AdminNotificationFiltersDto,
  AdminTestNotificationDto,
  UpdateEmailIntegrationDto,
  UpdateNotificationPreferencesDto,
  UpdateSmsIntegrationDto,
  UpdateTelegramIntegrationDto,
  SubscribePushDto,
} from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('api')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('admin/notifications')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminList(@CurrentUser() user: any, @Query() query: AdminNotificationFiltersDto) {
    return this.notificationsService.adminList(user, query);
  }

  @Post('admin/notifications/test')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminTest(@CurrentUser() user: any, @Body() body: AdminTestNotificationDto) {
    return this.notificationsService.adminSendTest(user, body);
  }

  @Get('admin/integrations')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminIntegrations(@CurrentUser() user: any) {
    return this.notificationsService.getIntegrations(user);
  }

  @Patch('admin/integrations/email')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  updateEmail(@CurrentUser() user: any, @Body() body: UpdateEmailIntegrationDto) {
    return this.notificationsService.updateEmailIntegration(user, body);
  }

  @Patch('admin/integrations/telegram')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  updateTelegram(@CurrentUser() user: any, @Body() body: UpdateTelegramIntegrationDto) {
    return this.notificationsService.updateTelegramIntegration(user, body);
  }

  @Patch('admin/integrations/sms')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  updateSms(@CurrentUser() user: any, @Body() body: UpdateSmsIntegrationDto) {
    return this.notificationsService.updateSmsIntegration(user, body);
  }

  @Get('resident/notifications')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentList(@CurrentUser() user: any) {
    return this.notificationsService.residentList(user);
  }

  @Patch('resident/notifications/:id/read')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationsService.residentMarkRead(user, id);
  }

  @Patch('resident/notifications/read-all')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentReadAll(@CurrentUser() user: any) {
    return this.notificationsService.residentMarkAllRead(user);
  }

  @Get('resident/notification-preferences')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentPrefs(@CurrentUser() user: any) {
    return this.notificationsService.getResidentPreferences(user);
  }

  @Patch('resident/notification-preferences')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  updateResidentPrefs(@CurrentUser() user: any, @Body() body: UpdateNotificationPreferencesDto) {
    return this.notificationsService.updateResidentPreferences(user, body);
  }

  @Post('resident/notification-preferences/telegram-connect-token')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  telegramToken(@CurrentUser() user: any) {
    return this.notificationsService.createTelegramLinkToken(user);
  }

  @Post('notifications/push/subscribe')
  subscribePush(@CurrentUser() user: any, @Body() body: SubscribePushDto, @Req() req: any) {
    return this.notificationsService.subscribePush(user, body, req?.headers?.['user-agent']);
  }

  @Patch('notifications/push/:id/disable')
  disablePush(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationsService.disablePush(user, id);
  }

  @Get('notifications/push/status')
  pushStatus(@CurrentUser() user: any) {
    return this.notificationsService.pushStatus(user);
  }

  @Public()
  @Post('integrations/telegram/webhook')
  telegramWebhook(@Body() body: any) {
    return this.notificationsService.handleTelegramWebhook(body);
  }
}

