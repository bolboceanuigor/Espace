import {
  ClientChurnReason,
  ClientChurnRiskSeverity,
  ClientChurnRiskStatus,
  ClientPriority,
  ClientRenewalOutcome,
  ClientRenewalStatus,
  ClientRetentionActionStatus,
  ClientRetentionActionType,
  ClientRetentionPlanOutcome,
  ClientRetentionPlanStatus,
  ChurnRiskSource,
} from '@prisma/client';

export class CreateChurnRiskDto {
  clientAccountId!: string;
  reason?: ClientChurnReason;
  severity?: ClientChurnRiskSeverity;
  title!: string;
  description?: string;
  score?: number;
  source?: ChurnRiskSource;
  assignedToId?: string;
  nextFollowUpAt?: string;
}

export class UpdateChurnRiskDto {
  title?: string;
  description?: string;
  severity?: ClientChurnRiskSeverity;
  score?: number;
  nextFollowUpAt?: string;
}

export class UpdateChurnRiskStatusDto {
  status!: ClientChurnRiskStatus;
  reason?: string;
}

export class AssignRetentionDto {
  assignedToId?: string;
}

export class RetentionNoteDto {
  note?: string;
}

export class CreateRetentionTaskDto {
  title?: string;
  dueAt?: string;
  assignedToId?: string;
}

export class CreateRetentionFollowUpDto {
  title?: string;
  dueAt!: string;
  assignedToId?: string;
}

export class MarkRiskOutcomeDto {
  note?: string;
}

export class CreateRenewalDto {
  clientAccountId!: string;
  subscriptionId?: string;
  renewalDate!: string;
  proposedPlanId?: string;
  proposedMonthlyValue?: number;
}

export class UpdateRenewalDto {
  renewalDate?: string;
  status?: ClientRenewalStatus;
  outcome?: ClientRenewalOutcome;
  proposedPlanId?: string;
  proposedMonthlyValue?: number;
  assignedToId?: string;
}

export class CompleteRenewalDto {
  outcome!: ClientRenewalOutcome;
  outcomeNotes?: string;
}

export class CreateRetentionPlanDto {
  clientAccountId?: string;
  churnRiskId?: string;
  renewalId?: string;
  title?: string;
  goal?: string;
  priority?: ClientPriority;
  dueAt?: string;
  ownerUserId?: string;
}

export class UpdateRetentionPlanDto {
  title?: string;
  description?: string;
  goal?: string;
  status?: ClientRetentionPlanStatus;
  priority?: ClientPriority;
  dueAt?: string;
  ownerUserId?: string;
}

export class RetentionActionDto {
  actionType!: ClientRetentionActionType;
  title!: string;
  description?: string;
  priority?: ClientPriority;
  dueAt?: string;
  assignedToId?: string;
  status?: ClientRetentionActionStatus;
}

export class CompleteRetentionActionDto {
  resultNote?: string;
}

export class CompleteRetentionPlanDto {
  outcome!: ClientRetentionPlanOutcome;
  outcomeNotes?: string;
}
