import { IsArray, IsString } from 'class-validator';

export class AssignPropertiesDto {
  @IsArray()
  @IsString({ each: true })
  propertyIds: string[];
}
