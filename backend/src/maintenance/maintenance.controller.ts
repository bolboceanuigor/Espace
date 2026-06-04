import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequiresPermissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, type MvpUser } from '../security/mvp-auth.guard';
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
@UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get(['admin/suppliers', 'admin/service-providers'])
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('suppliers.view')
  @AllowsPastDue()
  listSuppliers(@CurrentUser() user: MvpUser, @Query() query: SupplierFiltersDto) {
    return this.maintenanceService.listSuppliers(user, query);
  }

  @Post(['admin/suppliers', 'admin/service-providers'])
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('suppliers.manage')
  @RequiresActiveSubscription()
  createSupplier(@CurrentUser() user: MvpUser, @Body() body: CreateSupplierDto) {
    return this.maintenanceService.createSupplier(user, body);
  }

  @Patch(['admin/suppliers/:id', 'admin/service-providers/:id'])
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('suppliers.manage')
  @RequiresActiveSubscription()
  updateSupplier(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: UpdateSupplierDto) {
    return this.maintenanceService.updateSupplier(user, id, body);
  }

  @Delete(['admin/suppliers/:id', 'admin/service-providers/:id'])
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('suppliers.manage')
  @RequiresActiveSubscription()
  deleteSupplier(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.maintenanceService.deleteSupplier(user, id);
  }

  @Get('admin/maintenance/tasks')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('maintenance.view')
  @AllowsPastDue()
  listTasks(@CurrentUser() user: MvpUser, @Query() query: MaintenanceTaskFiltersDto) {
    return this.maintenanceService.listMaintenanceTasks(user, query);
  }

  @Post('admin/maintenance/tasks')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('maintenance.manage')
  @RequiresActiveSubscription()
  createTask(@CurrentUser() user: MvpUser, @Body() body: CreateMaintenanceTaskDto) {
    return this.maintenanceService.createMaintenanceTask(user, body);
  }

  @Get('admin/maintenance/events')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('maintenance.view')
  @AllowsPastDue()
  listMaintenanceEvents(@CurrentUser() user: MvpUser, @Query() query: MaintenanceEventFiltersDto) {
    return this.maintenanceService.listMaintenanceEvents(user, query);
  }

  @Post('admin/maintenance/events')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('maintenance.manage')
  @RequiresActiveSubscription()
  createMaintenanceEvent(@CurrentUser() user: MvpUser, @Body() body: CreateMaintenanceEventDto) {
    return this.maintenanceService.createMaintenanceEvent(user, body);
  }

  @Patch('admin/maintenance/events/:id')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('maintenance.manage')
  @RequiresActiveSubscription()
  updateMaintenanceEvent(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: UpdateMaintenanceEventDto) {
    return this.maintenanceService.updateMaintenanceEvent(user, id, body);
  }

  @Delete('admin/maintenance/events/:id')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('maintenance.manage')
  @RequiresActiveSubscription()
  deleteMaintenanceEvent(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.maintenanceService.deleteMaintenanceEvent(user, id);
  }

  @Post('admin/issues/:issueId/maintenance-task')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('maintenance.manage')
  @RequiresActiveSubscription()
  createTaskFromIssue(
    @CurrentUser() user: MvpUser,
    @Param('issueId') issueId: string,
    @Body() body: Partial<CreateMaintenanceTaskDto>,
  ) {
    return this.maintenanceService.createMaintenanceTaskFromIssue(user, issueId, body);
  }

  @Patch('admin/maintenance/tasks/:id')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('maintenance.manage')
  @RequiresActiveSubscription()
  updateTask(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: UpdateMaintenanceTaskDto) {
    return this.maintenanceService.updateMaintenanceTask(user, id, body);
  }

  @Delete('admin/maintenance/tasks/:id')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('maintenance.manage')
  @RequiresActiveSubscription()
  deleteTask(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.maintenanceService.deleteMaintenanceTask(user, id);
  }

  @Get('technician/tasks')
  @Roles(Role.ADMIN)
  @RequiresPermissions('maintenance.view')
  technicianTasks(@CurrentUser() user: MvpUser) {
    return this.maintenanceService.technicianTasks(user);
  }

  @Patch('technician/tasks/:id')
  @Roles(Role.ADMIN)
  @RequiresPermissions('maintenance.manage')
  technicianUpdateTask(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: TechnicianUpdateTaskDto) {
    return this.maintenanceService.technicianUpdateTask(user, id, body);
  }

  @Get('resident/maintenance/events')
  @Roles(Role.RESIDENT)
  listResidentMaintenanceEvents(@CurrentUser() user: MvpUser, @Query() query: MaintenanceEventFiltersDto) {
    return this.maintenanceService.listResidentMaintenanceEvents(user, query);
  }

  @Get('admin/expenses')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('expenses.view')
  @AllowsPastDue()
  listExpenses(@CurrentUser() user: MvpUser, @Query() query: ExpenseFiltersDto) {
    return this.maintenanceService.listExpenses(user, query);
  }

  @Post('admin/expenses')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('expenses.manage')
  @RequiresActiveSubscription()
  createExpense(@CurrentUser() user: MvpUser, @Body() body: CreateExpenseDto) {
    return this.maintenanceService.createExpense(user, body);
  }

  @Patch('admin/expenses/:id')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('expenses.manage')
  @RequiresActiveSubscription()
  updateExpense(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: UpdateExpenseDto) {
    return this.maintenanceService.updateExpense(user, id, body);
  }

  @Delete('admin/expenses/:id')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('expenses.manage')
  @RequiresActiveSubscription()
  deleteExpense(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.maintenanceService.deleteExpense(user, id);
  }

  @Post('admin/expenses/:id/attachments')
  @UseGuards(SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('expenses.manage')
  @RequiresActiveSubscription()
  addAttachment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: CreateExpenseAttachmentDto) {
    return this.maintenanceService.addExpenseAttachment(user, id, body);
  }
}
