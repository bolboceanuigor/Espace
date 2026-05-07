import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

  @Post(['admin/tariffs', 'api/admin/tariffs'])
  createTariff(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.saveTariff(user, body);
  }

  @Patch(['admin/tariffs/:id', 'api/admin/tariffs/:id'])
  updateTariff(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingReadService.saveTariff(user, body, id);
  }

  @Post(['admin/invoices/generate-monthly', 'api/admin/invoices/generate-monthly'])
  generateMonthlyInvoices(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.generateMonthlyInvoices(user, body);
  }

  @Get(['admin/invoices/monthly-summary', 'api/admin/invoices/monthly-summary'])
  getMonthlySummary(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.billingReadService.getMonthlySummary(user, query);
  }

  @Post(['invoices', 'api/invoices'])
  createInvoice(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingReadService.createInvoice(user, body);
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
