import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { ActivityMvpService } from './activity-mvp.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
export class ActivityMvpController {
  constructor(private readonly activityService: ActivityMvpService) {}

  @Get(['admin/activity', 'api/admin/activity', 'api/activity'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  listAdminActivity(@CurrentUser() user: MvpUser, @Query('limit') limit?: string) {
    return this.activityService.listAdminActivity(user, limit);
  }

  @Get(['superadmin/activity', 'api/superadmin/activity'])
  @Roles(Role.SUPERADMIN)
  listSuperadminActivity(@Query('limit') limit?: string) {
    return this.activityService.listSuperadminActivity(limit);
  }

  @Get(['resident/notifications', 'api/resident/notifications'])
  @Roles(Role.RESIDENT)
  listResidentNotifications(@CurrentUser() user: MvpUser) {
    return this.activityService.listResidentNotifications(user);
  }

  @Patch(['resident/notifications/:id/read', 'api/resident/notifications/:id/read'])
  @Roles(Role.RESIDENT)
  markResidentNotificationRead(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.activityService.markResidentNotificationRead(user, id);
  }

  @Patch(['resident/notifications/read-all', 'api/resident/notifications/read-all'])
  @Roles(Role.RESIDENT)
  markResidentNotificationsReadAll(@CurrentUser() user: MvpUser) {
    return this.activityService.markResidentNotificationsReadAll(user);
  }
}
