import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OnlinePaymentProviderType, Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { PaymentIntentService } from './payment-intent.service';
import { PaymentProviderService } from './payment-provider.service';

@Controller('api')
export class OnlinePaymentsController {
  constructor(
    private readonly providers: PaymentProviderService,
    private readonly intents: PaymentIntentService,
  ) {}

  @Get('superadmin/payments/providers')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  listProviders() {
    return this.providers.listProviders();
  }

  @Post('superadmin/payments/providers')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  createProvider(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.providers.createProvider(user, body);
  }

  @Get('superadmin/payments/providers/:id')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  getProvider(@Param('id') id: string) {
    return this.providers.getProvider(id);
  }

  @Patch('superadmin/payments/providers/:id')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  updateProvider(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.providers.updateProvider(user, id, body);
  }

  @Patch('superadmin/payments/providers/:id/status')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  updateProviderStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.providers.updateStatus(user, id, body);
  }

  @Patch('superadmin/payments/providers/:id/default')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  setDefaultProvider(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.providers.setDefault(user, id);
  }

  @Get('superadmin/payments/providers/:id/health')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  providerHealth(@Param('id') id: string) {
    return this.providers.getProviderHealth(id);
  }

  @Post('superadmin/payments/providers/:id/test')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  testProvider(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.providers.testProvider(user, id);
  }

  @Get('superadmin/payments/intents')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminIntents(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.intents.listIntents({ user, scope: 'SUPERADMIN', query });
  }

  @Get('superadmin/payments/intents/:id')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminIntent(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.intents.getIntent(id, { user, scope: 'SUPERADMIN' });
  }

  @Patch('superadmin/payments/intents/:id/cancel')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminCancelIntent(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: any) {
    return this.intents.cancelIntent(id, String(body?.reason || 'Anulat de Superadmin.'), { user, scope: 'SUPERADMIN' });
  }

  @Get('admin/payment-settings')
  @UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('SETTINGS', 'VIEW')
  adminSettings(@CurrentUser() user: MvpUser) {
    return this.intents.getSettings(user);
  }

  @Patch('admin/payment-settings')
  @UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('SETTINGS', 'MANAGE')
  updateAdminSettings(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.intents.updateSettings(user, body);
  }

  @Get('admin/payments/intents')
  @UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('PAYMENTS', 'VIEW')
  adminIntents(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.intents.listIntents({ user, scope: 'ADMIN', query });
  }

  @Get('admin/payments/intents/:id')
  @UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('PAYMENTS', 'VIEW')
  adminIntent(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.intents.getIntent(id, { user, scope: 'ADMIN' });
  }

  @Patch('admin/payments/intents/:id/cancel')
  @UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('PAYMENTS', 'MANAGE')
  adminCancelIntent(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: any) {
    return this.intents.cancelIntent(id, String(body?.reason || 'Anulat de Admin.'), { user, scope: 'ADMIN' });
  }

  @Post('admin/invoices/:id/payment-intents')
  @UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('PAYMENTS', 'CREATE')
  adminCreateIntent(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.intents.createAdminIntent(user, id, body);
  }

  @Get('admin/invoices/:id/payment-intents')
  @UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('PAYMENTS', 'VIEW')
  adminInvoiceIntents(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.intents.listInvoiceIntents(user, id);
  }

  @Post('admin/payments/intents/expire-old')
  @UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('PAYMENTS', 'MANAGE')
  adminExpireOld(@CurrentUser() user: MvpUser) {
    return this.intents.expireOldIntents(user);
  }

  @Post('resident/invoices/:id/payment-intents')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentCreateIntent(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.intents.createResidentIntent(user, id, body);
  }

  @Get('resident/payment-intents')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentIntents(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.intents.listIntents({ user, scope: 'RESIDENT', query });
  }

  @Get('resident/payment-intents/:id')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentIntent(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.intents.getIntent(id, { user, scope: 'RESIDENT' });
  }

  @Patch('resident/payment-intents/:id/cancel')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentCancelIntent(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: any) {
    return this.intents.cancelIntent(id, String(body?.reason || 'Anulat de locatar.'), { user, scope: 'RESIDENT' });
  }

  @Post('payments/webhooks/:providerType')
  webhook(@Param('providerType') providerType: string, @Body() payload: unknown, @Headers() headers: Record<string, unknown>) {
    const normalized = String(providerType || '').toUpperCase() as OnlinePaymentProviderType;
    if (!Object.values(OnlinePaymentProviderType).includes(normalized)) throw new BadRequestException('Provider webhook invalid.');
    return this.providers.parseWebhook(normalized, payload, headers);
  }
}
