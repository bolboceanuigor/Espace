import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard } from '../security/mvp-auth.guard';
import { SaasUsageService } from './saas-usage.service';

@Controller('api')
export class SaasUsageController {
  constructor(private readonly usage: SaasUsageService) {}

  @Get('admin/subscription')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  async adminSubscription(@Req() request: any) {
    return this.usage.adminSubscriptionSummary(request.user.organizationId);
  }

  @Get('admin/subscription/usage')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  async adminUsage(@Req() request: any, @Query('billingMonth') billingMonth?: string) {
    return this.usage.getAssociationUsage(request.user.organizationId, billingMonth);
  }

  @Get('admin/subscription/limits')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  async adminLimits(@Req() request: any) {
    return this.usage.getPlanLimitSummary(request.user.organizationId);
  }

  @Get('admin/subscription/features')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  async adminFeatures(@Req() request: any) {
    return { features: await this.usage.getFeatureAvailability(request.user.organizationId) };
  }

  @Get('admin/subscription/warnings')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  async adminWarnings(@Req() request: any) {
    const data = await this.usage.getAssociationUsage(request.user.organizationId);
    return { warnings: data.warnings, usageSummary: data.usageSummary };
  }

  @Get('superadmin/billing/usage')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminUsage(@Query() query: Record<string, unknown>) {
    return this.usage.superadminUsageOverview(query);
  }

  @Get('superadmin/billing/usage/associations')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminAssociationUsage(@Query() query: Record<string, unknown>) {
    return this.usage.superadminAssociationUsageRows(query);
  }

  @Get('superadmin/billing/subscriptions/:id/usage')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminSubscriptionUsage(@Param('id') id: string) {
    return this.usage.getUsageForSubscription(id);
  }

  @Get('superadmin/associations/:id/usage')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminSingleAssociationUsage(@Param('id') id: string) {
    return this.usage.getAssociationUsage(id);
  }
}
