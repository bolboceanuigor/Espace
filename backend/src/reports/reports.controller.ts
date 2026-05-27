import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { SaasLimitEnforcementService } from '../saas-usage/saas-limit-enforcement.service';
import { ReportsService } from './reports.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly saasLimits: SaasLimitEnforcementService,
  ) {}

  @Get(['admin/reports/debts', 'api/admin/reports/debts'])
  async adminDebts(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    await this.saasLimits.assertFeatureEnabled(user.organizationId, 'financialReports', user);
    return this.reportsService.adminDebts(user, query);
  }

  @Get(['admin/reports/payments', 'api/admin/reports/payments'])
  async adminPayments(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    await this.saasLimits.assertFeatureEnabled(user.organizationId, 'financialReports', user);
    return this.reportsService.adminPayments(user, query);
  }

  @Get(['admin/reports/monthly', 'api/admin/reports/monthly'])
  async adminMonthly(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    await this.saasLimits.assertFeatureEnabled(user.organizationId, 'financialReports', user);
    return this.reportsService.adminMonthly(user, query);
  }

  @Get(['admin/reports/charges', 'api/admin/reports/charges'])
  async adminCharges(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    await this.saasLimits.assertFeatureEnabled(user.organizationId, 'financialReports', user);
    return this.reportsService.adminCharges(user, query);
  }

  @Get(['admin/reports/apartments', 'api/admin/reports/apartments'])
  async adminApartments(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    await this.saasLimits.assertFeatureEnabled(user.organizationId, 'financialReports', user);
    return this.reportsService.adminApartments(user, query);
  }

  @Get(['admin/reports/residents', 'api/admin/reports/residents'])
  async adminResidents(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    await this.saasLimits.assertFeatureEnabled(user.organizationId, 'financialReports', user);
    return this.reportsService.adminResidents(user, query);
  }

  @Get(['admin/reports/debts.csv', 'api/admin/reports/debts.csv'])
  async adminDebtsCsv(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>, @Res() res: Response) {
    await this.saasLimits.assertCanExportCsv(user.organizationId, 'debts-report', user);
    this.sendCsv(res, await this.reportsService.adminDebtsCsv(user, query), 'raport-datorii.csv');
  }

  @Get(['admin/reports/payments.csv', 'api/admin/reports/payments.csv'])
  async adminPaymentsCsv(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>, @Res() res: Response) {
    await this.saasLimits.assertCanExportCsv(user.organizationId, 'payments-report', user);
    this.sendCsv(res, await this.reportsService.adminPaymentsCsv(user, query), 'raport-plati.csv');
  }

  @Get(['admin/reports/monthly.csv', 'api/admin/reports/monthly.csv'])
  async adminMonthlyCsv(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>, @Res() res: Response) {
    await this.saasLimits.assertCanExportCsv(user.organizationId, 'monthly-report', user);
    this.sendCsv(res, await this.reportsService.adminMonthlyCsv(user, query), 'raport-lunar.csv');
  }

  @Get(['admin/reports/apartments.csv', 'api/admin/reports/apartments.csv'])
  async adminApartmentsCsv(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>, @Res() res: Response) {
    await this.saasLimits.assertCanExportCsv(user.organizationId, 'apartments-report', user);
    this.sendCsv(res, await this.reportsService.adminApartmentsCsv(user, query), 'raport-apartamente.csv');
  }

  @Get(['admin/reports/residents.csv', 'api/admin/reports/residents.csv'])
  async adminResidentsCsv(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>, @Res() res: Response) {
    await this.saasLimits.assertCanExportCsv(user.organizationId, 'residents-report', user);
    this.sendCsv(res, await this.reportsService.adminResidentsCsv(user, query), 'raport-locatari.csv');
  }

  private sendCsv(res: Response, csv: string, filename: string) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
