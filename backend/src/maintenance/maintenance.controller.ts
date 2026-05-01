import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import {
  CreateMaintenanceEventDto,
  CreateExpenseAttachmentDto,
  CreateExpenseDto,
  CreateMaintenanceTaskDto,
  CreateSupplierDto,
  ExpenseFiltersDto,
  MaintenanceEventFiltersDto,
  MaintenanceTaskFiltersDto,
  SupplierFiltersDto,
  TechnicianUpdateTaskDto,
  UpdateMaintenanceEventDto,
  UpdateExpenseDto,
  UpdateMaintenanceTaskDto,
  UpdateSupplierDto,
} from './dto/maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@Controller('api')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('admin/suppliers')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  listSuppliers(@CurrentUser() user: any, @Query() query: SupplierFiltersDto) {
    return this.maintenanceService.listSuppliers(user, query);
  }

  @Post('admin/suppliers')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  createSupplier(@CurrentUser() user: any, @Body() body: CreateSupplierDto) {
    return this.maintenanceService.createSupplier(user, body);
  }

  @Patch('admin/suppliers/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  updateSupplier(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateSupplierDto) {
    return this.maintenanceService.updateSupplier(user, id, body);
  }

  @Delete('admin/suppliers/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  deleteSupplier(@CurrentUser() user: any, @Param('id') id: string) {
    return this.maintenanceService.deleteSupplier(user, id);
  }

  @Get('admin/maintenance/tasks')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  listTasks(@CurrentUser() user: any, @Query() query: MaintenanceTaskFiltersDto) {
    return this.maintenanceService.listMaintenanceTasks(user, query);
  }

  @Post('admin/maintenance/tasks')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  createTask(@CurrentUser() user: any, @Body() body: CreateMaintenanceTaskDto) {
    return this.maintenanceService.createMaintenanceTask(user, body);
  }

  @Get('admin/maintenance/events')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  listMaintenanceEvents(@CurrentUser() user: any, @Query() query: MaintenanceEventFiltersDto) {
    return this.maintenanceService.listMaintenanceEvents(user, query);
  }

  @Post('admin/maintenance/events')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  createMaintenanceEvent(@CurrentUser() user: any, @Body() body: CreateMaintenanceEventDto) {
    return this.maintenanceService.createMaintenanceEvent(user, body);
  }

  @Patch('admin/maintenance/events/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  updateMaintenanceEvent(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateMaintenanceEventDto) {
    return this.maintenanceService.updateMaintenanceEvent(user, id, body);
  }

  @Delete('admin/maintenance/events/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  deleteMaintenanceEvent(@CurrentUser() user: any, @Param('id') id: string) {
    return this.maintenanceService.deleteMaintenanceEvent(user, id);
  }

  @Post('admin/issues/:issueId/maintenance-task')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  createTaskFromIssue(
    @CurrentUser() user: any,
    @Param('issueId') issueId: string,
    @Body() body: Partial<CreateMaintenanceTaskDto>,
  ) {
    return this.maintenanceService.createMaintenanceTaskFromIssue(user, issueId, body);
  }

  @Patch('admin/maintenance/tasks/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  updateTask(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateMaintenanceTaskDto) {
    return this.maintenanceService.updateMaintenanceTask(user, id, body);
  }

  @Delete('admin/maintenance/tasks/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  deleteTask(@CurrentUser() user: any, @Param('id') id: string) {
    return this.maintenanceService.deleteMaintenanceTask(user, id);
  }

  @Get('technician/tasks')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  technicianTasks(@CurrentUser() user: any) {
    return this.maintenanceService.technicianTasks(user);
  }

  @Patch('technician/tasks/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  technicianUpdateTask(@CurrentUser() user: any, @Param('id') id: string, @Body() body: TechnicianUpdateTaskDto) {
    return this.maintenanceService.technicianUpdateTask(user, id, body);
  }

  @Get('resident/maintenance/events')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  listResidentMaintenanceEvents(@CurrentUser() user: any, @Query() query: MaintenanceEventFiltersDto) {
    return this.maintenanceService.listResidentMaintenanceEvents(user, query);
  }

  @Get('admin/expenses')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  listExpenses(@CurrentUser() user: any, @Query() query: ExpenseFiltersDto) {
    return this.maintenanceService.listExpenses(user, query);
  }

  @Post('admin/expenses')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  createExpense(@CurrentUser() user: any, @Body() body: CreateExpenseDto) {
    return this.maintenanceService.createExpense(user, body);
  }

  @Patch('admin/expenses/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  updateExpense(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateExpenseDto) {
    return this.maintenanceService.updateExpense(user, id, body);
  }

  @Delete('admin/expenses/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  deleteExpense(@CurrentUser() user: any, @Param('id') id: string) {
    return this.maintenanceService.deleteExpense(user, id);
  }

  @Post('admin/expenses/:id/attachments')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  addAttachment(@CurrentUser() user: any, @Param('id') id: string, @Body() body: CreateExpenseAttachmentDto) {
    return this.maintenanceService.addExpenseAttachment(user, id, body);
  }
}

