import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { InvoicePublishingService } from '../invoice-publishing/invoice-publishing.service';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { MetersService } from '../meters/meters.service';
import { ResidentDemoService } from './resident-demo.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.RESIDENT)
export class ResidentDemoController {
  constructor(
    private readonly residentDemoService: ResidentDemoService,
    private readonly invoicePublishingService: InvoicePublishingService,
    private readonly metersService: MetersService,
  ) {}

  @Get(['resident/me', 'api/resident/me', 'resident/demo', 'api/resident/demo'])
  getResidentContext(@CurrentUser() user: MvpUser) {
    return this.residentDemoService.getResidentContext(user);
  }

  @Get(['resident/home', 'api/resident/home'])
  getResidentHome(@CurrentUser() user: MvpUser) {
    return this.residentDemoService.getResidentHome(user);
  }

  @Get(['resident/dashboard', 'api/resident/dashboard'])
  getDashboard(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.residentDemoService.getDashboard(user, query);
  }

  @Get(['resident/profile', 'api/resident/profile'])
  getProfile(@CurrentUser() user: MvpUser) {
    return this.residentDemoService.getProfile(user);
  }

  @Patch(['resident/profile/preferences', 'api/resident/profile/preferences'])
  updateProfilePreferences(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.residentDemoService.updateProfilePreferences(user, body);
  }

  @Post(['resident/profile/update-requests', 'api/resident/profile/update-requests'])
  createProfileUpdateRequest(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.residentDemoService.createProfileUpdateRequest(user, body);
  }

  @Get(['resident/profile/update-requests', 'api/resident/profile/update-requests'])
  listProfileUpdateRequests(@CurrentUser() user: MvpUser) {
    return this.residentDemoService.listProfileUpdateRequests(user);
  }

  @Get(['resident/profile/update-requests/:id', 'api/resident/profile/update-requests/:id'])
  getProfileUpdateRequest(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentDemoService.getProfileUpdateRequest(user, id);
  }

  @Patch(['resident/profile/update-requests/:id/cancel', 'api/resident/profile/update-requests/:id/cancel'])
  cancelProfileUpdateRequest(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentDemoService.cancelProfileUpdateRequest(user, id);
  }

  @Get(['resident/apartments', 'api/resident/apartments'])
  listApartments(@CurrentUser() user: MvpUser) {
    return this.residentDemoService.listApartments(user);
  }

  @Get(['resident/invoices', 'api/resident/invoices'])
  listInvoices(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.invoicePublishingService.listResidentInvoices(user, query);
  }

  @Get(['resident/invoices/overview', 'api/resident/invoices/overview'])
  getInvoicesOverview(@CurrentUser() user: MvpUser) {
    return this.invoicePublishingService.getResidentOverview(user);
  }

  @Get(['resident/finance-summary', 'api/resident/finance-summary'])
  getFinanceSummary(@CurrentUser() user: MvpUser) {
    return this.residentDemoService.getFinanceSummary(user);
  }

  @Get(['resident/invoices/stats', 'api/resident/invoices/stats'])
  getInvoiceStats(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.residentDemoService.getInternalInvoiceStats(user, query);
  }

  @Get(['resident/invoices/:id/payments', 'api/resident/invoices/:id/payments'])
  getInvoicePayments(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentDemoService.listInternalInvoicePayments(user, id);
  }

  @Post(['resident/invoices/:id/payment-intent-placeholder', 'api/resident/invoices/:id/payment-intent-placeholder'])
  createPaymentIntentPlaceholder(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.invoicePublishingService.createResidentPaymentIntentPlaceholder(user, id, body);
  }

  @Get(['resident/invoices/:id/print-data', 'api/resident/invoices/:id/print-data'])
  getInvoicePrintData(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.invoicePublishingService.getResidentInvoicePrintData(user, id);
  }

  @Get(['resident/invoices/:id', 'api/resident/invoices/:id'])
  getInvoice(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.invoicePublishingService.getResidentInvoice(user, id);
  }

  @Post(['resident/invoices/:id/mark-viewed', 'api/resident/invoices/:id/mark-viewed'])
  markInvoiceViewed(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.invoicePublishingService.markResidentInvoiceViewed(user, id);
  }

  @Post(['resident/payment-intents/:id/cancel', 'api/resident/payment-intents/:id/cancel'])
  cancelPaymentIntentPlaceholder(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.invoicePublishingService.cancelResidentPaymentIntentPlaceholder(user, id, body);
  }

  @Get(['resident/payments', 'api/resident/payments'])
  listPayments(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.residentDemoService.listPayments(user, query);
  }

  @Get(['resident/payments/stats', 'api/resident/payments/stats'])
  getPaymentStats(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.residentDemoService.getInternalPaymentStats(user, query);
  }

  @Get(['resident/payments/:id', 'api/resident/payments/:id'])
  getPayment(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentDemoService.getInternalPayment(user, id);
  }

  @Get(['resident/apartments/:id/financial-summary', 'api/resident/apartments/:id/financial-summary'])
  getApartmentFinancialSummary(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentDemoService.getApartmentFinancialSummary(user, id);
  }

  @Get(['resident/apartments/:id/invoices', 'api/resident/apartments/:id/invoices'])
  getApartmentInvoices(@CurrentUser() user: MvpUser, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.residentDemoService.listApartmentInvoices(user, id, query);
  }

  @Get(['resident/apartments/:id/payments', 'api/resident/apartments/:id/payments'])
  getApartmentPayments(@CurrentUser() user: MvpUser, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.residentDemoService.listApartmentPayments(user, id, query);
  }

  @Get(['resident/apartments/:id', 'api/resident/apartments/:id'])
  getApartment(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentDemoService.getApartmentProfile(user, id);
  }

  @Get(['resident/meters', 'api/resident/meters'])
  listMeters(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.listResidentMeters(user, query);
  }

  @Post(['resident/meters/:meterId/readings', 'api/resident/meters/:meterId/readings'])
  addMeterReading(@CurrentUser() user: MvpUser, @Param('meterId') meterId: string, @Body() body: unknown) {
    return this.metersService.createResidentReading(user, body, meterId);
  }

  @Get(['resident/meters/:id', 'api/resident/meters/:id'])
  getMeter(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.metersService.getResidentMeter(user, id);
  }

  @Get(['resident/meter-readings', 'api/resident/meter-readings'])
  listMeterReadings(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.listResidentReadings(user, query);
  }

  @Post(['resident/meter-readings', 'api/resident/meter-readings'])
  createMeterReading(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.metersService.createResidentReading(user, body);
  }

  @Get(['resident/meter-readings/:id', 'api/resident/meter-readings/:id'])
  getMeterReading(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.metersService.getResidentReading(user, id);
  }

  @Patch(['resident/meter-readings/:id/cancel', 'api/resident/meter-readings/:id/cancel'])
  cancelMeterReading(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.metersService.cancelResidentReading(user, id);
  }

  @Get(['resident/issues', 'api/resident/issues'])
  listIssues(@CurrentUser() user: MvpUser) {
    return this.residentDemoService.listIssues(user);
  }

  @Post(['resident/issues', 'api/resident/issues'])
  createIssue(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.residentDemoService.createIssue(user, body);
  }

  @Get(['resident/announcements', 'api/resident/announcements'])
  listAnnouncements(@CurrentUser() user: MvpUser) {
    return this.residentDemoService.listAnnouncements(user);
  }
}
