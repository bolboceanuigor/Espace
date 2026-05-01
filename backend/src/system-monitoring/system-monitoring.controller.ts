import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SuperAdminGuard } from '../auth/guards/superadmin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateClientErrorDto, ListSystemErrorsDto } from './dto/system-monitoring.dto';
import { SystemMonitoringService } from './system-monitoring.service';

@Controller('api')
export class SystemMonitoringController {
  constructor(private readonly systemMonitoringService: SystemMonitoringService) {}

  @Post('system/errors/client')
  createClientError(@CurrentUser() user: any, @Body() body: CreateClientErrorDto) {
    return this.systemMonitoringService.logFrontendError(user, body);
  }

  @Get('superadmin/system/errors')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  listSystemErrors(@CurrentUser() user: any, @Query() query: ListSystemErrorsDto) {
    return this.systemMonitoringService.listSystemErrors(user, query);
  }

  @Patch('superadmin/system/errors/:id/resolve')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  resolveSystemError(@CurrentUser() user: any, @Param('id') id: string) {
    return this.systemMonitoringService.resolveSystemError(user, id);
  }

  @Get('superadmin/system/status')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  getSystemStatus(@CurrentUser() user: any) {
    return this.systemMonitoringService.getSystemStatus(user);
  }
}
