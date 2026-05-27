import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { SaasLimitEnforcementService } from '../saas-usage/saas-limit-enforcement.service';
import { BillingReadService } from './billing-read.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class BillingReadController {
  constructor(
    private readonly billingReadService: BillingReadService,
    private readonly saasLimits: SaasLimitEnforcementService,
  ) {}

  private sendCsv(res: Response, payload: { csv: string; fileName: string }) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    res.send(payload.csv);
  }

  @Get(['invoices', 'api/invoices'])
  listInvoices(@CurrentUser() user: MvpUser) {
    return this.billingReadService.listInvoices(user);
  }

  @Get(['admin/audit-log/stats', 'api/admin/audit-log/stats'])
  @RequirePermission('AUDIT_LOG', 'VIEW')
  getAdminAuditLogStats(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminAuditLogStats(user, query);
  }

  @Get(['admin/audit-log', 'api/admin/audit-log'])
  @RequirePermission('AUDIT_LOG', 'VIEW')
  listAdminAuditLog(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.listAdminAuditLog(user, query);
  }

  @Get(['admin/audit-log/:id', 'api/admin/audit-log/:id'])
  @RequirePermission('AUDIT_LOG', 'VIEW')
  getAdminAuditLog(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getAdminAuditLog(user, id);
  }

  @Get(['admin/reports', 'api/admin/reports'])
  @RequirePermission('REPORTS', 'VIEW')
  getAdminReportsSummary(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminReportsSummary(user, query);
  }

  @Get(['admin/reports/financial/overview', 'api/admin/reports/financial/overview'])
  @RequirePermission('REPORTS', 'VIEW')
  getAdminFinancialOverview(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminFinancialOverview(user, query);
  }

  @Get(['admin/reports/financial/status-breakdown', 'api/admin/reports/financial/status-breakdown'])
  @RequirePermission('REPORTS', 'VIEW')
  getAdminFinancialStatusBreakdown(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminFinancialStatusBreakdown(user, query);
  }

  @Get(['admin/reports/financial/monthly-trend', 'api/admin/reports/financial/monthly-trend'])
  @RequirePermission('REPORTS', 'VIEW')
  getAdminFinancialMonthlyTrend(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminFinancialMonthlyTrend(user, query);
  }

  @Get(['admin/reports/financial/apartments', 'api/admin/reports/financial/apartments'])
  @RequirePermission('REPORTS', 'VIEW')
  getAdminFinancialApartments(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminFinancialApartments(user, query);
  }

  @Get(['admin/reports/financial/aging', 'api/admin/reports/financial/aging'])
  @RequirePermission('REPORTS', 'VIEW')
  getAdminFinancialAging(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminFinancialAging(user, query);
  }

  @Get(['admin/reports/financial/recent-invoices', 'api/admin/reports/financial/recent-invoices'])
  @RequirePermission('REPORTS', 'VIEW')
  getAdminFinancialRecentInvoices(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminFinancialRecentInvoices(user, query);
  }

  @Get(['admin/reports/financial/recent-payments', 'api/admin/reports/financial/recent-payments'])
  @RequirePermission('REPORTS', 'VIEW')
  getAdminFinancialRecentPayments(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminFinancialRecentPayments(user, query);
  }

  @Get(['admin/exports/invoices.csv', 'api/admin/exports/invoices.csv'])
  @RequirePermission('EXPORTS', 'EXPORT')
  async exportAdminInvoicesCsv(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>, @Res() res: Response) {
    await this.saasLimits.assertCanExportCsv(user.organizationId, 'invoices', user);
    this.sendCsv(res, await this.billingReadService.exportAdminInvoicesCsv(user, query));
  }

  @Get(['admin/exports/payments.csv', 'api/admin/exports/payments.csv'])
  @RequirePermission('EXPORTS', 'EXPORT')
  async exportAdminPaymentsCsv(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>, @Res() res: Response) {
    await this.saasLimits.assertCanExportCsv(user.organizationId, 'payments', user);
    this.sendCsv(res, await this.billingReadService.exportAdminPaymentsCsv(user, query));
  }

  @Get(['admin/exports/apartment-balances.csv', 'api/admin/exports/apartment-balances.csv'])
  @RequirePermission('EXPORTS', 'EXPORT')
  async exportAdminApartmentBalancesCsv(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>, @Res() res: Response) {
    await this.saasLimits.assertCanExportCsv(user.organizationId, 'balances', user);
    this.sendCsv(res, await this.billingReadService.exportAdminApartmentBalancesCsv(user, query));
  }

  @Get(['admin/exports/financial-monthly.csv', 'api/admin/exports/financial-monthly.csv'])
  @RequirePermission('EXPORTS', 'EXPORT')
  async exportAdminFinancialMonthlyCsv(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>, @Res() res: Response) {
    await this.saasLimits.assertCanExportCsv(user.organizationId, 'financial', user);
    this.sendCsv(res, await this.billingReadService.exportAdminFinancialMonthlyCsv(user, query));
  }

  @Get(['admin/exports/aging.csv', 'api/admin/exports/aging.csv'])
  @RequirePermission('EXPORTS', 'EXPORT')
  async exportAdminAgingCsv(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>, @Res() res: Response) {
    await this.saasLimits.assertCanExportCsv(user.organizationId, 'aging', user);
    this.sendCsv(res, await this.billingReadService.exportAdminAgingCsv(user, query));
  }

  @Get(['admin/exports/meter-consumption.csv', 'api/admin/exports/meter-consumption.csv'])
  @RequirePermission('EXPORTS', 'EXPORT')
  async exportAdminMeterConsumptionCsv(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>, @Res() res: Response) {
    await this.saasLimits.assertCanExportCsv(user.organizationId, 'meter-consumption', user);
    this.sendCsv(res, await this.billingReadService.exportAdminMeterConsumptionCsv(user, query));
  }

  @Get(['admin/exports/apartments.csv', 'api/admin/exports/apartments.csv'])
  @RequirePermission('EXPORTS', 'EXPORT')
  async exportAdminApartmentsCsv(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>, @Res() res: Response) {
    await this.saasLimits.assertCanExportCsv(user.organizationId, 'apartments', user);
    this.sendCsv(res, await this.billingReadService.exportAdminApartmentsCsv(user, query));
  }

  @Get(['admin/exports/residents.csv', 'api/admin/exports/residents.csv'])
  @RequirePermission('EXPORTS', 'EXPORT')
  async exportAdminResidentsCsv(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>, @Res() res: Response) {
    await this.saasLimits.assertCanExportCsv(user.organizationId, 'residents', user);
    this.sendCsv(res, await this.billingReadService.exportAdminResidentsCsv(user, query));
  }

  @Get(['admin/exports/history', 'api/admin/exports/history'])
  @RequirePermission('EXPORTS', 'VIEW')
  getAdminExportHistory(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminExportHistory(user, query);
  }

  @Get(['admin/exports/options', 'api/admin/exports/options'])
  @RequirePermission('EXPORTS', 'VIEW')
  getAdminExportOptions(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminExportOptions(user, query);
  }

  @Get(['admin/billing', 'api/admin/billing'])
  @RequirePermission('BILLING', 'VIEW')
  getBillingOverview(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getBillingOverview(user, query);
  }

  @Get(['admin/billing/runs', 'api/admin/billing/runs'])
  @RequirePermission('BILLING', 'VIEW')
  listBillingRuns(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.listBillingRuns(user, query);
  }

  @Post(['admin/billing/runs', 'api/admin/billing/runs'])
  @RequirePermission('BILLING', 'MANAGE')
  createBillingRun(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.createBillingRun(user, body);
  }

  @Get(['admin/billing/runs/:id/activity/recent', 'api/admin/billing/runs/:id/activity/recent'])
  @RequirePermission('BILLING', 'VIEW')
  getBillingRunActivityRecent(@CurrentUser() user: MvpUser, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getBillingRunActivity(user, id, query, 5);
  }

  @Get(['admin/billing/runs/:id/activity', 'api/admin/billing/runs/:id/activity'])
  @RequirePermission('BILLING', 'VIEW')
  getBillingRunActivity(@CurrentUser() user: MvpUser, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getBillingRunActivity(user, id, query);
  }

  @Get(['admin/billing/runs/:id/checks', 'api/admin/billing/runs/:id/checks'])
  @RequirePermission('BILLING', 'VIEW')
  getBillingRunChecks(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getBillingRunChecks(user, id);
  }

  @Get(['admin/billing/runs/:id', 'api/admin/billing/runs/:id'])
  @RequirePermission('BILLING', 'VIEW')
  getBillingRun(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getBillingRun(user, id);
  }

  @Patch(['admin/billing/runs/:id', 'api/admin/billing/runs/:id'])
  @RequirePermission('BILLING', 'MANAGE')
  updateBillingRun(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.updateBillingRun(user, id, body);
  }

  @Post(['admin/billing/runs/:id/preflight', 'api/admin/billing/runs/:id/preflight'])
  @RequirePermission('BILLING', 'MANAGE')
  runBillingRunPreflight(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.runBillingRunPreflight(user, id);
  }

  @Post(['admin/billing/runs/:id/calculate-draft', 'api/admin/billing/runs/:id/calculate-draft'])
  @RequirePermission('BILLING', 'MANAGE')
  calculateBillingRunDraft(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.calculateBillingRunDraft(user, id, body);
  }

  @Post(['admin/billing/runs/:id/link-draft', 'api/admin/billing/runs/:id/link-draft'])
  @RequirePermission('BILLING', 'MANAGE')
  linkBillingRunDraft(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.linkBillingRunDraft(user, id, body);
  }

  @Patch(['admin/billing/runs/:id/status', 'api/admin/billing/runs/:id/status'])
  @RequirePermission('BILLING', 'MANAGE')
  updateBillingRunStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.updateBillingRunStatus(user, id, body);
  }

  @Patch(['admin/billing/runs/:id/cancel', 'api/admin/billing/runs/:id/cancel'])
  @RequirePermission('BILLING', 'MANAGE')
  cancelBillingRun(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.cancelBillingRun(user, id, body);
  }

  @Get(['admin/tariffs', 'api/admin/tariffs'])
  @RequirePermission('TARIFFS', 'VIEW')
  listTariffs(@CurrentUser() user: MvpUser) {
    return this.billingReadService.listTariffs(user);
  }

  @Get(['admin/tariffs/stats', 'api/admin/tariffs/stats'])
  @RequirePermission('TARIFFS', 'VIEW')
  getTariffStats(@CurrentUser() user: MvpUser) {
    return this.billingReadService.getTariffStats(user);
  }

  @Get(['admin/tariffs/preview', 'api/admin/tariffs/preview'])
  @RequirePermission('TARIFFS', 'VIEW')
  previewTariffs(@CurrentUser() user: MvpUser) {
    return this.billingReadService.previewTariffs(user);
  }

  @Post(['admin/tariffs/defaults', 'api/admin/tariffs/defaults'])
  @RequirePermission('TARIFFS', 'MANAGE')
  createDefaultTariffs(@CurrentUser() user: MvpUser) {
    return this.billingReadService.createDefaultTariffs(user);
  }

  @Get(['admin/tariffs/meter-based', 'api/admin/tariffs/meter-based'])
  @RequirePermission('TARIFFS', 'VIEW')
  listMeterBasedTariffs(@CurrentUser() user: MvpUser) {
    return this.billingReadService.listMeterBasedTariffs(user);
  }

  @Get(['admin/tariffs/meter-based/stats', 'api/admin/tariffs/meter-based/stats'])
  @RequirePermission('TARIFFS', 'VIEW')
  getMeterBasedTariffStats(@CurrentUser() user: MvpUser) {
    return this.billingReadService.getMeterBasedTariffStats(user);
  }

  @Post(['admin/tariffs/meter-based', 'api/admin/tariffs/meter-based'])
  @RequirePermission('TARIFFS', 'MANAGE')
  async createMeterBasedTariff(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    await this.saasLimits.assertFeatureEnabled(user.organizationId, 'meterBasedTariffs', user);
    return this.billingReadService.saveMeterBasedTariff(user, body);
  }

  @Get(['admin/tariffs/meter-based/:id', 'api/admin/tariffs/meter-based/:id'])
  @RequirePermission('TARIFFS', 'VIEW')
  getMeterBasedTariff(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getMeterBasedTariff(user, id);
  }

  @Patch(['admin/tariffs/meter-based/:id', 'api/admin/tariffs/meter-based/:id'])
  @RequirePermission('TARIFFS', 'MANAGE')
  async updateMeterBasedTariff(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertFeatureEnabled(user.organizationId, 'meterBasedTariffs', user);
    return this.billingReadService.saveMeterBasedTariff(user, body, id);
  }

  @Patch(['admin/tariffs/meter-based/:id/status', 'api/admin/tariffs/meter-based/:id/status'])
  @RequirePermission('TARIFFS', 'MANAGE')
  async updateMeterBasedTariffStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertFeatureEnabled(user.organizationId, 'meterBasedTariffs', user);
    return this.billingReadService.updateMeterBasedTariffStatus(user, id, body);
  }

  @Post(['admin/tariffs/meter-based/:id/duplicate', 'api/admin/tariffs/meter-based/:id/duplicate'])
  @RequirePermission('TARIFFS', 'MANAGE')
  async duplicateMeterBasedTariff(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    await this.saasLimits.assertFeatureEnabled(user.organizationId, 'meterBasedTariffs', user);
    return this.billingReadService.duplicateMeterBasedTariff(user, id);
  }

  @Get(['admin/tariffs/meter-based/:id/impact', 'api/admin/tariffs/meter-based/:id/impact'])
  @RequirePermission('TARIFFS', 'VIEW')
  getMeterBasedTariffImpact(@CurrentUser() user: MvpUser, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getMeterBasedTariffImpact(user, id, query);
  }

  @Get(['admin/tariffs/:id', 'api/admin/tariffs/:id'])
  @RequirePermission('TARIFFS', 'VIEW')
  getTariff(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getTariff(user, id);
  }

  @Post(['admin/tariffs', 'api/admin/tariffs'])
  @RequirePermission('TARIFFS', 'MANAGE')
  createTariff(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.saveTariff(user, body);
  }

  @Patch(['admin/tariffs/:id', 'api/admin/tariffs/:id'])
  @RequirePermission('TARIFFS', 'MANAGE')
  updateTariff(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.saveTariff(user, body, id);
  }

  @Patch(['admin/tariffs/:id/status', 'api/admin/tariffs/:id/status'])
  @RequirePermission('TARIFFS', 'MANAGE')
  updateTariffStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.updateTariffStatus(user, id, body);
  }

  @Post(['admin/tariffs/:id/duplicate', 'api/admin/tariffs/:id/duplicate'])
  @RequirePermission('TARIFFS', 'MANAGE')
  duplicateTariff(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.duplicateTariff(user, id);
  }

  @Delete(['admin/tariffs/:id', 'api/admin/tariffs/:id'])
  @RequirePermission('TARIFFS', 'DELETE')
  deactivateTariff(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.deactivateTariff(user, id);
  }

  @Get(['admin/invoices/draft', 'api/admin/invoices/draft'])
  @RequirePermission('BILLING', 'VIEW')
  getInvoiceDraft(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getInvoiceDraft(user, query);
  }

  @Post(['admin/invoices/draft/calculate', 'api/admin/invoices/draft/calculate'])
  @RequirePermission('BILLING', 'MANAGE')
  calculateInvoiceDraft(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.calculateInvoiceDraft(user, body);
  }

  @Post(['admin/invoices/draft/save', 'api/admin/invoices/draft/save'])
  @RequirePermission('BILLING', 'MANAGE')
  saveInvoiceDraft(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.saveInvoiceDraft(user, body);
  }

  @Get(['admin/invoices/draft/meter-charges-preview', 'api/admin/invoices/draft/meter-charges-preview'])
  @RequirePermission('BILLING', 'VIEW')
  getMeterChargesPreview(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getMeterChargesPreview(user, query);
  }

  @Get(['admin/invoices/draft/:id/review', 'api/admin/invoices/draft/:id/review'])
  @RequirePermission('BILLING', 'VIEW')
  getInvoiceDraftReview(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getInvoiceDraftReview(user, id);
  }

  @Get(['admin/invoices/draft/:id', 'api/admin/invoices/draft/:id'])
  @RequirePermission('BILLING', 'VIEW')
  getInvoiceDraftById(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getInvoiceDraftById(user, id);
  }

  @Patch(['admin/invoices/draft/:id/recalculate', 'api/admin/invoices/draft/:id/recalculate'])
  @RequirePermission('BILLING', 'MANAGE')
  recalculateInvoiceDraft(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.recalculateInvoiceDraft(user, id, body);
  }

  @Patch(['admin/invoices/draft/:id/lines/:lineId/status', 'api/admin/invoices/draft/:id/lines/:lineId/status'])
  @RequirePermission('BILLING', 'MANAGE')
  updateInvoiceDraftLineStatus(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: unknown,
  ) {
    return this.billingReadService.updateInvoiceDraftLineStatus(user, id, lineId, body);
  }

  @Patch(['admin/invoices/draft/:id/apartments/:apartmentId/status', 'api/admin/invoices/draft/:id/apartments/:apartmentId/status'])
  @RequirePermission('BILLING', 'MANAGE')
  updateInvoiceDraftApartmentStatus(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Param('apartmentId') apartmentId: string,
    @Body() body: unknown,
  ) {
    return this.billingReadService.updateInvoiceDraftApartmentStatus(user, id, apartmentId, body);
  }

  @Post(['admin/invoices/draft/:id/apartments/:apartmentId/adjustments', 'api/admin/invoices/draft/:id/apartments/:apartmentId/adjustments'])
  @RequirePermission('BILLING', 'MANAGE')
  addInvoiceDraftAdjustment(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Param('apartmentId') apartmentId: string,
    @Body() body: unknown,
  ) {
    return this.billingReadService.addInvoiceDraftAdjustment(user, id, apartmentId, body);
  }

  @Patch(['admin/invoices/draft/:id/adjustments/:lineId', 'api/admin/invoices/draft/:id/adjustments/:lineId'])
  @RequirePermission('BILLING', 'MANAGE')
  updateInvoiceDraftAdjustment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Param('lineId') lineId: string, @Body() body: unknown) {
    return this.billingReadService.updateInvoiceDraftAdjustment(user, id, lineId, body);
  }

  @Delete(['admin/invoices/draft/:id/adjustments/:lineId', 'api/admin/invoices/draft/:id/adjustments/:lineId'])
  @RequirePermission('BILLING', 'MANAGE')
  deleteInvoiceDraftAdjustment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Param('lineId') lineId: string) {
    return this.billingReadService.deleteInvoiceDraftAdjustment(user, id, lineId);
  }

  @Post(['admin/invoices/draft/:id/recalculate-apartment/:apartmentId', 'api/admin/invoices/draft/:id/recalculate-apartment/:apartmentId'])
  @RequirePermission('BILLING', 'MANAGE')
  recalculateInvoiceDraftApartment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Param('apartmentId') apartmentId: string) {
    return this.billingReadService.recalculateInvoiceDraftApartment(user, id, apartmentId);
  }

  @Post(['admin/invoices/draft/:id/lock', 'api/admin/invoices/draft/:id/lock'])
  @RequirePermission('BILLING', 'LOCK')
  lockInvoiceDraft(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.lockInvoiceDraft(user, id, body);
  }

  @Patch(['admin/invoices/draft/:id/cancel', 'api/admin/invoices/draft/:id/cancel'])
  @RequirePermission('BILLING', 'MANAGE')
  cancelInvoiceDraft(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.cancelInvoiceDraft(user, id);
  }

  @Get(['admin/invoices/finalize/:draftId', 'api/admin/invoices/finalize/:draftId'])
  @RequirePermission('INVOICES', 'VIEW')
  getInvoiceFinalizeSummary(@CurrentUser() user: MvpUser, @Param('draftId') draftId: string) {
    return this.billingReadService.getInvoiceFinalizeSummary(user, draftId);
  }

  @Post(['admin/invoices/finalize/:draftId', 'api/admin/invoices/finalize/:draftId'])
  @RequirePermission('INVOICES', 'FINALIZE')
  async finalizeInvoiceDraft(@CurrentUser() user: MvpUser, @Param('draftId') draftId: string) {
    await this.saasLimits.assertCanFinalizeInvoices(user.organizationId, undefined, 1, user);
    return this.billingReadService.finalizeInvoiceDraft(user, draftId);
  }

  @Post(['admin/invoices/generate-monthly', 'api/admin/invoices/generate-monthly'])
  @RequirePermission('INVOICES', 'FINALIZE')
  async generateMonthlyInvoices(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    await this.saasLimits.assertCanFinalizeInvoices(user.organizationId, undefined, 1, user);
    return this.billingReadService.generateMonthlyInvoices(user, body);
  }

  @Get(['admin/invoices/monthly-summary', 'api/admin/invoices/monthly-summary'])
  @RequirePermission('INVOICES', 'VIEW')
  getMonthlySummary(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getMonthlySummary(user, query);
  }

  @Get(['admin/invoices', 'api/admin/invoices'])
  @RequirePermission('INVOICES', 'VIEW')
  listAdminInternalInvoices(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.listAdminInternalInvoices(user, query);
  }

  @Get(['admin/invoices/:id/payments', 'api/admin/invoices/:id/payments'])
  @RequirePermission('INVOICES', 'VIEW')
  listAdminInvoicePayments(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.listAdminInvoicePayments(user, id);
  }

  @Get(['admin/invoices/:id', 'api/admin/invoices/:id'])
  @RequirePermission('INVOICES', 'VIEW')
  getAdminInternalInvoice(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getAdminInternalInvoice(user, id);
  }

  @Patch(['admin/invoices/:id/status', 'api/admin/invoices/:id/status'])
  @RequirePermission('INVOICES', 'CANCEL')
  updateAdminInternalInvoiceStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.updateAdminInternalInvoiceStatus(user, id, body);
  }

  @Get(['admin/finance-overview', 'api/admin/finance-overview'])
  @RequirePermission('REPORTS', 'VIEW')
  getFinanceOverview(@CurrentUser() user: MvpUser) {
    return this.billingReadService.getFinanceOverview(user);
  }

  @Get(['admin/payments/stats', 'api/admin/payments/stats'])
  @RequirePermission('PAYMENTS', 'VIEW')
  getAdminPaymentStats(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminPaymentStats(user, query);
  }

  @Get(['admin/payments/invoice-search', 'api/admin/payments/invoice-search'])
  @RequirePermission('PAYMENTS', 'VIEW')
  searchAdminPaymentInvoices(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.searchAdminPaymentInvoices(user, query);
  }

  @Get(['admin/payments/reconciliation/stats', 'api/admin/payments/reconciliation/stats'])
  @RequirePermission('RECONCILIATION', 'VIEW')
  getAdminPaymentReconciliationStats(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminPaymentReconciliationStats(user, query);
  }

  @Get(['admin/payments/reconciliation/debtors', 'api/admin/payments/reconciliation/debtors'])
  @RequirePermission('RECONCILIATION', 'VIEW')
  getAdminPaymentReconciliationDebtors(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminPaymentReconciliationDebtors(user, query);
  }

  @Get(['admin/payments/reconciliation/recent-payments', 'api/admin/payments/reconciliation/recent-payments'])
  @RequirePermission('RECONCILIATION', 'VIEW')
  getAdminPaymentReconciliationRecentPayments(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminPaymentReconciliationRecentPayments(user, query);
  }

  @Get(['admin/payments/reconciliation/apartments/:apartmentId', 'api/admin/payments/reconciliation/apartments/:apartmentId'])
  @RequirePermission('RECONCILIATION', 'VIEW')
  getAdminPaymentReconciliationApartment(
    @CurrentUser() user: MvpUser,
    @Param('apartmentId') apartmentId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.billingReadService.getAdminPaymentReconciliationApartment(user, apartmentId, query);
  }

  @Get(['admin/payments/reconciliation', 'api/admin/payments/reconciliation'])
  @RequirePermission('RECONCILIATION', 'VIEW')
  getAdminPaymentReconciliation(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminPaymentReconciliation(user, query);
  }

  @Get(['admin/payments', 'api/admin/payments'])
  @RequirePermission('PAYMENTS', 'VIEW')
  listAdminPayments(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.listAdminPayments(user, query);
  }

  @Post(['admin/payments', 'api/admin/payments'])
  @RequirePermission('PAYMENTS', 'CREATE')
  async createAdminPayment(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    await this.saasLimits.assertFeatureEnabled(user.organizationId, 'manualPayments', user);
    return this.billingReadService.createAdminPayment(user, body);
  }

  @Get(['admin/payments/:id', 'api/admin/payments/:id'])
  @RequirePermission('PAYMENTS', 'VIEW')
  getAdminPayment(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getAdminPayment(user, id);
  }

  @Patch(['admin/payments/:id/cancel', 'api/admin/payments/:id/cancel'])
  @RequirePermission('PAYMENTS', 'CANCEL')
  cancelAdminPayment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.cancelAdminPayment(user, id, body);
  }

  @Post(['invoices', 'api/invoices'])
  createInvoice(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.createInvoice(user, body);
  }

  @Patch(['invoices/:id/status', 'api/invoices/:id/status'])
  updateInvoiceStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.updateInvoiceStatus(user, id, body);
  }

  @Get(['invoices/:id', 'api/invoices/:id'])
  getInvoice(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getInvoice(user, id);
  }

  @Get(['payments', 'api/payments'])
  listPayments(@CurrentUser() user: MvpUser) {
    return this.billingReadService.listPayments(user);
  }

  @Post(['payments', 'api/payments'])
  createPayment(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.createPayment(user, body);
  }

  @Get(['payments/:id', 'api/payments/:id'])
  getPayment(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getPayment(user, id);
  }

  @Get(['billing/summary', 'api/billing/summary'])
  getSummary(@CurrentUser() user: MvpUser) {
    return this.billingReadService.getSummary(user);
  }
}
