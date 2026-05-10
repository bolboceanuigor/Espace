import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { ResidentDemoService } from './resident-demo.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.RESIDENT)
export class ResidentDemoController {
  constructor(private readonly residentDemoService: ResidentDemoService) {}

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

  @Get(['resident/invoices', 'api/resident/invoices'])
  listInvoices(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.residentDemoService.listInternalInvoices(user, query);
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

  @Get(['resident/invoices/:id', 'api/resident/invoices/:id'])
  getInvoice(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentDemoService.getInternalInvoice(user, id);
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

  @Get(['resident/meters', 'api/resident/meters'])
  listMeters(@CurrentUser() user: MvpUser) {
    return this.residentDemoService.listMeters(user);
  }

  @Post(['resident/meters/:meterId/readings', 'api/resident/meters/:meterId/readings'])
  addMeterReading(@CurrentUser() user: MvpUser, @Param('meterId') meterId: string, @Body() body: unknown) {
    return this.residentDemoService.addMeterReading(user, meterId, body);
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
