import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

  // Temporary MVP endpoint until the full backend guard stack is re-enabled.
  @Public()
  @Post()
  createApartment(@Body() body: unknown) {
    return this.apartmentsService.createApartment(body);
  }

  @Public()
  @Get(':id')
  getApartment(@Param('id') id: string) {
    return this.apartmentsService.getApartment(id);
  }
}
