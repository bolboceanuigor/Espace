import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { MetersService } from './meters.service';

@Controller(['meters', 'api/meters'])
export class MetersController {
  constructor(private readonly metersService: MetersService) {}

  @Public()
  @Get()
  listMeters() {
    return this.metersService.listMeters();
  }

  @Public()
  @Get(':id')
  getMeter(@Param('id') id: string) {
    return this.metersService.getMeter(id);
  }
}
