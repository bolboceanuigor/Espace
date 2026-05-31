import { Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SuperadminNotificationsService } from './superadmin-notifications.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminNotificationsController {
  constructor(private readonly service: SuperadminNotificationsService) {}

  @Get(['api/superadmin/notifications', 'superadmin/notifications'])
  list(@CurrentUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.service.list(user, query);
  }

  @Get(['api/superadmin/notifications/summary', 'superadmin/notifications/summary'])
  summary(@CurrentUser() user: any) {
    return this.service.summary(user);
  }

  @Patch(['api/superadmin/notifications/read-all', 'superadmin/notifications/read-all'])
  readAll(@CurrentUser() user: any) {
    return this.service.markAllRead(user);
  }

  @Patch(['api/superadmin/notifications/:id/read', 'superadmin/notifications/:id/read'])
  read(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.markRead(user, id);
  }

  @Patch(['api/superadmin/notifications/:id/archive', 'superadmin/notifications/:id/archive'])
  archive(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.archive(user, id);
  }

  @Post(['api/superadmin/notifications/generate', 'superadmin/notifications/generate'])
  generate(@CurrentUser() user: any) {
    return this.service.generate(user);
  }
}
