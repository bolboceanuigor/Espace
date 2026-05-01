import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { GenerateMonthlyInvoicesDto, InvoicesFilterDto, SendRemindersDto } from './dto/invoices.dto';
import { InvoicesService } from './invoices.service';

@Controller('api')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('admin/invoices/generate-monthly')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  generateMonthly(@CurrentUser() user: any, @Body() dto: GenerateMonthlyInvoicesDto) {
    return this.invoicesService.generateMonthly(user, dto);
  }

  @Get('admin/invoices')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminList(@CurrentUser() user: any, @Query() query: InvoicesFilterDto) {
    return this.invoicesService.adminList(user, query);
  }

  @Get('admin/invoices/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminGetOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invoicesService.adminGetOne(user, id);
  }

  @Post('admin/invoices/:id/issue')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  issue(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invoicesService.issueInvoice(user, id);
  }

  @Post('admin/invoices/:id/regenerate')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  regenerate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invoicesService.regenerateInvoice(user, id);
  }

  @Get('admin/invoices/:id/pdf')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  async adminPdf(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const buffer = await this.invoicesService.adminInvoicePdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
    res.send(buffer);
  }

  @Post('admin/invoices/send-reminders')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  sendReminders(@CurrentUser() user: any, @Body() dto: SendRemindersDto) {
    return this.invoicesService.sendReminders(user, dto);
  }

  @Get('admin/reminders')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminReminderHistory(@CurrentUser() user: any) {
    return this.invoicesService.adminReminderHistory(user);
  }

  @Get('admin/receipts')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminReceipts(@CurrentUser() user: any) {
    return this.invoicesService.adminReceipts(user);
  }

  @Get('admin/receipts/:id/pdf')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  async adminReceiptPdf(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const buffer = await this.invoicesService.adminReceiptPdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${id}.pdf"`);
    res.send(buffer);
  }

  @Get('resident/invoices')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentList(@CurrentUser() user: any) {
    return this.invoicesService.residentList(user);
  }

  @Get('resident/invoices/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentGetOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invoicesService.residentGetOne(user, id);
  }

  @Get('resident/invoices/:id/pdf')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  async residentPdf(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const buffer = await this.invoicesService.residentInvoicePdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
    res.send(buffer);
  }

  @Get('resident/receipts')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentReceipts(@CurrentUser() user: any) {
    return this.invoicesService.residentReceipts(user);
  }

  @Get('resident/receipts/:id/pdf')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  async residentReceiptPdf(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const buffer = await this.invoicesService.residentReceiptPdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${id}.pdf"`);
    res.send(buffer);
  }

  @Get('superadmin/support/invoices/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  superadminSupport(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invoicesService.superadminSupportInvoice(user, id);
  }
}
