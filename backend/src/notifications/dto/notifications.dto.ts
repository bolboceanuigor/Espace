import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminNotificationFiltersDto {
  @IsOptional()
  @IsIn(['ANNOUNCEMENT', 'DOCUMENT', 'ISSUE', 'PAYMENT', 'INVOICE', 'VOTE', 'MAINTENANCE', 'SYSTEM'])
  type?: string;
}

export class AdminTestNotificationDto {
  @IsString()
  @MaxLength(180)
  title!: string;

  @IsString()
  @MaxLength(500)
  message!: string;

  @IsOptional()
  @IsIn(['ANNOUNCEMENT', 'DOCUMENT', 'ISSUE', 'PAYMENT', 'INVOICE', 'VOTE', 'MAINTENANCE', 'SYSTEM'])
  type?: string;
}

export class UpdateEmailIntegrationDto {
  @IsIn(['SMTP', 'SENDGRID', 'OTHER'])
  provider!: 'SMTP' | 'SENDGRID' | 'OTHER';

  @IsOptional()
  @IsObject()
  configJson?: Record<string, any>;

  @Type(() => Boolean)
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateTelegramIntegrationDto {
  @IsString()
  botToken!: string;

  @Type(() => Boolean)
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateSmsIntegrationDto {
  @IsIn(['TWILIO', 'OTHER'])
  provider!: 'TWILIO' | 'OTHER';

  @IsOptional()
  @IsObject()
  configJson?: Record<string, any>;

  @Type(() => Boolean)
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  telegramEnabled?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  inAppEnabled?: boolean;
}

export class SubscribePushDto {
  @IsString()
  endpoint!: string;

  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

