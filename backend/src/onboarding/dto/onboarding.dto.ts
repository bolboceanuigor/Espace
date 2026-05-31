import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

const ONBOARDING_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  READY_FOR_LAUNCH: 'READY_FOR_LAUNCH',
  LAUNCHED: 'LAUNCHED',
  BLOCKED: 'BLOCKED',
  COMPLETED: 'COMPLETED',
} as const;

export class UpdateOnboardingStepDto {
  @IsOptional()
  @IsString()
  onboardingStep?: string;

  @IsOptional()
  @IsEnum(ONBOARDING_STATUS)
  onboardingStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'READY_FOR_LAUNCH' | 'LAUNCHED' | 'BLOCKED' | 'COMPLETED';

  @IsOptional()
  @IsBoolean()
  buildingsCreated?: boolean;

  @IsOptional()
  @IsBoolean()
  apartmentsImported?: boolean;

  @IsOptional()
  @IsBoolean()
  residentsImported?: boolean;

  @IsOptional()
  @IsBoolean()
  tariffsConfigured?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentProviderConfigured?: boolean;

  @IsOptional()
  @IsBoolean()
  firstInvoicesGenerated?: boolean;
}
