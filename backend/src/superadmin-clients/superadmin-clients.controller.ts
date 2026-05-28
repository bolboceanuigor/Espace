import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  ArchiveClientKnowledgeDto,
  CancelClientFollowUpDto,
  CancelClientTaskDto,
  ChangeClientOwnerDto,
  ChangeClientPriorityDto,
  ChangeClientRiskDto,
  ChangeClientStageDto,
  ChangeClientStatusDto,
  CloseClientDto,
  CreateClientAccountDto,
  CreateClientChecklistDto,
  CreateClientContactDto,
  CreateClientDecisionDto,
  CreateClientFileDto,
  CreateClientFollowUpDto,
  CreateClientKnowledgeItemDto,
  CreateClientKnownIssueDto,
  CreateClientLinkDto,
  CreateClientNoteDto,
  CreateClientReminderDto,
  CreateClientTaskDto,
  LinkAssociationDto,
  ResolveClientKnownIssueDto,
  RescheduleClientFollowUpDto,
  RescheduleClientTaskDto,
  SnoozeClientReminderDto,
  UpdateClientAccountDto,
  UpdateClientChecklistDto,
  UpdateClientContactDto,
  UpdateClientDecisionDto,
  UpdateClientFileDto,
  UpdateClientFollowUpDto,
  UpdateClientKnowledgeItemDto,
  UpdateClientKnownIssueDto,
  UpdateClientLinkDto,
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
  updateNote(@Param('noteId') noteId: string, @Body() dto: UpdateClientKnowledgeItemDto, @CurrentUser() user: any) {
    return this.service.updateNote(noteId, dto, user);
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
  createNote(@Param('id') id: string, @Body() dto: CreateClientKnowledgeItemDto | CreateClientNoteDto, @CurrentUser() user: any) {
    return this.service.createNote(id, dto, user);
  }

  @Get(':id/knowledge')
  knowledge(@Param('id') id: string) {
    return this.service.knowledgeOverview(id);
  }

  @Get(':id/knowledge/search')
  knowledgeSearch(@Param('id') id: string, @Query() query: Record<string, string | undefined>) {
    return this.service.clientKnowledgeSearch(id, query);
  }

  @Get(':id/notes/:noteId')
  getNote(@Param('id') id: string, @Param('noteId') noteId: string) {
    return this.service.getKnowledgeItem(id, noteId);
  }

  @Patch(':id/notes/:noteId')
  updateClientNote(@Param('id') id: string, @Param('noteId') noteId: string, @Body() dto: UpdateClientKnowledgeItemDto, @CurrentUser() user: any) {
    return this.service.updateKnowledgeItem(id, noteId, dto, user);
  }

  @Patch(':id/notes/:noteId/pin')
  pinClientNote(@Param('noteId') noteId: string, @Body('isPinned') isPinned: boolean) {
    return this.service.pinNote(noteId, isPinned !== false);
  }

  @Patch(':id/notes/:noteId/archive')
  archiveClientNote(@Param('id') id: string, @Param('noteId') noteId: string, @Body() dto: ArchiveClientKnowledgeDto, @CurrentUser() user: any) {
    return this.service.archiveKnowledgeItem(id, noteId, dto, user);
  }

  @Get(':id/files')
  files(@Param('id') id: string, @Query() query: Record<string, string | undefined>) {
    return this.service.clientFiles(id, query);
  }

  @Post(':id/files')
  createFile(@Param('id') id: string, @Body() dto: CreateClientFileDto, @CurrentUser() user: any) {
    return this.service.createClientFile(id, dto, user);
  }

  @Patch(':id/files/:fileId')
  updateFile(@Param('id') id: string, @Param('fileId') fileId: string, @Body() dto: UpdateClientFileDto, @CurrentUser() user: any) {
    return this.service.updateClientFile(id, fileId, dto, user);
  }

  @Patch(':id/files/:fileId/archive')
  archiveFile(@Param('id') id: string, @Param('fileId') fileId: string, @Body() dto: ArchiveClientKnowledgeDto, @CurrentUser() user: any) {
    return this.service.archiveClientFile(id, fileId, dto, user);
  }

  @Get(':id/contacts')
  contacts(@Param('id') id: string) {
    return this.service.clientContacts(id);
  }

  @Post(':id/contacts')
  createContact(@Param('id') id: string, @Body() dto: CreateClientContactDto, @CurrentUser() user: any) {
    return this.service.createClientContact(id, dto, user);
  }

  @Patch(':id/contacts/:contactId')
  updateContact(@Param('id') id: string, @Param('contactId') contactId: string, @Body() dto: UpdateClientContactDto, @CurrentUser() user: any) {
    return this.service.updateClientContact(id, contactId, dto, user);
  }

  @Patch(':id/contacts/:contactId/primary')
  primaryContact(@Param('id') id: string, @Param('contactId') contactId: string) {
    return this.service.primaryClientContact(id, contactId);
  }

  @Patch(':id/contacts/:contactId/archive')
  archiveContact(@Param('id') id: string, @Param('contactId') contactId: string) {
    return this.service.archiveClientContact(id, contactId);
  }

  @Get(':id/decisions')
  decisions(@Param('id') id: string) {
    return this.service.clientDecisions(id);
  }

  @Post(':id/decisions')
  createDecision(@Param('id') id: string, @Body() dto: CreateClientDecisionDto, @CurrentUser() user: any) {
    return this.service.createClientDecision(id, dto, user);
  }

  @Patch(':id/decisions/:decisionId')
  updateDecision(@Param('id') id: string, @Param('decisionId') decisionId: string, @Body() dto: UpdateClientDecisionDto, @CurrentUser() user: any) {
    return this.service.updateClientDecision(id, decisionId, dto, user);
  }

  @Patch(':id/decisions/:decisionId/supersede')
  supersedeDecision(@Param('id') id: string, @Param('decisionId') decisionId: string) {
    return this.service.supersedeClientDecision(id, decisionId);
  }

  @Patch(':id/decisions/:decisionId/archive')
  archiveDecision(@Param('id') id: string, @Param('decisionId') decisionId: string) {
    return this.service.archiveClientDecision(id, decisionId);
  }

  @Get(':id/known-issues')
  knownIssues(@Param('id') id: string) {
    return this.service.clientKnownIssues(id);
  }

  @Post(':id/known-issues')
  createKnownIssue(@Param('id') id: string, @Body() dto: CreateClientKnownIssueDto, @CurrentUser() user: any) {
    return this.service.createClientKnownIssue(id, dto, user);
  }

  @Patch(':id/known-issues/:issueId')
  updateKnownIssue(@Param('id') id: string, @Param('issueId') issueId: string, @Body() dto: UpdateClientKnownIssueDto, @CurrentUser() user: any) {
    return this.service.updateClientKnownIssue(id, issueId, dto, user);
  }

  @Patch(':id/known-issues/:issueId/resolve')
  resolveKnownIssue(@Param('id') id: string, @Param('issueId') issueId: string, @Body() dto: ResolveClientKnownIssueDto) {
    return this.service.resolveClientKnownIssue(id, issueId, dto);
  }

  @Patch(':id/known-issues/:issueId/archive')
  archiveKnownIssue(@Param('id') id: string, @Param('issueId') issueId: string) {
    return this.service.archiveClientKnownIssue(id, issueId);
  }

  @Get(':id/links')
  links(@Param('id') id: string) {
    return this.service.clientLinks(id);
  }

  @Post(':id/links')
  createLink(@Param('id') id: string, @Body() dto: CreateClientLinkDto, @CurrentUser() user: any) {
    return this.service.createClientLink(id, dto, user);
  }

  @Patch(':id/links/:linkId')
  updateLink(@Param('id') id: string, @Param('linkId') linkId: string, @Body() dto: UpdateClientLinkDto, @CurrentUser() user: any) {
    return this.service.updateClientLink(id, linkId, dto, user);
  }

  @Patch(':id/links/:linkId/archive')
  archiveLink(@Param('id') id: string, @Param('linkId') linkId: string) {
    return this.service.archiveClientLink(id, linkId);
  }

  @Get(':id/checklists')
  checklists(@Param('id') id: string) {
    return this.service.clientChecklists(id);
  }

  @Post(':id/checklists')
  createChecklist(@Param('id') id: string, @Body() dto: CreateClientChecklistDto, @CurrentUser() user: any) {
    return this.service.createClientChecklist(id, dto, user);
  }

  @Patch(':id/checklists/:checklistId')
  updateChecklist(@Param('id') id: string, @Param('checklistId') checklistId: string, @Body() dto: UpdateClientChecklistDto, @CurrentUser() user: any) {
    return this.service.updateClientChecklist(id, checklistId, dto, user);
  }

  @Patch(':id/checklists/:checklistId/items')
  updateChecklistItems(@Param('id') id: string, @Param('checklistId') checklistId: string, @Body() dto: UpdateClientChecklistDto, @CurrentUser() user: any) {
    return this.service.updateClientChecklist(id, checklistId, dto, user);
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
