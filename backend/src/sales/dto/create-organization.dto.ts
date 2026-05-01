import { IsString, IsEmail, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  organizationName: string;

  @IsEmail()
  ownerEmail: string;

  @IsString()
  ownerFirstName: string;

  @IsString()
  ownerLastName: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  ownerPassword: string;
}
