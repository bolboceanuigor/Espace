import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequiresPermissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminRbacService } from '../rbac/admin-rbac.service';
import { AcceptTeamInvitationDto } from './dto/accept-team-invitation.dto';
import { CreateTeamUserDto } from './dto/create-team-user.dto';
import { UpdateTeamUserDto } from './dto/update-team-user.dto';
import { TeamService } from './team.service';

@Controller('api')
export class TeamController {
  constructor(
    private readonly teamService: TeamService,
    private readonly authService: AuthService,
    private readonly rbacService: AdminRbacService,
  ) {}

  private setAuthCookies(
    response: Response,
    payload: { accessToken: string; user: { role: string } },
  ) {
    const secure =
      (process.env.COOKIE_SECURE ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')).toLowerCase() ===
      'true';
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    response.cookie('accessToken', payload.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      domain: cookieDomain,
      maxAge,
    });
    response.cookie('role', payload.user.role, {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      path: '/',
      domain: cookieDomain,
      maxAge,
    });
  }

  @Get('admin/team')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('team.view')
  list(@CurrentUser() user: any, @Query() query: Record<string, unknown>) {
    return this.rbacService.listTeamMembers(user, query || {});
  }

  @Post('admin/team/invite')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('team.manage')
  invite(@CurrentUser() user: any, @Body() dto: CreateTeamUserDto) {
    return this.teamService.adminInvite(user, dto);
  }

  @Patch('admin/team/:memberId')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('team.manage')
  update(
    @CurrentUser() user: any,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateTeamUserDto,
  ) {
    return this.teamService.adminUpdateMember(user, memberId, dto);
  }

  @Patch('admin/team/:memberId/disable')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('team.manage')
  disable(@CurrentUser() user: any, @Param('memberId') memberId: string) {
    return this.teamService.adminDisableMember(user, memberId);
  }

  @Patch('admin/team/:memberId/permissions')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequiresPermissions('team.manage')
  permissions(
    @CurrentUser() user: any,
    @Param('memberId') memberId: string,
    @Body() dto: { permissions?: Record<string, boolean> },
  ) {
    return this.teamService.adminUpdatePermissions(user, memberId, dto.permissions);
  }

  @Public()
  @Post('auth/team-invitations/:token/accept')
  async acceptTeamInvitation(
    @Param('token') token: string,
    @Body() dto: AcceptTeamInvitationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const accepted = await this.teamService.acceptInvitation(token, dto.password);
    const payload = await this.authService.login(
      { email: accepted.email, password: dto.password },
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
    this.setAuthCookies(res, payload);
    return payload;
  }

  @Get('superadmin/organizations/:organizationId/team')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminList(@Param('organizationId') organizationId: string) {
    return this.teamService.superadminList(organizationId);
  }

  @Post('superadmin/organizations/:organizationId/team/invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminInvite(
    @CurrentUser() user: any,
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateTeamUserDto,
  ) {
    return this.teamService.superadminInvite(organizationId, user.id || user.sub, user.role, dto);
  }

  @Patch('superadmin/organizations/:organizationId/team/:memberId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminUpdate(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateTeamUserDto,
  ) {
    return this.teamService.superadminUpdateMember(organizationId, memberId, dto);
  }

  @Patch('superadmin/organizations/:organizationId/team/:memberId/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminDisable(@Param('organizationId') organizationId: string, @Param('memberId') memberId: string) {
    return this.teamService.superadminDisableMember(organizationId, memberId);
  }

  @Patch('superadmin/organizations/:organizationId/team/:memberId/permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminPermissions(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @Body() dto: { permissions?: Record<string, boolean> },
  ) {
    return this.teamService.superadminUpdatePermissions(organizationId, memberId, dto.permissions);
  }
}
