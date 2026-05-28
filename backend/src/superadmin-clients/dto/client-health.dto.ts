import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { ClientHealthStatus, ClientPriority } from '@prisma/client';

export class ClientHealthOverrideDto {
  @IsOptional()
  @IsEnum(ClientHealthStatus)
  overrideStatus?: ClientHealthStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  overrideScore?: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class DismissClientHealthActionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateHealthTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class CreateHealthFollowUpDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class UpdateHealthActionDto {
  @IsOptional()
  @IsEnum(ClientPriority)
  priority?: ClientPriority;

  @IsOptional()
  @IsBoolean()
  accepted?: boolean;
}
