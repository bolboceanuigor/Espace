import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(10)
  oldPassword!: string;

  @IsString()
  @MinLength(10)
  newPassword!: string;
}

