import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission, RequiresPermissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminRbacService } from './admin-rbac.service';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles(Role.ADMIN)
export class AdminRbacController {
  constructor(private readonly rbacService: AdminRbacService) {}

  @Get('settings/roles')
  @RequirePermission('TEAM', 'VIEW')
  listRoles(@CurrentUser() user: any) {
    return this.rbacService.listRoles(user);
  }

  @Post('settings/roles')
  @RequirePermission('TEAM', 'MANAGE')
  createRole(@CurrentUser() user: any, @Body() body: any) {
    return this.rbacService.createRole(user, body);
  }

  @Get('settings/roles/:id')
  @RequirePermission('TEAM', 'VIEW')
  getRole(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rbacService.getRole(user, id);
  }

  @Patch('settings/roles/:id')
  @RequirePermission('TEAM', 'MANAGE')
  updateRole(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.rbacService.updateRole(user, id, body);
  }

  @Delete('settings/roles/:id')
  @RequirePermission('TEAM', 'MANAGE')
  deleteRole(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rbacService.deleteRole(user, id);
  }

  @Post('settings/roles/:id/duplicate')
  @RequirePermission('TEAM', 'MANAGE')
  duplicateRole(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rbacService.duplicateRole(user, id);
  }

  @Patch('settings/roles/:id/permissions')
  @RequirePermission('TEAM', 'MANAGE')
  updateRolePermissions(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.rbacService.updateRolePermissions(user, id, body);
  }

  @Post('settings/roles/:id/reset-preset')
  @RequirePermission('TEAM', 'MANAGE')
  resetPreset(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rbacService.resetPreset(user, id);
  }

  @Get('settings/permissions')
  @RequirePermission('TEAM', 'VIEW')
  listPermissions(@CurrentUser() user: any) {
    return this.rbacService.listPermissions(user);
  }

  @Get('settings/permissions/matrix')
  @RequirePermission('TEAM', 'VIEW')
  getMatrix(@CurrentUser() user: any) {
    return this.rbacService.getMatrix(user);
  }

  @Patch('settings/permissions/matrix')
  @RequirePermission('TEAM', 'MANAGE')
  updateMatrix(@CurrentUser() user: any, @Body() body: any) {
    return this.rbacService.updateMatrix(user, body);
  }

  @Get('settings/permissions/my')
  @RequiresPermissions()
  myPermissions(@CurrentUser() user: any) {
    return this.rbacService.myPermissions(user);
  }

  @Get('team/:id/permissions')
  @RequirePermission('TEAM', 'VIEW')
  getTeamMemberPermissions(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rbacService.getTeamMemberPermissions(user, id);
  }

  @Patch('team/:id/role')
  @RequirePermission('TEAM', 'MANAGE')
  updateTeamMemberRole(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.rbacService.updateTeamMemberRole(user, id, body);
  }

  @Get('team/permissions-members')
  @RequirePermission('TEAM', 'VIEW')
  listTeamMembers(@CurrentUser() user: any, @Query() query: Record<string, unknown>) {
    return this.rbacService.listTeamMembers(user, query);
  }
}
