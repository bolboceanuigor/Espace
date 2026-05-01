import { ForbiddenException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { getOrgId } from '../common/org-scope';
import { ManagerService } from './manager.service';
import { ManagerOverviewQueryDto } from './dto/manager-overview-query.dto';

@Controller('api/manager')
@UseGuards(RolesGuard)
@Roles(Role.MANAGER)
export class ManagerController {
  constructor(private readonly managerService: ManagerService) {}

  @Get('overview')
  getOverview(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Query() query: ManagerOverviewQueryDto,
  ) {
    const organizationId = getOrgId(user, req);
    const userId = user?.id ?? user?.sub;
    if (!userId) {
      throw new ForbiddenException('User context missing');
    }
    return this.managerService.getOverview({
      organizationId,
      userId,
      role: user.role,
      date: query.date || new Date().toISOString().slice(0, 10),
      days: query.days ?? 7,
    });
  }
}
