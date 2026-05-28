import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CancelClientFollowUpDto,
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
  CreateClientReminderDto,
  CreateClientTaskDto,
  LinkAssociationDto,
  RescheduleClientFollowUpDto,
  RescheduleClientTaskDto,
  SnoozeClientReminderDto,
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

  @Post('tasks')
  createGlobalTask(@Body() dto: CreateClientTaskDto, @CurrentUser() user: any) {
    return this.service.createTaskGlobal(dto, user);
  }

  @Get('follow-ups')
  followUps(@Query() query: Record<string, string | undefined>) {
    return this.service.followUps(query);
  }

  @Post('follow-ups')
  createGlobalFollowUp(@Body() dto: CreateClientFollowUpDto, @CurrentUser() user: any) {
    return this.service.createFollowUpGlobal(dto, user);
  }

  @Get('my-work')
  myWork(@CurrentUser() user: any) {
    return this.service.myWork(user);
  }

  @Get('calendar')
  calendar(@Query() query: Record<string, string | undefined>) {
    return this.service.calendar(query);
  }

  @Get('calendar/agenda')
  calendarAgenda(@Query() query: Record<string, string | undefined>) {
    return this.service.calendar({ ...query, view: 'agenda' });
  }

  @Get('calendar/day')
  calendarDay(@Query() query: Record<string, string | undefined>) {
    return this.service.calendar({ ...query, view: 'day' });
  }

  @Get('calendar/week')
  calendarWeek(@Query() query: Record<string, string | undefined>) {
    return this.service.calendar({ ...query, view: 'week' });
  }

  @Get('calendar/month')
  calendarMonth(@Query() query: Record<string, string | undefined>) {
    return this.service.calendar({ ...query, view: 'month' });
  }

  @Get('reminders')
  reminders(@Query() query: Record<string, string | undefined>) {
    return this.service.listReminders(query);
  }

  @Post('reminders')
  createReminder(@Body() dto: CreateClientReminderDto, @CurrentUser() user: any) {
    return this.service.createReminder(dto, user);
  }

  @Get('tasks/:taskId')
  getTask(@Param('taskId') taskId: string) {
    return this.service.getTask(taskId);
  }

  @Patch('tasks/:taskId')
  updateTask(@Param('taskId') taskId: string, @Body() dto: UpdateClientTaskDto, @CurrentUser() user: any) {
    return this.service.updateTask(taskId, dto, user);
  }

  @Patch('tasks/:taskId/start')
  startTask(@Param('taskId') taskId: string, @CurrentUser() user: any) {
    return this.service.startTask(taskId, user);
  }

  @Patch('tasks/:taskId/complete')
  completeTask(@Param('taskId') taskId: string, @CurrentUser() user: any) {
    return this.service.completeTask(taskId, user);
  }

  @Patch('tasks/:taskId/cancel')
  cancelTask(@Param('taskId') taskId: string, @Body() dto: CancelClientTaskDto, @CurrentUser() user: any) {
    return this.service.cancelTask(taskId, dto, user);
  }

  @Patch('tasks/:taskId/reschedule')
  rescheduleTask(@Param('taskId') taskId: string, @Body() dto: RescheduleClientTaskDto, @CurrentUser() user: any) {
    return this.service.rescheduleTask(taskId, dto, user);
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

  @Get('follow-ups/:followUpId')
  getFollowUp(@Param('followUpId') followUpId: string) {
    return this.service.getFollowUp(followUpId);
  }

  @Patch('follow-ups/:followUpId/done')
  doneFollowUp(@Param('followUpId') followUpId: string, @CurrentUser() user: any) {
    return this.service.doneFollowUp(followUpId, user);
  }

  @Patch('follow-ups/:followUpId/cancel')
  cancelFollowUp(@Param('followUpId') followUpId: string, @Body() dto: CancelClientFollowUpDto, @CurrentUser() user: any) {
    return this.service.cancelFollowUp(followUpId, dto, user);
  }

  @Patch('follow-ups/:followUpId/reschedule')
  rescheduleFollowUp(@Param('followUpId') followUpId: string, @Body() dto: RescheduleClientFollowUpDto, @CurrentUser() user: any) {
    return this.service.rescheduleFollowUp(followUpId, dto, user);
  }

  @Get('reminders/:reminderId')
  getReminder(@Param('reminderId') reminderId: string) {
    return this.service.getReminder(reminderId);
  }

  @Patch('reminders/:reminderId/complete')
  completeReminder(@Param('reminderId') reminderId: string, @CurrentUser() user: any) {
    return this.service.completeReminder(reminderId, user);
  }

  @Patch('reminders/:reminderId/snooze')
  snoozeReminder(@Param('reminderId') reminderId: string, @Body() dto: SnoozeClientReminderDto) {
    return this.service.snoozeReminder(reminderId, dto);
  }

  @Patch('reminders/:reminderId/dismiss')
  dismissReminder(@Param('reminderId') reminderId: string, @CurrentUser() user: any) {
    return this.service.dismissReminder(reminderId, user);
  }

  @Patch('reminders/:reminderId/cancel')
  cancelReminder(@Param('reminderId') reminderId: string) {
    return this.service.cancelReminder(reminderId);
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

  @Get(':id/follow-ups')
  clientFollowUps(@Param('id') id: string) {
    return this.service.clientFollowUps(id);
  }

  @Get(':id/calendar')
  clientCalendar(@Param('id') id: string, @Query() query: Record<string, string | undefined>) {
    return this.service.clientCalendar(id, query);
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
