import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission, RequiresPermissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminAssociationGuard } from '../association-context/admin-association.guard';
import { AdminRbacService } from './admin-rbac.service';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard, AdminAssociationGuard, PermissionGuard)
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

  @Get('team/stats')
  @RequirePermission('TEAM', 'VIEW')
  getTeamStats(@CurrentUser() user: any) {
    return this.rbacService.getTeamStats(user);
  }

  @Get('team/invitations')
  @RequirePermission('TEAM', 'VIEW')
  listStaffInvitations(@CurrentUser() user: any, @Query() query: Record<string, unknown>) {
    return this.rbacService.listStaffInvitations(user, query);
  }

  @Post('team/invitations')
  @RequirePermission('TEAM', 'INVITE')
  createStaffInvitation(@CurrentUser() user: any, @Body() body: any) {
    return this.rbacService.createStaffInvitation(user, body);
  }

  @Get('team/invitations/:id')
  @RequirePermission('TEAM', 'VIEW')
  getStaffInvitation(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rbacService.getStaffInvitation(user, id);
  }

  @Post('team/invitations/:id/regenerate')
  @RequirePermission('TEAM', 'INVITE')
  regenerateStaffInvitation(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rbacService.regenerateStaffInvitation(user, id);
  }

  @Patch('team/invitations/:id/mark-sent')
  @RequirePermission('TEAM', 'INVITE')
  markStaffInvitationSent(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rbacService.markStaffInvitationSent(user, id);
  }

  @Patch('team/invitations/:id/cancel')
  @RequirePermission('TEAM', 'INVITE')
  cancelStaffInvitation(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.rbacService.cancelStaffInvitation(user, id, body || {});
  }

  @Patch('team/invitations/:id/revoke')
  @RequirePermission('TEAM', 'MANAGE')
  revokeStaffInvitation(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.rbacService.revokeStaffInvitation(user, id, body || {});
  }

  @Get('team/invitations/:id/permissions-preview')
  @RequirePermission('TEAM', 'VIEW')
  staffInvitationPermissionsPreview(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rbacService.staffInvitationPermissionsPreview(user, id);
  }

  @Get('team/permissions-members')
  @RequirePermission('TEAM', 'VIEW')
  listTeamMembers(@CurrentUser() user: any, @Query() query: Record<string, unknown>) {
    return this.rbacService.listTeamMembers(user, query);
  }

  @Get('team/activity')
  @RequiresPermissions()
  listTeamActivity(@CurrentUser() user: any, @Query() query: Record<string, unknown>) {
    return this.rbacService.listTeamActivity(user, query);
  }

  @Get('team/activity/stats')
  @RequiresPermissions()
  getTeamActivityStats(@CurrentUser() user: any, @Query() query: Record<string, unknown>) {
    return this.rbacService.getTeamActivityStats(user, query);
  }

  @Get('team/activity/:id')
  @RequiresPermissions()
  getTeamActivityDetail(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rbacService.getTeamActivityDetail(user, id);
  }

  @Get('team/sensitive-actions')
  @RequiresPermissions()
  listSensitiveActions(@CurrentUser() user: any, @Query() query: Record<string, unknown>) {
    return this.rbacService.listSensitiveTeamActions(user, query);
  }

  @Get('team/security')
  @RequiresPermissions()
  listTeamSecurity(@CurrentUser() user: any, @Query() query: Record<string, unknown>) {
    return this.rbacService.listTeamSecurity(user, query);
  }

  @Get('team/security/stats')
  @RequiresPermissions()
  getTeamSecurityStats(@CurrentUser() user: any, @Query() query: Record<string, unknown>) {
    return this.rbacService.getTeamSecurityStats(user, query);
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

  @Patch('team/:id/suspend')
  @RequirePermission('TEAM', 'MANAGE')
  suspendTeamMember(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.rbacService.suspendTeamMember(user, id, body || {});
  }

  @Patch('team/:id/reactivate')
  @RequirePermission('TEAM', 'MANAGE')
  reactivateTeamMember(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.rbacService.reactivateTeamMember(user, id, body || {});
  }

  @Patch('team/:id/revoke')
  @RequirePermission('TEAM', 'MANAGE')
  revokeTeamMember(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.rbacService.revokeTeamMember(user, id, body || {});
  }

  @Get('team/:id/activity')
  @RequirePermission('TEAM', 'VIEW')
  listTeamMemberActivity(@CurrentUser() user: any, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.rbacService.listTeamMemberActivity(user, id, query);
  }

  @Get('team/:id/activity/stats')
  @RequirePermission('TEAM', 'VIEW')
  getTeamMemberActivityStats(@CurrentUser() user: any, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.rbacService.getTeamMemberActivityStats(user, id, query);
  }

  @Get('team/:id')
  @RequirePermission('TEAM', 'VIEW')
  getTeamMember(@CurrentUser() user: any, @Param('id') id: string) {
    return this.rbacService.getTeamMember(user, id);
  }

}
