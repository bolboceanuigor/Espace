import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

const REMINDER_TRIGGER_TYPES = {
  BEFORE_DUE_DATE: 'BEFORE_DUE_DATE',
  AFTER_DUE_DATE: 'AFTER_DUE_DATE',
  DEBT_OVER_AMOUNT: 'DEBT_OVER_AMOUNT',
  MONTHLY_UNPAID: 'MONTHLY_UNPAID',
} as const;

export class UpsertReminderRuleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsEnum(REMINDER_TRIGGER_TYPES)
  triggerType!: 'BEFORE_DUE_DATE' | 'AFTER_DUE_DATE' | 'DEBT_OVER_AMOUNT' | 'MONTHLY_UNPAID';

  @IsOptional()
  @IsNumber()
  daysOffset?: number;

  @IsOptional()
  @IsNumber()
  debtThreshold?: number;

  @IsOptional()
  channelsJson?: any;

  @IsString()
  messageTemplate!: string;
}

export class UpdateApartmentReminderSettingsDto {
  @IsBoolean()
  remindersPaused!: boolean;

  @IsOptional()
  @IsString()
  pauseReason?: string;

  @IsOptional()
  @IsString()
  pausedUntil?: string;
}

