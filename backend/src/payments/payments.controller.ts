import { Body, Controller, Get, GoneException, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AdminManualPaymentDto, AdminPaymentsQueryDto, ResidentCreateIntentDto, UpdatePaymentProviderConfigDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

@Controller('api')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('admin/payments')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('PAYMENTS', 'VIEW')
  adminList(@CurrentUser() user: any, @Query() query: AdminPaymentsQueryDto) {
    return this.paymentsService.adminList(user, query);
  }

  @Post('admin/payments/manual')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('PAYMENTS', 'CREATE')
  adminCreateManual(@CurrentUser() user: any, @Body() dto: AdminManualPaymentDto) {
    throw new GoneException('Plățile manuale legacy sunt dezactivate pentru pilot. Folosește /api/admin/payments.');
  }

  @Patch('admin/payments/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('PAYMENTS', 'CREATE')
  adminConfirm(@CurrentUser() user: any, @Param('id') id: string) {
    throw new GoneException('Confirmarea plăților legacy este dezactivată pentru pilot.');
  }

  @Patch('admin/payments/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('PAYMENTS', 'CANCEL')
  adminCancel(@CurrentUser() user: any, @Param('id') id: string) {
    throw new GoneException('Anularea plăților legacy este dezactivată pentru pilot.');
  }

  @Get('admin/payment-providers')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('SETTINGS', 'VIEW')
  adminListPaymentProviders(@CurrentUser() user: any) {
    return this.paymentsService.adminListPaymentProviders(user);
  }

  @Patch('admin/payment-providers/:provider')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('SETTINGS', 'MANAGE')
  adminUpdatePaymentProvider(@CurrentUser() user: any, @Param('provider') provider: string, @Body() dto: UpdatePaymentProviderConfigDto) {
    return this.paymentsService.adminUpdatePaymentProvider(user, provider, dto);
  }

  @Get('resident/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESIDENT)
  residentList(@CurrentUser() user: any) {
    return this.paymentsService.residentList(user);
  }

  @Post('resident/payments/create-intent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESIDENT)
  residentCreateIntent(@CurrentUser() user: any, @Body() dto: ResidentCreateIntentDto) {
    throw new GoneException('Intenturile legacy de plată sunt dezactivate pentru pilot. Folosește fluxul de dovadă de plată.');
  }

  @Get('resident/payment-providers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESIDENT)
  residentListProviders(@CurrentUser() user: any) {
    return this.paymentsService.residentListPaymentProviders(user);
  }

  @Get('resident/payments/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESIDENT)
  residentStatus(@CurrentUser() user: any, @Param('id') id: string) {
    return this.paymentsService.residentPaymentStatus(user, id);
  }

  @Post('payments/webhook/:provider')
  webhook(@Param('provider') provider: string, @Body() payload: any, @Headers() headers: Record<string, any>) {
    throw new GoneException('Webhook-urile legacy de plată sunt dezactivate pentru pilot.');
  }
}
