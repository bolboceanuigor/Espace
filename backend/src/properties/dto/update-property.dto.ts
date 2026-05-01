import { PartialType } from '@nestjs/mapped-types';
import { CreatePropertyDto } from './create-property.dto';

/** All fields optional; same validation rules as create when provided. */
export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}
