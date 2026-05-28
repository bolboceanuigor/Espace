import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  ClientAccountStatus,
  ClientFollowUpStatus,
  ClientLifecycleStage,
  ClientPriority,
  ClientRiskLevel,
  ClientSource,
  ClientTaskStatus,
} from '@prisma/client';

export class CreateClientAccountDto {
  @IsString()
  @MaxLength(180)
  displayName: string;

  @IsOptional() @IsString() associationId?: string;
  @IsOptional() @IsString() customerRequestId?: string;
  @IsOptional() @IsEnum(ClientLifecycleStage) lifecycleStage?: ClientLifecycleStage;
  @IsOptional() @IsEnum(ClientAccountStatus) status?: ClientAccountStatus;
  @IsOptional() @IsEnum(ClientPriority) priority?: ClientPriority;
  @IsOptional() @IsEnum(ClientSource) source?: ClientSource;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() associationName?: string;
  @IsOptional() @IsString() associationCode?: string;
  @IsOptional() apartmentsCount?: number;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @IsDateString() nextFollowUpAt?: string;
  @IsOptional() @IsString() internalNotes?: string;
}

export class UpdateClientAccountDto extends CreateClientAccountDto {
  @IsOptional() @IsEnum(ClientRiskLevel) riskLevel?: ClientRiskLevel;
}

export class ChangeClientStageDto {
  @IsEnum(ClientLifecycleStage)
  stage: ClientLifecycleStage;

  @IsOptional() @IsString() reason?: string;
}

export class ChangeClientStatusDto {
  @IsEnum(ClientAccountStatus)
  status: ClientAccountStatus;

  @IsOptional() @IsString() reason?: string;
}

export class ChangeClientPriorityDto {
  @IsEnum(ClientPriority)
  priority: ClientPriority;
}

export class ChangeClientOwnerDto {
  @IsOptional() @IsString() ownerUserId?: string;
}

export class ChangeClientRiskDto {
  @IsOptional() @IsEnum(ClientRiskLevel) riskLevel?: ClientRiskLevel;
  @IsOptional() @IsBoolean() recalculate?: boolean;
  @IsOptional() @IsString() reason?: string;
}

export class CloseClientDto {
  @IsString()
  reason: string;
}

export class LinkAssociationDto {
  @IsString()
  associationId: string;
}

export class CreateClientTaskDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(ClientPriority) priority?: ClientPriority;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() assignedToId?: string;
}

export class UpdateClientTaskDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(ClientTaskStatus) status?: ClientTaskStatus;
  @IsOptional() @IsEnum(ClientPriority) priority?: ClientPriority;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() assignedToId?: string;
}

export class CancelClientTaskDto {
  @IsString() reason: string;
}

export class CreateClientNoteDto {
  @IsString()
  note: string;

  @IsOptional() @IsBoolean()
  isPinned?: boolean;
}

export class UpdateClientNoteDto {
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsBoolean() isPinned?: boolean;
}

export class CreateClientFollowUpDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() dueAt: string;
  @IsOptional() @IsString() assignedToId?: string;
}

export class UpdateClientFollowUpDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsEnum(ClientFollowUpStatus) status?: ClientFollowUpStatus;
  @IsOptional() @IsString() assignedToId?: string;
}
