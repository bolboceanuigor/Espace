import { BadRequestException, Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminRbacService } from './admin-rbac.service';

@Controller('api/staff-invitations')
export class StaffInvitationsPublicController {
  constructor(
    private readonly rbacService: AdminRbacService,
    private readonly authService: AuthService,
  ) {}

  private setAuthCookies(response: Response, payload: { accessToken: string; user: { role: string } }) {
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

  @Public()
  @Get(':token')
  validate(@Param('token') token: string) {
    return this.rbacService.validatePublicStaffInvitation(token);
  }

  @Public()
  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const accepted = await this.rbacService.acceptStaffInvitation(token, body || {});
    const email = String(body?.email || accepted.user.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password) throw new BadRequestException('Email and password are required');
    const payload = await this.authService.login({ email, password }, { ip: req.ip, userAgent: req.headers['user-agent'] });
    this.setAuthCookies(response, payload);
    return { ...accepted, auth: payload };
  }

  @Post(':token/link-existing')
  @UseGuards(JwtAuthGuard)
  linkExisting(@Param('token') token: string, @CurrentUser() user: any) {
    return this.rbacService.linkExistingStaffInvitation(token, user);
  }
}
