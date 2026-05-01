import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationsService } from './invitations.service';
import type { Request } from 'express';
import type { Response } from 'express';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { AuthService } from '../auth/auth.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';

@Controller('api')
export class InvitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
    private readonly authService: AuthService,
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

  @Get('admin/invitations')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  list(@CurrentUser() user: any) {
    return this.invitationsService.adminList(user);
  }

  @Post('admin/invitations')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  create(@CurrentUser() user: any, @Body() dto: CreateInvitationDto) {
    return this.invitationsService.adminCreate(user, dto);
  }

  @Patch('admin/invitations/:id/cancel')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invitationsService.adminCancel(user, id);
  }

  @Post('admin/invitations/:id/resend')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  resend(@CurrentUser() user: any, @Param('id') id: string) {
    return this.invitationsService.adminResend(user, id);
  }

  @Public()
  @Get(['auth/invitations/:token', 'api/auth/invitations/:token'])
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  invitationByToken(@Param('token') token: string) {
    return this.invitationsService.getByToken(token);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post(['auth/invitations/:token/accept', 'api/auth/invitations/:token/accept', 'invitations/accept', 'api/invitations/accept'])
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
    @Res({ passthrough: true }) response: Response,
    @Req() req: Request,
  ) {
    const sourceToken = token || dto.token;
    if (!sourceToken) throw new BadRequestException('Invitation token required');
    const accepted = await this.invitationsService.acceptByToken(sourceToken, dto.password);
    const payload = await this.authService.login(
      { email: accepted.email, password: dto.password },
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
    this.setAuthCookies(response, payload);
    return payload;
  }
}
