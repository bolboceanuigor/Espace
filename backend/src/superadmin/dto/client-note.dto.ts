import { IsBoolean, IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClientNoteDto {
  @IsIn(['CALL', 'MEETING', 'SUPPORT', 'SALES', 'BILLING', 'OTHER'])
  type!: 'CALL' | 'MEETING' | 'SUPPORT' | 'SALES' | 'BILLING' | 'OTHER';

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(8000)
  content!: string;

  @IsOptional()
  @IsISO8601()
  followUpAt?: string;

  @IsOptional()
  @IsBoolean()
  isImportant?: boolean;
}

export class UpdateClientNoteDto {
  @IsOptional()
  @IsIn(['CALL', 'MEETING', 'SUPPORT', 'SALES', 'BILLING', 'OTHER'])
  type?: 'CALL' | 'MEETING' | 'SUPPORT' | 'SALES' | 'BILLING' | 'OTHER';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  content?: string;

  @IsOptional()
  @IsISO8601()
  followUpAt?: string;

  @IsOptional()
  @IsBoolean()
  isImportant?: boolean;
}
