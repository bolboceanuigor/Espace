import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SuperadminService } from './superadmin.service';
import { SuperAdminGuard } from '../auth/guards/superadmin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSuperadminOrgDto } from './dto/create-superadmin-org.dto';
import { UpdateSuperadminOrgDto } from './dto/update-superadmin-org.dto';
import { ListSuperadminUsersDto } from './dto/list-superadmin-users.dto';
import { CreateSuperadminUserDto } from './dto/create-superadmin-user.dto';
import { UpdateSuperadminUserDto } from './dto/update-superadmin-user.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateClientNoteDto, UpdateClientNoteDto } from './dto/client-note.dto';
import { CreateSuperadminTaskDto, ListSuperadminTasksDto, UpdateSuperadminTaskDto } from './dto/superadmin-task.dto';
import { ResetDemoDataDto } from './dto/superadmin-demo.dto';
import { UpdateQACheckDto } from './dto/qa-checklist.dto';
import { UpdateBetaLaunchStatusDto, UpdateBetaReadinessCheckDto } from './dto/beta-readiness.dto';

@Controller('api/superadmin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SuperadminController {
  constructor(private readonly superadminService: SuperadminService) {}

  @Get('orgs')
  listOrgs() {
    return this.superadminService.listOrganizations();
  }

  @Post('orgs')
  createOrg(@Body() dto: CreateSuperadminOrgDto) {
    return this.superadminService.createOrganization(dto);
  }

  @Patch('orgs/:id')
  updateOrg(@Param('id') id: string, @Body() dto: UpdateSuperadminOrgDto) {
    return this.superadminService.updateOrganization(id, dto);
  }

  @Get('users')
  listUsers(@Query() query: ListSuperadminUsersDto) {
    return this.superadminService.listUsers(query.orgId);
  }

  @Post('users')
  createUser(@Body() dto: CreateSuperadminUserDto) {
    return this.superadminService.createUser(dto);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateSuperadminUserDto) {
    return this.superadminService.updateUser(id, dto);
  }

  @Post('organizations/:id/support-session/start')
  startSupportSession(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { reason?: string },
  ) {
    return this.superadminService.startSupportSession(user.sub || user.id, id, body?.reason);
  }

  @Post('support-session/:id/end')
  endSupportSession(@Param('id') id: string, @CurrentUser() user: any) {
    return this.superadminService.endSupportSession(user.sub || user.id, id);
  }

  @Get('support-session/current')
  currentSupportSession(@CurrentUser() user: any) {
    return this.superadminService.currentSupportSession(user.sub || user.id);
  }

  @Get('organizations/:id/notes')
  listOrganizationNotes(@Param('id') id: string, @Query('type') type?: string) {
    return this.superadminService.listClientNotes(id, type);
  }

  @Post('organizations/:id/notes')
  createOrganizationNote(@Param('id') id: string, @CurrentUser() user: any, @Body() body: CreateClientNoteDto) {
    return this.superadminService.createClientNote(id, user.sub || user.id, body);
  }

  @Patch('client-notes/:id')
  updateClientNote(@Param('id') id: string, @Body() body: UpdateClientNoteDto) {
    return this.superadminService.updateClientNote(id, body);
  }

  @Get('follow-ups')
  listFollowUps() {
    return this.superadminService.listPendingFollowUps();
  }

  @Patch('client-notes/:id/mark-follow-up-done')
  markFollowUpDone(@Param('id') id: string) {
    return this.superadminService.markClientNoteFollowUpDone(id);
  }

  @Delete('client-notes/:id')
  deleteClientNote(@Param('id') id: string) {
    return this.superadminService.deleteClientNote(id);
  }

  @Get('tasks')
  listTasks(@Query() query: ListSuperadminTasksDto) {
    return this.superadminService.listTasks(query);
  }

  @Post('tasks')
  createTask(@CurrentUser() user: any, @Body() body: CreateSuperadminTaskDto) {
    return this.superadminService.createTask(user.sub || user.id, body);
  }

  @Patch('tasks/:id')
  updateTask(@Param('id') id: string, @Body() body: UpdateSuperadminTaskDto) {
    return this.superadminService.updateTask(id, body);
  }

  @Delete('tasks/:id')
  deleteTask(@Param('id') id: string) {
    return this.superadminService.deleteTask(id);
  }

  @Get('demo/status')
  demoStatus() {
    return this.superadminService.getDemoStatus();
  }

  @Post('demo/reset')
  resetDemo(@Body() body: ResetDemoDataDto) {
    return this.superadminService.resetDemoData(body.confirmText);
  }

  @Get('qa-checklist')
  listQAChecklist() {
    return this.superadminService.listQAChecklist();
  }

  @Patch('qa-checklist/:id')
  updateQACheck(@Param('id') id: string, @CurrentUser() user: any, @Body() body: UpdateQACheckDto) {
    return this.superadminService.updateQACheck(id, user.sub || user.id, body);
  }

  @Get('beta-readiness')
  listBetaReadiness() {
    return this.superadminService.getBetaReadiness();
  }

  @Patch('beta-readiness/:id')
  updateBetaReadinessCheck(@Param('id') id: string, @CurrentUser() user: any, @Body() body: UpdateBetaReadinessCheckDto) {
    return this.superadminService.updateBetaReadinessCheck(id, user.sub || user.id, body);
  }

  @Patch('beta-readiness/launch-status')
  updateBetaLaunchStatus(@CurrentUser() user: any, @Body() body: UpdateBetaLaunchStatusDto) {
    return this.superadminService.updateBetaLaunchStatus(user.sub || user.id, body.launchStatus);
  }

  @Patch('beta-readiness/maintenance-mode')
  updateMaintenanceMode(@CurrentUser() user: any, @Body() body: { maintenanceMode: boolean }) {
    return this.superadminService.updateMaintenanceMode(user.sub || user.id, !!body?.maintenanceMode);
  }
}

