import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

  // Temporary MVP endpoint until the full backend guard stack is re-enabled.
  @Public()
  @Post()
  createMeter(@Body() body: unknown) {
    return this.metersService.createMeter(body);
  }

  // Temporary MVP endpoint until the full backend guard stack is re-enabled.
  @Public()
  @Post(':meterId/readings')
  addReading(@Param('meterId') meterId: string, @Body() body: unknown) {
    return this.metersService.addReading(meterId, body);
  }

  @Public()
  @Get(':id')
  getMeter(@Param('id') id: string) {
    return this.metersService.getMeter(id);
  }
}
