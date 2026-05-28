import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import {
  ClientInterventionOutcome,
  ClientInterventionStatus,
  ClientPriority,
  CustomerSuccessPlaybookCategory,
  CustomerSuccessPlaybookStatus,
  CustomerSuccessTriggerType,
  PlaybookStepStatus,
  PlaybookStepType,
} from '@prisma/client';

export class CreatePlaybookStepDto {
  @IsInt()
  @Min(1)
  sortOrder!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(PlaybookStepType)
  stepType!: PlaybookStepType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  actionConfig?: unknown;

  @IsOptional()
  @IsString()
  expectedOutcome?: string;
}

export class CreateCustomerSuccessPlaybookDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(CustomerSuccessPlaybookCategory)
  category!: CustomerSuccessPlaybookCategory;

  @IsOptional()
  @IsEnum(CustomerSuccessPlaybookStatus)
  status?: CustomerSuccessPlaybookStatus;

  @IsOptional()
  @IsEnum(CustomerSuccessTriggerType)
  triggerType?: CustomerSuccessTriggerType;

  @IsOptional()
  triggerConfig?: unknown;

  @IsOptional()
  recommendedFor?: unknown;

  @IsOptional()
  @IsEnum(ClientPriority)
  defaultPriority?: ClientPriority;

  @IsOptional()
  @IsInt()
  estimatedDurationMinutes?: number;

  @IsOptional()
  steps?: CreatePlaybookStepDto[];
}

export class UpdateCustomerSuccessPlaybookDto extends CreateCustomerSuccessPlaybookDto {}

export class StartInterventionDto {
  @IsString()
  @IsNotEmpty()
  clientAccountId!: string;

  @IsOptional()
  @IsEnum(ClientPriority)
  priority?: ClientPriority;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  triggerReason?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  healthSnapshotId?: string;
}

export class CreateInterventionDto extends StartInterventionDto {
  @IsString()
  @IsNotEmpty()
  playbookId!: string;
}

export class UpdateInterventionDto {
  @IsOptional()
  @IsEnum(ClientInterventionStatus)
  status?: ClientInterventionStatus;

  @IsOptional()
  @IsEnum(ClientPriority)
  priority?: ClientPriority;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;
}

export class CompleteInterventionDto {
  @IsEnum(ClientInterventionOutcome)
  outcome!: ClientInterventionOutcome;

  @IsOptional()
  @IsString()
  outcomeNotes?: string;
}

export class CancelInterventionDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class StepReasonDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  result?: unknown;
}

export class StepCreateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;
}

export class StepCreateFollowUpDto extends StepCreateTaskDto {}

export class StepAddNoteDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  title?: string;
}

export class RecordContactDto {
  @IsString()
  @IsNotEmpty()
  method!: string;

  @IsOptional()
  @IsString()
  contactedAt?: string;

  @IsString()
  @IsNotEmpty()
  summary!: string;

  @IsOptional()
  @IsString()
  nextFollowUpAt?: string;
}
