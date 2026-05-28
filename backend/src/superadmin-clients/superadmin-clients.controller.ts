import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CancelClientTaskDto,
  ChangeClientOwnerDto,
  ChangeClientPriorityDto,
  ChangeClientRiskDto,
  ChangeClientStageDto,
  ChangeClientStatusDto,
  CloseClientDto,
  CreateClientAccountDto,
  CreateClientFollowUpDto,
  CreateClientNoteDto,
  CreateClientTaskDto,
  LinkAssociationDto,
  UpdateClientAccountDto,
  UpdateClientFollowUpDto,
  UpdateClientNoteDto,
  UpdateClientTaskDto,
} from './dto/superadmin-clients.dto';
import { SuperadminClientsService } from './superadmin-clients.service';

@Controller('api/superadmin/clients')
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminClientsController {
  constructor(private readonly service: SuperadminClientsService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>) {
    return this.service.list(query);
  }

  @Get('pipeline')
  pipeline() {
    return this.service.pipeline();
  }

  @Get('stats')
  stats() {
    return this.service.stats();
  }

  @Post()
  create(@Body() dto: CreateClientAccountDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Post('from-customer-request/:requestId')
  fromCustomerRequest(@Param('requestId') requestId: string, @CurrentUser() user: any) {
    return this.service.fromCustomerRequest(requestId, user);
  }

  @Get('tasks')
  tasks(@Query() query: Record<string, string | undefined>) {
    return this.service.listTasks(query);
  }

  @Get('follow-ups')
  followUps(@Query() query: Record<string, string | undefined>) {
    return this.service.followUps(query);
  }

  @Patch('tasks/:taskId')
  updateTask(@Param('taskId') taskId: string, @Body() dto: UpdateClientTaskDto, @CurrentUser() user: any) {
    return this.service.updateTask(taskId, dto, user);
  }

  @Patch('tasks/:taskId/complete')
  completeTask(@Param('taskId') taskId: string, @CurrentUser() user: any) {
    return this.service.completeTask(taskId, user);
  }

  @Patch('tasks/:taskId/cancel')
  cancelTask(@Param('taskId') taskId: string, @Body() dto: CancelClientTaskDto, @CurrentUser() user: any) {
    return this.service.cancelTask(taskId, dto, user);
  }

  @Patch('notes/:noteId')
  updateNote(@Param('noteId') noteId: string, @Body() dto: UpdateClientNoteDto) {
    return this.service.updateNote(noteId, dto);
  }

  @Patch('notes/:noteId/pin')
  pinNote(@Param('noteId') noteId: string, @Body('isPinned') isPinned: boolean) {
    return this.service.pinNote(noteId, isPinned !== false);
  }

  @Patch('follow-ups/:followUpId')
  updateFollowUp(@Param('followUpId') followUpId: string, @Body() dto: UpdateClientFollowUpDto) {
    return this.service.updateFollowUp(followUpId, dto);
  }

  @Patch('follow-ups/:followUpId/done')
  doneFollowUp(@Param('followUpId') followUpId: string, @CurrentUser() user: any) {
    return this.service.doneFollowUp(followUpId, user);
  }

  @Patch('follow-ups/:followUpId/cancel')
  cancelFollowUp(@Param('followUpId') followUpId: string) {
    return this.service.cancelFollowUp(followUpId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientAccountDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/stage')
  stage(@Param('id') id: string, @Body() dto: ChangeClientStageDto, @CurrentUser() user: any) {
    return this.service.changeStage(id, dto, user);
  }

  @Patch(':id/status')
  status(@Param('id') id: string, @Body() dto: ChangeClientStatusDto, @CurrentUser() user: any) {
    return this.service.changeStatus(id, dto, user);
  }

  @Patch(':id/priority')
  priority(@Param('id') id: string, @Body() dto: ChangeClientPriorityDto, @CurrentUser() user: any) {
    return this.service.changePriority(id, dto, user);
  }

  @Patch(':id/owner')
  owner(@Param('id') id: string, @Body() dto: ChangeClientOwnerDto, @CurrentUser() user: any) {
    return this.service.changeOwner(id, dto, user);
  }

  @Patch(':id/risk')
  risk(@Param('id') id: string, @Body() dto: ChangeClientRiskDto, @CurrentUser() user: any) {
    return this.service.changeRisk(id, dto, user);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @Body() dto: CloseClientDto, @CurrentUser() user: any) {
    return this.service.close(id, dto, user);
  }

  @Post(':id/reopen')
  reopen(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.reopen(id, user);
  }

  @Post(':id/link-association')
  linkAssociation(@Param('id') id: string, @Body() dto: LinkAssociationDto, @CurrentUser() user: any) {
    return this.service.linkAssociation(id, dto, user);
  }

  @Post(':id/create-association')
  createAssociationPlaceholder() {
    return this.service.createAssociationPlaceholder();
  }

  @Get(':id/tasks')
  clientTasks(@Param('id') id: string) {
    return this.service.clientTasks(id);
  }

  @Post(':id/tasks')
  createTask(@Param('id') id: string, @Body() dto: CreateClientTaskDto, @CurrentUser() user: any) {
    return this.service.createTask(id, dto, user);
  }

  @Get(':id/notes')
  notes(@Param('id') id: string) {
    return this.service.notes(id);
  }

  @Post(':id/notes')
  createNote(@Param('id') id: string, @Body() dto: CreateClientNoteDto, @CurrentUser() user: any) {
    return this.service.createNote(id, dto, user);
  }

  @Post(':id/follow-ups')
  createFollowUp(@Param('id') id: string, @Body() dto: CreateClientFollowUpDto, @CurrentUser() user: any) {
    return this.service.createFollowUp(id, dto, user);
  }

  @Get(':id/activity')
  activity(@Param('id') id: string) {
    return this.service.activityTimeline(id);
  }

  @Get(':id/onboarding')
  onboarding(@Param('id') id: string) {
    return this.service.onboarding(id);
  }

  @Get(':id/risk')
  riskTab(@Param('id') id: string) {
    return this.service.riskTab(id);
  }
}
