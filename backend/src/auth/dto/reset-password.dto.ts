import { IsOptional, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  token: string;

  @IsString()
  @IsOptional()
  @MinLength(10)
  password?: string;

  @IsString()
  @IsOptional()
  @MinLength(10)
  newPassword?: string;
}
