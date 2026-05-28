import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const TARGET_ROLES = ['ALL', 'SUPER_ADMIN', 'ADMIN', 'RESIDENT'];
const RELEASE_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'];
const UPDATE_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const UPDATE_TYPES = ['FEATURE', 'IMPROVEMENT', 'FIX', 'SECURITY', 'DEPRECATION', 'NOTICE'];
const UPDATE_VISIBILITIES = ['PUBLIC_CHANGELOG', 'IN_APP_ONLY', 'INTERNAL_ONLY'];
const UPDATE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

export class ReleaseNotesFiltersDto {
  @IsOptional()
  @IsIn(TARGET_ROLES)
  targetRole?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsIn(TARGET_ROLES)
  audience?: string;

  @IsOptional()
  @IsIn(UPDATE_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(UPDATE_VISIBILITIES)
  visibility?: string;

  @IsOptional()
  @IsIn(UPDATE_TYPES)
  updateType?: string;

  @IsOptional()
  @IsString()
  releaseId?: string;
}

export class CreateReleaseNoteDto {
  @IsString()
  @MaxLength(220)
  title!: string;

  @IsString()
  @MaxLength(12000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  version?: string;

  @IsOptional()
  @IsIn(TARGET_ROLES)
  targetRole?: string;
}

export class UpdateReleaseNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(220)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  version?: string;

  @IsOptional()
  @IsIn(TARGET_ROLES)
  targetRole?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class ProductReleaseFiltersDto {
  @IsOptional()
  @IsIn(RELEASE_STATUSES)
  status?: string;
}

export class CreateProductReleaseDto {
  @IsString()
  @MaxLength(80)
  version!: string;

  @IsString()
  @MaxLength(220)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  summary?: string;

  @IsOptional()
  @IsIn(RELEASE_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  publicSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  internalNotes?: string;
}

export class UpdateProductReleaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  summary?: string;

  @IsOptional()
  @IsIn(RELEASE_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  publicSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  internalNotes?: string;
}

export class ProductUpdateFiltersDto {
  @IsOptional()
  @IsIn(TARGET_ROLES)
  audience?: string;

  @IsOptional()
  @IsIn(UPDATE_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(UPDATE_VISIBILITIES)
  visibility?: string;

  @IsOptional()
  @IsIn(UPDATE_TYPES)
  updateType?: string;

  @IsOptional()
  @IsString()
  releaseId?: string;
}

export class CreateProductUpdateDto {
  @IsOptional()
  @IsString()
  productReleaseId?: string;

  @IsString()
  @MaxLength(220)
  title!: string;

  @IsString()
  @MaxLength(600)
  summary!: string;

  @IsString()
  @MaxLength(12000)
  body!: string;

  @IsOptional()
  @IsIn(UPDATE_TYPES)
  updateType?: string;

  @IsOptional()
  @IsIn(UPDATE_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(TARGET_ROLES)
  audience?: string;

  @IsOptional()
  @IsIn(UPDATE_VISIBILITIES)
  visibility?: string;

  @IsOptional()
  @IsIn(UPDATE_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  moduleKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  version?: string;

  @IsOptional()
  @IsBoolean()
  requiresAcknowledgement?: boolean;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  linkedFeatureRequestId?: string;

  @IsOptional()
  @IsString()
  linkedFeedbackId?: string;
}

export class UpdateProductUpdateDto {
  @IsOptional()
  @IsString()
  productReleaseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  body?: string;

  @IsOptional()
  @IsIn(UPDATE_TYPES)
  updateType?: string;

  @IsOptional()
  @IsIn(UPDATE_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(TARGET_ROLES)
  audience?: string;

  @IsOptional()
  @IsIn(UPDATE_VISIBILITIES)
  visibility?: string;

  @IsOptional()
  @IsIn(UPDATE_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  moduleKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  version?: string;

  @IsOptional()
  @IsBoolean()
  requiresAcknowledgement?: boolean;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  linkedFeatureRequestId?: string;

  @IsOptional()
  @IsString()
  linkedFeedbackId?: string;
}
