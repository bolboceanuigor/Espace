import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class UpdateOrganizationLimitsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  maxApartments?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxBuildings?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxTeamMembers?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxResidents?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxStorageMb?: number | null;

  @IsOptional()
  @IsObject()
  modulesJson?: Record<string, boolean>;
}

