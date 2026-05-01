import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CancelDemoRequestDto,
  CreateDemoRequestDto,
  ScheduleDemoRequestDto,
  UpdateDemoRequestDto,
} from './dto/demo-requests.dto';
import { DemoRequestsService } from './demo-requests.service';

@Controller()
export class DemoRequestsController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Post(['public/demo-requests', 'api/public/demo-requests'])
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  createPublic(@Body() body: CreateDemoRequestDto) {
    return this.demoRequestsService.createPublic(body);
  }

  @Get(['superadmin/demo-requests', 'api/superadmin/demo-requests'])
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  listForSuperadmin(@CurrentUser() user: any, @Query('status') status?: string) {
    return this.demoRequestsService.listForSuperadmin(user, status);
  }

  @Get(['superadmin/demo-requests/:id', 'api/superadmin/demo-requests/:id'])
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  getForSuperadmin(@CurrentUser() user: any, @Param('id') id: string) {
    return this.demoRequestsService.getForSuperadmin(user, id);
  }

  @Patch(['superadmin/demo-requests/:id', 'api/superadmin/demo-requests/:id'])
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  updateForSuperadmin(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateDemoRequestDto) {
    return this.demoRequestsService.updateForSuperadmin(user, id, body);
  }

  @Post(['superadmin/demo-requests/:id/schedule', 'api/superadmin/demo-requests/:id/schedule'])
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  schedule(@CurrentUser() user: any, @Param('id') id: string, @Body() body: ScheduleDemoRequestDto) {
    return this.demoRequestsService.schedule(user, id, body);
  }

  @Post(['superadmin/demo-requests/:id/complete', 'api/superadmin/demo-requests/:id/complete'])
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  complete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.demoRequestsService.complete(user, id);
  }

  @Post(['superadmin/demo-requests/:id/cancel', 'api/superadmin/demo-requests/:id/cancel'])
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  cancel(@CurrentUser() user: any, @Param('id') id: string, @Body() body: CancelDemoRequestDto) {
    return this.demoRequestsService.cancel(user, id, body);
  }
}
