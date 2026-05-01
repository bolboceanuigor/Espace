import { IsIn } from 'class-validator';

export class UploadImportDto {
  @IsIn(['BUILDINGS', 'STAIRCASES', 'APARTMENTS', 'RESIDENTS', 'INITIAL_BALANCES'])
  type!: 'BUILDINGS' | 'STAIRCASES' | 'APARTMENTS' | 'RESIDENTS' | 'INITIAL_BALANCES';
}
