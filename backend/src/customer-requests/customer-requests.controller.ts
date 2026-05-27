import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CustomerRequestsService } from './customer-requests.service';
import {
  CreateCustomerOnboardingRequestDto,
  CustomerRequestAssignDto,
  CustomerRequestNoteDto,
  CustomerRequestPriorityDto,
  CustomerRequestStatusDto,
} from './dto/customer-request.dto';

@Controller('api/public/customer-requests')
export class PublicCustomerRequestsController {
  constructor(private readonly service: CustomerRequestsService) {}

  @Post()
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  create(@Body() dto: CreateCustomerOnboardingRequestDto, @Req() req: any) {
    return this.service.createPublic(dto, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
      path: req.originalUrl || req.url,
    });
  }
}

@Controller('api/superadmin/customer-requests')
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminCustomerRequestsController {
  constructor(private readonly service: CustomerRequestsService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>) {
    return this.service.list(query);
  }

  @Get('stats')
  stats() {
    return this.service.stats();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id/status')
  status(@Param('id') id: string, @Body() dto: CustomerRequestStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Patch(':id/priority')
  priority(@Param('id') id: string, @Body() dto: CustomerRequestPriorityDto) {
    return this.service.updatePriority(id, dto);
  }

  @Post(':id/notes')
  notes(@Param('id') id: string, @Body() dto: CustomerRequestNoteDto) {
    return this.service.addNote(id, dto);
  }

  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body() dto: CustomerRequestAssignDto) {
    return this.service.assign(id, dto);
  }

  @Patch(':id/convert-to-association')
  convert(@Param('id') id: string) {
    return this.service.convertToAssociation(id);
  }
}
