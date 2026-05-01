import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ReleaseNotesFiltersDto {
  @IsOptional()
  @IsIn(['ALL', 'SUPER_ADMIN', 'ADMIN', 'RESIDENT'])
  targetRole?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isPublished?: boolean;
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
  @IsIn(['ALL', 'SUPER_ADMIN', 'ADMIN', 'RESIDENT'])
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
  @IsIn(['ALL', 'SUPER_ADMIN', 'ADMIN', 'RESIDENT'])
  targetRole?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
