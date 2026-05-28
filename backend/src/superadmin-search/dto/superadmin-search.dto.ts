import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveSuperadminSearchHistoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  selectedResultType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  selectedResultId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  selectedResultTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  selectedUrl?: string;
}
