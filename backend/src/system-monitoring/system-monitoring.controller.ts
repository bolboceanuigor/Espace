import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SuperAdminGuard } from '../auth/guards/superadmin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateClientErrorDto, ListSystemErrorsDto } from './dto/system-monitoring.dto';
import { SystemMonitoringService } from './system-monitoring.service';

@Controller('api')
export class SystemMonitoringController {
  constructor(private readonly systemMonitoringService: SystemMonitoringService) {}

  @Public()
  @Post('client-errors')
  createClientErrorPublic(@CurrentUser() user: any, @Body() body: CreateClientErrorDto) {
    return this.systemMonitoringService.logFrontendError(user, body);
  }

  @Post('system/errors/client')
  createClientError(@CurrentUser() user: any, @Body() body: CreateClientErrorDto) {
    return this.systemMonitoringService.logFrontendError(user, body);
  }

  @Get('superadmin/monitoring/overview')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  getOverview(@CurrentUser() user: any) {
    return this.systemMonitoringService.getOverview(user);
  }

  @Get('superadmin/monitoring/health')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  getMonitoringHealth() {
    return this.systemMonitoringService.getHealth();
  }

  @Get('superadmin/monitoring/services')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  getMonitoringServices() {
    return this.systemMonitoringService.getHealth();
  }

  @Get('superadmin/system/errors')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async listSystemErrors(@CurrentUser() user: any, @Query() query: ListSystemErrorsDto) {
    const result = await this.systemMonitoringService.listSystemErrors(user, query);
    return result.items.map((item: any) => ({
      ...item,
      level: item.severity,
      organizationId: item.associationId,
      organization: item.association,
      metadataJson: item.metadata,
      resolved: Boolean(item.resolvedAt),
      createdAt: item.createdAt || item.firstSeenAt,
    }));
  }

  @Get('superadmin/monitoring/errors')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  listMonitoringErrors(@CurrentUser() user: any, @Query() query: ListSystemErrorsDto) {
    return this.systemMonitoringService.listSystemErrors(user, query);
  }

  @Get('superadmin/monitoring/errors/:id')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  getMonitoringError(@CurrentUser() user: any, @Param('id') id: string) {
    return this.systemMonitoringService.getSystemError(user, id);
  }

  @Patch('superadmin/system/errors/:id/resolve')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  resolveSystemError(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.systemMonitoringService.resolveSystemError(user, id, body?.resolutionNote);
  }

  @Patch('superadmin/monitoring/errors/:id/resolve')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  resolveMonitoringError(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.systemMonitoringService.resolveSystemError(user, id, body?.resolutionNote);
  }

  @Patch('superadmin/monitoring/errors/:id/reopen')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  reopenMonitoringError(@CurrentUser() user: any, @Param('id') id: string) {
    return this.systemMonitoringService.reopenSystemError(user, id);
  }

  @Get('superadmin/system/status')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  getSystemStatus(@CurrentUser() user: any) {
    return this.systemMonitoringService.getSystemStatus(user);
  }

  @Get('superadmin/monitoring/deployments')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  listDeployments(@CurrentUser() user: any) {
    return this.systemMonitoringService.listDeployments(user);
  }

  @Get('superadmin/monitoring/deployments/current')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  getCurrentDeployment() {
    return this.systemMonitoringService.currentDeployment();
  }

  @Post('superadmin/monitoring/health/snapshot')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  saveHealthSnapshot(@CurrentUser() user: any) {
    return this.systemMonitoringService.saveHealthSnapshot(user);
  }
}
