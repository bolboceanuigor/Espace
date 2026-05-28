import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { AdminSearchService } from './admin-search.service';
import { ExecuteAdminCommandDto, SaveAdminSearchHistoryDto } from './dto/admin-search.dto';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class AdminSearchController {
  constructor(private readonly service: AdminSearchService) {}

  @Get(['admin/search', 'api/admin/search'])
  @RequirePermission('DASHBOARD', 'VIEW')
  search(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.service.searchAll(user, query);
  }

  @Get(['admin/search/recent', 'api/admin/search/recent'])
  @RequirePermission('DASHBOARD', 'VIEW')
  recent(@CurrentUser() user: MvpUser) {
    return this.service.recent(user);
  }

  @Post(['admin/search/recent', 'api/admin/search/recent'])
  @RequirePermission('DASHBOARD', 'VIEW')
  saveRecent(@CurrentUser() user: MvpUser, @Body() dto: SaveAdminSearchHistoryDto) {
    return this.service.saveRecent(user, dto);
  }

  @Delete(['admin/search/recent', 'api/admin/search/recent'])
  @RequirePermission('DASHBOARD', 'VIEW')
  clearRecent(@CurrentUser() user: MvpUser) {
    return this.service.clearRecent(user);
  }

  @Get(['admin/commands', 'api/admin/commands'])
  @RequirePermission('DASHBOARD', 'VIEW')
  commands(@CurrentUser() user: MvpUser) {
    return this.service.commands(user);
  }

  @Post(['admin/commands/:commandKey/execute', 'api/admin/commands/:commandKey/execute'])
  @RequirePermission('DASHBOARD', 'VIEW')
  execute(@CurrentUser() user: MvpUser, @Param('commandKey') commandKey: string, @Body() _dto: ExecuteAdminCommandDto) {
    return this.service.executeCommand(user, commandKey);
  }
}
