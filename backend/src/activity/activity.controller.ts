import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActivityService } from './activity.service';
import type { Request } from 'express';
import { getOrgScope, getRequestedOrgId } from '../common/org-scope';

@Controller('api/activity')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('entityType') entityType?: string,
    @Query('userId') userId?: string,
    @Req() req?: Request,
  ) {
    const organizationId = getOrgScope(user, req ? getRequestedOrgId(req) : undefined);
    return this.activityService.list(organizationId, {
      limit: limit ? Number(limit) : undefined,
      entityType,
      userId,
    });
  }
}
