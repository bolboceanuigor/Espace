import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { DemoAuthReadService } from './demo-auth-read.service';

@Controller(['auth', 'api/auth'])
export class DemoAuthReadController {
  constructor(private readonly demoAuthReadService: DemoAuthReadService) {}

  @Public()
  @Get('demo-users')
  listDemoUsers() {
    return this.demoAuthReadService.listDemoUsers();
  }
}
