import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, IsInt, Min, Max } from 'class-validator';
import { SavedViewDensity, SavedViewModule, SavedViewScope, SavedViewStatus } from '@prisma/client';

export class CreateSavedViewDto {
  @IsEnum(SavedViewModule)
  module: SavedViewModule;

  @IsEnum(SavedViewScope)
  scope: SavedViewScope;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsObject()
  filters: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  sort?: Record<string, unknown>;

  @IsOptional()
  columns?: unknown;

  @IsOptional()
  @IsEnum(SavedViewDensity)
  density?: SavedViewDensity;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  searchQuery?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}

export class UpdateSavedViewDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  sort?: Record<string, unknown>;

  @IsOptional()
  columns?: unknown;

  @IsOptional()
  @IsEnum(SavedViewDensity)
  density?: SavedViewDensity;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  searchQuery?: string;

  @IsOptional()
  @IsEnum(SavedViewStatus)
  status?: SavedViewStatus;
}

export class ToggleSavedViewDto {
  @IsBoolean()
  value: boolean;
}

export class UpdateModulePreferencesDto {
  @IsOptional()
  @IsString()
  defaultSavedViewId?: string;

  @IsOptional()
  columns?: unknown;

  @IsOptional()
  @IsEnum(SavedViewDensity)
  density?: SavedViewDensity;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(200)
  pageSize?: number;

  @IsOptional()
  @IsObject()
  sort?: Record<string, unknown>;
}
