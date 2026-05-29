import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { SaasLimitEnforcementService } from '../saas-usage/saas-limit-enforcement.service';
import { BillingDraftsService } from './billing-drafts.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class BillingDraftsController {
  constructor(
    private readonly billingDraftsService: BillingDraftsService,
    private readonly saasLimits: SaasLimitEnforcementService,
  ) {}

  @Get(['admin/billing-drafts/periods', 'api/admin/billing-drafts/periods'])
  @RequirePermission('BILLING', 'VIEW')
  listPeriods(@CurrentUser() user: MvpUser) {
    return this.billingDraftsService.listPeriods(user);
  }

  @Post(['admin/billing-drafts/periods', 'api/admin/billing-drafts/periods'])
  @RequirePermission('BILLING', 'MANAGE')
  async createPeriod(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.billingDraftsService.createPeriod(user, body);
  }

  @Get(['admin/billing-drafts/periods/:id/overview', 'api/admin/billing-drafts/periods/:id/overview'])
  @RequirePermission('BILLING', 'VIEW')
  getOverview(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingDraftsService.getOverview(user, id);
  }

  @Get(['admin/billing-drafts/periods/:id/tariffs', 'api/admin/billing-drafts/periods/:id/tariffs'])
  @RequirePermission('BILLING', 'VIEW')
  getTariffs(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingDraftsService.getTariffs(user, id);
  }

  @Put(['admin/billing-drafts/periods/:id/tariffs', 'api/admin/billing-drafts/periods/:id/tariffs'])
  @RequirePermission('BILLING', 'MANAGE')
  async updateTariffs(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.billingDraftsService.updateTariffs(user, id, body);
  }

  @Post(['admin/billing-drafts/periods/:id/generate', 'api/admin/billing-drafts/periods/:id/generate'])
  @RequirePermission('BILLING', 'MANAGE')
  async generateDrafts(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.billingDraftsService.generateDrafts(user, id, body);
  }

  @Get(['admin/billing-drafts/periods/:id/invoices', 'api/admin/billing-drafts/periods/:id/invoices'])
  @RequirePermission('BILLING', 'VIEW')
  listInvoices(@CurrentUser() user: MvpUser, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.billingDraftsService.listInvoices(user, id, query);
  }

  @Post(['admin/billing-drafts/periods/:id/recalculate', 'api/admin/billing-drafts/periods/:id/recalculate'])
  @RequirePermission('BILLING', 'MANAGE')
  async recalculateDrafts(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.billingDraftsService.recalculateDrafts(user, id, body);
  }

  @Get(['admin/billing-drafts/periods/:id/issues', 'api/admin/billing-drafts/periods/:id/issues'])
  @RequirePermission('BILLING', 'VIEW')
  getIssues(@CurrentUser() user: MvpUser, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.billingDraftsService.getIssues(user, id, query);
  }

  @Post(['admin/billing-drafts/periods/:id/approve', 'api/admin/billing-drafts/periods/:id/approve'])
  @RequirePermission('BILLING', 'MANAGE')
  async approvePeriod(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.billingDraftsService.approvePeriod(user, id, body);
  }

  @Post(['admin/billing-drafts/periods/:id/delete-drafts', 'api/admin/billing-drafts/periods/:id/delete-drafts'])
  @RequirePermission('BILLING', 'MANAGE')
  async deleteDrafts(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.billingDraftsService.deleteDrafts(user, id, body);
  }

  @Get(['admin/billing-drafts/invoices/:invoiceId', 'api/admin/billing-drafts/invoices/:invoiceId'])
  @RequirePermission('BILLING', 'VIEW')
  getInvoice(@CurrentUser() user: MvpUser, @Param('invoiceId') invoiceId: string) {
    return this.billingDraftsService.getInvoice(user, invoiceId);
  }

  @Patch(['admin/billing-drafts/invoices/:invoiceId', 'api/admin/billing-drafts/invoices/:invoiceId'])
  @RequirePermission('BILLING', 'MANAGE')
  async updateInvoice(@CurrentUser() user: MvpUser, @Param('invoiceId') invoiceId: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.billingDraftsService.updateInvoice(user, invoiceId, body);
  }
}
