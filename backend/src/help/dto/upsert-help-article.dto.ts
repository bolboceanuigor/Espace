import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { HelpArticleStatus, HelpArticleType, HelpAudience, HelpCategoryStatus } from '@prisma/client';

const LEGACY_TARGET_ROLES = ['ALL', 'SUPER_ADMIN', 'ADMIN', 'RESIDENT'] as const;
const LEGACY_CATEGORIES = ['GETTING_STARTED', 'PAYMENTS', 'INVOICES', 'RESIDENTS', 'ISSUES', 'SETTINGS', 'OTHER'] as const;

export class UpsertHelpArticleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(HelpArticleType)
  type?: HelpArticleType;

  @IsOptional()
  @IsEnum(HelpArticleStatus)
  status?: HelpArticleStatus;

  @IsOptional()
  @IsArray()
  audience?: HelpAudience[];

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(12)
  locale?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isContextual?: boolean;

  @IsOptional()
  @IsString()
  relatedRoute?: string;

  @IsOptional()
  @IsString()
  relatedModule?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(LEGACY_TARGET_ROLES)
  targetRole?: (typeof LEGACY_TARGET_ROLES)[number];

  @IsOptional()
  @IsEnum(LEGACY_CATEGORIES)
  category?: (typeof LEGACY_CATEGORIES)[number];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpsertHelpCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsArray()
  audience?: HelpAudience[];

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(HelpCategoryStatus)
  status?: HelpCategoryStatus;
}

export class HelpFeedbackDto {
  @IsBoolean()
  helpful: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsString()
  route?: string;
}

export class OnboardingProgressDto {
  @IsString()
  @IsNotEmpty()
  guideKey: string;

  @IsOptional()
  @IsArray()
  completedSteps?: string[];

  @IsOptional()
  @IsArray()
  skippedSteps?: string[];
}
