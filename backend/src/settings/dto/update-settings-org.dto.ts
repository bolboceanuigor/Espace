import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class BrandingMenuItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  key!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  @Min(0)
  order!: number;
}

export class UpdateSettingsOrgDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(['ro', 'ru', 'en'])
  defaultLocale?: 'ro' | 'ru' | 'en';

  @IsOptional()
  @IsIn(['MONDAY', 'SUNDAY'])
  weekStart?: 'MONDAY' | 'SUNDAY';

  @IsOptional()
  @IsString()
  @MaxLength(160)
  appName?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  sidebarColor?: string;

  @IsOptional()
  @IsIn(['LIGHT', 'DARK'])
  themeMode?: 'LIGHT' | 'DARK';

  @IsOptional()
  @IsString()
  @MaxLength(3000000)
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BrandingMenuItemDto)
  menuConfig?: BrandingMenuItemDto[];
}
