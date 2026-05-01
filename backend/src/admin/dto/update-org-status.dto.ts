import { IsBoolean } from 'class-validator';

export class UpdateOrgStatusDto {
  @IsBoolean()
  isActive: boolean;
}
