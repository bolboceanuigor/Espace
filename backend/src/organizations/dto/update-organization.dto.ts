import { IsString, IsOptional, MinLength, IsBoolean, IsIn } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['ro', 'ru', 'en'])
  defaultLocale?: string;

  @IsOptional()
  @IsString()
  @IsIn(['MONDAY', 'SUNDAY'])
  weekStart?: 'MONDAY' | 'SUNDAY';
}
