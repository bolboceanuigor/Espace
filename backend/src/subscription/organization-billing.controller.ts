import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  BillingCurrency,
  BillingType,
  OrganizationPaymentMethod,
  OrganizationPaymentStatus,
  OrganizationSubscriptionStatus,
  Role,
} from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationBillingService } from './organization-billing.service';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { SubscriptionAccessGuard } from './subscription-access.guard';
import { AllowsSuspendedViewOnly } from './subscription-access.decorator';

class UpsertOrganizationSubscriptionDto {
  @IsOptional()
  @IsString()
  planId?: string | null;

  @IsEnum(BillingType)
  billingType!: BillingType;

  @IsNumber()
  price!: number;

  @IsEnum(BillingCurrency)
  currency!: BillingCurrency;

  @IsOptional()
  @IsString()
  trialStartDate?: string | null;

  @IsOptional()
  @IsString()
  trialEndDate?: string | null;

  @IsOptional()
  @IsString()
  subscriptionStartDate?: string | null;

  @IsOptional()
  @IsString()
  nextBillingDate?: string | null;

  @IsEnum(OrganizationSubscriptionStatus)
  status!: OrganizationSubscriptionStatus;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

class PatchOrganizationSubscriptionDto {
  @IsOptional()
  @IsEnum(BillingType)
  billingType?: BillingType;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsEnum(BillingCurrency)
  currency?: BillingCurrency;

  @IsOptional()
  @IsString()
  trialStartDate?: string | null;

  @IsOptional()
  @IsString()
  trialEndDate?: string | null;

  @IsOptional()
  @IsString()
  nextBillingDate?: string | null;

  @IsOptional()
  @IsEnum(OrganizationSubscriptionStatus)
  status?: OrganizationSubscriptionStatus;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

class SubscriptionQuickActionDto {
  @IsIn(['START_TRIAL', 'EXTEND_TRIAL_30', 'MARK_ACTIVE', 'MARK_PAST_DUE', 'SUSPEND', 'CANCEL'])
  action!: 'START_TRIAL' | 'EXTEND_TRIAL_30' | 'MARK_ACTIVE' | 'MARK_PAST_DUE' | 'SUSPEND' | 'CANCEL';
}

class CreateOrganizationPaymentDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsNumber()
  amount!: number;

  @IsEnum(BillingCurrency)
  currency!: BillingCurrency;

  @IsEnum(OrganizationPaymentMethod)
  method!: OrganizationPaymentMethod;

  @IsOptional()
  @IsEnum(OrganizationPaymentStatus)
  status?: OrganizationPaymentStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

class ExtendTrialDto {
  @IsNumber()
  days!: number;
}

@Controller('api')
export class OrganizationBillingController {
  constructor(private readonly service: OrganizationBillingService) {}

  @Get('superadmin/subscriptions')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  listForSuperAdmin(@CurrentUser() user: any, @Query('status') status?: OrganizationSubscriptionStatus) {
    return this.service.listSubscriptions(user, status);
  }

  @Get('superadmin/trials')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  listTrials(@CurrentUser() user: any) {
    return this.service.listTrials(user);
  }

  @Post('superadmin/trials/:organizationId/convert')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  convertTrial(@CurrentUser() user: any, @Param('organizationId') organizationId: string) {
    return this.service.convertTrial(user, organizationId);
  }

  @Post('superadmin/trials/:organizationId/extend')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  extendTrial(@CurrentUser() user: any, @Param('organizationId') organizationId: string, @Body() dto: ExtendTrialDto) {
    return this.service.extendTrial(user, organizationId, dto.days);
  }

  @Post('superadmin/trials/:organizationId/mark-lost')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  markTrialLost(@CurrentUser() user: any, @Param('organizationId') organizationId: string) {
    return this.service.markTrialLost(user, organizationId);
  }

  @Post('superadmin/organizations/:id/subscription')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  upsertForOrganization(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpsertOrganizationSubscriptionDto) {
    return this.service.upsertOrganizationSubscription(user, id, dto);
  }

  @Get('superadmin/organizations/:id/subscription')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  getForOrganization(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getOrganizationSubscription(user, id);
  }

  @Patch('superadmin/subscriptions/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  patchSubscription(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: PatchOrganizationSubscriptionDto) {
    return this.service.updateSubscription(user, id, dto);
  }

  @Post('superadmin/subscriptions/:id/generate-invoice')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  generateInvoice(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: { periodStart?: string; periodEnd?: string },
  ) {
    return this.service.generateInvoice(user, id, dto?.periodStart, dto?.periodEnd);
  }

  @Get('superadmin/billing/invoices')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  listBillingInvoices(@CurrentUser() user: any) {
    return this.service.listInvoices(user);
  }

  @Post('superadmin/billing/generate')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  generateMonthlyBilling(@CurrentUser() user: any) {
    return this.service.generateMonthlyInvoices(user);
  }

  @Get('superadmin/billing/invoices/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  getBillingInvoice(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getInvoiceById(user, id);
  }

  @Patch('superadmin/billing/invoices/:id/mark-paid')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  markBillingInvoicePaid(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.markInvoicePaid(user, id);
  }

  @Get('superadmin/billing/payments')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  listBillingPayments(@CurrentUser() user: any) {
    return this.service.listPayments(user);
  }

  @Post('superadmin/billing/payments')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  createBillingPayment(@CurrentUser() user: any, @Body() dto: CreateOrganizationPaymentDto) {
    return this.service.createPayment(user, dto);
  }

  @Patch('superadmin/invoices/:id/mark-paid')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  markPaid(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.markInvoicePaid(user, id);
  }

  @Post('superadmin/subscriptions/:id/quick-action')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  quickAction(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: SubscriptionQuickActionDto) {
    return this.service.applyQuickAction(user, id, dto.action);
  }

  @Get('admin/subscription')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsSuspendedViewOnly()
  adminSubscription(@CurrentUser() user: any) {
    return this.service.adminSubscription(user);
  }

  @Get('admin/subscription/status')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsSuspendedViewOnly()
  adminSubscriptionStatus(@CurrentUser() user: any) {
    return this.service.adminSubscriptionStatus(user);
  }

  @Get('admin/subscription/invoices')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsSuspendedViewOnly()
  adminSubscriptionInvoices(@CurrentUser() user: any) {
    return this.service.adminSubscriptionInvoices(user);
  }
}
