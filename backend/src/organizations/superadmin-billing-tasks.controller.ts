import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { SuperadminBillingTasksService } from './superadmin-billing-tasks.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminBillingTasksController {
  constructor(private readonly billingTasksService: SuperadminBillingTasksService) {}

  @Get(['superadmin/billing-tasks', 'api/superadmin/billing-tasks'])
  list(@Query() query: Record<string, string | undefined>) {
    return this.billingTasksService.list(query);
  }

  @Post(['superadmin/billing-tasks', 'api/superadmin/billing-tasks'])
  create(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.billingTasksService.createManualTask(user, body);
  }

  @Patch(['superadmin/billing-tasks/:id', 'api/superadmin/billing-tasks/:id'])
  update(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.billingTasksService.updateTask(user, id, body);
  }

  @Post(['superadmin/billing-tasks/:id/complete', 'api/superadmin/billing-tasks/:id/complete'])
  complete(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingTasksService.completeTask(user, id);
  }

  @Post(['superadmin/billing-tasks/:id/dismiss', 'api/superadmin/billing-tasks/:id/dismiss'])
  dismiss(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.billingTasksService.dismissTask(user, id);
  }

  @Post(['superadmin/billing-tasks/generate', 'api/superadmin/billing-tasks/generate'])
  generate(@CurrentUser() user: MvpUser) {
    return this.billingTasksService.generateAutomaticTasks(user);
  }
}
