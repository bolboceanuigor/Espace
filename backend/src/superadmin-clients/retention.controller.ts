import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AssignRetentionDto,
  CompleteRenewalDto,
  CompleteRetentionActionDto,
  CompleteRetentionPlanDto,
  CreateChurnRiskDto,
  CreateRenewalDto,
  CreateRetentionFollowUpDto,
  CreateRetentionPlanDto,
  CreateRetentionTaskDto,
  MarkRiskOutcomeDto,
  RetentionActionDto,
  RetentionNoteDto,
  UpdateChurnRiskDto,
  UpdateChurnRiskStatusDto,
  UpdateRenewalDto,
  UpdateRetentionPlanDto,
} from './dto/retention.dto';
import { RetentionService } from './retention.service';

@Controller('api/superadmin/retention')
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class RetentionController {
  constructor(private readonly service: RetentionService) {}

  @Get()
  home() {
    return this.service.dashboard();
  }

  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Get('reports')
  reports() {
    return this.service.reports();
  }

  @Get('reasons')
  reasons() {
    return {
      churnReasons: [
        'LOW_USAGE',
        'ONBOARDING_STUCK',
        'TRIAL_EXPIRING',
        'SUBSCRIPTION_EXPIRING',
        'SUBSCRIPTION_SUSPENDED',
        'PAYMENT_ISSUES',
        'SAAS_INVOICE_OVERDUE',
        'PRICE_CONCERN',
        'MISSING_FEATURE',
        'DATA_QUALITY_PROBLEMS',
        'SUPPORT_ISSUES',
        'TECHNICAL_ERRORS',
        'NO_FOLLOW_UP',
        'DECISION_DELAY',
        'SWITCHING_TO_OTHER_TOOL',
        'MANUAL',
        'OTHER',
      ],
      detectionRules: [
        'Health AT_RISK/CRITICAL sau score sub 50',
        'Trial expiră în 7 zile',
        'Subscription activă cu perioadă curentă aproape de final',
        'Subscription PAST_DUE/SUSPENDED',
        'Facturi SaaS restante sau collection cases active',
        'Follow-up-uri/taskuri întârziate',
        'Onboarding fără progres recent',
      ],
    };
  }

  @Get('churn-risk')
  risks(@Query() query: Record<string, string | undefined>) {
    return this.service.listRisks(query);
  }

  @Post('churn-risk')
  createRisk(@Body() dto: CreateChurnRiskDto, @CurrentUser() user: any) {
    return this.service.createRisk(dto, user);
  }

  @Post('churn-risk/detect')
  detect(@CurrentUser() user: any) {
    return this.service.detectAll(user);
  }

  @Post('churn-risk/detect/:clientId')
  detectClient(@Param('clientId') clientId: string, @CurrentUser() user: any) {
    return this.service.detectClient(clientId, user);
  }

  @Get('churn-risk/:id')
  risk(@Param('id') id: string) {
    return this.service.riskDetail(id);
  }

  @Patch('churn-risk/:id')
  updateRisk(@Param('id') id: string, @Body() dto: UpdateChurnRiskDto, @CurrentUser() user: any) {
    return this.service.updateRisk(id, dto, user);
  }

  @Patch('churn-risk/:id/status')
  riskStatus(@Param('id') id: string, @Body() dto: UpdateChurnRiskStatusDto, @CurrentUser() user: any) {
    return this.service.updateRiskStatus(id, dto, user);
  }

  @Patch('churn-risk/:id/assign')
  assignRisk(@Param('id') id: string, @Body() dto: AssignRetentionDto, @CurrentUser() user: any) {
    return this.service.assignRisk(id, dto, user);
  }

  @Post('churn-risk/:id/start-retention-plan')
  startRetentionPlan(@Param('id') id: string, @Body() dto: CreateRetentionPlanDto, @CurrentUser() user: any) {
    return this.service.createPlan({ ...dto, churnRiskId: id }, user);
  }

  @Post('churn-risk/:id/create-task')
  createRiskTask(@Param('id') id: string, @Body() dto: CreateRetentionTaskDto, @CurrentUser() user: any) {
    return this.service.createRiskTask(id, dto, user);
  }

  @Post('churn-risk/:id/create-follow-up')
  createRiskFollowUp(@Param('id') id: string, @Body() dto: CreateRetentionFollowUpDto, @CurrentUser() user: any) {
    return this.service.createRiskFollowUp(id, dto, user);
  }

  @Post('churn-risk/:id/notes')
  addRiskNote(@Param('id') id: string, @Body() dto: RetentionNoteDto, @CurrentUser() user: any) {
    return this.service.addRiskNote(id, dto, user);
  }

  @Post('churn-risk/:id/mark-saved')
  markRiskSaved(@Param('id') id: string, @Body() dto: MarkRiskOutcomeDto, @CurrentUser() user: any) {
    return this.service.markRiskSaved(id, dto, user);
  }

  @Post('churn-risk/:id/mark-lost')
  markRiskLost(@Param('id') id: string, @Body() dto: MarkRiskOutcomeDto, @CurrentUser() user: any) {
    return this.service.markRiskLost(id, dto, user);
  }

  @Post('churn-risk/:id/dismiss')
  dismissRisk(@Param('id') id: string, @Body() dto: MarkRiskOutcomeDto, @CurrentUser() user: any) {
    return this.service.dismissRisk(id, dto, user);
  }

  @Get('renewals')
  renewals(@Query() query: Record<string, string | undefined>) {
    return this.service.listRenewals(query);
  }

  @Post('renewals')
  createRenewal(@Body() dto: CreateRenewalDto, @CurrentUser() user: any) {
    return this.service.createRenewal(dto, user);
  }

  @Post('renewals/generate-from-subscriptions')
  generateRenewals(@CurrentUser() user: any) {
    return this.service.generateRenewalsFromSubscriptions(user);
  }

  @Get('renewals/:id')
  renewal(@Param('id') id: string) {
    return this.service.renewalDetail(id);
  }

  @Patch('renewals/:id')
  updateRenewal(@Param('id') id: string, @Body() dto: UpdateRenewalDto, @CurrentUser() user: any) {
    return this.service.updateRenewal(id, dto, user);
  }

  @Patch('renewals/:id/status')
  renewalStatus(@Param('id') id: string, @Body() dto: UpdateRenewalDto, @CurrentUser() user: any) {
    return this.service.updateRenewalStatus(id, dto, user);
  }

  @Post('renewals/:id/start')
  startRenewal(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.startRenewal(id, user);
  }

  @Post('renewals/:id/complete')
  completeRenewal(@Param('id') id: string, @Body() dto: CompleteRenewalDto, @CurrentUser() user: any) {
    return this.service.completeRenewal(id, dto, user);
  }

  @Post('renewals/:id/start-retention-plan')
  createRenewalPlan(@Param('id') id: string, @Body() dto: CreateRetentionPlanDto, @CurrentUser() user: any) {
    return this.service.createPlan({ ...dto, renewalId: id }, user);
  }

  @Post('renewals/:id/create-task')
  createRenewalTask(@Param('id') id: string, @Body() dto: CreateRetentionTaskDto, @CurrentUser() user: any) {
    return this.service.createRenewalTask(id, dto, user);
  }

  @Post('renewals/:id/create-follow-up')
  createRenewalFollowUp(@Param('id') id: string, @Body() dto: CreateRetentionFollowUpDto, @CurrentUser() user: any) {
    return this.service.createRenewalFollowUp(id, dto, user);
  }

  @Get('plans')
  plans(@Query() query: Record<string, string | undefined>) {
    return this.service.listPlans(query);
  }

  @Post('plans')
  createPlan(@Body() dto: CreateRetentionPlanDto, @CurrentUser() user: any) {
    return this.service.createPlan(dto, user);
  }

  @Get('plans/:id')
  plan(@Param('id') id: string) {
    return this.service.planDetail(id);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdateRetentionPlanDto, @CurrentUser() user: any) {
    return this.service.updatePlan(id, dto, user);
  }

  @Post('plans/:id/actions')
  createPlanAction(@Param('id') id: string, @Body() dto: RetentionActionDto, @CurrentUser() user: any) {
    return this.service.createPlanAction(id, dto, user);
  }

  @Patch('plans/:id/actions/:actionId')
  updatePlanAction(@Param('id') id: string, @Param('actionId') actionId: string, @Body() dto: RetentionActionDto, @CurrentUser() user: any) {
    return this.service.updatePlanAction(id, actionId, dto, user);
  }

  @Post('plans/:id/actions/:actionId/complete')
  completePlanAction(@Param('id') id: string, @Param('actionId') actionId: string, @Body() dto: CompleteRetentionActionDto, @CurrentUser() user: any) {
    return this.service.completePlanAction(id, actionId, dto, user);
  }

  @Post('plans/:id/complete')
  completePlan(@Param('id') id: string, @Body() dto: CompleteRetentionPlanDto, @CurrentUser() user: any) {
    return this.service.completePlan(id, dto, user);
  }

  @Post('plans/:id/cancel')
  cancelPlan(@Param('id') id: string, @Body() dto: MarkRiskOutcomeDto, @CurrentUser() user: any) {
    return this.service.cancelPlan(id, dto, user);
  }

  @Post('plans/:id/create-task')
  createPlanTask(@Param('id') id: string, @Body() dto: CreateRetentionTaskDto, @CurrentUser() user: any) {
    return this.service.createPlanTask(id, dto, user);
  }

  @Post('plans/:id/create-follow-up')
  createPlanFollowUp(@Param('id') id: string, @Body() dto: CreateRetentionFollowUpDto, @CurrentUser() user: any) {
    return this.service.createPlanFollowUp(id, dto, user);
  }

  @Get('clients/:clientId')
  clientRetention(@Param('clientId') clientId: string) {
    return this.service.clientRetention(clientId);
  }
}
