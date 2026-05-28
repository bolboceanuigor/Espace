import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import {
  ClientAccountStatus,
  ClientChecklistStatus,
  ClientContactStatus,
  ClientDecisionImpact,
  ClientDecisionStatus,
  ClientFileStorageProvider,
  ClientFollowUpSource,
  ClientFollowUpStatus,
  ClientKnowledgeCategory,
  ClientKnowledgeItemType,
  ClientKnowledgePriority,
  ClientKnowledgeVisibility,
  ClientKnownIssueSeverity,
  ClientKnownIssueStatus,
  ClientLinkStatus,
  ClientLifecycleStage,
  ClientPriority,
  ClientReminderSource,
  ClientRiskLevel,
  ClientSource,
  ClientTaskCategory,
  ClientTaskSource,
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
  @IsOptional() @IsString() clientAccountId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(ClientPriority) priority?: ClientPriority;
  @IsOptional() @IsEnum(ClientTaskCategory) category?: ClientTaskCategory;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsDateString() reminderAt?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsEnum(ClientTaskSource) source?: ClientTaskSource;
  @IsOptional() @IsString() relatedEntityType?: string;
  @IsOptional() @IsString() relatedEntityId?: string;
}

export class UpdateClientTaskDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(ClientTaskStatus) status?: ClientTaskStatus;
  @IsOptional() @IsEnum(ClientPriority) priority?: ClientPriority;
  @IsOptional() @IsEnum(ClientTaskCategory) category?: ClientTaskCategory;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsDateString() reminderAt?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsEnum(ClientTaskSource) source?: ClientTaskSource;
  @IsOptional() @IsString() relatedEntityType?: string;
  @IsOptional() @IsString() relatedEntityId?: string;
}

export class CancelClientTaskDto {
  @IsString() reason: string;
}

export class RescheduleClientTaskDto {
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsDateString() reminderAt?: string;
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
  @IsOptional() @IsString() clientAccountId?: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() dueAt: string;
  @IsOptional() @IsDateString() reminderAt?: string;
  @IsOptional() @IsEnum(ClientPriority) priority?: ClientPriority;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsEnum(ClientFollowUpSource) source?: ClientFollowUpSource;
  @IsOptional() @IsString() relatedEntityType?: string;
  @IsOptional() @IsString() relatedEntityId?: string;
}

export class UpdateClientFollowUpDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsDateString() reminderAt?: string;
  @IsOptional() @IsEnum(ClientFollowUpStatus) status?: ClientFollowUpStatus;
  @IsOptional() @IsEnum(ClientPriority) priority?: ClientPriority;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsEnum(ClientFollowUpSource) source?: ClientFollowUpSource;
  @IsOptional() @IsString() relatedEntityType?: string;
  @IsOptional() @IsString() relatedEntityId?: string;
}

export class CancelClientFollowUpDto {
  @IsOptional() @IsString() reason?: string;
}

export class RescheduleClientFollowUpDto {
  @IsDateString() dueAt: string;
  @IsOptional() @IsDateString() reminderAt?: string;
}

export class CreateClientReminderDto {
  @IsString() title: string;
  @IsOptional() @IsString() clientAccountId?: string;
  @IsOptional() @IsString() associationId?: string;
  @IsOptional() @IsString() taskId?: string;
  @IsOptional() @IsString() followUpId?: string;
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsEnum(ClientPriority) priority?: ClientPriority;
  @IsDateString() remindAt: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsEnum(ClientReminderSource) source?: ClientReminderSource;
  @IsOptional() @IsString() relatedEntityType?: string;
  @IsOptional() @IsString() relatedEntityId?: string;
}

export class SnoozeClientReminderDto {
  @IsDateString() snoozedUntil: string;
}

export class CreateClientKnowledgeItemDto {
  @IsString() title: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsEnum(ClientKnowledgeItemType) type?: ClientKnowledgeItemType;
  @IsOptional() @IsEnum(ClientKnowledgeCategory) category?: ClientKnowledgeCategory;
  @IsOptional() @IsEnum(ClientKnowledgePriority) priority?: ClientKnowledgePriority;
  @IsOptional() @IsEnum(ClientKnowledgeVisibility) visibility?: ClientKnowledgeVisibility;
  @IsOptional() @IsBoolean() isPinned?: boolean;
  @IsOptional() @IsString() tags?: string;
  @IsOptional() @IsString() relatedEntityType?: string;
  @IsOptional() @IsString() relatedEntityId?: string;
}

export class UpdateClientKnowledgeItemDto extends CreateClientKnowledgeItemDto {}

export class ArchiveClientKnowledgeDto {
  @IsOptional() @IsString() reason?: string;
}

export class CreateClientFileDto {
  @IsString() fileName: string;
  @IsOptional() @IsString() originalFileName?: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() fileSize?: number;
  @IsOptional() @IsEnum(ClientFileStorageProvider) storageProvider?: ClientFileStorageProvider;
  @IsOptional() @IsString() storagePath?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) externalUrl?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(ClientKnowledgeCategory) category?: ClientKnowledgeCategory;
}

export class UpdateClientFileDto extends CreateClientFileDto {}

export class CreateClientContactDto {
  @IsString() fullName: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() preferredContactMethod?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsEnum(ClientContactStatus) status?: ClientContactStatus;
}

export class UpdateClientContactDto extends CreateClientContactDto {}

export class CreateClientDecisionDto {
  @IsString() title: string;
  @IsString() description: string;
  @IsOptional() @IsDateString() decisionDate?: string;
  @IsOptional() @IsString() decidedBy?: string;
  @IsOptional() @IsEnum(ClientDecisionImpact) impact?: ClientDecisionImpact;
  @IsOptional() @IsEnum(ClientKnowledgeCategory) category?: ClientKnowledgeCategory;
  @IsOptional() @IsEnum(ClientDecisionStatus) status?: ClientDecisionStatus;
  @IsOptional() @IsString() relatedEntityType?: string;
  @IsOptional() @IsString() relatedEntityId?: string;
}

export class UpdateClientDecisionDto extends CreateClientDecisionDto {}

export class CreateClientKnownIssueDto {
  @IsString() title: string;
  @IsString() description: string;
  @IsOptional() @IsEnum(ClientKnownIssueStatus) status?: ClientKnownIssueStatus;
  @IsOptional() @IsEnum(ClientKnownIssueSeverity) severity?: ClientKnownIssueSeverity;
  @IsOptional() @IsEnum(ClientKnowledgeCategory) category?: ClientKnowledgeCategory;
  @IsOptional() @IsString() workaround?: string;
  @IsOptional() @IsString() resolution?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsString() relatedEntityType?: string;
  @IsOptional() @IsString() relatedEntityId?: string;
}

export class UpdateClientKnownIssueDto extends CreateClientKnownIssueDto {}

export class ResolveClientKnownIssueDto {
  @IsOptional() @IsString() resolution?: string;
}

export class CreateClientLinkDto {
  @IsString() title: string;
  @IsUrl({ require_protocol: true }) url: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(ClientKnowledgeCategory) category?: ClientKnowledgeCategory;
  @IsOptional() @IsEnum(ClientLinkStatus) status?: ClientLinkStatus;
}

export class UpdateClientLinkDto extends CreateClientLinkDto {}

export class CreateClientChecklistDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(ClientKnowledgeCategory) category?: ClientKnowledgeCategory;
  @IsOptional() @IsEnum(ClientChecklistStatus) status?: ClientChecklistStatus;
  @IsOptional() items?: unknown;
}

export class UpdateClientChecklistDto extends CreateClientChecklistDto {}
