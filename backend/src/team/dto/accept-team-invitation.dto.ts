import { IsString, MinLength } from 'class-validator';

export class AcceptTeamInvitationDto {
  @IsString()
  @MinLength(10)
  password: string;
}

