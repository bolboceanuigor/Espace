import { IsUUID } from 'class-validator';

export class ListSuperadminUsersDto {
  @IsUUID()
  orgId: string;
}

