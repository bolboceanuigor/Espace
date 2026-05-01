import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  @IsIn(['ro', 'ru', 'en'])
  locale?: string;

  @IsOptional()
  @IsBoolean()
  sidebarLabels?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['sm', 'md', 'lg'])
  calendarZoom?: string;

  @IsOptional()
  @IsString()
  calendarStatusFilter?: string;

  @IsOptional()
  @IsString()
  calendarGroupId?: string;

  @IsOptional()
  @IsBoolean()
  welcomeDismissed?: boolean;
}
