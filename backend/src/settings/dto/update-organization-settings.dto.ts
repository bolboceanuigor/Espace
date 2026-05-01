import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateOrganizationSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  fiscalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankAccountIban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  bankSwift?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  paymentInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  treasurerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  administratorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000000)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  invoicePrefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  receiptPrefix?: string;

  @IsOptional()
  @IsIn(['MDL', 'EUR', 'USD'])
  defaultCurrency?: 'MDL' | 'EUR' | 'USD';
}
