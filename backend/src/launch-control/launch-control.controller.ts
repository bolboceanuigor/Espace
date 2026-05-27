import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SuperAdminGuard } from '../auth/guards/superadmin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  MarkGoLiveDto,
  PlatformServicePaymentEventDto,
  UpdateLaunchChecklistItemDto,
  UpsertPlatformServiceDto,
} from './dto/launch-control.dto';
import { LaunchControlService } from './launch-control.service';

@Controller('api/superadmin/launch')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class LaunchControlController {
  constructor(private readonly launchControlService: LaunchControlService) {}

  @Get()
  overview() {
    return this.launchControlService.overview();
  }

  @Get('checklist')
  checklist() {
    return this.launchControlService.checklist();
  }

  @Post('checklist/run')
  runChecklist(@CurrentUser() user: any) {
    return this.launchControlService.runChecklist(user);
  }

  @Patch('checklist/:id')
  updateChecklist(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateLaunchChecklistItemDto) {
    return this.launchControlService.updateChecklistItem(id, dto, user);
  }

  @Get('services')
  services(@Query() query: Record<string, string | undefined>) {
    return this.launchControlService.services(query);
  }

  @Post('services')
  createService(@CurrentUser() user: any, @Body() dto: UpsertPlatformServiceDto) {
    return this.launchControlService.createService(dto, user);
  }

  @Get('services/:id')
  getService(@Param('id') id: string) {
    return this.launchControlService.getService(id);
  }

  @Patch('services/:id')
  updateService(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpsertPlatformServiceDto) {
    return this.launchControlService.updateService(id, dto, user);
  }

  @Post('services/:id/payment-events')
  recordPayment(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: PlatformServicePaymentEventDto) {
    return this.launchControlService.recordPayment(id, dto, user);
  }

  @Get('costs')
  costs() {
    return this.launchControlService.costs();
  }

  @Get('env')
  env() {
    return this.launchControlService.envDiagnostics();
  }

  @Get('deployments')
  deployments() {
    return this.launchControlService.deployments();
  }

  @Get('go-live')
  goLive() {
    return this.launchControlService.goLive();
  }

  @Post('go-live/mark-ready')
  markReady(@CurrentUser() user: any, @Body() dto: MarkGoLiveDto) {
    return this.launchControlService.markReady(dto, user);
  }

  @Post('go-live/mark-live')
  markLive(@CurrentUser() user: any, @Body() dto: MarkGoLiveDto) {
    return this.launchControlService.markLive(dto, user);
  }

  @Get('events')
  events() {
    return this.launchControlService.events();
  }
}
