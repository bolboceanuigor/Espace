import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEmailTemplateDto {
  @IsString()
  @MaxLength(120)
  key!: string;

  @IsString()
  @MaxLength(180)
  name!: string;

  @IsString()
  @MaxLength(320)
  subject!: string;

  @IsString()
  @MaxLength(20000)
  body!: string;

  @IsIn(['ADMIN', 'RESIDENT', 'TEAM', 'ALL'])
  targetRole!: 'ADMIN' | 'RESIDENT' | 'TEAM' | 'ALL';

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string;

  @IsOptional()
  @IsIn(['ADMIN', 'RESIDENT', 'TEAM', 'ALL'])
  targetRole?: 'ADMIN' | 'RESIDENT' | 'TEAM' | 'ALL';

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
