import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SupplierFiltersDto {
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateSupplierDto {
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name!: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  serviceType?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  serviceType?: string;
}

export class MaintenanceTaskFiltersDto {
  @IsOptional()
  @IsIn(['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status?: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  buildingId?: string;
}

export class CreateMaintenanceTaskDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['PLANNED', 'REACTIVE'])
  type!: 'PLANNED' | 'REACTIVE';

  @IsOptional()
  @IsString()
  relatedIssueId?: string;

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsString()
  staircaseId?: string;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @IsIn(['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status?: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateMaintenanceTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['PLANNED', 'REACTIVE'])
  type?: 'PLANNED' | 'REACTIVE';

  @IsOptional()
  @IsString()
  relatedIssueId?: string | null;

  @IsOptional()
  @IsString()
  buildingId?: string | null;

  @IsOptional()
  @IsString()
  staircaseId?: string | null;

  @IsOptional()
  @IsString()
  assignedToUserId?: string | null;

  @IsOptional()
  @IsIn(['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status?: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;
}

export class TechnicianUpdateTaskDto {
  @IsOptional()
  @IsIn(['IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ExpenseFiltersDto {
  @IsOptional()
  @IsIn(['REPAIR', 'CLEANING', 'UTILITIES', 'SALARY', 'OTHER'])
  category?: 'REPAIR' | 'CLEANING' | 'UTILITIES' | 'SALARY' | 'OTHER';

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateExpenseDto {
  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  maintenanceTaskId?: string;

  @IsIn(['REPAIR', 'CLEANING', 'UTILITIES', 'SALARY', 'OTHER'])
  category!: 'REPAIR' | 'CLEANING' | 'UTILITIES' | 'SALARY' | 'OTHER';

  @IsString()
  @MinLength(2)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsIn(['MDL', 'EUR', 'USD'])
  currency!: 'MDL' | 'EUR' | 'USD';

  @IsDateString()
  expenseDate!: string;

  @IsIn(['CASH', 'BANK', 'CARD'])
  paidBy!: 'CASH' | 'BANK' | 'CARD';

  @IsOptional()
  @IsString()
  invoiceNumber?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  supplierId?: string | null;

  @IsOptional()
  @IsString()
  maintenanceTaskId?: string | null;

  @IsOptional()
  @IsIn(['REPAIR', 'CLEANING', 'UTILITIES', 'SALARY', 'OTHER'])
  category?: 'REPAIR' | 'CLEANING' | 'UTILITIES' | 'SALARY' | 'OTHER';

  @IsOptional()
  @IsString()
  @MinLength(2)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsIn(['MDL', 'EUR', 'USD'])
  currency?: 'MDL' | 'EUR' | 'USD';

  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @IsOptional()
  @IsIn(['CASH', 'BANK', 'CARD'])
  paidBy?: 'CASH' | 'BANK' | 'CARD';

  @IsOptional()
  @IsString()
  invoiceNumber?: string | null;
}

export class CreateExpenseAttachmentDto {
  @IsString()
  fileUrl!: string;

  @IsString()
  fileName!: string;
}

export class MaintenanceEventFiltersDto {
  @IsOptional()
  @IsIn(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateMaintenanceEventDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['ORGANIZATION', 'BUILDING', 'STAIRCASE', 'APARTMENT'])
  targetType!: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE' | 'APARTMENT';

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsString()
  staircaseId?: string;

  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsIn(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsBoolean()
  notifyResidents?: boolean;
}

export class UpdateMaintenanceEventDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['ORGANIZATION', 'BUILDING', 'STAIRCASE', 'APARTMENT'])
  targetType?: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE' | 'APARTMENT';

  @IsOptional()
  @IsString()
  buildingId?: string | null;

  @IsOptional()
  @IsString()
  staircaseId?: string | null;

  @IsOptional()
  @IsString()
  apartmentId?: string | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsIn(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsBoolean()
  notifyResidents?: boolean;
}

