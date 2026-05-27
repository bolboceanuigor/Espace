import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard } from '../security/mvp-auth.guard';
import { SaasUpgradesService } from './saas-upgrades.service';

@Controller('api')
export class SaasUpgradesController {
  constructor(private readonly service: SaasUpgradesService) {}

  @Get('admin/subscription/upgrade-options')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  adminOptions(@Req() request: any) {
    return this.service.adminUpgradeOptions(request.user);
  }

  @Post('admin/subscription/upgrade-requests')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  adminCreate(@Req() request: any, @Body() body: unknown) {
    return this.service.adminCreate(request.user, body);
  }

  @Get('admin/subscription/upgrade-requests')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  adminList(@Req() request: any) {
    return this.service.adminList(request.user);
  }

  @Get('admin/subscription/upgrade-requests/:id')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  adminGet(@Req() request: any, @Param('id') id: string) {
    return this.service.adminGet(request.user, id);
  }

  @Patch('admin/subscription/upgrade-requests/:id/cancel')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  adminCancel(@Req() request: any, @Param('id') id: string, @Body() body: unknown) {
    return this.service.adminCancel(request.user, id, body);
  }

  @Get('superadmin/billing/upgrade-requests')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminList(@Query() query: Record<string, unknown>) {
    return this.service.superadminList(query);
  }

  @Get('superadmin/billing/upgrade-requests/stats')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminStats() {
    return this.service.superadminStats();
  }

  @Get('superadmin/billing/upgrade-requests/:id')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminGet(@Param('id') id: string) {
    return this.service.superadminGet(id);
  }

  @Patch('superadmin/billing/upgrade-requests/:id/in-review')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  markInReview(@Req() request: any, @Param('id') id: string) {
    return this.service.markInReview(request.user, id);
  }

  @Patch('superadmin/billing/upgrade-requests/:id/approve')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  approve(@Req() request: any, @Param('id') id: string, @Body() body: unknown) {
    return this.service.approve(request.user, id, body);
  }

  @Patch('superadmin/billing/upgrade-requests/:id/reject')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  reject(@Req() request: any, @Param('id') id: string, @Body() body: unknown) {
    return this.service.reject(request.user, id, body);
  }

  @Get('superadmin/associations/:id/upgrade-requests')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  associationRequests(@Param('id') id: string) {
    return this.service.superadminAssociationRequests(id);
  }
}
