import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { MinimalAuthService } from './minimal-auth.service';

@Controller(['auth', 'api/auth'])
export class MinimalAuthController {
  constructor(private readonly minimalAuthService: MinimalAuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: { email?: string; password?: string }) {
    return this.minimalAuthService.login(body);
  }

  @Public()
  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.minimalAuthService.me(authorization);
  }
}
