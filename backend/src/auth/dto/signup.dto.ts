import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsString()
  organizationName: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}
