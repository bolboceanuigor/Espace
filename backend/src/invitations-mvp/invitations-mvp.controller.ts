import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { InvitationsMvpService } from './invitations-mvp.service';

@Controller()
export class InvitationsMvpController {
  constructor(private readonly invitationsService: InvitationsMvpService) {}

  @Post(['organizations/:organizationId/admin-invitations', 'api/organizations/:organizationId/admin-invitations'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  createAdminInvitation(
    @CurrentUser() user: MvpUser,
    @Param('organizationId') organizationId: string,
    @Body() body: unknown,
  ) {
    return this.invitationsService.createAdminInvitation(user, organizationId, body);
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
  getInvitation(@Param('token') token: string) {
    return this.invitationsService.getInvitationByToken(token);
  }

  @Post([
    'invitations/:token/accept',
    'api/invitations/:token/accept',
    'auth/invitations/:token/accept',
    'api/auth/invitations/:token/accept',
    'invitations/accept',
    'api/invitations/accept',
  ])
  acceptInvitation(@Param('token') token: string, @Body() body: unknown) {
    return this.invitationsService.acceptInvitation(token, body);
  }
}
