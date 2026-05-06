import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ApartmentsService } from './apartments.service';

@Controller(['apartments', 'api/apartments'])
export class ApartmentsController {
  constructor(private readonly apartmentsService: ApartmentsService) {}

  @Public()
  @Get()
  listApartments() {
    return this.apartmentsService.listApartments();
  }

  @Public()
  @Get(':id')
  getApartment(@Param('id') id: string) {
    return this.apartmentsService.getApartment(id);
  }
}
