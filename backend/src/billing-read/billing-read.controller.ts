import { Controller, Get, Param } from '@nestjs/common';
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
