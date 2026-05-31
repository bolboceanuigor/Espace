import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { AuditService } from '../audit/audit.service';
import { ActivityMvpService } from './activity-mvp.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
export class ActivityMvpController {
  constructor(
    private readonly activityService: ActivityMvpService,
    private readonly auditService: AuditService,
  ) {}

  @Get(['admin/activity', 'api/admin/activity', 'api/activity'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  listAdminActivity(@CurrentUser() user: MvpUser, @Query('limit') limit?: string) {
    return this.activityService.listAdminActivity(user, limit);
  }

  @Get(['superadmin/activity', 'api/superadmin/activity'])
  @Roles(Role.SUPERADMIN)
  listSuperadminActivity(@Query() query: Record<string, string | undefined>) {
    return this.auditService.listSuperadminActivity(query);
  }

  @Get(['resident/notifications', 'api/resident/notifications'])
  @Roles(Role.RESIDENT)
  listResidentNotifications(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.activityService.listResidentNotifications(user, query);
  }

  @Get(['resident/notifications/unread-count', 'api/resident/notifications/unread-count'])
  @Roles(Role.RESIDENT)
  getResidentUnreadCount(@CurrentUser() user: MvpUser) {
    return this.activityService.getResidentUnreadCount(user);
  }

  @Patch(['resident/notifications/:id/read', 'api/resident/notifications/:id/read'])
  @Roles(Role.RESIDENT)
  markResidentNotificationRead(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.activityService.markResidentNotificationRead(user, id);
  }

  @Patch(['resident/notifications/read-all', 'api/resident/notifications/read-all'])
  @Roles(Role.RESIDENT)
  markResidentNotificationsReadAll(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.activityService.markResidentNotificationsReadAll(user, body);
  }

  @Get(['admin/notifications', 'api/admin/notifications'])
  @Roles(Role.ADMIN)
  listAdminNotifications(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.activityService.listAdminNotifications(user, query);
  }

  @Get(['admin/notifications/unread-count', 'api/admin/notifications/unread-count'])
  @Roles(Role.ADMIN)
  getAdminUnreadCount(@CurrentUser() user: MvpUser) {
    return this.activityService.getAdminUnreadCount(user);
  }

  @Patch(['admin/notifications/:id/read', 'api/admin/notifications/:id/read'])
  @Roles(Role.ADMIN)
  markAdminNotificationRead(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.activityService.markAdminNotificationRead(user, id);
  }

  @Patch(['admin/notifications/read-all', 'api/admin/notifications/read-all'])
  @Roles(Role.ADMIN)
  markAdminNotificationsReadAll(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.activityService.markAdminNotificationsReadAll(user, body);
  }
}
