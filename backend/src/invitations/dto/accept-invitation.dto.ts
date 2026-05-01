import { IsOptional, IsString, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @IsOptional()
  @IsString()
  @MinLength(20)
  token?: string;

  @IsString()
  @MinLength(10)
  password: string;
}
