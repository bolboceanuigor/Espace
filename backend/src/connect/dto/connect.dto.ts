import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const CONNECT_TYPES = [
  'GENERAL',
  'APARTMENT',
  'INVOICE',
  'PAYMENT',
  'PAYMENT_PROOF',
  'METER_READING',
  'SERVICE_TICKET',
  'DOCUMENT',
  'ANNOUNCEMENT',
  'SYSTEM',
] as const;

export const CONNECT_STATUSES = [
  'OPEN',
  'PENDING_RESIDENT',
  'PENDING_ADMIN',
  'RESOLVED',
  'CLOSED',
  'ARCHIVED',
] as const;

export const CONNECT_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const CONNECT_MESSAGE_TYPES = ['TEXT', 'SYSTEM', 'ATTACHMENT', 'IMAGE', 'DOCUMENT'] as const;

export class ListConnectConversationsDto {
  @IsOptional()
  @IsIn(CONNECT_STATUSES)
  status?: (typeof CONNECT_STATUSES)[number];

  @IsOptional()
  @IsIn(CONNECT_TYPES)
  type?: (typeof CONNECT_TYPES)[number];

  @IsOptional()
  @IsIn(CONNECT_PRIORITIES)
  priority?: (typeof CONNECT_PRIORITIES)[number];

  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsString()
  residentUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  onlyUnread?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ListConnectResidentsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreateAdminConnectConversationDto {
  @IsString()
  residentUserId!: string;

  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsIn(CONNECT_TYPES)
  type?: (typeof CONNECT_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsIn(CONNECT_PRIORITIES)
  priority?: (typeof CONNECT_PRIORITIES)[number];

  @IsOptional()
  @IsString()
  relatedInvoiceId?: string | null;

  @IsOptional()
  @IsString()
  relatedServiceTicketId?: string | null;

  @IsOptional()
  @IsString()
  relatedMeterReadingId?: string | null;

  @IsOptional()
  @IsString()
  relatedPaymentProofId?: string | null;

  @IsOptional()
  @IsString()
  relatedDocumentId?: string | null;

  @IsOptional()
  @IsString()
  relatedAnnouncementId?: string | null;
}

export class CreateResidentConnectConversationDto {
  @IsString()
  apartmentId!: string;

  @IsOptional()
  @IsIn(CONNECT_TYPES)
  type?: (typeof CONNECT_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsString()
  relatedInvoiceId?: string | null;

  @IsOptional()
  @IsString()
  relatedServiceTicketId?: string | null;

  @IsOptional()
  @IsString()
  relatedMeterReadingId?: string | null;

  @IsOptional()
  @IsString()
  relatedPaymentProofId?: string | null;

  @IsOptional()
  @IsString()
  relatedDocumentId?: string | null;
}

export class CreateConnectMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsIn(CONNECT_MESSAGE_TYPES)
  messageType?: (typeof CONNECT_MESSAGE_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  attachmentFileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  attachmentMimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50_000_000)
  attachmentFileSize?: number;
}

export class UpdateAdminConnectConversationDto {
  @IsOptional()
  @IsIn(CONNECT_STATUSES)
  status?: (typeof CONNECT_STATUSES)[number];

  @IsOptional()
  @IsIn(CONNECT_PRIORITIES)
  priority?: (typeof CONNECT_PRIORITIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  internalNote?: string | null;

  @IsOptional()
  @IsString()
  adminUserId?: string | null;
}

export class ConnectResolutionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  close?: string;
}
