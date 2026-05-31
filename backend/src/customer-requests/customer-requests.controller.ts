import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard } from '../security/mvp-auth.guard';
import { CustomerRequestsService } from './customer-requests.service';
import {
  CreateCustomerOnboardingRequestDto,
  CustomerRequestAssignDto,
  CustomerRequestNoteDto,
  CustomerRequestPriorityDto,
  CustomerRequestStatusDto,
  CustomerRequestUpdateDto,
  CustomerRequestConvertDto,
} from './dto/customer-request.dto';

@Controller(['api/public/customer-requests', 'api/public/access-requests', 'public/access-requests'])
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

@Controller(['api/superadmin/customer-requests', 'api/superadmin/access-requests', 'superadmin/access-requests'])
@UseGuards(MvpAuthGuard, MvpRolesGuard)
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

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CustomerRequestUpdateDto) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/status')
  status(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CustomerRequestStatusDto) {
    return this.service.updateStatus(id, dto, user);
  }

  @Patch(':id/priority')
  priority(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CustomerRequestPriorityDto) {
    return this.service.updatePriority(id, dto, user);
  }

  @Post(':id/notes')
  notes(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CustomerRequestNoteDto) {
    return this.service.addNote(id, dto, user);
  }

  @Patch(':id/assign')
  assign(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CustomerRequestAssignDto) {
    return this.service.assign(id, dto, user);
  }

  @Post(':id/convert')
  convertAccessRequest(@Param('id') id: string, @Body() dto: CustomerRequestConvertDto, @CurrentUser() user: any) {
    return this.service.convertToOrganization(id, dto, user);
  }

  @Patch(':id/convert-to-association')
  convert(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.convertToAssociation(id, user);
  }
}
