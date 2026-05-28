import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  BackupCheckStatus,
  BackupScope,
  LaunchChecklistSeverity,
  ProductionIncidentSeverity,
  ProductionIncidentStatus,
  RecoveryDrillStatus,
  RecoveryScenario,
} from '@prisma/client';

export class UpdateBackupChecklistItemDto {
  @IsOptional()
  @IsEnum(BackupCheckStatus)
  status?: BackupCheckStatus;

  @IsOptional()
  @IsEnum(LaunchChecklistSeverity)
  severity?: LaunchChecklistSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  evidence?: string;
}

export class UpsertBackupCheckDto {
  @IsEnum(BackupScope)
  scope: BackupScope;

  @IsEnum(BackupCheckStatus)
  status: BackupCheckStatus;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(1000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  providerName?: string;

  @IsOptional()
  @IsDateString()
  checkedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  backupLocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  backupReference?: string;

  @IsOptional()
  @IsDateString()
  backupDate?: string;

  @IsOptional()
  @IsBoolean()
  restoreTested?: boolean;

  @IsOptional()
  @IsDateString()
  restoreTestedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;
}

export class CreateRecoveryDrillDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(1000)
  description: string;

  @IsEnum(BackupScope)
  scope: BackupScope;

  @IsOptional()
  @IsEnum(RecoveryScenario)
  scenario?: RecoveryScenario;

  @IsOptional()
  @IsDateString()
  plannedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;
}

export class UpdateRecoveryDrillDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(RecoveryDrillStatus)
  status?: RecoveryDrillStatus;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  resultSummary?: string;

  @IsOptional()
  @IsArray()
  issuesFound?: string[];

  @IsOptional()
  @IsArray()
  actionsTaken?: string[];

  @IsOptional()
  @IsArray()
  nextActions?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;
}

export class CompleteRecoveryDrillDto {
  @IsEnum(RecoveryDrillStatus)
  status: RecoveryDrillStatus;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  resultSummary?: string;

  @IsOptional()
  @IsArray()
  issuesFound?: string[];

  @IsOptional()
  @IsArray()
  actionsTaken?: string[];

  @IsOptional()
  @IsArray()
  nextActions?: string[];
}

export class CreateProductionIncidentDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(2000)
  description: string;

  @IsEnum(ProductionIncidentSeverity)
  severity: ProductionIncidentSeverity;

  @IsOptional()
  @IsArray()
  affectedServices?: string[];

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class UpdateProductionIncidentDto {
  @IsOptional()
  @IsEnum(ProductionIncidentStatus)
  status?: ProductionIncidentStatus;

  @IsOptional()
  @IsEnum(ProductionIncidentSeverity)
  severity?: ProductionIncidentSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  rootCause?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  resolutionSummary?: string;

  @IsOptional()
  @IsArray()
  nextActions?: string[];

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class IncidentUpdateDto {
  @IsString()
  @MaxLength(3000)
  message: string;

  @IsOptional()
  @IsEnum(ProductionIncidentStatus)
  status?: ProductionIncidentStatus;
}
