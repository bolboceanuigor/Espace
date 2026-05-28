import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import {
  BillingCurrency,
  PaymentPromiseStatus,
  RevenueCollectionContactMethod,
  RevenueCollectionPriority,
  RevenueCollectionStatus,
} from '@prisma/client';

export class CreateCollectionCaseDto {
  @IsString()
  saasInvoiceId!: string;

  @IsOptional()
  @IsEnum(RevenueCollectionPriority)
  priority?: RevenueCollectionPriority;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCollectionStatusDto {
  @IsEnum(RevenueCollectionStatus)
  status!: RevenueCollectionStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateCollectionPriorityDto {
  @IsEnum(RevenueCollectionPriority)
  priority!: RevenueCollectionPriority;
}

export class AssignCollectionCaseDto {
  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class CollectionNoteDto {
  @IsString()
  note!: string;

  @IsOptional()
  @IsEnum(RevenueCollectionContactMethod)
  contactMethod?: RevenueCollectionContactMethod;

  @IsOptional()
  @IsString()
  contactedPerson?: string;

  @IsOptional()
  @IsString()
  nextStep?: string;
}

export class RecordCollectionContactDto extends CollectionNoteDto {
  @IsOptional()
  @IsString()
  nextFollowUpAt?: string;
}

export class CreatePaymentPromiseDto {
  @IsNumber()
  @Min(0.01)
  promisedAmount!: number;

  @IsOptional()
  @IsEnum(BillingCurrency)
  currency?: BillingCurrency;

  @IsString()
  promisedDate!: string;

  @IsOptional()
  @IsString()
  promisedByName?: string;

  @IsOptional()
  @IsString()
  promisedByContact?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ScheduleCollectionFollowUpDto {
  @IsString()
  dueAt!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class CreateCollectionTaskDto {
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

export class CloseCollectionCaseDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsEnum(RevenueCollectionStatus)
  status?: RevenueCollectionStatus;
}

export class CancelPaymentPromiseDto {
  @IsString()
  reason!: string;
}

export class UpdatePaymentPromiseStatusDto {
  @IsOptional()
  @IsEnum(PaymentPromiseStatus)
  status?: PaymentPromiseStatus;
}
