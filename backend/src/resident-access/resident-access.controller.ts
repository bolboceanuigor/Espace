import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { ResidentAccessService } from './resident-access.service';

@Controller()
export class ResidentAccessController {
  constructor(private readonly residentAccess: ResidentAccessService) {}

  @Get(['admin/resident-access', 'api/admin/resident-access'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  listResidentAccess(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.residentAccess.listResidentAccess(user, query);
  }

  @Get(['admin/resident-access/stats', 'api/admin/resident-access/stats'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  stats(@CurrentUser() user: MvpUser) {
    return this.residentAccess.stats(user);
  }

  @Get(['admin/residents/:id/access', 'api/admin/residents/:id/access'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  residentAccessDetails(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentAccess.getResidentAccess(user, id);
  }

  @Post(['admin/residents/:id/invitations', 'api/admin/residents/:id/invitations'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  createInvitation(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.residentAccess.createInvitation(user, id, body);
  }

  @Get(['admin/resident-access/invitations', 'api/admin/resident-access/invitations'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  invitations(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.residentAccess.listInvitations(user, query);
  }

  @Get(['admin/resident-access/invitations/:id', 'api/admin/resident-access/invitations/:id'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  invitation(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentAccess.getInvitation(user, id);
  }

  @Post(['admin/resident-access/invitations/:id/regenerate', 'api/admin/resident-access/invitations/:id/regenerate'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  regenerateInvitation(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.residentAccess.regenerateInvitation(user, id, body);
  }

  @Patch(['admin/resident-access/invitations/:id/mark-sent', 'api/admin/resident-access/invitations/:id/mark-sent'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  markSent(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentAccess.markSent(user, id);
  }

  @Patch(['admin/resident-access/invitations/:id/cancel', 'api/admin/resident-access/invitations/:id/cancel'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  cancelInvitation(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.residentAccess.cancelInvitation(user, id, body);
  }

  @Post(['admin/residents/:id/portal-access/link-user', 'api/admin/residents/:id/portal-access/link-user'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  linkUser(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.residentAccess.linkUser(user, id, body);
  }

  @Patch(['admin/residents/:id/portal-access/suspend', 'api/admin/residents/:id/portal-access/suspend'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  suspend(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.residentAccess.suspendAccess(user, id, body);
  }

  @Patch(['admin/residents/:id/portal-access/reactivate', 'api/admin/residents/:id/portal-access/reactivate'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  reactivate(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.residentAccess.reactivateAccess(user, id, body);
  }

  @Patch(['admin/residents/:id/portal-access/revoke', 'api/admin/residents/:id/portal-access/revoke'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  revoke(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.residentAccess.revokeAccess(user, id, body);
  }

  @Get(['portal-invitations/:token', 'api/portal-invitations/:token'])
  publicInvitation(@Param('token') token: string) {
    return this.residentAccess.publicInvitation(token);
  }

  @Post(['portal-invitations/:token/accept', 'api/portal-invitations/:token/accept'])
  acceptInvitation(@Param('token') token: string, @Body() body: unknown) {
    return this.residentAccess.acceptInvitation(token, body);
  }

  @Post(['portal-invitations/:token/link-existing', 'api/portal-invitations/:token/link-existing'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  linkExisting(@CurrentUser() user: MvpUser, @Param('token') token: string) {
    return this.residentAccess.linkExistingAuthenticatedUser(user, token);
  }
}
