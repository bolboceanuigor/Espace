import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
