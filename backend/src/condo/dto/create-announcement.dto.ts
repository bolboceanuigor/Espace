import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title: string;

  @IsString()
  @MinLength(5)
  @MaxLength(3000)
  body: string;

  @IsOptional()
  @IsString()
  @IsIn(['OWNERS', 'ALL'])
  visibility?: 'OWNERS' | 'ALL';
}
