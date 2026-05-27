import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard } from '../security/mvp-auth.guard';
import { SaasInvoicesService } from './saas-invoices.service';

@Controller('api')
export class SaasInvoicesController {
  constructor(private readonly service: SaasInvoicesService) {}

  @Get('superadmin/billing/saas-invoices')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminList(@Query() query: Record<string, unknown>) {
    return this.service.superadminList(query);
  }

  @Get('superadmin/billing/saas-invoices/stats')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminStats() {
    return this.service.superadminStats();
  }

  @Post('superadmin/billing/saas-invoices')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  createManual(@Req() request: any, @Body() body: unknown) {
    return this.service.createManual(request.user, body);
  }

  @Post('superadmin/billing/saas-invoices/from-subscription')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  createFromSubscription(@Req() request: any, @Body() body: unknown) {
    return this.service.createFromSubscription(request.user, body);
  }

  @Get('superadmin/billing/saas-invoices/:id')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminGet(@Param('id') id: string) {
    return this.service.superadminGet(id);
  }

  @Patch('superadmin/billing/saas-invoices/:id')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  updateDraft(@Req() request: any, @Param('id') id: string, @Body() body: unknown) {
    return this.service.updateDraft(request.user, id, body);
  }

  @Patch('superadmin/billing/saas-invoices/:id/issue')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  issue(@Req() request: any, @Param('id') id: string) {
    return this.service.issue(request.user, id);
  }

  @Patch('superadmin/billing/saas-invoices/:id/mark-paid')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  markPaid(@Req() request: any, @Param('id') id: string, @Body() body: unknown) {
    return this.service.markPaid(request.user, id, body);
  }

  @Patch('superadmin/billing/saas-invoices/:id/cancel')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  cancel(@Req() request: any, @Param('id') id: string, @Body() body: unknown) {
    return this.service.cancel(request.user, id, body);
  }

  @Patch('superadmin/billing/saas-invoices/:id/void')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  void(@Req() request: any, @Param('id') id: string, @Body() body: unknown) {
    return this.service.void(request.user, id, body);
  }

  @Get('superadmin/billing/saas-invoices/:id/events')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  events(@Param('id') id: string) {
    return this.service.events(id);
  }

  @Get('superadmin/associations/:id/saas-invoices')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  associationInvoices(@Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.service.associationInvoices(id, query);
  }

  @Get('admin/subscription/invoices')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  adminList(@Req() request: any) {
    return this.service.adminList(request.user);
  }

  @Get('admin/subscription/invoices/:id')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  adminGet(@Req() request: any, @Param('id') id: string) {
    return this.service.adminGet(request.user, id);
  }
}
