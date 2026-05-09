import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListSuperadminTasksDto {
  @IsOptional()
  @IsIn(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @IsOptional()
  @IsIn(['OVERDUE', 'TODAY', 'UPCOMING'])
  dueFilter?: 'OVERDUE' | 'TODAY' | 'UPCOMING';

  @IsOptional()
  @IsIn(['ORGANIZATION', 'LEAD', 'DEMO_REQUEST', 'FEATURE_REQUEST', 'SUPPORT'])
  relatedType?: 'ORGANIZATION' | 'LEAD' | 'DEMO_REQUEST' | 'FEATURE_REQUEST' | 'SUPPORT';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relatedId?: string;
}

export class CreateSuperadminTaskDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsOptional()
  @IsIn(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @IsOptional()
  @IsIn(['ORGANIZATION', 'LEAD', 'DEMO_REQUEST', 'FEATURE_REQUEST', 'SUPPORT'])
  relatedType?: 'ORGANIZATION' | 'LEAD' | 'DEMO_REQUEST' | 'FEATURE_REQUEST' | 'SUPPORT';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relatedId?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;
}

export class UpdateSuperadminTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsOptional()
  @IsIn(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @IsOptional()
  @IsIn(['ORGANIZATION', 'LEAD', 'DEMO_REQUEST', 'FEATURE_REQUEST', 'SUPPORT'])
  relatedType?: 'ORGANIZATION' | 'LEAD' | 'DEMO_REQUEST' | 'FEATURE_REQUEST' | 'SUPPORT';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relatedId?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;
}
