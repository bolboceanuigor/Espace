import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BulkEntityType, Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { BulkOperationCancelDto, BulkOperationConfirmDto, BulkOperationPreviewDto } from './dto/bulk-operation.dto';
import { BulkOperationsService } from './bulk-operations.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class BulkOperationsController {
  constructor(private readonly service: BulkOperationsService) {}

  @Get(['admin/bulk-operations', 'api/admin/bulk-operations'])
  @RequirePermission('EXPORTS', 'VIEW')
  list(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.service.list(user, query);
  }

  @Get(['admin/bulk-operations/available-actions', 'api/admin/bulk-operations/available-actions'])
  @RequirePermission('EXPORTS', 'VIEW')
  availableActions(@CurrentUser() user: MvpUser, @Query('entityType') entityType: BulkEntityType) {
    return this.service.availableActions(user, entityType);
  }

  @Post(['admin/bulk-operations/preview', 'api/admin/bulk-operations/preview'])
  @RequirePermission('EXPORTS', 'EXPORT')
  preview(@CurrentUser() user: MvpUser, @Body() dto: BulkOperationPreviewDto) {
    return this.service.createPreview(user, dto);
  }

  @Get(['admin/bulk-operations/:id', 'api/admin/bulk-operations/:id'])
  @RequirePermission('EXPORTS', 'VIEW')
  get(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.getOperation(user, id);
  }

  @Get(['admin/bulk-operations/:id/items', 'api/admin/bulk-operations/:id/items'])
  @RequirePermission('EXPORTS', 'VIEW')
  items(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.items(user, id);
  }

  @Post(['admin/bulk-operations/:id/confirm', 'api/admin/bulk-operations/:id/confirm'])
  @RequirePermission('EXPORTS', 'EXPORT')
  confirm(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() dto: BulkOperationConfirmDto) {
    return this.service.confirm(user, id, dto.confirm);
  }

  @Patch(['admin/bulk-operations/:id/cancel', 'api/admin/bulk-operations/:id/cancel'])
  @RequirePermission('EXPORTS', 'EXPORT')
  cancel(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() dto: BulkOperationCancelDto) {
    return this.service.cancel(user, id, dto);
  }

  @Get(['admin/bulk-operations/:id/result', 'api/admin/bulk-operations/:id/result'])
  @RequirePermission('EXPORTS', 'VIEW')
  result(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.result(user, id);
  }
}
