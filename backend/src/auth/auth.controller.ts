import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Res,
  Req,
  Query,
  NotImplementedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import type { Request } from 'express';
import { GoogleAuthGuard } from './google-auth.guard';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller(['auth', 'api/auth'])
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private resolveCookieSameSite(): 'lax' | 'strict' | 'none' {
    const value = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
    if (value === 'strict') return 'strict';
    if (value === 'none') return 'none';
    return 'lax';
  }

  private isGoogleAuthEnabled() {
    return (process.env.ENABLE_GOOGLE_AUTH ?? 'false').toLowerCase() === 'true';
  }

  private setAuthCookies(
    response: Response,
    payload: { accessToken: string; user: { role: string } },
  ) {
    const secure =
      (process.env.COOKIE_SECURE ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')).toLowerCase() ===
      'true';
    const sameSite = this.resolveCookieSameSite();
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const maxAge = 7 * 24 * 60 * 60 * 1000;

    response.cookie('accessToken', payload.accessToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      domain: cookieDomain,
      maxAge,
    });
    // role hint helps middleware UX, backend auth remains source of truth
    response.cookie('role', payload.user.role, {
      httpOnly: false,
      secure,
      sameSite,
      path: '/',
      domain: cookieDomain,
      maxAge,
    });
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const payload = await this.authService.register(registerDto);
    if ('accessToken' in payload && payload.accessToken && payload.user) {
      this.setAuthCookies(response, payload);
    }
    return payload;
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    const payload = await this.authService.login(loginDto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    this.setAuthCookies(response, payload);
    return payload;
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('demo-login')
  async demoLogin(@Res({ passthrough: true }) response: Response) {
    const payload = await this.authService.loginAsDemo();
    this.setAuthCookies(response, payload);
    return payload;
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email, dto.locale);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    return this.authService.requestPasswordReset(dto.email, dto.locale, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('reset-password/:token')
  validateResetPassword(@Param('token') token: string) {
    return this.authService.validatePasswordResetToken(token);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password/:token')
  resetPasswordByToken(
    @Param('token') token: string,
    @Body() dto: Omit<ResetPasswordDto, 'token'>,
    @Req() request: Request,
  ) {
    const nextPassword = dto.newPassword || dto.password;
    if (!nextPassword) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'newPassword is required',
      });
    }
    return this.authService.resetPassword(token, nextPassword, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    const nextPassword = dto.newPassword || dto.password;
    if (!nextPassword) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'newPassword is required',
      });
    }
    return this.authService.resetPassword(dto.token, nextPassword, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
    // TODO(auth/google): enable OAuth flow when ENABLE_GOOGLE_AUTH=true.
    if (!this.isGoogleAuthEnabled()) {
      throw new NotImplementedException({
        code: 'GOOGLE_AUTH_DISABLED',
        message: 'Coming soon',
      });
    }
    return;
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: Request & { user?: { email: string; firstName?: string | null; lastName?: string | null; googleSub: string } },
    @Res() response: Response,
    @Query('state') state?: string,
  ) {
    // TODO(auth/google): enable OAuth callback when ENABLE_GOOGLE_AUTH=true.
    if (!this.isGoogleAuthEnabled()) {
      throw new NotImplementedException({
        code: 'GOOGLE_AUTH_DISABLED',
        message: 'Coming soon',
      });
    }
    const payload = await this.authService.loginWithGoogle(req.user as any);
    this.setAuthCookies(response, payload);
    const locale = ['ro', 'ru', 'en'].includes(state || '') ? state : 'ro';
    const appUrl = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    return response.redirect(`${appUrl}/${locale}/calendar`);
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    const secure =
      (process.env.COOKIE_SECURE ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')).toLowerCase() ===
      'true';
    const sameSite = this.resolveCookieSameSite();
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    response.clearCookie('accessToken', {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      domain: cookieDomain,
    });
    response.clearCookie('role', {
      httpOnly: false,
      secure,
      sameSite,
      path: '/',
      domain: cookieDomain,
    });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.authService.getMePayload(user.id ?? user.sub);
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('change-password')
  changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto, @Req() req: Request) {
    return this.authService.changePassword(user.id ?? user.sub, dto.oldPassword, dto.newPassword, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
