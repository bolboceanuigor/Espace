import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AllowsPastDue } from '../subscription/subscription-access.decorator';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { DebtsReportQueryDto, MonthlyReportQueryDto, PaymentsReportQueryDto, ResidentStatementQueryDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';

@Controller('api')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('admin/reports/monthly')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminMonthly(@CurrentUser() user: any, @Query() query: MonthlyReportQueryDto) {
    return this.reportsService.adminMonthly(user, query);
  }

  @Get('admin/reports/debts')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminDebts(@CurrentUser() user: any, @Query() query: DebtsReportQueryDto) {
    return this.reportsService.adminDebts(user, query);
  }

  @Get('admin/reports/payments')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminPayments(@CurrentUser() user: any, @Query() query: PaymentsReportQueryDto) {
    return this.reportsService.adminPayments(user, query);
  }

  @Get('admin/reports/charges')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminCharges(@CurrentUser() user: any, @Query() query: MonthlyReportQueryDto) {
    return this.reportsService.adminCharges(user, query);
  }

  @Get('resident/reports/statement')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentStatement(@CurrentUser() user: any, @Query() query: ResidentStatementQueryDto) {
    return this.reportsService.residentStatement(user, query);
  }

  @Get('superadmin/reports/platform')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  superadminPlatform(@CurrentUser() user: any) {
    return this.reportsService.superadminPlatform(user);
  }

  @Get('admin/reports/monthly/export/pdf')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  async adminMonthlyPdf(@CurrentUser() user: any, @Query() query: MonthlyReportQueryDto, @Res() res: Response) {
    const buffer = await this.reportsService.exportAdminMonthlyPdf(user, query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="monthly-report.pdf"');
    res.send(buffer);
  }

  @Get('admin/reports/monthly/export/xlsx')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  async adminMonthlyXlsx(@CurrentUser() user: any, @Query() query: MonthlyReportQueryDto, @Res() res: Response) {
    const buffer = await this.reportsService.exportAdminMonthlyXlsx(user, query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="monthly-report.xlsx"');
    res.send(buffer);
  }

  @Get('admin/reports/debts/export/pdf')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  async adminDebtsPdf(@CurrentUser() user: any, @Query() query: DebtsReportQueryDto, @Res() res: Response) {
    const buffer = await this.reportsService.exportAdminDebtsPdf(user, query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="debts-report.pdf"');
    res.send(buffer);
  }

  @Get('admin/reports/debts/export/xlsx')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  async adminDebtsXlsx(@CurrentUser() user: any, @Query() query: DebtsReportQueryDto, @Res() res: Response) {
    const buffer = await this.reportsService.exportAdminDebtsXlsx(user, query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="debts-report.xlsx"');
    res.send(buffer);
  }

  @Get('admin/reports/payments/export/xlsx')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  async adminPaymentsXlsx(@CurrentUser() user: any, @Query() query: PaymentsReportQueryDto, @Res() res: Response) {
    const buffer = await this.reportsService.exportAdminPaymentsXlsx(user, query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="payments-register.xlsx"');
    res.send(buffer);
  }

  @Get('resident/reports/statement/export/pdf')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  async residentStatementPdf(@CurrentUser() user: any, @Query() query: ResidentStatementQueryDto, @Res() res: Response) {
    const buffer = await this.reportsService.exportResidentStatementPdf(user, query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="resident-statement.pdf"');
    res.send(buffer);
  }

  @Get('superadmin/reports/platform/export/xlsx')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  async superadminPlatformXlsx(@CurrentUser() user: any, @Res() res: Response) {
    const buffer = await this.reportsService.exportSuperadminPlatformXlsx(user);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="platform-report.xlsx"');
    res.send(buffer);
  }
}
