import { IsString, IsIn } from 'class-validator';

export class ChangePlanDto {
  @IsString()
  @IsIn(['starter', 'pro', 'enterprise'])
  plan: string;
}
