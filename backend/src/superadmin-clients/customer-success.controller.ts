import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PlaybookStepStatus, Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CustomerSuccessService } from './customer-success.service';
import {
  CancelInterventionDto,
  CompleteInterventionDto,
  CreateCustomerSuccessPlaybookDto,
  CreateInterventionDto,
  RecordContactDto,
  StartInterventionDto,
  StepAddNoteDto,
  StepCreateFollowUpDto,
  StepCreateTaskDto,
  StepReasonDto,
  UpdateCustomerSuccessPlaybookDto,
  UpdateInterventionDto,
} from './dto/customer-success.dto';

@Controller('api/superadmin/customer-success')
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class CustomerSuccessController {
  constructor(private readonly service: CustomerSuccessService) {}

  @Get()
  dashboard() {
    return this.service.dashboard();
  }

  @Get('playbooks')
  playbooks(@Query() query: Record<string, string | undefined>) {
    return this.service.playbooks(query);
  }

  @Post('playbooks')
  createPlaybook(@Body() dto: CreateCustomerSuccessPlaybookDto, @CurrentUser() user: any) {
    return this.service.createPlaybook(dto, user);
  }

  @Get('playbooks/:id')
  playbook(@Param('id') id: string) {
    return this.service.playbook(id);
  }

  @Patch('playbooks/:id')
  updatePlaybook(@Param('id') id: string, @Body() dto: UpdateCustomerSuccessPlaybookDto, @CurrentUser() user: any) {
    return this.service.updatePlaybook(id, dto, user);
  }

  @Patch('playbooks/:id/archive')
  archivePlaybook(@Param('id') id: string) {
    return this.service.archivePlaybook(id);
  }

  @Post('playbooks/:id/duplicate')
  duplicatePlaybook(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.duplicatePlaybook(id, user);
  }

  @Post('playbooks/:id/start')
  startPlaybook(@Param('id') id: string, @Body() dto: StartInterventionDto, @CurrentUser() user: any) {
    return this.service.startFromPlaybook(id, dto, user);
  }

  @Get('interventions')
  interventions(@Query() query: Record<string, string | undefined>) {
    return this.service.interventions(query);
  }

  @Post('interventions')
  createIntervention(@Body() dto: CreateInterventionDto, @CurrentUser() user: any) {
    return this.service.createIntervention(dto, user);
  }

  @Get('interventions/:id')
  intervention(@Param('id') id: string) {
    return this.service.intervention(id);
  }

  @Patch('interventions/:id')
  updateIntervention(@Param('id') id: string, @Body() dto: UpdateInterventionDto, @CurrentUser() user: any) {
    return this.service.updateIntervention(id, dto, user);
  }

  @Patch('interventions/:id/status')
  updateInterventionStatus(@Param('id') id: string, @Body() dto: UpdateInterventionDto, @CurrentUser() user: any) {
    return this.service.updateIntervention(id, dto, user);
  }

  @Post('interventions/:id/complete')
  completeIntervention(@Param('id') id: string, @Body() dto: CompleteInterventionDto, @CurrentUser() user: any) {
    return this.service.completeIntervention(id, dto, user);
  }

  @Post('interventions/:id/cancel')
  cancelIntervention(@Param('id') id: string, @Body() dto: CancelInterventionDto, @CurrentUser() user: any) {
    return this.service.cancelIntervention(id, dto, user);
  }

  @Get('interventions/:id/events')
  events(@Param('id') id: string) {
    return this.service.events(id);
  }

  @Patch('interventions/:id/steps/:stepId/start')
  startStep(@Param('id') id: string, @Param('stepId') stepId: string, @Body() dto: StepReasonDto, @CurrentUser() user: any) {
    return this.service.stepStatus(id, stepId, PlaybookStepStatus.IN_PROGRESS, dto, user);
  }

  @Patch('interventions/:id/steps/:stepId/complete')
  completeStep(@Param('id') id: string, @Param('stepId') stepId: string, @Body() dto: StepReasonDto, @CurrentUser() user: any) {
    return this.service.stepStatus(id, stepId, PlaybookStepStatus.COMPLETED, dto, user);
  }

  @Patch('interventions/:id/steps/:stepId/skip')
  skipStep(@Param('id') id: string, @Param('stepId') stepId: string, @Body() dto: StepReasonDto, @CurrentUser() user: any) {
    return this.service.stepStatus(id, stepId, PlaybookStepStatus.SKIPPED, dto, user);
  }

  @Patch('interventions/:id/steps/:stepId/block')
  blockStep(@Param('id') id: string, @Param('stepId') stepId: string, @Body() dto: StepReasonDto, @CurrentUser() user: any) {
    return this.service.stepStatus(id, stepId, PlaybookStepStatus.BLOCKED, dto, user);
  }

  @Post('interventions/:id/steps/:stepId/create-task')
  createTask(@Param('id') id: string, @Param('stepId') stepId: string, @Body() dto: StepCreateTaskDto, @CurrentUser() user: any) {
    return this.service.stepCreateTask(id, stepId, dto, user);
  }

  @Post('interventions/:id/steps/:stepId/create-follow-up')
  createFollowUp(@Param('id') id: string, @Param('stepId') stepId: string, @Body() dto: StepCreateFollowUpDto, @CurrentUser() user: any) {
    return this.service.stepCreateFollowUp(id, stepId, dto, user);
  }

  @Post('interventions/:id/steps/:stepId/add-note')
  addNote(@Param('id') id: string, @Param('stepId') stepId: string, @Body() dto: StepAddNoteDto, @CurrentUser() user: any) {
    return this.service.stepAddNote(id, stepId, dto, user);
  }

  @Post('interventions/:id/steps/:stepId/record-contact')
  recordContact(@Param('id') id: string, @Param('stepId') stepId: string, @Body() dto: RecordContactDto, @CurrentUser() user: any) {
    return this.service.recordContact(id, stepId, dto, user);
  }

  @Get('recommendations')
  recommendations() {
    return this.service.recommendations();
  }

  @Post('recommendations/:id/start-playbook')
  startRecommendation(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.startRecommendation(id, user);
  }

  @Post('recommendations/:id/dismiss')
  dismissRecommendation(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.dismissRecommendation(id, user);
  }

  @Post('recommendations/:id/create-task')
  createRecommendationTask(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.createTaskFromRecommendation(id, user);
  }
}
