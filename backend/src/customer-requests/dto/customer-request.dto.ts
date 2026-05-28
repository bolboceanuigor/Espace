import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CustomerOnboardingRequestPriority,
  CustomerOnboardingRequestSource,
  CustomerOnboardingRequestStatus,
  CustomerOnboardingRequestType,
} from '@prisma/client';

export class CreateCustomerOnboardingRequestDto {
  @IsOptional()
  @IsEnum(CustomerOnboardingRequestType)
  type?: CustomerOnboardingRequestType;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  phone: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  associationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  associationCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apcCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  address?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  blocksCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20000)
  apartmentsCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contactRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  currentManagementMethod?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  interestedModules?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  preferredContactMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsEnum(CustomerOnboardingRequestSource)
  source?: CustomerOnboardingRequestSource;

  @IsBoolean()
  consent: boolean;

  @IsOptional()
  @IsString()
  website?: string;
}

export class CustomerRequestStatusDto {
  @IsEnum(CustomerOnboardingRequestStatus)
  status: CustomerOnboardingRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  closeReason?: string;
}

export class CustomerRequestPriorityDto {
  @IsEnum(CustomerOnboardingRequestPriority)
  priority: CustomerOnboardingRequestPriority;
}

export class CustomerRequestNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  note: string;
}

export class CustomerRequestAssignDto {
  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class CustomerRequestUpdateDto {
  @IsOptional()
  @IsEnum(CustomerOnboardingRequestStatus)
  status?: CustomerOnboardingRequestStatus;

  @IsOptional()
  @IsEnum(CustomerOnboardingRequestPriority)
  priority?: CustomerOnboardingRequestPriority;

  @IsOptional()
  @IsString()
  assignedToId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  internalNote?: string | null;

  @IsOptional()
  @IsString()
  lastContactedAt?: string | null;
}
