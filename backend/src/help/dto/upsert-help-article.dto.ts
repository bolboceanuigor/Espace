import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const TARGET_ROLES = ['ALL', 'SUPER_ADMIN', 'ADMIN', 'RESIDENT'] as const;
const CATEGORIES = ['GETTING_STARTED', 'PAYMENTS', 'INVOICES', 'RESIDENTS', 'ISSUES', 'SETTINGS', 'OTHER'] as const;

export class UpsertHelpArticleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  slug: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(TARGET_ROLES)
  targetRole: (typeof TARGET_ROLES)[number];

  @IsEnum(CATEGORIES)
  category: (typeof CATEGORIES)[number];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

