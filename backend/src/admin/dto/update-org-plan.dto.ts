import { IsString, IsIn } from 'class-validator';

export class UpdateOrgPlanDto {
  @IsString()
  @IsIn(['starter', 'pro', 'enterprise'])
  plan: string;
}
