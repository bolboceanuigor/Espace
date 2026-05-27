import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  LegalContactRequestStatus,
  LegalContactRequestType,
  LegalDocumentAudience,
  LegalDocumentStatus,
  LegalDocumentType,
} from '@prisma/client';

export class UpsertLegalDocumentDto {
  @IsString()
  @MaxLength(180)
  title: string;

  @IsString()
  @MaxLength(180)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(LegalDocumentType)
  type: LegalDocumentType;

  @IsEnum(LegalDocumentAudience)
  audience: LegalDocumentAudience;

  @IsOptional()
  @IsEnum(LegalDocumentStatus)
  status?: LegalDocumentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  locale?: string;

  @IsString()
  @MaxLength(50000)
  body: string;

  @IsString()
  @MaxLength(32)
  version: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLegalDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(LegalDocumentType)
  type?: LegalDocumentType;

  @IsOptional()
  @IsEnum(LegalDocumentAudience)
  audience?: LegalDocumentAudience;

  @IsOptional()
  @IsEnum(LegalDocumentStatus)
  status?: LegalDocumentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  version?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class LegalContactRequestDto {
  @IsString()
  @MaxLength(160)
  fullName: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;

  @IsString()
  @MaxLength(180)
  subject: string;

  @IsString()
  @MaxLength(5000)
  message: string;

  @IsEnum(LegalContactRequestType)
  requestType: LegalContactRequestType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @IsBoolean()
  consent: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  website?: string;
}

export class LegalContactStatusDto {
  @IsEnum(LegalContactRequestStatus)
  status: LegalContactRequestStatus;
}

export class LegalContactNoteDto {
  @IsString()
  @MaxLength(5000)
  note: string;
}

export class LegalListQueryDto {
  @IsOptional()
  @IsEnum(LegalDocumentType)
  type?: LegalDocumentType;

  @IsOptional()
  @IsEnum(LegalDocumentAudience)
  audience?: LegalDocumentAudience;

  @IsOptional()
  @IsEnum(LegalDocumentStatus)
  status?: LegalDocumentStatus;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  activeOnly?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
