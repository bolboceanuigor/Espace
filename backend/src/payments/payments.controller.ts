import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { AdminManualPaymentDto, AdminPaymentsQueryDto, ResidentCreateIntentDto, UpdatePaymentProviderConfigDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

@Controller('api')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('admin/payments')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminList(@CurrentUser() user: any, @Query() query: AdminPaymentsQueryDto) {
    return this.paymentsService.adminList(user, query);
  }

  @Post('admin/payments/manual')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminCreateManual(@CurrentUser() user: any, @Body() dto: AdminManualPaymentDto) {
    return this.paymentsService.adminCreateManual(user, dto);
  }

  @Patch('admin/payments/:id/confirm')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminConfirm(@CurrentUser() user: any, @Param('id') id: string) {
    return this.paymentsService.adminConfirm(user, id);
  }

  @Patch('admin/payments/:id/cancel')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminCancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.paymentsService.adminCancel(user, id);
  }

  @Get('admin/payment-providers')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminListPaymentProviders(@CurrentUser() user: any) {
    return this.paymentsService.adminListPaymentProviders(user);
  }

  @Patch('admin/payment-providers/:provider')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminUpdatePaymentProvider(@CurrentUser() user: any, @Param('provider') provider: string, @Body() dto: UpdatePaymentProviderConfigDto) {
    return this.paymentsService.adminUpdatePaymentProvider(user, provider, dto);
  }

  @Get('resident/payments')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentList(@CurrentUser() user: any) {
    return this.paymentsService.residentList(user);
  }

  @Post('resident/payments/create-intent')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentCreateIntent(@CurrentUser() user: any, @Body() dto: ResidentCreateIntentDto) {
    return this.paymentsService.residentCreateIntent(user, dto);
  }

  @Get('resident/payment-providers')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentListProviders(@CurrentUser() user: any) {
    return this.paymentsService.residentListPaymentProviders(user);
  }

  @Get('resident/payments/:id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentStatus(@CurrentUser() user: any, @Param('id') id: string) {
    return this.paymentsService.residentPaymentStatus(user, id);
  }

  @Post('payments/webhook/:provider')
  webhook(@Param('provider') provider: string, @Body() payload: any, @Headers() headers: Record<string, any>) {
    return this.paymentsService.webhook(provider, payload, headers);
  }
}
