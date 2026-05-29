import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { SaasLimitEnforcementService } from '../saas-usage/saas-limit-enforcement.service';
import { MetersService } from './meters.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
export class MetersController {
  constructor(
    private readonly metersService: MetersService,
    private readonly saasLimits: SaasLimitEnforcementService,
  ) {}

  @Get(['meters', 'api/meters'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METERS', 'VIEW')
  listMeters(@CurrentUser() user: MvpUser) {
    return this.metersService.listMeters(user);
  }

  @Post(['meters', 'api/meters'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METERS', 'MANAGE')
  async createMeter(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    await this.saasLimits.assertCanCreateMeter(user.organizationId, user);
    return this.metersService.createMeter(user, body);
  }

  @Post(['meters/:meterId/readings', 'api/meters/:meterId/readings'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'CREATE')
  async addReading(@CurrentUser() user: MvpUser, @Param('meterId') meterId: string, @Body() body: unknown) {
    await this.saasLimits.assertFeatureEnabled(user.organizationId, 'meterReadings', user);
    return this.metersService.addReading(user, meterId, body);
  }

  @Get(['meters/:id', 'api/meters/:id'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METERS', 'VIEW')
  getMeter(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.metersService.getMeter(user, id);
  }

  @Get(['admin/meters', 'api/admin/meters'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METERS', 'VIEW')
  listAdminMeters(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.listAdminMeters(user, query);
  }

  @Post(['admin/meters', 'api/admin/meters'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METERS', 'MANAGE')
  async createAdminMeter(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    await this.saasLimits.assertCanCreateMeter(user.organizationId, user);
    return this.metersService.createMeter(user, body);
  }

  @Get(['admin/meters/:id', 'api/admin/meters/:id'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METERS', 'VIEW')
  getAdminMeter(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.metersService.getMeter(user, id);
  }

  @Patch(['admin/meters/:id', 'api/admin/meters/:id'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METERS', 'MANAGE')
  async updateAdminMeter(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.metersService.updateMeter(user, id, body);
  }

  @Patch(['admin/meters/:id/status', 'api/admin/meters/:id/status'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METERS', 'MANAGE')
  async changeAdminMeterStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.metersService.changeMeterStatus(user, id, body);
  }

  @Get(['admin/meter-readings/stats', 'api/admin/meter-readings/stats'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'VIEW')
  getReadingStats(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.getReadingStats(user, query);
  }

  @Get(['admin/meter-readings/reports/consumption', 'api/admin/meter-readings/reports/consumption'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('REPORTS', 'VIEW')
  getConsumptionReport(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.getConsumptionReport(user, query);
  }

  @Get(['admin/meter-readings/reports/summary', 'api/admin/meter-readings/reports/summary'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('REPORTS', 'VIEW')
  getConsumptionSummary(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.getConsumptionSummary(user, query);
  }

  @Get(['admin/meter-readings/reports/by-meter-type', 'api/admin/meter-readings/reports/by-meter-type'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('REPORTS', 'VIEW')
  getConsumptionByMeterType(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.getConsumptionByMeterType(user, query);
  }

  @Get(['admin/meter-readings/reports/by-staircase', 'api/admin/meter-readings/reports/by-staircase'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('REPORTS', 'VIEW')
  getConsumptionByStaircase(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.getConsumptionByStaircase(user, query);
  }

  @Get(['admin/meter-readings/reports/by-apartment', 'api/admin/meter-readings/reports/by-apartment'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('REPORTS', 'VIEW')
  getConsumptionByApartment(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.getConsumptionByApartment(user, query);
  }

  @Get(['admin/meter-readings/reports/missing', 'api/admin/meter-readings/reports/missing'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('REPORTS', 'VIEW')
  getMissingReadingsReport(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.getMissingReadingsReport(user, query);
  }

  @Get(['admin/meter-readings/reports/issues', 'api/admin/meter-readings/reports/issues'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('REPORTS', 'VIEW')
  getReadingIssuesReport(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.getReadingIssuesReport(user, query);
  }

  @Get(['admin/meter-readings/reports/trends', 'api/admin/meter-readings/reports/trends'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('REPORTS', 'VIEW')
  getConsumptionTrends(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.getConsumptionTrends(user, query);
  }

  @Get(['admin/meter-readings/reports/top-consumption', 'api/admin/meter-readings/reports/top-consumption'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('REPORTS', 'VIEW')
  getTopConsumption(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.getTopConsumption(user, query);
  }

  @Get(['admin/meter-readings/periods', 'api/admin/meter-readings/periods'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'VIEW')
  listReadingPeriods(@CurrentUser() user: MvpUser) {
    return this.metersService.listReadingPeriods(user);
  }

  @Post(['admin/meter-readings/periods', 'api/admin/meter-readings/periods'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'CREATE')
  async createReadingPeriod(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    await this.saasLimits.assertFeatureEnabled(user.organizationId, 'meterReadings', user);
    return this.metersService.createReadingPeriod(user, body);
  }

  @Get(['admin/meter-readings/periods/:id/overview', 'api/admin/meter-readings/periods/:id/overview'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'VIEW')
  getReadingPeriodOverview(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.metersService.getReadingPeriodOverview(user, id);
  }

  @Get(['admin/meter-readings/periods/:id/workspace', 'api/admin/meter-readings/periods/:id/workspace'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'VIEW')
  getReadingPeriodWorkspace(@CurrentUser() user: MvpUser, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.metersService.getReadingPeriodWorkspace(user, id, query);
  }

  @Put(['admin/meter-readings/periods/:periodId/meters/:meterId', 'api/admin/meter-readings/periods/:periodId/meters/:meterId'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'CREATE')
  async saveReadingForPeriod(
    @CurrentUser() user: MvpUser,
    @Param('periodId') periodId: string,
    @Param('meterId') meterId: string,
    @Body() body: unknown,
  ) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.metersService.saveReadingForPeriod(user, periodId, meterId, body);
  }

  @Post(['admin/meter-readings/periods/:periodId/bulk-save', 'api/admin/meter-readings/periods/:periodId/bulk-save'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'CREATE')
  async bulkSaveReadingsForPeriod(@CurrentUser() user: MvpUser, @Param('periodId') periodId: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.metersService.bulkSaveReadingsForPeriod(user, periodId, body);
  }

  @Get(['admin/meter-readings/periods/:periodId/issues', 'api/admin/meter-readings/periods/:periodId/issues'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'VIEW')
  getReadingPeriodIssues(@CurrentUser() user: MvpUser, @Param('periodId') periodId: string, @Query() query: Record<string, unknown>) {
    return this.metersService.getReadingPeriodIssues(user, periodId, query);
  }

  @Post(['admin/meter-readings/periods/:periodId/recalculate', 'api/admin/meter-readings/periods/:periodId/recalculate'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'VIEW')
  recalculateReadingPeriod(@CurrentUser() user: MvpUser, @Param('periodId') periodId: string) {
    return this.metersService.recalculateReadingPeriod(user, periodId);
  }

  @Post(['admin/meter-readings/periods/:periodId/lock', 'api/admin/meter-readings/periods/:periodId/lock'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'APPROVE')
  async lockReadingPeriod(@CurrentUser() user: MvpUser, @Param('periodId') periodId: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.metersService.lockReadingPeriod(user, periodId, body);
  }

  @Post(['admin/meter-readings/periods/:periodId/unlock', 'api/admin/meter-readings/periods/:periodId/unlock'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'APPROVE')
  async unlockReadingPeriod(@CurrentUser() user: MvpUser, @Param('periodId') periodId: string) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.metersService.unlockReadingPeriod(user, periodId);
  }

  @Get(['admin/meter-readings', 'api/admin/meter-readings'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'VIEW')
  listAdminReadings(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.listAdminReadings(user, query);
  }

  @Post(['admin/meter-readings', 'api/admin/meter-readings'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'CREATE')
  async createAdminReading(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    await this.saasLimits.assertFeatureEnabled(user.organizationId, 'meterReadings', user);
    return this.metersService.createAdminReading(user, body);
  }

  @Get(['admin/meter-readings/:id', 'api/admin/meter-readings/:id'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'VIEW')
  getAdminReading(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.metersService.getAdminReading(user, id);
  }

  @Patch(['admin/meter-readings/:id/approve', 'api/admin/meter-readings/:id/approve'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'APPROVE')
  async approveReading(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.metersService.approveReading(user, id, body);
  }

  @Patch(['admin/meter-readings/:id/reject', 'api/admin/meter-readings/:id/reject'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'APPROVE')
  async rejectReading(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.metersService.rejectReading(user, id, body);
  }

  @Patch(['admin/meter-readings/:id/needs-review', 'api/admin/meter-readings/:id/needs-review'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'APPROVE')
  async markReadingNeedsReview(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.metersService.markReadingNeedsReview(user, id, body);
  }

  @Get(['admin/apartments/:id/meters', 'api/admin/apartments/:id/meters'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METERS', 'VIEW')
  listApartmentMeters(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.metersService.listApartmentMeters(user, id);
  }

  @Get(['admin/apartments/:id/meter-readings', 'api/admin/apartments/:id/meter-readings'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @RequirePermission('METER_READINGS', 'VIEW')
  listApartmentReadings(@CurrentUser() user: MvpUser, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.metersService.listApartmentReadings(user, id, query);
  }
}
