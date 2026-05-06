import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ResidentDemoService } from './resident-demo.service';

@Controller()
export class ResidentDemoController {
  constructor(private readonly residentDemoService: ResidentDemoService) {}

  @Public()
  @Get(['resident/demo', 'api/resident/demo'])
  getDemoContext() {
    return this.residentDemoService.getDemoContext();
  }

  @Public()
  @Get(['resident/invoices', 'api/resident/invoices'])
  listInvoices() {
    return this.residentDemoService.listInvoices();
  }

  @Public()
  @Get(['resident/payments', 'api/resident/payments'])
  listPayments() {
    return this.residentDemoService.listPayments();
  }

  @Public()
  @Get(['resident/meters', 'api/resident/meters'])
  listMeters() {
    return this.residentDemoService.listMeters();
  }

  @Public()
  @Get(['resident/issues', 'api/resident/issues'])
  listIssues() {
    return this.residentDemoService.listIssues();
  }

  @Public()
  @Get(['resident/announcements', 'api/resident/announcements'])
  listAnnouncements() {
    return this.residentDemoService.listAnnouncements();
  }
}
