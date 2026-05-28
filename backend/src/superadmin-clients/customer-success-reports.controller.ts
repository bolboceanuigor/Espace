import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CustomerSuccessAnalyticsService } from './customer-success-analytics.service';
import { ExportCustomerReportDto, SaveCustomerReportDto, SaveMetricSnapshotDto, UpdateSavedCustomerReportDto } from './dto/customer-success-reports.dto';

@Controller('api/superadmin/customer-success/reports')
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class CustomerSuccessReportsController {
  constructor(private readonly service: CustomerSuccessAnalyticsService) {}

  @Get('overview')
  overview(@Query() query: Record<string, string | undefined>) {
    return this.service.overview(query);
  }

  @Get('portfolio')
  portfolio(@Query() query: Record<string, string | undefined>) {
    return this.service.getPortfolioOverview(query);
  }

  @Get('health')
  health(@Query() query: Record<string, string | undefined>) {
    return this.service.getHealthDistribution(query);
  }

  @Get('health/trends')
  healthTrends(@Query() query: Record<string, string | undefined>) {
    return this.service.getHealthTrends(query);
  }

  @Get('onboarding')
  onboarding(@Query() query: Record<string, string | undefined>) {
    return this.service.getOnboardingReport(query);
  }

  @Get('revenue')
  revenue(@Query() query: Record<string, string | undefined>) {
    return this.service.getRevenueEstimate(query);
  }

  @Get('saas-invoices')
  saasInvoices(@Query() query: Record<string, string | undefined>) {
    return this.service.getSaasInvoicesReport(query);
  }

  @Get('follow-ups')
  followUps(@Query() query: Record<string, string | undefined>) {
    return this.service.getFollowUpPerformance(query);
  }

  @Get('tasks')
  tasks(@Query() query: Record<string, string | undefined>) {
    return this.service.getTaskPerformance(query);
  }

  @Get('playbooks')
  playbooks(@Query() query: Record<string, string | undefined>) {
    return this.service.getPlaybookPerformance(query);
  }

  @Get('usage')
  usage(@Query() query: Record<string, string | undefined>) {
    return this.service.getUsageByPlan(query);
  }

  @Get('churn-risk')
  churnRisk(@Query() query: Record<string, string | undefined>) {
    return this.service.getChurnRiskReport(query);
  }

  @Get('owner-performance')
  ownerPerformance(@Query() query: Record<string, string | undefined>) {
    return this.service.getOwnerPerformance(query);
  }

  @Post('snapshots')
  saveSnapshot(@Body() dto: SaveMetricSnapshotDto, @CurrentUser() user: any) {
    return this.service.saveSnapshot(dto, user);
  }

  @Get('snapshots')
  snapshots(@Query() query: Record<string, string | undefined>) {
    return this.service.snapshots(query);
  }

  @Get('snapshots/:id')
  snapshot(@Param('id') id: string) {
    return this.service.snapshot(id);
  }

  @Get('saved')
  savedReports(@Query() query: Record<string, string | undefined>) {
    return this.service.savedReports(query);
  }

  @Post('saved')
  createSavedReport(@Body() dto: SaveCustomerReportDto, @CurrentUser() user: any) {
    return this.service.createSavedReport(dto, user);
  }

  @Get('saved/:id')
  savedReport(@Param('id') id: string) {
    return this.service.savedReport(id);
  }

  @Patch('saved/:id')
  updateSavedReport(@Param('id') id: string, @Body() dto: UpdateSavedCustomerReportDto, @CurrentUser() user: any) {
    return this.service.updateSavedReport(id, dto, user);
  }

  @Patch('saved/:id/archive')
  archiveSavedReport(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.archiveSavedReport(id, user);
  }

  @Patch('saved/:id/favorite')
  favoriteSavedReport(@Param('id') id: string, @Body() body: { isFavorite?: boolean }, @CurrentUser() user: any) {
    return this.service.favoriteSavedReport(id, body.isFavorite !== false, user);
  }

  @Post('export')
  exportReport(@Body() dto: ExportCustomerReportDto, @CurrentUser() user: any) {
    return this.service.createExport(dto, user);
  }

  @Get('exports')
  exports(@Query() query: Record<string, string | undefined>) {
    return this.service.exports(query);
  }

  @Get('exports/:id')
  exportRecord(@Param('id') id: string) {
    return this.service.exportRecord(id);
  }

  @Get('exports/:id/download')
  async downloadExport(@Param('id') id: string, @Res() res: Response) {
    const payload = await this.service.downloadExport(id);
    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    res.send(payload.content);
  }
}
