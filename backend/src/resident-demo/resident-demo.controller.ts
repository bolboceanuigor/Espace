import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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

  @Get(['resident/invoices', 'api/resident/invoices'])
  listInvoices(@CurrentUser() user: MvpUser) {
    return this.residentDemoService.listInvoices(user);
  }

  @Get(['resident/payments', 'api/resident/payments'])
  listPayments(@CurrentUser() user: MvpUser) {
    return this.residentDemoService.listPayments(user);
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
