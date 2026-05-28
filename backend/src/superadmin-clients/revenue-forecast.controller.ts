import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AssignUpgradeOpportunityDto,
  ConvertUpgradeOpportunityDto,
  CreateManualUpgradeOpportunityDto,
  RevenueForecastScenarioDto,
  UpdateUpgradeOpportunityDto,
  UpdateUpgradeOpportunityStatusDto,
  UpgradeOpportunityFollowUpDto,
  UpgradeOpportunityNoteDto,
  UpgradeOpportunityTaskDto,
} from './dto/revenue-forecast.dto';
import { RevenueForecastService } from './revenue-forecast.service';

@Controller('api/superadmin/revenue')
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class RevenueForecastController {
  constructor(private readonly service: RevenueForecastService) {}

  @Get('forecast')
  forecast(@Query() query: Record<string, string | undefined>) {
    return this.service.forecast(query);
  }

  @Get('forecast/dashboard')
  dashboard(@Query() query: Record<string, string | undefined>) {
    return this.service.dashboard(query);
  }

  @Post('forecast/generate')
  generate(@Body() body: any, @CurrentUser() user: any) {
    return this.service.generateSnapshot(body || {}, user);
  }

  @Get('forecast/snapshots')
  snapshots(@Query() query: Record<string, string | undefined>) {
    return this.service.snapshots(query);
  }

  @Get('forecast/snapshots/:id')
  snapshot(@Param('id') id: string) {
    return this.service.snapshot(id);
  }

  @Get('forecast/scenarios')
  scenarios() {
    return this.service.scenarios();
  }

  @Post('forecast/scenarios')
  createScenario(@Body() dto: RevenueForecastScenarioDto, @CurrentUser() user: any) {
    return this.service.createScenario(dto, user);
  }

  @Get('forecast/scenarios/:id')
  scenario(@Param('id') id: string) {
    return this.service.scenario(id);
  }

  @Patch('forecast/scenarios/:id')
  updateScenario(@Param('id') id: string, @Body() dto: Partial<RevenueForecastScenarioDto>, @CurrentUser() user: any) {
    return this.service.updateScenario(id, dto, user);
  }

  @Patch('forecast/scenarios/:id/archive')
  archiveScenario(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.archiveScenario(id, user);
  }

  @Post('forecast/scenarios/:id/generate')
  generateScenario(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.generateSnapshot({ scenarioId: id }, user);
  }

  @Get('upgrade-opportunities')
  opportunities(@Query() query: Record<string, string | undefined>) {
    return this.service.listOpportunities(query);
  }

  @Post('upgrade-opportunities')
  createOpportunity(@Body() dto: CreateManualUpgradeOpportunityDto, @CurrentUser() user: any) {
    return this.service.createManualOpportunity(dto, user);
  }

  @Get('upgrade-opportunities/:id')
  opportunity(@Param('id') id: string) {
    return this.service.opportunity(id);
  }

  @Patch('upgrade-opportunities/:id')
  updateOpportunity(@Param('id') id: string, @Body() dto: UpdateUpgradeOpportunityDto, @CurrentUser() user: any) {
    return this.service.updateOpportunity(id, dto, user);
  }

  @Patch('upgrade-opportunities/:id/status')
  status(@Param('id') id: string, @Body() dto: UpdateUpgradeOpportunityStatusDto, @CurrentUser() user: any) {
    return this.service.updateStatus(id, dto, user);
  }

  @Patch('upgrade-opportunities/:id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignUpgradeOpportunityDto, @CurrentUser() user: any) {
    return this.service.assign(id, dto, user);
  }

  @Post('upgrade-opportunities/:id/notes')
  addNote(@Param('id') id: string, @Body() dto: UpgradeOpportunityNoteDto, @CurrentUser() user: any) {
    return this.service.addNote(id, dto, user);
  }

  @Post('upgrade-opportunities/:id/tasks')
  createTask(@Param('id') id: string, @Body() dto: UpgradeOpportunityTaskDto, @CurrentUser() user: any) {
    return this.service.createTask(id, dto, user);
  }

  @Post('upgrade-opportunities/:id/follow-ups')
  createFollowUp(@Param('id') id: string, @Body() dto: UpgradeOpportunityFollowUpDto, @CurrentUser() user: any) {
    return this.service.createFollowUp(id, dto, user);
  }

  @Post('upgrade-opportunities/:id/convert')
  convert(@Param('id') id: string, @Body() dto: ConvertUpgradeOpportunityDto, @CurrentUser() user: any) {
    return this.service.convert(id, dto, user);
  }

  @Post('upgrade-opportunities/detect')
  detect(@CurrentUser() user: any) {
    return this.service.detectAll(user);
  }

  @Post('upgrade-opportunities/detect/:associationId')
  detectAssociation(@Param('associationId') associationId: string, @CurrentUser() user: any) {
    return this.service.detectForAssociation(associationId, user);
  }

  @Get('clients/:clientId/forecast')
  clientForecast(@Param('clientId') clientId: string) {
    return this.service.clientForecast(clientId);
  }

  @Get('clients/:clientId/upgrade-opportunities')
  clientOpportunities(@Param('clientId') clientId: string) {
    return this.service.clientOpportunities(clientId);
  }
}
