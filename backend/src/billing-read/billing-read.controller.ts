import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { BillingReadService } from './billing-read.service';

@Controller()
export class BillingReadController {
  constructor(private readonly billingReadService: BillingReadService) {}

  @Public()
  @Get(['invoices', 'api/invoices'])
  listInvoices() {
    return this.billingReadService.listInvoices();
  }

  // Temporary MVP endpoint until the full backend guard stack is re-enabled.
  @Public()
  @Post(['invoices', 'api/invoices'])
  createInvoice(@Body() body: unknown) {
    return this.billingReadService.createInvoice(body);
  }

  @Public()
  @Get(['invoices/:id', 'api/invoices/:id'])
  getInvoice(@Param('id') id: string) {
    return this.billingReadService.getInvoice(id);
  }

  @Public()
  @Get(['payments', 'api/payments'])
  listPayments() {
    return this.billingReadService.listPayments();
  }

  // Temporary MVP endpoint until the full backend guard stack is re-enabled.
  @Public()
  @Post(['payments', 'api/payments'])
  createPayment(@Body() body: unknown) {
    return this.billingReadService.createPayment(body);
  }

  @Public()
  @Get(['payments/:id', 'api/payments/:id'])
  getPayment(@Param('id') id: string) {
    return this.billingReadService.getPayment(id);
  }

  @Public()
  @Get(['billing/summary', 'api/billing/summary'])
  getSummary() {
    return this.billingReadService.getSummary();
  }
}
