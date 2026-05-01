import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingsProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;
}
