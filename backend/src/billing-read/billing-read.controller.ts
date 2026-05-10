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

  @Post(['admin/invoices/generate-monthly', 'api/admin/invoices/generate-monthly'])
  generateMonthlyInvoices(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.generateMonthlyInvoices(user, body);
  }

  @Get(['admin/invoices/monthly-summary', 'api/admin/invoices/monthly-summary'])
  getMonthlySummary(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getMonthlySummary(user, query);
  }

  @Get(['admin/finance-overview', 'api/admin/finance-overview'])
  getFinanceOverview(@CurrentUser() user: MvpUser) {
    return this.billingReadService.getFinanceOverview(user);
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
