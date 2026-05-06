import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

  // Temporary MVP endpoint until the full backend guard stack is re-enabled.
  @Public()
  @Post()
  createResident(@Body() body: unknown) {
    return this.residentsService.createResident(body);
  }

  @Public()
  @Get(':id')
  getResident(@Param('id') id: string) {
    return this.residentsService.getResident(id);
  }
}
