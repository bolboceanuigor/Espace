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
  dashboardDensity?: string;

  @IsOptional()
  @IsString()
  dashboardStatusFilter?: string;

  @IsOptional()
  @IsString()
  dashboardGroupId?: string;

  @IsOptional()
  @IsBoolean()
  welcomeDismissed?: boolean;
}
