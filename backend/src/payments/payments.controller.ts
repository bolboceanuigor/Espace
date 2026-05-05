import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminManualPaymentDto, AdminPaymentsQueryDto, ResidentCreateIntentDto, UpdatePaymentProviderConfigDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

@Controller('api')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('admin/payments')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminList(@CurrentUser() user: any, @Query() query: AdminPaymentsQueryDto) {
    return this.paymentsService.adminList(user, query);
  }

  @Post('admin/payments/manual')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminCreateManual(@CurrentUser() user: any, @Body() dto: AdminManualPaymentDto) {
    return this.paymentsService.adminCreateManual(user, dto);
  }

  @Patch('admin/payments/:id/confirm')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminConfirm(@CurrentUser() user: any, @Param('id') id: string) {
    return this.paymentsService.adminConfirm(user, id);
  }

  @Patch('admin/payments/:id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminCancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.paymentsService.adminCancel(user, id);
  }

  @Get('admin/payment-providers')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminListPaymentProviders(@CurrentUser() user: any) {
    return this.paymentsService.adminListPaymentProviders(user);
  }

  @Patch('admin/payment-providers/:provider')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminUpdatePaymentProvider(@CurrentUser() user: any, @Param('provider') provider: string, @Body() dto: UpdatePaymentProviderConfigDto) {
    return this.paymentsService.adminUpdatePaymentProvider(user, provider, dto);
  }

  @Get('resident/payments')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentList(@CurrentUser() user: any) {
    return this.paymentsService.residentList(user);
  }

  @Post('resident/payments/create-intent')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentCreateIntent(@CurrentUser() user: any, @Body() dto: ResidentCreateIntentDto) {
    return this.paymentsService.residentCreateIntent(user, dto);
  }

  @Get('resident/payment-providers')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentListProviders(@CurrentUser() user: any) {
    return this.paymentsService.residentListPaymentProviders(user);
  }

  @Get('resident/payments/:id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentStatus(@CurrentUser() user: any, @Param('id') id: string) {
    return this.paymentsService.residentPaymentStatus(user, id);
  }

  @Post('payments/webhook/:provider')
  webhook(@Param('provider') provider: string, @Body() payload: any, @Headers() headers: Record<string, any>) {
    return this.paymentsService.webhook(provider, payload, headers);
  }
}
