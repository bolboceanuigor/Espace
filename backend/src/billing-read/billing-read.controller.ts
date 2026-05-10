import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { BillingReadService } from './billing-read.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class BillingReadController {
  constructor(private readonly billingReadService: BillingReadService) {}

  @Get(['invoices', 'api/invoices'])
  listInvoices(@CurrentUser() user: MvpUser) {
    return this.billingReadService.listInvoices(user);
  }

  @Get(['admin/audit-log/stats', 'api/admin/audit-log/stats'])
  getAdminAuditLogStats(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminAuditLogStats(user, query);
  }

  @Get(['admin/audit-log', 'api/admin/audit-log'])
  listAdminAuditLog(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.listAdminAuditLog(user, query);
  }

  @Get(['admin/audit-log/:id', 'api/admin/audit-log/:id'])
  getAdminAuditLog(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getAdminAuditLog(user, id);
  }

  @Get(['admin/billing', 'api/admin/billing'])
  getBillingOverview(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getBillingOverview(user, query);
  }

  @Get(['admin/billing/runs', 'api/admin/billing/runs'])
  listBillingRuns(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.listBillingRuns(user, query);
  }

  @Post(['admin/billing/runs', 'api/admin/billing/runs'])
  createBillingRun(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.createBillingRun(user, body);
  }

  @Get(['admin/billing/runs/:id/activity/recent', 'api/admin/billing/runs/:id/activity/recent'])
  getBillingRunActivityRecent(@CurrentUser() user: MvpUser, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getBillingRunActivity(user, id, query, 5);
  }

  @Get(['admin/billing/runs/:id/activity', 'api/admin/billing/runs/:id/activity'])
  getBillingRunActivity(@CurrentUser() user: MvpUser, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getBillingRunActivity(user, id, query);
  }

  @Get(['admin/billing/runs/:id/checks', 'api/admin/billing/runs/:id/checks'])
  getBillingRunChecks(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getBillingRunChecks(user, id);
  }

  @Get(['admin/billing/runs/:id', 'api/admin/billing/runs/:id'])
  getBillingRun(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getBillingRun(user, id);
  }

  @Patch(['admin/billing/runs/:id', 'api/admin/billing/runs/:id'])
  updateBillingRun(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.updateBillingRun(user, id, body);
  }

  @Post(['admin/billing/runs/:id/preflight', 'api/admin/billing/runs/:id/preflight'])
  runBillingRunPreflight(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.runBillingRunPreflight(user, id);
  }

  @Post(['admin/billing/runs/:id/calculate-draft', 'api/admin/billing/runs/:id/calculate-draft'])
  calculateBillingRunDraft(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.calculateBillingRunDraft(user, id, body);
  }

  @Post(['admin/billing/runs/:id/link-draft', 'api/admin/billing/runs/:id/link-draft'])
  linkBillingRunDraft(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.linkBillingRunDraft(user, id, body);
  }

  @Patch(['admin/billing/runs/:id/status', 'api/admin/billing/runs/:id/status'])
  updateBillingRunStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.updateBillingRunStatus(user, id, body);
  }

  @Patch(['admin/billing/runs/:id/cancel', 'api/admin/billing/runs/:id/cancel'])
  cancelBillingRun(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.cancelBillingRun(user, id, body);
  }

  @Get(['admin/tariffs', 'api/admin/tariffs'])
  listTariffs(@CurrentUser() user: MvpUser) {
    return this.billingReadService.listTariffs(user);
  }

  @Get(['admin/tariffs/stats', 'api/admin/tariffs/stats'])
  getTariffStats(@CurrentUser() user: MvpUser) {
    return this.billingReadService.getTariffStats(user);
  }

  @Get(['admin/tariffs/preview', 'api/admin/tariffs/preview'])
  previewTariffs(@CurrentUser() user: MvpUser) {
    return this.billingReadService.previewTariffs(user);
  }

  @Post(['admin/tariffs/defaults', 'api/admin/tariffs/defaults'])
  createDefaultTariffs(@CurrentUser() user: MvpUser) {
    return this.billingReadService.createDefaultTariffs(user);
  }

  @Get(['admin/tariffs/meter-based', 'api/admin/tariffs/meter-based'])
  listMeterBasedTariffs(@CurrentUser() user: MvpUser) {
    return this.billingReadService.listMeterBasedTariffs(user);
  }

  @Get(['admin/tariffs/meter-based/stats', 'api/admin/tariffs/meter-based/stats'])
  getMeterBasedTariffStats(@CurrentUser() user: MvpUser) {
    return this.billingReadService.getMeterBasedTariffStats(user);
  }

  @Post(['admin/tariffs/meter-based', 'api/admin/tariffs/meter-based'])
  createMeterBasedTariff(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.saveMeterBasedTariff(user, body);
  }

  @Get(['admin/tariffs/meter-based/:id', 'api/admin/tariffs/meter-based/:id'])
  getMeterBasedTariff(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getMeterBasedTariff(user, id);
  }

  @Patch(['admin/tariffs/meter-based/:id', 'api/admin/tariffs/meter-based/:id'])
  updateMeterBasedTariff(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.saveMeterBasedTariff(user, body, id);
  }

  @Patch(['admin/tariffs/meter-based/:id/status', 'api/admin/tariffs/meter-based/:id/status'])
  updateMeterBasedTariffStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.updateMeterBasedTariffStatus(user, id, body);
  }

  @Post(['admin/tariffs/meter-based/:id/duplicate', 'api/admin/tariffs/meter-based/:id/duplicate'])
  duplicateMeterBasedTariff(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.duplicateMeterBasedTariff(user, id);
  }

  @Get(['admin/tariffs/meter-based/:id/impact', 'api/admin/tariffs/meter-based/:id/impact'])
  getMeterBasedTariffImpact(@CurrentUser() user: MvpUser, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getMeterBasedTariffImpact(user, id, query);
  }

  @Get(['admin/tariffs/:id', 'api/admin/tariffs/:id'])
  getTariff(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getTariff(user, id);
  }

  @Post(['admin/tariffs', 'api/admin/tariffs'])
  createTariff(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.saveTariff(user, body);
  }

  @Patch(['admin/tariffs/:id', 'api/admin/tariffs/:id'])
  updateTariff(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.saveTariff(user, body, id);
  }

  @Patch(['admin/tariffs/:id/status', 'api/admin/tariffs/:id/status'])
  updateTariffStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.updateTariffStatus(user, id, body);
  }

  @Post(['admin/tariffs/:id/duplicate', 'api/admin/tariffs/:id/duplicate'])
  duplicateTariff(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.duplicateTariff(user, id);
  }

  @Delete(['admin/tariffs/:id', 'api/admin/tariffs/:id'])
  deactivateTariff(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.deactivateTariff(user, id);
  }

  @Get(['admin/invoices/draft', 'api/admin/invoices/draft'])
  getInvoiceDraft(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getInvoiceDraft(user, query);
  }

  @Post(['admin/invoices/draft/calculate', 'api/admin/invoices/draft/calculate'])
  calculateInvoiceDraft(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.calculateInvoiceDraft(user, body);
  }

  @Post(['admin/invoices/draft/save', 'api/admin/invoices/draft/save'])
  saveInvoiceDraft(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.saveInvoiceDraft(user, body);
  }

  @Get(['admin/invoices/draft/meter-charges-preview', 'api/admin/invoices/draft/meter-charges-preview'])
  getMeterChargesPreview(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getMeterChargesPreview(user, query);
  }

  @Get(['admin/invoices/draft/:id/review', 'api/admin/invoices/draft/:id/review'])
  getInvoiceDraftReview(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getInvoiceDraftReview(user, id);
  }

  @Get(['admin/invoices/draft/:id', 'api/admin/invoices/draft/:id'])
  getInvoiceDraftById(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getInvoiceDraftById(user, id);
  }

  @Patch(['admin/invoices/draft/:id/recalculate', 'api/admin/invoices/draft/:id/recalculate'])
  recalculateInvoiceDraft(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.recalculateInvoiceDraft(user, id, body);
  }

  @Patch(['admin/invoices/draft/:id/lines/:lineId/status', 'api/admin/invoices/draft/:id/lines/:lineId/status'])
  updateInvoiceDraftLineStatus(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: unknown,
  ) {
    return this.billingReadService.updateInvoiceDraftLineStatus(user, id, lineId, body);
  }

  @Patch(['admin/invoices/draft/:id/apartments/:apartmentId/status', 'api/admin/invoices/draft/:id/apartments/:apartmentId/status'])
  updateInvoiceDraftApartmentStatus(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Param('apartmentId') apartmentId: string,
    @Body() body: unknown,
  ) {
    return this.billingReadService.updateInvoiceDraftApartmentStatus(user, id, apartmentId, body);
  }

  @Post(['admin/invoices/draft/:id/apartments/:apartmentId/adjustments', 'api/admin/invoices/draft/:id/apartments/:apartmentId/adjustments'])
  addInvoiceDraftAdjustment(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Param('apartmentId') apartmentId: string,
    @Body() body: unknown,
  ) {
    return this.billingReadService.addInvoiceDraftAdjustment(user, id, apartmentId, body);
  }

  @Patch(['admin/invoices/draft/:id/adjustments/:lineId', 'api/admin/invoices/draft/:id/adjustments/:lineId'])
  updateInvoiceDraftAdjustment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Param('lineId') lineId: string, @Body() body: unknown) {
    return this.billingReadService.updateInvoiceDraftAdjustment(user, id, lineId, body);
  }

  @Delete(['admin/invoices/draft/:id/adjustments/:lineId', 'api/admin/invoices/draft/:id/adjustments/:lineId'])
  deleteInvoiceDraftAdjustment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Param('lineId') lineId: string) {
    return this.billingReadService.deleteInvoiceDraftAdjustment(user, id, lineId);
  }

  @Post(['admin/invoices/draft/:id/recalculate-apartment/:apartmentId', 'api/admin/invoices/draft/:id/recalculate-apartment/:apartmentId'])
  recalculateInvoiceDraftApartment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Param('apartmentId') apartmentId: string) {
    return this.billingReadService.recalculateInvoiceDraftApartment(user, id, apartmentId);
  }

  @Post(['admin/invoices/draft/:id/lock', 'api/admin/invoices/draft/:id/lock'])
  lockInvoiceDraft(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.lockInvoiceDraft(user, id, body);
  }

  @Patch(['admin/invoices/draft/:id/cancel', 'api/admin/invoices/draft/:id/cancel'])
  cancelInvoiceDraft(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.cancelInvoiceDraft(user, id);
  }

  @Get(['admin/invoices/finalize/:draftId', 'api/admin/invoices/finalize/:draftId'])
  getInvoiceFinalizeSummary(@CurrentUser() user: MvpUser, @Param('draftId') draftId: string) {
    return this.billingReadService.getInvoiceFinalizeSummary(user, draftId);
  }

  @Post(['admin/invoices/finalize/:draftId', 'api/admin/invoices/finalize/:draftId'])
  finalizeInvoiceDraft(@CurrentUser() user: MvpUser, @Param('draftId') draftId: string) {
    return this.billingReadService.finalizeInvoiceDraft(user, draftId);
  }

  @Post(['admin/invoices/generate-monthly', 'api/admin/invoices/generate-monthly'])
  generateMonthlyInvoices(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.generateMonthlyInvoices(user, body);
  }

  @Get(['admin/invoices/monthly-summary', 'api/admin/invoices/monthly-summary'])
  getMonthlySummary(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getMonthlySummary(user, query);
  }

  @Get(['admin/invoices', 'api/admin/invoices'])
  listAdminInternalInvoices(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.listAdminInternalInvoices(user, query);
  }

  @Get(['admin/invoices/:id/payments', 'api/admin/invoices/:id/payments'])
  listAdminInvoicePayments(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.listAdminInvoicePayments(user, id);
  }

  @Get(['admin/invoices/:id', 'api/admin/invoices/:id'])
  getAdminInternalInvoice(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getAdminInternalInvoice(user, id);
  }

  @Patch(['admin/invoices/:id/status', 'api/admin/invoices/:id/status'])
  updateAdminInternalInvoiceStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.updateAdminInternalInvoiceStatus(user, id, body);
  }

  @Get(['admin/finance-overview', 'api/admin/finance-overview'])
  getFinanceOverview(@CurrentUser() user: MvpUser) {
    return this.billingReadService.getFinanceOverview(user);
  }

  @Get(['admin/payments/stats', 'api/admin/payments/stats'])
  getAdminPaymentStats(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminPaymentStats(user, query);
  }

  @Get(['admin/payments/invoice-search', 'api/admin/payments/invoice-search'])
  searchAdminPaymentInvoices(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.searchAdminPaymentInvoices(user, query);
  }

  @Get(['admin/payments/reconciliation/stats', 'api/admin/payments/reconciliation/stats'])
  getAdminPaymentReconciliationStats(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminPaymentReconciliationStats(user, query);
  }

  @Get(['admin/payments/reconciliation/debtors', 'api/admin/payments/reconciliation/debtors'])
  getAdminPaymentReconciliationDebtors(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminPaymentReconciliationDebtors(user, query);
  }

  @Get(['admin/payments/reconciliation/recent-payments', 'api/admin/payments/reconciliation/recent-payments'])
  getAdminPaymentReconciliationRecentPayments(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminPaymentReconciliationRecentPayments(user, query);
  }

  @Get(['admin/payments/reconciliation/apartments/:apartmentId', 'api/admin/payments/reconciliation/apartments/:apartmentId'])
  getAdminPaymentReconciliationApartment(
    @CurrentUser() user: MvpUser,
    @Param('apartmentId') apartmentId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.billingReadService.getAdminPaymentReconciliationApartment(user, apartmentId, query);
  }

  @Get(['admin/payments/reconciliation', 'api/admin/payments/reconciliation'])
  getAdminPaymentReconciliation(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getAdminPaymentReconciliation(user, query);
  }

  @Get(['admin/payments', 'api/admin/payments'])
  listAdminPayments(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.listAdminPayments(user, query);
  }

  @Post(['admin/payments', 'api/admin/payments'])
  createAdminPayment(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.createAdminPayment(user, body);
  }

  @Get(['admin/payments/:id', 'api/admin/payments/:id'])
  getAdminPayment(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingReadService.getAdminPayment(user, id);
  }

  @Patch(['admin/payments/:id/cancel', 'api/admin/payments/:id/cancel'])
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
