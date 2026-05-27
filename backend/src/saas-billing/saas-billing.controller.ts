import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard } from '../security/mvp-auth.guard';
import { SaasBillingService } from './saas-billing.service';

@Controller('api/superadmin')
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.SUPERADMIN)
export class SaasBillingController {
  constructor(private readonly service: SaasBillingService) {}

  @Get('billing/overview')
  overview() {
    return this.service.overview();
  }

  @Get('billing/plans')
  listPlans(@Query() query: Record<string, unknown>) {
    return this.service.listPlans(query);
  }

  @Post('billing/plans')
  createPlan(@CurrentUser() user: any, @Body() body: unknown) {
    return this.service.createPlan(user, body);
  }

  @Get('billing/plans/:id')
  getPlan(@Param('id') id: string) {
    return this.service.getPlan(id);
  }

  @Patch('billing/plans/:id')
  updatePlan(@CurrentUser() user: any, @Param('id') id: string, @Body() body: unknown) {
    return this.service.updatePlan(user, id, body);
  }

  @Patch('billing/plans/:id/status')
  updatePlanStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() body: unknown) {
    return this.service.updatePlanStatus(user, id, body);
  }

  @Post('billing/plans/:id/duplicate')
  duplicatePlan(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.duplicatePlan(user, id);
  }

  @Get('billing/plans/:id/associations')
  planAssociations(@Param('id') id: string) {
    return this.service.planAssociations(id);
  }

  @Get('billing/subscriptions')
  listSubscriptions(@Query() query: Record<string, unknown>) {
    return this.service.listSubscriptions(query);
  }

  @Post('billing/subscriptions')
  createSubscription(@CurrentUser() user: any, @Body() body: unknown) {
    return this.service.createOrAssignSubscription(user, body);
  }

  @Get('billing/subscriptions/:id')
  getSubscription(@Param('id') id: string) {
    return this.service.getSubscription(id);
  }

  @Patch('billing/subscriptions/:id/change-plan')
  changePlan(@CurrentUser() user: any, @Param('id') id: string, @Body() body: unknown) {
    return this.service.changePlan(user, id, body);
  }

  @Patch('billing/subscriptions/:id/activate')
  activate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.activate(user, id);
  }

  @Patch('billing/subscriptions/:id/suspend')
  suspend(@CurrentUser() user: any, @Param('id') id: string, @Body() body: unknown) {
    return this.service.suspend(user, id, body);
  }

  @Patch('billing/subscriptions/:id/reactivate')
  reactivate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.reactivate(user, id);
  }

  @Patch('billing/subscriptions/:id/cancel')
  cancel(@CurrentUser() user: any, @Param('id') id: string, @Body() body: unknown) {
    return this.service.cancel(user, id, body);
  }

  @Post('billing/subscriptions/:id/notes')
  addNote(@CurrentUser() user: any, @Param('id') id: string, @Body() body: unknown) {
    return this.service.addNote(user, id, body);
  }

  @Get('associations/:id/subscription')
  getAssociationSubscription(@Param('id') id: string) {
    return this.service.getAssociationSubscription(id);
  }

  @Post('associations/:id/subscription/assign-plan')
  assignAssociationPlan(@CurrentUser() user: any, @Param('id') id: string, @Body() body: unknown) {
    return this.service.createOrAssignSubscription(user, body, id);
  }

  @Get('associations/:id/subscription/usage')
  getAssociationUsage(@Param('id') id: string) {
    return this.service.getAssociationUsage(id);
  }
}
