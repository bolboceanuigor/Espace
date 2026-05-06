import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ResidentsService } from './residents.service';

@Controller(['residents', 'api/residents'])
export class ResidentsController {
  constructor(private readonly residentsService: ResidentsService) {}

  @Public()
  @Get()
  listResidents() {
    return this.residentsService.listResidents();
  }

  @Public()
  @Get(':id')
  getResident(@Param('id') id: string) {
    return this.residentsService.getResident(id);
  }
}
