import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { ResidentAccessService } from '../resident-access/resident-access.service';
import { InvitationsMvpService } from './invitations-mvp.service';

@Controller()
export class InvitationsMvpController {
  constructor(
    private readonly invitationsService: InvitationsMvpService,
    private readonly residentAccessService: ResidentAccessService,
  ) {}

  @Post([
    'superadmin/organizations/:organizationId/admin-invitations',
    'api/superadmin/organizations/:organizationId/admin-invitations',
    'organizations/:organizationId/admin-invitations',
    'api/organizations/:organizationId/admin-invitations',
  ])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  createAdminInvitation(
    @CurrentUser() user: MvpUser,
    @Param('organizationId') organizationId: string,
    @Body() body: unknown,
  ) {
    return this.invitationsService.createAdminInvitation(user, organizationId, body);
  }

  @Post(['superadmin/admin-invitations/:id/resend', 'api/superadmin/admin-invitations/:id/resend'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  resendAdminInvitation(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.invitationsService.resendAdminInvitation(user, id, body);
  }

  @Post(['superadmin/admin-invitations/:id/cancel', 'api/superadmin/admin-invitations/:id/cancel'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  cancelAdminInvitation(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.invitationsService.cancelAdminInvitation(user, id);
  }

  @Post(['residents/:residentId/invitations', 'api/residents/:residentId/invitations'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  createResidentInvitation(
    @CurrentUser() user: MvpUser,
    @Param('residentId') residentId: string,
    @Body() body: unknown,
  ) {
    return this.invitationsService.createResidentInvitation(user, residentId, body);
  }

  @Get(['invitations/:token', 'api/invitations/:token', 'auth/invitations/:token', 'api/auth/invitations/:token'])
  async getInvitation(@Param('token') token: string) {
    try {
      return await this.invitationsService.getInvitationByToken(token);
    } catch (error) {
      if (!this.isInvalidLegacyInvitation(error)) throw error;
      return this.residentAccessService.publicInvitation(token);
    }
  }

  @Get(['public/admin-invitations/:token', 'api/public/admin-invitations/:token'])
  getPublicAdminInvitation(@Param('token') token: string) {
    return this.invitationsService.getPublicAdminInvitation(token);
  }

  @Post(['public/admin-invitations/:token/accept', 'api/public/admin-invitations/:token/accept'])
  acceptPublicAdminInvitation(@Param('token') token: string, @Body() body: unknown) {
    return this.invitationsService.acceptPublicAdminInvitation(token, body);
  }

  @Post([
    'invitations/:token/accept',
    'api/invitations/:token/accept',
    'auth/invitations/:token/accept',
    'api/auth/invitations/:token/accept',
    'invitations/accept',
    'api/invitations/accept',
  ])
  async acceptInvitation(@Param('token') token: string, @Body() body: unknown) {
    try {
      return await this.invitationsService.acceptInvitation(token, body);
    } catch (error) {
      if (!this.isInvalidLegacyInvitation(error)) throw error;
      return this.residentAccessService.acceptInvitation(token, body);
    }
  }

  @Get(['admin/first-login', 'api/admin/first-login'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  getAdminFirstLogin(@CurrentUser() user: MvpUser) {
    return this.invitationsService.getAdminFirstLogin(user);
  }

  @Patch(['admin/first-login', 'api/admin/first-login'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  updateAdminFirstLogin(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.invitationsService.updateAdminFirstLogin(user, body);
  }

  @Post(['admin/first-login/complete', 'api/admin/first-login/complete'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  completeAdminFirstLogin(@CurrentUser() user: MvpUser) {
    return this.invitationsService.completeAdminFirstLogin(user);
  }

  private isInvalidLegacyInvitation(error: unknown) {
    const response = typeof (error as any)?.getResponse === 'function' ? (error as any).getResponse() : null;
    return Boolean(
      response &&
        typeof response === 'object' &&
        'code' in response &&
        (response as { code?: string }).code === 'INVITATION_INVALID',
    );
  }
}
