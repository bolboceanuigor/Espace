import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AssignCollectionCaseDto,
  CancelPaymentPromiseDto,
  CloseCollectionCaseDto,
  CollectionNoteDto,
  CreateCollectionCaseDto,
  CreateCollectionTaskDto,
  CreatePaymentPromiseDto,
  RecordCollectionContactDto,
  ScheduleCollectionFollowUpDto,
  UpdateCollectionPriorityDto,
  UpdateCollectionStatusDto,
} from './dto/revenue-operations.dto';
import { RevenueOperationsService } from './revenue-operations.service';

@Controller('api/superadmin/revenue')
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class RevenueOperationsController {
  constructor(private readonly service: RevenueOperationsService) {}

  @Get('dashboard')
  dashboard(@Query() query: Record<string, string | undefined>) {
    return this.service.dashboard(query);
  }

  @Get('overdue')
  overdue(@Query() query: Record<string, string | undefined>) {
    return this.service.overdueInvoices(query);
  }

  @Get('aging')
  aging(@Query() query: Record<string, string | undefined>) {
    return this.service.agingReport(query);
  }

  @Get('reports')
  reports(@Query() query: Record<string, string | undefined>) {
    return this.service.reports(query);
  }

  @Get('collections')
  collections(@Query() query: Record<string, string | undefined>) {
    return this.service.cases(query);
  }

  @Post('collections')
  createCollection(@Body() dto: CreateCollectionCaseDto, @CurrentUser() user: any) {
    return this.service.createCase(dto, user);
  }

  @Get('collections/:id')
  collection(@Param('id') id: string) {
    return this.service.caseDetail(id);
  }

  @Patch('collections/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateCollectionStatusDto, @CurrentUser() user: any) {
    return this.service.updateStatus(id, dto, user);
  }

  @Patch('collections/:id/priority')
  updatePriority(@Param('id') id: string, @Body() dto: UpdateCollectionPriorityDto, @CurrentUser() user: any) {
    return this.service.updatePriority(id, dto, user);
  }

  @Patch('collections/:id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignCollectionCaseDto, @CurrentUser() user: any) {
    return this.service.assign(id, dto, user);
  }

  @Post('collections/:id/notes')
  addNote(@Param('id') id: string, @Body() dto: CollectionNoteDto, @CurrentUser() user: any) {
    return this.service.addNote(id, dto, user);
  }

  @Post('collections/:id/record-contact')
  recordContact(@Param('id') id: string, @Body() dto: RecordCollectionContactDto, @CurrentUser() user: any) {
    return this.service.recordContact(id, dto, user);
  }

  @Post('collections/:id/promises')
  createPromise(@Param('id') id: string, @Body() dto: CreatePaymentPromiseDto, @CurrentUser() user: any) {
    return this.service.createPromise(id, dto, user);
  }

  @Post('collections/:id/follow-ups')
  scheduleFollowUp(@Param('id') id: string, @Body() dto: ScheduleCollectionFollowUpDto, @CurrentUser() user: any) {
    return this.service.scheduleFollowUp(id, dto, user);
  }

  @Post('collections/:id/tasks')
  createTask(@Param('id') id: string, @Body() dto: CreateCollectionTaskDto, @CurrentUser() user: any) {
    return this.service.createTask(id, dto, user);
  }

  @Post('collections/:id/escalate')
  escalate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.escalate(id, user);
  }

  @Post('collections/:id/recommend-suspension')
  recommendSuspension(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.recommendSuspension(id, user);
  }

  @Post('collections/:id/close')
  close(@Param('id') id: string, @Body() dto: CloseCollectionCaseDto, @CurrentUser() user: any) {
    return this.service.closeCase(id, dto, user);
  }

  @Get('promises')
  promises(@Query() query: Record<string, string | undefined>) {
    return this.service.promises(query);
  }

  @Get('promises/:id')
  promise(@Param('id') id: string) {
    return this.service.promiseDetail(id);
  }

  @Patch('promises/:id/kept')
  markKept(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.markPromiseKept(id, user);
  }

  @Patch('promises/:id/missed')
  markMissed(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.markPromiseMissed(id, user);
  }

  @Patch('promises/:id/cancel')
  cancelPromise(@Param('id') id: string, @Body() dto: CancelPaymentPromiseDto, @CurrentUser() user: any) {
    return this.service.cancelPromise(id, dto, user);
  }

  @Get('clients/:clientId')
  clientProfile(@Param('clientId') clientId: string) {
    return this.service.clientProfile(clientId);
  }

  @Get('associations/:associationId')
  associationProfile(@Param('associationId') associationId: string) {
    return this.service.associationProfile(associationId);
  }

  @Post('sync-collection-cases')
  sync(@CurrentUser() user: any) {
    return this.service.syncCases(user);
  }
}
