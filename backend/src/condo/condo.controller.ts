import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { getOrgId } from '../common/org-scope';
import { CondoService } from './condo.service';
import { CreateAnnualSummaryDto } from './dto/create-annual-summary.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Controller('api/condo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CondoController {
  constructor(private readonly condoService: CondoService) {}

  @Get('owner-dashboard')
  @Roles(Role.RESIDENT, Role.ADMIN, Role.SUPERADMIN)
  getOwnerDashboard(@CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgId(user, req);
    const userId = user?.id ?? user?.sub;
    return this.condoService.getOwnerDashboard(organizationId, userId, user.role);
  }

  @Get('annual-summaries')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  listAnnualSummaries(@CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgId(user, req);
    return this.condoService.listAnnualSummaries(organizationId, user.role);
  }

  @Post('annual-summaries')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  createAnnualSummary(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Body() dto: CreateAnnualSummaryDto,
  ) {
    const organizationId = getOrgId(user, req);
    const userId = user?.id ?? user?.sub;
    return this.condoService.createAnnualSummary(organizationId, userId, user.role, dto);
  }

  @Patch('annual-summaries/:id/publish')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  publishAnnualSummary(@CurrentUser() user: any, @Req() req: Request, @Param('id') id: string) {
    const organizationId = getOrgId(user, req);
    return this.condoService.publishAnnualSummary(organizationId, user.role, id);
  }

  @Get('announcements')
  @Roles(Role.RESIDENT, Role.ADMIN, Role.SUPERADMIN)
  listAnnouncements(@CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgId(user, req);
    return this.condoService.listAnnouncements(organizationId);
  }

  @Post('announcements')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  createAnnouncement(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Body() dto: CreateAnnouncementDto,
  ) {
    const organizationId = getOrgId(user, req);
    const userId = user?.id ?? user?.sub;
    return this.condoService.createAnnouncement(organizationId, userId, user.role, dto);
  }
}
