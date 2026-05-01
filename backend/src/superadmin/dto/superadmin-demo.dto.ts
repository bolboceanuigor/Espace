import { IsString } from 'class-validator';

export class ResetDemoDataDto {
  @IsString()
  confirmText!: string;
}
