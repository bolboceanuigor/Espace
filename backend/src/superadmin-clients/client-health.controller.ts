import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClientHealthService } from './client-health.service';
import { ClientHealthOverrideDto, CreateHealthFollowUpDto, CreateHealthTaskDto, DismissClientHealthActionDto } from './dto/client-health.dto';

@Controller('api/superadmin/client-health')
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class ClientHealthController {
  constructor(private readonly service: ClientHealthService) {}

  @Get()
  dashboard() {
    return this.service.overview();
  }

  @Get('overview')
  overview() {
    return this.service.overview();
  }

  @Get('clients')
  clients(@Query() query: Record<string, string | undefined>) {
    return this.service.clients(query);
  }

  @Get('at-risk')
  atRisk() {
    return this.service.atRisk();
  }

  @Get('risk')
  risk() {
    return this.service.atRisk();
  }

  @Get('trends')
  trends(@Query('clientAccountId') clientAccountId?: string) {
    return clientAccountId ? this.service.trend(clientAccountId) : { items: [] };
  }

  @Get('recommendations')
  recommendations() {
    return this.service.recommendations();
  }

  @Post('recalculate-all')
  recalculateAll(@CurrentUser() user: any) {
    return this.service.recalculateAll(user);
  }

  @Get('clients/:id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  @Post('clients/:id/recalculate')
  recalculate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.recalculate(id, user);
  }

  @Get('clients/:id/trend')
  trend(@Param('id') id: string) {
    return this.service.trend(id);
  }

  @Post('clients/:id/override')
  override(@Param('id') id: string, @Body() dto: ClientHealthOverrideDto, @CurrentUser() user: any) {
    return this.service.createOverride(id, dto, user);
  }

  @Patch('overrides/:id/disable')
  disableOverride(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.disableOverride(id, user);
  }

  @Post('actions/:id/accept')
  acceptAction(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.acceptAction(id, user);
  }

  @Post('actions/:id/dismiss')
  dismissAction(@Param('id') id: string, @Body() dto: DismissClientHealthActionDto, @CurrentUser() user: any) {
    return this.service.dismissAction(id, dto, user);
  }

  @Post('actions/:id/complete')
  completeAction(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.completeAction(id, user);
  }

  @Post('actions/:id/create-task')
  createTask(@Param('id') id: string, @Body() dto: CreateHealthTaskDto, @CurrentUser() user: any) {
    return this.service.createTaskFromAction(id, dto, user);
  }

  @Post('actions/:id/create-follow-up')
  createFollowUp(@Param('id') id: string, @Body() dto: CreateHealthFollowUpDto, @CurrentUser() user: any) {
    return this.service.createFollowUpFromAction(id, dto, user);
  }
}
