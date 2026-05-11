import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { MinimalAuthService } from './minimal-auth.service';

@Controller(['auth', 'api/auth'])
export class MinimalAuthController {
  constructor(private readonly minimalAuthService: MinimalAuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: { email?: string; password?: string; locale?: string }, @Req() request: Request) {
    return this.minimalAuthService.login(body, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.minimalAuthService.me(authorization);
  }

  @Public()
  @Post('logout')
  logout(@Headers('authorization') authorization: string | undefined, @Req() request: Request) {
    return this.minimalAuthService.logout(authorization, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() body: { email?: string; locale?: string }, @Req() request: Request) {
    return this.minimalAuthService.forgotPassword(body, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @Get('reset-password/:token')
  validateResetPassword(@Param('token') token: string) {
    return this.minimalAuthService.validateResetToken(token);
  }

  @Public()
  @Post('reset-password/:token')
  resetPasswordByToken(
    @Param('token') token: string,
    @Body() body: { password?: string; newPassword?: string; confirmPassword?: string },
    @Req() request: Request,
  ) {
    return this.minimalAuthService.resetPassword(token, body, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @Post('reset-password')
  resetPasswordLegacy(
    @Body() body: { token?: string; password?: string; newPassword?: string; confirmPassword?: string },
    @Req() request: Request,
  ) {
    return this.minimalAuthService.resetPassword(String(body.token || ''), body, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @Get('account-status')
  accountStatus(@Headers('authorization') authorization?: string) {
    return this.minimalAuthService.accountStatus(authorization);
  }
}
